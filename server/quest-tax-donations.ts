import type { Express } from "express";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { firebaseAuth, requireAdmin } from "./auth-middleware";
import { decrypt, encrypt, isEncryptionKeySet } from "./encryption";
import { getFirestore } from "./firebase-admin";
import { storage } from "./storage";

const TAX_PROFILES = "questTaxProfiles";
const TAX_SETTINGS = "questTaxSettings";
const PAYEES = "questPayrollPayees";
const LEDGER = "questPayoutLedger";
const TRANSACTIONS = "questPayrollTransactions";
const DISBURSEMENTS = "questNonprofitDisbursements";
const AUDIT = "questTaxDonationAuditEvents";
const IRS_FORM_FILE = "1099_form_1790278740415.pdf";
const RECIPIENT_COPY_PAGE_INDEX = 3;

type TaxData = {
  legalName: string;
  businessName: string;
  taxIdType: "ssn" | "ein";
  taxId: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const now = () => new Date().toISOString();
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const taxProfileDocId = (profileId: number, year: number) => `${profileId}_${year}`;
const stateCodes: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
  "puerto rico": "PR", guam: "GU", "u.s. virgin islands": "VI", "virgin islands": "VI",
};
const countryCodes: Record<string, string> = {
  "united states": "US", "united states of america": "US", usa: "US", canada: "CA",
  "united kingdom": "GB", uk: "GB", mexico: "MX", australia: "AU", germany: "DE",
  france: "FR", india: "IN", japan: "JP", ireland: "IE", italy: "IT", spain: "ES",
  netherlands: "NL", brazil: "BR", china: "CN", "new zealand": "NZ",
};
const stateCode = (value: unknown) => {
  const text = clean(value, 80).toLowerCase();
  if (/^[a-z]{2}$/.test(text)) return text.toUpperCase();
  return stateCodes[text] || "";
};
const countryCode = (value: unknown) => {
  const text = clean(value, 80).toLowerCase();
  if (/^[a-z]{2}$/.test(text)) return text.toUpperCase();
  return countryCodes[text] || "";
};
const cents = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
const moneyToCents = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
};
const parseTaxYear = (value: unknown) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
};
const parseDate = (value: unknown) => {
  if (value && typeof (value as any).toDate === "function") {
    const date = (value as any).toDate();
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const text = clean(value, 40);
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
};
const endOfDay = (value: unknown) => {
  const text = clean(value, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T23:59:59.999Z`);
  return parseDate(text);
};

function validTaxData(body: any, retainedTaxId = ""): TaxData | null {
  const taxIdType = body?.taxIdType === "ein" ? "ein" : body?.taxIdType === "ssn" ? "ssn" : null;
  const taxId = digits(body?.taxId) || retainedTaxId;
  const country = countryCode(body?.country || "US");
  const data: TaxData = {
    legalName: clean(body?.legalName, 160),
    businessName: clean(body?.businessName, 160),
    taxIdType: taxIdType || "ssn",
    taxId,
    address1: clean(body?.address1, 180),
    address2: clean(body?.address2, 100),
    city: clean(body?.city, 100),
    state: stateCode(body?.state),
    postalCode: clean(body?.postalCode, 24),
    country,
  };
  if (
    !taxIdType
    || !data.legalName
    || !data.address1
    || !data.city
    || data.state.length !== 2
    || !data.postalCode
    || data.country.length !== 2
    || data.taxId.length !== 9
  ) return null;
  return data;
}

function maskedTin(taxId: string) {
  return `••••${digits(taxId).slice(-4)}`;
}

function formatTin(taxId: string, type: "ssn" | "ein") {
  const value = digits(taxId);
  return type === "ein" ? `${value.slice(0, 2)}-${value.slice(2)}` : `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`;
}

async function getTaxpayerProfile(uid: string) {
  const profile = await storage.getTalentProfileByUserId(uid);
  if (!profile || profile.role !== "talent") return null;
  return profile;
}

function isPayerReady(payer: any) {
  return Boolean(
    payer?.payerName
    && payer?.payerTinEncrypted
    && payer?.address1
    && payer?.city
    && stateCode(payer?.state)
    && payer?.postalCode
    && countryCode(payer?.country || "US"),
  );
}

async function getPayerSettings() {
  const snapshot = await getFirestore().collection(TAX_SETTINGS).doc("payer").get();
  return snapshot.exists ? snapshot.data() || {} : {};
}

async function paidGrossCentsForProfile(userId: string, profileId: number, year: number) {
  const firestore = getFirestore();
  const payeeSnapshot = await firestore.collection(PAYEES).get();
  const payeeIds = new Set(
    payeeSnapshot.docs
      .filter((doc) => {
        const payee = doc.data();
        return payee.userId === userId || Number(payee.talentProfileId) === Number(profileId);
      })
      .map((doc) => doc.id),
  );
  if (!payeeIds.size) return 0;

  const ledgerSnapshot = await firestore.collection(LEDGER).get();
  return ledgerSnapshot.docs.reduce((sum, doc) => {
    const entry = doc.data();
    if (entry.status !== "paid" || !payeeIds.has(String(entry.payeeId))) return sum;
    const paidAt = parseDate(entry.paidAt);
    if (!paidAt || paidAt.getUTCFullYear() !== year) return sum;
    return sum + cents(entry.grossCents);
  }, 0);
}

function safePayer(payer: any) {
  return {
    payerName: clean(payer?.payerName, 180),
    address1: clean(payer?.address1, 180),
    address2: clean(payer?.address2, 100),
    city: clean(payer?.city, 100),
    state: stateCode(payer?.state),
    postalCode: clean(payer?.postalCode, 24),
    country: countryCode(payer?.country || "US"),
    phone: clean(payer?.phone, 40),
    payerTinLast4: clean(payer?.payerTinLast4, 4),
    configured: isPayerReady(payer),
  };
}

async function decryptTaxVersion(version: any): Promise<TaxData> {
  if (!isEncryptionKeySet() || !version?.encryptedPayload) {
    throw new Error("Secure tax data is unavailable.");
  }
  try {
    return JSON.parse(decrypt(String(version.encryptedPayload))) as TaxData;
  } catch {
    throw new Error("Tax records cannot be opened with the current encryption configuration.");
  }
}

async function resolveLedgerForAllocation(transaction: any) {
  const firestore = getFirestore();
  const directId = clean(transaction?.sourceLedgerId || transaction?.ledgerId, 160);
  if (directId) {
    const direct = await firestore.collection(LEDGER).doc(directId).get();
    if (direct.exists) return { id: direct.id, data: direct.data() || {} };
  }

  if (!transaction?.batchId || !transaction?.payeeId) return null;
  const entries = await firestore.collection(LEDGER).where("batchId", "==", transaction.batchId).get();
  const amount = cents(transaction.amountCents);
  const candidates = entries.docs.filter((entry) => {
    const value = entry.data();
    if (String(value.payeeId) !== String(transaction.payeeId)) return false;
    return cents(value.nonprofitCents) === amount
      || (value.status === "forfeited" && cents(value.grossCents) === amount);
  });
  if (candidates.length !== 1) return null;
  return { id: candidates[0].id, data: candidates[0].data() || {} };
}

function safeUrl(value: unknown) {
  const text = clean(value, 1200);
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Evidence links must be valid HTTP or HTTPS URLs.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Evidence links must be valid HTTP or HTTPS URLs.");
  }
  return url.toString();
}

function safeDisbursement(id: string, record: any) {
  return {
    id,
    organizationLegalName: clean(record.organizationLegalName, 180),
    organizationEinLast4: clean(record.organizationEinLast4, 4),
    organizationVerified: Boolean(record.organizationVerified),
    verificationMethod: clean(record.verificationMethod, 300),
    allocationTransactionId: clean(record.allocationTransactionId, 160),
    sourceLedgerId: clean(record.sourceLedgerId, 160),
    sourceAllocationCents: cents(record.sourceAllocationCents),
    amountCents: cents(record.amountCents),
    allocationDate: clean(record.allocationDate, 30),
    transferDate: clean(record.transferDate, 30),
    transactionReference: clean(record.transactionReference, 180),
    receiptUrl: clean(record.receiptUrl, 1200) || null,
    transactionEvidenceUrl: clean(record.transactionEvidenceUrl, 1200) || null,
    agreementUrl: clean(record.agreementUrl, 1200) || null,
    notes: clean(record.notes, 1000),
    createdAt: record.createdAt || null,
    createdBy: record.createdBy || null,
    evidenceComplete: Boolean(record.receiptUrl && record.transactionEvidenceUrl && record.agreementUrl),
  };
}

export async function hasTaxInfoBeforeDeadline(
  userId: string,
  profileId: number,
  year: number,
  deadline: string | null | undefined,
) {
  if (!isEncryptionKeySet() || !userId || !profileId || !year || !deadline) return false;
  const cutoff = endOfDay(deadline);
  if (!cutoff) return false;
  const ref = getFirestore().collection(TAX_PROFILES).doc(taxProfileDocId(profileId, year));
  const [profileSnapshot, versionsSnapshot] = await Promise.all([
    ref.get(),
    ref.collection("versions").get(),
  ]);
  if (!profileSnapshot.exists) return false;
  const profileData = profileSnapshot.data() || {};
  if (profileData.userId !== userId || Number(profileData.profileId) !== Number(profileId)) return false;
  const acknowledgement = parseDate(profileData.acknowledgedAt);
  if (!acknowledgement || acknowledgement > cutoff) return false;
  return versionsSnapshot.docs.some((doc) => {
    const version = doc.data();
    const savedAt = parseDate(version.createdAt);
    const versionAcknowledgement = parseDate(version.acknowledgedAt);
    return Boolean(
      version.complete
      && savedAt
      && savedAt <= cutoff
      && versionAcknowledgement
      && versionAcknowledgement <= cutoff,
    );
  });
}

export function finalVotingDeadline(competition: any): string | null {
  if (!competition) return null;
  const finale = Array.isArray(competition.stages)
    ? competition.stages.find((stage: any) => stage?.isFinale === true)
    : null;
  for (const value of [finale?.votingEndDate, competition.votingEndDate, competition.endDate]) {
    const candidate = clean(value, 40);
    if (candidate && endOfDay(candidate)) return candidate;
  }
  return null;
}

async function latestTaxVersionForProfile(userId: string, profileId: number) {
  const firestore = getFirestore();
  const profileDocs = await firestore.collection(TAX_PROFILES).where("userId", "==", userId).get();
  const matchingParents = profileDocs.docs.filter((doc) => Number(doc.data().profileId) === Number(profileId));
  const versionSets = await Promise.all(matchingParents.map(async (parent) => {
    const versions = await parent.ref.collection("versions").get();
    return versions.docs.map((doc) => ({
      id: doc.id,
      taxYear: Number(parent.data().taxYear),
      data: doc.data(),
    }));
  }));
  return versionSets.flat()
    .sort((a, b) => String(b.data.createdAt || "").localeCompare(String(a.data.createdAt || "")))[0] || null;
}

export function registerQuestTaxAndDonations(app: Express) {
  app.get("/api/admin/payroll/contestant-profiles", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const snapshot = await getFirestore().collection("talentProfiles").get();
      res.json(snapshot.docs
        .map((doc) => ({ id: Number(doc.id), ...doc.data() }))
        .filter((profile: any) => Number.isFinite(profile.id) && profile.userId && profile.role === "talent")
        .map((profile: any) => ({
          id: profile.id,
          userId: profile.userId,
          name: clean(profile.stageName || profile.displayName || "Contestant", 160),
          email: clean(profile.email, 320).toLowerCase(),
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch {
      res.status(500).json({ message: "Could not load contestant profiles." });
    }
  });

  app.get("/api/tax/my-years", firebaseAuth, async (req: any, res: any) => {
    try {
      const uid = String(req.firebaseUser?.uid || "");
      const profile = await getTaxpayerProfile(uid);
      if (!profile) return res.status(403).json({ message: "A contestant profile is required." });
      const firestore = getFirestore();
      const profileDocs = await firestore.collection(TAX_PROFILES).where("userId", "==", uid).get();
      const years = new Set<number>([new Date().getUTCFullYear()]);
      profileDocs.docs.forEach((doc) => {
        const year = parseTaxYear(doc.data().taxYear);
        if (year) years.add(year);
      });
      const payees = await firestore.collection(PAYEES).get();
      const ids = new Set(payees.docs
        .filter((doc) => doc.data().userId === uid || Number(doc.data().talentProfileId) === Number(profile.id))
        .map((doc) => doc.id));
      if (ids.size) {
        const ledger = await firestore.collection(LEDGER).get();
        ledger.docs.forEach((doc) => {
          const entry = doc.data();
          const paidAt = parseDate(entry.paidAt);
          if (entry.status === "paid" && ids.has(String(entry.payeeId)) && paidAt) years.add(paidAt.getUTCFullYear());
        });
      }
      res.json([...years].sort((a, b) => b - a));
    } catch {
      res.status(500).json({ message: "Could not load your tax years." });
    }
  });

  app.get("/api/tax/my-deadlines", firebaseAuth, async (req: any, res: any) => {
    try {
      const uid = String(req.firebaseUser?.uid || "");
      const profile = await getTaxpayerProfile(uid);
      if (!profile) return res.status(403).json({ message: "A contestant profile is required." });
      const [competitions, contestants] = await Promise.all([
        storage.getCompetitions(),
        storage.getAllContestants(),
      ]);
      const competitionById = new Map(competitions.map((competition) => [Number(competition.id), competition]));
      const deadlines = contestants
        .filter((contestant: any) => Number(contestant.talentProfileId) === Number(profile.id))
        .map((contestant: any) => {
          const competition = competitionById.get(Number(contestant.competitionId));
          const deadline = finalVotingDeadline(competition);
          return deadline ? {
            competitionId: Number(contestant.competitionId),
            competitionTitle: clean(competition?.title || contestant.competitionTitle || "Competition", 180),
            deadline,
            taxYear: new Date(deadline).getUTCFullYear(),
          } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => String(a.deadline).localeCompare(String(b.deadline)));
      res.setHeader("Cache-Control", "private, no-store");
      res.json(deadlines);
    } catch {
      res.status(500).json({ message: "Could not load your tax-information deadlines." });
    }
  });

  app.get("/api/tax/my-profile/:taxYear", firebaseAuth, async (req: any, res: any) => {
    try {
      const uid = String(req.firebaseUser?.uid || "");
      const profile = await getTaxpayerProfile(uid);
      if (!profile) return res.status(403).json({ message: "A contestant profile is required." });
      const year = parseTaxYear(req.params.taxYear);
      if (!year) return res.status(400).json({ message: "Choose a valid tax year." });
      const firestore = getFirestore();
      const ref = firestore.collection(TAX_PROFILES).doc(taxProfileDocId(Number(profile.id), year));
      const [profileSnapshot, versionsSnapshot, payer] = await Promise.all([
        ref.get(),
        ref.collection("versions").get(),
        getPayerSettings(),
      ]);
      const parent = profileSnapshot.data() || {};
      if (parent.userId && parent.userId !== uid) return res.status(403).json({ message: "Tax profile not found." });
      const sorted = versionsSnapshot.docs.sort((a, b) =>
        String(b.data().createdAt || "").localeCompare(String(a.data().createdAt || "")),
      );
      const currentId = String(parent.currentVersionId || "");
      const currentDoc = sorted.find((doc) => doc.id === currentId) || sorted[0] || null;
      const fallbackVersion = currentDoc ? null : await latestTaxVersionForProfile(uid, Number(profile.id));
      const currentData = currentDoc
        ? await decryptTaxVersion(currentDoc.data())
        : fallbackVersion
          ? await decryptTaxVersion(fallbackVersion.data)
          : null;
      const versions = await Promise.all(sorted.map(async (doc) => {
        const version = doc.data();
        const data = await decryptTaxVersion(version);
        return {
          id: doc.id,
          createdAt: version.createdAt || null,
          legalName: data.legalName,
          businessName: data.businessName,
          taxIdType: data.taxIdType,
          taxIdLast4: data.taxId.slice(-4),
        };
      }));
      const paidGrossCents = await paidGrossCentsForProfile(uid, Number(profile.id), year);
      res.json({
        taxYear: year,
        encryptionReady: isEncryptionKeySet(),
        payerConfigured: isPayerReady(payer),
        acknowledgedAt: parent.acknowledgedAt || null,
        dismissedAt: parent.dismissedAt || null,
        currentVersionId: currentDoc?.id || null,
        current: currentData ? {
          legalName: currentData.legalName,
          businessName: currentData.businessName,
          taxIdType: currentData.taxIdType,
          taxIdLast4: currentData.taxId.slice(-4),
          address1: currentData.address1,
          address2: currentData.address2,
          city: currentData.city,
          state: stateCode(currentData.state),
          postalCode: currentData.postalCode,
          country: countryCode(currentData.country),
        } : null,
        versions,
        paidGrossCents,
      });
    } catch (error: any) {
      res.status(503).json({ message: error?.message || "Could not load your tax profile securely." });
    }
  });

  app.post("/api/tax/my-profile/:taxYear/acknowledgment", firebaseAuth, async (req: any, res: any) => {
    try {
      const uid = String(req.firebaseUser?.uid || "");
      const profile = await getTaxpayerProfile(uid);
      if (!profile) return res.status(403).json({ message: "A contestant profile is required." });
      const year = parseTaxYear(req.params.taxYear);
      if (!year) return res.status(400).json({ message: "Choose a valid tax year." });
      const action = req.body?.action === "acknowledge" ? "acknowledge" : req.body?.action === "dismiss" ? "dismiss" : null;
      if (!action) return res.status(400).json({ message: "Choose acknowledge or dismiss." });
      const ref = getFirestore().collection(TAX_PROFILES).doc(taxProfileDocId(Number(profile.id), year));
      const update = action === "acknowledge"
        ? { acknowledgedAt: now(), dismissedAt: null }
        : { dismissedAt: now() };
      await ref.set({ userId: uid, profileId: Number(profile.id), taxYear: year, ...update, updatedAt: now() }, { merge: true });
      res.json({ success: true, action, acknowledgedAt: action === "acknowledge" ? update.acknowledgedAt : null });
    } catch {
      res.status(500).json({ message: "Could not save the acknowledgement." });
    }
  });

  app.post("/api/tax/my-profile/:taxYear", firebaseAuth, async (req: any, res: any) => {
    try {
      const uid = String(req.firebaseUser?.uid || "");
      const profile = await getTaxpayerProfile(uid);
      if (!profile) return res.status(403).json({ message: "A contestant profile is required." });
      const year = parseTaxYear(req.params.taxYear);
      if (!year) return res.status(400).json({ message: "Choose a valid tax year." });
      if (!isEncryptionKeySet()) return res.status(503).json({ message: "Secure tax storage is not configured." });

      const firestore = getFirestore();
      const ref = firestore.collection(TAX_PROFILES).doc(taxProfileDocId(Number(profile.id), year));
      const parentSnapshot = await ref.get();
      const parent = parentSnapshot.data() || {};
      if (parent.userId && parent.userId !== uid) return res.status(403).json({ message: "Tax profile not found." });
      if (!parent.acknowledgedAt) return res.status(400).json({ message: "Acknowledge the tax-information deadline before saving." });

      const currentSnapshot = parent.currentVersionId
        ? await ref.collection("versions").doc(String(parent.currentVersionId)).get()
        : null;
      let retainedTaxId = "";
      if (!digits(req.body?.taxId) && currentSnapshot?.exists) {
        try {
          const previous = await decryptTaxVersion(currentSnapshot.data());
          retainedTaxId = previous.taxId;
        } catch {
          return res.status(503).json({ message: "The saved tax ID cannot be opened with the current encryption key. Contact an administrator before changing it." });
        }
      } else if (!digits(req.body?.taxId)) {
        const previousVersion = await latestTaxVersionForProfile(uid, Number(profile.id));
        if (previousVersion) {
          try {
            const previous = await decryptTaxVersion(previousVersion.data);
            retainedTaxId = previous.taxId;
          } catch {
            return res.status(503).json({ message: "The saved tax ID cannot be opened with the current encryption key. Contact an administrator before changing it." });
          }
        }
      }
      const data = validTaxData(req.body, retainedTaxId);
      if (!data) {
        return res.status(400).json({ message: "Enter a legal name, complete mailing address with two-letter state/country codes, and a valid 9-digit tax ID." });
      }
      const versionRef = ref.collection("versions").doc();
      const createdAt = now();
      const version = {
        encryptedPayload: encrypt(JSON.stringify(data)),
        complete: true,
        createdAt,
        acknowledgedAt: parent.acknowledgedAt,
        taxIdLast4: data.taxId.slice(-4),
        taxIdType: data.taxIdType,
      };
      await versionRef.set(version);
      await ref.set({
        userId: uid,
        profileId: Number(profile.id),
        taxYear: year,
        currentVersionId: versionRef.id,
        updatedAt: createdAt,
      }, { merge: true });
      await firestore.collection(AUDIT).add({
        action: "contestant_tax_profile_saved",
        userId: uid,
        profileId: Number(profile.id),
        taxYear: year,
        versionId: versionRef.id,
        createdAt,
      });
      res.json({ success: true, versionId: versionRef.id, createdAt, taxIdLast4: data.taxId.slice(-4) });
    } catch {
      res.status(500).json({ message: "Could not securely save the tax profile." });
    }
  });

  app.get("/api/tax/my-profile/:taxYear/1099", firebaseAuth, async (req: any, res: any) => {
    try {
      const uid = String(req.firebaseUser?.uid || "");
      const profile = await getTaxpayerProfile(uid);
      if (!profile) return res.status(403).json({ message: "A contestant profile is required." });
      const year = parseTaxYear(req.params.taxYear);
      if (!year) return res.status(400).json({ message: "Choose a valid tax year." });
      if (!isEncryptionKeySet()) return res.status(503).json({ message: "Secure tax storage is not configured." });

      const firestore = getFirestore();
      const ref = firestore.collection(TAX_PROFILES).doc(taxProfileDocId(Number(profile.id), year));
      const parentSnapshot = await ref.get();
      const parent = parentSnapshot.data() || {};
      if (parent.userId !== uid) return res.status(404).json({ message: "Tax profile not found." });
      const versionId = clean(req.query?.versionId || parent.currentVersionId, 160);
      if (!versionId) return res.status(400).json({ message: "Save your tax details before exporting a form." });
      const [versionSnapshot, payer] = await Promise.all([
        ref.collection("versions").doc(versionId).get(),
        getPayerSettings(),
      ]);
      if (!versionSnapshot.exists) return res.status(404).json({ message: "Tax-profile version not found." });
      if (!isPayerReady(payer)) return res.status(409).json({ message: "The Original Concepts payer details are not complete. Contact an administrator." });
      const taxData = await decryptTaxVersion(versionSnapshot.data());
      const recipientState = stateCode(taxData.state);
      const recipientCountry = countryCode(taxData.country);
      if (!recipientState || !recipientCountry) {
        return res.status(409).json({ message: "Update your mailing address using two-letter state/region and country codes before exporting." });
      }
      const payerEin = decrypt(String(payer.payerTinEncrypted));
      const amountCents = await paidGrossCentsForProfile(uid, Number(profile.id), year);
      const templatePaths = [
        join(process.cwd(), "attached_assets", IRS_FORM_FILE),
        join(process.cwd(), "dist", "attached_assets", IRS_FORM_FILE),
      ];
      let templateBytes: Buffer | null = null;
      for (const templatePath of templatePaths) {
        try {
          templateBytes = await readFile(templatePath);
          break;
        } catch {
          // Try the build-output copy of the same IRS template.
        }
      }
      if (!templateBytes) return res.status(500).json({ message: "The recipient 1099-NEC template is unavailable." });

      const pdf = await PDFDocument.load(templateBytes);
      const form = pdf.getForm();
      const prefix = "topmostSubform[0].CopyB[0].";
      const set = (field: string, value: string) => form.getTextField(`${prefix}${field}`).setText(value);
      set("PgHeader[0].CalendarYear[0].f2_1[0]", String(year));
      set("LeftCol[0].f2_2[0]", clean(payer.payerName, 180));
      set("LeftCol[0].f2_3[0]", clean(payer.address1, 180));
      set("LeftCol[0].f2_4[0]", clean(payer.address2, 100));
      set("LeftCol[0].f2_5[0]", clean(payer.city, 100));
      set("LeftCol[0].f2_6[0]", clean(payer.phone, 40));
      set("LeftCol[0].f2_7[0]", stateCode(payer.state));
      set("LeftCol[0].f2_8[0]", countryCode(payer.country || "US"));
      set("LeftCol[0].f2_9[0]", clean(payer.postalCode, 24));
      set("LeftCol[0].f2_10[0]", formatTin(payerEin, "ein"));
      set("LeftCol[0].f2_11[0]", formatTin(taxData.taxId, taxData.taxIdType));
      const recipientNameField = form.getTextField(`${prefix}LeftCol[0].f2_12[0]`);
      recipientNameField.enableMultiline();
      recipientNameField.setText([taxData.legalName, taxData.businessName].filter(Boolean).join("\n"));
      set("LeftCol[0].f2_13[0]", taxData.address1);
      set("LeftCol[0].f2_14[0]", taxData.address2);
      set("LeftCol[0].f2_15[0]", taxData.city);
      set("LeftCol[0].f2_16[0]", recipientState);
      set("LeftCol[0].f2_17[0]", recipientCountry);
      set("LeftCol[0].f2_18[0]", taxData.postalCode);
      set("RightCol[0].f2_20[0]", (amountCents / 100).toFixed(2));
      form.flatten();

      const recipientCopy = await PDFDocument.create();
      const [page] = await recipientCopy.copyPages(pdf, [RECIPIENT_COPY_PAGE_INDEX]);
      recipientCopy.addPage(page);
      recipientCopy.setTitle(`The Quest ${year} Form 1099-NEC - Recipient Copy`);
      recipientCopy.setSubject("Recipient copy of the annual Form 1099-NEC");
      const bytes = await recipientCopy.save();
      await firestore.collection(AUDIT).add({
        action: "contestant_1099_recipient_copy_exported",
        userId: uid,
        profileId: Number(profile.id),
        taxYear: year,
        versionId,
        amountCents,
        createdAt: now(),
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="TheQuest-1099-NEC-${year}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(Buffer.from(bytes));
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not create the recipient 1099-NEC copy." });
    }
  });

  app.get("/api/admin/tax/payer-settings", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      res.json(safePayer(await getPayerSettings()));
    } catch {
      res.status(500).json({ message: "Could not load payer settings." });
    }
  });

  app.put("/api/admin/tax/payer-settings", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      if (!isEncryptionKeySet()) return res.status(503).json({ message: "Secure tax storage is not configured." });
      const firestore = getFirestore();
      const ref = firestore.collection(TAX_SETTINGS).doc("payer");
      const existingSnapshot = await ref.get();
      const existing = existingSnapshot.data() || {};
      const payerTin = digits(req.body?.payerEin);
      if (payerTin && payerTin.length !== 9) return res.status(400).json({ message: "Enter a valid 9-digit payer EIN." });
      if (!existing.payerTinEncrypted && !payerTin) return res.status(400).json({ message: "Enter the payer EIN before saving." });
      const payerState = stateCode(req.body?.state);
      const payerCountry = countryCode(req.body?.country || "US");
      if (!payerState || !payerCountry) return res.status(400).json({ message: "Enter the payer state/region and country as two-letter codes." });
      const record: any = {
        payerName: clean(req.body?.payerName, 180),
        address1: clean(req.body?.address1, 180),
        address2: clean(req.body?.address2, 100),
        city: clean(req.body?.city, 100),
        state: payerState,
        postalCode: clean(req.body?.postalCode, 24),
        country: payerCountry,
        phone: clean(req.body?.phone, 40),
        updatedAt: now(),
        updatedBy: req.firebaseUser?.uid || null,
      };
      if (payerTin) {
        record.payerTinEncrypted = encrypt(payerTin);
        record.payerTinLast4 = payerTin.slice(-4);
      } else {
        record.payerTinEncrypted = existing.payerTinEncrypted;
        record.payerTinLast4 = existing.payerTinLast4;
      }
      if (!record.payerName || !record.address1 || !record.city || !record.postalCode) {
        return res.status(400).json({ message: "Complete the payer legal name and mailing address." });
      }
      await ref.set(record, { merge: true });
      await firestore.collection(AUDIT).add({
        action: "payer_settings_updated",
        userId: req.firebaseUser?.uid || null,
        createdAt: now(),
      });
      res.json(safePayer({ ...existing, ...record }));
    } catch {
      res.status(500).json({ message: "Could not save payer settings securely." });
    }
  });

  app.get("/api/admin/nonprofit/allocation-sources", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const firestore = getFirestore();
      const [transactionSnapshot, ledgerSnapshot, disbursementSnapshot] = await Promise.all([
        firestore.collection(TRANSACTIONS).where("type", "==", "nonprofit_allocation").get(),
        firestore.collection(LEDGER).get(),
        firestore.collection(DISBURSEMENTS).get(),
      ]);
      const ledgerById = new Map(ledgerSnapshot.docs.map((doc) => [doc.id, doc.data()]));
      const usedByTransaction = new Map<string, number>();
      disbursementSnapshot.docs.forEach((doc) => {
        const record = doc.data();
        const id = String(record.allocationTransactionId || "");
        usedByTransaction.set(id, (usedByTransaction.get(id) || 0) + cents(record.amountCents));
      });
      const sources = await Promise.all(transactionSnapshot.docs.map(async (doc) => {
        const transaction = doc.data();
        const source = await resolveLedgerForAllocation(transaction);
        const allocatedCents = cents(transaction.amountCents);
        const usedCents = usedByTransaction.get(doc.id) || 0;
        const ledgerData = source ? ledgerById.get(source.id) || source.data : null;
        return {
          id: doc.id,
          competitionId: transaction.competitionId ?? null,
          batchId: transaction.batchId ?? null,
          payeeId: transaction.payeeId ?? null,
          selection: clean(transaction.nonprofitSelection || transaction.memo || "Nonprofit allocation", 180),
          createdAt: transaction.createdAt || null,
          allocatedCents,
          usedCents,
          remainingCents: Math.max(0, allocatedCents - usedCents),
          sourceLedgerId: source?.id || "",
          sourceLedgerStatus: ledgerData?.status || "missing",
        };
      }));
      res.json(sources.filter((source) => source.remainingCents > 0 && source.sourceLedgerId));
    } catch {
      res.status(500).json({ message: "Could not load source nonprofit allocations." });
    }
  });

  app.get("/api/admin/nonprofit/disbursements", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const snapshot = await getFirestore().collection(DISBURSEMENTS).get();
      const records = snapshot.docs
        .map((doc) => safeDisbursement(doc.id, doc.data()))
        .sort((a, b) => String(b.transferDate).localeCompare(String(a.transferDate)));
      const monthly = new Map<string, { month: string; amountCents: number; records: number; missingEvidence: number }>();
      records.forEach((record) => {
        const month = record.transferDate.slice(0, 7) || "undated";
        const current = monthly.get(month) || { month, amountCents: 0, records: 0, missingEvidence: 0 };
        current.amountCents += record.amountCents;
        current.records += 1;
        if (!record.evidenceComplete) current.missingEvidence += 1;
        monthly.set(month, current);
      });
      res.json({ records, monthlyTotals: [...monthly.values()].sort((a, b) => b.month.localeCompare(a.month)) });
    } catch {
      res.status(500).json({ message: "Could not load nonprofit disbursements." });
    }
  });

  app.post("/api/admin/nonprofit/disbursements", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      if (!isEncryptionKeySet()) return res.status(503).json({ message: "Secure organization-ID storage is not configured." });
      const firestore = getFirestore();
      const allocationTransactionId = clean(req.body?.allocationTransactionId, 160);
      const organizationLegalName = clean(req.body?.organizationLegalName, 180);
      const ein = digits(req.body?.organizationEin);
      const amountCents = moneyToCents(req.body?.amountDollars);
      const transactionReference = clean(req.body?.transactionReference, 180);
      const verificationMethod = clean(req.body?.verificationMethod, 300);
      const transferDate = clean(req.body?.transferDate, 30);
      const allocationDate = clean(req.body?.allocationDate, 30);
      const transferDateValue = parseDate(transferDate);
      const allocationDateValue = parseDate(allocationDate);
      if (!allocationTransactionId || !organizationLegalName || ein.length !== 9 || amountCents <= 0 || !transactionReference) {
        return res.status(400).json({ message: "Enter the organization, valid EIN, positive transfer amount, source allocation, and transaction reference." });
      }
      if (!req.body?.organizationVerified || !verificationMethod) {
        return res.status(400).json({ message: "Confirm nonprofit verification and record how it was verified." });
      }
      if (!transferDateValue || !allocationDateValue) return res.status(400).json({ message: "Enter valid allocation and transfer dates." });
      const sourceRef = firestore.collection(TRANSACTIONS).doc(allocationTransactionId);
      const sourceSnapshot = await sourceRef.get();
      if (!sourceSnapshot.exists || sourceSnapshot.data()?.type !== "nonprofit_allocation") {
        return res.status(404).json({ message: "Choose an existing nonprofit allocation transaction." });
      }
      const sourceTransaction = sourceSnapshot.data() || {};
      const sourceLedger = await resolveLedgerForAllocation(sourceTransaction);
      if (!sourceLedger) {
        return res.status(400).json({ message: "This allocation is not linked to exactly one payroll ledger entry. Link the source ledger entry before recording its transfer." });
      }
      const receiptUrl = safeUrl(req.body?.receiptUrl);
      const transactionEvidenceUrl = safeUrl(req.body?.transactionEvidenceUrl);
      const agreementUrl = safeUrl(req.body?.agreementUrl);
      const notes = clean(req.body?.notes, 1000);
      const recordRef = firestore.collection(DISBURSEMENTS).doc();
      const createdAt = now();
      const record = {
        organizationLegalName,
        organizationEinEncrypted: encrypt(ein),
        organizationEinLast4: ein.slice(-4),
        organizationVerified: true,
        verificationMethod,
        allocationTransactionId,
        sourceLedgerId: sourceLedger.id,
        sourceAllocationCents: cents(sourceTransaction.amountCents),
        amountCents,
        allocationDate,
        transferDate,
        transactionReference,
        receiptUrl,
        transactionEvidenceUrl,
        agreementUrl,
        notes,
        createdBy: req.firebaseUser?.uid || null,
        createdAt,
        updatedAt: createdAt,
      };

      await firestore.runTransaction(async (transaction) => {
        const [currentSource, previousRecords] = await Promise.all([
          transaction.get(sourceRef),
          transaction.get(firestore.collection(DISBURSEMENTS).where("allocationTransactionId", "==", allocationTransactionId)),
        ]);
        if (!currentSource.exists) throw new Error("Source allocation no longer exists.");
        const used = previousRecords.docs.reduce((sum, doc) => sum + cents(doc.data().amountCents), 0);
        const allocated = cents(currentSource.data()?.amountCents);
        if (amountCents > allocated - used) throw new Error("The documented transfers cannot exceed the remaining source allocation.");
        transaction.set(recordRef, record);
        transaction.update(sourceRef, {
          sourceLedgerId: sourceLedger.id,
          documentedDisbursementCents: used + amountCents,
          updatedAt: createdAt,
        });
      });
      await firestore.collection(AUDIT).add({
        action: "nonprofit_disbursement_recorded",
        userId: req.firebaseUser?.uid || null,
        recordId: recordRef.id,
        allocationTransactionId,
        sourceLedgerId: sourceLedger.id,
        amountCents,
        createdAt,
      });
      res.status(201).json(safeDisbursement(recordRef.id, record));
    } catch (error: any) {
      const message = String(error?.message || "");
      const clientError = message.includes("cannot exceed") || message.includes("no longer exists") || message.includes("Evidence links");
      res.status(clientError ? 400 : 500).json({ message: clientError ? message : "Could not record the nonprofit disbursement." });
    }
  });

  app.patch("/api/admin/nonprofit/disbursements/:id", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const ref = getFirestore().collection(DISBURSEMENTS).doc(clean(req.params.id, 160));
      const snapshot = await ref.get();
      if (!snapshot.exists) return res.status(404).json({ message: "Disbursement record not found." });
      const current = snapshot.data() || {};
      const update = {
        receiptUrl: req.body?.receiptUrl === undefined ? current.receiptUrl || null : safeUrl(req.body.receiptUrl),
        transactionEvidenceUrl: req.body?.transactionEvidenceUrl === undefined ? current.transactionEvidenceUrl || null : safeUrl(req.body.transactionEvidenceUrl),
        agreementUrl: req.body?.agreementUrl === undefined ? current.agreementUrl || null : safeUrl(req.body.agreementUrl),
        notes: req.body?.notes === undefined ? current.notes || "" : clean(req.body.notes, 1000),
        updatedAt: now(),
        updatedBy: req.firebaseUser?.uid || null,
      };
      await ref.update(update);
      await getFirestore().collection(AUDIT).add({
        action: "nonprofit_disbursement_evidence_updated",
        userId: req.firebaseUser?.uid || null,
        recordId: ref.id,
        createdAt: now(),
      });
      res.json(safeDisbursement(ref.id, { ...current, ...update }));
    } catch {
      res.status(400).json({ message: "Could not update disbursement evidence." });
    }
  });
}