import { DEFAULT_TALENT_IMAGE_CROP_POSITION } from "../shared/image-crop";

export interface ImageCropPosition {
  x: number;
  y: number;
  zoom?: number;
}

const DEFAULT_IMAGE_CROP: ImageCropPosition = { ...DEFAULT_TALENT_IMAGE_CROP_POSITION };

export function normalizeImageCropPositions(
  value: unknown,
  imageCount: number,
): ImageCropPosition[] | null {
  if (!Number.isSafeInteger(imageCount) || imageCount < 0 || imageCount > 50) {
    return null;
  }

  const positions = value == null ? [] : value;
  if (
    !Array.isArray(positions)
    || positions.length > imageCount
    || positions.some((position) =>
      !position
      || typeof position !== "object"
      || !Number.isFinite((position as ImageCropPosition).x)
      || !Number.isFinite((position as ImageCropPosition).y)
      || ((position as ImageCropPosition).zoom !== undefined
        && !Number.isFinite((position as ImageCropPosition).zoom))
    )
  ) {
    return null;
  }

  return Array.from({ length: imageCount }, (_, index) => {
    const position = positions[index] as ImageCropPosition | undefined;
    if (!position) return { ...DEFAULT_IMAGE_CROP };
    const normalized: ImageCropPosition = {
      x: Math.max(0, Math.min(100, position.x)),
      y: Math.max(0, Math.min(100, position.y)),
    };
    if (position.zoom !== undefined) {
      normalized.zoom = Math.max(1, Math.min(2.5, position.zoom));
    }
    return normalized;
  });
}
