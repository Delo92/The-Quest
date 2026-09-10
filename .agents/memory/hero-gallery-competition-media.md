---
name: Hero gallery competition media
description: Media selection and loading rule for the public homepage coverflow.
---

When an active competition exists for a category, the hero gallery must show that competition’s cover media immediately. Category artwork is only the fallback when the category has no active competition. For Vimeo covers, show the competition’s video poster on non-centered cards and load one actual player only for the centered card.

**Why:** Showing category artwork first made a competition appear to change media as the carousel moved, while mounting every Vimeo player harms public-page performance.

**How to apply:** Keep competition selection and poster resolution in the hero-gallery response, preserve competition title/link metadata, and keep non-centered Vimeo cards poster-only while the centered card is the only autoplaying player.