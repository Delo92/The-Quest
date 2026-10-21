import test from "node:test";
import assert from "node:assert/strict";
import { getImageSourceCandidates } from "./fallback-image";

test("competition artwork follows contestant photo sources and precedes the platform placeholder", () => {
  assert.deepEqual(
    getImageSourceCandidates(
      "https://cdn.example/contestant.jpg",
      "https://cdn.example/contestant-backup.jpg",
      ["https://cdn.example/event-cover.jpg", "https://cdn.example/site-placeholder.jpg"],
    ),
    [
      "https://cdn.example/contestant.jpg",
      "https://cdn.example/contestant-backup.jpg",
      "https://cdn.example/event-cover.jpg",
      "https://cdn.example/site-placeholder.jpg",
      "/images/template/a1.jpg",
    ],
  );
});

test("an empty profile in a competition starts with that competition's cover", () => {
  assert.deepEqual(
    getImageSourceCandidates(undefined, undefined, ["https://cdn.example/event-cover.jpg"]),
    ["https://cdn.example/event-cover.jpg", "/images/template/a1.jpg"],
  );
});
