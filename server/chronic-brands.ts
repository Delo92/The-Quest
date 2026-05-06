const CBUSA_BASE = "https://chronicdocs.com";
const REDEEMING_SITE = "thequest";

function getApiKey(): string | undefined {
  return process.env.CHRONIC_BRANDS_API_KEY || process.env.PROMO_API_KEY;
}

export interface PromoReward {
  type: "discount_percent" | "discount_fixed" | "bonus_votes" | "info";
  value?: number;
  description: string;
}

export interface PromoValidateResult {
  valid: boolean;
  reward?: PromoReward;
  message?: string;
  code?: string;
}

export interface PromoRedeemPayload {
  code: string;
  orderNumber: string;
  orderValue: string;
  discountAmount: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  notes?: string;
}

export async function validatePromo(code: string): Promise<PromoValidateResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[ChronicBrands] API key not set — promo validation skipped");
    return { valid: false, message: "Promo system not configured" };
  }

  try {
    const response = await fetch(`${CBUSA_BASE}/api/promo/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-promo-api-key": apiKey,
      },
      body: JSON.stringify({ code: code.trim().toUpperCase(), redeemingSite: REDEEMING_SITE }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { valid: false, message: result?.message || `HTTP ${response.status}` };
    }

    console.log(`[ChronicBrands] Validated code=${code} valid=${result?.valid}`);
    return result as PromoValidateResult;
  } catch (err: any) {
    console.error("[ChronicBrands] Validate error:", err.message);
    return { valid: false, message: "Unable to reach promo service" };
  }
}

export async function redeemPromo(payload: PromoRedeemPayload): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[ChronicBrands] API key not set — promo redemption skipped");
    return;
  }

  try {
    const response = await fetch(`${CBUSA_BASE}/api/promo/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-promo-api-key": apiKey,
      },
      body: JSON.stringify({
        code: payload.code.trim().toUpperCase(),
        redeemingSite: REDEEMING_SITE,
        orderNumber: payload.orderNumber,
        orderValue: payload.orderValue,
        discountAmount: payload.discountAmount,
        customerName: payload.customerName ?? null,
        customerEmail: payload.customerEmail ?? null,
        customerPhone: payload.customerPhone ?? null,
        notes: payload.notes ?? null,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      console.warn(`[ChronicBrands] Redeem rejected: code=${payload.code} msg=${result?.message}`);
      return;
    }

    console.log(`[ChronicBrands] Redeemed: code=${payload.code} orderId=${payload.orderNumber}`);
  } catch (err: any) {
    console.error("[ChronicBrands] Redeem error:", err.message);
  }
}

export interface PromoRedemptionPayload {
  code: string;
  orderNumber?: string;
  orderValue?: string;
  discountAmount?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  notes?: string;
}

export async function trackChronicBrandsPromo(payload: PromoRedemptionPayload): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[ChronicBrands] API key not set — referral tracking skipped:", payload.code);
    return;
  }

  try {
    const response = await fetch(`${CBUSA_BASE}/api/promo/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-promo-api-key": apiKey,
      },
      body: JSON.stringify({
        code: payload.code.trim().toUpperCase(),
        redeemingSite: REDEEMING_SITE,
        orderNumber: payload.orderNumber ?? null,
        orderValue: payload.orderValue ?? "0.00",
        discountAmount: payload.discountAmount ?? "0.00",
        customerName: payload.customerName ?? null,
        customerEmail: payload.customerEmail ?? null,
        customerPhone: payload.customerPhone ?? null,
        notes: payload.notes ?? null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.warn(`[ChronicBrands] Track rejected: code=${payload.code} msg=${result?.message}`);
      return;
    }

    console.log(`[ChronicBrands] Referral tracked: code=${payload.code}`);
  } catch (err: any) {
    console.warn(`[ChronicBrands] Track error (non-fatal): ${err.message}`);
  }
}
