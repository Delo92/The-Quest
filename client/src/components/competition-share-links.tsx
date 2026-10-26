import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { slugify } from "@shared/slugify";
import { getCompetitionVideoEmbedCode } from "@shared/video-share";

interface CompetitionShareLinksProps {
  competition: {
    id: number;
    title: string;
    category: string;
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
  const { data: shareData, isLoading: shareDataLoading, isError: shareDataError } = useQuery<{
    referralCode: string | null;
    referralOwnerName: string | null;
    videoPlayerUrl: string | null;
    videoWidth: number | null;
    videoHeight: number | null;
  }>({
    queryKey: ["/api/competitions", competition.id, "share-links"],
    staleTime: 60_000,
  });
  const links = getCompetitionShareLinks(competition, shareData?.referralCode);
  const videoEmbedCode = shareData?.videoPlayerUrl
    ? getCompetitionVideoEmbedCode(
        competition.title,
        shareData.videoPlayerUrl,
        shareData.videoWidth || 640,
        shareData.videoHeight || 360,
      )
    : null;

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
          {!compact && <p className="mt-1 text-sm leading-relaxed text-white/75">Share the public page, copy a playable video link, or embed the video on a website. Messaging apps may still show a thumbnail for page links.</p>}
        </div>
      </div>

      <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
        <ShareLinkRow
          label="Competition page"
          value={links.competitionUrl}
          onCopy={() => copyValue("competitionUrl", links.competitionUrl, "Competition link")}
          copied={copied === "competitionUrl"}
          compact={compact}
        />
        <ShareLinkRow
          label={`Host link · ${links.promoCode}`}
          value={links.nominationUrl}
          onCopy={() => copyValue("nominationUrl", links.nominationUrl, "Nomination link")}
          copied={copied === "nominationUrl"}
          compact={compact}
        />
        {shareData?.videoPlayerUrl && (
          <ShareLinkRow
            label="Playable video link"
            value={shareData.videoPlayerUrl}
            openUrl={shareData.videoPlayerUrl}
            onCopy={() => copyValue("videoPlayerUrl", shareData.videoPlayerUrl!, "Video link")}
            copied={copied === "videoPlayerUrl"}
            compact={compact}
          />
        )}
        {videoEmbedCode && (
          <ShareLinkRow
            label="Website embed code"
            value={videoEmbedCode}
            isCode
            onCopy={() => copyValue("videoEmbedCode", videoEmbedCode, "Embed code")}
            copied={copied === "videoEmbedCode"}
            compact={compact}
          />
        )}
      </div>
      {!shareData?.videoPlayerUrl && !shareDataLoading && !shareDataError && (
        <p className="mt-3 text-xs leading-relaxed text-white/65">
          No playable competition video is available to embed. Add a cover or promo video to this competition first.
        </p>
      )}
      {!shareData?.videoPlayerUrl && shareDataError && (
        <p role="status" className="mt-3 text-xs leading-relaxed text-amber-200/80">
          Video sharing details could not be loaded. Try again shortly.
        </p>
      )}
    </section>
  );
}

function ShareLinkRow({
  label,
  value,
  openUrl,
  isCode = false,
  onCopy,
  copied,
  compact,
}: {
  label: string;
  value: string;
  openUrl?: string;
  isCode?: boolean;
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
        {openUrl && !isCode && (
          <a href={openUrl} target="_blank" rel="noreferrer" className="flex h-11 w-11 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={`Open ${label}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button type="button" onClick={onCopy} className="flex h-11 w-11 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={`Copy ${label}`} data-testid={`copy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}