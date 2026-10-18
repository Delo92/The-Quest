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
      assert.equal(form.get("scope"), "offline_access https://outlook.office.com/SMTP.Send");
      return new Response(JSON.stringify({
        device_code: "private-device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://microsoft.com/devicelogin",
        expires_in: 900,
        interval: 5,
      }), { status: 200 });
    }

    tokenPolls++;
    assert.equal(form.get("device_code"), "private-device-code");
    if (tokenPolls === 1) {
      return new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 });
    }
    return new Response(JSON.stringify({
      access_token: "temporary-access-token",
      refresh_token: "long-lived-refresh-token",
    }), { status: 200 });
  };

  const dependencies = {
    firestore: fixture.firestore,
    fetch: fetch as typeof globalThis.fetch,
    encrypt: (value: string) => `encrypted:${value}`,
    decrypt: (value: string) => value.replace(/^encrypted:/, ""),
    encryptionKeyReady: () => true,
    createId: () => FLOW_ID,
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
    encryptedRefreshToken: "encrypted:long-lived-refresh-token",
    connectedAt: new Date(now).toISOString(),
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
    createId: () => FLOW_ID,
    now: () => 1_000,
  });

  assert.equal(sentClientId, CLIENT_ID);
  assert.equal(requestedScope, "offline_access https://outlook.office.com/SMTP.Send");
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
