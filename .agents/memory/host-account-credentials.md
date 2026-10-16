---
name: Admin account credentials
description: Owner-approved temporary-password convention and account recovery for hosts, nominees, and main users.
---

Existing host passwords must never be treated as recoverable password history. Hosts normally have their own custom passwords; the fixed admin reset credential is an emergency/temporary fallback used only when an admin explicitly resets an account, after which the host is expected to change it. Reset metadata may be compared with the host's later Firebase sign-in time.

**Why:** Firebase authentication does not provide plaintext password retrieval, and the original password should not be reconstructed. The product's support workflow needs a predictable temporary recovery credential without changing normal per-host password setup.

**How to apply:** Keep reset authorization server-side and admin-only, record reset time/admin identity, show the configured reset credential and reset date in the host modal, and show whether the host has signed in since the reset.

Use the established host admin-reset temporary-password convention for newly pre-created nominee accounts as well. Provide the same Account Access controls on the main Users profile modal, including an explicit reset-and-email action. Do not replace this with randomly generated per-account temporary passwords unless the owner changes that policy.

**Why:** The owner explicitly asked to reuse the existing host reset convention instead of introducing a new one, and to make the host password-reset UI available for all users.

**How to apply:** Never claim that the shared temporary credential is an existing user's current password. Include it only when creating an account or explicitly resetting it. Resending access instructions alone must not silently reset existing passwords. Require confirmation before a reset, revoke existing sessions, retain reset/sign-in auditing, and exclude credential-bearing responses from request logs.

Bulk artist/competitor recovery must exclude hosts and admins, even if some records also label them as artists. Competition ownership is another host exclusion signal.

**Why:** The owner repeatedly specified artist/competitor accounts only, not hosts, when authorizing account-wide recovery.

**How to apply:** Give exclusion signals precedence across account levels, authentication claims, profile roles, and competition ownership. Record per-account reset and email outcomes so a failed delivery can be retried without resetting successful accounts again. Do not equate profile-only contestant records with usable login accounts.