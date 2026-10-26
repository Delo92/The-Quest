import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { getCompetitionScopedTalentVideos } from "./competition-videos";
import { getContestantShareVideo, registerShareVideoRoutes, renderShareVideoPlayer, resolveShareVideoStream } from "./share-video";
import { applyShareMeta } from "./share-meta";
import { shareVideoPath, shareVideoPlayerPath, videoShareTags } from "../shared/video-share";
import type { VimeoVideo, VimeoPlayUrls } from "./vimeo";

const competition = { id: 71, title: "Competition A", status: "active", vimeoFolderUrl: "https://vimeo.com/showcase/71" };
const profile = {
  id: 81, displayName: "Sample artist",
  competitionVideoUris: { "71": "/videos/123456", "72": "/videos/987654" },
  videoUrls: ["https://vimeo.com/987654"],
};
const video: VimeoVideo = {
  uri: "/videos/123456", name: "Sample artist", description: null,
  link: "https://vimeo.com/123456/privatehash",
  player_embed_url: "https://player.vimeo.com/video/123456?h=privatehash",
  duration: 34, width: 1080, height: 1920, status: "available",
  pictures: { active: true, type: "custom", sizes: [{ width: 640, height: 1138, link: "https://i.vimeocdn.com/video/actual-frame.jpg" }] },
  created_time: "2026-10-01T12:00:00Z",
};
const play: VimeoPlayUrls = {
  hls: null, dash: null, thumbnailUrl: "https://i.vimeocdn.com/video/actual-frame.jpg",
  progressive: [{ rendition: "360p", width: 202, height: 360, link: "https://video.example.test/clip.mp4?expires=soon", size: 1000 }],
  expiresAt: Date.now() + 3600_000,
};

test("video selection uses only the chosen competition map entry, not the profile-wide list", async () => {
  const selected = await getCompetitionScopedTalentVideos(profile, competition, profile.displayName, {
    getVideoById: async (id) => { assert.equal(id, "123456"); return video; },
    listTalentVideos: async () => { throw new Error("Should not enumerate when mapped"); },
  });
  assert.equal(selected[0], video);
});

test("legacy video lookup stays inside the selected competition and excludes hidden videos", async () => {
  const hidden = { ...video, uri: "/videos/222222", created_time: "2026-10-20T00:00:00Z" };
  const result = await getCompetitionScopedTalentVideos({ hiddenVideoUris: [hidden.uri] }, competition, profile.displayName, {
    listTalentVideos: async (title, name, folder, options) => {
      assert.equal(title, competition.title);
      assert.equal(name, profile.displayName);
      assert.equal(folder, competition.vimeoFolderUrl);
      assert.equal(options?.competitionOnly, true);
      return [video, hidden];
    },
  });
  assert.deepEqual(result, [video]);
});

test("public video endpoint supports GET/HEAD and refuses unavailable or malformed media", async () => {
  const app = express();
  let resolves = 0;
  registerShareVideoRoutes(app, async (competitionId, talentProfileId, videoId) => {
    resolves++;
    assert.equal(competitionId, 71);
    assert.equal(talentProfileId, 81);
    return videoId === "123456" ? play.progressive[0].link : null;
  }, async () => play);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const get = await fetch(`${base}${shareVideoPath(71, 81, "123456")}`, { redirect: "manual", headers: { Range: "bytes=0-1023" } });
    assert.equal(get.status, 302);
    assert.equal(get.headers.get("location"), play.progressive[0].link);
    assert.equal(get.headers.get("cache-control"), "no-store");
    const head = await fetch(`${base}${shareVideoPath(71, 81, "123456")}`, { method: "HEAD", redirect: "manual" });
    assert.equal(head.status, 302);
    assert.equal(await head.text(), "");
    const player = await fetch(`${base}${shareVideoPlayerPath(71, 81, "123456")}`);
    assert.equal(player.status, 200);
    assert.match(player.headers.get("content-security-policy") || "", /frame-ancestors https:/);
    assert.match(await player.text(), /<source src="\/api\/share-video\/71\/81\/123456.mp4" type="video\/mp4">/);
    assert.equal((await fetch(`${base}${shareVideoPath(71, 81, "999999")}`)).status, 404);
    assert.equal((await fetch(`${base}/api/share-video/nope/81/123456.mp4`)).status, 400);
    assert.equal(resolves, 4);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("share metadata uses the video's poster and stable first-party player/MP4 paths", async () => {
  const meta = await getContestantShareVideo(competition, profile, "https://quest.example", {
    getVideos: async () => [video], getPlayUrls: async () => play,
  });
  assert.ok(meta);
  assert.equal(meta.posterUrl, play.thumbnailUrl);
  assert.equal(meta.playerUrl, "https://quest.example/api/share-video/71/81/123456.html");
  assert.equal(meta.streamUrl, "https://quest.example/api/share-video/71/81/123456.mp4");
  assert.doesNotMatch(JSON.stringify(meta), /expires=soon|987654/);
  assert.equal(meta.height, 1920);
});

test("Vimeo player metadata and real poster remain available without MP4 access", async () => {
  const meta = await getContestantShareVideo(competition, profile, "https://quest.example", {
    getVideos: async () => [video], getPlayUrls: async () => { throw new Error("No progressive access"); },
  });
  assert.ok(meta);
  assert.equal(meta.streamUrl, undefined);
  assert.equal(meta.posterUrl, video.pictures.sizes[0].link);
  assert.equal(meta.playerUrl, video.player_embed_url);
});

test("the public share player is responsive, uses native video, and escapes media attributes", () => {
  const html = renderShareVideoPlayer("/api/share-video/71/81/123456.mp4", 'https://image.example/frame.jpg?a=1&b="x"');
  assert.match(html, /controls playsinline loop preload="metadata"/);
  assert.match(html, /width:100%;height:100%;object-fit:contain/);
  assert.match(html, /a=1&amp;b=&quot;x&quot;/);
  assert.doesNotMatch(html, /<iframe|<script|expires=soon/);
});

test("an entry without a video cannot borrow another entry's media", async () => {
  const meta = await getContestantShareVideo(competition, profile, "https://quest.example", {
    getVideos: async () => [], getPlayUrls: async () => { throw new Error("Must not run"); },
  });
  assert.equal(meta, null);
});

const streamDependencies = () => ({
  getCompetition: async () => competition,
  getContestantsByCompetition: async () => [{ talentProfile: profile }],
  getVideos: async () => [video],
  getPlayUrls: async () => play,
}) as unknown as NonNullable<Parameters<typeof resolveShareVideoStream>[3]>;

test("stable stream resolves the current approved entry to a fresh signed CDN URL", async () => {
  assert.equal(await resolveShareVideoStream(71, 81, "123456", streamDependencies()), play.progressive[0].link);
});

test("stream refuses another video's ID, a missing contestant, and draft competitions", async () => {
  assert.equal(await resolveShareVideoStream(71, 81, "987654", streamDependencies()), null);
  assert.equal(await resolveShareVideoStream(71, 99, "123456", streamDependencies()), null);
  const dependencies = streamDependencies();
  dependencies.getCompetition = async () => ({ ...competition, status: "draft" } as any);
  assert.equal(await resolveShareVideoStream(71, 81, "123456", dependencies), null);
});

test("video cards advertise both MP4 and HTML players with the correct portrait size", () => {
  const tags = videoShareTags({
    playerUrl: video.player_embed_url, streamUrl: shareVideoPath(71, 81, "123456"),
    posterUrl: play.thumbnailUrl!, width: 1080, height: 1920, duration: 34,
  }, "https://quest.example");
  assert.deepEqual(tags.filter((tag) => tag.key === "og:video:type").map((tag) => tag.value), ["video/mp4", "text/html"]);
  assert.equal(tags.find((tag) => tag.key === "twitter:player:height")?.value, "1920");
  assert.equal(tags.find((tag) => tag.key === "twitter:player:stream")?.value, "https://quest.example/api/share-video/71/81/123456.mp4");
  assert.throws(() => videoShareTags({ playerUrl: "javascript:alert(1)", posterUrl: "", width: 1, height: 1 }, "https://quest.example"), /HTTPS/);
});

test("server HTML contains playable video tags and escaped video poster, not profile artwork", () => {
  const template = '<html><head><title>Old</title><meta name="twitter:card" content="summary_large_image" /><meta property="og:video" content="stale" /><link rel="canonical" href="https://old.example" /></head><body><div id="root"></div></body></html>';
  const poster = "https://i.vimeocdn.com/video/frame.jpg?a=1&b=2";
  const html = applyShareMeta(template, {
    title: "Artist's competition video", description: "Watch and vote", url: "https://quest.example/entry",
    image: poster, ogType: "video.other",
    video: { playerUrl: video.player_embed_url, streamUrl: "https://quest.example/api/share-video/71/81/123456.mp4", posterUrl: poster, width: 1080, height: 1920 },
  });
  assert.match(html, /name="twitter:card" content="player"/);
  assert.match(html, /property="og:video:type" content="video\/mp4"/);
  assert.match(html, /property="og:image" content="https:\/\/i.vimeocdn.com\/video\/frame.jpg\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /content="stale"|expires=soon/);
  const plain = applyShareMeta(html, { title: "Normal page", description: "Text", url: "https://quest.example" });
  assert.doesNotMatch(plain, /property="og:video"|name="twitter:player/);
  assert.match(plain, /name="twitter:card" content="summary_large_image"/);
});
