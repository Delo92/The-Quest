import admin from "firebase-admin";
import crypto from "crypto";
import { getFirestore } from "./firebase-admin";

const COLLECTIONS = {
  USERS: "users",
  VIEWER_PROFILES: "viewerProfiles",
  CATEGORIES: "categories",
  COMPETITIONS: "competitions",
  TALENT_PROFILES: "talentProfiles",
  CONTESTANTS: "contestants",
  VOTES: "votes",
  VOTE_COUNTS: "voteCounts",
  VOTE_PURCHASES: "votePurchases",
  VOTE_PACKAGES: "votePackages",
  LIVERY: "livery",
  SETTINGS: "settings",
  COUNTERS: "counters",
  JOIN_SETTINGS: "joinSettings",
  JOIN_SUBMISSIONS: "joinSubmissions",
  HOST_SETTINGS: "hostSettings",
  HOST_SUBMISSIONS: "hostSubmissions",
  INVITATIONS: "invitations",
  REFERRAL_CODES: "referralCodes",
  REFERRAL_STATS: "referralStats",
} as const;

function db() {
  return getFirestore();
}

function now() {
  return admin.firestore.Timestamp.now();
}

async function nextId(collection: string): Promise<number> {
  const ref = db().collection(COLLECTIONS.COUNTERS).doc("ids");
  const result = await db().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data() || {};
    const current = data[collection] || 0;
    const next = current + 1;
    tx.set(ref, { ...data, [collection]: next });
    return next;
  });
  return result;
}

export interface FirestoreCategory {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  videoUrl: string | null;
  order: number;
  isActive: boolean;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface FirestoreCompetition {
  id: number;
  title: string;
  description: string | null;
  category: string;
  coverImage: string | null;
  coverVideo: string | null;
  status: string;
  voteCost: number;
  maxVotesPerDay: number;
  maxImagesPerContestant: number | null;
  maxVideosPerContestant: number | null;
  startDate: string | null;
  endDate: string | null;
  startDateTbd: boolean;
  endDateTbd: boolean;
  votingStartDate: string | null;
  votingEndDate: string | null;
  expectedContestants: number | null;
  onlineVoteWeight: number;
  inPersonOnly: boolean;
  createdAt: string | null;
  createdBy: string | null;
}

export interface FirestoreTalentProfile {
  id: number;
  userId: string;
  displayName: string;
  stageName: string | null;
  email?: string | null;
  showEmail?: boolean;
  bio: string | null;
  category: string | null;
  location: string | null;
  imageUrls: string[];
  imageBackupUrls?: string[];
  videoUrls: string[];
  socialLinks: string | null;
  profileColor?: string | null;
  profileBgImage?: string | null;
  role: string;
  hiddenVideoUris?: string[];
}

export interface FirestoreContestant {
  id: number;
  competitionId: number;
  talentProfileId: number;
  applicationStatus: string;
  appliedAt: string | null;
}

export interface FirestoreVote {
  id: number;
  contestantId: number;
  competitionId: number;
  voterIp: string | null;
  userId: string | null;
  purchaseId: number | null;
  source: "online" | "in_person";
  refCode?: string | null;
  votedAt: string;
}

export interface FirestoreReferralCode {
  code: string;
  ownerId: string;
  ownerType: "talent" | "host" | "admin" | "custom";
  ownerName: string;
  ownerEmail?: string | null;
  talentProfileId?: number | null;
  competitionId?: number | null;
  competitionIds?: number[];
  contestantId?: number | null;
  createdAt: string;
  aliasFor?: string | null;
  previousCodes?: string[];
}

export interface FirestoreReferralStats {
  code: string;
  ownerId: string;
  ownerType: "talent" | "host" | "admin";
  ownerName: string;
  totalVotesDriven: number;
  uniqueVoters: number;
  voterIps: string[];
  updatedAt: admin.firestore.Timestamp;
}

export interface FirestoreVoteCount {
  contestantId: number;
  competitionId: number;
  onlineCount?: number;
  inPersonCount?: number;
  count: number;
  updatedAt: admin.firestore.Timestamp;
}

export interface FirestoreViewerProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastPurchaseAt: string | null;
  totalVotesPurchased: number;
  totalSpent: number;
}

export interface FirestoreVotePurchase {
  id: number;
  userId: string | null;
  viewerId: string | null;
  guestEmail: string | null;
  guestName: string | null;
  competitionId: number;
  contestantId: number;
  voteCount: number;
  amount: number;
  transactionId: string | null;
  purchasedAt: string | null;
}

export interface FirestoreVotePackage {
  id: string;
  name: string;
  description: string;
  voteCount: number;
  bonusVotes: number;
  price: number;
  isActive: boolean;
  order: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface FirestoreLiveryItem {
  imageKey: string;
  label: string;
  imageUrl: string | null;
  defaultUrl: string;
  mediaType?: "image" | "video";
  textContent?: string | null;
  defaultText?: string | null;
  itemType?: "media" | "text";
}

export interface FirestoreSettings {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  defaultVoteCost: number;
  defaultMaxVotesPerDay: number;
  updatedAt: admin.firestore.Timestamp;
}

export interface FirestoreJoinSettings {
  mode: "request" | "purchase";
  price: number;
  pageTitle: string;
  pageDescription: string;
  requiredFields: string[];
  isActive: boolean;
  charityName: string;
  charityPercentage: number;
  nominationFee: number;
  nominationEnabled: boolean;
  nonprofitRequired: boolean;
  freeNominationPromoCode: string;
  updatedAt: admin.firestore.Timestamp;
}

export interface FirestoreJoinSubmission {
  id: string;
  competitionId: number | null;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  bio: string | null;
  category: string | null;
  socialLinks: string | null;
  mediaUrls: string[];
  status: "pending" | "approved" | "rejected";
  transactionId: string | null;
  amountPaid: number;
  createdAt: string;
  type: "application" | "nomination";
  nominatorName: string | null;
  nominatorEmail: string | null;
  nominatorPhone: string | null;
  nominationStatus: "pending" | "joined" | "unsure" | "not_interested" | null;
  chosenNonprofit: string | null;
}

export interface FirestoreHostSettings {
  mode: "request" | "purchase";
  price: number;
  pageTitle: string;
  pageDescription: string;
  requiredFields: string[];
  isActive: boolean;
  updatedAt: admin.firestore.Timestamp;
}

export interface FirestoreHostSubmission {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  organization: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  eventName: string;
  eventDescription: string | null;
  eventCategory: string | null;
  eventDate: string | null;
  socialLinks: string | null;
  mediaUrls: string[];
  status: "pending" | "approved" | "rejected";
  transactionId: string | null;
  amountPaid: number;
  createdAt: string;
}

export const firestoreCategories = {
  async getAll(): Promise<FirestoreCategory[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.CATEGORIES)
      .get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreCategory));
    return categories.sort((a, b) => a.order - b.order);
  },

  async getActive(): Promise<FirestoreCategory[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.CATEGORIES)
      .where("isActive", "==", true)
      .get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreCategory));
    return categories.sort((a, b) => a.order - b.order);
  },

  async get(id: string): Promise<FirestoreCategory | null> {
    const doc = await db().collection(COLLECTIONS.CATEGORIES).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as FirestoreCategory;
  },

  async create(data: Omit<FirestoreCategory, "id" | "createdAt" | "updatedAt">): Promise<FirestoreCategory> {
    const timestamp = now();
    const docRef = db().collection(COLLECTIONS.CATEGORIES).doc();
    const category: FirestoreCategory = {
      ...data,
      id: docRef.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await docRef.set(category);
    return category;
  },

  async update(id: string, data: Partial<Omit<FirestoreCategory, "id" | "createdAt">>): Promise<FirestoreCategory | null> {
    const ref = db().collection(COLLECTIONS.CATEGORIES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ ...data, updatedAt: now() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as FirestoreCategory;
  },

  async delete(id: string): Promise<void> {
    await db().collection(COLLECTIONS.CATEGORIES).doc(id).delete();
  },
};

function normalizeCompetition(data: any): FirestoreCompetition {
  return {
    ...data,
    startDateTbd: data.startDateTbd ?? false,
    endDateTbd: data.endDateTbd ?? false,
    maxImagesPerContestant: data.maxImagesPerContestant ?? null,
    maxVideosPerContestant: data.maxVideosPerContestant ?? null,
    onlineVoteWeight: data.onlineVoteWeight ?? 100,
    inPersonOnly: data.inPersonOnly ?? false,
  } as FirestoreCompetition;
}

export const firestoreCompetitions = {
  async getAll(): Promise<FirestoreCompetition[]> {
    const snapshot = await db().collection(COLLECTIONS.COMPETITIONS).get();
    const comps = snapshot.docs.map(doc => normalizeCompetition(doc.data()));
    return comps.sort((a, b) => b.id - a.id);
  },

  async getByStatus(status: string): Promise<FirestoreCompetition[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.COMPETITIONS)
      .where("status", "==", status)
      .get();
    const comps = snapshot.docs.map(doc => normalizeCompetition(doc.data()));
    return comps.sort((a, b) => b.id - a.id);
  },

  async getByCategory(category: string): Promise<FirestoreCompetition[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.COMPETITIONS)
      .where("category", "==", category)
      .get();
    const comps = snapshot.docs.map(doc => normalizeCompetition(doc.data()));
    return comps.sort((a, b) => b.id - a.id);
  },

  async getByCategoryAndStatus(category: string, status: string): Promise<FirestoreCompetition[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.COMPETITIONS)
      .where("category", "==", category)
      .where("status", "==", status)
      .get();
    const comps = snapshot.docs.map(doc => normalizeCompetition(doc.data()));
    return comps.sort((a, b) => b.id - a.id);
  },

  async getByCreator(createdBy: string): Promise<FirestoreCompetition[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.COMPETITIONS)
      .where("createdBy", "==", createdBy)
      .get();
    return snapshot.docs.map(doc => normalizeCompetition(doc.data()));
  },

  async get(id: number): Promise<FirestoreCompetition | null> {
    const doc = await db().collection(COLLECTIONS.COMPETITIONS).doc(String(id)).get();
    if (!doc.exists) return null;
    return normalizeCompetition(doc.data());
  },

  async create(data: Omit<FirestoreCompetition, "id">): Promise<FirestoreCompetition> {
    const id = await nextId("competitions");
    const competition: FirestoreCompetition = { ...data, id };
    await db().collection(COLLECTIONS.COMPETITIONS).doc(String(id)).set(competition);
    return competition;
  },

  async update(id: number, data: Partial<Omit<FirestoreCompetition, "id">>): Promise<FirestoreCompetition | null> {
    const ref = db().collection(COLLECTIONS.COMPETITIONS).doc(String(id));
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update(data);
    const updated = await ref.get();
    return normalizeCompetition(updated.data());
  },

  async delete(id: number): Promise<void> {
    await db().collection(COLLECTIONS.COMPETITIONS).doc(String(id)).delete();
    const votesSnapshot = await db().collection(COLLECTIONS.VOTES).where("competitionId", "==", id).get();
    const batch1 = db().batch();
    votesSnapshot.docs.forEach(doc => batch1.delete(doc.ref));
    if (votesSnapshot.docs.length > 0) await batch1.commit();

    const contestantsSnapshot = await db().collection(COLLECTIONS.CONTESTANTS).where("competitionId", "==", id).get();
    const batch2 = db().batch();
    contestantsSnapshot.docs.forEach(doc => batch2.delete(doc.ref));
    if (contestantsSnapshot.docs.length > 0) await batch2.commit();

    const voteCountsSnapshot = await db().collection(COLLECTIONS.VOTE_COUNTS).where("competitionId", "==", id).get();
    const batch3 = db().batch();
    voteCountsSnapshot.docs.forEach(doc => batch3.delete(doc.ref));
    if (voteCountsSnapshot.docs.length > 0) await batch3.commit();
  },
};

export const firestoreTalentProfiles = {
  async getAll(): Promise<FirestoreTalentProfile[]> {
    const snapshot = await db().collection(COLLECTIONS.TALENT_PROFILES).get();
    return snapshot.docs.map(doc => doc.data() as FirestoreTalentProfile);
  },

  async get(id: number): Promise<FirestoreTalentProfile | null> {
    const doc = await db().collection(COLLECTIONS.TALENT_PROFILES).doc(String(id)).get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreTalentProfile;
  },

  async getByUserId(userId: string): Promise<FirestoreTalentProfile | null> {
    const snapshot = await db()
      .collection(COLLECTIONS.TALENT_PROFILES)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as FirestoreTalentProfile;
  },

  async create(data: Omit<FirestoreTalentProfile, "id">): Promise<FirestoreTalentProfile> {
    const id = await nextId("talentProfiles");
    const profile: FirestoreTalentProfile = { ...data, id };
    await db().collection(COLLECTIONS.TALENT_PROFILES).doc(String(id)).set(profile);
    return profile;
  },

  async updateByUserId(userId: string, data: Partial<Omit<FirestoreTalentProfile, "id" | "userId">>): Promise<FirestoreTalentProfile | null> {
    const snapshot = await db()
      .collection(COLLECTIONS.TALENT_PROFILES)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const docRef = snapshot.docs[0].ref;
    await docRef.update(data);
    const updated = await docRef.get();
    return updated.data() as FirestoreTalentProfile;
  },

  async getByRole(role: string): Promise<FirestoreTalentProfile[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.TALENT_PROFILES)
      .where("role", "==", role)
      .get();
    return snapshot.docs.map(doc => doc.data() as FirestoreTalentProfile);
  },

  async deleteByUserId(userId: string): Promise<boolean> {
    const snapshot = await db()
      .collection(COLLECTIONS.TALENT_PROFILES)
      .where("userId", "==", userId)
      .get();
    if (snapshot.empty) return false;
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
    return true;
  },
};

export const firestoreContestants = {
  async getByCompetition(competitionId: number): Promise<FirestoreContestant[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.CONTESTANTS)
      .where("competitionId", "==", competitionId)
      .get();
    return snapshot.docs.map(doc => doc.data() as FirestoreContestant);
  },

  async getByTalent(talentProfileId: number): Promise<FirestoreContestant[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.CONTESTANTS)
      .where("talentProfileId", "==", talentProfileId)
      .get();
    return snapshot.docs.map(doc => doc.data() as FirestoreContestant);
  },

  async getAll(): Promise<FirestoreContestant[]> {
    const snapshot = await db().collection(COLLECTIONS.CONTESTANTS).get();
    return snapshot.docs.map(doc => doc.data() as FirestoreContestant);
  },

  async get(competitionId: number, talentProfileId: number): Promise<FirestoreContestant | null> {
    const snapshot = await db()
      .collection(COLLECTIONS.CONTESTANTS)
      .where("competitionId", "==", competitionId)
      .where("talentProfileId", "==", talentProfileId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as FirestoreContestant;
  },

  async getById(id: number): Promise<FirestoreContestant | null> {
    const doc = await db().collection(COLLECTIONS.CONTESTANTS).doc(String(id)).get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreContestant;
  },

  async create(data: Omit<FirestoreContestant, "id">): Promise<FirestoreContestant> {
    const id = await nextId("contestants");
    const contestant: FirestoreContestant = { ...data, id };
    await db().collection(COLLECTIONS.CONTESTANTS).doc(String(id)).set(contestant);
    return contestant;
  },

  async updateStatus(id: number, status: string): Promise<FirestoreContestant | null> {
    const ref = db().collection(COLLECTIONS.CONTESTANTS).doc(String(id));
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ applicationStatus: status });
    const updated = await ref.get();
    return updated.data() as FirestoreContestant;
  },

  async delete(id: number): Promise<boolean> {
    const ref = db().collection(COLLECTIONS.CONTESTANTS).doc(String(id));
    const doc = await ref.get();
    if (!doc.exists) return false;
    const contestant = doc.data() as FirestoreContestant;
    const votesSnapshot = await db()
      .collection(COLLECTIONS.VOTES)
      .where("contestantId", "==", id)
      .get();
    if (!votesSnapshot.empty) {
      const batch = db().batch();
      votesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));
      await batch.commit();
    }
    const voteCountsSnapshot = await db()
      .collection(COLLECTIONS.VOTE_COUNTS)
      .where("contestantId", "==", id)
      .get();
    if (!voteCountsSnapshot.empty) {
      const batch2 = db().batch();
      voteCountsSnapshot.docs.forEach(vcDoc => batch2.delete(vcDoc.ref));
      await batch2.commit();
    }
    await ref.delete();
    return true;
  },
};

export const firestoreVotes = {
  async cast(data: Omit<FirestoreVote, "id" | "votedAt">): Promise<FirestoreVote> {
    const id = await nextId("votes");
    const vote: FirestoreVote = {
      ...data,
      source: data.source || "online",
      refCode: data.refCode || null,
      id,
      votedAt: new Date().toISOString(),
    };
    await db().collection(COLLECTIONS.VOTES).doc(String(id)).set(vote);

    const countDocId = `${data.competitionId}_${data.contestantId}`;
    const countRef = db().collection(COLLECTIONS.VOTE_COUNTS).doc(countDocId);
    const countDoc = await countRef.get();
    const sourceInc = vote.source === "in_person"
      ? { inPersonCount: admin.firestore.FieldValue.increment(1) }
      : { onlineCount: admin.firestore.FieldValue.increment(1) };
    if (countDoc.exists) {
      await countRef.update({
        count: admin.firestore.FieldValue.increment(1),
        ...sourceInc,
        updatedAt: now(),
      });
    } else {
      await countRef.set({
        contestantId: data.contestantId,
        competitionId: data.competitionId,
        count: 1,
        onlineCount: vote.source === "online" ? 1 : 0,
        inPersonCount: vote.source === "in_person" ? 1 : 0,
        updatedAt: now(),
      });
    }

    return vote;
  },

  async getVoteCount(contestantId: number): Promise<number> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTE_COUNTS)
      .where("contestantId", "==", contestantId)
      .get();
    let total = 0;
    snapshot.docs.forEach(doc => {
      total += (doc.data() as FirestoreVoteCount).count;
    });
    return total;
  },

  async getTotalByCompetition(competitionId: number): Promise<number> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTE_COUNTS)
      .where("competitionId", "==", competitionId)
      .get();
    let total = 0;
    snapshot.docs.forEach(doc => {
      total += (doc.data() as FirestoreVoteCount).count;
    });
    return total;
  },

  async getVotesTodayByIp(competitionId: number, voterIp: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    const snapshot = await db()
      .collection(COLLECTIONS.VOTES)
      .where("competitionId", "==", competitionId)
      .where("voterIp", "==", voterIp)
      .where("votedAt", ">=", todayStr)
      .get();
    return snapshot.docs.length;
  },

  async getFreeVotesTodayByIpForCategory(competitionIds: number[], voterIp: string): Promise<number> {
    if (competitionIds.length === 0) return 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    let total = 0;
    const batches = [];
    for (let i = 0; i < competitionIds.length; i += 10) {
      batches.push(competitionIds.slice(i, i + 10));
    }
    for (const batch of batches) {
      const snapshot = await db()
        .collection(COLLECTIONS.VOTES)
        .where("competitionId", "in", batch)
        .where("voterIp", "==", voterIp)
        .where("votedAt", ">=", todayStr)
        .get();
      total += snapshot.docs.filter(d => !d.data().purchaseId).length;
    }
    return total;
  },

  async syncVoteCount(contestantId: number, competitionId: number, totalCount: number): Promise<void> {
    const docId = `${competitionId}_${contestantId}`;
    await db().collection(COLLECTIONS.VOTE_COUNTS).doc(docId).set({
      contestantId,
      competitionId,
      count: totalCount,
      updatedAt: now(),
    });
  },

  async getVoteCountForContestantInCompetition(contestantId: number, competitionId: number): Promise<number> {
    const docId = `${competitionId}_${contestantId}`;
    const doc = await db().collection(COLLECTIONS.VOTE_COUNTS).doc(docId).get();
    if (!doc.exists) return 0;
    return (doc.data() as FirestoreVoteCount).count;
  },

  async getTotalPlatformVotes(): Promise<number> {
    const snapshot = await db().collection(COLLECTIONS.VOTE_COUNTS).get();
    let total = 0;
    snapshot.docs.forEach(doc => {
      total += (doc.data() as FirestoreVoteCount).count;
    });
    return total;
  },

  async getVoteBreakdownByCompetition(competitionId: number): Promise<{ online: number; inPerson: number; total: number }> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTE_COUNTS)
      .where("competitionId", "==", competitionId)
      .get();
    let online = 0;
    let inPerson = 0;
    let total = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data() as FirestoreVoteCount;
      online += data.onlineCount || 0;
      inPerson += data.inPersonCount || 0;
      total += data.count;
    });
    return { online, inPerson, total };
  },

  async getContestantVoteBreakdown(contestantId: number, competitionId: number): Promise<{ online: number; inPerson: number; total: number }> {
    const docId = `${competitionId}_${contestantId}`;
    const doc = await db().collection(COLLECTIONS.VOTE_COUNTS).doc(docId).get();
    if (!doc.exists) return { online: 0, inPerson: 0, total: 0 };
    const data = doc.data() as FirestoreVoteCount;
    return {
      online: data.onlineCount || 0,
      inPerson: data.inPersonCount || 0,
      total: data.count,
    };
  },

  async getVotesByContestant(contestantId: number, competitionId: number): Promise<FirestoreVote[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTES)
      .where("contestantId", "==", contestantId)
      .where("competitionId", "==", competitionId)
      .get();
    return snapshot.docs.map(doc => doc.data() as FirestoreVote);
  },

  async getVotesByCompetition(competitionId: number): Promise<FirestoreVote[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTES)
      .where("competitionId", "==", competitionId)
      .get();
    return snapshot.docs.map(doc => doc.data() as FirestoreVote);
  },
};

export const firestoreVotePurchases = {
  async create(data: Omit<FirestoreVotePurchase, "id" | "purchasedAt">): Promise<FirestoreVotePurchase> {
    const id = await nextId("votePurchases");
    const purchase: FirestoreVotePurchase = {
      ...data,
      id,
      purchasedAt: new Date().toISOString(),
    };
    await db().collection(COLLECTIONS.VOTE_PURCHASES).doc(String(id)).set(purchase);
    return purchase;
  },

  async getByUser(userId: string): Promise<FirestoreVotePurchase[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTE_PURCHASES)
      .where("userId", "==", userId)
      .get();
    const purchases = snapshot.docs.map(doc => doc.data() as FirestoreVotePurchase);
    return purchases.sort((a, b) => (b.purchasedAt || "").localeCompare(a.purchasedAt || ""));
  },

  async getByCompetition(competitionId: number): Promise<FirestoreVotePurchase[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTE_PURCHASES)
      .where("competitionId", "==", competitionId)
      .get();
    const purchases = snapshot.docs.map(doc => doc.data() as FirestoreVotePurchase);
    return purchases.sort((a, b) => (b.purchasedAt || "").localeCompare(a.purchasedAt || ""));
  },

  async getByViewer(viewerId: string): Promise<FirestoreVotePurchase[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTE_PURCHASES)
      .where("viewerId", "==", viewerId)
      .get();
    const purchases = snapshot.docs.map(doc => doc.data() as FirestoreVotePurchase);
    return purchases.sort((a, b) => (b.purchasedAt || "").localeCompare(a.purchasedAt || ""));
  },
};

export const firestoreViewerProfiles = {
  async getByEmail(email: string): Promise<FirestoreViewerProfile | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const snapshot = await db()
      .collection(COLLECTIONS.VIEWER_PROFILES)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as FirestoreViewerProfile;
  },

  async get(id: string): Promise<FirestoreViewerProfile | null> {
    const doc = await db().collection(COLLECTIONS.VIEWER_PROFILES).doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreViewerProfile;
  },

  async create(data: { email: string; displayName: string }): Promise<FirestoreViewerProfile> {
    const docRef = db().collection(COLLECTIONS.VIEWER_PROFILES).doc();
    const profile: FirestoreViewerProfile = {
      id: docRef.id,
      email: data.email.toLowerCase().trim(),
      displayName: data.displayName.trim(),
      createdAt: new Date().toISOString(),
      lastPurchaseAt: null,
      totalVotesPurchased: 0,
      totalSpent: 0,
    };
    await docRef.set(profile);
    return profile;
  },

  async getOrCreate(email: string, displayName: string): Promise<FirestoreViewerProfile> {
    const existing = await this.getByEmail(email);
    if (existing) {
      if (existing.displayName !== displayName.trim()) {
        await db().collection(COLLECTIONS.VIEWER_PROFILES).doc(existing.id).update({
          displayName: displayName.trim(),
        });
        existing.displayName = displayName.trim();
      }
      return existing;
    }
    return this.create({ email, displayName });
  },

  async recordPurchase(id: string, voteCount: number, amount: number): Promise<void> {
    const ref = db().collection(COLLECTIONS.VIEWER_PROFILES).doc(id);
    await ref.update({
      lastPurchaseAt: new Date().toISOString(),
      totalVotesPurchased: admin.firestore.FieldValue.increment(voteCount),
      totalSpent: admin.firestore.FieldValue.increment(amount),
    });
  },

  async lookup(email: string, name: string): Promise<FirestoreViewerProfile | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const snapshot = await db()
      .collection(COLLECTIONS.VIEWER_PROFILES)
      .where("email", "==", normalizedEmail)
      .limit(5)
      .get();
    if (snapshot.empty) return null;

    const inputWords = name.toLowerCase().trim().split(/\s+/).filter(Boolean);

    for (const doc of snapshot.docs) {
      const profile = doc.data() as FirestoreViewerProfile;
      const storedWords = profile.displayName.toLowerCase().trim().split(/\s+/).filter(Boolean);

      if (storedWords.join(" ") === inputWords.join(" ")) return profile;

      const inputFirst = inputWords[0];
      const inputLast = inputWords[inputWords.length - 1];
      const storedFirst = storedWords[0];
      const storedLast = storedWords[storedWords.length - 1];
      if (inputFirst === storedFirst && inputLast === storedLast) return profile;
    }

    return null;
  },
};

export const firestoreVotePackages = {
  async getAll(): Promise<FirestoreVotePackage[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTE_PACKAGES)
      .get();
    const packages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreVotePackage));
    return packages.sort((a, b) => a.order - b.order);
  },

  async getActive(): Promise<FirestoreVotePackage[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.VOTE_PACKAGES)
      .where("isActive", "==", true)
      .get();
    const packages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreVotePackage));
    return packages.sort((a, b) => a.order - b.order);
  },

  async get(id: string): Promise<FirestoreVotePackage | null> {
    const doc = await db().collection(COLLECTIONS.VOTE_PACKAGES).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as FirestoreVotePackage;
  },

  async create(data: Omit<FirestoreVotePackage, "id" | "createdAt" | "updatedAt">): Promise<FirestoreVotePackage> {
    const timestamp = now();
    const docRef = db().collection(COLLECTIONS.VOTE_PACKAGES).doc();
    const pkg: FirestoreVotePackage = {
      ...data,
      id: docRef.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await docRef.set(pkg);
    return pkg;
  },

  async update(id: string, data: Partial<Omit<FirestoreVotePackage, "id" | "createdAt">>): Promise<FirestoreVotePackage | null> {
    const ref = db().collection(COLLECTIONS.VOTE_PACKAGES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ ...data, updatedAt: now() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as FirestoreVotePackage;
  },

  async delete(id: string): Promise<void> {
    await db().collection(COLLECTIONS.VOTE_PACKAGES).doc(id).delete();
  },
};

export const firestoreLivery = {
  async getAll(): Promise<FirestoreLiveryItem[]> {
    const snapshot = await db().collection(COLLECTIONS.LIVERY).get();
    const items = snapshot.docs.map(doc => doc.data() as FirestoreLiveryItem);
    return items.sort((a, b) => a.label.localeCompare(b.label));
  },

  async getByKey(imageKey: string): Promise<FirestoreLiveryItem | null> {
    const doc = await db().collection(COLLECTIONS.LIVERY).doc(imageKey).get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreLiveryItem;
  },

  async upsert(item: FirestoreLiveryItem): Promise<FirestoreLiveryItem> {
    await db().collection(COLLECTIONS.LIVERY).doc(item.imageKey).set(item);
    return item;
  },

  async updateImage(imageKey: string, imageUrl: string | null, mediaType?: "image" | "video"): Promise<FirestoreLiveryItem | null> {
    const ref = db().collection(COLLECTIONS.LIVERY).doc(imageKey);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updateData: any = { imageUrl };
    if (mediaType !== undefined) updateData.mediaType = mediaType;
    if (imageUrl === null) updateData.mediaType = "image";
    await ref.update(updateData);
    const updated = await ref.get();
    return updated.data() as FirestoreLiveryItem;
  },

  async updateText(imageKey: string, textContent: string | null): Promise<FirestoreLiveryItem | null> {
    const ref = db().collection(COLLECTIONS.LIVERY).doc(imageKey);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ textContent });
    const updated = await ref.get();
    return updated.data() as FirestoreLiveryItem;
  },

  async delete(imageKey: string): Promise<void> {
    await db().collection(COLLECTIONS.LIVERY).doc(imageKey).delete();
  },
};

export const firestoreSettings = {
  async get(): Promise<FirestoreSettings | null> {
    const doc = await db().collection(COLLECTIONS.SETTINGS).doc("global").get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreSettings;
  },

  async update(data: Partial<Omit<FirestoreSettings, "updatedAt">>): Promise<FirestoreSettings> {
    const ref = db().collection(COLLECTIONS.SETTINGS).doc("global");
    const doc = await ref.get();

    if (doc.exists) {
      await ref.update({ ...data, updatedAt: now() });
    } else {
      const defaults: FirestoreSettings = {
        siteName: "The Quest",
        siteDescription: "Competition & Voting Platform",
        contactEmail: "admin@thequest.com",
        defaultVoteCost: 0,
        defaultMaxVotesPerDay: 10,
        updatedAt: now(),
        ...data,
      };
      await ref.set(defaults);
      return defaults;
    }

    const updated = await ref.get();
    return updated.data() as FirestoreSettings;
  },
};

const JOIN_SETTINGS_DEFAULTS: Omit<FirestoreJoinSettings, "updatedAt"> = {
  mode: "request",
  price: 0,
  pageTitle: "NOMINATE NOW",
  pageDescription: "Ready to showcase your talent? Submit your application to join an upcoming competition. Fill out the form below with your details and we'll review your entry.",
  requiredFields: ["fullName", "email", "phone", "bio", "category"],
  isActive: true,
  charityName: "",
  charityPercentage: 0,
  nominationFee: 0,
  nominationEnabled: true,
  nonprofitRequired: false,
  freeNominationPromoCode: "",
};

export const firestoreJoinSettings = {
  async get(): Promise<FirestoreJoinSettings> {
    const doc = await db().collection(COLLECTIONS.JOIN_SETTINGS).doc("global").get();
    if (!doc.exists) {
      const settings = { ...JOIN_SETTINGS_DEFAULTS, updatedAt: now() };
      await db().collection(COLLECTIONS.JOIN_SETTINGS).doc("global").set(settings);
      return settings;
    }
    return { ...JOIN_SETTINGS_DEFAULTS, ...doc.data() } as FirestoreJoinSettings;
  },

  async update(data: Partial<Omit<FirestoreJoinSettings, "updatedAt">>): Promise<FirestoreJoinSettings> {
    const ref = db().collection(COLLECTIONS.JOIN_SETTINGS).doc("global");
    const doc = await ref.get();
    if (doc.exists) {
      await ref.update({ ...data, updatedAt: now() });
    } else {
      await ref.set({ ...JOIN_SETTINGS_DEFAULTS, ...data, updatedAt: now() });
    }
    const updated = await ref.get();
    return updated.data() as FirestoreJoinSettings;
  },
};

export const firestoreJoinSubmissions = {
  async create(data: Omit<FirestoreJoinSubmission, "id" | "createdAt" | "status">): Promise<FirestoreJoinSubmission> {
    const docRef = db().collection(COLLECTIONS.JOIN_SUBMISSIONS).doc();
    const submission: FirestoreJoinSubmission = {
      ...data,
      id: docRef.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await docRef.set(submission);
    return submission;
  },

  async getAll(): Promise<FirestoreJoinSubmission[]> {
    const snapshot = await db().collection(COLLECTIONS.JOIN_SUBMISSIONS).get();
    const items = snapshot.docs.map(doc => doc.data() as FirestoreJoinSubmission);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async get(id: string): Promise<FirestoreJoinSubmission | null> {
    const doc = await db().collection(COLLECTIONS.JOIN_SUBMISSIONS).doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreJoinSubmission;
  },

  async updateStatus(id: string, status: "approved" | "rejected"): Promise<FirestoreJoinSubmission | null> {
    const ref = db().collection(COLLECTIONS.JOIN_SUBMISSIONS).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ status });
    const updated = await ref.get();
    return updated.data() as FirestoreJoinSubmission;
  },

  async updateNominationStatus(id: string, nominationStatus: "pending" | "joined" | "unsure" | "not_interested"): Promise<FirestoreJoinSubmission | null> {
    const ref = db().collection(COLLECTIONS.JOIN_SUBMISSIONS).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ nominationStatus });
    const updated = await ref.get();
    return updated.data() as FirestoreJoinSubmission;
  },
};

const HOST_SETTINGS_DEFAULTS: Omit<FirestoreHostSettings, "updatedAt"> = {
  mode: "request",
  price: 0,
  pageTitle: "HOST YOUR EVENT",
  pageDescription: "Want to run your own competition on HiFitComp? Whether you're an event coordinator, brand, or organization, we provide the platform. Submit your event details below and our team will get you set up.",
  requiredFields: ["fullName", "email", "phone", "eventName", "eventDescription", "eventCategory"],
  isActive: true,
};

export const firestoreHostSettings = {
  async get(): Promise<FirestoreHostSettings> {
    const doc = await db().collection(COLLECTIONS.HOST_SETTINGS).doc("global").get();
    if (!doc.exists) {
      const settings = { ...HOST_SETTINGS_DEFAULTS, updatedAt: now() };
      await db().collection(COLLECTIONS.HOST_SETTINGS).doc("global").set(settings);
      return settings;
    }
    return doc.data() as FirestoreHostSettings;
  },

  async update(data: Partial<Omit<FirestoreHostSettings, "updatedAt">>): Promise<FirestoreHostSettings> {
    const ref = db().collection(COLLECTIONS.HOST_SETTINGS).doc("global");
    const doc = await ref.get();
    if (doc.exists) {
      await ref.update({ ...data, updatedAt: now() });
    } else {
      await ref.set({ ...HOST_SETTINGS_DEFAULTS, ...data, updatedAt: now() });
    }
    const updated = await ref.get();
    return updated.data() as FirestoreHostSettings;
  },
};

export const firestoreHostSubmissions = {
  async create(data: Omit<FirestoreHostSubmission, "id" | "createdAt" | "status">): Promise<FirestoreHostSubmission> {
    const docRef = db().collection(COLLECTIONS.HOST_SUBMISSIONS).doc();
    const submission: FirestoreHostSubmission = {
      ...data,
      id: docRef.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await docRef.set(submission);
    return submission;
  },

  async getAll(): Promise<FirestoreHostSubmission[]> {
    const snapshot = await db().collection(COLLECTIONS.HOST_SUBMISSIONS).get();
    const items = snapshot.docs.map(doc => doc.data() as FirestoreHostSubmission);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async get(id: string): Promise<FirestoreHostSubmission | null> {
    const doc = await db().collection(COLLECTIONS.HOST_SUBMISSIONS).doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreHostSubmission;
  },

  async updateStatus(id: string, status: "approved" | "rejected"): Promise<FirestoreHostSubmission | null> {
    const ref = db().collection(COLLECTIONS.HOST_SUBMISSIONS).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ status });
    const updated = await ref.get();
    return updated.data() as FirestoreHostSubmission;
  },
};

export interface FirestoreInvitation {
  id: string;
  token: string;
  invitedBy: string;
  invitedByEmail: string;
  invitedByName: string;
  invitedEmail: string;
  invitedName: string;
  invitedPhone?: string | null;
  targetLevel: number;
  message: string | null;
  suggestedCategory?: string | null;
  suggestedEventName?: string | null;
  status: "pending" | "accepted" | "expired";
  createdAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export const firestoreInvitations = {
  async create(data: {
    invitedBy: string;
    invitedByEmail: string;
    invitedByName: string;
    invitedEmail: string;
    invitedName: string;
    invitedPhone?: string;
    targetLevel: number;
    message?: string;
    suggestedCategory?: string;
    suggestedEventName?: string;
  }): Promise<FirestoreInvitation> {
    const docRef = db().collection(COLLECTIONS.INVITATIONS).doc();
    const invitation: FirestoreInvitation = {
      id: docRef.id,
      token: generateToken(),
      invitedBy: data.invitedBy,
      invitedByEmail: data.invitedByEmail,
      invitedByName: data.invitedByName,
      invitedEmail: data.invitedEmail,
      invitedName: data.invitedName,
      invitedPhone: data.invitedPhone || null,
      targetLevel: data.targetLevel,
      message: data.message || null,
      suggestedCategory: data.suggestedCategory || null,
      suggestedEventName: data.suggestedEventName || null,
      status: "pending",
      createdAt: new Date().toISOString(),
      acceptedAt: null,
      acceptedBy: null,
    };
    await docRef.set(invitation);
    return invitation;
  },

  async getByToken(token: string): Promise<FirestoreInvitation | null> {
    const snapshot = await db()
      .collection(COLLECTIONS.INVITATIONS)
      .where("token", "==", token)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as FirestoreInvitation;
  },

  async getBySender(invitedBy: string): Promise<FirestoreInvitation[]> {
    const snapshot = await db()
      .collection(COLLECTIONS.INVITATIONS)
      .where("invitedBy", "==", invitedBy)
      .get();
    const items = snapshot.docs.map(doc => doc.data() as FirestoreInvitation);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getAll(): Promise<FirestoreInvitation[]> {
    const snapshot = await db().collection(COLLECTIONS.INVITATIONS).get();
    const items = snapshot.docs.map(doc => doc.data() as FirestoreInvitation);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async markAccepted(token: string, acceptedByUid: string): Promise<FirestoreInvitation | null> {
    const snapshot = await db()
      .collection(COLLECTIONS.INVITATIONS)
      .where("token", "==", token)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const docRef = snapshot.docs[0].ref;
    await docRef.update({
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      acceptedBy: acceptedByUid,
    });
    const updated = await docRef.get();
    return updated.data() as FirestoreInvitation;
  },

  async delete(id: string): Promise<void> {
    await db().collection(COLLECTIONS.INVITATIONS).doc(id).delete();
  },
};

export const firestoreReferrals = {
  async generateCode(
    ownerId: string,
    ownerType: "talent" | "host" | "admin" | "custom",
    ownerName: string,
    talentProfileId?: number | null,
    opts?: { ownerEmail?: string; competitionId?: number; competitionIds?: number[]; contestantId?: number; skipDuplicateCheck?: boolean; customCode?: string }
  ): Promise<FirestoreReferralCode> {
    if (!opts?.skipDuplicateCheck) {
      const existing = await db().collection(COLLECTIONS.REFERRAL_CODES).where("ownerId", "==", ownerId).limit(1).get();
      if (!existing.empty) {
        return existing.docs[0].data() as FirestoreReferralCode;
      }
    }
    const code = opts?.customCode || crypto.randomBytes(4).toString("hex").toUpperCase();
    const referral: FirestoreReferralCode = {
      code,
      ownerId,
      ownerType,
      ownerName,
      ownerEmail: opts?.ownerEmail || null,
      talentProfileId: talentProfileId || null,
      competitionId: opts?.competitionId || null,
      competitionIds: opts?.competitionIds || [],
      contestantId: opts?.contestantId || null,
      createdAt: new Date().toISOString(),
    };
    await db().collection(COLLECTIONS.REFERRAL_CODES).doc(code).set(referral);
    await db().collection(COLLECTIONS.REFERRAL_STATS).doc(code).set({
      code,
      ownerId,
      ownerType,
      ownerName,
      totalVotesDriven: 0,
      uniqueVoters: 0,
      voterIps: [],
      updatedAt: now(),
    });
    return referral;
  },

  async getCodeByOwner(ownerId: string): Promise<FirestoreReferralCode | null> {
    const snapshot = await db().collection(COLLECTIONS.REFERRAL_CODES).where("ownerId", "==", ownerId).get();
    if (snapshot.empty) return null;
    const codes = snapshot.docs.map(d => d.data() as FirestoreReferralCode);
    const active = codes.find(c => !c.aliasFor);
    return active || codes[0];
  },

  async getCodesByOwner(ownerId: string): Promise<FirestoreReferralCode[]> {
    const snapshot = await db().collection(COLLECTIONS.REFERRAL_CODES).where("ownerId", "==", ownerId).get();
    return snapshot.docs.map(d => d.data() as FirestoreReferralCode);
  },

  async resolveCode(code: string): Promise<FirestoreReferralCode | null> {
    const doc = await db().collection(COLLECTIONS.REFERRAL_CODES).doc(code).get();
    if (!doc.exists) return null;
    const data = doc.data() as FirestoreReferralCode;
    if (data.aliasFor) {
      const activeDoc = await db().collection(COLLECTIONS.REFERRAL_CODES).doc(data.aliasFor).get();
      if (activeDoc.exists) return activeDoc.data() as FirestoreReferralCode;
    }
    return data;
  },

  async getCodeByCode(code: string): Promise<FirestoreReferralCode | null> {
    const doc = await db().collection(COLLECTIONS.REFERRAL_CODES).doc(code).get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreReferralCode;
  },

  async getAllCodes(): Promise<FirestoreReferralCode[]> {
    const snapshot = await db().collection(COLLECTIONS.REFERRAL_CODES).get();
    return snapshot.docs.map(doc => doc.data() as FirestoreReferralCode);
  },

  async getAllStats(): Promise<FirestoreReferralStats[]> {
    const snapshot = await db().collection(COLLECTIONS.REFERRAL_STATS).get();
    return snapshot.docs.map(doc => doc.data() as FirestoreReferralStats);
  },

  async trackReferralVote(refCode: string, voterIp: string, voteCount: number = 1): Promise<void> {
    let activeCode = refCode;
    try {
      const resolved = await this.resolveCode(refCode);
      if (resolved) activeCode = resolved.code;
    } catch {}

    const statsRef = db().collection(COLLECTIONS.REFERRAL_STATS).doc(activeCode);
    const statsDoc = await statsRef.get();
    if (!statsDoc.exists) return;
    const data = statsDoc.data() as FirestoreReferralStats;
    const isNewVoter = !data.voterIps.includes(voterIp);
    const updates: any = {
      totalVotesDriven: admin.firestore.FieldValue.increment(voteCount),
      updatedAt: now(),
    };
    if (isNewVoter) {
      updates.uniqueVoters = admin.firestore.FieldValue.increment(1);
      updates.voterIps = admin.firestore.FieldValue.arrayUnion(voterIp);
    }
    await statsRef.update(updates);
  },

  async updateCode(
    oldCode: string,
    updates: { newCode?: string; ownerName?: string; ownerEmail?: string | null; ownerType?: "talent" | "host" | "admin" | "custom"; competitionId?: number | null; competitionIds?: number[]; contestantId?: number | null }
  ): Promise<FirestoreReferralCode> {
    const codeDoc = await db().collection(COLLECTIONS.REFERRAL_CODES).doc(oldCode).get();
    if (!codeDoc.exists) throw new Error("Referral code not found");
    const existing = codeDoc.data() as FirestoreReferralCode;

    const finalCode = updates.newCode?.toUpperCase().trim() || oldCode;
    const isCodeChanged = finalCode !== oldCode;

    if (isCodeChanged) {
      const dupCheck = await db().collection(COLLECTIONS.REFERRAL_CODES).doc(finalCode).get();
      if (dupCheck.exists) {
        const dupData = dupCheck.data() as FirestoreReferralCode;
        if (!dupData.aliasFor || dupData.ownerId !== existing.ownerId) {
          throw new Error("Code already exists");
        }
      }
    }

    const previousCodes = existing.previousCodes || [];

    const updated: FirestoreReferralCode = {
      ...existing,
      code: finalCode,
      ownerName: updates.ownerName ?? existing.ownerName,
      ownerEmail: updates.ownerEmail !== undefined ? updates.ownerEmail : existing.ownerEmail,
      ownerType: updates.ownerType ?? existing.ownerType,
      competitionId: updates.competitionId !== undefined ? updates.competitionId : existing.competitionId,
      competitionIds: updates.competitionIds !== undefined ? updates.competitionIds : (existing.competitionIds || []),
      contestantId: updates.contestantId !== undefined ? updates.contestantId : existing.contestantId,
      aliasFor: null,
      previousCodes: isCodeChanged ? [...previousCodes, oldCode] : previousCodes,
    };

    const statsUpdates: Record<string, any> = {
      ownerName: updated.ownerName,
      ownerType: updated.ownerType,
      updatedAt: now(),
    };

    if (isCodeChanged) {
      await db().collection(COLLECTIONS.REFERRAL_CODES).doc(oldCode).update({
        aliasFor: finalCode,
      });

      await db().collection(COLLECTIONS.REFERRAL_CODES).doc(finalCode).set(updated);

      const statsDoc = await db().collection(COLLECTIONS.REFERRAL_STATS).doc(oldCode).get();
      if (statsDoc.exists) {
        const statsData = { ...statsDoc.data()!, ...statsUpdates, code: finalCode };
        await db().collection(COLLECTIONS.REFERRAL_STATS).doc(finalCode).set(statsData);
      } else {
        await db().collection(COLLECTIONS.REFERRAL_STATS).doc(finalCode).set({
          code: finalCode,
          ownerId: updated.ownerId,
          ownerType: updated.ownerType,
          ownerName: updated.ownerName,
          totalVotesDriven: 0,
          uniqueVoters: 0,
          voterIps: [],
          updatedAt: now(),
        });
      }
    } else {
      await db().collection(COLLECTIONS.REFERRAL_CODES).doc(oldCode).update({
        ownerName: updated.ownerName,
        ownerEmail: updated.ownerEmail,
        ownerType: updated.ownerType,
        competitionId: updated.competitionId ?? null,
        competitionIds: updated.competitionIds || [],
        contestantId: updated.contestantId ?? null,
      });
      await db().collection(COLLECTIONS.REFERRAL_STATS).doc(oldCode).update(statsUpdates).catch(() => {});
    }

    return updated;
  },

  async deleteCode(code: string): Promise<void> {
    await db().collection(COLLECTIONS.REFERRAL_CODES).doc(code).delete();
    await db().collection(COLLECTIONS.REFERRAL_STATS).doc(code).delete();
  },
};
