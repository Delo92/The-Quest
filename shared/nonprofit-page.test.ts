import assert from "node:assert/strict";
import test from "node:test";
import {
  collectPublicNonprofitOrganizations,
  nonprofitLogoMediaKey,
  nonprofitPageTextLiveryDefaults,
} from "./nonprofit-page";

test("public nonprofit roster exposes only declared public names and safe websites", () => {
  const result = collectPublicNonprofitOrganizations([
    {
      role: "talent",
      nonprofitDeclaration: {
        publicName: "  Neighborhood   Arts Fund ",
        legalName: "Private Legal Name",
        website: "https://arts.example.org/path",
        donationContactEmail: "private@example.org",
        taxIdLast4: "1234",
      } as any,
    },
    {
      role: "host",
      nonprofitDeclaration: {
        publicName: "Neighborhood Arts Fund",
        website: "javascript:alert(1)",
      } as any,
    },
    {
      role: "admin",
      nonprofitDeclaration: { publicName: "Admin Organization", website: "https://admin.example.org" } as any,
    },
    {
      role: "talent",
      nonprofitDeclaration: { publicName: "   ", website: "https://empty.example.org" } as any,
    },
  ]);

  assert.deepEqual(result, [{
    name: "Neighborhood Arts Fund",
    website: "https://arts.example.org/path",
    logoKey: nonprofitLogoMediaKey("Neighborhood Arts Fund"),
  }]);
  assert.doesNotMatch(JSON.stringify(result), /Private Legal Name|private@example\.org|1234/);
});

test("nonprofit logo media keys are deterministic and page text defaults are editable Livery items", () => {
  assert.equal(nonprofitLogoMediaKey("It Stops Now Foundation"), nonprofitLogoMediaKey("It Stops Now Foundation"));
  assert.notEqual(nonprofitLogoMediaKey("It Stops Now Foundation"), nonprofitLogoMediaKey("Event Pro Group Foundation"));

  const defaults = nonprofitPageTextLiveryDefaults();
  assert.ok(defaults.length >= 20);
  assert.ok(defaults.every((item) => item.itemType === "text" && item.defaultText));
  assert.equal(new Set(defaults.map((item) => item.imageKey)).size, defaults.length);

  const textByKey = new Map(defaults.map((item) => [item.imageKey, item.defaultText || ""]));
  const mandatoryContributionCopy = [
    textByKey.get("nonprofits_hero_copy"),
    textByKey.get("nonprofits_flow_copy"),
    textByKey.get("nonprofits_step_1_copy"),
    textByKey.get("nonprofits_step_2_copy"),
    textByKey.get("nonprofits_example_note"),
    textByKey.get("nonprofits_clarity_copy"),
  ].join(" ");
  assert.match(mandatoryContributionCopy, /required to contribute|required contribution|must choose/i);
  assert.doesNotMatch(mandatoryContributionCopy, /\b(?:can|may) contribute\b/i);

  const matchCopy = [
    textByKey.get("nonprofits_hero_copy"),
    textByKey.get("nonprofits_step_3_title"),
    textByKey.get("nonprofits_step_3_copy"),
    textByKey.get("nonprofits_example_title"),
    textByKey.get("nonprofits_example_note"),
  ].join(" ");
  assert.match(matchCopy, /dollar-for-dollar/i);
  assert.doesNotMatch(matchCopy, /may match|can match|not guaranteed|available share/i);
});
