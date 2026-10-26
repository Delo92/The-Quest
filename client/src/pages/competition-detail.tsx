import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar, Vote, Heart, Users, Crown, Award, ChevronRight, ShoppingCart, Menu, ChevronDown, Clock3, ImageIcon, Crop } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isVoteAuthenticationError, VoteAuthDialog } from "@/components/vote-auth-dialog";
import ImageCropDialog, { type ImageCropPosition } from "@/components/image-crop-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { slugify, slugifyWithId } from "@shared/slugify";
import { preserveReferralQuery } from "@/lib/referral";
import { DEFAULT_TALENT_IMAGE_CROP_POSITION, getCompetitionCropImageStyle } from "@shared/image-crop";
import type { VideoShareMetadata } from "@shared/video-share";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";
import CompetitionTrackingPanel, { type CompetitionTrackingContestant } from "@/components/competition-tracking-panel";
import CompetitionShareLinks from "@/components/competition-share-links";
import CompetitionPromoVideos from "@/components/competition-promo-videos";
import CompetitionSummaryText from "@/components/competition-summary-text";
import DemoVimeoPreview from "@/components/demo-vimeo-preview";
import {
  CompetitionCountdownPanel,
  formatCompetitionDate,
  getCompetitionPhase,
  getCompetitionSchedule,
} from "@/components/competition-countdown";

/** Mounts the Vimeo iframe only when the container scrolls into the viewport.
 *  Prevents the browser from opening dozens of player connections at page load. */
function LazyVimeoIframe({ src, title, className, allow }: { src: string; title: string; className?: string; allow?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setVisible(entry.isIntersecting); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {visible && (
        <iframe
          src={src}
          className={className ?? "absolute inset-0 w-full h-full"}
          loading="eager"
          allow={allow ?? "autoplay; fullscreen; picture-in-picture"}
          title={title}
        />
      )}
    </div>
  );
}

function readableTextColor(hexColor: string): string {
  const match = hexColor.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return "#000000";
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

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
    imageCropPositions?: Array<{ x: number; y: number; zoom?: number }> | null;
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
  promoVideos?: string[] | null;
  shareVideo?: VideoShareMetadata | null;
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
  hostedByProfileSlug?: string | null;
  themeColor?: string | null;
  contestantImageCropPositions?: Record<string, Record<string, ImageCropPosition>>;
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

export default function CompetitionDetailPage({ demoMode = false }: { demoMode?: boolean } = {}) {
  const params = useParams<{ categorySlug: string; compSlug: string }>();
  const categorySlug = demoMode ? "music" : params?.categorySlug;
  const compSlug = demoMode ? "cb-publishing-music-quest" : params?.compSlug;
  const { user } = useAuth();
  const { toast } = useToast();
  const [voteAuthOpen, setVoteAuthOpen] = useState(false);
  const [voteAuthContestantId, setVoteAuthContestantId] = useState<number | null>(null);
  const [editingContestantCrop, setEditingContestantCrop] = useState<{
    profileId: number;
    src: string;
    alt: string;
    position: ImageCropPosition;
  } | null>(null);
  const [savingContestantCrop, setSavingContestantCrop] = useState(false);

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
  const saveContestantCrop = async () => {
    if (!editingContestantCrop || !competition || savingContestantCrop) return;
    setSavingContestantCrop(true);
    try {
      const response = await apiRequest(
        "PATCH",
        `/api/competitions/${competition.id}/contestant-image-framing`,
        { profileId: editingContestantCrop.profileId, imageIndex: 0, position: editingContestantCrop.position },
      );
      const result = await response.json() as { contestantImageCropPositions: Record<string, Record<string, ImageCropPosition>> };
      queryClient.setQueryData<CompetitionDetail>(
        ["/api/resolve/competition", categorySlug, compSlug],
        (current) => current
          ? {
              ...current,
              contestantImageCropPositions: result.contestantImageCropPositions,
            }
          : current,
      );
      setEditingContestantCrop(null);
      toast({ title: "Photo framing saved", description: "The updated crop applies only to this competition card." });
    } catch (error: any) {
      toast({
        title: "Could not save photo framing",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingContestantCrop(false);
    }
  };
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
    ogImage: competition?.coverImage || competition?.shareVideo?.posterUrl || undefined,
    ogVideo: competition?.shareVideo || undefined,
    favicon: competition ? competition.coverImage || competition.shareVideo?.posterUrl || undefined : undefined,
    canonical: competition ? `https://thequest-2dc77.firebaseapp.com/${slugify(competition.category)}/${slugify(competition.title)}` : undefined,
    pending: !competition && isLoading,
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
    onError: (error: Error, variables: { contestantId: number; stageId?: string }) => {
      if (isVoteAuthenticationError(error)) {
        setVoteAuthContestantId(variables.contestantId);
        setVoteAuthOpen(true);
        return;
      }
      toast({ title: "Vote failed", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        {!demoMode && <SiteNavbar />}
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
        {!demoMode && <SiteNavbar />}
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
  const genericContestantFallback = getImage("talent_profile_fallback") || undefined;
  const competitionContestantFallback = competition.coverImage || genericContestantFallback;
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

  // Share layout and typography, not Starr Struck's event-specific colors.
  const accent      = competition.themeColor || "#FF5A09";
  const accentBg    = accent;
  const accentText  = readableTextColor(accent);
  const accentMuted = `${accent}20`;
  const accentFont  = "'Bebas Neue', sans-serif";
  const clipBtn     = "polygon(14px 0%, 100% 0%, calc(100% - 14px) 100%, 0% 100%)";
  // Unthemed competitions keep the neutral platform background.
  const pageBgStyle = competition.themeColor ? {
    background: `
      radial-gradient(ellipse 90% 35% at 50% 0%,   ${accent}18 0%, transparent 65%),
      radial-gradient(ellipse 50% 25% at 10% 40%,  ${accent}0d 0%, transparent 55%),
      radial-gradient(ellipse 45% 20% at 90% 60%,  ${accent}0a 0%, transparent 50%),
      linear-gradient(180deg, #101010 0%, #080808 40%, #050505 70%, #000 100%)
    `,
  } : undefined;
  const competitionTitleContent = (
    <>
      <p className="mb-1 text-sm leading-relaxed text-white/85">
        <Link
          href="/competitions"
          className="transition-colors hover:text-white"
          style={{ color: "rgba(255,255,255,0.85)" }}
          data-testid="link-back"
        >
          Competitions
        </Link>
        <span className="mx-2">/</span>{competition.category}
      </p>
      <h2
        className="mx-auto max-w-full uppercase leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(2rem, 6vw, 4rem)",
          color: accent,
          letterSpacing: "0.08em",
          textShadow: `0 2px 12px rgba(0,0,0,0.95), 0 0 24px ${accent}55`,
        }}
        data-testid="text-competition-title"
      >
        {competition.title}
      </h2>
    </>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {!demoMode && <SiteNavbar />}

      <section className="relative overflow-hidden">
        {(() => {
          if (competition.coverImage) {
            return (
              <>
                <div className="h-[270px] md:h-[340px] relative overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${competition.coverImage}')` }} />
                  <div className="absolute inset-0 bg-black/65" />
                  <div className="absolute bottom-0 left-1/2 z-20 w-full max-w-4xl -translate-x-1/2 px-4 pb-6 pt-8 text-center sm:px-6">
                    {competitionTitleContent}
                  </div>
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
                <div className="absolute bottom-0 left-1/2 z-20 w-full max-w-4xl -translate-x-1/2 px-4 pb-6 pt-8 text-center sm:px-6">
                  {competitionTitleContent}
                </div>
              </div>
            );
          }
          return (
            <div className="bg-black/80 pt-16 pb-0">
              <div className="mx-auto w-full max-w-4xl px-4 pb-6 pt-4 text-center sm:px-6">
                {competitionTitleContent}
              </div>
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
              <video src={competition.coverVideo} className="w-full h-full object-cover" controls loop playsInline />
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
                  className={`min-h-[46px] border px-5 text-sm font-bold uppercase tracking-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 ${!selectedStage ? "text-white" : "border-white/20 bg-white/[0.04] text-white/75 hover:border-white/45 hover:text-white"}`}
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
                    className={`min-h-[46px] border px-5 text-sm font-bold uppercase tracking-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 ${selectedStage?.id === stage.id ? "text-white" : "border-white/20 bg-white/[0.04] text-white/75 hover:border-white/45 hover:text-white"}`}
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
                  <CompetitionSummaryText
                    content={selectedStage.description}
                    accentColor={accent}
                    className="mt-3"
                    testId="text-stage-description"
                  />
                )}
              </div>
              <div className="inline-flex items-center gap-2 border border-white/20 bg-black/30 px-3 py-2 text-xs uppercase tracking-[1.5px] text-white/75">
                <Clock3 className="h-4 w-4" style={{ color: accent }} />
                {formatStageWindow(selectedStage)}
              </div>
            </div>
          </section>
        ) : (
          <>
            <CompetitionPromoVideos
              videos={competition.promoVideos ?? []}
              title={competition.title}
              accentColor={accent}
            />
            {competition.description && (
              <CompetitionSummaryText
                content={competition.description}
                accentColor={accent}
                className="mx-auto mb-6 max-w-3xl"
                testId="text-description"
                collapsible
              />
            )}
          </>
        )}

        <div className="mb-8">
          <CompetitionShareLinks competition={competition} />
        </div>

        {competition.hostedBy && (
          competition.hostedByProfileSlug ? (
            <p className="text-white/75 text-sm mb-6 uppercase tracking-wider" data-testid="text-hosted-by">
              Hosted by{" "}
              <Link
                href={`/host/${competition.hostedByProfileSlug}`}
                className="underline decoration-white/30 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A09]"
              >
                {competition.hostedBy}
              </Link>
            </p>
          ) : (
            <p className="text-white/75 text-sm mb-6 uppercase tracking-wider" data-testid="text-hosted-by">
              Hosted by {competition.hostedBy === "admin" ? getText("site_name", "The Quest") : competition.hostedBy}
            </p>
          )
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
                className="inline-flex min-h-[44px] items-center border border-white/20 px-4 text-sm font-bold uppercase text-white/75 transition-colors hover:border-white/40 hover:text-white"
               style={{ letterSpacing: "2px" }}
               data-testid="button-view-contestants"
             >
               Back to Contestants
             </button>
           )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/75 sm:gap-6">
            {(selectedStage ? selectedStage.startDate : (schedule.start || schedule.startIsTbd)) && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-white/65" />
                Starts {selectedStage ? formatCompetitionDate(selectedStage.startDate ? new Date(selectedStage.startDate) : null, !selectedStage.startDate) : formatCompetitionDate(schedule.start, schedule.startIsTbd)}
              </span>
            )}
            {(selectedStage ? selectedStage.endDate : (schedule.end || schedule.endIsTbd)) && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-white/65" />
                Ends {selectedStage ? formatCompetitionDate(selectedStage.endDate ? new Date(selectedStage.endDate) : null, !selectedStage.endDate) : formatCompetitionDate(schedule.end, schedule.endIsTbd)}
              </span>
            )}
            {selectedStage && !selectedStage.startDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-white/65" />
                Stage schedule TBD
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Vote className="h-4 w-4 text-white/65" />
              {(selectedStage ? stageLeaderboardQuery.data?.totalVotes || 0 : competition.totalVotes).toLocaleString()} {selectedStage ? "stage votes" : "total votes"}
            </span>
            {competition.voteCost > 0 && (
              <span className="flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-white/65" />
                {competition.voteCost} credits/vote
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Vote className="h-4 w-4 text-white/65" />
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
          <>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:hidden" data-testid="grid-contestants-compact">
            {sorted.map((contestant, index) => {
              const voteCount = getContestantVoteCount(contestant);
              const name = contestant.talentProfile.stageName || contestant.talentProfile.displayName;
              const rankColor = index === 0 ? "text-yellow-400" : index === 1 ? "text-gray-300" : index === 2 ? "text-orange-400" : "";
              const stageSubmission = selectedStage ? stageSubmissions.get(contestant.id) : null;
              const stageResult = selectedStage ? contestant.stageResults?.[selectedStage.id] : null;
              const primaryProfileImage = contestant.talentProfile.imageUrls?.[0];
              const backupProfileImage = getBackupUrl(contestant.talentProfile.imageUrls, contestant.talentProfile.imageBackupUrls, 0);
              const cardCropPosition: ImageCropPosition = competition.contestantImageCropPositions?.[String(contestant.talentProfile.id)]?.["0"]
                ?? contestant.talentProfile.imageCropPositions?.[0]
                ?? DEFAULT_TALENT_IMAGE_CROP_POSITION;
              const tileVideo = !selectedStage ? (contestantVideos.get(contestant.id) || [])[0] : undefined;
              const tileVideoSrc = tileVideo
                ? `${tileVideo.embedUrl}${tileVideo.embedUrl.includes("?") ? "&" : "?"}autoplay=1&muted=1&loop=1&background=1&controls=0&autopause=0&quality=auto`
                : null;
              const cardImageCandidates = [
                tileVideo?.thumbnail,
                (contestant as any).videoThumbnail,
                primaryProfileImage,
                backupProfileImage,
                competitionContestantFallback,
                genericContestantFallback,
              ].filter((source): source is string => typeof source === "string" && source.trim().length > 0);
              const imageSrc = stageSubmission
                ? (stageSubmission.mediaType === "image" ? stageSubmission.mediaUrl : stageSubmission.thumbnailUrl) || undefined
                : cardImageCandidates[0];
              const imageFallbackSrc = stageSubmission ? stageSubmission.thumbnailUrl : cardImageCandidates[1];
              const imageFallbackSrcs = stageSubmission
                ? [competition.coverImage, genericContestantFallback]
                : cardImageCandidates.slice(2);
              const referralQuery = preserveReferralQuery(window.location.search);
              const href = `/${slugify(competition.category)}/${slugify(competition.title)}/${slugifyWithId(name, contestant.talentProfile.id)}${referralQuery}`;
              return (
                <li key={contestant.id} data-testid={`card-contestant-compact-${contestant.id}`}>
                  <Link
                    href={href}
                    className="group relative block aspect-[3/4] overflow-hidden rounded-lg border border-white/10 bg-[#101010] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ outlineColor: accent }}
                    aria-label={`View ${name}'s profile, ${voteCount} votes`}
                  >
                    <FallbackImage
                      src={imageSrc}
                      fallbackSrc={imageFallbackSrc}
                      fallbackSrcs={imageFallbackSrcs}
                      uncroppedSrcs={[competition.coverImage]}
                      alt=""
                      className="h-full w-full object-cover"
                      style={getCompetitionCropImageStyle(cardCropPosition)}
                    />
                    {tileVideoSrc && (
                      <div className="absolute inset-0">
                        <LazyVimeoIframe
                          src={tileVideoSrc}
                          title={`${name} video preview`}
                          className="pointer-events-none absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
                        />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-1.5 pb-1.5 pt-8">
                      <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">{name}</p>
                      <p className="mt-0.5 text-[11px] text-white/80">{voteCount} {selectedStage ? "stage votes" : "votes"}</p>
                    </div>
                    {rankColor && (
                      <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75">
                        {index === 0 ? <Crown className={`h-3.5 w-3.5 ${rankColor}`} /> : <Award className={`h-3.5 w-3.5 ${rankColor}`} />}
                      </span>
                    )}
                    {stageResult && stageResult !== "active" && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-black/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ border: `1px solid ${accent}80`, color: accentBg }}>
                        {stageResult}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sorted.map((contestant, index) => {
               const voteCount = getContestantVoteCount(contestant);
               const pct = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
              const rankIcon = index === 0 ? <Crown className="h-4 w-4 text-yellow-400" /> : index === 1 ? <Award className="h-4 w-4 text-gray-300" /> : index === 2 ? <Award className="h-4 w-4 text-orange-400" /> : null;
              const videos = contestantVideos.get(contestant.id) || [];
               const primaryProfileImage = contestant.talentProfile.imageUrls?.[0];
               const backupProfileImage = getBackupUrl(contestant.talentProfile.imageUrls, contestant.talentProfile.imageBackupUrls, 0);
                const cardCropPosition: ImageCropPosition = competition.contestantImageCropPositions?.[String(contestant.talentProfile.id)]?.["0"]
                  ?? contestant.talentProfile.imageCropPositions?.[0]
                  ?? DEFAULT_TALENT_IMAGE_CROP_POSITION;
               const stageSubmission = selectedStage ? stageSubmissions.get(contestant.id) : null;
               const stageResult = selectedStage ? contestant.stageResults?.[selectedStage.id] : null;
               const cardImageCandidates = [
                 (contestant as any).videoThumbnail,
                 videos[0]?.thumbnail,
                 primaryProfileImage,
                 backupProfileImage,
                 competitionContestantFallback,
                 genericContestantFallback,
               ].filter((source): source is string => typeof source === "string" && source.trim().length > 0);
               const cardImage = cardImageCandidates[0];
               const cardImageFallback = cardImageCandidates[1];
               const cardImageFallbacks = cardImageCandidates.slice(2);
               const showVideoPreview = videos.length > 0;
    const referralQuery = preserveReferralQuery(window.location.search);
    const contestantHref = `/${slugify(competition.category)}/${slugify(competition.title)}/${slugifyWithId(contestant.talentProfile.stageName || contestant.talentProfile.displayName, contestant.talentProfile.id)}${referralQuery}`;

              return (
                <div
                  key={contestant.id}
                   className="overflow-hidden rounded-2xl border border-white/10 bg-[#101010] shadow-sm"
                  data-testid={`card-contestant-${contestant.id}`}
                >
                   {demoMode && !selectedStage && videos.length > 0 ? (
                     <Link
                       href={contestantHref}
                       className="relative block overflow-hidden bg-black p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px]"
                       style={{ outlineColor: accent }}
                       aria-label={`View ${contestant.talentProfile.stageName || contestant.talentProfile.displayName}'s profile`}
                     >
                       <div className={`relative w-full overflow-hidden ${videos[0].height && videos[0].width && videos[0].height > videos[0].width ? "aspect-[9/16]" : "aspect-video"}`}>
                         <DemoVimeoPreview
                           videoId={videos[0].uri}
                           thumbnail={videos[0].thumbnail}
                           title={`${contestant.talentProfile.displayName} — ${videos[0].name}`}
                           className="pointer-events-none absolute inset-0 h-full w-full"
                         />
                       </div>
                       {rankIcon && (
                         <div className="pointer-events-none absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/75">
                           {rankIcon}
                         </div>
                       )}
                     </Link>
                  ) : (
                  <Link
                    href={contestantHref}
                       className={`relative block overflow-hidden bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] ${showVideoPreview ? "space-y-1" : "aspect-[4/5]"}`}
                    style={{ outlineColor: accent }}
                    aria-label={`View ${contestant.talentProfile.stageName || contestant.talentProfile.displayName}'s profile`}
                  >
                    {selectedStage && stageSubmissionsQuery.isLoading ? (
                      <div
                        className="aspect-[4/5] animate-pulse flex items-center justify-center bg-[#101010] text-xs uppercase tracking-[3px] text-white/70"
                        aria-label="Loading stage submission"
                      >
                        Loading stage media
                      </div>
                    ) : selectedStage && stageSubmission?.mediaType === "video" ? (
                      <div className="relative aspect-video w-full overflow-hidden">
                        <LazyVimeoIframe
                           src={`${stageVideoEmbedUrl(stageSubmission.mediaUrl)}?autoplay=1&muted=1&loop=1&background=1&controls=0&autopause=0&quality=auto`}
                           className="pointer-events-none absolute inset-0 h-full w-full border-0"
                          title={`${contestant.talentProfile.displayName} — ${selectedStage.name}`}
                        />
                        {/* Transparent overlay — captures clicks the iframe would otherwise swallow */}
                        <div className="absolute inset-0 z-10 cursor-pointer" aria-hidden="true" />
                      </div>
                    ) : selectedStage && stageSubmission?.mediaType === "image" ? (
                      <FallbackImage
                        src={stageSubmission.mediaUrl}
                        fallbackSrc={stageSubmission.thumbnailUrl}
                        fallbackSrcs={[competition.coverImage, genericContestantFallback]}
                        uncroppedSrcs={[competition.coverImage]}
                        alt={`${contestant.talentProfile.stageName || contestant.talentProfile.displayName} — ${selectedStage.name}`}
                        className="aspect-[4/5] w-full object-cover"
                        style={{ objectPosition: `${DEFAULT_TALENT_IMAGE_CROP_POSITION.x}% ${DEFAULT_TALENT_IMAGE_CROP_POSITION.y}%` }}
                      />
                    ) : selectedStage ? (
                      <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 bg-[#101010] px-5 text-center">
                        <ImageIcon className="h-8 w-8 text-white/15" />
                        <span className="text-xs uppercase tracking-[2px] text-white/70">No stage submission yet</span>
                      </div>
                    ) : isLoadingContestantVideos ? (
                      <div
                        className="aspect-[4/5] animate-pulse flex items-center justify-center bg-[#101010] text-xs uppercase tracking-[3px] text-white/70"
                        aria-label="Loading contestant media"
                      >
                        Loading media
                      </div>
                    ) : showVideoPreview ? videos.slice(0, 1).map((video) => {
                      const sep = video.embedUrl.includes("?") ? "&" : "?";
                      const playerUrl = `${video.embedUrl}${sep}autoplay=1&muted=1&loop=1&background=1&controls=0&autopause=0&quality=auto`;
                      return (
                        <div
                          key={video.uri}
                          className={`relative w-full overflow-hidden ${video.height && video.width && video.height > video.width ? "aspect-[9/16]" : "aspect-video"}`}
                        >
                          <LazyVimeoIframe
                            src={playerUrl}
                            className="pointer-events-none absolute inset-0 h-full w-full border-0"
                            title={`${contestant.talentProfile.displayName} — ${video.name}`}
                          />
                          <div className="absolute inset-0 z-10 cursor-pointer" aria-hidden="true" />
                        </div>
                      );
                    }) : (
                      <FallbackImage
                        src={cardImage}
                        fallbackSrc={cardImageFallback}
                        fallbackSrcs={cardImageFallbacks}
                        uncroppedSrcs={[competition.coverImage]}
                        alt={contestant.talentProfile.stageName || contestant.talentProfile.displayName}
                        className="h-full w-full object-cover"
                        style={getCompetitionCropImageStyle(cardCropPosition)}
                      />
                    )}
                    {rankIcon && (
                      <div className="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/75">
                        {rankIcon}
                      </div>
                    )}
                    {stageResult && stageResult !== "active" && (
                      <div className="absolute right-3 top-3 rounded-full bg-black/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.5px]" style={{ border: `1px solid ${accent}80`, color: accentBg }}>
                        {stageResult}
                      </div>
                    )}
                  </Link>
                  )}
                   <div className="bg-[#141414] px-4 py-5 text-center">
                    <Link
                      href={contestantHref}
                       className="inline-flex min-h-10 items-center justify-center rounded-sm text-white transition-colors hover:text-white/70 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                       style={{ outlineColor: accent }}
                      data-testid={`link-contestant-name-${contestant.id}`}
                    >
                       <h4 className="mb-1 font-sans text-base font-semibold leading-tight sm:text-lg" data-testid={`text-contestant-name-${contestant.id}`}>
                        {contestant.talentProfile.stageName || contestant.talentProfile.displayName}
                      </h4>
                    </Link>
                    <div className="mb-3">
                       <span className="text-sm text-white/65" data-testid={`text-votes-${contestant.id}`}>
                        {voteCount} {selectedStage ? "stage votes" : "votes"}
                      </span>
                      {contestant.talentProfile.category && (
                        <>
                           <span className="mx-2 text-white/35">·</span>
                           <span className="text-sm text-white/55">
                            {contestant.talentProfile.category}
                          </span>
                        </>
                      )}
                    </div>

                     <div className="relative mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                         className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: accent }}
                      />
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Link
                         href={contestantHref}
                         className="inline-flex min-h-10 items-center justify-center rounded-full border px-5 text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                         style={{ borderColor: accent, color: accent, outlineColor: accent }}
                        data-testid={`link-profile-${contestant.id}`}
                      >
                        View Profile
                      </Link>
                       {user && user.level >= 4 && !selectedStage && !isLoadingContestantVideos && videos.length === 0 && primaryProfileImage && (
                         <button
                           type="button"
                           className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-xs font-medium text-white/65 transition-colors hover:border-white/35 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                           style={{ outlineColor: accent }}
                           onClick={() => {
                             setEditingContestantCrop({
                               profileId: contestant.talentProfile.id,
                               src: primaryProfileImage,
                               alt: contestant.talentProfile.stageName || contestant.talentProfile.displayName,
                                position: { x: cardCropPosition.x, y: cardCropPosition.y, zoom: cardCropPosition.zoom ?? 1.25 },
                             });
                           }}
                           data-testid={`button-adjust-contestant-framing-${contestant.id}`}
                         >
                           <Crop className="h-3.5 w-3.5" />
                           Adjust photo framing
                         </button>
                       )}
                      {canVote && (
                        <div className="flex items-center justify-center gap-2 w-full flex-wrap">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!user) {
                                setVoteAuthContestantId(contestant.id);
                                setVoteAuthOpen(true);
                                return;
                              }
                              voteMutation.mutate({ contestantId: contestant.id, stageId: selectedStage?.id });
                            }}
                            disabled={voteMutation.isPending}
                            className="flex min-h-11 flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                            style={{ outlineColor: accent }}
                            data-testid={`button-vote-${contestant.id}`}
                          >
                            <Heart className="h-3.5 w-3.5 flex-shrink-0" />
                            {voteMutation.isPending ? "Voting..." : "Vote Free"}
                          </button>
                          {!isInPersonOnlyEvent && (
                            <Link
                               href={`/checkout/${competition.id}/${contestant.id}${selectedStage ? `?stageId=${encodeURIComponent(selectedStage.id)}` : ""}`}
                               className="flex min-h-11 flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                               style={{ backgroundColor: accentBg, color: accentText, borderColor: accentBg, outlineColor: accent }}
                              onClick={(e) => e.stopPropagation()}
                               data-testid={`button-donate-votes-${contestant.id}`}
                            >
                               <Heart className="h-3.5 w-3.5 flex-shrink-0" />
                               Donate &amp; Vote
                            </Link>
                          )}
                        </div>
                      )}
                      {isVotingOpen && isInPersonOnlyEvent && !isInPersonVoting && (
                        <span className="text-xs text-white/75 uppercase" style={{ letterSpacing: "2px" }} data-testid={`text-in-person-only-${contestant.id}`}>
                          Scan QR to Vote
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        ) : (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-white/10 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No contestants yet</h3>
            <p className="text-sm text-white/75 mb-6">Be the first to apply!</p>
            <Link
              href={`/nominate?competition=${competition.id}${preserveReferralQuery(window.location.search).replace(/^\?/, "&")}`}
              className="inline-flex min-h-[48px] min-w-[212px] max-w-full items-center justify-center border border-white bg-black px-6 text-center text-base font-bold text-white transition-colors duration-200 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f] sm:px-8"
              data-testid="button-apply-login"
            >
              Want to Join the Competition?
              <ChevronRight className="ml-1 h-4 w-4 shrink-0" />
              <ChevronRight className="-ml-2 h-4 w-4 shrink-0" />
            </Link>
          </div>
        )}
      </div>

      <SiteFooter />
      <VoteAuthDialog
        open={voteAuthOpen}
        onOpenChange={setVoteAuthOpen}
        competitionId={competition?.id ?? null}
        contestantId={voteAuthContestantId}
      />
      {editingContestantCrop && (
        <ImageCropDialog
          open={!!editingContestantCrop}
          onOpenChange={(open) => {
            if (!open && !savingContestantCrop) setEditingContestantCrop(null);
          }}
          src={editingContestantCrop.src}
          alt={`Photo framing for ${editingContestantCrop.alt}`}
          position={editingContestantCrop.position}
          onPositionChange={(position) => setEditingContestantCrop((current) => current ? { ...current, position } : current)}
          onSave={saveContestantCrop}
          isSaving={savingContestantCrop}
          title="Adjust competition card photo"
          description="Drag the photo or use the controls. This framing changes only this competition; the shared profile and other competitions stay unchanged."
          secondaryPreviewLabel="Square preview"
          zoomEnabled
          defaultZoom={1.25}
        />
      )}
    </div>
  );
}
