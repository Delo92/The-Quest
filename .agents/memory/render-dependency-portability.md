---
name: Render dependency portability
description: Keep The Quest's dependency and build configuration portable to its external Render deployment.
---

## Rule
Do not add Replit-specific packages to this project. Keep Render's dashboard settings untouched unless the user explicitly requests a change, and keep npm lockfile tarball URLs on the public npm registry.

**Why:** The user reports that Render built successfully before recent code changes and specifically requested a repository-side fix without Render configuration changes.

**How to apply:** Remove unnecessary Replit-only Vite plugins and their imports from workspace manifests/configs. Verify `package-lock.json` contains no `@replit/*` dependencies or internal package-firewall URLs.
