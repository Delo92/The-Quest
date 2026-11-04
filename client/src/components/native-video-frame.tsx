import { useCallback, useState } from "react";
import { Play } from "lucide-react";
import { VideoPlayer } from "@capgo/capacitor-video-player";
import { isNativeApp } from "@/lib/native-app";

export type NativePlaybackItem = {
  videoId: string;
  hls: string | null;
  mp4: string | null;
  poster: string | null;
  expiresAt: number;
};

/** Vimeo video id from an API uri such as /videos/123456. */
export function vimeoIdFromUri(uri: string): string | null {
  return uri.match(/(\d{5,})/)?.[1] ?? null;
}

type Props = {
  embedUrl: string;
  embedSrc: string;
  title: string;
  poster?: string | null;
  playback?: NativePlaybackItem | null;
};

/**
 * Website: the Vimeo embed. iPhone/Android app: a native player (AVPlayer or
 * ExoPlayer) fed the HLS stream the server already prepared. If the stream is
 * not ready, the app falls back to the embed so playback never disappears.
 */
export function NativeVideoFrame({ embedSrc, title, poster, playback }: Props) {
  const [failed, setFailed] = useState(false);
  const streamUrl = playback && playback.expiresAt > Date.now() ? playback.hls || playback.mp4 : null;
  const native = isNativeApp() && !!streamUrl && !failed;

  const start = useCallback(async () => {
    if (!streamUrl) return;
    try {
      await VideoPlayer.initPlayer({
        mode: "fullscreen",
        url: streamUrl,
        playerId: `quest-${playback?.videoId ?? "video"}`,
        title,
        artwork: poster || playback?.poster || undefined,
        exitOnEnd: true,
        loopOnEnd: false,
        pipEnabled: true,
        bkmodeEnabled: true,
        showControls: true,
        displayMode: "all",
      });
    } catch {
      setFailed(true);
    }
  }, [streamUrl, playback?.videoId, playback?.poster, title, poster]);

  if (!native) {
    return (
      <iframe
        src={embedSrc}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title={title}
      />
    );
  }

  const image = poster || playback?.poster || undefined;
  return (
    <button
      type="button"
      onClick={start}
      aria-label={`Play ${title}`}
      className="absolute inset-0 flex h-full w-full items-center justify-center bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      data-testid="button-native-play"
    >
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-black/60 ring-2 ring-white/80">
        <Play className="h-7 w-7 translate-x-0.5 text-white" fill="currentColor" />
      </span>
    </button>
  );
}
