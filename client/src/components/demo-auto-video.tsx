import { useEffect, useRef, useState } from "react";

const FALLBACK_POSTER = "/images/template/e1.jpg";

interface DemoAutoVideoProps {
  videoId: string | number;
  poster?: string | null;
  title: string;
  className?: string;
}

interface VimeoPlayResponse {
  progressive?: Array<{ rendition: string; link: string }>;
}

function getNumericVideoId(videoId: string | number): string | null {
  const rawId = String(videoId);
  if (/^\d+$/.test(rawId)) return rawId;

  try {
    const pathname = new URL(rawId, window.location.origin).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    return /^\d+$/.test(lastSegment) ? lastSegment : null;
  } catch {
    return null;
  }
}

export default function DemoAutoVideo({
  videoId,
  poster,
  title,
  className = "",
}: DemoAutoVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || directUrl || loadFailed) return;
    const numericVideoId = getNumericVideoId(videoId);
    if (!numericVideoId) {
      setLoadFailed(true);
      return;
    }
    let cancelled = false;

    fetch(`/api/vimeo/${numericVideoId}/play`)
      .then((response) => {
        if (!response.ok) throw new Error(`Playback source returned ${response.status}`);
        return response.json() as Promise<VimeoPlayResponse>;
      })
      .then(({ progressive = [] }) => {
        if (cancelled) return;
        const source =
          progressive.find((rendition) => rendition.rendition === "360p") ||
          progressive.find((rendition) => rendition.rendition === "480p") ||
          progressive[1] ||
          progressive[0];
        if (source?.link) setDirectUrl(source.link);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, nearViewport, directUrl, loadFailed]);

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      {nearViewport && directUrl ? (
        <video
          src={directUrl}
          poster={poster || FALLBACK_POSTER}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label={title}
          onError={() => {
            setDirectUrl(null);
            setLoadFailed(true);
          }}
        />
      ) : (
        <>
          <img
            src={poster || FALLBACK_POSTER}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
          {loadFailed && (
            <span className="absolute inset-x-2 bottom-2 rounded bg-black/75 px-2 py-1 text-center text-xs text-white/80">
              Preview unavailable
            </span>
          )}
        </>
      )}
    </div>
  );
}
