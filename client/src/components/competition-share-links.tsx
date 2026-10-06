import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { slugify } from "@shared/slugify";

interface CompetitionShareLinksProps {
  competition: {
    id: number;
    title: string;
    category: string;
  };
  compact?: boolean;
}

export function getCompetitionShareLinks(competition: CompetitionShareLinksProps["competition"], referralCode?: string | null) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const competitionUrl = `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`;
  const promoCode = referralCode || competition.title.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const nominationUrl = `${origin}/?ref=${encodeURIComponent(promoCode)}`;

  return { competitionUrl, nominationUrl, promoCode };
}

export default function CompetitionShareLinks({ competition, compact = false }: CompetitionShareLinksProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const { data: shareData } = useQuery<{ referralCode: string | null; referralOwnerName: string | null }>({
    queryKey: ["/api/competitions", competition.id, "share-links"],
    staleTime: 5 * 60_000,
  });
  const links = getCompetitionShareLinks(competition, shareData?.referralCode);

  const copyLink = async (key: "competitionUrl" | "nominationUrl", label: string) => {
    try {
      await navigator.clipboard.writeText(links[key]);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Could not copy link", description: "Select the link and copy it manually.", variant: "destructive" });
    }
  };

  return (
    <section
      className={compact
        ? "border-t border-white/20 bg-black/30 p-3"
        : "border border-white/20 bg-black/40 p-4 sm:p-5"}
      data-testid={`competition-share-links-${competition.id}`}
    >
      <div className="mb-3 flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF0E9B]" />
        <div>
          <h3 className="text-sm font-semibold text-white/90">Share this competition</h3>
          {!compact && <p className="mt-1 text-sm leading-relaxed text-white/75">Use the public page for viewers, or the host nomination link to track nominations and votes.</p>}
        </div>
      </div>

      <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
        <ShareLinkRow
          label="Competition page"
          value={links.competitionUrl}
          onCopy={() => copyLink("competitionUrl", "Competition link")}
          copied={copied === "competitionUrl"}
          compact={compact}
        />
        <ShareLinkRow
          label={`Host link · ${links.promoCode}`}
          value={links.nominationUrl}
          onCopy={() => copyLink("nominationUrl", "Nomination link")}
          copied={copied === "nominationUrl"}
          compact={compact}
        />
      </div>
    </section>
  );
}

function ShareLinkRow({
  label,
  value,
  onCopy,
  copied,
  compact,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  compact: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">{label}</p>
      <div className="flex min-w-0 items-center gap-2 border border-white/10 bg-white/[0.04] px-2.5 py-2">
        <span className={`min-w-0 flex-1 truncate font-mono text-white/80 ${compact ? "text-xs" : "text-sm"}`} title={value}>
          {value}
        </span>
        <a href={value} target="_blank" rel="noreferrer" className="flex h-11 w-11 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={`Open ${label}`}>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button type="button" onClick={onCopy} className="flex h-11 w-11 shrink-0 items-center justify-center text-[#FFB3D9] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={`Copy ${label}`} data-testid={`copy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}