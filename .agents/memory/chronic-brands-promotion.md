---
name: Chronic Brands promotion rules
description: Per-competition opt-in behavior and contestant-facing promotion commitments.
---

The Chronic Brands Network promotion is enabled by default per competition, but the host can opt out. Opted-in competitions require contestants to promote voting at least three times weekly and target four paid live-show tickets; opted-out competitions must hide the promo-code/ticket link and show the explicit opt-out message. A competition-specific ticket URL overrides the global destination, while contestant share links retain `promoCode`, `competitionId`, and `source=thequest`. Host-wide referral links remain separate.

**Why:** The ticket promotion is an additional host-controlled commitment, separate from ordinary voting and contestant recruitment. Event-specific sales destinations must not redirect other competitions.

**How to apply:** Prefer the competition URL for contestant ticket referrals and use the global destination only as a fallback. Keep voting links available independently, gate ticket UI and progress by the opt-in flag, treat purchase callbacks as competition-specific, and preserve host-wide referral flows.