---
name: SEO canonical origin
description: Keep client-managed canonical URLs anchored to The Quest's configured public domain.
---

Canonical URLs and `og:url` must use the public site origin even when the app is opened on a Replit preview hostname. The server-provided `site-origin` meta value is the source of truth; client SEO code must not substitute `window.location.origin`.

**Why:** React hydration can overwrite correct server-rendered metadata with the preview hostname, creating a preview-domain canonical even though the production HTML was correct.

**How to apply:** When changing `useSEO` or adding page-level SEO, derive the origin from the server-rendered site-origin metadata, which follows `SITE_URL`, with the documented public-domain fallback.

The configured public-site value may be a bare hostname rather than an absolute URL. Account-access email links must normalize that configuration to HTTPS before constructing URLs.

**Why:** A live account-recovery preflight failed URL validation because the configured site value lacked a protocol. Requiring absolute URLs without normalization would also prevent account emails from being sent.

**How to apply:** Normalize bare hostnames while rejecting unsafe schemes and embedded credentials. Verify the canonical live login page before sending bulk account-access mail; do not substitute a preview origin.