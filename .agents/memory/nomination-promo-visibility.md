---
name: Nomination promo visibility
description: User expectation for when the nomination promo field appears and how it relates to active code configuration.
---

The nomination form should always show its promo-code section. Admins need multiple active or disabled nomination codes, with free, percentage, or fixed-amount discounts; the discount must change the amount actually charged. Current codes have no redemption limit.

**Why:** The owner explicitly requested a visible promo input and flexible multi-code configuration, including half-off and other discounts. Redemption limits were not requested.

**How to apply:** Keep promo-input visibility independent from code validation. Only configured, active codes may discount; calculate discounts and provider charge amounts on the server, and preserve the legacy free-code setting until it is replaced.