import { Link } from "wouter";
import CBLogo from "@/components/cb-logo";
import { useAuth } from "@/hooks/use-auth";
import { useViewerSession } from "@/hooks/use-viewer-session";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLivery } from "@/hooks/use-livery";
import { ShoppingCart, Radio } from "lucide-react";
import { VOTE_COUNT_UPDATED_EVENT } from "@/lib/vote-count-events";

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
      const res = await fetch("/api/stats/total-votes", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTotalVotes(data.totalVotes);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchVotes();
    const handleVoteCountUpdated = () => { void fetchVotes(); };
    const handleVisibilityChange = () => {
      if (!document.hidden) void fetchVotes();
    };
    window.addEventListener(VOTE_COUNT_UPDATED_EVENT, handleVoteCountUpdated);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Keep public counters reasonably current without refetching on every render.
    const interval = setInterval(() => {
      if (!document.hidden) void fetchVotes();
    }, 15_000);
    return () => {
      clearInterval(interval);
      window.removeEventListener(VOTE_COUNT_UPDATED_EVENT, handleVoteCountUpdated);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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

const desktopNavItemClass =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] px-2.5 text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.25)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[var(--quest-brand)]/55 hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-0";

export default function SiteNavbar() {
  const { user, isAuthenticated } = useAuth();
  const { isViewerLoggedIn } = useViewerSession();
  const { getImage, getMedia, getText } = useLivery();
  const isLoggedIn = isAuthenticated || isViewerLoggedIn;
  const questBrand = getText("quest_brand_color", "#FF5A09");
  const questBrandDark = (() => {
    const h = questBrand.replace("#", "");
    if (h.length !== 6) return questBrand;
    const f = 0.85;
    return `#${[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)].map(c=>Math.round(c*f).toString(16).padStart(2,"0")).join("")}`;
  })();
  const dashboardHref = isViewerLoggedIn ? "/viewer" : "/dashboard";
  const isQuestSection = window.location.pathname === "/thequest" || window.location.pathname.startsWith("/thequest/");
  const homeHref = isQuestSection ? "/thequest" : "/";
  const hostHref = isQuestSection ? "/host" : "/thequest/host";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <style>{`:root { --quest-brand: ${questBrand}; --quest-brand-dark: ${questBrandDark}; }`}</style>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.42)] ${scrolled ? "bg-black/95 backdrop-blur-xl" : "bg-[#0b0d0c]/82 backdrop-blur-lg"}`}
        data-testid="site-navbar"
      >
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-7 bg-black/60 backdrop-blur-sm border-b border-white/5 max-w-7xl mx-auto w-full">
        <a href="/" className="text-white/40 text-[10px] uppercase tracking-widest hover:text-white/70 transition-colors">← CB Publishing</a>
        <LiveVoteCounter />
        <div className="w-24" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-20">
        <a href={homeHref} className="flex items-center gap-3" data-testid="link-home">
          <CBLogo size="md" />
        </a>

        <div className="flex items-center gap-3 lg:hidden">
          <Link
            href={hostHref}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--quest-brand)]/65 bg-[var(--quest-brand)]/10 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--quest-brand)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--quest-brand)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-0"
            data-testid="link-mobile-host"
          >
            Host an Event
          </Link>
          <button
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_4px_12px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-site-navigation"
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
        </div>

        <div className="hidden lg:flex items-center gap-1.5 xl:gap-2">
          <a
            href={homeHref}
            className={desktopNavItemClass}
            data-testid="link-nav-home"
          >
            Home
          </a>
          <Link
            href="/competitions"
            className={desktopNavItemClass}
            data-testid="link-nav-competitions"
          >
            Competitions
          </Link>
          <Link
            href="/nominate"
            className={desktopNavItemClass}
            data-testid="link-nav-join"
          >
            Nominate
          </Link>
          <Link
            href="/about"
            className={desktopNavItemClass}
            data-testid="link-nav-about"
          >
            About
          </Link>
          <Link
            href="/faq"
            className={desktopNavItemClass}
            data-testid="link-nav-faq"
          >
            FAQ
          </Link>
        </div>

        <div className="hidden lg:flex items-center gap-2.5 xl:gap-3">
          <Link
            href={hostHref}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--quest-brand)]/65 bg-[var(--quest-brand)]/10 px-3 text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-[var(--quest-brand)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--quest-brand)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-0"
            data-testid="link-nav-host"
          >
            Host an Event
          </Link>
          <Link
            href="/competitions"
            className="inline-flex min-h-10 items-center gap-1 rounded-md border border-white/20 bg-[var(--quest-brand)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_5px_16px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--quest-brand-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-0"
            data-testid="link-nav-vote"
          >
            Vote
          </Link>
          <Link
            href="/my-purchases"
            aria-label="My purchases"
            title="My purchases"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/[0.045] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_4px_12px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[var(--quest-brand)]/55 hover:bg-white/[0.09] hover:text-[var(--quest-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-0"
            data-testid="link-nav-cart"
          >
            <ShoppingCart className="h-5 w-5" />
          </Link>
          {isLoggedIn ? (
            <Link
              href={dashboardHref}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/[0.045] px-3 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_4px_12px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-0"
              data-testid="link-nav-dashboard"
            >
              {isViewerLoggedIn ? "My Account" : "Dashboard"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/[0.045] px-3 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_4px_12px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-0"
              data-testid="link-nav-login"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-site-navigation" className="lg:hidden border-t border-white/10 bg-[#0b0d0c]/98 px-4 pb-safe shadow-[0_16px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="space-y-1 py-3">
            {[
              { href: homeHref, label: "Home", testid: "link-mobile-home", isAnchor: true },
              { href: "/competitions", label: "Competitions", testid: "link-mobile-competitions" },
              { href: "/nominate", label: "Nominate", testid: "link-mobile-join" },
              { href: "/about", label: "About", testid: "link-mobile-about" },
              { href: "/faq", label: "FAQ", testid: "link-mobile-faq" },
            ].map(({ href, label, testid, isAnchor }) =>
              isAnchor ? (
                <a key={href} href={href} className="flex min-h-11 items-center rounded-md border border-white/10 bg-white/[0.035] px-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)]" data-testid={testid}>
                  {label}
                </a>
              ) : (
                <Link key={href} href={href} className="flex min-h-11 items-center rounded-md border border-white/10 bg-white/[0.035] px-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)]" onClick={() => setMenuOpen(false)} data-testid={testid}>
                  {label}
                </Link>
              )
            )}
          </div>
          <div className="py-3 space-y-3">
            <Link
              href="/competitions"
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-[var(--quest-brand)] text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_5px_16px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => setMenuOpen(false)}
              data-testid="link-mobile-vote"
            >
              Vote Now
            </Link>
            <Link
              href="/my-purchases"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/[0.04] text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quest-brand)]"
              onClick={() => setMenuOpen(false)}
              data-testid="link-mobile-cart"
            >
              <ShoppingCart className="h-4 w-4" />
              My Purchases
            </Link>
            {isLoggedIn ? (
              <Link
                href={dashboardHref}
                className="flex min-h-12 w-full items-center justify-center rounded-md border border-white/15 bg-white/[0.035] text-sm font-bold text-white"
                onClick={() => setMenuOpen(false)}
                data-testid="link-mobile-dashboard"
              >
                {isViewerLoggedIn ? "My Account" : "Dashboard"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex min-h-12 w-full items-center justify-center rounded-md border border-white/15 bg-white/[0.035] text-sm font-bold text-white"
                onClick={() => setMenuOpen(false)}
                data-testid="link-mobile-login"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
    </>
  );
}
