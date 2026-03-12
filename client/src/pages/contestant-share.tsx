import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, MapPin, Tag, ChevronRight, Play, Heart, ShoppingCart, Calendar, Users, Share2, Check, Copy } from "lucide-react";
import { SiYoutube, SiInstagram, SiTiktok, SiFacebook } from "react-icons/si";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";
import { slugify } from "@shared/slugify";

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
    videoThumbnail: string | null;
    videos: {
      uri: string;
      name: string;
      link: string;
      embedUrl: string;
      duration: number;
      thumbnail: string | null;
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

export default function ContestantSharePage() {
  const [, params] = useRoute("/:categorySlug/:compSlug/:talentSlug");
  const categorySlug = params?.categorySlug;
  const compSlug = params?.compSlug;
  const talentSlug = params?.talentSlug;
  const { getImage } = useLivery();
  const { user } = useAuth();
  const { toast } = useToast();
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<ResolvedData>({
    queryKey: ["/api/resolve", categorySlug, compSlug, talentSlug],
    enabled: !!categorySlug && !!compSlug && !!talentSlug,
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

  useEffect(() => {
    if (data) {
      document.title = `${data.contestant.talentProfile.displayName} - ${data.competition.title} | The Quest`;
    }
    return () => { document.title = "The Quest - Talent Competition & Voting Platform"; };
  }, [data]);

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
  const fallbackDefault = getImage("talent_profile_fallback", "/images/template/a1.jpg");
  const mainImage = contestant.videoThumbnail || profile.imageUrls?.[0] || fallbackDefault;
  const mainImageFallback = getBackupUrl(profile.imageUrls, profile.imageBackupUrls, 0) || fallbackDefault;
  const isVotingOpen = competition.status === "active" || competition.status === "voting";
  const votePercentage = totalVotes > 0 ? Math.round((contestant.voteCount / totalVotes) * 100) : 0;

  const getShareData = () => {
    const shareUrl = `${window.location.origin}/thequest/${categorySlug}/${compSlug}/${talentSlug}?ref=${talentSlug}`;
    const shareText = `Vote for ${profile.displayName} in ${competition.title} on The Quest!`;
    return { shareUrl, shareText };
  };

  const handleShare = async () => {
    const { shareUrl, shareText } = getShareData();
    const fullText = `${shareText}\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = fullText;
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

  return (
    <div className="min-h-screen bg-black text-white relative">
      {bgImage && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={bgImage} alt="" className="w-full h-full object-cover opacity-[0.04]" />
        </div>
      )}
      <div className="relative z-10">
      <SiteNavbar />

      <section
        className="relative h-[270px] md:h-[400px] overflow-hidden"
      >
        <FallbackImage
          src={mainImage}
          fallbackSrc={mainImageFallback}
          alt={profile.displayName || ""}
          className="absolute inset-0 w-full h-full object-cover"
        />
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
            {profile.displayName}
          </h2>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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

        {isVotingOpen && (
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10" data-testid="voting-actions">
            <button
              onClick={() => voteMutation.mutate()}
              disabled={voteMutation.isPending}
              className="inline-flex items-center bg-black text-white font-bold text-sm uppercase px-8 leading-[47px] border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer disabled:opacity-50"
              style={{ letterSpacing: "2px" }}
              data-testid="button-vote"
            >
              <Heart className="h-4 w-4 mr-2" />
              {voteMutation.isPending ? "Voting..." : "Vote Free"}
            </button>
            <Link
              href={`/checkout/${competition.id}/${contestant.id}`}
              className="inline-flex items-center text-white font-bold text-sm uppercase px-8 leading-[47px] border transition-all duration-500 cursor-pointer"
              style={{ letterSpacing: "2px", backgroundColor: accentColor, borderColor: accentColor }}
              data-testid="button-buy-votes"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Buy Votes
            </Link>
          </div>
        )}

        <div className="flex justify-center mb-10">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 bg-white/5 text-white/70 font-bold text-sm uppercase px-8 leading-[47px] border border-white/20 transition-all duration-500 hover:bg-white/10 hover:text-white hover:border-white/40 cursor-pointer"
            style={{ letterSpacing: "2px" }}
            data-testid="button-share"
          >
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
            {copied ? "Copied!" : "Share"}
          </button>
        </div>

        {profile.bio && (
          <div className="mb-10 text-center">
            <p className="text-white/50 leading-relaxed text-base max-w-2xl mx-auto" data-testid="text-bio">
              {profile.bio}
            </p>
          </div>
        )}

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

        {contestant.videos && contestant.videos.length > 0 && (
          <div className="mb-10">
            <div className="text-center mb-10">
              <p className="text-[#5f5f5f] text-sm mb-1">Watch performances</p>
              <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>
                Videos
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contestant.videos.map((video, i) => (
                <div key={video.uri || i} className="relative" data-testid={`video-item-${i}`}>
                  {playingVideo === video.embedUrl ? (
                    <div className="aspect-video">
                      <iframe
                        src={`${video.embedUrl}?autoplay=1`}
                        className="w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div
                      className="relative aspect-video overflow-hidden group cursor-pointer"
                      onClick={() => setPlayingVideo(video.embedUrl)}
                    >
                      <img
                        src={video.thumbnail || "/images/template/a1.jpg"}
                        alt={video.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors duration-500 flex items-center justify-center">
                        <div className="w-14 h-14 flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: accentColor }}>
                          <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-white/50 text-sm mt-2 text-center truncate">{video.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 pb-10">
          <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`}>
            <span
              className="inline-block bg-transparent text-white font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer text-center"
              data-testid="button-back-competition"
            >
              View Competition <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
            </span>
          </Link>
          <Link href="/competitions">
            <span
              className="inline-block bg-transparent text-white/60 font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] border border-white/30 transition-all duration-500 hover:bg-white hover:text-black cursor-pointer text-center"
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
