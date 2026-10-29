---
name: Hero gallery competition media
description: Media selection and loading rule for the public homepage coverflow.
---

For each category’s selected active competition, gallery media priority is its cover video, then its saved hero video, then its promo videos in saved order. If no competition video is usable, use the top-voted contestant’s competition-scoped video from that same event. Keep the competition cover as the poster/fallback image; show image-only media only when neither video source is available. Category artwork is the fallback when there is no active competition. Vimeo access hashes must be retained, and public videos must be muted, autoplaying, looping, and control-free.

**Why:** A competition’s saved hero video is the intended featured media and must not be replaced by a separate promo clip. If neither cover nor hero media is available, use the saved promos and then feature the leading talent when the event has no usable competition video.

**How to apply:** Keep competition selection and media resolution in the public response, preserve competition title/link metadata, and expose direct hero files as `directVideoUrl`. Use the shared competition-video resolver for Vimeo cover/promo sources. Only fall back to the top-voted contestant’s video from the selected competition; use the cover image when neither video source is available. Render video muted and looping, without controls.

**Gallery render order (critical):** Thumbnail/coverVideo ALWAYS renders as the base layer first. The Vimeo iframe overlays it absolutely on top. This means if the iframe is privacy-blocked on the production domain (cbpublishing.live is not in Vimeo's allowed-domains list for that video), the card still shows the thumbnail underneath — it never goes black. Do NOT put the iframe as the only content in the branch; always keep thumbnail as the base.

Competition seed corrections may replace known generic seed placeholders, but must not overwrite a host/admin’s custom cover media.

**Why:** Existing Firestore competitions outlive seed definitions, so correcting a default alone does not repair the live public page; unrestricted startup rewrites could also erase intentional custom artwork.

**How to apply:** Add targeted startup synchronization for known placeholder assignments and leave non-placeholder images or any assigned cover video untouched.