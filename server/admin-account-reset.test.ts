import test from "node:test";
import assert from "node:assert/strict";
import { resetAdminAccount } from "./admin-account-reset";
import { getTemporaryAccountPassword } from "./account-email-access";

function fixture({ missing = false, delivery = true, throwOnSend = false } = {}) {
  const calls: string[] = [];
  const dependencies = {
    getUser: async (uid: string) => {
      assert.equal(uid, "sample-user");
      return missing ? null : { email: "nominee@example.com", displayName: "Sample Nominee", level: 2 };
    },
    setPassword: async (uid: string, password: string) => {
      assert.equal(uid, "sample-user");
      assert.ok(password === getTemporaryAccountPassword());
      calls.push("set-password");
    },
    revokeSessions: async (uid: string) => { assert.equal(uid, "sample-user"); calls.push("revoke"); },
    recordReset: async (uid: string, audit: { adminPasswordResetAt: string; adminPasswordResetBy: string }) => {
      assert.equal(uid, "sample-user");
      assert.equal(audit.adminPasswordResetBy, "sample-admin");
      assert.ok(Number.isFinite(Date.parse(audit.adminPasswordResetAt)));
      calls.push("audit");
    },
    sendEmail: async (options: { to: string; name: string; level: number; temporaryPassword: string; siteUrl: string }) => {
      assert.equal(options.to, "nominee@example.com");
      assert.equal(options.level, 2);
      assert.ok(options.temporaryPassword === getTemporaryAccountPassword());
      calls.push("email");
      if (throwOnSend) throw new Error("Sample email failure");
      return delivery;
    },
  };
  return { calls, dependencies };
}

const options = { uid: "sample-user", adminUid: "sample-admin", sendEmail: true, siteUrl: "https://quest.example" };

test("admin reset changes credentials, revokes sessions, records audit, then emails the matching credential", async () => {
  const { calls, dependencies } = fixture();
  const result = await resetAdminAccount(options, dependencies);
  assert.deepEqual(calls, ["set-password", "revoke", "audit", "email"]);
  assert.equal(result.emailSent, true);
  assert.ok(result.temporaryPassword === getTemporaryAccountPassword());
});

test("reset-only action does not send an email", async () => {
  const { calls, dependencies } = fixture();
  const result = await resetAdminAccount({ ...options, sendEmail: false }, dependencies);
  assert.deepEqual(calls, ["set-password", "revoke", "audit"]);
  assert.equal(result.emailSent, null);
});

test("failed email delivery is explicit after a successful reset", async () => {
  for (const throwOnSend of [false, true]) {
    const { dependencies } = fixture({ delivery: false, throwOnSend });
    const result = await resetAdminAccount(options, dependencies);
    assert.equal(result.emailSent, false);
    assert.ok(result.temporaryPassword === getTemporaryAccountPassword());
    assert.ok(result.resetAt);
  }
});

test("a missing account causes no password change, audit write, or email", async () => {
  const { calls, dependencies } = fixture({ missing: true });
  await assert.rejects(resetAdminAccount(options, dependencies), /User not found/);
  assert.deepEqual(calls, []);
});
