/**
 * HlsVideoPlayer — direct HLS adaptive playback via Vimeo API signed URLs.
 *
 * Mirrors ChronicTV's VideoPlayer implementation:
 * - Dynamic import of hls.js (keeps it off the initial bundle)
 * - Native HLS on Safari/iOS (no hls.js needed)
 * - ChronicTV's exact ABR/buffer/retry config for reliable mobile playback
 * - Falls back to best progressive MP4 if HLS is unsupported
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface HlsVideoPlayerProps {
  videoId: string;       // Vimeo URI like /videos/123 or bare numeric ID
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  poster?: string;
  onEnded?: () => void;
}

interface PlayUrls {
  hls: string | null;
  progressive: Array<{ rendition: string; width: number; height: number; link: string }>;
}

function extractVideoId(input: string): string {
  const match = input.match(/(\d+)(?:[^/]*)?$/);
  return match ? match[1] : input;
}

export function HlsVideoPlayer({
  videoId,
  className,
  autoPlay = true,
  muted = false,
  controls = true,
  loop = false,
  poster,
  onEnded,
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const id = extractVideoId(videoId);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };

    cleanup();

    fetch(`/api/vimeo/${id}/play`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json() as Promise<PlayUrls>;
      })
      .then(async (urls) => {
        if (cancelled) return;

        const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl");

        if (urls.hls && canNativeHls) {
          // Safari / iOS — native HLS support, no library needed
          video.src = urls.hls;
          video.load();
          if (autoPlay) video.play().catch(() => {});
          setLoading(false);
          return;
        }

        if (urls.hls) {
          // Chrome / Firefox / Android — dynamically import hls.js so it stays
          // off the initial bundle (mirrors ChronicTV's initializeHls pattern)
          try {
            const { default: Hls } = await import("hls.js");
            if (cancelled) return;

            if (!Hls.isSupported()) throw new Error("HLS not supported");

            // ChronicTV's exact HLS config
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,

              // Startup — assume 1.5 Mbps so we don't begin at the lowest rendition
              startLevel: -1,
              abrEwmaDefaultEstimate: 1_500_000,

              // Buffer — enough runway for unreliable mobile without excessive memory use
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              maxBufferSize: 60 * 1000 * 1000,
              backBufferLength: 30,
              maxBufferHole: 0.3,

              // Stall recovery
              highBufferWatchdogPeriod: 1,
              nudgeOffset: 0.1,
              nudgeMaxRetry: 8,

              // Fragment retry
              fragLoadingMaxRetry: 8,
              fragLoadingRetryDelay: 300,
              fragLoadingMaxRetryTimeout: 4000,

              // Manifest / level retry
              manifestLoadingMaxRetry: 5,
              manifestLoadingRetryDelay: 500,
              levelLoadingMaxRetry: 5,
              levelLoadingRetryDelay: 500,

              // ABR — never fetch renditions larger than the element; conservative upgrades
              capLevelToPlayerSize: true,
              abrBandWidthFactor: 0.95,
              abrBandWidthUpFactor: 0.7,
            });

            hls.loadSource(urls.hls);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (cancelled) return;
              if (autoPlay) video.play().catch(() => {});
              setLoading(false);
            });

            hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
              if (data.fatal) {
                console.error("hls.js fatal error", data.type, data.details);
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                  hls.startLoad();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                  hls.recoverMediaError();
                } else {
                  // Final fallback to best progressive MP4
                  const best = [...(urls.progressive ?? [])].reverse()[0];
                  if (best) { video.src = best.link; if (autoPlay) video.play().catch(() => {}); }
                  else setError("Playback failed");
                }
              }
            });

            if (!cancelled) hlsRef.current = hls;
          } catch (err) {
            if (cancelled) return;
            console.error("HLS init error:", err);
            // Fall through to progressive
            const best = [...(urls.progressive ?? [])].reverse()[0];
            if (best) { video.src = best.link; if (autoPlay) video.play().catch(() => {}); setLoading(false); }
            else { setError("Could not start playback"); setLoading(false); }
          }
          return;
        }

        // No HLS — use best progressive MP4
        const best = [...(urls.progressive ?? [])].reverse()[0];
        if (best) {
          video.src = best.link;
          if (autoPlay) video.play().catch(() => {});
          setLoading(false);
        } else {
          setError("No playable source");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("HlsVideoPlayer:", err);
          setError("Could not load video");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [id, autoPlay]);

  return (
    <div className={`relative bg-black ${className ?? ""}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        playsInline
        muted={muted}
        loop={loop}
        controls={controls}
        onEnded={onEnded}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
      />
    </div>
  );
}
