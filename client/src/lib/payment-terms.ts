export type PaymentTermsContext = "vote" | "nomination" | "host";

const SECTION_LABELS = [
  "Nomination Fees",
  "Paid Vote Contributions",
  "Vote Package Purchases",
  "No Refund Policy",
  "User Responsibility",
  "Fraud Prevention & Payment Security",
  "Chargebacks & Payment Disputes",
  "Agreement to Terms",
] as const;

const SECTIONS_BY_CONTEXT: Record<PaymentTermsContext, readonly string[]> = {
  vote: [
    "Paid Vote Contributions",
    "Vote Package Purchases",
    "No Refund Policy",
    "User Responsibility",
    "Fraud Prevention & Payment Security",
    "Chargebacks & Payment Disputes",
    "Agreement to Terms",
  ],
  nomination: [
    "Nomination Fees",
    "No Refund Policy",
    "User Responsibility",
    "Fraud Prevention & Payment Security",
    "Chargebacks & Payment Disputes",
    "Agreement to Terms",
  ],
  host: [
    "No Refund Policy",
    "User Responsibility",
    "Agreement to Terms",
  ],
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTermsContext, string> = {
  vote: "paid vote contribution",
  nomination: "nomination",
  host: "host application",
};

export function getPaymentTermsForContext(
  terms: string | null | undefined,
  context: PaymentTermsContext,
): string {
  const source = terms?.trim();
  if (!source) return "";

  const knownLabels = new Map(SECTION_LABELS.map((label) => [label.toLowerCase(), label]));
  const sections: Array<{ label: string; lines: string[] }> = [];
  let current: { label: string; lines: string[] } | null = null;

  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const label = knownLabels.get(line.trim().toLowerCase());
    if (label) {
      current = { label, lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (sections.length === 0) return source;

  const allowed = new Set(SECTIONS_BY_CONTEXT[context]);
  return sections
    .filter((section) => allowed.has(section.label))
    .map((section) => {
      let lines = section.lines;

      if (section.label === "No Refund Policy") {
        // These checkmarked bullets enumerate other purchase types, while the
        // no-refund statement above them applies to the current payment too.
        lines = lines.filter((line) => !line.trim().startsWith("✔"));
      }

      if (section.label === "User Responsibility" && context === "host") {
        lines = lines.filter((line) => !/nominee/i.test(line));
      }

      const displayLabel = section.label === "Vote Package Purchases"
        ? "Paid Vote Contributions"
        : section.label;
      return [displayLabel, ...lines].join("\n").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}
