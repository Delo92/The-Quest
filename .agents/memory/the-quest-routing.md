---
name: The Quest routing
description: API ownership and nested client routes for the full-stack Quest app
---

The Quest app (`server/index.ts`) is a full-stack Express+Vite monolith that handles both the frontend AND its own `/api` routes in a single process.

The pnpm monorepo template also includes an `artifacts/api-server` that originally claimed the `/api` path — this steals all API traffic away from the Quest server, causing 404s on every `/api/*` route.

**Fix applied:** Updated `artifacts/the-quest/.replit-artifact/artifact.toml` to include `paths = ["/", "/api"]`, and changed `artifacts/api-server` to use `paths = ["/internal-api"]` so it no longer intercepts `/api`.

**Why:** The application router routes requests by path prefix to whichever artifact claims that path. Two artifacts cannot safely share the same prefix — the first match wins and the other never sees the traffic.

**How to apply:** Whenever working on this project, if `/api` routes return 404 from the browser but work fine via `curl localhost:22558`, check that `artifacts/api-server` hasn't reclaimed `/api` (e.g. after a template reset or merge).

Public Quest pages live in `QuestRouter`, mounted beneath the outer `/thequest` route. Register a page such as `/nominationindex` in that nested router before the generic `/:profileSlug` route; its public URL is `/thequest/nominationindex`. Nested Wouter links use the child path, while native anchors should use the full `/thequest/...` URL.

**Why:** Adding a Quest page only to the outer router produces a working-looking root route but leaves the requested `/thequest/...` URL at the app's 404 page.

**How to apply:** For any new public Quest page, check both the nested route and the final browser URL, and make footer or external links resolve to the full public URL.
