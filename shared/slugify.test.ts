import assert from "node:assert/strict";
import { test } from "node:test";
import { findCompetitionByRouteSlug } from "./slugify";

const competition = {
  id: 11,
  title: "Chronic Cuties X Curves&Confidence Hawaii Quest",
  category: "Modeling/Fashion",
  slug: "chronic-cuties-of-hawaii",
};

test("competition route lookup accepts the canonical competition slug", () => {
  assert.equal(
    findCompetitionByRouteSlug([competition], "modelingfashion", "chronic-cuties-of-hawaii"),
    competition,
  );
});

test("competition route lookup preserves a unique title-derived legacy slug", () => {
  assert.equal(
    findCompetitionByRouteSlug(
      [competition],
      "modelingfashion",
      "chronic-cuties-x-curvesconfidence-hawaii-quest",
    ),
    competition,
  );
});

test("ambiguous title-derived slugs are not resolved to the wrong competition", () => {
  const duplicateTitle = { ...competition, id: 12, slug: "another-public-slug" };
  assert.equal(
    findCompetitionByRouteSlug(
      [competition, duplicateTitle],
      "modelingfashion",
      "chronic-cuties-x-curvesconfidence-hawaii-quest",
    ),
    undefined,
  );
});
