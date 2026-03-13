import { useEffect, useRef, useState } from "react";
import { detectMediaType, getYouTubeId, getVimeoId, buildVimeoSrc, isFacebookVideo } from "@/lib/media-utils";
import { Volume2, VolumeX } from "lucide-react";

interface MediaSlotProps {
  url: string;
  alt?: string;
  className?: string;
  mode?: "img" | "bg";
  clickToUnmute?: boolean;
  muteButtonClassName?: string;
}

export default function MediaSlot({ url, alt = "", className = "", mode = "img", clickToUnmute = false, muteButtonClassName }: MediaSlotProps) {
  const type = detectMediaType(url);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);
  const [fullPlayer, setFullPlayer] = useState(false);

  const bgStyle: React.CSSProperties = mode === "bg"
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }
    : {};

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

  if (!url) return null;

  if (type === "image") {
    return (
      <img
        src={url}
        alt={alt}
        className={`object-cover ${className}`}
        style={mode === "bg" ? { ...bgStyle, objectFit: "cover" } : undefined}
      />
    );
  }

  if (type === "video") {
    const videoEl = (
      <video
        ref={videoRef}
        src={url}
        className={`object-cover ${className}`}
        style={mode === "bg" ? { ...bgStyle, objectFit: "cover" } : { width: "100%", height: "100%", objectFit: "cover" }}
        muted
        loop
        autoPlay
        playsInline
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

  if (type === "vimeo") {
    const id = getVimeoId(url);
    if (!id) return <img src={url} alt={alt} className={`object-cover ${className}`} style={mode === "bg" ? bgStyle : undefined} />;

    if (clickToUnmute && mode === "bg") {
      const src = fullPlayer
        ? buildVimeoSrc(url, "autoplay=1&muted=0&loop=1&background=0&controls=0&autopause=0&title=0&byline=0&portrait=0")!
        : buildVimeoSrc(url, "autoplay=1&muted=1&loop=1&background=1")!;

      return (
        <>
          <iframe
            key={fullPlayer ? "full" : "bg"}
            ref={iframeRef}
            src={src}
            className={className}
            style={{ ...bgStyle, pointerEvents: "none" }}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={alt || "Vimeo video"}
          />
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

    const src = buildVimeoSrc(url, "autoplay=1&muted=1&loop=1&background=1")!;
    return (
      <iframe
        src={src}
        className={className}
        style={{ ...bgStyle, pointerEvents: mode === "bg" ? "none" : "auto" }}
        allow="autoplay; encrypted-media"
        allowFullScreen
        title={alt || "Vimeo video"}
      />
    );
  }

  if (type === "facebook") {
    const isVid = isFacebookVideo(url);
    return (
      <div
        className={`flex items-center justify-center overflow-auto ${className}`}
        style={mode === "bg" ? { ...bgStyle, zIndex: 0 } : undefined}
      >
        {isVid ? (
          <div
            className="fb-video"
            data-href={url}
            data-width="auto"
            data-show-text="false"
            data-autoplay="true"
            data-mute="true"
          />
        ) : (
          <div
            className="fb-post"
            data-href={url}
            data-width="auto"
            data-show-text="true"
          />
        )}
      </div>
    );
  }

  if (type === "instagram") {
    return (
      <div
        className={`flex items-center justify-center overflow-auto ${className}`}
        style={mode === "bg" ? { ...bgStyle, zIndex: 0 } : undefined}
      >
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={url}
          data-instgrm-version="14"
          data-instgrm-captioned
        >
          <a href={url}>View on Instagram</a>
        </blockquote>
      </div>
    );
  }

  return <img src={url} alt={alt} className={`object-cover ${className}`} style={mode === "bg" ? bgStyle : undefined} />;
}
