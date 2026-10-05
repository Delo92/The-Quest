---
name: OC payment provider selection
description: How Quest selects the active buyer checkout route when the OC bridge is available
---

OC availability and the selected buyer provider are separate settings. `QUEST_OC_API_TOKEN` makes the bridge available; the admin Buyer checkout provider selection chooses OC Stripe or OC PayPal. Authorize.Net remains the fallback when selected or when the chosen route is not ready.

The non-mutating OC connectivity probe must use a fresh UUID for its deliberately nonexistent payout-batch ID. OC rejects the fixed `__quest_connection_check__` sentinel as reserved with HTTP 500; a valid nonexistent UUID returns 404 and confirms reachability and authorization. This probe does not verify Stripe or PayPal readiness inside OC.

**Why:** The payment bridge can be healthy while the app still reports Authorize.Net as active. Treating token presence as provider selection makes the admin screen and checkout behavior misleading.

**How to apply:** Keep the OC bridge status visible in admin payment settings, use a random UUID for its read-only reachability probe, and keep provider readiness distinct from API connectivity. Never treat Payroll & Agreements payment methods as buyer checkout configuration; those methods describe payout recording.