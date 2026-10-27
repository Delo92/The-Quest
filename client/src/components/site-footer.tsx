import { Link } from "wouter";
import CBLogo from "@/components/cb-logo";
import { useLivery } from "@/hooks/use-livery";
import { resolveSupportEmail } from "@shared/support-contact";

export default function SiteFooter() {
  const { getText } = useLivery();
  const supportEmail = resolveSupportEmail(getText("contact_email", ""));
  const isQuestSection = window.location.pathname === "/thequest" || window.location.pathname.startsWith("/thequest/");
  const hostHref = isQuestSection ? "/host" : "/thequest/host";

  return (
    <footer className="bg-[#111111] py-8" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CBLogo size="lg" showText />
        </div>
        <nav className="flex flex-wrap items-center gap-6">
          <Link
            href="/"
            className="text-white/60 text-sm uppercase tracking-widest transition-colors duration-300 hover:text-white"
            data-testid="link-footer-home"
          >
            Home
          </Link>
          <Link
            href="/competitions"
            className="text-white/60 text-sm uppercase tracking-widest transition-colors duration-300 hover:text-white"
            data-testid="link-footer-competitions"
          >
            Competitions
          </Link>
          <Link
            href="/nominate"
            className="text-white/60 text-sm uppercase tracking-widest transition-colors duration-300 hover:text-white"
            data-testid="link-footer-join"
          >
            Nominate
          </Link>
          <a
            href="/thequest/nominationindex"
            className="text-white/60 text-sm uppercase tracking-widest transition-colors duration-300 hover:text-white"
            data-testid="link-footer-talent-directory"
          >
            Talent Directory
          </a>
          <Link
            href={hostHref}
            className="text-white/60 text-sm uppercase tracking-widest transition-colors duration-300 hover:text-white"
            data-testid="link-footer-host"
          >
            Host an Event
          </Link>
          <Link
            href="/NonProfits"
            className="text-white/60 text-sm uppercase tracking-widest transition-colors duration-300 hover:text-white"
            data-testid="link-footer-nonprofits"
          >
            Nonprofits
          </Link>
          <Link
            href="/about"
            className="text-white/60 text-sm uppercase tracking-widest transition-colors duration-300 hover:text-white"
            data-testid="link-footer-about"
          >
            About
          </Link>
          <Link
            href="/faq"
            className="text-white/60 text-sm uppercase tracking-widest transition-colors duration-300 hover:text-white"
            data-testid="link-footer-faq"
          >
            FAQ
          </Link>
        </nav>
        <p className="text-xs text-white/30">
          &copy; {new Date().getFullYear()} The Quest
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 border-t border-white/5 pt-4">
        <p className="mb-3 text-center text-sm text-white/65" data-testid="footer-support-details">
          Need help? Email support:{" "}
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex min-h-11 max-w-full items-center break-all rounded-sm font-medium text-orange-400 underline-offset-4 hover:text-orange-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            data-testid="link-footer-support-email"
          >
            {supportEmail}
          </a>
        </p>
        <p className="text-[10px] text-white/20 text-center" data-testid="text-designed-by">Designed by : <a href="https://oraginalconcepts.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/40 transition-colors">Oraginal Concepts</a></p>
      </div>
    </footer>
  );
}
