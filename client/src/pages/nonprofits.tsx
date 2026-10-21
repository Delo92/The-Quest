import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  ExternalLink,
  HeartHandshake,
  Mail,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link } from "wouter";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { nonprofitLogoMediaKey } from "@shared/nonprofit-page";
import itStopsNowLogo from "@assets/image_1792613288554.png";
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

const featuredPrograms = [
  {
    name: "It Stops Now Foundation",
    url: "https://www.facebook.com/itstopsnowfoundation",
    note: "Featured program organization",
    imageKey: nonprofitLogoMediaKey("It Stops Now Foundation"),
    imageSrc: itStopsNowLogo,
  },
  {
    name: "Event Pro Group Foundation",
    url: "https://eventprogroupusa.com/Foundation",
    note: "Featured program organization",
    imageKey: nonprofitLogoMediaKey("Event Pro Group Foundation"),
    imageSrc: null,
  },
];

const steps = [
  {
    number: "01",
    title: "Choose an organization",
    copy: "Contestants and hosts choose an eligible nonprofit for their own contribution.",
  },
  {
    number: "02",
    title: "Set a rate",
    copy: "They select 1–10% of their eligible earnings. If they leave the rate unset, it defaults to 10%.",
  },
  {
    number: "03",
    title: "A match may follow",
    copy: "The Quest can match the participant’s actual recorded amount, when its available share allows.",
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
  const isDirectVideo = item.mediaType === "video" && /\.(mp4|webm|mov)(?:$|[?#])/i.test(item.mediaUrl);

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
  const { getText, items } = useLivery();
  const rosterQuery = useQuery<PublicNonprofit[]>({ queryKey: ["/api/nonprofits/public"] });
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

  return (
    <div className="quest-np-page min-h-screen" data-testid="page-nonprofits">
      <SiteNavbar forceDark />
      <main className="pt-[108px]">
        <section className="quest-np-hero relative overflow-hidden" aria-labelledby="np-hero-title">
          <div className="quest-np-hero-orbit quest-np-orbit-one" aria-hidden="true" />
          <div className="quest-np-hero-orbit quest-np-orbit-two" aria-hidden="true" />
          <div className="quest-np-hero-grain" aria-hidden="true" />
          <div className="quest-np-hero-inner">
            <Reveal className="quest-np-hero-copy">
              <SectionLabel>{liveryText("eyebrow", "A different kind of spotlight")}</SectionLabel>
              <h1 id="np-hero-title">{liveryText("hero_title", "When talent rises, its impact can travel further.")}</h1>
              <p>{liveryText("hero_copy", "The Quest connects entertainment with participant-led nonprofit support. Contestants and hosts can contribute a share of their own eligible earnings to an organization they choose. The Quest may match that actual amount when its available share allows.")}</p>
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
              <div className="quest-np-art-caption">
                <span>CHOICE → CONTRIBUTION → POSSIBILITY</span>
                <span className="quest-np-art-mark">TQ / 01</span>
              </div>
              <div className="quest-np-art-core">
                <div className="quest-np-art-ring ring-a" />
                <div className="quest-np-art-ring ring-b" />
                <div className="quest-np-art-ring ring-c" />
                <div className="quest-np-art-sun" />
                <div className="quest-np-art-line line-a" />
                <div className="quest-np-art-line line-b" />
                <div className="quest-np-art-dot dot-a" />
                <div className="quest-np-art-dot dot-b" />
                <span className="quest-np-art-word">A share<br />of the stage</span>
              </div>
              <div className="quest-np-art-bottom">
                <span>PARTICIPANT-LED GIVING</span>
                <span>NO GUARANTEED MATCH</span>
              </div>
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
              <p>{liveryText("flow_copy", "This program is separate from donations made to The Quest to receive votes or register. A participant names their organization, chooses a rate, and contributes from their eligible earnings.")}</p>
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
                <h3>{liveryText("example_title", "What a match could look like")}</h3>
              </div>
              <CircleDollarSign className="quest-np-example-icon" aria-hidden="true" />
            </div>
            <div className="quest-np-equation" aria-label="One thousand dollars eligible earnings, ten percent participant rate, one hundred dollars participant contribution, possible one hundred dollar Quest match, up to two hundred dollars combined">
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
                <span>Possible Quest match</span>
                <strong>up to $100</strong>
              </div>
              <span className="quest-np-equation-sign" aria-hidden="true">=</span>
              <div className="quest-np-equation-item quest-np-equation-total">
                <span>Combined in this example</span>
                <strong>up to $200</strong>
              </div>
            </div>
            <p className="quest-np-example-note">
              {liveryText("example_note", "The rate may be 1–10%; 10% applies only when the participant leaves the rate unset. A match is not guaranteed and depends on The Quest’s available share. Contributions are recorded through payout operations; The Quest does not automatically send funds to nonprofits.")}
            </p>
          </Reveal>
        </section>

        <section className="quest-np-roster" aria-labelledby="np-roster-title">
          <div className="section-shell quest-np-roster-inner">
            <Reveal className="quest-np-roster-heading">
              <div>
                <SectionLabel>{liveryText("roster_eyebrow", "A community of choice")}</SectionLabel>
                <h2 id="np-roster-title">{liveryText("roster_title", "Organizations participants have named.")}</h2>
              </div>
              <p>{liveryText("roster_copy", "These are organization names entered by contestants and hosts. Their appearance here is not a verification, endorsement, eligibility determination, or promise of donations.")}</p>
            </Reveal>
            {rosterQuery.isLoading ? (
              <div className="quest-np-roster-list" aria-label="Loading organizations">
                {[0, 1, 2].map((n) => <div className="quest-np-roster-skeleton" key={n} />)}
              </div>
            ) : rosterQuery.isError ? (
              <div className="quest-np-state" role="alert">
                <div><strong>Organizations could not be loaded.</strong><span>Please try again in a moment.</span></div>
                <button type="button" onClick={() => void rosterQuery.refetch()} className="quest-np-retry" data-testid="button-retry-nonprofit-roster">
                  <RefreshCw size={15} /> Retry
                </button>
              </div>
            ) : organizations.length === 0 ? (
              <div className="quest-np-state quest-np-state-empty">
                <UsersRound aria-hidden="true" />
                <div><strong>No participant-entered organizations to show yet.</strong><span>{liveryText("roster_empty", "When contestants or hosts enter an organization, it will appear here.")}</span></div>
              </div>
            ) : (
              <div className="quest-np-roster-list" data-testid="list-nonprofit-roster">
                {organizations.map((org, index) => {
                  const logoItem = items?.find((item) => item.imageKey === org.logoKey);
                  const localLogo = org.name.trim().toLocaleLowerCase() === "it stops now foundation" ? itStopsNowLogo : "";
                  const logo = logoItem?.imageUrl || localLogo || logoItem?.defaultUrl || "";
                  const website = org.website && /^https?:\/\//i.test(org.website) ? org.website : null;
                  return (
                    <Reveal key={`${org.name}-${index}`} delay={Math.min(index * 0.045, 0.27)}>
                      <div className="quest-np-roster-row" data-testid={`nonprofit-roster-${index}`}>
                        <span className="quest-np-roster-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="quest-np-roster-logo">
                          {logo ? <img src={logo} alt="" loading="lazy" /> : <HeartHandshake aria-hidden="true" />}
                        </span>
                        <span className="quest-np-roster-name">{org.name}</span>
                        {website ? (
                          <a href={website} target="_blank" rel="noopener noreferrer" className="quest-np-roster-link" aria-label={`Visit ${org.name} website`}>
                            Website <ArrowUpRight size={15} aria-hidden="true" />
                          </a>
                        ) : <span className="quest-np-roster-no-link">Participant-entered</span>}
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="quest-np-featured section-shell" aria-labelledby="np-featured-title">
          <Reveal className="quest-np-featured-intro">
            <SectionLabel>{liveryText("featured_eyebrow", "Featured program organizations")}</SectionLabel>
            <h2 id="np-featured-title">{liveryText("featured_title", "Two organizations connected to the program.")}</h2>
            <p>{liveryText("featured_copy", "These links share organizations featured in the program. They are not automatically selected payout recipients; each participant makes their own choice.")}</p>
          </Reveal>
          <div className="quest-np-featured-list">
            {featuredPrograms.map((org, index) => {
              const logoItem = items?.find((item) => item.imageKey === org.imageKey);
              const logo = logoItem?.imageUrl || org.imageSrc || logoItem?.defaultUrl || "";
              return (
                <Reveal key={org.name} delay={index * 0.12}>
                  <a href={org.url} target="_blank" rel="noopener noreferrer" className={`quest-np-featured-row featured-${index + 1}`}>
                    <span className="quest-np-featured-number">0{index + 1}</span>
                    <span className="quest-np-featured-logo">
                      {logo ? <img src={logo} alt="" loading="lazy" /> : <HeartHandshake aria-hidden="true" />}
                    </span>
                    <span className="quest-np-featured-text">
                      <small>{org.note}</small>
                      <strong>{org.name}</strong>
                    </span>
                    <span className="quest-np-featured-arrow"><ExternalLink size={18} aria-hidden="true" /></span>
                  </a>
                </Reveal>
              );
            })}
          </div>
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
                      <div className="quest-np-gallery-frame">
                        <GalleryMedia item={item} />
                        {item.mediaType === "video" && <span className="quest-np-media-tag"><Play size={12} fill="currentColor" /> VIDEO</span>}
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
              <p>{liveryText("clarity_copy", "People donate to The Quest to receive votes; registration is also a donation. Those donations are received by The Quest and are not sent directly to a nonprofit at checkout. Nonprofit support is separate: contestants and hosts may contribute a share of their own eligible earnings to an organization they choose.")}</p>
            </div>
          </Reveal>
          <Reveal className="quest-np-truth-aside" delay={0.12}>
            <span>01 / TRANSPARENCY</span>
            <p>{liveryText("clarity_aside", "Contribution amounts and any Quest match are recorded through payout operations. The Quest does not automatically transfer funds to nonprofits.")}</p>
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
      <SiteFooter />
    </div>
  );
}
