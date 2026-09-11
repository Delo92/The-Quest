---
name: Hero gallery competition media
description: Media selection and loading rule for the public homepage coverflow.
---

When an active competition exists for a category, the hero gallery and competition listing must show that competition’s cover media immediately. Use the cover video first, then the cover image, then the generic fallback. Category artwork is only the fallback when the category has no active competition. Vimeo cover URLs must retain their access hash, and public cover videos must be muted, autoplaying, looping, and control-free.

**Why:** Showing category artwork or a generic poster first made the competition appear to change media as the carousel moved or between pages. The current product requirement is for assigned cover videos to play without waiting for the card to center or exposing pause, play, mute, or other player controls.

**How to apply:** Keep competition selection and poster resolution in the public responses, preserve competition title/link metadata, render assigned Vimeo/direct-video covers immediately with muted autoplay and loop enabled, disable Vimeo/native controls, and use cover images only when no cover video exists.

**Gallery render order (critical):** Thumbnail/coverVideo ALWAYS renders as the base layer first. The Vimeo iframe overlays it absolutely on top. This means if the iframe is privacy-blocked on the production domain (cbpublishing.live is not in Vimeo's allowed-domains list for that video), the card still shows the thumbnail underneath — it never goes black. Do NOT put the iframe as the only content in the branch; always keep thumbnail as the base.

Competition seed corrections may replace known generic seed placeholders, but must not overwrite a host/admin’s custom cover media.

**Why:** Existing Firestore competitions outlive seed definitions, so correcting a default alone does not repair the live public page; unrestricted startup rewrites could also erase intentional custom artwork.

**How to apply:** Add targeted startup synchronization for known placeholder assignments and leave non-placeholder images or any assigned cover video untouched.