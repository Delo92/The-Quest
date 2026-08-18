---
name: The Quest routing
description: How /api routing is configured for the full-stack Quest Express+Vite monolith
---

The Quest app (`server/index.ts`) is a full-stack Express+Vite monolith that handles both the frontend AND its own `/api` routes in a single process.

The pnpm monorepo template also includes an `artifacts/api-server` that originally claimed the `/api` path — this steals all API traffic away from the Quest server, causing 404s on every `/api/*` route.

**Fix applied:** Updated `artifacts/the-quest/.replit-artifact/artifact.toml` to include `paths = ["/", "/api"]`, and changed `artifacts/api-server` to use `paths = ["/internal-api"]` so it no longer intercepts `/api`.

**Why:** The application router routes requests by path prefix to whichever artifact claims that path. Two artifacts cannot safely share the same prefix — the first match wins and the other never sees the traffic.

**How to apply:** Whenever working on this project, if `/api` routes return 404 from the browser but work fine via `curl localhost:22558`, check that `artifacts/api-server` hasn't reclaimed `/api` (e.g. after a template reset or merge).
