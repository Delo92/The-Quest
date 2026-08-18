import {
  firestoreCompetitions,
  firestoreTalentProfiles,
  firestoreContestants,
  firestoreVotes,
  firestoreVotePurchases,
  firestoreLivery,
  type FirestoreCompetition,
  type FirestoreTalentProfile,
  type FirestoreContestant,
  type FirestoreVote,
  type FirestoreVotePurchase,
  type FirestoreLiveryItem,
} from "./firestore-collections";
import { getFirestoreUser, createFirestoreUser, updateFirestoreUser, type FirestoreUser } from "./firebase-admin";

export interface IStorage {
  getUser(id: string): Promise<FirestoreUser | null>;
  createUser(data: { uid: string; email: string; displayName: string; level: number; profileImageUrl?: string; stageName?: string; socialLinks?: Record<string, string>; billingAddress?: any }): Promise<FirestoreUser>;
  updateUser(id: string, data: Partial<any>): Promise<FirestoreUser | null>;

  getTalentProfile(id: number): Promise<FirestoreTalentProfile | null>;
  getTalentProfileByUserId(userId: string): Promise<FirestoreTalentProfile | null>;
  createTalentProfile(profile: Omit<FirestoreTalentProfile, "id">): Promise<FirestoreTalentProfile>;
  updateTalentProfile(userId: string, data: Partial<Omit<FirestoreTalentProfile, "id" | "userId">>): Promise<FirestoreTalentProfile | null>;
  getAllTalentProfiles(): Promise<FirestoreTalentProfile[]>;
  getAdminProfiles(): Promise<FirestoreTalentProfile[]>;
  getHostProfiles(): Promise<FirestoreTalentProfile[]>;

  deleteTalentProfileByUserId(userId: string): Promise<boolean>;

  getCompetitions(): Promise<FirestoreCompetition[]>;
  getCompetitionsByStatus(status: string): Promise<FirestoreCompetition[]>;
  getCompetitionsByCategory(category: string): Promise<FirestoreCompetition[]>;
  getCompetitionsByCategoryAndStatus(category: string, status: string): Promise<FirestoreCompetition[]>;
  getCompetitionsByCreator(createdBy: string): Promise<FirestoreCompetition[]>;
  getCompetition(id: number): Promise<FirestoreCompetition | null>;
  createCompetition(comp: Omit<FirestoreCompetition, "id">): Promise<FirestoreCompetition>;
  updateCompetition(id: number, data: Partial<Omit<FirestoreCompetition, "id">>): Promise<FirestoreCompetition | null>;
  deleteCompetition(id: number): Promise<void>;

  getContestantsByCompetition(competitionId: number): Promise<(FirestoreContestant & { talentProfile: FirestoreTalentProfile; voteCount: number })[]>;
  getContestantsByTalent(talentProfileId: number): Promise<(FirestoreContestant & { competitionTitle: string })[]>;
  createContestant(contestant: Omit<FirestoreContestant, "id">): Promise<FirestoreContestant>;
  updateContestantStatus(id: number, status: string): Promise<FirestoreContestant | null>;
  getContestant(competitionId: number, talentProfileId: number): Promise<FirestoreContestant | null>;
  deleteContestant(id: number): Promise<boolean>;
  getAllContestants(): Promise<(FirestoreContestant & { talentProfile: FirestoreTalentProfile; competitionTitle: string })[]>;

  castVote(vote: { contestantId: number; competitionId: number; voterIp: string | null; userId?: string | null; purchaseId?: number | null; source?: "online" | "in_person"; refCode?: string | null }): Promise<FirestoreVote>;
  getVoteCount(contestantId: number): Promise<number>;
  getTotalVotesByCompetition(competitionId: number): Promise<number>;
  getVoteBreakdownByCompetition(competitionId: number): Promise<{ online: number; inPerson: number; total: number }>;
  getContestantVoteBreakdown(contestantId: number, competitionId: number): Promise<{ online: number; inPerson: number; total: number }>;
  getVotesTodayByIp(competitionId: number, voterIp: string): Promise<number>;

  castBulkVotes(data: { contestantId: number; competitionId: number; userId: string; purchaseId: number; voteCount: number; source?: "online" | "in_person"; refCode?: string | null }): Promise<void>;
  getVoteCountForContestantInCompetition(contestantId: number, competitionId: number): Promise<number>;

  createVotePurchase(purchase: { userId: string; competitionId: number; contestantId: number; voteCount: number; amount: number }): Promise<FirestoreVotePurchase>;
  getVotePurchasesByUser(userId: string): Promise<FirestoreVotePurchase[]>;
  getVotePurchasesByCompetition(competitionId: number): Promise<FirestoreVotePurchase[]>;

  getAllLivery(): Promise<FirestoreLiveryItem[]>;
  getLiveryByKey(imageKey: string): Promise<FirestoreLiveryItem | null>;
  upsertLivery(item: FirestoreLiveryItem): Promise<FirestoreLiveryItem>;
  updateLiveryImage(imageKey: string, imageUrl: string | null, mediaType?: "image" | "video"): Promise<FirestoreLiveryItem | null>;
  updateLiveryText(imageKey: string, textContent: string | null): Promise<FirestoreLiveryItem | null>;
  deleteLiverySlot(imageKey: string): Promise<void>;
}

export class FirestoreStorage implements IStorage {
  async getUser(id: string): Promise<FirestoreUser | null> {
    return getFirestoreUser(id);
  }

  async createUser(data: { uid: string; email: string; displayName: string; level: number; profileImageUrl?: string; stageName?: string; socialLinks?: Record<string, string>; billingAddress?: any }): Promise<FirestoreUser> {
    return createFirestoreUser(data);
  }

  async updateUser(id: string, data: Partial<any>): Promise<FirestoreUser | null> {
    return updateFirestoreUser(id, data);
  }

  async getTalentProfile(id: number): Promise<FirestoreTalentProfile | null> {
    return firestoreTalentProfiles.get(id);
  }

  async getTalentProfileByUserId(userId: string): Promise<FirestoreTalentProfile | null> {
    return firestoreTalentProfiles.getByUserId(userId);
  }

  async createTalentProfile(profile: Omit<FirestoreTalentProfile, "id">): Promise<FirestoreTalentProfile> {
    return firestoreTalentProfiles.create(profile);
  }

  async updateTalentProfile(userId: string, data: Partial<Omit<FirestoreTalentProfile, "id" | "userId">>): Promise<FirestoreTalentProfile | null> {
    return firestoreTalentProfiles.updateByUserId(userId, data);
  }

  async getAllTalentProfiles(): Promise<FirestoreTalentProfile[]> {
    return firestoreTalentProfiles.getAll();
  }

  async getAdminProfiles(): Promise<FirestoreTalentProfile[]> {
    return firestoreTalentProfiles.getByRole("admin");
  }

  async getHostProfiles(): Promise<FirestoreTalentProfile[]> {
    return firestoreTalentProfiles.getByRole("host");
  }

  async deleteTalentProfileByUserId(userId: string): Promise<boolean> {
    return firestoreTalentProfiles.deleteByUserId(userId);
  }

  async getCompetitions(): Promise<FirestoreCompetition[]> {
    return firestoreCompetitions.getAll();
  }

  async getCompetitionsByStatus(status: string): Promise<FirestoreCompetition[]> {
    return firestoreCompetitions.getByStatus(status);
  }

  async getCompetitionsByCategory(category: string): Promise<FirestoreCompetition[]> {
    return firestoreCompetitions.getByCategory(category);
  }

  async getCompetitionsByCategoryAndStatus(category: string, status: string): Promise<FirestoreCompetition[]> {
    return firestoreCompetitions.getByCategoryAndStatus(category, status);
  }

  async getCompetitionsByCreator(createdBy: string): Promise<FirestoreCompetition[]> {
    return firestoreCompetitions.getByCreator(createdBy);
  }

  async getCompetition(id: number): Promise<FirestoreCompetition | null> {
    return firestoreCompetitions.get(id);
  }

  async createCompetition(comp: Omit<FirestoreCompetition, "id">): Promise<FirestoreCompetition> {
    return firestoreCompetitions.create(comp);
  }

  async updateCompetition(id: number, data: Partial<Omit<FirestoreCompetition, "id">>): Promise<FirestoreCompetition | null> {
    return firestoreCompetitions.update(id, data);
  }

  async deleteCompetition(id: number): Promise<void> {
    return firestoreCompetitions.delete(id);
  }

  async getContestantsByCompetition(competitionId: number): Promise<(FirestoreContestant & { talentProfile: FirestoreTalentProfile; voteCount: number })[]> {
    const allContestants = await firestoreContestants.getByCompetition(competitionId);
    const approved = allContestants.filter(c => c.applicationStatus === "approved");

    const results: (FirestoreContestant & { talentProfile: FirestoreTalentProfile; voteCount: number })[] = [];
    for (const contestant of approved) {
      const profile = await firestoreTalentProfiles.get(contestant.talentProfileId);
      if (!profile) continue;
      const voteCount = await firestoreVotes.getVoteCountForContestantInCompetition(contestant.id, competitionId);
      results.push({
        ...contestant,
        talentProfile: profile,
        voteCount,
      });
    }
    return results;
  }

  async getContestantsByTalent(talentProfileId: number): Promise<(FirestoreContestant & { competitionTitle: string })[]> {
    const contestantEntries = await firestoreContestants.getByTalent(talentProfileId);
    const results: (FirestoreContestant & { competitionTitle: string })[] = [];
    for (const contestant of contestantEntries) {
      const comp = await firestoreCompetitions.get(contestant.competitionId);
      results.push({
        ...contestant,
        competitionTitle: comp?.title || "Unknown Competition",
      });
    }
    return results;
  }

  async createContestant(contestant: Omit<FirestoreContestant, "id">): Promise<FirestoreContestant> {
    return firestoreContestants.create(contestant);
  }

  async updateContestantStatus(id: number, status: string): Promise<FirestoreContestant | null> {
    return firestoreContestants.updateStatus(id, status);
  }

  async getContestant(competitionId: number, talentProfileId: number): Promise<FirestoreContestant | null> {
    return firestoreContestants.get(competitionId, talentProfileId);
  }

  async deleteContestant(id: number): Promise<boolean> {
    return firestoreContestants.delete(id);
  }

  async getAllContestants(): Promise<(FirestoreContestant & { talentProfile: FirestoreTalentProfile; competitionTitle: string })[]> {
    const allContestants = await firestoreContestants.getAll();
    const results: (FirestoreContestant & { talentProfile: FirestoreTalentProfile; competitionTitle: string })[] = [];
    for (const contestant of allContestants) {
      const profile = await firestoreTalentProfiles.get(contestant.talentProfileId);
      if (!profile) continue;
      const comp = await firestoreCompetitions.get(contestant.competitionId);
      results.push({
        ...contestant,
        talentProfile: profile,
        competitionTitle: comp?.title || "Unknown Competition",
      });
    }
    return results;
  }

  async castVote(vote: { contestantId: number; competitionId: number; voterIp: string | null; userId?: string | null; purchaseId?: number | null; source?: "online" | "in_person"; refCode?: string | null }): Promise<FirestoreVote> {
    return firestoreVotes.cast({
      contestantId: vote.contestantId,
      competitionId: vote.competitionId,
      voterIp: vote.voterIp,
      userId: vote.userId || null,
      purchaseId: vote.purchaseId || null,
      source: vote.source || "online",
      refCode: vote.refCode || null,
    });
  }

  async getVoteCount(contestantId: number): Promise<number> {
    return firestoreVotes.getVoteCount(contestantId);
  }

  async getTotalVotesByCompetition(competitionId: number): Promise<number> {
    return firestoreVotes.getTotalByCompetition(competitionId);
  }

  async getVoteBreakdownByCompetition(competitionId: number): Promise<{ online: number; inPerson: number; total: number }> {
    return firestoreVotes.getVoteBreakdownByCompetition(competitionId);
  }

  async getContestantVoteBreakdown(contestantId: number, competitionId: number): Promise<{ online: number; inPerson: number; total: number }> {
    return firestoreVotes.getContestantVoteBreakdown(contestantId, competitionId);
  }

  async getVotesTodayByIp(competitionId: number, voterIp: string): Promise<number> {
    return firestoreVotes.getVotesTodayByIp(competitionId, voterIp);
  }

  async castBulkVotes(data: { contestantId: number; competitionId: number; userId: string; purchaseId: number; voteCount: number; source?: "online" | "in_person"; refCode?: string | null }): Promise<void> {
    for (let i = 0; i < data.voteCount; i++) {
      await firestoreVotes.cast({
        contestantId: data.contestantId,
        competitionId: data.competitionId,
        voterIp: null,
        userId: data.userId,
        purchaseId: data.purchaseId,
        source: data.source || "online",
        refCode: data.refCode || null,
      });
    }
  }

  async getVoteCountForContestantInCompetition(contestantId: number, competitionId: number): Promise<number> {
    return firestoreVotes.getVoteCountForContestantInCompetition(contestantId, competitionId);
  }

  async createVotePurchase(purchase: { userId: string; competitionId: number; contestantId: number; voteCount: number; amount: number }): Promise<FirestoreVotePurchase> {
    return firestoreVotePurchases.create(purchase);
  }

  async getVotePurchasesByUser(userId: string): Promise<FirestoreVotePurchase[]> {
    return firestoreVotePurchases.getByUser(userId);
  }

  async getVotePurchasesByCompetition(competitionId: number): Promise<FirestoreVotePurchase[]> {
    return firestoreVotePurchases.getByCompetition(competitionId);
  }

  async getAllLivery(): Promise<FirestoreLiveryItem[]> {
    return firestoreLivery.getAll();
  }

  async getLiveryByKey(imageKey: string): Promise<FirestoreLiveryItem | null> {
    return firestoreLivery.getByKey(imageKey);
  }

  async upsertLivery(item: FirestoreLiveryItem): Promise<FirestoreLiveryItem> {
    return firestoreLivery.upsert(item);
  }

  async updateLiveryImage(imageKey: string, imageUrl: string | null, mediaType?: "image" | "video"): Promise<FirestoreLiveryItem | null> {
    return firestoreLivery.updateImage(imageKey, imageUrl, mediaType);
  }

  async updateLiveryText(imageKey: string, textContent: string | null): Promise<FirestoreLiveryItem | null> {
    return firestoreLivery.updateText(imageKey, textContent);
  }

  async deleteLiverySlot(imageKey: string): Promise<void> {
    return firestoreLivery.delete(imageKey);
  }
}

export const storage = new FirestoreStorage();
