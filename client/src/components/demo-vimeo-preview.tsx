import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { HlsVideoPlayer } from "@/components/hls-video-player";
import { useVideoPreloader } from "@/hooks/use-video-preloader";

const FALLBACK_POSTER = "/images/template/e1.jpg";

interface DemoVimeoPreviewProps {
  videoId: string;
  thumbnail?: string | null;
  title: string;
  className?: string;
}

interface PlayUrls {
  hls: string | null;
  progressive: Array<{ rendition: string; width: number; height: number; link: string }>;
}

function extractVideoId(input: string): string {
  const match = input.match(/(?:\/videos\/|vimeo\.com\/|^)(\d+)/) ?? input.match(/(\d+)/);
  return match?.[1] ?? "";
}

export default function DemoVimeoPreview({
  videoId,
  thumbnail,
  title,
  className = "",
}: DemoVimeoPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [playUrls, setPlayUrls] = useState<PlayUrls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const numericVideoId = extractVideoId(videoId);
  const preloader = useVideoPreloader(
    isNearViewport ? playUrls?.hls ?? null : null,
  );

  useEffect(() => {
    for (const origin of ["https://player.vimeo.com", "https://i.vimeocdn.com"]) {
      if (document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: "350px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNearViewport || !numericVideoId || playUrls) return;
    const controller = new AbortController();

    fetch(`/api/vimeo/${numericVideoId}/play`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Video request failed (${response.status})`);
        return response.json() as Promise<PlayUrls>;
      })
      .then((urls) => {
        if (urls && (urls.hls || urls.progressive?.length)) setPlayUrls(urls);
      })
      .catch(() => {
        // HlsVideoPlayer retries through the same endpoint on click and shows its own error state.
      });

    return () => controller.abort();
  }, [isNearViewport, numericVideoId, playUrls]);

  if (playing) {
    return (
      <div ref={containerRef} className={className}>
        <HlsVideoPlayer
          videoId={numericVideoId}
          className="absolute inset-0 h-full w-full"
          poster={thumbnailFailed ? FALLBACK_POSTER : thumbnail || FALLBACK_POSTER}
          autoPlay
          controls
          preloadedUrls={playUrls}
          preloader={preloader}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <button
        type="button"
        className="group absolute inset-0 block overflow-hidden bg-black text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        aria-label={`Play video: ${title}`}
        data-demo-safe-action="true"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPlaying(true);
        }}
      >
        <img
          src={thumbnailFailed ? FALLBACK_POSTER : thumbnail || FALLBACK_POSTER}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setThumbnailFailed(true)}
        />
        <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/10" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-black/65 text-white shadow-lg transition-transform group-hover:scale-105">
            <Play className="h-6 w-6 fill-current" aria-hidden="true" />
          </span>
        </span>
      </button>
    </div>
  );
}
