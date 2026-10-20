import { getFirestore } from "./firebase-admin";
import {
  hashReferralValue, OCReferralError, sameOCReferralEvent,
  type OCReferralStore, type OCReferralRecord, type OCReferralClaim,
} from "./oc-referral-service";

const referrals = () => getFirestore().collection("ocEventReferrals");
const claims = () => getFirestore().collection("ocEventBenefitClaims");

export const ocReferralStore: OCReferralStore = {
  async create(key, value) { await referrals().doc(key).create(value); },
  async get(key) {
    const doc = await referrals().doc(key).get();
    return doc.exists ? doc.data() as OCReferralRecord : null;
  },
  async getClaim(uid) {
    const doc = await claims().doc(hashReferralValue(uid)).get();
    return doc.exists ? doc.data() as OCReferralClaim : null;
  },
  async activate(key, value, ocAccountId, at) {
    const referralRef = referrals().doc(key);
    const claimRef = claims().doc(hashReferralValue(value.uid));
    await getFirestore().runTransaction(async (tx) => {
      const [referralDoc, claimDoc] = await Promise.all([tx.get(referralRef), tx.get(claimRef)]);
      const current = referralDoc.data() as OCReferralRecord | undefined;
      const claim = claimDoc.data() as OCReferralClaim | undefined;
      if (!current || current.revokedAt || claim?.revokedAt) {
        throw new OCReferralError(409, "benefit_revoked", "This promotional benefit has ended.");
      }
      if ((current.ocAccountId && current.ocAccountId !== ocAccountId)
        || (claim && (!sameOCReferralEvent(claim, value) || claim.ocAccountId !== ocAccountId))) {
        throw new OCReferralError(409, "offer_already_assigned", "This offer is already assigned to another event or OC account.");
      }
      tx.update(referralRef, { ocAccountId, claimedAt: current.claimedAt || at });
      if (!claim) tx.create(claimRef, {
        competitionId: value.competitionId, role: value.role,
        contestantId: value.contestantId, profileId: value.profileId, ocAccountId,
        claimedAt: at, revokedAt: null, revocationReason: null,
      });
    });
  },
  async revoke(key, value, reason, at) {
    const referralRef = referrals().doc(key);
    const claimRef = claims().doc(hashReferralValue(value.uid));
    await getFirestore().runTransaction(async (tx) => {
      const [referralDoc, claimDoc] = await Promise.all([tx.get(referralRef), tx.get(claimRef)]);
      const current = referralDoc.data() as OCReferralRecord | undefined;
      const claim = claimDoc.data() as OCReferralClaim | undefined;
      if (current && !current.revokedAt) tx.update(referralRef, { revokedAt: at, revocationReason: reason });
      if (reason !== "handoff_expired" && claim
        && sameOCReferralEvent(claim, value) && !claim.revokedAt) {
        tx.update(claimRef, { revokedAt: at, revocationReason: reason });
      }
    });
  },
};
