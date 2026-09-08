import crypto from "crypto";
import admin from "firebase-admin";
import { getFirestore } from "./firebase-admin";

export type PaymentStatus = "processing" | "charged" | "completed" | "failed";

export interface PaymentRequest {
  idempotencyKey: string;
  route: string;
  amountCents: number;
  ownerKey: string;
  packageKey: string;
  competitionId?: number | null;
  contestantId?: number | null;
}

const PAYMENT_RATE_WINDOW_MS = 60 * 60 * 1000;
const PAYMENT_RATE_LIMIT = 10;

function paymentDocId(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function rateLimitDocId(scope: string, value: string): string {
  return crypto.createHash("sha256").update(`${scope}:${value}`).digest("hex");
}

/**
 * Limits charge attempts by both source IP and normalized customer email.
 * The counter is stored in Firestore so the limit remains effective when
 * requests are handled by different application instances.
 */
export async function enforcePaymentVelocity(ip: string, email?: string): Promise<void> {
  const scopes = [
    ["ip", ip || "unknown"],
    ...(email ? [["email", email.trim().toLowerCase()] as const] : []),
  ] as const;
  const now = Date.now();

  await Promise.all(scopes.map(async ([scope, value]) => {
    const ref = getFirestore().collection("paymentRateLimits").doc(rateLimitDocId(scope, value));
    await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const storedAttempts = Array.isArray(snap.data()?.attempts) ? snap.data()!.attempts : [];
      const recentAttempts = storedAttempts
        .map((timestamp: unknown) => Number(timestamp))
        .filter((timestamp: number) => Number.isFinite(timestamp) && now - timestamp < PAYMENT_RATE_WINDOW_MS);

      if (recentAttempts.length >= PAYMENT_RATE_LIMIT) {
        throw Object.assign(new Error("Too many payment attempts. Please try again later."), {
          status: 429,
          retryAfterSeconds: Math.ceil((recentAttempts[0] + PAYMENT_RATE_WINDOW_MS - now) / 1000),
        });
      }

      tx.set(ref, {
        attempts: [...recentAttempts, now],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }));
}

function requestHash(request: PaymentRequest): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      route: request.route,
      amountCents: request.amountCents,
      ownerKey: request.ownerKey,
      packageKey: request.packageKey,
      competitionId: request.competitionId ?? null,
      contestantId: request.contestantId ?? null,
    }))
    .digest("hex");
}

export async function reservePayment(request: PaymentRequest): Promise<{
  state: "reserved" | "processing" | "charged" | "completed";
  paymentId: string;
  response?: unknown;
  transactionId?: string;
}> {
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(request.idempotencyKey)) {
    throw Object.assign(new Error("A valid idempotency key is required"), { status: 400 });
  }

  const paymentId = paymentDocId(request.idempotencyKey);
  const ref = getFirestore().collection("paymentAttempts").doc(paymentId);
  const hash = requestHash(request);

  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const existing = snap.data()!;
      if (existing.requestHash !== hash) {
        throw Object.assign(new Error("Idempotency key was reused for a different payment"), { status: 409 });
      }
      if (existing.status === "completed") {
        return { state: "completed" as const, paymentId, response: existing.response, transactionId: existing.transactionId };
      }
      if (existing.status === "charged") {
        return { state: "charged" as const, paymentId, transactionId: existing.transactionId };
      }
      if (existing.status === "processing") {
        return { state: "processing" as const, paymentId };
      }
      // Failed requests may be retried with the same key only if no gateway charge occurred.
    }

    tx.set(ref, {
      ...request,
      idempotencyKeyHash: paymentId,
      requestHash: hash,
      status: "processing",
      attemptCount: admin.firestore.FieldValue.increment(1),
      createdAt: snap.exists ? snap.data()!.createdAt : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { state: "reserved" as const, paymentId };
  });
}

export async function markPaymentCharged(paymentId: string, transactionId: string, gateway: Record<string, unknown>) {
  const ref = getFirestore().collection("paymentAttempts").doc(paymentId);
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Payment reservation not found");
    const data = snap.data()!;
    if (data.transactionId && data.transactionId !== transactionId) {
      throw new Error("Payment reservation already has a different transaction");
    }
    tx.update(ref, {
      status: "charged",
      transactionId,
      gateway,
      chargedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export async function completePayment(paymentId: string, response: unknown) {
  await getFirestore().collection("paymentAttempts").doc(paymentId).update({
    status: "completed",
    response,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function failPayment(paymentId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await getFirestore().collection("paymentAttempts").doc(paymentId).set({
    status: "failed",
    failureMessage: message.substring(0, 500),
    failedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export function verifyAuthorizeNetWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const signatureKey = process.env.AUTHORIZE_NET_SIGNATURE_KEY;
  if (!signatureKey || !signatureHeader || !rawBody?.length) return false;
  const supplied = signatureHeader.replace(/^sha512=/i, "").trim();
  if (!/^[a-f0-9]{128}$/i.test(supplied) || !/^[a-f0-9]+$/i.test(signatureKey)) return false;
  const expected = crypto.createHmac("sha512", Buffer.from(signatureKey, "hex")).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export async function recordAuthorizeNetWebhook(payload: any) {
  const notificationId = String(payload?.notificationId || "");
  if (!notificationId) throw Object.assign(new Error("Missing notificationId"), { status: 400 });
  const ref = getFirestore().collection("authnetWebhookEvents").doc(notificationId);
  const transactionId = String(payload?.payload?.id || payload?.payload?.transId || "");
  const created = await getFirestore().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return false;
    tx.create(ref, {
      notificationId,
      eventType: payload?.eventType || "unknown",
      transactionId: transactionId || null,
      payload,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!created) return { duplicate: true };
  if (transactionId) {
    const attempts = await getFirestore().collection("paymentAttempts").where("transactionId", "==", transactionId).limit(1).get();
    if (!attempts.empty) {
      await attempts.docs[0].ref.set({
        latestWebhookEvent: payload?.eventType || "unknown",
        webhookConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
  return { duplicate: false };
}