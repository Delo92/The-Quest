import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVoteSupportCopy } from "./vote-support-copy";

test("legacy vote-sale copy is expressed as vote donations", () => {
  const result = normalizeVoteSupportCopy(
    "Paid Vote Contributions are final once processed. Paid vote packages can be purchased. Can votes be purchased?",
  );
  assert.equal(
    result,
    "Vote donations are final once processed. Donations can be made to support votes. How can I support voting with a donation?",
  );
});

test("unrelated host fees and commercial purchases are left unchanged", () => {
  const source = "The host fee is separate. Purchase event tickets through the venue.";
  assert.equal(normalizeVoteSupportCopy(source), source);
});
