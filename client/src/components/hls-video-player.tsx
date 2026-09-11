/**
 * HlsVideoPlayer — direct HLS adaptive playback via Vimeo API signed URLs.
 *
 * Mirrors ChronicTV's VideoPlayer implementation:
 * - Dynamic import of hls.js (keeps it off the initial bundle)
 * - Native HLS on Safari/iOS (no hls.js needed)
 * - ChronicTV's exact ABR/buffer/retry config for reliable mobile playback
 * - Falls back to best progressive MP4 if HLS is unsupported
 *
 * Background preload handoff:
 * When a VideoPreloaderState is passed via `preloader`, this player adopts
 * the already-running hls.js instance instead of starting fresh.
 * hls.detachMedia() removes it from the hidden video; hls.attachMedia()
 * binds it to this player. The manifest is already parsed and the first
 * segments may already be in the CDN/browser cache, so buffering resumes
 * from where the preloader left off rather than starting from zero.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { VideoPreloaderState } from "@/hooks/use-video-preloader";

interface HlsVideoPlayerProps {
  videoId: string;       // Vimeo URI like /videos/123 or bare numeric ID
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  poster?: string;
  onEnded?: () => void;
  /** Pre-fetched play URLs from the bundle — skips the /api/vimeo/:id/play fetch */
  preloadedUrls?: PlayUrls | null;
  /** Running background preloader to adopt on mount */
  preloader?: VideoPreloaderState | null;
}

interface PlayUrls {
  hls: string | null;
  progressive: Array<{ rendition: string; width: number; height: number; link: string }>;
}

// ChronicTV's exact HLS config
const HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  startLevel: -1,
  abrEwmaDefaultEstimate: 1_500_000,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 60 * 1000 * 1000,
  backBufferLength: 30,
  maxBufferHole: 0.3,
  highBufferWatchdogPeriod: 1,
  nudgeOffset: 0.1,
  nudgeMaxRetry: 8,
  fragLoadingMaxRetry: 8,
  fragLoadingRetryDelay: 300,
  fragLoadingMaxRetryTimeout: 4000,
  manifestLoadingMaxRetry: 5,
  manifestLoadingRetryDelay: 500,
  levelLoadingMaxRetry: 5,
  levelLoadingRetryDelay: 500,
  capLevelToPlayerSize: true,
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
};

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
  preloadedUrls,
  preloader,
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

    // ── Background preloader handoff path ─────────────────────────────────
    // If the preloader has an active hls.js instance, adopt it instead of
    // starting a fresh one. detachMedia removes it from the hidden video;
    // attachMedia binds it here. Manifest is already parsed — buffering
    // resumes immediately. Falls through to normal init if preloader isn't ready.
    if (preloader?.hlsRef.current) {
      const hls = preloader.hlsRef.current;
      try {
        hls.detachMedia();
        hls.attachMedia(video);
        // Apply full player config (preloader used conservative settings)
        hls.config.maxBufferLength = HLS_CONFIG.maxBufferLength;
        hls.config.maxMaxBufferLength = HLS_CONFIG.maxMaxBufferLength;
        hls.config.capLevelToPlayerSize = true;
        hls.config.startLevel = -1; // Let ABR upgrade from preloader's start level

        const onManifest = () => {
          if (cancelled) return;
          if (autoPlay) video.play().catch(() => {});
          setLoading(false);
        };
        hls.on("hlsManifestParsed", onManifest);

        // Manifest may already be parsed — check readyState
        if (video.readyState >= 1) {
          if (autoPlay) video.play().catch(() => {});
          setLoading(false);
        }

        hls.on("hlsError", (_: any, data: any) => {
          if (data.fatal) {
            if (data.type === "networkError") hls.startLoad();
            else if (data.type === "mediaError") hls.recoverMediaError();
            else setError("Playback failed");
          }
        });

        hlsRef.current = hls;
        // Clear the preloader ref so it isn't adopted again
        preloader.hlsRef.current = null;

        return () => {
          cancelled = true;
          cleanup();
        };
      } catch {
        // Fall through to normal init if handoff fails
      }
    }

    // ── Normal init path ──────────────────────────────────────────────────
    const urlsPromise: Promise<PlayUrls> = preloadedUrls
      ? Promise.resolve(preloadedUrls)
      : fetch(`/api/vimeo/${id}/play`)
          .then((r) => {
            if (!r.ok) throw new Error(`Server returned ${r.status}`);
            return r.json() as Promise<PlayUrls>;
          });

    urlsPromise
      .then(async (urls) => {
        if (cancelled) return;

        const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl");

        if (urls.hls && canNativeHls) {
          // Safari / iOS — native HLS, no library needed
          video.src = urls.hls;
          video.load();
          if (autoPlay) video.play().catch(() => {});
          setLoading(false);
          return;
        }

        if (urls.hls) {
          try {
            const { default: Hls } = await import("hls.js");
            if (cancelled) return;
            if (!Hls.isSupported()) throw new Error("HLS not supported");

            const hls = new Hls(HLS_CONFIG);
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
                  const best = [...(urls.progressive ?? [])].reverse()[0];
                  if (best) { video.src = best.link; if (autoPlay) video.play().catch(() => {}); }
                  else setError("Playback failed");
                }
              }
            });

            if (!cancelled) hlsRef.current = hls;
          } catch (err) {
            if (cancelled) return;
            const best = [...(urls.progressive ?? [])].reverse()[0];
            if (best) { video.src = best.link; if (autoPlay) video.play().catch(() => {}); setLoading(false); }
            else { setError("Could not start playback"); setLoading(false); }
          }
          return;
        }

        // No HLS — best progressive MP4
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
