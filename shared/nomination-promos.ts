export type NominationPromoDiscountType = "free" | "percentage" | "fixed";

export interface NominationPromoCode {
  id: string;
  code: string;
  discountType: NominationPromoDiscountType;
  /** Percentage points for percentage discounts; cents for fixed discounts. */
  discountValue: number;
  isActive: boolean;
}

export interface NominationPromoQuote {
  valid: boolean;
  promoCode: NominationPromoCode | null;
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
}

export function formatNominationPromoDiscount(promo: Pick<NominationPromoCode, "discountType" | "discountValue">): string {
  if (promo.discountType === "free") return "Free nomination";
  if (promo.discountType === "percentage") return `${promo.discountValue}% off`;
  return `$${(promo.discountValue / 100).toFixed(2)} off`;
}