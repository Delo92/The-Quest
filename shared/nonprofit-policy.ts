export const MIN_NONPROFIT_CONTRIBUTION_PERCENT = 1;
export const MAX_NONPROFIT_CONTRIBUTION_PERCENT = 10;

export type NonprofitContributionLevel = "contestant" | "host" | "platform";
export type PlatformMatchMode = "percentage" | "cash";

export type NonprofitContributionRates = Record<NonprofitContributionLevel, number | null>;

export function isValidNonprofitContributionRate(value: unknown): value is number {
  const rate = Number(value);
  return Number.isFinite(rate)
    && rate >= MIN_NONPROFIT_CONTRIBUTION_PERCENT
    && rate <= MAX_NONPROFIT_CONTRIBUTION_PERCENT;
}

export function normalizeNonprofitContributionRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  if (!Number.isFinite(rate)
    || rate < MIN_NONPROFIT_CONTRIBUTION_PERCENT
    || rate > MAX_NONPROFIT_CONTRIBUTION_PERCENT) {
    throw new Error(`Each nonprofit rate must be between ${MIN_NONPROFIT_CONTRIBUTION_PERCENT}% and ${MAX_NONPROFIT_CONTRIBUTION_PERCENT}%, inclusive.`);
  }
  return Math.round(rate * 100) / 100;
}

export function isNonprofitPolicyConfigured(settings: any): boolean {
  return Boolean(
    isValidNonprofitContributionRate(settings?.nonprofitContributionRates?.platform)
    && typeof settings?.charityName === "string"
    && settings.charityName.trim(),
  );
}

export function nonprofitAllocationCents(grossCents: number, percentage: number): number {
  if (!Number.isFinite(grossCents) || grossCents <= 0 || !isValidNonprofitContributionRate(percentage)) return 0;
  return Math.round(grossCents * percentage / 100);
}

export function declaredNonprofitName(declaration: any): string {
  return String(declaration?.publicName || declaration?.legalName || "").trim();
}

export function hasAcknowledgedNonprofitDeclaration(declaration: any): boolean {
  return declaration?.programAcknowledged === true;
}

export function hasPrizeReadyNonprofitDeclaration(declaration: any): boolean {
  const rate = Number(declaration?.contributionRate);
  const acknowledgedRate = Number(declaration?.contributionRateAtAcknowledgment);
  return Boolean(
    declaredNonprofitName(declaration)
    && hasAcknowledgedNonprofitDeclaration(declaration)
    && isValidNonprofitContributionRate(rate)
    && isValidNonprofitContributionRate(acknowledgedRate)
    && Math.round(rate * 100) === Math.round(acknowledgedRate * 100),
  );
}

export type PlatformMatchSource = {
  sourceId: string;
  donorName: string;
  donorRole: "contestant" | "host";
  nonprofitName: string;
  contributionCents: number;
};

export type PlatformMatchAllocation = PlatformMatchSource & {
  matchCents: number;
};

/**
 * Percentage mode matches the platform rate against each participant's
 * contribution. Cash mode aims for a dollar-for-dollar match. In both modes,
 * total matches are capped by the platform's share allocation and by donors'
 * actual contributions.
 */
export function calculatePlatformMatchAllocations(
  sources: PlatformMatchSource[],
  platformShareCents: number,
  platformRate: number,
  mode: PlatformMatchMode,
): PlatformMatchAllocation[] {
  if (!isValidNonprofitContributionRate(platformRate) || !Number.isFinite(platformShareCents) || platformShareCents <= 0) {
    return [];
  }

  const eligible = sources
    .map((source) => {
      const contributionCents = Math.max(0, Math.round(Number(source.contributionCents) || 0));
      const requestedCents = mode === "cash"
        ? contributionCents
        : Math.round(contributionCents * platformRate / 100);
      return { ...source, contributionCents, requestedCents: Math.min(contributionCents, requestedCents) };
    })
    .filter((source) =>
      source.sourceId
      && source.nonprofitName.trim()
      && source.contributionCents > 0
      && source.requestedCents > 0,
    );

  const requestedTotal = eligible.reduce((sum, source) => sum + source.requestedCents, 0);
  const platformBudget = nonprofitAllocationCents(platformShareCents, platformRate);
  const matchTotal = Math.min(requestedTotal, platformBudget);
  if (!matchTotal || !requestedTotal) return [];
  if (matchTotal === requestedTotal) {
    return eligible.map(({ requestedCents, ...source }) => ({ ...source, matchCents: requestedCents }));
  }

  const shares = eligible.map((source) => {
    const exact = source.requestedCents * matchTotal / requestedTotal;
    return { source, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let unassigned = matchTotal - shares.reduce((sum, share) => sum + share.cents, 0);
  shares
    .sort((a, b) => b.remainder - a.remainder || a.source.sourceId.localeCompare(b.source.sourceId))
    .forEach((share) => {
      if (unassigned > 0 && share.cents < share.source.requestedCents) {
        share.cents += 1;
        unassigned -= 1;
      }
    });

  return shares
    .filter((share) => share.cents > 0)
    .map(({ source, cents }) => {
      const { requestedCents: _requestedCents, ...matchSource } = source;
      return { ...matchSource, matchCents: cents };
    })
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}