---
name: Competition share links
description: Public and host promotion URLs used to share a competition and preserve nomination attribution.
---

Competition sharing uses two URLs: the public competition page under `/thequest/{category}/{title}`, and a root-domain `?ref={competition code}` link for host promotion. The promotion code must come from a persisted server referral record, then travel through `hfc_ref` browser storage into nomination submissions and vote records. Host-owned competitions use the host as referral owner; admin-created competitions may use a competition-owned fallback.

**Why:** Hosts need one link for viewers and a separate attribution link for recruiting nominations.

**How to apply:** Keep both links visible anywhere hosts manage or promote a competition, and preserve the existing referral capture path when changing nomination navigation.

Shared referral and competition URLs also need event-specific landing content and server-rendered social metadata; generic CB Publishing or Quest metadata is only appropriate for an unqualified raw site URL.