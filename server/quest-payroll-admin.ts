import type { Express } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "./firebase-admin";
import { firebaseAuth, requireAdmin, requireHost } from "./auth-middleware";
import { storage } from "./storage";
import { firestoreJoinSettings } from "./firestore-collections";
import { runMonthlyPayouts } from "./quest-payout-job";
import { finalVotingDeadline, hasTaxInfoBeforeDeadline } from "./quest-tax-donations";
import {
  declaredNonprofitName,
  hasAcknowledgedNonprofitDeclaration,
  hasPrizeReadyNonprofitDeclaration,
  isNonprofitPolicyConfigured,
  isValidNonprofitContributionRate,
  nonprofitAllocationCents,
} from "@shared/nonprofit-policy";

const SETTINGS = "questPayrollSettings";
const PAYEES = "questPayrollPayees";
const BATCHES = "questPayrollBatches";
const LEDGER = "questPayoutLedger";
const AGREEMENTS = "questPayrollAgreements";
const SIGNINGS = "questPayrollSignings";
const TRANSACTIONS = "questPayrollTransactions";
const AUDIT = "questPayrollAuditEvents";

const PAYMENT_METHODS = ["manual", "ach", "stripe_ach", "paypal", "check", "other"] as const;
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
  const date = dateValue
    ? /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ? new Date(`${dateValue}T12:00:00Z`)
      : new Date(dateValue)
    : new Date();
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

function numericCents(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function dollarsToCents(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function transactionHasLedgerSource(transaction: any, ledger: any[]) {
  const sourceId = String(transaction.sourceLedgerId || transaction.ledgerId || "");
  if (sourceId && ledger.some((entry) => String(entry.id) === sourceId)) return true;
  if (!transaction.batchId || !transaction.payeeId) return false;
  const amount = numericCents(transaction.amountCents);
  const candidates = ledger.filter((entry) =>
    String(entry.batchId) === String(transaction.batchId)
    && String(entry.payeeId) === String(transaction.payeeId)
    && (
      numericCents(entry.nonprofitCents) === amount
      || (entry.status === "forfeited" && numericCents(entry.grossCents) === amount)
    ),
  );
  return candidates.length > 0;
}

function charityAllocationCents(transactions: any[], ledger: any[]) {
  const standaloneAllocations = transactions
    .filter((item) => item.type === "nonprofit_allocation" && !transactionHasLedgerSource(item, ledger));
  return ledger.reduce((sum, entry) => sum + numericCents(entry.nonprofitCents), 0)
    + standaloneAllocations.reduce((sum, item) => sum + numericCents(item.amountCents), 0);
}

function displayName(profile: any, fallback = "Unknown") {
  return profile?.stageName || profile?.displayName || fallback;
}

async function buildFinancialOverview() {
  const [competitions, allContestants, profiles, payeesSnap, ledgerSnap, transactionsSnap, batchesSnap, joinSettings] = await Promise.all([
    storage.getCompetitions(),
    storage.getAllContestants(),
    storage.getAllTalentProfiles(),
    db().collection(PAYEES).get(),
    db().collection(LEDGER).get(),
    db().collection(TRANSACTIONS).get(),
    db().collection(BATCHES).get(),
    firestoreJoinSettings.get(),
  ]);

  const payees: Array<{ id: string; name?: string; [key: string]: any }> =
    payeesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const ledger = ledgerSnap.docs.map((doc) => serialize(doc.id, doc.data() || {}));
  const transactions = transactionsSnap.docs.map((doc) => serialize(doc.id, doc.data() || {}));
  const batches = batchesSnap.docs.map((doc) => serialize(doc.id, doc.data() || {}));
  const [purchasesByCompetition, freeVotesByCompetition, contestantVotesByCompetition] = await Promise.all([
    Promise.all(competitions.map(async (competition) => [competition.id, await storage.getVotePurchasesByCompetition(competition.id)] as const)),
    Promise.all(competitions.map(async (competition) => [competition.id, await storage.getTotalVotesByCompetition(competition.id)] as const)),
    // getContestantsByCompetition returns rawVoteCount (true free vote count) per contestant
    Promise.all(competitions.map(async (competition) => [competition.id, await storage.getContestantsByCompetition(competition.id)] as const)),
  ]);
  const purchaseMap = new Map(purchasesByCompetition);
  const freeVotesMap = new Map(freeVotesByCompetition);
  // Map: competitionId → Map of contestantId → rawVoteCount
  const contestantRawVotesMap = new Map(
    contestantVotesByCompetition.map(([compId, contestants]) => [
      compId,
      new Map(contestants.map((c) => [c.id, c.rawVoteCount ?? 0])),
    ]),
  );
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const contestantById = new Map(allContestants.map((contestant) => [contestant.id, contestant]));
  const nonprofitRates = joinSettings.nonprofitContributionRates;
  const platformNonprofitPercentage = isValidNonprofitContributionRate(nonprofitRates?.platform)
    ? nonprofitRates.platform
    : null;
  const contestantNonprofitPercentage = isValidNonprofitContributionRate(nonprofitRates?.contestant)
    ? nonprofitRates.contestant
    : null;
  const hostNonprofitPercentage = isValidNonprofitContributionRate(nonprofitRates?.host)
    ? nonprofitRates.host
    : null;

  const payeeMatchesProfile = (payee: any, profile: any) => {
    return payee.userId === profile.userId
      || Number(payee.talentProfileId) === Number(profile.id);
  };

  const entriesForProfile = (profile: any, competitionId?: number) => {
    const matchingPayeeIds = new Set(payees.filter((payee) => payeeMatchesProfile(payee, profile)).map((payee) => payee.id));
    return ledger.filter((entry: any) =>
      matchingPayeeIds.has(entry.payeeId)
      && (competitionId === undefined || Number(entry.competitionId) === competitionId),
    );
  };

  const transactionsForCompetition = (competitionId: number) =>
    transactions.filter((item: any) => Number(item.competitionId) === competitionId);

  const ledgerForCompetition = (competitionId: number) =>
    ledger.filter((item: any) => Number(item.competitionId) === competitionId);

  const competitionBreakdowns = competitions.map((competition) => {
    const purchases = purchaseMap.get(competition.id) || [];
    const compContestants = allContestants.filter((contestant) => contestant.competitionId === competition.id);
    const compTransactions = transactionsForCompetition(competition.id);
    const compLedger = ledgerForCompetition(competition.id);
    const hostProfile = competition.createdBy ? profilesByUserId.get(competition.createdBy) : null;
    const hostPayeeIds = new Set(payees
      .filter((payee) => hostProfile && payeeMatchesProfile(payee, hostProfile))
      .map((payee) => payee.id));
    const hostEntries = compLedger.filter((entry: any) => hostPayeeIds.has(entry.payeeId));
    const compFreeVotes = freeVotesMap.get(competition.id) || 0;
    const contestantRows = compContestants.map((contestant: any, index) => {
      const profile = profilesById.get(contestant.talentProfileId) || contestant.talentProfile;
      const entries = profile ? entriesForProfile(profile, competition.id) : [];
      const contestantPurchases = purchases.filter((purchase: any) => Number(purchase.contestantId) === contestant.id);
      const grossCents = entries.reduce((sum, entry: any) => sum + numericCents(entry.grossCents), 0);
      const nonprofitCents = entries.reduce((sum, entry: any) => sum + numericCents(entry.nonprofitCents), 0);
      const pendingCents = entries
        .filter((entry: any) => ["pending_approval", "approved", "blocked"].includes(entry.status))
        .reduce((sum, entry: any) => sum + numericCents(entry.netCents), 0);
      const paidCents = entries.filter((entry: any) => entry.status === "paid").reduce((sum, entry: any) => sum + numericCents(entry.netCents), 0);
      const totalPaidVoteShare = purchases.reduce((sum, purchase: any) => sum + Number(purchase.voteCount || 0), 0);
      const contestantPaidVoteCount = contestantPurchases.reduce((sum, purchase: any) => sum + Number(purchase.voteCount || 0), 0);
      // freeVoteCount: use the per-competition contestant vote map (rawVoteCount from getContestantsByCompetition)
      const freeVoteCount = contestantRawVotesMap.get(competition.id)?.get(contestant.id) ?? 0;
      const totalVoteCount = freeVoteCount + contestantPaidVoteCount;
      return {
        contestantId: contestant.id,
        talentProfileId: contestant.talentProfileId,
        name: displayName(profile, `Contestant ${index + 1}`),
        profileUserId: profile?.userId || null,
        freeVoteCount,
        paidVoteCount: contestantPaidVoteCount,
        totalVoteCount,
        paidVoteRevenueCents: contestantPurchases.reduce((sum, purchase: any) => sum + dollarsToCents(purchase.amount), 0),
        voteSharePercentage: totalPaidVoteShare > 0 ? Math.round((contestantPaidVoteCount / totalPaidVoteShare) * 10000) / 100 : 0,
        earningsCents: grossCents,
        nonprofitCents,
        pendingCents,
        paidCents,
        placement: entries[0]?.placement || null,
        payoutEntries: entries.map((entry: any) => ({
          id: entry.id,
          status: entry.status,
          grossCents: numericCents(entry.grossCents),
          netCents: numericCents(entry.netCents),
          payoutDueDate: batches.find((batch: any) => batch.id === entry.batchId)?.payoutDueDate || null,
          paymentInfoProvided: Boolean(entry.paymentInfoProvided),
          blockedReason: entry.blockedReason || null,
        })),
      };
    });
    const paidVoteRevenueCents = purchases.reduce((sum, purchase: any) => sum + dollarsToCents(purchase.amount), 0);
    const hostShareCents = hostEntries.reduce((sum, entry: any) => sum + numericCents(entry.grossCents), 0);
    const contestantShareCents = contestantRows.reduce((sum, row) => sum + row.earningsCents, 0);
    const platformShareCents = Math.max(0, paidVoteRevenueCents - hostShareCents - contestantShareCents);
    const platformNonprofitDueCents = platformNonprofitPercentage === null
      ? null
      : nonprofitAllocationCents(platformShareCents, platformNonprofitPercentage);
    const charityShareCents = charityAllocationCents(compTransactions, compLedger);
    const paidVoteCount = purchases.reduce((sum, purchase: any) => sum + Number(purchase.voteCount || 0), 0);
    const totalVoteCount = compFreeVotes + paidVoteCount;
    return {
      competitionId: competition.id,
      title: competition.title,
      category: competition.category,
      status: competition.status,
      endDate: competition.endDate,
      hostUid: competition.createdBy || null,
      hostName: displayName(hostProfile, competition.createdBy ? "Assigned host" : "The Quest"),
      hostShareCents,
      hostSharePercentage: paidVoteRevenueCents > 0 ? Math.round((hostShareCents / paidVoteRevenueCents) * 10000) / 100 : 0,
      charityShareCents,
      contestantShareCents,
      platformShareCents,
      platformNonprofitPercentage,
      platformNonprofitDueCents,
      votes: {
        freeVoteCount: compFreeVotes,
        paidVoteCount,
        totalVoteCount,
      },
      paidVoting: {
        revenueCents: paidVoteRevenueCents,
        purchaseCount: purchases.length,
        purchasedVoteCount: paidVoteCount,
      },
      paidVoteDetails: purchases
        .map((purchase: any) => {
          const contestant = contestantById.get(Number(purchase.contestantId));
          const profile = contestant ? profilesById.get(contestant.talentProfileId) : null;
          return {
            id: purchase.id,
            contestantId: purchase.contestantId,
            contestantName: displayName(profile, "Unknown contestant"),
            purchaserName: purchase.guestName || "Registered voter",
            purchaserEmail: purchase.guestEmail || null,
            voteCount: Number(purchase.voteCount || 0),
            amountCents: dollarsToCents(purchase.amount),
            transactionId: purchase.transactionId || null,
            purchasedAt: purchase.purchasedAt || null,
          };
        })
        .sort((a: any, b: any) => String(b.purchasedAt || "").localeCompare(String(a.purchasedAt || ""))),
      contestants: contestantRows,
      pendingPayouts: compLedger
        .filter((entry: any) => ["pending_approval", "approved", "blocked"].includes(entry.status))
        .map((entry: any) => ({
          id: entry.id,
          payeeId: entry.payeeId,
          status: entry.status,
          netCents: numericCents(entry.netCents),
          grossCents: numericCents(entry.grossCents),
          dueDate: batches.find((batch: any) => batch.id === entry.batchId)?.payoutDueDate || null,
          paymentInfoProvided: Boolean(entry.paymentInfoProvided),
          blockedReason: entry.blockedReason || null,
        })),
    };
  });

  const hostUserIds = new Set(competitions.map((competition) => competition.createdBy).filter(Boolean));
  const contestantProfileIds = new Set(allContestants.map((contestant) => contestant.talentProfileId));
  const platformDefaultCharity = joinSettings.charityName || "Platform recipient not configured";
  const platformDefaultCharityPercentage = platformNonprofitPercentage ?? 0;
  const profileEarnings = profiles
    .filter((profile) => profile.role !== "admin" && (profile.role === "host" || hostUserIds.has(profile.userId) || contestantProfileIds.has(profile.id)))
    .map((profile) => {
      const entries = entriesForProfile(profile);
      const pending = entries
        .filter((entry: any) => ["pending_approval", "approved", "blocked"].includes(entry.status))
        .reduce((sum, entry: any) => sum + numericCents(entry.netCents), 0);
      const paid = entries.filter((entry: any) => entry.status === "paid").reduce((sum, entry: any) => sum + numericCents(entry.netCents), 0);
      const gross = entries.reduce((sum, entry: any) => sum + numericCents(entry.grossCents), 0);
      const nextEntry = entries
        .filter((entry: any) => ["pending_approval", "approved"].includes(entry.status))
        .sort((a: any, b: any) => String(batches.find((batch: any) => batch.id === a.batchId)?.payoutDueDate || "").localeCompare(String(batches.find((batch: any) => batch.id === b.batchId)?.payoutDueDate || "")))[0];
      const nonprofitCents = entries.reduce((sum, entry: any) => sum + numericCents(entry.nonprofitCents), 0);
      const declaration = profile.nonprofitDeclaration;
      const declaredCharity = hasPrizeReadyNonprofitDeclaration(declaration)
        ? declaredNonprofitName(declaration)
        : "";
      const profileRate = profile.role === "host" ? hostNonprofitPercentage : contestantNonprofitPercentage;
      return {
        userId: profile.userId,
        talentProfileId: profile.id,
        name: displayName(profile),
        role: profile.role,
        profileType: profile.role === "host" || hostUserIds.has(profile.userId) ? "host" : "contestant",
        nonprofitDeclaration: declaration || null,
        charitySource: declaredCharity || null,
        charitySourceType: declaredCharity ? "declared" : "missing_declaration",
        charityPercentage: gross > 0
          ? Math.round((nonprofitCents / gross) * 10000) / 100
          : profileRate,
        grossCents: gross,
        pendingCents: pending,
        paidCents: paid,
        nonprofitCents,
        nextPayoutCents: nextEntry ? numericCents(nextEntry.netCents) : 0,
        nextPayoutDate: nextEntry ? (batches.find((batch: any) => batch.id === nextEntry.batchId)?.payoutDueDate || null) : null,
        payoutEntries: entries.map((entry: any) => ({
          id: entry.id,
          competitionId: entry.competitionId,
          status: entry.status,
          grossCents: numericCents(entry.grossCents),
          netCents: numericCents(entry.netCents),
          nonprofitCents: numericCents(entry.nonprofitCents),
          dueDate: batches.find((batch: any) => batch.id === entry.batchId)?.payoutDueDate || null,
          blockedReason: entry.blockedReason || null,
        })),
      };
    })
    .sort((a, b) => a.profileType.localeCompare(b.profileType) || a.name.localeCompare(b.name));

  const pendingPayouts = ledger
    .filter((entry: any) => ["pending_approval", "approved", "blocked"].includes(entry.status))
    .map((entry: any) => ({
      id: entry.id,
      competitionId: entry.competitionId,
      payeeId: entry.payeeId,
      payeeName: payees.find((payee: any) => payee.id === entry.payeeId)?.name || "Unmatched payee",
      status: entry.status,
      netCents: numericCents(entry.netCents),
      dueDate: batches.find((batch: any) => batch.id === entry.batchId)?.payoutDueDate || null,
      paymentInfoProvided: Boolean(entry.paymentInfoProvided),
      blockedReason: entry.blockedReason || null,
    }));

  return {
    summary: {
      paidVotingRevenueCents: competitionBreakdowns.reduce((sum, competition) => sum + competition.paidVoting.revenueCents, 0),
      paidVotingPurchases: competitionBreakdowns.reduce((sum, competition) => sum + competition.paidVoting.purchaseCount, 0),
      paidVotingVoteCount: competitionBreakdowns.reduce((sum, competition) => sum + competition.paidVoting.purchasedVoteCount, 0),
      freeVoteCount: competitionBreakdowns.reduce((sum, competition) => sum + competition.votes.freeVoteCount, 0),
      totalVoteCount: competitionBreakdowns.reduce((sum, competition) => sum + competition.votes.totalVoteCount, 0),
      hostShareCents: competitionBreakdowns.reduce((sum, competition) => sum + competition.hostShareCents, 0),
      contestantShareCents: competitionBreakdowns.reduce((sum, competition) => sum + competition.contestantShareCents, 0),
      charityShareCents: competitionBreakdowns.reduce((sum, competition) => sum + competition.charityShareCents, 0),
      platformShareCents: competitionBreakdowns.reduce((sum, competition) => sum + competition.platformShareCents, 0),
      platformNonprofitDueCents: platformNonprofitPercentage === null
        ? null
        : competitionBreakdowns.reduce((sum, competition) => sum + (competition.platformNonprofitDueCents || 0), 0),
      pendingPayoutCents: pendingPayouts.reduce((sum, payout) => sum + payout.netCents, 0),
      paidPayoutCents: ledger.filter((entry: any) => entry.status === "paid").reduce((sum, entry: any) => sum + numericCents(entry.netCents), 0),
      forfeitedCents: ledger.filter((entry: any) => entry.status === "forfeited").reduce((sum, entry: any) => sum + numericCents(entry.grossCents), 0),
    },
    competitions: competitionBreakdowns,
    profileEarnings,
    pendingPayouts,
    nonprofitDeclarations: profiles
      .filter((profile) => profile.role !== "admin" && (
        declaredNonprofitName(profile.nonprofitDeclaration)
        || profile.nonprofitDeclaration?.programAcknowledged
        || profile.nonprofitDeclaration?.consentToDonate
      ))
      .map((profile) => ({
        userId: profile.userId,
        talentProfileId: profile.id,
        name: displayName(profile),
        role: profile.role,
        declaration: profile.nonprofitDeclaration,
        payoutReady: hasPrizeReadyNonprofitDeclaration(profile.nonprofitDeclaration),
      })),
    platformDefaultCharity: {
      name: platformDefaultCharity,
      percentage: platformDefaultCharityPercentage,
      dueCents: platformNonprofitPercentage === null
        ? null
        : competitionBreakdowns.reduce((sum, competition) => sum + (competition.platformNonprofitDueCents || 0), 0),
    },
    nonprofitContributionRates: nonprofitRates,
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
        nonprofitCents: charityAllocationCents(
          transactionsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })),
          ledgerSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })),
        ),
        batches: batches.length,
        transactions: transactions.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load payroll summary." });
    }
  });

  app.get("/api/admin/financial-overview", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      res.json(await buildFinancialOverview());
    } catch (error: any) {
      console.error("Financial overview error:", error);
      res.status(500).json({ message: error.message || "Could not load financial overview." });
    }
  });

  app.get("/api/payroll/my-overview", firebaseAuth, async (req: any, res: any) => {
    try {
      const uid = req.firebaseUser?.uid;
      const profile = await storage.getTalentProfileByUserId(uid);
      if (!profile) return res.json({ role: "viewer", competitions: [], earnings: null, pendingPayouts: [] });
      const overview = await buildFinancialOverview();
      if (profile.role === "host" || Number(req.firebaseUser?.level) === 3) {
        return res.json({
          role: "host",
          competitions: overview.competitions.filter((competition) => competition.hostUid === uid),
          earnings: overview.profileEarnings.find((earning) => earning.userId === uid) || null,
          pendingPayouts: overview.pendingPayouts.filter((payout) =>
            overview.competitions.some((competition) => competition.competitionId === payout.competitionId && competition.hostUid === uid),
          ),
        });
      }
      const myCompetitions = overview.competitions
        .map((competition) => ({
          ...competition,
          contestants: competition.contestants.filter((contestant) => contestant.profileUserId === uid),
        }))
        .filter((competition) => competition.contestants.length > 0);
      return res.json({
        role: "contestant",
        competitions: myCompetitions,
        earnings: overview.profileEarnings.find((earning) => earning.userId === uid) || null,
        pendingPayouts: overview.pendingPayouts.filter((payout) => overview.profileEarnings
          .find((earning) => earning.userId === uid)?.payoutEntries.some((entry) => entry.id === payout.id)),
      });
    } catch (error: any) {
      console.error("Personal financial overview error:", error);
      res.status(500).json({ message: error.message || "Could not load your financial overview." });
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
      const userId = clean(req.body?.userId, 160);
      const talentProfileId = Number(req.body?.talentProfileId);
      if (type === "contestant" || type === "host") {
        if (!userId || !Number.isInteger(talentProfileId) || talentProfileId <= 0) {
          return res.status(400).json({ message: `Link this ${type} payee to a verified ${type} profile.` });
        }
        const linkedProfile = await storage.getTalentProfile(talentProfileId);
        const expectedRole = type === "contestant" ? "talent" : "host";
        if (!linkedProfile || linkedProfile.role !== expectedRole || linkedProfile.userId !== userId) {
          return res.status(400).json({ message: `The selected ${type} profile does not match this account.` });
        }
      }
      const record = {
        name,
        email,
        type,
        ...(type === "contestant" || type === "host" ? { userId, talentProfileId } : {}),
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
      const nextType = (update.type || existing.data.type) as PayeeType;
      const linkWasChanged = req.body?.userId !== undefined || req.body?.talentProfileId !== undefined;
      const typeWasChanged = nextType !== existing.data.type;
      if (linkWasChanged || typeWasChanged) {
        if (nextType === "contestant" || nextType === "host") {
          const userId = clean(req.body?.userId ?? existing.data.userId, 160);
          const talentProfileId = Number(req.body?.talentProfileId ?? existing.data.talentProfileId);
          if (!userId || !Number.isInteger(talentProfileId) || talentProfileId <= 0) {
            return res.status(400).json({ message: `Choose a linked ${nextType} profile for this payee.` });
          }
          const linkedProfile = await storage.getTalentProfile(talentProfileId);
          const expectedRole = nextType === "contestant" ? "talent" : "host";
          if (!linkedProfile || linkedProfile.role !== expectedRole || linkedProfile.userId !== userId) {
            return res.status(400).json({ message: `The selected ${nextType} profile does not match this account.` });
          }
          update.userId = userId;
          update.talentProfileId = talentProfileId;
        } else if (linkWasChanged) {
          return res.status(400).json({ message: "Only contestant and host payees can be linked to a Quest profile." });
        }
      }
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
      const nonprofitPolicy = await firestoreJoinSettings.get();
      if (!isNonprofitPolicyConfigured(nonprofitPolicy)) {
        return res.status(409).json({ message: "Configure all three nonprofit contribution rates and the platform recipient before creating a payout batch." });
      }
      const competitionId = Number.isFinite(Number(req.body?.competitionId)) ? Number(req.body.competitionId) : null;
      const competition = competitionId ? await storage.getCompetition(competitionId) : null;
       const competitionEndDate = clean(req.body?.competitionEndDate, 40) || competition?.endDate || null;
      const dueDate = nextMonthFirst(competitionEndDate);
      if (!dueDate) return res.status(400).json({ message: "A valid competition end date is required." });
       const taxDeadline = finalVotingDeadline(competition);
       const taxDeadlineTime = taxDeadline
         ? (/^\d{4}-\d{2}-\d{2}$/.test(taxDeadline)
           ? new Date(`${taxDeadline}T23:59:59.999Z`).getTime()
           : new Date(taxDeadline).getTime())
         : Number.NaN;
       const taxDeadlinePassed = Number.isFinite(taxDeadlineTime) && Date.now() > taxDeadlineTime;
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
          const payeeType = payee.data.type as PayeeType;
          const requiresNonprofitDeclaration = payeeType === "contestant" || payeeType === "host";
          const expectedProfileRole = payeeType === "contestant" ? "talent" : payeeType === "host" ? "host" : null;
          const userId = clean(payee.data.userId, 160);
          const talentProfileId = Number(payee.data.talentProfileId);
          const linkedProfile = requiresNonprofitDeclaration && Number.isInteger(talentProfileId) && talentProfileId > 0
            ? await storage.getTalentProfile(talentProfileId)
            : null;
          const stableLink = Boolean(
            expectedProfileRole
            && userId
            && linkedProfile
            && linkedProfile.role === expectedProfileRole
            && linkedProfile.userId === userId,
          );
          const declaration = stableLink ? linkedProfile?.nonprofitDeclaration : null;
          const nonprofitDeclarationReady = !requiresNonprofitDeclaration
            || Boolean(stableLink && hasPrizeReadyNonprofitDeclaration(declaration));
          const nonprofitSelection = requiresNonprofitDeclaration
            ? nonprofitDeclarationReady ? declaredNonprofitName(declaration) : null
            : clean(raw?.nonprofitSelection, 180) || null;
          const nonprofitPercentage = payeeType === "contestant"
            ? nonprofitPolicy.nonprofitContributionRates.contestant
            : payeeType === "host"
              ? nonprofitPolicy.nonprofitContributionRates.host
              : null;
          const nonprofitCents = requiresNonprofitDeclaration && isValidNonprofitContributionRate(nonprofitPercentage)
            ? nonprofitAllocationCents(grossCents, nonprofitPercentage)
            : 0;
          let paymentInfoProvided = Boolean(raw?.paymentInfoProvided || payee.data.paymentInfoProvided);
          let taxInfoSatisfied: boolean | null = null;
          let taxYear: number | null = null;
          if (payeeType === "contestant") {
           taxYear = taxDeadline && Number.isFinite(new Date(taxDeadline).getTime())
             ? new Date(taxDeadline).getUTCFullYear()
             : null;
           taxInfoSatisfied = Boolean(
             stableLink
             && taxDeadline
             && taxYear
             && await hasTaxInfoBeforeDeadline(userId, talentProfileId, taxYear, taxDeadline),
           );
           paymentInfoProvided = taxInfoSatisfied;
         }
          const eligible = paymentInfoProvided && nonprofitDeclarationReady;
          const forfeited = payeeType === "contestant"
            && !taxInfoSatisfied
           && settings.missingPaymentPolicy === "forfeit"
           && taxDeadlinePassed;
         const blocked = !eligible && !forfeited;
        const netCents = forfeited ? 0 : Math.max(0, grossCents - deductionsCents - nonprofitCents);
         const ledgerRef = db().collection(LEDGER).doc();
          const nonprofitTransactionRef = nonprofitCents > 0 && nonprofitSelection
            ? db().collection(TRANSACTIONS).doc()
            : null;
        const ledgerRecord = {
          batchId: batchRef.id,
          competitionId,
          payeeId,
          placement: Math.max(1, Math.round(Number(raw?.placement) || 1)),
          grossCents,
          deductions,
          deductionsCents,
           nonprofitSelection,
          nonprofitCents,
           nonprofitContributionLevel: requiresNonprofitDeclaration ? payeeType : null,
           nonprofitPercentage: requiresNonprofitDeclaration ? nonprofitPercentage : null,
           nonprofitPolicyAcknowledged: requiresNonprofitDeclaration
             ? hasAcknowledgedNonprofitDeclaration(declaration)
             : null,
          netCents,
           paymentInfoDeadline: taxDeadline,
           taxYear,
           taxInfoSatisfied,
           paymentInfoProvided,
           eligible,
           status: forfeited ? "forfeited" : blocked ? "blocked" : "pending_approval",
           blockedReason: forfeited
             ? "Required information was not provided by the final-voting deadline."
             : blocked
                ? [
                    !nonprofitDeclarationReady
                      ? `A linked ${payeeType} profile must have a nonprofit name and acknowledge the required contribution policy.`
                      : null,
                    !paymentInfoProvided
                      ? payeeType === "contestant"
                        ? "Tax details were not acknowledged and saved before the final-voting deadline."
                        : "Payment information is missing."
                      : null,
                  ].filter(Boolean).join(" ")
               : null,
          payoutReference: null,
           nonprofitAllocationTransactionId: nonprofitTransactionRef?.id || null,
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
           batch.set(nonprofitTransactionRef!, {
             type: "nonprofit_allocation",
             amountCents: nonprofitCents,
             payeeId,
             competitionId,
             batchId: batchRef.id,
             sourceLedgerId: ledgerRef.id,
              nonprofitSelection,
              nonprofitPercentage,
             createdBy: req.firebaseUser?.uid || null,
             createdAt: now(),
           });
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

  /**
   * POST /api/admin/payroll/execute-monthly
   * Triggers the monthly payout job immediately.
   * Safe to call manually from the admin UI or by a cron scheduler on the 1st.
   * Returns a full summary: paid, skipped, and failed entries.
   */
  app.post("/api/admin/payroll/execute-monthly", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const triggeredBy = req.firebaseUser?.email || req.firebaseUser?.uid || "admin";
      await audit(req.firebaseUser, "monthly_payout_job_triggered", { triggeredBy });
      const result = await runMonthlyPayouts(triggeredBy);
      res.json(result);
    } catch (error: any) {
      console.error("[payroll/execute-monthly]", error);
      res.status(500).json({ message: error.message || "Payout job failed." });
    }
  });

  /**
   * GET /api/admin/payroll/stripe-balance
   * Returns current platform Stripe balance (available + pending cents).
   * Used in the admin payroll UI to show how much is ready to disburse.
   */
  app.get("/api/admin/payroll/stripe-balance", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const { getStripeBalance } = await import("./stripe-payouts");
      const balance = await getStripeBalance();
      res.json(balance);
    } catch (error: any) {
      // Not fatal — Stripe may not be configured yet
      res.json({ available: null, pending: null, error: error.message });
    }
  });
}