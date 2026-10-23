import assert from "node:assert/strict";
import test from "node:test";
import {
  pollMicrosoftEmailDeviceAuthorization,
  startMicrosoftEmailDeviceAuthorization,
} from "./microsoft-email-oauth";
import type { getFirestore } from "./firebase-admin";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const FLOW_ID = "33333333-3333-4333-8333-333333333333";

function firestoreFixture() {
  const collections = new Map<string, Map<string, Record<string, any>>>();
  const firestore = {
    collection(name: string) {
      let records = collections.get(name);
      if (!records) {
        records = new Map();
        collections.set(name, records);
      }
      return {
        doc(id: string) {
          return {
            async get() {
              const record = records?.get(id);
              return { exists: Boolean(record), data: () => record };
            },
            async set(data: Record<string, any>, options?: { merge?: boolean }) {
              const prior = records?.get(id);
              records?.set(id, options?.merge ? { ...prior, ...data } : { ...data });
            },
            async update(data: Record<string, any>) {
              const prior = records?.get(id);
              if (!prior) throw new Error("Document does not exist");
              records?.set(id, { ...prior, ...data });
            },
            async delete() {
              records?.delete(id);
            },
          };
        },
      };
    },
  };
  return {
    firestore: firestore as unknown as ReturnType<typeof getFirestore>,
    read: (collection: string, id: string) => collections.get(collection)?.get(id),
  };
}

test("Microsoft device authorization does not replace the current sender before approval", async () => {
  const fixture = firestoreFixture();
  const originalSender = {
    tenantId: "old-tenant",
    clientId: "old-client",
    mailboxAddress: "legacy@gmail.com",
    activeProvider: "gmail",
    encryptedRefreshToken: "existing-token",
  };
  await fixture.firestore.collection("serverEmailAuth").doc("microsoft365").set(originalSender);

  let now = 1_000;
  let tokenPolls = 0;
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const form = new URLSearchParams(String(init?.body || ""));
    if (url.endsWith("/devicecode")) {
      assert.equal(form.get("client_id"), CLIENT_ID);
      assert.equal(
        form.get("scope"),
        "offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send",
      );
      return new Response(JSON.stringify({
        device_code: "private-device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://microsoft.com/devicelogin",
        expires_in: 900,
        interval: 5,
      }), { status: 200 });
    }

    if (form.get("grant_type") === "refresh_token") {
      assert.equal(form.get("refresh_token"), "long-lived-refresh-token");
      assert.equal(form.get("scope"), "offline_access https://outlook.office.com/SMTP.Send");
      return new Response(JSON.stringify({
        access_token: "smtp-access-token",
        refresh_token: "rotated-refresh-token",
        scope: "https://outlook.office.com/SMTP.Send",
      }), { status: 200 });
    }
    tokenPolls++;
    assert.equal(form.get("scope"), "offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send");
    assert.equal(form.get("device_code"), "private-device-code");
    if (tokenPolls === 1) {
      return new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 });
    }
    return new Response(JSON.stringify({
      access_token: "temporary-access-token",
      refresh_token: "long-lived-refresh-token",
      scope: "Mail.Read Mail.Send",
    }), { status: 200 });
  };

  const dependencies = {
    firestore: fixture.firestore,
    environment: {},
    fetch: fetch as typeof globalThis.fetch,
    encrypt: (value: string) => `encrypted:${value}`,
    decrypt: (value: string) => value.replace(/^encrypted:/, ""),
    encryptionKeyReady: () => true,
    createId: (): typeof FLOW_ID => FLOW_ID,
    now: () => now,
  };

  const flow = await startMicrosoftEmailDeviceAuthorization(
    { clientId: CLIENT_ID, tenantId: TENANT_ID },
    dependencies,
  );
  assert.equal(flow.flowId, FLOW_ID);
  assert.equal(fixture.read("serverEmailAuth", "microsoft365")?.activeProvider, "gmail");
  assert.equal(fixture.read("serverEmailAuthFlows", FLOW_ID)?.encryptedDeviceCode, "encrypted:private-device-code");
  assert.equal(JSON.stringify(flow).includes("private-device-code"), false);

  now += 5_000;
  assert.deepEqual(
    await pollMicrosoftEmailDeviceAuthorization(FLOW_ID, dependencies),
    { status: "pending", retryAfterSeconds: 5 },
  );
  assert.equal(fixture.read("serverEmailAuth", "microsoft365")?.activeProvider, "gmail");

  now += 5_000;
  assert.deepEqual(
    await pollMicrosoftEmailDeviceAuthorization(FLOW_ID, dependencies),
    { status: "connected" },
  );
  assert.equal(tokenPolls, 2);
  assert.deepEqual(fixture.read("serverEmailAuth", "microsoft365"), {
    ...originalSender,
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    mailboxAddress: "info@cbpublishing.live",
    activeProvider: "microsoft365",
    encryptedRefreshToken: "encrypted:rotated-refresh-token",
    connectedAt: new Date(now).toISOString(),
    mailboxAccessGranted: true,
  });
  assert.equal(fixture.read("serverEmailAuthFlows", FLOW_ID), undefined);
});

test("invalid Microsoft app IDs are rejected before contacting Microsoft", async () => {
  const fixture = firestoreFixture();
  let requested = false;

  await assert.rejects(
    startMicrosoftEmailDeviceAuthorization(
      { clientId: "not-a-guid", tenantId: TENANT_ID },
      {
        firestore: fixture.firestore,
        environment: {},
        fetch: (async () => {
          requested = true;
          return new Response("{}");
        }) as typeof globalThis.fetch,
        encryptionKeyReady: () => true,
      },
    ),
    /Application \(client\) ID/,
  );
  assert.equal(requested, false);
  assert.equal(fixture.read("serverEmailAuthFlows", FLOW_ID), undefined);
});

test("Microsoft device authorization uses server environment IDs without requiring them in the request", async () => {
  const fixture = firestoreFixture();
  let sentClientId = "";
  let requestedScope = "";

  const flow = await startMicrosoftEmailDeviceAuthorization({}, {
    firestore: fixture.firestore,
    environment: {
      MICROSOFT_EMAIL_CLIENT_ID: CLIENT_ID,
      MICROSOFT_EMAIL_TENANT_ID: TENANT_ID,
    },
    fetch: (async (_input, init) => {
      const form = new URLSearchParams(String(init?.body || ""));
      sentClientId = form.get("client_id") || "";
      requestedScope = form.get("scope") || "";
      return new Response(JSON.stringify({
        device_code: "private-device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://microsoft.com/devicelogin",
        expires_in: 900,
        interval: 5,
      }), { status: 200 });
    }) as typeof globalThis.fetch,
    encrypt: (value: string) => `encrypted:${value}`,
    encryptionKeyReady: () => true,
    createId: (): typeof FLOW_ID => FLOW_ID,
    now: () => 1_000,
  });

  assert.equal(sentClientId, CLIENT_ID);
  assert.equal(
    requestedScope,
    "offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send",
  );
  assert.equal(flow.flowId, FLOW_ID);
  assert.equal(fixture.read("serverEmailAuthFlows", FLOW_ID)?.tenantId, TENANT_ID);
});

test("partial Microsoft environment configuration fails instead of using request IDs", async () => {
  const fixture = firestoreFixture();
  let requested = false;

  await assert.rejects(
    startMicrosoftEmailDeviceAuthorization(
      { clientId: CLIENT_ID, tenantId: TENANT_ID },
      {
        firestore: fixture.firestore,
        environment: { MICROSOFT_EMAIL_CLIENT_ID: CLIENT_ID },
        fetch: (async () => {
          requested = true;
          return new Response("{}");
        }) as typeof globalThis.fetch,
        encryptionKeyReady: () => true,
      },
    ),
    /Set both MICROSOFT_EMAIL_CLIENT_ID and MICROSOFT_EMAIL_TENANT_ID/,
  );
  assert.equal(requested, false);
  assert.equal(fixture.read("serverEmailAuthFlows", FLOW_ID), undefined);
});

async function approvedFlowFixture(fetcher: typeof fetch) {
  const fixture = firestoreFixture();
  const originalSender = {
    activeProvider: "microsoft365",
    encryptedRefreshToken: "existing-sender-token",
    mailboxAccessGranted: false,
  };
  await fixture.firestore.collection("serverEmailAuth").doc("microsoft365").set(originalSender);
  await fixture.firestore.collection("serverEmailAuthFlows").doc(FLOW_ID).set({
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    encryptedDeviceCode: "encrypted:private-device-code",
    expiresAtMs: 900_000,
    intervalSeconds: 5,
    nextPollAtMs: 0,
  });
  let now = 1_000;
  return {
    ...fixture,
    originalSender,
    advance: () => { now += 5_000; },
    dependencies: {
      firestore: fixture.firestore,
      fetch: fetcher,
      encrypt: (value: string) => `encrypted:${value}`,
      decrypt: (value: string) => value.replace(/^encrypted:/, ""),
      encryptionKeyReady: () => true,
      now: () => now,
    },
  };
}

test("mixed-resource errors expose the safe Microsoft code, not the response body", async () => {
  const f = await approvedFlowFixture(async (_input, init) => {
    const form = new URLSearchParams(String(init?.body || ""));
    assert.equal(form.get("scope")?.includes("outlook.office.com"), false);
    return new Response(JSON.stringify({
      error: "invalid_request",
      error_codes: [28000],
      error_description: "Sensitive details that must not be exposed",
    }), { status: 400 });
  });
  const result = await pollMicrosoftEmailDeviceAuthorization(FLOW_ID, f.dependencies);
  assert.equal(result.status, "failed");
  assert.match("message" in result ? result.message : "", /AADSTS28000/);
  assert.doesNotMatch(JSON.stringify(result), /Sensitive details|private-device-code|existing-sender-token/);
  assert.deepEqual(f.read("serverEmailAuth", "microsoft365"), f.originalSender);
});

test("incomplete Graph approval cannot enable inbox access or replace the sender", async () => {
  let calls = 0;
  const f = await approvedFlowFixture(async () => {
    calls++;
    return new Response(JSON.stringify({
      access_token: "graph-token", refresh_token: "graph-refresh", scope: "Mail.Read",
    }));
  });
  const result = await pollMicrosoftEmailDeviceAuthorization(FLOW_ID, f.dependencies);
  assert.equal(result.status, "failed");
  assert.equal(calls, 1);
  assert.deepEqual(f.read("serverEmailAuth", "microsoft365"), f.originalSender);
});

test("SMTP approval is checked separately and denial preserves the current sender", async () => {
  const f = await approvedFlowFixture(async (_input, init) => {
    const form = new URLSearchParams(String(init?.body || ""));
    if (form.get("grant_type") === "refresh_token") {
      assert.equal(form.get("scope"), "offline_access https://outlook.office.com/SMTP.Send");
      assert.equal(form.get("refresh_token"), "graph-refresh");
      return new Response(JSON.stringify({ error: "consent_required" }), { status: 400 });
    }
    return new Response(JSON.stringify({
      access_token: "graph-token", refresh_token: "graph-refresh", scope: "Mail.Read Mail.Send",
    }));
  });
  const result = await pollMicrosoftEmailDeviceAuthorization(FLOW_ID, f.dependencies);
  assert.equal(result.status, "failed");
  assert.match("message" in result ? result.message : "", /SMTP sending permission/);
  assert.deepEqual(f.read("serverEmailAuth", "microsoft365"), f.originalSender);
});

test("a transient SMTP failure resumes encrypted approval without consuming the device code twice", async () => {
  let deviceCalls = 0;
  let smtpCalls = 0;
  const f = await approvedFlowFixture(async (_input, init) => {
    const form = new URLSearchParams(String(init?.body || ""));
    if (form.get("grant_type") === "refresh_token") {
      smtpCalls++;
      if (smtpCalls === 1) return new Response(JSON.stringify({ error: "temporarily_unavailable" }), { status: 503 });
      return new Response(JSON.stringify({
        access_token: "smtp-token", refresh_token: "rotated-refresh",
        scope: "https://outlook.office.com/SMTP.Send",
      }));
    }
    deviceCalls++;
    return new Response(JSON.stringify({
      access_token: "graph-token", refresh_token: "graph-refresh",
      scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send",
    }));
  });
  assert.deepEqual(await pollMicrosoftEmailDeviceAuthorization(FLOW_ID, f.dependencies), { status: "pending", retryAfterSeconds: 5 });
  assert.equal(f.read("serverEmailAuthFlows", FLOW_ID)?.encryptedApprovedRefreshToken, "encrypted:graph-refresh");
  assert.deepEqual(f.read("serverEmailAuth", "microsoft365"), f.originalSender);
  f.advance();
  assert.deepEqual(await pollMicrosoftEmailDeviceAuthorization(FLOW_ID, f.dependencies), { status: "connected" });
  assert.equal(deviceCalls, 1);
  assert.equal(smtpCalls, 2);
  assert.equal(f.read("serverEmailAuth", "microsoft365")?.encryptedRefreshToken, "encrypted:rotated-refresh");
  assert.equal(f.read("serverEmailAuth", "microsoft365")?.mailboxAccessGranted, true);
  assert.equal(f.read("serverEmailAuthFlows", FLOW_ID), undefined);
});

test("Microsoft slow-down responses preserve the flow and increase the polling interval", async () => {
  const f = await approvedFlowFixture(async () => new Response(JSON.stringify({ error: "slow_down" }), { status: 400 }));
  assert.deepEqual(await pollMicrosoftEmailDeviceAuthorization(FLOW_ID, f.dependencies), { status: "pending", retryAfterSeconds: 10 });
  assert.equal(f.read("serverEmailAuthFlows", FLOW_ID)?.intervalSeconds, 10);
  assert.deepEqual(f.read("serverEmailAuth", "microsoft365"), f.originalSender);
});
