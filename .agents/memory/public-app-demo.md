---
name: Public app demo isolation
description: Security and interaction boundary for The Quest's public no-login platform demo.
---

The public demo must remain a visual-only representation of The Quest. Visitors may switch demo roles and navigate among read-only dashboard sections, but must not log in, vote, upload, or add, edit, delete, or otherwise change platform data. Demo screens must use sample data and must not read authenticated user/session state or send API writes to real services.

**Why:** The user explicitly requested a complete visual representation with no authorization and no actionable ability to affect real data.

**How to apply:** Keep the public demo outside normal auth and consent gates, isolate its query state, serve fixtures for its data reads, allow role and section navigation only, block all action controls and write requests, and preserve normal authentication behavior on every non-demo route.

When using real Quest competitions, contestants, or video in the demo, show only publicly verifiable data and keep each video paired with its actual contestant and competition. Votes, purchases, payouts, analytics, and other demo metrics remain fictional and should be labeled as such.

**Why:** The user explicitly authorized real platform videos and matching real identities while requiring demo metrics to stay fictional.

**How to apply:** Keep verified real media in an explicit fixture map, check that each video has a playable source, and never attach it to a fictional contestant. Only pass through allowlisted read-only playback requests; keep all other demo reads fixture-backed and all writes blocked.

For the public demo only, autoplay videos muted and inline when their cards are meaningfully visible; stop and unmount them when scrolled away, and honor reduced-motion and background-tab settings. Keep controls available so viewers can pause or unmute.

**Why:** The user clarified that demo contestant videos should autoplay rather than wait for a click.

**How to apply:** Keep autoplay scoped to the demo player component. Do not change the normal contestant-page playback behavior.

Demo contestant media must use explicit Vimeo IDs that have been checked for public playback; never derive IDs from synthetic contestant IDs or treat metadata alone as proof of playback.

**Why:** Numeric ID arithmetic produced a nonexistent player URL, while neighboring generated IDs happened to point at unrelated real videos.

**How to apply:** Maintain deliberate sample-media mappings and verify each Vimeo video through the public demo playback path.

When the host and viewer roles show the same demo competitions, keep their artist rosters and aggregate counts consistent by deriving both roles from the shared competition and contestant fixtures.

**Why:** The user explicitly asked for the host demo to show the same artists the viewer demo sees so the role views match.

**How to apply:** Keep host competition and contestant endpoints tied to the shared demo fixtures, and derive summary counts from those fixtures rather than maintaining a smaller role-specific roster.

The demo shell should not imitate a second branded site header or lead with a read-only warning. Make preview-role controls prominent and place real-site destinations inside one clearly labeled menu that warns visitors they are leaving the demo.

**Why:** The user clarified that visitors must recognize the app demo, with role previews more prominent than links to the full site.

**How to apply:** Keep real-site links outside the read-only event-capture surface and use the `/thequest/...` route prefix when linking from `/app-demo`.

Use It Stops Now Foundation and Event Pro Group Foundation as sample nonprofit recipients in the demo when no participant choice is available. This is a demo-only exception, not a change to real participant choice or an assertion that the featured people selected those recipients.

**Why:** The owner explicitly retained participant-selected nonprofits for real accounts and clarified that these two organizations should fill the otherwise empty demo declarations.

**How to apply:** Label recipient choices as sample/demo information, never invent tax IDs or contacts, and never persist demo defaults to real accounts. Demo payout cards must split the balance after the nonprofit deduction into nonoverlapping scheduled, awaiting-approval, and already-paid amounts. Show a nonzero example in all three payout categories, including already paid.

**Why all three:** The owner explicitly corrected a demo that showed zero already paid; they want the post-contribution balance distributed across every payout category, not only scheduled and awaiting approval.
