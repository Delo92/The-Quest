---
name: Nomination promo visibility
description: User expectation for when the nomination promo field appears and how it relates to active code configuration.
---

The nomination form should show its promo-code section whenever a nomination fee applies, even when no redeemable free code is currently configured.

**Why:** The owner explicitly directed that `hasPromoCode` be true so the promo input is discoverable instead of hidden by the absence of a configured code.

**How to apply:** Keep promo-input visibility independent from code validation. The server must still waive fees only for a configured exact-match code; never accept arbitrary values just because the field is visible.