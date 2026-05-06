import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { ShoppingCart, CreditCard, CheckCircle, ArrowLeft, Heart, Package, Tag, Loader2, X } from "lucide-react";
import PaymentConfirmationModal from "@/components/payment-confirmation-modal";
import { slugify } from "@shared/slugify";

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        secureData: {
          authData: { clientKey: string; apiLoginID: string };
          cardData: { cardNumber: string; month: string; year: string; cardCode: string };
        },
        callback: (response: { opaqueData?: { dataDescriptor: string; dataValue: string }; messages?: { resultCode: string; message: { code: string; text: string }[] } }) => void,
      ) => void;
    };
  }
}

interface VotePackage {
  id: string;
  name: string;
  voteCount: number;
  bonusVotes: number;
  price: number;
  isActive: boolean;
  description?: string;
}

interface CompetitionDetail {
  id: number;
  title: string;
  category: string;
  status: string;
  contestants: {
    id: number;
    talentProfileId: number;
    talentProfile: {
      displayName: string;
      imageUrls: string[] | null;
    };
  }[];
}

interface PaymentConfig {
  apiLoginId: string;
  clientKey: string;
  environment: string;
}

interface PromoReward {
  type: "discount_percent" | "discount_fixed" | "bonus_votes" | "info";
  value?: number;
  description: string;
}

interface PromoResult {
  valid: boolean;
  reward?: PromoReward;
  message?: string;
}

export default function CheckoutPage() {
  const params = useParams<{ competitionId: string; contestantId: string }>();
  const competitionId = params?.competitionId ? parseInt(params.competitionId) : null;
  const contestantId = params?.contestantId ? parseInt(params.contestantId) : null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { getImage, getMedia } = useLivery();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [individualVoteCount, setIndividualVoteCount] = useState<number>(1);
  const [createAccount, setCreateAccount] = useState(true);
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ transactionId: string; votesAdded: number } | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [acceptLoaded, setAcceptLoaded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const promoInputRef = useRef<HTMLInputElement>(null);

  const { data: competition, isLoading: compLoading } = useQuery<CompetitionDetail>({
    queryKey: ["/api/competitions", competitionId?.toString()],
    enabled: !!competitionId,
  });

  const { data: platformSettings } = useQuery<any>({
    queryKey: ["/api/platform-settings"],
  });
  const packages: VotePackage[] | undefined = platformSettings?.votePackages?.map((pkg: any, idx: number) => ({
    id: `pkg_${idx}`,
    name: pkg.name,
    voteCount: pkg.voteCount,
    bonusVotes: pkg.bonusVotes || 0,
    price: pkg.price * 100,
    isActive: true,
    description: pkg.description,
  }));
  const perVotePrice = platformSettings?.pricePerVote || 1;
  const pkgLoading = !platformSettings;

  const { data: paymentConfig } = useQuery<PaymentConfig>({
    queryKey: ["/api/payment-config"],
  });

  useEffect(() => {
    const savedRef = localStorage.getItem("hfc_ref");
    if (savedRef) setReferralCode(savedRef);
  }, []);

  useEffect(() => {
    if (paymentConfig && !acceptLoaded) {
      const scriptUrl = paymentConfig.environment === "production"
        ? "https://js.authorize.net/v1/Accept.js"
        : "https://jstest.authorize.net/v1/Accept.js";

      const existing = document.querySelector(`script[src="${scriptUrl}"]`);
      if (existing) {
        setAcceptLoaded(true);
        return;
      }

      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => setAcceptLoaded(true);
      document.head.appendChild(script);
    }
  }, [paymentConfig, acceptLoaded]);

  const contestant = competition?.contestants?.find((c) => c.id === contestantId);
  const selectedPkg = packages?.find((p) => p.id === selectedPackage);
  const isIndividual = selectedPackage === "individual";
  const individualTotal = individualVoteCount * perVotePrice * 100;

  // Compute discount from promo
  const getPromoDiscount = useCallback((subtotal: number) => {
    if (!promoResult?.valid || !promoResult.reward) return { discountDollars: 0, discountPercent: 0, discountFixed: 0 };
    const r = promoResult.reward;
    if (r.type === "discount_percent" && r.value) {
      const d = Math.round(subtotal * (r.value / 100) * 100) / 100;
      return { discountDollars: d, discountPercent: r.value, discountFixed: 0 };
    }
    if (r.type === "discount_fixed" && r.value) {
      const d = Math.min(r.value, subtotal);
      return { discountDollars: d, discountPercent: 0, discountFixed: r.value };
    }
    return { discountDollars: 0, discountPercent: 0, discountFixed: 0 };
  }, [promoResult]);

  const handleValidatePromo = useCallback(async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoValidating(true);
    setPromoResult(null);
    try {
      const res = await apiRequest("POST", "/api/promo/validate", { code });
      const data: PromoResult = await res.json();
      setPromoResult(data);
      if (data.valid) {
        toast({ title: "Promo code applied!", description: data.reward?.description || "Reward unlocked." });
      } else {
        toast({ title: "Invalid code", description: data.message || "This code could not be validated.", variant: "destructive" });
      }
    } catch {
      setPromoResult({ valid: false, message: "Unable to validate code right now." });
      toast({ title: "Validation failed", description: "Unable to reach promo service.", variant: "destructive" });
    } finally {
      setPromoValidating(false);
    }
  }, [promoCode, toast]);

  const clearPromo = useCallback(() => {
    setPromoCode("");
    setPromoResult(null);
  }, []);

  const validateCheckout = useCallback(() => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Please enter your name and email", variant: "destructive" });
      return false;
    }
    if (!selectedPackage) {
      toast({ title: "Please select a vote option", variant: "destructive" });
      return false;
    }
    if (isIndividual && (individualVoteCount < 1 || individualVoteCount > 10000)) {
      toast({ title: "Please enter a valid number of votes (1-10,000)", variant: "destructive" });
      return false;
    }
    if (!cardNumber || !expMonth || !expYear || !cvv) {
      toast({ title: "Please enter your card details", variant: "destructive" });
      return false;
    }
    if (!paymentConfig || !window.Accept) {
      toast({ title: "Payment system not ready. Please try again.", variant: "destructive" });
      return false;
    }
    return true;
  }, [name, email, selectedPackage, isIndividual, individualVoteCount, cardNumber, expMonth, expYear, cvv, paymentConfig, toast]);

  const processCheckout = useCallback(async () => {
    setShowConfirmModal(false);
    setProcessing(true);

    const secureData = {
      authData: {
        clientKey: paymentConfig!.clientKey,
        apiLoginID: paymentConfig!.apiLoginId,
      },
      cardData: {
        cardNumber: cardNumber.replace(/\s/g, ""),
        month: expMonth.padStart(2, "0"),
        year: expYear.length === 2 ? `20${expYear}` : expYear,
        cardCode: cvv,
      },
    };

    window.Accept!.dispatchData(secureData, async (tokenResponse) => {
      if (tokenResponse.messages?.resultCode === "Error") {
        setProcessing(false);
        const errMsg = tokenResponse.messages.message[0]?.text || "Card tokenization failed";
        toast({ title: "Payment Error", description: errMsg, variant: "destructive" });
        return;
      }

      if (!tokenResponse.opaqueData) {
        setProcessing(false);
        toast({ title: "Payment Error", description: "Failed to tokenize card", variant: "destructive" });
        return;
      }

      try {
        const pkgIndex = selectedPackage?.startsWith("pkg_") ? parseInt(selectedPackage.replace("pkg_", "")) : undefined;
        const subtotal = isIndividual ? (individualVoteCount * perVotePrice) : (selectedPkg ? selectedPkg.price / 100 : 0);
        const { discountPercent, discountFixed } = getPromoDiscount(subtotal);

        const body: any = {
          name: name.trim(),
          email: email.trim(),
          competitionId,
          contestantId,
          packageId: selectedPackage,
          packageIndex: isIndividual ? undefined : pkgIndex,
          createAccount,
          dataDescriptor: tokenResponse.opaqueData.dataDescriptor,
          dataValue: tokenResponse.opaqueData.dataValue,
          referralCode: referralCode || undefined,
          promoCode: promoResult?.valid && promoCode ? promoCode.trim().toUpperCase() : undefined,
          promoDiscountPercent: discountPercent > 0 ? discountPercent : undefined,
          promoDiscountFixed: discountFixed > 0 ? discountFixed : undefined,
        };
        if (isIndividual) {
          body.individualVoteCount = individualVoteCount;
        }
        const result = await apiRequest("POST", "/api/guest/checkout", body);

        const data = await result.json();
        setSuccess(true);
        setSuccessData({ transactionId: data.transactionId, votesAdded: data.votesAdded });
        toast({ title: "Purchase successful!", description: `${data.votesAdded} votes added!` });
      } catch (error: any) {
        toast({ title: "Checkout Failed", description: error.message?.replace(/^\d+:\s*/, "") || "Something went wrong", variant: "destructive" });
      } finally {
        setProcessing(false);
      }
    });
  }, [name, email, selectedPackage, cardNumber, expMonth, expYear, cvv, paymentConfig, competitionId, contestantId, createAccount, toast, isIndividual, individualVoteCount, referralCode, promoCode, promoResult, selectedPkg, perVotePrice, getPromoDiscount]);

  const handlePayClick = useCallback(() => {
    if (!validateCheckout()) return;
    setShowConfirmModal(true);
  }, [validateCheckout]);

  if (success && successData) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SiteNavbar />
        <div className="max-w-lg mx-auto px-4 py-32 text-center">
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-6" />
          <h2
            className="text-2xl uppercase font-normal mb-4"
            style={{ letterSpacing: "10px" }}
            data-testid="text-success-title"
          >
            PURCHASE COMPLETE
          </h2>
          <p className="text-white/60 mb-2" data-testid="text-votes-added">
            {successData.votesAdded} votes have been added for {contestant?.talentProfile?.displayName || "your chosen contestant"}!
          </p>
          <p className="text-white/40 text-sm mb-8" data-testid="text-transaction-id">
            Transaction ID: {successData.transactionId}
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link href={competition ? `/${slugify(competition.category)}/${slugify(competition.title)}` : "/competitions"}>
              <span
                className="inline-block bg-[#FF5A09] text-white font-bold text-sm uppercase px-8 leading-[47px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer"
                data-testid="button-back-competition"
              >
                Back to Competition
              </span>
            </Link>
            <Link href="/my-purchases">
              <span
                className="text-white/40 text-sm hover:text-white/60 transition-colors cursor-pointer"
                data-testid="link-view-purchases"
              >
                View Purchase History
              </span>
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (compLoading || pkgLoading) {
    return (
      <div className="min-h-screen bg-black">
        <SiteNavbar />
        <div className="max-w-2xl mx-auto px-4 py-32">
          <Skeleton className="h-8 w-1/2 mb-6 bg-white/10" />
          <Skeleton className="h-48 mb-4 bg-white/5" />
          <Skeleton className="h-48 bg-white/5" />
        </div>
      </div>
    );
  }

  if (!competition || !contestant) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <SiteNavbar />
        <div className="text-center">
          <ShoppingCart className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Invalid Checkout</h3>
          <p className="text-white/40 text-sm mb-6">Competition or contestant not found.</p>
          <Link href="/competitions">
            <Button variant="ghost" className="text-orange-400" data-testid="button-back">
              Back to Competitions
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
          <p className="text-black/50 text-base leading-relaxed mb-1">
            <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`} className="hover:text-[#FF5A09] transition-colors text-black/50" data-testid="link-back-comp">
              {competition.title}
            </Link>
            <span className="mx-2">/</span>
            Buy Votes
          </p>
          <h2
            className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none"
            style={{ letterSpacing: "10px" }}
            data-testid="text-page-title"
          >
            CHECKOUT
          </h2>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`} className="inline-flex items-center gap-2 text-white/40 text-sm mb-8 hover:text-white/60 transition-colors" data-testid="link-back">
          <ArrowLeft className="h-4 w-4" />
          Back to competition
        </Link>

        <div className="flex items-center gap-4 mb-10 p-4 border border-white/10">
          <div className="w-16 h-16 overflow-hidden flex-shrink-0">
            <img
              src={contestant.talentProfile.imageUrls?.[0] || getImage("talent_profile_fallback", "/images/template/a1.jpg")}
              alt={contestant.talentProfile.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider">Voting for</p>
            <h3 className="text-white font-bold uppercase" data-testid="text-contestant-name">
              {contestant.talentProfile.displayName}
            </h3>
            <p className="text-white/40 text-xs">{competition.title}</p>
          </div>
        </div>

        <div className="mb-10">
          <p className="text-[#5f5f5f] text-sm mb-1">Step 1</p>
          <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
            SELECT PACKAGE
          </h3>

          <div
            onClick={() => setSelectedPackage("individual")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedPackage("individual"); }}
            className={`w-full p-5 border text-left transition-all duration-300 cursor-pointer mb-4 ${
              isIndividual
                ? "border-[#FF5A09] bg-[#FF5A09]/10"
                : "border-white/10 hover:border-white/30"
            }`}
            data-testid="button-individual-votes"
          >
            <div className="flex items-center gap-3 mb-3">
              <Heart className={`h-5 w-5 ${isIndividual ? "text-[#FF5A09]" : "text-white/40"}`} />
              <span className="text-white font-bold uppercase text-sm" style={{ letterSpacing: "2px" }}>
                Buy Individual Votes
              </span>
              <span className="text-white/40 text-xs ml-auto">${perVotePrice.toFixed(2)} each</span>
            </div>
            {isIndividual && (
              <div className="flex items-center gap-4 mt-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIndividualVoteCount(Math.max(1, individualVoteCount - 1)); }}
                    className="w-8 h-8 border border-white/20 text-white flex items-center justify-center hover:border-[#FF5A09] transition-colors"
                    data-testid="button-decrease-votes"
                  >
                    -
                  </button>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={individualVoteCount}
                    onChange={(e) => setIndividualVoteCount(Math.max(1, Math.min(10000, parseInt(e.target.value) || 1)))}
                    className="w-20 bg-white/[0.08] border-white/20 text-white text-center"
                    data-testid="input-individual-vote-count"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIndividualVoteCount(Math.min(10000, individualVoteCount + 1)); }}
                    className="w-8 h-8 border border-white/20 text-white flex items-center justify-center hover:border-[#FF5A09] transition-colors"
                    data-testid="button-increase-votes"
                  >
                    +
                  </button>
                </div>
                <span className="text-white font-bold text-lg ml-auto">
                  ${(individualVoteCount * perVotePrice).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <p className="text-white/30 text-xs uppercase tracking-wider mb-3" style={{ letterSpacing: "2px" }}>Or choose a package</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {packages?.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`p-5 border text-left transition-all duration-300 cursor-pointer ${
                  selectedPackage === pkg.id
                    ? "border-[#FF5A09] bg-[#FF5A09]/10"
                    : "border-white/10 hover:border-white/30"
                }`}
                data-testid={`button-package-${pkg.id}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Package className={`h-5 w-5 ${selectedPackage === pkg.id ? "text-[#FF5A09]" : "text-white/40"}`} />
                  <span className="text-white font-bold uppercase text-sm" style={{ letterSpacing: "2px" }}>
                    {pkg.name}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-white/60 text-sm">
                    <Heart className="inline h-3.5 w-3.5 mr-1 text-[#FF5A09]" />
                    {pkg.voteCount.toLocaleString()} votes
                    {pkg.bonusVotes > 0 && (
                      <span className="text-[#FF5A09] font-bold ml-1">+{pkg.bonusVotes.toLocaleString()} bonus</span>
                    )}
                  </span>
                  <span className="text-white font-bold text-lg">
                    ${(pkg.price / 100).toFixed(2)}
                  </span>
                </div>
                {pkg.description && (
                  <p className="text-white/30 text-xs mt-2">{pkg.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <p className="text-[#5f5f5f] text-sm mb-1">Step 2</p>
          <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
            YOUR INFO
          </h3>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-white/60 uppercase text-xs tracking-wider">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Your full name"
                required
                data-testid="input-name"
              />
            </div>
            <div>
              <Label htmlFor="checkout-email" className="text-white/60 uppercase text-xs tracking-wider">
                Email
              </Label>
              <Input
                id="checkout-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="your@email.com"
                required
                data-testid="input-email"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer mt-4" data-testid="label-create-account">
              <input
                type="checkbox"
                checked={createAccount}
                onChange={(e) => setCreateAccount(e.target.checked)}
                className="w-4 h-4 accent-[#FF5A09]"
                data-testid="checkbox-create-account"
              />
              <span className="text-white/60 text-sm">
                Save my info to track purchases and vote history
              </span>
            </label>

            {/* Referral Code */}
            <div className="mt-4">
              <Label className="text-white/60 uppercase text-xs tracking-wider">
                Referral Code
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={referralCode}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setReferralCode(val);
                    if (val) localStorage.setItem("hfc_ref", val);
                    else localStorage.removeItem("hfc_ref");
                  }}
                  className="bg-white/[0.08] border-white/20 text-white"
                  placeholder="Enter referral code (optional)"
                  data-testid="input-checkout-referral-code"
                />
                {referralCode && (
                  <span className="text-green-400 text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Applied
                  </span>
                )}
              </div>
            </div>

            {/* CBUSA Promo Code */}
            <div className="mt-4">
              <Label className="text-white/60 uppercase text-xs tracking-wider flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Promo Code
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  ref={promoInputRef}
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    if (promoResult) setPromoResult(null);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && promoCode.trim()) handleValidatePromo(); }}
                  className={`bg-white/[0.08] border-white/20 text-white ${promoResult?.valid ? "border-green-500/60" : promoResult && !promoResult.valid ? "border-red-500/60" : ""}`}
                  placeholder="Enter promo code"
                  data-testid="input-promo-code"
                  disabled={promoValidating}
                />
                {promoResult?.valid ? (
                  <button
                    type="button"
                    onClick={clearPromo}
                    className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
                    data-testid="button-clear-promo"
                    title="Remove promo code"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleValidatePromo}
                    disabled={!promoCode.trim() || promoValidating}
                    className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-wider px-4 py-2 border border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    data-testid="button-validate-promo"
                  >
                    {promoValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {promoValidating ? "Checking..." : "Apply"}
                  </button>
                )}
              </div>
              {promoResult?.valid && promoResult.reward && (
                <div className="mt-2 flex items-start gap-2 text-green-400 text-xs" data-testid="text-promo-reward">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{promoResult.reward.description}</span>
                </div>
              )}
              {promoResult && !promoResult.valid && (
                <p className="mt-2 text-red-400 text-xs" data-testid="text-promo-invalid">
                  {promoResult.message || "Invalid promo code."}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-10">
          <p className="text-[#5f5f5f] text-sm mb-1">Step 3</p>
          <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
            PAYMENT
          </h3>

          <div className="space-y-4">
            <div>
              <Label htmlFor="card-number" className="text-white/60 uppercase text-xs tracking-wider">
                Card Number
              </Label>
              <Input
                id="card-number"
                name="cardnumber"
                autoComplete="cc-number"
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="4111 1111 1111 1111"
                maxLength={19}
                data-testid="input-card-number"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="exp-month" className="text-white/60 uppercase text-xs tracking-wider">
                  Month
                </Label>
                <Input
                  id="exp-month"
                  name="cc-exp-month"
                  autoComplete="cc-exp-month"
                  type="text"
                  inputMode="numeric"
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="bg-white/[0.08] border-white/20 text-white mt-2"
                  placeholder="MM"
                  maxLength={2}
                  data-testid="input-exp-month"
                />
              </div>
              <div>
                <Label htmlFor="exp-year" className="text-white/60 uppercase text-xs tracking-wider">
                  Year
                </Label>
                <Input
                  id="exp-year"
                  name="cc-exp-year"
                  autoComplete="cc-exp-year"
                  type="text"
                  inputMode="numeric"
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="bg-white/[0.08] border-white/20 text-white mt-2"
                  placeholder="YY"
                  maxLength={4}
                  data-testid="input-exp-year"
                />
              </div>
              <div>
                <Label htmlFor="cvv" className="text-white/60 uppercase text-xs tracking-wider">
                  CVV
                </Label>
                <Input
                  id="cvv"
                  name="cc-csc"
                  autoComplete="cc-csc"
                  type="text"
                  inputMode="numeric"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="bg-white/[0.08] border-white/20 text-white mt-2"
                  placeholder="123"
                  maxLength={4}
                  data-testid="input-cvv"
                />
              </div>
            </div>
          </div>
        </div>

        {(selectedPkg || isIndividual) && (() => {
          const subtotal = isIndividual ? (individualVoteCount * perVotePrice) : (selectedPkg!.price / 100);
          const voteLabel = isIndividual
            ? `${individualVoteCount.toLocaleString()} vote${individualVoteCount !== 1 ? "s" : ""}`
            : `${selectedPkg!.name} (${selectedPkg!.voteCount.toLocaleString()}${selectedPkg!.bonusVotes > 0 ? ` + ${selectedPkg!.bonusVotes.toLocaleString()} bonus` : ""} votes)`;
          const taxRate = platformSettings?.salesTaxPercent || 0;
          const { discountDollars } = getPromoDiscount(subtotal);
          const discountedSubtotal = Math.max(0, subtotal - discountDollars);
          const taxAmount = discountedSubtotal * (taxRate / 100);
          const total = discountedSubtotal + taxAmount;
          return (
            <div className="border border-white/10 p-5 mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60 text-sm uppercase tracking-wider">Order Summary</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white">{voteLabel}</span>
                <span className="text-white">${subtotal.toFixed(2)}</span>
              </div>
              {discountDollars > 0 && (
                <div className="flex items-center justify-between mb-1 text-green-400 text-sm">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    Promo: {promoCode}
                  </span>
                  <span>-${discountDollars.toFixed(2)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex items-center justify-between mb-1 text-white/50 text-sm">
                  <span>Sales Tax ({taxRate}%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                <span className="text-white font-bold">Total</span>
                <span className="text-orange-400 font-bold text-lg">${total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-white/40 text-sm mt-1">
                <span>For: {contestant.talentProfile.displayName}</span>
                <span>in {competition.title}</span>
              </div>
              {referralCode && (
                <div className="flex items-center gap-1.5 text-green-400 text-xs mt-2 pt-2 border-t border-white/10">
                  <CheckCircle className="h-3 w-3" />
                  <span>Referral code: {referralCode}</span>
                </div>
              )}
            </div>
          );
        })()}

        <button
          onClick={handlePayClick}
          disabled={processing || !selectedPackage || !acceptLoaded}
          className="w-full bg-[#FF5A09] text-white font-bold text-base uppercase px-8 leading-[52px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          data-testid="button-checkout"
        >
          <CreditCard className="h-5 w-5" />
          {processing ? "PROCESSING..." : (() => {
            if (!selectedPackage) return "SELECT A VOTE OPTION";
            const subtotal = isIndividual ? (individualVoteCount * perVotePrice) : (selectedPkg ? selectedPkg.price / 100 : 0);
            const { discountDollars } = getPromoDiscount(subtotal);
            const discountedSubtotal = Math.max(0, subtotal - discountDollars);
            const taxRate = platformSettings?.salesTaxPercent || 0;
            const total = discountedSubtotal * (1 + taxRate / 100);
            return `PAY $${total.toFixed(2)}`;
          })()}
        </button>

        <p className="text-white/30 text-xs text-center mt-4">
          Payments processed securely via Authorize.Net. Your card info never touches our servers.
        </p>

        {showConfirmModal && (() => {
          const subtotal = isIndividual ? (individualVoteCount * perVotePrice) : (selectedPkg ? selectedPkg.price / 100 : 0);
          const voteLabel = isIndividual
            ? `${individualVoteCount.toLocaleString()} vote${individualVoteCount !== 1 ? "s" : ""}`
            : selectedPkg ? `${selectedPkg.name} (${selectedPkg.voteCount.toLocaleString()}${selectedPkg.bonusVotes > 0 ? ` + ${selectedPkg.bonusVotes.toLocaleString()} bonus` : ""} votes)` : "";
          const taxRate = platformSettings?.salesTaxPercent || 0;
          const { discountDollars } = getPromoDiscount(subtotal);
          const discountedSubtotal = Math.max(0, subtotal - discountDollars);
          const taxAmount = discountedSubtotal * (taxRate / 100);
          const total = discountedSubtotal + taxAmount;
          const lineItems = [
            { label: "Contestant", value: contestant?.talentProfile?.displayName || "" },
            { label: "Competition", value: competition?.title || "" },
            { label: "Package", value: voteLabel },
            { label: "Subtotal", value: `$${subtotal.toFixed(2)}` },
            ...(discountDollars > 0 ? [{ label: `Promo (${promoCode})`, value: `-$${discountDollars.toFixed(2)}`, highlight: true }] : []),
            ...(taxRate > 0 ? [{ label: `Sales Tax (${taxRate}%)`, value: `$${taxAmount.toFixed(2)}` }] : []),
          ];
          if (referralCode) {
            lineItems.push({ label: "Referral Code", value: referralCode, highlight: true });
          }
          return (
            <PaymentConfirmationModal
              open={showConfirmModal}
              onClose={() => setShowConfirmModal(false)}
              onConfirm={processCheckout}
              processing={processing}
              title="Confirm Vote Purchase"
              description="Please review your order before proceeding."
              lineItems={lineItems}
              totalAmount={`$${total.toFixed(2)}`}
              confirmText={`PAY $${total.toFixed(2)}`}
              termsSummary={platformSettings?.termsSummary}
              termsFinePrint={platformSettings?.termsFinePrint}
            />
          );
        })()}
      </div>

      <SiteFooter />
    </div>
  );
}
