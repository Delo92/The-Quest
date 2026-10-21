import { ArrowRight, BadgeCheck, HandHeart, HeartHandshake, Mail, Sparkles } from "lucide-react";
import { Link } from "wouter";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";

const steps = [
  {
    number: "01",
    title: "Be considered",
    copy: "Eligible organizations can contact The Quest to share their mission and learn how they may be considered in the program.",
  },
  {
    number: "02",
    title: "A participant chooses",
    copy: "Contestants and event hosts select their own eligible nonprofit and choose a contribution rate from 1% to 10% of their eligible earnings. If no rate is selected, 10% applies.",
  },
  {
    number: "03",
    title: "The Quest matches",
    copy: "The Quest matches the participant’s recorded contribution dollar-for-dollar, subject to the platform’s available share. The participant—not a voter or nominator—makes the final choice of organization.",
  },
];

export default function NonprofitsPage() {
  const { getText } = useLivery();
  const contactEmail = getText("contact_email", "admin@thequest.com") || "admin@thequest.com";
  const inquirySubject = encodeURIComponent("Nonprofit participation inquiry");
  const inquiryBody = encodeURIComponent(
    "Hello The Quest,\n\nOur organization would like to learn about eligibility and being considered for the nonprofit program.\n\nOrganization name:\nWebsite:\nContact name:\nMission:",
  );
  const inquiryHref = `mailto:${contactEmail}?subject=${inquirySubject}&body=${inquiryBody}`;

  useSEO({
    title: "Nonprofit Program | The Quest",
    description: "Learn how The Quest nonprofit program works, how participants choose eligible organizations, and how nonprofits can ask to be considered.",
    canonical: "/NonProfits",
  });

  return (
    <div className="min-h-screen bg-[#f4f3ec] text-[#17392d]" data-testid="page-nonprofits">
      <SiteNavbar forceDark />

      <main className="pt-28 sm:pt-32">
        <section className="relative overflow-hidden bg-[#17392d] text-[#f5f3e9]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border border-[#d4e27b]/15 sm:h-[30rem] sm:w-[30rem]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-12 h-56 w-56 rounded-full border border-[#d4e27b]/20 sm:h-[22rem] sm:w-[22rem]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-12 lg:py-24">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#d4e27b]">
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                The Quest nonprofit program
              </p>
              <h1 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                Your mission belongs in the spotlight.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#f5f3e9]/75 sm:text-lg">
                The Quest brings talent, audiences, and eligible nonprofits together. Contestants and hosts can direct a share of their eligible earnings to an organization they choose—and The Quest matches those contributions when funds are available.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={inquiryHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d4e27b] px-5 text-sm font-bold uppercase tracking-wider text-[#17392d] transition-colors hover:bg-[#e4eea7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17392d]"
                  data-testid="button-nonprofit-inquiry"
                >
                  Ask to be considered <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <Link
                  href="/competitions"
                  className="inline-flex min-h-12 items-center justify-center border border-white/30 px-5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  data-testid="link-nonprofits-competitions"
                >
                  Explore The Quest
                </Link>
              </div>
            </div>

            <aside className="border-l border-[#d4e27b]/50 pl-5 sm:pl-7 lg:mb-2" aria-label="Program highlights">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4e27b]">A participant-led program</p>
              <p className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">Chosen by the people who compete and host.</p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#f5f3e9]/65">
                There is no Quest-selected nonprofit. Each participant names their own eligible organization in their account.
              </p>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12" aria-labelledby="how-giving-works">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="max-w-md">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#697f36]">How giving works</p>
              <h2 id="how-giving-works" className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
                A clear path from participant choice to nonprofit support.
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-[#17392d]/70 sm:text-base">
                Each contribution comes from a contestant’s or host’s own eligible earnings—not from a voter choosing a recipient at checkout.
              </p>
            </div>

            <ol className="divide-y divide-[#17392d]/15 border-y border-[#17392d]/15">
              {steps.map((step) => (
                <li key={step.number} className="grid gap-3 py-6 sm:grid-cols-[4rem_1fr] sm:gap-5">
                  <span className="font-serif text-2xl text-[#82954b]" aria-hidden="true">{step.number}</span>
                  <div>
                    <h3 className="text-lg font-bold text-[#17392d]">{step.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#17392d]/70">{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y border-[#17392d]/10 bg-white/65">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:px-12">
            <div className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#e4e8ce] text-[#31513a]">
                <HandHeart className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold">For nonprofit organizations</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#17392d]/70">
                  If your organization is an eligible state- or nationally accredited nonprofit, contact us with your website and mission. We’ll follow up about eligibility and how participants may consider your organization. An inquiry is not a registration, listing, selection, or promise of donations.
                </p>
                <a href={inquiryHref} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#31513a] underline decoration-[#82954b] underline-offset-4 hover:text-[#697f36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#697f36]" data-testid="link-nonprofit-contact">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Email The Quest about your organization
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#f3e4d8] text-[#a24c21]">
                <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold">For voters and supporters</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#17392d]/70">
                  A paid vote contribution is processed by The Quest and adds votes. It is not sent directly to a nonprofit at checkout, and the voter does not choose the nonprofit or contribution amount. The nonprofit program is funded separately through participant earnings and the Quest match.
                </p>
                <Link href="/competitions" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#31513a] underline decoration-[#82954b] underline-offset-4 hover:text-[#697f36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#697f36]" data-testid="link-nonprofits-vote">
                  Explore competitions <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12" aria-label="Program transparency">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex gap-4">
              <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[#a24c21]" aria-hidden="true" />
              <div>
                <h2 className="font-serif text-2xl">Built around choice, with the details in the open.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#17392d]/70">
                  Contributions and matching amounts are recorded as part of The Quest’s payout operations; the app does not initiate nonprofit transfers automatically. Participants make the final choice of nonprofit and rate, and match amounts depend on The Quest’s available share.
                </p>
              </div>
            </div>
            <Link href="/about" className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#17392d]/25 px-4 text-sm font-bold text-[#17392d] transition-colors hover:bg-[#17392d]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#697f36]" data-testid="link-nonprofits-about">
              About The Quest
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
