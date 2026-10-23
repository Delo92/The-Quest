---
name: Microsoft email scope
description: The approved Microsoft 365 sender and mailbox inbox permissions for The Quest.
---

The owner wants The Quest's outgoing email sent as the real Microsoft 365 mailbox `info@cbpublishing.live`. They selected Microsoft OAuth and rejected password-based SMTP. They later approved an admin inbox with replies. Authorization needs SMTP.Send, Graph Mail.Read, and Graph Mail.Send, using separate resource-specific token requests. The app opens messages without changing read status and replies within the source thread; it does not need permission to move or delete mail.

**Why:** Outbound sending remains the original requirement; the owner subsequently chose the inbox-with-replies scope for the admin Email area. Broader message modification permissions are not needed.

**How to apply:** Keep mailbox OAuth separate from application sign-in and do not use password-based SMTP. Require a fresh Microsoft consent before inbox access, and keep mailbox reads non-mutating. Gmail may remain active while Microsoft authorization is pending, but once Microsoft is active, do not silently fall back to Gmail.

Never combine Outlook SMTP and Microsoft Graph scopes in one device authorization or token request.

**Why:** Microsoft rejects the mixed-resource request with AADSTS28000, even if device-code creation initially appears successful. Existing consent may already allow each resource separately; a failed reconnect does not mean sending or inbox authorization is absent.

**How to apply:** Obtain Graph approval separately and verify SMTP through a resource-specific refresh. Check granted permissions before enabling mailbox access or replacing the active sender. Resume transient checks from an encrypted approved refresh token rather than exchanging a consumed device code again.

The admin Email tab should prioritize daily inbox work over connection setup.

**Why:** The owner wants the mailbox positioned higher on tab load rather than displaced by infrequently used authorization and test-email controls.

**How to apply:** Keep connection settings available through a compact, initially collapsed chevron disclosure, while leaving sender status visible.

The Microsoft mailbox is also the public support contact, not just an automated sender.

**Why:** The owner wants visitors to know how to email the team directly.

**How to apply:** Make the support address visible and clickable in public support/contact details. Do not let the legacy admin@thequest.com placeholder replace the real mailbox.
