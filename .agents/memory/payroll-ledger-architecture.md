---
name: Quest payroll and tax ledger architecture
description: The Quest payroll and tax records preserve winner entitlements, tax compliance, recipient forms, and nonprofit allocations without executing external transfers by default.
---

The Quest treats recipients as independent contractors, not employees. Only host-defined competition placements can earn winnings. Tax compliance uses the finale voting cutoff when configured, then competition voting end, then competition end; both acknowledgment and a complete tax-profile version must predate that cutoff. Match payees by stable profile/user IDs, never name or email. Recipient 1099-NEC gross amounts come from ledger entries paid during the selected calendar year. Preserve profile versions and encrypt full tax IDs. Payer legal name, address, and EIN must be entered by an administrator, not inferred. Nonprofit transfers remain manual records linked to source allocations and ledger entries.

**Why:** Voting cutoffs and payment dates can fall in different calendar years, so eligibility and annual reporting need separate dates; stable IDs and linked source allocations prevent identity mismatches and duplicate totals. The current payment architecture does not authorize automatic outbound transfers or guessed legal payer details.

**How to apply:** Keep payout creation, approval, deductions, agreements, and payout references server-side. For annual forms, use paid-at year and a saved profile version; if the paid year differs from the competition cutoff year, allow a recipient to repopulate that year from the latest known profile. Never store bank account numbers, CVV, processor secrets, raw payment credentials, or unencrypted tax IDs in Firestore. Add external payout execution only after a provider and compliance boundary are explicitly chosen.

Host accounts use the same encrypted, versioned tax-record contract as talent accounts. Determine host cutoff eligibility from competitions whose owner UID matches the user; apply the same finale/voting/end fallback and the same acknowledged-and-saved-before-cutoff checks.

**Why:** Hosts may be payees without having contestant rows, so contestant-only eligibility leaves their tax profile inaccessible even though payout compliance still depends on competition cutoffs.

**How to apply:** Permit host-role profiles in personal tax routes and use owned competition IDs to supply deadlines. Continue matching gross by stable profile/user IDs and reporting it by the ledger paid year.