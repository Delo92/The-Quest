import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, HeartHandshake, Pause, Play } from "lucide-react";
import { useCardWidth } from "@/components/hero-coverflow-gallery";

export interface NonprofitDirectoryEntry {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  source: "featured" | "participant";
}

function validWebsite(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function OrganizationLogo({ entry }: { entry: NonprofitDirectoryEntry }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [entry.logoUrl]);

  if (entry.logoUrl && !failed) {
    return <img src={entry.logoUrl} alt="" onError={() => setFailed(true)} draggable={false} />;
  }
  return <HeartHandshake aria-hidden="true" />;
}

export default function NonprofitDirectoryWheel({
  organizations,
}: {
  organizations: NonprofitDirectoryEntry[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const cardWidth = useCardWidth();
  const total = organizations.length;
  const currentIndex = total ? activeIndex % total : 0;
  const isPaused = isHovered || isFocused || isPausedByUser;

  const go = useCallback((direction: number) => {
    if (total < 2) return;
    setActiveIndex((previous) => ((previous + direction) % total + total) % total);
  }, [total]);

  const goTo = useCallback((index: number) => {
    if (total < 1) return;
    setActiveIndex(((index % total) + total) % total);
  }, [total]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (total < 2 || !isInView || isPaused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % total);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [activeIndex, isInView, isPaused, reducedMotion, total]);

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;
    const difference = startX - event.changedTouches[0].screenX;
    if (Math.abs(difference) >= 45) go(difference > 0 ? 1 : -1);
  };

  if (!total) return null;

  return (
    <div
      ref={rootRef}
      className="quest-np-wheel"
      role="region"
      aria-label="Nonprofit organization directory"
      aria-roledescription="carousel"
      data-testid="nonprofit-directory-wheel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsFocused(false);
        }
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0]?.screenX ?? null;
      }}
      onTouchEnd={handleTouchEnd}
    >
      <div className="quest-np-wheel-stage" aria-live="off">
        {organizations.map((entry, index) => {
          let offset = index - currentIndex;
          if (offset > total / 2) offset -= total;
          else if (offset < -total / 2) offset += total;
          const distance = Math.abs(offset);
          if (distance > 2) return null;

          const isCurrent = index === currentIndex;
          const step = Math.round(cardWidth * 0.7);
          const translateX = offset * step;
          const translateZ = -distance * 100;
          const rotateY = -Math.sign(offset) * Math.min(distance * 34, 48);
          const scale = 1 - distance * 0.1;

          return (
            <div
              key={entry.id}
              className={`quest-np-wheel-position ${isCurrent ? "is-current" : `is-offset-${offset}`}`}
              style={{
                transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity: 1 - distance * 0.24,
                zIndex: 20 - distance,
              }}
              data-testid={`nonprofit-wheel-item-${index}`}
            >
              {isCurrent ? (
                <article className="quest-np-wheel-card" role="group" aria-label={`${entry.name}, ${index + 1} of ${total}`}>
                  <div className="quest-np-wheel-photo">
                    <OrganizationLogo entry={entry} />
                  </div>
                  <div className="quest-np-wheel-info">
                    <small>{entry.source === "featured" ? "Featured program organization" : "Participant-entered organization"}</small>
                    <h2>{entry.name}</h2>
                    {validWebsite(entry.website) ? (
                      <a
                        className="quest-np-wheel-link"
                        href={validWebsite(entry.website) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visit ${entry.name} website, opens in a new tab`}
                      >
                        <span>Visit organization</span>
                        <ExternalLink size={15} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="quest-np-wheel-no-link">No public website provided</span>
                    )}
                  </div>
                </article>
              ) : (
                <button
                  type="button"
                  className="quest-np-wheel-card quest-np-wheel-preview"
                  onClick={() => goTo(index)}
                  aria-label={`Show ${entry.name}`}
                  tabIndex={distance === 1 ? 0 : -1}
                >
                  <div className="quest-np-wheel-photo">
                    <OrganizationLogo entry={entry} />
                  </div>
                  <div className="quest-np-wheel-preview-name">{entry.name}</div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <div className="quest-np-wheel-controls">
          <button type="button" className="quest-np-wheel-control" onClick={() => go(-1)} aria-label="Previous nonprofit">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="quest-np-wheel-count" aria-label={`Organization ${currentIndex + 1} of ${total}`}>
            {String(currentIndex + 1).padStart(2, "0")} <span>/</span> {String(total).padStart(2, "0")}
          </span>
          <button type="button" className="quest-np-wheel-control" onClick={() => go(1)} aria-label="Next nonprofit">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="quest-np-wheel-control quest-np-wheel-pause"
            onClick={() => setIsPausedByUser((paused) => !paused)}
            aria-label={reducedMotion ? "Automatic rotation is disabled by your reduced motion setting" : isPausedByUser ? "Resume automatic rotation" : "Pause automatic rotation"}
            aria-pressed={isPausedByUser}
            disabled={Boolean(reducedMotion)}
          >
            {isPausedByUser ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}
