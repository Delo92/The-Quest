---
name: Hero gallery competition media
description: Media selection and loading rule for the public homepage coverflow.
---

When an active competition exists for a category, the hero gallery and competition listing must show that competition’s cover media immediately. Use the cover video first, then the cover image, then the generic fallback. Category artwork is only the fallback when the category has no active competition. Vimeo cover URLs must retain their access hash.

**Why:** Showing category artwork or a generic poster first made the competition appear to change media as the carousel moved or between pages. The current product requirement is for assigned cover videos to play without waiting for the card to center.

**How to apply:** Keep competition selection and poster resolution in the public responses, preserve competition title/link metadata, render assigned Vimeo/direct-video covers immediately, and use cover images only when no cover video exists.