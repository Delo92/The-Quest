---
name: React type resolution across workspaces
description: Keep the legacy root app's React 18 typings separate from React 19 artifact typings.
---

Keep TypeScript type resolution project-local when React 18 and React 19 applications coexist in this workspace. A shared pnpm virtual-store fallback can make React 18 source files consume React 19 declarations, producing a large cascade of JSX and `ReactNode` errors even though each runtime is intentionally versioned.

**Why:** The root application and standalone artifacts have different React runtimes; a workspace-wide override would make one of those projects' types incorrect.

**How to apply:** Keep the root check explicitly aligned to React 18 types, and do not impose a workspace-wide React type override. Leave React 19 artifacts on their own package and TypeScript configuration.
