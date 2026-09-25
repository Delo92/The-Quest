export function preserveReferralQuery(search: string): string {
  const referralCode = new URLSearchParams(search).get("ref")?.trim();
  return referralCode ? `?ref=${encodeURIComponent(referralCode)}` : "";
}