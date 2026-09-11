/**
 * useVideoPreloader — starts buffering a video in the background the moment
 * an HLS URL is available, before the user taps play.
 *
 * Strategy:
 * - hls.js (Chrome/Android/Firefox): attaches to a 1px off-screen <video>
 *   element and starts loading the manifest + first segments. When the visible
 *   player mounts it calls hls.detachMedia() → hls.attachMedia(visibleVideo).
 *   hls.js already has the manifest parsed and re-requests segments; since
 *   Vimeo CDN segments are typically served with short-lived signed URLs the
 *   browser HTTP cache may or may not hold them, but the manifest round-trip
 *   is always eliminated and any cached segments are served instantly.
 * - Safari / iOS (native HLS): sets src on a hidden <video> and calls
 *   video.load() so the browser starts buffering. The HlsVideoPlayer on iOS
 *   uses the same native approach; it benefits from whatever the browser
 *   buffered even though the video element isn't shared.
 */
import { useEffect, useRef } from "react";

// Same ABR/buffer config as HlsVideoPlayer but tuned for background preload:
// startLevel 0 = lowest rendition first so segments arrive ASAP.
// maxBufferLength 15 = only buffer 15s — enough head start, not wasteful.
const PRELOAD_HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  startLevel: 0,                  // Lowest rendition — fastest first segment
  abrEwmaDefaultEstimate: 1_500_000,
  maxBufferLength: 15,
  maxMaxBufferLength: 30,
  maxBufferSize: 30 * 1000 * 1000,
  backBufferLength: 0,
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
  capLevelToPlayerSize: false,    // Hidden video is 1px — don't cap level to it
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
};

function makeHiddenVideo(): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.setAttribute("aria-hidden", "true");
  v.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(v);
  return v;
}

export interface VideoPreloaderState {
  /** hls.js instance (null on Safari — uses native HLS) */
  hlsRef: React.MutableRefObject<any>;
  /** The hidden video element that was pre-buffering */
  hiddenVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  /** Whether the native HLS path is being used (Safari/iOS) */
  isNativeRef: React.MutableRefObject<boolean>;
}

export function useVideoPreloader(hlsUrl: string | null): VideoPreloaderState {
  const hlsRef = useRef<any>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const isNativeRef = useRef(false);

  useEffect(() => {
    if (!hlsUrl) return;
    let cancelled = false;

    (async () => {
      // Detect native HLS support (Safari / iOS)
      const probe = document.createElement("video");
      const isNative = !!probe.canPlayType("application/vnd.apple.mpegurl");
      isNativeRef.current = isNative;

      if (isNative) {
        // Safari: hidden video with src set — browser buffers natively
        const video = makeHiddenVideo();
        video.src = hlsUrl;
        video.preload = "auto";
        video.load();
        hiddenVideoRef.current = video;
        return;
      }

      // hls.js path (Chrome / Firefox / Android)
      const { default: Hls } = await import("hls.js");
      if (cancelled || !Hls.isSupported()) return;

      const video = makeHiddenVideo();
      hiddenVideoRef.current = video;

      const hls = new Hls(PRELOAD_HLS_CONFIG);
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      // Start playback on the hidden video so segments are actually fetched
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) video.play().catch(() => {});
      });
      hlsRef.current = hls;
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.pause();
        hiddenVideoRef.current.src = "";
        try { document.body.removeChild(hiddenVideoRef.current); } catch {}
        hiddenVideoRef.current = null;
      }
      isNativeRef.current = false;
    };
  }, [hlsUrl]);

  return { hlsRef, hiddenVideoRef, isNativeRef };
}
