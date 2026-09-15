---
name: Financial operations aggregation
description: Keep competition charity totals and payout ledgers auditable without counting the same nonprofit allocation twice.
---

Charity totals must have one authoritative source per allocation. A nonprofit transaction that is generated from a payroll ledger entry must be linked to that source entry and excluded from independent summation.

**Why:** The financial overview combines payroll ledger records and donation-oriented transactions, so summing both collections without a source link can overstate the amount owed or reported.

**How to apply:** Before enabling formal donation execution or exports, add a source-ledger reference/idempotency key and aggregate either the linked transaction or the ledger allocation, never both.