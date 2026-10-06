---
name: Mockup sandbox PostCSS isolation
description: Why the Tailwind v4 mockup sandbox needs a package-local PostCSS configuration.
---

Keep the mockup sandbox's Tailwind v4 processing isolated from the workspace-level Tailwind v3 PostCSS configuration. The sandbox uses `@tailwindcss/vite`; its local PostCSS config prevents Vite from inheriting the root plugin and failing on Tailwind v4 `@layer` directives.

**Why:** The inherited Tailwind v3 plugin raises a runtime CSS error that breaks every sandbox preview even though the sandbox typecheck succeeds.

**How to apply:** Preserve a package-local empty PostCSS plugin list in the mockup sandbox. Do not change the workspace PostCSS config to fix sandbox previews, since the main Quest app still uses Tailwind v3.
