import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, Calendar, Users, MapPin, Mail, Phone, ExternalLink } from "lucide-react";
import { SiFacebook, SiInstagram, SiYoutube, SiTiktok } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { slugify } from "@shared/slugify";
import type { Competition } from "@shared/schema";

type CompetitionExt = Competition & { coverVideo?: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CATEGORIES = ["All", "Music", "Dance", "Modeling", "Bodybuilding", "Comedy", "Acting", "Other"];

export default function AboutPage() {
  const { getImage, getMedia, getText } = useLivery();
  const { data: competitions } = useQuery<CompetitionExt[]>({
    queryKey: ["/api/competitions"],
  });
  const [catFilter, setCatFilter] = useState("All");
  const [showDetails, setShowDetails] = useState(false);

  useSEO({
    title: "About The Quest",
    description: "Learn about The Quest - the ultimate talent competition and voting platform. See our rules, upcoming events calendar, and how to get started as a competitor or host.",
    canonical: "https://thequest-2dc77.firebaseapp.com/about",
  });

  const calendarComps = (competitions || [])
    .filter((c) => c.status !== "draft" && c.status !== "completed")
    .filter((c) => catFilter === "All" || c.category === catFilter)
    .sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const db = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return da - db;
    });

  const rulesText = getText("about_rules_text", "Welcome to The Quest! Our platform connects talent with audiences through fair, transparent competitions.\n\n**Rules & Guidelines:**\n\n1. All participants must be 18 years or older.\n2. Each competitor may only enter a competition once.\n3. Voting is limited per IP address daily to ensure fairness.\n4. Content must be original and appropriate for all audiences.\n5. Hosts are responsible for managing their events and enforcing rules.\n6. Vote purchases are non-refundable once processed.\n7. The Quest reserves the right to remove content that violates community standards.");

  const detailsText = getText("about_details_text", "");

  const socialFacebook = getText("social_facebook", "");
  const socialInstagram = getText("social_instagram", "");
  const socialTwitter = getText("social_twitter", "");
  const socialYoutube = getText("social_youtube", "");
  const socialTiktok = getText("social_tiktok", "");
  const contactEmail = getText("contact_email", "admin@thequest.com");
  const contactPhone = getText("contact_phone", "");
  const contactAddress = getText("contact_address", "");

  const socialLinks = [
    { url: socialFacebook, icon: SiFacebook, label: "Facebook" },
    { url: socialInstagram, icon: SiInstagram, label: "Instagram" },
    { url: socialTwitter, icon: FaXTwitter, label: "X" },
    { url: socialYoutube, icon: SiYoutube, label: "YouTube" },
    { url: socialTiktok, icon: SiTiktok, label: "TikTok" },
  ].filter((s) => s.url);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section className="relative h-[270px] md:h-[340px] overflow-hidden">
        {getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").type === "video" ? (
          <video src={getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${getImage("breadcrumb_bg", "/images/template/breadcumb.jpg")}')` }} />
        )}
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-10 pb-6 px-8 z-10 w-[calc(100%-60px)] max-w-[552px]">
          <p className="text-black/50 text-base leading-relaxed mb-1">
            <Link href="/" className="hover:text-[#FF5A09] transition-colors text-black/50" data-testid="link-breadcrumb-home">Home</Link>
            {" > "}About
          </p>
          <h2
            className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none"
            style={{ letterSpacing: "10px" }}
            data-testid="text-page-title"
          >
            About
          </h2>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3
          className="text-[#FF5A09] text-xs uppercase mb-4 font-bold"
          style={{ letterSpacing: "6px" }}
          data-testid="text-rules-heading"
        >
          Rules &amp; Guidelines
        </h3>
        <div className="prose prose-invert max-w-none" data-testid="text-rules-content">
          {rulesText.split("\n").map((line, i) => {
            if (!line.trim()) return <br key={i} />;
            const boldMatch = line.match(/^\*\*(.*)\*\*$/);
            if (boldMatch) return <h4 key={i} className="text-white text-lg font-bold mt-6 mb-3 uppercase" style={{ letterSpacing: "3px" }}>{boldMatch[1]}</h4>;
            return <p key={i} className="text-white/70 text-[15px] leading-relaxed mb-2">{line}</p>;
          })}
        </div>

        {detailsText && (
          <div className="mt-8" data-testid="details-section">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-2 text-[#FF5A09] text-sm uppercase font-bold tracking-widest transition-colors duration-300 hover:text-orange-300"
              data-testid="button-see-all-details"
            >
              {showDetails ? "Hide Details" : "See All Details"}
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showDetails ? "rotate-180" : ""}`} />
            </button>

            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${showDetails ? "max-h-[5000px] opacity-100 mt-6" : "max-h-0 opacity-0"}`}
              data-testid="details-content"
            >
              <div className="border-t border-white/10 pt-6">
                <div className="prose prose-invert max-w-none">
                  {detailsText.split("\n").map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    const boldMatch = line.match(/^\*\*(.*)\*\*$/);
                    if (boldMatch) return <h4 key={i} className="text-white text-lg font-bold mt-6 mb-3 uppercase" style={{ letterSpacing: "3px" }}>{boldMatch[1]}</h4>;
                    const listMatch = line.match(/^- (.*)$/);
                    if (listMatch) return <p key={i} className="text-white/70 text-[15px] leading-relaxed mb-1.5 pl-4 before:content-[''] relative"><span className="absolute left-0 text-[#FF5A09]">&bull;</span>{listMatch[1]}</p>;
                    return <p key={i} className="text-white/70 text-[15px] leading-relaxed mb-2">{line}</p>;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-[#0a0a0a] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h3
              className="text-[#FF5A09] text-xs uppercase mb-3 font-bold"
              style={{ letterSpacing: "6px" }}
            >
              Upcoming Events
            </h3>
            <h2
              className="text-[24px] md:text-[30px] uppercase text-white font-normal leading-none"
              style={{ letterSpacing: "10px" }}
              data-testid="text-calendar-title"
            >
              Competition Calendar
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`inline-block px-3 py-1.5 text-[13px] uppercase border-2 transition-all duration-300 ${catFilter === cat ? "border-[#FF5A09] text-[#FF5A09]" : "border-transparent bg-white/5 text-white/50 hover:border-white/30"}`}
                style={{ letterSpacing: "2px" }}
                data-testid={`filter-cat-${cat.toLowerCase()}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {calendarComps.length > 0 ? (
            <div className="space-y-3">
              {calendarComps.map((comp) => {
                const start = comp.startDate ? new Date(comp.startDate) : null;
                const end = comp.endDate ? new Date(comp.endDate) : null;
                return (
                  <Link
                    key={comp.id}
                    href={`/${slugify(comp.category)}/${slugify(comp.title)}`}
                    data-testid={`calendar-comp-${comp.id}`}
                  >
                    <div className="flex items-stretch bg-black border border-white/10 hover:border-[#FF5A09]/50 transition-all duration-300 cursor-pointer group">
                      <div className="flex-shrink-0 w-20 md:w-24 bg-[#FF5A09] flex flex-col items-center justify-center text-white py-4">
                        {start && !comp.startDateTbd ? (
                          <>
                            <span className="text-2xl md:text-3xl font-bold leading-none">{start.getDate()}</span>
                            <span className="text-xs uppercase tracking-wider mt-1">{MONTHS[start.getMonth()]}</span>
                          </>
                        ) : (
                          <span className="text-sm font-bold uppercase">TBD</span>
                        )}
                      </div>
                      <div className="flex-1 px-4 md:px-6 py-4 flex flex-col justify-center min-w-0">
                        <h4 className="text-white font-bold uppercase text-sm md:text-base truncate group-hover:text-[#FF5A09] transition-colors duration-300" data-testid={`calendar-title-${comp.id}`}>
                          {comp.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          <span className="text-white/50 text-xs inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {comp.category}
                          </span>
                          {end && !comp.endDateTbd && (
                            <span className="text-white/50 text-xs inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Ends {MONTHS[end.getMonth()]} {end.getDate()}, {end.getFullYear()}
                            </span>
                          )}
                          <span className={`text-xs uppercase tracking-wider px-2 py-0.5 ${comp.status === "active" || comp.status === "voting" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60"}`}>
                            {comp.status === "voting" ? "Active" : comp.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center pr-4">
                        <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-[#FF5A09] transition-colors duration-300" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-10 w-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No upcoming competitions in this category.</p>
            </div>
          )}
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <Link
              href="/competitions"
              className="inline-block bg-[#FF5A09] text-white font-bold text-sm uppercase px-8 leading-[47px] min-w-[212px] text-center border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer"
              style={{ letterSpacing: "3px" }}
              data-testid="cta-start-voting"
            >
              Start Voting <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
            </Link>
            <Link
              href="/nominate"
              className="inline-block bg-transparent text-white font-bold text-sm uppercase px-8 leading-[47px] min-w-[212px] text-center border border-white/30 transition-all duration-500 hover:bg-white hover:text-black hover:border-white cursor-pointer"
              style={{ letterSpacing: "3px" }}
              data-testid="cta-start-nominating"
            >
              Start Nominating <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0a0a0a] py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3
            className="text-[#FF5A09] text-xs uppercase mb-6 font-bold"
            style={{ letterSpacing: "6px" }}
          >
            Connect With Us
          </h3>

          {socialLinks.length > 0 && (
            <div className="flex items-center justify-center gap-5 mb-8" data-testid="social-links">
              {socialLinks.map(({ url, icon: Icon, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 flex items-center justify-center border border-white/20 text-white/60 hover:bg-[#FF5A09] hover:border-[#FF5A09] hover:text-white transition-all duration-300"
                  data-testid={`social-${label.toLowerCase()}`}
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-6 text-white/50 text-sm" data-testid="contact-info">
            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-2 hover:text-[#FF5A09] transition-colors duration-300" data-testid="contact-email">
                <Mail className="h-4 w-4" />
                {contactEmail}
              </a>
            )}
            {contactPhone && (
              <a href={`tel:${contactPhone}`} className="inline-flex items-center gap-2 hover:text-[#FF5A09] transition-colors duration-300" data-testid="contact-phone">
                <Phone className="h-4 w-4" />
                {contactPhone}
              </a>
            )}
            {contactAddress && (
              <span className="inline-flex items-center gap-2" data-testid="contact-address">
                <MapPin className="h-4 w-4" />
                {contactAddress}
              </span>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
