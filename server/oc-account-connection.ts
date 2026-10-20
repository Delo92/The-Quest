import { createHash, randomBytes } from "node:crypto";
import { getFirestore } from "./firebase-admin";
import { decrypt, encrypt, isEncryptionKeySet } from "./encryption";
import { getPublicOrigin } from "./share-meta";

const REQUIRED_SCOPES = ["brand-kits:read", "social-accounts:read", "social-posts:publish"] as const;
const CONNECTIONS = "ocUserConnections";
const OAUTH_STATES = "ocUserOAuthStates";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 90 * 1000;

export type OCAccountSummary = {
  id: string;
  displayName: string;
};

export type OCConnectionSummary = {
  connected: boolean;
  account: OCAccountSummary | null;
  selectedBrandKitId: string | null;
  selectedBrandKitName: string | null;
  scopes: string[];
  connectedAt: string | null;
};

export class OCAccountError extends Error {
  status: number;
  code: string;
  returnTo?: string;

  constructor(status: number, code: string, message: string, returnTo?: string) {
    super(message);
    this.name = "OCAccountError";
    this.status = status;
    this.code = code;
    this.returnTo = returnTo;
  }
}

type OCAccountConnectionRecord = {
  uid: string;
  ocAccountId: string;
  ocDisplayName: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  accessTokenExpiresAt: number;
  scopes: string[];
  selectedBrandKitId: string | null;
  selectedBrandKitName: string | null;
  connectedAt: string;
  updatedAt: string;
};

type OAuthStateRecord = {
  uid: string;
  returnTo: string;
  codeVerifierEncrypted: string;
  expiresAt: number;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

function getOCBaseUrl(): URL {
  const configured = process.env.OC_API_BASE_URL?.trim() || "https://oraginalconcepts.com";
  let base: URL;
  try {
    base = new URL(configured);
  } catch {
    throw new OCAccountError(503, "oc_base_url_invalid", "The OC account service URL is invalid.");
  }
  if (
    (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1")
    || base.username
    || base.password
  ) {
    throw new OCAccountError(503, "oc_base_url_invalid", "The OC account service URL must use HTTPS.");
  }
  base.pathname = base.pathname.replace(/\/+$/, "");
  base.search = "";
  base.hash = "";
  return base;
}

function getOAuthClient() {
  const clientId = process.env.OC_QUEST_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.OC_QUEST_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new OCAccountError(503, "oc_oauth_not_configured", "OC account connection is not configured yet.");
  }
  if (!isEncryptionKeySet()) {
    throw new OCAccountError(503, "encryption_not_configured", "Secure OC account storage is not configured.");
  }
  return { clientId, clientSecret };
}

function getCallbackUrl(): string {
  return `${getPublicOrigin()}/api/oc/account/callback`;
}

export function isAllowedOCAccountReturnTo(value: unknown): value is "/thequest/dashboard" {
  return value === "/thequest/dashboard";
}

export function createOCAccountPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildOCAccountAuthorizationUrl(input: {
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL("/oauth/authorize", input.baseUrl);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", REQUIRED_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function isOCAccountOAuthConfigured(): boolean {
  return Boolean(
    process.env.OC_QUEST_OAUTH_CLIENT_ID?.trim()
    && process.env.OC_QUEST_OAUTH_CLIENT_SECRET
    && isEncryptionKeySet(),
  );
}

export async function beginOCAccountConnection(
  uid: string,
  returnTo: "/thequest/dashboard",
): Promise<string> {
  const { clientId } = getOAuthClient();
  const baseUrl = getOCBaseUrl();
  const redirectUri = getCallbackUrl();
  const state = randomBytes(32).toString("hex");
  const { verifier, challenge } = createOCAccountPkcePair();
  const expiresAt = Date.now() + OAUTH_STATE_TTL_MS;

  await getFirestore().collection(OAUTH_STATES).doc(state).create({
    uid,
    returnTo,
    codeVerifierEncrypted: encrypt(verifier),
    expiresAt,
    createdAt: new Date().toISOString(),
  } satisfies OAuthStateRecord & { createdAt: string });

  return buildOCAccountAuthorizationUrl({
    baseUrl: baseUrl.origin,
    clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });
}

function readTokenResponse(value: any, fallbackScopes: string[] = []): TokenResponse {
  const accessToken = typeof value?.access_token === "string" ? value.access_token.trim() : "";
  const refreshToken = typeof value?.refresh_token === "string" ? value.refresh_token.trim() : "";
  const tokenType = typeof value?.token_type === "string" ? value.token_type : "";
  const expiresIn = Number(value?.expires_in);
  const scopeValue = typeof value?.scope === "string"
    ? value.scope
    : Array.isArray(value?.scope)
      ? value.scope.join(" ")
      : "";
  const scopes = scopeValue.trim()
    ? scopeValue.trim().split(/\s+/).filter(Boolean)
    : fallbackScopes;

  if (!accessToken || tokenType.toLowerCase() !== "bearer" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new OCAccountError(502, "oc_token_invalid", "OC returned an invalid account authorization.");
  }
  if (!REQUIRED_SCOPES.every((scope) => scopes.includes(scope))) {
    throw new OCAccountError(403, "oc_scope_missing", "OC authorization did not include the required brand-kit and publishing access.");
  }

  return {
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    token_type: "Bearer",
    expires_in: Math.min(expiresIn, 365 * 24 * 60 * 60),
    scope: scopes.join(" "),
  };
}

function basicClientAuthorization(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function postOAuthForm(fields: Record<string, string>): Promise<any> {
  const { clientId, clientSecret } = getOAuthClient();
  const url = new URL("/oauth/token", getOCBaseUrl());
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: basicClientAuthorization(clientId, clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ ...fields, client_id: clientId }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new OCAccountError(502, "oc_unreachable", "Could not reach the OC account service.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const status = response.status === 400 ? 400 : response.status === 401 || response.status === 403 ? 403 : 502;
    throw new OCAccountError(status, "oc_oauth_failed", "OC could not complete the account authorization.");
  }
  return data;
}

async function requestOCJson(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<any> {
  const base = getOCBaseUrl();
  const url = new URL(path, base);
  if (url.origin !== base.origin) {
    throw new OCAccountError(500, "oc_api_path_invalid", "Invalid OC API path.");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
      signal: options.signal || AbortSignal.timeout(20_000),
    });
  } catch {
    throw new OCAccountError(502, "oc_unreachable", "Could not reach the OC account service.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const status = response.status === 401 ? 401
      : response.status === 403 ? 403
      : response.status === 404 ? 404
      : response.status === 409 ? 409
      : response.status === 429 ? 429
      : response.status >= 500 ? 502
      : 400;
    const messages: Record<number, string> = {
      400: "OC could not process this request.",
      401: "The OC connection expired. Reconnect your account to continue.",
      403: "The OC account has not granted access to this brand kit or publishing target.",
      404: "The requested OC brand kit or media item could not be found.",
      409: "OC is already processing this post request.",
      429: "OC is receiving too many requests. Try again shortly.",
      502: "The OC account service is temporarily unavailable.",
    };
    throw new OCAccountError(status, "oc_api_request_failed", messages[status] || messages[400]);
  }
  return data;
}

async function readConnection(uid: string): Promise<OCAccountConnectionRecord | null> {
  const doc = await getFirestore().collection(CONNECTIONS).doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as OCAccountConnectionRecord;
}

export async function getOCAccountConnectionSummary(uid: string): Promise<OCConnectionSummary> {
  const connection = await readConnection(uid);
  if (!connection?.accessTokenEncrypted) {
    return {
      connected: false,
      account: null,
      selectedBrandKitId: null,
      selectedBrandKitName: null,
      scopes: [],
      connectedAt: null,
    };
  }
  return {
    connected: true,
    account: {
      id: connection.ocAccountId,
      displayName: connection.ocDisplayName,
    },
    selectedBrandKitId: connection.selectedBrandKitId || null,
    selectedBrandKitName: connection.selectedBrandKitName || null,
    scopes: connection.scopes || [],
    connectedAt: connection.connectedAt || null,
  };
}

async function consumeOAuthState(state: string): Promise<OAuthStateRecord> {
  if (!/^[a-f0-9]{64}$/.test(state)) {
    throw new OCAccountError(400, "oauth_state_invalid", "The OC authorization state is invalid or expired.");
  }
  const firestore = getFirestore();
  const stateRef = firestore.collection(OAUTH_STATES).doc(state);
  const record = await firestore.runTransaction(async (transaction) => {
    const doc = await transaction.get(stateRef);
    if (!doc.exists) return null;
    const data = doc.data() as OAuthStateRecord;
    transaction.delete(stateRef);
    return data;
  });
  if (!record || !record.uid || !record.codeVerifierEncrypted || record.expiresAt < Date.now()) {
    throw new OCAccountError(400, "oauth_state_invalid", "The OC authorization state is invalid or expired.");
  }
  return record;
}

export async function consumeOCAccountOAuthState(state: string): Promise<{
  uid: string;
  returnTo: string;
}> {
  const authorization = await consumeOAuthState(state);
  return { uid: authorization.uid, returnTo: authorization.returnTo };
}

async function exchangeAuthorizationCode(code: string, verifier: string): Promise<TokenResponse> {
  const data = await postOAuthForm({
    grant_type: "authorization_code",
    code,
    redirect_uri: getCallbackUrl(),
    code_verifier: verifier,
  });
  return readTokenResponse(data);
}

async function getOCAccountProfile(accessToken: string): Promise<OCAccountSummary> {
  const data = await requestOCJson("/api/quest/v1/me", accessToken);
  const profile = data?.account || data;
  const id = typeof profile?.id === "string" || typeof profile?.id === "number"
    ? String(profile.id).trim()
    : "";
  const displayName = typeof profile?.displayName === "string"
    ? profile.displayName.trim()
    : typeof profile?.name === "string"
      ? profile.name.trim()
      : "";
  if (!id || !displayName || id.length > 256 || displayName.length > 160) {
    throw new OCAccountError(502, "oc_profile_invalid", "OC returned invalid account information.");
  }
  return { id, displayName };
}

export async function completeOCAccountConnection(
  code: string,
  state: string,
): Promise<{ uid: string; returnTo: string }> {
  if (!code || code.length > 4096) {
    throw new OCAccountError(400, "oauth_code_invalid", "OC did not return a valid authorization code.");
  }
  const authorization = await consumeOAuthState(state);
  try {
    const verifier = decrypt(authorization.codeVerifierEncrypted);
    const tokens = await exchangeAuthorizationCode(code, verifier);
    const account = await getOCAccountProfile(tokens.access_token);
    const firestore = getFirestore();
    const connectionRef = firestore.collection(CONNECTIONS).doc(authorization.uid);
    const existing = await connectionRef.get();
    const existingData = existing.exists ? existing.data() as OCAccountConnectionRecord : null;
    const sameOCAccount = existingData?.ocAccountId === account.id;
    const now = new Date().toISOString();

    const connection: OCAccountConnectionRecord = {
      uid: authorization.uid,
      ocAccountId: account.id,
      ocDisplayName: account.displayName,
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : sameOCAccount
          ? existingData?.refreshTokenEncrypted || null
          : null,
      accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope.split(/\s+/).filter(Boolean),
      selectedBrandKitId: sameOCAccount ? existingData?.selectedBrandKitId || null : null,
      selectedBrandKitName: sameOCAccount ? existingData?.selectedBrandKitName || null : null,
      connectedAt: sameOCAccount ? existingData?.connectedAt || now : now,
      updatedAt: now,
    };

    await connectionRef.set(connection);
    return { uid: authorization.uid, returnTo: authorization.returnTo };
  } catch (error) {
    if (error instanceof OCAccountError) {
      error.returnTo = authorization.returnTo;
      throw error;
    }
    throw new OCAccountError(
      502,
      "oc_account_exchange_failed",
      "OC account authorization could not be completed.",
      authorization.returnTo,
    );
  }
}

let refreshPromises = new Map<string, Promise<string>>();

async function refreshOCAccountToken(uid: string, force = false): Promise<string> {
  const pending = refreshPromises.get(uid);
  if (pending) return pending;

  const refreshPromise = (async () => {
    const connection = await readConnection(uid);
    if (!connection?.accessTokenEncrypted) {
      throw new OCAccountError(401, "oc_connection_missing", "Connect your OC account to continue.");
    }
    if (!force && connection.accessTokenExpiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
      return decrypt(connection.accessTokenEncrypted);
    }
    if (!connection.refreshTokenEncrypted) {
      throw new OCAccountError(401, "oc_reconnect_required", "Reconnect your OC account to continue.");
    }

    let data: any;
    try {
      data = await postOAuthForm({
        grant_type: "refresh_token",
        refresh_token: decrypt(connection.refreshTokenEncrypted),
      });
    } catch (error) {
      if (error instanceof OCAccountError && (error.status === 400 || error.status === 401 || error.status === 403)) {
        throw new OCAccountError(401, "oc_reconnect_required", "Reconnect your OC account to continue.");
      }
      throw error;
    }
    const tokens = readTokenResponse(data, connection.scopes);
    const updated: Partial<OCAccountConnectionRecord> = {
      accessTokenEncrypted: encrypt(tokens.access_token),
      accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope.split(/\s+/).filter(Boolean),
      updatedAt: new Date().toISOString(),
    };
    if (tokens.refresh_token) updated.refreshTokenEncrypted = encrypt(tokens.refresh_token);
    await getFirestore().collection(CONNECTIONS).doc(uid).set(updated, { merge: true });
    return tokens.access_token;
  })();

  refreshPromises.set(uid, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    refreshPromises.delete(uid);
  }
}

export async function requestOCAccountApi(
  uid: string,
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const accessToken = await refreshOCAccountToken(uid);
  try {
    return await requestOCJson(path, accessToken, options);
  } catch (error) {
    if (!(error instanceof OCAccountError) || error.status !== 401) throw error;
    const refreshedToken = await refreshOCAccountToken(uid, true);
    return requestOCJson(path, refreshedToken, options);
  }
}

export async function saveSelectedOCBrandKit(uid: string, kitId: string, kitName: string): Promise<void> {
  const connection = await readConnection(uid);
  if (!connection?.accessTokenEncrypted) {
    throw new OCAccountError(401, "oc_connection_missing", "Connect your OC account before selecting a brand kit.");
  }
  await getFirestore().collection(CONNECTIONS).doc(uid).set({
    selectedBrandKitId: kitId,
    selectedBrandKitName: kitName,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function getSelectedOCBrandKitId(uid: string): Promise<string> {
  const connection = await readConnection(uid);
  if (!connection?.accessTokenEncrypted) {
    throw new OCAccountError(401, "oc_connection_missing", "Connect your OC account to continue.");
  }
  if (!connection.selectedBrandKitId) {
    throw new OCAccountError(409, "oc_brand_kit_not_selected", "Select an OC brand kit before continuing.");
  }
  return connection.selectedBrandKitId;
}

export async function disconnectOCAccount(uid: string): Promise<{ revocationConfirmed: boolean }> {
  const firestore = getFirestore();
  const ref = firestore.collection(CONNECTIONS).doc(uid);
  const connection = await readConnection(uid);
  if (!connection) return { revocationConfirmed: true };

  let revocationConfirmed = false;
  try {
    const token = connection.refreshTokenEncrypted
      ? decrypt(connection.refreshTokenEncrypted)
      : decrypt(connection.accessTokenEncrypted);
    const { clientId, clientSecret } = getOAuthClient();
    const response = await fetch(new URL("/oauth/revoke", getOCBaseUrl()), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: basicClientAuthorization(clientId, clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
        token_type_hint: connection.refreshTokenEncrypted ? "refresh_token" : "access_token",
        client_id: clientId,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    revocationConfirmed = response.ok;
  } catch {
    revocationConfirmed = false;
  }

  await ref.delete();
  return { revocationConfirmed };
}

export function requiredOCAccountScopes(): readonly string[] {
  return REQUIRED_SCOPES;
}
