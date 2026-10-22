---
name: Microsoft email scope
description: The approved Microsoft 365 sender and mailbox inbox permissions for The Quest.
---

The owner wants The Quest's outgoing email sent as the real Microsoft 365 mailbox `info@cbpublishing.live`. They selected Microsoft OAuth and rejected password-based SMTP. They later approved an admin inbox with replies. Reauthorization requests SMTP.Send, Graph Mail.Read, and Graph Mail.Send. The app opens messages without changing read status and replies within the source thread; it does not need permission to move or delete mail.

**Why:** Outbound sending remains the original requirement; the owner subsequently chose the inbox-with-replies scope for the admin Email area. Broader message modification permissions are not needed.

**How to apply:** Keep mailbox OAuth separate from application sign-in and do not use password-based SMTP. Require a fresh Microsoft consent before inbox access, and keep mailbox reads non-mutating. Gmail may remain active while Microsoft authorization is pending, but once Microsoft is active, do not silently fall back to Gmail.
