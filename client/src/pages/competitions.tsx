import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Users, Search, Megaphone, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { Competition } from "@shared/schema";
import { slugify } from "@shared/slugify";

type CompetitionExt = Competition & { coverVideo?: string | null; hostedBy?: string | null };
import { useState } from "react";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";

export default function Competitions() {
  useSEO({
    title: "Browse Competitions",
    description: "Explore active talent competitions in music, modeling, bodybuilding, dance and more. Vote for your favorites, or apply to compete on HiFitComp.",
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
    if (filter === "all" && c.status === "draft") return false;
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
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {["all", "active", "completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-block px-3 py-1.5 text-[15px] border-2 transition-all duration-300 ${filter === f ? "border-black bg-transparent text-white" : "border-transparent bg-[#f4f4f4]/10 text-white/50 hover:border-white/30"}`}
              data-testid={`filter-${f}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {firestoreCategories && firestoreCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-10">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`inline-block px-3 py-1.5 text-[13px] uppercase tracking-wider border-2 transition-all duration-300 ${categoryFilter === "all" ? "border-[#FF5A09] text-[#FF5A09]" : "border-transparent bg-[#f4f4f4]/10 text-white/50 hover:border-white/30"}`}
              data-testid="filter-category-all"
            >
              All Categories
            </button>
            {firestoreCategories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.name)}
                className={`inline-block px-3 py-1.5 text-[13px] uppercase tracking-wider border-2 transition-all duration-300 ${categoryFilter === cat.name ? "border-[#FF5A09] text-[#FF5A09]" : "border-transparent bg-[#f4f4f4]/10 text-white/50 hover:border-white/30"}`}
                data-testid={`filter-category-${cat.id}`}
              >
                {cat.name}
              </button>
            ))}
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
  const websiteName = getText("site_name", "HiFitComp");
  return (
    <div
      className="group transition-all duration-500 hover:shadow-[0_5px_80px_0_rgba(0,0,0,0.2)]"
      data-testid={`card-competition-${competition.id}`}
    >
      <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`}>
        <div className="cursor-pointer">
          <div className="overflow-hidden relative h-52">
            {competition.coverVideo ? (
              <video
                src={competition.coverVideo}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <img
                src={competition.coverImage || getImage("competition_card_fallback", "/images/template/e1.jpg")}
                alt={competition.title}
                className="w-full h-52 object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}
          </div>
          <div className="bg-black group-hover:bg-[#f5f9fa] text-center py-6 px-4 transition-all duration-500">
            <h4
              className="text-white group-hover:text-black uppercase font-bold text-base mb-3 transition-colors duration-500"
              data-testid={`text-title-${competition.id}`}
            >
              {competition.title}
            </h4>
            <div className="mb-4">
              <span className="text-white/60 group-hover:text-black/60 text-[15px] transition-colors duration-500 inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {(competition as any).endDateTbd ? "TBD" : competition.endDate ? new Date(competition.endDate).toLocaleDateString() : "Open"}
              </span>
              <span className="text-white/40 group-hover:text-black/40 mx-3 transition-colors duration-500">|</span>
              <span className="text-white/60 group-hover:text-black/60 text-[15px] transition-colors duration-500 inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {competition.category}
              </span>
            </div>
            {competition.hostedBy && (
              <p className="text-white/40 group-hover:text-black/40 text-[13px] mb-3 transition-colors duration-500" data-testid={`text-hosted-by-${competition.id}`}>
                Hosted by {competition.hostedBy === "admin" ? websiteName : competition.hostedBy}
              </p>
            )}
            <span
              className="inline-block bg-white/20 group-hover:bg-black/80 text-white text-[11px] font-bold uppercase px-5 py-2 tracking-widest transition-all duration-500 backdrop-blur-sm"
              style={{ letterSpacing: "4px" }}
            >
              See Competition
            </span>
          </div>
        </div>
      </Link>
      <div className="bg-black group-hover:bg-[#f5f9fa] border-t border-white/5 group-hover:border-black/10 px-4 pb-6 pt-4 flex flex-wrap items-center justify-center gap-3 transition-all duration-500">
        <Link
          href={`/join?competition=${competition.id}`}
          className="inline-block bg-[#FF5A09] text-white font-bold text-xs uppercase px-5 leading-[36px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer"
          style={{ letterSpacing: "2px" }}
          data-testid={`button-join-${competition.id}`}
        >
          Start Nominating
        </Link>
      </div>
    </div>
  );
}
