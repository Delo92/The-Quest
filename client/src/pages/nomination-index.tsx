import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, MapPin, Search, Users, X } from "lucide-react";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useSEO } from "@/hooks/use-seo";

interface DirectoryCompetition {
  id: number;
  title: string;
  category: string | null;
  status: string;
}

interface TalentDirectoryProfile {
  id: number;
  name: string;
  profileSlug: string;
  imageUrl: string | null;
  category: string | null;
  location: string | null;
  hasOfficialEntry: boolean;
  needsNomination: boolean;
  nominationCompetition: DirectoryCompetition | null;
  officialCompetitions: DirectoryCompetition[];
}

type DirectoryFilter = "all" | "needs-nomination" | "official";

const FILTERS: Array<{ id: DirectoryFilter; label: string }> = [
  { id: "all", label: "All profiles" },
  { id: "needs-nomination", label: "Needs a nomination" },
  { id: "official", label: "Official entries" },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function TalentPortrait({ profile }: { profile: TalentDirectoryProfile }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="relative aspect-[1.08] overflow-hidden bg-[#292522]" data-testid={`portrait-talent-${profile.id}`}>
      {profile.imageUrl && !imageFailed ? (
        <img
          src={profile.imageUrl}
          alt={`${profile.name} portrait`}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          data-testid={`img-talent-${profile.id}`}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-[radial-gradient(ellipse_at_70%_15%,rgba(255,111,47,.2),transparent_50%),linear-gradient(145deg,#302a26,#1a1a1b)]">
          <span className="font-display text-5xl tracking-tight text-[#f1a174]/80" data-testid={`text-talent-initials-${profile.id}`}>
            {initials(profile.name)}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111112]/70 via-transparent to-transparent" />
      <span className="absolute bottom-3 left-4 font-mono text-[9px] uppercase tracking-[.2em] text-white/60">
        THE QUEST / {String(profile.id).padStart(4, "0")}
      </span>
    </div>
  );
}

export default function NominationIndexPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const { data: profiles = [], isLoading, isError, refetch, isFetching } = useQuery<TalentDirectoryProfile[]>({
    queryKey: ["/api/public/talent-directory"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/public/talent-directory", { signal });
      if (!response.ok) throw new Error("Talent directory could not be loaded");
      return response.json();
    },
    staleTime: 60_000,
  });

  useSEO({
    title: "Meet the Talent | The Quest",
    description: "Discover artists and contestants on The Quest. Explore their profiles and support the next stage of their journey.",
    canonical: "/nominationindex",
  });

  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return profiles.filter((profile) => {
      if (filter === "needs-nomination" && !profile.needsNomination) return false;
      if (filter === "official" && !profile.hasOfficialEntry) return false;
      if (!query) return true;
      const competitionNames = [
        ...profile.officialCompetitions.map((competition) => competition.title),
        profile.nominationCompetition?.title || "",
      ];
      return [
        profile.name,
        profile.category || "",
        profile.location || "",
        ...competitionNames,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [profiles, filter, search]);

  const counts: Record<DirectoryFilter, number> = {
    all: profiles.length,
    "needs-nomination": profiles.filter((profile) => profile.needsNomination).length,
    official: profiles.filter((profile) => profile.hasOfficialEntry).length,
  };

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#111112] text-[#f5f0e9]">
      <SiteNavbar />
      <main className="pt-[108px] sm:pt-[116px]">
        <section className="relative isolate overflow-hidden border-b border-white/[.08]">
          <div className="pointer-events-none absolute -right-24 -top-36 h-[30rem] w-[30rem] rounded-full border border-[#ff7437]/10" />
          <div className="pointer-events-none absolute -right-10 -top-20 h-[22rem] w-[22rem] rounded-full border border-[#ff7437]/10" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_20%,rgba(255,104,48,.14),transparent_38%),linear-gradient(180deg,#171617,#111112)]" />
          <div className="relative mx-auto max-w-[1320px] px-5 pb-11 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-20">
            <div className="mb-8 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.24em] text-white/50">
              <span className="h-px w-8 bg-[#ff7b43]" /> The people behind the performances
            </div>
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-4xl">
                <h1 className="font-display text-[clamp(3.2rem,9vw,7.8rem)] leading-[.82] tracking-[-.055em] text-[#f7f2eb]" data-testid="text-directory-title">
                  Meet the <span className="text-[#f2864e]">talent.</span>
                </h1>
                <p className="mt-7 max-w-2xl text-sm leading-7 text-white/60 sm:text-base sm:leading-8">
                  Find the artists, performers, and contestants bringing their work to The Quest. Follow a profile, discover their stages, and help someone take the next step.
                </p>
              </div>
              <div className="flex items-end gap-3 border-l border-[#f2864e]/50 pl-4 lg:mb-1">
                <span className="font-display text-5xl leading-none text-white" data-testid="text-directory-total">{profiles.length}</span>
                <span className="pb-1 text-[10px] uppercase leading-4 tracking-[.18em] text-white/45">profiles<br />and counting</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-11 lg:px-12" aria-label="Browse talent profiles">
          <div className="mb-8 flex flex-col gap-5 border-b border-white/[.09] pb-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter profiles">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={filter === item.id}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[10px] font-semibold uppercase tracking-[.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a52] ${
                    filter === item.id
                      ? "border-[#f2864e] bg-[#f2864e] text-[#191514]"
                      : "border-white/15 bg-white/[.025] text-white/65 hover:border-white/35 hover:text-white"
                  }`}
                  data-testid={`button-directory-filter-${item.id}`}
                >
                  {item.label}
                  <span className={filter === item.id ? "text-[#191514]/65" : "text-white/35"}>{counts[item.id]}</span>
                </button>
              ))}
            </div>
            <label className="relative block w-full lg:max-w-[390px]">
              <span className="sr-only">Search talent profiles</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search names, categories, places, competitions"
                className="min-h-12 w-full rounded-full border border-white/15 bg-[#1a1a1c] py-3 pl-11 pr-11 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#f2864e]/70 focus:ring-2 focus:ring-[#f2864e]/15"
                data-testid="input-directory-search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a52]"
                  data-testid="button-clear-directory-search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>

          {!isLoading && !isError && (
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[.19em] text-white/40" data-testid="text-directory-results">
              {visibleProfiles.length} {visibleProfiles.length === 1 ? "profile" : "profiles"} to discover
              {search.trim() ? ` · matching “${search.trim()}”` : ""}
            </p>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-x-5 gap-y-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Loading talent profiles" data-testid="status-directory-loading">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="aspect-[1.08] rounded-[1.1rem] bg-white/[.055]" />
                  <div className="mt-4 h-5 w-2/3 rounded bg-white/[.07]" />
                  <div className="mt-3 h-3 w-1/3 rounded bg-white/[.045]" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-[1.25rem] border border-white/10 bg-[#19191b] px-6 py-14 text-center" data-testid="status-directory-error">
              <p className="font-display text-3xl text-white">The directory is taking a moment.</p>
              <p className="mt-3 text-sm text-white/50">Please try again. Your place in the search is still here.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f2864e] px-6 text-[10px] font-bold uppercase tracking-[.14em] text-[#191514] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                data-testid="button-retry-directory"
              >
                {isFetching ? "Loading profiles" : "Try again"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : profiles.length === 0 ? (
            <div className="rounded-[1.25rem] border border-white/10 bg-[#19191b] px-6 py-16 text-center" data-testid="status-directory-empty">
              <Users className="mx-auto h-8 w-8 text-[#f2864e]/80" />
              <h2 className="mt-4 font-display text-3xl text-white">The first introductions are on their way.</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">There are no public talent profiles to show just yet. Check back soon.</p>
            </div>
          ) : visibleProfiles.length === 0 ? (
            <div className="rounded-[1.25rem] border border-white/10 bg-[#19191b] px-6 py-16 text-center" data-testid="status-directory-no-matches">
              <Search className="mx-auto h-7 w-7 text-white/35" />
              <h2 className="mt-4 font-display text-3xl text-white">No profiles found.</h2>
              <p className="mt-3 text-sm text-white/50">Try another name, category, location, or competition.</p>
              <button
                type="button"
                onClick={() => { setSearch(""); setFilter("all"); }}
                className="mt-5 min-h-10 rounded-full border border-white/20 px-5 text-[10px] font-semibold uppercase tracking-[.14em] text-white/70 transition-colors hover:border-white/45 hover:text-white"
                data-testid="button-reset-directory"
              >
                Reset search and filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-9 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="grid-talent-profiles">
              {visibleProfiles.map((profile, index) => {
                const nominationHref = `/nominate?profileId=${profile.id}${profile.nominationCompetition ? `&competition=${profile.nominationCompetition.id}` : ""}`;
                return (
                  <article
                    key={profile.id}
                    className="group min-w-0 animate-[directory-rise_.45s_ease-out_both]"
                    style={{ animationDelay: `${Math.min(index % 8, 7) * 35}ms` }}
                    data-testid={`card-talent-${profile.id}`}
                  >
                    <Link href={`/${profile.profileSlug}`} className="block overflow-hidden rounded-[1.1rem] border border-white/[.09] bg-[#1a191a] transition-transform duration-300 hover:-translate-y-1 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a52]" data-testid={`link-profile-${profile.id}`}>
                      <TalentPortrait profile={profile} />
                      <div className="p-4 pb-5 sm:px-5">
                        <h2 className="break-words font-display text-2xl leading-tight tracking-[-.02em] text-white" data-testid={`text-talent-name-${profile.id}`}>{profile.name}</h2>
                        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
                          {profile.category && <span data-testid={`text-talent-category-${profile.id}`}>{profile.category}</span>}
                          {profile.location && (
                            <span className="inline-flex items-center gap-1" data-testid={`text-talent-location-${profile.id}`}>
                              <MapPin className="h-3 w-3 text-[#f2864e]/80" />{profile.location}
                            </span>
                          )}
                        </div>
                        <div className="mt-4 border-t border-white/[.08] pt-3">
                          {profile.needsNomination ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#f2a071]" data-testid={`status-needs-nomination-${profile.id}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-[#ee975f]" />
                              Not officially entered
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[.12em] text-white/65" data-testid={`status-official-entry-${profile.id}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-[#b0a58f]" />
                              Officially entered
                            </div>
                          )}
                          {profile.needsNomination && profile.nominationCompetition && (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45" data-testid={`text-nomination-competition-${profile.id}`}>
                              Suggested competition: <span className="text-white/70">{profile.nominationCompetition.title}</span>
                            </p>
                          )}
                          {!profile.needsNomination && profile.officialCompetitions.length > 0 && (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45" data-testid={`text-official-competitions-${profile.id}`}>
                              {profile.officialCompetitions.map((competition) => competition.title).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                    <Link
                      href={nominationHref}
                      className="mt-2 inline-flex min-h-10 items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#f2864e] transition-colors hover:text-[#ffb28a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a52]"
                      data-testid={`link-nominate-${profile.id}`}
                    >
                      Start a nomination <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
      <style>{`
        @keyframes directory-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .animate-\\[directory-rise_\\.45s_ease-out_both\\] { animation: none; } }
      `}</style>
    </div>
  );
}
