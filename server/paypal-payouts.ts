/**
 * paypal-payouts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends a PayPal Payout to a recipient's PayPal email address.
 *
 * Requires: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET env vars.
 * Set PAYPAL_USE_LIVE=true (or NODE_ENV=production) to use the live API.
 *
 * PayPal Payouts API: https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
 */

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

const useLive =
  process.env.PAYPAL_USE_LIVE === "true" || process.env.NODE_ENV === "production";
const PAYPAL_API_BASE = useLive
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "PayPal not configured — set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
    );
  }
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`PayPal auth failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export interface PayPalPayoutResult {
  payoutBatchId: string;
  status: string;
}

export async function sendPayPalPayout(opts: {
  recipientEmail: string;
  amountDollars: number;
  note?: string;
  currency?: string;
  senderBatchId?: string;
}): Promise<PayPalPayoutResult> {
  const token = await getAccessToken();
  const currency = opts.currency || "USD";
  const batchId = opts.senderBatchId || `quest_payout_${Date.now()}`;

  const body = {
    sender_batch_header: {
      sender_batch_id: batchId,
      email_subject: "You have a payout from The Quest",
      email_message:
        opts.note || "Your competition earnings have been sent. Thank you for competing!",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: { value: opts.amountDollars.toFixed(2), currency },
        receiver: opts.recipientEmail,
        note: opts.note || "",
        sender_item_id: `item_${Date.now()}`,
      },
    ],
  };

  const res = await fetch(`${PAYPAL_API_BASE}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal Payout failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    batch_header: { payout_batch_id: string; batch_status: string };
  };
  return {
    payoutBatchId: data.batch_header.payout_batch_id,
    status: data.batch_header.batch_status,
  };
}

export function isPayPalConfigured(): boolean {
  return !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
}
