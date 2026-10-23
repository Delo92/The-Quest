import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupportEmail, SUPPORT_EMAIL } from "./support-contact";

test("missing or blank support details use the working mailbox", () => {
  for (const value of [undefined, null, "", "  "]) {
    assert.equal(resolveSupportEmail(value), SUPPORT_EMAIL);
  }
});

test("legacy placeholder contact details use the working mailbox", () => {
  assert.equal(resolveSupportEmail(" Admin@TheQuest.com "), "info@cbpublishing.live");
});

test("intentional contact overrides remain supported", () => {
  assert.equal(resolveSupportEmail(" help@example.com "), "help@example.com");
});
