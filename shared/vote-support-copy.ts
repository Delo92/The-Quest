/**
 * Older editable site copy may still use the former vote-sale wording.
 * Normalize only phrases that clearly refer to vote donations; do not rewrite
 * unrelated host fees, event tickets, or commercial purchases.
 */
export function normalizeVoteSupportCopy(value: string): string {
  return value
    .replace(/\bVote Package Purchases?\b/gi, "Vote Donations")
    .replace(/\bpaid vote packages?\s+(?:can|may)\s+be\s+purchased\b/gi, (match) =>
      match[0] === "P" ? "Donations can be made to support votes" : "donations can be made to support votes")
    .replace(/\bpaid vote packages?\b/gi, (match) =>
      match[0] === "P" ? "Vote donation options" : "vote donation options")
    .replace(/\bvote packages?\s+(?:can|may)\s+be\s+purchased\b/gi, "donations can be made to support votes")
    .replace(/\bvote packages?\s+are available for purchase\b/gi, "vote donation options are available")
    .replace(/\bvote packages?\b/gi, "vote donation options")
    .replace(/\bvote packs?\b/gi, "vote donations")
    .replace(/\bvote purchases\b/gi, "vote donations")
    .replace(/\bpaid vote contributions?\b/gi, (match) =>
      match[0] === "P" ? "Vote donations" : "vote donations")
    .replace(/\bpaid voting\b/gi, "vote donations")
    .replace(/\bpurchased votes\b/gi, "votes supported by donations")
    .replace(/\bpaid votes?\b/gi, (match) =>
      match[0] === "P" ? "Votes supported by donations" : "votes supported by donations")
    .replace(/\bvotes purchased\b/gi, "votes supported")
    .replace(/\bvotes? that (?:may|can) be purchased\b/gi, "votes supported with a contribution")
    .replace(/\b(votes?)\s+(can|may|could|might)\s+be\s+(?:purchased|bought)\b/gi, "$1 $2 be supported with a donation")
    .replace(/\b(?:Can|May|Could|Might) additional votes be (?:purchased|bought)\??/gi, "How can I contribute to add votes?")
    .replace(/\b(?:Can|May|Could|Might) votes? be (?:purchased|bought)\??/gi, "How can I support voting with a donation?")
    .replace(/\b(?:buy|buys|buying) (?:additional )?votes?\b/gi, "donate to add votes")
    .replace(/\b(?:purchase|purchases|purchased|buy|buys|buying) (?:additional )?votes?\b/gi, "donate to support votes")
    .replace(/\b(?:purchase|purchases|purchased|buy|buys|buying) (?:an? )?(?:additional )?vote (?:pack|package)s?\b/gi, "make a vote donation")
    .replace(/\bthank you for your purchase\b/gi, (match) =>
      match[0] === "T" ? "Thank you for your vote donation" : "thank you for your vote donation")
    .replace(/\bquestions about this purchase\b/gi, "questions about this vote donation")
    .replace(/\b((?:Your )?(?:The )?Quest) Purchase Receipt\b/gi, "$1 Vote Donation Confirmation")
    .replace(/\bPurchase Receipt\b/gi, "Vote Donation Confirmation")
    .replace(/\bVote purchases\b/g, "Vote donations")
    .replace(/\bvote purchases\b/g, "vote donations");
}
