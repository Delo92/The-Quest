import assert from "node:assert/strict";
import test from "node:test";
import { getPaymentTermsForContext } from "./payment-terms";

const currentTerms = `Payment & Purchase Policy

The Quest platform involves fees associated with nominations and vote packages.

Nomination Fees

Each nomination submission requires a non-refundable nomination fee.

Vote Package Purchases

Vote packages are applied to the selected nominee.

No Refund Policy

All payments are final.

This policy applies to:

✔ Nomination fees
✔ Vote package purchases

User Responsibility

✔ Correct nominee selection
✔ Accurate payment information

Fraud Prevention & Payment Security

Suspicious payment or voting activity may be investigated.

Chargebacks & Payment Disputes

Vote removal or nominee disqualification may result.

Agreement to Terms

Completion of any payment constitutes acceptance of this policy.`;

test("paid vote terms omit nomination-only language and hide cross-payment lists", () => {
  const terms = getPaymentTermsForContext(currentTerms, "vote");
  assert.match(terms, /Paid Vote Contributions/);
  assert.match(terms, /All payments are final/);
  assert.doesNotMatch(terms, /Nomination Fees|nomination submission|Nomination fees/);
  assert.doesNotMatch(terms, /Payment & Purchase Policy|nominations and vote packages/);
});

test("new paid vote terms headings are included in the voter disclosure", () => {
  const terms = getPaymentTermsForContext(
    "Paid Vote Contributions\nYour contribution adds votes to the selected contestant.\n\nNomination Fees\nA separate nomination fee applies.",
    "vote",
  );
  assert.match(terms, /Paid Vote Contributions/);
  assert.match(terms, /adds votes/);
  assert.doesNotMatch(terms, /Nomination Fees|separate nomination fee/);
});

test("nomination terms omit vote-package language", () => {
  const terms = getPaymentTermsForContext(currentTerms, "nomination");
  assert.match(terms, /Nomination Fees/);
  assert.match(terms, /nomination submission/);
  assert.doesNotMatch(terms, /Vote Package Purchases|Vote package purchases/);
});

test("host terms omit nomination, vote, and voting-specific sections", () => {
  const terms = getPaymentTermsForContext(currentTerms, "host");
  assert.match(terms, /No Refund Policy/);
  assert.match(terms, /Accurate payment information/);
  assert.doesNotMatch(terms, /Nomination Fees|Vote Package Purchases|nominee|voting activity/i);
});

test("unstructured custom terms remain available instead of being discarded", () => {
  assert.equal(
    getPaymentTermsForContext("These are custom terms.", "vote"),
    "These are custom terms.",
  );
});
