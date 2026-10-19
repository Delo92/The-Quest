export interface ImageCropPosition {
  x: number;
  y: number;
}

const CENTERED_IMAGE_CROP: ImageCropPosition = { x: 50, y: 50 };

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
    )
  ) {
    return null;
  }

  return Array.from({ length: imageCount }, (_, index) => {
    const position = positions[index] as ImageCropPosition | undefined;
    if (!position) return { ...CENTERED_IMAGE_CROP };
    return {
      x: Math.max(0, Math.min(100, position.x)),
      y: Math.max(0, Math.min(100, position.y)),
    };
  });
}
