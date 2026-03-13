export type MediaType = "image" | "video" | "youtube" | "vimeo" | "facebook" | "instagram";

export function detectMediaType(url: string): MediaType {
  if (!url) return "image";
  const u = url.toLowerCase();
  if (/\.(mp4|webm|mov)(\?.*)?$/.test(u)) return "video";
  if (/player\.vimeo\.com\/|vimeo\.com\//.test(u)) return "vimeo";
  if (/youtube\.com\/|youtu\.be\//.test(u)) return "youtube";
  if (/facebook\.com\/|fb\.com\/|fb\.watch/.test(u)) return "facebook";
  if (/instagram\.com\/(p|reel|tv)\//.test(u)) return "instagram";
  return "image";
}

export function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/);
  return m ? m[1] : null;
}

export function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function getVimeoHash(url: string): string | null {
  const m = url.match(/[?&]h=([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

export function buildVimeoSrc(url: string, params: string): string | null {
  const id = getVimeoId(url);
  if (!id) return null;
  const hash = getVimeoHash(url);
  const parts: string[] = [];
  if (params) parts.push(params);
  if (hash) parts.push(`h=${hash}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return `https://player.vimeo.com/video/${id}${qs}`;
}

export function isFacebookVideo(url: string): boolean {
  return /\/videos\/|\/watch|fb\.watch|\/reel/.test(url);
}

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  image: "Image",
  video: "Video",
  youtube: "YouTube",
  vimeo: "Vimeo",
  facebook: "Facebook",
  instagram: "Instagram",
};

export const MEDIA_TYPE_COLORS: Record<MediaType, string> = {
  image: "bg-white/10 text-white/60",
  video: "bg-blue-500/80 text-white",
  youtube: "bg-red-600/90 text-white",
  vimeo: "bg-blue-400/90 text-white",
  facebook: "bg-indigo-600/90 text-white",
  instagram: "bg-purple-600/90 text-white",
};
