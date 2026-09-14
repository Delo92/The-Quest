---
name: Cross-browser gallery media
description: Hero gallery posters and category artwork need browser-compatible, source-specific fallbacks.
---

Use Vimeo's API-provided custom picture as the gallery poster. Vumbnail can return a generic lock/privacy placeholder even when the video has a real custom poster. Use the shipped PNG category artwork when the database points at a WebP asset that older browsers may not decode.

**Why:** The gallery showed a lock image for a valid Brand & Business Vimeo video and blank Modeling/Fashion artwork in older Explorer-style browsers.

**How to apply:** Keep poster selection on the server, normalize shipped category artwork to PNG for the public gallery, and keep the poster as a visible base layer beneath any native video overlay.