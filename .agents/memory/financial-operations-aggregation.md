---
name: Financial operations aggregation
description: Keep competition charity totals and payout ledgers auditable without counting the same nonprofit allocation twice.
---

Charity totals must have one authoritative source per allocation. A nonprofit transaction generated from a payroll ledger entry must link to that source entry and must not be summed in addition to the ledger allocation. Platform matches are carved out of The Quest's existing capped nonprofit allocation, not added on top; the remaining platform allocation belongs to the configured platform recipient. Manual disbursement records consume, but do not create, an allocation.

**Why:** The financial overview combines payroll ledger records and donation-oriented transactions, so summing both collections without a source link can overstate the amount owed or reported. Treating matches as incremental would also exceed the platform's agreed cap.

**How to apply:** Keep every generated allocation linked to its ledger entry. Document nonprofit transfers against the source allocation, cap cumulative transfers at the allocated amount, and aggregate the allocation only once. Split the platform pool into recipient allocations and matches without increasing its total.