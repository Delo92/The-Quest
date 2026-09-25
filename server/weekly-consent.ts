import admin from "firebase-admin";
import { getFirestore } from "./firebase-admin";
import {
  MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT,
  MARKETING_GUIDELINES_ACKNOWLEDGMENT_VERSION,
  WEEKLY_CONSENT_TIME_ZONE,
  type WeeklyConsentRole,
  type WeeklyConsentStatus,
} from "../shared/weekly-consent";

const WEEKLY_CONSENTS_COLLECTION = "questWeeklyConsents";
const DAY_MS = 24 * 60 * 60 * 1000;

export function getWeeklyConsentWeekStart(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WEEKLY_CONSENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const getPart = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  const year = Number(getPart("year"));
  const month = Number(getPart("month"));
  const day = Number(getPart("day"));
  if (![year, month, day].every(Number.isFinite)) {
    throw new Error("Could not determine the current consent week");
  }

  const localDateAsUtc = Date.UTC(year, month - 1, day);
  const dayOfWeek = new Date(localDateAsUtc).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return new Date(localDateAsUtc - daysSinceMonday * DAY_MS).toISOString().slice(0, 10);
}

function getConsentDocumentId(uid: string, weekStart: string): string {
  return `${uid}_${weekStart}_${MARKETING_GUIDELINES_ACKNOWLEDGMENT_VERSION}`;
}

function parseAcceptedAt(value: unknown): string | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  return null;
}

export async function getWeeklyConsentStatus(
  uid: string,
  role: WeeklyConsentRole,
): Promise<WeeklyConsentStatus> {
  const weekStart = getWeeklyConsentWeekStart();
  const snapshot = await getFirestore()
    .collection(WEEKLY_CONSENTS_COLLECTION)
    .doc(getConsentDocumentId(uid, weekStart))
    .get();
  const record = snapshot.data();
  const acceptedAt = parseAcceptedAt(record?.acceptedAt);
  const accepted = Boolean(
    record
    && record.uid === uid
    && record.role === role
    && record.weekStart === weekStart
    && record.consentVersion === MARKETING_GUIDELINES_ACKNOWLEDGMENT_VERSION
    && acceptedAt,
  );

  return {
    required: true,
    accepted,
    weekStart,
    version: MARKETING_GUIDELINES_ACKNOWLEDGMENT_VERSION,
    role,
    acceptedAt: accepted ? acceptedAt : null,
  };
}

export async function recordWeeklyConsent(
  uid: string,
  role: WeeklyConsentRole,
): Promise<WeeklyConsentStatus> {
  const weekStart = getWeeklyConsentWeekStart();
  const firestore = getFirestore();
  const consentRef = firestore
    .collection(WEEKLY_CONSENTS_COLLECTION)
    .doc(getConsentDocumentId(uid, weekStart));

  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(consentRef);
    const existingRecord = existing.data();
    if (
      existingRecord
      && existingRecord.uid === uid
      && existingRecord.role === role
      && existingRecord.weekStart === weekStart
      && existingRecord.consentVersion === MARKETING_GUIDELINES_ACKNOWLEDGMENT_VERSION
      && parseAcceptedAt(existingRecord.acceptedAt)
    ) {
      return;
    }

    const acceptedAt = admin.firestore.Timestamp.now();
    transaction.set(consentRef, {
      uid,
      role,
      scope: "weekly_marketing_guidelines",
      weekStart,
      weekTimeZone: WEEKLY_CONSENT_TIME_ZONE,
      consentVersion: MARKETING_GUIDELINES_ACKNOWLEDGMENT_VERSION,
      policyText: MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT,
      acceptedAt,
      createdAt: acceptedAt,
    });
  });

  return getWeeklyConsentStatus(uid, role);
}