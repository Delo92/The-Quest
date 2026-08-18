import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Copy, CheckCheck, Tag, Trophy, ArrowLeft } from "lucide-react";
import NotFound from "@/pages/not-found";

export default function CodeLandingPage() {
  const params = useParams<{ slug: string }>();
  const slug = (params?.slug || "").toUpperCase().trim();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<{
    found: boolean;
    code?: string;
    ownerName?: string;
    sourcePlatform?: string;
    status?: string;
  }>({
    queryKey: ["/api/code-registry/lookup", slug],
    queryFn: () => fetch(`/api/code-registry/lookup/${encodeURIComponent(slug)}`).then((r) => r.json()),
    enabled: !!slug,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FF5A09] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.found || data.status === "inactive") {
    return <NotFound />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(data.code || slug).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-lg w-full">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FF5A09]/10 border border-[#FF5A09]/30 mb-5" style={{ borderRadius: 0 }}>
            <Tag size={28} className="text-[#FF5A09]" />
          </div>
          <h1
            className="text-3xl uppercase text-white font-normal mb-2"
            style={{ letterSpacing: "8px" }}
          >
            You've Got a Code!
          </h1>
          <p className="text-white/40 text-sm">
            {data.ownerName ? `Referred by ${data.ownerName}` : "Referral & promo code"}
            {data.sourcePlatform ? ` · via ${data.sourcePlatform}` : ""}
          </p>
        </div>

        <div className="border border-white/10 p-6 mb-6 text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Your Code</p>
          <div className="flex items-center justify-center gap-4">
            <span
              className="text-4xl font-black text-white tracking-widest font-mono"
              data-testid="text-promo-code"
            >
              {data.code || slug}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-[#FF5A09]/10 hover:bg-[#FF5A09]/20 border border-[#FF5A09]/40 text-[#FF5A09] px-3 py-2 text-sm font-semibold transition-all"
              data-testid="button-copy-code"
            >
              {copied ? (
                <><CheckCheck size={15} /> Copied!</>
              ) : (
                <><Copy size={15} /> Copy</>
              )}
            </button>
          </div>
          <p className="text-white/30 text-xs mt-4">
            Save this code — enter it at checkout when you're ready to vote
          </p>
        </div>

        <div className="border border-white/10 p-5 mb-6 space-y-3">
          <p className="text-white/60 text-sm leading-relaxed">
            This code is registered with{" "}
            <strong className="text-white">Chronic Brands USA</strong> and is
            valid for purchases and services across the CB network. Use it at
            checkout to credit your referral source.
          </p>
          <p className="text-white/40 text-sm">
            Browse our active competitions below, then enter{" "}
            <strong className="text-[#FF5A09]">{data.code || slug}</strong> when
            you're ready to buy votes.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/competitions">
            <span
              className="flex items-center justify-center gap-2 bg-[#FF5A09] hover:bg-transparent text-white hover:text-[#FF5A09] font-bold uppercase px-6 py-4 border border-[#FF5A09] text-sm transition-all duration-500 cursor-pointer"
              style={{ letterSpacing: "4px" }}
              data-testid="button-explore"
            >
              <Trophy size={18} />
              View Competitions
            </span>
          </Link>
          <Link href="/">
            <span
              className="flex items-center justify-center gap-2 text-white/40 hover:text-white/70 font-medium px-6 py-3 text-sm transition-all border border-white/10 hover:border-white/20 cursor-pointer"
              data-testid="link-back-home"
            >
              <ArrowLeft size={15} />
              Back to Home
            </span>
          </Link>
        </div>

      </div>
    </div>
  );
}
