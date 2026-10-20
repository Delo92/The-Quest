import { ArrowUpRight, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OCReferralBannerProps {
  href: string;
  audience: "artist" | "host";
}

export default function OCReferralBanner({ href, audience }: OCReferralBannerProps) {
  const label = audience === "artist" ? "artist" : "host";

  return (
    <section
      className="rounded-xl border border-orange-400/20 bg-orange-400/[0.05] p-4 sm:p-5"
      aria-labelledby={`oc-referral-title-${audience}`}
      data-testid={`oc-referral-banner-${audience}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-400/10 text-orange-300">
            <Megaphone className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id={`oc-referral-title-${audience}`} className="text-sm font-semibold text-white">
              Tired of remembering to post?
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/65">
              Original Concepts can help automate social posts for your {label} brand. Use promo code{" "}
              <span className="font-semibold text-orange-200">THE QUEST</span> for free automation during your first Quest competition.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/40">
              Continuing opens Original Concepts and shares your email, name, and social profile links to prefill setup.
            </p>
          </div>
        </div>
        <Button
          asChild
          className="min-h-11 w-full shrink-0 gap-2 bg-orange-500 text-white hover:bg-orange-400 sm:w-auto"
          data-testid={`button-oc-referral-${audience}`}
        >
          <a href={href} target="_blank" rel="noopener noreferrer">
            Set up free posting
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  );
}
