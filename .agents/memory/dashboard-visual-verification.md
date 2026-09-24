---
name: Dashboard visual verification
description: Reliable responsive checks for protected dashboard interiors in the local Quest preview
---

Protected dashboard screenshots need an authenticated browser session; an unauthenticated preview only verifies the redirect to login. The local seeded Host and Talent accounts can exercise the real dashboard interiors, while Viewer can be checked with an isolated guest session for its empty state.

**Why:** The Quest preview does not share an authenticated session with static screenshot requests, so checking only the route URL can miss responsive issues inside protected pages.

**How to apply:** For future dashboard UI changes, use isolated authenticated visual passes at phone, tablet, and desktop widths, then measure both document overflow and element bounds so clipped navigation is caught even when `scrollWidth` stays unchanged.

Radix `TabsContent` with `forceMount` stays present and therefore does not receive its normal inactive `hidden` state. Add `data-[state=inactive]:hidden` to any force-mounted panel that must remain visually inactive while its effects or queries run.

**Why:** Background-mounted tax reminders must load before a user opens their tab, but the rest of that panel must not appear alongside the selected dashboard tab.

**How to apply:** Keep the reminder component mounted inside the tab panel, apply state-based hiding to the panel, and verify the reminder portal plus the active/inactive tab surfaces in an authenticated session.