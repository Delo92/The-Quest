import { z } from "zod";
import { getFirestore } from "./firebase-admin";
import { hashReferralValue, OCReferralError, type OCReferralRecord } from "./oc-referral-service";

export const postResultSchema = z.object({
  referralId: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  ocAccountId: z.string().trim().min(1).max(256),
  postId: z.string().trim().min(1).max(128),
  results: z.array(z.object({
    platform: z.string().trim().min(1).max(40),
    status: z.enum(["published", "scheduled", "failed"]),
    publishedAt: z.string().datetime().optional(),
    postUrl: z.string().url().max(2048).refine((v) => /^https:\/\//i.test(v), "HTTPS only").optional(),
    error: z.string().trim().max(200).optional(),
  }).strict()).min(1).max(20),
}).strict();

export interface OCPostResultRecord {
  uid: string;
  competitionId: number;
  ocAccountId: string;
  postId: string;
  results: z.infer<typeof postResultSchema>["results"];
  receivedAt: string;
}

export interface OCPostResultStore {
  getReferral(key: string): Promise<OCReferralRecord | null>;
  save(id: string, value: OCPostResultRecord): Promise<void>;
  listByUser(uid: string, limit: number): Promise<OCPostResultRecord[]>;
}

const collection = () => getFirestore().collection("ocPostResults");

export const ocPostResultStore: OCPostResultStore = {
  async getReferral(key) {
    const doc = await getFirestore().collection("ocEventReferrals").doc(key).get();
    return doc.exists ? doc.data() as OCReferralRecord : null;
  },
  async save(id, value) {
    // Idempotent per (referral, post): a retry overwrites with the same data and keeps the first receivedAt.
    const ref = collection().doc(id);
    await getFirestore().runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      tx.set(ref, existing.exists ? { ...value, receivedAt: (existing.data() as OCPostResultRecord).receivedAt } : value);
    });
  },
  async listByUser(uid, limit) {
    const snap = await collection().where("uid", "==", uid).limit(limit).get();
    return snap.docs.map((d) => d.data() as OCPostResultRecord);
  },
};

export function createOCPostResultService(store: OCPostResultStore, now: () => number = Date.now) {
  return {
    async record(input: z.infer<typeof postResultSchema>) {
      const key = hashReferralValue(input.referralId);
      const referral = await store.getReferral(key);
      if (!referral) throw new OCReferralError(404, "referral_not_found", "The Quest referral does not exist.");
      if (!referral.ocAccountId || referral.ocAccountId !== input.ocAccountId) {
        throw new OCReferralError(403, "account_mismatch", "This referral belongs to another OC account.");
      }
      await store.save(`${key}_${hashReferralValue(input.postId)}`, {
        uid: referral.uid,
        competitionId: referral.competitionId,
        ocAccountId: input.ocAccountId,
        postId: input.postId,
        results: input.results,
        receivedAt: new Date(now()).toISOString(),
      });
      return { recorded: true, postId: input.postId };
    },

    async summary(uid: string) {
      const posts = (await store.listByUser(uid, 200))
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      const totals = { published: 0, scheduled: 0, failed: 0 };
      const byPlatform: Record<string, { published: number; scheduled: number; failed: number }> = {};
      for (const post of posts) {
        for (const result of post.results) {
          totals[result.status] += 1;
          const entry = byPlatform[result.platform] ||= { published: 0, scheduled: 0, failed: 0 };
          entry[result.status] += 1;
        }
      }
      return {
        postCount: posts.length,
        totals,
        byPlatform,
        recent: posts.slice(0, 10).map((p) => ({
          postId: p.postId, competitionId: p.competitionId, receivedAt: p.receivedAt, results: p.results,
        })),
      };
    },
  };
}
