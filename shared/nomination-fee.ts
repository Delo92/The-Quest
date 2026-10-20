export function getCompetitionNominationFeeCents(
  competitionFeeCents: number | null | undefined,
  siteWideFeeCents: number,
): number {
  const feeCents = competitionFeeCents ?? siteWideFeeCents;
  if (!Number.isSafeInteger(feeCents) || feeCents < 0) {
    throw new Error("Nomination fee must be a non-negative whole number of cents");
  }
  return feeCents;
}
