import assert from "node:assert/strict";
import test from "node:test";
import { normalizePromoVideos } from "./promo-videos";

test("Vimeo page links become player URLs and keep the privacy hash", () => {
  assert.deepEqual(normalizePromoVideos(["https://vimeo.com/123456/abcdef1234"]), ["https://player.vimeo.com/video/123456?h=abcdef1234"]);
  assert.deepEqual(normalizePromoVideos(["https://vimeo.com/123456"]), ["https://player.vimeo.com/video/123456"]);
});
test("rejects unsafe, unsupported, and excess links", () => {
  assert.throws(() => normalizePromoVideos(["http://vimeo.com/1"]));
  assert.throws(() => normalizePromoVideos(["https://example.com/page"]));
  assert.throws(() => normalizePromoVideos(["javascript:alert(1)"]));
  assert.throws(() => normalizePromoVideos(Array(4).fill("https://vimeo.com/1")));
});
test("removes duplicates and accepts direct files", () => {
  assert.deepEqual(normalizePromoVideos(["https://vimeo.com/5", "https://vimeo.com/5", "https://cdn.example.com/a.mp4"]),
    ["https://player.vimeo.com/video/5", "https://cdn.example.com/a.mp4"]);
});
