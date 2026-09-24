export const MAX_NONPROFIT_CONTRIBUTION_PERCENT = 10;

export type NonprofitContributionLevel = "contestant" | "host" | "platform";

export type NonprofitContributionRates = Record<NonprofitContributionLevel, number | null>;

export function isValidNonprofitContributionRate(value: unknown): value is number {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 && rate <= MAX_NONPROFIT_CONTRIBUTION_PERCENT;
}

export function normalizeNonprofitContributionRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0 || rate > MAX_NONPROFIT_CONTRIBUTION_PERCENT) {
    throw new Error(`Each required nonprofit share must be greater than 0% and no more than ${MAX_NONPROFIT_CONTRIBUTION_PERCENT}%.`);
  }
  return Math.round(rate * 100) / 100;
}

export function areNonprofitContributionRatesConfigured(value: unknown): value is NonprofitContributionRates {
  if (!value || typeof value !== "object") return false;
  const rates = value as Partial<NonprofitContributionRates>;
  return isValidNonprofitContributionRate(rates.contestant)
    && isValidNonprofitContributionRate(rates.host)
    && isValidNonprofitContributionRate(rates.platform);
}

export function isNonprofitPolicyConfigured(settings: any): boolean {
  return Boolean(
    areNonprofitContributionRatesConfigured(settings?.nonprofitContributionRates)
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
  return Boolean(declaredNonprofitName(declaration) && hasAcknowledgedNonprofitDeclaration(declaration));
}