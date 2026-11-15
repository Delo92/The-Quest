import { createHash, randomUUID } from "node:crypto";
import { getAllFirestoreUsers } from "./firebase-admin";
import {
  firestoreHostSubmissions,
  firestoreJoinSubmissions,
} from "./firestore-collections";
import { getFirestore } from "./firebase-admin";
import {
  forwardMicrosoftInboxMessage,
  getMicrosoftInboxMessage,
  readMicrosoftInboxDelta,
} from "./microsoft-mailbox";
import { storage } from "./storage";

const FORWARD_TO = ["nbadelo@gmail.com", "jobs@hivestaffing.com"] as const;
const POLL_INTERVAL_MS = 90_000;
const SCAN_LEASE_MS = 3 * 60_000;
const STATE_COLLECTION = "microsoftEmailForwarding";
const STATE_ID = "inbox";

export type UserIdentity = {
  names: string[];
  emails: string[];
  phones: string[];
  profileIds: number[];
  contestantIds: number[];
};

export type ForwardableMessage = {
  id: string;
  subject: string;
  body: string;
  sender: string;
  senderName?: string;
};

function normalizeWords(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function identityMentioned(message: ForwardableMessage, identity: UserIdentity): boolean {
  const rawText = `${message.sender}\n${message.senderName || ""}\n${message.subject}\n${message.body}`.toLocaleLowerCase();
  const normalizedText = ` ${normalizeWords(rawText)} `;

  for (const email of identity.emails) {
    const normalizedEmail = email.trim().toLocaleLowerCase();
    if (normalizedEmail && new RegExp(`(^|[^a-z0-9._%+-])${escapeRegex(normalizedEmail)}([^a-z0-9._%+-]|$)`, "i").test(rawText)) {
      return true;
    }
  }

  for (const name of identity.names) {
    const normalizedName = normalizeWords(name);
    if (normalizedName.length >= 4 && normalizedText.includes(` ${normalizedName} `)) return true;
  }

  const phoneCandidates = (rawText.match(/\+?\d[\d\s().-]{8,}\d/g) || [])
    .map((candidate) => candidate.replace(/\D/g, ""))
    .filter((candidate) => candidate.length >= 10);
  for (const phone of identity.phones) {
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length >= 10 && phoneCandidates.some((candidate) => candidate.endsWith(phoneDigits.slice(-10)))) return true;
  }

  for (const id of identity.profileIds) {
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const idText = String(id);
    const labeledId = new RegExp(`\\b(?:profile|talent|user)\\s*(?:id|#|number)?\\s*#?${idText}\\b`, "i");
    const slugId = new RegExp(`\\b[a-z0-9]+(?:-[a-z0-9]+)*-${idText}\\b`, "i");
    if (labeledId.test(rawText) || slugId.test(rawText)) return true;
  }

  for (const id of identity.contestantIds) {
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const idText = String(id);
    if (new RegExp(`\\b(?:contestant|entry)\\s*(?:id|#|number)?\\s*#?${idText}\\b`, "i").test(rawText)) {
      return true;
    }
  }

  return false;
}

export function findMatchingUserIdentity(
  message: ForwardableMessage,
  identities: UserIdentity[],
): UserIdentity | null {
  return identities.find((identity) => identityMentioned(message, identity)) || null;
}

function makeIdentity(): UserIdentity {
  return { names: [], emails: [], phones: [], profileIds: [], contestantIds: [] };
}

function addValue(values: string[], value: unknown): void {
  if (typeof value === "string" && value.trim() && !values.includes(value.trim())) {
    values.push(value.trim());
  }
}

async function loadUserIdentities(): Promise<UserIdentity[]> {
  const [users, profiles, contestants, joinSubmissions, hostSubmissions] = await Promise.all([
    getAllFirestoreUsers(),
    storage.getAllTalentProfiles(),
    storage.getAllContestants(),
    firestoreJoinSubmissions.getAll(),
    firestoreHostSubmissions.getAll(),
  ]);
  const byUser = new Map<string, UserIdentity>();
  const byProfile = new Map<number, UserIdentity>();
  const byName = new Map<string, UserIdentity>();

  const forUser = (uid: string): UserIdentity => {
    let identity = byUser.get(uid);
    if (!identity) {
      identity = makeIdentity();
      byUser.set(uid, identity);
    }
    return identity;
  };

  for (const user of users) {
    const identity = forUser(user.uid);
    addValue(identity.names, user.displayName);
    addValue(identity.names, user.stageName);
    addValue(identity.emails, user.email);
  }

  for (const profile of profiles) {
    const identity = profile.userId ? forUser(profile.userId) : makeIdentity();
    identity.profileIds.push(profile.id);
    addValue(identity.names, profile.displayName);
    addValue(identity.names, profile.stageName);
    addValue(identity.emails, profile.email);
    byProfile.set(profile.id, identity);
    for (const name of identity.names) {
      const key = normalizeWords(name);
      if (key) byName.set(key, identity);
    }
  }

  for (const contestant of contestants) {
    const profile = contestant.talentProfile;
    const identity = byProfile.get(profile.id)
      || (profile.userId ? forUser(profile.userId) : makeIdentity());
    identity.profileIds.push(profile.id);
    identity.contestantIds.push(contestant.id);
    addValue(identity.names, profile.displayName);
    addValue(identity.names, profile.stageName);
    addValue(identity.emails, profile.email);
    for (const name of identity.names) {
      const key = normalizeWords(name);
      if (key) byName.set(key, identity);
    }
  }

  for (const submission of joinSubmissions) {
    const key = normalizeWords(submission.fullName);
    const identity = (key && byName.get(key)) || makeIdentity();
    addValue(identity.names, submission.fullName);
    addValue(identity.emails, submission.email);
    addValue(identity.emails, submission.nominatorEmail);
    addValue(identity.phones, submission.phone);
    addValue(identity.phones, submission.nominatorPhone);
    if (key) byName.set(key, identity);
  }

  for (const submission of hostSubmissions) {
    const key = normalizeWords(submission.fullName);
    const identity = (key && byName.get(key)) || makeIdentity();
    addValue(identity.names, submission.fullName);
    addValue(identity.emails, submission.email);
    addValue(identity.phones, submission.phone);
    if (key) byName.set(key, identity);
  }

  return [...new Set([...byUser.values(), ...byProfile.values(), ...byName.values()])];
}

function shouldIgnoreMessage(message: ForwardableMessage): boolean {
  const blockedSenders = new Set([...FORWARD_TO, "info@cbpublishing.live"]);
  return blockedSenders.has(message.sender.trim().toLocaleLowerCase());
}

export async function getMicrosoftEmailForwardingStatus() {
  const snapshot = await getFirestore().collection(STATE_COLLECTION).doc(STATE_ID).get();
  const data = snapshot.data() || {};
  return {
    enabled: data.enabled !== false,
    recipients: [...FORWARD_TO],
    lastScanAt: typeof data.lastScanAt === "string" ? data.lastScanAt : null,
    lastScanCounts: data.lastScanCounts || null,
    baselineEstablishedAt: typeof data.baselineEstablishedAt === "string" ? data.baselineEstablishedAt : null,
  };
}

export async function setMicrosoftEmailForwardingEnabled(enabled: boolean) {
  await getFirestore().collection(STATE_COLLECTION).doc(STATE_ID).set({
    enabled,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return getMicrosoftEmailForwardingStatus();
}

function messageKey(messageId: string): string {
  return createHash("sha256").update(messageId).digest("hex");
}

async function acquireScanLease(): Promise<string | null> {
  const db = getFirestore();
  const stateRef = db.collection(STATE_COLLECTION).doc(STATE_ID);
  const token = randomUUID();
  const nowMs = Date.now();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(stateRef);
    const leaseUntil = Number(snapshot.data()?.scanLeaseUntilMs || 0);
    if (leaseUntil > nowMs) return null;
    transaction.set(stateRef, {
      scanLeaseToken: token,
      scanLeaseUntilMs: nowMs + SCAN_LEASE_MS,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return token;
  });
}

async function releaseScanLease(token: string): Promise<void> {
  const stateRef = getFirestore().collection(STATE_COLLECTION).doc(STATE_ID);
  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(stateRef);
    if (snapshot.data()?.scanLeaseToken !== token) return;
    transaction.set(stateRef, {
      scanLeaseToken: null,
      scanLeaseUntilMs: 0,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
}

async function processNewMessage(
  messageId: string,
  identities: UserIdentity[],
): Promise<"forwarded" | "ignored" | "skipped" | "failed"> {
  const db = getFirestore();
  const messageRef = db.collection(STATE_COLLECTION).doc(`${STATE_ID}_${messageKey(messageId)}`);
  const existing = await messageRef.get();
  const existingData = existing.data() || {};
  if (existingData.status === "forwarded" || existingData.status === "ignored" || existingData.status === "processing") {
    return "skipped";
  }
  if (existingData.status === "failed") {
    if (!existingData.retryable || Number(existingData.attempts || 0) >= 3) return "skipped";
    if (Number(existingData.nextAttemptAtMs || 0) > Date.now()) return "skipped";
  }

  const detail = await getMicrosoftInboxMessage(messageId);
  const message: ForwardableMessage = {
    id: detail.id,
    subject: detail.subject,
    body: detail.body,
    sender: detail.from.emailAddress,
    senderName: detail.from.name,
  };

  if (shouldIgnoreMessage(message) || !findMatchingUserIdentity(message, identities)) {
    await messageRef.set({
      status: "ignored",
      createdAt: new Date().toISOString(),
    }, { merge: true });
    return "ignored";
  }

  const attempts = Number(existingData.attempts || 0) + 1;
  await messageRef.set({
    status: "processing",
    messageId,
    attempts,
    createdAt: new Date().toISOString(),
    nextAttemptAtMs: null,
    retryable: false,
  }, { merge: true });
  try {
    await forwardMicrosoftInboxMessage(messageId, [...FORWARD_TO]);
    await messageRef.set({
      status: "forwarded",
      forwardedTo: [...FORWARD_TO],
      forwardedAt: new Date().toISOString(),
    }, { merge: true });
    return "forwarded";
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 0;
    const retryable = status === 429 || status >= 500;
    const retryDelay = attempts === 1 ? 60_000 : 5 * 60_000;
    await messageRef.set({
      status: "failed",
      failedAt: new Date().toISOString(),
      retryable,
      nextAttemptAtMs: retryable && attempts < 3 ? Date.now() + retryDelay : null,
      failure: error instanceof Error ? error.message.slice(0, 200) : "Forward failed",
    }, { merge: true });
    return "failed";
  }
}

async function retryFailedMessages(identities: UserIdentity[]): Promise<number> {
  const snapshot = await getFirestore()
    .collection(STATE_COLLECTION)
    .where("status", "==", "failed")
    .limit(25)
    .get();
  let forwarded = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    if (!data.retryable || Number(data.attempts || 0) >= 3 || !data.messageId) continue;
    if (Number(data.nextAttemptAtMs || 0) > Date.now()) continue;
    const result = await processNewMessage(String(data.messageId), identities);
    if (result === "forwarded") forwarded += 1;
  }
  return forwarded;
}

export async function runMicrosoftEmailForwardingScan(): Promise<{
  baseline: boolean;
  forwarded: number;
  ignored: number;
  failed: number;
}> {
  const lease = await acquireScanLease();
  if (!lease) return { baseline: false, forwarded: 0, ignored: 0, failed: 0 };
  const stateRef = getFirestore().collection(STATE_COLLECTION).doc(STATE_ID);
  try {
    const state = await stateRef.get();
    const stateData = state.data() || {};
    if (stateData.enabled === false) return { baseline: false, forwarded: 0, ignored: 0, failed: 0 };
    const oldDeltaLink = stateData.deltaLink as string | undefined;
    const delta = await readMicrosoftInboxDelta(oldDeltaLink);
    if (!delta.deltaLink) throw new Error("Microsoft did not return an inbox delta cursor.");

    if (!oldDeltaLink) {
      await stateRef.set({
        deltaLink: delta.deltaLink,
        baselineEstablishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      console.info("[MicrosoftEmailForwarding] Inbox baseline established; existing messages were not forwarded.");
      return { baseline: true, forwarded: 0, ignored: 0, failed: 0 };
    }

    const identities = await loadUserIdentities();
    let forwarded = 0;
    let ignored = 0;
    let failed = 0;
    forwarded += await retryFailedMessages(identities);
    for (const message of delta.messages) {
      const status = await processNewMessage(message.id!, identities);
      if (status === "forwarded") forwarded += 1;
      else if (status === "ignored") ignored += 1;
      else if (status === "failed") failed += 1;
    }

    await stateRef.set({
      deltaLink: delta.deltaLink,
      lastScanAt: new Date().toISOString(),
      lastScanCounts: { forwarded, ignored, failed },
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    if (forwarded || failed) {
      console.info(`[MicrosoftEmailForwarding] Scan finished: ${forwarded} forwarded, ${ignored} ignored, ${failed} failed.`);
    }
    return { baseline: false, forwarded, ignored, failed };
  } finally {
    await releaseScanLease(lease).catch(() => undefined);
  }
}

export function startMicrosoftEmailForwardingJob(): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[MicrosoftEmailForwarding] Automatic forwarding is disabled outside production.");
    return;
  }

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runMicrosoftEmailForwardingScan();
    } catch (error) {
      console.error(
        "[MicrosoftEmailForwarding] Inbox scan failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), POLL_INTERVAL_MS);
  timer.unref();
}
