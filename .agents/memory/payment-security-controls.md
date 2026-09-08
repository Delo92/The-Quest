---
name: Payment security controls
description: Shared controls that must remain at the server charge boundary for every paid Quest flow.
---

All paid Quest flows must pass through the shared server-side charge helper. The helper enforces billing-address presence, Firestore-backed IP/email velocity limits, Authorize.Net duplicate protection, and payment reservation before gateway dispatch.

**Why:** Client-side validation and browser-generated idempotency keys alone do not stop requests with new keys, malformed billing data, or repeated gateway submissions.

**How to apply:** When adding a paid route, route it through the shared charge helper and pass the billing address; do not call Authorize.Net directly or rely on a UI-only rate limit.