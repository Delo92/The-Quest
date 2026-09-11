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
  const query = new URLSearchParams(params);
  try {
    const sourceParams = new URL(url).searchParams;
    sourceParams.forEach((value, key) => {
      if (!query.has(key)) query.append(key, value);
    });
  } catch {
    const hash = getVimeoHash(url);
    if (hash && !query.has("h")) query.set("h", hash);
  }
  const qs = query.toString() ? `?${query.toString()}` : "";
  return `https://player.vimeo.com/video/${id}${qs}`;
}

/**
 * Vimeo names retain a private competition/contestant prefix for folder
 * matching. Public cards should show only the uploaded filename as a readable
 * title.
 */
export function formatVideoTitle(name: string | null | undefined): string {
  let title = String(name || "").trim();
  const parts = title.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) title = parts[parts.length - 1];
  title = title
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title || "Performance video";
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
