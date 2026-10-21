const escapedCharacters: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => escapedCharacters[character] || character);
}

export function nextReferralUsageCount(totalUses: unknown, legacyUniqueVoters: unknown): number {
  const savedCount = typeof totalUses === "number" && Number.isFinite(totalUses)
    ? Math.max(0, totalUses)
    : null;
  const legacyCount = typeof legacyUniqueVoters === "number" && Number.isFinite(legacyUniqueVoters)
    ? Math.max(0, legacyUniqueVoters)
    : 0;
  return (savedCount ?? legacyCount) + 1;
}

export function buildReferralCodeUsageNotice(code: string, usageCount: number) {
  const count = Number.isFinite(usageCount) ? Math.max(0, Math.floor(usageCount)) : 0;
  const formattedCount = count.toLocaleString("en-US");
  const useWord = count === 1 ? "time" : "times";

  return {
    subject: `Your code was used — ${formattedCount} recorded ${useWord} — The Quest`,
    bodyHtml: `
      <div style="text-align:center; margin-bottom: 28px;">
        <span class="badge">Referral Code Used</span>
      </div>
      <h2 style="text-align:center;">Your code was used</h2>
      <p style="text-align:center; font-size:16px; color:#ccc;">
        Your referral code <strong style="color:#FF5A09;">${escapeHtml(code)}</strong>
        now has <strong style="color:#fff;">${formattedCount} recorded ${useWord}</strong>.
      </p>
    `,
  };
}
