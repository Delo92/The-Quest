import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useViewerSession } from "@/hooks/use-viewer-session";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLivery } from "@/hooks/use-livery";
import { ShoppingCart, Radio } from "lucide-react";

function useAnimatedCounter(targetValue: number, duration: number = 800) {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const startValue = displayValue;
    const diff = targetValue - startValue;
    if (diff === 0) return;

    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * eased));

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [targetValue, duration]);

  return displayValue;
}

function LiveVoteCounter() {
  const [totalVotes, setTotalVotes] = useState<number | null>(null);
  const animatedCount = useAnimatedCounter(totalVotes ?? 0);

  const fetchVotes = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/total-votes");
      if (res.ok) {
        const data = await res.json();
        setTotalVotes(data.totalVotes);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchVotes();
    const interval = setInterval(fetchVotes, 5000);
    return () => clearInterval(interval);
  }, [fetchVotes]);

  if (totalVotes === null) return null;

  return (
    <div className="flex items-center gap-1.5 text-white" data-testid="live-vote-counter">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      <span className="text-xs font-bold uppercase tracking-wider tabular-nums">
        {animatedCount.toLocaleString()}
      </span>
      <span className="text-[10px] text-white/60 uppercase tracking-wider hidden sm:inline">
        votes
      </span>
    </div>
  );
}

export default function SiteNavbar() {
  const { user, isAuthenticated } = useAuth();
  const { isViewerLoggedIn } = useViewerSession();
  const { getImage, getMedia } = useLivery();
  const isLoggedIn = isAuthenticated || isViewerLoggedIn;
  const dashboardHref = isViewerLoggedIn ? "/viewer" : "/dashboard";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-black/95 backdrop-blur-sm" : "bg-transparent"}`}
      data-testid="site-navbar"
    >
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-7 bg-black/60 backdrop-blur-sm border-b border-white/5 max-w-7xl mx-auto w-full">
        <a href="/" className="text-white/40 text-[10px] uppercase tracking-widest hover:text-white/70 transition-colors">← CB Publishing</a>
        <LiveVoteCounter />
        <div className="w-24" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-20">
        <Link href="/" className="flex items-center gap-3" data-testid="link-home">
          {getMedia("logo", "/images/template/logo.png").type === "video" ? (
            <video src={getMedia("logo", "/images/template/logo.png").url} className="h-12 sm:h-16 md:h-20" autoPlay muted loop playsInline />
          ) : (
            <img src={getImage("logo", "/images/template/logo.png")} alt="The Quest" className="h-12 sm:h-16 md:h-20" />
          )}
        </Link>

        <button
          className="md:hidden text-white"
          onClick={() => setMenuOpen(!menuOpen)}
          data-testid="button-mobile-menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/"
            className="text-white text-sm font-bold uppercase tracking-wider transition-colors duration-300 hover:text-white/70"
            data-testid="link-nav-home"
          >
            Home
          </Link>
          <Link
            href="/competitions"
            className="text-white text-sm font-bold uppercase tracking-wider transition-colors duration-300 hover:text-white/70"
            data-testid="link-nav-competitions"
          >
            Competitions
          </Link>
          <Link
            href="/nominate"
            className="text-white text-sm font-bold uppercase tracking-wider transition-colors duration-300 hover:text-white/70"
            data-testid="link-nav-join"
          >
            Nominate
          </Link>
          <Link
            href="/about"
            className="text-white text-sm font-bold uppercase tracking-wider transition-colors duration-300 hover:text-white/70"
            data-testid="link-nav-about"
          >
            About
          </Link>
          <Link
            href="/faq"
            className="text-white text-sm font-bold uppercase tracking-wider transition-colors duration-300 hover:text-white/70"
            data-testid="link-nav-faq"
          >
            FAQ
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/competitions"
            className="inline-flex items-center gap-1 bg-[#FF5A09] text-white font-bold text-xs uppercase tracking-wider px-4 py-2 transition-all duration-300 hover:bg-[#e04f08]"
            data-testid="link-nav-vote"
          >
            Vote
          </Link>
          <Link
            href="/my-purchases"
            className="text-white transition-colors duration-500 hover:text-[#FF5A09]"
            data-testid="link-nav-cart"
          >
            <ShoppingCart className="h-5 w-5" />
          </Link>
          {isLoggedIn ? (
            <Link
              href={dashboardHref}
              className="text-white font-bold text-base cursor-pointer transition-colors duration-500 hover:text-white/70"
              data-testid="link-nav-dashboard"
            >
              {isViewerLoggedIn ? "My Account" : "Dashboard"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-white font-bold text-base cursor-pointer transition-colors duration-500 hover:text-white/70"
              data-testid="link-nav-login"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 px-4 py-4">
          <Link
            href="/"
            className="block py-2 text-white font-bold uppercase tracking-wider text-sm"
            onClick={() => setMenuOpen(false)}
            data-testid="link-mobile-home"
          >
            Home
          </Link>
          <Link
            href="/competitions"
            className="block py-2 text-white font-bold uppercase tracking-wider text-sm"
            onClick={() => setMenuOpen(false)}
            data-testid="link-mobile-competitions"
          >
            Competitions
          </Link>
          <Link
            href="/nominate"
            className="block py-2 text-white font-bold uppercase tracking-wider text-sm"
            onClick={() => setMenuOpen(false)}
            data-testid="link-mobile-join"
          >
            Nominate
          </Link>
          <Link
            href="/about"
            className="block py-2 text-white font-bold uppercase tracking-wider text-sm"
            onClick={() => setMenuOpen(false)}
            data-testid="link-mobile-about"
          >
            About
          </Link>
          <Link
            href="/faq"
            className="block py-2 text-white font-bold uppercase tracking-wider text-sm"
            onClick={() => setMenuOpen(false)}
            data-testid="link-mobile-faq"
          >
            FAQ
          </Link>
          <Link
            href="/competitions"
            className="block py-2 text-[#FF5A09] font-bold uppercase tracking-wider text-sm"
            onClick={() => setMenuOpen(false)}
            data-testid="link-mobile-vote"
          >
            Vote
          </Link>
          <Link
            href="/my-purchases"
            className="flex items-center gap-2 py-2 text-white font-bold uppercase tracking-wider text-sm"
            onClick={() => setMenuOpen(false)}
            data-testid="link-mobile-cart"
          >
            <ShoppingCart className="h-4 w-4" />
            My Purchases
          </Link>
          {isLoggedIn ? (
            <Link
              href={dashboardHref}
              className="block py-2 text-white font-bold text-sm"
              onClick={() => setMenuOpen(false)}
              data-testid="link-mobile-dashboard"
            >
              {isViewerLoggedIn ? "My Account" : "Dashboard"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="block py-2 text-white font-bold text-sm"
              onClick={() => setMenuOpen(false)}
              data-testid="link-mobile-login"
            >
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
