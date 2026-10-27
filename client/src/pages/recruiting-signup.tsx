import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT, VOTED_ARTIST_REMINDER_ACKNOWLEDGMENT_TEXT } from "@shared/weekly-consent";
import { slugifyWithId } from "@shared/slugify";
import { ArrowUpRight, Check, Copy, LoaderCircle, Share2, Trophy } from "lucide-react";

interface RecruitingCompetition {
  id: number;
  title: string;
  category: string;
  description: string | null;
  coverImage: string | null;
  themeColor: string | null;
  status: string;
}

const schema = z.object({
  publicName: z.string().trim().min(2, "Enter the name you want people to see."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Use at least 6 characters."),
  bio: z.string().trim().max(500, "Keep your bio under 500 characters.").optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  location: z.string().trim().max(120).optional().default(""),
  instagram: z.string().trim().optional().default(""),
  facebook: z.string().trim().optional().default(""),
  tiktok: z.string().trim().optional().default(""),
  youtube: z.string().trim().optional().default(""),
  competitionEntryFeesAcknowledged: z.boolean().refine(Boolean, "Please acknowledge that fees may apply to a future entry."),
  marketingGuidelinesAcknowledged: z.boolean().refine(Boolean, "Please acknowledge the marketing guidelines."),
  votedArtistReminderAcknowledged: z.boolean().refine(Boolean, "Please acknowledge the voted-artist reminder."),
});

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  publicName: "", email: "", password: "", bio: "", category: "", location: "",
  instagram: "", facebook: "", tiktok: "", youtube: "",
  competitionEntryFeesAcknowledged: false,
  marketingGuidelinesAcknowledged: false,
  votedArtistReminderAcknowledged: false,
};

const closedStatuses = new Set(["draft"]);

export default function RecruitingSignupPage() {
  const params = useParams<{ categorySlug: string; compSlug: string }>();
  const categorySlug = params.categorySlug || "";
  const compSlug = params.compSlug || "";
  const { register, isAuthenticated, user, logout } = useAuth();
  const { toast } = useToast();
  const [createdProfileSlug, setCreatedProfileSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  const { data: competition, isLoading, isError, error, refetch } = useQuery<RecruitingCompetition>({
    queryKey: ["/api/resolve/competition", categorySlug, compSlug],
    queryFn: async () => {
      const response = await fetch(`/api/resolve/competition/${encodeURIComponent(categorySlug)}/${encodeURIComponent(compSlug)}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || (response.status === 404 ? "This competition could not be found." : "We could not load this competition."));
      }
      return response.json();
    },
    enabled: Boolean(categorySlug && compSlug),
    retry: 1,
  });
  const isClosed = Boolean(competition && closedStatuses.has(competition.status.toLowerCase()));
  const shareUrl = useMemo(() => createdProfileSlug
    ? `${window.location.origin}/thequest/${createdProfileSlug}`
    : "", [createdProfileSlug]);

  useSEO({
    title: competition ? `Create your contestant profile | ${competition.title}` : "Create your contestant profile | The Quest",
    description: "Create a free public contestant profile on The Quest. No competition entry or payment is required now.",
    canonical: `/thequest/${encodeURIComponent(categorySlug)}/${encodeURIComponent(compSlug)}/recruiting`,
    ogImage: competition?.coverImage || undefined,
    pending: isLoading,
  });

  const onSubmit = async (values: FormValues) => {
    if (!competition || isClosed || isAuthenticated) return;
    try {
      const result = await register(
        values.email,
        values.password,
        values.publicName,
        undefined,
        2,
        {
          competitionEntryFeesAcknowledged: values.competitionEntryFeesAcknowledged,
          marketingGuidelinesAcknowledged: values.marketingGuidelinesAcknowledged,
          votedArtistReminderAcknowledged: values.votedArtistReminderAcknowledged,
          recruitingCompetitionId: competition.id,
          stageName: values.publicName,
          bio: values.bio || "",
          category: values.category || competition.category || "",
          location: values.location || "",
          socialLinks: {
            instagram: values.instagram || "",
            facebook: values.facebook || "",
            tiktok: values.tiktok || "",
            youtube: values.youtube || "",
          },
        },
      );
      if (!result?.talentProfileId) throw new Error("Your account was created, but we could not retrieve the profile link. Please sign in to continue.");
      setCreatedProfileSlug(slugifyWithId(values.publicName, result.talentProfileId));
      toast({ title: "Your contestant profile is ready", description: "Share your profile to introduce yourself to your audience." });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message.replace(/^\d+:\s*/, "") : "We could not create your account. Please try again.";
      toast({ title: "Account creation failed", description: message, variant: "destructive" });
    }
  };

  const copyProfile = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Profile link copied" });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast({ title: "Could not copy link", description: "Select and copy the profile URL instead.", variant: "destructive" });
    }
  };

  const shareProfile = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "My contestant profile on The Quest", url: shareUrl }); } catch {}
    } else {
      await copyProfile();
    }
  };

  const fieldClass = "min-h-12 border-white/15 bg-[#202020] text-white placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[#ff5a09]";

  return (
    <div className="min-h-[100dvh] bg-[#111111] text-white">
      <SiteNavbar />
      <main className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[430px] bg-[radial-gradient(ellipse_at_top,rgba(255,90,9,0.17),transparent_64%)]" />
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 pt-28 pb-8 sm:px-6 md:pt-32 md:pb-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:px-8 lg:pt-32 lg:pb-16">
          <section className="lg:sticky lg:top-8 lg:self-start" aria-labelledby="signup-title">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#ff8957]">
              <span className="h-px w-7 bg-[#ff5a09]" /> The Quest · Contestant profile
            </p>
            <h1 id="signup-title" className="max-w-xl text-4xl font-black uppercase leading-[0.94] tracking-tight sm:text-5xl lg:text-6xl">
              Your next audience starts here.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/65 sm:text-lg">
              Set up your free public profile, put your work in one place, and share it with the people who should know your name.
            </p>
            <div className="mt-8 border-l-2 border-[#ff5a09] bg-white/[0.035] p-4 sm:p-5" data-testid="competition-referral-source">
              {isLoading ? (
                <div className="space-y-3" role="status" data-testid="status-competition-loading">
                  <div className="h-3 w-28 animate-pulse bg-white/10" />
                  <div className="h-5 w-3/4 animate-pulse bg-white/10" />
                  <span className="sr-only">Loading competition details</span>
                </div>
              ) : competition ? (
                <div className="flex gap-4">
                  {competition.coverImage ? <img src={competition.coverImage} alt="" className="h-16 w-16 shrink-0 object-cover sm:h-20 sm:w-20" /> : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-white/5 text-[#ff8957] sm:h-20 sm:w-20"><Trophy className="h-7 w-7" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Referred by competition</p>
                    <h2 className="mt-1 truncate text-lg font-bold sm:text-xl" data-testid="text-referral-competition">{competition.title}</h2>
                    <p className="mt-1 text-sm text-white/50">{competition.category}</p>
                  </div>
                </div>
              ) : null}
              {isClosed && <p role="status" className="mt-4 text-sm text-amber-200" data-testid="status-competition-closed">This competition recruiting link is not available. Ask the event host for a current link.</p>}
              {isError && <div role="alert" className="mt-3 text-sm text-rose-200" data-testid="status-competition-error">{(error as Error)?.message || "Competition details are unavailable."}</div>}
            </div>
            <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-white/60" data-testid="text-no-entry-required">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ff5a09]" />
              <p><strong className="font-semibold text-white">No payment or competition entry is required now.</strong> This creates your contestant account and public profile only. You can decide about competitions later.</p>
            </div>
          </section>

          <section className="min-w-0 border-t border-white/10 pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0 lg:pl-10">
            {createdProfileSlug ? (
              <div className="mx-auto max-w-xl py-5 sm:py-12" data-testid="signup-success">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#ff5a09]/15 text-[#ff8957]"><Check className="h-6 w-6" /></div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff8957]">Account created</p>
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Your profile is live.</h2>
                <p className="mt-3 text-white/60">Share this link to bring your audience to The Quest. You can add photos and videos from your dashboard whenever you’re ready.</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Input readOnly value={shareUrl} aria-label="Public profile URL" className={`${fieldClass} min-w-0`} data-testid="input-share-profile-url" />
                  <Button onClick={copyProfile} className="min-h-12 shrink-0 bg-[#ff5a09] text-white hover:bg-[#e94f00] focus-visible:ring-2 focus-visible:ring-white" data-testid="button-copy-profile-link">
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
                <Button variant="outline" onClick={shareProfile} className="mt-3 min-h-12 w-full border-white/20 bg-transparent text-white hover:bg-white/10" data-testid="button-share-profile">
                  <Share2 className="mr-2 h-4 w-4" /> Share profile
                </Button>
                <Link href="/dashboard" className="mt-5 flex min-h-12 items-center justify-center gap-2 bg-white px-5 font-bold uppercase tracking-wider text-[#171717] transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a09]" data-testid="link-profile-dashboard">
                  Go to dashboard <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            ) : isAuthenticated ? (
              user?.level === 2 || user?.profileRole === "talent" ? (
                <div className="mx-auto max-w-xl py-6 sm:py-12" data-testid="authenticated-signup-notice">
                  <h2 className="text-3xl font-bold">You’re already on The Quest.</h2>
                  <p className="mt-3 leading-7 text-white/60">Visit your dashboard to manage your contestant profile and add photos or videos.</p>
                  <Link href="/dashboard" className="mt-6 inline-flex min-h-12 items-center gap-2 bg-[#ff5a09] px-6 font-bold uppercase tracking-wider text-white hover:bg-[#e94f00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" data-testid="link-authenticated-dashboard">Open dashboard <ArrowUpRight className="h-4 w-4" /></Link>
                </div>
              ) : (
                <div className="mx-auto max-w-xl py-6 sm:py-12" data-testid="authenticated-non-contestant-notice">
                  <h2 className="text-3xl font-bold">This link is for contestant accounts.</h2>
                  <p className="mt-3 leading-7 text-white/60">You’re signed in with a different account type. Sign out to create a new contestant account through this competition.</p>
                  <Button
                    onClick={() => logout()}
                    className="mt-6 min-h-12 bg-[#ff5a09] px-6 font-bold uppercase tracking-wider text-white hover:bg-[#e94f00] focus-visible:ring-2 focus-visible:ring-white"
                    data-testid="button-sign-out-for-contestant-signup"
                  >
                    Sign out to continue
                  </Button>
                </div>
              )
            ) : isError ? (
              <div className="mx-auto max-w-xl py-6 sm:py-12">
                <h2 className="text-2xl font-bold">We couldn’t load this referral.</h2>
                <p className="mt-2 text-white/60">Try again to load the competition details before creating your contestant profile.</p>
                <Button onClick={() => refetch()} variant="outline" className="mt-5 min-h-11 border-white/20 text-white hover:bg-white/10" data-testid="button-retry-competition">Try again</Button>
              </div>
            ) : isLoading ? (
              <div className="mx-auto max-w-xl space-y-5 py-6" aria-busy="true" data-testid="signup-form-loading">
                <div className="h-8 w-2/3 animate-pulse bg-white/10" /><div className="h-12 animate-pulse bg-white/5" /><div className="h-12 animate-pulse bg-white/5" /><div className="h-28 animate-pulse bg-white/5" />
              </div>
            ) : !competition || isClosed ? (
              <div className="mx-auto max-w-xl py-6 sm:py-12">
                <h2 className="text-2xl font-bold">{isClosed ? "This recruiting link has closed." : "Competition not found."}</h2>
                <p className="mt-3 text-white/60">Ask the event host for a current recruiting link, or browse other competitions.</p>
                <Link href="/competitions" className="mt-6 inline-flex min-h-12 items-center bg-[#ff5a09] px-6 font-bold uppercase tracking-wider text-white hover:bg-[#e94f00]" data-testid="link-browse-competitions">Browse competitions <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
              </div>
            ) : (
              <div className="mx-auto max-w-xl">
                <div className="mb-7">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff8957]">Free account · No entry today</p>
                  <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Create your contestant profile</h2>
                  <p className="mt-2 text-sm leading-6 text-white/55">Start with the essentials. You can polish your profile and upload media later.</p>
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" data-testid="form-recruiting-signup">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <FormField control={form.control} name="publicName" render={({ field }) => <FormItem><FormLabel className="text-sm text-white/80">Public / stage name</FormLabel><FormControl><Input {...field} autoComplete="nickname" placeholder="How should people know you?" className={fieldClass} data-testid="input-public-name" /></FormControl><FormMessage /></FormItem>} />
                      <FormField control={form.control} name="category" render={({ field }) => <FormItem><FormLabel className="text-sm text-white/80">Your category</FormLabel><FormControl><Input {...field} placeholder={competition.category || "Music, dance, comedy…"} className={fieldClass} data-testid="input-category" /></FormControl><FormMessage /></FormItem>} />
                    </div>
                    <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel className="text-sm text-white/80">Email address</FormLabel><FormControl><Input {...field} type="email" autoComplete="email" placeholder="you@example.com" className={fieldClass} data-testid="input-email" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel className="text-sm text-white/80">Password</FormLabel><FormControl><Input {...field} type="password" autoComplete="new-password" placeholder="At least 6 characters" className={fieldClass} data-testid="input-password" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="bio" render={({ field }) => <FormItem><FormLabel className="text-sm text-white/80">A little about you <span className="text-white/40">(optional)</span></FormLabel><FormControl><Textarea {...field} rows={4} placeholder="Tell people what you do and what makes your work yours." className={`${fieldClass} min-h-28 resize-y py-3`} data-testid="input-bio" /></FormControl><p className="text-xs text-white/40">{field.value?.length || 0}/500 characters</p><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="location" render={({ field }) => <FormItem><FormLabel className="text-sm text-white/80">Location <span className="text-white/40">(optional)</span></FormLabel><FormControl><Input {...field} autoComplete="address-level2" placeholder="City, region" className={fieldClass} data-testid="input-location" /></FormControl><FormMessage /></FormItem>} />

                    <fieldset className="border-t border-white/10 pt-5">
                      <legend className="mb-3 text-sm font-semibold text-white/85">Social links <span className="font-normal text-white/40">(optional)</span></legend>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {(["instagram", "facebook", "tiktok", "youtube"] as const).map((name) => (
                          <FormField key={name} control={form.control} name={name} render={({ field }) => <FormItem><FormLabel className="text-xs capitalize text-white/60">{name}</FormLabel><FormControl><Input {...field} type="url" placeholder="https://" className={fieldClass} data-testid={`input-social-${name}`} /></FormControl><FormMessage /></FormItem>} />
                        ))}
                      </div>
                    </fieldset>

                    <div className="space-y-3 border-t border-white/10 pt-5">
                      <p className="text-sm font-semibold text-white/85">Before you continue</p>
                      <FormField control={form.control} name="competitionEntryFeesAcknowledged" render={({ field }) => <FormItem className="flex items-start gap-3"><FormControl><Checkbox id="fees-later" checked={field.value} onCheckedChange={field.onChange} className="mt-1 border-white/35 data-[state=checked]:border-[#ff5a09] data-[state=checked]:bg-[#ff5a09]" data-testid="checkbox-fees-later" /></FormControl><div><FormLabel htmlFor="fees-later" className="cursor-pointer text-sm font-normal leading-6 text-white/65">I understand that a future competition nomination or entry may require a registration donation. This signup does not enter me into a competition.</FormLabel><FormMessage /></div></FormItem>} />
                      <FormField control={form.control} name="marketingGuidelinesAcknowledged" render={({ field }) => <FormItem className="flex items-start gap-3"><FormControl><Checkbox id="marketing-guidelines" checked={field.value} onCheckedChange={field.onChange} className="mt-1 border-white/35 data-[state=checked]:border-[#ff5a09] data-[state=checked]:bg-[#ff5a09]" data-testid="checkbox-marketing-guidelines" /></FormControl><div><FormLabel htmlFor="marketing-guidelines" className="cursor-pointer text-sm font-normal leading-6 text-white/65">{MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT}</FormLabel><FormMessage /></div></FormItem>} />
                      <FormField control={form.control} name="votedArtistReminderAcknowledged" render={({ field }) => <FormItem className="flex items-start gap-3"><FormControl><Checkbox id="voted-artist-reminder" checked={field.value} onCheckedChange={field.onChange} className="mt-1 border-white/35 data-[state=checked]:border-[#ff5a09] data-[state=checked]:bg-[#ff5a09]" data-testid="checkbox-voted-artist-reminder" /></FormControl><div><FormLabel htmlFor="voted-artist-reminder" className="cursor-pointer text-sm font-normal leading-6 text-white/65">{VOTED_ARTIST_REMINDER_ACKNOWLEDGMENT_TEXT}</FormLabel><FormMessage /></div></FormItem>} />
                    </div>
                    <div className="border-l-2 border-[#ff5a09] bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white/60" data-testid="text-payment-not-required">
                      Creating this account is free. No payment, nomination, or competition entry happens during signup.
                    </div>
                    <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-[52px] w-full bg-[#ff5a09] text-base font-bold uppercase tracking-[0.12em] text-white hover:bg-[#e94f00] focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60" data-testid="button-create-account">
                      {form.formState.isSubmitting ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Creating profile</> : "Create free contestant account"}
                    </Button>
                    <p className="text-center text-xs leading-5 text-white/40">By creating an account, you agree to The Quest’s applicable terms and policies.</p>
                  </form>
                </Form>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
