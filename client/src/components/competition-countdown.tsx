import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Clock, Timer } from "lucide-react";
import FlipCountdown from "@/components/flip-countdown";

export type CompetitionCountdownPhase = "upcoming" | "live" | "ended" | "unknown";

export interface CompetitionSchedule {
  start: Date | null;
  end: Date | null;
  startIsTbd: boolean;
  endIsTbd: boolean;
}

export interface CompetitionScheduleInput {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startDateTbd?: boolean;
  endDateTbd?: boolean;
  votingStartDate?: string | null;
  votingEndDate?: string | null;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getCompetitionSchedule(competition: CompetitionScheduleInput): CompetitionSchedule {
  const hasVotingStart = Boolean(competition.votingStartDate);
  const hasVotingEnd = Boolean(competition.votingEndDate);

  return {
    start: parseDate(hasVotingStart ? competition.votingStartDate : competition.startDate),
    end: parseDate(hasVotingEnd ? competition.votingEndDate : competition.endDate),
    startIsTbd: !hasVotingStart && Boolean(competition.startDateTbd),
    endIsTbd: !hasVotingEnd && Boolean(competition.endDateTbd),
  };
}

export function getCompetitionPhase(
  competition: CompetitionScheduleInput,
  now = new Date(),
): CompetitionCountdownPhase {
  const schedule = getCompetitionSchedule(competition);
  const nowMs = now.getTime();

  if (schedule.end && nowMs >= schedule.end.getTime()) return "ended";
  if (schedule.start && nowMs < schedule.start.getTime()) return "upcoming";
  if (schedule.start || schedule.end || competition.status === "active" || competition.status === "voting") {
    return "live";
  }
  if (competition.status === "completed") return "ended";
  return "unknown";
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;

  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
  return `${remainingSeconds}s`;
}

function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return new Date(now);
}

export function formatCompetitionDate(date: Date | null, isTbd = false): string {
  if (isTbd) return "TBD";
  if (!date) return "Open";
  return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
}

export function CompetitionCountdownBadge({
  competition,
}: {
  competition: CompetitionScheduleInput;
}) {
  const now = useCurrentTime();
  const schedule = getCompetitionSchedule(competition);
  const phase = getCompetitionPhase(competition, now);
  const target = phase === "upcoming" ? schedule.start : phase === "live" ? schedule.end : null;

  let label = "Dates TBD";
  if (phase === "upcoming") {
    label = target ? `Starts in ${formatDuration(target.getTime() - now.getTime())}` : "Starts TBD";
  } else if (phase === "live") {
    label = target ? `Ends in ${formatDuration(target.getTime() - now.getTime())}` : "Voting is live";
  } else if (phase === "ended") {
    label = "Voting ended";
  }

  const tone = phase === "upcoming"
    ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
    : phase === "live"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : phase === "ended"
        ? "border-white/10 bg-white/5 text-white/45"
        : "border-[#FF5A09]/30 bg-[#FF5A09]/10 text-[#FFB08A]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${tone}`}
      data-testid="competition-countdown-badge"
    >
      <Clock className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function CompetitionCountdownPanel({
  competition,
}: {
  competition: CompetitionScheduleInput;
}) {
  const now = useCurrentTime();
  const schedule = getCompetitionSchedule(competition);
  const phase = getCompetitionPhase(competition, now);
  const target = phase === "upcoming" ? schedule.start : phase === "live" ? schedule.end : null;
  const targetDate = useMemo(() => (target ? new Date(target) : null), [target?.getTime()]);

  const phaseCopy = phase === "upcoming"
    ? {
        eyebrow: "Before the competition",
        title: "Voting starts soon",
        description: "The countdown is on. Come back when voting opens to support your favorite contestant.",
        icon: Timer,
        accent: "text-amber-300",
      }
    : phase === "live"
      ? {
          eyebrow: "Competition is live",
          title: "Voting closes in",
          description: "Cast your vote before the competition closes.",
          icon: CheckCircle2,
          accent: "text-emerald-300",
        }
      : phase === "ended"
        ? {
            eyebrow: "Competition complete",
            title: "Voting has ended",
            description: "This competition is no longer accepting votes.",
            icon: CheckCircle2,
            accent: "text-white/50",
          }
        : {
            eyebrow: "Competition schedule",
            title: "Dates coming soon",
            description: "The competition schedule will be announced soon.",
            icon: Calendar,
            accent: "text-[#FFB08A]",
          };
  const PhaseIcon = phaseCopy.icon;

  return (
    <section
      className="mb-10 overflow-hidden rounded-sm border border-white/10 bg-[#0d0d0d] px-5 py-7 sm:px-8 sm:py-9"
      data-testid="competition-countdown-panel"
    >
      <div className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[3px] text-white/45">
        <PhaseIcon className={`h-4 w-4 ${phaseCopy.accent}`} />
        <span>{phaseCopy.eyebrow}</span>
      </div>
      <h2 className={`mb-3 text-center text-xl font-semibold uppercase tracking-[4px] sm:text-2xl ${phaseCopy.accent}`}>
        {phaseCopy.title}
      </h2>
      <p className="mx-auto mb-8 max-w-xl text-center text-sm leading-relaxed text-white/50">
        {phaseCopy.description}
      </p>

      {targetDate ? (
        <FlipCountdown targetDate={targetDate} title={phase === "upcoming" ? "Time until voting opens" : "Time remaining"} />
      ) : (
        <p className="text-center text-lg font-semibold uppercase tracking-[4px] text-white/35">
          {phase === "live" ? "Voting is open" : "Schedule pending"}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-white/30" />
          Starts {formatCompetitionDate(schedule.start, schedule.startIsTbd)}
        </span>
        <span className="hidden text-white/15 sm:inline">|</span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-white/30" />
          Ends {formatCompetitionDate(schedule.end, schedule.endIsTbd)}
        </span>
      </div>
    </section>
  );
}