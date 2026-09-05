---
name: Payment outcome handling
description: Fail-closed rules for Authorize.net retries and uncertain gateway responses.
---

An Authorize.net payment attempt with an unknown gateway outcome must remain locked and require reconciliation. Only an explicit gateway decline may become retryable.

**Why:** A timeout or empty gateway response can occur after a successful capture. Automatically retrying that request can charge the customer twice.

**How to apply:** Preserve one idempotency key per payment intent, reserve it atomically before gateway dispatch, and retain processing/charged state through persistence or network uncertainty. Use the merchant reference to reconcile before permitting another charge.