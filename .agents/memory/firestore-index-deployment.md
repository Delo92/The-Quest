---
name: Firestore REST index deployment
description: Operational behavior for reconciling Firestore composite indexes through the Firebase REST API.
---

Firebase composite-index creation is asynchronous. REST create calls return long-running operations, and index listing can include entries from other collection groups, so readiness checks must filter by the collection-group path and wait for every requested index to become `READY`.

**Why:** A successful create response does not mean the query is ready, and treating a broad list response as group-specific can produce false positives or duplicate creates.

**How to apply:** Compare desired fields against filtered live indexes, create only missing definitions, poll operation/index state, and verify the complete manifest before relying on the new query paths.