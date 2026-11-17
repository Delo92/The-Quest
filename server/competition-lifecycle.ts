export interface CompetitionLifecycleFields {
  status?: string | null;
  endDate?: string | null;
  votingEndDate?: string | null;
}

function endTimestamp(value?: string | null): number | null {
  if (!value) return null;
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const timestamp = Date.parse(dateValue);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getCompetitionEndTimestamp(
  competition: CompetitionLifecycleFields,
): number | null {
  return endTimestamp(competition.votingEndDate) ?? endTimestamp(competition.endDate);
}

export function getEffectiveCompetitionStatus(
  competition: CompetitionLifecycleFields,
  now = Date.now(),
): string {
  const status = String(competition.status || "");
  const end = getCompetitionEndTimestamp(competition);
  if (
    (status === "active" || status === "voting")
    && end !== null
    && end <= now
  ) {
    return "completed";
  }
  return status;
}

export function isCompetitionClosed(
  competition: CompetitionLifecycleFields | null | undefined,
  now = Date.now(),
): boolean {
  if (!competition) return false;
  const status = String(competition.status || "").toLowerCase();
  if (status === "completed" || status === "cancelled") return true;
  const end = getCompetitionEndTimestamp(competition);
  return end !== null && end <= now;
}
