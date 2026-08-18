import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { slugify } from "@shared/slugify";

interface GalleryItem {
  categoryId: string;
  categoryName: string;
  thumbnail: string | null;
  videoEmbedUrl: string | null;
  coverVideoUrl: string | null;
  topContestantName: string | null;
  voteCount: number;
  competitionCount: number;
  competitionSlug: string | null;
  contestantSlug: string | null;
}

function CardWrapper({ useLink, href, children }: { useLink: boolean; href: string; children: React.ReactNode }) {
  if (useLink) {
    return <Link href={href}>{children}</Link>;
  }
  return <div className="cursor-pointer">{children}</div>;
}

interface HeroCoverflowGalleryProps {
  onCardClick?: (categoryName: string) => void;
}

export default function HeroCoverflowGallery({ onCardClick }: HeroCoverflowGalleryProps = {}) {
  const { data: items = [], isLoading } = useQuery<GalleryItem[]>({
    queryKey: ["/api/hero-gallery"],
    staleTime: 60000,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalItems = items.length;

  const startAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    autoplayRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % (totalItems || 1));
    }, 15000);
  }, [totalItems]);

  useEffect(() => {
    if (totalItems > 1) {
      startAutoplay();
    }
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [totalItems, startAutoplay]);

  const navigate = useCallback((direction: number) => {
    if (isAnimating || totalItems === 0) return;
    setIsAnimating(true);
    setCurrentIndex(prev => {
      let next = prev + direction;
      if (next < 0) next = totalItems - 1;
      else if (next >= totalItems) next = 0;
      return next;
    });
    startAutoplay();
    setTimeout(() => setIsAnimating(false), 600);
  }, [isAnimating, totalItems, startAutoplay]);

  const goToIndex = useCallback((index: number) => {
    if (isAnimating || index === currentIndex) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    startAutoplay();
    setTimeout(() => setIsAnimating(false), 600);
  }, [isAnimating, currentIndex, startAutoplay]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        navigate(diff > 0 ? 1 : -1);
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [navigate]);

  if (isLoading || totalItems === 0) {
    return (
      <div className="w-full" data-testid="hero-coverflow-gallery-skeleton">
        <div className="coverflow-container" style={{ perspective: "1200px" }}>
          <div className="coverflow-track">
            {[0, 1, 2, 3, 4].map((i) => {
              const offset = i - 2;
              const absOffset = Math.abs(offset);
              const sign = Math.sign(offset);
              const translateX = offset * 200;
              const translateZ = -absOffset * 180;
              const rotateY = -sign * Math.min(absOffset * 55, 55);
              const opacity = absOffset > 3 ? 0 : 1 - absOffset * 0.2;
              const scale = 1 - absOffset * 0.08;
              return (
                <div
                  key={i}
                  className="coverflow-item"
                  style={{
                    transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                    opacity,
                    zIndex: 10 - absOffset,
                  }}
                >
                  <div className="coverflow-cover">
                    <div className="w-full h-full bg-black/40 animate-pulse rounded" />
                  </div>
                  <div className="coverflow-info">
                    <div className="h-4 w-32 bg-white/10 animate-pulse rounded mx-auto mb-2" />
                    <div className="h-3 w-20 bg-white/10 animate-pulse rounded mx-auto" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="hero-coverflow-gallery">
      <div
        ref={containerRef}
        className="coverflow-container"
        style={{ perspective: "1200px" }}
      >
        <div className="coverflow-track">
          {items.map((item, index) => {
            let offset = index - currentIndex;
            if (offset > totalItems / 2) offset -= totalItems;
            else if (offset < -totalItems / 2) offset += totalItems;

            const absOffset = Math.abs(offset);
            const sign = Math.sign(offset);

            const translateX = offset * 200;
            const translateZ = -absOffset * 180;
            const rotateY = -sign * Math.min(absOffset * 55, 55);
            const opacity = absOffset > 3 ? 0 : 1 - absOffset * 0.2;
            const scale = 1 - absOffset * 0.08;
            const finalTranslateX = absOffset > 3 ? sign * 700 : translateX;

            return (
              <div
                key={item.categoryId}
                className="coverflow-item"
                style={{
                  transform: `translateX(${finalTranslateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex: 100 - absOffset,
                }}
                onClick={(e) => {
                  if (index !== currentIndex) {
                    e.preventDefault();
                    goToIndex(index);
                  } else if (onCardClick) {
                    e.preventDefault();
                    onCardClick(item.categoryName);
                  }
                }}
                data-testid={`gallery-item-${item.categoryId}`}
              >
                <CardWrapper useLink={!onCardClick} href={
                  item.competitionSlug && item.contestantSlug
                    ? `/${slugify(item.categoryName || "")}/${item.competitionSlug}/${item.contestantSlug}`
                    : item.competitionSlug
                    ? `/${slugify(item.categoryName || "")}/${item.competitionSlug}`
                    : `/competitions?category=${encodeURIComponent(item.categoryName || "")}`
                }>
                  <div className="coverflow-vote-badge">
                    <span className="coverflow-vote-dot" />
                    <span className="coverflow-vote-count">{item.voteCount.toLocaleString()}</span>
                    <span className="coverflow-vote-label">VOTES</span>
                  </div>
                  <div className="coverflow-card-wrapper">
                    <div className="coverflow-cover">
                      {item.videoEmbedUrl && index === currentIndex ? (
                        <>
                          <iframe
                            src={`${item.videoEmbedUrl}${item.videoEmbedUrl.includes('?') ? '&' : '?'}autoplay=1&muted=1&loop=1&background=1`}
                            className="w-full h-full"
                            allow="autoplay; fullscreen"
                            frameBorder="0"
                            title={item.categoryName}
                            style={{ pointerEvents: "none" }}
                          />
                          <div className="absolute inset-0 z-10" />
                        </>
                      ) : item.coverVideoUrl ? (
                        <video
                          src={item.coverVideoUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.thumbnail || "/images/template/bg-1.jpg"}
                          alt={item.categoryName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="coverflow-label">
                        <span className="coverflow-label-title">{item.categoryName}</span>
                        {item.topContestantName && (
                          <span className="coverflow-label-sub">{item.topContestantName}</span>
                        )}
                      </div>
                    </div>
                    <div className="coverflow-reflection" aria-hidden="true">
                      <img
                        src={item.thumbnail || "/images/template/bg-1.jpg"}
                        alt=""
                        loading="lazy"
                      />
                    </div>
                  </div>
                </CardWrapper>
              </div>
            );
          })}
        </div>

        <button
          className="coverflow-nav coverflow-nav-prev"
          onClick={(e) => { e.stopPropagation(); navigate(-1); }}
          data-testid="gallery-nav-prev"
        >
          &#8249;
        </button>
        <button
          className="coverflow-nav coverflow-nav-next"
          onClick={(e) => { e.stopPropagation(); navigate(1); }}
          data-testid="gallery-nav-next"
        >
          &#8250;
        </button>

        <div className="coverflow-dots">
          {items.map((_, index) => (
            <button
              key={index}
              className={`coverflow-dot ${index === currentIndex ? "active" : ""}`}
              onClick={() => goToIndex(index)}
              data-testid={`gallery-dot-${index}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
