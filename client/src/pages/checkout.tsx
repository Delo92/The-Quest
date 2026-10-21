import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { ShoppingCart, CreditCard, CheckCircle, ArrowLeft, Heart, Package } from "lucide-react";
import PaymentConfirmationModal from "@/components/payment-confirmation-modal";
import { FallbackImage } from "@/components/fallback-image";
import { slugify } from "@shared/slugify";
import { confirmStripeCardPayment, type StripeInstance, type StripeCardHandle } from "@/lib/buyer-payment";
import { StripeCardField } from "@/components/stripe-card-field";
import { notifyVoteCountUpdated } from "@/lib/vote-count-events";

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
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
  coverImage?: string | null;
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
  provider?: "authorize" | "stripe" | "paypal";
  stripePublishableKey?: string | null;
  stripeConfigured?: boolean;
  paypalConfigured?: boolean;
}

interface AppliedCheckoutCode {
  kind: "discount" | "referral";
  code: string;
  orderKey: string;
  discountLabel?: string;
  discountAmountCents: number;
  subtotalCents: number;
  discountedSubtotalCents: number;
  taxAmountCents: number;
  totalAmountCents: number;
}

function CheckoutStepHeading({ number, title, hint }: { number: number; title: string; hint?: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#FF5A09]/70 bg-[#FF5A09]/10 font-['Bebas_Neue'] text-lg text-[#ff9a6d]">
        {number}
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff9a6d]">Step {number}</p>
        <h3 className="text-lg font-normal uppercase text-white" style={{ letterSpacing: "5px" }}>
          {title}
        </h3>
      </div>
      {hint && <p className="ml-auto hidden text-right text-xs text-white/55 sm:block">{hint}</p>}
    </div>
  );
}

export default function CheckoutPage() {
  const paymentIdempotencyKey = useRef(crypto.randomUUID());
  const params = useParams<{ competitionId: string; contestantId: string }>();
  const competitionId = params?.competitionId ? parseInt(params.competitionId) : null;
  const contestantId = params?.contestantId ? parseInt(params.contestantId) : null;
  const stageId = new URLSearchParams(window.location.search).get("stageId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { getImage, getMedia } = useLivery();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [individualVoteCount, setIndividualVoteCount] = useState<number>(1);
  const [createAccount, setCreateAccount] = useState(true);
  const [cardNumber, setCardNumber] = useState("");
  const [stripeCard, setStripeCard] = useState<StripeCardHandle | null>(null);
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [billingAddress, setBillingAddress] = useState({
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ transactionId: string; votesAdded: number } | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [appliedCheckoutCode, setAppliedCheckoutCode] = useState<AppliedCheckoutCode | null>(null);
  const [codeApplying, setCodeApplying] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [acceptLoaded, setAcceptLoaded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const codeValidationRequestId = useRef(0);
  const pendingSavedReferralCode = useRef<string | null>(null);

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
    if (authLoading || !authUser) return;

    setName((current) => current.trim() ? current : authUser.displayName?.trim() || "");
    setEmail((current) => current.trim() ? current : authUser.email || "");

    const savedAddress = authUser.billingAddress;
    if (!savedAddress) return;
    setBillingAddress((current) => ({
      address: current.address.trim() ? current.address : savedAddress.street || "",
      city: current.city.trim() ? current.city : savedAddress.city || "",
      state: current.state.trim() ? current.state : savedAddress.state || "",
      zip: current.zip.trim() ? current.zip : savedAddress.zip || "",
    }));
  }, [authLoading, authUser]);

  useEffect(() => {
    const savedRef = localStorage.getItem("hfc_ref");
    if (savedRef) {
      setReferralCode(savedRef);
      pendingSavedReferralCode.current = savedRef;
    }
  }, []);

  useEffect(() => {
    if (paymentConfig?.provider === "authorize" && !acceptLoaded) {
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
  const currentCodeOrderKey = [
    competitionId || "",
    contestantId || "",
    stageId || "",
    selectedPackage,
    isIndividual ? individualVoteCount : "",
  ].join(":");
  const currentCodeOrderKeyRef = useRef(currentCodeOrderKey);
  currentCodeOrderKeyRef.current = currentCodeOrderKey;
  const activeAppliedCode = appliedCheckoutCode?.orderKey === currentCodeOrderKey ? appliedCheckoutCode : null;
  const codePending = codeApplying || Boolean(pendingSavedReferralCode.current && selectedPackage);
  const subtotalCents = isIndividual
    ? Math.max(0, Math.round(individualVoteCount * perVotePrice * 100))
    : selectedPkg?.price || 0;
  const taxRate = Number(platformSettings?.salesTaxPercent || 0);
  const calculatedTaxCents = Math.round(subtotalCents * (taxRate / 100));
  const discountedSubtotalCents = activeAppliedCode?.discountedSubtotalCents ?? subtotalCents;
  const taxAmountCents = activeAppliedCode?.taxAmountCents ?? calculatedTaxCents;
  const totalAmountCents = activeAppliedCode?.totalAmountCents ?? subtotalCents + calculatedTaxCents;
  const noPaymentDue = activeAppliedCode?.kind === "discount" && totalAmountCents === 0;
  const paymentSystemReady = noPaymentDue
    ? Boolean(paymentConfig?.provider === "stripe" && paymentConfig.stripeConfigured)
    : paymentConfig?.provider === "stripe"
      ? Boolean(paymentConfig.stripeConfigured && stripeCard?.complete)
      : paymentConfig?.provider === "paypal"
        ? Boolean(paymentConfig.paypalConfigured)
        : Boolean(paymentConfig && window.Accept && acceptLoaded);
  const previousCodeOrderKey = useRef(currentCodeOrderKey);

  useEffect(() => {
    const previousOrderKey = previousCodeOrderKey.current;
    if (previousOrderKey !== currentCodeOrderKey) {
      previousCodeOrderKey.current = currentCodeOrderKey;
      codeValidationRequestId.current += 1;
      setAppliedCheckoutCode(null);
      setCodeApplying(false);
      setCodeError("");
      paymentIdempotencyKey.current = crypto.randomUUID();
      pendingSavedReferralCode.current = selectedPackage ? localStorage.getItem("hfc_ref") : null;
    }
  }, [currentCodeOrderKey]);

  const applyCheckoutCode = async (codeOverride?: string) => {
    const codeToApply = codeOverride ?? referralCode;
    if (!codeToApply.trim()) {
      setAppliedCheckoutCode(null);
      setCodeError("");
      localStorage.removeItem("hfc_ref");
      return;
    }
    if (!selectedPackage) {
      setCodeError("Choose a vote option before applying a code.");
      return;
    }

    const requestId = ++codeValidationRequestId.current;
    const orderKey = currentCodeOrderKey;
    setCodeApplying(true);
    setCodeError("");
    try {
      const pkgIndex = selectedPackage.startsWith("pkg_")
        ? Number.parseInt(selectedPackage.replace("pkg_", ""), 10)
        : undefined;
      const response = await apiRequest("POST", "/api/guest/checkout/validate-code", {
        code: codeToApply.trim(),
        competitionId,
        contestantId,
        stageId: stageId || undefined,
        packageId: selectedPackage,
        packageIndex: isIndividual ? undefined : pkgIndex,
        individualVoteCount: isIndividual ? individualVoteCount : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not validate this code.");
      if (requestId !== codeValidationRequestId.current || orderKey !== currentCodeOrderKeyRef.current) return;
      if (!data.valid) {
        setAppliedCheckoutCode(null);
        setCodeError(data.message || "That code is not an active discount or referral code.");
        localStorage.removeItem("hfc_ref");
        return;
      }

      const applied: AppliedCheckoutCode = {
        kind: data.kind,
        code: data.code,
        orderKey,
        discountLabel: data.discountLabel,
        discountAmountCents: data.discountAmountCents,
        subtotalCents: data.subtotalCents,
        discountedSubtotalCents: data.discountedSubtotalCents,
        taxAmountCents: data.taxAmountCents,
        totalAmountCents: data.totalAmountCents,
      };
      setAppliedCheckoutCode(applied);
      setReferralCode(data.code);
      paymentIdempotencyKey.current = crypto.randomUUID();
      if (data.kind === "referral") localStorage.setItem("hfc_ref", data.code);
      else localStorage.removeItem("hfc_ref");
    } catch (error: any) {
      if (requestId === codeValidationRequestId.current && orderKey === currentCodeOrderKeyRef.current) {
        setAppliedCheckoutCode(null);
        setCodeError(error.message?.replace(/^\d+:\s*/, "") || "Could not validate this code.");
      }
    } finally {
      if (requestId === codeValidationRequestId.current) setCodeApplying(false);
    }
  };

  useEffect(() => {
    const savedCode = pendingSavedReferralCode.current;
    if (!savedCode || !selectedPackage) return;
    pendingSavedReferralCode.current = null;
    void applyCheckoutCode(savedCode);
  }, [currentCodeOrderKey]);

  const validateCheckout = useCallback(() => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Please enter your name and email", variant: "destructive" });
      return false;
    }
    if (!selectedPackage) {
      toast({ title: "Please select a vote option", variant: "destructive" });
      return false;
    }
    if (codePending) {
      toast({ title: "Please wait while your code is checked", variant: "destructive" });
      return false;
    }
    if (isIndividual && (individualVoteCount < 1 || individualVoteCount > 10000)) {
      toast({ title: "Please enter a valid number of votes (1-10,000)", variant: "destructive" });
      return false;
    }
    if (!noPaymentDue && (paymentConfig?.provider === "stripe" ? !stripeCard?.complete : paymentConfig?.provider !== "paypal" && (!cardNumber || !expMonth || !expYear || !cvv))) {
      toast({ title: "Please enter your card details", variant: "destructive" });
      return false;
    }
    if (!billingAddress.address.trim() || !billingAddress.city.trim() || !billingAddress.state.trim() || !billingAddress.zip.trim()) {
      toast({ title: "Please enter your billing address", variant: "destructive" });
      return false;
    }
    const paymentReady = noPaymentDue
      ? Boolean(paymentConfig?.provider === "stripe" && paymentConfig.stripeConfigured)
      : paymentConfig?.provider === "paypal"
      ? Boolean(paymentConfig.paypalConfigured)
      : paymentConfig?.provider === "stripe"
        ? Boolean(paymentConfig.stripeConfigured && stripeCard?.stripe)
        : Boolean(paymentConfig && window.Accept);
    if (!paymentReady) {
      toast({ title: "Donation processing is unavailable. Please try again.", variant: "destructive" });
      return false;
    }
    return true;
  }, [name, email, selectedPackage, isIndividual, individualVoteCount, cardNumber, expMonth, expYear, cvv, billingAddress, paymentConfig, stripeCard, noPaymentDue, codePending, toast]);

  const processCheckout = useCallback(async () => {
    setShowConfirmModal(false);
    setProcessing(true);

    const pkgIndex = selectedPackage?.startsWith("pkg_") ? parseInt(selectedPackage.replace("pkg_", "")) : undefined;
    const checkoutBody: any = {
      idempotencyKey: paymentIdempotencyKey.current,
      name: name.trim(),
      email: email.trim(),
      competitionId,
      contestantId,
      stageId: stageId || undefined,
      packageId: selectedPackage,
      packageIndex: isIndividual ? undefined : pkgIndex,
      createAccount,
      referralCode: activeAppliedCode?.kind === "referral" ? activeAppliedCode.code : undefined,
      promoCode: activeAppliedCode?.kind === "discount" ? activeAppliedCode.code : undefined,
      billingAddress,
      paymentProvider: paymentConfig?.provider || "authorize",
    };
    if (isIndividual) checkoutBody.individualVoteCount = individualVoteCount;

    if (paymentConfig?.provider === "paypal") {
      try {
        sessionStorage.setItem("quest_paypal_checkout", JSON.stringify(checkoutBody));
        const response = await apiRequest("POST", "/api/guest/checkout/paypal-order", checkoutBody);
        const order = await response.json();
        if (!order.approvalUrl) throw new Error("PayPal did not return an approval link.");
        window.location.assign(order.approvalUrl);
      } catch (error: any) {
        setProcessing(false);
        toast({ title: "PayPal checkout failed", description: error.message?.replace(/^\d+:\s*/, "") || "Unable to start PayPal checkout", variant: "destructive" });
      }
      return;
    }

    if (paymentConfig?.provider === "stripe") {
      try {
        let stripePaymentIntentId: string | undefined;
        if (!noPaymentDue) {
          const result = await confirmStripeCardPayment({
            publishableKey: paymentConfig.stripePublishableKey!,
            purpose: "vote",
            intentPath: "/api/guest/checkout/stripe-intent",
            intentPayload: checkoutBody,
            cardHandle: stripeCard,
            name, email, billingAddress,
          });
          stripePaymentIntentId = result.paymentIntentId;
        }
        const resultResponse = await apiRequest("POST", "/api/guest/checkout", {
          ...checkoutBody,
          ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
        });
        const data = await resultResponse.json();
        notifyVoteCountUpdated();
        setSuccess(true);
        setSuccessData({ transactionId: data.transactionId, votesAdded: data.votesAdded });
        toast({ title: "Vote support complete", description: `${data.votesAdded} votes added!` });
      } catch (error: any) {
        toast({ title: "Checkout Failed", description: error.message?.replace(/^\d+:\s*/, "") || "Something went wrong", variant: "destructive" });
      } finally {
        setProcessing(false);
      }
      return;
    }

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
          toast({ title: "Donation Error", description: errMsg, variant: "destructive" });
        return;
      }

      if (!tokenResponse.opaqueData) {
        setProcessing(false);
        toast({ title: "Donation Error", description: "Card details could not be securely prepared.", variant: "destructive" });
        return;
      }

      try {
         const body = {
           ...checkoutBody,
           dataDescriptor: tokenResponse.opaqueData.dataDescriptor,
           dataValue: tokenResponse.opaqueData.dataValue,
         };
        const result = await apiRequest("POST", "/api/guest/checkout", body);

        const data = await result.json();
        notifyVoteCountUpdated();
        setSuccess(true);
        setSuccessData({ transactionId: data.transactionId, votesAdded: data.votesAdded });
        toast({ title: "Vote support complete", description: `${data.votesAdded} votes added!` });
      } catch (error: any) {
        toast({ title: "Checkout Failed", description: error.message?.replace(/^\d+:\s*/, "") || "Something went wrong", variant: "destructive" });
      } finally {
        setProcessing(false);
      }
    });
  }, [name, email, selectedPackage, cardNumber, expMonth, expYear, cvv, billingAddress, paymentConfig, competitionId, contestantId, createAccount, toast, isIndividual, individualVoteCount, activeAppliedCode, noPaymentDue, stageId, stripeCard]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalOrderId = params.get("token");
    if (params.get("paypalReturn") !== "1" || !paypalOrderId) return;
    const saved = sessionStorage.getItem("quest_paypal_checkout");
    if (!saved) return;
    try {
      const body = { ...JSON.parse(saved), paypalOrderId, paymentProvider: "paypal" };
      setProcessing(true);
      apiRequest("POST", "/api/guest/checkout", body)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "PayPal payment could not be completed.");
          notifyVoteCountUpdated();
          setSuccess(true);
          setSuccessData({ transactionId: data.transactionId, votesAdded: data.votesAdded });
          sessionStorage.removeItem("quest_paypal_checkout");
          toast({ title: "Vote support complete", description: `${data.votesAdded} votes added!` });
        })
        .catch((error: any) => toast({ title: "PayPal checkout failed", description: error.message, variant: "destructive" }))
        .finally(() => setProcessing(false));
    } catch {
      toast({ title: "PayPal checkout failed", description: "Your checkout session could not be restored.", variant: "destructive" });
      setProcessing(false);
    }
  }, [toast]);

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
            VOTE SUPPORT COMPLETE
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
                View Vote Support History
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
        {(() => { const m = getMedia("breadcrumb_bg"); return m.type === "video" && m.url ? (
          <video src={m.url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : m.url ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${m.url}')` }} />
        ) : <div className="absolute inset-0 bg-zinc-950" />; })()}
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm text-center pt-8 pb-5 px-8 z-10 w-[calc(100%-60px)] max-w-[552px]">
          <p className="text-black/50 text-base leading-relaxed mb-1">
            <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`} className="hover:text-[#FF5A09] transition-colors text-black/50" data-testid="link-back-comp">
              {competition.title}
            </Link>
            <span className="mx-2">/</span>
              Donate &amp; Vote
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
        <Link href={`/${slugify(competition.category)}/${slugify(competition.title)}`} className="inline-flex min-h-10 items-center gap-2 text-white/65 text-sm mb-8 underline decoration-white/30 underline-offset-4 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]" data-testid="link-back">
          <ArrowLeft className="h-4 w-4" />
          Back to competition
        </Link>

        <div className="flex items-center gap-4 mb-10 p-4 border border-white/20 border-l-4 border-l-[#FF5A09] bg-white/[0.025]">
          <div className="w-16 h-16 overflow-hidden flex-shrink-0">
            <FallbackImage
              src={contestant.talentProfile.imageUrls?.[0] || (contestant as any).videoThumbnail || competition.coverImage || getImage("talent_profile_fallback") || undefined}
              fallbackSrc={(contestant as any).videoThumbnail || competition.coverImage}
              fallbackSrcs={[competition.coverImage, getImage("talent_profile_fallback")]}
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

        <div className="mb-8 border border-emerald-300/35 bg-emerald-950/35 p-4 text-sm leading-relaxed text-emerald-50/85" data-testid="vote-nonprofit-disclosure">
          <p className="font-semibold text-emerald-100">Your vote donation is received by The Quest.</p>
          <p className="mt-2">
            This donation is received by The Quest to add votes; it is not sent directly to a nonprofit at checkout. Contestants and hosts choose an eligible nonprofit and allocate 1%–10% of their eligible earnings (10% by default). The Quest matches those recorded contributions dollar-for-dollar. Recipient and amount are set through the participant payout process, not by this checkout.
          </p>
          <Link href="/NonProfits" className="mt-3 inline-flex min-h-9 items-center font-semibold text-emerald-200 underline decoration-emerald-200/50 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200" data-testid="link-checkout-nonprofits">
            See how nonprofit giving works
          </Link>
        </div>

        <div className="mb-10">
          <CheckoutStepHeading number={1} title="Choose vote support" hint="Select a contribution amount" />

          <div
            className={`mb-4 overflow-hidden border transition-colors ${
              isIndividual
                ? "border-[#FF5A09] bg-[#FF5A09]/[0.09] shadow-[inset_0_0_0_1px_rgba(255,90,9,0.42)]"
                : "border-white/30 bg-[#171918] hover:border-[#ff9a6d]/80"
            }`}
          >
            <button
              type="button"
              aria-pressed={isIndividual}
              onClick={() => setSelectedPackage("individual")}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF5A09]"
              data-testid="button-individual-votes"
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isIndividual ? "border-[#FF5A09] bg-[#FF5A09]" : "border-white/55"
                }`}
              >
                {isIndividual && <CheckCircle className="h-4 w-4 text-white" />}
              </span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-sm ${
                isIndividual ? "bg-[#FF5A09]/15 text-[#ff9a6d]" : "bg-white/[0.07] text-white/70"
              }`}>
                <Heart className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-white font-bold uppercase text-sm tracking-[0.12em]">
                  Donate for Individual Votes
                </span>
                <span className="mt-0.5 block text-xs text-white/60">Add as many as you need</span>
              </span>
              <span className="ml-auto whitespace-nowrap rounded-sm border border-white/25 px-2.5 py-1 text-sm font-semibold text-white">
                ${perVotePrice.toFixed(2)} each
              </span>
            </button>
            {isIndividual && (
              <div className="flex flex-wrap items-center gap-3 border-t border-[#FF5A09]/35 bg-black/20 px-4 py-3">
                <span className="text-xs uppercase tracking-wider text-white/65">Number of votes</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease vote count"
                    onClick={() => setIndividualVoteCount(Math.max(1, individualVoteCount - 1))}
                    className="flex h-10 w-10 items-center justify-center border border-white/35 bg-white/[0.05] text-white transition-colors hover:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]"
                    data-testid="button-decrease-votes"
                  >
                    −
                  </button>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={individualVoteCount}
                    onChange={(e) => setIndividualVoteCount(Math.max(1, Math.min(10000, parseInt(e.target.value) || 1)))}
                    className="h-10 w-20 border-white/30 bg-[#111] text-center text-white focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                    data-testid="input-individual-vote-count"
                  />
                  <button
                    type="button"
                    aria-label="Increase vote count"
                    onClick={() => setIndividualVoteCount(Math.min(10000, individualVoteCount + 1))}
                    className="flex h-10 w-10 items-center justify-center border border-white/35 bg-white/[0.05] text-white transition-colors hover:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]"
                    data-testid="button-increase-votes"
                  >
                    +
                  </button>
                </div>
                <span className="min-w-16 text-right text-white font-bold text-lg">
                  ${(individualVoteCount * perVotePrice).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <p className="pt-2 text-white/65 text-xs font-semibold uppercase tracking-[0.16em] mb-3">Or choose a vote contribution</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {packages?.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                aria-pressed={selectedPackage === pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`group relative min-h-36 p-4 sm:p-5 border-2 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111] ${
                  selectedPackage === pkg.id
                    ? "border-[#FF5A09] bg-[#FF5A09]/[0.1] shadow-[inset_0_0_0_1px_rgba(255,90,9,0.38)]"
                    : "border-white/30 bg-[#171918] hover:border-[#ff9a6d] hover:bg-[#211b18]"
                }`}
                data-testid={`button-package-${pkg.id}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selectedPackage === pkg.id ? "border-[#FF5A09] bg-[#FF5A09]" : "border-white/55"
                      }`}
                    >
                      {selectedPackage === pkg.id && <CheckCircle className="h-4 w-4 text-white" />}
                    </span>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${
                      selectedPackage === pkg.id ? "bg-[#FF5A09]/15 text-[#ff9a6d]" : "bg-white/[0.07] text-white/70"
                    }`}>
                      <Package className="h-4 w-4" />
                    </span>
                    <span className="text-white font-bold uppercase text-sm tracking-[0.1em]">
                      {pkg.name}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    selectedPackage === pkg.id
                      ? "bg-[#FF5A09] text-white"
                      : "border border-white/25 text-white/70 group-hover:border-[#ff9a6d]/70 group-hover:text-[#ffb28b]"
                  }`}>
                    {selectedPackage === pkg.id ? "Selected" : "Choose"}
                  </span>
                </span>
                <span className="mt-4 flex items-end justify-between gap-2">
                  <span className="text-white/80 text-sm">
                    <Heart className="inline h-3.5 w-3.5 mr-1 text-[#FF5A09]" />
                    {pkg.voteCount.toLocaleString()} votes
                    {pkg.bonusVotes > 0 && (
                      <span className="text-[#FF5A09] font-bold ml-1">+{pkg.bonusVotes.toLocaleString()} bonus</span>
                    )}
                  </span>
                  <span className="text-white font-bold text-lg">
                    ${(pkg.price / 100).toFixed(2)}
                  </span>
                </span>
                {pkg.description && (
                  <span className="mt-2 block text-xs text-white/55">{pkg.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-10 border-t border-white/15 pt-8">
          <CheckoutStepHeading number={2} title="Your info" hint="Required fields marked *" />

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-white/80 uppercase text-xs tracking-wider">
                Full Name <span className="text-[#ff9a6d]">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 min-h-11 border-white/30 bg-[#171918] text-white transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                placeholder="Your full name"
                required
                data-testid="input-name"
              />
            </div>
            <div>
              <Label htmlFor="checkout-email" className="text-white/80 uppercase text-xs tracking-wider">
                Email <span className="text-[#ff9a6d]">*</span>
              </Label>
              <Input
                id="checkout-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 min-h-11 border-white/30 bg-[#171918] text-white transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                placeholder="your@email.com"
                required
                data-testid="input-email"
              />
            </div>
            <div className="border-t border-white/15 pt-4 mt-5">
              <p className="mb-3 flex items-center justify-between text-white/80 uppercase text-xs tracking-wider">
                Billing Address
                <span className="rounded-sm border border-white/20 px-2 py-1 text-[10px] text-white/55">Optional</span>
              </p>
              <div className="space-y-3">
                <Input
                  aria-label="Billing street address"
                  autoComplete="billing street-address"
                  value={billingAddress.address}
                  onChange={(e) => setBillingAddress((current) => ({ ...current, address: e.target.value }))}
                  className="min-h-11 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                  placeholder="Street address"
                  data-testid="input-billing-address"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    aria-label="Billing city"
                    autoComplete="billing address-level2"
                    value={billingAddress.city}
                    onChange={(e) => setBillingAddress((current) => ({ ...current, city: e.target.value }))}
                    className="min-h-11 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                    placeholder="City"
                    data-testid="input-billing-city"
                  />
                  <Input
                    aria-label="Billing state"
                    autoComplete="billing address-level1"
                    value={billingAddress.state}
                    onChange={(e) => setBillingAddress((current) => ({ ...current, state: e.target.value }))}
                    className="min-h-11 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                    placeholder="State"
                    data-testid="input-billing-state"
                  />
                  <Input
                    aria-label="Billing ZIP code"
                    autoComplete="billing postal-code"
                    value={billingAddress.zip}
                    onChange={(e) => setBillingAddress((current) => ({ ...current, zip: e.target.value }))}
                    className="min-h-11 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                    placeholder="ZIP code"
                    data-testid="input-billing-zip"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer mt-4" data-testid="label-create-account">
              <input
                type="checkbox"
                checked={createAccount}
                onChange={(e) => setCreateAccount(e.target.checked)}
                className="h-5 w-5 accent-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111]"
                data-testid="checkbox-create-account"
              />
              <span className="text-white/80 text-sm">
                 Save my info to track vote contributions and history
              </span>
            </label>

            <div className="mt-4">
              <Label htmlFor="input-checkout-referral-code" className="text-white/80 uppercase text-xs tracking-wider">
                Promo or Referral Code
              </Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="input-checkout-referral-code"
                  value={referralCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    codeValidationRequestId.current += 1;
                    pendingSavedReferralCode.current = null;
                    setReferralCode(val);
                    setAppliedCheckoutCode(null);
                    setCodeApplying(false);
                    setCodeError("");
                    paymentIdempotencyKey.current = crypto.randomUUID();
                    localStorage.removeItem("hfc_ref");
                  }}
                  className="min-h-11 min-w-0 flex-1 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                  placeholder="Enter code (optional)"
                  data-testid="input-checkout-referral-code"
                />
                <Button
                  type="button"
                  onClick={() => applyCheckoutCode()}
                  disabled={codePending || !referralCode.trim() || !selectedPackage}
                  className="min-h-11 w-full bg-white/10 text-white hover:bg-white/15 disabled:opacity-50 sm:w-auto"
                  data-testid="button-apply-checkout-code"
                >
                  {codeApplying ? "Checking…" : "Apply code"}
                </Button>
              </div>
              {activeAppliedCode && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-green-400" role="status" aria-live="polite">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  {activeAppliedCode.kind === "discount"
                    ? `Discount applied: ${activeAppliedCode.discountLabel} ($${(activeAppliedCode.discountAmountCents / 100).toFixed(2)} off)`
                    : `Referral tracked: ${activeAppliedCode.code}`}
                </p>
              )}
              {codeError && <p className="mt-2 text-xs text-red-300" role="alert">{codeError}</p>}
              <p className="mt-2 text-xs text-white/45">
                Discounts reduce the donation amount; referrals track where votes came from without changing the total.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10 border-t border-white/15 pt-8">
          <CheckoutStepHeading number={3} title="Donation details" hint={noPaymentDue ? "No donation balance is due" : "Your card details stay secure"} />

          <div className="space-y-4">
            {paymentConfig?.provider === "stripe" ? (
              noPaymentDue ? (
                <p className="border border-green-400/25 bg-green-400/[0.06] px-4 py-3 text-sm text-green-200" role="status">
                  Your discount covers this vote donation. No additional donation is due.
                </p>
              ) : (
                <StripeCardField publishableKey={paymentConfig.stripePublishableKey || ""} onChange={setStripeCard} />
              )
            ) : paymentConfig?.provider !== "paypal" ? (<>
            <div>
              <Label htmlFor="card-number" className="text-white/80 uppercase text-xs tracking-wider">
                Card Number <span className="text-[#ff9a6d]">*</span>
              </Label>
              <Input
                id="card-number"
                name="cardnumber"
                autoComplete="cc-number"
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                className="mt-2 min-h-11 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                placeholder="4111 1111 1111 1111"
                maxLength={19}
                data-testid="input-card-number"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div>
                <Label htmlFor="exp-month" className="text-white/80 uppercase text-xs tracking-wider">
                  Month <span className="text-[#ff9a6d]">*</span>
                </Label>
                <Input
                  id="exp-month"
                  name="cc-exp-month"
                  autoComplete="cc-exp-month"
                  type="text"
                  inputMode="numeric"
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="mt-2 min-h-11 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                  placeholder="MM"
                  maxLength={2}
                  data-testid="input-exp-month"
                />
              </div>
              <div>
                <Label htmlFor="exp-year" className="text-white/80 uppercase text-xs tracking-wider">
                  Year <span className="text-[#ff9a6d]">*</span>
                </Label>
                <Input
                  id="exp-year"
                  name="cc-exp-year"
                  autoComplete="cc-exp-year"
                  type="text"
                  inputMode="numeric"
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="mt-2 min-h-11 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                  placeholder="YY"
                  maxLength={4}
                  data-testid="input-exp-year"
                />
              </div>
              <div>
                <Label htmlFor="cvv" className="text-white/80 uppercase text-xs tracking-wider">
                  CVV <span className="text-[#ff9a6d]">*</span>
                </Label>
                <Input
                  id="cvv"
                  name="cc-csc"
                  autoComplete="cc-csc"
                  type="text"
                  inputMode="numeric"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="mt-2 min-h-11 border-white/30 bg-[#171918] text-white placeholder:text-white/40 transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50"
                  placeholder="123"
                  maxLength={4}
                  data-testid="input-cvv"
                />
              </div>
            </div>
            </>) : null}
          </div>
        </div>

        {(selectedPkg || isIndividual) && (() => {
          const voteLabel = isIndividual
            ? `${individualVoteCount.toLocaleString()} vote${individualVoteCount !== 1 ? "s" : ""}`
            : `${selectedPkg!.name} (${selectedPkg!.voteCount.toLocaleString()}${selectedPkg!.bonusVotes > 0 ? ` + ${selectedPkg!.bonusVotes.toLocaleString()} bonus` : ""} votes)`;
          const discountAmount = activeAppliedCode?.kind === "discount" ? activeAppliedCode.discountAmountCents / 100 : 0;
          const total = totalAmountCents / 100;
          return (
            <div className="border border-white/20 border-l-4 border-l-[#FF5A09] bg-white/[0.025] p-5 mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60 text-sm uppercase tracking-wider">Vote contribution summary</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white">{voteLabel}</span>
                <span className="text-white">${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between mb-1 text-green-300 text-sm">
                  <span>Discount ({activeAppliedCode?.code})</span>
                  <span>−${discountAmount.toFixed(2)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex items-center justify-between mb-1 text-white/50 text-sm">
                  <span>Sales Tax ({taxRate}%)</span>
                  <span>${(taxAmountCents / 100).toFixed(2)}</span>
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
              {activeAppliedCode?.kind === "discount" && (
                <div className="flex items-center gap-1.5 text-green-400 text-xs mt-2 pt-2 border-t border-white/10">
                  <CheckCircle className="h-3 w-3" />
                  <span>Discount applied: {activeAppliedCode.code}</span>
                </div>
              )}
              {activeAppliedCode?.kind === "referral" && (
                <div className="flex items-center gap-1.5 text-green-400 text-xs mt-2 pt-2 border-t border-white/10">
                  <CheckCircle className="h-3 w-3" />
                  <span>Referral tracked: {activeAppliedCode.code}</span>
                </div>
              )}
            </div>
          );
        })()}

        <button
          onClick={handlePayClick}
          disabled={processing || !selectedPackage || !paymentSystemReady || codePending}
          className="w-full min-h-14 bg-[#FF5A09] text-white font-bold text-base uppercase px-8 border border-[#FF5A09] transition-all duration-200 hover:bg-[#ff7434] active:scale-[0.99] cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-white/10 disabled:text-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111] flex items-center justify-center gap-2 motion-reduce:transform-none motion-reduce:transition-none"
          data-testid="button-checkout"
        >
          {noPaymentDue ? <CheckCircle className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
          {processing
            ? "PROCESSING..."
            : (selectedPkg || isIndividual)
              ? noPaymentDue ? "COMPLETE FREE VOTE SUPPORT" : `DONATE $${(totalAmountCents / 100).toFixed(2)} & VOTE`
              : "SELECT A VOTE CONTRIBUTION"}
        </button>

        {!selectedPackage && (
              <p className="text-white/55 text-xs text-center mt-2">
            Choose a vote contribution above to see your total and continue.
          </p>
        )}

        <p className="text-white/30 text-xs text-center mt-4">
          {noPaymentDue
            ? "Your promo code covers the vote donation; no additional donation is due."
            : "Donations are processed securely by The Quest. Your card details never touch our servers."}
        </p>

        {showConfirmModal && (() => {
          const voteLabel = isIndividual
            ? `${individualVoteCount.toLocaleString()} vote${individualVoteCount !== 1 ? "s" : ""}`
            : selectedPkg ? `${selectedPkg.name} (${selectedPkg.voteCount.toLocaleString()}${selectedPkg.bonusVotes > 0 ? ` + ${selectedPkg.bonusVotes.toLocaleString()} bonus` : ""} votes)` : "";
          const discountAmount = activeAppliedCode?.kind === "discount" ? activeAppliedCode.discountAmountCents / 100 : 0;
          const total = totalAmountCents / 100;
          const lineItems: Array<{ label: string; value: string; highlight?: boolean }> = [
            { label: "Contestant", value: contestant?.talentProfile?.displayName || "" },
            { label: "Competition", value: competition?.title || "" },
            { label: "Package", value: voteLabel },
            { label: "Subtotal", value: `$${(subtotalCents / 100).toFixed(2)}` },
            ...(discountAmount > 0 ? [{ label: `Discount (${activeAppliedCode?.code})`, value: `−$${discountAmount.toFixed(2)}`, highlight: true }] : []),
            ...(taxRate > 0 ? [{ label: `Sales Tax (${taxRate}%)`, value: `$${(taxAmountCents / 100).toFixed(2)}` }] : []),
          ];
          if (activeAppliedCode?.kind === "referral") {
            lineItems.push({ label: "Referral tracked", value: activeAppliedCode.code, highlight: true });
          } else if (activeAppliedCode?.kind === "discount") {
            lineItems.push({ label: "Discount applied", value: activeAppliedCode.code, highlight: true });
          }
          return (
            <PaymentConfirmationModal
              open={showConfirmModal}
              onClose={() => setShowConfirmModal(false)}
              onConfirm={processCheckout}
              processing={processing}
              title="Confirm Vote Contribution"
              description={noPaymentDue ? "Your promo code covers this vote donation; no additional donation is due." : "Your donation adds votes and is received by The Quest, not sent directly to a nonprofit. Please review the details before continuing."}
              lineItems={lineItems}
              totalAmount={`$${total.toFixed(2)}`}
              confirmText={noPaymentDue ? "COMPLETE FREE VOTE SUPPORT" : `DONATE $${total.toFixed(2)} & VOTE`}
              termsContext="vote"
              termsFinePrint={platformSettings?.termsFinePrint}
            />
          );
        })()}
      </div>

      <SiteFooter />
    </div>
  );
}
