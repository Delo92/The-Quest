import { useState } from "react";
import { Play } from "lucide-react";

const FALLBACK_POSTER = "/images/template/e1.jpg";

interface DemoVimeoPreviewProps {
  embedUrl: string;
  thumbnail?: string | null;
  title: string;
  className?: string;
}

export default function DemoVimeoPreview({
  embedUrl,
  thumbnail,
  title,
  className = "",
}: DemoVimeoPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const playerUrl = `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1&controls=1&dnt=1&title=0&byline=0&portrait=0`;

  if (playing) {
    return (
      <iframe
        src={playerUrl}
        className={className}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title={title}
      />
    );
  }

  return (
    <button
      type="button"
      className={`group relative block overflow-hidden bg-black text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${className}`}
      aria-label={`Play sample video: ${title}`}
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
        loading="eager"
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
  );
}
