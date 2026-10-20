import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  buildOCAccountAuthorizationUrl,
  createOCAccountPkcePair,
  isAllowedOCAccountReturnTo,
} from "./oc-account-connection";

test("OC account connection creates a valid S256 PKCE challenge", () => {
  const { verifier, challenge } = createOCAccountPkcePair();
  const expectedChallenge = createHash("sha256").update(verifier).digest("base64url");

  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(challenge, expectedChallenge);
});

test("OC authorization URL requests the required user-consented scopes", () => {
  const authorizationUrl = new URL(buildOCAccountAuthorizationUrl({
    baseUrl: "https://oraginalconcepts.com",
    clientId: "quest-client",
    redirectUri: "https://quest.example/api/oc/account/callback",
    state: "one-time-state",
    codeChallenge: "pkce-challenge",
  }));

  assert.equal(authorizationUrl.origin, "https://oraginalconcepts.com");
  assert.equal(authorizationUrl.pathname, "/oauth/authorize");
  assert.equal(authorizationUrl.searchParams.get("client_id"), "quest-client");
  assert.equal(authorizationUrl.searchParams.get("redirect_uri"), "https://quest.example/api/oc/account/callback");
  assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
  assert.equal(authorizationUrl.searchParams.get("scope"), "brand-kits:read social-accounts:read social-posts:publish");
  assert.equal(authorizationUrl.searchParams.get("state"), "one-time-state");
  assert.equal(authorizationUrl.searchParams.get("code_challenge"), "pkce-challenge");
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
});

test("OC account callbacks allow only the Quest dashboard route", () => {
  assert.equal(isAllowedOCAccountReturnTo("/thequest/dashboard"), true);
  assert.equal(isAllowedOCAccountReturnTo("/host-dashboard"), false);
  assert.equal(isAllowedOCAccountReturnTo("/talent-dashboard"), false);
  assert.equal(isAllowedOCAccountReturnTo("https://example.com"), false);
  assert.equal(isAllowedOCAccountReturnTo("//example.com"), false);
  assert.equal(isAllowedOCAccountReturnTo("/admin"), false);
});
