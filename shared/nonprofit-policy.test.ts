import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePlatformMatchAllocations,
  effectiveNonprofitContributionRate,
  hasPrizeReadyNonprofitDeclaration,
  nonprofitAllocationCents,
} from "./nonprofit-policy";

test("an unset rate uses the 10% default for payout deductions", () => {
  assert.equal(effectiveNonprofitContributionRate(undefined), 10);
  assert.equal(effectiveNonprofitContributionRate(null), 10);
  assert.equal(nonprofitAllocationCents(10_000, undefined), 1_000);
});

test("a saved contribution rate applies to the participant's eligible share", () => {
  assert.equal(effectiveNonprofitContributionRate(4.5), 4.5);
  assert.equal(nonprofitAllocationCents(10_000, 4.5), 450);
  assert.equal(effectiveNonprofitContributionRate(11), null);
});

test("payout readiness requires an explicit acknowledgment snapshot", () => {
  const base = { publicName: "Community Arts Fund", programAcknowledged: true };

  assert.equal(
    hasPrizeReadyNonprofitDeclaration({
      ...base,
      contributionRate: null,
      contributionRateAtAcknowledgment: 10,
    }),
    true,
  );
  assert.equal(
    hasPrizeReadyNonprofitDeclaration({
      ...base,
      contributionRate: null,
      contributionRateAtAcknowledgment: null,
    }),
    false,
  );
  assert.equal(
    hasPrizeReadyNonprofitDeclaration({
      ...base,
      contributionRate: 5,
      contributionRateAtAcknowledgment: 10,
    }),
    false,
  );
});

test("The Quest matches each contribution dollar-for-dollar when its share permits", () => {
  const matches = calculatePlatformMatchAllocations([
    {
      sourceId: "contestant-1",
      donorName: "Contestant",
      donorRole: "contestant",
      nonprofitName: "Community Arts Fund",
      contributionCents: 1_250,
    },
    {
      sourceId: "host-1",
      donorName: "Host",
      donorRole: "host",
      nonprofitName: "Local Food Bank",
      contributionCents: 750,
    },
  ], 2_000);

  assert.deepEqual(matches.map(({ sourceId, matchCents }) => [sourceId, matchCents]), [
    ["contestant-1", 1_250],
    ["host-1", 750],
  ]);
});

test("aggregate matches never exceed The Quest's available share or a participant's contribution", () => {
  const matches = calculatePlatformMatchAllocations([
    {
      sourceId: "contestant-1",
      donorName: "Contestant",
      donorRole: "contestant",
      nonprofitName: "Community Arts Fund",
      contributionCents: 1_200,
    },
    {
      sourceId: "host-1",
      donorName: "Host",
      donorRole: "host",
      nonprofitName: "Local Food Bank",
      contributionCents: 800,
    },
  ], 900);

  assert.equal(matches.reduce((sum, match) => sum + match.matchCents, 0), 900);
  assert.ok(matches.every((match) => match.matchCents <= match.contributionCents));
});