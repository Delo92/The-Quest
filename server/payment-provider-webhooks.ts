import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { getFirestore } from "./firebase-admin";
import { failPayment } from "./payment-security";
import {
  getBuyerPaymentConfig,
  getPayPalAccessToken,
  getPayPalApiBase,
} from "./buyer-payment-providers";

function verifyStripeSignature(rawBody: Buffer, header: string, secret: string): boolean {
  try {
    const values = Object.fromEntries(header.split(",").map((part) => {
      const index = part.indexOf("=");
      return index === -1 ? [part, ""] : [part.slice(0, index), part.slice(index + 1)];
    }));
    const timestamp = Number(values.t);
    const signature = values.v1;
    if (!timestamp || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
    const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
    return signature.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function recordEvent(provider: string, eventId: string, payload: unknown) {
  const ref = getFirestore().collection("paymentProviderWebhookEvents").doc(`${provider}_${eventId}`);
  return getFirestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) return false;
    transaction.create(ref, {
      provider,
      eventId,
      payload,
      receivedAt: new Date().toISOString(),
    });
    return true;
  });
}

async function findPaymentAttempt(transactionId?: string, idempotencyKey?: string) {
  const db = getFirestore();
  if (transactionId) {
    const byTransaction = await db.collection("paymentAttempts")
      .where("transactionId", "==", transactionId).limit(1).get();
    if (!byTransaction.empty) return byTransaction.docs[0];
  }
  if (idempotencyKey) {
    const paymentId = crypto.createHash("sha256").update(idempotencyKey).digest("hex");
    const byId = await db.collection("paymentAttempts").doc(paymentId).get();
    if (byId.exists) return byId;
  }
  return null;
}

async function markWebhookConfirmed(input: {
  provider: string;
  eventType: string;
  transactionId?: string;
  idempotencyKey?: string;
  status?: "succeeded" | "failed";
}) {
  const attempt = await findPaymentAttempt(input.transactionId, input.idempotencyKey);
  if (!attempt) {
    console.warn("[PaymentWebhook] No payment attempt matched event", input);
    return;
  }
  const update: Record<string, unknown> = {
    latestWebhookEvent: input.eventType,
    webhookProvider: input.provider,
    webhookConfirmedAt: new Date().toISOString(),
  };
  if (input.status === "failed" && attempt.data()?.status === "processing") {
    await failPayment(attempt.id, new Error(`${input.provider} payment failed`));
    return;
  }
  await attempt.ref.set(update, { merge: true });
}

async function verifyPayPalWebhook(req: Request, config: Awaited<ReturnType<typeof getBuyerPaymentConfig>>) {
  if (!config.paypalWebhookId) return false;
  const token = await getPayPalAccessToken(config);
  const response = await fetch(`${getPayPalApiBase(config.paypalEnvironment)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: req.header("paypal-auth-algo"),
      cert_url: req.header("paypal-cert-url"),
      transmission_id: req.header("paypal-transmission-id"),
      transmission_sig: req.header("paypal-transmission-sig"),
      transmission_time: req.header("paypal-transmission-time"),
      webhook_id: config.paypalWebhookId,
      webhook_event: req.body,
    }),
  });
  if (!response.ok) return false;
  const result = await response.json() as { verification_status?: string };
  return result.verification_status === "SUCCESS";
}

export function registerPaymentProviderWebhooks(app: Express) {
  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from("");
    const signature = req.header("stripe-signature");
    const config = await getBuyerPaymentConfig();
    if (!signature || !rawBody.length || !config.stripeWebhookSecret
      || !verifyStripeSignature(rawBody, signature, config.stripeWebhookSecret)) {
      return res.status(401).json({ message: "Invalid Stripe webhook signature" });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ message: "Invalid Stripe webhook body" });
    }
    const isNew = await recordEvent("stripe", String(event.id || ""), event);
    res.json({ received: true, duplicate: !isNew });
    if (!isNew) return;

    const object = event.data?.object || {};
    const transactionId = event.type.startsWith("payment_intent.")
      ? String(object.id || "")
      : String(object.payment_intent || "");
    const idempotencyKey = object.metadata?.idempotencyKey;
    if (event.type === "payment_intent.succeeded" || event.type === "checkout.session.completed") {
      await markWebhookConfirmed({
        provider: "stripe",
        eventType: event.type,
        transactionId,
        idempotencyKey,
        status: "succeeded",
      });
    } else if (event.type === "payment_intent.payment_failed") {
      await markWebhookConfirmed({
        provider: "stripe",
        eventType: event.type,
        transactionId,
        idempotencyKey,
        status: "failed",
      });
    }
  });

  app.post("/api/webhooks/paypal", async (req: Request, res: Response) => {
    const config = await getBuyerPaymentConfig();
    try {
      if (!(await verifyPayPalWebhook(req, config))) {
        return res.status(401).json({ message: "Invalid PayPal webhook signature" });
      }
    } catch (error) {
      console.error("[PayPalWebhook] Verification failed:", error);
      return res.status(401).json({ message: "Invalid PayPal webhook signature" });
    }
    const event = req.body || {};
    const isNew = await recordEvent("paypal", String(event.id || ""), event);
    res.json({ received: true, duplicate: !isNew });
    if (!isNew) return;

    const orderId = event.resource?.supplementary_data?.related_ids?.order_id
      || event.resource?.custom_id;
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      await markWebhookConfirmed({
        provider: "paypal",
        eventType: event.event_type,
        transactionId: orderId ? `paypal_${orderId}` : undefined,
        status: "succeeded",
      });
    } else if (event.event_type === "PAYMENT.CAPTURE.DENIED" || event.event_type === "PAYMENT.CAPTURE.DECLINED") {
      await markWebhookConfirmed({
        provider: "paypal",
        eventType: event.event_type,
        transactionId: orderId ? `paypal_${orderId}` : undefined,
        status: "failed",
      });
    }
  });
}