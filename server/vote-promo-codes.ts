import type Stripe from "stripe";

export class VotePromoCodeError extends Error {
  status = 400;
}

export interface VotePromoDiscount {
  code: string;
  discountAmountCents: number;
  discountLabel: string;
}

/**
 * Resolves Stripe Dashboard promotion codes for one-time vote payments.
 * The current checkout uses PaymentIntents, so this applies the coupon value
 * to the server-calculated subtotal instead of relying on Stripe Checkout.
 */
export async function resolveStripeVotePromoDiscount(
  stripe: Stripe,
  rawCode: unknown,
  subtotalCents: number,
): Promise<VotePromoDiscount | null> {
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (!code) return null;

  const result = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 100,
    expand: ["data.promotion.coupon"],
  });
  const promotionCode = result.data.find(
    (candidate) => candidate.active && candidate.code.trim().toUpperCase() === code,
  );
  if (!promotionCode) return null;

  const reject = (message: string): never => {
    throw new VotePromoCodeError(message);
  };

  if (promotionCode.customer || promotionCode.customer_account) {
    return reject("This promo code is restricted to a specific Stripe customer.");
  }
  if (promotionCode.restrictions.first_time_transaction) {
    return reject("This promo code is restricted to first-time Stripe customers.");
  }
  if (promotionCode.max_redemptions != null) {
    return reject("This promo code has a Stripe redemption limit that this checkout cannot enforce.");
  }

  const minimumUsd = promotionCode.restrictions.currency_options?.usd?.minimum_amount;
  const minimumCurrency = promotionCode.restrictions.minimum_amount_currency?.toLowerCase();
  const minimumAmountCents = minimumUsd ?? (
    !minimumCurrency || minimumCurrency === "usd"
      ? promotionCode.restrictions.minimum_amount
      : null
  );
  if (minimumAmountCents !== null && minimumAmountCents !== undefined && subtotalCents < minimumAmountCents) {
    return reject("This promo code requires a higher vote-package subtotal.");
  }

  const rawCoupon = promotionCode.promotion.coupon;
  if (!rawCoupon || typeof rawCoupon === "string" || "deleted" in rawCoupon || !rawCoupon.valid) {
    return reject("This Stripe promo code does not have an active coupon.");
  }
  if (rawCoupon.applies_to?.products?.length) {
    return reject("This promo code is restricted to Stripe products not used for vote purchases.");
  }
  if (rawCoupon.max_redemptions != null) {
    return reject("This coupon has a Stripe redemption limit that this checkout cannot enforce.");
  }

  let discountAmountCents = 0;
  let discountLabel = "";
  if (rawCoupon.percent_off && rawCoupon.percent_off > 0) {
    discountAmountCents = Math.round(subtotalCents * rawCoupon.percent_off / 100);
    discountLabel = `${rawCoupon.percent_off}% off`;
  } else {
    const amountOffCents = rawCoupon.currency_options?.usd?.amount_off
      ?? (rawCoupon.currency?.toLowerCase() === "usd" ? rawCoupon.amount_off : null);
    if (!amountOffCents || amountOffCents <= 0) {
      return reject("This Stripe promo code does not include a USD discount.");
    }
    discountAmountCents = amountOffCents;
  }

  discountAmountCents = Math.min(Math.max(0, Math.round(subtotalCents)), discountAmountCents);
  if (discountAmountCents <= 0) {
    return reject("This promo code does not discount this vote purchase.");
  }
  if (!discountLabel) discountLabel = `$${(discountAmountCents / 100).toFixed(2)} off`;

  return {
    code: promotionCode.code.trim().toUpperCase(),
    discountAmountCents,
    discountLabel,
  };
}
