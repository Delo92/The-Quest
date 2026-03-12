import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { CheckCircle, CreditCard, Search, Trophy, UserPlus, Heart, Upload, X, Loader2, ImageIcon, Sparkles } from "lucide-react";
import PaymentConfirmationModal from "@/components/payment-confirmation-modal";
import HeroCoverflowGallery from "@/components/hero-coverflow-gallery";
import type { Competition } from "@shared/schema";

interface JoinSettings {
  mode: "request" | "purchase";
  price: number;
  pageTitle: string;
  pageDescription: string;
  requiredFields: string[];
  isActive: boolean;
  nominationFee?: number;
  nominationEnabled?: boolean;
  nonprofitRequired?: boolean;
  charityName?: string;
  hasPromoCode?: boolean;
}

interface PaymentConfig {
  apiLoginId: string;
  clientKey: string;
  environment: string;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
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
  useSEO({
    title: "Nominate Now",
    description: "Ready to showcase your talent? Apply to join an active competition on The Quest. Compete in music, modeling, bodybuilding, dance, and more.",
    canonical: "https://thequest-2dc77.firebaseapp.com/join",
  });
  const { toast } = useToast();
  const { getImage, getMedia } = useLivery();

  const [mode] = useState<"nominate">("nominate");
  const [form, setForm] = useState<Record<string, string>>({});
  const [nominatorForm, setNominatorForm] = useState<Record<string, string>>({});
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [acceptLoaded, setAcceptLoaded] = useState(false);
  const searchString = useSearch();
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [compSearch, setCompSearch] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [nominationImageUrl, setNominationImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoValidated, setPromoValidated] = useState(false);
  const [promoChecking, setPromoChecking] = useState(false);
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
    const savedRef = localStorage.getItem("hfc_ref");
    if (savedRef) setReferralCode(savedRef);
  }, []);

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
    let openComps = competitions.filter(c => c.status === "active" || c.status === "voting" || c.status === "draft");
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
    const openComps = competitions.filter(c => c.status === "active" || c.status === "voting" || c.status === "draft");
    const counts: Record<string, number> = {};
    for (const cat of firestoreCategories) {
      counts[cat.name] = openComps.filter(c => c.category === cat.name).length;
    }
    return counts;
  }, [competitions, firestoreCategories]);

  const selectedCompetition = useMemo(() => {
    return competitions?.find(c => c.id === selectedCompetitionId) || null;
  }, [competitions, selectedCompetitionId]);

  const handleGalleryCardClick = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedCompetitionId(null);
    setCompSearch("");
    setTimeout(() => {
      competitionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const needsPayment = (settings?.nominationFee || 0) > 0 && !promoValidated;
  const paymentAmount = settings?.nominationFee || 0;

  useEffect(() => {
    if (paymentConfig && needsPayment && !acceptLoaded) {
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
    if (!nominatorForm.name?.trim()) {
      toast({ title: "Your name is required", variant: "destructive" });
      return false;
    }
    if (!nominatorForm.email?.trim()) {
      toast({ title: "Your email is required", variant: "destructive" });
      return false;
    }
    if (needsPayment) {
      if (!cardNumber || !expMonth || !expYear || !cvv) {
        toast({ title: "Please enter your card details", variant: "destructive" });
        return false;
      }
      if (!paymentConfig || !window.Accept) {
        toast({ title: "Payment system not ready", variant: "destructive" });
        return false;
      }
    }
    return true;
  }, [settings, form, nominatorForm, selectedCompetitionId, needsPayment, cardNumber, expMonth, expYear, cvv, paymentConfig, toast]);

  const processPayment = useCallback(async () => {
    setShowConfirmModal(false);
    setProcessing(true);

    const submitData = async (dataDescriptor?: string, dataValue?: string) => {
      try {
        await apiRequest("POST", "/api/join/nominate", {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || "",
          bio: form.bio || "",
          category: form.category || "",
          chosenNonprofit: form.chosenNonprofit || null,
          competitionId: selectedCompetitionId,
          nominatorName: nominatorForm.name,
          nominatorEmail: nominatorForm.email,
          nominatorPhone: nominatorForm.phone || "",
          referralCode: referralCode || undefined,
          mediaUrls: nominationImageUrl ? [nominationImageUrl] : [],
          promoCode: promoValidated ? promoCode : undefined,
          dataDescriptor,
          dataValue,
        });
        setSuccess(true);
        toast({ title: "Nomination submitted!", description: "Thank you for your nomination!" });
      } catch (error: any) {
        toast({ title: "Submission Failed", description: error.message?.replace(/^\d+:\s*/, "") || "Something went wrong", variant: "destructive" });
      } finally {
        setProcessing(false);
      }
    };

    if (needsPayment) {
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
          toast({ title: "Payment Error", description: tokenResponse.messages.message[0]?.text, variant: "destructive" });
          return;
        }
        if (!tokenResponse.opaqueData) {
          setProcessing(false);
          toast({ title: "Payment Error", description: "Failed to tokenize card", variant: "destructive" });
          return;
        }
        await submitData(tokenResponse.opaqueData.dataDescriptor, tokenResponse.opaqueData.dataValue);
      });
    } else {
      await submitData();
    }
  }, [settings, form, nominatorForm, mode, cardNumber, expMonth, expYear, cvv, paymentConfig, toast, selectedCompetitionId, needsPayment, nominationImageUrl]);

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
        {getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").type === "video" ? (
          <video src={getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url('${getImage("breadcrumb_bg", "/images/template/breadcumb.jpg")}')` }} />
        )}
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

        {(settings.nominationFee || 0) > 0 && (
          <div className="border border-[#FF5A09]/30 bg-[#FF5A09]/5 p-4 mb-8">
            {promoValidated ? (
              <>
                <p className="text-green-400 font-bold uppercase text-sm" style={{ letterSpacing: "2px" }}>
                  Promo Code Applied - FREE Nomination
                </p>
                <p className="text-white/40 text-xs mt-1">Your promo code has been applied. No payment required.</p>
              </>
            ) : (
              <>
                <p className="text-[#FF5A09] font-bold uppercase text-sm" style={{ letterSpacing: "2px" }}>
                  Nomination Fee: ${((settings.nominationFee || 0) / 100).toFixed(2)}
                </p>
                <p className="text-white/40 text-xs mt-1">Payment is required to submit a nomination.</p>
              </>
            )}
            {settings.hasPromoCode && !promoValidated && (
              <div className="mt-3 space-y-2">
              <p className="text-white/50 text-xs">If you have a promo code, enter it here:</p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="bg-white/5 border-white/10 text-white uppercase max-w-[200px] h-9"
                  data-testid="input-promo-code"
                />
                <button
                  onClick={async () => {
                    if (!promoCode.trim()) return;
                    setPromoChecking(true);
                    try {
                      const res = await apiRequest("POST", "/api/join/validate-promo", { code: promoCode });
                      const data = await res.json();
                      if (data.valid) {
                        setPromoValidated(true);
                        toast({ title: "Promo code applied!", description: "Nomination fee has been waived." });
                      } else {
                        toast({ title: "Invalid promo code", variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Failed to validate promo code", variant: "destructive" });
                    } finally {
                      setPromoChecking(false);
                    }
                  }}
                  disabled={promoChecking || !promoCode.trim()}
                  className="text-xs uppercase tracking-wider border border-[#FF5A09]/40 bg-[#FF5A09]/10 text-[#FF5A09] px-4 py-2 transition-colors hover:bg-[#FF5A09]/20 disabled:opacity-40"
                  data-testid="button-apply-promo"
                >
                  {promoChecking ? "Checking..." : "Apply"}
                </button>
              </div>
              </div>
            )}
          </div>
        )}

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
                  <p className="text-xs text-white/40">{selectedCompetition.category} | {selectedCompetition.status}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedCompetitionId(null); setSelectedCategory(selectedCompetition.category); }}
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
            <p className="text-[#5f5f5f] text-sm mb-1">Your Information</p>
            <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
              NOMINATOR DETAILS
            </h3>
            <div>
              <Label className="text-white/60 uppercase text-xs tracking-wider">
                Your Name <span className="text-[#FF5A09]">*</span>
              </Label>
              <Input
                value={nominatorForm.name || ""}
                onChange={(e) => updateNominatorField("name", e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Enter your full name"
                data-testid="input-nominator-name"
              />
            </div>
            <div>
              <Label className="text-white/60 uppercase text-xs tracking-wider">
                Your Email <span className="text-[#FF5A09]">*</span>
              </Label>
              <Input
                type="email"
                value={nominatorForm.email || ""}
                onChange={(e) => updateNominatorField("email", e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Enter your email"
                data-testid="input-nominator-email"
              />
            </div>
            <div>
              <Label className="text-white/60 uppercase text-xs tracking-wider">
                Your Phone
              </Label>
              <Input
                type="tel"
                value={nominatorForm.phone || ""}
                onChange={(e) => updateNominatorField("phone", e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Enter your phone number"
                data-testid="input-nominator-phone"
              />
            </div>
            <div>
              <Label className="text-white/60 uppercase text-xs tracking-wider">
                Referral / Promo Code
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
                  placeholder="Enter code (optional)"
                  data-testid="input-referral-code"
                />
                {referralCode && (
                  <span className="text-green-400 text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Applied
                  </span>
                )}
              </div>
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
            const label = field === "fullName" ? "Nominee's Full Name"
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
                    <p className="text-white/30 text-xs mt-1 mb-2">Upload a photo of the person, brand, or company you're nominating</p>
                    <input
                      ref={nominationImageRef}
                      type="file"
                      accept="image/*"
                      onChange={handleNominationImageUpload}
                      className="hidden"
                      data-testid="input-nomination-image"
                    />
                    {nominationImageUrl ? (
                      <div className="relative inline-block">
                        <img src={nominationImageUrl} alt="Nominee" className="w-32 h-32 object-cover rounded border border-white/20" />
                        <button
                          type="button"
                          onClick={() => setNominationImageUrl(null)}
                          className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-500"
                          data-testid="button-remove-nomination-image"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
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
              return (
                <div key={field}>
                  <Label htmlFor={field} className="text-white/60 uppercase text-xs tracking-wider">
                    {label} {required && <span className="text-[#FF5A09]">*</span>}
                  </Label>
                  <Select value={form.category || ""} onValueChange={(val) => updateField("category", val)}>
                    <SelectTrigger className="bg-white/[0.08] border-white/20 text-white mt-2" data-testid="select-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      {(firestoreCategories || []).map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  placeholder={field === "fullName" ? "Enter nominee's full name"
                    : field === "email" ? "Enter nominee's email"
                    : field === "phone" ? "Enter nominee's phone number"
                    : `Enter ${label.toLowerCase()}`}
                  required={required}
                  data-testid={`input-${field}`}
                />
              </div>
            );
          })}
        </div>

        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-4 w-4 text-[#FF5A09]" />
            <p className="text-[#5f5f5f] text-sm">Support a Cause</p>
          </div>
          <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
            CHOICE OF NON-PROFIT
          </h3>
          <p className="text-white/40 text-xs mb-4">We encourage all nominees to support a non-profit organization. This is optional, but every little bit helps make a difference in our community.</p>
          {settings.charityName && (
            <div className="border border-[#FF5A09]/30 bg-[#FF5A09]/5 p-4 mb-4">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Suggested Non-Profit</p>
              <p className="text-[#FF5A09] font-bold text-sm">{settings.charityName}</p>
              <p className="text-white/40 text-xs mt-1">Feel free to suggest a different organization below, or leave blank.</p>
            </div>
          )}
          <div>
            <Label htmlFor="chosenNonprofit" className="text-white/60 uppercase text-xs tracking-wider">
              Non-Profit Organization <span className="text-white/25 normal-case">(optional)</span>
            </Label>
            <Input
              id="chosenNonprofit"
              type="text"
              value={form.chosenNonprofit ?? settings.charityName ?? ""}
              onChange={(e) => updateField("chosenNonprofit", e.target.value)}
              className="bg-white/[0.08] border-white/20 text-white mt-2"
              placeholder="Suggest a non-profit organization"
              data-testid="input-chosen-nonprofit"
            />
          </div>
        </div>

        {needsPayment && (
          <div className="mb-10">
            <p className="text-[#5f5f5f] text-sm mb-1">Payment</p>
            <h3 className="text-lg uppercase text-white font-normal mb-6" style={{ letterSpacing: "6px" }}>
              CARD DETAILS
            </h3>
            <div className="space-y-4">
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
            </div>
          </div>
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
              {processing ? "PROCESSING..." : `PAY $${(paymentAmount / 100).toFixed(2)} & NOMINATE`}
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
            <p className="text-white/30 text-xs">Payments processed securely via Authorize.Net.</p>
            <p className="text-white/40 text-xs">
              All fees are <span className="text-white/60 font-medium">non-refundable</span> once submitted. By paying you agree to our{" "}
              <a href="/about#terms" className="underline underline-offset-2 text-white/50 hover:text-white/80 transition-colors">Terms & Conditions</a>.
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
              { label: "Nominated by", value: nominatorForm.name || "" },
              { label: "Nomination Fee", value: `$${(paymentAmount / 100).toFixed(2)}` },
            ]}
            totalAmount={`$${(paymentAmount / 100).toFixed(2)}`}
            confirmText={`PAY $${(paymentAmount / 100).toFixed(2)} & NOMINATE`}
            termsSummary={platformSettings?.termsSummary}
            termsFinePrint={platformSettings?.termsFinePrint}
          />
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
