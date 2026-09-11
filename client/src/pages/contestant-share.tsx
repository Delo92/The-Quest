import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, MapPin, Tag, ChevronRight, ChevronLeft, Play, Heart, ShoppingCart, Share2, Check, Users } from "lucide-react";
import { SiYoutube, SiInstagram, SiTiktok, SiFacebook } from "react-icons/si";
import { Link } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";
import { slugify } from "@shared/slugify";
import { formatVideoTitle } from "@/lib/media-utils";

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

  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Touch/swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const { data, isLoading, error } = useQuery<ResolvedData>({
    queryKey: ["/api/resolve", categorySlug, compSlug, talentSlug],
    enabled: !!categorySlug && !!compSlug && !!talentSlug,
  });

  const { data: mediaData } = useQuery<{
    videoThumbnail: string | null;
    videos: ResolvedData["contestant"]["videos"];
  }>({
    queryKey: ["/api/resolve", categorySlug, compSlug, talentSlug, "videos"],
    enabled: !!data && !!categorySlug && !!compSlug && !!talentSlug,
    staleTime: 60_000,
  });

  // Fetch full contestant list for the competition (for prev/next navigation)
  const { data: competitionData } = useQuery<{ contestants: CompetitionContestant[] }>({
    queryKey: ["/api/resolve/competition", categorySlug, compSlug],
    queryFn: async () => {
      const res = await fetch(`/api/resolve/competition/${categorySlug}/${compSlug}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!categorySlug && !!compSlug,
    staleTime: 120_000,
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
  const currentIndex = orderedContestants.findIndex(
    (c) => slugify(c.talentProfile.stageName || c.talentProfile.displayName) === talentSlug
  );
  const prevContestant = currentIndex > 0 ? orderedContestants[currentIndex - 1] : null;
  const nextContestant = currentIndex >= 0 && currentIndex < orderedContestants.length - 1
    ? orderedContestants[currentIndex + 1]
    : null;

  const goToContestant = useCallback((c: CompetitionContestant | null) => {
    if (!c) return;
    const slug = slugify(c.talentProfile.stageName || c.talentProfile.displayName);
    // Navigate relative to the wouter base (/thequest is already the base)
    navigate(`/${categorySlug}/${compSlug}/${slug}`);
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
      toast({ title: "Vote failed", description: err.message || "Could not cast vote", variant: "destructive" });
    },
  });

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
          <img src={bgImage} alt="" className="w-full h-full object-cover opacity-[0.04]" />
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
                    onClick={() => voteMutation.mutate()}
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

        {/* Hero */}
        <section className="relative h-[270px] md:h-[400px] overflow-hidden">
          {heroVideoEmbedUrl ? (
            <iframe
              src={`${heroVideoEmbedUrl}${heroVideoEmbedUrl.includes("?") ? "&" : "?"}autoplay=1&muted=1&loop=1&background=1&controls=0&autopause=0`}
              className="absolute left-0"
              style={heroVideoIsPortrait ? {
                top: "50%",
                transform: "translateY(-50%)",
                width: "100%",
                aspectRatio: `${videos[0].width} / ${videos[0].height}`,
                border: "none",
                pointerEvents: "none",
              } : {
                top: 0,
                width: "100%",
                height: "100%",
                border: "none",
                pointerEvents: "none",
              }}
              allow="autoplay; fullscreen"
              title={profile.stageName || profile.displayName || ""}
            />
          ) : (
            <FallbackImage
              src={mainImage}
              fallbackSrc={mainImageFallback}
              alt={profile.stageName || profile.displayName || ""}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pt-8 pb-5 px-8 z-10 w-[calc(100%-40px)] max-w-[600px]"
            style={{ backgroundColor: "white" }}
          >
            <p className="text-xs uppercase mb-1" style={{ letterSpacing: "4px", color: accentColor }} data-testid="text-competition-context">
              {competition.title}
            </p>
            <h2
              className="text-[24px] md:text-[34px] uppercase text-black font-normal leading-none"
              style={{ letterSpacing: "10px" }}
              data-testid="text-contestant-name"
            >
              {profile.stageName || profile.displayName}
            </h2>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Metadata */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40 mb-6">
            {profile.category && (
              <span className="flex items-center gap-1.5" data-testid="text-category">
                <Tag className="h-4 w-4 text-white/30" /> {profile.category}
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1.5" data-testid="text-location">
                <MapPin className="h-4 w-4 text-white/30" /> {profile.location}
              </span>
            )}
            <span className="flex items-center gap-1.5" data-testid="text-competition-name">
              <Trophy className="h-4 w-4 text-white/30" /> {competition.title}
            </span>
          </div>

          {/* Vote stats */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-6 bg-white/5 px-8 py-4">
              <div data-testid="text-vote-count">
                <span className="text-3xl font-bold" style={{ color: accentColor }}>{contestant.voteCount}</span>
                <p className="text-white/40 text-xs uppercase mt-1" style={{ letterSpacing: "3px" }}>Votes</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div data-testid="text-vote-percentage">
                <span className="text-3xl font-bold text-white">{votePercentage}%</span>
                <p className="text-white/40 text-xs uppercase mt-1" style={{ letterSpacing: "3px" }}>Of Total</p>
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mb-10 text-center">
              <p className="text-white/50 leading-relaxed text-base max-w-2xl mx-auto" data-testid="text-bio">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Social links */}
          {(() => {
            let socialObj: Record<string, string> = {};
            try {
              const raw = profile.socialLinks;
              if (raw) socialObj = typeof raw === "string" ? JSON.parse(raw) : raw;
            } catch {}
            const platforms = [
              { key: "youtube", icon: SiYoutube, label: "YouTube", color: "text-[#FF0000] hover:text-[#FF0000]/80" },
              { key: "instagram", icon: SiInstagram, label: "Instagram", color: "text-[#E4405F] hover:text-[#E4405F]/80" },
              { key: "tiktok", icon: SiTiktok, label: "TikTok", color: "text-[#00F2EA] hover:text-[#00F2EA]/80" },
              { key: "facebook", icon: SiFacebook, label: "Facebook", color: "text-[#1877F2] hover:text-[#1877F2]/80" },
            ];
            const active = platforms.filter(p => socialObj[p.key] && /^https?:\/\//i.test(socialObj[p.key]));
            if (active.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center justify-center gap-5 mb-10" data-testid="social-links">
                {active.map(({ key, icon: Icon, label, color }) => (
                  <a key={key} href={socialObj[key]} target="_blank" rel="noopener noreferrer"
                    className={`${color} transition-colors duration-300`}
                    data-testid={`link-social-${key}`} title={label}>
                    <Icon className="h-6 w-6" />
                  </a>
                ))}
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
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Videos + vote buttons directly below */}
          {videos.length > 0 && (
            <div className="mb-10">
              <div className="text-center mb-10">
                <p className="text-[#5f5f5f] text-sm mb-1">Watch performances</p>
                <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>
                  Videos
                </h2>
              </div>
              <div className={`grid gap-6 ${videos.length === 1 ? "grid-cols-1 max-w-xl mx-auto" : "grid-cols-1 md:grid-cols-2"}`}>
                {videos.map((video, i) => (
                  <div key={video.uri || i} className="relative" data-testid={`video-item-${i}`}>
                    <div
                      className={`relative overflow-hidden ${video.height && video.width && video.height > video.width ? "aspect-[9/16]" : "aspect-video"}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Play ${formatVideoTitle(video.name)}`}
                      onClick={() => setPlayingVideo(video.uri)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setPlayingVideo(video.uri);
                        }
                      }}
                    >
                      {playingVideo === video.uri ? (
                        <iframe
                          src={`${video.embedUrl}${video.embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
                          className="w-full h-full"
                          loading="lazy"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title={formatVideoTitle(video.name)}
                        />
                      ) : (
                        <>
                          <FallbackImage
                            src={video.thumbnail || getImage("talent_profile_fallback") || ""}
                            fallbackSrc={getImage("talent_profile_fallback") || ""}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors duration-300">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 border border-white/30 text-white shadow-lg backdrop-blur-sm">
                              <Play className="ml-1 h-6 w-6 fill-current" />
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-white/50 text-sm mt-2 text-center truncate">{formatVideoTitle(video.name)}</p>
                  </div>
                ))}
              </div>

              {/* Vote buttons directly under the video — in eyeline after watching */}
              {isVotingOpen && (
                <div className="flex flex-wrap items-center justify-center gap-4 mt-8" data-testid="voting-actions">
                  <button
                    onClick={() => voteMutation.mutate()}
                    disabled={voteMutation.isPending}
                    className="inline-flex items-center bg-black text-white font-bold text-sm uppercase px-8 leading-[47px] rounded-full border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer disabled:opacity-50"
                    style={{ letterSpacing: "2px" }}
                    data-testid="button-vote"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    {voteMutation.isPending ? "Voting..." : "Vote Free"}
                  </button>
                  <Link
                    href={`/checkout/${competition.id}/${contestant.id}`}
                    className="inline-flex items-center text-white font-bold text-sm uppercase px-8 leading-[47px] rounded-full border transition-all duration-500 cursor-pointer"
                    style={{ letterSpacing: "2px", backgroundColor: accentColor, borderColor: accentColor }}
                    data-testid="button-buy-votes"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buy Votes
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Vote buttons for profiles with no video (keep above nav) */}
          {videos.length === 0 && isVotingOpen && (
            <div className="flex flex-wrap items-center justify-center gap-4 mb-10" data-testid="voting-actions">
              <button
                onClick={() => voteMutation.mutate()}
                disabled={voteMutation.isPending}
                className="inline-flex items-center bg-black text-white font-bold text-sm uppercase px-8 leading-[47px] rounded-full border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer disabled:opacity-50"
                style={{ letterSpacing: "2px" }}
                data-testid="button-vote"
              >
                <Heart className="h-4 w-4 mr-2" />
                {voteMutation.isPending ? "Voting..." : "Vote Free"}
              </button>
              <Link
                href={`/checkout/${competition.id}/${contestant.id}`}
                className="inline-flex items-center text-white font-bold text-sm uppercase px-8 leading-[47px] rounded-full border transition-all duration-500 cursor-pointer"
                style={{ letterSpacing: "2px", backgroundColor: accentColor, borderColor: accentColor }}
                data-testid="button-buy-votes"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Buy Votes
              </Link>
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
      </div>
    </div>
  );
}
