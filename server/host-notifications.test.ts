import assert from "node:assert/strict";
import test from "node:test";
import { nextHostStatsSendAt } from "./host-notifications";

test("daily host stats are scheduled at 9 a.m. Central before and after the send time", () => {
  assert.equal(
    nextHostStatsSendAt(new Date("2026-10-28T13:59:00.000Z")).toISOString(),
    "2026-10-28T14:00:00.000Z",
  );
  assert.equal(
    nextHostStatsSendAt(new Date("2026-10-28T14:01:00.000Z")).toISOString(),
    "2026-10-29T14:00:00.000Z",
  );
});

test("daily host stats keep 9 a.m. Central across daylight-saving transitions", () => {
  assert.equal(
    nextHostStatsSendAt(new Date("2026-03-07T15:01:00.000Z")).toISOString(),
    "2026-03-08T14:00:00.000Z",
  );
  assert.equal(
    nextHostStatsSendAt(new Date("2026-10-31T14:01:00.000Z")).toISOString(),
    "2026-11-01T15:00:00.000Z",
  );
});
