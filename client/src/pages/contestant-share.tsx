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
import type { VideoShareMetadata } from "@shared/video-share";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";
import { extractIdFromSlug, slugify, slugifyWithId , competitionSlug } from "@shared/slugify";
import { parsePublicLinks } from "@shared/public-links";
import { preserveReferralQuery } from "@/lib/referral";
import { formatVideoTitle } from "@/lib/media-utils";
import { buildVimeoSrc } from "@/lib/media-utils";
import { DEFAULT_TALENT_IMAGE_CROP_POSITION } from "@shared/image-crop";
import ContestantVideoWheel from "@/components/contestant-video-wheel";
import ProfileScrollDepthCard from "@/components/profile-scroll-depth-card";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

interface ResolvedData {
  shareVideo?: VideoShareMetadata | null;
  competition: {
    id: number;
    title: string;
    description: string | null;
    category: string;
    coverImage: string | null;
    themeColor?: string | null;
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
    contestantDivision?: string | null;
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
  otherCompetitionVideos?: {
    uri: string;
    name: string;
    embedUrl: string;
    duration: number;
    thumbnail: string | null;
    width?: number;
    height?: number;
    competitionId: number;
    competitionTitle: string;
  }[];
}

type ContestantVideo = ResolvedData["contestant"]["videos"][number];

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

export default function ContestantSharePage({ demoMode = false }: { demoMode?: boolean } = {}) {
  const params = useParams<{ categorySlug: string; compSlug: string; talentSlug: string }>();
  const categorySlug = demoMode ? "music" : params?.categorySlug;
  const compSlug = demoMode ? "cb-publishing-music-quest" : params?.compSlug;
  const talentSlug = demoMode ? "most-hated-twinz-501" : params?.talentSlug;
  const [, navigate] = useLocation();
  const { getImage } = useLivery();
  const { user } = useAuth();
  const { toast } = useToast();
  const [voteAuthOpen, setVoteAuthOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const backgroundParallaxY = useTransform(scrollYProgress, [0, 1], [0, -100]);

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
  const seoDivision = data?.contestant.contestantDivision;
  const seoCompetitionContext = [seoDivision, data?.competition.title].filter(Boolean).join(" — ");
  const seoTalentSlug = seoProfile ? slugifyWithId(seoName || "contestant", seoProfile.id) : talentSlug;
  const seoVideo = mediaData?.videos?.[0];
  const seoShareVideo = bundleData?.shareVideo;
  useSEO({
    title: demoMode ? "The Quest app demo" : seoName && data
      ? `${seoName} — ${seoCompetitionContext} | The Quest`
      : "Contestant Profile | The Quest",
    description: seoName && data
      ? [
          seoDivision ? `${seoDivision} division` : "",
          seoProfile?.bio?.trim()
            || `${seoName} is competing in ${data.competition.title}, a ${data.competition.category} competition on The Quest.`,
        ].filter(Boolean).join(" · ")
      : undefined,
    canonical: categorySlug && compSlug && seoTalentSlug
      ? `/thequest/${categorySlug}/${compSlug}/${seoTalentSlug}`
      : undefined,
    ogType: seoShareVideo ? "video.other" : "profile",
    ogImage: seoProfile?.imageUrls?.[0] || data?.competition.coverImage || undefined,
    pending: isLoading,
    ogVideo: seoShareVideo || undefined,
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
    if (!demoMode) window.scrollTo({ top: 0, behavior: "instant" });
    setActiveVideoIndex(0);
    setPlayingVideo(null);
  }, [talentSlug, demoMode]);

  useEffect(() => {
    if (data && !demoMode) {
      const division = data.contestant.contestantDivision;
      const competitionContext = [division, data.competition.title].filter(Boolean).join(" — ");
      document.title = `${data.contestant.talentProfile.stageName || data.contestant.talentProfile.displayName} - ${competitionContext} | The Quest`;
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
  const prevContestant = !demoMode && currentIndex > 0 ? orderedContestants[currentIndex - 1] : null;
  const nextContestant = !demoMode && currentIndex >= 0 && currentIndex < orderedContestants.length - 1
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
  const accentColor = competition.themeColor || "#FF5A09";
  const bgImage = profile.profileBgImage || null;
  const genericFallback = getImage("talent_profile_fallback") || undefined;
  const competitionFallback = competition.coverImage || genericFallback;
  const videos = mediaData?.videos || contestant.videos || [];
  const currentVideo = videos[0];
  const otherVideos = bundleData?.otherCompetitionVideos || [];
  const activeOtherVideo = otherVideos[Math.min(activeVideoIndex, Math.max(otherVideos.length - 1, 0))];
  const playingVideoData: ContestantVideo | (typeof otherVideos)[number] | undefined = playingVideo
    ? [...videos, ...otherVideos].find((video) => video.uri === playingVideo)
    : undefined;
  const backupProfileImage = getBackupUrl(profile.imageUrls, profile.imageBackupUrls, 0);
  const mainImageCandidates = [
    profile.imageUrls?.[0],
    mediaData?.videoThumbnail,
    contestant.videoThumbnail,
    backupProfileImage,
    competitionFallback,
    genericFallback,
  ].filter((source): source is string => typeof source === "string" && source.trim().length > 0);
  const mainImage = mainImageCandidates[0];
  const mainImageFallback = mainImageCandidates[1];
  const mainImageFallbacks = mainImageCandidates.slice(2);
  const profileCrop = profile.imageUrls?.[0]
    ? profile.imageCropPositions?.[0] ?? DEFAULT_TALENT_IMAGE_CROP_POSITION
    : DEFAULT_TALENT_IMAGE_CROP_POSITION;
  const isVotingOpen = competition.status === "active" || competition.status === "voting";
  const votePercentage = totalVotes > 0 ? Math.round((contestant.voteCount / totalVotes) * 100) : 0;

  const getShareData = () => {
    const shareUrl = `${window.location.origin}/thequest/${categorySlug}/${compSlug}/${talentSlug}?ref=${talentSlug}`;
    const contestantName = profile.stageName || profile.displayName;
    const hasVideo = Boolean(seoShareVideo || currentVideo);
    const shareKind = hasVideo ? "Contestant profile + video" : "Contestant profile";
    const division = contestant.contestantDivision;
    const shareCompetitionName = [division, competition.title].filter(Boolean).join(" — ");
    const shareTitle = `${shareKind}: ${contestantName} — ${shareCompetitionName}`;
    const shareText = hasVideo
      ? `Watch ${contestantName}'s video and view their profile${division ? ` in the ${division} division` : ""} of ${competition.title} on The Quest.`
      : `View ${contestantName}'s contestant profile${division ? ` in the ${division} division` : ""} of ${competition.title} on The Quest.`;
    return { shareUrl, shareTitle, shareText, shareKind };
  };

  const handleShare = async () => {
    const { shareUrl, shareTitle, shareText, shareKind } = getShareData();
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
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
    toast({ title: `${shareKind} link copied`, description: "Paste it to share this contestant." });
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
      className="profile-depth-page min-h-screen bg-black text-white relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <motion.div
        className="profile-depth-backdrop pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          y: reduceMotion ? 0 : backgroundParallaxY,
          backgroundImage: `radial-gradient(ellipse 58% 38% at 50% 0%, ${accentColor}20, transparent 72%), radial-gradient(ellipse 42% 46% at 0% 40%, ${accentColor}0D, transparent 72%), radial-gradient(ellipse 42% 46% at 100% 62%, rgba(255,255,255,0.035), transparent 72%)`,
        }}
      >
        <div className="profile-depth-vignette absolute inset-0" />
        <div className="profile-depth-grid absolute inset-0" />
      </motion.div>
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
                  <Link href={`/${slugify(competition.category)}/${competitionSlug(competition)}`}>
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
        {!demoMode && <SiteNavbar />}

        {/* Back to competition breadcrumb */}
        {!demoMode && <div className="bg-black/80 border-b border-white/10 px-4 py-2 flex items-center gap-2 text-sm sticky top-0 z-40 backdrop-blur-sm">
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
        </div>}

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
              src={mainImage}
              fallbackSrc={mainImageFallback}
              fallbackSrcs={mainImageFallbacks}
              uncroppedSrcs={[competition.coverImage]}
              alt={profile.stageName || profile.displayName || ""}
              className="h-full w-full object-cover"
              style={{
                objectPosition: `${profileCrop.x}% ${profileCrop.y}%`,
              }}
            />
          </div>
          <p className="mb-1 text-xs uppercase" style={{ letterSpacing: "4px", color: accentColor }} data-testid="text-competition-context">
            {[contestant.contestantDivision, competition.title].filter(Boolean).join(" · ")}
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

        {!demoMode && (
          <div className="flex justify-center px-4 pt-1">
            <Link href={`/${slugifyWithId(profile.stageName || profile.displayName, profile.id)}`}>
              <span
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-white/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                data-testid="link-personal-portfolio"
              >
                View {profile.stageName || profile.displayName}&apos;s personal portfolio
                <ExternalLink className="h-4 w-4" />
              </span>
            </Link>
          </div>
        )}

        {/* The current competition entry leads; the profile-wide video wheel follows it. */}
        {(videos.length > 0 || otherVideos.length > 0) && (
          <section className="mx-auto max-w-5xl px-4 pb-6 pt-6" aria-label="Competition videos" data-testid="contestant-videos">
            {currentVideo && (
              <div className="mx-auto max-w-3xl">
                <div className="mb-3 text-center">
                  <p className="text-[11px] uppercase tracking-[3px] text-white/45">This competition</p>
                  <h2 className="mt-1 text-sm font-semibold text-white/85">
                    {[contestant.contestantDivision, competition.title].filter(Boolean).join(" · ")}
                  </h2>
                </div>
                <ProfileScrollDepthCard
                  className={`relative mx-auto w-full overflow-hidden rounded-xl bg-black ${currentVideo.height && currentVideo.width && currentVideo.height > currentVideo.width ? "aspect-[9/16] max-h-[72dvh] max-w-sm" : "aspect-video max-w-3xl"}`}
                >
                  <div data-testid="video-player">
                    <iframe
                      src={buildVimeoSrc(currentVideo.embedUrl, "autoplay=1&muted=1&controls=1&title=0&byline=0&portrait=0&autopause=0") || ""}
                      className="absolute inset-0 h-full w-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title={formatVideoTitle(currentVideo.name)}
                    />
                  </div>
                </ProfileScrollDepthCard>
              </div>
            )}
            {isVotingOpen && (
              <div className="mt-6">
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
                  data-testid="button-donate-votes"
                >
                  <Heart className="mr-2 h-4 w-4" />
                  Donate &amp; Vote
                </Link>
              </div>
              </div>
            )}
            {otherVideos.length > 0 && (
              <div className="mt-8" data-testid="other-competition-video-wheel">
                <div className="mb-2 text-center">
                  <p className="text-[11px] uppercase tracking-[3px] text-white/45">More from {profile.stageName || profile.displayName}</p>
                  <h2 className="mt-1 text-sm font-semibold text-white/85">Videos from other competitions</h2>
                </div>
                <ContestantVideoWheel
                  videos={otherVideos.map((video) => ({
                    id: video.uri,
                    title: `${formatVideoTitle(video.name)} · ${video.competitionTitle}`,
                    thumbnail: video.thumbnail,
                  }))}
                  index={activeVideoIndex}
                  onIndexChange={(next) => { setActiveVideoIndex(next); setPlayingVideo(null); }}
                  onPlay={(i) => setPlayingVideo(otherVideos[i].uri)}
                  voteCount={contestant.voteCount}
                  accentColor={accentColor}
                />
                {activeOtherVideo && playingVideo === activeOtherVideo.uri && (
                  <ProfileScrollDepthCard
                    className={`relative mx-auto mt-5 w-full overflow-hidden rounded-xl bg-black ${activeOtherVideo.height && activeOtherVideo.width && activeOtherVideo.height > activeOtherVideo.width ? "aspect-[9/16] max-h-[72dvh] max-w-sm" : "aspect-video max-w-3xl"}`}
                  >
                    <div data-testid="other-video-player">
                      <iframe
                        src={buildVimeoSrc(activeOtherVideo.embedUrl, "autoplay=1&controls=1&title=0&byline=0&portrait=0&autopause=0") || ""}
                        className="absolute inset-0 h-full w-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title={`${formatVideoTitle(activeOtherVideo.name)} — ${activeOtherVideo.competitionTitle}`}
                      />
                    </div>
                  </ProfileScrollDepthCard>
                )}
              </div>
            )}
          </section>
        )}

        {/* Profile photos follow the current-competition video and cross-competition wheel. */}
        {profile.imageUrls && profile.imageUrls.length > 0 && (
          <section className="mx-auto mb-8 w-full max-w-5xl px-4" aria-label="Contestant photo gallery" data-testid="contestant-photo-gallery">
            <div className="mb-5 text-center">
              <p className="mb-1 text-sm text-[#5f5f5f]">See what&apos;s new</p>
              <h2 className="text-lg font-normal uppercase text-white" style={{ letterSpacing: "8px" }}>Profile photos</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              {profile.imageUrls.map((url, i) => (
                <ProfileScrollDepthCard key={i} className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-900">
                  <FallbackImage
                    src={url}
                    fallbackSrc={getBackupUrl(profile.imageUrls, profile.imageBackupUrls, i)}
                    alt={`${profile.stageName || profile.displayName} profile photo ${i + 1}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{
                      objectPosition: `${profile.imageCropPositions?.[i]?.x ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.x}% ${profile.imageCropPositions?.[i]?.y ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.y}%`,
                    }}
                  />
                </ProfileScrollDepthCard>
              ))}
            </div>
          </section>
        )}

        <div className="mx-auto max-w-4xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

          {videos.length === 0 && otherVideos.length === 0 && isVotingOpen && (
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
                  data-testid="button-donate-votes"
                >
                  <Heart className="mr-2 h-4 w-4" />
                  Donate &amp; Vote
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

          {/* Share */}
          <div className="flex justify-center mb-10">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 bg-white/5 text-white/70 font-bold text-sm uppercase px-8 leading-[47px] rounded-full border border-white/20 transition-all duration-500 hover:bg-white/10 hover:text-white hover:border-white/40 cursor-pointer"
              style={{ letterSpacing: "2px" }}
              data-testid="button-share"
              aria-label={seoShareVideo || currentVideo ? "Share contestant profile and video" : "Share contestant profile"}
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Copied!" : seoShareVideo || currentVideo ? "Share profile + video" : "Share profile"}
            </button>
          </div>

          {/* Bottom nav */}
          {!demoMode && <div className="flex flex-wrap items-center justify-center gap-4 pb-10">
            <Link href={`/${slugify(competition.category)}/${competitionSlug(competition)}`}>
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
          </div>}
        </div>

        {!demoMode && <SiteFooter />}
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
