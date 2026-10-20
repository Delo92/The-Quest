interface CompetitionPromoVideosProps {
  videos: string[];
  title: string;
  accentColor: string;
}

const isDirectFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

export default function CompetitionPromoVideos({ videos, title, accentColor }: CompetitionPromoVideosProps) {
  if (!videos.length) return null;
  const single = videos.length === 1;
  return (
    <section aria-label={`${title} videos`} className="mb-6" data-testid="competition-promo-videos">
      <ul
        className={
          single
            ? "grid grid-cols-1"
            : "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
        }
      >
        {videos.map((url, index) => (
          <li
            key={url}
            className={single ? "" : "w-[85%] shrink-0 snap-center sm:w-auto"}
          >
            <div
              className="relative aspect-video w-full overflow-hidden rounded-lg border bg-black"
              style={{ borderColor: `${accentColor}55` }}
            >
              {isDirectFile(url) ? (
                <video src={url} controls playsInline preload="metadata" className="h-full w-full object-cover" aria-label={`${title} video ${index + 1}`} />
              ) : (
                <iframe
                  src={url}
                  title={`${title} video ${index + 1}`}
                  loading="lazy"
                  allow="fullscreen; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
