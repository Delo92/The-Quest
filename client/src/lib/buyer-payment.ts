import { apiRequest } from "@/lib/queryClient";

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

type StripeInstance = {
  confirmCardPayment: (
    clientSecret: string,
    data: {
      payment_method: {
        card: { number: string; exp_month: number; exp_year: number; cvc: string };
        billing_details: {
          name: string;
          email: string;
          address?: { line1?: string; city?: string; state?: string; postal_code?: string };
        };
      };
    },
  ) => Promise<{ paymentIntent?: { id: string; status: string }; error?: { message?: string } }>;
};

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

export async function confirmStripeCardPayment(input: {
  publishableKey: string;
  purpose: "join" | "nominate" | "host" | "vote";
  intentPayload: Record<string, unknown>;
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  name: string;
  email: string;
  billingAddress: { address: string; city: string; state: string; zip: string };
  /** Path for the intent endpoint — defaults to /api/payment-provider/stripe-intent */
  intentPath?: string;
}): Promise<{ paymentIntentId: string; ocPaymentId?: string }> {
  if (!window.Stripe) throw new Error("Stripe is not ready.");
  const intentPath = input.intentPath || "/api/payment-provider/stripe-intent";
  const intentResponse = await apiRequest("POST", intentPath, {
    ...input.intentPayload,
    purpose: input.purpose,
    email: input.email,
  });
  const intent = await intentResponse.json();
  if (!intentResponse.ok) throw new Error(intent.message || "Unable to start Stripe checkout.");
  if (!intent.clientSecret) throw new Error("Stripe did not return a payment secret.");
  const stripe = window.Stripe(input.publishableKey);
  const result = await stripe.confirmCardPayment(intent.clientSecret, {
    payment_method: {
      card: {
        number: input.cardNumber.replace(/\s/g, ""),
        exp_month: parseInt(input.expMonth, 10),
        exp_year: parseInt(input.expYear.length === 2 ? `20${input.expYear}` : input.expYear, 10),
        cvc: input.cvv,
      },
      billing_details: {
        name: input.name.trim(),
        email: input.email.trim(),
        address: {
          line1: input.billingAddress.address,
          city: input.billingAddress.city,
          state: input.billingAddress.state,
          postal_code: input.billingAddress.zip,
        },
      },
    },
  });
  if (result.error || !result.paymentIntent || result.paymentIntent.status !== "succeeded") {
    throw new Error(result.error?.message || "Stripe payment was not completed.");
  }
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