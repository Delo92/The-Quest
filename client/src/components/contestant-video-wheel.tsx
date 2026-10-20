import { useCallback, useState } from "react";
import { Play } from "lucide-react";
import { useCardWidth } from "@/components/hero-coverflow-gallery";

export interface WheelVideo {
  id: string;
  title: string;
  thumbnail: string | null;
}

interface ContestantVideoWheelProps {
  videos: WheelVideo[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Called when the centered card is tapped. */
  onPlay: (index: number) => void;
  voteCount: number;
  accentColor: string;
}

/** Cover-flow wheel that uses the same markup and styles as the home gallery. */
export default function ContestantVideoWheel({ videos, index, onIndexChange, onPlay, voteCount, accentColor }: ContestantVideoWheelProps) {
  const cardWidth = useCardWidth();
  const total = videos.length;
  const [animating, setAnimating] = useState(false);

  const go = useCallback((next: number) => {
    if (animating || total === 0) return;
    setAnimating(true);
    onIndexChange(((next % total) + total) % total);
    setTimeout(() => setAnimating(false), 450);
  }, [animating, total, onIndexChange]);

  if (total === 0) return null;
  const step = Math.round(cardWidth * 0.72);
  // Vimeo pads thumbnails with black bars (r=pad); drop it so portrait clips fill the card.
  const coverUrl = (url: string | null) => url?.replace(/([?&])r=pad&?/, "$1") ?? null;

  return (
    <div
      className="w-full"
      data-testid="contestant-video-wheel"
    >
      <div className="coverflow-container" style={{ perspective: "1200px" }}>
        <div className="coverflow-track">
          {videos.map((video, i) => {
            let offset = i - index;
            if (offset > total / 2) offset -= total;
            else if (offset < -total / 2) offset += total;
            const abs = Math.abs(offset);
            const sign = Math.sign(offset);
            const x = abs > 3 ? sign * step * 5 : offset * step;
            const isCurrent = i === index;
            return (
              <div
                key={video.id}
                className="coverflow-item"
                style={{
                  transform: `translateX(${x}px) translateZ(${-abs * 180}px) rotateY(${-sign * Math.min(abs * 55, 55)}deg) scale(${1 - abs * 0.08})`,
                  opacity: abs > 3 ? 0 : 1 - abs * 0.2,
                  zIndex: 100 - abs,
                }}
                data-testid={`wheel-video-${i}`}
              >
                <button
                  type="button"
                  className="flex h-full w-full flex-col text-left"
                  onClick={() => (isCurrent ? onPlay(i) : go(i))}
                  aria-label={isCurrent ? `Play ${video.title}` : `Show ${video.title}`}
                >
                  <div className="coverflow-vote-badge">
                    <span className="coverflow-vote-dot" style={{ background: accentColor }} />
                    <span className="coverflow-vote-count" style={{ color: accentColor }}>{voteCount.toLocaleString()}</span>
                    <span className="coverflow-vote-label">VOTES</span>
                  </div>
                  <div className="coverflow-card-wrapper">
                    <div className="coverflow-cover">
                      <div
                        className="h-full w-full bg-zinc-900"
                        style={video.thumbnail ? { backgroundImage: `url(${coverUrl(video.thumbnail)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                      />
                      {isCurrent && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white backdrop-blur-sm">
                            <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
                          </span>
                        </span>
                      )}
                    </div>
                    {video.thumbnail && (
                      <div className="coverflow-reflection" aria-hidden="true">
                        <img src={coverUrl(video.thumbnail) ?? ""} alt="" loading="lazy" />
                      </div>
                    )}
                  </div>
                  <div className="coverflow-caption">
                    <span className="coverflow-caption-title line-clamp-2">{video.title}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        {total > 1 && (
          <>
            <button className="coverflow-nav coverflow-nav-prev" onClick={() => go(index - 1)} aria-label="Previous video" data-testid="wheel-prev">&#8249;</button>
            <button className="coverflow-nav coverflow-nav-next" onClick={() => go(index + 1)} aria-label="Next video" data-testid="wheel-next">&#8250;</button>
            <div className="coverflow-dots">
              {videos.map((video, i) => (
                <button
                  key={video.id}
                  className={`coverflow-dot ${i === index ? "active" : ""}`}
                  onClick={() => go(i)}
                  aria-label={`Show video ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
