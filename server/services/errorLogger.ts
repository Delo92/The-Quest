import { getFirestore } from '../firebase-admin';
import type { Query, CollectionReference, DocumentData } from 'firebase-admin/firestore';

export type ErrorType =
  | 'registration' | 'payment' | 'approval' | 'queue'
  | 'api' | 'client' | 'email' | 'sms' | 'pdf'
  | 'security_alert' | 'workflow' | 'system' | 'database'
  | 'authentication' | 'validation' | 'form_upload'
  | 'admin_operation_error' | 'workflow_error' | 'email_error'
  | 'sms_error' | 'package_not_found' | 'manual_action'
  | 'uncategorized';

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

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
  context?: Record<string, any>;
  wasShownToUser?: boolean;
}

interface StoredErrorLog extends ErrorLogData {
  id: string;
  timestamp: Date;
  createdAt: Date;
}

const recentErrors = new Map<string, number>();

function getErrorKey(errorData: ErrorLogData): string {
  return [errorData.errorType, errorData.message, errorData.userUid || 'anonymous'].join('::');
}

function isDuplicate(errorData: ErrorLogData): boolean {
  const key = getErrorKey(errorData);
  const lastTime = recentErrors.get(key);
  const now = Date.now();
  if (lastTime && now - lastTime < 30000) return true;
  recentErrors.set(key, now);
  if (recentErrors.size > 1000) {
    const oldestKey = recentErrors.keys().next().value;
    if (oldestKey) recentErrors.delete(oldestKey);
  }
  return false;
}

function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanObject);
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' ? cleanObject(value) : value;
    }
  }
  return cleaned;
}

export async function logError(errorData: ErrorLogData): Promise<void> {
  try {
    if (isDuplicate(errorData)) return;
    const db = getFirestore();
    if (!db) return;
    const now = new Date();
    const logEntry = {
      ...cleanObject(errorData),
      timestamp: now,
      createdAt: now,
      wasShownToUser: errorData.wasShownToUser ?? false,
      context: cleanObject(errorData.context ?? {}),
    };
    await db.collection('errorLogs').add(logEntry);
    if (errorData.severity === 'critical') {
      console.error('CRITICAL ERROR LOGGED:', { type: errorData.errorType, message: errorData.message });
    }
  } catch (err) {
    console.error('ERROR LOGGER: Failed to log error:', err);
  }
}

export async function getErrorLogs(options: {
  startDate?: Date; endDate?: Date; severity?: ErrorSeverity;
  errorType?: ErrorType; userLevel?: number; userUid?: string;
  limit?: number; offset?: number;
}): Promise<{ logs: StoredErrorLog[]; total: number }> {
  try {
    const db = getFirestore();
    if (!db) return { logs: [], total: 0 };
    const queryLimit = options.limit || 50;
    const offset = options.offset || 0;

    let dataQuery: Query<DocumentData> | CollectionReference<DocumentData> =
      db.collection('errorLogs').orderBy('timestamp', 'desc');
    let countQuery: Query<DocumentData> | CollectionReference<DocumentData> =
      db.collection('errorLogs');

    if (options.severity) {
      dataQuery = dataQuery.where('severity', '==', options.severity);
      countQuery = countQuery.where('severity', '==', options.severity);
    }
    if (options.errorType) {
      dataQuery = dataQuery.where('errorType', '==', options.errorType);
      countQuery = countQuery.where('errorType', '==', options.errorType);
    }
    if (options.startDate) {
      dataQuery = dataQuery.where('timestamp', '>=', options.startDate);
      countQuery = countQuery.where('timestamp', '>=', options.startDate);
    }
    if (options.endDate) {
      dataQuery = dataQuery.where('timestamp', '<=', options.endDate);
      countQuery = countQuery.where('timestamp', '<=', options.endDate);
    }

    if (offset > 0) {
      const offsetSnap = await dataQuery.limit(offset).get();
      if (!offsetSnap.empty) {
        dataQuery = dataQuery.startAfter(offsetSnap.docs[offsetSnap.docs.length - 1]);
      }
    }

    const [countSnap, dataSnap] = await Promise.all([
      countQuery.count().get(),
      dataQuery.limit(queryLimit).get(),
    ]);

    const logs: StoredErrorLog[] = dataSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
    } as StoredErrorLog));

    return { logs, total: countSnap.data().count };
  } catch (err) {
    console.error('ERROR LOGGER: Failed to fetch error logs:', err);
    return { logs: [], total: 0 };
  }
}

export function createErrorContext(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (['password', 'token', 'secret'].some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = JSON.stringify(value).substring(0, 500);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
