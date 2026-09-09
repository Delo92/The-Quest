import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import CBLogo from "@/components/cb-logo";
import { useSEO } from "@/hooks/use-seo";
import { slugify } from "@shared/slugify";

interface ReferralLandingResponse {
  referralCode: string;
  hostName: string;
  hostImageUrl?: string | null;
  hostBio?: string | null;
  competition: {
    id: number;
    title: string;
    category: string;
    description?: string | null;
    coverImage?: string | null;
  };
}

export default function ReferralLandingPage() {
  const search = useSearch();
  const referralCode = new URLSearchParams(search).get("ref")?.trim().toUpperCase() || "";
  const { data, isLoading, isError } = useQuery<ReferralLandingResponse>({
    queryKey: ["/api/referral", referralCode, "landing"],
    enabled: Boolean(referralCode),
    staleTime: 5 * 60_000,
  });

  useSEO({
    title: data ? `${data.competition.title} — ${data.hostName}` : "Competition Invitation",
    description: data?.competition.description || (data ? `Join ${data.competition.title}, hosted by ${data.hostName}.` : "Competition invitation"),
    canonical: data ? `${window.location.origin}/thequest/${slugify(data.competition.category)}/${slugify(data.competition.title)}` : undefined,
    ogImage: data?.competition.coverImage || data?.hostImageUrl || undefined,
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080006] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#FF0E9B]" aria-label="Loading invitation" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080006] px-6 text-center text-white">
        <div>
          <CBLogo size="sm" showText />
          <h1 className="mt-8 text-2xl font-semibold">This invitation is no longer available</h1>
          <p className="mt-2 text-sm text-white/50">The referral link may be invalid or the event may have been removed.</p>
        </div>
      </main>
    );
  }

  const competitionPath = `/thequest/${slugify(data.competition.category)}/${slugify(data.competition.title)}`;
  const nominatePath = `/thequest/nominate?competition=${data.competition.id}&ref=${encodeURIComponent(data.referralCode)}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080006] text-white">
      {(data.competition.coverImage || data.hostImageUrl) && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-[-32px] z-0 scale-105 bg-cover bg-center opacity-35 blur-[18px]"
            style={{
              backgroundImage: `url(${data.competition.coverImage || data.hostImageUrl})`,
            }}
          />
          <div aria-hidden="true" className="absolute inset-0 z-10 bg-[#080006]/72" />
          <div
            aria-hidden="true"
            className="absolute inset-0 z-10 bg-gradient-to-b from-[#080006]/80 via-[#100008]/70 to-[#080006]/92"
          />
        </>
      )}
      <div className="relative z-20 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <CBLogo size="sm" showText />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">Event invitation</span>
        </header>

        <section className="mt-10 overflow-hidden border border-white/10 bg-black">
          <div className="relative aspect-[4/3] w-full bg-black sm:aspect-[16/9]">
            {data.competition.coverImage ? (
              <img src={data.competition.coverImage} alt={`${data.competition.title} cover`} className="h-full w-full object-contain" />
            ) : data.hostImageUrl ? (
              <img src={data.hostImageUrl} alt={`${data.hostName} profile`} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <CBLogo size="lg" showText />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
          <div className="border-t border-white/10 bg-[#110008] px-6 py-8 sm:px-12 sm:py-10">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#FFB3D9]">
              <Sparkles className="h-4 w-4 text-[#FF0E9B]" />
              {data.competition.category} event
            </p>
            <h1 className="font-serif text-4xl font-bold leading-tight sm:text-6xl">{data.competition.title}</h1>
            <p className="mt-5 text-sm uppercase tracking-[0.18em] text-white/55">Hosted by {data.hostName}</p>
            {data.competition.description && (
              <p className="mt-6 max-w-3xl text-base leading-7 text-white/70">{data.competition.description}</p>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Your invitation is connected to</p>
            <p className="mt-2 font-mono text-sm text-[#FFB3D9]">{data.referralCode}</p>
            <p className="mt-2 text-sm text-white/50">Nominations and votes from this invitation are attributed to {data.hostName}.</p>
          </div>
          <div className="flex flex-col gap-3 sm:min-w-[220px]">
            <Link href={nominatePath} className="inline-flex items-center justify-center gap-2 bg-[#FFB3D9] px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-white">
              Nominate someone <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={competitionPath} className="inline-flex items-center justify-center gap-2 border border-[#FF0E9B]/60 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#FFB3D9] transition hover:bg-[#FF0E9B]/15">
              View event <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}