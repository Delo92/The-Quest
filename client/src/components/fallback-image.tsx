import { useEffect, useState } from "react";

const DEFAULT_FALLBACK_SRC = "/images/template/a1.jpg";

interface FallbackImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
  "data-testid"?: string;
}

export function FallbackImage({ src, fallbackSrc, alt, className, style, loading, "data-testid": testId }: FallbackImageProps) {
  const finalFallbackSrc = fallbackSrc || DEFAULT_FALLBACK_SRC;
  const initialSrc = src || finalFallbackSrc;
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [triedFallback, setTriedFallback] = useState(false);
  const [allSourcesFailed, setAllSourcesFailed] = useState(false);

  // Contestant data and livery assets can arrive after the card mounts. Reset
  // the image state when those inputs change so a temporary placeholder does
  // not permanently stick to the card.
  useEffect(() => {
    setCurrentSrc(initialSrc);
    setTriedFallback(false);
    setAllSourcesFailed(false);
  }, [initialSrc, finalFallbackSrc]);

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
      style={style}
      loading={loading}
      data-testid={testId}
      onError={() => {
        if (!triedFallback && currentSrc !== finalFallbackSrc) {
          setCurrentSrc(finalFallbackSrc);
          setTriedFallback(true);
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
