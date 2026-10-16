---
name: Gmail delivery verification
description: Read-only bounce checks when Gmail API access is disabled, and delivery-status limits for nominee emails.
---

The application's existing Gmail authorization supports SMTP and read-only IMAP, but Gmail API requests may fail with `403 accessNotConfigured` because the OAuth project's Gmail API is disabled. This is not necessarily an expired credential.

**Why:** Mail sending and IMAP authentication succeeded while the Gmail REST API was unavailable. Asking the owner to reconnect working credentials would not address the disabled API.

**How to apply:** For authorized mailbox investigations, use IMAP over TLS with the existing OAuth authorization. Use `EXAMINE` and `BODY.PEEK` so messages remain unchanged. Check All Mail, Spam, and Trash; match delivery notices to the original subject/message and recipient rather than treating every historical bounce as part of the latest batch. Never print OAuth tokens, whole quoted account-access messages, or reset links.

SMTP acceptance means the sending service accepted a message, not that the recipient's provider or inbox accepted it. Absence of a bounce does not establish inbox delivery. Apple's `554 5.7.1 [HM08]` is a local-policy rejection; it does not identify the precise filtering signal.

**Why:** The owner emphasized that silently blocked nominee emails can hurt contestants' chances. Messages accepted for sending later produced asynchronous recipient-provider rejections.

**How to apply:** Distinguish submitted/accepted, confirmed bounced, recipient-server accepted, and unknown inbox status. Report failed account-access messages for follow-up without automatically resetting passwords or repeatedly resending permanent failures. Do not claim all iCloud users are blocked from one iCloud rejection.

Keep the existing owner-controlled Google sender when investigating account-email delivery. Do not treat replacing it with a transactional provider or adding delivery tracking as a prerequisite.

**Why:** The owner explicitly rejected those as necessary changes and wants ordinary account emails to work through their existing Google account.

**How to apply:** Investigate actual rejection diagnostics first and propose narrowly scoped email-content or formatting changes. Explain that recipient-side policy cannot be disabled by the sending app. Ask before test resends; never reset passwords again merely to test delivery. Authentication results on Google's bounce notification describe that notification, not necessarily the original rejected email.
