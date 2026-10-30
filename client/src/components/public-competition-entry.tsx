import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Play, Radio } from "lucide-react";
import { Link } from "wouter";
import { getVimeoId, formatVideoTitle } from "@/lib/media-utils";
import { slugify, slugifyWithId , competitionSlug as competitionSlugOf } from "@shared/slugify";

export interface PublicCompetition {
  id: number;
  title: string;
  slug?: string | null;
  category: string | null;
  status: string;
  coverImage: string | null;
  themeColor: string | null;
}

export interface CompetitionVideo {
  uri: string;
  name: string;
  embedUrl: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string | null;
}

interface Props {
  competition: PublicCompetition;
  video?: CompetitionVideo;
  videoThumbnail?: string | null;
  contestantName: string;
  contestantId: number;
  index: number;
}

function NativePreview({ video, title }: { video: CompetitionVideo; title: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [mp4, setMp4] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const vimeoId = getVimeoId(video.uri || video.embedUrl);

  useEffect(() => {
    const element = frameRef.current;
    if (!element || !("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "180px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !vimeoId || mp4 || failed) return;
    let cancelled = false;
    fetch(`/api/vimeo/${encodeURIComponent(vimeoId)}/play`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Preview unavailable")))
      .then((data: { progressive?: Array<{ rendition: string; link: string }> }) => {
        if (cancelled) return;
        const source = data.progressive?.find((item) => item.rendition === "360p")
          || data.progressive?.find((item) => item.rendition === "480p")
          || data.progressive?.[0];
        if (source?.link) setMp4(source.link);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [near, vimeoId, mp4, failed]);

  return (
    <div ref={frameRef} className="absolute inset-0">
      {near && mp4 && !failed && (
        <video
          src={mp4}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${hasFrame ? "opacity-100" : "opacity-0"}`}
          muted
          loop
          autoPlay
          playsInline
          preload="none"
          aria-label={`${title} performance preview`}
          onCanPlay={() => setHasFrame(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function statusPresentation(status: string) {
  const normalized = status.toLowerCase();
  if (["active", "voting", "live"].includes(normalized)) return { label: "Voting is open", action: "Vote for this entry", live: true };
  if (["completed", "closed", "ended", "archived"].includes(normalized)) return { label: "Competition closed", action: "View competition", live: false };
  return { label: "Entry approved", action: "View competition", live: false };
}

export default function PublicCompetitionEntry({ competition, video, videoThumbnail, contestantName, contestantId, index }: Props) {
  const accent = competition.themeColor || "#f36b2b";
  const categorySlug = slugify(competition.category || "competition");
  const competitionSlug = competitionSlugOf(competition);
  const contestantSlug = slugifyWithId(contestantName, contestantId);
  const contestantRoute = `/${categorySlug}/${competitionSlug}/${contestantSlug}`;
  const state = statusPresentation(competition.status);
  const thumbnail = video?.thumbnail || videoThumbnail || competition.coverImage;
  const videoTitle = video ? formatVideoTitle(video.name) : "";

  return (
    <article
      className="quest-entry-card group relative overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-[#171719] shadow-[0_24px_80px_rgba(0,0,0,.24)]"
      style={{ ["--entry-accent" as string]: accent, animationDelay: `${Math.min(index * 90, 450)}ms` }}
      data-testid={`card-profile-competition-${competition.id}`}
    >
      <Link
        href={contestantRoute}
        className="relative block aspect-[16/10] cursor-pointer overflow-hidden bg-[#202023] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--entry-accent)] sm:aspect-[16/9]"
        aria-label={`${state.action}: ${contestantName} in ${competition.title}`}
        data-testid={`link-preview-entry-${competition.id}`}
      >
        {thumbnail ? (
          <img src={thumbnail} alt={`${competition.title} entry preview`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]" loading="lazy" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_65%_25%,color-mix(in_srgb,var(--entry-accent)_45%,transparent),transparent_52%),linear-gradient(140deg,#29292c,#131315)]" />
        )}
        {video && <NativePreview video={video} title={videoTitle || competition.title} />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#101012] via-[#101012]/20 to-black/10" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-white/90 backdrop-blur-md">
          {state.live ? <Radio className="h-3 w-3 text-[var(--entry-accent)]" /> : <span className="h-1.5 w-1.5 rounded-full bg-[var(--entry-accent)]" />}
          {state.label}
        </div>
        {video && (
          <span className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition-transform duration-300 group-hover:scale-110" aria-label="Video preview">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--entry-accent)] opacity-90" />
      </Link>
      <div className="relative px-5 pb-5 pt-5 sm:px-7 sm:pb-7">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-white/45">
          <span>{competition.category || "The Quest"}</span>
          <span className="h-px w-6 bg-[var(--entry-accent)]/80" />
          <span>Official entry</span>
        </div>
        <h3 className="max-w-2xl font-display text-2xl leading-tight text-white sm:text-[2rem]">{competition.title}</h3>
        {video ? (
          <p className="mt-2 truncate text-sm text-white/55" title={videoTitle}>Featuring: {videoTitle}</p>
        ) : (
          <p className="mt-2 text-sm text-white/45">No competition video has been added yet.</p>
        )}
        <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.09] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-white/40">A performance by <span className="text-white/75">{contestantName}</span></span>
          <Link
            href={contestantRoute}
            className="inline-flex min-h-12 items-center justify-center gap-3 self-start rounded-full bg-[var(--entry-accent)] px-6 text-[11px] font-bold uppercase tracking-[.15em] text-[#161313] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:self-auto"
            data-testid={`link-vote-entry-${competition.id}`}
          >
            {state.action}<ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
