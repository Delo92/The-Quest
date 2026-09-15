import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, CircleDollarSign, Landmark, ShieldCheck, Users, Vote, Wallet } from "lucide-react";

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
    grossCents: number;
    pendingCents: number;
    paidCents: number;
    nonprofitCents: number;
    nextPayoutCents: number;
    nextPayoutDate?: string | null;
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

export default function AdminFinancialOverview() {
  const { data, isLoading, isError } = useQuery<FinancialOverview>({
    queryKey: ["/api/admin/financial-overview"],
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    competitions: true,
    people: true,
    payouts: false,
    nonprofits: false,
  });
  const [openCompetitions, setOpenCompetitions] = useState<Record<number, boolean>>({});

  const toggle = (key: string) => setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  const toggleCompetition = (id: number) => setOpenCompetitions((current) => ({ ...current, [id]: !current[id] }));

  if (isLoading) return <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6 text-sm text-white/45">Loading financial operations...</div>;
  if (isError || !data) return <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6 text-sm text-red-200">Financial operations could not be loaded.</div>;

  const summaryCards = [
    { label: "Paid voting revenue", value: money(data.summary.paidVotingRevenueCents), detail: `${data.summary.paidVotingPurchases.toLocaleString()} purchases`, icon: Vote },
    { label: "Host share recorded", value: money(data.summary.hostShareCents), detail: "From payroll ledger", icon: Users },
    { label: "Contestant earnings", value: money(data.summary.contestantShareCents), detail: "Gross winner entitlements", icon: CircleDollarSign },
    { label: "Pending payouts", value: money(data.summary.pendingPayoutCents), detail: "Approval, blocked, or due", icon: Wallet },
    { label: "Nonprofit allocations", value: money(data.summary.charityShareCents), detail: "Declared in ledger", icon: Landmark },
    { label: "Paid out", value: money(data.summary.paidPayoutCents), detail: "Manually recorded", icon: ShieldCheck },
  ];

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <card.icon className="mb-3 h-4 w-4 text-orange-300" />
            <p className="text-xl font-semibold tabular-nums text-white">{card.value}</p>
            <p className="mt-1 text-xs font-medium text-white/65">{card.label}</p>
            <p className="mt-1 text-[11px] text-white/35">{card.detail}</p>
          </div>
        ))}
      </div>

      <Section title="Competitions and host earnings" subtitle="Expand a competition for paid voting, host share, charity allocation, and contestant-level details." icon={Landmark} open={openSections.competitions} onToggle={() => toggle("competitions")} testId="financial-section-competitions">
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
      </Section>

      <Section title="Talent and profile earnings" subtitle="Review gross entitlements, upcoming payout amounts, paid totals, and nonprofit allocations by person." icon={Users} open={openSections.people} onToggle={() => toggle("people")} testId="financial-section-people">
        <div className="space-y-2">
          {data.profileEarnings.length === 0 ? <p className="text-sm text-white/40">No profile earnings have been recorded.</p> : data.profileEarnings.map((earning) => (
            <div key={earning.userId} className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_repeat(4,auto)] sm:items-center">
              <div><p className="text-sm font-medium text-white">{earning.name}</p><p className="mt-1 text-xs capitalize text-white/40">{earning.role} · Next payout {earning.nextPayoutDate ? dateLabel(earning.nextPayoutDate) : "not scheduled"}</p></div>
              <div className="text-left sm:text-right"><span className="block text-[10px] text-white/35">Upcoming</span><b className="text-sm tabular-nums text-orange-200">{money(earning.nextPayoutCents)}</b></div>
              <div className="text-left sm:text-right"><span className="block text-[10px] text-white/35">Pending</span><b className="text-sm tabular-nums text-white">{money(earning.pendingCents)}</b></div>
              <div className="text-left sm:text-right"><span className="block text-[10px] text-white/35">Paid</span><b className="text-sm tabular-nums text-white">{money(earning.paidCents)}</b></div>
              <div className="text-left sm:text-right"><span className="block text-[10px] text-white/35">Nonprofit</span><b className="text-sm tabular-nums text-white">{money(earning.nonprofitCents)}</b></div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pending payout queue" subtitle="Entries that still need approval, payment information, or manual payout recording." icon={Wallet} open={openSections.payouts} onToggle={() => toggle("payouts")} testId="financial-section-payouts">
        <div className="space-y-2">
          {data.pendingPayouts.length === 0 ? <p className="text-sm text-white/40">No pending payouts.</p> : data.pendingPayouts.map((payout) => (
            <div key={payout.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm text-white">{payout.payeeName}</p><p className="mt-1 text-xs text-white/40">{payout.status.replace("_", " ")} · due {dateLabel(payout.dueDate)}</p>{payout.blockedReason && <p className="mt-1 text-xs text-amber-200">{payout.blockedReason}</p>}</div>
              <div className="flex items-center gap-3"><Badge variant="outline" className={payout.paymentInfoProvided ? "border-green-400/25 text-green-200" : "border-amber-400/25 text-amber-200"}>{payout.paymentInfoProvided ? "Payment details received" : "Payment details missing"}</Badge><span className="font-semibold tabular-nums text-orange-200">{money(payout.netCents)}</span></div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Nonprofit declarations" subtitle="Host and contestant declarations available for formal donation review; no donation is executed from this view." icon={ShieldCheck} open={openSections.nonprofits} onToggle={() => toggle("nonprofits")} testId="financial-section-nonprofits">
        <div className="grid gap-3 lg:grid-cols-2">
          {data.nonprofitDeclarations.length === 0 ? <p className="text-sm text-white/40">No participant has submitted a donation declaration yet.</p> : data.nonprofitDeclarations.map((item) => (
            <div key={`${item.name}-${item.declaration.publicName}`} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-white">{item.declaration.publicName || item.declaration.legalName}</p><p className="mt-1 text-xs text-white/40">{item.name} · {item.role}</p></div><Badge variant="outline" className="border-orange-400/25 text-orange-200">{item.declaration.verificationStatus}</Badge></div>
              <div className="mt-3 space-y-1 text-xs text-white/55"><p>Legal entity: <span className="text-white/75">{item.declaration.legalName}</span></p><p>Contact: <span className="text-white/75">{item.declaration.donationContactName} · {item.declaration.donationContactEmail}</span></p>{item.declaration.website && <p>Website: <span className="text-white/75">{item.declaration.website}</span></p>}<p>Tax ID status: <span className="text-white/75">{item.declaration.taxIdStatus}{item.declaration.taxIdLast4 ? ` · ending ${item.declaration.taxIdLast4}` : ""}</span></p>{item.declaration.designation && <p>Designation: <span className="text-white/75">{item.declaration.designation}</span></p>}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}