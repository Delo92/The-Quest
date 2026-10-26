import assert from "node:assert/strict";
import test from "node:test";
import {
  getContestantDivisionLabel,
  getContestantDivisionOptions,
  getCompetitionPublicDescription,
  resolveContestantDivision,
} from "./competition-divisions";

const chronicCuties = {
  title: "Chronic Cuties of Hawaii",
  category: "Modeling/Fashion",
};

test("Chronic Cuties offers Cuties and Hunks as entrant divisions", () => {
  assert.deepEqual(getContestantDivisionOptions(chronicCuties), [
    "Chronic Cuties",
    "Chronic Hunks",
  ]);
});

test("other competitions do not gain divisions", () => {
  assert.deepEqual(getContestantDivisionOptions({
    title: "A Different Modeling Event",
    category: "Modeling/Fashion",
  }), []);
});

test("division validation requires an explicit choice when requested and preserves the legacy label", () => {
  assert.equal(
    resolveContestantDivision(chronicCuties, undefined, true).error,
    "Please choose a contestant division.",
  );
  assert.equal(
    resolveContestantDivision(chronicCuties, "Chronic Hunks", true).contestantDivision,
    "Chronic Hunks",
  );
  assert.ok(resolveContestantDivision(chronicCuties, "Not a division").error);
  assert.equal(getContestantDivisionLabel(chronicCuties, null), "Chronic Cuties");
});

test("the Chronic Cuties public copy welcomes entrants of all genders without changing other event text", () => {
  assert.equal(
    getCompetitionPublicDescription({
      ...chronicCuties,
      description: "Seeking dynamic, confident women ready to represent Hawaii. Model entry is $10.",
    }),
    "Seeking dynamic, confident models of all genders ready to represent Hawaii. Model entry is $10.",
  );
});
