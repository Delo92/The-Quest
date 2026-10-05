---
name: Nomination promo visibility
description: User expectation for when the nomination promo field appears and how it relates to active code configuration.
---

The nomination form should show its promo-code section at checkout, directly beside the due total and payment action—not at the top before competition selection. Admins need multiple active or disabled codes with free, percentage, or fixed-amount discounts; discounts must change the amount actually charged. Current codes have no redemption limit.

**Why:** The owner explicitly requested a visible checkout promo input and flexible multi-code configuration, including half-off and other discounts. They specifically corrected the top-of-form placement. Redemption limits were not requested.

**How to apply:** Keep promo-input visibility independent from code validation. Place the code entry and recalculated total beside checkout controls, after the nomination details. Only configured, active codes may discount; calculate discounts and provider charge amounts on the server, and preserve the legacy free-code setting until it is replaced.