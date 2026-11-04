---
name: Stale deploys and removed-profile links
description: Why production logged chunk-load, video-load and 404 errors, and the rules that prevent them.
---

Missing /assets files must return a real 404 (never the HTML shell) and HTML must be no-cache, so tabs open across a deploy reload once instead of erroring. Expected 404s for removed profiles/contestants are not client errors and must not be logged as such; transient 5xx/network failures on public pages retry.

**Why:** Visitors with pre-deploy tabs, social in-app browsers, and crawlers kept hitting removed bundles and deleted profile links; each was logged as an error though nothing was broken.

**How to apply:** Use the shared HTTP error helpers for public-page fetches. Reset links require an existing Firebase login (invitees without one get a create-account email). Public profile pages must also serve approved contestants whose account role is viewer.
