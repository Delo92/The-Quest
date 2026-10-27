import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronRight, ExternalLink, LockKeyhole, MapPin, Tag, X } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import { Skeleton } from "@/components/ui/skeleton";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { useAuth } from "@/hooks/use-auth";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";
import PublicCompetitionEntry, { type CompetitionVideo, type PublicCompetition } from "@/components/public-competition-entry";
import { DEFAULT_TALENT_IMAGE_CROP_POSITION } from "@shared/image-crop";
import { extractIdFromSlug, slugify, slugifyWithId } from "@shared/slugify";

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

interface CompetitionMedia {
  videoThumbnail: string | null;
  videos: CompetitionVideo[];
}

function imageSourceKey(source: string | null | undefined) {
  return (source || "").split(/[?#]/, 1)[0].trim().toLowerCase();
}

function SectionHeading({ eyebrow, title, index }: { eyebrow: string; title: string; index?: string }) {
  return (
    <div className="mb-9 flex items-end justify-between gap-5 border-b border-white/[0.1] pb-5 sm:mb-12">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.24em] text-[#ff9b58]">{eyebrow}</p>
        <h2 className="font-display text-3xl leading-none tracking-[-.035em] text-[#f7f3ed] sm:text-5xl">{title}</h2>
      </div>
      {index && <span className="pb-1 font-mono text-xs tracking-widest text-white/35">{index}</span>}
    </div>
  );
}

function SocialLinks({ profile, accentColor }: { profile: PublicTalentProfile; accentColor: string }) {
  let socialObj: Record<string, any> = {};
  try {
    const raw = profile.socialLinks;
    if (raw) socialObj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    socialObj = {};
  }
  const platforms = [
    { key: "youtube", icon: SiYoutube, label: "YouTube" },
    { key: "instagram", icon: SiInstagram, label: "Instagram" },
    { key: "tiktok", icon: SiTiktok, label: "TikTok" },
    { key: "facebook", icon: SiFacebook, label: "Facebook" },
  ];
  const active = platforms.filter((platform) => socialObj[platform.key] && /^https?:\/\//i.test(socialObj[platform.key]));
  const customLinks: { label: string; url: string }[] = Array.isArray(socialObj.customLinks)
    ? socialObj.customLinks.filter((link: any) => link.label && link.url && /^https?:\/\//i.test(link.url))
    : [];
  if (!active.length && !customLinks.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="social-links">
      {active.map(({ key, icon: Icon, label }) => (
        <a
          key={key}
          href={socialObj[key]}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          aria-label={label}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 transition-transform duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          data-testid={`link-social-${key}`}
        >
          <Icon className="h-[17px] w-[17px]" />
        </a>
      ))}
      {customLinks.map((link, index) => (
        <a
          key={`${link.url}-${index}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ borderColor: `${accentColor}66` }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-white/[0.035] px-4 text-xs font-semibold text-white/85 transition-colors hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          data-testid={`link-custom-${index}`}
        >
          {link.label}<ExternalLink className="h-3.5 w-3.5 text-white/50" />
        </a>
      ))}
    </div>
  );
}

export default function TalentProfilePublic() {
  const params = useParams<{ id?: string; profileSlug?: string }>();
  const idFromSlug = params?.profileSlug ? extractIdFromSlug(params.profileSlug).id : null;
  const id = params?.id || (idFromSlug ? String(idFromSlug) : undefined);
  const [, navigate] = useLocation();
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

  const { data: profile, isLoading, isError, refetch } = useQuery<PublicTalentProfile>({
    queryKey: ["/api/talent-profiles", id, "public"],
    queryFn: async () => {
      const response = await fetch(`/api/talent-profiles/${encodeURIComponent(id!)}/public`);
      if (!response.ok) throw new Error("Public profile could not be loaded");
      return response.json();
    },
    enabled: !!id,
  });
  const { data: competitions = [], isLoading: competitionsLoading, isError: competitionsError, refetch: refetchCompetitions } = useQuery<PublicCompetition[]>({
    queryKey: ["/api/talent-profiles", id, "competitions"],
    queryFn: async () => {
      const response = await fetch(`/api/talent-profiles/${encodeURIComponent(id!)}/competitions`);
      if (!response.ok) throw new Error("Competition entries could not be loaded");
      return response.json();
    },
    enabled: !!id,
    staleTime: 60_000,
  });
  const mediaQueries = useQueries({
    queries: competitions.map((competition) => {
      const categorySlug = slugify(competition.category || "competition");
      const competitionSlug = slugify(competition.title);
      const contestantSlug = slugifyWithId(profile?.stageName?.trim() || profile?.displayName?.trim() || "", profile?.id || 0);
      return {
        queryKey: ["/api/resolve", categorySlug, competitionSlug, contestantSlug, "videos"],
        queryFn: async (): Promise<CompetitionMedia> => {
          const response = await fetch(`/api/resolve/${encodeURIComponent(categorySlug)}/${encodeURIComponent(competitionSlug)}/${encodeURIComponent(contestantSlug)}/videos`);
          if (response.status === 404) return { videoThumbnail: null, videos: [] };
          if (!response.ok) throw new Error("Competition video could not be loaded");
          return response.json();
        },
        enabled: !!profile && !!competition.category,
        staleTime: 60_000,
      };
    }),
  });

  const profileName = profile?.stageName?.trim() || profile?.displayName?.trim() || "";
  const fallbackDefault = getImage("talent_profile_fallback") || "";
  const mainImage = profile?.imageUrls?.[0] || fallbackDefault;
  const mainImageFallback = profile
    ? getBackupUrl(profile.imageUrls, profile.imageBackupUrls, 0) || fallbackDefault
    : fallbackDefault;
  const canIndexProfile = String(profile?.role || "").toLowerCase() === "talent";
  useEffect(() => {
    if (!profile || !profileName) return;
    const canonicalSlug = slugifyWithId(profileName, profile.id);
    if (!params?.id && params?.profileSlug === canonicalSlug) return;
    navigate(`/${canonicalSlug}${window.location.search}`, { replace: true });
  }, [params?.id, params?.profileSlug, profile, profileName, navigate]);

  useSEO({
    title: profileName ? `${profileName} | Personal Portfolio on The Quest` : "Personal Portfolio | The Quest",
    description: profile?.bio?.trim()
      || (profileName ? `${profileName} is an artist on The Quest. Explore their public profile, work, and competition entries.` : "Explore artist and competitor profiles on The Quest."),
    canonical: id && profileName ? `/thequest/${slugifyWithId(profileName, Number(id))}` : undefined,
    ogType: "profile",
    ogImage: profile?.imageUrls?.[0] || undefined,
    robots: !profile || !canIndexProfile ? "noindex, follow" : undefined,
    pending: isLoading,
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#111113]">
        <SiteNavbar />
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <Skeleton className="mb-8 h-[min(65vw,580px)] w-full rounded-[2rem] bg-white/[0.06]" />
          <Skeleton className="mb-4 h-10 w-1/3 bg-white/[0.07]" />
          <Skeleton className="h-5 w-1/2 bg-white/[0.05]" />
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-[100dvh] bg-[#111113] text-white">
        <SiteNavbar />
        <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <span className="mb-4 font-mono text-xs uppercase tracking-[.22em] text-[#ff9958]">The Quest / Profile</span>
          <h1 className="font-display text-4xl">This page isn&apos;t here.</h1>
          <p className="mt-3 text-sm text-white/55">The profile may have moved, or the link may be out of date.</p>
          <button type="button" onClick={() => refetch()} className="mt-7 rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[.14em] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" data-testid="button-retry-profile">
            Try again
          </button>
          <Link href="/competitions" className="mt-5 text-sm text-white/55 underline decoration-white/20 underline-offset-4 hover:text-white">Browse competitions</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const accentColor = profile.profileColor || "#ff7135";
  const mainImageKey = imageSourceKey(mainImage);
  const additionalImages = profile.imageUrls.filter((url) => imageSourceKey(url) !== mainImageKey);
  const savedBackground = profile.profileBgImage?.trim() || "";
  const backgroundImage = savedBackground && imageSourceKey(savedBackground) !== mainImageKey
    ? savedBackground
    : additionalImages[0] || mainImage;
  const backgroundImageKey = imageSourceKey(backgroundImage);
  const backgroundFallback = additionalImages.find((url) => imageSourceKey(url) !== backgroundImageKey) || fallbackDefault;
  const crop = profile.imageCropPositions?.[0] ?? DEFAULT_TALENT_IMAGE_CROP_POSITION;

  return (
    <div className="profile-depth-page min-h-[100dvh] overflow-hidden text-[#f7f3ed]">
      <style>{`
        @keyframes profile-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .profile-reveal { animation: profile-rise .65s cubic-bezier(.2,.75,.2,1) both; }
        .profile-reveal-delay { animation-delay: .14s; }
        .profile-reveal-late { animation-delay: .25s; }
        @media (prefers-reduced-motion: reduce) { .profile-reveal { animation: none; } }
      `}</style>
      <SiteNavbar />
      <main>
        <section className="relative isolate min-h-[740px] overflow-hidden sm:min-h-[830px]" aria-labelledby="text-profile-name">
          <div className="profile-depth-backdrop absolute -inset-[5%]">
            <FallbackImage
              src={backgroundImage}
              fallbackSrc={backgroundFallback}
              alt=""
              aria-hidden="true"
              className="h-full w-full scale-[1.02] object-cover opacity-[.25] grayscale blur-[2px]"
              style={{ objectPosition: `${crop.x}% ${crop.y}%` }}
            />
          </div>
          <div className="profile-depth-vignette absolute inset-0" />
          <div className="profile-depth-grid pointer-events-none absolute inset-0" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_42%,color-mix(in_srgb,var(--profile-accent)_24%,transparent),transparent_40%)]" style={{ ["--profile-accent" as string]: accentColor }} />
          <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[#111113] to-transparent" />
          <div className="relative mx-auto grid min-h-[740px] max-w-[1440px] grid-cols-1 items-center gap-10 px-5 pb-20 pt-12 sm:min-h-[830px] sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:px-14">
            <div className="order-2 max-w-2xl pb-4 lg:order-1 lg:pb-14">
              <div className="profile-reveal mb-7 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.25em] text-white/60">
                <span className="h-px w-9 bg-[#ff8b4c]" /> The Quest artist profile
              </div>
              <h1 id="text-profile-name" data-testid="text-profile-name" className="profile-reveal profile-reveal-delay max-w-4xl break-words font-display text-[clamp(3.4rem,9vw,8.4rem)] leading-[.82] tracking-[-.055em] text-white [text-shadow:0_12px_45px_rgba(0,0,0,.24)]">
                {profileName}
              </h1>
              <p className="profile-reveal profile-reveal-late mt-7 max-w-xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
                {profile.bio || "A performer on The Quest. Explore the work, find the competition, and make some noise."}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-medium text-white/55">
                {profile.category && <span className="inline-flex items-center gap-2" data-testid="text-category"><Tag className="h-3.5 w-3.5" style={{ color: accentColor }} />{profile.category}</span>}
                {profile.location && <span className="inline-flex items-center gap-2" data-testid="text-location"><MapPin className="h-3.5 w-3.5" style={{ color: accentColor }} />{profile.location}</span>}
                <span className="inline-flex items-center gap-2 uppercase tracking-[.14em]"><span className="h-1.5 w-1.5 rounded-full bg-[#f8894e]" />On The Quest</span>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a href="#entries" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#f47a3c] px-6 text-[11px] font-bold uppercase tracking-[.16em] text-[#171313] shadow-[0_10px_35px_rgba(244,122,60,.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" data-testid="link-explore-entries">
                  Explore their entries<ArrowDown className="h-4 w-4" />
                </a>
                <Link href={`/nominate?profileId=${encodeURIComponent(String(profile.id))}`} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-6 text-[11px] font-bold uppercase tracking-[.15em] text-white backdrop-blur-sm transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" data-testid="link-nominate-profile">
                  Nominate<ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
              {profile.showEmail === true && profile.email && (
                <a className="mt-5 inline-block text-sm text-white/55 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" href={`mailto:${profile.email}`} data-testid="link-public-email">
                  Contact {profileName}
                </a>
              )}
            </div>
            <div className="profile-reveal relative order-1 mx-auto w-full max-w-[420px] lg:order-2 lg:max-w-none">
              <div className="absolute -inset-7 rounded-[48%] bg-[#df763e]/[.12] blur-3xl" />
              <div className="relative mx-auto aspect-[.82] w-[min(76vw,390px)] rotate-[1.5deg] overflow-hidden rounded-[46%_46%_2rem_2rem] border border-white/20 bg-[#292629] shadow-[0_35px_100px_rgba(0,0,0,.52)] sm:w-[min(70vw,430px)]">
                <FallbackImage
                  src={mainImage}
                  fallbackSrc={mainImageFallback}
                  alt={profileName}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${crop.x}% ${crop.y}%` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-white/[.05]" />
                <div className="absolute inset-x-6 bottom-7 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[.24em] text-white/60">In the spotlight</p>
                    <p className="mt-1 font-display text-2xl text-white">{profile.stageName || profile.displayName}</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-2 rounded-full border border-white/15 bg-[#1e1d1e]/90 px-4 py-3 text-[9px] font-semibold uppercase tracking-[.16em] text-white/75 shadow-xl backdrop-blur-lg sm:-left-8">
                Real work. Real stages.
              </div>
              <div className="absolute right-0 top-[18%] hidden rotate-90 text-[9px] font-mono uppercase tracking-[.25em] text-white/45 sm:block">THE QUEST / {String(profile.id).padStart(4, "0")}</div>
            </div>
          </div>
          <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[9px] font-semibold uppercase tracking-[.2em] text-white/35 lg:flex">
            Scroll to discover <span className="h-px w-9 bg-white/25" />
          </div>
        </section>

        <div className="relative z-10 mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-12">
          {profile.role === "talent" && !isAuthenticated && showSignInPrompt && (
            <aside className="relative -mt-4 mb-16 flex flex-col gap-4 rounded-[1.5rem] border border-[#ed8a4a]/25 bg-[linear-gradient(115deg,rgba(237,138,74,.13),rgba(255,255,255,.035))] p-5 shadow-[0_22px_65px_rgba(0,0,0,.25)] backdrop-blur-xl sm:flex-row sm:items-center sm:p-6" aria-label="Contestant sign-in prompt">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#ed8a4a]/30 bg-[#ed8a4a]/10 text-[#ffad71]"><LockKeyhole className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Are you this contestant?</p>
                <p className="mt-1 text-sm leading-6 text-white/55">Sign in to manage your earnings and enter tax details before your competition&apos;s final-voting cutoff.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/login?section=tax" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f47a3c] px-6 text-[10px] font-bold uppercase tracking-[.15em] text-[#171313] transition-transform hover:-translate-y-0.5" data-testid="link-sign-in">Sign in</Link>
                <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={() => { window.localStorage.setItem(`quest-tax-signin-dismissed-${id}`, "1"); setShowSignInPrompt(false); }} aria-label="Dismiss sign-in prompt" data-testid="button-dismiss-sign-in">
                  <X className="h-4 w-4" /> Dismiss
                </button>
              </div>
            </aside>
          )}

          <section id="entries" className="scroll-mt-16 pb-24 pt-20 sm:pb-32 sm:pt-28" data-testid="profile-competitions">
            <SectionHeading eyebrow="Where the work meets the stage" title="Competition entries" index={`${String(competitions.length).padStart(2, "0")} ENTRIES`} />
            <p className="mb-9 max-w-2xl text-sm leading-6 text-white/48 sm:mb-12 sm:text-base">
              Every performance has its own stage. Watch the entry, then head to that competition to show your support.
            </p>
            {competitionsLoading ? (
              <div className={competitions.length === 1 ? "mx-auto grid max-w-5xl gap-6" : "grid gap-6 lg:grid-cols-2"}>
                {[0, 1].map((item) => <Skeleton key={item} className="aspect-[1.2] rounded-[1.35rem] bg-white/[0.05]" />)}
              </div>
            ) : competitionsError ? (
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[.03] p-8 text-center">
                <p className="text-sm text-white/65">We couldn&apos;t load the competition entries just now.</p>
                <button onClick={() => refetchCompetitions()} className="mt-4 rounded-full border border-white/20 px-5 py-2.5 text-xs uppercase tracking-widest text-white/75 hover:bg-white/10" data-testid="button-retry-competitions">Try again</button>
              </div>
            ) : competitions.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {competitions.map((competition, index) => (
                  <PublicCompetitionEntry
                    key={competition.id}
                    competition={competition}
                    video={mediaQueries[index]?.data?.videos?.[0]}
                    videoThumbnail={mediaQueries[index]?.data?.videoThumbnail}
                    contestantName={profileName}
                    contestantId={profile.id}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-[1.6rem] border border-white/[.1] bg-[radial-gradient(ellipse_at_90%_0%,rgba(230,116,62,.13),transparent_45%),#171719] px-6 py-12 text-center sm:px-12 sm:py-16">
                <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#f59a64]">The next stage is ahead</p>
                <h3 className="mt-3 font-display text-3xl text-white">No entries just yet.</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">Stay close. New competition appearances will show up here as they are approved.</p>
              </div>
            )}
          </section>

          {profile.imageUrls && profile.imageUrls.length > 0 && (
            <section className="pb-24 sm:pb-32" aria-labelledby="profile-gallery-heading">
              <SectionHeading eyebrow="Outside the frame" title="A closer look" index={`${String(profile.imageUrls.length).padStart(2, "0")} PHOTOS`} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
                {profile.imageUrls.map((url, index) => (
                  <figure key={`${url}-${index}`} className={`group relative overflow-hidden rounded-[1.1rem] border border-white/[.08] bg-[#242326] shadow-[0_20px_55px_rgba(0,0,0,.22)] ${index === 0 ? "col-span-2 row-span-2 aspect-[1.22] sm:aspect-auto" : "aspect-square"}`} data-testid={`img-profile-gallery-${index}`}>
                    <FallbackImage
                      src={url}
                      fallbackSrc={getBackupUrl(profile.imageUrls, profile.imageBackupUrls, index)}
                      alt={`${profileName} photo ${index + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      style={{ objectPosition: `${profile.imageCropPositions?.[index]?.x ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.x}% ${profile.imageCropPositions?.[index]?.y ?? DEFAULT_TALENT_IMAGE_CROP_POSITION.y}%` }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
                    <figcaption className="absolute bottom-3 left-3 font-mono text-[9px] uppercase tracking-[.18em] text-white/65 sm:bottom-4 sm:left-4">FRAME / {String(index + 1).padStart(2, "0")}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <section className="relative mb-24 overflow-hidden rounded-[1.75rem] border border-white/[.1] bg-[linear-gradient(120deg,#211c1b,#171719_55%,#201817)] px-6 py-9 sm:mb-32 sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-[#f08a51]/15" />
            <div className="pointer-events-none absolute -right-2 -top-12 h-48 w-48 rounded-full border border-[#f08a51]/10" />
            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[.23em] text-[#f59a64]">Keep following the work</p>
                <h2 className="mt-3 font-display text-3xl leading-tight text-white sm:text-4xl">The next performance could be their biggest yet.</h2>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <SocialLinks profile={profile} accentColor={accentColor} />
                <Link href={`/nominate?profileId=${encodeURIComponent(String(profile.id))}`} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#f47a3c] px-6 text-[10px] font-bold uppercase tracking-[.16em] text-[#171313] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" data-testid="link-nominate-profile-bottom">
                  Nominate {profileName || "this artist"}<ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          <div className="pb-16 text-center">
            <Link href="/competitions" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-[10px] font-semibold uppercase tracking-[.17em] text-white/55 transition-colors hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" data-testid="button-back">
              Discover all competitions<ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
