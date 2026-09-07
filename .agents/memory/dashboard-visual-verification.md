---
name: Dashboard visual verification
description: Reliable responsive checks for protected dashboard interiors in the local Quest preview
---

Protected dashboard screenshots need an authenticated browser session; an unauthenticated preview only verifies the redirect to login. The local seeded Host and Talent accounts can exercise the real dashboard interiors, while Viewer can be checked with an isolated guest session for its empty state.

**Why:** The Quest preview does not share an authenticated session with static screenshot requests, so checking only the route URL can miss responsive issues inside protected pages.

**How to apply:** For future dashboard UI changes, use isolated authenticated visual passes at phone, tablet, and desktop widths, then measure both document overflow and element bounds so clipped navigation is caught even when `scrollWidth` stays unchanged.