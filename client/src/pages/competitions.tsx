import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Users, Search, Megaphone, ArrowRight, Star, Clock3 } from "lucide-react";
import { Link } from "wouter";
import type { Competition } from "@shared/schema";
import { slugify } from "@shared/slugify";

type CompetitionExt = Competition & {
  coverVideo?: string | null;
  coverVideoThumbnail?: string | null;
  hostedBy?: string | null;
};
import { useState } from "react";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import {
  CompetitionCountdownBadge,
  formatCompetitionDate,
  getCompetitionSchedule,
} from "@/components/competition-countdown";

export default function Competitions() {
  useSEO({
    title: "Browse Competitions",
    description: "Explore active talent competitions in music, modeling, bodybuilding, dance and more. Vote for your favorites, or apply to compete on The Quest.",
    canonical: "https://thequest-2dc77.firebaseapp.com/competitions",
  });
  const { data: competitions, isLoading } = useQuery<CompetitionExt[]>({
    queryKey: ["/api/competitions"],
  });
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { getImage, getMedia } = useLivery();

  const { data: firestoreCategories } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const filtered = competitions?.filter((c) => {
    if (c.status === "draft") return false;
    if (filter === "active" && c.status !== "active" && c.status !== "voting") return false;
    if (filter === "completed" && c.status !== "completed") return false;
    if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section className="relative overflow-hidden">
        <div className="relative h-[270px] md:h-[340px]">
          {getMedia("competitions_header", "/images/template/breadcumb2.jpg").type === "video" ? (
            <video src={getMedia("competitions_header", "/images/template/breadcumb2.jpg").url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
          ) : (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${getImage("competitions_header", "/images/template/breadcumb2.jpg")}')` }} />
          )}
          <div className="absolute inset-0 bg-black/65" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-10 pb-6 px-8 z-10 w-[calc(100%-60px)] max-w-[552px]">
            <p className="text-black/50 text-base leading-relaxed mb-1">See what&apos;s new</p>
            <h2
              className="text-[30px] uppercase text-black/80 font-normal leading-none"
              style={{ letterSpacing: "10px" }}
              data-testid="text-page-title"
            >
              Competitions
            </h2>
          </div>
        </div>

        <div className="bg-gradient-to-b from-purple-950/40 to-black border-b border-white/10 py-12 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="flex-shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-full bg-purple-500/20 border border-purple-500/30">
              <Megaphone className="h-6 w-6 text-purple-300" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold uppercase mb-1" style={{ letterSpacing: "4px" }}>Become a Host</h2>
              <p className="text-white/50 text-sm">
                Want to run your own competition? Get access to built-in voting, contestant management, analytics, and more.
              </p>
            </div>
            <Link href="/host" className="flex-shrink-0">
              <span
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold uppercase px-6 py-3 text-sm cursor-pointer hover:from-purple-500 hover:to-purple-400 transition-all duration-300 whitespace-nowrap"
                style={{ letterSpacing: "2px" }}
                data-testid="button-become-a-host"
              >
                Become a Host <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scroll-momentum">
          <div className="flex items-center gap-2 mb-4 min-w-max sm:min-w-0 sm:flex-wrap">
            {["all", "active", "completed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-block px-4 py-2 min-h-[40px] text-[14px] border-2 transition-all duration-300 whitespace-nowrap ${filter === f ? "border-black bg-transparent text-white" : "border-transparent bg-[#f4f4f4]/10 text-white/50 hover:border-white/30"}`}
                data-testid={`filter-${f}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {firestoreCategories && firestoreCategories.length > 0 && (
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scroll-momentum">
            <div className="flex items-center gap-2 mb-8 min-w-max sm:min-w-0 sm:flex-wrap">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`inline-block px-4 py-2 min-h-[40px] text-[12px] uppercase tracking-wider border-2 transition-all duration-300 whitespace-nowrap ${categoryFilter === "all" ? "border-[#FF5A09] text-[#FF5A09]" : "border-transparent bg-[#f4f4f4]/10 text-white/50 hover:border-white/30"}`}
                data-testid="filter-category-all"
              >
                All Categories
              </button>
              {firestoreCategories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.name)}
                  className={`inline-block px-4 py-2 min-h-[40px] text-[12px] uppercase tracking-wider border-2 transition-all duration-300 whitespace-nowrap ${categoryFilter === cat.name ? "border-[#FF5A09] text-[#FF5A09]" : "border-transparent bg-[#f4f4f4]/10 text-white/50 hover:border-white/30"}`}
                  data-testid={`filter-category-${cat.id}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-52 bg-white/5" />
                <div className="bg-black p-6">
                  <Skeleton className="h-5 w-3/4 mb-3 bg-white/10" />
                  <Skeleton className="h-4 w-full mb-2 bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((comp) => (
              <CompetitionCard key={comp.id} competition={comp} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Search className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No competitions found</h3>
            <p className="text-white/40 text-sm">Try a different filter or check back soon.</p>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

function CompetitionCard({ competition }: { competition: CompetitionExt }) {
  const { getImage, getText } = useLivery();
  const websiteName = getText("site_name", "The Quest");
  const schedule = getCompetitionSchedule(competition);
  const coverPoster = competition.coverVideoThumbnail || competition.coverImage || getImage("competition_card_fallback", "/images/competition-cover-1.png");
  return (
    <div
      className="group relative overflow-hidden rounded-sm border border-white/10 bg-[#101010] shadow-[0_16px_35px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF5A09]/60 hover:shadow-[0_20px_45px_rgba(0,0,0,0.65)]"
      data-testid={`card-competition-${competition.id}`}
    >
      <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`}>
        <div className="cursor-pointer">
          <div className="overflow-hidden relative h-52 border-b border-white/10 bg-[#080808]">
            {competition.isFeatured && (
              <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 border border-[#FF5A09]/60 bg-black/85 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[2px] text-[#FF5A09] shadow-lg">
                <Star className="h-3 w-3 fill-current" />
                Featured
              </div>
            )}
            {competition.status === "draft" && (
              <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 border border-[#FF5A09]/60 bg-black/85 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[1.5px] text-[#FFB38F] shadow-lg">
                <Clock3 className="h-3 w-3" />
                Schedule pending
              </div>
            )}
            {competition.coverVideo ? (
              competition.coverVideo.includes("vimeo.com") ? (
                <iframe
                  src={`${competition.coverVideo}${competition.coverVideo.includes("?") ? "&" : "?"}autoplay=1&loop=1&muted=1&background=1&controls=0&autopause=0`}
                  className="w-full h-full transition-transform duration-700 group-hover:scale-105"
                  style={{ border: "none", pointerEvents: "none" }}
                  loading="eager"
                  allow="autoplay; fullscreen"
                  title={`${competition.title} cover video`}
                />
              ) : (
                <video
                  src={competition.coverVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  poster={competition.coverImage || undefined}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )
            ) : (
              <img
                src={competition.coverImage || getImage("competition_card_fallback", "/images/template/e1.jpg")}
                alt={competition.title}
                className="w-full h-52 object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
          <div className="bg-[#101010] group-hover:bg-[#171717] text-center py-6 px-4 transition-colors duration-300">
            <h4
              className="text-white uppercase font-bold text-base mb-3 transition-colors duration-300"
              data-testid={`text-title-${competition.id}`}
            >
              {competition.title}
            </h4>
            <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              <span className="text-white/60 text-[15px] inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatCompetitionDate(schedule.start, schedule.startIsTbd)}
                <span className="text-white/30">–</span>
                {formatCompetitionDate(schedule.end, schedule.endIsTbd)}
              </span>
              <span className="text-white/30">|</span>
              <span className="text-white/60 text-[15px] inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {competition.category}
              </span>
            </div>
            <CompetitionCountdownBadge competition={competition} />
            {competition.hostedBy && (
              <p className="mt-3 text-white/40 text-[13px] mb-3" data-testid={`text-hosted-by-${competition.id}`}>
                Hosted by {competition.hostedBy === "admin" ? websiteName : competition.hostedBy}
              </p>
            )}
             <span
               className="inline-block border border-white/20 bg-white/10 text-white text-[11px] font-bold uppercase px-5 py-2 tracking-widest transition-colors duration-300 group-hover:border-[#FF5A09]/70 group-hover:bg-[#FF5A09] group-hover:text-black"
               style={{ letterSpacing: "4px" }}
             >
               See Competition
             </span>
          </div>
        </div>
      </Link>
       <div className="bg-[#101010] border-t border-white/10 px-4 pb-6 pt-4 flex flex-wrap items-center justify-center gap-3">
         {competition.status === "draft" ? (
           <span className="inline-flex items-center gap-2 text-white/45 text-xs uppercase tracking-[2px]" data-testid={`status-schedule-pending-${competition.id}`}>
             <Clock3 className="h-3.5 w-3.5" /> Schedule pending
           </span>
         ) : (
           <Link
             href={`/join?competition=${competition.id}`}
             className="inline-block bg-[#FF5A09] text-white font-bold text-xs uppercase px-5 leading-[36px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer"
             style={{ letterSpacing: "2px" }}
             data-testid={`button-join-${competition.id}`}
           >
             Start Nominating
           </Link>
         )}
       </div>
    </div>
  );
}
