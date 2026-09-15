---
name: Quest payroll ledger architecture
description: The Quest payroll records freelance winner entitlements, agreements, deductions, nonprofit allocations, and payout references without executing external transfers by default.
---

The Quest treats recipients as independent contractors, not employees. The payroll layer is an auditable ledger: only host-defined competition placements can earn winnings; payment information must be complete by the competition final day; payouts are due on the first day of the following month; missing information may forfeit or block an entitlement according to saved policy.

**Why:** The source system's generic payroll and provider execution models do not match The Quest's winner-only business rules or its current Authorize.Net money-in architecture.

**How to apply:** Keep payout creation, approval, deductions, nonprofit allocations, agreement status, and payout references server-side. Never store bank account numbers, CVV, processor secrets, or raw payment credentials in Firestore. Add external payout execution only after a provider and compliance boundary are explicitly chosen.