import { useState } from "react";

interface FallbackImageProps {
  src: string;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  "data-testid"?: string;
}

export function FallbackImage({ src, fallbackSrc, alt, className, loading, "data-testid": testId }: FallbackImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [triedFallback, setTriedFallback] = useState(false);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      data-testid={testId}
      onError={() => {
        if (!triedFallback && fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
          setTriedFallback(true);
        }
      }}
    />
  );
}

export function getBackupUrl(imageUrls?: string[] | null, imageBackupUrls?: string[] | null, index: number = 0): string | null {
  if (!imageBackupUrls || !imageBackupUrls[index]) return null;
  if (imageUrls?.[index] === imageBackupUrls[index]) return null;
  return imageBackupUrls[index];
}
