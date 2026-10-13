---
name: Public app demo isolation
description: Security and interaction boundary for The Quest's public no-login platform demo.
---

The public demo must remain a visual-only representation of The Quest. Visitors may switch demo roles and navigate among read-only dashboard sections, but must not log in, vote, upload, or add, edit, delete, or otherwise change platform data. Demo screens must use sample data and must not read authenticated user/session state or send API writes to real services.

**Why:** The user explicitly requested a complete visual representation with no authorization and no actionable ability to affect real data.

**How to apply:** Keep the public demo outside normal auth and consent gates, isolate its query state, serve fixtures for its data reads, allow role and section navigation only, block all action controls and write requests, and preserve normal authentication behavior on every non-demo route.
