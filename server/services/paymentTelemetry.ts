import type { NextFunction, Request, Response } from "express";
import type Stripe from "stripe";
import { getFirestore } from "../firebase-admin";
import { createErrorContext, logError, type ErrorSeverity } from "./errorLogger";

/**
 * Payment telemetry: every payment request, every outbound provider call and every
 * provider webhook is written to the central error log (type "payment") with a shared
 * attemptId so a purchase can be followed from the buyer's phone to the card network.
 */

const PAYMENT_PATH = /^\/api\/(guest\/checkout|payment-provider|payment\/|oc\/paypal-capture|oc\/payments|vote-purchases|webhooks\/(stripe|paypal|authorize-net))/;
const SLOW_CALL_MS = 8_000;

export interface PaymentEventInput {
  step: string;
  severity: ErrorSeverity;
  message: string;
  attemptId?: string;
  provider?: "stripe" | "paypal" | "authorize-net" | "oc";
  statusCode?: number;
  endpoint?: string;
  method?: string;
  stackTrace?: string;
  userEmail?: string;
  context?: Record<string, unknown>;
}

export function paymentEnvironmentName(): "production" | "development" {
  return process.env.RENDER || process.env.NODE_ENV === "production" ? "production" : "development";
}

export function logPaymentEvent(input: PaymentEventInput): void {
  void logError({
    errorType: "payment",
    severity: input.severity,
    message: input.message,
    stackTrace: input.stackTrace,
    statusCode: input.statusCode,
    endpoint: input.endpoint,
    method: input.method,
    userEmail: input.userEmail,
    wasShownToUser: input.severity === "error" || input.severity === "critical",
    // The unique key keeps every step of an attempt, and skips only exact repeats.
    idempotencyKey: input.attemptId ? `payment:${input.attemptId}:${input.step}:${input.statusCode ?? ""}` : undefined,
    context: createErrorContext({
      source: "payment-server",
      step: input.step,
      provider: input.provider,
      attemptId: input.attemptId,
      ...input.context,
    }),
  });
}

function attemptIdFromRequest(req: Request): string | undefined {
  const header = req.headers["x-payment-attempt"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromBody = req.body && typeof req.body === "object" ? (req.body as { idempotencyKey?: unknown }).idempotencyKey : undefined;
  const value = fromHeader || (typeof fromBody === "string" ? fromBody : undefined);
  return value ? value.slice(0, 80) : undefined;
}

/** Records every payment API request with its outcome and duration, including successes. */
export function paymentRequestTelemetry(req: Request, res: Response, next: NextFunction): void {
  if (!PAYMENT_PATH.test(req.path) || req.method === "GET") return next();
  const startedAt = Date.now();
  const attemptId = attemptIdFromRequest(req);
  let finished = false;

  res.on("finish", () => {
    finished = true;
    const status = res.statusCode;
    const durationMs = Date.now() - startedAt;
    const failed = status >= 400;
    logPaymentEvent({
      step: "request",
      severity: status >= 500 ? "error" : failed ? "warning" : durationMs > SLOW_CALL_MS ? "warning" : "info",
      message: `Payment request ${req.method} ${req.path} → ${status} in ${durationMs}ms`,
      attemptId: attemptId ? `${attemptId}:${req.path}` : undefined,
      statusCode: status,
      endpoint: req.path,
      method: req.method,
      context: {
        attemptRef: attemptId,
        durationMs,
        requestOrigin: req.headers.origin,
        userAgent: req.headers["user-agent"]?.slice(0, 250),
        ip: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip,
      },
    });
  });

  // A connection that closes before a response is sent means the buyer's device
  // (or a proxy) gave up while the server was still working on a payment.
  res.on("close", () => {
    if (finished) return;
    const durationMs = Date.now() - startedAt;
    logPaymentEvent({
      step: "request-aborted",
      severity: "error",
      message: `Payment request ${req.method} ${req.path} was cut off after ${durationMs}ms before a response was sent`,
      attemptId: attemptId ? `${attemptId}:${req.path}` : undefined,
      endpoint: req.path,
      method: req.method,
      context: {
        attemptRef: attemptId,
        durationMs,
        userAgent: req.headers["user-agent"]?.slice(0, 250),
        ip: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip,
      },
    });
  });
  next();
}

/** Logs each outbound Stripe API call (method, path, status, latency, Stripe request id). */
export function instrumentStripeClient<T extends Stripe>(stripe: T): T {
  const startedByRequest = new Map<string, number>();
  const stripeEvents = stripe as unknown as {
    on: (event: "request" | "response", handler: (data: Record<string, any>) => void) => void;
  };
  stripeEvents.on("request", (data) => {
    if (data.request_start_time) startedByRequest.set(String(data.idempotency_key || data.path), data.request_start_time);
  });
  stripeEvents.on("response", (data) => {
    const status = Number(data.status);
    const elapsed = Number(data.elapsed ?? 0);
    const failed = status >= 400;
    logPaymentEvent({
      step: "stripe-api-call",
      severity: status >= 500 ? "error" : failed ? "warning" : elapsed > SLOW_CALL_MS ? "warning" : "info",
      message: `Stripe ${data.method} ${data.path} → ${status} in ${elapsed}ms`,
      provider: "stripe",
      attemptId: data.request_id ? `stripe:${data.request_id}` : undefined,
      statusCode: status,
      endpoint: String(data.path || ""),
      method: String(data.method || ""),
      context: { stripeRequestId: data.request_id, apiVersion: data.api_version, elapsedMs: elapsed, retries: data.request_retries },
    });
  });
  return stripe;
}

/** fetch wrapper that records latency/status for PayPal and other REST providers. */
export async function tracedProviderFetch(
  provider: "paypal" | "authorize-net" | "oc",
  operation: string,
  url: string,
  init: RequestInit,
  attemptId?: string,
): Promise<globalThis.Response> {
  const startedAt = Date.now();
  const path = (() => { try { return new URL(url).pathname; } catch { return url.slice(0, 120); } })();
  try {
    const response = await fetch(url, init);
    const elapsed = Date.now() - startedAt;
    logPaymentEvent({
      step: `${provider}-api-call`,
      severity: response.status >= 500 ? "error" : response.status >= 400 ? "warning" : elapsed > SLOW_CALL_MS ? "warning" : "info",
      message: `${provider} ${operation} ${init.method || "GET"} ${path} → ${response.status} in ${elapsed}ms`,
      provider,
      attemptId: attemptId ? `${attemptId}:${operation}` : undefined,
      statusCode: response.status,
      endpoint: path,
      method: init.method || "GET",
      context: { operation, elapsedMs: elapsed, providerRequestId: response.headers.get("paypal-debug-id") || undefined },
    });
    return response;
  } catch (error) {
    logPaymentEvent({
      step: `${provider}-api-call-failed`,
      severity: "error",
      message: `${provider} ${operation} could not reach the provider: ${(error as Error)?.message || "network error"}`,
      provider,
      attemptId: attemptId ? `${attemptId}:${operation}` : undefined,
      endpoint: path,
      method: init.method || "GET",
      stackTrace: (error as Error)?.stack,
      context: { operation, elapsedMs: Date.now() - startedAt },
    });
    throw error;
  }
}

/**
 * Finds card payments whose Stripe intent was created but never reached a final state
 * (buyer's phone dropped, tab closed, redirect lost) and reports each one once.
 */
export async function reportStalledPaymentAttempts(options: { olderThanMs?: number; lookbackMs?: number } = {}): Promise<number> {
  const olderThanMs = options.olderThanMs ?? 15 * 60 * 1000;
  const lookbackMs = options.lookbackMs ?? 48 * 60 * 60 * 1000;
  const now = Date.now();
  const snapshot = await getFirestore()
    .collection("questStripeCheckouts")
    .where("createdAt", ">=", now - lookbackMs)
    .get();
  let reported = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const createdAt = Number(data.createdAt || 0);
    if (!createdAt || now - createdAt < olderThanMs) continue;
    if (data.stripeStatus === "succeeded" || data.stripeStatus === "canceled") continue;
    let liveStatus: string | undefined;
    if (data.intentId) {
      try {
        const { getStripeBuyerClient } = await import("../buyer-payment-providers");
        const stripe = await getStripeBuyerClient();
        liveStatus = (await stripe.paymentIntents.retrieve(String(data.intentId))).status;
      } catch {
        liveStatus = undefined;
      }
      if (liveStatus === "succeeded" || liveStatus === "canceled") continue;
    }
    reported += 1;
    logPaymentEvent({
      step: "stalled-attempt",
      severity: "critical",
      message: `Card payment never completed: intent ${data.intentId || "not created"} is ${liveStatus || data.stripeStatus || "unconfirmed"} ${Math.round((now - createdAt) / 60000)} min after checkout started`,
      attemptId: `stalled:${doc.id}`,
      provider: "stripe",
      context: {
        checkoutId: doc.id,
        paymentIntentId: data.intentId,
        stripeStatus: liveStatus || data.stripeStatus,
        latestWebhookEvent: data.latestWebhookEvent,
        amountCents: data.amountCents,
        startedAt: new Date(createdAt).toISOString(),
        note: "The buyer's card may or may not have been charged. Check this payment intent in Stripe before asking them to retry.",
      },
    });
  }
  return reported;
}

export function startStalledPaymentSweep(): void {
  const run = () => reportStalledPaymentAttempts().catch((error) => {
    console.error("Stalled payment sweep failed:", error);
  });
  setTimeout(run, 60_000);
  setInterval(run, 10 * 60 * 1000);
}
