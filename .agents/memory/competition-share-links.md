---
name: Competition share links
description: Public and host promotion URLs used to share a competition and preserve nomination attribution.
---

Competition sharing uses two URLs: the public competition page under `/thequest/{category}/{title}`, and a root-domain `?ref={competition code}` link for host promotion. The promotion code must come from a persisted server referral record, then travel through `hfc_ref` browser storage into nomination submissions and vote records. Host-owned competitions use the host as referral owner; admin-created competitions may use a competition-owned fallback.

Public competition pages should invite visitors directly to the competition-specific nomination form, not require login before they can start.

**Why:** Prospective contestants should be able to begin an application from the public competition page without an unrelated account gate.

**How to apply:** Carry the selected competition and any incoming referral through nomination navigation; only require sign-in if the nomination flow itself reaches a step that needs an account.

Contestant share links should feature that contestant's video for the selected competition across all sharing channels, not the event artwork or a shared profile photo.

**Why:** The owner explicitly wants the competition video to be the shared media everywhere. Platforms ultimately decide whether to render a playable card; an image-only platform should receive a frame from that same video.

**How to apply:** Keep server HTML and hydrated metadata aligned. Preserve competition-scoped ownership and attribution. Use stable, approved-entry media URLs in cached cards rather than expiring signed CDN URLs. Social-card players may use a first-party native-video embed; this is separate from the in-app Vimeo player policy and must not require changing Vimeo privacy.

**Why:** Hosts need one link for viewers and a separate attribution link for recruiting nominations.

**How to apply:** Keep both links visible anywhere hosts manage or promote a competition, and preserve the existing referral capture path when changing nomination navigation. A global/custom code with no single competition cannot use the event-specific landing endpoint without a general landing fallback.

Shared referral and competition URLs also need event-specific landing content and server-rendered social metadata; generic CB Publishing or Quest metadata is only appropriate for an unqualified raw site URL.

Vote registration keeps attribution domains separate: preserve an incoming `?ref` code; otherwise prefill a vote referral code bound to the target contestant and competition. Chronic Brands `promoCode` remains ticket-promotion metadata and must not be reused as the vote `refCode`.

**Why:** Host/competition recruiting, contestant-driven vote referrals, and ticket sales attribute different outcomes.

**How to apply:** Carry `?ref` through account creation, derive the target contestant code only when no inbound referral exists, and keep `promoCode` on ticket links.

Contestant profile URLs must keep their own social preview metadata even when `?ref` is present. A contestant slug such as `vivian-40` is not necessarily a host referral code; profile identity and video come from the path and selected competition.

**Why:** A failed host-code lookup previously returned generic site metadata for shared contestant links, so Facebook displayed the wrong title and no contestant media.

**How to apply:** Resolve profile paths before query-string referral metadata; keep the original `ref` query intact for attribution and use the selected competition video's poster as the share image when available, then the contestant's public image.

Competition-page share cards use the competition cover as `og:image` and the competition's own video metadata: cover video first, otherwise its first configured promo video. Never substitute an arbitrary contestant's clip. Keep the browser favicon as the site brand icon; it is separate from social-card imagery. Facebook documents secure `og:video` URLs as eligible for inline Feed playback, but says playback is not guaranteed.

**Why:** A competition page represents the event, and some active competitions have a promo video even when no cover video is set. The cover image remains the social thumbnail; an incorrect inherited square icon dimension can degrade that preview.

**How to apply:** Resolve event-owned video sources server-side, use a stable validated URL that refreshes signed CDN redirects, and preserve the cover image for `og:image`. Treat Facebook inline playback as eligibility, not a promise; other platforms apply their own preview rules.