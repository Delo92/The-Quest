import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { confirmStripeCardPayment, createPayPalRedirect, loadStripeScript, type BuyerPaymentConfig } from "@/lib/buyer-payment";
import type { StripeCardHandle } from "@/lib/buyer-payment";
import { StripeCardField } from "@/components/stripe-card-field";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { CheckCircle, CreditCard, Search, Trophy, UserPlus, Upload, X, Loader2, ImageIcon, Sparkles, Crop } from "lucide-react";
import PaymentConfirmationModal from "@/components/payment-confirmation-modal";
import ImageCropDialog, { type ImageCropPosition } from "@/components/image-crop-dialog";
import { DEFAULT_TALENT_IMAGE_CROP_POSITION } from "@shared/image-crop";
import { getCompetitionNominationFeeCents } from "@shared/nomination-fee";
import HeroCoverflowGallery from "@/components/hero-coverflow-gallery";
import type { Competition } from "@shared/schema";
import {
  MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT,
  OC_SOCIAL_AUTOMATION_OFFER_TEXT,
  VOTED_ARTIST_REMINDER_ACKNOWLEDGMENT_TEXT,
} from "@shared/weekly-consent";

interface JoinSettings {
  mode: "request" | "purchase";
  price: number;
  pageTitle: string;
  pageDescription: string;
  requiredFields: string[];
  isActive: boolean;
  nominationFee?: number;
  nominationEnabled?: boolean;
  hasPromoCode?: boolean;
}

type PaymentConfig = BuyerPaymentConfig & {
  apiLoginId: string;
  clientKey: string;
  environment: string;
};

interface AppliedNominationPromo {
  kind: "discount" | "referral";
  code: string;
  discountLabel?: string | null;
  discountAmountCents: number;
  finalAmountCents: number;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: "Nominee's Name",
  email: "Email",
  phone: "Phone Number",
  address: "Street Address",
  city: "City",
  state: "State",
  zip: "ZIP Code",
  bio: "Bio / About You",
  category: "Talent Category",
  socialLinks: "Social Media Links",
};

export default function JoinPage() {
  const paymentIdempotencyKey = useRef(crypto.randomUUID());
  useSEO({
    title: "Nominate Now",
    description: "Ready to showcase your talent? Apply to join an active competition on The Quest. Compete in music, modeling, bodybuilding, dance, and more.",
    canonical: "/nominate",
  });
  const { toast } = useToast();
  const { getMedia } = useLivery();

  const [mode] = useState<"nominate">("nominate");
  const [form, setForm] = useState<Record<string, string>>({});
  const [nominatorForm, setNominatorForm] = useState<Record<string, string>>({});
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
  const [acceptLoaded, setAcceptLoaded] = useState(false);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const searchString = useSearch();
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [compSearch, setCompSearch] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralChecking, setReferralChecking] = useState(false);
  const [nominationImageUrl, setNominationImageUrl] = useState<string | null>(null);
  const [nominationImageCropPosition, setNominationImageCropPosition] = useState<ImageCropPosition>({ ...DEFAULT_TALENT_IMAGE_CROP_POSITION });
  const [nominationImageCropDraft, setNominationImageCropDraft] = useState<ImageCropPosition>({ ...DEFAULT_TALENT_IMAGE_CROP_POSITION });
  const [nominationCropDialogOpen, setNominationCropDialogOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [promoCode, setPromoCode] = useState(() =>
    new URLSearchParams(searchString).get("promoCode")?.trim().toUpperCase() || "",
  );
  const [appliedPromo, setAppliedPromo] = useState<AppliedNominationPromo | null>(null);
  const [nominationFeeAcknowledged, setNominationFeeAcknowledged] = useState(false);
  const [marketingGuidelinesAcknowledged, setMarketingGuidelinesAcknowledged] = useState(false);
  const [votedArtistReminderAcknowledged, setVotedArtistReminderAcknowledged] = useState(false);
  const [nonprofitProceedsAcknowledged, setNonprofitProceedsAcknowledged] = useState(false);
  const nominationImageRef = useRef<HTMLInputElement>(null);
  const competitionSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const compId = params.get("competition");
    if (compId) {
      setSelectedCompetitionId(parseInt(compId, 10));
    }
  }, [searchString]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const refFromUrl = params.get("ref");
    if (refFromUrl) {
      const code = refFromUrl.toUpperCase();
      setReferralCode(code);
      localStorage.setItem("hfc_ref", code);
    } else {
      const savedRef = localStorage.getItem("hfc_ref");
      if (savedRef) setReferralCode(savedRef.toUpperCase());
    }
  }, [searchString]);

  const { data: settings, isLoading } = useQuery<JoinSettings>({
    queryKey: ["/api/join/settings"],
    staleTime: 0,
  });
  const { data: paymentConfig } = useQuery<PaymentConfig>({
    queryKey: ["/api/payment-config"],
  });

  const { data: competitions } = useQuery<Competition[]>({
    queryKey: ["/api/competitions"],
  });

  const { data: firestoreCategories } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const { data: platformSettings } = useQuery<any>({
    queryKey: ["/api/platform-settings"],
  });

  const filteredCompetitions = useMemo(() => {
    if (!competitions) return [];
    let openComps = competitions.filter(c => c.status === "active" || c.status === "voting");
    if (selectedCategory) {
      openComps = openComps.filter(c => c.category === selectedCategory);
    }
    if (!compSearch.trim()) return openComps;
    const q = compSearch.toLowerCase();
    return openComps.filter(c =>
      c.title.toLowerCase().includes(q)
    );
  }, [competitions, compSearch, selectedCategory]);

  const categoryCompCounts = useMemo(() => {
    if (!competitions || !firestoreCategories) return {};
    const openComps = competitions.filter(c => c.status === "active" || c.status === "voting");
    const counts: Record<string, number> = {};
    for (const cat of firestoreCategories) {
      counts[cat.name] = openComps.filter(c => c.category === cat.name).length;
    }
    return counts;
  }, [competitions, firestoreCategories]);

  const selectedCompetition = useMemo(() => {
    return competitions?.find(c => c.id === selectedCompetitionId) || null;
  }, [competitions, selectedCompetitionId]);
  const selectedCompetitionCategory = selectedCompetition?.category?.trim() || "";

  useEffect(() => {
    if (!selectedCompetitionCategory) return;
    setForm((previous) => previous.category === selectedCompetitionCategory
      ? previous
      : { ...previous, category: selectedCompetitionCategory });
  }, [selectedCompetitionCategory]);

  const handleGalleryCardClick = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedCompetitionId(null);
    setCompSearch("");
    setTimeout(() => {
      competitionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const promoValidated = appliedPromo?.kind === "discount";
  const originalPaymentAmount = getCompetitionNominationFeeCents(
    selectedCompetition?.nominationFee,
    settings?.nominationFee ?? 0,
  );
  useEffect(() => {
    setAppliedPromo(null);
    paymentIdempotencyKey.current = crypto.randomUUID();
  }, [selectedCompetitionId, originalPaymentAmount]);
  const appliedReferralCode = appliedPromo?.kind === "referral" ? appliedPromo.code : referralCode;
  const paymentAmount = promoValidated ? appliedPromo!.finalAmountCents : originalPaymentAmount;
  const needsPayment = paymentAmount > 0;

  useEffect(() => {
    if (paymentConfig?.provider === "authorize" && needsPayment && !acceptLoaded) {
      const scriptUrl = paymentConfig.environment === "production"
        ? "https://js.authorize.net/v1/Accept.js"
        : "https://jstest.authorize.net/v1/Accept.js";
      const existing = document.querySelector(`script[src="${scriptUrl}"]`);
      if (existing) { setAcceptLoaded(true); return; }
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => setAcceptLoaded(true);
      document.head.appendChild(script);
    }
  }, [paymentConfig, needsPayment, acceptLoaded]);

  useEffect(() => {
    if (paymentConfig?.provider !== "stripe" || !needsPayment || stripeLoaded) return;
    loadStripeScript().then(setStripeLoaded);
  }, [paymentConfig, needsPayment, stripeLoaded]);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateNominatorField = (key: string, value: string) => {
    setNominatorForm((prev) => ({ ...prev, [key]: value }));
  };

  const isRequired = (field: string) => settings?.requiredFields?.includes(field) ?? false;

  const handleNominationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/join/nomination-image", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Upload failed");
      }
      const data = await res.json();
      setNominationImageUrl(data.url);
      const faceFocusedPosition = { ...DEFAULT_TALENT_IMAGE_CROP_POSITION };
      setNominationImageCropPosition(faceFocusedPosition);
      setNominationImageCropDraft(faceFocusedPosition);
      setNominationCropDialogOpen(true);
      toast({ title: "Image uploaded!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setImageUploading(false);
      if (nominationImageRef.current) nominationImageRef.current.value = "";
    }
  };

  const validateForm = useCallback(() => {
    if (!settings) return false;
    if (promoCode.trim() && !appliedPromo) {
      toast({ title: "Apply or clear the promo or referral code before submitting", variant: "destructive" });
      return false;
    }
    if (!nominationFeeAcknowledged) {
      toast({ title: "Please acknowledge that nomination or competition fees may apply", variant: "destructive" });
      return false;
    }
    if (!marketingGuidelinesAcknowledged) {
      toast({ title: "Please acknowledge the marketing guidelines", variant: "destructive" });
      return false;
    }
    if (!votedArtistReminderAcknowledged) {
      toast({ title: "Please acknowledge the voted-artist reminder agreement", variant: "destructive" });
      return false;
    }
    if (!nonprofitProceedsAcknowledged) {
      toast({ title: "Please acknowledge the nonprofit contribution policy", variant: "destructive" });
      return false;
    }
    if (!selectedCompetitionId) {
      toast({ title: "Please select a competition", variant: "destructive" });
      return false;
    }
    if (!form.fullName?.trim()) {
      toast({ title: "Nominee's name is required", variant: "destructive" });
      return false;
    }
    if (!form.email?.trim()) {
      toast({ title: "Nominee's email is required", variant: "destructive" });
      return false;
    }
    const nominatorEmail = nominatorForm.email?.trim() || "";
    if (nominatorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nominatorEmail)) {
      toast({ title: "Enter a valid email or leave it blank to nominate anonymously", variant: "destructive" });
      return false;
    }
    if (needsPayment) {
      if (paymentConfig?.provider === "stripe" ? !stripeCard?.complete : paymentConfig?.provider !== "paypal" && (!cardNumber || !expMonth || !expYear || !cvv)) {
        toast({ title: "Please enter your card details", variant: "destructive" });
        return false;
      }
      if (!billingAddress.address.trim() || !billingAddress.city.trim() || !billingAddress.state.trim() || !billingAddress.zip.trim()) {
        toast({ title: "Please enter your billing address", variant: "destructive" });
        return false;
      }
      const ready = paymentConfig?.provider === "paypal"
        ? Boolean(paymentConfig.paypalConfigured)
        : paymentConfig?.provider === "stripe"
          ? Boolean(paymentConfig.stripeConfigured && stripeLoaded && window.Stripe)
          : Boolean(paymentConfig && window.Accept);
      if (!ready) {
        toast({ title: "Donation processing is not ready", variant: "destructive" });
        return false;
      }
    }
    return true;
  }, [settings, promoCode, appliedPromo, nominationFeeAcknowledged, marketingGuidelinesAcknowledged, votedArtistReminderAcknowledged, nonprofitProceedsAcknowledged, form, nominatorForm, selectedCompetitionId, needsPayment, cardNumber, expMonth, expYear, cvv, billingAddress, paymentConfig, stripeLoaded, stripeCard, toast]);

  const processPayment = useCallback(async () => {
    setShowConfirmModal(false);
    setProcessing(true);

    const submitData = async (dataDescriptor?: string, dataValue?: string, stripePaymentIntentId?: string, paypalOrderId?: string, ocPaymentId?: string) => {
      try {
        const nominationResponse = await apiRequest("POST", "/api/join/nominate", {
          idempotencyKey: paymentIdempotencyKey.current,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || "",
          bio: form.bio || "",
          category: form.category || "",
          competitionId: selectedCompetitionId,
          nominatorEmail: nominatorForm.email?.trim() || undefined,
          suggestedNonprofit: form.suggestedNonprofit?.trim() || undefined,
          referralCode: appliedReferralCode || undefined,
          mediaUrls: nominationImageUrl ? [nominationImageUrl] : [],
          imageCropPositions: nominationImageUrl ? [nominationImageCropPosition] : [],
          promoCode: promoValidated ? promoCode : undefined,
          dataDescriptor,
          dataValue,
          stripePaymentIntentId,
          paypalOrderId,
          ocPaymentId,
          billingAddress,
          nominationFeeAcknowledged,
          marketingGuidelinesAcknowledged,
          votedArtistReminderAcknowledged,
          nonprofitProceedsAcknowledged,
        });
        setSuccess(true);
        const nominationResult = await nominationResponse.json();
        toast({
          title: nominationResult.emailSent === false ? "Nomination saved; email needs attention" : "Nomination submitted!",
          description: nominationResult.emailSent === false
            ? "The nominee's login email could not be sent. Contact The Quest so an admin can resend account access instructions."
            : `The nominee was emailed login and account access instructions.${appliedReferralCode ? ` Referral tracked: ${appliedReferralCode}.` : ""}`,
          variant: nominationResult.emailSent === false ? "destructive" : "default",
          diagnosticContext: nominationResult.emailDiagnosticId
            ? { diagnosticId: nominationResult.emailDiagnosticId }
            : undefined,
        });
      } catch (error: any) {
        toast({ title: "Submission Failed", description: error.message?.replace(/^\d+:\s*/, "") || "Something went wrong", variant: "destructive" });
      } finally {
        setProcessing(false);
      }
    };

    if (needsPayment && paymentConfig?.provider === "stripe") {
      try {
        const { paymentIntentId: stripePaymentIntentId, ocPaymentId } = await confirmStripeCardPayment({
          publishableKey: paymentConfig.stripePublishableKey!,
          purpose: "nominate",
          intentPayload: {
            idempotencyKey: paymentIdempotencyKey.current,
            competitionId: selectedCompetitionId,
            promoCode: promoValidated ? promoCode : undefined,
            referralCode: appliedReferralCode || undefined,
          },
          cardHandle: stripeCard,
          name: "Anonymous",
          email: nominatorForm.email?.trim() || "",
          billingAddress,
        });
        await submitData(undefined, undefined, stripePaymentIntentId, undefined, ocPaymentId);
      } catch (error: any) {
        setProcessing(false);
        toast({ title: "Donation could not be completed", description: error.message, variant: "destructive" });
      }
    } else if (needsPayment && paymentConfig?.provider === "paypal") {
      const paypalPayload = {
        idempotencyKey: paymentIdempotencyKey.current,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || "",
        bio: form.bio || "",
        category: form.category || "",
        nominationFeeAcknowledged,
        marketingGuidelinesAcknowledged,
        votedArtistReminderAcknowledged,
        nonprofitProceedsAcknowledged,
        competitionId: selectedCompetitionId,
        nominatorEmail: nominatorForm.email?.trim() || undefined,
        suggestedNonprofit: form.suggestedNonprofit?.trim() || undefined,
        referralCode: appliedReferralCode || undefined,
        mediaUrls: nominationImageUrl ? [nominationImageUrl] : [],
        imageCropPositions: nominationImageUrl ? [nominationImageCropPosition] : [],
        promoCode: promoValidated ? promoCode : undefined,
        billingAddress,
      };
      sessionStorage.setItem("quest_paypal_nomination", JSON.stringify(paypalPayload));
      try {
        await createPayPalRedirect({
          purpose: "nominate",
          payload: paypalPayload,
          returnUrl: `${window.location.origin}/join?paypalReturn=1`,
          cancelUrl: `${window.location.origin}/join?paypalCancel=1`,
        });
      } catch (error: any) {
        sessionStorage.removeItem("quest_paypal_nomination");
        setProcessing(false);
        toast({ title: "PayPal checkout failed", description: error.message, variant: "destructive" });
      }
    } else if (needsPayment) {
      window.Accept!.dispatchData({
        authData: { clientKey: paymentConfig!.clientKey, apiLoginID: paymentConfig!.apiLoginId },
        cardData: {
          cardNumber: cardNumber.replace(/\s/g, ""),
          month: expMonth.padStart(2, "0"),
          year: expYear.length === 2 ? `20${expYear}` : expYear,
          cardCode: cvv,
        },
      }, async (tokenResponse: any) => {
        if (tokenResponse.messages?.resultCode === "Error") {
          setProcessing(false);
          toast({ title: "Donation Error", description: tokenResponse.messages.message[0]?.text, variant: "destructive" });
          return;
        }
        if (!tokenResponse.opaqueData) {
          setProcessing(false);
          toast({ title: "Donation Error", description: "Card details could not be securely prepared.", variant: "destructive" });
          return;
        }
        await submitData(tokenResponse.opaqueData.dataDescriptor, tokenResponse.opaqueData.dataValue);
      });
    } else {
      await submitData();
    }
  }, [settings, form, nominatorForm, mode, cardNumber, expMonth, expYear, cvv, billingAddress, paymentConfig, toast, selectedCompetitionId, needsPayment, nominationImageUrl, promoCode, promoValidated, appliedReferralCode, stripeLoaded, stripeCard, nominationFeeAcknowledged, marketingGuidelinesAcknowledged, votedArtistReminderAcknowledged, nonprofitProceedsAcknowledged]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const paypalOrderId = params.get("token");
    if (params.get("paypalReturn") !== "1" || !paypalOrderId) return;
    const saved = sessionStorage.getItem("quest_paypal_nomination");
    if (!saved) return;
    setProcessing(true);
    apiRequest("POST", "/api/join/nominate", { ...JSON.parse(saved), paypalOrderId })
      .then(async (response) => {
        const data = await response.json();
          if (!response.ok) throw new Error(data.message || "PayPal donation could not be completed.");
        sessionStorage.removeItem("quest_paypal_nomination");
        setSuccess(true);
        toast({
          title: data.emailSent === false ? "Nomination saved; email needs attention" : "Nomination submitted!",
          description: data.emailSent === false ? "The nominee's login email could not be sent. Contact The Quest so an admin can resend account access instructions." : "The nominee was emailed login and account access instructions.",
          variant: data.emailSent === false ? "destructive" : "default",
          diagnosticContext: data.emailDiagnosticId
            ? { diagnosticId: data.emailDiagnosticId }
            : undefined,
        });
      })
      .catch((error: any) => toast({ title: "PayPal checkout failed", description: error.message, variant: "destructive" }))
      .finally(() => setProcessing(false));
  }, [searchString, toast]);

  const handlePayClick = useCallback(() => {
    if (!validateForm()) return;
    if (needsPayment) {
      setShowConfirmModal(true);
    } else {
      processPayment();
    }
  }, [validateForm, needsPayment, processPayment]);

  if (success) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SiteNavbar />
        <div className="max-w-lg mx-auto px-4 py-32 text-center">
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-6" />
          <h2 className="text-2xl uppercase font-normal mb-4" style={{ letterSpacing: "10px" }} data-testid="text-success">
            NOMINATION SUBMITTED
          </h2>
          <p className="text-white/60 mb-8">
            Thank you for nominating {form.fullName}! Our team will review the nomination and reach out to them.
          </p>
          <a href="/competitions">
            <span className="inline-block bg-[#FF5A09] text-white font-bold text-sm uppercase px-8 leading-[47px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer" data-testid="button-browse">
              Browse Competitions
            </span>
          </a>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (isLoading || !settings) {
    return (
      <div className="min-h-screen bg-black">
        <SiteNavbar />
        <div className="max-w-2xl mx-auto px-4 py-32">
          <div className="h-8 w-1/2 bg-white/10 animate-pulse mb-6" />
          <div className="h-48 bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!settings.isActive) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SiteNavbar />
        <div className="max-w-lg mx-auto px-4 py-32 text-center">
          <h2 className="text-2xl uppercase font-normal mb-4" style={{ letterSpacing: "10px" }}>
            CURRENTLY CLOSED
          </h2>
          <p className="text-white/40">Join applications are not being accepted at this time. Check back later.</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const activeFields = ["fullName", "email", "phone", "bio", "category"];

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <section className="relative overflow-hidden">
        {(() => { const m = getMedia("breadcrumb_bg"); return m.type === "video" && m.url ? (
          <video src={m.url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : m.url ? (
          <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url('${m.url}')` }} />
        ) : <div className="absolute inset-0 bg-zinc-950" />; })()}
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 pt-[60px] md:pt-[72px] pb-0">
          <div className="max-w-5xl mx-auto">
            <HeroCoverflowGallery onCardClick={handleGalleryCardClick} />
          </div>
        </div>
        <div className="relative z-10 flex justify-center mt-6">
          <div className="bg-white/80 backdrop-blur-sm text-center pt-8 pb-5 px-8 w-[calc(100%-60px)] max-w-[552px]">
            <p className="text-black/50 text-base leading-relaxed mb-1">Get Started</p>
            <h2
              className="text-[24px] md:text-[30px] uppercase text-black/80 font-normal leading-none"
              style={{ letterSpacing: "10px" }}
              data-testid="text-page-title"
            >
              {settings.pageTitle}
            </h2>
          </div>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-white/40 text-sm mb-8 max-w-xl" data-testid="text-page-description">
          {settings.pageDescription}
        </p>

        <div className="mb-10" ref={competitionSectionRef}>
          <p className="text-[#5f5f5f] text-sm mb-1">Select Competition</p>
          <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
            CHOOSE YOUR EVENT
          </h3>

          {selectedCompetition ? (
            <div className="border border-[#FF5A09]/40 bg-[#FF5A09]/5 p-4 flex flex-wrap items-center justify-between gap-3" data-testid="selected-competition">
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-[#FF5A09]" />
                <div>
                  <p className="font-bold text-white">{selectedCompetition.title}</p>
                  <p className="text-xs text-white/40">
                    {selectedCompetition.category} | {selectedCompetition.status} | Registration donation: ${(originalPaymentAmount / 100).toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCompetitionId(null);
                  setSelectedCategory(selectedCompetition.category);
                  setForm((previous) => ({ ...previous, category: "" }));
                }}
                className="text-xs text-white/40 uppercase tracking-wider border border-white/10 px-3 py-1.5 transition-colors hover:text-white/60"
                data-testid="button-change-competition"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <p className="text-white/40 text-xs mb-3 uppercase tracking-wider">Step 1: Pick a Category</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {(firestoreCategories || []).filter((c: any) => c.isActive !== false).map((cat: any) => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.name); setCompSearch(""); }}
                    className={`px-4 py-2 text-xs uppercase tracking-wider border transition-colors ${
                      selectedCategory === cat.name
                        ? "bg-[#FF5A09] border-[#FF5A09] text-white"
                        : "bg-white/[0.05] border-white/15 text-white/60 hover:border-[#FF5A09]/40 hover:text-white"
                    }`}
                    data-testid={`category-tab-${cat.id}`}
                  >
                    {cat.name}
                    <span className="ml-1.5 text-[10px] opacity-60">({categoryCompCounts[cat.name] || 0})</span>
                  </button>
                ))}
              </div>

              {selectedCategory && (
                <>
                  <p className="text-white/40 text-xs mb-3 uppercase tracking-wider">Step 2: Choose Competition</p>
                  {filteredCompetitions.length > 6 && (
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                      <Input
                        value={compSearch}
                        onChange={(e) => setCompSearch(e.target.value)}
                        placeholder={`Search in ${selectedCategory}...`}
                        className="bg-white/[0.08] border-white/20 text-white pl-10"
                        data-testid="input-comp-search"
                      />
                    </div>
                  )}
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {filteredCompetitions.length > 0 ? filteredCompetitions.map((comp) => (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedCompetitionId(comp.id)}
                        className="w-full text-left bg-white/[0.08] border border-white/15 p-4 transition-colors hover:border-[#FF5A09]/30 hover:bg-[#FF5A09]/5 flex items-center gap-3"
                        data-testid={`comp-option-${comp.id}`}
                      >
                        <Trophy className="h-4 w-4 text-[#FF5A09]/50 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-white text-sm">{comp.title}</p>
                          <p className="text-xs text-white/30">{comp.status}</p>
                        </div>
                      </button>
                    )) : (
                      <p className="text-white/30 text-sm py-4 text-center">No competitions in this category yet.</p>
                    )}
                  </div>
                </>
              )}

              {!selectedCategory && (
                <p className="text-white/20 text-sm py-4 text-center border border-dashed border-white/10 mt-2">
                  Select a category above to see available competitions
                </p>
              )}
            </>
          )}
        </div>

        <div className="space-y-5 mb-10">
            <div className="flex items-start gap-3 bg-white/[0.06] border border-white/10 rounded-sm px-4 py-3 mb-6">
              <Sparkles className="h-4 w-4 text-[#FF5A09] mt-0.5 shrink-0" />
              <p className="text-white/70 text-sm leading-relaxed">
                Want to put yourself in the spotlight?{" "}
                <span className="text-white font-medium">You can nominate yourself</span> — just fill in your own details below.
              </p>
            </div>
            <p className="text-[#5f5f5f] text-sm mb-1">Optional Contact</p>
            <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
              NOMINATION UPDATES
            </h3>
            <p className="text-white/40 text-sm">
              We don't ask for your name or phone. Add an email only if you want an update when the nomination is accepted and active on The Quest.
            </p>
            <div>
              <Label htmlFor="nominator-email" className="text-white/60 uppercase text-xs tracking-wider">
                Email for updates <span className="text-white/30 normal-case">(optional)</span>
              </Label>
              <Input
                id="nominator-email"
                type="email"
                value={nominatorForm.email || ""}
                onChange={(e) => updateNominatorField("email", e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Email for nomination updates"
                data-testid="input-nominator-email"
              />
            </div>
            <div>
              <Label htmlFor="input-payment-code" className="text-white/60 uppercase text-xs tracking-wider">
                Promo or Referral Code
              </Label>
              <div className="flex flex-col gap-2 mt-2 sm:flex-row">
                <Input
                  id="input-payment-code"
                  value={referralCode || promoCode}
                  onChange={(e) => {
                    const val = e.target.value.trim().toUpperCase();
                    setReferralCode(val);
                    setPromoCode(val);
                    setAppliedPromo(null);
                    localStorage.removeItem("hfc_ref");
                    paymentIdempotencyKey.current = crypto.randomUUID();
                  }}
                  className="min-w-0 flex-1 bg-white/[0.08] border-white/20 text-white"
                  placeholder="Enter a promo or referral code"
                  autoComplete="off"
                  maxLength={40}
                  data-testid="input-payment-code"
                />
                <button
                  type="button"
                  disabled={referralChecking || !selectedCompetitionId || !(referralCode || promoCode).trim()}
                  onClick={async () => {
                    const codeToApply = (referralCode || promoCode).trim();
                    if (!codeToApply) return;
                    setReferralChecking(true);
                    try {
                      const response = await apiRequest("POST", "/api/payment/validate-code", {
                        purpose: "nominate",
                        code: codeToApply,
                        competitionId: selectedCompetitionId,
                      });
                      const data = await response.json();
                      if (!response.ok || !data.valid) throw new Error(data.message || "Invalid code.");
                      const applied = {
                        kind: data.kind as "discount" | "referral",
                        code: data.code as string,
                        discountLabel: data.discountLabel || null,
                        discountAmountCents: Number(data.discountAmountCents || 0),
                        finalAmountCents: Number(data.totalAmountCents ?? originalPaymentAmount),
                      };
                      setAppliedPromo(applied);
                      setPromoCode(applied.kind === "discount" ? applied.code : "");
                      setReferralCode(applied.kind === "referral" ? applied.code : "");
                      if (applied.kind === "referral") localStorage.setItem("hfc_ref", applied.code);
                      else localStorage.removeItem("hfc_ref");
                      toast({
                        title: applied.kind === "discount" ? "Discount applied" : "Referral tracked",
                        description: applied.kind === "discount"
                          ? `${applied.discountLabel || "Discount"}; $${(applied.finalAmountCents / 100).toFixed(2)} is due.`
                          : "The referral is recorded without changing the registration donation.",
                      });
                    } catch (error: any) {
                      toast({
                        title: "Code not applied",
                        description: error.message?.replace(/^\d+:\s*/, "") || "Could not validate the code.",
                        variant: "destructive",
                      });
                    } finally {
                      setReferralChecking(false);
                    }
                  }}
                  className="min-h-11 border border-[#FF5A09]/40 bg-[#FF5A09]/10 px-5 text-xs uppercase tracking-wider text-[#FF5A09] disabled:opacity-40"
                  data-testid="button-apply-referral-code"
                >
                  {referralChecking ? "Checking..." : "Apply code"}
                </button>
              </div>
              {appliedPromo && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-green-400" role="status" aria-live="polite">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {appliedPromo.kind === "discount"
                    ? `Discount applied: ${appliedPromo.discountLabel || "Promo discount"}`
                    : `Referral tracked: ${appliedPromo.code}`}
                </p>
              )}
            </div>
          </div>

        <div className="space-y-5 mb-10">
          <p className="text-[#5f5f5f] text-sm mb-1">
            Nominee Information
          </p>
          <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
            WHO ARE YOU NOMINATING?
          </h3>

          {activeFields.map((field) => {
            const required = field === "fullName" || field === "email";
            const label = field === "fullName" ? "Nominee's Name"
              : field === "email" ? "Nominee's Email"
              : field === "phone" ? "Nominee's Phone"
              : field === "bio" ? "Why Are You Making This Nomination?"
              : field === "category" ? "Talent Category"
              : FIELD_LABELS[field] || field;

            if (field === "bio") {
              return (
                <div key={field} className="space-y-4">
                  <div>
                    <Label htmlFor={field} className="text-white/60 uppercase text-xs tracking-wider">
                      {label} {required && <span className="text-[#FF5A09]">*</span>}
                    </Label>
                    <Textarea
                      id={field}
                      value={form[field] || ""}
                      onChange={(e) => updateField(field, e.target.value)}
                      className="bg-white/[0.08] border-white/20 text-white mt-2 resize-none min-h-[100px]"
                      placeholder="Tell us why this person, brand, or company deserves to be nominated"
                      required={required}
                      data-testid={`input-${field}`}
                    />
                  </div>
                  <div>
                    <Label className="text-white/60 uppercase text-xs tracking-wider">
                      Photo of Nominee <span className="text-white/30 normal-case">(optional)</span>
                    </Label>
                    <p className="text-white/45 text-xs mt-1 mb-2">
                      Upload a photo, then frame the nominee&apos;s face or main subject for their public competition card.
                    </p>
                    <input
                      ref={nominationImageRef}
                      type="file"
                      accept="image/*"
                      onChange={handleNominationImageUpload}
                      className="hidden"
                      data-testid="input-nomination-image"
                    />
                    {nominationImageUrl ? (
                      <div className="max-w-xs space-y-3">
                        <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/20 bg-black shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                          <img
                            src={nominationImageUrl}
                            alt={`Nominee photo preview${form.fullName ? ` for ${form.fullName}` : ""}`}
                            className="h-full w-full object-cover"
                            style={{
                              objectPosition: `${nominationImageCropPosition.x}% ${nominationImageCropPosition.y}%`,
                            }}
                          />
                          <span className="absolute bottom-2 left-2 rounded-full border border-white/15 bg-black/75 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white/80">
                            Competition card preview
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNominationImageCropDraft(nominationImageCropPosition);
                              setNominationCropDialogOpen(true);
                            }}
                            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 bg-white/[0.05] px-3 text-sm font-semibold text-white hover:border-[#FF5A09]/70 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]"
                            data-testid="button-adjust-nomination-image"
                          >
                            <Crop className="h-4 w-4" />
                            Adjust framing
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNominationImageUrl(null);
                              setNominationImageCropPosition({ ...DEFAULT_TALENT_IMAGE_CROP_POSITION });
                              setNominationImageCropDraft({ ...DEFAULT_TALENT_IMAGE_CROP_POSITION });
                              setNominationCropDialogOpen(false);
                            }}
                            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 px-3 text-sm text-white/65 hover:border-red-400/50 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            data-testid="button-remove-nomination-image"
                          >
                            <X className="h-4 w-4" />
                            Remove photo
                          </button>
                        </div>
                        <p className="text-xs text-white/45">
                          Your framing is saved with the nomination and used if this photo becomes the nominee&apos;s public profile image, even if they don&apos;t sign in.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => nominationImageRef.current?.click()}
                        disabled={imageUploading}
                        className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white/60 text-sm hover:border-[#FF5A09] hover:text-[#FF5A09] transition-colors disabled:opacity-50"
                        data-testid="button-upload-nomination-image"
                      >
                        {imageUploading ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                        ) : (
                          <><ImageIcon className="h-4 w-4" /> Choose Image</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            if (field === "category") {
              const categories = firestoreCategories || [];
              const selectedCategoryIsListed = categories.some((category: any) => category.name === selectedCompetitionCategory);
              return (
                <div key={field}>
                  <Label htmlFor={field} className="text-white/60 uppercase text-xs tracking-wider">
                    {label} {required && <span className="text-[#FF5A09]">*</span>}
                  </Label>
                  <Select
                    value={selectedCompetitionCategory || form.category || ""}
                    onValueChange={(val) => updateField("category", val)}
                    disabled={Boolean(selectedCompetitionCategory)}
                  >
                    <SelectTrigger
                      className="bg-white/[0.08] border-white/20 text-white mt-2 disabled:cursor-default disabled:opacity-100"
                      data-testid="select-category"
                    >
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      {selectedCompetitionCategory && !selectedCategoryIsListed && (
                        <SelectItem value={selectedCompetitionCategory}>{selectedCompetitionCategory}</SelectItem>
                      )}
                      {categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCompetitionCategory && (
                    <p className="mt-1 text-xs text-white/40">Matches the competition you selected.</p>
                  )}
                </div>
              );
            }

            if (["address", "city", "state", "zip"].includes(field)) {
              if (field === "address") {
                return (
                  <div key="address-group">
                    <Label className="text-white/60 uppercase text-xs tracking-wider">
                      Address {(isRequired("address") || isRequired("city") || isRequired("state") || isRequired("zip")) && <span className="text-[#FF5A09]">*</span>}
                    </Label>
                    <Input
                      id="address"
                      value={form.address || ""}
                      onChange={(e) => updateField("address", e.target.value)}
                      className="bg-white/[0.08] border-white/20 text-white mt-2"
                      placeholder="Street address"
                      required={isRequired("address")}
                      data-testid="input-address"
                    />
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <Input
                        value={form.city || ""}
                        onChange={(e) => updateField("city", e.target.value)}
                        className="bg-white/[0.08] border-white/20 text-white"
                        placeholder="City"
                        required={isRequired("city")}
                        data-testid="input-city"
                      />
                      <Input
                        value={form.state || ""}
                        onChange={(e) => updateField("state", e.target.value)}
                        className="bg-white/[0.08] border-white/20 text-white"
                        placeholder="State"
                        required={isRequired("state")}
                        data-testid="input-state"
                      />
                      <Input
                        value={form.zip || ""}
                        onChange={(e) => updateField("zip", e.target.value)}
                        className="bg-white/[0.08] border-white/20 text-white"
                        placeholder="ZIP"
                        required={isRequired("zip")}
                        data-testid="input-zip"
                      />
                    </div>
                  </div>
                );
              }
              return null;
            }

            return (
              <div key={field}>
                <Label htmlFor={field} className="text-white/60 uppercase text-xs tracking-wider">
                  {label} {required && <span className="text-[#FF5A09]">*</span>}
                </Label>
                <Input
                  id={field}
                  type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                  value={form[field] || ""}
                  onChange={(e) => updateField(field, e.target.value)}
                  className="bg-white/[0.08] border-white/20 text-white mt-2"
                  placeholder={field === "fullName" ? "Enter the nominee's artist, stage, or business name"
                    : field === "email" ? "Enter nominee's email"
                    : field === "phone" ? "Enter nominee's phone number"
                    : `Enter ${label.toLowerCase()}`}
                  required={required}
                  data-testid={`input-${field}`}
                />
                {field === "fullName" && (
                  <p className="mt-2 text-xs leading-relaxed text-white/40">
                    This can be the name people know them by, such as an artist or stage name like Lil Wayne or Lady Gaga, or a business name.
                  </p>
                )}
              </div>
            );
          })}
          <div className="space-y-2">
            <Label htmlFor="suggested-nonprofit" className="text-white/60 uppercase text-xs tracking-wider">
              Suggested Nonprofit <span className="text-white/30 normal-case">(optional)</span>
            </Label>
            <Input
              id="suggested-nonprofit"
              value={form.suggestedNonprofit || ""}
              onChange={(event) => updateField("suggestedNonprofit", event.target.value)}
              className="bg-white/[0.08] border-white/20 text-white"
              placeholder="Suggest a nonprofit for the nominee"
              maxLength={180}
              data-testid="input-suggested-nonprofit"
            />
            <p className="text-xs leading-relaxed text-white/40">
              This is only a suggestion. The nominee chooses their own nonprofit in their account.
            </p>
          </div>
        </div>

        <div className="mb-10">
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 border border-white/15 bg-white/[0.03] p-4 text-xs leading-relaxed text-white/75">
              <input
                id="nomination-fee-acknowledged"
                type="checkbox"
                checked={nominationFeeAcknowledged}
                onChange={(event) => setNominationFeeAcknowledged(event.target.checked)}
                aria-required="true"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF5A09]"
                data-testid="checkbox-nomination-fees"
              />
              <span>
                I understand that being nominated or entering competitions may require a registration donation.
              </span>
            </label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 border border-white/15 bg-white/[0.03] p-4 text-xs leading-relaxed text-white/75">
                <input
                  id="nomination-marketing-guidelines-acknowledged"
                  type="checkbox"
                  checked={marketingGuidelinesAcknowledged}
                  onChange={(event) => setMarketingGuidelinesAcknowledged(event.target.checked)}
                  aria-required="true"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF5A09]"
                  data-testid="checkbox-nomination-marketing-guidelines"
                />
                <span>{MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT}</span>
              </label>
              <p className="pl-7 text-xs leading-relaxed text-white/45">
                {OC_SOCIAL_AUTOMATION_OFFER_TEXT}
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 border border-white/15 bg-white/[0.03] p-4 text-xs leading-relaxed text-white/75">
              <input
                id="nomination-voted-artist-reminder-acknowledged"
                type="checkbox"
                checked={votedArtistReminderAcknowledged}
                onChange={(event) => setVotedArtistReminderAcknowledged(event.target.checked)}
                aria-required="true"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF5A09]"
                data-testid="checkbox-nomination-voted-artist-reminders"
              />
              <span>{VOTED_ARTIST_REMINDER_ACKNOWLEDGMENT_TEXT}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 border border-white/15 bg-white/[0.03] p-4 text-xs leading-relaxed text-white/75">
              <input
                id="nomination-nonprofit-proceeds-acknowledged"
                type="checkbox"
                checked={nonprofitProceedsAcknowledged}
                onChange={(event) => setNonprofitProceedsAcknowledged(event.target.checked)}
                aria-required="true"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF5A09]"
                data-testid="checkbox-nomination-nonprofit-proceeds"
              />
              <span>
                I understand that The Quest's participants will be required to give a portion of any proceeds to a nonprofit.
              </span>
            </label>
          </div>
        </div>

        {needsPayment && (
          <div className="mb-10">
            <p className="text-[#5f5f5f] text-sm mb-1">Registration donation</p>
            <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
              CARD DETAILS
            </h3>
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-4">
                <p className="text-white/60 uppercase text-xs tracking-wider mb-3">Billing Address</p>
                <div className="space-y-3">
                  <Input
                    aria-label="Billing street address"
                    autoComplete="billing street-address"
                    value={billingAddress.address}
                    onChange={(e) => setBillingAddress((current) => ({ ...current, address: e.target.value }))}
                    className="bg-white/[0.08] border-white/20 text-white"
                    placeholder="Street address"
                    data-testid="input-billing-address"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      aria-label="Billing city"
                      autoComplete="billing address-level2"
                      value={billingAddress.city}
                      onChange={(e) => setBillingAddress((current) => ({ ...current, city: e.target.value }))}
                      className="bg-white/[0.08] border-white/20 text-white"
                      placeholder="City"
                      data-testid="input-billing-city"
                    />
                    <Input
                      aria-label="Billing state"
                      autoComplete="billing address-level1"
                      value={billingAddress.state}
                      onChange={(e) => setBillingAddress((current) => ({ ...current, state: e.target.value }))}
                      className="bg-white/[0.08] border-white/20 text-white"
                      placeholder="State"
                      data-testid="input-billing-state"
                    />
                    <Input
                      aria-label="Billing ZIP code"
                      autoComplete="billing postal-code"
                      value={billingAddress.zip}
                      onChange={(e) => setBillingAddress((current) => ({ ...current, zip: e.target.value }))}
                      className="bg-white/[0.08] border-white/20 text-white"
                      placeholder="ZIP code"
                      data-testid="input-billing-zip"
                    />
                  </div>
                </div>
              </div>
              {paymentConfig?.provider === "stripe" ? (
                <StripeCardField publishableKey={paymentConfig.stripePublishableKey || ""} onChange={setStripeCard} />
              ) : paymentConfig?.provider !== "paypal" ? (<>
              <div>
                <Label htmlFor="join-card" className="text-white/60 uppercase text-xs tracking-wider">Card Number</Label>
                <Input id="join-card" name="cardnumber" autoComplete="cc-number" type="text" inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                  className="bg-white/[0.08] border-white/20 text-white mt-2" placeholder="4111 1111 1111 1111" maxLength={19} data-testid="input-card-number" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-white/60 uppercase text-xs tracking-wider">Month</Label>
                  <Input name="cc-exp-month" autoComplete="cc-exp-month" type="text" inputMode="numeric" value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="bg-white/[0.08] border-white/20 text-white mt-2" placeholder="MM" maxLength={2} data-testid="input-exp-month" />
                </div>
                <div>
                  <Label className="text-white/60 uppercase text-xs tracking-wider">Year</Label>
                  <Input name="cc-exp-year" autoComplete="cc-exp-year" type="text" inputMode="numeric" value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="bg-white/[0.08] border-white/20 text-white mt-2" placeholder="YYYY" maxLength={4} data-testid="input-exp-year" />
                </div>
                <div>
                  <Label className="text-white/60 uppercase text-xs tracking-wider">CVV</Label>
                  <Input name="cc-csc" autoComplete="cc-csc" type="text" inputMode="numeric" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="bg-white/[0.08] border-white/20 text-white mt-2" placeholder="123" maxLength={4} data-testid="input-cvv" />
                </div>
              </div>
              </>) : null}
            </div>
          </div>
        )}

        {(originalPaymentAmount > 0 || appliedPromo) && (
          <section
            className="mb-5 border border-white/10 bg-white/[0.03] p-4 sm:p-5"
            aria-label="Checkout total and applied code"
            data-testid="nomination-checkout-promo"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-white/50 text-xs uppercase tracking-wider">Checkout total</p>
                <p className="mt-1 text-white font-semibold" data-testid="text-nomination-checkout-total">
                  {appliedPromo ? `Due now: $${(paymentAmount / 100).toFixed(2)}` : `$${(originalPaymentAmount / 100).toFixed(2)}`}
                </p>
              </div>
              {appliedPromo && (
                <div className="text-right">
                  <p className="text-green-400 text-sm font-semibold">
                    {appliedPromo.kind === "discount"
                      ? `Discount applied: ${appliedPromo.discountLabel || "Promo discount"}`
                      : `Referral tracked: ${appliedPromo.code}`}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {appliedPromo.kind === "discount"
                      ? `Save $${(appliedPromo.discountAmountCents / 100).toFixed(2)}`
                      : "This code tracks the referral source and does not change the amount due."}
                  </p>
                </div>
              )}
            </div>

            {appliedPromo ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-white/50">
                  {appliedPromo.kind === "discount"
                    ? <>Original donation ${(originalPaymentAmount / 100).toFixed(2)}<span className="mx-2 text-white/25">·</span>Discount -${(appliedPromo.discountAmountCents / 100).toFixed(2)}{paymentAmount === 0 && <span className="ml-2 text-green-300">No donation is due.</span>}</>
                    : "Referral tracked; registration donation is unchanged."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoCode("");
                    if (appliedPromo.kind === "referral") {
                      setReferralCode("");
                      localStorage.removeItem("hfc_ref");
                    }
                    paymentIdempotencyKey.current = crypto.randomUUID();
                  }}
                  className="min-h-11 px-2 text-xs text-white/50 underline underline-offset-2 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A09]"
                  data-testid="button-remove-applied-promo"
                >
                  Remove code
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-white/50">
                Enter a promo or referral code above to apply it.
              </p>
            )}
          </section>
        )}

        <button
          onClick={handlePayClick}
          disabled={processing}
          className="w-full bg-[#FF5A09] text-white font-bold text-base uppercase px-8 leading-[52px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          data-testid="button-submit"
        >
          {needsPayment ? (
            <>
              <CreditCard className="h-5 w-5" />
              {processing ? "PROCESSING..." : `DONATE $${(paymentAmount / 100).toFixed(2)} & NOMINATE`}
            </>
          ) : (
            <>
              <UserPlus className="h-5 w-5" />
              {processing ? "SUBMITTING..." : "SUBMIT NOMINATION"}
            </>
          )}
        </button>

        {needsPayment && (
          <div className="mt-4 space-y-1 text-center">
            <p className="text-white/30 text-xs">
              Donations are processed securely by The Quest.
            </p>
            <p className="text-white/40 text-xs">
              Registration donations are <span className="text-white/60 font-medium">non-refundable</span> once submitted. By donating you agree to our{" "}
              <a href="/thequest/about" className="underline underline-offset-2 text-white/50 hover:text-white/80 transition-colors">Terms & Conditions</a>.
            </p>
          </div>
        )}

        {showConfirmModal && (
          <PaymentConfirmationModal
            open={showConfirmModal}
            onClose={() => setShowConfirmModal(false)}
            onConfirm={processPayment}
            processing={processing}
            title="Confirm Nomination"
            description="Please review your nomination details before proceeding."
            lineItems={[
              { label: "Nominee", value: form.fullName || "" },
              { label: "Update email", value: nominatorForm.email?.trim() || "Anonymous submission" },
              { label: promoValidated ? "Original registration donation" : "Registration donation", value: `$${(originalPaymentAmount / 100).toFixed(2)}` },
              ...(promoValidated ? [
                { label: `Promo code (${appliedPromo.code})`, value: `-$${(appliedPromo.discountAmountCents / 100).toFixed(2)}` },
                { label: "Amount due", value: `$${(paymentAmount / 100).toFixed(2)}` },
              ] : []),
              ...(appliedPromo?.kind === "referral" ? [
                { label: "Referral", value: `Tracked: ${appliedPromo.code}` },
              ] : []),
            ]}
            totalAmount={`$${(paymentAmount / 100).toFixed(2)}`}
            confirmText={paymentAmount > 0 ? `DONATE $${(paymentAmount / 100).toFixed(2)} & NOMINATE` : "SUBMIT NOMINATION"}
            termsContext="nomination"
            termsFinePrint={platformSettings?.termsFinePrint}
          />
        )}
      </div>

      {nominationImageUrl && (
        <ImageCropDialog
          open={nominationCropDialogOpen}
          onOpenChange={(open) => {
            if (open) setNominationImageCropDraft(nominationImageCropPosition);
            setNominationCropDialogOpen(open);
          }}
          src={nominationImageUrl}
          alt={form.fullName ? `Nominee ${form.fullName}` : "Nominee"}
          position={nominationImageCropDraft}
          onPositionChange={setNominationImageCropDraft}
          onSave={() => {
            setNominationImageCropPosition(nominationImageCropDraft);
            setNominationCropDialogOpen(false);
          }}
          isSaving={false}
        />
      )}

      <SiteFooter />
    </div>
  );
}
