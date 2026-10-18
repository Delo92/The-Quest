---
name: The Quest artifact dev setup
description: How the artifact workflow runs the real Express+Vite server, not the scaffolded Vite template
---

The `artifacts/the-quest` directory contains a scaffolded Vite template from `createArtifact`, but the actual application code lives at the **workspace root** (`server/`, `client/`, `shared/`).

**Dev command must cd to workspace root:**
```toml
[services.development]
run = "cd /home/runner/workspace && NODE_ENV=development npx tsx server/index.ts"
```

Without the `cd`, `npx tsx server/index.ts` fails with `ERR_MODULE_NOT_FOUND` because the artifact workflow's CWD is `artifacts/the-quest/`.

**Port:** The artifact injects `PORT=22558` via `[services.env]`. The server reads `process.env.PORT || "5000"` so it binds to 22558. `localPort = 22558` in the artifact.toml tells the proxy where to forward traffic.

**Artifact port mappings:** Keep `.replit` free of partial `[[ports]]` mappings when artifact services are routed by `artifact.toml`. If explicit mappings exist, they must cover every artifact service port; a partial list can prevent the Quest preview from passing its health check.

**Why:** An 8080/8081-only mapping caused the Quest preview to fail despite Express starting on 22558. Removing those mappings restored the managed artifact route.

**How to apply:** Before changing `.replit` ports, compare against every artifact's `localPort`. Prefer the artifact router's existing configuration; validate any `.replit` replacement with Replit's config tool.

**Vimeo 403s in preview:** Expected behavior. Vimeo videos are domain-whitelisted for `cbpublishing.live`. Must add the Replit dev domain (and later the production URL) in Vimeo privacy settings per video.
