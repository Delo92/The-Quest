---
name: Quest promo-code sources
description: Source-of-truth distinction for Quest-managed promo and referral codes.
---

Quest-managed promo and referral codes are not sourced from Stripe. Referral codes are attribution records, while nomination discounts are configured in app-managed settings. A Stripe promotion-code lookup is not a reliable inventory of Quest's codes.

**Why:** The owner explicitly corrected that Quest promo/referral codes are not saved in Stripe; a Stripe lookup returned no codes but did not answer whether app-managed codes existed.

**How to apply:** Check app-managed sources when asked which Quest codes exist. App-managed discount promos must work for Stripe-backed vote checkout; keep referral codes attribution-only and do not treat them as discounts.
