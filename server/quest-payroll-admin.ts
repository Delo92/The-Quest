import type { Express } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "./firebase-admin";
import { firebaseAuth, requireAdmin, requireHost } from "./auth-middleware";
import { storage } from "./storage";

const SETTINGS = "questPayrollSettings";
const PAYEES = "questPayrollPayees";
const BATCHES = "questPayrollBatches";
const LEDGER = "questPayoutLedger";
const AGREEMENTS = "questPayrollAgreements";
const SIGNINGS = "questPayrollSignings";
const TRANSACTIONS = "questPayrollTransactions";
const AUDIT = "questPayrollAuditEvents";

const PAYMENT_METHODS = ["manual", "ach", "paypal", "check", "other"] as const;
const PAYEE_TYPES = ["contestant", "host", "referrer", "nonprofit"] as const;
const AGREEMENT_STATUSES = ["draft", "active", "archived"] as const;
const LEDGER_STATUSES = ["pending_approval", "approved", "paid", "blocked", "failed", "forfeited"] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];
type PayeeType = (typeof PAYEE_TYPES)[number];

const db = () => getFirestore();

function now() {
  return Timestamp.now();
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (typeof (value as any).toDate === "function") return (value as any).toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serialize(id: string, data: Record<string, any>) {
  const output: Record<string, any> = { id, ...data };
  for (const key of ["createdAt", "updatedAt", "signedAt", "approvedAt", "paidAt", "paymentInfoReceivedAt"]) {
    if (key in output) output[key] = iso(output[key]);
  }
  return output;
}

function cents(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function centsFromInput(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function clean(value: unknown, max = 300): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function defaultPlacements() {
  return [
    { place: 1, percentage: 100, label: "Winner" },
  ];
}

function defaultSettings() {
  return {
    entityType: "independent_contractor",
    payoutDueDay: 1,
    paymentInfoDeadline: "competition_final_day",
    missingPaymentPolicy: "forfeit",
    defaultPlacementModel: "winner_only",
    defaultPlacements: defaultPlacements(),
    enabledPaymentMethods: ["manual", "ach", "paypal", "check"],
    payoutProvider: "manual",
    requiredAgreementTypes: ["independent_contractor", "winner_payout_terms"],
    nonprofitTrackingEnabled: true,
    updatedAt: now(),
  };
}

function normalizePlacements(value: unknown) {
  if (!Array.isArray(value)) return defaultPlacements();
  const placements = value
    .map((item: any) => ({
      place: Math.max(1, Math.round(Number(item?.place) || 0)),
      percentage: Math.max(0, Math.min(100, Number(item?.percentage) || 0)),
      label: clean(item?.label || `Place ${item?.place || ""}`, 80),
    }))
    .filter((item) => item.place > 0 && item.percentage > 0)
    .slice(0, 20);
  const total = placements.reduce((sum, item) => sum + item.percentage, 0);
  return placements.length && total <= 100 ? placements : defaultPlacements();
}

function normalizeSettings(body: any) {
  const methods = Array.isArray(body?.enabledPaymentMethods)
    ? body.enabledPaymentMethods.filter((method: unknown): method is PaymentMethod =>
        PAYMENT_METHODS.includes(method as PaymentMethod),
      )
    : undefined;
  return {
    entityType: "independent_contractor",
    payoutDueDay: 1,
    paymentInfoDeadline: "competition_final_day",
    missingPaymentPolicy: body?.missingPaymentPolicy === "block" ? "block" : "forfeit",
    defaultPlacementModel: ["winner_only", "top_three", "custom"].includes(body?.defaultPlacementModel)
      ? body.defaultPlacementModel
      : "winner_only",
    defaultPlacements: normalizePlacements(body?.defaultPlacements),
    enabledPaymentMethods: methods?.length ? methods : defaultSettings().enabledPaymentMethods,
    payoutProvider: "manual",
    requiredAgreementTypes: Array.isArray(body?.requiredAgreementTypes)
      ? body.requiredAgreementTypes.map((value: unknown) => clean(value, 80)).filter(Boolean).slice(0, 10)
      : defaultSettings().requiredAgreementTypes,
    nonprofitTrackingEnabled: body?.nonprofitTrackingEnabled !== false,
  };
}

function normalizeDeductions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      label: clean(item?.label, 100),
      amountCents: cents(item?.amount ?? item?.amountCents),
    }))
    .filter((item) => item.label && item.amountCents > 0)
    .slice(0, 25);
}

function nextMonthFirst(dateValue?: string | null) {
  const date = dateValue ? new Date(`${dateValue}T12:00:00Z`) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

async function audit(actor: any, event: string, data: Record<string, any> = {}) {
  await db().collection(AUDIT).add({
    actorUid: actor?.uid || null,
    actorEmail: actor?.email || null,
    event,
    data,
    createdAt: now(),
  });
}

async function getSettingDoc() {
  const ref = db().collection(SETTINGS).doc("global");
  const snap = await ref.get();
  return { ref, data: { ...defaultSettings(), ...(snap.data() || {}) } };
}

async function getPayee(payeeId: string) {
  const snap = await db().collection(PAYEES).doc(payeeId).get();
  return snap.exists ? { ref: snap.ref, data: snap.data() || {} } : null;
}

function normalizedRules(body: any) {
  const placements = normalizePlacements(body?.placements);
  const model = ["winner_only", "top_three", "custom"].includes(body?.payoutModel)
    ? body.payoutModel
    : placements.length === 3 ? "top_three" : "winner_only";
  return {
    payoutModel: model,
    placements,
    prizePoolCents: cents(body?.prizePool),
    paymentInfoDeadline: "competition_final_day" as const,
    missingPaymentPolicy: (body?.missingPaymentPolicy === "block" ? "block" : "forfeit") as "block" | "forfeit",
    updatedAt: now(),
  };
}

export function registerQuestPayrollAdmin(app: Express) {
  app.get("/api/admin/payroll/settings", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const { data } = await getSettingDoc();
      res.json(serialize("global", data));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load payroll settings." });
    }
  });

  app.put("/api/admin/payroll/settings", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const { ref } = await getSettingDoc();
      const update = { ...normalizeSettings(req.body), updatedAt: now() };
      await ref.set(update, { merge: true });
      await audit(req.firebaseUser, "payroll_settings_updated", {
        enabledPaymentMethods: update.enabledPaymentMethods,
        missingPaymentPolicy: update.missingPaymentPolicy,
      });
      res.json(serialize("global", { ...update }));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not save payroll settings." });
    }
  });

  app.get("/api/admin/payroll/summary", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const [payeesSnap, batchesSnap, ledgerSnap, transactionsSnap] = await Promise.all([
        db().collection(PAYEES).get(),
        db().collection(BATCHES).get(),
        db().collection(LEDGER).get(),
        db().collection(TRANSACTIONS).get(),
      ]);
      const payees = payeesSnap.docs.map((doc) => doc.data());
      const batches = batchesSnap.docs.map((doc) => doc.data());
      const ledger = ledgerSnap.docs.map((doc) => doc.data());
      const transactions = transactionsSnap.docs.map((doc) => doc.data());
      res.json({
        payees: payees.length,
        activePayees: payees.filter((payee) => payee.status !== "inactive").length,
        pendingCents: ledger.filter((entry) => ["pending_approval", "approved", "blocked"].includes(entry.status)).reduce((sum, entry) => sum + Number(entry.netCents || 0), 0),
        paidCents: ledger.filter((entry) => entry.status === "paid").reduce((sum, entry) => sum + Number(entry.netCents || 0), 0),
        forfeitedCents: ledger.filter((entry) => entry.status === "forfeited").reduce((sum, entry) => sum + Number(entry.grossCents || 0), 0),
        nonprofitCents: transactions.filter((item) => item.type === "nonprofit_allocation").reduce((sum, item) => sum + Number(item.amountCents || 0), 0),
        batches: batches.length,
        transactions: transactions.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load payroll summary." });
    }
  });

  app.get("/api/admin/payroll/payees", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const snap = await db().collection(PAYEES).get();
      res.json(snap.docs.map((doc) => serialize(doc.id, doc.data())).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load payees." });
    }
  });

  app.post("/api/admin/payroll/payees", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const name = clean(req.body?.name, 160);
      const email = clean(req.body?.email, 320).toLowerCase();
      const type: PayeeType = PAYEE_TYPES.includes(req.body?.type) ? req.body.type : "contestant";
      if (!name || !email) return res.status(400).json({ message: "Name and email are required." });
      const ref = db().collection(PAYEES).doc();
      const record = {
        name,
        email,
        type,
        status: "active",
        paymentMethodType: null,
        paymentMethodLabel: null,
        paymentInfoProvided: false,
        paymentInfoReceivedAt: null,
        agreementStatus: "pending",
        createdAt: now(),
        updatedAt: now(),
      };
      await ref.set(record);
      await audit(req.firebaseUser, "payee_created", { payeeId: ref.id, type });
      res.status(201).json(serialize(ref.id, record));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not create payee." });
    }
  });

  app.patch("/api/admin/payroll/payees/:payeeId", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const existing = await getPayee(req.params.payeeId);
      if (!existing) return res.status(404).json({ message: "Payee not found." });
      const update: Record<string, any> = { updatedAt: now() };
      for (const key of ["name", "email", "paymentMethodLabel"]) {
        if (req.body?.[key] !== undefined) update[key] = clean(req.body[key], key === "email" ? 320 : 160);
      }
      if (req.body?.email !== undefined) update.email = update.email.toLowerCase();
      if (req.body?.type && PAYEE_TYPES.includes(req.body.type)) update.type = req.body.type;
      if (req.body?.status === "active" || req.body?.status === "inactive") update.status = req.body.status;
      if (req.body?.paymentMethodType && PAYMENT_METHODS.includes(req.body.paymentMethodType)) {
        update.paymentMethodType = req.body.paymentMethodType;
      }
      if (req.body?.paymentInfoProvided !== undefined) {
        update.paymentInfoProvided = Boolean(req.body.paymentInfoProvided);
        update.paymentInfoReceivedAt = update.paymentInfoProvided ? now() : null;
      }
      if (req.body?.agreementStatus && ["pending", "partial", "signed"].includes(req.body.agreementStatus)) {
        update.agreementStatus = req.body.agreementStatus;
      }
      await existing.ref.update(update);
      await audit(req.firebaseUser, "payee_updated", { payeeId: req.params.payeeId, fields: Object.keys(update) });
      res.json(serialize(req.params.payeeId, { ...existing.data, ...update }));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not update payee." });
    }
  });

  app.get("/api/admin/payroll/agreements", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const snap = await db().collection(AGREEMENTS).get();
      res.json(snap.docs.map((doc) => serialize(doc.id, doc.data())).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load agreements." });
    }
  });

  app.post("/api/admin/payroll/agreements", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const title = clean(req.body?.title, 180);
      const content = clean(req.body?.content, 20_000);
      if (!title || !content) return res.status(400).json({ message: "Agreement title and content are required." });
      const ref = db().collection(AGREEMENTS).doc();
      const record = {
        title,
        type: clean(req.body?.type, 80) || "winner_payout_terms",
        version: clean(req.body?.version, 30) || "1.0",
        content,
        status: AGREEMENT_STATUSES.includes(req.body?.status) ? req.body.status : "draft",
        required: req.body?.required !== false,
        createdBy: req.firebaseUser?.uid || null,
        createdAt: now(),
        updatedAt: now(),
      };
      await ref.set(record);
      await audit(req.firebaseUser, "agreement_created", { agreementId: ref.id });
      res.status(201).json(serialize(ref.id, record));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not create agreement." });
    }
  });

  app.patch("/api/admin/payroll/agreements/:agreementId", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const ref = db().collection(AGREEMENTS).doc(req.params.agreementId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Agreement not found." });
      const update: Record<string, any> = { updatedAt: now() };
      for (const key of ["title", "type", "version", "content"]) {
        if (req.body?.[key] !== undefined) update[key] = clean(req.body[key], key === "content" ? 20_000 : 180);
      }
      if (AGREEMENT_STATUSES.includes(req.body?.status)) update.status = req.body.status;
      if (req.body?.required !== undefined) update.required = Boolean(req.body.required);
      await ref.update(update);
      res.json(serialize(ref.id, { ...(snap.data() || {}), ...update }));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not update agreement." });
    }
  });

  app.get("/api/admin/payroll/signings", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const snap = await db().collection(SIGNINGS).get();
      res.json(snap.docs.map((doc) => serialize(doc.id, doc.data())));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load contract signings." });
    }
  });

  app.post("/api/admin/payroll/signings", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const payeeId = clean(req.body?.payeeId, 120);
      const agreementId = clean(req.body?.agreementId, 120);
      const status = ["pending", "signed", "declined"].includes(req.body?.status) ? req.body.status : "pending";
      if (!payeeId || !agreementId) return res.status(400).json({ message: "Payee and agreement are required." });
      const id = `${payeeId}_${agreementId}`;
      const ref = db().collection(SIGNINGS).doc(id);
      const record = {
        payeeId,
        agreementId,
        status,
        signerName: clean(req.body?.signerName, 160) || null,
        signatureMethod: status === "signed" ? "admin_recorded" : null,
        signedAt: status === "signed" ? now() : null,
        updatedAt: now(),
      };
      await ref.set(record, { merge: true });
      await db().collection(PAYEES).doc(payeeId).set({ agreementStatus: status === "signed" ? "signed" : "partial", updatedAt: now() }, { merge: true });
      await audit(req.firebaseUser, "agreement_signing_updated", { payeeId, agreementId, status });
      res.json(serialize(id, record));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not record signing." });
    }
  });

  app.get("/api/admin/payroll/transactions", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const snap = await db().collection(TRANSACTIONS).get();
      res.json(snap.docs.map((doc) => serialize(doc.id, doc.data())).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load payroll transactions." });
    }
  });

  app.post("/api/admin/payroll/transactions", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const allowed = ["earning", "deduction", "nonprofit_allocation", "payout", "adjustment", "forfeiture"];
      const type = allowed.includes(req.body?.type) ? req.body.type : null;
      const amountCents = cents(req.body?.amount);
      if (!type || amountCents <= 0) return res.status(400).json({ message: "Transaction type and a positive amount are required." });
      const ref = db().collection(TRANSACTIONS).doc();
      const record = {
        type,
        amountCents,
        payeeId: clean(req.body?.payeeId, 120) || null,
        competitionId: Number.isFinite(Number(req.body?.competitionId)) ? Number(req.body.competitionId) : null,
        nonprofitSelection: clean(req.body?.nonprofitSelection, 180) || null,
        memo: clean(req.body?.memo, 500),
        status: "recorded",
        createdBy: req.firebaseUser?.uid || null,
        createdAt: now(),
      };
      await ref.set(record);
      await audit(req.firebaseUser, "payroll_transaction_recorded", { transactionId: ref.id, type, amountCents });
      res.status(201).json(serialize(ref.id, record));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not record transaction." });
    }
  });

  app.get("/api/admin/payroll/batches", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const snap = await db().collection(BATCHES).get();
      res.json(snap.docs.map((doc) => serialize(doc.id, doc.data())).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load payroll batches." });
    }
  });

  app.post("/api/admin/payroll/batches", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      if (!entries.length) return res.status(400).json({ message: "At least one winner entitlement is required." });
      const { data: settings } = await getSettingDoc();
      const competitionId = Number.isFinite(Number(req.body?.competitionId)) ? Number(req.body.competitionId) : null;
      const competition = competitionId ? await storage.getCompetition(competitionId) : null;
      const competitionEndDate = clean(req.body?.competitionEndDate, 20) || competition?.endDate || null;
      const dueDate = nextMonthFirst(competitionEndDate);
      if (!dueDate) return res.status(400).json({ message: "A valid competition end date is required." });
      const batchRef = db().collection(BATCHES).doc();
      const batch = db().batch();
      let grossTotal = 0;
      let deductionsTotal = 0;
      let nonprofitTotal = 0;
      let netTotal = 0;
      let forfeitedTotal = 0;
      const normalizedEntries: Array<Record<string, any>> = [];
      for (const raw of entries.slice(0, 100)) {
        const payeeId = clean(raw?.payeeId, 120);
        const payee = await getPayee(payeeId);
        if (!payee) return res.status(400).json({ message: `Payee ${payeeId || "unknown"} was not found.` });
        const grossCents = cents(raw?.grossAmount);
        if (!grossCents) continue;
        const deductions = normalizeDeductions(raw?.deductions);
        const deductionsCents = deductions.reduce((sum, item) => sum + item.amountCents, 0);
        const nonprofitCents = cents(raw?.nonprofitAmount);
        const paymentInfoProvided = Boolean(raw?.paymentInfoProvided || payee.data.paymentInfoProvided);
        const eligible = paymentInfoProvided;
        const forfeited = !eligible && settings.missingPaymentPolicy === "forfeit";
        const netCents = forfeited ? 0 : Math.max(0, grossCents - deductionsCents - nonprofitCents);
        const ledgerRef = db().collection(LEDGER).doc();
        const ledgerRecord = {
          batchId: batchRef.id,
          competitionId,
          payeeId,
          placement: Math.max(1, Math.round(Number(raw?.placement) || 1)),
          grossCents,
          deductions,
          deductionsCents,
          nonprofitSelection: clean(raw?.nonprofitSelection, 180) || null,
          nonprofitCents,
          netCents,
          paymentInfoDeadline: competitionEndDate,
          paymentInfoProvided,
          eligible,
          status: forfeited ? "forfeited" : "pending_approval",
          blockedReason: forfeited ? "Payment information was not provided by the competition final day." : null,
          payoutReference: null,
          createdAt: now(),
          updatedAt: now(),
        };
        batch.set(ledgerRef, ledgerRecord);
        normalizedEntries.push({ id: ledgerRef.id, ...ledgerRecord });
        grossTotal += grossCents;
        deductionsTotal += deductionsCents;
        nonprofitTotal += nonprofitCents;
        netTotal += netCents;
        forfeitedTotal += forfeited ? grossCents : 0;
        const earningRef = db().collection(TRANSACTIONS).doc();
        batch.set(earningRef, { type: "earning", amountCents: grossCents, payeeId, competitionId, batchId: batchRef.id, createdBy: req.firebaseUser?.uid || null, createdAt: now() });
        for (const deduction of deductions) {
          batch.set(db().collection(TRANSACTIONS).doc(), { type: "deduction", amountCents: deduction.amountCents, payeeId, competitionId, batchId: batchRef.id, memo: deduction.label, createdBy: req.firebaseUser?.uid || null, createdAt: now() });
        }
        if (nonprofitCents > 0) {
          batch.set(db().collection(TRANSACTIONS).doc(), { type: "nonprofit_allocation", amountCents: nonprofitCents, payeeId, competitionId, batchId: batchRef.id, nonprofitSelection: clean(raw?.nonprofitSelection, 180) || null, createdBy: req.firebaseUser?.uid || null, createdAt: now() });
        }
      }
      if (!normalizedEntries.length) return res.status(400).json({ message: "Winner entitlements must have positive amounts." });
      const batchRecord = {
        competitionId,
        competitionTitle: clean(req.body?.competitionTitle, 180) || competition?.title || "Competition payout",
        competitionEndDate,
        payoutDueDate: dueDate,
        month: dueDate.slice(0, 7),
        status: "draft",
        placementPolicy: competition?.payrollRules || settings.defaultPlacements,
        grossCents: grossTotal,
        deductionsCents: deductionsTotal,
        nonprofitCents: nonprofitTotal,
        netCents: netTotal,
        forfeitedCents: forfeitedTotal,
        participantCount: normalizedEntries.length,
        createdBy: req.firebaseUser?.uid || null,
        createdAt: now(),
        updatedAt: now(),
      };
      batch.set(batchRef, batchRecord);
      await batch.commit();
      await audit(req.firebaseUser, "payroll_batch_created", { batchId: batchRef.id, competitionId, participantCount: normalizedEntries.length });
      res.status(201).json({ batch: serialize(batchRef.id, batchRecord), entries: normalizedEntries.map((entry) => serialize(entry.id, entry)) });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not create payroll batch." });
    }
  });

  app.post("/api/admin/payroll/batches/:batchId/approve", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const ref = db().collection(BATCHES).doc(req.params.batchId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Payroll batch not found." });
      if (snap.data()?.status !== "draft") return res.status(400).json({ message: "Only draft batches can be approved." });
      const entries = await db().collection(LEDGER).where("batchId", "==", req.params.batchId).get();
      const write = db().batch();
      entries.docs.forEach((entry) => {
        if (entry.data().status === "pending_approval") write.update(entry.ref, { status: "approved", updatedAt: now() });
      });
      write.update(ref, { status: "approved", approvedBy: req.firebaseUser?.uid || null, approvedAt: now(), updatedAt: now() });
      await write.commit();
      await audit(req.firebaseUser, "payroll_batch_approved", { batchId: req.params.batchId });
      res.json({ id: req.params.batchId, status: "approved" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not approve payroll batch." });
    }
  });

  app.post("/api/admin/payroll/batches/:batchId/record-payout", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const ledgerId = clean(req.body?.ledgerId, 160);
      const ledgerRef = db().collection(LEDGER).doc(ledgerId);
      const [batchSnap, ledgerSnap] = await Promise.all([
        db().collection(BATCHES).doc(req.params.batchId).get(),
        ledgerRef.get(),
      ]);
      if (!batchSnap.exists || !ledgerSnap.exists || ledgerSnap.data()?.batchId !== req.params.batchId) {
        return res.status(404).json({ message: "Payout entry not found." });
      }
      const entry = ledgerSnap.data() || {};
      if (entry.status !== "approved") return res.status(400).json({ message: "Only approved eligible entries can be recorded as paid." });
      const reference = clean(req.body?.payoutReference, 180);
      if (!reference) return res.status(400).json({ message: "A payout reference is required." });
      await ledgerRef.update({ status: "paid", payoutReference: reference, paymentMethod: PAYMENT_METHODS.includes(req.body?.paymentMethod) ? req.body.paymentMethod : "manual", paidAt: now(), updatedAt: now() });
      await db().collection(TRANSACTIONS).add({ type: "payout", amountCents: entry.netCents, payeeId: entry.payeeId, competitionId: entry.competitionId, batchId: req.params.batchId, memo: reference, createdBy: req.firebaseUser?.uid || null, createdAt: now() });
      const remaining = await db().collection(LEDGER).where("batchId", "==", req.params.batchId).get();
      const active = remaining.docs.map((item) => item.data()).filter((item) => !["paid", "forfeited"].includes(item.status));
      if (!active.length) await db().collection(BATCHES).doc(req.params.batchId).update({ status: "paid", updatedAt: now() });
      await audit(req.firebaseUser, "payout_recorded", { batchId: req.params.batchId, ledgerId, reference });
      res.json({ id: ledgerId, status: "paid", payoutReference: reference });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not record payout." });
    }
  });

  app.get("/api/admin/payroll/competition-rules/:competitionId", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const competition = await storage.getCompetition(Number(req.params.competitionId));
      if (!competition) return res.status(404).json({ message: "Competition not found." });
      res.json(competition.payrollRules || normalizedRules({}));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load competition payout rules." });
    }
  });

  async function saveCompetitionRules(req: any, res: any) {
    const competitionId = Number(req.params.competitionId);
    const competition = await storage.getCompetition(competitionId);
    if (!competition) return res.status(404).json({ message: "Competition not found." });
    if (req.firebaseUser?.level < 4 && competition.createdBy !== req.firebaseUser?.uid) {
      return res.status(403).json({ message: "You can only manage payout rules for your own competitions." });
    }
    const rules = normalizedRules(req.body);
    await storage.updateCompetition(competitionId, { payrollRules: rules });
    await audit(req.firebaseUser, "competition_payout_rules_updated", { competitionId, payoutModel: rules.payoutModel });
    res.json(rules);
  }

  app.put("/api/admin/payroll/competition-rules/:competitionId", firebaseAuth, requireAdmin, saveCompetitionRules);
  app.put("/api/host/competitions/:competitionId/payroll-rules", firebaseAuth, requireHost, saveCompetitionRules);
}