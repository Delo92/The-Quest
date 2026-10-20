export const MAX_PROMO_VIDEOS = 3;

export class PromoVideoError extends Error {}

/**
 * Accepts Vimeo page/player links and direct https video files, and stores
 * Vimeo videos as player URLs so the public page can embed them.
 */
function normalizePromoVideoUrl(value: unknown): string {
  if (typeof value !== "string") throw new PromoVideoError("Each promo video must be a link.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new PromoVideoError("Promo videos must be valid links."); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new PromoVideoError("Promo video links must start with https://.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "player.vimeo.com") {
    if (!/^\/video\/\d+/.test(url.pathname)) throw new PromoVideoError("That Vimeo player link is not valid.");
    return url.toString();
  }
  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const match = url.pathname.match(/^\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([a-z0-9]+))?\/?$/i);
    if (!match) throw new PromoVideoError("Paste the link to a single Vimeo video.");
    const hash = match[2] || url.searchParams.get("h");
    const player = new URL(`https://player.vimeo.com/video/${match[1]}`);
    if (hash) player.searchParams.set("h", hash);
    return player.toString();
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(url.pathname)) return url.toString();
  throw new PromoVideoError("Use a Vimeo link or a direct https link to an mp4, webm or mov file.");
}

export function normalizePromoVideos(input: unknown): string[] {
  if (input === null || input === undefined) return [];
  if (!Array.isArray(input)) throw new PromoVideoError("Promo videos must be a list.");
  if (input.length > MAX_PROMO_VIDEOS) throw new PromoVideoError(`You can add up to ${MAX_PROMO_VIDEOS} promo videos.`);
  const urls = input.map(normalizePromoVideoUrl);
  return Array.from(new Set(urls));
}
