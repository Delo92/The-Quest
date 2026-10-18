import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { resolveStripeVotePromoDiscount } from "./vote-promo-codes";

function fakeStripe(promotionCode: Record<string, any> | null) {
  return {
    promotionCodes: {
      list: async (params: Record<string, unknown>) => {
        assert.equal(params.active, true);
        assert.deepEqual(params.expand, ["data.promotion.coupon"]);
        return { data: promotionCode ? [promotionCode] : [] };
      },
    },
  } as unknown as Stripe;
}

function promotion(coupon: Record<string, any>, overrides: Record<string, any> = {}) {
  return {
    active: true,
    code: "SAVE20",
    customer: null,
    customer_account: null,
    max_redemptions: null,
    restrictions: {
      first_time_transaction: false,
      minimum_amount: null,
      minimum_amount_currency: null,
    },
    promotion: { type: "coupon", coupon: { valid: true, ...coupon } },
    ...overrides,
  };
}

test("resolves a Stripe percentage coupon against the vote subtotal", async () => {
  const result = await resolveStripeVotePromoDiscount(
    fakeStripe(promotion({ percent_off: 20, amount_off: null, currency: null })) ,
    " save20 ",
    1500,
  );
  assert.deepEqual(result, { code: "SAVE20", discountAmountCents: 300, discountLabel: "20% off" });
});

test("clamps fixed-amount discounts to the subtotal", async () => {
  const result = await resolveStripeVotePromoDiscount(
    fakeStripe(promotion({ percent_off: null, amount_off: 1000, currency: "usd" })),
    "SAVE20",
    500,
  );
  assert.deepEqual(result, { code: "SAVE20", discountAmountCents: 500, discountLabel: "$5.00 off" });
});

test("supports USD coupon currency options", async () => {
  const result = await resolveStripeVotePromoDiscount(
    fakeStripe(promotion({
      percent_off: null,
      amount_off: null,
      currency: null,
      currency_options: { usd: { amount_off: 250 } },
    })),
    "SAVE20",
    1000,
  );
  assert.equal(result?.discountAmountCents, 250);
});

test("returns null when Stripe has no active promo code", async () => {
  assert.equal(await resolveStripeVotePromoDiscount(fakeStripe(null), "NOPE", 1000), null);
});

test("rejects promotions that cannot safely be honored by a PaymentIntent checkout", async () => {
  await assert.rejects(
    resolveStripeVotePromoDiscount(
      fakeStripe(promotion({ percent_off: 20 }, { max_redemptions: 10 })),
      "SAVE20",
      1500,
    ),
    /redemption limit/,
  );
  await assert.rejects(
    resolveStripeVotePromoDiscount(
      fakeStripe(promotion({ percent_off: 20 }, {
        restrictions: { first_time_transaction: true, minimum_amount: null, minimum_amount_currency: null },
      })),
      "SAVE20",
      1500,
    ),
    /first-time/,
  );
});

test("rejects product-restricted, inactive, or non-discount coupons", async () => {
  await assert.rejects(
    resolveStripeVotePromoDiscount(
      fakeStripe(promotion({ percent_off: 20, applies_to: { products: ["prod_votes"] } })),
      "SAVE20",
      1500,
    ),
    /restricted to Stripe products/,
  );
  await assert.rejects(
    resolveStripeVotePromoDiscount(fakeStripe(promotion({ percent_off: null, amount_off: null, currency: "usd" })), "SAVE20", 1500),
    /does not include a USD discount/,
  );
  assert.equal(
    await resolveStripeVotePromoDiscount(fakeStripe(promotion({ percent_off: 20 }, { active: false })), "SAVE20", 1500),
    null,
  );
});
