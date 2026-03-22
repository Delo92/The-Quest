const WEBHOOK_URL = "https://chronicbrandsusa.com/api/webhooks/promo-redemption";
const BRAND_NAME = "The Quest";
const PLATFORM = "The Quest";

interface PromoRedemptionPayload {
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
  const apiKey = process.env.CHRONIC_BRANDS_API_KEY || process.env.PROMO_API_KEY;
  if (!apiKey) {
    console.warn("[ChronicBrands] PROMO_API_KEY not set — promo redemption not tracked:", payload.code);
    return;
  }

  const body = {
    code: payload.code,
    brandName: BRAND_NAME,
    platform: PLATFORM,
    orderNumber: payload.orderNumber,
    orderValue: payload.orderValue,
    discountAmount: payload.discountAmount,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerPhone: payload.customerPhone ?? null,
    notes: payload.notes,
  };

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.message || `HTTP ${response.status}`);
  }
  if (!result?.valid) {
    throw new Error(result?.message || "Code rejected by Chronic Brands");
  }

  console.log(`[ChronicBrands] Promo tracked: code=${payload.code} redemptionId=${result?.redemption?.id}`);
}
