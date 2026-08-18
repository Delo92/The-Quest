import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar, Users, ChevronRight, Crown, Globe, Instagram } from "lucide-react";
import { Link } from "wouter";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { slugify } from "@shared/slugify";

interface HostData {
  host: {
    id: number;
    displayName: string;
    stageName: string | null;
    bio: string | null;
    category: string | null;
    imageUrls: string[] | null;
    location: string | null;
    email: string | null;
    socialLinks: Record<string, string> | null;
    profileImageUrl: string | null;
  };
  competitions: {
    id: number;
    title: string;
    description: string | null;
    category: string;
    coverImage: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
  }[];
}

export default function HostProfilePublic() {
  const params = useParams<{ hostSlug: string }>();
  const hostSlug = params?.hostSlug;
  const { getImage } = useLivery();

  const isNumericId = hostSlug && /^\d+$/.test(hostSlug);

  const { data, isLoading, error } = useQuery<HostData>({
    queryKey: ["/api/resolve/host", hostSlug],
    enabled: !!hostSlug && !isNumericId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <SiteNavbar />
        <div className="max-w-4xl mx-auto px-4 py-32">
          <Skeleton className="h-40 w-40 mx-auto mb-6 bg-white/5" />
          <Skeleton className="h-8 w-1/3 mx-auto mb-4 bg-white/10" />
          <Skeleton className="h-4 w-1/2 mx-auto bg-white/10" />
        </div>
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <SiteNavbar />
        <div className="text-center">
          <Crown className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Host not found</h3>
          <p className="text-white/40 mt-2 mb-4">This host profile link may be invalid.</p>
          <Link href="/competitions">
            <span className="inline-block mt-4 text-white/60 hover:text-white transition-colors cursor-pointer">
              Browse Competitions
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const { host, competitions } = data;
  const mainImage = host.profileImageUrl || host.imageUrls?.[0] || getImage("talent_profile_fallback", "/images/template/a1.jpg");

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section
        className="relative h-[270px] md:h-[340px] bg-cover bg-center overflow-hidden"
        style={{ backgroundImage: `url('${mainImage}')`, backgroundSize: "cover" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white text-center pt-8 pb-5 px-8 z-10 w-[calc(100%-40px)] max-w-[600px]">
          <p className="text-[#5f5f5f] text-xs uppercase mb-1" style={{ letterSpacing: "4px" }}>Competition Host</p>
          <h2
            className="text-[24px] md:text-[30px] uppercase text-black font-normal leading-none"
            style={{ letterSpacing: "10px" }}
            data-testid="text-host-name"
          >
            {host.displayName}
          </h2>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {host.bio && (
          <div className="mb-10 text-center">
            <p className="text-white/50 leading-relaxed text-base max-w-2xl mx-auto" data-testid="text-bio">
              {host.bio}
            </p>
          </div>
        )}

        {host.socialLinks && Object.keys(host.socialLinks).length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            {Object.entries(host.socialLinks).map(([platform, url]) => {
              if (!url) return null;
              return (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 hover:text-[#FF5A09] transition-colors text-sm uppercase flex items-center gap-1.5"
                  style={{ letterSpacing: "2px" }}
                  data-testid={`link-social-${platform}`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  {platform}
                </a>
              );
            })}
          </div>
        )}

        {competitions.length > 0 && (
          <div className="mb-10">
            <div className="text-center mb-10">
              <p className="text-[#5f5f5f] text-sm mb-1">Events hosted by {host.displayName}</p>
              <h2 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "10px" }}>
                Competitions
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((comp) => (
                <Link key={comp.id} href={`/${slugify(comp.category)}/${slugify(comp.title)}`}>
                  <div className="group cursor-pointer transition-all duration-500 hover:shadow-[0_5px_80px_0_rgba(0,0,0,0.2)]" data-testid={`card-comp-${comp.id}`}>
                    <div className="overflow-hidden relative h-44">
                      <img
                        src={comp.coverImage || getImage("competition_card_fallback", "/images/template/e1.jpg")}
                        alt={comp.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute top-3 right-3 px-2 py-1 text-[10px] uppercase font-bold" style={{ letterSpacing: "2px", background: comp.status === "active" || comp.status === "voting" ? "#FF5A09" : comp.status === "completed" ? "#333" : "#555", color: "white" }}>
                        {comp.status === "voting" ? "Active" : comp.status}
                      </div>
                    </div>
                    <div className="bg-black group-hover:bg-[#f5f9fa] text-center py-5 px-4 transition-all duration-500">
                      <h4 className="text-white group-hover:text-black uppercase font-bold text-sm mb-2 transition-colors duration-500">
                        {comp.title}
                      </h4>
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-white/60 group-hover:text-black/60 text-xs transition-colors duration-500 inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {comp.endDate ? new Date(comp.endDate).toLocaleDateString() : "Open"}
                        </span>
                        <span className="text-white/60 group-hover:text-black/60 text-xs transition-colors duration-500 inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {comp.category}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pb-10">
          <Link href="/competitions">
            <span
              className="inline-block bg-transparent text-white font-bold text-base capitalize px-8 leading-[47px] min-w-[212px] border border-white transition-all duration-500 hover:bg-white hover:text-black cursor-pointer"
              data-testid="button-back"
            >
              Browse Competitions <ChevronRight className="inline h-4 w-4 ml-1" /><ChevronRight className="inline h-4 w-4 -ml-2" />
            </span>
          </Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
