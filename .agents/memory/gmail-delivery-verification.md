---
name: Gmail delivery verification
description: Read-only bounce checks when Gmail API access is disabled, and delivery-status limits for nominee emails.
---

The application's existing Gmail authorization supports SMTP and read-only IMAP, but Gmail API requests may fail with `403 accessNotConfigured` because the OAuth project's Gmail API is disabled. This is not necessarily an expired credential.

**Why:** Mail sending and IMAP authentication succeeded while the Gmail REST API was unavailable. Asking the owner to reconnect working credentials would not address the disabled API.

**How to apply:** For authorized mailbox investigations, use IMAP over TLS with the existing OAuth authorization. Use `EXAMINE` and `BODY.PEEK` so messages remain unchanged. Check All Mail, Spam, and Trash; match delivery notices to the original subject/message and recipient rather than treating every historical bounce as part of the latest batch. Never print OAuth tokens, whole quoted account-access messages, or reset links. A negative IMAP BODY search for the original Message-ID does not establish that no bounce exists: Gmail may not search attached original-message headers. Enumerate recent delivery notices and compare decoded attached headers, recipient, and timestamps before reporting no rejection.

SMTP acceptance means the sending service accepted a message, not that the recipient's provider or inbox accepted it. Absence of a bounce does not establish inbox delivery. Apple's `554 5.7.1 [HM08]` is a local-policy rejection; it does not identify the precise filtering signal.

**Why:** The owner emphasized that silently blocked nominee emails can hurt contestants' chances. Messages accepted for sending later produced asynchronous recipient-provider rejections.

**How to apply:** Distinguish submitted/accepted, confirmed bounced, recipient-server accepted, and unknown inbox status. Report failed account-access messages for follow-up without automatically resetting passwords or repeatedly resending permanent failures. Do not claim all iCloud users are blocked from one iCloud rejection.

Keep the existing owner-controlled Google sender and existing email/password sign-in when investigating account-email delivery. Do not treat replacing the sender, adding delivery tracking, or adding Apple/Google sign-in as a prerequisite.

**Why:** The owner explicitly rejected changing the email provider or adding tracking and wants ordinary account emails to work through their existing Google account. When offered independent Apple/Google authentication as a backup, the owner selected “Keep the existing sign-in and focus only on email delivery.”

**How to apply:** Keep work scoped to email delivery rather than proposing authentication changes again. Investigate actual rejection diagnostics first and propose narrowly scoped email-content or formatting changes. Explain that recipient-side policy cannot be disabled by the sending app. Ask before test resends; never reset passwords again merely to test delivery. Authentication results on Google's bounce notification describe that notification, not necessarily the original rejected email.

Account-access emails must retain The Quest's branded HTML presentation and proper visuals. A plain-text alternative may accompany it in the same multipart email; it must not replace the visible branded design.

**Why:** The owner explicitly objected when a delivery test was going to remove branding and stated that plain-text-only emails were not appropriate for the product.

**How to apply:** Preserve the established HTML header, palette, credential presentation, and login button. Explain that normal HTML-capable clients display the branded version, while the plain-text part is a compatibility alternative. Do not promise that multipart formatting alone will prevent recipient-side filtering.

Account onboarding and recovery must remain self-service when a transactional email is rejected. Calls, texts, host intervention, and manually sharing passwords are not acceptable product fallbacks.

**Why:** The owner stated, “we dont send texts or make calls” and that users being locked out “without human assistance” is unacceptable. The concern is platform-wide access reliability, not just assisting one recipient.

**How to apply:** Do not present human-assisted credential delivery or resending the same permanently rejected message as a completed solution. Any independent recovery route must securely verify account ownership; knowing an email address alone is not sufficient. Do not change authentication methods or expose shared temporary credentials publicly to bypass an email-delivery failure.
