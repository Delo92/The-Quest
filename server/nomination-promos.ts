import { randomUUID } from "node:crypto";
import type {
  NominationPromoCode,
  NominationPromoDiscountType,
  NominationPromoQuote,
} from "../shared/nomination-promos";

const MAX_PROMO_CODES = 200;
const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

export class PromoCodeConfigurationError extends Error {
  status = 400;
}

function normalizeCode(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, "").toUpperCase()
    : "";
}

export function normalizeNominationPromoCodes(value: unknown): NominationPromoCode[] {
  if (!Array.isArray(value)) {
    throw new PromoCodeConfigurationError("Promo codes must be provided as a list.");
  }
  if (value.length > MAX_PROMO_CODES) {
    throw new PromoCodeConfigurationError(`You can configure up to ${MAX_PROMO_CODES} nomination promo codes.`);
  }

  const seenCodes = new Set<string>();
  const seenIds = new Set<string>();

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new PromoCodeConfigurationError(`Promo code ${index + 1} is invalid.`);
    }

    const raw = entry as Record<string, unknown>;
    const code = normalizeCode(raw.code);
    if (!PROMO_CODE_PATTERN.test(code)) {
      throw new PromoCodeConfigurationError(
        `Promo code ${index + 1} must be 2–40 characters and contain only letters, numbers, hyphens, or underscores.`,
      );
    }
    if (seenCodes.has(code)) {
      throw new PromoCodeConfigurationError(`The promo code ${code} is listed more than once.`);
    }
    seenCodes.add(code);

    const id = typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim().slice(0, 100)
      : randomUUID();
    if (seenIds.has(id)) {
      throw new PromoCodeConfigurationError("Each promo code must have a unique ID.");
    }
    seenIds.add(id);

    const discountType = raw.discountType as NominationPromoDiscountType;
    if (!["free", "percentage", "fixed"].includes(discountType)) {
      throw new PromoCodeConfigurationError(`Promo code ${code} has an unsupported discount type.`);
    }

    let discountValue = 0;
    if (discountType === "percentage") {
      const value = Number(raw.discountValue);
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        throw new PromoCodeConfigurationError(`Promo code ${code} must discount between 0.01% and 100%.`);
      }
      discountValue = Math.round(value * 100) / 100;
    } else if (discountType === "fixed") {
      const value = Number(raw.discountValue);
      if (!Number.isInteger(value) || value <= 0 || value > 100_000_000) {
        throw new PromoCodeConfigurationError(`Promo code ${code} must discount a positive amount in cents.`);
      }
      discountValue = value;
    }

    return {
      id,
      code,
      discountType,
      discountValue,
      isActive: raw.isActive !== false,
    };
  });
}

export function getNominationPromoCodes(settings: {
  nominationPromoCodes?: unknown;
  freeNominationPromoCode?: unknown;
}): NominationPromoCode[] {
  if (Array.isArray(settings.nominationPromoCodes)) {
    return normalizeNominationPromoCodes(settings.nominationPromoCodes);
  }

  const legacyCode = normalizeCode(settings.freeNominationPromoCode);
  if (!legacyCode) return [];

  return normalizeNominationPromoCodes([{
    id: `legacy-${legacyCode}`,
    code: legacyCode,
    discountType: "free",
    discountValue: 0,
    isActive: true,
  }]);
}

export function calculateNominationPromoQuote(
  originalAmountCents: number,
  code: unknown,
  settings: {
    nominationPromoCodes?: unknown;
    freeNominationPromoCode?: unknown;
  },
): NominationPromoQuote {
  const original = Number.isFinite(originalAmountCents)
    ? Math.max(0, Math.round(originalAmountCents))
    : 0;
  const normalizedCode = normalizeCode(code);
  const promoCode = normalizedCode
    ? getNominationPromoCodes(settings).find((promo) => promo.isActive && promo.code === normalizedCode) || null
    : null;

  let discountAmountCents = 0;
  if (promoCode) {
    if (promoCode.discountType === "free") {
      discountAmountCents = original;
    } else if (promoCode.discountType === "percentage") {
      discountAmountCents = Math.round(original * promoCode.discountValue / 100);
    } else {
      discountAmountCents = promoCode.discountValue;
    }
    discountAmountCents = Math.min(original, Math.max(0, discountAmountCents));
  }

  return {
    valid: Boolean(promoCode),
    promoCode,
    originalAmountCents: original,
    discountAmountCents,
    finalAmountCents: original - discountAmountCents,
  };
}