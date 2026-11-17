import assert from "node:assert/strict";
import test from "node:test";
import {
  getCompetitionEndTimestamp,
  getEffectiveCompetitionStatus,
  isCompetitionClosed,
} from "./competition-lifecycle";

const afterRaplahomaEnd = Date.parse("2026-11-17T12:00:00.000Z");

test("scheduled active competition becomes completed after voting closes", () => {
  const raplahoma = {
    status: "active",
    endDate: "2026-11-14T08:00:00.000Z",
    votingEndDate: "2026-11-14T08:00:00.000Z",
  };

  assert.equal(getEffectiveCompetitionStatus(raplahoma, afterRaplahomaEnd), "completed");
  assert.equal(isCompetitionClosed(raplahoma, afterRaplahomaEnd), true);
});

test("date-only competition deadlines remain open through their final day", () => {
  const competition = { status: "voting", votingEndDate: "2026-11-17" };

  assert.equal(
    getCompetitionEndTimestamp(competition),
    Date.parse("2026-11-17T23:59:59.999Z"),
  );
  assert.equal(isCompetitionClosed(competition, Date.parse("2026-11-17T12:00:00.000Z")), false);
  assert.equal(isCompetitionClosed(competition, Date.parse("2026-11-18T00:00:00.000Z")), true);
});

test("future, undated, and already-cancelled statuses are preserved correctly", () => {
  assert.equal(
    getEffectiveCompetitionStatus(
      { status: "voting", votingEndDate: "2026-11-18T00:00:00.000Z" },
      afterRaplahomaEnd,
    ),
    "voting",
  );
  assert.equal(getEffectiveCompetitionStatus({ status: "active" }, afterRaplahomaEnd), "active");
  assert.equal(isCompetitionClosed({ status: "cancelled" }, afterRaplahomaEnd), true);
});
