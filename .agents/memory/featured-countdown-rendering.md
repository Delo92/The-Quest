---
name: Featured countdown rendering
description: Rendering guidance for the featured competition state on the Quest homepage
---

The featured competition panel should be visible immediately when its data is available; do not put its only visible state behind a delayed opacity animation.

**Why:** Preview captures and fast user loads can happen before delayed entrance animations finish, making a correctly loaded featured competition appear absent.

**How to apply:** Keep the featured panel near the carousel and use animation only after the panel is already renderable. If no voting end date exists, show the explicit unavailable state rather than inventing a countdown target.