import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { slugify } from "@shared/slugify";

interface CompetitionShareLinksProps {
  competition: {
    id: number;
    title: string;
    category: string;
    coverVideo?: string | null;
    promoVideos?: string[] | null;
    themeColor?: string | null;
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
  const { data: shareData } = useQuery<{
    referralCode: string | null;
    referralOwnerName: string | null;
  }>({
    queryKey: ["/api/competitions", competition.id, "share-links"],
    staleTime: 5 * 60_000,
  });
  const links = getCompetitionShareLinks(competition, shareData?.referralCode);
  const hasCompetitionVideo = Boolean(competition.coverVideo || competition.promoVideos?.length);
  const competitionLinkLabel = hasCompetitionVideo
    ? "Competition page + promo video"
    : "Competition page";

  const copyValue = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Could not copy", description: "Select the content and copy it manually.", variant: "destructive" });
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
        <Link2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: competition.themeColor || "#FF5A09" }} />
        <div>
          <h3 className="text-sm font-semibold text-white/90">Share this competition</h3>
          {!compact && <p className="mt-1 text-sm leading-relaxed text-white/75">Use the public competition link to share its page and video, or the host link to track referrals.</p>}
        </div>
      </div>

      <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
        <ShareLinkRow
          label={competitionLinkLabel}
          value={links.competitionUrl}
          description={hasCompetitionVideo
            ? "Public page link with this competition’s promo video and share preview data."
            : "Public page link for this competition."}
          onCopy={() => copyValue("competitionUrl", links.competitionUrl, "Competition link")}
          copied={copied === "competitionUrl"}
          compact={compact}
        />
        <ShareLinkRow
          label={`Host referral link · ${links.promoCode}`}
          value={links.nominationUrl}
          description="Tracks nominations and votes from this host link."
          onCopy={() => copyValue("nominationUrl", links.nominationUrl, "Host referral link")}
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
  description,
  onCopy,
  copied,
  compact,
}: {
  label: string;
  value: string;
  description: string;
  onCopy: () => void;
  copied: boolean;
  compact: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">{label}</p>
      <p className="mb-2 text-xs leading-relaxed text-white/60">{description}</p>
      <div className="flex min-w-0 items-center gap-2 border border-white/10 bg-white/[0.04] px-2.5 py-2">
        <span className={`min-w-0 flex-1 truncate font-mono text-white/80 ${compact ? "text-xs" : "text-sm"}`} title={value}>
          {value}
        </span>
        <button type="button" onClick={onCopy} className="flex h-11 w-11 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={`Copy ${label}`} data-testid={`copy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}