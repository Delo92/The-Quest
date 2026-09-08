---
name: Competition tracking
description: Public competition standings and freshness strategy
---

Public competition tracking should expose aggregate vote counts and weighted tournament points through a read-only, no-store endpoint. The public page should poll that endpoint while the tracking view is open and offer an explicit refresh control.

**Why:** The existing detailed vote breakdown route is authenticated for admin-facing use, while supporters need to see current standings without signing in. Aggregate counts are safe to expose publicly, and short polling keeps the UI current without exposing Firestore internals or requiring client credentials.

**How to apply:** Keep voter identity and mutation operations behind existing auth boundaries. If a future realtime subscription is introduced, preserve the same public response shape and zero-vote/tie handling.