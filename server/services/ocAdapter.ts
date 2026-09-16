/**
 * ocAdapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-to-server client for the Original Concepts Quest integration API.
 *
 * Quest's server calls OC to create payments, verify payment status, trigger
 * payouts, and start Stripe Connect onboarding for payees.  All Stripe and
 * PayPal credentials stay exclusively in OC — Quest never touches them.
 *
 * Required env vars (Quest side):
 *   QUEST_OC_API_TOKEN   — shared bearer token (same value as OC's QUEST_OC_INTEGRATION_TOKEN)
 *   OC_API_BASE_URL      — OC server origin, e.g. https://oraginalconcepts.com
 */

const OC_BASE_URL = (process.env.OC_API_BASE_URL || "https://oraginalconcepts.com").replace(/\/$/, "");
const OC_TOKEN = process.env.QUEST_OC_API_TOKEN;

export function isOCAdapterConfigured(): boolean {
  return Boolean(OC_TOKEN && OC_BASE_URL);
}

async function ocFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (!OC_TOKEN) {
    throw Object.assign(new Error("QUEST_OC_API_TOKEN is not configured on this Quest server."), { status: 503 });
  }
  const url = `${OC_BASE_URL}/api/integrations/quest${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OC_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw Object.assign(new Error(`OC integration returned non-JSON (${response.status})`), { status: 502 });
  }
  if (!response.ok) {
    throw Object.assign(
      new Error(data?.message || `OC integration error (${response.status})`),
      { status: response.status },
    );
  }
  return data;
}

// ─── Payment endpoints ────────────────────────────────────────────────────────

export interface OCPaymentRequest {
  amountCents: number;
  currency?: string;
  questOrderId: string;
  description: string;
  idempotencyKey: string;
  /** If omitted, OC returns a clientSecret for Stripe.js in-page confirmation */
  successUrl?: string;
  cancelUrl?: string;
}

export interface OCPaymentResponse {
  ocPaymentId: string;
  provider: string;
  status: string;
  /** Present when OC creates a hosted Checkout Session */
  checkoutUrl?: string;
  /** Present when OC creates a PaymentIntent for in-page confirmation */
  clientSecret?: string;
}

export async function createOCPayment(params: OCPaymentRequest): Promise<OCPaymentResponse> {
  return ocFetch("/payments", {
    method: "POST",
    body: JSON.stringify({ provider: "stripe", ...params }),
  });
}

export async function getOCPayment(ocPaymentId: string): Promise<{
  ocPaymentId: string;
  status: string;
  provider: string;
  stripePaymentIntentId?: string;
  amountCents?: number;
}> {
  return ocFetch(`/payments/${encodeURIComponent(ocPaymentId)}`);
}

// ─── Payout endpoints ─────────────────────────────────────────────────────────

export interface OCPayoutRequest {
  batchId: string;
  idempotencyKey: string;
}

export interface OCPayoutResponse {
  ocPayoutId: string;
  status: string;
  results?: Array<{ id: string; status: string; transferId?: string; error?: string }>;
}

export async function createOCPayout(params: OCPayoutRequest): Promise<OCPayoutResponse> {
  return ocFetch("/payouts", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getOCPayout(ocPayoutId: string): Promise<OCPayoutResponse> {
  return ocFetch(`/payouts/${encodeURIComponent(ocPayoutId)}`);
}

// ─── Payee onboarding ─────────────────────────────────────────────────────────

export async function createOCPayeeOnboardingLink(
  payeeId: string,
  params: { refreshUrl?: string; returnUrl?: string },
): Promise<{ url: string; stripeAccountId: string }> {
  return ocFetch(`/payees/${encodeURIComponent(payeeId)}/onboarding`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}
