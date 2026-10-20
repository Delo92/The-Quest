---
name: Competition photo framing
description: Scope for admin and host crop adjustments to contestant images.
---

## Rule
Adjusting a contestant's card photo from a competition workspace saves an override on that competition, keyed by contestant profile and photo index. It must not update the shared talent-profile crop.

**Why:** The user chose competition-only framing so page appearance changes do not affect the contestant's profile gallery or appearances in other competitions.

Competition card framing may include a bounded zoom value as well as x/y. `object-position` alone cannot pan along an axis where the source image has no overflow; apply the saved zoom consistently in the editor and competition-card renderers. Keep the zoom off shared profile crops.

**Why:** Portrait photos can fit a card's width exactly, making horizontal object-position changes invisible. A competition-only zoom creates safe pan room without changing the shared profile image or other competitions.

**How to apply:** Public competition cards use the competition override when present, then fall back to the existing profile crop and platform default. Hosts may change overrides only for competitions they own. Preserve legacy x/y-only positions and clamp zoom at the save boundary.
