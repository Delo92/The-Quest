---
name: Host account credentials
description: Secure handling for admin host account password support
---

Existing host passwords must never be treated as recoverable password history. The current admin reset policy deliberately uses a shared known reset credential and records reset metadata; this is an explicit operational tradeoff, not a way to recover the original password. It may compare the host's later Firebase sign-in time to the reset time.

**Why:** Firebase authentication does not provide plaintext password retrieval, and the original password should not be reconstructed. The shared reset credential is intentionally requested for this product's operational workflow.

**How to apply:** Keep reset authorization server-side and admin-only, record reset time/admin identity, show the configured reset credential and reset date in the host modal, and show whether the host has signed in since the reset.