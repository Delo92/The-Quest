---
name: OC payment provider selection
description: How Quest selects the active buyer checkout route when the OC bridge is available
---

OC availability and the selected buyer provider are separate settings. `QUEST_OC_API_TOKEN` makes the bridge available; the admin Buyer checkout provider selection chooses OC Stripe or OC PayPal. Authorize.Net remains the fallback when selected or when the chosen route is not ready.

**Why:** The payment bridge can be healthy while the app still reports Authorize.Net as active. Treating token presence as provider selection makes the admin screen and checkout behavior misleading.

**How to apply:** Keep the OC bridge status visible in admin payment settings. Never treat Payroll & Agreements payment methods as buyer checkout configuration; those methods describe payout recording.