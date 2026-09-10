import crypto from "node:crypto";
import admin from "firebase-admin";
import { getFirestore } from "../firebase-admin";

type PurchaseFeedStatus = "pending" | "delivered";

export interface OCPurchaseItem {
  sku: string;
  name: string;
  quantity: number;
  amountCents: number;
}

export interface OCPurchasePayload {
  eventId: string;
  eventType: "purchase.updated";
  purchaseId: string;
  orderId?: string | null;
  sourceSystem: string;
  processor: "authorize_net";
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded" | "partially_refunded";
  currency: "usd";
  amountCents: number;
  taxCents?: number;
  feeCents?: number;
  customer?: {
    email?: string;
    name?: string;
  };
  items?: OCPurchaseItem[];
  paymentMethod?: string;
  occurredAt: string;
  externalReferences?: Record<string, string>;
}

interface StoredFeedEvent {
  eventId: string;
  payload: OCPurchasePayload;
  status: PurchaseFeedStatus;
  attempts: number;
  nextAttemptAt?: admin.firestore.Timestamp;
}

const FEED_COLLECTION = "ocPurchaseFeedEvents";
const MAX_ATTEMPTS_PER_DELIVERY = 3;
const RETRY_BASE_DELAY_MS = 500;
const DELIVERY_TIMEOUT_MS = 15_000;

function isEnabled(): boolean {
  return process.env.OC_PURCHASE_FEED_ENABLED === "true";
}

function getConfig(): { url: string; apiKey: string } {
  const url = process.env.OC_PURCHASE_FEED_URL?.trim();
  const apiKey = process.env.OC_PURCHASE_FEED_API_KEY?.trim();
  if (!url || !apiKey) {
    throw new Error("OC purchase feed is enabled but not configured");
  }
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("OC purchase feed URL must use HTTP or HTTPS");
  }
  return { url, apiKey };
}

function documentId(eventId: string): string {
  return crypto.createHash("sha256").update(eventId).digest("hex");
}

function backoff(attempt: number): number {
  return RETRY_BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0);
}

function shouldRetry(error: unknown): boolean {
  const status = Number((error as { status?: number })?.status);
  return !Number.isFinite(status) || status === 429 || status >= 500;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postPurchase(payload: OCPurchasePayload): Promise<"accepted" | "duplicate"> {
  const { url, apiKey } = getConfig();
  // The exact serialized bytes are signed and sent unchanged.
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = `sha256=${crypto
    .createHmac("sha256", apiKey)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex")}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-oc-api-key": apiKey,
        "x-oc-timestamp": timestamp,
        "x-oc-signature": signature,
      },
      body,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) return result?.duplicate ? "duplicate" : "accepted";
    if (response.status === 409) return "duplicate";

    const error = Object.assign(
      new Error(`OC purchase feed failed (${response.status})`),
      { status: response.status },
    );
    if (response.status >= 400 && response.status < 500) {
      const detail = typeof result?.message === "string" ? `: ${result.message}` : "";
      error.message += detail;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function markDelivered(ref: FirebaseFirestore.DocumentReference, attempts: number) {
  await ref.set({
    status: "delivered",
    attempts,
    deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastError: admin.firestore.FieldValue.delete(),
    nextAttemptAt: admin.firestore.FieldValue.delete(),
  }, { merge: true });
}

async function markPending(
  ref: FirebaseFirestore.DocumentReference,
  attempts: number,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  await ref.set({
    status: "pending",
    attempts,
    lastError: message.slice(0, 500),
    nextAttemptAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + backoff(attempts))),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function deliverStoredEvent(
  ref: FirebaseFirestore.DocumentReference,
  stored: StoredFeedEvent,
): Promise<void> {
  if (stored.status === "delivered") return;

  let attempts = Number(stored.attempts) || 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_DELIVERY; attempt += 1) {
    attempts += 1;
    try {
      const result = await postPurchase(stored.payload);
      await markDelivered(ref, attempts);
      console.info("[OCPurchaseFeed] Purchase event delivered", {
        eventId: stored.eventId,
        result,
      });
      return;
    } catch (error) {
      if (!shouldRetry(error) || attempt === MAX_ATTEMPTS_PER_DELIVERY) {
        await markPending(ref, attempts, error);
        console.warn("[OCPurchaseFeed] Delivery deferred", {
          eventId: stored.eventId,
          attempts,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      await wait(backoff(attempt));
    }
  }
}

export async function queueOCPurchase(
  input: Omit<OCPurchasePayload, "eventType" | "sourceSystem" | "processor" | "status" | "currency">,
): Promise<void> {
  await queueOCEvent({
    ...input,
    status: "paid",
  });
}

async function queueOCEvent(
  input: Omit<OCPurchasePayload, "eventType" | "sourceSystem" | "processor" | "currency">,
): Promise<void> {
  if (!isEnabled()) return;

  const payload: OCPurchasePayload = {
    ...input,
    eventType: "purchase.updated",
    sourceSystem: process.env.OC_SOURCE_SYSTEM?.trim() || "cbpublishing",
    processor: "authorize_net",
    currency: "usd",
    amountCents: Math.max(0, Math.round(input.amountCents)),
    occurredAt: input.occurredAt || new Date().toISOString(),
  };
  const ref = getFirestore().collection(FEED_COLLECTION).doc(documentId(payload.eventId));
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.create({
      eventId: payload.eventId,
      purchaseId: payload.purchaseId,
      payload,
      status: "pending",
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      nextAttemptAt: admin.firestore.Timestamp.now(),
    });
  }

  const current = await ref.get();
  if (!current.exists) throw new Error("OC purchase feed event disappeared before delivery");
  await deliverStoredEvent(ref, current.data() as StoredFeedEvent);
}

function getWebhookPurchaseId(route: string, response: any): string | null {
  if (route.endsWith("/guest/checkout")) {
    const id = response?.purchase?.id;
    return id === undefined || id === null ? null : `vote_${id}`;
  }
  if (route.endsWith("/join/submit")) {
    return response?.id ? `join_${response.id}` : null;
  }
  if (route.endsWith("/join/nominate")) {
    return response?.id ? `nomination_${response.id}` : null;
  }
  if (route.endsWith("/host/submit")) {
    return response?.id ? `host_${response.id}` : null;
  }
  return null;
}

function getWebhookStatus(eventType: string): OCPurchasePayload["status"] | null {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("refund.created")) return "refunded";
  if (normalized.includes("refund.failed")) return "failed";
  if (normalized.includes("void.created")) return "cancelled";
  if (normalized.includes("chargeback.created") || normalized.includes("dispute.created")) return "failed";
  if (normalized.includes("authcapture.failed") || normalized.includes("authcapture.declined")) return "failed";
  // The initial auth/capture is mirrored after the source record is created.
  if (normalized.includes("authcapture.created")) return null;
  return null;
}

export async function mirrorAuthorizeNetWebhook(payload: any): Promise<void> {
  if (!isEnabled()) return;

  const eventType = String(payload?.eventType || "");
  const status = getWebhookStatus(eventType);
  if (!status) return;

  const transactionId = String(payload?.payload?.id || payload?.payload?.transId || "");
  const notificationId = String(payload?.notificationId || "");
  if (!transactionId || !notificationId) return;

  const attemptSnapshot = await getFirestore()
    .collection("paymentAttempts")
    .where("transactionId", "==", transactionId)
    .limit(1)
    .get();
  const attempt = attemptSnapshot.docs[0]?.data();
  if (!attempt) {
    console.warn("[OCPurchaseFeed] No payment attempt matched webhook", { transactionId, eventType });
    return;
  }

  const purchaseId = getWebhookPurchaseId(String(attempt.route || ""), attempt.response);
  if (!purchaseId) {
    console.warn("[OCPurchaseFeed] Could not infer purchase ID from webhook", {
      transactionId,
      route: attempt.route,
    });
    return;
  }

  const response = attempt.response || {};
  const customerEmail = response?.guestEmail
    || response?.email
    || response?.purchase?.guestEmail
    || attempt.customerEmail
    || undefined;
  const customerName = response?.guestName
    || response?.name
    || response?.purchase?.guestName
    || attempt.customerName
    || undefined;

  await queueOCEvent({
    eventId: `${purchaseId}:${status}:${notificationId}`,
    purchaseId,
    orderId: transactionId,
    status,
    amountCents: Math.max(0, Number(attempt.amountCents) || 0),
    customer: customerEmail || customerName ? { email: customerEmail, name: customerName } : undefined,
    occurredAt: typeof payload?.eventDate === "string" ? payload.eventDate : new Date().toISOString(),
    externalReferences: {
      sourcePaymentId: String(attempt.idempotencyKeyHash || ""),
      sourceNotificationId: notificationId,
      sourcePath: String(attempt.route || ""),
    },
  });
}

export async function retryPendingOCPurchaseFeedEvents(): Promise<void> {
  if (!isEnabled()) return;

  const now = admin.firestore.Timestamp.now();
  let snapshot: FirebaseFirestore.QuerySnapshot;
  try {
    snapshot = await getFirestore()
      .collection(FEED_COLLECTION)
      .where("status", "==", "pending")
      .where("nextAttemptAt", "<=", now)
      .orderBy("nextAttemptAt", "asc")
      .limit(25)
      .get();
  } catch {
    snapshot = await getFirestore()
      .collection(FEED_COLLECTION)
      .where("status", "==", "pending")
      .limit(25)
      .get();
  }

  await Promise.all(snapshot.docs.map(async (doc) => {
    const stored = doc.data() as StoredFeedEvent;
    if (stored.nextAttemptAt && stored.nextAttemptAt.toMillis() > Date.now()) return;
    await deliverStoredEvent(doc.ref, stored);
  }));
}

export function startOCPurchaseFeedWorker(): void {
  if (!isEnabled()) return;
  void retryPendingOCPurchaseFeedEvents().catch((error) => {
    console.warn("[OCPurchaseFeed] Initial retry sweep failed:", error instanceof Error ? error.message : String(error));
  });
  const timer = setInterval(() => {
    void retryPendingOCPurchaseFeedEvents().catch((error) => {
      console.warn("[OCPurchaseFeed] Retry sweep failed:", error instanceof Error ? error.message : String(error));
    });
  }, 60_000);
  timer.unref?.();
}