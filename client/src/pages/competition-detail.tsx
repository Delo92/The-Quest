import { useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar, Vote, Heart, Users, Crown, Award, ChevronRight, ShoppingCart } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { slugify } from "@shared/slugify";
import { FallbackImage, getBackupUrl } from "@/components/fallback-image";

interface ContestantWithProfile {
  id: number;
  competitionId: number;
  talentProfileId: number;
  applicationStatus: string;
  voteCount: number;
  talentProfile: {
    id: number;
    displayName: string;
    bio: string | null;
    category: string | null;
    imageUrls: string[] | null;
    imageBackupUrls?: string[] | null;
    location: string | null;
  };
}

interface CompetitionDetail {
  id: number;
  title: string;
  description: string | null;
  category: string;
  coverImage: string | null;
  coverVideo: string | null;
  status: string;
  voteCost: number;
  maxVotesPerDay: number;
  startDate: string | null;
  endDate: string | null;
  contestants: ContestantWithProfile[];
  totalVotes: number;
  hostedBy?: string | null;
}

export default function CompetitionDetailPage() {
  const params = useParams<{ categorySlug: string; compSlug: string }>();
  const categorySlug = params?.categorySlug;
  const compSlug = params?.compSlug;
  const { user } = useAuth();
  const { toast } = useToast();

  const voteSource = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("source") === "in_person" ? "in_person" : "online";
  }, []);

  const isInPersonVoting = voteSource === "in_person";

  const { getImage, getMedia, getText } = useLivery();
  const { data: competition, isLoading } = useQuery<CompetitionDetail>({
    queryKey: ["/api/resolve/competition", categorySlug, compSlug],
    enabled: !!categorySlug && !!compSlug,
  });

  const id = competition?.id?.toString();

  useSEO({
    title: competition ? `${competition.title} - ${competition.category} Competition` : "Competition",
    description: competition?.description || (competition ? `Vote in the ${competition.title} ${competition.category} competition on The Quest. Browse contestants, cast your vote, and help decide the winner!` : undefined),
    ogImage: competition?.coverImage || undefined,
    canonical: competition ? `https://thequest-2dc77.firebaseapp.com/${slugify(competition.category)}/${slugify(competition.title)}` : undefined,
  });

  const voteMutation = useMutation({
    mutationFn: async (contestantId: number) => {
      const refCode = localStorage.getItem("hfc_ref") || undefined;
      await apiRequest("POST", `/api/competitions/${id}/vote`, { contestantId, source: voteSource, refCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resolve/competition", categorySlug, compSlug] });
      toast({ title: "Vote cast!", description: "Your vote has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Vote failed", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <SiteNavbar />
        <div className="max-w-5xl mx-auto px-4 py-32">
          <Skeleton className="h-64 mb-6 bg-white/5" />
          <Skeleton className="h-8 w-1/2 mb-4 bg-white/10" />
          <Skeleton className="h-4 w-3/4 bg-white/10" />
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <SiteNavbar />
        <div className="text-center">
          <Trophy className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Competition not found</h3>
          <Link href="/competitions">
            <Button variant="ghost" className="mt-4 text-orange-400" data-testid="button-back">Back to Competitions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const maxVotes = Math.max(...(competition.contestants?.map((c) => c.voteCount) || [1]), 1);
  const isVotingOpen = competition.status === "voting" || competition.status === "active";
  const isInPersonOnlyEvent = (competition as any).inPersonOnly === true;
  const canVote = isVotingOpen && (!isInPersonOnlyEvent || isInPersonVoting);
  const sorted = [...(competition.contestants || [])].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section className="relative h-[270px] md:h-[340px] overflow-hidden">
        {(() => {
          if (competition.coverVideo) {
            const isVimeo = competition.coverVideo.includes("vimeo.com");
            if (isVimeo) {
              const embedUrl = competition.coverVideo.includes("?")
                ? competition.coverVideo + "&background=1&autoplay=1&loop=1&muted=1"
                : competition.coverVideo + "?background=1&autoplay=1&loop=1&muted=1";
              return (
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full"
                  style={{ border: "none", transform: "scale(1.4)", transformOrigin: "center center" }}
                  allow="autoplay; fullscreen"
                  title="Competition video"
                />
              );
            }
            return <video src={competition.coverVideo} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />;
          }
          if (competition.coverImage) {
            return <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${competition.coverImage}')` }} />;
          }
          const fallback = getMedia("competition_detail_header", "/images/template/breadcumb3.jpg");
          return fallback.type === "video" ? (
            <video src={fallback.url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
          ) : (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${fallback.url}')` }} />
          );
        })()}
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-10 pb-6 px-8 z-10 w-[calc(100%-60px)] max-w-[552px]">
          <p className="text-black/50 text-base leading-relaxed mb-1">
            <Link href="/competitions" className="hover:text-[#FF5A09] transition-colors text-black/50" data-testid="link-back">
              Competitions
            </Link>
            <span className="mx-2">/</span>
            {competition.category}
          </p>
          <h2
            className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none"
            style={{ letterSpacing: "10px" }}
            data-testid="text-competition-title"
          >
            {competition.title}
          </h2>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {isInPersonVoting && (
          <div className="mb-6 rounded-md bg-[#FF5A09]/10 border border-[#FF5A09]/30 px-4 py-3 flex flex-wrap items-center gap-3" data-testid="banner-in-person">
            <Vote className="h-5 w-5 text-[#FF5A09] shrink-0" />
            <p className="text-sm text-white/80">
              <span className="font-bold text-[#FF5A09]">LIVE EVENT VOTING</span> — Your votes are recorded as in-person votes for this competition.
            </p>
          </div>
        )}
        {isInPersonOnlyEvent && !isInPersonVoting && (
          <div className="mb-6 rounded-md bg-purple-500/10 border border-purple-500/30 px-4 py-3 flex flex-wrap items-center gap-3" data-testid="banner-in-person-only">
            <Vote className="h-5 w-5 text-purple-400 shrink-0" />
            <p className="text-sm text-white/80">
              <span className="font-bold text-purple-400">IN-PERSON ONLY EVENT</span> — This competition accepts votes only at the live venue. Scan the QR code at the event to cast your vote.
            </p>
          </div>
        )}

        {competition.description && (
          <p className="text-white/40 mb-6 text-base max-w-3xl leading-relaxed" data-testid="text-description">
            {competition.description}
          </p>
        )}

        {competition.hostedBy && (
          <p className="text-white/50 text-sm mb-6 uppercase tracking-wider" data-testid="text-hosted-by">
            Hosted by {competition.hostedBy === "admin" ? getText("site_name", "The Quest") : competition.hostedBy}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-10">
          <Link
            href={`/join?competition=${competition.id}`}
            className="inline-block bg-[#FF5A09] text-white font-bold text-sm uppercase px-6 leading-[42px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer"
            style={{ letterSpacing: "2px" }}
            data-testid="button-join-competition"
          >
            Start Nominating <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-6 text-sm text-white/40">
            {(competition.endDate || (competition as any).endDateTbd) && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-white/30" />
                {(competition as any).endDateTbd ? <span className="text-orange-400">Ends TBD</span> : `Ends ${new Date(competition.endDate!).toLocaleDateString()}`}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Vote className="h-4 w-4 text-white/30" />
              {competition.totalVotes} total votes
            </span>
            {competition.voteCost > 0 && (
              <span className="flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-white/30" />
                {competition.voteCost} credits/vote
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Vote className="h-4 w-4 text-white/30" />
              1 free vote/competition/day
            </span>
          </div>
        </div>

        <div className="text-center mb-12">
          <p className="text-[#5f5f5f] text-sm mb-1">See what&apos;s new</p>
          <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>
            Contestants ({sorted.length})
          </h2>
        </div>

        {sorted.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted.map((contestant, index) => {
              const pct = maxVotes > 0 ? (contestant.voteCount / maxVotes) * 100 : 0;
              const rankIcon = index === 0 ? <Crown className="h-4 w-4 text-yellow-400" /> : index === 1 ? <Award className="h-4 w-4 text-gray-300" /> : index === 2 ? <Award className="h-4 w-4 text-orange-400" /> : null;

              return (
                <div
                  key={contestant.id}
                  className="group cursor-pointer transition-all duration-500 hover:shadow-[0_5px_80px_0_rgba(0,0,0,0.2)]"
                  data-testid={`card-contestant-${contestant.id}`}
                >
                  <div className="relative overflow-hidden h-52">
                    <FallbackImage
                      src={(contestant as any).videoThumbnail || contestant.talentProfile.imageUrls?.[0] || getImage("talent_profile_fallback", "/images/template/a1.jpg")}
                      fallbackSrc={getBackupUrl(contestant.talentProfile.imageUrls, contestant.talentProfile.imageBackupUrls, 0) || getImage("talent_profile_fallback", "/images/template/a1.jpg")}
                      alt={contestant.talentProfile.displayName}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {rankIcon && (
                      <div className="absolute top-3 left-3 w-8 h-8 bg-black/70 flex items-center justify-center">
                        {rankIcon}
                      </div>
                    )}
                  </div>
                  <div className="bg-black group-hover:bg-[#f5f9fa] text-center py-6 px-4 transition-all duration-500">
                    <Link
                      href={`/${slugify(competition.category)}/${slugify(competition.title)}/${slugify(contestant.talentProfile.displayName)}`}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`link-contestant-name-${contestant.id}`}
                    >
                      <h4 className="text-white group-hover:text-black uppercase font-bold text-base mb-2 transition-colors duration-500 hover:text-[#FF5A09] group-hover:hover:text-[#FF5A09]" data-testid={`text-contestant-name-${contestant.id}`}>
                        {contestant.talentProfile.displayName}
                      </h4>
                    </Link>
                    <div className="mb-3">
                      <span className="text-white/60 group-hover:text-black/60 text-sm transition-colors duration-500" data-testid={`text-votes-${contestant.id}`}>
                        {contestant.voteCount} votes
                      </span>
                      {contestant.talentProfile.category && (
                        <>
                          <span className="text-white/30 group-hover:text-black/30 mx-2 transition-colors duration-500">|</span>
                          <span className="text-white/60 group-hover:text-black/60 text-sm transition-colors duration-500">
                            {contestant.talentProfile.category}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="relative h-1.5 bg-white/10 group-hover:bg-black/10 mb-4 transition-colors duration-500">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#FF5A09] transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-center gap-4">
                      <Link
                        href={`/${slugify(competition.category)}/${slugify(competition.title)}/${slugify(contestant.talentProfile.displayName)}`}
                        className="text-[11px] text-white group-hover:text-black uppercase border-b border-white group-hover:border-black pb-1 transition-colors duration-500"
                        style={{ letterSpacing: "6px" }}
                        data-testid={`link-profile-${contestant.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Profile
                      </Link>
                      {canVote && (
                        <>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              voteMutation.mutate(contestant.id);
                            }}
                            disabled={voteMutation.isPending}
                            className="inline-block bg-black group-hover:bg-[#111] text-white font-bold text-sm capitalize px-6 leading-[40px] border border-black transition-all duration-500 hover:bg-white hover:text-black cursor-pointer disabled:opacity-50"
                            data-testid={`button-vote-${contestant.id}`}
                          >
                            <Heart className="inline h-3.5 w-3.5 mr-1.5" />
                            {voteMutation.isPending ? "Voting..." : "Vote"}
                          </button>
                          {!isInPersonOnlyEvent && (
                            <Link
                              href={`/checkout/${competition.id}/${contestant.id}`}
                              className="inline-block bg-[#FF5A09] text-white font-bold text-sm capitalize px-6 leading-[40px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer"
                              style={{ letterSpacing: "2px" }}
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-buy-votes-${contestant.id}`}
                            >
                              <ShoppingCart className="inline h-3.5 w-3.5 mr-1.5" />
                              Buy Votes
                            </Link>
                          )}
                        </>
                      )}
                      {isVotingOpen && isInPersonOnlyEvent && !isInPersonVoting && (
                        <span className="text-[11px] text-white/40 uppercase" style={{ letterSpacing: "3px" }} data-testid={`text-in-person-only-${contestant.id}`}>
                          Scan QR to Vote
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-white/10 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No contestants yet</h3>
            <p className="text-sm text-white/30 mb-6">Be the first to apply!</p>
            {!user && (
              <a href="/login">
                <span
                  className="inline-block bg-black text-white font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer"
                  data-testid="button-apply-login"
                >
                  Log in to Apply <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
                </span>
              </a>
            )}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
