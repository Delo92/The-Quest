import { Link } from "wouter";
import CBLogo from "@/components/cb-logo";

export default function SiteFooter() {
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
        <p className="text-[10px] text-white/20 text-center" data-testid="text-designed-by">Designed by : <a href="https://oraginalconcepts.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/40 transition-colors">Oraginal Concepts</a></p>
      </div>
    </footer>
  );
}
