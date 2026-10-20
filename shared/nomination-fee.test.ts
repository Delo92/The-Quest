import assert from "node:assert/strict";
import test from "node:test";
import { getCompetitionNominationFeeCents } from "./nomination-fee";

test("uses the event-specific fee when configured", () => {
  assert.equal(getCompetitionNominationFeeCents(2500, 1000), 2500);
});

test("falls back to the site-wide fee when no event override is set", () => {
  assert.equal(getCompetitionNominationFeeCents(null, 1000), 1000);
  assert.equal(getCompetitionNominationFeeCents(undefined, 1000), 1000);
});

test("preserves a zero-dollar event override", () => {
  assert.equal(getCompetitionNominationFeeCents(0, 1000), 0);
});

test("rejects invalid fee data", () => {
  assert.throws(() => getCompetitionNominationFeeCents(-1, 1000));
  assert.throws(() => getCompetitionNominationFeeCents(null, 0.5));
});
