import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCentralDayKey,
  hasDailyScanPassed,
  hasReminderAttemptedToday,
  nextDailyScanAt,
} from "./reminder-schedule";

test("daily scans stay at 9 a.m. Central across daylight-saving changes", () => {
  assert.equal(
    nextDailyScanAt(new Date("2026-03-07T14:00:00.000Z")).toISOString(),
    "2026-03-07T15:00:00.000Z",
  );
  assert.equal(
    nextDailyScanAt(new Date("2026-03-08T13:00:00.000Z")).toISOString(),
    "2026-03-08T14:00:00.000Z",
  );
});

test("a late server start is recognized as needing today's catch-up scan", () => {
  assert.equal(hasDailyScanPassed(new Date("2026-10-29T13:59:59.000Z")), false);
  assert.equal(hasDailyScanPassed(new Date("2026-10-29T14:00:00.000Z")), true);
  assert.equal(
    nextDailyScanAt(new Date("2026-10-29T14:01:00.000Z")).toISOString(),
    "2026-10-30T14:00:00.000Z",
  );
});

test("reminder claims use Central calendar days and protect legacy states", () => {
  const today = new Date("2026-10-29T14:00:00.000Z");
  assert.equal(getCentralDayKey(today), "2026-10-29");
  assert.equal(hasReminderAttemptedToday("2026-10-29", null, today), true);
  assert.equal(hasReminderAttemptedToday(null, "2026-10-29T14:05:00.000Z", today), true);
  assert.equal(hasReminderAttemptedToday(null, "2026-10-29T14:05:00.000Z", new Date("2026-10-30T14:00:00.000Z")), false);
});
