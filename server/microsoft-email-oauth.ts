import { randomUUID } from "node:crypto";
import { decrypt, encrypt, isEncryptionKeySet } from "./encryption";
import { getFirestore } from "./firebase-admin";

const MAILBOX_ADDRESS = "info@cbpublishing.live";
const SETTINGS_COLLECTION = "serverEmailAuth";
const FLOW_COLLECTION = "serverEmailAuthFlows";
const SMTP_SCOPE = "https://outlook.office.com/SMTP.Send";
const GRAPH_SCOPES = "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send";
const DEVICE_AUTH_SCOPES = `offline_access ${SMTP_SCOPE} ${GRAPH_SCOPES}`;
const MICROSOFT_CLIENT_ID_ENV = "MICROSOFT_EMAIL_CLIENT_ID";
const MICROSOFT_TENANT_ID_ENV = "MICROSOFT_EMAIL_TENANT_ID";

type MicrosoftEmailSettingsDocument = {
  tenantId: string;
  clientId: string;
  mailboxAddress: string;
  activeProvider: "gmail" | "microsoft365";
  encryptedRefreshToken?: string | null;
  connectedAt?: string | null;
  mailboxAccessGranted?: boolean;
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

type MicrosoftOAuthTestDependencies = Partial<{
  firestore: ReturnType<typeof getFirestore>;
  fetch: typeof fetch;
  encrypt: typeof encrypt;
  decrypt: typeof decrypt;
  encryptionKeyReady: typeof isEncryptionKeySet;
  createId: typeof randomUUID;
  environment: Record<string, string | undefined>;
  now: () => number;
}>;

let settingsCache: { value: MicrosoftEmailSettings | null; expiresAt: number } | null = null;
let graphAccessTokenCache: { token: string; expiresAt: number; refreshToken: string } | null = null;

function settingsRef(firestore = getFirestore()) {
  return firestore.collection(SETTINGS_COLLECTION).doc("microsoft365");
}

function flowRef(flowId: string, firestore = getFirestore()) {
  return firestore.collection(FLOW_COLLECTION).doc(flowId);
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

function readEnvironmentConfig(environment: Record<string, string | undefined> = process.env) {
  const clientId = environment[MICROSOFT_CLIENT_ID_ENV]?.trim() || "";
  const tenantId = environment[MICROSOFT_TENANT_ID_ENV]?.trim() || "";
  return {
    clientId,
    tenantId,
    hasAny: Boolean(clientId || tenantId),
    hasBoth: Boolean(clientId && tenantId),
  };
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
      return "Microsoft requires consent for sending mail and accessing the inbox before this mailbox can connect.";
    case "invalid_grant":
      return "Microsoft did not accept the authorization. Start a new connection attempt and sign in as info@cbpublishing.live.";
    default:
      return "Microsoft could not complete authorization. Check the app registration and admin consent, then try again.";
  }
}

export function invalidateMicrosoftEmailSettingsCache(): void {
  settingsCache = null;
  graphAccessTokenCache = null;
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
    mailboxAccessGranted: stored.mailboxAccessGranted === true,
    ...(stored.encryptedRefreshToken
      ? { refreshToken: decrypt(stored.encryptedRefreshToken) }
      : {}),
  };
  settingsCache = { value: settings, expiresAt: Date.now() + 10_000 };
  return settings;
}

export class MicrosoftMailboxPermissionError extends Error {
  constructor() {
    super("Reconnect Microsoft 365 in Admin → Email and approve the inbox and reply permissions.");
    this.name = "MicrosoftMailboxPermissionError";
  }
}

export async function getMicrosoftGraphAccessToken(): Promise<string> {
  const settings = await getMicrosoftEmailSettings();
  if (
    !settings ||
    settings.activeProvider !== "microsoft365" ||
    !settings.refreshToken ||
    !settings.mailboxAccessGranted
  ) {
    throw new MicrosoftMailboxPermissionError();
  }

  const now = Date.now();
  if (
    graphAccessTokenCache &&
    graphAccessTokenCache.refreshToken === settings.refreshToken &&
    graphAccessTokenCache.expiresAt > now + 60_000
  ) {
    return graphAccessTokenCache.token;
  }

  const response = await fetch(oauthEndpoint(settings.tenantId, "token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: settings.clientId,
      grant_type: "refresh_token",
      refresh_token: settings.refreshToken,
      scope: `offline_access ${GRAPH_SCOPES}`,
    }),
  });
  const result = await response.json() as MicrosoftTokenResponse;
  if (!response.ok || !result.access_token) {
    const code = result.error || "token_refresh_failed";
    throw new Error(code === "invalid_grant"
      ? "The Microsoft mailbox authorization expired. Reconnect Microsoft 365 in Admin → Email."
      : "Microsoft could not authorize inbox access. Reconnect Microsoft 365 and approve the requested permissions.");
  }

  if (result.refresh_token && result.refresh_token !== settings.refreshToken) {
    const encryptedRefreshToken = encrypt(result.refresh_token);
    await settingsRef().set({
      encryptedRefreshToken,
    }, { merge: true });
    settings.refreshToken = result.refresh_token;
    settings.encryptedRefreshToken = encryptedRefreshToken;
    settingsCache = { value: settings, expiresAt: Date.now() + 10_000 };
  }
  graphAccessTokenCache = {
    token: result.access_token,
    refreshToken: settings.refreshToken,
    expiresAt: Date.now() + Math.max(60, Number(result.expires_in) || 3600) * 1000,
  };
  return result.access_token;
}

export async function getMicrosoftEmailOAuthStatus() {
  const settings = await getMicrosoftEmailSettings();
  const environmentConfig = readEnvironmentConfig();
  const usingEnvironmentConfig = environmentConfig.hasAny;
  const clientId = usingEnvironmentConfig ? environmentConfig.clientId : settings?.clientId || "";
  const tenantId = usingEnvironmentConfig ? environmentConfig.tenantId : settings?.tenantId || "";
  let configurationError: string | null = null;
  if (usingEnvironmentConfig && !environmentConfig.hasBoth) {
    configurationError = `Set both ${MICROSOFT_CLIENT_ID_ENV} and ${MICROSOFT_TENANT_ID_ENV}.`;
  } else if (usingEnvironmentConfig && !isClientId(clientId)) {
    configurationError = `${MICROSOFT_CLIENT_ID_ENV} must be a valid application client ID.`;
  } else if (usingEnvironmentConfig && !isSafeTenantId(tenantId)) {
    configurationError = `${MICROSOFT_TENANT_ID_ENV} must be a tenant ID or verified tenant domain.`;
  }
  const configured = usingEnvironmentConfig
    ? !configurationError
    : Boolean(clientId && tenantId);
  const connected = Boolean(settings?.refreshToken);
  return {
    mailboxAddress: MAILBOX_ADDRESS,
    clientId: usingEnvironmentConfig ? "" : clientId,
    tenantId: usingEnvironmentConfig ? "" : tenantId,
    configured,
    configurationSource: usingEnvironmentConfig ? "environment" as const : configured ? "admin" as const : "missing" as const,
    configurationError,
    connected,
    active: settings?.activeProvider === "microsoft365" && connected,
    mailboxAccessGranted: settings?.mailboxAccessGranted === true,
    connectedAt: settings?.connectedAt || null,
    encryptionReady: isEncryptionKeySet(),
  };
}

export async function startMicrosoftEmailDeviceAuthorization(input: {
  clientId?: string;
  tenantId?: string;
}, dependencies: MicrosoftOAuthTestDependencies = {}) {
  const firestore = dependencies.firestore ?? getFirestore();
  const fetcher = dependencies.fetch ?? fetch;
  const encryptValue = dependencies.encrypt ?? encrypt;
  const encryptionKeyReady = dependencies.encryptionKeyReady ?? isEncryptionKeySet;
  const createId = dependencies.createId ?? randomUUID;
  const now = dependencies.now ?? Date.now;
  const environmentConfig = readEnvironmentConfig(dependencies.environment);
  if (environmentConfig.hasAny && !environmentConfig.hasBoth) {
    throw new Error(`Set both ${MICROSOFT_CLIENT_ID_ENV} and ${MICROSOFT_TENANT_ID_ENV} before connecting Microsoft 365.`);
  }
  const clientId = (environmentConfig.hasBoth ? environmentConfig.clientId : input.clientId || "").trim();
  const tenantId = (environmentConfig.hasBoth ? environmentConfig.tenantId : input.tenantId || "").trim();
  if (!isClientId(clientId)) {
    throw new Error("Enter the Microsoft Application (client) ID from the app registration.");
  }
  if (!isSafeTenantId(tenantId)) {
    throw new Error("Enter the Microsoft Directory (tenant) ID or verified tenant domain.");
  }
  if (!encryptionKeyReady()) {
    throw new Error("Email authorization cannot be stored securely because ENCRYPTION_KEY is not configured.");
  }

  const response = await fetcher(oauthEndpoint(tenantId, "devicecode"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: clientId,
      scope: DEVICE_AUTH_SCOPES,
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

  const flowId = createId();
  const intervalSeconds = Math.max(5, Number(result.interval) || 5);
  const expiresIn = Math.max(60, Number(result.expires_in) || 900);
  const currentTime = now();
  const flow: DeviceFlowDocument = {
    tenantId,
    clientId,
    encryptedDeviceCode: encryptValue(result.device_code),
    expiresAtMs: currentTime + expiresIn * 1000,
    intervalSeconds,
    nextPollAtMs: currentTime + intervalSeconds * 1000,
  };
  await flowRef(flowId, firestore).set(flow);

  return {
    flowId,
    userCode: result.user_code,
    verificationUri: result.verification_uri,
    verificationUriComplete: result.verification_uri_complete || null,
    expiresIn,
    intervalSeconds,
  };
}

export async function pollMicrosoftEmailDeviceAuthorization(
  flowId: string,
  dependencies: MicrosoftOAuthTestDependencies = {},
) {
  const firestore = dependencies.firestore ?? getFirestore();
  const fetcher = dependencies.fetch ?? fetch;
  const encryptValue = dependencies.encrypt ?? encrypt;
  const decryptValue = dependencies.decrypt ?? decrypt;
  const encryptionKeyReady = dependencies.encryptionKeyReady ?? isEncryptionKeySet;
  const now = dependencies.now ?? Date.now;
  if (!/^[0-9a-f-]{36}$/i.test(flowId)) {
    throw new Error("Invalid Microsoft authorization session.");
  }

  const ref = flowRef(flowId, firestore);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return { status: "failed" as const, message: "This Microsoft sign-in session is no longer active. Start again." };
  }

  const flow = snapshot.data() as DeviceFlowDocument;
  const currentTime = now();
  if (flow.expiresAtMs <= currentTime) {
    await ref.delete();
    return { status: "failed" as const, message: "The Microsoft sign-in code expired. Start again." };
  }
  if (flow.nextPollAtMs > currentTime) {
    return {
      status: "pending" as const,
      retryAfterSeconds: Math.max(1, Math.ceil((flow.nextPollAtMs - currentTime) / 1000)),
    };
  }

  const intervalSeconds = Math.max(5, flow.intervalSeconds || 5);
  await ref.update({
    nextPollAtMs: currentTime + intervalSeconds * 1000,
  });

  const response = await fetcher(oauthEndpoint(flow.tenantId, "token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: flow.clientId,
      device_code: decryptValue(flow.encryptedDeviceCode),
    }),
  });
  const result = await response.json() as MicrosoftTokenResponse;

  if (response.ok && result.access_token && result.refresh_token) {
    if (!encryptionKeyReady()) {
      await ref.delete();
      return { status: "failed" as const, message: "The Microsoft token could not be stored securely. Ask the site administrator to check the encryption setting." };
    }
    await settingsRef(firestore).set({
      tenantId: flow.tenantId,
      clientId: flow.clientId,
      mailboxAddress: MAILBOX_ADDRESS,
      activeProvider: "microsoft365",
      encryptedRefreshToken: encryptValue(result.refresh_token),
      connectedAt: new Date(now()).toISOString(),
      mailboxAccessGranted: true,
    }, { merge: true });
    await ref.delete();
    invalidateMicrosoftEmailSettingsCache();
    graphAccessTokenCache = null;
    return { status: "connected" as const };
  }

  if (result.error === "authorization_pending") {
    return { status: "pending" as const, retryAfterSeconds: intervalSeconds };
  }
  if (result.error === "slow_down") {
    const slowerInterval = intervalSeconds + 5;
    await ref.update({
      intervalSeconds: slowerInterval,
      nextPollAtMs: now() + slowerInterval * 1000,
    });
    return { status: "pending" as const, retryAfterSeconds: slowerInterval };
  }

  await ref.delete();
  return {
    status: "failed" as const,
    message: explainMicrosoftOAuthError(result.error),
  };
}
