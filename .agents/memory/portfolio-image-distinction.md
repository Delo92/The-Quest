---
name: Portfolio image distinction
description: Image selection for the public personal portfolio hero.
---

**Rule:** When a public artist profile has more than one distinct image, do not reuse the featured portrait as the large hero backdrop. Keep a custom background when it differs from the portrait; otherwise choose another profile image. A fallback must not silently switch back to the featured portrait when another image is available.

**Why:** The user explicitly said duplicate hero and portrait imagery makes the portfolio feel wrong; using distinct images creates a more intentional composition.

**How to apply:** Compare image sources without query strings or fragments. Prefer a saved background that differs from the portrait, then another gallery image, then the app fallback. Reuse the portrait only when there is no distinct alternative.
