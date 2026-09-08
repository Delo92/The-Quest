import { useEffect, useState } from "react";

interface FallbackImageProps {
  src: string;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  "data-testid"?: string;
}

export function FallbackImage({ src, fallbackSrc, alt, className, loading, "data-testid": testId }: FallbackImageProps) {
  const accessibleSrc = getAccessibleMediaUrl(src);
  const accessibleFallbackSrc = fallbackSrc ? getAccessibleMediaUrl(fallbackSrc) : null;
  const [currentSrc, setCurrentSrc] = useState(accessibleSrc);
  const [triedFallback, setTriedFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(accessibleSrc);
    setTriedFallback(false);
  }, [accessibleSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      data-testid={testId}
      onError={() => {
        if (!triedFallback && accessibleFallbackSrc && currentSrc !== accessibleFallbackSrc) {
          setCurrentSrc(accessibleFallbackSrc);
          setTriedFallback(true);
        }
      }}
    />
  );
}

export function getAccessibleMediaUrl(src?: string | null): string {
  if (!src) return "";

  try {
    const url = new URL(src, window.location.origin);
    const bucketName = "thequest-2dc77.firebasestorage.app";
    const bucketPrefix = `/${bucketName}/`;
    if (url.hostname === "storage.googleapis.com" && url.pathname.startsWith(bucketPrefix)) {
      const objectPath = decodeURIComponent(url.pathname.slice(bucketPrefix.length));
      return `/api/media/firebase-storage?path=${encodeURIComponent(objectPath)}`;
    }
  } catch {
    // Keep non-URL and relative application assets unchanged.
  }

  return src;
}

export function getBackupUrl(imageUrls?: string[] | null, imageBackupUrls?: string[] | null, index: number = 0): string | null {
  if (!imageBackupUrls || !imageBackupUrls[index]) return null;
  if (imageUrls?.[index] === imageBackupUrls[index]) return null;
  return imageBackupUrls[index];
}
