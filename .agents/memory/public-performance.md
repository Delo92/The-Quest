---
name: Public page performance
description: Performance rules for The Quest public pages and media-backed APIs
---

Public listing pages must not block their initial response on Vimeo enumeration or thumbnail resolution. Return Firestore-backed profile, competition, and vote data first, then load Vimeo media through a separate lazy request. Mobile landing pages must not eagerly download large background videos; use a lightweight local poster on narrow viewports.

**Why:** Vimeo API calls add multi-second latency and are not required to render the initial public cards, while large autoplay background videos can consume tens of megabytes before a mobile visitor sees the page.

**How to apply:** Keep short-lived server response caching and in-flight request deduplication on public listing endpoints, parallelize Firestore reads, defer below-the-fold video/iframe loading in the client, and provide compressed WebP artwork plus a static mobile poster for video-backed hero media.