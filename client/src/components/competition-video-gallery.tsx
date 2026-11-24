import { useState } from "react";
import { Play } from "lucide-react";
import { NativeVideoFrame, type NativePlaybackItem } from "@/components/native-video-frame";
import { buildVimeoSrc, formatVideoTitle } from "@/lib/media-utils";

type GalleryVideo = {
  uri: string;
  name: string;
  embedUrl: string;
  thumbnail: string | null;
};

export default function CompetitionVideoGallery({
  videos, competitionTitle, playbackFor,
}: {
  videos: GalleryVideo[];
  competitionTitle: string;
  playbackFor: (uri: string) => NativePlaybackItem | null;
}) {
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  if (!videos.length) return null;

  return (
    <section className="mx-auto mb-8 w-full max-w-5xl px-4" aria-label="Competition video gallery" data-testid="competition-video-gallery">
      <div className="mb-5 text-center">
        <p className="mb-1 text-sm text-white/55">{competitionTitle} · {videos.length} {videos.length === 1 ? "video" : "videos"}</p>
        <h2 className="text-lg font-normal uppercase tracking-[.2em] text-white sm:tracking-[.4em]">Competition videos</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video, index) => (
          <figure key={video.uri} className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900" data-testid={`competition-video-${index}`}>
            <div className="relative aspect-video">
              {playingUri === video.uri ? (
                <NativeVideoFrame
                  embedUrl={video.embedUrl}
                  embedSrc={buildVimeoSrc(video.embedUrl, "autoplay=1&controls=1&title=0&byline=0&portrait=0") || video.embedUrl}
                  title={`${formatVideoTitle(video.name)} · video ${index + 1}`}
                  poster={video.thumbnail}
                  playback={playbackFor(video.uri)}
                />
              ) : (
                <button type="button" onClick={() => setPlayingUri(video.uri)} className="absolute inset-0 flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400" aria-label={`Play ${formatVideoTitle(video.name)}, video ${index + 1}`}>
                  {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />}
                  <span className="relative grid h-12 w-12 place-items-center rounded-full bg-black/65 text-white ring-1 ring-white/60"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
                </button>
              )}
            </div>
            <figcaption className="break-words px-4 py-3 text-sm text-white/80">{formatVideoTitle(video.name)} <span className="text-white/50">· {index + 1} of {videos.length}</span></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
