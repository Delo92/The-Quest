export interface VideoShareMetadata {
  playerUrl: string;
  streamUrl?: string;
  posterUrl: string;
  width: number;
  height: number;
  duration?: number;
  uploadDate?: string;
}

export function shareVideoPath(competitionId: number, talentProfileId: number, videoId: string): string {
  return `/api/share-video/${competitionId}/${talentProfileId}/${videoId}.mp4`;
}

export function shareVideoPlayerPath(competitionId: number, talentProfileId: number, videoId: string): string {
  return `/api/share-video/${competitionId}/${talentProfileId}/${videoId}.html`;
}

/** Keep server-rendered cards and hydrated page metadata in agreement. */
export function videoShareTags(video: VideoShareMetadata, origin: string) {
  const tags: Array<{ attr: "property" | "name"; key: string; value: string }> = [];
  const add = (attr: "property" | "name", key: string, value: string | number) =>
    tags.push({ attr, key, value: String(value) });
  const httpsUrl = (value: string) => {
    const url = new URL(value, origin);
    if (url.protocol !== "https:") throw new Error("Share video URLs must use HTTPS");
    return url.href;
  };
  const width = Math.max(1, Math.round(video.width || 640));
  const height = Math.max(1, Math.round(video.height || 360));
  // Messages and other direct-media consumers need a video asset, not an iframe.
  if (video.streamUrl) {
    const stream = httpsUrl(video.streamUrl);
    add("property", "og:video", stream);
    add("property", "og:video:secure_url", stream);
    add("property", "og:video:type", "video/mp4");
    add("property", "og:video:width", width);
    add("property", "og:video:height", height);
    add("name", "twitter:player:stream", stream);
    add("name", "twitter:player:stream:content_type", "video/mp4");
  }
  const player = httpsUrl(video.playerUrl);
  add("property", "og:video", player);
  add("property", "og:video:secure_url", player);
  add("property", "og:video:type", "text/html");
  add("property", "og:video:width", width);
  add("property", "og:video:height", height);
  add("name", "twitter:player", player);
  add("name", "twitter:player:width", width);
  add("name", "twitter:player:height", height);
  if (video.duration && video.duration > 0) add("property", "video:duration", Math.round(video.duration));
  return tags;
}
