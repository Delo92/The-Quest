import { getFirebaseAuth, getFirestore, getFirestoreUser } from "../firebase-admin";
import {
  firestoreContestants,
  firestoreTalentProfiles,
  type FirestoreContestant,
  type FirestoreTalentProfile,
} from "../firestore-collections";
import { parsePublicLinks } from "../../shared/public-links";
import { logError } from "./errorLogger";
import {
  isOCAdapterConfigured,
  syncOCSocialProfiles,
  type OCSocialProfileSyncRecord,
} from "./ocAdapter";

const INACTIVE_CONTESTANT_STATUSES = new Set(["rejected", "withdrawn", "removed", "cancelled"]);
const RESULT_COLLECTION = "ocSocialScanResults";
const BACKFILL_BATCH_SIZE = 50;
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

type SocialRole = "host" | "contestant";

interface ProfileContext {
  profile: FirestoreTalentProfile;
  roleTypes: Set<SocialRole>;
  competitionIds: Set<number>;
}

interface BuiltRecord {
  record: OCSocialProfileSyncRecord | null;
  hasSocialLinks: boolean;
  missingEmail: boolean;
}

function activeContestant(contestant: FirestoreContestant): boolean {
  return !INACTIVE_CONTESTANT_STATUSES.has(String(contestant.applicationStatus || "").toLowerCase());
}

function addProfileContext(
  contexts: Map<number, ProfileContext>,
  profile: FirestoreTalentProfile,
): ProfileContext {
  let context = contexts.get(profile.id);
  if (!context) {
    context = { profile, roleTypes: new Set(), competitionIds: new Set() };
    contexts.set(profile.id, context);
  }
  return context;
}

async function buildRecord(
  profile: FirestoreTalentProfile,
  roleTypes: SocialRole[],
  competitionIds: number[],
): Promise<BuiltRecord> {
  const account = await getFirestoreUser(profile.userId).catch(() => null);
  let authAccount: { email?: string; displayName?: string; phoneNumber?: string } | null = null;
  try {
    const firebaseUser = await getFirebaseAuth().getUser(profile.userId);
    authAccount = {
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      phoneNumber: firebaseUser.phoneNumber,
    };
  } catch {
    authAccount = null;
  }

  const fullName = String(account?.displayName || authAccount?.displayName || profile.displayName || "").trim();
  const email = String(account?.email || (profile as any).email || authAccount?.email || "").trim().toLowerCase();
  const phone = String(authAccount?.phoneNumber || (profile as any).phone || (account as any)?.phone || "").trim() || null;
  const socialLinks = {
    ...parsePublicLinks(account?.socialLinks),
    ...parsePublicLinks(profile.socialLinks),
  };
  const hasSocialLinks = Object.keys(socialLinks).length > 0;
  const operation = roleTypes.length > 0 ? "upsert" : "delete";

  if (operation === "upsert" && !email) {
    return { record: null, hasSocialLinks, missingEmail: true };
  }

  return {
    record: {
      operation,
      questProfileId: String(profile.id),
      questUserId: profile.userId,
      fullName,
      email,
      phone,
      roleTypes,
      competitionIds,
      socialLinks,
      updatedAt: new Date().toISOString(),
    },
    hasSocialLinks,
    missingEmail: false,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) return;
        results[index] = await mapper(items[index]);
      }
    }),
  );
  return results;
}

async function getProfileRecordForUser(userId: string): Promise<OCSocialProfileSyncRecord | null> {
  const profile = await firestoreTalentProfiles.getByUserId(userId);
  if (!profile) return null;

  const contestantEntries = await firestoreContestants.getByTalent(profile.id);
  const activeEntries = contestantEntries.filter(activeContestant);
  const roleTypes: SocialRole[] = [];
  if (profile.role.toLowerCase() === "host") roleTypes.push("host");
  if (activeEntries.length > 0) roleTypes.push("contestant");

  const built = await buildRecord(
    profile,
    roleTypes,
    [...new Set(activeEntries.map((entry) => Number(entry.competitionId)).filter(Number.isFinite))],
  );
  return built.record;
}

async function logSyncFailure(
  error: unknown,
  details: { userId?: string; profileId?: string; count?: number },
): Promise<void> {
  const status = Number((error as any)?.status);
  await logError({
    errorType: "api",
    severity: "warning",
    message: "Quest social profile sync to OC failed",
    endpoint: "/api/integrations/quest/social-profiles/sync",
    method: "POST",
    statusCode: Number.isInteger(status) && status > 0 ? status : undefined,
    userUid: details.userId,
    context: {
      profileId: details.profileId,
      count: details.count,
    },
  });
}

export async function syncOCSocialProfileForUser(userId: string): Promise<void> {
  if (!isOCAdapterConfigured() || !userId) return;
  try {
    const record = await getProfileRecordForUser(userId);
    if (!record) return;
    await syncOCSocialProfiles([record], "change");
  } catch (error) {
    await logSyncFailure(error, { userId });
  }
}

export function queueOCSocialProfileSyncForUser(userId: string): void {
  if (!isOCAdapterConfigured() || !userId) return;
  const pending = syncTimers.get(userId);
  if (pending) clearTimeout(pending);
  const timer = setTimeout(() => {
    syncTimers.delete(userId);
    void syncOCSocialProfileForUser(userId);
  }, 300);
  timer.unref?.();
  syncTimers.set(userId, timer);
}

export function queueOCSocialProfileSyncForTalentProfile(profileId: number): void {
  if (!isOCAdapterConfigured() || !Number.isFinite(profileId)) return;
  void firestoreTalentProfiles.get(profileId).then((profile) => {
    if (profile) queueOCSocialProfileSyncForUser(profile.userId);
  }).catch((error) => {
    void logSyncFailure(error, { profileId: String(profileId) });
  });
}

export async function removeOCSocialProfileForDeletedTalentProfile(profile: FirestoreTalentProfile): Promise<void> {
  if (!isOCAdapterConfigured()) return;
  try {
    const built = await buildRecord(profile, [], []);
    if (built.record) await syncOCSocialProfiles([built.record], "change");
  } catch (error) {
    await logSyncFailure(error, { userId: profile.userId, profileId: String(profile.id) });
  }
}

export async function runOCSocialProfileBackfill(): Promise<{
  eligibleCount: number;
  sentCount: number;
  failedCount: number;
  skippedNoSocialLinks: number;
  skippedMissingEmail: number;
  failedProfileIds: string[];
}> {
  if (!isOCAdapterConfigured()) {
    throw Object.assign(new Error("OC integration is not configured"), { status: 503 });
  }

  const [profiles, contestants] = await Promise.all([
    firestoreTalentProfiles.getAll(),
    firestoreContestants.getAll(),
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const contexts = new Map<number, ProfileContext>();

  for (const profile of profiles) {
    if (profile.role.toLowerCase() === "host") {
      addProfileContext(contexts, profile).roleTypes.add("host");
    }
  }
  for (const contestant of contestants) {
    if (!activeContestant(contestant)) continue;
    const profile = profilesById.get(contestant.talentProfileId);
    if (!profile) continue;
    const context = addProfileContext(contexts, profile);
    context.roleTypes.add("contestant");
    context.competitionIds.add(Number(contestant.competitionId));
  }

  const built = await mapWithConcurrency([...contexts.values()], 20, async (context) =>
    buildRecord(
      context.profile,
      [...context.roleTypes],
      [...context.competitionIds].filter(Number.isFinite),
    ),
  );

  const eligible = built.filter((item) => item.record?.operation === "upsert");
  const records = eligible
    .filter((item) => item.hasSocialLinks && item.record)
    .map((item) => item.record!);
  let sentCount = 0;
  let failedCount = 0;
  const failedProfileIds: string[] = [];

  for (let index = 0; index < records.length; index += BACKFILL_BATCH_SIZE) {
    const batch = records.slice(index, index + BACKFILL_BATCH_SIZE);
    try {
      const response = await syncOCSocialProfiles(batch, "backfill");
      const rejected = Array.isArray(response?.rejected) ? response.rejected : [];
      const reportedAccepted = Number(response?.acceptedCount ?? response?.accepted);
      const acceptedCount = Number.isFinite(reportedAccepted)
        ? Math.max(0, Math.min(batch.length, reportedAccepted))
        : Math.max(0, batch.length - rejected.length);
      sentCount += acceptedCount;
      failedCount += batch.length - acceptedCount;
      const rejectedIds = new Set(rejected.map((item: any) => String(item?.questProfileId || "")));
      const reportedFailedIds = batch
        .filter((record) => rejectedIds.has(record.questProfileId))
        .map((record) => record.questProfileId);
      failedProfileIds.push(
        ...(reportedFailedIds.length > 0
          ? reportedFailedIds
          : batch.slice(acceptedCount).map((record) => record.questProfileId)),
      );
    } catch (error) {
      failedCount += batch.length;
      failedProfileIds.push(...batch.map((record) => record.questProfileId));
      await logSyncFailure(error, { count: batch.length });
    }
  }

  return {
    eligibleCount: contexts.size,
    sentCount,
    failedCount,
    skippedNoSocialLinks: eligible.filter((item) => !item.hasSocialLinks && !item.missingEmail).length,
    skippedMissingEmail: built.filter((item) => item.missingEmail).length,
    failedProfileIds,
  };
}

export interface OCSocialScanResult {
  questProfileId: string;
  scanStatus: "complete" | "partial" | "unavailable" | "error";
  checkedAt: string;
  windowStart?: string;
  windowEnd?: string;
  qualifyingPostCountLast7Days?: number | null;
  message?: string;
  links?: Array<{
    platform: string;
    url: string;
    scanStatus: "complete" | "partial" | "unavailable" | "error";
    postCountLast7Days?: number | null;
    lastPostAt?: string | null;
    evidenceUrls?: string[];
  }>;
}

export async function storeOCSocialScanResults(results: OCSocialScanResult[]): Promise<{
  storedCount: number;
  staleCount: number;
}> {
  const db = getFirestore();
  const collection = db.collection(RESULT_COLLECTION);
  const existingDocs = await Promise.all(
    results.map((result) => collection.doc(result.questProfileId).get()),
  );
  const batch = db.batch();
  let storedCount = 0;
  let staleCount = 0;

  results.forEach((result, index) => {
    const existingCheckedAt = existingDocs[index].data()?.checkedAt;
    if (existingCheckedAt && Date.parse(existingCheckedAt) > Date.parse(result.checkedAt)) {
      staleCount += 1;
      return;
    }

    const postCount = result.qualifyingPostCountLast7Days ?? null;
    const weeklyMinimumMet = postCount !== null && postCount >= 3
      ? true
      : result.scanStatus === "complete" && postCount !== null
        ? false
        : null;
    batch.set(collection.doc(result.questProfileId), {
      ...result,
      weeklyMinimumMet,
      receivedAt: new Date().toISOString(),
    });
    storedCount += 1;
  });

  if (storedCount > 0) await batch.commit();
  return { storedCount, staleCount };
}