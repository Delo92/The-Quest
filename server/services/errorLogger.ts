import crypto from "node:crypto";
import { getFirestore } from "../firebase-admin";
import type { CollectionReference, DocumentData, Query } from "firebase-admin/firestore";

export type ErrorType =
  | "registration"
  | "payment"
  | "waiting_room"
  | "approval"
  | "queue"
  | "api"
  | "client"
  | "email"
  | "sms"
  | "pdf"
  | "security_alert"
  | "workflow"
  | "system"
  | "video_consultation"
  | "database"
  | "authentication"
  | "validation"
  | "form_upload"
  | "admin_operation_error"
  | "workflow_error"
  | "commission_error"
  | "email_error"
  | "sms_error"
  | "package_not_found"
  | "manual_action"
  | "media_permission"
  | "uncategorized";

export type ErrorSeverity = "critical" | "error" | "warning" | "info";

export interface ErrorLogData {
  errorType: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stackTrace?: string;
  userLevel?: 1 | 2 | 3 | 4 | null;
  userUid?: string;
  userName?: string;
  userEmail?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
  wasShownToUser?: boolean;
  idempotencyKey?: string;
}

export interface StoredErrorLog extends ErrorLogData {
  id: string;
  timestamp: Date;
  createdAt: Date;
}

const recentErrors = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 30_000;
const MAX_RECENT_ERRORS = 1_000;
const REDACTED = "[REDACTED]";
const REDACTED_KEYS = ["password", "token", "secret", "authorization", "privatekey", "credential"];

function getErrorKey(errorData: ErrorLogData): string {
  const context = errorData.context || {};
  const identity =
    errorData.userUid ||
    String(context.userUid || context.talentUid || context.hostUid || context.viewerUid || "");
  return [
    errorData.errorType,
    errorData.message,
    identity || "anonymous",
    String(context.competitionId || ""),
  ].join("::");
}

function isDuplicate(errorData: ErrorLogData): boolean {
  const key = getErrorKey(errorData);
  const now = Date.now();
  const lastTime = recentErrors.get(key);

  if (lastTime && now - lastTime < DUPLICATE_WINDOW_MS) return true;

  recentErrors.set(key, now);
  if (recentErrors.size > MAX_RECENT_ERRORS) {
    const oldestKey = recentErrors.keys().next().value;
    if (oldestKey) recentErrors.delete(oldestKey);
  }
  return false;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
  return REDACTED_KEYS.some((sensitive) => normalized.includes(sensitive));
}

function sanitizeValue(value: unknown, key = "", depth = 0): unknown {
  if (isSensitiveKey(key)) return REDACTED;
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (depth > 2) {
    try {
      return JSON.stringify(value).slice(0, 500);
    } catch {
      return "[UNSERIALIZABLE]";
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = sanitizeValue(childValue, childKey, depth + 1);
      if (cleaned !== undefined) sanitized[childKey] = cleaned;
    }
    return sanitized;
  }
  return String(value);
}

function sanitizeContext(context: Record<string, unknown> | undefined): Record<string, unknown> {
  const cleaned = sanitizeValue(context || {}, "context");
  return (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned))
    ? cleaned as Record<string, unknown>
    : {};
}

function inferUserLevel(errorData: ErrorLogData): 1 | 2 | 3 | 4 | null {
  if (errorData.userLevel !== undefined) return errorData.userLevel;

  const context = errorData.context || {};
  const role = String(context.role || context.profileRole || context.userRole || "").toLowerCase();
  if (role.includes("admin")) return 4;
  if (role.includes("host")) return 3;
  if (role.includes("talent") || role.includes("contestant")) return 2;
  if (role.includes("viewer")) return 1;

  if (context.adminUid || context.adminUserId) return 4;
  if (context.hostUid || context.hostUserId) return 3;
  if (context.talentUid || context.talentUserId) return 2;
  if (context.viewerUid || context.viewerUserId) return 1;

  const message = `${errorData.errorType} ${errorData.message}`.toLowerCase();
  if (message.includes("admin")) return 4;
  if (message.includes("host")) return 3;
  if (message.includes("talent") || message.includes("contestant")) return 2;
  if (message.includes("viewer")) return 1;
  return null;
}

function getIdempotentDocumentId(idempotencyKey: string): string {
  return `idempotent-${crypto.createHash("sha256").update(idempotencyKey).digest("hex")}`;
}

function applyCommonFilters(
  query: Query<DocumentData> | CollectionReference<DocumentData>,
  options: {
    startDate?: Date;
    endDate?: Date;
    severity?: ErrorSeverity;
    errorType?: ErrorType;
    userLevel?: number;
  },
) {
  let filtered = query;
  if (options.severity) filtered = filtered.where("severity", "==", options.severity);
  if (options.errorType) filtered = filtered.where("errorType", "==", options.errorType);
  if (options.userLevel !== undefined) filtered = filtered.where("userLevel", "==", options.userLevel);
  if (options.startDate) filtered = filtered.where("timestamp", ">=", options.startDate);
  if (options.endDate) filtered = filtered.where("timestamp", "<=", options.endDate);
  return filtered;
}

function toStoredErrorLog(doc: FirebaseFirestore.QueryDocumentSnapshot<DocumentData>): StoredErrorLog {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
  } as StoredErrorLog;
}

async function getLogsWithFallback(
  query: Query<DocumentData> | CollectionReference<DocumentData>,
  limit: number,
): Promise<FirebaseFirestore.QuerySnapshot<DocumentData>> {
  try {
    return await query.orderBy("timestamp", "desc").limit(limit).get();
  } catch (error) {
    console.warn("Error log ordered query failed; falling back to unordered read:", (error as Error).message);
    return await query.limit(Math.max(limit, 250)).get();
  }
}

export async function logError(errorData: ErrorLogData): Promise<void> {
  try {
    const context = sanitizeContext(errorData.context);
    const normalized: ErrorLogData = {
      ...errorData,
      userLevel: inferUserLevel({ ...errorData, context }),
      context,
    };

    if (normalized.idempotencyKey) {
      const db = getFirestore();
      const idempotentRef = db.collection("errorLogs").doc(getIdempotentDocumentId(normalized.idempotencyKey));
      if ((await idempotentRef.get()).exists) return;
      const now = new Date();
      const { idempotencyKey: _idempotencyKey, ...storedData } = normalized;
      await idempotentRef.create({
        ...sanitizeContext(storedData),
        timestamp: now,
        createdAt: now,
        wasShownToUser: normalized.wasShownToUser ?? false,
      });
      return;
    }

    if (isDuplicate(normalized)) return;

    const db = getFirestore();
    const now = new Date();
    const { idempotencyKey: _idempotencyKey, ...storedData } = normalized;
    await db.collection("errorLogs").add({
      ...sanitizeContext(storedData),
      timestamp: now,
      createdAt: now,
      wasShownToUser: normalized.wasShownToUser ?? false,
    });

    if (normalized.severity === "critical") {
      console.error("CRITICAL ERROR LOGGED:", {
        type: normalized.errorType,
        message: normalized.message,
      });
    }
  } catch (error) {
    console.error("ERROR LOGGER: Failed to log error:", error);
  }
}

export async function getErrorLogs(options: {
  startDate?: Date;
  endDate?: Date;
  severity?: ErrorSeverity;
  errorType?: ErrorType;
  userLevel?: number;
  userUid?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: StoredErrorLog[]; total: number }> {
  try {
    const db = getFirestore();
    const limit = Math.min(Math.max(options.limit || 50, 1), 250);
    const offset = Math.max(options.offset || 0, 0);
    const base = () => applyCommonFilters(db.collection("errorLogs"), options);

    if (options.userUid) {
      const identityFields = [
        "userUid",
        "context.userUid",
        "context.talentUid",
        "context.hostUid",
        "context.viewerUid",
      ];
      const snapshots = await Promise.all(
        identityFields.map((field) => getLogsWithFallback(base().where(field, "==", options.userUid), limit + offset)),
      );
      const unique = new Map<string, StoredErrorLog>();
      snapshots.flatMap((snapshot) => snapshot.docs).forEach((doc) => unique.set(doc.id, toStoredErrorLog(doc)));
      const logs = Array.from(unique.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(offset, offset + limit);
      return { logs, total: unique.size };
    }

    const countQuery = base();
    let count = 0;
    try {
      count = (await countQuery.count().get()).data().count;
    } catch {
      count = (await countQuery.limit(1000).get()).size;
    }

    const snapshot = await getLogsWithFallback(base(), limit + offset);
    const logs = snapshot.docs
      .map(toStoredErrorLog)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
    return { logs, total: count };
  } catch (error) {
    console.error("ERROR LOGGER: Failed to fetch error logs:", error);
    return { logs: [], total: 0 };
  }
}

export function createErrorContext(data: Record<string, unknown>): Record<string, unknown> {
  return sanitizeContext(data);
}