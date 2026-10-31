import { apiRequest } from "@/lib/queryClient";
import { logClientError } from "@/lib/client-error-logger";

export type BuyerPaymentProvider = "authorize" | "stripe" | "paypal";

export interface BuyerPaymentConfig {
  provider?: BuyerPaymentProvider;
  stripePublishableKey?: string | null;
  stripeConfigured?: boolean;
  paypalConfigured?: boolean;
  apiLoginId?: string;
  clientKey?: string;
  environment?: string;
}

export type StripeCardElement = {
  mount: (container: HTMLElement) => void;
  destroy: () => void;
  on: (event: "change", callback: (event: { complete: boolean; error?: { message?: string } }) => void) => void;
};
export type StripeInstance = {
  elements: () => { create: (type: "card", options: unknown) => StripeCardElement };
  confirmCardPayment: (
    clientSecret: string,
    data: {
      payment_method: {
        card: StripeCardElement;
        billing_details: {
          name: string;
          email?: string;
          address?: { line1?: string; city?: string; state?: string; postal_code?: string };
        };
      };
    },
  ) => Promise<{ paymentIntent?: { id: string; status: string }; error?: { message?: string; type?: string; code?: string; decline_code?: string } }>;
};
export type StripeCardHandle = { stripe: StripeInstance; card: StripeCardElement; complete: boolean };

export function loadStripeScript(): Promise<boolean> {
  if (window.Stripe) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://js.stripe.com/v3/"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Stripe)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Stripe));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}


const STRIPE_STALL_MS = 20_000;

function paymentEnvironment() {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  const ua = navigator.userAgent || "";
  return {
    online: navigator.onLine,
    visibility: document.visibilityState,
    connectionType: connection?.effectiveType,
    inAppBrowser: /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/i.test(ua) ? (ua.match(/FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/i)?.[0] ?? "yes") : false,
  };
}

/** Reports one payment step to the central error log. Never includes card or contact data. */
function tracePayment(
  attemptId: string,
  purpose: string,
  step: string,
  severity: "info" | "warning" | "error",
  startedAt: number,
  details: Record<string, unknown> = {},
) {
  void logClientError({
    errorType: "payment",
    severity,
    message: `Payment ${step} (${purpose})`,
    idempotencyKey: `payment-trace:${attemptId}:${step}`,
    wasShownToUser: severity === "error",
    context: {
      source: "payment-trace",
      step,
      purpose,
      attemptId,
      elapsedMs: Math.round(performance.now() - startedAt),
      ...paymentEnvironment(),
      ...details,
    },
  });
}

function describeStripeError(error: unknown) {
  const e = error as { message?: string; type?: string; code?: string; decline_code?: string; name?: string } | undefined;
  return {
    errorName: e?.name,
    errorMessage: typeof e?.message === "string" ? e.message.slice(0, 300) : undefined,
    stripeType: e?.type,
    stripeCode: e?.code,
    declineCode: e?.decline_code,
  };
}

export async function confirmStripeCardPayment(input: {
  publishableKey: string;
  purpose: "join" | "nominate" | "host" | "vote";
  intentPayload: Record<string, unknown>;
  cardHandle: StripeCardHandle | null;
  name: string;
  email: string;
  billingAddress: { address: string; city: string; state: string; zip: string };
  /** Path for the intent endpoint — defaults to /api/payment-provider/stripe-intent */
  intentPath?: string;
}): Promise<{ paymentIntentId: string; ocPaymentId?: string }> {
  if (!input.cardHandle?.complete) throw new Error("Please complete your secure card details.");
  const intentPath = input.intentPath || "/api/payment-provider/stripe-intent";
  const startedAt = performance.now();
  const rawKey = (input.intentPayload as { idempotencyKey?: unknown }).idempotencyKey;
  const attemptId = typeof rawKey === "string" && rawKey ? rawKey.slice(0, 80) : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const trace = (step: string, severity: "info" | "warning" | "error", details?: Record<string, unknown>) =>
    tracePayment(attemptId, input.purpose, step, severity, startedAt, details);

  trace("started", "info", { intentPath });
  let intent: { clientSecret?: string; paymentIntentId?: string; ocPaymentId?: unknown; message?: string };
  let intentResponse: Response;
  try {
    intentResponse = await apiRequest("POST", intentPath, {
      ...input.intentPayload,
      purpose: input.purpose,
      email: input.email,
      billingAddress: input.billingAddress,
    });
    intent = await intentResponse.json();
  } catch (error) {
    trace("intent-request-failed", "error", { intentPath, ...describeStripeError(error) });
    throw error;
  }
  if (!intentResponse.ok) {
    trace("intent-rejected", "error", { intentPath, status: intentResponse.status, errorMessage: String(intent.message || "").slice(0, 300) });
    throw new Error(intent.message || "Unable to start Stripe checkout.");
  }
  if (!intent.clientSecret) {
    trace("intent-missing-secret", "error", { intentPath });
    throw new Error("Stripe did not return a payment secret.");
  }
  trace("intent-created", "info", { paymentIntentId: intent.paymentIntentId });

  const { stripe, card } = input.cardHandle;
  trace("confirm-started", "info", { paymentIntentId: intent.paymentIntentId });
  const stallTimer = window.setTimeout(() => {
    trace("confirm-stalled", "warning", { paymentIntentId: intent.paymentIntentId, stalledAfterMs: STRIPE_STALL_MS });
  }, STRIPE_STALL_MS);
  const onHidden = () => {
    if (document.visibilityState === "hidden") trace("page-hidden-during-confirm", "warning", { paymentIntentId: intent.paymentIntentId });
  };
  document.addEventListener("visibilitychange", onHidden);
  let result: Awaited<ReturnType<StripeInstance["confirmCardPayment"]>>;
  try {
    result = await stripe.confirmCardPayment(intent.clientSecret, {
      payment_method: {
        card,
        billing_details: {
          name: input.name.trim(),
          ...(input.email.trim() ? { email: input.email.trim() } : {}),
          address: {
            line1: input.billingAddress.address,
            city: input.billingAddress.city,
            state: input.billingAddress.state,
            postal_code: input.billingAddress.zip,
          },
        },
      },
    });
  } catch (error) {
    trace("confirm-threw", "error", { paymentIntentId: intent.paymentIntentId, ...describeStripeError(error) });
    throw error;
  } finally {
    window.clearTimeout(stallTimer);
    document.removeEventListener("visibilitychange", onHidden);
  }
  if (result.error || !result.paymentIntent || result.paymentIntent.status !== "succeeded") {
    trace("confirm-failed", "error", {
      paymentIntentId: result.paymentIntent?.id ?? intent.paymentIntentId,
      intentStatus: result.paymentIntent?.status,
      ...describeStripeError(result.error),
    });
    throw new Error(result.error?.message || "Stripe payment was not completed.");
  }
  trace("confirm-succeeded", "info", { paymentIntentId: result.paymentIntent.id });
  return {
    paymentIntentId: result.paymentIntent.id,
    // When the intent was created via OC, the server echoes back ocPaymentId
    ocPaymentId: typeof intent.ocPaymentId === "string" ? intent.ocPaymentId : undefined,
  };
}

export async function createPayPalRedirect(input: {
  purpose: "join" | "nominate" | "host" | "vote";
  payload: Record<string, unknown>;
  returnUrl: string;
  cancelUrl: string;
}) {
  const response = await apiRequest("POST", "/api/payment-provider/paypal-order", {
    ...input.payload,
    purpose: input.purpose,
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
  });
  const order = await response.json();
  if (!response.ok) throw new Error(order.message || "Unable to start PayPal checkout.");
  if (!order.approvalUrl) throw new Error("PayPal did not return an approval link.");
  window.location.assign(order.approvalUrl);
}