---
name: Public page performance
description: Performance rules for The Quest public pages and media-backed APIs
---

Public listing pages must not block their initial response on Vimeo enumeration or thumbnail resolution. Return Firestore-backed profile, competition, and vote data first, then load Vimeo media through a separate lazy request.

**Why:** Vimeo API calls add multi-second latency and are not required to render the initial public cards, while users still need video playback once they open a profile.

**How to apply:** Keep short-lived server response caching and in-flight request deduplication on public listing endpoints, parallelize Firestore reads, and defer below-the-fold video/iframe loading in the client.