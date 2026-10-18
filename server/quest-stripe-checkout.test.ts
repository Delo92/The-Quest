import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { createQuestStripeIntent, assertQuestStripePayment, stripeOrderFingerprint, type StripeOrder } from "./quest-stripe-checkout";
import { verifyStripeSignature } from "./payment-provider-webhooks";

const order: StripeOrder = { purpose: "vote", competitionId: 21, contestantId: 7, stageId: "final", packageId: "individual", individualVoteCount: 2 };
const input = {
  idempotencyKey: "test-order-1234567890",
  order, amountCents: 200, description: "2 votes",
  email: "buyer@example.invalid", ip: "127.0.0.1",
  billingAddress: { address: "123 Test", city: "Test", state: "TX", zip: "75001" },
};

function fixture() {
  let record: Record<string, any> | undefined;
  let createCount = 0;
  let velocityCount = 0;
  let createError = false;
  const ref = { set: async (data: object) => { record = { ...record, ...data }; } };
  const db = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async (callback: any) => callback({
      get: async () => ({ exists: Boolean(record), data: () => record }),
      create: (_ref: any, data: any) => { record = data; },
    }),
  };
  const intent = {
    id: "pi_test_quest", client_secret: "not-a-real-client-secret",
    status: "succeeded", currency: "usd", amount: 200, amount_received: 200,
    metadata: { source: "the-quest-direct", idempotencyKey: input.idempotencyKey, orderFingerprint: stripeOrderFingerprint(order) },
  } as unknown as Stripe.PaymentIntent;
  const stripe = {
    paymentIntents: {
      create: async (params: any, options: any) => {
        createCount++;
        assert.equal(params.amount, input.amountCents);
        assert.equal(params.currency, "usd");
        assert.equal(params.metadata.source, "the-quest-direct");
        assert.equal(params.metadata.orderFingerprint, stripeOrderFingerprint(order));
        assert.equal(options.idempotencyKey, `quest-direct:${input.idempotencyKey}`);
        if (createError) throw new Error("Ambiguous network outcome");
        return intent;
      },
      retrieve: async (id: string) => { assert.equal(id, intent.id); return intent; },
    },
  } as unknown as Stripe;
  const deps = {
    firestore: db as any,
    enforceVelocity: async () => { velocityCount++; },
  };
  return { stripe, deps, intent, getRecord: () => record, setRecord: (data: any) => { record = data; },
    createCount: () => createCount, velocityCount: () => velocityCount, failCreate: () => { createError = true; } };
}

test("creates directly on Quest with server amount, binding and Stripe idempotency", async () => {
  const f = fixture();
  await createQuestStripeIntent(f.stripe, input, f.deps);
  assert.equal(f.createCount(), 1);
  assert.equal(f.velocityCount(), 1);
  assert.equal(f.getRecord()?.intentId, f.intent.id);
});

test("repeated setup retrieves the same intent without a second creation", async () => {
  const f = fixture();
  await createQuestStripeIntent(f.stripe, input, f.deps);
  await createQuestStripeIntent(f.stripe, input, f.deps);
  assert.equal(f.createCount(), 1);
});

test("same key cannot be rebound to another amount or contestant", async () => {
  const f = fixture();
  await createQuestStripeIntent(f.stripe, input, f.deps);
  await assert.rejects(createQuestStripeIntent(f.stripe, { ...input, amountCents: 300 }, f.deps), /different payment/);
  await assert.rejects(createQuestStripeIntent(f.stripe, { ...input, order: { ...order, contestantId: 8 } }, f.deps), /different payment/);
  assert.equal(f.createCount(), 1);
});

test("invalid key, missing billing or invalid amount cannot reach Stripe", async () => {
  const f = fixture();
  for (const bad of [{ idempotencyKey: "" }, { billingAddress: {} }, { amountCents: -1 }, { amountCents: 1.5 }]) {
    await assert.rejects(createQuestStripeIntent(f.stripe, { ...input, ...bad }, f.deps));
  }
  assert.equal(f.createCount(), 0);
  assert.equal(f.velocityCount(), 0);
});

test("velocity rejection happens before reservation and gateway dispatch", async () => {
  const f = fixture();
  await assert.rejects(createQuestStripeIntent(f.stripe, input, {
    ...f.deps, enforceVelocity: async () => { throw new Error("Too many payment attempts"); },
  }), /Too many/);
  assert.equal(f.getRecord(), undefined);
  assert.equal(f.createCount(), 0);
});

test("ambiguous old requests remain reserved beyond Stripe's safe retry window", async () => {
  const f = fixture();
  f.failCreate();
  await assert.rejects(createQuestStripeIntent(f.stripe, input, f.deps), /Ambiguous/);
  f.setRecord({ ...f.getRecord(), createdAt: Date.now() - 24 * 60 * 60 * 1000 });
  await assert.rejects(createQuestStripeIntent(f.stripe, input, f.deps), /reconciliation/);
  assert.equal(f.createCount(), 1);
});

test("fulfillment requires matching paid intent, amount, currency and bound order", () => {
  const f = fixture();
  const check = { idempotencyKey: input.idempotencyKey, amountCents: input.amountCents, order };
  assert.doesNotThrow(() => assertQuestStripePayment(f.intent, check));
  for (const patch of [
    { status: "requires_payment_method" }, { currency: "cad" }, { amount: 300 }, { amount_received: 0 },
    { metadata: { ...f.intent.metadata, source: "oc" } },
    { metadata: { ...f.intent.metadata, idempotencyKey: "different-order" } },
  ]) assert.throws(() => assertQuestStripePayment({ ...f.intent, ...patch } as Stripe.PaymentIntent, check));
  for (const patch of [{ contestantId: 8 }, { competitionId: 22 }, { stageId: "semi" }, { individualVoteCount: 3 }, { purpose: "host" as const }]) {
    assert.throws(() => assertQuestStripePayment(f.intent, { ...check, order: { ...order, ...patch } }));
  }
});

test("fingerprints tolerate form number strings and omitted optional fields", () => {
  assert.equal(stripeOrderFingerprint(order), stripeOrderFingerprint({ ...order, competitionId: "21", contestantId: "7", packageIndex: "" }));
  assert.equal(stripeOrderFingerprint({ purpose: "host", selectedPackageName: "Pro" }),
    stripeOrderFingerprint({ purpose: "host", selectedPackageName: "Pro", competitionId: 21 }));
});

test("promo codes and their server quote are bound to the Stripe intent", () => {
  const discountedOrder: StripeOrder = {
    ...order,
    promoCode: "SAVE20",
    promoDiscountAmountCents: 300,
  };
  assert.notEqual(stripeOrderFingerprint(order), stripeOrderFingerprint(discountedOrder));
  assert.notEqual(
    stripeOrderFingerprint(discountedOrder),
    stripeOrderFingerprint({ ...discountedOrder, promoDiscountAmountCents: 200 }),
  );
  assert.notEqual(
    stripeOrderFingerprint(discountedOrder),
    stripeOrderFingerprint({ ...discountedOrder, promoCode: "SAVE10" }),
  );
});

test("host, join, and nomination promo and referral values bind to the Stripe intent", () => {
  for (const purpose of ["host", "join", "nominate"] as const) {
    const base: StripeOrder = {
      purpose,
      ...(purpose === "host" ? { selectedPackageName: "Pro" } : { competitionId: 21 }),
    };
    assert.notEqual(
      stripeOrderFingerprint(base),
      stripeOrderFingerprint({ ...base, promoCode: "SAVE20", promoDiscountAmountCents: 300 }),
    );
    assert.notEqual(
      stripeOrderFingerprint(base),
      stripeOrderFingerprint({ ...base, referralCode: "HOSTREF" }),
    );
  }
});

test("webhooks accept valid rotated signatures and reject wrong, stale, or altered payloads", () => {
  const secret = "whsec_unit_test_not_real";
  const payload = JSON.stringify({ id: "evt_unit_test", type: "payment_intent.succeeded" });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(verifyStripeSignature(Buffer.from(payload), header, secret), true);
  assert.equal(verifyStripeSignature(Buffer.from(payload), `${header},v1=invalid`, secret), true);
  assert.equal(verifyStripeSignature(Buffer.from(payload), header, "wrong"), false);
  assert.equal(verifyStripeSignature(Buffer.from(`${payload} `), header, secret), false);
  const stale = Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 600 });
  assert.equal(verifyStripeSignature(Buffer.from(payload), stale, secret), false);
});
