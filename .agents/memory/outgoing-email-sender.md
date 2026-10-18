---
name: Outgoing email sender
description: The requested mailbox and narrow scope for The Quest's outbound mail configuration.
---

The owner wants The Quest's outgoing email sent as the real Microsoft 365 mailbox `info@cbpublishing.live`. They selected Microsoft OAuth and rejected password-based SMTP.

**Why:** The owner's clarification was, “I just want to send emails out from the real email thats it.” Existing application sign-in is unrelated to the sender change.

**How to apply:** Keep changes limited to outbound mail from this mailbox. Do not add inbound mailbox access, change account sign-in, or switch to password-based SMTP. Gmail may remain active while Microsoft authorization is pending, but once Microsoft is active, do not silently fall back to Gmail.
