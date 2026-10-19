---
name: Vote count freshness
description: User expectation for how quickly global vote totals update after a purchase.
---

After a successful vote purchase, the displayed platform total should refresh immediately for that buyer. Other viewers should see updates within a short polling window, not wait a minute or longer.

**Why:** A confirmed vote purchase appeared successful while the sitewide total stayed stale, then changed roughly a minute later.

**How to apply:** Invalidate any cached platform total after vote persistence, notify the current page to refresh, use no-store client fetches, and keep a bounded background refresh for other sessions.
