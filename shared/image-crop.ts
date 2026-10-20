export const DEFAULT_TALENT_IMAGE_CROP_POSITION = { x: 50, y: 18 } as const;

export interface ImageCropPosition {
  x: number;
  y: number;
  zoom?: number;
}

export function getCompetitionCropImageStyle(position: ImageCropPosition): Record<string, string> {
  const zoom = Math.max(1, Math.min(2.5, position.zoom ?? 1));
  if (zoom <= 1) {
    return { objectPosition: `${position.x}% ${position.y}%` };
  }

  return {
    position: "absolute",
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    left: `-${position.x * (zoom - 1)}%`,
    top: `-${position.y * (zoom - 1)}%`,
    objectFit: "cover",
    objectPosition: "50% 50%",
  };
}
