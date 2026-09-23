---
name: Host account credentials
description: Secure handling for admin host account password support
---

Existing host passwords must never be stored for later display or made recoverable through the admin UI. Admin support should explain that the original password is unavailable and use a server-side reset that returns a newly generated temporary password only once.

**Why:** Password history would expose credentials and create a larger compromise surface; Firebase authentication does not provide plaintext password retrieval.

**How to apply:** Keep reset authorization server-side and admin-only, show the new temporary password only in the immediate reset result, and tell the operator to transmit it securely.