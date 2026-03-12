import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useViewerSession, type ViewerSession } from "@/hooks/use-viewer-session";
import { apiRequest } from "@/lib/queryClient";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { slugify } from "@shared/slugify";
import { Heart, Receipt, ShoppingCart, Trophy, LogOut, RefreshCw, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PurchaseDetail {
  id: number;
  competitionId: number;
  contestantId: number;
  voteCount: number;
  amount: number;
  transactionId: string | null;
  purchasedAt: string | null;
  competitionTitle: string;
  competitionCategory: string;
}

interface LookupResult {
  viewer: ViewerSession;
  purchases: PurchaseDetail[];
}

export default function ViewerDashboard() {
  useSEO({
    title: "My Dashboard",
    description: "View your voting history, purchases, and active competitions on HiFitComp.",
    canonical: "https://thequest-2dc77.firebaseapp.com/viewer",
  });

  const { viewer, logoutViewer, refreshViewer } = useViewerSession();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { getImage, getMedia } = useLivery();

  const [purchases, setPurchases] = useState<PurchaseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!viewer) {
      setLocation("/login");
      return;
    }
    loadData();
  }, [viewer]);

  const loadData = async () => {
    if (!viewer) return;
    try {
      const res = await apiRequest("POST", "/api/guest/lookup", {
        name: viewer.displayName,
        email: viewer.email,
      });
      const data: LookupResult = await res.json();
      setPurchases(data.purchases);
      refreshViewer({
        totalVotesPurchased: data.viewer.totalVotesPurchased,
        totalSpent: data.viewer.totalSpent,
      });
    } catch {
      toast({ title: "Could not load your data", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = () => {
    logoutViewer();
    window.location.href = "/";
  };

  if (!viewer) return null;

  const uniqueCompetitions = Array.from(
    new Map(purchases.map(p => [p.competitionId, p])).values()
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section className="relative h-[270px] md:h-[350px] overflow-hidden">
        {getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").type === "video" ? (
          <video src={getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${getImage("breadcrumb_bg", "/images/template/breadcumb.jpg")}')` }} />
        )}
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-8 pb-5 px-8 z-10 w-[calc(100%-60px)] max-w-[552px]">
          <p className="text-black/50 text-base leading-relaxed mb-1">Welcome back</p>
          <h2
            className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none"
            style={{ letterSpacing: "10px" }}
            data-testid="text-viewer-name"
          >
            {viewer.displayName}
          </h2>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 border-b border-white/10 pb-5">
          <p className="text-white/50 text-sm">{viewer.email}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 text-white/70 text-xs uppercase tracking-wider border border-white/20 px-3 py-1.5 hover:border-white/40 hover:text-white transition-colors disabled:opacity-50"
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-[#FF5A09] text-xs uppercase tracking-wider border border-[#FF5A09]/40 px-3 py-1.5 hover:bg-[#FF5A09] hover:text-white transition-colors"
              data-testid="button-viewer-logout"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 bg-white/5" />
              <Skeleton className="h-24 bg-white/5" />
            </div>
            <Skeleton className="h-40 bg-white/5" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="border border-white/15 bg-white/[0.04] p-5 text-center">
                <Heart className="h-6 w-6 text-[#FF5A09] mx-auto mb-2" />
                <span className="text-3xl font-bold text-white" data-testid="text-total-votes">
                  {viewer.totalVotesPurchased}
                </span>
                <p className="text-white/50 text-xs uppercase tracking-wider mt-1">Votes Purchased</p>
              </div>
              <div className="border border-white/15 bg-white/[0.04] p-5 text-center">
                <Receipt className="h-6 w-6 text-[#FF5A09] mx-auto mb-2" />
                <span className="text-3xl font-bold text-white" data-testid="text-total-spent">
                  ${(viewer.totalSpent / 100).toFixed(2)}
                </span>
                <p className="text-white/50 text-xs uppercase tracking-wider mt-1">Total Spent</p>
              </div>
            </div>

            {uniqueCompetitions.length > 0 && (
              <div className="mb-10 border border-white/15 bg-white/[0.03] p-5">
                <div className="text-center mb-5">
                  <p className="text-white/50 text-sm mb-1">Your activity</p>
                  <h3 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "8px" }}>
                    Competitions
                  </h3>
                </div>
                <div className="space-y-3">
                  {uniqueCompetitions.map((comp) => {
                    const compPurchases = purchases.filter(p => p.competitionId === comp.competitionId);
                    const totalVotes = compPurchases.reduce((sum, p) => sum + p.voteCount, 0);
                    const totalAmount = compPurchases.reduce((sum, p) => sum + p.amount, 0);
                    return (
                      <Link
                        key={comp.competitionId}
                        href={`/${slugify(comp.competitionCategory)}/${slugify(comp.competitionTitle)}`}
                        data-testid={`card-competition-${comp.competitionId}`}
                      >
                        <div className="border border-white/15 bg-white/[0.04] p-4 transition-colors hover:border-[#FF5A09]/40 hover:bg-white/[0.06] cursor-pointer">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-[#FF5A09]" />
                              <span className="text-white font-bold uppercase text-sm">
                                {comp.competitionTitle}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-white/40" />
                          </div>
                          <div className="flex items-center gap-4 text-white/50 text-xs">
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3 text-[#FF5A09]" />
                              {totalVotes} votes
                            </span>
                            <span>${(totalAmount / 100).toFixed(2)} spent</span>
                            <span>{compPurchases.length} purchase{compPurchases.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-10 border border-white/15 bg-white/[0.03] p-5">
              <div className="text-center mb-5">
                <p className="text-white/50 text-sm mb-1">Purchase history</p>
                <h3 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "8px" }}>
                  Transactions ({purchases.length})
                </h3>
              </div>

              {purchases.length > 0 ? (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="border border-white/15 bg-white/[0.04] p-4 transition-colors hover:border-white/25"
                      data-testid={`card-purchase-${purchase.id}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <Link
                          href={`/${slugify(purchase.competitionCategory)}/${slugify(purchase.competitionTitle)}`}
                          className="text-white font-bold uppercase text-sm hover:text-[#FF5A09] transition-colors"
                          data-testid={`link-competition-${purchase.id}`}
                        >
                          {purchase.competitionTitle}
                        </Link>
                        <span className="text-white font-bold">${(purchase.amount / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-white/50 text-xs">
                        <span className="flex items-center gap-1">
                          <Heart className="inline h-3 w-3 text-[#FF5A09]" />
                          {purchase.voteCount} votes
                        </span>
                        <span>
                          {purchase.purchasedAt
                            ? new Date(purchase.purchasedAt).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                      {purchase.transactionId && (
                        <p className="text-white/30 text-xs mt-1">
                          Txn: {purchase.transactionId}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <ShoppingCart className="h-12 w-12 text-white/15 mx-auto mb-4" />
                  <p className="text-white/50 text-sm mb-4">No purchases yet.</p>
                  <Link
                    href="/competitions"
                    className="inline-flex items-center gap-2 bg-[#FF5A09] text-white font-bold text-sm uppercase px-6 leading-[43px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09]"
                    style={{ letterSpacing: "2px" }}
                    data-testid="link-browse-competitions"
                  >
                    <Trophy className="h-4 w-4" />
                    Browse Competitions
                  </Link>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pb-6">
              <Link
                href="/competitions"
                className="inline-block bg-[#FF5A09] text-white font-bold text-sm uppercase px-8 leading-[47px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] text-center"
                style={{ letterSpacing: "2px" }}
                data-testid="link-vote-now"
              >
                Vote Now
              </Link>
              <Link
                href="/"
                className="inline-block bg-transparent text-white/60 font-bold text-sm uppercase px-8 leading-[47px] border border-white/30 transition-all duration-500 hover:bg-white hover:text-black text-center"
                style={{ letterSpacing: "2px" }}
                data-testid="link-home"
              >
                Home
              </Link>
            </div>
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
