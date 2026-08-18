import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { Search, ShoppingCart, Heart, Receipt } from "lucide-react";
import { Link } from "wouter";
import { slugify } from "@shared/slugify";

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

interface ViewerProfile {
  id: string;
  email: string;
  displayName: string;
  totalVotesPurchased: number;
  totalSpent: number;
  createdAt: string;
}

interface LookupResult {
  viewer: ViewerProfile;
  purchases: PurchaseDetail[];
}

export default function MyPurchasesPage() {
  const { toast } = useToast();
  const { getImage, getMedia } = useLivery();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [searched, setSearched] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast({ title: "Please enter your name and email", variant: "destructive" });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const res = await apiRequest("POST", "/api/guest/lookup", {
        name: name.trim(),
        email: email.trim(),
      });
      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      setResult(null);
      toast({
        title: "Not Found",
        description: error.message?.replace(/^\d+:\s*/, "") || "No account found with that name and email.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section className="relative h-[270px] md:h-[300px] overflow-hidden">
        {getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").type === "video" ? (
          <video src={getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${getImage("breadcrumb_bg", "/images/template/breadcumb.jpg")}')` }} />
        )}
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-8 pb-5 px-8 z-10 w-[calc(100%-60px)] max-w-[552px]">
          <p className="text-black/50 text-base leading-relaxed mb-1">Your Account</p>
          <h2
            className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none"
            style={{ letterSpacing: "10px" }}
            data-testid="text-page-title"
          >
            MY PURCHASES
          </h2>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {!result ? (
          <>
            <div className="text-center mb-8">
              <p className="text-white/40 text-sm">
                Look up your purchase history by entering the name and email you used at checkout.
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-4 max-w-md mx-auto mb-10">
              <div>
                <Label htmlFor="lookup-name" className="text-white/60 uppercase text-xs tracking-wider">
                  Full Name
                </Label>
                <Input
                  id="lookup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/[0.08] border-white/20 text-white mt-2"
                  placeholder="Your full name"
                  required
                  data-testid="input-lookup-name"
                />
              </div>
              <div>
                <Label htmlFor="lookup-email" className="text-white/60 uppercase text-xs tracking-wider">
                  Email
                </Label>
                <Input
                  id="lookup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/[0.08] border-white/20 text-white mt-2"
                  placeholder="your@email.com"
                  required
                  data-testid="input-lookup-email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF5A09] text-white font-bold text-sm uppercase px-8 leading-[47px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-lookup"
              >
                <Search className="h-4 w-4" />
                {loading ? "SEARCHING..." : "LOOK UP"}
              </button>
            </form>

            {searched && !result && !loading && (
              <div className="text-center py-10">
                <ShoppingCart className="h-12 w-12 text-white/10 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2" data-testid="text-no-results">No Account Found</h3>
                <p className="text-white/40 text-sm">
                  Make sure you enter the exact name and email you used during checkout.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="border border-white/10 p-5 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold uppercase" data-testid="text-viewer-name">
                    {result.viewer.displayName}
                  </h3>
                  <p className="text-white/40 text-sm" data-testid="text-viewer-email">{result.viewer.email}</p>
                </div>
                <button
                  onClick={() => { setResult(null); setSearched(false); }}
                  className="text-white/40 text-xs uppercase tracking-wider hover:text-white/60 transition-colors"
                  data-testid="button-new-lookup"
                >
                  Different Account
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 text-center">
                  <Heart className="h-5 w-5 text-[#FF5A09] mx-auto mb-1" />
                  <span className="text-white font-bold text-xl" data-testid="text-total-votes">
                    {result.viewer.totalVotesPurchased}
                  </span>
                  <p className="text-white/40 text-xs uppercase tracking-wider">Total Votes</p>
                </div>
                <div className="bg-white/5 p-4 text-center">
                  <Receipt className="h-5 w-5 text-[#FF5A09] mx-auto mb-1" />
                  <span className="text-white font-bold text-xl" data-testid="text-total-spent">
                    ${(result.viewer.totalSpent / 100).toFixed(2)}
                  </span>
                  <p className="text-white/40 text-xs uppercase tracking-wider">Total Spent</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[#5f5f5f] text-sm mb-1">Purchase History</p>
              <h3 className="text-lg uppercase text-white font-normal" style={{ letterSpacing: "6px" }}>
                TRANSACTIONS ({result.purchases.length})
              </h3>
            </div>

            {result.purchases.length > 0 ? (
              <div className="space-y-3">
                {result.purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="border border-white/10 p-4 transition-colors hover:border-white/20"
                    data-testid={`card-purchase-${purchase.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={`/${slugify(purchase.competitionCategory)}/${slugify(purchase.competitionTitle)}`}
                        className="text-white font-bold uppercase text-sm hover:text-[#FF5A09] transition-colors"
                        data-testid={`link-competition-${purchase.id}`}
                      >
                        {purchase.competitionTitle}
                      </Link>
                      <span className="text-white font-bold">${(purchase.amount / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-white/40 text-xs">
                      <span>
                        <Heart className="inline h-3 w-3 mr-1 text-[#FF5A09]" />
                        {purchase.voteCount} votes
                      </span>
                      <span>
                        {purchase.purchasedAt
                          ? new Date(purchase.purchasedAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    {purchase.transactionId && (
                      <p className="text-white/20 text-xs mt-1">
                        Txn: {purchase.transactionId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <ShoppingCart className="h-12 w-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-sm">No purchases yet.</p>
              </div>
            )}
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
