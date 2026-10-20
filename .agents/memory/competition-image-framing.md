---
name: Competition photo framing
description: Scope for admin and host crop adjustments to contestant images.
---

## Rule
Adjusting a contestant's card photo from a competition workspace saves an override on that competition, keyed by contestant profile and photo index. It must not update the shared talent-profile crop.

**Why:** The user chose competition-only framing so page appearance changes do not affect the contestant's profile gallery or appearances in other competitions.

**How to apply:** Public competition cards use the competition override when present, then fall back to the existing profile crop and platform default. Hosts may change overrides only for competitions they own.
