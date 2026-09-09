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
    <main className="min-h-screen bg-[#080006] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <CBLogo size="sm" showText />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">Event invitation</span>
        </header>

        <section className="relative mt-10 isolate overflow-hidden border border-white/10 bg-[#110008]">
          {(data.competition.coverImage || data.hostImageUrl) && (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-[-18px] z-0 scale-105 bg-cover bg-center opacity-40 blur-[12px]"
                style={{
                  backgroundImage: `url(${data.competition.coverImage || data.hostImageUrl})`,
                }}
              />
              <div aria-hidden="true" className="absolute inset-0 z-10 bg-[#080006]/65" />
              <div
                aria-hidden="true"
                className="absolute inset-0 z-10 bg-gradient-to-br from-[#18000e]/75 via-[#100008]/65 to-[#050005]/85"
              />
            </>
          )}
          <div className="relative z-20 px-6 py-10 sm:px-12 sm:py-14">
            {!data.competition.coverImage && !data.hostImageUrl && (
              <div className="mb-8">
                <CBLogo size="lg" showText />
              </div>
            )}
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