import assert from "node:assert/strict";
import test from "node:test";
import { buildReferralCodeUsageNotice, nextReferralUsageCount } from "./referral-code-notification";

test("referral use counts continue from the saved total or legacy unique-user baseline", () => {
  assert.equal(nextReferralUsageCount(8, 3), 9);
  assert.equal(nextReferralUsageCount(undefined, 5), 6);
  assert.equal(nextReferralUsageCount(undefined, undefined), 1);
});

test("referral use notice reports only the code and aggregate usage count", () => {
  const notice = buildReferralCodeUsageNotice("YUNGSTOERRA", 12);

  assert.match(notice.subject, /12 recorded times/);
  assert.match(notice.bodyHtml, /YUNGSTOERRA/);
  assert.match(notice.bodyHtml, /12 recorded times/);
  assert.doesNotMatch(notice.bodyHtml, /used by|nominated|competition|@/i);
});

test("referral use notice handles one use and escapes code text", () => {
  const notice = buildReferralCodeUsageNotice("<CODE>", 1);

  assert.match(notice.subject, /1 recorded time/);
  assert.match(notice.bodyHtml, /&lt;CODE&gt;/);
  assert.match(notice.bodyHtml, /1 recorded time/);
  assert.doesNotMatch(notice.bodyHtml, /<CODE>/);
});
