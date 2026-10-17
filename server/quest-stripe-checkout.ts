import crypto from "node:crypto";
import type Stripe from "stripe";
import { getFirestore } from "./firebase-admin";
import { enforcePaymentVelocity } from "./payment-security";

export type StripeOrder = {
  purpose: "join" | "nominate" | "host" | "vote";
  competitionId?: unknown;
  contestantId?: unknown;
  stageId?: unknown;
  packageId?: unknown;
  packageIndex?: unknown;
  individualVoteCount?: unknown;
  selectedPackageName?: unknown;
  promoCode?: unknown;
};

export function stripeOrderFingerprint(order: StripeOrder): string {
  const fields: (keyof StripeOrder)[] = order.purpose === "host"
    ? ["purpose", "selectedPackageName"]
    : order.purpose === "nominate" ? ["purpose", "competitionId", "promoCode"]
    : order.purpose === "join" ? ["purpose", "competitionId"]
    : ["purpose", "competitionId", "contestantId", "stageId", "packageId", "packageIndex", "individualVoteCount"];
  return crypto.createHash("sha256").update(JSON.stringify(fields.map((field) =>
    order[field] == null || order[field] === "" ? null : String(order[field]).trim(),
  ))).digest("hex");
}

/** Reserve before exposing any chargeable client secret. Never silently route to OC. */
export async function createQuestStripeIntent(stripe: Stripe, input: {
  idempotencyKey: string;
  order: StripeOrder;
  amountCents: number;
  description: string;
  email?: string;
  billingAddress?: { address?: string; city?: string; state?: string; zip?: string };
  ip: string;
}, dependencies: {
  firestore?: ReturnType<typeof getFirestore>;
  enforceVelocity?: typeof enforcePaymentVelocity;
} = {}) {
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(input.idempotencyKey)) {
    throw Object.assign(new Error("A valid idempotency key is required"), { status: 400 });
  }
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw Object.assign(new Error("Invalid payment amount"), { status: 400 });
  }
  if (![input.billingAddress?.address, input.billingAddress?.city, input.billingAddress?.state, input.billingAddress?.zip]
    .every((value) => typeof value === "string" && value.trim())) {
    throw Object.assign(new Error("Billing address is required for payment"), { status: 400 });
  }
  const fingerprint = stripeOrderFingerprint(input.order);
  const requestHash = crypto.createHash("sha256").update(JSON.stringify({
    fingerprint, amount: input.amountCents, email: input.email?.trim().toLowerCase() || "",
    billing: input.billingAddress,
  })).digest("hex");
  await (dependencies.enforceVelocity || enforcePaymentVelocity)(input.ip, input.email);
  const id = crypto.createHash("sha256").update(input.idempotencyKey).digest("hex");
  const db = dependencies.firestore || getFirestore();
  const ref = db.collection("questStripeCheckouts").doc(id);
  const existingIntent = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) {
      const existing = snapshot.data()!;
      if (existing.requestHash !== requestHash) {
        throw Object.assign(new Error("Idempotency key was reused for a different payment"), { status: 409 });
      }
      if (existing.intentId) return String(existing.intentId);
      // Stripe retains idempotency results for at least 24 hours. An unresolved
      // older create must be reconciled, not submitted as a potentially new charge.
      if (Date.now() - existing.createdAt > 23 * 60 * 60 * 1000) {
        throw Object.assign(new Error("Payment requires reconciliation before retrying"), { status: 409 });
      }
      return null;
    }
    tx.create(ref, { requestHash, fingerprint, amountCents: input.amountCents, createdAt: Date.now() });
    return null;
  });
  if (existingIntent) return stripe.paymentIntents.retrieve(existingIntent);
  const intent = await stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: "usd",
    payment_method_types: ["card"],
    receipt_email: input.email?.trim() || undefined,
    description: input.description,
    metadata: {
      source: "the-quest-direct",
      idempotencyKey: input.idempotencyKey,
      orderFingerprint: fingerprint,
      purpose: input.order.purpose,
    },
  }, { idempotencyKey: `quest-direct:${input.idempotencyKey}` });
  await ref.set({ intentId: intent.id }, { merge: true });
  return intent;
}

export function assertQuestStripePayment(intent: Stripe.PaymentIntent, input: {
  idempotencyKey: string;
  amountCents: number;
  order: StripeOrder;
}) {
  if (intent.status !== "succeeded" || intent.currency !== "usd"
    || intent.amount !== input.amountCents || intent.amount_received !== input.amountCents
    || intent.metadata.source !== "the-quest-direct"
    || intent.metadata.idempotencyKey !== input.idempotencyKey
    || intent.metadata.orderFingerprint !== stripeOrderFingerprint(input.order)) {
    throw Object.assign(new Error("Stripe payment has not completed for this order"), { status: 400 });
  }
}
