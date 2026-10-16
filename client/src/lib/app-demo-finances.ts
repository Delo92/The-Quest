import { DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT, nonprofitAllocationCents } from "../../../shared/nonprofit-policy";

// Demo-only sample recipients; never used to populate real participant accounts.
export const demoArtistNonprofitDeclaration = { publicName: "It Stops Now Foundation" };
export const demoHostNonprofitDeclaration = { publicName: "Event Pro Group Foundation" };

export function buildDemoEarnings(grossCents: number, scheduledCents: number) {
  const estimatedNonprofitCents = nonprofitAllocationCents(grossCents, DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT);
  const netCents = grossCents - estimatedNonprofitCents;
  if (!Number.isInteger(scheduledCents) || scheduledCents < 0 || scheduledCents > netCents) {
    throw new Error("Demo scheduled payout must fit within earnings after the nonprofit deduction.");
  }
  return {
    grossCents,
    nextPayoutCents: scheduledCents,
    pendingCents: netCents - scheduledCents,
    paidCents: 0,
    nonprofitCents: 0,
    charityPercentage: DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT,
    charityRateSource: "default",
    estimatedNonprofitCents,
  };
}
