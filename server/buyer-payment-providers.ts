import Stripe from "stripe";
import { getFirestore } from "./firebase-admin";
import { decrypt, encrypt, isEncryptionKeySet } from "./encryption";

export type BuyerPaymentProvider = "authorize" | "stripe" | "paypal";

type BuyerPaymentSettings = {
  paymentProvider?: BuyerPaymentProvider;
  stripePublishableKey?: string;
  stripeSecretKeyEncrypted?: string;
  stripeWebhookSecretEncrypted?: string;
  paypalClientId?: string;
  paypalSecretEncrypted?: string;
  paypalWebhookId?: string;
  paypalEnvironment?: "sandbox" | "live";
};

async function getSettings(): Promise<BuyerPaymentSettings> {
  const snapshot = await getFirestore().collection("site_settings").doc("main").get();
  return (snapshot.data() || {}) as BuyerPaymentSettings;
}

function envValue(...names: string[]): string | undefined {
  return names.map((name) => process.env[name]?.trim()).find(Boolean);
}

export async function getBuyerPaymentConfig() {
  const settings = await getSettings();
  const stripeSecretKey = settings.stripeSecretKeyEncrypted
    ? decrypt(settings.stripeSecretKeyEncrypted)
    : envValue("STRIPE_SECRET_KEY");
  const paypalSecret = settings.paypalSecretEncrypted
    ? decrypt(settings.paypalSecretEncrypted)
    : envValue("PAYPAL_CLIENT_SECRET", "PAYPAL_SECRET");
  const stripePublishableKey = settings.stripePublishableKey || envValue("STRIPE_PUBLISHABLE_KEY");
  const paypalClientId = settings.paypalClientId || envValue("PAYPAL_CLIENT_ID");
  const paypalEnvironment = settings.paypalEnvironment || (process.env.PAYPAL_USE_LIVE === "true" ? "live" : "sandbox");
  const stripeWebhookSecret = settings.stripeWebhookSecretEncrypted
    ? decrypt(settings.stripeWebhookSecretEncrypted)
    : envValue("STRIPE_WEBHOOK_SECRET");
  const stripeConfigured = Boolean(stripeSecretKey && stripePublishableKey);
  const paypalConfigured = Boolean(paypalClientId && paypalSecret);
  const requestedProvider = settings.paymentProvider || "authorize";
  const provider = requestedProvider === "stripe" && stripeConfigured
    ? "stripe"
    : requestedProvider === "paypal" && paypalConfigured
      ? "paypal"
      : "authorize";

  return {
    provider: provider as BuyerPaymentProvider,
    requestedProvider,
    stripeConfigured,
    stripePublishableKey: stripePublishableKey || null,
    paypalConfigured,
    paypalClientId: paypalClientId || null,
    paypalEnvironment,
    stripeWebhookSecret,
    paypalWebhookId: settings.paypalWebhookId || envValue("PAYPAL_WEBHOOK_ID") || null,
    stripeSecretKey,
    paypalSecret,
  };
}

export async function saveBuyerPaymentSettings(input: {
  paymentProvider: BuyerPaymentProvider;
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  paypalClientId?: string;
  paypalSecret?: string;
  stripeWebhookSecret?: string;
  paypalWebhookId?: string;
  paypalEnvironment?: "sandbox" | "live";
}) {
  const update: BuyerPaymentSettings = {
    paymentProvider: input.paymentProvider,
    paypalEnvironment: input.paypalEnvironment || "sandbox",
  };

  if (input.stripePublishableKey?.trim()) update.stripePublishableKey = input.stripePublishableKey.trim();
  if (input.paypalClientId?.trim()) update.paypalClientId = input.paypalClientId.trim();
  if (input.paypalWebhookId?.trim()) update.paypalWebhookId = input.paypalWebhookId.trim();

  if (input.stripeSecretKey?.trim() || input.paypalSecret?.trim() || input.stripeWebhookSecret?.trim()) {
    if (!isEncryptionKeySet()) {
      throw Object.assign(new Error("ENCRYPTION_KEY must be configured before saving payment secrets."), { status: 400 });
    }
    if (input.stripeSecretKey?.trim()) update.stripeSecretKeyEncrypted = encrypt(input.stripeSecretKey.trim());
    if (input.paypalSecret?.trim()) update.paypalSecretEncrypted = encrypt(input.paypalSecret.trim());
    if (input.stripeWebhookSecret?.trim()) update.stripeWebhookSecretEncrypted = encrypt(input.stripeWebhookSecret.trim());
  }

  await getFirestore().collection("site_settings").doc("main").set(update, { merge: true });
  return getBuyerPaymentConfig();
}

export async function getStripeBuyerClient(): Promise<Stripe> {
  const config = await getBuyerPaymentConfig();
  if (!config.stripeSecretKey) throw new Error("Stripe is not configured.");
  return new Stripe(config.stripeSecretKey);
}

export function getPayPalApiBase(environment: "sandbox" | "live") {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalAccessToken(config?: Awaited<ReturnType<typeof getBuyerPaymentConfig>>) {
  config = config || await getBuyerPaymentConfig();
  if (!config.paypalClientId || !config.paypalSecret) throw new Error("PayPal is not configured.");
  const auth = Buffer.from(`${config.paypalClientId}:${config.paypalSecret}`).toString("base64");
  const response = await fetch(`${getPayPalApiBase(config.paypalEnvironment)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status}).`);
  return (await response.json() as { access_token: string }).access_token;
}