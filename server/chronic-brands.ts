const WEBHOOK_URL = "https://chronicbrandsusa.com/api/webhooks/promo-redemption";
const CODE_REGISTRY_URL = "https://chronicbrandsusa.com/api/code-registry/lookup";
const BRAND_NAME = "The Quest";
const PLATFORM = "The Quest";

function getApiKey(): string | undefined {
  return process.env.CHRONIC_BRANDS_API_KEY || process.env.PROMO_API_KEY;
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

export interface CodeRegistryEntry {
  found: boolean;
  code?: string;
  ownerName?: string;
  sourcePlatform?: string;
  status?: string;
}

export async function trackChronicBrandsPromo(payload: PromoRedemptionPayload): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[ChronicBrands] PROMO_API_KEY not set — promo redemption not tracked:", payload.code);
    return;
  }

  const body = {
    code: payload.code.trim().toUpperCase(),
    brandName: BRAND_NAME,
    platform: PLATFORM,
    orderNumber: payload.orderNumber ?? null,
    orderValue: payload.orderValue ?? "0.00",
    discountAmount: payload.discountAmount ?? "0.00",
    customerName: payload.customerName ?? null,
    customerEmail: payload.customerEmail ?? null,
    customerPhone: payload.customerPhone ?? null,
    notes: payload.notes ?? null,
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

export async function lookupCodeRegistry(code: string): Promise<CodeRegistryEntry> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { found: false };
  }

  try {
    const normalized = code.trim().toUpperCase();
    const response = await fetch(`${CODE_REGISTRY_URL}/${encodeURIComponent(normalized)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) return { found: false };
    const result = await response.json();
    return result as CodeRegistryEntry;
  } catch (err: any) {
    console.warn("[ChronicBrands] Code registry lookup failed:", err.message);
    return { found: false };
  }
}
