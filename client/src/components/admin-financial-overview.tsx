import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Landmark, Users, Vote, Wallet } from "lucide-react";

export type FinancialView = "competitions" | "profiles" | "contestants" | "votes" | "pending";

type FinancialOverview = {
  summary: {
    paidVotingRevenueCents: number;
    paidVotingPurchases: number;
    paidVotingVoteCount: number;
    hostShareCents: number;
    contestantShareCents: number;
    charityShareCents: number;
    pendingPayoutCents: number;
    paidPayoutCents: number;
    forfeitedCents: number;
  };
  competitions: Array<{
    competitionId: number;
    title: string;
    category: string;
    status: string;
    endDate?: string | null;
    hostUid?: string | null;
    hostName: string;
    hostShareCents: number;
    hostSharePercentage: number;
    charityShareCents: number;
    contestantShareCents: number;
    paidVoting: { revenueCents: number; purchaseCount: number; purchasedVoteCount: number };
    paidVoteDetails: Array<{
      id: number;
      contestantName: string;
      purchaserName: string;
      purchaserEmail?: string | null;
      voteCount: number;
      amountCents: number;
      transactionId?: string | null;
      purchasedAt?: string | null;
    }>;
    contestants: Array<{
      contestantId: number;
      name: string;
      profileUserId?: string | null;
      voteCount: number;
      paidVoteCount: number;
      paidVoteRevenueCents: number;
      voteSharePercentage: number;
      earningsCents: number;
      nonprofitCents: number;
      pendingCents: number;
      paidCents: number;
      placement?: number | null;
    }>;
    pendingPayouts: Array<{
      id: string;
      payeeName?: string;
      status: string;
      netCents: number;
      dueDate?: string | null;
      paymentInfoProvided: boolean;
      blockedReason?: string | null;
    }>;
  }>;
  profileEarnings: Array<{
    userId: string;
    talentProfileId: number;
    name: string;
    role: string;
    profileType: "host" | "contestant";
    grossCents: number;
    pendingCents: number;
    paidCents: number;
    nonprofitCents: number;
    nextPayoutCents: number;
    nextPayoutDate?: string | null;
    charitySource: string;
    charitySourceType: "declared" | "platform_default";
    charityPercentage: number;
  }>;
  pendingPayouts: Array<{
    id: string;
    competitionId?: number | null;
    payeeName: string;
    status: string;
    netCents: number;
    dueDate?: string | null;
    paymentInfoProvided: boolean;
    blockedReason?: string | null;
  }>;
  nonprofitDeclarations: Array<{
    name: string;
    role: string;
    declaration: {
      publicName: string;
      legalName: string;
      legalStatus: string;
      taxIdStatus: string;
      taxIdLast4?: string | null;
      donationContactName: string;
      donationContactEmail: string;
      donationContactPhone?: string | null;
      website?: string | null;
      designation?: string | null;
      verificationStatus: string;
    };
  }>;
  platformDefaultCharity: { name: string; percentage: number };
};

const money = (cents: number | undefined) =>
  `$${((Number(cents || 0) || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateLabel = (value?: string | null) => value
  ? new Date(`${value}${value.length === 10 ? "T12:00:00" : ""}`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  : "Not scheduled";

function Section({ title, subtitle, icon: Icon, open, onToggle, children, testId }: any) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] overflow-hidden" data-testid={testId}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70"
        aria-expanded={open}
      >
        <span className="rounded-lg border border-orange-400/20 bg-orange-400/10 p-2 text-orange-300">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{title}</span>
          <span className="mt-0.5 block text-xs text-white/45">{subtitle}</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-white/45" /> : <ChevronRight className="h-4 w-4 text-white/45" />}
      </button>
      {open && <div className="border-t border-white/10 p-4">{children}</div>}
    </section>
  );
}

export default function AdminFinancialOverview({
  activeView,
  onViewChange,
}: {
  activeView: FinancialView | null;
  onViewChange: (view: FinancialView | null) => void;
}) {
  const { data, isLoading, isError } = useQuery<FinancialOverview>({
    queryKey: ["/api/admin/financial-overview"],
  });
  const [openCompetitions, setOpenCompetitions] = useState<Record<number, boolean>>({});

  const toggleCompetition = (id: number) => setOpenCompetitions((current) => ({ ...current, [id]: !current[id] }));

  if (isLoading) return <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6 text-sm text-white/45">Loading financial operations...</div>;
  if (isError || !data) return <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6 text-sm text-red-200">Financial operations could not be loaded.</div>;

  const visibleProfiles = activeView === "contestants"
    ? data.profileEarnings.filter((profile) => profile.profileType === "contestant")
    : data.profileEarnings;

  return (
    <div className="space-y-5" data-testid="admin-financial-overview">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-orange-300/80">Financial operations</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-white">Earnings, allocations, and payouts</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/45">Server-calculated operating totals tied to competitions, hosts, contestants, ledger entries, and payout status.</p>
        </div>
        <Badge variant="outline" className="w-fit border-amber-400/25 bg-amber-400/5 text-amber-200">Manual payout recording</Badge>
      </div>

      {!activeView && <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm text-white/45">Select one of the dashboard cards above to open its financial breakdown.</div>}

      {activeView === "competitions" && <Section title="Competitions and host earnings" subtitle="One competition at a time: paid voting, host share, charity allocation, and contestant details." icon={Landmark} open onToggle={() => onViewChange(null)} testId="financial-section-competitions">
        <div className="space-y-2">
          {data.competitions.length === 0 ? <p className="text-sm text-white/40">No competitions have financial activity yet.</p> : data.competitions.map((competition) => {
            const open = Boolean(openCompetitions[competition.competitionId]);
            return (
              <div key={competition.competitionId} className="rounded-lg border border-white/10 bg-black/20" data-testid={`financial-competition-${competition.competitionId}`}>
                <button type="button" onClick={() => toggleCompetition(competition.competitionId)} className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-white/[0.035] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70" aria-expanded={open}>
                  {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{competition.title}</span>
                      <Badge variant="outline" className="border-white/15 text-[10px] text-white/50">{competition.status}</Badge>
                    </span>
                    <span className="mt-1 block text-xs text-white/40">{competition.category} · Host: {competition.hostName}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-orange-200">{money(competition.paidVoting.revenueCents)}</span>
                    <span className="block text-[10px] text-white/35">paid voting</span>
                  </span>
                </button>
                {open && (
                  <div className="grid gap-4 border-t border-white/10 p-3 lg:grid-cols-[1fr_1.5fr]">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-white/[0.04] p-3"><span className="text-white/40">Host share</span><strong className="mt-1 block text-white">{money(competition.hostShareCents)} <span className="text-[10px] text-white/35">({competition.hostSharePercentage}%)</span></strong></div>
                        <div className="rounded-md bg-white/[0.04] p-3"><span className="text-white/40">Charity share</span><strong className="mt-1 block text-white">{money(competition.charityShareCents)}</strong></div>
                        <div className="rounded-md bg-white/[0.04] p-3"><span className="text-white/40">Contestant share</span><strong className="mt-1 block text-white">{money(competition.contestantShareCents)}</strong></div>
                        <div className="rounded-md bg-white/[0.04] p-3"><span className="text-white/40">Purchases</span><strong className="mt-1 block text-white">{competition.paidVoting.purchaseCount.toLocaleString()}</strong></div>
                      </div>
                      <div className="rounded-md border border-white/10 p-3 text-xs text-white/55">
                        <div className="flex justify-between gap-3"><span>Purchased votes</span><span className="tabular-nums text-white">{competition.paidVoting.purchasedVoteCount.toLocaleString()}</span></div>
                        <div className="mt-2 flex justify-between gap-3"><span>Competition end</span><span className="text-white">{dateLabel(competition.endDate)}</span></div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-xs font-semibold uppercase tracking-wider text-orange-200">Contestant shares</h4><span className="text-[11px] text-white/35">{competition.contestants.length} contestants</span></div>
                      <div className="space-y-2">
                        {competition.contestants.length === 0 ? <p className="text-xs text-white/35">No contestant records for this competition.</p> : competition.contestants.map((contestant) => (
                          <div key={contestant.contestantId} className="rounded-md border border-white/10 bg-white/[0.025] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0"><p className="truncate text-sm text-white">{contestant.name}</p><p className="mt-1 text-[11px] text-white/35">{contestant.placement ? `Placement ${contestant.placement} · ` : ""}{contestant.voteSharePercentage}% paid-vote share</p></div>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-orange-200">{money(contestant.earningsCents)}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/45 sm:grid-cols-4"><span>Paid votes <b className="block text-white">{contestant.paidVoteCount.toLocaleString()}</b></span><span>Vote revenue <b className="block text-white">{money(contestant.paidVoteRevenueCents)}</b></span><span>Pending <b className="block text-white">{money(contestant.pendingCents)}</b></span><span>Nonprofit <b className="block text-white">{money(contestant.nonprofitCents)}</b></span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>}

      {(activeView === "profiles" || activeView === "contestants") && <Section
        title={activeView === "contestants" ? "Contestant earnings" : "Talent and host profile earnings"}
        subtitle={activeView === "contestants" ? "Contestants only: total earnings, next payout, and charity destination." : "Every competitor and host profile, including profiles with no earnings yet."}
        icon={Users}
        open
        onToggle={() => onViewChange(null)}
        testId={activeView === "contestants" ? "financial-section-contestants" : "financial-section-people"}
      >
        <div className="space-y-2">
          {visibleProfiles.length === 0 ? <p className="text-sm text-white/40">No matching profiles were found.</p> : visibleProfiles.map((earning) => (
            <div key={earning.userId} className="grid gap-4 rounded-lg border border-white/10 bg-black/20 p-4 lg:grid-cols-[minmax(180px,1.4fr)_repeat(3,minmax(100px,.65fr))_minmax(190px,1fr)] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-white">{earning.name}</p><Badge variant="outline" className="border-white/15 text-[10px] capitalize text-white/55">{earning.profileType}</Badge></div>
                <p className="mt-1 text-xs text-white/40">Next payout {earning.nextPayoutDate ? dateLabel(earning.nextPayoutDate) : "not scheduled"}</p>
              </div>
              <div><span className="block text-[10px] uppercase tracking-wider text-white/35">Total earnings</span><b className="mt-1 block text-sm tabular-nums text-white">{money(earning.grossCents)}</b></div>
              <div><span className="block text-[10px] uppercase tracking-wider text-white/35">Next payout</span><b className="mt-1 block text-sm tabular-nums text-orange-200">{money(earning.nextPayoutCents)}</b></div>
              <div><span className="block text-[10px] uppercase tracking-wider text-white/35">Paid to date</span><b className="mt-1 block text-sm tabular-nums text-white">{money(earning.paidCents)}</b></div>
              <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
                <span className="block text-[10px] uppercase tracking-wider text-white/35">Charity allocation</span>
                <b className="mt-1 block text-sm text-white">{earning.charityPercentage}% · {earning.charitySource}</b>
                <span className="mt-1 block text-[10px] text-white/35">{earning.charitySourceType === "platform_default" ? "Platform default" : "Profile declaration"} · {money(earning.nonprofitCents)} allocated</span>
              </div>
            </div>
          ))}
        </div>
      </Section>}

      {activeView === "votes" && <Section title="Paid voting details" subtitle={`${data.summary.paidVotingVoteCount.toLocaleString()} paid votes across ${data.summary.paidVotingPurchases.toLocaleString()} purchases.`} icon={Vote} open onToggle={() => onViewChange(null)} testId="financial-section-votes">
        <div className="space-y-4">
          {data.competitions.map((competition) => (
            <div key={competition.competitionId} className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
              <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-medium text-white">{competition.title}</p><p className="mt-1 text-xs text-white/40">{competition.paidVoting.purchaseCount} purchases · {competition.paidVoting.purchasedVoteCount} votes</p></div>
                <b className="tabular-nums text-orange-200">{money(competition.paidVoting.revenueCents)}</b>
              </div>
              {competition.paidVoteDetails.length === 0 ? <p className="p-4 text-xs text-white/35">No paid votes for this competition.</p> : <div className="divide-y divide-white/10">{competition.paidVoteDetails.map((purchase) => (
                <div key={purchase.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[1.2fr_1fr_auto_auto] sm:items-center">
                  <div><p className="text-white">{purchase.contestantName}</p><p className="mt-1 text-white/35">{purchase.purchaserName}{purchase.purchaserEmail ? ` · ${purchase.purchaserEmail}` : ""}</p></div>
                  <span className="text-white/45">{purchase.purchasedAt ? dateLabel(purchase.purchasedAt) : "Date unavailable"}</span>
                  <span className="tabular-nums text-white">{purchase.voteCount.toLocaleString()} votes</span>
                  <b className="tabular-nums text-orange-200">{money(purchase.amountCents)}</b>
                </div>
              ))}</div>}
            </div>
          ))}
        </div>
      </Section>}

      {activeView === "pending" && <Section title="Pending payout queue" subtitle="All payouts waiting for approval, payment information, or manual payout recording." icon={Wallet} open onToggle={() => onViewChange(null)} testId="financial-section-payouts">
        <div className="space-y-2">
          {data.pendingPayouts.length === 0 ? <p className="text-sm text-white/40">No pending payouts.</p> : data.pendingPayouts.map((payout) => (
            <div key={payout.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm text-white">{payout.payeeName}</p><p className="mt-1 text-xs text-white/40">{payout.status.replace("_", " ")} · due {dateLabel(payout.dueDate)}</p>{payout.blockedReason && <p className="mt-1 text-xs text-amber-200">{payout.blockedReason}</p>}</div>
              <div className="flex items-center gap-3"><Badge variant="outline" className={payout.paymentInfoProvided ? "border-green-400/25 text-green-200" : "border-amber-400/25 text-amber-200"}>{payout.paymentInfoProvided ? "Payment details received" : "Payment details missing"}</Badge><span className="font-semibold tabular-nums text-orange-200">{money(payout.netCents)}</span></div>
            </div>
          ))}
        </div>
      </Section>}
    </div>
  );
}