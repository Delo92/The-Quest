import assert from "node:assert/strict";
import test from "node:test";
import { normalizeImageCropPositions } from "./image-crop";

test("defaults missing image framing to centered positions", () => {
  assert.deepEqual(normalizeImageCropPositions(undefined, 2), [
    { x: 50, y: 50 },
    { x: 50, y: 50 },
  ]);
});

test("clamps submitted framing positions to the supported range", () => {
  assert.deepEqual(normalizeImageCropPositions([{ x: 140, y: -12 }], 1), [
    { x: 100, y: 0 },
  ]);
});

test("rejects malformed or excess framing positions", () => {
  assert.equal(normalizeImageCropPositions([{ x: "50", y: 50 }], 1), null);
  assert.equal(normalizeImageCropPositions([{ x: 50, y: 50 }, { x: 25, y: 25 }], 1), null);
  assert.equal(normalizeImageCropPositions(undefined, 51), null);
});
