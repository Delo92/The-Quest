import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar, Vote, Heart, Users, Crown, Award, ChevronRight, ShoppingCart, Menu, ChevronDown, Clock3, ImageIcon } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { slugify } from "@shared/slugify";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";
import CompetitionTrackingPanel, { type CompetitionTrackingContestant } from "@/components/competition-tracking-panel";
import {
  CompetitionCountdownPanel,
  formatCompetitionDate,
  getCompetitionPhase,
  getCompetitionSchedule,
} from "@/components/competition-countdown";

interface ContestantWithProfile {
  id: number;
  competitionId: number;
  talentProfileId: number;
  applicationStatus: string;
  voteCount: number;
  tournamentPoints?: number;
  stageResults?: Record<string, "active" | "eliminated" | "finalist" | "winner">;
  talentProfile: {
    id: number;
    displayName: string;
    stageName?: string | null;
    bio: string | null;
    category: string | null;
    imageUrls: string[] | null;
    imageBackupUrls?: string[] | null;
    location: string | null;
  };
}

interface CompetitionStage {
  id: string;
  order: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  submissionStartDate: string | null;
  submissionEndDate: string | null;
  votingStartDate: string | null;
  votingEndDate: string | null;
  eliminationCount: number;
  isFinale: boolean;
}

interface StageSubmission {
  id: string;
  stageId: string;
  contestantId: number;
  mediaType: "image" | "video";
  mediaUrl: string;
  thumbnailUrl?: string | null;
  title: string | null;
  description: string | null;
}

interface StageLeaderboardResponse {
  competitionId: number;
  stage: CompetitionStage;
  totalVotes: number;
  leaderboard: Array<{
    contestantId: number;
    totalVotes: number;
    freeVotes: number;
    paidVotes: number;
    rank: number;
    votePercentage: number;
  }>;
}

interface ContestantVideo {
  uri: string;
  name: string;
  embedUrl: string;
  duration: number;
  width?: number;
  height?: number;
  thumbnail?: string | null;
}

interface CompetitionDetail {
  id: number;
  title: string;
  description: string | null;
  category: string;
  coverImage: string | null;
  coverVideo: string | null;
  status: string;
  voteCost: number;
  maxVotesPerDay: number;
  startDate: string | null;
  endDate: string | null;
  startDateTbd?: boolean;
  endDateTbd?: boolean;
  votingStartDate?: string | null;
  votingEndDate?: string | null;
  contestants: ContestantWithProfile[];
  totalVotes: number;
  hostedBy?: string | null;
  themeColor?: string | null;
  stages?: CompetitionStage[];
}

interface CompetitionTrackingResponse {
  competitionId: number;
  totalVotes: number;
  totalPoints: number;
  onlineVotes: number;
  inPersonVotes: number;
  updatedAt: string;
  contestants: CompetitionTrackingContestant[];
}

function dateBoundary(value: string | null | undefined, endOfDay = false): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.includes("T") ? value : `${value}${endOfDay ? "T23:59:59.999" : "T00:00:00.000"}`);
  return Number.isNaN(parsed) ? null : parsed;
}

function isStageVotingOpen(stage: CompetitionStage): boolean {
  const start = dateBoundary(stage.votingStartDate || stage.startDate);
  const end = dateBoundary(stage.votingEndDate || stage.endDate, true);
  const now = Date.now();
  return start !== null && end !== null && now >= start && now <= end;
}

function formatStageWindow(stage: CompetitionStage): string {
  const start = stage.startDate;
  const end = stage.endDate;
  if (!start || !end) return "Schedule TBD";
  return `${new Date(start).toLocaleDateString()} – ${new Date(end).toLocaleDateString()}`;
}

function stageVideoEmbedUrl(mediaUrl: string): string {
  const match = mediaUrl.match(/(?:vimeo\.com\/(?:video\/)?|\/videos\/)(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : mediaUrl;
}

export default function CompetitionDetailPage() {
  const params = useParams<{ categorySlug: string; compSlug: string }>();
  const categorySlug = params?.categorySlug;
  const compSlug = params?.compSlug;
  const { user } = useAuth();
  const { toast } = useToast();

  const voteSource = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("source") === "in_person" ? "in_person" : "online";
  }, []);

  const isInPersonVoting = voteSource === "in_person";

  const { getImage, getMedia, getText } = useLivery();
  const [activeSection, setActiveSection] = useState<"contestants" | "tracking">(() =>
    new URLSearchParams(window.location.search).get("view") === "tracking" ? "tracking" : "contestants"
  );
  const [selectedStageId, setSelectedStageId] = useState("overview");
  const [mobileStageMenuOpen, setMobileStageMenuOpen] = useState(false);
  const { data: competition, isLoading } = useQuery<CompetitionDetail>({
    queryKey: ["/api/resolve/competition", categorySlug, compSlug],
    enabled: !!categorySlug && !!compSlug,
  });
  const { data: contestantVideoData = [], isLoading: isLoadingContestantVideos } = useQuery<{ contestantId: number; videos: ContestantVideo[] }[]>({
    queryKey: ["/api/resolve/competition", categorySlug, compSlug, "videos"],
    enabled: !!competition && !!categorySlug && !!compSlug,
    staleTime: 60_000,
  });
  const trackingQuery = useQuery<CompetitionTrackingResponse>({
    queryKey: ["/api/resolve/competition", categorySlug, compSlug, "tracking"],
    enabled: !!competition && !!categorySlug && !!compSlug && activeSection === "tracking",
    staleTime: 0,
    refetchInterval: activeSection === "tracking" ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const id = competition?.id?.toString();
  const activeStageId = selectedStageId === "overview" ? null : selectedStageId;
  const stageLeaderboardQuery = useQuery<StageLeaderboardResponse>({
    queryKey: ["/api/competitions", id, "stages", activeStageId, "leaderboard"],
    enabled: !!id && !!activeStageId,
    staleTime: 15_000,
  });
  const stageSubmissionsQuery = useQuery<StageSubmission[]>({
    queryKey: ["/api/competitions", id, "stages", activeStageId, "submissions"],
    enabled: !!id && !!activeStageId,
    staleTime: 15_000,
  });
  const contestantVideos = useMemo(
    () => new Map(contestantVideoData.map(({ contestantId, videos }) => [contestantId, videos])),
    [contestantVideoData],
  );

  useSEO({
    title: competition ? `${competition.title} - ${competition.category} Competition` : "Competition",
    description: competition?.description || (competition ? `Vote in the ${competition.title} ${competition.category} competition on The Quest. Browse contestants, cast your vote, and help decide the winner!` : undefined),
    ogImage: competition?.coverImage || undefined,
    canonical: competition ? `https://thequest-2dc77.firebaseapp.com/${slugify(competition.category)}/${slugify(competition.title)}` : undefined,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ contestantId, stageId }: { contestantId: number; stageId?: string }) => {
      const refCode = localStorage.getItem("hfc_ref") || undefined;
      await apiRequest("POST", `/api/competitions/${id}/vote`, { contestantId, stageId, source: voteSource, refCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resolve/competition", categorySlug, compSlug] });
      queryClient.invalidateQueries({ queryKey: ["/api/resolve/competition", categorySlug, compSlug, "tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions", id, "stages", activeStageId, "leaderboard"] });
      toast({ title: "Vote cast!", description: "Your vote has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Vote failed", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <SiteNavbar />
        <div className="max-w-5xl mx-auto px-4 py-32">
          <Skeleton className="h-64 mb-6 bg-white/5" />
          <Skeleton className="h-8 w-1/2 mb-4 bg-white/10" />
          <Skeleton className="h-4 w-3/4 bg-white/10" />
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <SiteNavbar />
        <div className="text-center">
          <Trophy className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Competition not found</h3>
          <Link href="/competitions">
            <Button variant="ghost" className="mt-4 text-orange-400" data-testid="button-back">Back to Competitions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const stages = [...(competition.stages || [])].sort((a, b) => a.order - b.order);
  const selectedStage = stages.find((stage) => stage.id === activeStageId) || null;
  const stageLeaderboard = new Map(
    (stageLeaderboardQuery.data?.leaderboard || []).map((entry) => [entry.contestantId, entry]),
  );
  const stageSubmissions = new Map(
    (stageSubmissionsQuery.data || []).map((submission) => [submission.contestantId, submission]),
  );
  const getContestantVoteCount = (contestant: ContestantWithProfile) => (
    selectedStage ? stageLeaderboard.get(contestant.id)?.totalVotes || 0 : contestant.voteCount
  );
  const maxVotes = Math.max(...(competition.contestants?.map(getContestantVoteCount) || [1]), 1);
  const schedule = getCompetitionSchedule(competition);
  const competitionPhase = getCompetitionPhase(competition);
  const isVotingOpen = (competition.status === "voting" || competition.status === "active")
    && competitionPhase !== "upcoming"
    && competitionPhase !== "ended";
  const isInPersonOnlyEvent = (competition as any).inPersonOnly === true;
  const canVote = (selectedStage ? isStageVotingOpen(selectedStage) : isVotingOpen)
    && (!isInPersonOnlyEvent || isInPersonVoting);
  const sorted = [...(competition.contestants || [])].sort(
    (a, b) => selectedStage
      ? getContestantVoteCount(b) - getContestantVoteCount(a)
      : (b.tournamentPoints ?? b.voteCount) - (a.tournamentPoints ?? a.voteCount)
  );
  const selectStage = (stageId: string) => {
    setSelectedStageId(stageId);
    setActiveSection("contestants");
    setMobileStageMenuOpen(false);
  };

  // Per-competition theme derived from themeColor (falls back to platform orange)
  const accent      = competition.themeColor || "#FF5A09";
  const accentBg    = competition.themeColor ? "#FFB3D9" : "#FF5A09";   // bubblegum pink vs orange
  const accentText  = competition.themeColor ? "#000000" : "#ffffff";   // black on bubblegum, white on orange
  const accentMuted = competition.themeColor ? `${competition.themeColor}20` : "rgba(255,90,9,0.08)";
  const accentFont  = competition.themeColor ? "'Bebas Neue', sans-serif" : undefined;
  // Slanted parallelogram clip-path for branded buttons (not square)
  const clipBtn     = competition.themeColor
    ? "polygon(14px 0%, 100% 0%, calc(100% - 14px) 100%, 0% 100%)"
    : undefined;
  // Atmospheric gradient background for themed competitions
  const pageBgStyle = competition.themeColor
    ? {
        background: `
          radial-gradient(ellipse 90% 35% at 50% 0%,   ${competition.themeColor}18 0%, transparent 65%),
          radial-gradient(ellipse 50% 25% at 10% 40%,  ${competition.themeColor}0d 0%, transparent 55%),
          radial-gradient(ellipse 45% 20% at 90% 60%,  ${competition.themeColor}0a 0%, transparent 50%),
          linear-gradient(180deg, #0d0008 0%, #060006 40%, #040004 70%, #000 100%)
        `,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section className="relative overflow-hidden">
        {(() => {
          if (competition.coverImage) {
            return (
              <>
                <div className="h-[270px] md:h-[340px] relative overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${competition.coverImage}')` }} />
                  <div className="absolute inset-0 bg-black/65" />
                  {competition.themeColor ? (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pt-8 pb-6 px-8 z-20 w-[calc(100%-60px)] max-w-[552px]">
                      <p className="text-base leading-relaxed mb-1" style={{ color: `${competition.themeColor}99` }}>
                        <Link href="/competitions" className="transition-colors hover:opacity-100" style={{ color: `${competition.themeColor}99` }} data-testid="link-back">Competitions</Link>
                        <span className="mx-2">/</span>{competition.category}
                      </p>
                      <h2 className="uppercase leading-none tracking-widest drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem,6vw,4rem)", color: competition.themeColor, letterSpacing: "0.15em", textShadow: `0 0 24px ${competition.themeColor}55` }} data-testid="text-competition-title">{competition.title}</h2>
                    </div>
                  ) : (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-10 pb-6 px-8 z-20 w-[calc(100%-60px)] max-w-[552px]">
                      <p className="text-black/50 text-base leading-relaxed mb-1">
                        <Link href="/competitions" className="hover:text-[#FF5A09] transition-colors text-black/50" data-testid="link-back">Competitions</Link>
                        <span className="mx-2">/</span>{competition.category}
                      </p>
                      <h2 className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none" style={{ letterSpacing: "10px" }} data-testid="text-competition-title">{competition.title}</h2>
                    </div>
                  )}
                </div>
              </>
            );
          }
          const fallback = getMedia("competition_detail_header", "");
          if (!competition.coverVideo && fallback.url) {
            return (
              <div className="h-[270px] md:h-[340px] relative overflow-hidden">
                {fallback.type === "video"
                  ? <video src={fallback.url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
                  : <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${fallback.url}')` }} />
                }
                <div className="absolute inset-0 bg-black/65" />
                {competition.themeColor ? (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pt-8 pb-6 px-8 z-20 w-[calc(100%-60px)] max-w-[552px]">
                    <p className="text-base leading-relaxed mb-1" style={{ color: `${competition.themeColor}99` }}>
                      <Link href="/competitions" className="transition-colors hover:opacity-100" style={{ color: `${competition.themeColor}99` }} data-testid="link-back">Competitions</Link>
                      <span className="mx-2">/</span>{competition.category}
                    </p>
                    <h2 className="uppercase leading-none tracking-widest drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem,6vw,4rem)", color: competition.themeColor, letterSpacing: "0.15em", textShadow: `0 0 24px ${competition.themeColor}55` }} data-testid="text-competition-title">{competition.title}</h2>
                  </div>
                ) : (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-10 pb-6 px-8 z-20 w-[calc(100%-60px)] max-w-[552px]">
                    <p className="text-black/50 text-base leading-relaxed mb-1">
                      <Link href="/competitions" className="hover:text-[#FF5A09] transition-colors text-black/50" data-testid="link-back">Competitions</Link>
                      <span className="mx-2">/</span>{competition.category}
                    </p>
                    <h2 className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none" style={{ letterSpacing: "10px" }} data-testid="text-competition-title">{competition.title}</h2>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div className="bg-black/80 pt-20 pb-0">
              {competition.themeColor ? (
                <div className="mx-auto text-center pt-8 pb-6 px-8 w-[calc(100%-60px)] max-w-[552px]">
                  <p className="text-base leading-relaxed mb-1" style={{ color: `${competition.themeColor}99` }}>
                    <Link href="/competitions" className="transition-colors hover:opacity-100" style={{ color: `${competition.themeColor}99` }} data-testid="link-back">Competitions</Link>
                    <span className="mx-2">/</span>{competition.category}
                  </p>
                  <h2 className="uppercase leading-none tracking-widest drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem,6vw,4rem)", color: competition.themeColor, letterSpacing: "0.15em", textShadow: `0 0 24px ${competition.themeColor}55` }} data-testid="text-competition-title">{competition.title}</h2>
                </div>
              ) : (
                <div className="mx-auto bg-white/80 backdrop-blur-sm text-center pt-10 pb-6 px-8 w-[calc(100%-60px)] max-w-[552px]">
                  <p className="text-black/50 text-base leading-relaxed mb-1">
                    <Link href="/competitions" className="hover:text-[#FF5A09] transition-colors text-black/50" data-testid="link-back">Competitions</Link>
                    <span className="mx-2">/</span>{competition.category}
                  </p>
                  <h2 className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none" style={{ letterSpacing: "10px" }} data-testid="text-competition-title">{competition.title}</h2>
                </div>
              )}
            </div>
          );
        })()}

        {competition.coverVideo && (
          <div className="w-full bg-black" style={{ aspectRatio: "16/9", maxHeight: "520px" }}>
            {competition.coverVideo.includes("vimeo.com") ? (
              <iframe
                src={competition.coverVideo.includes("?") ? competition.coverVideo + "&autoplay=1&loop=1&muted=1" : competition.coverVideo + "?autoplay=1&loop=1&muted=1"}
                className="w-full h-full"
                style={{ border: "none", display: "block" }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="Competition video"
              />
            ) : (
              <video src={competition.coverVideo} className="w-full h-full object-cover" controls playsInline />
            )}
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-b from-transparent via-black/70 to-black md:h-28"
          aria-hidden="true"
        />
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10" style={pageBgStyle}>
        {isInPersonVoting && (
          <div className="mb-6 rounded-md bg-[#FF5A09]/10 border border-[#FF5A09]/30 px-4 py-3 flex flex-wrap items-center gap-3" data-testid="banner-in-person">
            <Vote className="h-5 w-5 text-[#FF5A09] shrink-0" />
            <p className="text-sm text-white/80">
              <span className="font-bold text-[#FF5A09]">LIVE EVENT VOTING</span> — Your votes are recorded as in-person votes for this competition.
            </p>
          </div>
        )}
        {isInPersonOnlyEvent && !isInPersonVoting && (
          <div className="mb-6 rounded-md bg-purple-500/10 border border-purple-500/30 px-4 py-3 flex flex-wrap items-center gap-3" data-testid="banner-in-person-only">
            <Vote className="h-5 w-5 text-purple-400 shrink-0" />
            <p className="text-sm text-white/80">
              <span className="font-bold text-purple-400">IN-PERSON ONLY EVENT</span> — This competition accepts votes only at the live venue. Scan the QR code at the event to cast your vote.
            </p>
          </div>
        )}

        {stages.length > 0 && (
          <nav className="mb-8 border-y border-white/10 py-4" aria-label="Competition stages" data-testid="stage-navigation">
            <div className="sm:hidden">
              <button
                type="button"
                onClick={() => setMobileStageMenuOpen((open) => !open)}
                className="flex min-h-[48px] w-full items-center justify-between border border-white/15 bg-[#101010] px-4 text-left text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2"
                style={{ outlineColor: accent }}
                aria-expanded={mobileStageMenuOpen}
                aria-controls="mobile-stage-menu"
                data-testid="button-mobile-stage-menu"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Menu className="h-5 w-5 shrink-0" style={{ color: accent }} />
                  <span className="truncate">{selectedStage?.name || "Competition overview"}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${mobileStageMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {mobileStageMenuOpen && (
                <div id="mobile-stage-menu" className="mt-2 border border-white/10 bg-[#0d0d0d] p-2 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => selectStage("overview")}
                    className={`flex min-h-[44px] w-full items-center px-3 text-left text-sm ${!selectedStage ? "text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
                    style={!selectedStage ? { backgroundColor: accent } : undefined}
                    data-testid="stage-option-overview-mobile"
                  >
                    Competition overview
                  </button>
                  {stages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => selectStage(stage.id)}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-3 px-3 text-left text-sm ${selectedStage?.id === stage.id ? "text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
                      style={selectedStage?.id === stage.id ? { backgroundColor: accent } : undefined}
                      data-testid={`stage-option-${stage.id}-mobile`}
                    >
                      <span>{stage.name}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider opacity-70">
                        {formatStageWindow(stage)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden sm:block overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-2" role="tablist" aria-label="Select a competition stage">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!selectedStage}
                  onClick={() => selectStage("overview")}
                  className={`min-h-[46px] border px-5 text-sm font-bold uppercase tracking-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 ${!selectedStage ? "text-white" : "border-white/15 bg-white/[0.03] text-white/55 hover:border-white/35 hover:text-white"}`}
                  style={{ fontFamily: accentFont, ...(!selectedStage ? { backgroundColor: accent, borderColor: accent } : {}) }}
                  data-testid="stage-option-overview"
                >
                  Overview
                </button>
                {stages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedStage?.id === stage.id}
                    onClick={() => selectStage(stage.id)}
                    className={`min-h-[46px] border px-5 text-sm font-bold uppercase tracking-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 ${selectedStage?.id === stage.id ? "text-white" : "border-white/15 bg-white/[0.03] text-white/55 hover:border-white/35 hover:text-white"}`}
                    style={{ fontFamily: accentFont, ...(selectedStage?.id === stage.id ? { backgroundColor: accent, borderColor: accent } : {}) }}
                    data-testid={`stage-option-${stage.id}`}
                  >
                    {stage.name}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        )}

        {selectedStage ? (
          <section className="mb-6 border-l-2 bg-[#101010] px-5 py-5 sm:px-6" style={{ borderLeftColor: accent }} data-testid="selected-stage-summary">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[2px]" style={{ color: accent, fontFamily: accentFont }}>
                  {selectedStage.isFinale ? "Finale stage" : `Stage ${selectedStage.order}`}
                </p>
                <h2 className="text-white leading-none" style={{ fontFamily: accentFont || "inherit", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: accentFont ? "0.06em" : "0.02em" }}>{selectedStage.name}</h2>
                {selectedStage.description && (
                  <p className="mt-3 text-sm leading-7 sm:text-base" style={{ color: "rgba(255,255,255,0.5)", fontStyle: accentFont ? "italic" : "normal", fontWeight: 300 }} data-testid="text-stage-description">
                    {selectedStage.description}
                  </p>
                )}
              </div>
              <div className="inline-flex items-center gap-2 border border-white/10 bg-black/30 px-3 py-2 text-xs uppercase tracking-[1.5px] text-white/55">
                <Clock3 className="h-4 w-4" style={{ color: accent }} />
                {formatStageWindow(selectedStage)}
              </div>
            </div>
          </section>
        ) : competition.description ? (
          <p className="mb-8 max-w-3xl leading-8" style={{ color: "rgba(255,255,255,0.45)", fontStyle: accentFont ? "italic" : "normal", fontWeight: 300, fontSize: "1rem" }} data-testid="text-description">
            {competition.description}
          </p>
        ) : null}

        {competition.hostedBy && (
          <p className="text-white/50 text-sm mb-6 uppercase tracking-wider" data-testid="text-hosted-by">
            Hosted by {competition.hostedBy === "admin" ? getText("site_name", "The Quest") : competition.hostedBy}
          </p>
        )}

         {!selectedStage && <CompetitionCountdownPanel competition={competition} />}

         <div className="flex flex-wrap items-center gap-3 mb-10" role="tablist" aria-label="Competition views">
          {!selectedStage && (
          <Link
            href={`/join?competition=${competition.id}`}
            className="inline-block font-bold uppercase cursor-pointer"
            style={{ letterSpacing: "3px", fontFamily: accentFont || "inherit", fontSize: accentFont ? "1.1rem" : "0.875rem", padding: accentFont ? "0 2rem" : "0 1.5rem", lineHeight: "46px", backgroundColor: accentBg, color: accentText, border: `2px solid ${accentBg}`, clipPath: clipBtn }}
            data-testid="button-join-competition"
          >
            Start Nominating <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
          </Link>
          )}
            {!selectedStage && <button
             type="button"
             role="tab"
             aria-selected={activeSection === "tracking"}
             onClick={() => setActiveSection("tracking")}
             className={`inline-flex items-center gap-2 border font-bold uppercase transition-all duration-300 ${activeSection === "tracking" ? "" : "border-white/20 bg-transparent text-white/70"}`}
             style={{ letterSpacing: "3px", fontFamily: accentFont || "inherit", fontSize: accentFont ? "1.05rem" : "0.875rem", padding: accentFont ? "0 1.5rem" : "0 1.25rem", minHeight: "46px", clipPath: clipBtn, ...(activeSection === "tracking" ? { borderColor: accent, backgroundColor: `${accent}18`, color: accent } : {}) }}
             data-testid="button-view-tracking"
            >
             <Vote className="h-4 w-4" />
             Live Tracking
            </button>}
            {!selectedStage && activeSection === "tracking" && (
             <button
               type="button"
               role="tab"
               aria-selected={false}
               onClick={() => setActiveSection("contestants")}
               className="inline-flex min-h-[42px] items-center border border-white/10 px-4 text-sm font-bold uppercase text-white/45 transition-colors hover:border-white/30 hover:text-white/80"
               style={{ letterSpacing: "2px" }}
               data-testid="button-view-contestants"
             >
               Back to Contestants
             </button>
           )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-6 text-sm text-white/40">
            {(selectedStage ? selectedStage.startDate : (schedule.start || schedule.startIsTbd)) && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-white/30" />
                Starts {selectedStage ? formatCompetitionDate(selectedStage.startDate ? new Date(selectedStage.startDate) : null, !selectedStage.startDate) : formatCompetitionDate(schedule.start, schedule.startIsTbd)}
              </span>
            )}
            {(selectedStage ? selectedStage.endDate : (schedule.end || schedule.endIsTbd)) && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-white/30" />
                Ends {selectedStage ? formatCompetitionDate(selectedStage.endDate ? new Date(selectedStage.endDate) : null, !selectedStage.endDate) : formatCompetitionDate(schedule.end, schedule.endIsTbd)}
              </span>
            )}
            {selectedStage && !selectedStage.startDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-white/30" />
                Stage schedule TBD
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Vote className="h-4 w-4 text-white/30" />
              {(selectedStage ? stageLeaderboardQuery.data?.totalVotes || 0 : competition.totalVotes).toLocaleString()} {selectedStage ? "stage votes" : "total votes"}
            </span>
            {competition.voteCost > 0 && (
              <span className="flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-white/30" />
                {competition.voteCost} credits/vote
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Vote className="h-4 w-4 text-white/30" />
              {competition.maxVotesPerDay} free {competition.maxVotesPerDay === 1 ? "vote" : "votes"}/{selectedStage ? "stage" : "competition"}/day
            </span>
          </div>
        </div>

         {activeSection === "contestants" && <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[4px] mb-2" style={{ color: accentFont ? accent : "#5f5f5f", fontFamily: accentFont, opacity: 0.7 }}>
            {accentFont ? "★ The Cast ★" : "See what's new"}
          </p>
          <h2 className="uppercase leading-none" style={{ fontFamily: accentFont || "inherit", fontSize: accentFont ? "clamp(2.2rem, 5vw, 3.5rem)" : "1.125rem", letterSpacing: accentFont ? "0.12em" : "10px", color: "#fff", fontWeight: accentFont ? 400 : 400 }}>
             {selectedStage ? selectedStage.name : "Contestants"} <span style={{ color: accentFont ? accent : "inherit" }}>({sorted.length})</span>
          </h2>
         </div>}

         {activeSection === "tracking" ? (
           <CompetitionTrackingPanel
             contestants={trackingQuery.data?.contestants || []}
             totalVotes={trackingQuery.data?.totalVotes || 0}
             totalPoints={trackingQuery.data?.totalPoints || 0}
             onlineVotes={trackingQuery.data?.onlineVotes || 0}
             inPersonVotes={trackingQuery.data?.inPersonVotes || 0}
             lastUpdated={trackingQuery.dataUpdatedAt ? new Date(trackingQuery.dataUpdatedAt) : null}
             isRefreshing={trackingQuery.isFetching}
             onRefresh={() => trackingQuery.refetch()}
             isLoading={trackingQuery.isLoading}
             error={trackingQuery.error instanceof Error ? trackingQuery.error.message : null}
           />
         ) : sorted.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted.map((contestant, index) => {
               const voteCount = getContestantVoteCount(contestant);
               const pct = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
              const rankIcon = index === 0 ? <Crown className="h-4 w-4 text-yellow-400" /> : index === 1 ? <Award className="h-4 w-4 text-gray-300" /> : index === 2 ? <Award className="h-4 w-4 text-orange-400" /> : null;
              const videos = contestantVideos.get(contestant.id) || [];
               const stageSubmission = selectedStage ? stageSubmissions.get(contestant.id) : null;
               const stageResult = selectedStage ? contestant.stageResults?.[selectedStage.id] : null;
              const contestantHref = `/${slugify(competition.category)}/${slugify(competition.title)}/${slugify(contestant.talentProfile.stageName || contestant.talentProfile.displayName)}`;

              return (
                <div
                  key={contestant.id}
                  className="group cursor-pointer transition-all duration-500 hover:shadow-[0_5px_80px_0_rgba(0,0,0,0.2)]"
                  data-testid={`card-contestant-${contestant.id}`}
                >
                  <Link href={contestantHref} className={`block relative overflow-hidden bg-black ${videos.length > 0 ? "p-1 space-y-1" : "h-52"}`}>
                    {selectedStage && stageSubmissionsQuery.isLoading ? (
                      <div
                        className="h-52 bg-[#101010] animate-pulse flex items-center justify-center text-xs uppercase tracking-[3px] text-white/20"
                        aria-label="Loading stage submission"
                      >
                        Loading stage media
                      </div>
                    ) : selectedStage && stageSubmission?.mediaType === "video" ? (
                      <div className="relative aspect-video w-full overflow-hidden">
                        <iframe
                          src={`${stageVideoEmbedUrl(stageSubmission.mediaUrl)}?autoplay=1&muted=1&loop=1&background=1`}
                          className="absolute inset-0 h-full w-full pointer-events-none"
                          allow="autoplay; fullscreen; picture-in-picture"
                          title={`${contestant.talentProfile.displayName} — ${selectedStage.name}`}
                        />
                      </div>
                    ) : selectedStage && stageSubmission?.mediaType === "image" ? (
                      <FallbackImage
                        src={stageSubmission.mediaUrl}
                        fallbackSrc={stageSubmission.thumbnailUrl || getImage("talent_profile_fallback", "/images/template/a1.jpg")}
                        alt={`${contestant.talentProfile.stageName || contestant.talentProfile.displayName} — ${selectedStage.name}`}
                        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : selectedStage ? (
                      <div className="flex h-52 flex-col items-center justify-center gap-3 bg-[#101010] px-5 text-center">
                        <ImageIcon className="h-8 w-8 text-white/15" />
                        <span className="text-xs uppercase tracking-[2px] text-white/30">No stage submission yet</span>
                      </div>
                    ) : isLoadingContestantVideos ? (
                      <div
                        className="h-52 bg-[#101010] animate-pulse flex items-center justify-center text-xs uppercase tracking-[3px] text-white/20"
                        aria-label="Loading contestant media"
                      >
                        Loading media
                      </div>
                    ) : videos.length > 0 ? videos.map((video) => {
                      const playerUrl = `${video.embedUrl}${video.embedUrl.includes("?") ? "&" : "?"}autoplay=1&muted=1&loop=1&background=1`;
                      return (
                        <div
                          key={video.uri}
                          className={`relative w-full overflow-hidden ${video.height && video.width && video.height > video.width ? "aspect-[9/16]" : "aspect-video"}`}
                        >
                          <iframe
                            src={playerUrl}
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            allow="autoplay; fullscreen; picture-in-picture"
                            title={`${contestant.talentProfile.displayName} — ${video.name}`}
                          />
                        </div>
                      );
                    }) : (
                      <FallbackImage
                        src={(contestant as any).videoThumbnail || contestant.talentProfile.imageUrls?.[0] || getImage("talent_profile_fallback", "/images/template/a1.jpg")}
                        fallbackSrc={getBackupUrl(contestant.talentProfile.imageUrls, contestant.talentProfile.imageBackupUrls, 0) || getImage("talent_profile_fallback", "/images/template/a1.jpg")}
                        alt={contestant.talentProfile.stageName || contestant.talentProfile.displayName}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                    {rankIcon && (
                      <div className="absolute top-3 left-3 w-8 h-8 bg-black/70 flex items-center justify-center">
                        {rankIcon}
                      </div>
                    )}
                    {stageResult && stageResult !== "active" && (
                      <div className="absolute right-3 top-3 bg-black/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1.5px]" style={{ border: `1px solid ${accent}80`, color: accentBg, fontFamily: accentFont }}>
                        {stageResult}
                      </div>
                    )}
                  </Link>
                  <div className="bg-black group-hover:bg-[#f5f9fa] text-center py-6 px-4 transition-all duration-500">
                    <Link
                      href={contestantHref}
                      data-testid={`link-contestant-name-${contestant.id}`}
                    >
                      <h4 className="text-white group-hover:text-black uppercase font-bold mb-2 transition-colors duration-500" style={{ fontFamily: accentFont || "inherit", fontSize: accentFont ? "1.3rem" : "1rem", letterSpacing: accentFont ? "0.06em" : "0" }} data-testid={`text-contestant-name-${contestant.id}`}>
                        {contestant.talentProfile.stageName || contestant.talentProfile.displayName}
                      </h4>
                    </Link>
                    <div className="mb-3">
                      <span className="text-white/60 group-hover:text-black/60 text-sm transition-colors duration-500" data-testid={`text-votes-${contestant.id}`}>
                        {voteCount} {selectedStage ? "stage votes" : "votes"}
                      </span>
                      {contestant.talentProfile.category && (
                        <>
                          <span className="text-white/30 group-hover:text-black/30 mx-2 transition-colors duration-500">|</span>
                          <span className="text-white/60 group-hover:text-black/60 text-sm transition-colors duration-500">
                            {contestant.talentProfile.category}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="relative h-1.5 bg-white/10 group-hover:bg-black/10 mb-4 transition-colors duration-500">
                      <div
                        className="absolute inset-y-0 left-0 transition-all duration-1000"
                        style={{ width: `${pct}%`, backgroundColor: accent }}
                      />
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Link
                        href={`/${slugify(competition.category)}/${slugify(competition.title)}/${slugify(contestant.talentProfile.stageName || contestant.talentProfile.displayName)}`}
                        className="text-[11px] text-white group-hover:text-black uppercase border-b border-white group-hover:border-black pb-1 transition-colors duration-500"
                        style={{ letterSpacing: "4px" }}
                        data-testid={`link-profile-${contestant.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Profile
                      </Link>
                      {canVote && (
                        <div className="flex items-center justify-center gap-2 w-full flex-wrap">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              voteMutation.mutate({ contestantId: contestant.id, stageId: selectedStage?.id });
                            }}
                            disabled={voteMutation.isPending}
                            className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-black group-hover:bg-[#111] text-white font-bold text-sm capitalize px-4 py-2.5 min-h-[44px] border border-black transition-all duration-500 hover:bg-white hover:text-black cursor-pointer disabled:opacity-50"
                            data-testid={`button-vote-${contestant.id}`}
                          >
                            <Heart className="h-3.5 w-3.5 flex-shrink-0" />
                            {voteMutation.isPending ? "Voting..." : "Vote Free"}
                          </button>
                          {!isInPersonOnlyEvent && (
                            <Link
                               href={`/checkout/${competition.id}/${contestant.id}${selectedStage ? `?stageId=${encodeURIComponent(selectedStage.id)}` : ""}`}
                              className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 font-bold capitalize px-4 py-2.5 min-h-[44px] border transition-all duration-500 cursor-pointer"
                              style={{ backgroundColor: accentBg, color: accentText, borderColor: accentBg, fontFamily: accentFont || "inherit", fontSize: accentFont ? "1rem" : "0.875rem", letterSpacing: accentFont ? "2px" : "0", clipPath: clipBtn }}
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-buy-votes-${contestant.id}`}
                            >
                              <ShoppingCart className="h-3.5 w-3.5 flex-shrink-0" />
                              Buy Votes
                            </Link>
                          )}
                        </div>
                      )}
                      {isVotingOpen && isInPersonOnlyEvent && !isInPersonVoting && (
                        <span className="text-[11px] text-white/40 uppercase" style={{ letterSpacing: "3px" }} data-testid={`text-in-person-only-${contestant.id}`}>
                          Scan QR to Vote
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-white/10 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No contestants yet</h3>
            <p className="text-sm text-white/30 mb-6">Be the first to apply!</p>
            {!user && (
              <a href="/login">
                <span
                  className="inline-block bg-black text-white font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer"
                  data-testid="button-apply-login"
                >
                  Log in to Apply <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
                </span>
              </a>
            )}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
