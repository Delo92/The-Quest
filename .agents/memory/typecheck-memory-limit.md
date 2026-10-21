---
name: TypeScript check memory limit
description: Guidance for the root TypeScript check when it exhausts the Node heap.
---

The full root TypeScript check can run out of memory before reporting diagnostics; a run here reached the default 2 GB Node heap and aborted.

**Why:** The repository's full-stack TypeScript program is large enough to exceed the default heap in this environment, so repeated identical checks only waste time.

**How to apply:** Use focused tests, Vite module transforms, esbuild syntax checks, and a running workflow to verify scoped changes. Retry the full check only if the available heap or project configuration has changed.
