---
name: Firebase media persistence
description: The Quest media URLs are owned by Firebase records and must not be rewritten by startup initialization.
---

Firebase Storage and its Firestore/Livery records are the source of truth for user-managed content media, including nonprofit logos. The `attached_assets/` directory is intentionally Git-ignored and must not be statically imported for app content. Videos use Vimeo only when explicitly routed to artist or competition folders; other videos belong in Firebase Storage. Server startup must read media records only, not seed or normalize them.

**Why:** The project intentionally keeps user-managed content media out of Git and serves it from Firebase. A startup write can also replace a valid saved URL with an empty or null default, leaving the asset present but unreachable.

**How to apply:** Upload app imagery through the existing Firebase media flow and save its URL in the corresponding record; do not add `attached_assets/` exceptions or static imports to fix a build. Keep media initialization out of server startup. Any migration or repair must be an explicit, one-time operation.