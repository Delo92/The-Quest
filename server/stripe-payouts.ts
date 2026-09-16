/**
 * stripe-payouts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends an ACH payout from the platform's Stripe balance to a winner's bank
 * account (routing + account number stored in their payoutInfo).
 *
 * Flow:
 *  1. Load + decrypt the platform Stripe secret key from site_settings Firestore doc.
 *  2. Create a Stripe bank-account token from the recipient's routing/account.
 *  3. Attach it as an external account on the platform's Stripe account.
 *  4. Issue a payout to that external account.
 *
 * Funds source: the platform's Stripe balance (funded via the "Add funds"
 * ACH credit transfer shown in the Stripe dashboard under Balances).
 */

import Stripe from "stripe";
import { getFirestore } from "./firebase-admin";
import { decrypt, isEncryptionKeySet } from "./encryption";

async function getStripeClient(): Promise<Stripe> {
  if (!isEncryptionKeySet()) {
    throw new Error("ENCRYPTION_KEY not set — cannot decrypt Stripe secret key.");
  }
  const db = getFirestore();
  const doc = await db.collection("site_settings").doc("main").get();
  const enc = doc.data()?.stripeSecretKeyEncrypted;
  if (!enc) {
    throw new Error(
      "Stripe secret key not configured. Go to Admin → Settings → Stripe to add it."
    );
  }
  const secretKey = decrypt(enc);
  return new Stripe(secretKey);
}

export interface StripePayout {
  payoutId: string;
  status: string;
  arrivalDate: number;
}

export async function getStripeBalance(): Promise<{ available: number; pending: number }> {
  const stripe = await getStripeClient();
  const balance = await stripe.balance.retrieve();
  const available = balance.available.find((b: any) => b.currency === "usd")?.amount ?? 0;
  const pending   = balance.pending.find((b: any) => b.currency === "usd")?.amount ?? 0;
  return { available, pending };
}

export async function sendStripeAchPayout(opts: {
  routingNumber: string;
  accountNumber: string;
  accountHolderName: string;
  accountType: "individual" | "company";
  amountCents: number;
  description: string;
}): Promise<StripePayout> {
  const stripe = await getStripeClient();
  const { routingNumber, accountNumber, accountHolderName, accountType, amountCents, description } = opts;

  // Step 1 — Create a bank account token
  const token = await stripe.tokens.create({
    bank_account: {
      country: "US",
      currency: "usd",
      account_holder_name: accountHolderName,
      account_holder_type: accountType,
      routing_number: routingNumber,
      account_number: accountNumber,
    },
  });

  // Step 2 — Get platform Stripe account ID
  const account = await (stripe as any).account.retrieve();
  const accountId = account.id;

  // Step 3 — Attach as external account (Stripe deduplicates by fingerprint)
  let externalAccountId: string;
  try {
    const ext = await stripe.accounts.createExternalAccount(accountId, {
      external_account: token.id,
    });
    externalAccountId = ext.id;
  } catch (err: any) {
    if (err?.code === "external_account_exists" || err?.message?.includes("already exists")) {
      const existing = await stripe.accounts.listExternalAccounts(accountId, {
        object: "bank_account",
        limit: 100,
      });
      const match = existing.data.find((ba: any) => {
        return ba.last4 === accountNumber.slice(-4) && (ba as any).routing_number === routingNumber;
      });
      if (!match) throw err;
      externalAccountId = match.id;
    } else {
      throw err;
    }
  }

  // Step 4 — Issue payout from Stripe balance to that bank account
  const payout = await stripe.payouts.create({
    amount: amountCents,
    currency: "usd",
    destination: externalAccountId,
    description,
    statement_descriptor: "THEQUEST",
  });

  return {
    payoutId: payout.id,
    status: payout.status,
    arrivalDate: payout.arrival_date,
  };
}
