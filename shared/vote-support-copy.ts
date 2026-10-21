/**
 * Older editable site copy may still use the former vote-sale wording.
 * Normalize only phrases that clearly refer to paid voting; do not rewrite
 * unrelated host fees, event tickets, or commercial purchases.
 */
export function normalizeVoteSupportCopy(value: string): string {
  return value
    .replace(/\bVote Package Purchases\b/gi, "Paid Vote Contributions")
    .replace(/\bvote packages?\b/gi, "vote contribution options")
    .replace(/\bvote packs?\b/gi, "vote contributions")
    .replace(/\bvote purchases\b/gi, "paid vote contributions")
    .replace(/\bpurchased votes\b/gi, (match) => match[0] === "P" ? "Paid votes" : "paid votes")
    .replace(/\bvotes purchased\b/gi, "votes supported")
    .replace(/\bvotes? that (?:may|can) be purchased\b/gi, "votes supported with a contribution")
    .replace(/\b(?:Can|May) additional votes be purchased\??/gi, "How can I contribute to add votes?")
    .replace(/\b(?:buy|buys|buying) (?:additional )?votes?\b/gi, "donate to add votes")
    .replace(/\b(?:purchase|purchases|purchased|buy|buys|buying) (?:additional )?votes?\b/gi, "contribute to paid voting")
    .replace(/\b(?:purchase|purchases|purchased|buy|buys|buying) (?:an? )?(?:additional )?vote (?:pack|package)s?\b/gi, "make a vote contribution")
    .replace(/\bthank you for your purchase\b/gi, "thank you for your vote contribution")
    .replace(/\bquestions about this purchase\b/gi, "questions about this vote contribution")
    .replace(/\b((?:Your )?(?:The )?Quest) Purchase Receipt\b/gi, "$1 Vote Support Confirmation")
    .replace(/\bPurchase Receipt\b/gi, "Vote Contribution Confirmation")
    .replace(/\bVote purchases\b/g, "Paid vote contributions")
    .replace(/\bvote purchases\b/g, "paid vote contributions");
}
