import { useEffect, useRef, useState } from "react";
import { detectMediaType, getYouTubeId, getVimeoId, buildVimeoSrc, isFacebookVideo } from "@/lib/media-utils";
import { Volume2, VolumeX } from "lucide-react";

/** True once the element is within 200px of the viewport — resets when it leaves. */
function useNearViewport(ref: React.RefObject<Element | null>) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return near;
}

/**
 * Fetches a direct progressive MP4 URL from our server's Vimeo play-URL cache.
 * Returns:
 *   "loading"  — fetch in flight
 *   string     — MP4 URL ready for native <video>
 *   null       — fetch failed or no progressive rendition — fall back to iframe
 *
 * Only fires when `enabled` is true (near the viewport). Prefers 360p for fast
 * start on mobile; steps up to 480p or whatever is available if 360p is absent.
 */
function useVimeoNativeUrl(videoId: string | null, enabled: boolean): "loading" | string | null {
  const [state, setState] = useState<"loading" | string | null>("loading");
  useEffect(() => {
    if (!videoId || !enabled) return;
    setState("loading");
    let cancelled = false;
    fetch(`/api/vimeo/${videoId}/play`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { progressive?: Array<{ rendition: string; link: string }> }) => {
        if (cancelled) return;
        const pick =
          data.progressive?.find(p => p.rendition === "360p") ||
          data.progressive?.find(p => p.rendition === "480p") ||
          data.progressive?.[1] ||
          data.progressive?.[0];
        setState(pick?.link ?? null);
      })
      .catch(() => { if (!cancelled) setState(null); });
    return () => { cancelled = true; };
  }, [videoId, enabled]);
  return state;
}

interface MediaSlotProps {
  url: string;
  alt?: string;
  className?: string;
  mode?: "img" | "bg";
  fit?: "cover" | "contain";
  clickToUnmute?: boolean;
  muteButtonClassName?: string;
}

export default function MediaSlot({
  url,
  alt = "",
  className = "",
  mode = "img",
  fit = "cover",
  clickToUnmute = false,
  muteButtonClassName,
}: MediaSlotProps) {
  const type = detectMediaType(url);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [muted, setMuted] = useState(true);
  const [fullPlayer, setFullPlayer] = useState(false);
  // true once the 500ms timer fires without canplay — forces iframe fallback
  const [useFallback, setUseFallback] = useState(false);

  // Only activate near-viewport and native-URL logic for Vimeo bg slots
  const isBgVimeo = type === "vimeo" && mode === "bg";
  const nearViewport = useNearViewport(containerRef);

  const vimeoId = type === "vimeo" ? getVimeoId(url) : null;
  // For bg mode: try to get a native MP4 URL. For non-bg/interactive: skip (null).
  const nativeUrl = useVimeoNativeUrl(
    isBgVimeo ? vimeoId : null,
    isBgVimeo && nearViewport,
  );

  const bgStyle: React.CSSProperties = mode === "bg"
    ? fit === "contain"
      ? { position: "absolute", top: "50%", left: 0, width: "100%", aspectRatio: "16 / 9", transform: "translateY(-50%)", border: "none" }
      : { position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }
    : {};

  // Reset fallback state when the URL or viewport state changes
  useEffect(() => {
    setUseFallback(false);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  }, [url, nearViewport]);

  useEffect(() => {
    if (type === "facebook" && !document.getElementById("fb-sdk")) {
      const div = document.createElement("div");
      div.id = "fb-root";
      document.body.prepend(div);
      const script = document.createElement("script");
      script.id = "fb-sdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    if (type === "instagram" && !document.getElementById("ig-embed")) {
      const script = document.createElement("script");
      script.id = "ig-embed";
      script.src = "//www.instagram.com/embed.js";
      script.async = true;
      document.body.appendChild(script);
      script.onload = () => { (window as any).instgrm?.Embeds?.process?.(); };
    }
  }, [type]);

  function handleUnmuteClick() {
    if (type === "video" && videoRef.current) {
      const next = !muted;
      videoRef.current.muted = next;
      setMuted(next);
    }
    if (type === "vimeo") {
      if (!fullPlayer) {
        setFullPlayer(true);
        setMuted(false);
      } else {
        const next = !muted;
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ method: "setVolume", value: next ? 0 : 1 }),
          "https://player.vimeo.com"
        );
        setMuted(next);
      }
    }
  }

  /**
   * Called when the native <video> fires loadstart.
   * Starts a 500ms timer — if canplay doesn't fire in time, switch to the
   * Vimeo iframe so the user doesn't stare at a black frame on slow connections.
   */
  function handleNativeLoadStart() {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => setUseFallback(true), 500);
  }

  /** Native video loaded fast enough — cancel the fallback timer. */
  function handleNativeCanPlay() {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }

  if (!url) return null;

  // ── Image ──────────────────────────────────────────────────────────────────
  if (type === "image") {
    return (
      <img
        src={url}
        alt={alt}
        className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
        style={mode === "bg" ? { ...bgStyle, objectFit: fit } : undefined}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  // ── Direct video file (MP4/WebM) ───────────────────────────────────────────
  if (type === "video") {
    const videoEl = (
      <video
        ref={videoRef}
        src={url}
        className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
        style={mode === "bg" ? { ...bgStyle, objectFit: fit } : { width: "100%", height: "100%", objectFit: fit }}
        muted
        loop
        autoPlay
        playsInline
        preload="none"
      />
    );
    if (clickToUnmute && mode === "bg") {
      return (
        <>
          {videoEl}
          <button
            onClick={handleUnmuteClick}
            className={muteButtonClassName ?? "absolute bottom-20 right-6 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-all duration-200 backdrop-blur-sm border border-white/20"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </>
      );
    }
    return videoEl;
  }

  // ── YouTube ────────────────────────────────────────────────────────────────
  if (type === "youtube") {
    const id = getYouTubeId(url);
    if (!id) return <img src={url} alt={alt} className={`object-cover ${className}`} style={mode === "bg" ? bgStyle : undefined} />;
    const src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&modestbranding=1`;
    return (
      <iframe
        src={src}
        className={className}
        style={{ ...bgStyle, pointerEvents: mode === "bg" ? "none" : "auto", objectFit: "cover" }}
        allow="autoplay; encrypted-media"
        allowFullScreen
        title={alt || "YouTube video"}
      />
    );
  }

  // ── Vimeo ──────────────────────────────────────────────────────────────────
  if (type === "vimeo") {
    if (!vimeoId) return <img src={url} alt={alt} className={`object-cover ${className}`} style={mode === "bg" ? bgStyle : undefined} />;

    // ── Vimeo background (ambient) — native-first with 500ms iframe fallback ──
    if (mode === "bg" && !clickToUnmute) {
      const iframeSrc = buildVimeoSrc(url, `autoplay=1&muted=1&loop=1&autopause=0&background=${fit === "contain" ? "0" : "1"}&controls=0&title=0&byline=0&portrait=0`)!;

      // Show native video while the MP4 URL is available and hasn't timed out.
      // Falls back to Vimeo iframe if: fetch failed (null), or 500ms elapsed (useFallback).
      const showNative = typeof nativeUrl === "string" && !useFallback;
      const showIframe = nativeUrl === null || useFallback;

      return (
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
          {showNative && (
            <video
              key={nativeUrl}
              src={nativeUrl}
              className={`object-${fit} ${className}`}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit }}
              muted
              loop
              autoPlay
              playsInline
              preload="auto"
              onLoadStart={handleNativeLoadStart}
              onCanPlay={handleNativeCanPlay}
            />
          )}
          {(showIframe || nativeUrl === "loading") && nearViewport && showIframe && (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className={className}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
              allow="autoplay; encrypted-media"
              allowFullScreen
              loading="lazy"
              title={alt || "Vimeo video"}
            />
          )}
        </div>
      );
    }

    // ── Vimeo background with click-to-unmute ─────────────────────────────────
    if (mode === "bg" && clickToUnmute) {
      const src = fullPlayer
        ? buildVimeoSrc(url, "autoplay=1&muted=0&loop=1&background=0&controls=0&autopause=0&title=0&byline=0&portrait=0")!
        : buildVimeoSrc(url, `autoplay=1&muted=1&loop=1&autopause=0&background=${fit === "contain" ? "0" : "1"}&controls=0&title=0&byline=0&portrait=0`)!;
      return (
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
          <iframe
            key={fullPlayer ? "full" : "bg"}
            ref={iframeRef}
            src={nearViewport ? src : undefined}
            className={className}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
            allow="autoplay; encrypted-media"
            allowFullScreen
            loading="lazy"
            title={alt || "Vimeo video"}
          />
          <button
            onClick={handleUnmuteClick}
            className={muteButtonClassName ?? "absolute bottom-20 right-6 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-all duration-200 backdrop-blur-sm border border-white/20"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      );
    }

    // ── Vimeo interactive (non-bg) — iframe only ──────────────────────────────
    const src = buildVimeoSrc(url, "autoplay=0&controls=1&title=0&byline=0&portrait=0")!;
    return (
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
        <iframe
          src={nearViewport ? src : undefined}
          className={className}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          loading="lazy"
          title={alt || "Vimeo video"}
        />
      </div>
    );
  }

  // ── Facebook ───────────────────────────────────────────────────────────────
  if (type === "facebook") {
    const isVid = isFacebookVideo(url);
    return (
      <div
        className={`flex items-center justify-center overflow-auto ${className}`}
        style={mode === "bg" ? { ...bgStyle, zIndex: 0 } : undefined}
      >
        {isVid ? (
          <div className="fb-video" data-href={url} data-width="auto" data-show-text="false" data-autoplay="true" data-mute="true" />
        ) : (
          <div className="fb-post" data-href={url} data-width="auto" data-show-text="true" />
        )}
      </div>
    );
  }

  // ── Instagram ──────────────────────────────────────────────────────────────
  if (type === "instagram") {
    return (
      <div
        className={`flex items-center justify-center overflow-auto ${className}`}
        style={mode === "bg" ? { ...bgStyle, zIndex: 0 } : undefined}
      >
        <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14" data-instgrm-captioned>
          <a href={url}>View on Instagram</a>
        </blockquote>
      </div>
    );
  }

  return <img src={url} alt={alt} className={`object-cover ${className}`} style={mode === "bg" ? bgStyle : undefined} />;
}
