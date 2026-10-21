import { useEffect, useState } from "react";

const DEFAULT_FALLBACK_SRC = "/images/template/a1.jpg";

interface FallbackImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  fallbackSrcs?: Array<string | null | undefined>;
  uncroppedSrcs?: Array<string | null | undefined>;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
  "data-testid"?: string;
}

export function getImageSourceCandidates(
  src?: string | null,
  fallbackSrc?: string | null,
  fallbackSrcs: Array<string | null | undefined> = [],
): string[] {
  return [...new Set(
    [src, fallbackSrc, ...fallbackSrcs, DEFAULT_FALLBACK_SRC]
      .filter((source): source is string => typeof source === "string" && source.trim().length > 0),
  )];
}

export function FallbackImage({
  src,
  fallbackSrc,
  fallbackSrcs,
  uncroppedSrcs,
  alt,
  className,
  style,
  loading,
  "data-testid": testId,
}: FallbackImageProps) {
  const sourceCandidates = getImageSourceCandidates(src, fallbackSrc, fallbackSrcs);
  const sourceKey = sourceCandidates.join("\u0000");
  const initialSrc = sourceCandidates[0] || DEFAULT_FALLBACK_SRC;
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [allSourcesFailed, setAllSourcesFailed] = useState(false);
  const useCenteredStyle = Boolean(currentSrc && uncroppedSrcs?.includes(currentSrc));
  const imageStyle = useCenteredStyle
    ? { ...style, objectPosition: "center", transform: "none", transformOrigin: "center" }
    : style;

  // Contestant data and livery assets can arrive after the card mounts. Reset
  // the image state when those inputs change so a temporary placeholder does
  // not permanently stick to the card.
  useEffect(() => {
    setCurrentSrc(initialSrc);
    setAllSourcesFailed(false);
  }, [sourceKey, initialSrc]);

  if (allSourcesFailed) {
    return (
      <div
        className={className}
        role="img"
        aria-label={alt}
        data-testid={testId}
        style={{
          ...style,
          backgroundColor: "#101010",
          backgroundImage: `url(${DEFAULT_FALLBACK_SRC})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      style={imageStyle}
      loading={loading}
      data-testid={testId}
      onError={() => {
        const currentIndex = sourceCandidates.indexOf(currentSrc);
        const nextSrc = sourceCandidates[currentIndex + 1];
        if (nextSrc) {
          setCurrentSrc(nextSrc);
          return;
        }
        setAllSourcesFailed(true);
      }}
    />
  );
}

export function getBackupUrl(imageUrls?: string[] | null, imageBackupUrls?: string[] | null, index: number = 0): string | null {
  if (!imageBackupUrls || !imageBackupUrls[index]) return null;
  if (imageUrls?.[index] === imageBackupUrls[index]) return null;
  return imageBackupUrls[index];
}
