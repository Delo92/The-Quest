---
name: Hero gallery routing
description: Homepage category cards must open the selected competition rather than a contestant profile
---

The homepage hero gallery represents a competition. Its links should use the two-segment category/competition route, not a three-segment contestant route.

**Why:** Gallery data can combine featured-competition metadata with vote leaders from another competition in the same category. A contestant slug in that mixed response can produce a valid-looking but nonexistent profile URL.

**How to apply:** Keep contestant names as display context if useful, but route gallery cards to the competition detail page. Use contestant routes only from an explicit contestant selection or share action.