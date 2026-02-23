import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronRight, Info, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import HeroCoverflowGallery from "@/components/hero-coverflow-gallery";
import FlipCountdown from "@/components/flip-countdown";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

export default function Landing() {
  useSEO({
    title: "HiFitComp - Talent Competition & Voting Platform",
    description: "The ultimate talent competition platform. Browse competitions, vote for your favorite artists, models, bodybuilders, and performers. Join as a competitor or nominate someone today.",
    canonical: "https://hifitcomp.com",
  });
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const { items, isLoading: liveryLoading, getImage, getMedia, getText } = useLivery();
  const { data: dynamicCategories } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const getCategoryMedia = (cat: any): { url: string; type: "image" | "video" } => {
    if (cat.videoUrl) return { url: cat.videoUrl, type: "video" };
    if (cat.imageUrl) return { url: cat.imageUrl, type: "image" };
    return { url: getImage("competition_card_fallback", "/images/template/e1.jpg"), type: "image" };
  };

  const fallbackCategories = [
    { id: "fb-music", name: "Music", description: "Singers, rappers, DJs & producers", imageUrl: "/images/template/a1.jpg", isActive: true },
    { id: "fb-modeling", name: "Modeling", description: "Fashion, fitness & swimwear models", imageUrl: "/images/template/a2.jpg", isActive: true },
    { id: "fb-bodybuilding", name: "Bodybuilding", description: "Physique, classic & open divisions", imageUrl: "/images/template/b1.jpg", isActive: true },
    { id: "fb-dance", name: "Dance", description: "Hip-hop, contemporary & freestyle", imageUrl: "/images/template/a4.jpg", isActive: true },
  ];

  const activeCategories = (dynamicCategories && dynamicCategories.length > 0)
    ? dynamicCategories.filter((c: any) => c.isActive)
    : fallbackCategories;

  const cats = useInView();
  const featured = useInView();
  const steps = useInView();
  const cta = useInView();

  const [showVotingModal, setShowVotingModal] = useState(false);
  const [showNominationModal, setShowNominationModal] = useState(false);

  const renderInfoText = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      const boldMatch = line.match(/^\*\*(.*)\*\*:?$/);
      if (boldMatch) return <h4 key={i} className="text-white text-base font-bold mt-5 mb-2 uppercase" style={{ letterSpacing: "2px" }}>{boldMatch[1]}</h4>;
      const listMatch = line.match(/^- (.*)$/);
      if (listMatch) return <p key={i} className="text-white/70 text-sm leading-relaxed mb-1.5 pl-4 relative"><span className="absolute left-0 text-[#FF5A09]">&bull;</span>{listMatch[1]}</p>;
      const numMatch = line.match(/^(\d+)\. (.*)$/);
      if (numMatch) return <p key={i} className="text-white/70 text-sm leading-relaxed mb-1.5 pl-6 relative"><span className="absolute left-0 text-[#FF5A09] font-bold">{numMatch[1]}.</span>{numMatch[2]}</p>;
      return <p key={i} className="text-white/70 text-sm leading-relaxed mb-2">{line}</p>;
    });
  };

  return (
    <div className={`min-h-screen bg-black text-white overflow-x-hidden transition-opacity duration-500 ${liveryLoading ? "opacity-0" : "opacity-100"}`}>
      <SiteNavbar />

      <section ref={heroRef} className="relative min-h-screen flex items-start justify-center pb-16" style={{ overflow: "visible" }}>
        <motion.div style={{ y: heroY }} className="absolute inset-0 overflow-hidden">
          {getMedia("hero_background", "/images/template/bg-1.jpg").type === "video" ? (
            <video src={getMedia("hero_background", "/images/template/bg-1.jpg").url} className="w-full h-full object-cover scale-110" autoPlay muted loop playsInline />
          ) : (
            <img src={getImage("hero_background", "/images/template/bg-1.jpg")} alt="" className="w-full h-full object-cover scale-110" />
          )}
          <div className="absolute inset-0 bg-black/35" />
        </motion.div>

        <div className="relative z-10 text-center px-4 sm:px-8 w-full pt-64 sm:pt-68">
          {getText("hero_title_top", "") && (
          <motion.h6
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-white text-sm sm:text-lg uppercase mb-5 block tracking-[8px] sm:tracking-[20px]"
          >
            {getText("hero_title_top", "")}
          </motion.h6>
          )}

          {getText("hero_title_main", "Talent Platform") && (
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative text-xl sm:text-2xl md:text-3xl lg:text-4xl text-white font-normal capitalize inline-block tracking-[3px] sm:tracking-[8px] md:tracking-[12px]"
          >
            <span
              className="absolute top-0 left-0 w-full h-full"
              style={{
                color: "rgba(255, 255, 255, 0.15)",
                animation: "textsonar 6s linear infinite",
              }}
            >
              {getText("hero_title_main", "Talent Platform")}
            </span>
            {getText("hero_title_main", "Talent Platform")}
          </motion.h2>
          )}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="mt-8 sm:mt-10 w-full max-w-5xl mx-auto"
          >
            <HeroCoverflowGallery />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <div className="flex flex-col items-center">
              <Link href="/competitions">
                <span
                  className="inline-block bg-[#FF5A09] border border-[#FF5A09] text-white font-bold text-sm sm:text-base capitalize px-6 sm:px-8 leading-[42px] sm:leading-[47px] w-full sm:w-auto sm:min-w-[212px] text-center transition-all duration-500 hover:bg-transparent hover:text-white cursor-pointer"
                  data-testid="button-hero-start-voting"
                >
                  Start Voting <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
                </span>
              </Link>
              <button
                onClick={() => setShowVotingModal(true)}
                className="inline-flex items-center gap-1.5 text-white/90 text-xs uppercase tracking-widest transition-colors duration-300 hover:text-[#FF5A09] mt-3"
                data-testid="button-hero-how-voting"
              >
                <Info className="h-3.5 w-3.5" />
                How Voting Works
              </button>
            </div>
            <div className="flex flex-col items-center">
              <Link href="/nominate">
                <span
                  className="inline-block bg-transparent border border-white text-white font-bold text-sm sm:text-base capitalize px-6 sm:px-8 leading-[42px] sm:leading-[47px] w-full sm:w-auto sm:min-w-[212px] text-center transition-all duration-500 hover:bg-white hover:text-black cursor-pointer"
                  data-testid="button-hero-join-nominate"
                >
                  Nominate <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
                </span>
              </Link>
              <button
                onClick={() => setShowNominationModal(true)}
                className="inline-flex items-center gap-1.5 text-white/90 text-xs uppercase tracking-widest transition-colors duration-300 hover:text-[#FF5A09] mt-3"
                data-testid="button-hero-how-nominations"
              >
                <Info className="h-3.5 w-3.5" />
                How Nominations Work
              </button>
            </div>
          </motion.div>

          {getText("hero_summary") && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.7 }}
              className="mt-10 max-w-3xl mx-auto text-white/70 text-sm sm:text-base md:text-lg leading-relaxed px-2 sm:px-0"
              style={{ letterSpacing: "1px" }}
              data-testid="text-hero-summary"
            >
              {getText("hero_summary")}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2.0 }}
            className="mt-12 sm:mt-16"
          >
            <FlipCountdown
              targetDate={new Date("2026-06-13T23:59:59")}
              title="Voting Closes In"
            />
          </motion.div>
        </div>
      </section>

      <section className="py-24 md:py-28 bg-black" id="categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={cats.ref} className={`text-center mb-24 transition-all duration-1000 ${cats.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-[#5f5f5f] text-sm mb-1">See what&apos;s new</p>
            <h2 className="text-lg uppercase text-white font-normal tracking-[5px] sm:tracking-[10px]">
              Competition Categories
            </h2>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${(activeCategories.length) <= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-6`}>
            {activeCategories.map((cat: any, i: number) => {
              const media = getCategoryMedia(cat);
              return (
              <Link href="/competitions" key={cat.id}>
                <div
                  className={`group cursor-pointer transition-all duration-500 ${cats.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                  data-testid={`card-category-${cat.name.toLowerCase()}`}
                >
                  <div className="overflow-hidden">
                    {media.type === "video" ? (
                      <video src={media.url} className="w-full aspect-square object-cover transition-transform duration-700 group-hover:scale-110" autoPlay muted loop playsInline />
                    ) : (
                      <img src={media.url} alt={cat.name} className="w-full aspect-square object-cover transition-transform duration-700 group-hover:scale-110" />
                    )}
                  </div>
                  <div className="bg-black group-hover:bg-[#f5f9fa] text-center py-6 px-4 transition-all duration-500">
                    <h4 className="text-white group-hover:text-black uppercase text-base font-bold mb-2 transition-colors duration-500">
                      {cat.name}
                    </h4>
                    <p className="text-white/50 group-hover:text-black/50 text-sm mb-4 transition-colors duration-500">
                      {cat.description}
                    </p>
                    <span
                      className="text-[11px] text-white group-hover:text-black uppercase border-b border-white group-hover:border-black pb-1 transition-colors duration-500"
                      style={{ letterSpacing: "10px" }}
                    >
                      See More
                    </span>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative py-24 md:py-28 overflow-hidden">
        {getMedia("feature_background", "/images/template/bg-2.jpg").type === "video" ? (
          <video src={getMedia("feature_background", "/images/template/bg-2.jpg").url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <div className="absolute inset-0 bg-cover bg-center bg-fixed" style={{ backgroundImage: `url('${getImage("feature_background", "/images/template/bg-2.jpg")}')` }} />
        )}
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={featured.ref} className={`text-center mb-24 transition-all duration-1000 ${featured.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-[#5f5f5f] text-sm mb-1">{getText("why_subtitle", "See what's new")}</p>
            <h2 className="text-lg uppercase text-white font-normal tracking-[5px] sm:tracking-[10px]">
              {getText("why_heading", "Why HiFitComp")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { title: getText("why_card1_title", "Any Competition"), desc: getText("why_card1_desc", "Music, modeling, bodybuilding, dance, art -- create or join competitions in any talent category imaginable.") },
              { title: getText("why_card2_title", "Public Voting"), desc: getText("why_card2_desc", "Fair, transparent voting. The public decides who wins with configurable vote limits and pricing per competition.") },
              { title: getText("why_card3_title", "Rich Profiles"), desc: getText("why_card3_desc", "Upload photos, videos, share your bio and social links. Build a stunning profile that shows the world your talent.") },
            ].map((item, i) => (
              <div
                key={i}
                className={`text-center transition-all duration-700 ${featured.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <h4 className="text-white uppercase text-base font-bold mb-4" style={{ letterSpacing: "3px" }}>
                  {item.title}
                </h4>
                <p className="text-white/60 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 md:py-28 bg-black" id="how-it-works">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={steps.ref} className={`text-center mb-24 transition-all duration-1000 ${steps.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-[#5f5f5f] text-sm mb-1">See what&apos;s new</p>
            <h2 className="text-lg uppercase text-white font-normal tracking-[5px] sm:tracking-[10px]">
              {getText("hiw_section_title", "How It Works")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { step: "01", title: getText("hiw_step1_title", "Create Your Profile"), desc: getText("hiw_step1_desc", "Sign up, set up your talent profile with photos, videos, and bio. Make it stand out.") },
              { step: "02", title: getText("hiw_step2_title", "Apply to Compete"), desc: getText("hiw_step2_desc", "Browse active competitions and apply to the ones that match your talent and goals.") },
              { step: "03", title: getText("hiw_step3_title", "Win Public Votes"), desc: getText("hiw_step3_desc", "Once approved, share your profile. The contestant with the most votes wins the crown.") },
            ].map((s, i) => (
              <div
                key={s.step}
                className={`text-center transition-all duration-700 ${steps.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div
                  className="text-5xl font-light text-white/20 mb-6"
                  style={{ letterSpacing: "5px" }}
                >
                  {s.step}
                </div>
                <h4 className="text-white/40 uppercase text-base font-bold mb-4" style={{ letterSpacing: "3px" }}>
                  {s.title}
                </h4>
                <p className="text-white leading-relaxed text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 md:py-28 overflow-hidden">
        {getMedia("cta_background", "/images/template/breadcumb.jpg").type === "video" ? (
          <video src={getMedia("cta_background", "/images/template/breadcumb.jpg").url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <div className="absolute inset-0 bg-cover bg-center bg-fixed" style={{ backgroundImage: `url('${getImage("cta_background", "/images/template/breadcumb.jpg")}')` }} />
        )}
        <div className="absolute inset-0 bg-black/65" />
        <div ref={cta.ref} className={`relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ${cta.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <p className="text-[#5f5f5f] text-sm mb-1">See what&apos;s new</p>
          <h2 className="text-lg uppercase text-white font-normal mb-8 tracking-[5px] sm:tracking-[10px]">
            Ready to Shine
          </h2>
          <p className="text-white/60 mb-10 text-base max-w-xl mx-auto">
            Nominate talented individuals to compete for recognition across the globe. The spotlight is waiting.
          </p>
          <a href="/nominate">
            <span
              className="inline-block bg-black text-white font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] border border-black transition-all duration-500 hover:bg-white hover:text-black cursor-pointer"
              data-testid="button-cta-join"
            >
              Start Nominating Now <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
            </span>
          </a>
        </div>
      </section>

      <SiteFooter />

      {showVotingModal && (
        <Dialog open={showVotingModal} onOpenChange={setShowVotingModal}>
          <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white uppercase tracking-[3px] text-base font-bold">How Voting Works</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              {renderInfoText(getText("how_voting_works", "Information coming soon."))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showNominationModal && (
        <Dialog open={showNominationModal} onOpenChange={setShowNominationModal}>
          <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white uppercase tracking-[3px] text-base font-bold">How Nominations Work</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              {renderInfoText(getText("how_nominations_work", "Information coming soon."))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
