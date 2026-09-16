/**
 * quest-payout-job.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Monthly payout runner for The Quest.
 *
 * Rules:
 *  - Only processes ledger entries with status = "approved"
 *  - Competition must have ended at least 3 days before today
 *  - Entry must not already be paid (payoutReference is null)
 *
 * Provider selection per entry:
 *  1. If the payee has routingNumber + accountNumber in payoutInfo → Stripe ACH
 *  2. Else if the payee has a paypalEmail in payoutInfo → PayPal Payout
 *  3. Otherwise → skipped (flagged as "no_payment_info")
 *
 * Admin endpoint: POST /api/admin/payroll/execute-monthly
 * Can also be called by a scheduled job (e.g. Render Cron, Cloud Scheduler)
 * on the 1st of each month.
 */

import { getFirestore } from "./firebase-admin";
import { sendStripeAchPayout } from "./stripe-payouts";
import { sendPayPalPayout, isPayPalConfigured } from "./paypal-payouts";
import { Timestamp } from "firebase-admin/firestore";

const LEDGER       = "questPayoutLedger";
const PAYEES       = "questPayrollPayees";
const BATCHES      = "questPayrollBatches";
const TRANSACTIONS = "questPayrollTransactions";
const TALENT       = "talentProfiles";

const db = () => getFirestore();

function now() {
  return Timestamp.now();
}

export interface PayoutJobResult {
  ran: string;                   // ISO timestamp
  entriesChecked: number;
  paid: PayoutJobEntry[];
  skipped: PayoutJobEntry[];
  failed: PayoutJobEntry[];
}

export interface PayoutJobEntry {
  ledgerId: string;
  payeeId: string;
  competitionId: string | number;
  netCents: number;
  method: "stripe_ach" | "paypal" | "manual" | "no_payment_info";
  reference?: string;
  error?: string;
}

/**
 * Resolve the payoutInfo for a given payee document.
 * Looks up the talent profile via userId or talentProfileId on the payee doc.
 */
async function resolvePayoutInfo(payeeData: Record<string, any>): Promise<Record<string, any> | null> {
  // Try by userId first
  if (payeeData.userId) {
    const snap = await db()
      .collection(TALENT)
      .where("userId", "==", payeeData.userId)
      .limit(1)
      .get();
    if (!snap.empty) {
      const profile = snap.docs[0].data();
      return profile.payoutInfo || null;
    }
  }
  // Fall back to talentProfileId
  if (payeeData.talentProfileId) {
    const doc = await db().collection(TALENT).doc(String(payeeData.talentProfileId)).get();
    if (doc.exists) {
      return (doc.data() as any)?.payoutInfo || null;
    }
  }
  return null;
}

/**
 * Determine if a competition ended at least minDaysAgo days before today.
 */
async function competitionEndedAtLeast(competitionId: string | number, minDaysAgo: number): Promise<boolean> {
  if (!competitionId) return false;

  // Check the batch for stored competitionEndDate
  const batchSnap = await db()
    .collection(BATCHES)
    .where("competitionId", "==", String(competitionId))
    .limit(1)
    .get();

  let endDate: Date | null = null;

  if (!batchSnap.empty) {
    const raw = batchSnap.docs[0].data()?.competitionEndDate;
    if (raw) endDate = new Date(raw);
  }

  if (!endDate || isNaN(endDate.getTime())) return false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - minDaysAgo);
  return endDate <= cutoff;
}

/**
 * Main job. Processes all approved, unpaid ledger entries whose competition
 * ended at least 3 days ago.
 */
export async function runMonthlyPayouts(triggeredBy: string = "system"): Promise<PayoutJobResult> {
  const ranAt = new Date().toISOString();
  console.log(`[quest-payout-job] Starting monthly payout run — triggered by: ${triggeredBy}`);

  // Fetch all approved ledger entries
  const ledgerSnap = await db()
    .collection(LEDGER)
    .where("status", "==", "approved")
    .get();

  const paid:    PayoutJobEntry[] = [];
  const skipped: PayoutJobEntry[] = [];
  const failed:  PayoutJobEntry[] = [];

  for (const doc of ledgerSnap.docs) {
    const entry = doc.data();
    const ledgerId     = doc.id;
    const payeeId      = entry.payeeId as string;
    const competitionId = entry.competitionId;
    const netCents     = Number(entry.netCents || 0);
    const batchId      = entry.batchId as string;

    if (!payeeId || netCents <= 0) {
      skipped.push({ ledgerId, payeeId, competitionId, netCents, method: "no_payment_info", error: "Missing payeeId or zero netCents" });
      continue;
    }

    // Guard: competition must have ended ≥3 days ago
    const ready = await competitionEndedAtLeast(competitionId, 3);
    if (!ready) {
      skipped.push({ ledgerId, payeeId, competitionId, netCents, method: "manual", error: "Competition ended less than 3 days ago — will process next cycle" });
      continue;
    }

    // Fetch payee
    const payeeDoc = await db().collection(PAYEES).doc(payeeId).get();
    if (!payeeDoc.exists) {
      skipped.push({ ledgerId, payeeId, competitionId, netCents, method: "no_payment_info", error: "Payee record not found" });
      continue;
    }
    const payeeData = payeeDoc.data() || {};
    const payeeName = payeeData.name || payeeData.displayName || payeeId;

    // Resolve banking info from the talent profile
    const payoutInfo = await resolvePayoutInfo(payeeData);

    const hasACH     = payoutInfo?.routingNumber && payoutInfo?.accountNumber && payoutInfo?.legalName;
    const hasPayPal  = payoutInfo?.paypalEmail && isPayPalConfigured();

    if (!hasACH && !hasPayPal) {
      skipped.push({ ledgerId, payeeId, competitionId, netCents, method: "no_payment_info", error: "No bank info or PayPal email on file for this payee" });
      continue;
    }

    const amountDollars = netCents / 100;
    const description   = `TheQuest payout — competition ${competitionId} — ${payeeName}`;

    try {
      if (hasACH) {
        // ── Stripe ACH ────────────────────────────────────────────────
        const result = await sendStripeAchPayout({
          routingNumber:     payoutInfo!.routingNumber,
          accountNumber:     payoutInfo!.accountNumber,
          accountHolderName: payoutInfo!.legalName,
          accountType:       "individual",
          amountCents:       netCents,
          description,
        });

        await doc.ref.update({
          status:         "paid",
          payoutReference: result.payoutId,
          paymentMethod:  "stripe_ach",
          paidAt:         now(),
          updatedAt:      now(),
        });
        await db().collection(TRANSACTIONS).add({
          type:          "payout",
          amountCents:   netCents,
          payeeId,
          competitionId,
          batchId,
          memo:          result.payoutId,
          paymentMethod: "stripe_ach",
          stripePayoutId: result.payoutId,
          stripeStatus:  result.status,
          stripeArrivalDate: result.arrivalDate,
          createdBy:     "system",
          createdAt:     now(),
        });

        paid.push({ ledgerId, payeeId, competitionId, netCents, method: "stripe_ach", reference: result.payoutId });
        console.log(`[quest-payout-job] ✓ Stripe ACH ${result.payoutId} — $${amountDollars.toFixed(2)} → ${payeeName}`);

      } else {
        // ── PayPal Payout ─────────────────────────────────────────────
        const result = await sendPayPalPayout({
          recipientEmail: payoutInfo!.paypalEmail,
          amountDollars,
          note:           description,
          senderBatchId:  `quest_${ledgerId}_${Date.now()}`,
        });

        await doc.ref.update({
          status:         "paid",
          payoutReference: result.payoutBatchId,
          paymentMethod:  "paypal",
          paidAt:         now(),
          updatedAt:      now(),
        });
        await db().collection(TRANSACTIONS).add({
          type:            "payout",
          amountCents:     netCents,
          payeeId,
          competitionId,
          batchId,
          memo:            result.payoutBatchId,
          paymentMethod:   "paypal",
          paypalBatchId:   result.payoutBatchId,
          paypalStatus:    result.status,
          createdBy:       "system",
          createdAt:       now(),
        });

        paid.push({ ledgerId, payeeId, competitionId, netCents, method: "paypal", reference: result.payoutBatchId });
        console.log(`[quest-payout-job] ✓ PayPal ${result.payoutBatchId} — $${amountDollars.toFixed(2)} → ${payoutInfo!.paypalEmail}`);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[quest-payout-job] ✗ Failed — ledger ${ledgerId}: ${errMsg}`);

      await doc.ref.update({
        status:      "failed",
        blockedReason: errMsg,
        updatedAt:   now(),
      });

      failed.push({ ledgerId, payeeId, competitionId, netCents, method: hasACH ? "stripe_ach" : "paypal", error: errMsg });
    }
  }

  const summary = {
    ran: ranAt,
    entriesChecked: ledgerSnap.docs.length,
    paid,
    skipped,
    failed,
  };

  console.log(`[quest-payout-job] Done — checked: ${summary.entriesChecked}, paid: ${paid.length}, skipped: ${skipped.length}, failed: ${failed.length}`);
  return summary;
}
