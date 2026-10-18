import { randomUUID } from "node:crypto";
import { decrypt, encrypt, isEncryptionKeySet } from "./encryption";
import { getFirestore } from "./firebase-admin";

const MAILBOX_ADDRESS = "info@cbpublishing.live";
const SETTINGS_COLLECTION = "serverEmailAuth";
const FLOW_COLLECTION = "serverEmailAuthFlows";
const SMTP_SCOPE = "https://outlook.office.com/SMTP.Send";

type MicrosoftEmailSettingsDocument = {
  tenantId: string;
  clientId: string;
  mailboxAddress: string;
  activeProvider: "gmail" | "microsoft365";
  encryptedRefreshToken?: string | null;
  connectedAt?: string | null;
};

export type MicrosoftEmailSettings = MicrosoftEmailSettingsDocument & {
  refreshToken?: string;
};

type DeviceFlowDocument = {
  tenantId: string;
  clientId: string;
  encryptedDeviceCode: string;
  expiresAtMs: number;
  intervalSeconds: number;
  nextPollAtMs: number;
};

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
  interval?: number;
  expires_in?: number;
};

let settingsCache: { value: MicrosoftEmailSettings | null; expiresAt: number } | null = null;

function settingsRef() {
  return getFirestore().collection(SETTINGS_COLLECTION).doc("microsoft365");
}

function flowRef(flowId: string) {
  return getFirestore().collection(FLOW_COLLECTION).doc(flowId);
}

function isSafeTenantId(value: string): boolean {
  const trimmed = value.trim();
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const domain = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;
  return guid.test(trimmed) || domain.test(trimmed);
}

function isClientId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function oauthEndpoint(tenantId: string, endpoint: "devicecode" | "token"): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/${endpoint}`;
}

function formBody(values: Record<string, string>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body;
}

function explainMicrosoftOAuthError(code: string | undefined): string {
  switch (code) {
    case "authorization_declined":
      return "Microsoft authorization was declined.";
    case "expired_token":
      return "The Microsoft sign-in code expired. Start a new connection attempt.";
    case "invalid_client":
    case "unauthorized_client":
      return "Microsoft rejected the app registration. Check the tenant ID, client ID, and public-client setting.";
    case "consent_required":
    case "interaction_required":
      return "Microsoft requires admin consent for the SMTP.Send permission before this mailbox can connect.";
    case "invalid_grant":
      return "Microsoft did not accept the authorization. Start a new connection attempt and sign in as info@cbpublishing.live.";
    default:
      return "Microsoft could not complete authorization. Check the app registration and admin consent, then try again.";
  }
}

export function invalidateMicrosoftEmailSettingsCache(): void {
  settingsCache = null;
}

export async function getMicrosoftEmailSettings(): Promise<MicrosoftEmailSettings | null> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) {
    return settingsCache.value;
  }

  const snapshot = await settingsRef().get();
  if (!snapshot.exists) {
    settingsCache = { value: null, expiresAt: Date.now() + 10_000 };
    return null;
  }

  const stored = snapshot.data() as MicrosoftEmailSettingsDocument;
  const settings: MicrosoftEmailSettings = {
    tenantId: stored.tenantId,
    clientId: stored.clientId,
    mailboxAddress: stored.mailboxAddress || MAILBOX_ADDRESS,
    activeProvider: stored.activeProvider || "gmail",
    encryptedRefreshToken: stored.encryptedRefreshToken || null,
    connectedAt: stored.connectedAt || null,
    ...(stored.encryptedRefreshToken
      ? { refreshToken: decrypt(stored.encryptedRefreshToken) }
      : {}),
  };
  settingsCache = { value: settings, expiresAt: Date.now() + 10_000 };
  return settings;
}

export async function getMicrosoftEmailOAuthStatus() {
  const settings = await getMicrosoftEmailSettings();
  const connected = Boolean(settings?.refreshToken);
  return {
    mailboxAddress: MAILBOX_ADDRESS,
    clientId: settings?.clientId || "",
    tenantId: settings?.tenantId || "",
    configured: Boolean(settings?.clientId && settings?.tenantId),
    connected,
    active: settings?.activeProvider === "microsoft365" && connected,
    connectedAt: settings?.connectedAt || null,
    encryptionReady: isEncryptionKeySet(),
  };
}

export async function startMicrosoftEmailDeviceAuthorization(input: {
  clientId: string;
  tenantId: string;
}) {
  const clientId = input.clientId.trim();
  const tenantId = input.tenantId.trim();
  if (!isClientId(clientId)) {
    throw new Error("Enter the Microsoft Application (client) ID from the app registration.");
  }
  if (!isSafeTenantId(tenantId)) {
    throw new Error("Enter the Microsoft Directory (tenant) ID or verified tenant domain.");
  }
  if (!isEncryptionKeySet()) {
    throw new Error("Email authorization cannot be stored securely because ENCRYPTION_KEY is not configured.");
  }

  const existing = await settingsRef().get();
  const current = existing.exists ? existing.data() as Partial<MicrosoftEmailSettingsDocument> : null;
  const sameApp = current?.clientId === clientId && current?.tenantId === tenantId;
  await settingsRef().set({
    tenantId,
    clientId,
    mailboxAddress: MAILBOX_ADDRESS,
    activeProvider: sameApp ? (current?.activeProvider || "gmail") : "gmail",
    encryptedRefreshToken: sameApp ? (current?.encryptedRefreshToken || null) : null,
    connectedAt: sameApp ? (current?.connectedAt || null) : null,
  }, { merge: true });
  invalidateMicrosoftEmailSettingsCache();

  const response = await fetch(oauthEndpoint(tenantId, "devicecode"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: clientId,
      scope: `offline_access ${SMTP_SCOPE}`,
    }),
  });
  const result = await response.json() as MicrosoftTokenResponse & {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    verification_uri_complete?: string;
    message?: string;
  };
  if (!response.ok || !result.device_code || !result.user_code || !result.verification_uri) {
    throw new Error(explainMicrosoftOAuthError(result.error));
  }

  const flowId = randomUUID();
  const intervalSeconds = Math.max(5, Number(result.interval) || 5);
  const expiresIn = Math.max(60, Number(result.expires_in) || 900);
  const now = Date.now();
  const flow: DeviceFlowDocument = {
    tenantId,
    clientId,
    encryptedDeviceCode: encrypt(result.device_code),
    expiresAtMs: now + expiresIn * 1000,
    intervalSeconds,
    nextPollAtMs: now + intervalSeconds * 1000,
  };
  await flowRef(flowId).set(flow);

  return {
    flowId,
    userCode: result.user_code,
    verificationUri: result.verification_uri,
    verificationUriComplete: result.verification_uri_complete || null,
    expiresIn,
    intervalSeconds,
  };
}

export async function pollMicrosoftEmailDeviceAuthorization(flowId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(flowId)) {
    throw new Error("Invalid Microsoft authorization session.");
  }

  const ref = flowRef(flowId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return { status: "failed" as const, message: "This Microsoft sign-in session is no longer active. Start again." };
  }

  const flow = snapshot.data() as DeviceFlowDocument;
  const now = Date.now();
  if (flow.expiresAtMs <= now) {
    await ref.delete();
    return { status: "failed" as const, message: "The Microsoft sign-in code expired. Start again." };
  }
  if (flow.nextPollAtMs > now) {
    return {
      status: "pending" as const,
      retryAfterSeconds: Math.max(1, Math.ceil((flow.nextPollAtMs - now) / 1000)),
    };
  }

  const intervalSeconds = Math.max(5, flow.intervalSeconds || 5);
  await ref.update({
    nextPollAtMs: now + intervalSeconds * 1000,
  });

  const response = await fetch(oauthEndpoint(flow.tenantId, "token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: flow.clientId,
      device_code: decrypt(flow.encryptedDeviceCode),
    }),
  });
  const result = await response.json() as MicrosoftTokenResponse;

  if (response.ok && result.access_token && result.refresh_token) {
    if (!isEncryptionKeySet()) {
      await ref.delete();
      return { status: "failed" as const, message: "The Microsoft token could not be stored securely. Ask the site administrator to check the encryption setting." };
    }
    await settingsRef().set({
      tenantId: flow.tenantId,
      clientId: flow.clientId,
      mailboxAddress: MAILBOX_ADDRESS,
      activeProvider: "microsoft365",
      encryptedRefreshToken: encrypt(result.refresh_token),
      connectedAt: new Date().toISOString(),
    }, { merge: true });
    await ref.delete();
    invalidateMicrosoftEmailSettingsCache();
    return { status: "connected" as const };
  }

  if (result.error === "authorization_pending") {
    return { status: "pending" as const, retryAfterSeconds: intervalSeconds };
  }
  if (result.error === "slow_down") {
    const slowerInterval = intervalSeconds + 5;
    await ref.update({
      intervalSeconds: slowerInterval,
      nextPollAtMs: Date.now() + slowerInterval * 1000,
    });
    return { status: "pending" as const, retryAfterSeconds: slowerInterval };
  }

  await ref.delete();
  return {
    status: "failed" as const,
    message: explainMicrosoftOAuthError(result.error),
  };
}
