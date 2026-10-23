---
name: Payment outcome handling
description: Fail-closed payment retries and reconciliation after uncertain or failed fulfillment.
---

An Authorize.net payment attempt with an unknown gateway outcome must remain locked and require reconciliation. Only an explicit gateway decline may become retryable.

**Why:** A timeout or empty gateway response can occur after a successful capture. Automatically retrying that request can charge the customer twice.

**How to apply:** Preserve one idempotency key per payment intent, reserve it atomically before gateway dispatch, and retain processing/charged state through persistence or network uncertainty. Use the merchant reference to reconcile before permitting another charge.

A failed nomination response or missing internal payment reservation is not evidence that the customer's card payment failed.

**Why:** A production nomination incident returned an internal error before the reservation was saved, while Stripe had already captured the payment. The nomination and reservation were both absent despite the successful charge.

**How to apply:** Check the processor's payment status before advising a retry, issuing a refund, or recovering fulfillment. Include checkout records in reconciliation rather than checking internal payment attempts alone. Never recover a paid nomination by charging again.