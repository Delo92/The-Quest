---
name: Centralized error logging
description: The Quest's port of ChronicDocs error capture, sanitization, deduplication, and device context
---

The Quest follows the ChronicDocs error-logging behavior, but all reads and writes use The Quest's configured Firebase/Firestore helper and `errorLogs` collection. Do not point this system at ChronicDocs' named Firestore database.

**Why:** ChronicDocs' implementation provides the desired operational coverage, but the applications have separate Firebase projects, identities, and role levels.

**How to apply:** Preserve anonymous client-error ingestion for pre-login failures, verified Firebase identity when a bearer token is available, 30-second duplicate suppression, durable idempotency keys, redacted context, inferred Quest role levels, and structured browser/device metadata.