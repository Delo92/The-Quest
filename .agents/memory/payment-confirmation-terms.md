---
name: Payment confirmation terms
description: Product rule for how payment confirmation dialogs present legal terms.
---

Payment confirmations should show the agreement checkbox and a collapsed disclosure by default. Expanded terms must be limited to the current transaction type; a vote purchase must not show nomination-fee terms or unrelated purchase categories.

**Why:** The shared global summary mixed nomination, vote, and other payment language in one checkout dialog, making the terms noisy and confusing.

**How to apply:** Pass the payment purpose into the shared confirmation dialog and keep its section filtering aligned with the headings configured in the admin terms settings. Preserve the complete applicable terms behind the disclosure.
