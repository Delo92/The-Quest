import { timingSafeEqual } from "node:crypto";

/**
 * ocAdapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-to-server client for the Original Concepts Quest integration API.
 *
 * Quest's server calls OC to create payments, verify status, capture PayPal
 * orders, issue refunds, and trigger payroll batch approve/release.
 * All Stripe and PayPal credentials stay exclusively in OC.
 *
 * Required env vars (Quest side):
 *   QUEST_OC_API_TOKEN   — shared bearer token (same value set in OC environment)
 *   OC_API_BASE_URL      — OC server origin (default: https://oraginalconcepts.com)
 */

const OC_BASE_URL = (process.env.OC_API_BASE_URL || "https://oraginalconcepts.com").replace(/\/$/, "");
const OC_TOKEN = process.env.QUEST_OC_API_TOKEN;

export function isOCAdapterConfigured(): boolean {
  return Boolean(OC_TOKEN);
}

export function hasOCIntegrationToken(): boolean {
  return Boolean(OC_TOKEN);
}

export function isValidOCIntegrationAuthorization(authorization: string | undefined): boolean {
  if (!OC_TOKEN || !authorization) return false;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = Buffer.from(match[1].trim());
  const expected = Buffer.from(OC_TOKEN);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/**
 * Non-mutating connection probe for the admin status panel.
 *
 * OC does not expose a separate health endpoint. A request for a deliberately
 * nonexistent payout batch still proves that the integration route is
 * reachable and that the shared token was accepted when it returns 404.
 */
export async function getOCConnectionStatus(): Promise<{
  configured: boolean;
  reachable: boolean;
  authorized: boolean;
  baseUrl: string;
}> {
  if (!OC_TOKEN) {
    return { configured: false, reachable: false, authorized: false, baseUrl: OC_BASE_URL };
  }

  try {
    await questFetch(`/payouts/${encodeURIComponent("__quest_connection_check__")}`);
    return { configured: true, reachable: true, authorized: true, baseUrl: OC_BASE_URL };
  } catch (error: any) {
    const status = Number(error?.status || 0);
    if (status === 404) {
      return { configured: true, reachable: true, authorized: true, baseUrl: OC_BASE_URL };
    }
    if (status === 401 || status === 403) {
      return { configured: true, reachable: true, authorized: false, baseUrl: OC_BASE_URL };
    }
    return { configured: true, reachable: false, authorized: false, baseUrl: OC_BASE_URL };
  }
}

// ─── Low-level fetch helpers ──────────────────────────────────────────────────

async function ocFetch(fullPath: string, options: RequestInit = {}): Promise<any> {
  if (!OC_TOKEN) {
    throw Object.assign(new Error("QUEST_OC_API_TOKEN is not configured on this Quest server."), { status: 503 });
  }
  const url = `${OC_BASE_URL}${fullPath}`;
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

/** Calls /api/integrations/quest/* endpoints */
function questFetch(path: string, options?: RequestInit) {
  return ocFetch(`/api/integrations/quest${path}`, options);
}

/** Calls /api/portal/quest/* endpoints (payroll batch approve / release) */
function portalFetch(path: string, options?: RequestInit) {
  return ocFetch(`/api/portal/quest${path}`, options);
}

// ─── Payment endpoints ────────────────────────────────────────────────────────

export interface OCPaymentRequest {
  provider: "stripe" | "paypal";
  amountCents: number;
  currency?: string;
  questOrderId: string;
  description: string;
  idempotencyKey: string;
}

export interface OCPaymentResponse {
  ocPaymentId: string;
  provider: "stripe" | "paypal";
  status: string;
  /** Stripe: client secret for Stripe.js confirmCardPayment */
  clientSecret?: string;
  /** PayPal: URL to redirect the buyer to for approval */
  approvalUrl?: string;
}

/** Create a Stripe PaymentIntent or PayPal order on OC's accounts. */
export async function createOCPayment(params: OCPaymentRequest): Promise<OCPaymentResponse> {
  return questFetch("/payments", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Get live payment status. OC syncs from Stripe/PayPal when still pending. */
export async function getOCPayment(ocPaymentId: string): Promise<{
  ocPaymentId: string;
  status: string;
  provider: string;
  stripePaymentIntentId?: string;
  paypalOrderId?: string;
  amountCents?: number;
}> {
  return questFetch(`/payments/${encodeURIComponent(ocPaymentId)}`);
}

/**
 * Capture a PayPal order after the buyer has approved it.
 * Call this after the buyer returns from PayPal's approvalUrl.
 */
export async function captureOCPayPalPayment(ocPaymentId: string): Promise<{
  ocPaymentId: string;
  status: string;
  capturedAmount?: number;
}> {
  return questFetch(`/payments/${encodeURIComponent(ocPaymentId)}/capture`, { method: "POST", body: "{}" });
}

/**
 * Request a refund for a completed payment.
 * @param amountCents  Omit for a full refund.
 */
export async function refundOCPayment(
  ocPaymentId: string,
  params?: { amountCents?: number; reason?: string },
): Promise<{ ocPaymentId: string; status: string; refundId?: string }> {
  return questFetch(`/payments/${encodeURIComponent(ocPaymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify(params || {}),
  });
}

// ─── Payout / payroll batch endpoints ─────────────────────────────────────────

/**
 * Read a payroll batch + ledger status from OC.
 * batchId is the OC payroll batch ID (cbpublishing_payroll_batches doc ID).
 */
export async function getOCPayoutBatch(batchId: string): Promise<any> {
  return questFetch(`/payouts/${encodeURIComponent(batchId)}`);
}

/**
 * Approve a payroll batch via OC's portal route.
 * The integration token is now accepted by that route.
 */
export async function approveOCBatch(batchId: string): Promise<any> {
  return portalFetch(`/batches/${encodeURIComponent(batchId)}/approve`, { method: "POST", body: "{}" });
}

/**
 * Release (pay out) an approved payroll batch via OC's portal route.
 * OC executes Stripe Connect transfers to each payee.
 */
export async function releaseOCBatch(batchId: string): Promise<any> {
  return portalFetch(`/batches/${encodeURIComponent(batchId)}/release`, { method: "POST", body: "{}" });
}

export interface OCSocialProfileSyncRecord {
  operation: "upsert" | "delete";
  questProfileId: string;
  questUserId: string;
  fullName: string;
  email: string;
  roleTypes: Array<"host" | "contestant">;
  competitionIds: number[];
  socialLinks: Record<string, string>;
  updatedAt: string;
}

function getSocialScanResultsCallbackUrl(): string {
  const configured = process.env.SITE_URL?.trim() || "https://cbpublishing.live";
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return `${new URL(withProtocol).origin}/api/oc/social-profiles/results`;
}

/**
 * Upsert or remove Quest host/contestant profiles in OC's social scanning index.
 * OC deduplicates records by sourceSystem + questProfileId.
 */
export async function syncOCSocialProfiles(
  records: OCSocialProfileSyncRecord[],
  syncType: "change" | "backfill" = "change",
): Promise<any> {
  if (records.length === 0) return { acceptedCount: 0, rejected: [] };
  return questFetch("/social-profiles/sync", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      sourceSystem: "the-quest",
      schemaVersion: 1,
      syncType,
      sentAt: new Date().toISOString(),
      callbackUrl: getSocialScanResultsCallbackUrl(),
      records,
    }),
  });
}
