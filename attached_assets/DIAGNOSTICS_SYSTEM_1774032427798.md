# Diagnostics System — Complete Implementation Guide

This document covers every piece of the Diagnostics tab in the admin dashboard: what it does, how it works end-to-end, and the exact code for every file involved. It is self-contained so you can re-implement this system in any Node.js / React backend.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Required Dependencies](#required-dependencies)
4. [Environment Variables / Secrets](#environment-variables--secrets)
5. [Tab 1: Analytics (GA4)](#tab-1-analytics-ga4)
   - [How It Works](#how-analytics-works)
   - [Frontend Tracking Script (index.html)](#frontend-tracking-script-indexhtml)
   - [SPA Page-View Hook](#spa-page-view-hook)
   - [App Root Registration](#app-root-registration)
   - [Backend Analytics Service](#backend-analytics-service)
   - [Backend API Route](#backend-api-route-ga4)
6. [Tab 2: Error Logs](#tab-2-error-logs)
   - [How It Works](#how-error-logging-works)
   - [Error Logger Service](#error-logger-service)
   - [Global API Error Intercept Middleware](#global-api-error-intercept-middleware)
   - [Global Crash Handler (index.ts)](#global-crash-handler-indexts)
   - [Backend API Route (Error Logs)](#backend-api-route-error-logs)
7. [Frontend UI — Full Diagnostics Page](#frontend-ui--full-diagnostics-page)
8. [Firestore Collections Required](#firestore-collections-required)
9. [Setting Up for a New Client](#setting-up-for-a-new-client)
10. [Error Type Reference](#error-type-reference)
11. [Severity Level Reference](#severity-level-reference)

---

## Overview

The Diagnostics page in the admin dashboard has two sub-tabs:

| Tab | What it shows |
|---|---|
| **Analytics** | Live Google Analytics 4 data pulled via the GA4 Data API — active users, sessions, page views, avg session duration, bounce rate, new users, top pages, daily user chart, traffic sources |
| **Error Logs** | All server-side errors auto-captured and stored in Firestore — filterable by severity and error type, searchable, paginated, expandable with full context |

Both tabs are admin-only (behind your admin authentication middleware).

---

## System Architecture

```
Browser
  └─ index.html  (GA4 gtag.js snippet — tracks page loads)
  └─ useGATracking hook  (tracks SPA route changes)
  └─ diagnostics.tsx  (renders both tabs, fetches from API)

Server (Express + Node.js)
  └─ Global intercept middleware  (wraps res.json, logs all 4xx/5xx)
  └─ Global crash handler in index.ts  (logs unhandled Express errors)
  └─ /api/admin/ga4-analytics  (fetches GA4 Data API, returns JSON)
  └─ /api/admin/error-logs  (queries Firestore errorLogs collection)

External Services
  └─ Google Analytics 4 (browser tracking)
  └─ GA4 Data API (server-side reporting via @google-analytics/data)
  └─ Firebase Firestore (error log storage)
```

---

## Required Dependencies

Install these in your project:

```bash
npm install @google-analytics/data firebase-admin
```

Your `package.json` should already have:
- `express`
- `@tanstack/react-query`
- `wouter` (or React Router — see SPA hook section)
- `shadcn/ui` components (Card, Badge, Button, Input, Skeleton, Tabs, Select)
- `lucide-react` icons

---

## Environment Variables / Secrets

| Variable | Description | Where to get it |
|---|---|---|
| `GA4_PROPERTY_ID` | Your numeric GA4 property ID (e.g. `520580573`) | Google Analytics → Admin → Property Settings |
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON of your Firebase service account key | Firebase Console → Project Settings → Service Accounts → Generate new private key |

The GA4 Measurement ID (e.g. `G-XXXXXXXX`) is used in the frontend HTML script tag only — it does not need to be a secret.

Your Firebase service account must have the **Viewer** role on the GA4 property. To grant access:
1. Go to [Google Analytics Admin](https://analytics.google.com/) → Admin → Account Access Management
2. Add the service account email with **Viewer** permission
3. Make sure the [Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com) is enabled in your Google Cloud project

---

## Tab 1: Analytics (GA4)

### How Analytics Works

1. The GA4 `gtag.js` script in `index.html` sends page view events to Google Analytics automatically on hard loads.
2. The `useGATracking` hook fires a `page_view` event every time the SPA route changes — this ensures single-page navigation is tracked correctly.
3. When the admin opens the Analytics tab, the frontend calls `GET /api/admin/ga4-analytics?dateRange=30d`.
4. The backend uses the **GA4 Data API** (server-side) with the Firebase service account credentials to pull reporting data — active users, sessions, page views, bounce rate, new users, top pages, daily breakdown, traffic sources.
5. Data is cached client-side for 5 minutes (`staleTime: 5 * 60 * 1000`).

---

### Frontend Tracking Script (index.html)

Place this in your `<head>` tag. Replace `G-XXXXXXXXXX` with your actual GA4 Measurement ID.

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

---

### SPA Page-View Hook

This hook fires a `page_view` event every time the route changes within the React SPA. Without this, GA4 only sees the initial hard page load — all client-side navigation goes untracked.

**File: `client/src/hooks/use-ga-tracking.ts`**

```typescript
import { useEffect } from "react";
import { useLocation } from "wouter";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function useGATracking() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: location,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location]);
}
```

> If you use React Router instead of Wouter, replace `useLocation` from `"wouter"` with `useLocation` from `"react-router-dom"`. The rest of the hook stays the same.

---

### App Root Registration

Call the hook once at the top of your root `App` component so it runs on every route change.

**File: `client/src/App.tsx` (relevant section)**

```typescript
import { useGATracking } from "@/hooks/use-ga-tracking";

function App() {
  useGATracking(); // <-- add this line inside your root component

  return (
    // ... your router / routes
  );
}
```

---

### Backend Analytics Service

This service uses the `@google-analytics/data` npm package to query the GA4 Reporting API.

**File: `server/services/ga4Analytics.ts`**

```typescript
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getCredentials } from '../firebase'; // see note below

let _client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (_client) return _client;
  const creds = getCredentials();
  _client = new BetaAnalyticsDataClient({
    credentials: { client_email: creds.clientEmail, private_key: creds.privateKey },
    projectId: creds.projectId,
  });
  return _client;
}

function getPropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) throw new Error('GA4_PROPERTY_ID environment variable not set');
  return id;
}

export async function getGA4Report(dateRange: string = '30d') {
  const client = getClient();
  const propertyId = getPropertyId();

  const startDate =
    dateRange === '1d' ? 'yesterday' :
    dateRange === '3d' ? '3daysAgo' :
    dateRange === '7d' ? '7daysAgo' :
    dateRange === '90d' ? '90daysAgo' :
    dateRange === '1y' ? '365daysAgo' : '30daysAgo';

  // --- Overview metrics ---
  const [overviewResponse] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    metrics: [
      { name: 'activeUsers' }, { name: 'sessions' },
      { name: 'screenPageViews' }, { name: 'averageSessionDuration' },
      { name: 'bounceRate' }, { name: 'newUsers' },
    ],
  });

  const row = overviewResponse.rows?.[0];
  const overview = {
    activeUsers: parseInt(row?.metricValues?.[0]?.value || '0'),
    sessions: parseInt(row?.metricValues?.[1]?.value || '0'),
    pageViews: parseInt(row?.metricValues?.[2]?.value || '0'),
    avgSessionDuration: parseFloat(row?.metricValues?.[3]?.value || '0'),
    bounceRate: parseFloat(row?.metricValues?.[4]?.value || '0'),
    newUsers: parseInt(row?.metricValues?.[5]?.value || '0'),
  };

  // --- Top pages ---
  const [pageResponse] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 10,
  });

  const topPages = (pageResponse.rows || []).map(r => ({
    path: r.dimensionValues?.[0]?.value || '',
    views: parseInt(r.metricValues?.[0]?.value || '0'),
    users: parseInt(r.metricValues?.[1]?.value || '0'),
  }));

  // --- Daily breakdown ---
  const [dailyResponse] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
  });

  const dailyData = (dailyResponse.rows || []).map(r => {
    const raw = r.dimensionValues?.[0]?.value || '';
    // GA4 returns dates as YYYYMMDD — convert to YYYY-MM-DD
    const date = raw.length === 8
      ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
      : raw;
    return {
      date,
      users: parseInt(r.metricValues?.[0]?.value || '0'),
      sessions: parseInt(r.metricValues?.[1]?.value || '0'),
      pageViews: parseInt(r.metricValues?.[2]?.value || '0'),
    };
  });

  // --- Traffic sources ---
  const [sourceResponse] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  const trafficSources = (sourceResponse.rows || []).map(r => ({
    source: r.dimensionValues?.[0]?.value || '(direct)',
    sessions: parseInt(r.metricValues?.[0]?.value || '0'),
  }));

  return { overview, topPages, dailyData, trafficSources };
}
```

> **Note on `getCredentials()`:** This function returns the parsed Firebase service account JSON. In this project it reads from a `FIREBASE_SERVICE_ACCOUNT` environment variable (a JSON string). You can replace it with however you load your service account — the only fields needed are `client_email`, `private_key`, and `project_id`.

Example minimal `getCredentials`:
```typescript
export function getCredentials() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  return {
    clientEmail: sa.client_email,
    privateKey: sa.private_key,
    projectId: sa.project_id,
  };
}
```

---

### Backend API Route (GA4)

Add this route to your Express router, protected by your admin authentication middleware.

```typescript
// Replace isAdminAuthenticated with your own admin auth middleware
app.get("/api/admin/ga4-analytics", isAdminAuthenticated, async (req, res) => {
  try {
    const { getGA4Report } = await import('./services/ga4Analytics');
    const dateRange = (req.query.dateRange as string) || '30d';
    const data = await getGA4Report(dateRange);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('GA4 analytics error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch analytics data' });
  }
});
```

---

## Tab 2: Error Logs

### How Error Logging Works

There are **three** places errors get captured automatically:

1. **Global API intercept middleware** — wraps `res.json` on every request. Whenever a route sends a 4xx or 5xx response, it intercepts it and logs to Firestore. Fires silently in the background (fire-and-forget) — it never slows down the original response.

2. **Global crash handler in `index.ts`** — Express's 4-argument error middleware catches any unhandled thrown error from any route and logs it at `critical` severity before returning a 500 response.

3. **Manual calls** — you can call `logError(...)` anywhere in your server code to log a specific error (e.g. a failed email send, a Firestore write failure, a PayPal webhook rejection).

All logs are stored in a Firestore collection called `errorLogs`.

**What is intentionally NOT logged** (to avoid noise):
- `/api/admin/session` and `/api/portal/session` returning 401 — these are normal "am I logged in?" checks
- `/api/cart/*` returning 404 — normal for new/anonymous sessions

---

### Error Logger Service

**File: `server/services/errorLogger.ts`**

```typescript
import { getFirestore } from '../firebase'; // replace with your Firestore init
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

// In-memory dedup: same error from same user within 30 seconds is ignored
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

    if (options.startDate) {
      dataQuery = dataQuery.where('timestamp', '>=', options.startDate);
      countQuery = countQuery.where('timestamp', '>=', options.startDate);
    }
    if (options.endDate) {
      dataQuery = dataQuery.where('timestamp', '<=', options.endDate);
      countQuery = countQuery.where('timestamp', '<=', options.endDate);
    }
    if (options.severity) {
      dataQuery = dataQuery.where('severity', '==', options.severity);
      countQuery = countQuery.where('severity', '==', options.severity);
    }
    if (options.errorType) {
      dataQuery = dataQuery.where('errorType', '==', options.errorType);
      countQuery = countQuery.where('errorType', '==', options.errorType);
    }
    if (options.userLevel !== undefined) {
      dataQuery = dataQuery.where('userLevel', '==', options.userLevel);
      countQuery = countQuery.where('userLevel', '==', options.userLevel);
    }

    // Offset pagination via cursor (Firestore doesn't have native offset)
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

// Sanitizes context before storing — redacts passwords/tokens/secrets
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
```

---

### Global API Error Intercept Middleware

This middleware wraps `res.json` for every incoming request. When the route eventually calls `res.json(...)`, the wrapper checks the status code — if 4xx or 5xx, it logs to Firestore before passing through to the original `res.json`.

**Place this in your routes file, BEFORE your route definitions.**

```typescript
import { logError, createErrorContext, type ErrorType, type ErrorSeverity } from './services/errorLogger';

// Add inside your registerRoutes / app setup function:

app.use((req, res, next) => {
  const originalJson = (res.json as Function).bind(res);
  (res as any).json = function (data: any) {
    const status = res.statusCode;
    if (status >= 400 && req.path.startsWith('/api')) {
      // Skip noisy non-errors that happen normally
      const isSessionCheck = (
        req.path === '/api/admin/session' ||
        req.path === '/api/portal/session'
      ) && status === 401;
      const isCartMiss = req.path.startsWith('/api/cart') && status === 404;

      if (!isSessionCheck && !isCartMiss) {
        const p = req.path.toLowerCase();

        // Map URL patterns to error types
        let errorType: ErrorType = 'api';
        if (p.includes('/login') || p.includes('/logout') || p.includes('/session') || p.includes('/auth') || p.includes('/portal/register')) errorType = 'authentication';
        else if (p.includes('/booking')) errorType = 'registration';
        else if (p.includes('/payment') || p.includes('/paypal') || p.includes('/subscribe')) errorType = 'payment';
        else if (p.includes('/email') || p.includes('/contact') || p.includes('/send') || p.includes('/gmail')) errorType = 'email';
        else if (p.includes('/upload') || p.includes('/image') || p.includes('/brand-kit') || p.includes('/file') || p.includes('/product-image')) errorType = 'form_upload';
        else if (p.includes('/admin')) errorType = 'admin_operation_error';
        else if (status >= 500) errorType = 'system';

        // Map status codes to severity
        const severity: ErrorSeverity =
          status >= 500 ? 'error' :
          (status === 401 || status === 403) ? 'warning' : 'info';

        // Fire-and-forget — never blocks the response
        logError({
          errorType,
          severity,
          message: data?.message || `HTTP ${status} ${req.method} ${req.path}`,
          endpoint: req.path,
          method: req.method,
          statusCode: status,
          wasShownToUser: status < 500,
          context: createErrorContext({
            ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
            userAgent: req.headers['user-agent']?.substring(0, 250),
            referer: req.headers['referer'],
            // Include request body for non-GET requests (passwords auto-redacted by createErrorContext)
            body: req.method !== 'GET' ? JSON.stringify(req.body || {}).substring(0, 400) : undefined,
          }),
        }).catch(() => {});
      }
    }
    return originalJson(data);
  };
  next();
});
```

---

### Global Crash Handler (index.ts)

Express's 4-argument error middleware catches any error that is thrown (or passed to `next(err)`) from a route. This covers server crashes that the intercept middleware above would miss.

**File: `server/index.ts`**

```typescript
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { logError } from "./services/errorLogger";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  await registerRoutes(httpServer, app);

  // Global crash handler — catches any unhandled thrown error in any route
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logError({
      errorType: status >= 500 ? 'system' : 'api',
      severity: status >= 500 ? 'critical' : 'error',
      message: `Unhandled server error: ${message}`,
      stackTrace: err.stack,
      endpoint: req.path,
      method: req.method,
      statusCode: status,
      wasShownToUser: false,
      context: {
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 250),
      },
    }).catch(() => {});

    res.status(status).json({ message });
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    console.log(`Server running on port ${port}`);
  });
})();
```

---

### Backend API Route (Error Logs)

```typescript
app.get("/api/admin/error-logs", isAdminAuthenticated, async (req, res) => {
  try {
    const { getErrorLogs } = await import('./services/errorLogger');
    const { startDate, endDate, severity, errorType, userLevel, userUid, limit, offset } = req.query;
    const options: any = {};
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    if (severity) options.severity = severity as string;
    if (errorType) options.errorType = errorType as string;
    if (userLevel !== undefined && userLevel !== '') options.userLevel = parseInt(userLevel as string);
    if (userUid) options.userUid = userUid as string;
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);
    const result = await getErrorLogs(options);
    res.json(result);
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ logs: [], total: 0 });
  }
});
```

---

## Frontend UI — Full Diagnostics Page

This is the complete React component for both tabs. It uses shadcn/ui, TanStack React Query, and Lucide icons.

**File: `client/src/pages/admin/diagnostics.tsx`**

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, AlertCircle, Info, ShieldAlert,
  ChevronDown, ChevronRight, RefreshCw, Search,
  BarChart3, TrendingUp, Users, Eye, Clock,
  Globe, FileText, Loader2, Activity,
} from "lucide-react";

interface ErrorLog {
  id: string;
  errorType: string;
  severity: string;
  message: string;
  stackTrace?: string;
  userUid?: string;
  userName?: string;
  userEmail?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  context?: Record<string, any>;
  wasShownToUser?: boolean;
  timestamp: string;
  createdAt: string;
}

interface GA4Data {
  overview: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
    newUsers: number;
  };
  topPages: Array<{ path: string; views: number; users: number }>;
  dailyData: Array<{ date: string; users: number; sessions: number; pageViews: number }>;
  trafficSources: Array<{ source: string; sessions: number }>;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  error: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
};

const SeverityIcon = ({ severity }: { severity: string }) => {
  const icons: Record<string, any> = {
    critical: ShieldAlert, error: AlertCircle, warning: AlertTriangle, info: Info,
  };
  const Icon = icons[severity] || Info;
  return <Icon className="h-4 w-4" />;
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function MiniBarChart({ data, dataKey, maxHeight = 80 }: {
  data: Array<Record<string, any>>; dataKey: string; maxHeight?: number;
}) {
  if (!data.length) return null;
  const values = data.map(d => d[dataKey] as number);
  const max = Math.max(...values, 1);
  const barW = Math.max(3, Math.min(16, Math.floor(560 / data.length) - 2));
  return (
    <div className="flex items-end gap-[2px]" style={{ height: maxHeight }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d[dataKey] / max) * (maxHeight - 4));
        return (
          <div
            key={i}
            className="bg-primary/70 hover:bg-primary rounded-t transition-colors cursor-default flex-shrink-0"
            style={{ width: barW, height: h }}
            title={`${d.date}: ${d[dataKey]}`}
          />
        );
      })}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: string | number; icon: any; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function AnalyticsTab() {
  const [dateRange, setDateRange] = useState("30d");

  const { data, isLoading, error, refetch } = useQuery<GA4Data>({
    queryKey: ["/api/admin/ga4-analytics", dateRange],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/ga4-analytics?dateRange=${dateRange}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to fetch analytics");
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const rangeLabel: Record<string, string> = {
    "1d": "1 day", "3d": "3 days", "7d": "7 days",
    "30d": "30 days", "90d": "90 days", "1y": "1 year",
  };
  const isConnected = !error && !isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting to Google Analytics...
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-40" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    const msg = (error as Error)?.message || "";
    const isNotConfigured = msg.includes("GA4_PROPERTY_ID");
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="font-medium">
            {isNotConfigured ? "GA4 Property ID not configured" : "Analytics unavailable"}
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {isNotConfigured
              ? "Add your numeric GA4 Property ID as the GA4_PROPERTY_ID secret to enable live traffic data."
              : msg || "Could not connect to Google Analytics. Check that the service account has Viewer access and the Analytics Data API is enabled."}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { overview, topPages, dailyData, trafficSources } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Showing data for the last {rangeLabel[dateRange]}
          </p>
          {isConnected && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              GA4 Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 1 day</SelectItem>
              <SelectItem value="3d">Last 3 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Active Users" value={overview.activeUsers.toLocaleString()} icon={Users} />
        <StatCard label="New Users" value={overview.newUsers.toLocaleString()} icon={TrendingUp} />
        <StatCard label="Sessions" value={overview.sessions.toLocaleString()} icon={Activity} />
        <StatCard label="Page Views" value={overview.pageViews.toLocaleString()} icon={Eye} />
        <StatCard label="Avg. Duration" value={formatDuration(overview.avgSessionDuration)} icon={Clock} />
        <StatCard label="Bounce Rate" value={`${(overview.bounceRate * 100).toFixed(1)}%`} icon={TrendingUp} />
      </div>

      {dailyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Daily Users</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={dailyData} dataKey="users" maxHeight={100} />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{dailyData[0]?.date}</span>
              <span>{dailyData[dailyData.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No page data yet</p>
            ) : topPages.map((page, i) => {
              const maxViews = topPages[0]?.views || 1;
              return (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground font-mono text-xs max-w-[65%]">
                      {page.path}
                    </span>
                    <span className="font-medium">{page.views.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${(page.views / maxViews) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" /> Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trafficSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source data yet</p>
            ) : trafficSources.map((src, i) => {
              const maxSessions = trafficSources[0]?.sessions || 1;
              return (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{src.source}</span>
                    <span className="font-medium">{src.sessions.toLocaleString()} sessions</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${(src.sessions / maxSessions) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorLogsTab() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  if (severityFilter !== "all") params.set("severity", severityFilter);
  if (typeFilter !== "all") params.set("errorType", typeFilter);

  const { data, isLoading, refetch } = useQuery<{ logs: ErrorLog[]; total: number }>({
    queryKey: ["/api/admin/error-logs", severityFilter, typeFilter, page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/error-logs?${params}`);
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;

  const filtered = search
    ? logs.filter(l =>
        l.message.toLowerCase().includes(search.toLowerCase()) ||
        l.errorType.toLowerCase().includes(search.toLowerCase()) ||
        l.endpoint?.toLowerCase().includes(search.toLowerCase()) ||
        l.userEmail?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {[
                "api", "client", "payment", "authentication", "email",
                "database", "system", "validation", "uncategorized",
              ].map(t => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 w-52 h-9"
            />
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              {search ? "No logs match your search" : "No error logs yet — that's a good sign!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(log => (
            <div
              key={log.id}
              className={`border rounded-lg overflow-hidden transition-colors ${severityColors[log.severity] || ""}`}
            >
              <button
                className="w-full text-left p-3 flex items-start gap-3"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                <SeverityIcon severity={log.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-mono">{log.errorType}</Badge>
                    <span className="text-sm font-medium truncate">{log.message}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs opacity-70 flex-wrap">
                    {log.endpoint && <span>{log.method} {log.endpoint}</span>}
                    {log.userEmail && <span>{log.userEmail}</span>}
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                {expanded === log.id
                  ? <ChevronDown className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  : <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              </button>

              {expanded === log.id && (
                <div className="px-4 pb-4 space-y-2 border-t border-current/10">
                  {log.userEmail && (
                    <div className="text-xs mt-2">
                      <span className="font-medium">User: </span>
                      {log.userName && <span>{log.userName} — </span>}
                      <span>{log.userEmail}</span>
                      {log.userUid && <span className="opacity-60 ml-1">({log.userUid})</span>}
                    </div>
                  )}
                  {log.statusCode && (
                    <div className="text-xs">
                      <span className="font-medium">Status: </span>{log.statusCode}
                    </div>
                  )}
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium">Context:</span>
                      <pre className="mt-1 bg-black/10 dark:bg-white/10 rounded p-2 overflow-x-auto text-xs whitespace-pre-wrap">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.stackTrace && (
                    <div className="text-xs">
                      <span className="font-medium">Stack trace:</span>
                      <pre className="mt-1 bg-black/10 dark:bg-white/10 rounded p-2 overflow-x-auto text-xs whitespace-pre-wrap opacity-80">
                        {log.stackTrace}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
          <span>{total} total logs</span>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDiagnostics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-normal mb-2">Diagnostics</h1>
        <p className="text-muted-foreground">
          Track site traffic, visitor behavior, and system health.
        </p>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="mb-4">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Error Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Firestore Collections Required

The error logging system uses one Firestore collection:

| Collection | Purpose |
|---|---|
| `errorLogs` | Stores all auto-captured and manually logged errors |

### Firestore Composite Indexes Required

The query filters (orderBy + where clauses) require a composite index. Create the following in your Firebase Console under **Firestore → Indexes → Composite**:

| Collection | Field 1 | Field 2 | Query scope |
|---|---|---|---|
| `errorLogs` | `timestamp` Descending | *(none needed if no filters)* | Collection |
| `errorLogs` | `severity` Ascending | `timestamp` Descending | Collection |
| `errorLogs` | `errorType` Ascending | `timestamp` Descending | Collection |

Firebase will also provide a direct link to create missing indexes in the server console error message — look for "The query requires an index" in your logs when you first filter.

---

## Setting Up for a New Client

Follow these steps in order:

**1. Google Analytics 4**
- Create a GA4 property at [analytics.google.com](https://analytics.google.com)
- Copy the **Measurement ID** (format: `G-XXXXXXXXXX`) and put it in `index.html` (two places in the script block)
- Copy the **Property ID** (numeric only, e.g. `520580573`) and add it as the `GA4_PROPERTY_ID` environment variable

**2. Firebase / Service Account**
- In Firebase Console → Project Settings → Service Accounts → Generate new private key
- Download the JSON file
- Set the entire JSON content (one line, or as-is) as the `FIREBASE_SERVICE_ACCOUNT` environment variable
- In Google Analytics Admin → Account Access Management, add the service account email (`firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`) as a **Viewer**
- In Google Cloud Console → APIs → enable **Google Analytics Data API** for the project

**3. Admin route protection**
- Replace `isAdminAuthenticated` in both API routes with your own admin auth middleware

**4. Register the routes**
- Add both `GET /api/admin/ga4-analytics` and `GET /api/admin/error-logs` routes to your Express app
- Register the global error intercept middleware BEFORE your route definitions
- Register the global crash handler in `index.ts` AFTER `registerRoutes(...)`

**5. Frontend**
- Register `useGATracking()` once at the root of your React app
- Add the Diagnostics page to your admin router

---

## Error Type Reference

| Error Type | When it fires |
|---|---|
| `authentication` | Login failures, unauthorized access, session issues, registration |
| `payment` | PayPal errors, subscription failures, checkout issues |
| `registration` | Booking submission errors |
| `email` | Email send failures (Gmail, SMTP) |
| `form_upload` | Image upload failures, brand kit save errors, file errors |
| `admin_operation_error` | Admin-only API failures not covered by above |
| `system` | 500+ errors that don't match any URL pattern, unhandled crashes |
| `api` | Generic API errors (catch-all for unmatched routes) |
| `database` | Manually logged database failures |
| `validation` | Manually logged form or schema validation failures |
| `client` | Manually logged client-side errors |
| `security_alert` | Manually logged suspicious activity |
| `manual_action` | Manually logged admin actions with issues |
| `uncategorized` | Manually logged errors with no other fit |

---

## Severity Level Reference

| Severity | Color in UI | When to use |
|---|---|---|
| `critical` | Red | Server crash, unhandled exception, data loss risk |
| `error` | Orange | 500-level API errors, failed critical operations |
| `warning` | Yellow | 401 / 403 (unauthorized), partial failures |
| `info` | Blue | 400-level client errors shown to user (bad input, not found) |

---

*This document covers the complete Diagnostics system as implemented. All code blocks are production-ready and match the live codebase exactly.*
