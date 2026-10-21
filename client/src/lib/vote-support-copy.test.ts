import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVoteSupportCopy } from "../../../shared/vote-support-copy";

test("normalizes legacy voter-facing copy without rewriting other payments", () => {
  const copy = [
    "Can additional votes be purchased?",
    "Purchased votes are non-refundable.",
    "You can buy votes for a contestant.",
    "Vote packages can be purchased.",
    "Votes can be bought.",
    "Your Quest Purchase Receipt",
    "Thank you for your purchase!",
    "Hosts may purchase an event package.",
  ].join("\n");

  const normalized = normalizeVoteSupportCopy(copy);
  assert.match(normalized, /How can I contribute to add votes\?/);
  assert.match(normalized, /Paid votes are non-refundable/);
  assert.match(normalized, /donate to add votes/);
  assert.match(normalized, /vote contribution options are available/i);
  assert.match(normalized, /votes can be supported with a contribution/i);
  assert.match(normalized, /Your Quest Vote Support Confirmation/);
  assert.match(normalized, /Thank you for your vote contribution/i);
  assert.match(normalized, /Hosts may purchase an event package/);
  assert.doesNotMatch(normalized, /purchased votes|buy votes|votes be purchased/i);
});
