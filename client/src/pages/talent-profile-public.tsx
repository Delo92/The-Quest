import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, MapPin, Tag, ChevronRight, Play } from "lucide-react";
import { SiYoutube, SiInstagram, SiTiktok, SiFacebook } from "react-icons/si";
import { Link } from "wouter";
import { useState } from "react";
import type { TalentProfile } from "@shared/schema";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";

export default function TalentProfilePublic() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { getImage } = useLivery();

  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery<TalentProfile & { videos?: any[] }>({
    queryKey: ["/api/talent-profiles", id],
    enabled: !!id,
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <SiteNavbar />
        <div className="text-center">
          <Trophy className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Profile not found</h3>
          <Link href="/competitions">
            <span className="inline-block mt-4 text-white/60 hover:text-white transition-colors cursor-pointer">
              Back to Competitions
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const fallbackDefault = getImage("talent_profile_fallback", "/images/template/a1.jpg");
  const mainImage = profile.imageUrls?.[0] || fallbackDefault;
  const mainImageFallback = getBackupUrl(profile.imageUrls, (profile as any).imageBackupUrls, 0) || fallbackDefault;

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
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-10 pb-6 px-8 z-10 w-[calc(100%-60px)] max-w-[552px]">
          <p className="text-black/50 text-base leading-relaxed mb-1">Talent Profile</p>
          <h2
            className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none"
            style={{ letterSpacing: "10px" }}
            data-testid="text-profile-name"
          >
            {profile.stageName || profile.displayName}
          </h2>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40 mb-10">
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
                    fallbackSrc={getBackupUrl(profile.imageUrls, (profile as any).imageBackupUrls, i)}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.videos && profile.videos.length > 0 && (
          <div className="mb-10">
            <div className="text-center mb-10">
              <p className="text-[#5f5f5f] text-sm mb-1">Watch performances</p>
              <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>
                Videos
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profile.videos.map((video: any, i: number) => (
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
                        <div className="w-14 h-14 bg-[#FF5A09] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                          <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-white/50 text-sm mt-2 text-center truncate">{video.name}</p>
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
              className="inline-block bg-transparent text-white font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer"
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
