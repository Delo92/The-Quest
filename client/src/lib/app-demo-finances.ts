import { DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT, nonprofitAllocationCents } from "../../../shared/nonprofit-policy";

// Demo-only sample recipients; never used to populate real participant accounts.
export const demoArtistNonprofitDeclaration = { publicName: "It Stops Now Foundation" };
export const demoHostNonprofitDeclaration = { publicName: "Event Pro Group Foundation" };

export function buildDemoEarnings(grossCents: number, scheduledCents: number, paidCents: number) {
  const estimatedNonprofitCents = nonprofitAllocationCents(grossCents, DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT);
  const netCents = grossCents - estimatedNonprofitCents;
  if (!Number.isInteger(scheduledCents) || !Number.isInteger(paidCents)
    || scheduledCents < 0 || paidCents < 0 || scheduledCents + paidCents > netCents) {
    throw new Error("Demo scheduled and paid payouts must fit within earnings after the nonprofit deduction.");
  }
  return {
    grossCents,
    nextPayoutCents: scheduledCents,
    pendingCents: netCents - scheduledCents - paidCents,
    paidCents,
    nonprofitCents: 0,
    charityPercentage: DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT,
    charityRateSource: "default",
    estimatedNonprofitCents,
  };
}
