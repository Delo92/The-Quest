import { useState } from "react";
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

export function getCompetitionShareLinks(competition: CompetitionShareLinksProps["competition"]) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const competitionUrl = `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`;
  const promoCode = competition.title.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const nominationUrl = `${origin}/?ref=${encodeURIComponent(promoCode)}`;

  return { competitionUrl, nominationUrl, promoCode };
}

export default function CompetitionShareLinks({ competition, compact = false }: CompetitionShareLinksProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const links = getCompetitionShareLinks(competition);

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
        ? "border-t border-white/10 bg-black/20 p-3"
        : "border border-white/10 bg-black/25 p-4 sm:p-5"}
      data-testid={`competition-share-links-${competition.id}`}
    >
      <div className="mb-3 flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF0E9B]" />
        <div>
          <h3 className="text-sm font-semibold text-white/90">Share this competition</h3>
          {!compact && <p className="mt-1 text-xs text-white/45">Use the public page for viewers, or the nomination link to track your promotion code.</p>}
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
          label={`Nomination link · ${links.promoCode}`}
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
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <div className="flex min-w-0 items-center gap-2 border border-white/10 bg-white/[0.04] px-2.5 py-2">
        <span className={`min-w-0 flex-1 truncate font-mono text-white/60 ${compact ? "text-[10px]" : "text-xs"}`} title={value}>
          {value}
        </span>
        <a href={value} target="_blank" rel="noreferrer" className="shrink-0 text-white/35 hover:text-white" aria-label={`Open ${label}`}>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button type="button" onClick={onCopy} className="shrink-0 text-[#FFB3D9] hover:text-white" aria-label={`Copy ${label}`} data-testid={`copy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}