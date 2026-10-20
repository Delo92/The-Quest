import assert from "node:assert/strict";
import test from "node:test";
import { buildOCReferralUrl } from "./oc-referral";

test("OC referral links carry consented profile prefill and campaign details", () => {
  const url = new URL(buildOCReferralUrl({
    role: "artist",
    email: "artist@example.com",
    displayName: "The Artist",
    stageName: "Stage Name",
    socialLinks: {
      instagram: "https://instagram.com/example",
      youtube: "https://youtube.com/@example",
      invalid: "javascript:alert(1)",
      customLinks: [{ label: "Website", url: "https://example.com" }],
    },
  }));

  assert.equal(url.origin + url.pathname, "https://oraginalconcepts.com/s/TheQuest/referral");
  assert.equal(url.searchParams.get("source"), "the-quest");
  assert.equal(url.searchParams.get("promoCode"), "THE QUEST");
  assert.equal(url.searchParams.get("role"), "artist");
  assert.equal(url.searchParams.get("email"), "artist@example.com");
  assert.equal(url.searchParams.get("brandName"), "Stage Name");
  assert.equal(url.searchParams.get("artistName"), "Stage Name");
  assert.deepEqual(JSON.parse(url.searchParams.get("socialLinks") || "{}"), {
    instagram: "https://instagram.com/example",
    youtube: "https://youtube.com/@example",
    customLinks: [{ label: "Website", url: "https://example.com/" }],
  });
});

test("OC referral links omit unavailable profile values and use display name as brand fallback", () => {
  const url = new URL(buildOCReferralUrl({
    role: "host",
    displayName: "Quest Host",
    email: " ",
    socialLinks: null,
  }));

  assert.equal(url.searchParams.get("brandName"), "Quest Host");
  assert.equal(url.searchParams.get("displayName"), "Quest Host");
  assert.equal(url.searchParams.has("email"), false);
  assert.equal(url.searchParams.has("socialLinks"), false);
  assert.equal(url.searchParams.has("artistName"), false);
});
