import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import CBLogo from "@/components/cb-logo";
import { useSEO } from "@/hooks/use-seo";
import { slugify, competitionSlug } from "@shared/slugify";

interface ReferralLandingResponse {
  referralCode: string;
  hostName: string;
  hostImageUrl?: string | null;
  hostBio?: string | null;
  isGlobal?: boolean;
  competition: {
    id: number;
    title: string;
    slug?: string | null;
    category: string;
    description?: string | null;
    coverImage?: string | null;
  } | null;
}

export default function ReferralLandingPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const referralCode = new URLSearchParams(search).get("ref")?.trim().toUpperCase() || "";
  const { data, isLoading, isError } = useQuery<ReferralLandingResponse>({
    queryKey: ["/api/referral", referralCode, "landing"],
    enabled: Boolean(referralCode),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const referralQuery = `?ref=${encodeURIComponent(data.referralCode)}`;
    if (data.competition) {
      setLocation(
        `/thequest/${slugify(data.competition.category)}/${competitionSlug(data.competition)}${referralQuery}`,
      );
      return;
    }
    if (data.isGlobal || !data.competition) setLocation(`/thequest${referralQuery}`);
  }, [data, setLocation]);

  useSEO({
    title: data?.competition ? data.competition.title : "The Quest — Talent Competition & Voting Platform",
    description: data?.competition?.description || (data?.competition ? `Join ${data.competition.title} on The Quest.` : "Browse competitions, nominate talent, and vote on The Quest."),
    canonical: data?.competition ? `${window.location.origin}/thequest/${slugify(data.competition.category)}/${competitionSlug(data.competition)}` : `${window.location.origin}/thequest`,
    ogImage: data?.competition?.coverImage || undefined,
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080006] text-white">
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-[#FF0E9B]" />
        <span className="text-sm text-white/70">
          {data.competition ? `Opening ${data.competition.title}…` : "Opening The Quest…"}
        </span>
      </div>
    </main>
  );
}