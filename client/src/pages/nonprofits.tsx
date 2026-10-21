import type { ReactNode } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  CircleDollarSign,
  Maximize2,
  HeartHandshake,
  Mail,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import NonprofitDirectoryWheel, { type NonprofitDirectoryEntry } from "@/components/nonprofit-directory-wheel";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { nonprofitLogoMediaKey } from "@shared/nonprofit-page";
import itStopsNowLogo from "@assets/image_1792613288554.png";
import eventProFoundationLogo from "@assets/image_1792615336461.png";
import "./nonprofits.css";

type PublicNonprofit = {
  name: string;
  website: string | null;
  logoKey: string;
};

type GalleryItem = {
  id: string;
  title: string;
  caption: string | null;
  organizationName: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  embedUrl: string | null;
  createdAt: string;
};

function isDirectVideoMedia(item: GalleryItem): boolean {
  return item.mediaType === "video" && /\.(mp4|webm|mov)(?:$|[?#])/i.test(item.mediaUrl);
}

const featuredPrograms = [
  {
    name: "It Stops Now Foundation",
    url: "https://www.facebook.com/itstopsnowfoundation",
    imageKey: nonprofitLogoMediaKey("It Stops Now Foundation"),
    imageSrc: itStopsNowLogo,
  },
  {
    name: "Event Pro Group Foundation",
    url: "https://eventprogroupusa.com/Foundation",
    imageKey: nonprofitLogoMediaKey("Event Pro Group Foundation"),
    imageSrc: eventProFoundationLogo,
  },
];

const steps = [
  {
    number: "01",
    title: "Choose an organization",
    copy: "Contestants and hosts must choose an eligible nonprofit for their required contribution.",
  },
  {
    number: "02",
    title: "Set a rate",
    copy: "The required contribution is 1–10% of eligible earnings. If no rate is set, the 10% default applies.",
  },
  {
    number: "03",
    title: "Dollar-for-dollar match",
    copy: "The Quest matches each participant’s actual recorded contribution dollar-for-dollar.",
  },
];

function safeVideoEmbed(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
      const match = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]+)/);
      return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
    }
    if (host === "vimeo.com" || host === "www.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "player.vimeo.com" && /^\/video\/\d+/.test(url.pathname)) return url.href;
  } catch {
    return null;
  }
  return null;
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.14 }}
      transition={{ duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="quest-np-label">
      <span aria-hidden="true" />
      {children}
    </p>
  );
}

function GalleryMedia({ item }: { item: GalleryItem }) {
  const embed = item.mediaType === "video" ? safeVideoEmbed(item.embedUrl) : null;
  const isDirectVideo = isDirectVideoMedia(item);

  if (embed) {
    return (
      <iframe
        src={embed}
        title={item.title}
        className="quest-np-gallery-media"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  if (isDirectVideo) {
    return (
      <video className="quest-np-gallery-media" controls preload="metadata" playsInline aria-label={item.title}>
        <source src={item.mediaUrl} />
        Your browser does not support embedded video.
      </video>
    );
  }
  if (item.mediaType === "image") {
    return <img className="quest-np-gallery-media" src={item.mediaUrl} alt={item.title} loading="lazy" />;
  }
  return (
    <div className="quest-np-video-unavailable" role="status">
      <Play aria-hidden="true" />
      <span>Video preview unavailable</span>
    </div>
  );
}

export default function NonprofitsPage() {
  const { getText, items } = useLivery({ refetchInterval: 65_000 });
  const [expandedGalleryItem, setExpandedGalleryItem] = useState<GalleryItem | null>(null);
  const rosterQuery = useQuery<PublicNonprofit[]>({
    queryKey: ["/api/nonprofits/public"],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const galleryQuery = useQuery<GalleryItem[]>({ queryKey: ["/api/nonprofits/gallery"] });
  const contactEmail = getText("contact_email", "admin@thequest.com") || "admin@thequest.com";
  const liveryText = (key: string, fallback: string) => getText(`nonprofits_${key}`, fallback) || fallback;
  const inquiryHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Nonprofit program inquiry")}&body=${encodeURIComponent("Hello The Quest,\\n\\nOur organization would like to ask about being considered for the nonprofit program.\\n\\nOrganization name:\\nWebsite:\\nContact name:\\nMission:")}`;

  useSEO({
    title: "Nonprofit Program | The Quest",
    description: "See how The Quest nonprofit program works, explore organizations chosen by participants, and view community media.",
    canonical: "/NonProfits",
  });

  const organizations = rosterQuery.data ?? [];
  const galleryItems = galleryQuery.data ?? [];
  const featuredNames = new Set(featuredPrograms.map((org) => org.name.trim().toLocaleLowerCase()));
  const directoryOrganizations: NonprofitDirectoryEntry[] = [
    ...featuredPrograms.map((org) => {
      const logoItem = items?.find((item) => item.imageKey === org.imageKey);
      return {
        id: `featured-${org.imageKey}`,
        name: org.name,
        website: org.url,
        logoUrl: logoItem?.imageUrl || org.imageSrc || logoItem?.defaultUrl || null,
        source: "featured" as const,
      };
    }),
    ...organizations
      .filter((org) => !featuredNames.has(org.name.trim().toLocaleLowerCase()))
      .map((org) => {
        const logoItem = items?.find((item) => item.imageKey === org.logoKey);
        return {
          id: `participant-${org.logoKey}`,
          name: org.name,
          website: org.website,
          logoUrl: logoItem?.imageUrl || logoItem?.defaultUrl || null,
          source: "participant" as const,
        };
      }),
  ];

  return (
    <div className="quest-np-page min-h-screen" data-testid="page-nonprofits">
      <SiteNavbar forceDark />
      <main className="pt-[108px]">
        <section className="quest-np-hero relative overflow-hidden" aria-labelledby="np-hero-title">
          <div className="quest-np-hero-grain" aria-hidden="true" />
          <div className="quest-np-hero-inner">
            <Reveal className="quest-np-hero-copy">
              <SectionLabel>{liveryText("eyebrow", "A different kind of spotlight")}</SectionLabel>
              <h1 id="np-hero-title">{liveryText("hero_title", "When talent rises, its impact can travel further.")}</h1>
              <p>{liveryText("hero_copy", "The Quest connects entertainment with participant-led nonprofit support. Contestants and hosts are required to contribute a share of their own eligible earnings to an organization they choose. The Quest will match that actual amount dollar-for-dollar.")}</p>
              <div className="quest-np-hero-actions">
                <a className="quest-np-pill quest-np-pill-accent" href="#how-it-works">
                  See how it works <ArrowDown size={16} aria-hidden="true" />
                </a>
                <a className="quest-np-pill quest-np-pill-quiet" href="#community">
                  Community gallery <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
              <p className="quest-np-hero-footnote">
                <ShieldCheck size={15} aria-hidden="true" />
                The participant—not a voter—chooses the organization and rate.
              </p>
            </Reveal>
            <Reveal className="quest-np-hero-art" delay={0.16}>
              <div className="quest-np-directory-heading">
                <div>
                  <SectionLabel>Organizations to explore</SectionLabel>
                  <p>Featured and participant-entered nonprofits</p>
                </div>
                <span>THE QUEST / DIRECTORY</span>
              </div>
              <NonprofitDirectoryWheel organizations={directoryOrganizations} />
              {rosterQuery.isError && (
                <div className="quest-np-directory-error" role="alert">
                  <span>Participant organizations could not be loaded.</span>
                  <button type="button" onClick={() => void rosterQuery.refetch()} data-testid="button-retry-nonprofit-roster">
                    <RefreshCw size={13} aria-hidden="true" /> Retry
                  </button>
                </div>
              )}
              <p className="quest-np-directory-disclaimer">
                {liveryText("roster_copy", "Participant-entered listings are self-reported, not verified or endorsed, and are not a promise of donations.")} Featured links are informational, not automatic payout recipients.
              </p>
            </Reveal>
          </div>
          <div className="quest-np-hero-bottom">
            <span>THE QUEST / NONPROFIT PROGRAM</span>
            <span>01 — 04</span>
          </div>
        </section>

        <section className="quest-np-flow section-shell" id="how-it-works" aria-labelledby="np-flow-title">
          <div className="quest-np-flow-intro">
            <Reveal>
              <SectionLabel>{liveryText("flow_eyebrow", "A clear, participant-led flow")}</SectionLabel>
              <h2 id="np-flow-title">{liveryText("flow_title", "Giving begins with the person on stage.")}</h2>
              <p>{liveryText("flow_copy", "Contestants and hosts are required to contribute from their eligible earnings to the nonprofit they choose. This program is separate from donations made to The Quest to receive votes or register.")}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="quest-np-flow-steps">
                {steps.map((step, index) => (
                  <div className="quest-np-step" key={step.number}>
                    <span className="quest-np-step-number">{step.number}</span>
                    <div>
                      <h3>{liveryText(`step_${index + 1}_title`, step.title)}</h3>
                      <p>{liveryText(`step_${index + 1}_copy`, step.copy)}</p>
                    </div>
                    {index < steps.length - 1 && <span className="quest-np-step-rule" aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal className="quest-np-example">
            <div className="quest-np-example-top">
              <div>
                <SectionLabel>{liveryText("example_eyebrow", "A simple example")}</SectionLabel>
                <h3>{liveryText("example_title", "How the dollar-for-dollar match works")}</h3>
              </div>
              <CircleDollarSign className="quest-np-example-icon" aria-hidden="true" />
            </div>
            <div className="quest-np-equation" aria-label="One thousand dollars eligible earnings, ten percent participant rate, one hundred dollars participant contribution, one hundred dollar Quest match, two hundred dollars combined">
              <div className="quest-np-equation-item">
                <span>Eligible earnings</span>
                <strong>$1,000</strong>
              </div>
              <span className="quest-np-equation-sign" aria-hidden="true">×</span>
              <div className="quest-np-equation-item">
                <span>Participant rate</span>
                <strong>10%</strong>
              </div>
              <span className="quest-np-equation-sign" aria-hidden="true">=</span>
              <div className="quest-np-equation-item quest-np-equation-highlight">
                <span>Participant amount</span>
                <strong>$100</strong>
              </div>
              <span className="quest-np-equation-plus" aria-hidden="true">+</span>
              <div className="quest-np-equation-item quest-np-equation-match">
                <span>Quest match</span>
                <strong>$100</strong>
              </div>
              <span className="quest-np-equation-sign" aria-hidden="true">=</span>
              <div className="quest-np-equation-item quest-np-equation-total">
                <span>Combined in this example</span>
                <strong>$200</strong>
              </div>
            </div>
            <p className="quest-np-example-note">
              {liveryText("example_note", "The required contribution rate is 1–10% of eligible earnings; the 10% default applies when no rate is set. The Quest matches each participant’s actual contribution dollar-for-dollar. Contributions are recorded through payout operations; The Quest does not automatically send funds to nonprofits.")}
            </p>
          </Reveal>
        </section>

        <section className="quest-np-gallery" id="community" aria-labelledby="np-gallery-title">
          <div className="section-shell">
            <Reveal className="quest-np-gallery-heading">
              <div>
                <SectionLabel>{liveryText("gallery_eyebrow", "From the community")}</SectionLabel>
                <h2 id="np-gallery-title">{liveryText("gallery_title", "Real moments. Shared with care.")}</h2>
              </div>
              <p>{liveryText("gallery_copy", "Media shared by The Quest community. Each image or video is shown as supplied by the program team.")}</p>
            </Reveal>
            {galleryQuery.isLoading ? (
              <div className="quest-np-gallery-grid" aria-label="Loading community gallery">
                {[0, 1, 2].map((n) => <div className="quest-np-gallery-skeleton" key={n} />)}
              </div>
            ) : galleryQuery.isError ? (
              <div className="quest-np-state quest-np-gallery-state" role="alert">
                <div><strong>The community gallery is unavailable right now.</strong><span>We couldn’t load its media. Please try again.</span></div>
                <button type="button" onClick={() => void galleryQuery.refetch()} className="quest-np-retry" data-testid="button-retry-nonprofit-gallery">
                  <RefreshCw size={15} /> Retry
                </button>
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="quest-np-state quest-np-gallery-state quest-np-state-empty">
                <Sparkles aria-hidden="true" />
                <div><strong>Nothing in the gallery just yet.</strong><span>{liveryText("gallery_empty", "Community media will appear here when it has been shared.")}</span></div>
              </div>
            ) : (
              <div className="quest-np-gallery-grid" data-testid="grid-nonprofit-gallery">
                {galleryItems.map((item, index) => (
                  <Reveal className={`quest-np-gallery-item gallery-item-${index % 3}`} key={item.id} delay={(index % 3) * 0.08}>
                    <figure>
                      <div className={isDirectVideoMedia(item)
                        ? "quest-np-gallery-frame quest-np-gallery-frame--video"
                        : "quest-np-gallery-frame"}>
                        <GalleryMedia item={item} />
                        {item.mediaType === "video" && <span className="quest-np-media-tag"><Play size={12} fill="currentColor" /> VIDEO</span>}
                        <button
                          type="button"
                          className="quest-np-gallery-expand"
                          onClick={() => setExpandedGalleryItem(item)}
                          aria-label={`Expand ${item.title}`}
                          title={`Expand ${item.title}`}
                          data-testid={`button-expand-gallery-${item.id}`}
                        >
                          <Maximize2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <figcaption>
                        <div>
                          {item.organizationName && <span className="quest-np-gallery-org">{item.organizationName}</span>}
                          <h3>{item.title}</h3>
                          {item.caption && <p>{item.caption}</p>}
                        </div>
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="quest-np-truth section-shell" aria-labelledby="np-truth-title">
          <Reveal className="quest-np-truth-main">
            <div className="quest-np-truth-icon"><CircleDollarSign aria-hidden="true" /></div>
            <div>
              <SectionLabel>{liveryText("clarity_eyebrow", "The important distinction")}</SectionLabel>
              <h2 id="np-truth-title">{liveryText("clarity_title", "A donation for votes is not a donation to a nonprofit.")}</h2>
              <p>{liveryText("clarity_copy", "People donate to The Quest to receive votes; registration is also a donation. Those donations are received by The Quest and are not sent directly to a nonprofit at checkout. Separately, contestants and hosts are required to contribute a share of their own eligible earnings to an organization they choose.")}</p>
            </div>
          </Reveal>
          <Reveal className="quest-np-truth-aside" delay={0.12}>
            <span>01 / TRANSPARENCY</span>
            <p>{liveryText("clarity_aside", "Contribution amounts and the corresponding dollar-for-dollar Quest match are recorded through payout operations. The Quest does not automatically transfer funds to nonprofits.")}</p>
            <Link href="/competitions" className="quest-np-text-link" data-testid="link-nonprofits-competitions">
              Explore competitions <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Reveal>
        </section>

        <section className="quest-np-inquiry">
          <div className="quest-np-inquiry-orbit" aria-hidden="true" />
          <Reveal className="quest-np-inquiry-inner">
            <div>
              <SectionLabel>{liveryText("inquiry_eyebrow", "For nonprofit organizations")}</SectionLabel>
              <h2>{liveryText("inquiry_title", "A mission worth knowing about?")}</h2>
              <p>{liveryText("inquiry_copy", "Eligible organizations may contact The Quest to share their mission and ask to be considered. An inquiry is not a registration, selection, eligibility decision, or promise of donations.")}</p>
            </div>
            <a href={inquiryHref} className="quest-np-pill quest-np-pill-light" data-testid="button-nonprofit-inquiry">
              <Mail size={16} aria-hidden="true" /> Contact The Quest <ArrowRight size={16} aria-hidden="true" />
            </a>
          </Reveal>
          <div className="quest-np-inquiry-bottom"><span>GOOD WORK, SEEN.</span><span>THE QUEST / NONPROFITS</span></div>
        </section>
      </main>
      <Dialog
        open={expandedGalleryItem !== null}
        onOpenChange={(open) => {
          if (!open) setExpandedGalleryItem(null);
        }}
      >
        <DialogContent className="quest-np-gallery-dialog">
          {expandedGalleryItem && (
            <>
              <div className="quest-np-gallery-dialog-heading">
                <DialogTitle className="quest-np-gallery-dialog-title">{expandedGalleryItem.title}</DialogTitle>
                {expandedGalleryItem.caption && (
                  <DialogDescription className="quest-np-gallery-dialog-description">
                    {expandedGalleryItem.caption}
                  </DialogDescription>
                )}
              </div>
              <div className={`quest-np-gallery-expanded ${
                isDirectVideoMedia(expandedGalleryItem)
                  ? "quest-np-gallery-expanded--video"
                  : expandedGalleryItem.mediaType === "image"
                    ? "quest-np-gallery-expanded--image"
                    : "quest-np-gallery-expanded--embed"
              }`}>
                <GalleryMedia item={expandedGalleryItem} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <SiteFooter />
    </div>
  );
}
