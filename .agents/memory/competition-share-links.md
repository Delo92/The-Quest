---
name: Competition share links
description: Public and host promotion URLs used to share a competition and preserve nomination attribution.
---

Competition sharing uses two URLs: the public competition page under `/thequest/{category}/{title}`, and a root-domain `?ref={competition code}` link for host promotion. The promotion code must come from a persisted server referral record, then travel through `hfc_ref` browser storage into nomination submissions and vote records. Host-owned competitions use the host as referral owner; admin-created competitions may use a competition-owned fallback.

Public competition pages should invite visitors directly to the competition-specific nomination form, not require login before they can start.

**Why:** Prospective contestants should be able to begin an application from the public competition page without an unrelated account gate.

**How to apply:** Carry the selected competition and any incoming referral through nomination navigation; only require sign-in if the nomination flow itself reaches a step that needs an account.

**Why:** Hosts need one link for viewers and a separate attribution link for recruiting nominations.

**How to apply:** Keep both links visible anywhere hosts manage or promote a competition, and preserve the existing referral capture path when changing nomination navigation. A global/custom code with no single competition cannot use the event-specific landing endpoint without a general landing fallback.

Shared referral and competition URLs also need event-specific landing content and server-rendered social metadata; generic CB Publishing or Quest metadata is only appropriate for an unqualified raw site URL.

Vote registration keeps attribution domains separate: preserve an incoming `?ref` code; otherwise prefill a vote referral code bound to the target contestant and competition. Chronic Brands `promoCode` remains ticket-promotion metadata and must not be reused as the vote `refCode`.

**Why:** Host/competition recruiting, contestant-driven vote referrals, and ticket sales attribute different outcomes.

**How to apply:** Carry `?ref` through account creation, derive the target contestant code only when no inbound referral exists, and keep `promoCode` on ticket links.