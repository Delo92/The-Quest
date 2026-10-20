import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, MapPin, Tag, ChevronRight, ChevronLeft, Heart, ShoppingCart, Share2, Check, Users, Globe, ExternalLink } from "lucide-react";
import { SiYoutube, SiInstagram, SiTiktok, SiFacebook } from "react-icons/si";
import { Link } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isVoteAuthenticationError, VoteAuthDialog } from "@/components/vote-auth-dialog";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";
import { extractIdFromSlug, slugify, slugifyWithId } from "@shared/slugify";
import { parsePublicLinks } from "@shared/public-links";
import { preserveReferralQuery } from "@/lib/referral";
import { formatVideoTitle } from "@/lib/media-utils";
import { buildVimeoSrc } from "@/lib/media-utils";
import { DEFAULT_TALENT_IMAGE_CROP_POSITION } from "@shared/image-crop";
import ContestantVideoWheel from "@/components/contestant-video-wheel";

interface ResolvedData {
  competition: {
    id: number;
    title: string;
    description: string | null;
    category: string;
    coverImage: string | null;
    status: string;
    voteCost: number;
    maxVotesPerDay: number;
    startDate: string | null;
    endDate: string | null;
    votingStartDate: string | null;
    votingEndDate: string | null;
  };
  contestant: {
    id: number;
    competitionId: number;
    talentProfileId: number;
    voteCount: number;
    tournamentPoints?: number;
    videoThumbnail: string | null;
    videos: {
      uri: string;
      name: string;
      link: string;
      embedUrl: string;
      duration: number;
      thumbnail: string | null;
      width?: number;
      height?: number;
    }[];
    talentProfile: {
      id: number;
      displayName: string;
      stageName: string | null;
      bio: string | null;
      category: string | null;
      imageUrls: string[] | null;
      imageBackupUrls?: string[] | null;
      imageCropPositions?: Array<{ x: number; y: number }> | null;
      location: string | null;
      profileColor?: string | null;
      profileBgImage?: string | null;
      email?: string | null;
      showEmail?: boolean;
      socialLinks?: string | null;
    };
  };
  totalVotes: number;
}

interface CompetitionContestant {
  id: number;
  talentProfileId: number;
  voteCount: number;
  talentProfile: {
    id: number;
    displayName: string;
    stageName: string | null;
    imageUrls?: string[] | null;
  };
}

export default function ContestantSharePage() {
  const params = useParams<{ categorySlug: string; compSlug: string; talentSlug: string }>();
  const categorySlug = params?.categorySlug;
  const compSlug = params?.compSlug;
  const talentSlug = params?.talentSlug;
  const [, navigate] = useLocation();
  const { getImage } = useLivery();
  const { user } = useAuth();
  const { toast } = useToast();
  const [voteAuthOpen, setVoteAuthOpen] = useState(false);

  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Touch/swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Single bundle fetch replaces 3 sequential round-trips.
  // The bundle also includes the signed HLS URL for the first video so we can
  // preload the m3u8 manifest before the player component even mounts.
  const { data: bundleData, isLoading, error } = useQuery<
    ResolvedData & { contestants: CompetitionContestant[] }
  >({
    queryKey: ["/api/resolve", categorySlug, compSlug, talentSlug, "bundle"],
    queryFn: async () => {
      const res = await fetch(`/api/resolve/${categorySlug}/${compSlug}/${talentSlug}/bundle`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!categorySlug && !!compSlug && !!talentSlug,
    staleTime: 30_000,
  });

  // Destructure bundle into the shapes the rest of the page expects
  const data = bundleData ? {
    competition: bundleData.competition,
    contestant: bundleData.contestant,
    totalVotes: bundleData.totalVotes,
  } as ResolvedData : undefined;
  const mediaData = bundleData ? {
    videoThumbnail: bundleData.contestant.videoThumbnail,
    videos: bundleData.contestant.videos,
  } : undefined;
  const competitionData = bundleData ? { contestants: bundleData.contestants } : undefined;
  const seoProfile = data?.contestant.talentProfile;
  const seoName = seoProfile?.stageName || seoProfile?.displayName;
  const seoTalentSlug = seoProfile ? slugifyWithId(seoName || "contestant", seoProfile.id) : talentSlug;
  useSEO({
    title: seoName && data
      ? `${seoName} — ${data.competition.title} | The Quest`
      : "Contestant Profile | The Quest",
    description: seoProfile?.bio
      || (seoName && data ? `${seoName} is competing in ${data.competition.title}, a ${data.competition.category} competition on The Quest.` : undefined),
    canonical: categorySlug && compSlug && seoTalentSlug
      ? `/thequest/${categorySlug}/${compSlug}/${seoTalentSlug}`
      : undefined,
    ogType: "profile",
    ogImage: seoProfile?.imageUrls?.[0] || data?.competition.coverImage || undefined,
  });

  const { data: myRefCode } = useQuery<{ code: string } | null>({
    queryKey: ["/api/referral/my-code"],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return null;
      const res = await fetch("/api/referral/my-code", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Scroll to top whenever the contestant changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [talentSlug]);

  useEffect(() => {
    if (data) {
      document.title = `${data.contestant.talentProfile.stageName || data.contestant.talentProfile.displayName} - ${data.competition.title} | The Quest`;
    }
    return () => { document.title = "The Quest - Talent Competition & Voting Platform"; };
  }, [data]);

  // Build ordered contestant list and find prev/next
  const orderedContestants = competitionData?.contestants ?? [];
  const requestedTalentId = extractIdFromSlug(talentSlug || "").id;
  const currentIndex = orderedContestants.findIndex(
    (c) => requestedTalentId
      ? Number(c.talentProfile.id) === requestedTalentId
      : slugify(c.talentProfile.stageName || c.talentProfile.displayName) === talentSlug
  );
  const prevContestant = currentIndex > 0 ? orderedContestants[currentIndex - 1] : null;
  const nextContestant = currentIndex >= 0 && currentIndex < orderedContestants.length - 1
    ? orderedContestants[currentIndex + 1]
    : null;

  const goToContestant = useCallback((c: CompetitionContestant | null) => {
    if (!c) return;
    const slug = slugifyWithId(c.talentProfile.stageName || c.talentProfile.displayName, c.talentProfile.id);
    // Navigate relative to the wouter base (/thequest is already the base)
    navigate(`/${categorySlug}/${compSlug}/${slug}${preserveReferralQuery(window.location.search)}`);
  }, [navigate, categorySlug, compSlug]);

  // Keyboard arrow navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToContestant(prevContestant);
      if (e.key === "ArrowRight") goToContestant(nextContestant);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevContestant, nextContestant, goToContestant]);

  // Touch swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only register horizontal swipes that dominate vertical movement
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goToContestant(nextContestant);
      else goToContestant(prevContestant);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Vimeo postMessage finish listener
  useEffect(() => {
    if (!playingVideo || nudgeDismissed) return;

    // Tell every Vimeo iframe to report finish events
    const registerWithVimeo = () => {
      document.querySelectorAll<HTMLIFrameElement>("iframe[src*='player.vimeo.com']").forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ method: "addEventListener", value: "finish" }),
            "https://player.vimeo.com"
          );
        } catch {}
      });
    };

    // Delay slightly so the iframe is mounted
    const regTimer = setTimeout(registerWithVimeo, 2000);

    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== "https://player.vimeo.com") return;
      try {
        const payload = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (payload?.event === "finish") {
          setShowNudge(true);
        }
      } catch {}
    };

    window.addEventListener("message", handleMessage);
    return () => {
      clearTimeout(regTimer);
      window.removeEventListener("message", handleMessage);
    };
  }, [playingVideo, nudgeDismissed]);

  // Auto-hide nudge after 12s if not interacted
  useEffect(() => {
    if (showNudge) {
      nudgeTimerRef.current = setTimeout(() => setShowNudge(false), 12000);
    }
    return () => {
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    };
  }, [showNudge]);

  const dismissNudge = () => {
    setShowNudge(false);
    setNudgeDismissed(true);
  };

  const voteMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const refCode = localStorage.getItem("hfc_ref") || undefined;
      await apiRequest("POST", `/api/competitions/${data.competition.id}/vote`, {
        contestantId: data.contestant.id,
        refCode,
      });
    },
    onSuccess: () => {
      toast({ title: "Vote cast!", description: "Your vote has been recorded." });
      queryClient.invalidateQueries({ queryKey: ["/api/resolve", categorySlug, compSlug, talentSlug] });
      dismissNudge();
    },
    onError: (err: any) => {
      if (isVoteAuthenticationError(err)) {
        setVoteAuthOpen(true);
        return;
      }
      toast({ title: "Vote failed", description: err.message || "Could not cast vote", variant: "destructive" });
    },
  });

  const handleVoteClick = () => {
    if (!user) {
      setVoteAuthOpen(true);
      return;
    }
    voteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <SiteNavbar />
        <div className="max-w-4xl mx-auto px-4 py-32">
          <Skeleton className="h-40 w-40 mx-auto mb-6 bg-white/5" />
          <Skeleton className="h-8 w-1/3 mx-auto mb-4 bg-white/10" />
          <Skeleton className="h-4 w-1/2 mx-auto bg-white/10" />
        </div>
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <SiteNavbar />
        <div className="text-center">
          <Trophy className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Profile not found</h3>
          <p className="text-white/40 mt-2 mb-4">This link may be invalid or the contestant is no longer active.</p>
          <Link href="/competitions">
            <span className="inline-block mt-4 text-white/60 hover:text-white transition-colors cursor-pointer">
              Browse Competitions
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const { competition, contestant, totalVotes } = data;
  const profile = contestant.talentProfile;
  const accentColor = profile.profileColor || "#FF5A09";
  const bgImage = profile.profileBgImage || null;
  const fallbackDefault = getImage("talent_profile_fallback") || "";
  const videos = mediaData?.videos || contestant.videos || [];
  const activeVideo = Math.min(activeVideoIndex, Math.max(videos.length - 1, 0));
  const currentVideo = videos[activeVideo];
  const hasImages = !!(profile.imageUrls && profile.imageUrls.length > 0);
  const heroVideoEmbedUrl = !hasImages && videos.length > 0 ? videos[0].embedUrl : null;
  const heroVideoIsPortrait = heroVideoEmbedUrl
    && videos[0].height && videos[0].width
    && videos[0].height > videos[0].width;
  const mainImage = mediaData?.videoThumbnail || contestant.videoThumbnail || profile.imageUrls?.[0] || fallbackDefault;
  const mainImageFallback = getBackupUrl(profile.imageUrls, profile.imageBackupUrls, 0) || fallbackDefault;
  const isVotingOpen = competition.status === "active" || competition.status === "voting";
  const votePercentage = totalVotes > 0 ? Math.round((contestant.voteCount / totalVotes) * 100) : 0;

  const getShareData = () => {
    const shareUrl = `${window.location.origin}/thequest/${categorySlug}/${compSlug}/${talentSlug}?ref=${talentSlug}`;
    const shareText = `Vote for ${profile.stageName || profile.displayName} in ${competition.title} on The Quest!`;
    return { shareUrl, shareText };
  };

  const handleShare = async () => {
    const { shareUrl, shareText } = getShareData();
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl });
        return;
      } catch { /* fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    toast({ title: "Link copied!", description: "Share link copied to clipboard. Paste it anywhere!" });
    setTimeout(() => setCopied(false), 3000);
  };

  // Contestant position label
  const positionLabel = currentIndex >= 0
    ? `${currentIndex + 1} of ${orderedContestants.length}`
    : null;

  const nextContestantSlug = nextContestant
    ? slugify(nextContestant.talentProfile.stageName || nextContestant.talentProfile.displayName)
    : null;
  const prevContestantSlug = prevContestant
    ? slugify(prevContestant.talentProfile.stageName || prevContestant.talentProfile.displayName)
    : null;

  return (
    <div
      className="min-h-screen bg-black text-white relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {bgImage && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={bgImage} alt="" className="w-full h-full object-cover opacity-[0.04]" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}

      {/* Left / Right floating nav arrows */}
      {prevContestantSlug && (
        <button
          onClick={() => goToContestant(prevContestant)}
          aria-label={`Previous: ${prevContestant?.talentProfile.stageName || prevContestant?.talentProfile.displayName}`}
          className="fixed left-2 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1.5 group"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/70 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/15 group-hover:border-white/50 group-hover:text-white shadow-lg">
            <ChevronLeft className="h-5 w-5" />
          </span>
          <span className="text-[9px] uppercase text-white/40 tracking-widest hidden md:block max-w-[60px] truncate text-center leading-tight">
            {prevContestant?.talentProfile.stageName || prevContestant?.talentProfile.displayName}
          </span>
        </button>
      )}
      {nextContestantSlug && (
        <button
          onClick={() => goToContestant(nextContestant)}
          aria-label={`Next: ${nextContestant?.talentProfile.stageName || nextContestant?.talentProfile.displayName}`}
          className="fixed right-2 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1.5 group"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/70 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/15 group-hover:border-white/50 group-hover:text-white shadow-lg">
            <ChevronRight className="h-5 w-5" />
          </span>
          <span className="text-[9px] uppercase text-white/40 tracking-widest hidden md:block max-w-[60px] truncate text-center leading-tight">
            {nextContestant?.talentProfile.stageName || nextContestant?.talentProfile.displayName}
          </span>
        </button>
      )}

      {/* Post-video engagement nudge */}
      {showNudge && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-400">
          <div className="mx-auto max-w-lg px-4 pb-4">
            <div
              className="rounded-2xl border border-white/15 shadow-2xl overflow-hidden"
              style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(20px)" }}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <p className="text-xs uppercase tracking-[3px] text-white/40">Liked what you saw?</p>
                <button
                  onClick={dismissNudge}
                  className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none px-1"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
              <p className="px-5 pb-3 text-white font-semibold text-base" style={{ letterSpacing: "1px" }}>
                {profile.stageName || profile.displayName} wants your vote
              </p>
              <div className="flex items-stretch border-t border-white/10">
                {isVotingOpen && (
                  <button
                    onClick={handleVoteClick}
                    disabled={voteMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold uppercase text-white transition-colors hover:bg-white/5 disabled:opacity-50 border-r border-white/10"
                    style={{ letterSpacing: "2px" }}
                  >
                    <Heart className="h-4 w-4" style={{ color: accentColor }} />
                    {voteMutation.isPending ? "Voting…" : "Vote Free"}
                  </button>
                )}
                {nextContestant && (
                  <button
                    onClick={() => { goToContestant(nextContestant); dismissNudge(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold uppercase text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                    style={{ letterSpacing: "2px" }}
                  >
                    <Users className="h-4 w-4" />
                    Next Contestant
                    <ChevronRight className="h-4 w-4 opacity-60" />
                  </button>
                )}
                {!nextContestant && !isVotingOpen && (
                  <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`}>
                    <span className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold uppercase text-white/70 transition-colors hover:bg-white/5 hover:text-white px-6"
                      style={{ letterSpacing: "2px" }}>
                      View Competition
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10">
        <SiteNavbar />

        {/* Back to competition breadcrumb */}
        <div className="bg-black/80 border-b border-white/10 px-4 py-2 flex items-center gap-2 text-sm sticky top-0 z-40 backdrop-blur-sm">
          <Link href={`/${categorySlug}/${compSlug}`}>
            <span className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors cursor-pointer">
              <ChevronRight className="h-3.5 w-3.5 rotate-180 shrink-0" />
              {competition?.title || "Competition"}
            </span>
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white/90 truncate max-w-[180px]">{profile?.stageName || profile?.displayName}</span>
          {positionLabel && (
            <span className="ml-auto text-white/25 text-xs shrink-0">{positionLabel}</span>
          )}
        </div>

        {/* Swipe hint bar (shown only when neighbours exist) */}
        {(prevContestant || nextContestant) && (
          <div className="flex items-center justify-center gap-3 py-2 text-white/25 text-xs border-b border-white/5">
            {prevContestant && <ChevronLeft className="h-3 w-3" />}
            <span className="uppercase tracking-widest text-[10px]">swipe to browse contestants</span>
            {nextContestant && <ChevronRight className="h-3 w-3" />}
          </div>
        )}

        {/* Identity */}
        <header className="px-4 pb-2 pt-8 text-center">
          <div
            className="mx-auto mb-3 h-20 w-20 overflow-hidden rounded-full border-2 bg-zinc-900 md:h-24 md:w-24"
            style={{ borderColor: accentColor }}
          >
            <FallbackImage
              src={profile.imageUrls?.[0] || mainImage}
              fallbackSrc={mainImageFallback}
              alt={profile.stageName || profile.displayName || ""}
              className="h-full w-full object-cover"
              style={{
                objectPosition: `${profile.imageCropPositions?.[0]?.x ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.x}% ${profile.imageCropPositions?.[0]?.y ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.y}%`,
              }}
            />
          </div>
          <p className="mb-1 text-xs uppercase" style={{ letterSpacing: "4px", color: accentColor }} data-testid="text-competition-context">
            {competition.title}
          </p>
          <h1
            className="text-[28px] font-normal uppercase leading-none text-white md:text-[40px]"
            style={{ letterSpacing: "8px" }}
            data-testid="text-contestant-name"
          >
            {profile.stageName || profile.displayName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-white/60">
            {profile.category && (
              <span className="flex items-center gap-1.5" data-testid="text-category">
                <Tag className="h-4 w-4 text-white/40" /> {profile.category}
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1.5" data-testid="text-location">
                <MapPin className="h-4 w-4 text-white/40" /> {profile.location}
              </span>
            )}
            <span className="flex items-center gap-1.5" data-testid="text-vote-count">
              <Heart className="h-4 w-4" style={{ color: accentColor }} />
              <span className="font-semibold text-white">{contestant.voteCount}</span> votes
              <span className="text-white/35" data-testid="text-vote-percentage">· {votePercentage}% of total</span>
            </span>
          </div>
        </header>

        {/* Videos: same cover-flow wheel as the home page, vote flow attached */}
        {videos.length > 0 && (
          <section className="mx-auto max-w-5xl px-4 pb-10 pt-6" aria-label="Competition videos" data-testid="contestant-videos">
            <ContestantVideoWheel
              videos={videos.map((video, i) => ({
                id: video.uri || String(i),
                title: formatVideoTitle(video.name),
                thumbnail: video.thumbnail || contestant.videoThumbnail || null,
              }))}
              index={activeVideo}
              onIndexChange={(next) => { setActiveVideoIndex(next); setPlayingVideo(null); }}
              onPlay={(i) => setPlayingVideo(videos[i].uri)}
              voteCount={contestant.voteCount}
              accentColor={accentColor}
            />
            {currentVideo && playingVideo === currentVideo.uri && (
              <div
                className={`relative mx-auto mt-8 w-full overflow-hidden rounded-lg bg-black ${currentVideo.height && currentVideo.width && currentVideo.height > currentVideo.width ? "aspect-[9/16] max-h-[78vh] max-w-sm" : "aspect-video max-w-3xl"}`}
                data-testid="video-player"
              >
                <iframe
                  src={buildVimeoSrc(currentVideo.embedUrl, "autoplay=1&controls=1&title=0&byline=0&portrait=0&autopause=0") || ""}
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={formatVideoTitle(currentVideo.name)}
                />
              </div>
            )}
            {isVotingOpen && (
              <div className="mt-8">
                <p className="mb-3 text-center text-xs uppercase text-white/50" style={{ letterSpacing: "3px" }}>
                  Vote for {profile.stageName || profile.displayName}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3" data-testid="voting-actions">
                <button
                  onClick={handleVoteClick}
                  disabled={voteMutation.isPending}
                  className="inline-flex min-h-12 items-center rounded-full border border-white bg-black px-8 text-sm font-bold uppercase text-white transition-all duration-500 hover:bg-white hover:text-black disabled:opacity-50"
                  style={{ letterSpacing: "2px" }}
                  data-testid="button-vote"
                >
                  <Heart className="mr-2 h-4 w-4" />
                  {voteMutation.isPending ? "Voting..." : "Vote Free"}
                </button>
                <Link
                  href={`/checkout/${competition.id}/${contestant.id}`}
                  className="inline-flex min-h-12 items-center rounded-full border px-8 text-sm font-bold uppercase text-white transition-all duration-500 hover:brightness-110"
                  style={{ letterSpacing: "2px", backgroundColor: accentColor, borderColor: accentColor }}
                  data-testid="button-buy-votes"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Buy Votes
                </Link>
              </div>
              </div>
            )}
          </section>
        )}

        <div className="mx-auto max-w-4xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

          {videos.length === 0 && isVotingOpen && (
            <div className="mb-10" data-testid="voting-actions-wrap">
              <div className="flex flex-wrap items-center justify-center gap-3" data-testid="voting-actions-no-video">
                <button
                  onClick={handleVoteClick}
                  disabled={voteMutation.isPending}
                  className="inline-flex min-h-12 items-center rounded-full border border-white bg-black px-8 text-sm font-bold uppercase text-white transition-all duration-500 hover:bg-white hover:text-black disabled:opacity-50"
                  style={{ letterSpacing: "2px" }}
                  data-testid="button-vote"
                >
                  <Heart className="mr-2 h-4 w-4" />
                  {voteMutation.isPending ? "Voting..." : "Vote Free"}
                </button>
                <Link
                  href={`/checkout/${competition.id}/${contestant.id}`}
                  className="inline-flex min-h-12 items-center rounded-full border px-8 text-sm font-bold uppercase text-white transition-all duration-500 hover:brightness-110"
                  style={{ letterSpacing: "2px", backgroundColor: accentColor, borderColor: accentColor }}
                  data-testid="button-buy-votes"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Buy Votes
                </Link>
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div className="mb-10 text-center">
              <p className="text-white/50 leading-relaxed text-base max-w-2xl mx-auto" data-testid="text-bio">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Links */}
          {(() => {
            const socialObj = parsePublicLinks(profile.socialLinks);
            const platforms = [
              { key: "youtube", icon: SiYoutube, label: "YouTube" },
              { key: "instagram", icon: SiInstagram, label: "Instagram" },
              { key: "tiktok", icon: SiTiktok, label: "TikTok" },
              { key: "facebook", icon: SiFacebook, label: "Facebook" },
            ];
            const active = Object.entries(socialObj);
            if (active.length === 0) return null;
            return (
              <div className="mx-auto mb-12 w-full max-w-md" data-testid="social-links">
                <div className="mb-5 text-center">
                  <p className="mb-1 text-sm text-[#5f5f5f]">Follow along</p>
                  <h2 className="text-lg font-normal uppercase text-white" style={{ letterSpacing: "10px" }}>Links</h2>
                </div>
                <ul className="flex flex-col gap-3">
                  {active.map(([key, url]) => {
                    const platform = platforms.find((item) => item.key === key.toLowerCase());
                    const Icon = platform?.icon;
                    const label = platform?.label || key;
                    return (
                      <li key={key}>
                        <a
                          href={url}
                          target="_blank"
                          rel="me noopener noreferrer"
                          className="flex min-h-12 items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          style={{ outlineColor: accentColor }}
                          data-testid={`link-social-${key}`}
                          aria-label={`${label} profile`}
                        >
                          {Icon ? <Icon className="h-5 w-5 shrink-0" style={{ color: accentColor }} /> : <Globe className="h-5 w-5 shrink-0" style={{ color: accentColor }} />}
                          <span className="min-w-0 flex-1 truncate text-center capitalize">{label}</span>
                          <ExternalLink className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          {/* Gallery */}
          {profile.imageUrls && profile.imageUrls.length > 0 && (
            <div className="mb-10">
              <div className="text-center mb-10">
                <p className="text-[#5f5f5f] text-sm mb-1">See what&apos;s new</p>
                <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>
                  Gallery
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {profile.imageUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden group cursor-pointer">
                    <FallbackImage
                      src={url}
                      fallbackSrc={getBackupUrl(profile.imageUrls, profile.imageBackupUrls, i)}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      style={{
                        objectPosition: `${profile.imageCropPositions?.[i]?.x ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.x}% ${profile.imageCropPositions?.[i]?.y ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.y}%`,
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Share */}
          <div className="flex justify-center mb-10">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 bg-white/5 text-white/70 font-bold text-sm uppercase px-8 leading-[47px] rounded-full border border-white/20 transition-all duration-500 hover:bg-white/10 hover:text-white hover:border-white/40 cursor-pointer"
              style={{ letterSpacing: "2px" }}
              data-testid="button-share"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Copied!" : "Share"}
            </button>
          </div>

          {/* Bottom nav */}
          <div className="flex flex-wrap items-center justify-center gap-4 pb-10">
            <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`}>
              <span
                className="inline-block bg-transparent text-white font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] rounded-full border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer text-center"
                data-testid="button-back-competition"
              >
                View Competition <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
              </span>
            </Link>
            <Link href="/competitions">
              <span
                className="inline-block bg-transparent text-white/60 font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] rounded-full border border-white/30 transition-all duration-500 hover:bg-white hover:text-black cursor-pointer text-center"
                data-testid="button-back-competitions"
              >
                All Competitions
              </span>
            </Link>
          </div>
        </div>

        <SiteFooter />
        <VoteAuthDialog
          open={voteAuthOpen}
          onOpenChange={setVoteAuthOpen}
          competitionId={data?.competition?.id ?? null}
          contestantId={data?.contestant?.id ?? null}
        />
      </div>
    </div>
  );
}
