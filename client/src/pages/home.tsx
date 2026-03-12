import { useLivery } from "@/hooks/use-livery";
import { useState, useEffect } from "react";
import { Facebook, Twitter, Youtube, Instagram, Menu, X, ChevronRight, Trophy, Music, Star, Users, Mail, Phone, MapPin, Zap } from "lucide-react";
import MediaSlot from "@/components/media-slot";
import CBLogo from "@/components/cb-logo";

function darkenHex(hex: string, amount = 0.15): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = 1 - amount;
  return `#${Math.round(r * f).toString(16).padStart(2, "0")}${Math.round(g * f).toString(16).padStart(2, "0")}${Math.round(b * f).toString(16).padStart(2, "0")}`;
}
function hexAlpha(hex: string, opacity: number): string {
  const base = hex.startsWith("#") && hex.length === 7 ? hex : (hex.length === 6 ? `#${hex}` : hex.slice(0, 7));
  return base + Math.round(opacity * 255).toString(16).padStart(2, "0");
}

function HomeNavbar({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { getImage } = useLivery();

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-black/95 shadow-lg" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <a href="/" className="flex items-center gap-3">
            <CBLogo size="sm" />
          </a>

          <button
            className="md:hidden text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-white text-sm font-semibold uppercase tracking-wider hover:text-[var(--cbp-brand)] transition-colors">Home</a>
            <a href="#feature" className="text-white text-sm font-semibold uppercase tracking-wider hover:text-[var(--cbp-brand)] transition-colors">Features</a>
            <a href="#about" className="text-white text-sm font-semibold uppercase tracking-wider hover:text-[var(--cbp-brand)] transition-colors">About</a>
            <a href="#contact" className="text-white text-sm font-semibold uppercase tracking-wider hover:text-[var(--cbp-brand)] transition-colors">Contact</a>
          </nav>

          <a
            href="/thequest"
            className="hidden md:inline-flex items-center gap-2 bg-[var(--cbp-brand)] text-white font-bold text-sm uppercase tracking-wider px-5 py-2.5 rounded-full hover:bg-[var(--cbp-brand-dark)] transition-colors"
          >
            <Trophy className="w-4 h-4" />
            The Quest
          </a>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 px-4 py-4 space-y-1">
          {[["#home", "Home"], ["#feature", "Features"], ["#about", "About"], ["#contact", "Contact"]].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}
              className="block py-2 text-white font-semibold uppercase tracking-wider text-sm hover:text-[var(--cbp-brand)]">{label}</a>
          ))}
          <a href="/thequest" className="block py-2 text-[var(--cbp-brand)] font-bold uppercase tracking-wider text-sm">
            The Quest →
          </a>
        </div>
      )}
    </header>
  );
}

export default function HomePage() {
  const { getImage, getText } = useLivery();
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    document.title = getText("home_hero_title", "CB Publishing") + " — Entertainment. Competition. Community.";
    return () => { document.title = "The Quest - Talent Competition Platform"; };
  }, []);

  const heroTitle = getText("home_hero_title", "CB Publishing");
  const heroSubtitle = getText("home_hero_subtitle", "Entertainment. Competition. Community.");
  const quoteLeft = getText("home_quote_left", "Music gives soul to the universe, wings to the mind, flight to the imagination.");
  const quoteBody = getText("home_quote_body", "CB Publishing is a creative entertainment company focused on building platforms that connect artists, performers, and audiences. From competition platforms to music promotion, we're building the future of entertainment.");
  const aboutTitle = getText("home_about_title", "About CB Publishing");
  const aboutBody = getText("home_about_body", "CB Publishing is an independent entertainment and digital media company. We specialize in creating competition platforms, music promotion, and event management tools that empower artists and audiences alike.\n\nOur properties include The Quest — an online talent competition and voting platform — and more exciting projects in development.");

  const bannerBg = getImage("home_banner_bg", "/images/template/bg-1.jpg");
  const feat1 = getImage("home_feature_1", "/images/template/breadcumb.jpg");
  const feat2 = getImage("home_feature_2", "/images/template/breadcumb2.jpg");
  const feat3 = getImage("home_feature_3", "/images/template/breadcumb3.jpg");
  const feat4 = getImage("home_feature_4", "/images/template/bg-1.jpg");
  const feat5 = getImage("home_feature_5", "/images/template/bg-2.jpg");
  const aboutImg = getImage("home_about_img", "/images/template/bg-2.jpg");
  const serviceBg = getImage("home_service_bg", "/images/template/breadcumb.jpg");
  const memberBg = getImage("home_member_bg", "/images/template/bg-1.jpg");

  const feat1Title = getText("home_feature_1_title", "The Quest Finals");
  const feat1Sub = getText("home_feature_1_subtitle", "Live competition event");
  const feat2Title = getText("home_feature_2_title", "Music Showcase");
  const feat2Sub = getText("home_feature_2_subtitle", "Artists on stage");
  const feat3Title = getText("home_feature_3_title", "Talent Awards");
  const feat3Sub = getText("home_feature_3_subtitle", "Celebrating excellence");
  const feat4Title = getText("home_feature_4_title", "Be Unique");
  const feat4Sub = getText("home_feature_4_subtitle", "Express your talent");
  const feat5Title = getText("home_feature_5_title", "Rise to the Top");
  const feat5Sub = getText("home_feature_5_subtitle", "Compete and win");

  const socialFacebook = getText("social_facebook", "");
  const socialInstagram = getText("social_instagram", "");
  const socialTwitter = getText("social_twitter", "");
  const socialYoutube = getText("social_youtube", "");
  const brandColor = getText("home_brand_color", "#691cff");

  const FeatureCard = ({ url, title, subtitle, tall = false }: { url: string; title: string; subtitle: string; tall?: boolean }) => (
    <div className={`relative overflow-hidden group cursor-pointer ${tall ? "h-72 md:h-80" : "h-56 md:h-64"}`}>
      <MediaSlot
        url={url}
        alt={title}
        mode="bg"
        className="grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
      />
      <div className="absolute inset-0 cbp-feat-overlay opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-10">
        <div className="text-center text-white px-4">
          <h2 className="text-xl md:text-2xl font-bold uppercase mb-2">{title}</h2>
          <p className="text-sm text-white/80">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--cbp-brand", brandColor);
    root.style.setProperty("--cbp-brand-dark", darkenHex(brandColor));
    root.style.setProperty("--cbp-feat-overlay-bg", hexAlpha(brandColor, 0.7));
    return () => {
      root.style.removeProperty("--cbp-brand");
      root.style.removeProperty("--cbp-brand-dark");
      root.style.removeProperty("--cbp-feat-overlay-bg");
    };
  }, [brandColor]);

  return (
    <div className="bg-gray-950 text-gray-300 font-['Poppins',sans-serif] min-h-screen">
      <HomeNavbar scrolled={scrolled} />

      {/* Hero / Banner */}
      <section
        id="home"
        className="relative min-h-screen flex items-end justify-center overflow-hidden pb-32"
      >
        <MediaSlot url={bannerBg} alt="Hero background" mode="bg" clickToUnmute className="hero-media-shift-up" />
        <div className="absolute inset-0 bg-black/60 z-[1]" />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-wider mb-6 drop-shadow-2xl">
            {heroTitle.startsWith("CB") ? (
              <>
                <span style={{ background: "linear-gradient(180deg, #555 0%, #111 45%, #333 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.9)) drop-shadow(0 -1px 1px rgba(255,255,255,0.15))" }}>C</span>
                <span className="inline-flex items-center relative" style={{ background: "linear-gradient(180deg, #86efac 0%, #22c55e 40%, #15803d 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 2px 8px rgba(34,197,94,0.6)) drop-shadow(0 -1px 1px rgba(255,255,255,0.2))" }}>
                  <Zap className="absolute -left-3 md:-left-4 w-5 h-5 md:w-7 md:h-7 text-white fill-white" style={{ top: "50%", transform: "translateY(-50%)" }} />
                  B
                </span>
                <span className="text-white">{heroTitle.slice(2)}</span>
              </>
            ) : (
              <span className="text-white">{heroTitle}</span>
            )}
          </h1>
          <p className="text-lg md:text-xl uppercase tracking-[0.3em] text-white/70 mb-10">
            {(() => {
              const parts = heroSubtitle.split(/\s*[–—\-]+\s*/).filter(Boolean);
              return parts.length > 1
                ? parts.map((part, i) => (
                    <span key={i} className="block">{i > 0 ? `– ${part} –` : part}</span>
                  ))
                : heroSubtitle;
            })()}
          </p>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce z-10">
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex items-start justify-center pt-2">
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-20 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-right">
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-relaxed">
                {quoteLeft.split(",").map((part, i, arr) => (
                  <span key={i}>
                    {i === 0 ? <span className="text-[var(--cbp-brand)]">{part}</span> : part}
                    {i < arr.length - 1 ? "," : ""}
                    {i < arr.length - 1 ? <br /> : ""}
                  </span>
                ))}
              </h2>
            </div>
            <div>
              <p className="text-gray-400 leading-relaxed text-base">{quoteBody}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature / Media Grid */}
      <section id="feature" className="bg-black">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <FeatureCard url={feat1} title={feat1Title} subtitle={feat1Sub} tall />
          <FeatureCard url={feat2} title={feat2Title} subtitle={feat2Sub} tall />
          <FeatureCard url={feat3} title={feat3Title} subtitle={feat3Sub} tall />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <FeatureCard url={feat4} title={feat4Title} subtitle={feat4Sub} />
          <FeatureCard url={feat5} title={feat5Title} subtitle={feat5Sub} />
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="w-full h-80 md:h-96 overflow-hidden relative">
                <MediaSlot url={aboutImg} alt="About CB Publishing" mode="bg" />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[var(--cbp-brand)] hidden md:block" />
            </div>
            <div>
              <span className="text-[var(--cbp-brand)] text-sm font-bold uppercase tracking-widest mb-3 block">Who We Are</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{aboutTitle}</h2>
              {aboutBody.split("\n\n").map((para, i) => {
                const underlinePhrases = ["Exclusive Empire Records distribution", "Exclusive Empire Records distrobution", "The Quest"];
                const regex = new RegExp(`(${underlinePhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
                const parts = para.split(regex);
                return (
                  <p key={i} className="text-gray-400 mb-4 leading-relaxed">
                    {parts.map((part, j) =>
                      underlinePhrases.includes(part)
                        ? (
                          part === "The Quest"
                            ? <a key={j} href="/thequest" className="underline decoration-1 underline-offset-2 hover:text-white transition-colors">{part}</a>
                            : <a key={j} href="https://www.empi.re/" target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2 hover:text-white transition-colors">{part}</a>
                          )
                        : part
                    )}
                  </p>
                );
              })}
              <a
                href="/thequest"
                className="inline-flex items-center gap-2 border border-[var(--cbp-brand)] text-[var(--cbp-brand)] font-bold text-sm uppercase tracking-wider px-6 py-2.5 rounded-full hover:bg-[var(--cbp-brand)] hover:text-white transition-colors mt-4"
              >
                Explore The Quest <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Our Properties / Services */}
      <section className="py-20 relative overflow-hidden">
        <MediaSlot url={serviceBg} alt="Services background" mode="bg" />
        <div className="absolute inset-0 bg-black/80 z-[1]" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-[var(--cbp-brand)] text-sm font-bold uppercase tracking-widest mb-3 block">What We Build</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Our Properties</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <a href="/thequest" className="group block bg-white/5 border border-white/10 p-8 hover:bg-[var(--cbp-brand)]/20 hover:border-[var(--cbp-brand)]/50 transition-all duration-300">
              <Trophy className="w-10 h-10 text-[var(--cbp-brand)] mb-5" />
              <h3 className="text-xl font-bold text-white mb-3">The Quest</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Online talent competition and voting platform. Music, modeling, bodybuilding, dance — compete for public votes and win.</p>
              <span className="inline-flex items-center gap-1 text-[var(--cbp-brand)] text-sm font-bold mt-5 group-hover:gap-2 transition-all">Enter <ChevronRight className="w-4 h-4" /></span>
            </a>
            <div className="bg-white/5 border border-white/10 p-8">
              <Music className="w-10 h-10 text-[var(--cbp-brand)] mb-5" />
              <h3 className="text-xl font-bold text-white mb-3">Music Promotion</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Artist discovery and promotion services. Get your music in front of audiences that matter.</p>
              <a href="#contact" className="inline-flex items-center gap-1 text-[var(--cbp-brand)] text-sm font-bold mt-5 hover:gap-2 transition-all">Request Brand Development Meeting <ChevronRight className="w-4 h-4" /></a>
            </div>
            <div className="bg-white/5 border border-white/10 p-8 flex flex-col">
              <Star className="w-10 h-10 text-[var(--cbp-brand)] mb-5" />
              <h3 className="text-xl font-bold text-white mb-3">Events</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Live event management, production, and promotion for entertainment brands and independent artists.</p>
              <div className="mt-5 flex flex-col gap-3">
                <a href="/thequest/host" className="inline-flex items-center gap-1 text-[var(--cbp-brand)] text-sm font-bold hover:gap-2 transition-all">
                  Start a virtual competition today <ChevronRight className="w-4 h-4" />
                </a>
                <a href="#contact" className="inline-flex items-center gap-1 text-gray-400 text-sm font-semibold hover:text-white transition-colors">
                  Request an Event Quote <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Members / Join CTA */}
      <section className="py-20 relative overflow-hidden">
        <MediaSlot url={memberBg} alt="Join background" mode="bg" />
        <div className="absolute inset-0 bg-black/75 z-[1]" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-[var(--cbp-brand)] text-sm font-bold uppercase tracking-widest mb-3 block">Join Us</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to Compete?</h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The Quest is open to all talent. Apply as a competitor, rally votes from your fans, and win. No gatekeepers — just the public vote.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/thequest/nominate" className="inline-flex items-center gap-2 bg-[var(--cbp-brand)] text-white font-bold text-sm uppercase tracking-wider px-8 py-3 rounded-full hover:bg-[var(--cbp-brand-dark)] transition-colors">
              <Users className="w-4 h-4" />
              Nominate Someone
            </a>
            <a href="/thequest/competitions" className="inline-flex items-center gap-2 border border-white/30 text-white font-bold text-sm uppercase tracking-wider px-8 py-3 rounded-full hover:border-[var(--cbp-brand)] hover:text-[var(--cbp-brand)] transition-colors">
              Browse Competitions
            </a>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-[var(--cbp-brand)] text-sm font-bold uppercase tracking-widest mb-3 block">Get In Touch</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Contact Us</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Mail className="w-5 h-5 text-[var(--cbp-brand)] mt-1 shrink-0" />
                <div>
                  <h4 className="text-white font-semibold mb-1">Email</h4>
                  <span className="text-gray-400 text-sm select-all">
                    {getText("contact_email", "admin@thequest.com")}
                  </span>
                </div>
              </div>
              {getText("contact_phone", "") && (
                <div className="flex items-start gap-4">
                  <Phone className="w-5 h-5 text-[var(--cbp-brand)] mt-1 shrink-0" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Phone</h4>
                    <p className="text-gray-400 text-sm">{getText("contact_phone", "")}</p>
                  </div>
                </div>
              )}
              {getText("contact_address", "") && (
                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-[var(--cbp-brand)] mt-1 shrink-0" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Address</h4>
                    <p className="text-gray-400 text-sm">{getText("contact_address", "")}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 pt-4">
                {socialFacebook && <a href={socialFacebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 hover:bg-[var(--cbp-brand)] flex items-center justify-center text-white transition-colors"><Facebook className="w-4 h-4" /></a>}
                {socialTwitter && <a href={socialTwitter} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 hover:bg-[var(--cbp-brand)] flex items-center justify-center text-white transition-colors"><Twitter className="w-4 h-4" /></a>}
                {socialInstagram && <a href={socialInstagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 hover:bg-[var(--cbp-brand)] flex items-center justify-center text-white transition-colors"><Instagram className="w-4 h-4" /></a>}
                {socialYoutube && <a href={socialYoutube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 hover:bg-[var(--cbp-brand)] flex items-center justify-center text-white transition-colors"><Youtube className="w-4 h-4" /></a>}
              </div>
            </div>
            <form onSubmit={async (e) => {
                e.preventDefault();
                if (!formData.name || !formData.email || !formData.message) return;
                setFormStatus("sending");
                try {
                  const res = await fetch("/api/home/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
                  if (res.ok) { setFormStatus("sent"); setFormData({ name: "", email: "", phone: "", message: "" }); }
                  else setFormStatus("error");
                } catch { setFormStatus("error"); }
              }} className="space-y-4">
              <input
                type="text"
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[var(--cbp-brand)] transition-colors"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[var(--cbp-brand)] transition-colors"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[var(--cbp-brand)] transition-colors"
              />
              <textarea
                placeholder="Message"
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[var(--cbp-brand)] transition-colors resize-none"
              />
              {formStatus === "sent" && <p className="text-green-400 text-sm font-semibold">Message sent! We'll be in touch soon.</p>}
              {formStatus === "error" && <p className="text-red-400 text-sm">Something went wrong. Please try again or email us directly.</p>}
              {formStatus !== "sent" && (
                <button
                  type="submit"
                  disabled={formStatus === "sending"}
                  className="inline-flex items-center gap-2 bg-[var(--cbp-brand)] text-white font-bold text-sm uppercase tracking-wider px-8 py-3 rounded-full hover:bg-[var(--cbp-brand-dark)] transition-colors disabled:opacity-60"
                >
                  {formStatus === "sending" ? "Sending..." : <> Send Message <ChevronRight className="w-4 h-4" /> </>}
                </button>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} CB Publishing. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="/thequest" className="text-gray-500 hover:text-[var(--cbp-brand)] text-sm transition-colors">The Quest</a>
              <a href="/thequest/about" className="text-gray-500 hover:text-white text-sm transition-colors">About</a>
              <a href="#contact" className="text-gray-500 hover:text-white text-sm transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-700">
              Designed by:{" "}
              <a href="https://oraginalconcepts.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">
                Oraginal Concepts
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
