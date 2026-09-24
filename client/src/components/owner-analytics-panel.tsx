import { useQuery } from "@tanstack/react-query";
import type { OwnerAnalyticsCompetition, OwnerAnalyticsEntry, OwnerAnalyticsResponse } from "@shared/owner-analytics";
import { AlertCircle, ArrowUpRight, Eye, Play, RefreshCw, Trophy, UserRound } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const numberFormat = new Intl.NumberFormat("en-US");

function count(value: number) {
  return numberFormat.format(value ?? 0);
}

function Metric({
  label,
  value,
  icon: Icon,
  accent,
  detail,
  valueTestId,
}: {
  label: string;
  value: number;
  icon: typeof Eye;
  accent: string;
  detail: string;
  valueTestId: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] ${accent}`} aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums text-white sm:text-3xl" data-testid={valueTestId}>{count(value)}</p>
      <p className="mt-1 text-xs text-white/35">{detail}</p>
    </div>
  );
}

function LinkLabel({ path, children }: { path: string; children: React.ReactNode }) {
  if (!path) return <>{children}</>;

  return (
    <Link
      href={path}
      data-testid={`link-public-page-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
      className="group/link inline-flex max-w-full items-center gap-1.5 text-left hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171717]"
    >
      <span className="truncate">{children}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/25 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5 group-hover/link:text-orange-300" aria-hidden="true" />
      <span className="sr-only">Open public page</span>
    </Link>
  );
}

function EntryRow({ entry }: { entry: OwnerAnalyticsEntry }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-t border-white/10 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-6" data-testid={`analytics-entry-${entry.contestantId}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white/85">
          <LinkLabel path={entry.pagePath}>{entry.displayName}</LinkLabel>
        </p>
        <p className="mt-1 text-xs text-white/35">Approved entry</p>
      </div>
      <div className="flex items-center justify-between gap-3 md:block md:min-w-[112px]">
        <span className="text-xs text-white/40">Website visitors</span>
        <span className="block text-sm font-semibold tabular-nums text-white/80 sm:mt-1" data-testid={`text-entry-visitors-${entry.contestantId}`}>{count(entry.websiteVisitors)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 md:block md:min-w-[96px] md:text-right">
        <span className="text-xs text-white/40">Unique plays</span>
        <span className="block text-sm font-semibold tabular-nums text-orange-300 sm:mt-1" data-testid={`text-entry-plays-${entry.contestantId}`}>{count(entry.uniquePlays)}</span>
      </div>
    </div>
  );
}

function CompetitionBlock({ competition }: { competition: OwnerAnalyticsCompetition }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]" aria-labelledby={`analytics-competition-${competition.competitionId}`} data-testid={`analytics-competition-${competition.competitionId}`}>
      <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/75">{competition.category || "Competition"}</p>
          <h3 id={`analytics-competition-${competition.competitionId}`} className="truncate text-lg font-semibold text-white">
            <LinkLabel path={competition.pagePath}>{competition.title}</LinkLabel>
          </h3>
          <p className="mt-1 text-xs text-white/35">
            {competition.entries.length} approved {competition.entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:min-w-[230px] md:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">Website visitors</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-white/80" data-testid={`text-competition-visitors-${competition.competitionId}`}>{count(competition.websiteVisitors)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">Unique plays</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-orange-300" data-testid={`text-competition-plays-${competition.competitionId}`}>{count(competition.uniquePlays)}</p>
          </div>
        </div>
      </div>

      {competition.entries.length > 0 ? (
        <div className="px-4 sm:px-5">
          <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-6 border-b border-white/10 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30 md:grid">
            <span>Entry</span>
            <span className="min-w-[112px]">Website visitors</span>
            <span className="min-w-[96px] text-right">Unique plays</span>
          </div>
          {competition.entries.map((entry) => (
            <EntryRow key={`${competition.competitionId}-${entry.contestantId}`} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="p-4 text-sm text-white/40 sm:p-5">No approved entries have been recorded for this competition.</p>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-label="Loading analytics" aria-busy="true">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-2xl bg-white/[0.07]" />)}
      </div>
      <div className="space-y-4">
        {[1, 2].map((item) => <Skeleton key={item} className="h-48 rounded-2xl bg-white/[0.07]" />)}
      </div>
    </div>
  );
}

export default function OwnerAnalyticsPanel() {
  const analytics = useQuery<OwnerAnalyticsResponse>({
    queryKey: ["/api/analytics/my-dashboard"],
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  });

  if (analytics.isLoading) return <LoadingState />;

  if (analytics.isError) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-6 sm:p-8" role="alert" data-testid="analytics-error">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 text-red-300" aria-hidden="true">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold text-white">Analytics unavailable</h2>
            <p className="mt-1 text-sm text-white/50">We couldn’t load your dashboard analytics. Try again in a moment.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => analytics.refetch()}
            className="border-white/15 bg-transparent text-white/75 hover:bg-white/[0.08] hover:text-white"
            data-testid="button-retry-analytics"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  const data = analytics.data;
  if (!data || data.competitions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-14 text-center sm:px-8" data-testid="analytics-empty">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-400/10 text-orange-300" aria-hidden="true">
          <BarChartIcon />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-white">No analytics to show yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
          {data?.role === "talent"
            ? "Once one of your approved entries receives visitors or plays, the activity will appear here."
            : "Once your public competition pages receive visitors or approved entries receive plays, the activity will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="owner-analytics-panel">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/80">Audience activity</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-white">Analytics</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/45">
            See how people discover your public pages and which entries earn attention. Plays are lifetime video counts; repeat plays are included.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-white/45">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Visitors: {data.visitorPeriod}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Plays: {data.playPeriod}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <Metric label="Website visitors" value={data.summary.websiteVisitors} icon={Eye} accent="text-orange-300" detail="Last 30 days" valueTestId="text-analytics-website-visitors" />
        <Metric label="Unique plays" value={data.summary.uniquePlays} icon={Play} accent="text-amber-300" detail="Lifetime" valueTestId="text-analytics-unique-plays" />
        <Metric label="Competitions" value={data.summary.competitionCount} icon={Trophy} accent="text-orange-300" detail={data.role === "host" ? "Your competitions" : "Approved competitions"} valueTestId="text-analytics-competition-count" />
        <Metric label="Entries" value={data.summary.entryCount} icon={UserRound} accent="text-amber-300" detail="Approved entries" valueTestId="text-analytics-entry-count" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white/90">{data.role === "host" ? "Competition performance" : "Entry performance"}</h3>
          <p className="mt-1 text-xs text-white/40">Compare visitor and play totals across your public pages.</p>
        </div>
        <span className="text-xs tabular-nums text-white/35">{data.competitions.length} {data.competitions.length === 1 ? "competition" : "competitions"}</span>
      </div>

      <div className="space-y-4">
        {data.competitions.map((competition) => (
          <CompetitionBlock key={competition.competitionId} competition={competition} />
        ))}
      </div>
    </div>
  );
}

function BarChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-5M12 16V7M16 16v-8" />
    </svg>
  );
}