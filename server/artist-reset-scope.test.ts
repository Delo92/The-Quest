import test from "node:test";
import assert from "node:assert/strict";
import { artistResetEligibility } from "./artist-reset-scope";

const artist = { userLevel: 2, authLevel: 2, roles: ["talent"], ownsCompetition: false, authExists: true, disabled: false, email: "sample@example.com" };

test("only enabled artist accounts with usable emails are eligible", () => {
  assert.equal(artistResetEligibility(artist), "eligible");
  assert.equal(artistResetEligibility({ ...artist, disabled: true }), "disabled");
  assert.equal(artistResetEligibility({ ...artist, email: "" }), "missing-email");
  assert.equal(artistResetEligibility({ ...artist, authExists: false }), "missing-account");
});

test("any host or admin signal excludes an account even if other records say artist", () => {
  assert.equal(artistResetEligibility({ ...artist, userLevel: 3 }), "host-admin");
  assert.equal(artistResetEligibility({ ...artist, userLevel: 4 }), "host-admin");
  assert.equal(artistResetEligibility({ ...artist, authLevel: 3 }), "host-admin");
  assert.equal(artistResetEligibility({ ...artist, roles: ["talent", "Host"] }), "host-admin");
  assert.equal(artistResetEligibility({ ...artist, roles: ["talent", "admin"] }), "host-admin");
  assert.equal(artistResetEligibility({ ...artist, ownsCompetition: true }), "host-admin");
});

test("viewers and inconsistent account types are not reset", () => {
  assert.equal(artistResetEligibility({ ...artist, userLevel: 1, authLevel: 1, roles: ["viewer"] }), "not-artist");
  assert.equal(artistResetEligibility({ ...artist, userLevel: 1 }), "role-conflict");
});
