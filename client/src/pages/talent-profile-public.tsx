import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trophy, MapPin, Tag, ChevronRight, ExternalLink, X, LockKeyhole } from "lucide-react";
import { SiYoutube, SiInstagram, SiTiktok, SiFacebook } from "react-icons/si";
import { Link } from "wouter";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";
import { DEFAULT_TALENT_IMAGE_CROP_POSITION } from "@shared/image-crop";
import { formatVideoTitle } from "@/lib/media-utils";
import { useAuth } from "@/hooks/use-auth";
import { slugify } from "@shared/slugify";

interface PublicTalentProfile {
  id: number;
  role: string;
  displayName: string;
  stageName: string | null;
  bio: string | null;
  category: string | null;
  location: string | null;
  email?: string | null;
  showEmail?: boolean;
  imageUrls: string[];
  imageBackupUrls?: string[];
  imageCropPositions?: Array<{ x: number; y: number; zoom?: number }>;
  socialLinks: string | Record<string, any> | null;
  profileColor?: string | null;
  profileBgImage?: string | null;
}

export default function TalentProfilePublic() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { getImage } = useLivery();
  const { isAuthenticated } = useAuth();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  useEffect(() => {
    if (!id || isAuthenticated) {
      setShowSignInPrompt(false);
      return;
    }
    setShowSignInPrompt(window.localStorage.getItem(`quest-tax-signin-dismissed-${id}`) !== "1");
  }, [id, isAuthenticated]);

  const { data: profile, isLoading, isError } = useQuery<PublicTalentProfile>({
    queryKey: ["/api/talent-profiles", id, "public"],
    queryFn: async () => {
      const response = await fetch(`/api/talent-profiles/${encodeURIComponent(id!)}/public`);
      if (!response.ok) throw new Error("Public profile could not be loaded");
      return response.json();
    },
    enabled: !!id,
  });
  const { data: videos = [] } = useQuery<any[]>({
    queryKey: ["/api/talent-profiles", id, "videos"],
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: competitions = [] } = useQuery<{ id: number; title: string; category: string | null }[]>({
    queryKey: ["/api/talent-profiles", id, "competitions"],
    enabled: !!id,
    staleTime: 60_000,
  });

  const profileName = profile?.stageName?.trim() || profile?.displayName?.trim() || "";
  const fallbackDefault = getImage("talent_profile_fallback") || "";
  const mainImage = profile?.imageUrls?.[0] || fallbackDefault;
  const mainImageFallback = profile
    ? getBackupUrl(profile.imageUrls, (profile as any).imageBackupUrls, 0) || fallbackDefault
    : fallbackDefault;
  const canIndexProfile = String(profile?.role || "").toLowerCase() === "talent";

  useSEO({
    title: profileName ? `${profileName} | Artist Profile on The Quest` : "Artist Profile | The Quest",
    description: profile?.bio?.trim()
      || (profileName ? `${profileName} is an artist on The Quest. Explore their public profile, work, and competition entries.` : "Explore artist and competitor profiles on The Quest."),
    canonical: id ? `/thequest/talent/${encodeURIComponent(id)}` : undefined,
    ogType: "profile",
    ogImage: profile?.imageUrls?.[0] || undefined,
    robots: !profile || !canIndexProfile ? "noindex, follow" : undefined,
    pending: isLoading,
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

  if (isError || !profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <SiteNavbar />
        <div className="text-center">
          <Trophy className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold" data-testid="status-profile-not-found">Profile not found</h3>
          <Link href="/competitions">
            <span className="inline-block mt-4 text-white/60 hover:text-white transition-colors cursor-pointer">
              Back to Competitions
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const accentColor = (profile as any).profileColor || "#FF5A09";

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section
        className="relative h-[270px] md:h-[340px] overflow-hidden"
      >
        <FallbackImage
          src={mainImage}
          fallbackSrc={mainImageFallback}
          alt={profile.stageName || profile.displayName || "Talent"}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: `${profile.imageCropPositions?.[0]?.x ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.x}% ${profile.imageCropPositions?.[0]?.y ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.y}%`,
          }}
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-10 pb-6 px-8 z-10 w-[calc(100%-60px)] max-w-[552px]" style={{ borderTop: `4px solid ${accentColor}` }}>
          <p className="text-black/50 text-base leading-relaxed mb-1">Talent Profile</p>
          <h1
            className="text-[24px] md:text-[30px] uppercase font-normal leading-none"
            style={{ letterSpacing: "10px", color: accentColor }}
            data-testid="text-profile-name"
          >
            {profileName}
          </h1>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {profile.role === "talent" && !isAuthenticated && showSignInPrompt && (
          <aside className="mb-8 flex flex-col gap-3 rounded-xl border border-orange-400/20 bg-orange-400/[0.06] p-4 sm:flex-row sm:items-center" aria-label="Contestant sign-in prompt">
            <LockKeyhole className="h-5 w-5 flex-none text-orange-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Are you this contestant?</p>
              <p className="mt-1 text-sm text-white/55">Sign in to manage your earnings and enter tax details before your competition’s final-voting cutoff.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/login?section=tax">
                <Button className="min-h-10 bg-orange-500 text-white hover:bg-orange-400">Sign in</Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                className="min-h-10 text-white/55 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  window.localStorage.setItem(`quest-tax-signin-dismissed-${id}`, "1");
                  setShowSignInPrompt(false);
                }}
                aria-label="Dismiss sign-in prompt"
              >
                <X className="mr-1 h-4 w-4" /> Dismiss
              </Button>
            </div>
          </aside>
        )}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40 mb-10">
          {profile.category && (
            <span className="flex items-center gap-1.5" data-testid="text-category">
              <Tag className="h-4 w-4" style={{ color: accentColor }} /> {profile.category}
            </span>
          )}
          {profile.location && (
            <span className="flex items-center gap-1.5" data-testid="text-location">
              <MapPin className="h-4 w-4" style={{ color: accentColor }} /> {profile.location}
            </span>
          )}
        </div>

        {profile.bio && (
          <div className="mb-10 text-center">
            <p className="text-white/50 leading-relaxed text-base max-w-2xl mx-auto" data-testid="text-bio">
              {profile.bio}
            </p>
          </div>
        )}

        {profile.showEmail === true && profile.email && (
          <p className="mb-8 text-center text-sm text-white/60" data-testid="text-public-email">
            <a className="underline decoration-white/30 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" href={`mailto:${profile.email}`} data-testid="link-public-email">
              Contact {profileName}
            </a>
          </p>
        )}

        <div className="mb-10 flex justify-center">
          <Link href={`/nominate?profileId=${encodeURIComponent(String(profile.id))}`}>
            <span
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#ff5a09] px-7 text-sm font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#e94f00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              data-testid="link-nominate-profile"
            >
              Nominate {profileName || "this contestant"} <ChevronRight className="h-4 w-4" />
            </span>
          </Link>
        </div>

        {(() => {
          let socialObj: Record<string, any> = {};
          try {
            const raw = (profile as any).socialLinks;
            if (raw) socialObj = typeof raw === "string" ? JSON.parse(raw) : raw;
          } catch {}
          const platforms = [
            { key: "youtube", icon: SiYoutube, label: "YouTube", color: "text-[#FF0000] hover:text-[#FF0000]/80" },
            { key: "instagram", icon: SiInstagram, label: "Instagram", color: "text-[#E4405F] hover:text-[#E4405F]/80" },
            { key: "tiktok", icon: SiTiktok, label: "TikTok", color: "text-[#00F2EA] hover:text-[#00F2EA]/80" },
            { key: "facebook", icon: SiFacebook, label: "Facebook", color: "text-[#1877F2] hover:text-[#1877F2]/80" },
          ];
          const active = platforms.filter(p => socialObj[p.key] && /^https?:\/\//i.test(socialObj[p.key]));
          const customLinks: { label: string; url: string }[] = Array.isArray(socialObj.customLinks)
            ? socialObj.customLinks.filter((l: any) => l.label && l.url && /^https?:\/\//i.test(l.url))
            : [];
          if (active.length === 0 && customLinks.length === 0) return null;
          return (
            <div className="flex flex-col items-center gap-5 mb-10" data-testid="social-links">
              {/* Platform icons */}
              {active.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-5">
                  {active.map(({ key, icon: Icon, label, color }) => (
                    <a key={key} href={socialObj[key]} target="_blank" rel="noopener noreferrer"
                      className={`${color} transition-colors duration-300`}
                      data-testid={`link-social-${key}`} title={label}>
                      <Icon className="h-6 w-6" />
                    </a>
                  ))}
                </div>
              )}
              {/* Custom CTA buttons */}
              {customLinks.length > 0 && (
                <div className="flex flex-wrap justify-center gap-3">
                  {customLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ borderColor: accentColor, color: accentColor }}
                      className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2 text-sm font-semibold transition-all hover:opacity-80 hover:scale-105"
                      data-testid={`link-custom-${i}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {competitions.length > 0 && (
          <div className="mb-10" data-testid="profile-competitions">
            <div className="text-center mb-6">
              <p className="text-sm mb-1" style={{ color: accentColor }}>Explore their appearances</p>
              <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>Competitions</h2>
            </div>
            <div className="flex flex-col items-stretch gap-3 max-w-md mx-auto">
              {competitions.map((c) => (
                <Link key={c.id} href={c.category ? `/${slugify(c.category)}/${slugify(c.title)}` : "/competitions"}>
                  <span
                    className="flex min-h-12 items-center justify-between gap-3 rounded-full border px-5 py-3 text-sm font-semibold cursor-pointer transition-all hover:opacity-80"
                    style={{ borderColor: accentColor, color: accentColor }}
                    data-testid={`link-profile-competition-${c.id}`}
                  >
                    <span className="truncate">{c.title}</span>
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {profile.imageUrls && profile.imageUrls.length > 0 && (
          <div className="mb-10">
            <div className="text-center mb-10">
              <p className="text-sm mb-1" style={{ color: accentColor }}>See what&apos;s new</p>
              <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>
                Gallery
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {profile.imageUrls.map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden group cursor-pointer">
                  <FallbackImage
                    src={url}
                    fallbackSrc={getBackupUrl(profile.imageUrls, (profile as any).imageBackupUrls, i)}
                    alt={`${profileName} photo ${i + 1}`}
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

        {videos.length > 0 && (
          <div className="mb-10">
            <div className="text-center mb-10">
              <p className="text-sm mb-1" style={{ color: accentColor }}>Watch performances</p>
              <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>
                Videos
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {videos.map((video: any, i: number) => (
                <div key={video.uri || i} className="relative" data-testid={`video-item-${i}`}>
                  <div className={video.height > video.width ? "aspect-[9/16]" : "aspect-video"}>
                    <iframe
                      src={`${video.embedUrl}${video.embedUrl.includes("?") ? "&" : "?"}autoplay=1&muted=1&loop=1&background=1&controls=0&autopause=0&title=0&byline=0&portrait=0`}
                      className="w-full h-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title={formatVideoTitle(video.name)}
                    />
                  </div>
                  <p className="text-white/50 text-sm mt-2 text-center truncate">{formatVideoTitle(video.name)}</p>
                  {video.competitionFolder && (
                    <p className="text-white/30 text-xs text-center">{video.competitionFolder}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pb-10">
          <Link href="/competitions">
            <span
              className="inline-block bg-transparent font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] border transition-all duration-500 cursor-pointer hover:text-white"
              style={{ color: accentColor, borderColor: accentColor }}
              data-testid="button-back"
            >
              Back to Competitions <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
            </span>
          </Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
