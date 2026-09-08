import { useMemo, useState, type ReactNode } from "react";
import { Activity, BarChart3, Check, Clock3, Crown, RefreshCw, Trophy, Users, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CompetitionTrackingContestant {
  contestantId: number;
  displayName: string;
  stageName?: string | null;
  voteCount: number;
  tournamentPoints: number;
  votePercentage: number;
  online: number;
  inPerson: number;
  imageUrl?: string | null;
}

export interface CompetitionTrackingPanelProps {
  contestants: CompetitionTrackingContestant[];
  totalVotes: number;
  totalPoints: number;
  onlineVotes: number;
  inPersonVotes: number;
  lastUpdated?: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCount(value: number) {
  return numberFormatter.format(Math.max(0, value));
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(Math.max(0, Math.min(100, value)) * 10) / 10}%`;
}

function getFreshnessLabel(lastUpdated?: Date | null) {
  if (!lastUpdated || Number.isNaN(lastUpdated.getTime())) return "Awaiting first sync";

  const elapsed = Math.max(0, Date.now() - lastUpdated.getTime());
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 10) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "—";
}

function ContestantAvatar({
  contestant,
  size = "default",
}: {
  contestant: CompetitionTrackingContestant;
  size?: "default" | "large";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = contestant.stageName || contestant.displayName;
  const sizeClass = size === "large" ? "h-20 w-20 text-xl" : "h-11 w-11 text-sm";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-[#252321] font-semibold tracking-[0.08em] text-[#f2a16f] ${sizeClass}`}
      data-testid={`avatar-contestant-${contestant.contestantId}`}
    >
      {contestant.imageUrl && !imageFailed ? (
        <img
          src={contestant.imageUrl}
          alt={`${label} profile`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(label)}</span>
      )}
    </div>
  );
}

function MetricBar({
  label,
  value,
  total,
  icon,
}: {
  label: string;
  value: number;
  total: number;
  icon: ReactNode;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-2" data-testid={`metric-source-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="flex items-center gap-2 text-white/55">
          {icon}
          {label}
        </span>
        <span className="font-mono tabular-nums text-white/80">{formatCount(value)}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-label={`${label} votes`}
        aria-valuemin={0}
        aria-valuemax={total || 1}
        aria-valuenow={value}
      >
        <div
          className="h-full rounded-full bg-[#db6d2f] transition-transform duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, percentage))}%`, transformOrigin: "left center" }}
        />
      </div>
      <p className="text-right text-[11px] font-mono tabular-nums text-white/35">{formatPercent(percentage)} of total</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Loading live standings" data-testid="competition-tracking-loading">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
        <div className="h-52 rounded-sm border border-white/[0.08] bg-white/[0.04]" />
        <div className="space-y-3 rounded-sm border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="h-3 w-20 rounded bg-white/[0.08]" />
          <div className="h-10 w-32 rounded bg-white/[0.08]" />
          <div className="h-3 w-full rounded bg-white/[0.06]" />
          <div className="h-3 w-4/5 rounded bg-white/[0.06]" />
        </div>
      </div>
      <div className="border-y border-white/[0.08]">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-4 border-b border-white/[0.06] px-3 py-4 last:border-b-0">
            <div className="h-5 w-5 rounded bg-white/[0.08]" />
            <div className="h-11 w-11 rounded-sm bg-white/[0.08]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-white/[0.08]" />
              <div className="h-2 w-full rounded bg-white/[0.06]" />
            </div>
            <div className="hidden h-4 w-16 rounded bg-white/[0.08] sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompetitionTrackingPanel({
  contestants,
  totalVotes,
  totalPoints,
  onlineVotes,
  inPersonVotes,
  lastUpdated,
  isRefreshing,
  onRefresh,
  isLoading = false,
  error = null,
}: CompetitionTrackingPanelProps) {
  const rankedContestants = useMemo(
    () =>
      [...contestants].sort((a, b) => {
        if (b.tournamentPoints !== a.tournamentPoints) return b.tournamentPoints - a.tournamentPoints;
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return (a.stageName || a.displayName).localeCompare(b.stageName || b.displayName);
      }),
    [contestants],
  );

  const leader = rankedContestants[0];
  const leaderName = leader?.stageName || leader?.displayName;
  const sourceTotal = onlineVotes + inPersonVotes;
  const freshnessLabel = isRefreshing ? "Refreshing standings" : getFreshnessLabel(lastUpdated);

  return (
    <section
      className="relative overflow-hidden bg-[#151413] text-white"
      aria-labelledby="competition-tracking-title"
      data-testid="competition-tracking-panel"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#db6d2f]" />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/[0.1] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#db6d2f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#db6d2f]" aria-hidden="true" />
              Live standings
            </div>
            <h2 id="competition-tracking-title" className="text-2xl font-semibold tracking-[-0.03em] text-[#f4f0ec] sm:text-3xl">
              Follow the lead
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/48">
              Vote totals are shown as they arrive. Rankings are ordered by tournament points, with votes breaking a tie.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="flex items-center gap-2 text-xs text-white/45" aria-live="polite" data-testid="text-last-updated">
              {isRefreshing ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{freshnessLabel}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="min-h-10 rounded-sm border-white/15 bg-transparent px-3 text-xs text-white/75 hover:border-[#db6d2f] hover:bg-[#db6d2f]/10 hover:text-white active:translate-y-px"
              aria-label="Refresh live standings"
              data-testid="button-refresh-standings"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isRefreshing ? "Refreshing" : "Refresh"}</span>
            </Button>
          </div>
        </header>

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div className="border border-[#b55735]/50 bg-[#351d16] px-5 py-8 sm:px-8" role="alert" data-testid="competition-tracking-error">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-[#e88754]" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-[#f6e6dc]">Standings are temporarily unavailable</h3>
                  <p className="mt-1 text-sm leading-6 text-[#e2b9a5]">{error}</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="shrink-0 rounded-sm bg-[#db6d2f] text-white hover:bg-[#c45e27] active:translate-y-px"
                data-testid="button-retry-standings"
              >
                Try again
              </Button>
            </div>
          </div>
        ) : rankedContestants.length === 0 ? (
          <div className="border border-dashed border-white/15 bg-[#1b1a18] px-5 py-14 text-center sm:px-8" data-testid="competition-tracking-empty">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#db6d2f]/35 bg-[#db6d2f]/10 text-[#db6d2f]">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-white/90">The board is waiting</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
              Contestant standings will appear here as soon as the competition receives its first entry.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-xs text-white/45">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              No contestants ranked yet
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
            <div className="min-w-0">
               <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden border border-white/[0.1] bg-white/[0.1] sm:grid-cols-2 lg:grid-cols-4">
                 <div className="bg-[#1b1a18] p-5 sm:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Total votes</p>
                  <p className="mt-2 font-mono text-3xl font-medium tabular-nums tracking-[-0.04em] text-[#f4f0ec]" data-testid="text-total-votes">
                    {formatCount(totalVotes)}
                  </p>
                </div>
                <div className="bg-[#1b1a18] p-5 sm:p-6">
                   <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Vote points</p>
                  <p className="mt-2 font-mono text-2xl font-medium tabular-nums text-white/90" data-testid="text-contestant-count">
                     {formatCount(totalPoints)}
                  </p>
                </div>
                <div className="bg-[#1b1a18] p-5 sm:p-6">
                   <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Contestants</p>
                   <p className="mt-2 font-mono text-2xl font-medium tabular-nums text-white/90" data-testid="text-contestant-count">
                     {formatCount(rankedContestants.length)}
                   </p>
                 </div>
                 <div className="bg-[#1b1a18] p-5 sm:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Current lead</p>
                  <p className="mt-2 truncate text-lg font-semibold text-[#db6d2f]" data-testid="text-current-leader">
                    {leaderName}
                  </p>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#db6d2f]">Ranked field</p>
                  <h3 className="mt-1 text-lg font-semibold text-white/90">Who is leading now</h3>
                </div>
                <div className="hidden items-center gap-2 text-[11px] text-white/35 sm:flex">
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Points + vote share</span>
                </div>
              </div>

              <ol className="border-y border-white/[0.1]" aria-label="Contestant standings" data-testid="list-contestants">
                {rankedContestants.map((contestant, index) => {
                  const name = contestant.stageName || contestant.displayName;
                  const percentage = Math.max(0, Math.min(100, contestant.votePercentage));
                  const isLeader = index === 0;

                  return (
                    <li
                      key={contestant.contestantId}
                      className={`group grid grid-cols-[2rem_minmax(0,1fr)_4.2rem_auto] items-center gap-3 border-b border-white/[0.07] px-2 py-4 transition-[background-color,transform] duration-200 last:border-b-0 hover:bg-white/[0.035] sm:grid-cols-[2.25rem_minmax(0,1fr)_5.25rem_5.5rem] sm:gap-4 sm:px-3 ${isLeader ? "bg-[#201b17]" : ""}`}
                      data-testid={`row-contestant-${contestant.contestantId}`}
                    >
                      <div className="flex items-center justify-center text-sm font-mono tabular-nums text-white/35">
                        {isLeader ? <Crown className="h-4 w-4 text-[#db6d2f]" aria-label="Current leader" /> : `0${index + 1}`.slice(-2)}
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <ContestantAvatar contestant={contestant} />
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${isLeader ? "text-white" : "text-white/85"}`}>{name}</p>
                          {contestant.stageName && contestant.displayName !== contestant.stageName && (
                            <p className="truncate text-xs text-white/35">{contestant.displayName}</p>
                          )}
                          <div className="mt-2 h-1.5 w-full min-w-[100px] max-w-[280px] overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label={`${name} vote share`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
                            <div
                              className={`h-full rounded-full transition-transform duration-300 ease-out ${isLeader ? "bg-[#db6d2f]" : "bg-[#a95731]"}`}
                              style={{ width: `${percentage}%`, transformOrigin: "left center" }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm tabular-nums text-white/85">{formatCount(contestant.tournamentPoints)}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/30">points</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium tabular-nums text-white/90">{formatCount(contestant.voteCount)}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#db6d2f]">{formatPercent(percentage)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <aside className="space-y-5">
              <div className="border border-[#db6d2f]/35 bg-[#211b17] p-5 sm:p-6" data-testid="card-current-leader">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#db6d2f]">Current leader</p>
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[#edbd9f]">
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    Rank 01
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <ContestantAvatar contestant={leader} size="large" />
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-semibold tracking-[-0.03em] text-white" data-testid="text-leader-name">{leaderName}</h3>
                    {leader.stageName && leader.displayName !== leader.stageName && (
                      <p className="mt-1 truncate text-sm text-white/45">{leader.displayName}</p>
                    )}
                  </div>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                  <div>
                     <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Points</p>
                     <p className="mt-1 font-mono text-xl tabular-nums text-white/90">{formatCount(leader.tournamentPoints)}</p>
                  </div>
                  <div>
                     <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Votes</p>
                     <p className="mt-1 font-mono text-xl tabular-nums text-white/90">{formatCount(leader.voteCount)}</p>
                   </div>
                   <div>
                     <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Point share</p>
                    <p className="mt-1 font-mono text-xl tabular-nums text-[#db6d2f]">{formatPercent(leader.votePercentage)}</p>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.1] bg-[#1b1a18] p-5 sm:p-6" data-testid="card-vote-sources">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Vote sources</p>
                    <h3 className="mt-1 text-base font-semibold text-white/90">Where support comes from</h3>
                  </div>
                  {sourceTotal === totalVotes && totalVotes > 0 ? (
                    <Check className="h-4 w-4 text-[#db6d2f]" aria-label="Source totals match total votes" />
                  ) : (
                    <Wifi className="h-4 w-4 text-white/30" aria-label="Source totals are updating" />
                  )}
                </div>
                <div className="space-y-6">
                  <MetricBar label="Online" value={onlineVotes} total={totalVotes} icon={<Wifi className="h-3.5 w-3.5 text-[#db6d2f]" aria-hidden="true" />} />
                  <MetricBar label="In person" value={inPersonVotes} total={totalVotes} icon={<Users className="h-3.5 w-3.5 text-[#db6d2f]" aria-hidden="true" />} />
                </div>
                <p className="mt-6 border-t border-white/[0.08] pt-4 text-xs leading-5 text-white/35">
                  Source totals may briefly lag while new votes are being verified.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}