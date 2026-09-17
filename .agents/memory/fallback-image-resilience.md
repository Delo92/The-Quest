---
name: Fallback image resilience
description: Rules for rendering contestant and profile images when remote media is missing or fails
---

Shared image components must start with a valid local placeholder when the primary URL is empty, retry a supplied backup once, reset when async media inputs change, and avoid leaving a broken `<img>` when every remote source fails.

**Why:** Contestant media often arrives asynchronously and may include expired or inaccessible Firebase URLs. An empty initial source or a failed final retry otherwise leaves a broken-image icon, especially visible in mobile grids.

**How to apply:** Use the shipped `/images/template/a1.jpg` asset as the final fallback for public talent and competition cards. Preserve the requested image sizing class when rendering the final placeholder.