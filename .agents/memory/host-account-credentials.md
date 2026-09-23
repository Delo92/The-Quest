---
name: Host account credentials
description: Secure handling for admin host account password support
---

Existing host passwords must never be treated as recoverable password history. Hosts normally have their own custom passwords; the fixed admin reset credential is an emergency/temporary fallback used only when an admin explicitly resets an account, after which the host is expected to change it. Reset metadata may be compared with the host's later Firebase sign-in time.

**Why:** Firebase authentication does not provide plaintext password retrieval, and the original password should not be reconstructed. The product's support workflow needs a predictable temporary recovery credential without changing normal per-host password setup.

**How to apply:** Keep reset authorization server-side and admin-only, record reset time/admin identity, show the configured reset credential and reset date in the host modal, and show whether the host has signed in since the reset.