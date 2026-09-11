import fs from "fs";
import path from "path";

const VIMEO_BASE = "https://api.vimeo.com";

function getVimeoHeaders(): Record<string, string> {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("VIMEO_ACCESS_TOKEN secret is not set");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.vimeo.*+json;version=3.4",
  };
}

export interface VimeoVideo {
  uri: string;
  name: string;
  description: string | null;
  link: string;
  player_embed_url: string;
  duration: number;
  width: number;
  height: number;
  status: string;
  pictures: {
    active: boolean;
    type: string;
    sizes: Array<{ width: number; height: number; link: string }>;
  };
  created_time: string;
}

export function formatVimeoDisplayName(
  rawName: string | null | undefined,
  competitionName?: string | null,
  talentName?: string | null,
): string {
  let displayName = String(rawName || "").trim();
  const safeCompetition = competitionName
    ? competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim()
    : "";
  const safeTalent = talentName
    ? talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim()
    : "";

  const knownPrefix = safeCompetition && safeTalent
    ? `${safeCompetition} - ${safeTalent} -`
    : "";
  if (knownPrefix && displayName.startsWith(knownPrefix)) {
    displayName = displayName.slice(knownPrefix.length).trim();
  } else {
    // Legacy Vimeo names contain the competition and contestant path. Keep only
    // the final human-facing filename instead of exposing that storage convention.
    const parts = displayName.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 3) displayName = parts[parts.length - 1];
  }

  displayName = displayName
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return displayName || "Performance video";
}

export interface VimeoFolder {
  uri: string;
  name: string;
  metadata: {
    connections: {
      videos: { total: number; uri: string };
    };
  };
}

async function vimeoRequest(path: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith("http") ? path : `${VIMEO_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getVimeoHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Vimeo API ${options.method || "GET"} ${path} → ${res.status}: ${text}`);
    throw new Error(`Vimeo API error ${res.status}: ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// In-process folder cache — folders virtually never change so we cache for 30 minutes.
const folderCache = new Map<string, { folder: VimeoFolder; expiresAt: number }>();
const folderInflight = new Map<string, Promise<VimeoFolder>>();

export async function findOrCreateFolder(name: string, parentUri?: string): Promise<VimeoFolder> {
  const cacheKey = `${name}::${parentUri ?? "root"}`;
  const now = Date.now();

  const cached = folderCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.folder;

  // Deduplicate concurrent calls for the same folder
  const inflight = folderInflight.get(cacheKey);
  if (inflight) return inflight;

  const promise = (async (): Promise<VimeoFolder> => {
    const listDescription = parentUri ? `${parentUri}/items?per_page=100` : "/me/projects?per_page=100&page=1..20";
    try {
      const items: any[] = [];
      if (parentUri) {
        const data = await vimeoRequest(`${parentUri}/items?per_page=100`);
        items.push(...(data.data || []));
      } else {
        for (let page = 1; page <= 20; page++) {
          const data = await vimeoRequest(`/me/projects?per_page=100&page=${page}`);
          const pageItems = data.data || [];
          items.push(...pageItems);
          if (pageItems.length < 100) break;
        }
      }

      const matchingFolders = [];
      for (const item of items) {
        const folder = item.folder || item;
        const isFolder = parentUri ? Boolean(item.folder || item.type === "folder" || item.resource_key) : true;
        const isRootFolder = parentUri || !folder.metadata?.connections?.parent_folder?.uri;
        if (isFolder && isRootFolder && folder.name === name) {
          matchingFolders.push(folder);
        }
      }
      if (matchingFolders.length > 0) {
        matchingFolders.sort((a: VimeoFolder, b: VimeoFolder) => {
          const aId = Number(a.uri?.match(/\/(\d+)$/)?.[1] || Number.MAX_SAFE_INTEGER);
          const bId = Number(b.uri?.match(/\/(\d+)$/)?.[1] || Number.MAX_SAFE_INTEGER);
          return aId - bId;
        });
        const folder = matchingFolders[0];
        folderCache.set(cacheKey, { folder, expiresAt: now + 30 * 60_000 });
        return folder;
      }
    } catch (err: any) {
      console.warn(`Could not list folders at ${listDescription}:`, err.message);
    }

    const body: any = { name };
    if (parentUri) body.parent_folder_uri = parentUri;
    const created = await vimeoRequest("/me/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });

    folderCache.set(cacheKey, { folder: created, expiresAt: now + 30 * 60_000 });
    return created;
  })();

  folderInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    folderInflight.delete(cacheKey);
  }
}

export function parseVimeoFolderUri(folderUrl: string): string {
  try {
    const parsed = new URL(folderUrl.trim());
    if (parsed.hostname !== "vimeo.com" && !parsed.hostname.endsWith(".vimeo.com")) {
      throw new Error("Folder link must be a Vimeo URL");
    }
    const match = parsed.pathname.match(/\/folder\/(\d+)(?:\/|$)/);
    if (!match) throw new Error("Folder link must include a Vimeo folder ID");
    return `/me/projects/${match[1]}`;
  } catch (error: any) {
    if (error?.message?.startsWith("Folder link")) throw error;
    throw new Error("Folder link must be a valid Vimeo folder URL");
  }
}

export async function getVimeoFolderFromUrl(folderUrl: string): Promise<VimeoFolder> {
  const folderUri = parseVimeoFolderUri(folderUrl);
  const folder = await vimeoRequest(folderUri);
  if (!folder?.uri || !folder?.name) {
    throw new Error("The Vimeo folder could not be found or accessed");
  }
  return folder as VimeoFolder;
}

export async function getRootFolder(): Promise<VimeoFolder> {
  return findOrCreateFolder("The Quest");
}

export async function getCompetitionFolder(competitionName: string): Promise<VimeoFolder> {
  const root = await getRootFolder();
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  return findOrCreateFolder(safeName, root.uri);
}

export async function getTalentFolderInCompetition(competitionName: string, talentName: string): Promise<VimeoFolder> {
  const compFolder = await getCompetitionFolder(competitionName);
  const safeTalentName = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  return findOrCreateFolder(safeTalentName, compFolder.uri);
}

export async function createCompetitionVimeoFolder(
  competitionName: string,
  folderUrl?: string | null,
): Promise<VimeoFolder> {
  return folderUrl
    ? getVimeoFolderFromUrl(folderUrl)
    : getChronicTVEventVimeoFolder(competitionName);
}

export async function createContestantVimeoFolder(competitionName: string, _talentName: string): Promise<VimeoFolder> {
  // Contestant uploads share the competition folder. Keep this function for
  // existing callers, but never create a contestant-level Vimeo folder.
  return getChronicTVEventVimeoFolder(competitionName);
}

export async function listTalentVideos(
  competitionName: string,
  talentName: string,
  folderUrl?: string | null,
): Promise<VimeoVideo[]> {
  const safeTalentName = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const safeCompName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  try {
    const folder = folderUrl
      ? await getVimeoFolderFromUrl(folderUrl)
      : await getChronicTVEventVimeoFolder(competitionName);
    const videosUri = folder.metadata?.connections?.videos?.uri || `${folder.uri}/videos`;
    const data = await vimeoRequest(`${videosUri}?per_page=50&sort=date&direction=desc`);
    const prefix = `${safeCompName} - ${safeTalentName} -`;
    return (data.data || []).filter((v: VimeoVideo) => v.name?.startsWith(prefix));
  } catch {
    try {
      const prefix = `${safeCompName} - ${safeTalentName} -`;
      const data = await vimeoRequest(`/me/videos?per_page=50&sort=date&direction=desc&query=${encodeURIComponent(prefix)}`);
      return (data.data || []).filter((v: VimeoVideo) => v.name?.startsWith(prefix));
    } catch {
      return [];
    }
  }
}

export async function listCompetitionVideos(competitionName: string): Promise<VimeoVideo[]> {
  const safeCompName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const prefix = `${safeCompName} -`;
  try {
    const folder = await getChronicTVEventVimeoFolder(competitionName);
    const videosUri = folder.metadata?.connections?.videos?.uri || `${folder.uri}/videos`;
    const folderData = await vimeoRequest(`${videosUri}?per_page=100&sort=date&direction=desc`);
    const inCompetitionFolder = (folderData.data || []).filter((v: VimeoVideo) => v.name?.startsWith(prefix));
    const searchData = await vimeoRequest(`/me/videos?per_page=100&sort=date&direction=desc&query=${encodeURIComponent(prefix)}`);
    const allMatches = (searchData.data || []).filter((v: VimeoVideo) => v.name?.startsWith(prefix));
    const byUri = new Map<string, VimeoVideo>();
    [...inCompetitionFolder, ...allMatches].forEach((video: VimeoVideo) => byUri.set(video.uri, video));
    return Array.from(byUri.values());
  } catch {
    try {
      const searchData = await vimeoRequest(`/me/videos?per_page=100&sort=date&direction=desc&query=${encodeURIComponent(prefix)}`);
      return (searchData.data || []).filter((v: VimeoVideo) => v.name?.startsWith(prefix));
    } catch {
      return [];
    }
  }
}

export async function listLegacyQuestTalentVideos(competitionName: string, talentName: string): Promise<VimeoVideo[]> {
  const safeTalentName = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const safeCompName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  try {
    const root = await getRootFolder();
    const competitionItems = await vimeoRequest(`${root.uri}/items?type=folder&per_page=100`);
    const competitionFolder = (competitionItems.data || [])
      .map((item: any) => item.folder || item)
      .find((folder: any) => folder.name === safeCompName);
    if (!competitionFolder?.uri) return [];

    const talentItems = await vimeoRequest(`${competitionFolder.uri}/items?type=folder&per_page=100`);
    const talentFolder = (talentItems.data || [])
      .map((item: any) => item.folder || item)
      .find((folder: any) => folder.name === safeTalentName);
    if (!talentFolder?.uri) return [];

    const videosUri = talentFolder.metadata?.connections?.videos?.uri || `${talentFolder.uri}/videos`;
    const data = await vimeoRequest(`${videosUri}?per_page=50&sort=date&direction=desc`);
    return data.data || [];
  } catch {
    return [];
  }
}

export async function listAllTalentVideos(talentName: string): Promise<(VimeoVideo & { competitionFolder: string })[]> {
  const safeTalentName = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  try {
    const root = await getChronicTVQuestSeriesFolder();
    const listPath = `${root.uri}/items?type=folder&per_page=100`;
    const data = await vimeoRequest(listPath);
    const compFolders = data.data || [];

    // Parallel: all competition folders checked simultaneously
    const results = await Promise.all(
      compFolders.map(async (compItem: any) => {
        const compFolder = compItem.folder || compItem;
        if (!compFolder.uri) return [];
        try {
          const videosUri = compFolder.metadata?.connections?.videos?.uri || `${compFolder.uri}/videos`;
          const videosData = await vimeoRequest(`${videosUri}?per_page=50&sort=date&direction=desc`);
          const prefix = `${compFolder.name} - ${safeTalentName} -`;
          return (videosData.data || [])
            .filter((v: VimeoVideo) => v.name?.startsWith(prefix))
            .map((v: VimeoVideo) => ({ ...v, competitionFolder: compFolder.name }));
        } catch {
          return [];
        }
      })
    );
    return results.flat();
  } catch {
    try {
      const searchQuery = ` - ${safeTalentName} - `;
      const data = await vimeoRequest(`/me/videos?per_page=100&sort=date&direction=desc&query=${encodeURIComponent(safeTalentName)}`);
      return (data.data || [])
        .filter((v: VimeoVideo) => v.name?.includes(searchQuery))
        .map((v: VimeoVideo) => {
          const parts = v.name?.split(" - ") || [];
          return { ...v, competitionFolder: parts[0] || "Unknown" };
        });
    } catch {
      return [];
    }
  }
}

export async function createUploadTicket(
  competitionName: string,
  talentName: string,
  fileName: string,
  fileSize: number
): Promise<{
  uploadLink: string;
  videoUri: string;
  completeUri: string;
}> {
  const folder = await getChronicTVEventVimeoFolder(competitionName);
  const folderUri = folder.uri;

  const videoName = `${competitionName} - ${talentName} - ${fileName}`;
  const body: any = {
    upload: {
      approach: "tus",
      size: fileSize,
    },
    name: videoName,
  };
  if (folderUri) {
    body.folder_uri = folderUri;
  }

  const data = await vimeoRequest("/me/videos", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    uploadLink: data.upload.upload_link,
    videoUri: data.uri,
    completeUri: data.upload.complete_uri || "",
  };
}

export async function createCustomFolderUploadTicket(
  folderUrl: string,
  competitionName: string,
  talentName: string,
  fileName: string,
  fileSize: number
): Promise<{ uploadLink: string; videoUri: string; completeUri: string }> {
  const folder = await getVimeoFolderFromUrl(folderUrl);
  const videoName = `${competitionName} - ${talentName} - ${fileName}`;
  const data = await vimeoRequest("/me/videos", {
    method: "POST",
    body: JSON.stringify({
      upload: { approach: "tus", size: fileSize },
      name: videoName,
      folder_uri: folder.uri,
    }),
  });
  return {
    uploadLink: data.upload.upload_link,
    videoUri: data.uri,
    completeUri: data.upload.complete_uri || "",
  };
}

export async function createChronicTVUploadTicket(
  competitionName: string,
  talentName: string,
  chronicTVName: string,
  fileName: string,
  fileSize: number,
  folderUrl?: string | null,
): Promise<{
  uploadLink: string;
  videoUri: string;
  completeUri: string;
}> {
  const folder = folderUrl
    ? await getVimeoFolderFromUrl(folderUrl)
    : await getChronicTVEventVimeoFolder(competitionName);
  const folderUri = folder.uri;

  const videoName = `${competitionName} - ${talentName} - ${fileName}`;
  const body: any = {
    upload: {
      approach: "tus",
      size: fileSize,
    },
    name: videoName,
  };
  if (folderUri) {
    body.folder_uri = folderUri;
  }

  const data = await vimeoRequest("/me/videos", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    uploadLink: data.upload.upload_link,
    videoUri: data.uri,
    completeUri: data.upload.complete_uri || "",
  };
}

export async function getVideo(videoUri: string): Promise<VimeoVideo> {
  return vimeoRequest(videoUri);
}

export async function deleteVideo(videoUri: string): Promise<void> {
  await vimeoRequest(videoUri, { method: "DELETE" });
}

export async function renameVideo(videoUri: string, newName: string): Promise<VimeoVideo> {
  return vimeoRequest(videoUri, {
    method: "PATCH",
    body: JSON.stringify({ name: newName }),
  });
}

export async function addVideoToFolder(videoUri: string, folderUri: string): Promise<void> {
  const videoId = videoUri.replace("/videos/", "");
  await vimeoRequest(`${folderUri}/videos/${videoId}`, {
    method: "PUT",
  });
}

export function getVideoThumbnail(video: VimeoVideo, width: number = 640): string {
  if (!video.pictures?.sizes?.length) return "";
  if (!video.pictures.active) return "";
  const sorted = [...video.pictures.sizes].sort((a, b) => Math.abs(a.width - width) - Math.abs(b.width - width));
  return sorted[0]?.link || "";
}

export async function resolveVideoThumbnail(video: VimeoVideo, width: number = 640): Promise<string> {
  const quick = getVideoThumbnail(video, width);
  if (quick) return quick;
  try {
    const videoId = video.uri.replace("/videos/", "");
    const data = await vimeoRequest(`/videos/${videoId}/pictures`);
    const pictures: any[] = data.data || [];
    const custom = pictures.find((p) => !p.default_picture && p.sizes?.length);
    if (!custom) return "";
    const sorted = [...custom.sizes].sort((a: any, b: any) => Math.abs(a.width - width) - Math.abs(b.width - width));
    return sorted[0]?.link || "";
  } catch {
    return "";
  }
}

export function getVideoEmbedUrl(video: VimeoVideo): string {
  return video.player_embed_url || "";
}

export async function getVideoById(videoId: string): Promise<VimeoVideo> {
  return vimeoRequest(`/videos/${videoId}`);
}

export interface VimeoPlayUrls {
  hls: string | null;
  dash: string | null;
  progressive: Array<{ rendition: string; width: number; height: number; link: string; size: number }>;
  expiresAt: number; // unix ms
}

/** Extract the numeric Vimeo video ID from any Vimeo URL format. */
export function extractVimeoVideoId(url: string): string | null {
  const match = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
  return match ? match[1] : null;
}

/**
 * Resolve a direct progressive MP4 link for a Vimeo URL.
 * Prefers 360p for background/ambient playback — small file, fast start, GPU-decoded.
 * Falls back through available renditions if 360p isn't transcoded.
 * Returns null if the account doesn't support direct links or the call fails.
 */
export async function resolveDirectVideoUrl(vimeoUrl: string): Promise<string | null> {
  const id = extractVimeoVideoId(vimeoUrl);
  if (!id) return null;
  try {
    const urls = await getVideoPlayUrls(id);
    const target =
      urls.progressive.find(p => p.rendition === "360p") ||
      urls.progressive.find(p => p.rendition === "480p") ||
      urls.progressive[1] ||
      urls.progressive[0];
    return target?.link ?? null;
  } catch {
    return null;
  }
}

// Cache HLS/progressive URLs server-side. Links expire in ~24h so cache for 23h.
// The cache is persisted to disk so it survives server restarts — a restart no
// longer causes a cold-cache performance hit where every video hits Vimeo API fresh.
const PLAY_URL_CACHE_FILE = path.join(process.cwd(), ".vimeo-play-cache.json");

type PlayUrlCacheEntry = { data: VimeoPlayUrls; expiresAt: number };
const playUrlCache = new Map<string, PlayUrlCacheEntry>();

// Load persisted cache from disk on startup (ignore missing/corrupt file)
try {
  const raw = fs.readFileSync(PLAY_URL_CACHE_FILE, "utf8");
  const entries: Record<string, PlayUrlCacheEntry> = JSON.parse(raw);
  const now = Date.now();
  let loaded = 0;
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.expiresAt > now) {
      playUrlCache.set(id, entry);
      loaded++;
    }
  }
  if (loaded > 0) console.log(`[vimeo] Restored ${loaded} play URL entries from disk cache`);
} catch {
  // File doesn't exist yet or is corrupt — start fresh, no action needed
}

/**
 * Evict a video ID from the play URL cache immediately.
 * Call this whenever a video is deleted or its URL changes — prevents the old
 * signed URL from being served for up to 23 hours.
 */
export function invalidateVideoPlayCache(videoId: string): void {
  playUrlCache.delete(videoId);
  persistPlayUrlCache();
}

/**
 * Pre-warm the cache for a single freshly-uploaded or newly-set video.
 * Fire-and-forget — caller should not await this.
 */
export function prewarmVideoPlayUrl(vimeoUrl: string): void {
  const id = extractVimeoVideoId(vimeoUrl);
  if (!id) return;
  // Evict any stale entry first so we always fetch fresh for a changed video
  playUrlCache.delete(id);
  getVideoPlayUrls(id).catch(() => {});
}

function persistPlayUrlCache() {
  try {
    const obj: Record<string, PlayUrlCacheEntry> = {};
    for (const [id, entry] of playUrlCache.entries()) obj[id] = entry;
    fs.writeFileSync(PLAY_URL_CACHE_FILE, JSON.stringify(obj), "utf8");
  } catch {
    // Non-fatal — in-memory cache still works
  }
}

export async function getVideoPlayUrls(videoId: string): Promise<VimeoPlayUrls> {
  const now = Date.now();
  const cached = playUrlCache.get(videoId);
  if (cached && cached.expiresAt > now) return cached.data;

  const data = await vimeoRequest(`/videos/${videoId}?fields=play`);
  const play = data?.play || {};

  const result: VimeoPlayUrls = {
    hls: play.hls?.link || null,
    dash: play.dash?.link || null,
    progressive: (play.progressive || []).map((f: any) => ({
      rendition: f.rendition,
      width: f.width,
      height: f.height,
      link: f.link,
      size: f.size,
    })).sort((a: any, b: any) => a.height - b.height), // ascending: lowest quality first
    expiresAt: now + 23 * 60 * 60 * 1000,
  };

  playUrlCache.set(videoId, { data: result, expiresAt: result.expiresAt });
  persistPlayUrlCache(); // write-through so the next restart warms immediately
  return result;
}

/**
 * Pre-warm the Vimeo play URL cache on server startup.
 * Fetches signed HLS/progressive URLs for every active competition's cover video
 * so the first real user request hits the cache instead of Vimeo's API cold.
 * Runs non-blocking — a failure here never prevents the server from starting.
 */
export async function warmVimeoPlayUrlCache(
  getCompetitions: () => Promise<Array<{ coverVideo?: string | null }>>
): Promise<void> {
  try {
    const comps = await getCompetitions();
    const ids = [
      ...new Set(
        comps
          .map(c => c.coverVideo ? extractVimeoVideoId(c.coverVideo) : null)
          .filter((id): id is string => !!id)
      ),
    ];
    if (ids.length === 0) return;
    let warmed = 0;
    await Promise.allSettled(
      ids.map(id =>
        getVideoPlayUrls(id)
          .then(() => { warmed++; })
          .catch(() => {})
      )
    );
    console.log(`[vimeo] Pre-warmed play URL cache for ${warmed}/${ids.length} competition videos`);
  } catch {
    // Non-fatal — cache will warm on first real request
  }
}

// ChronicTV sync — parallel catalog under ChronicTV > Originals > CB Publishing The Quest
const CHRONIC_TV_QUEST_SERIES_NAME = "CB Publishing The Quest";
// Vimeo returns a mixture of personal-library and team-library projects from
// /me/projects.  The canonical Quest catalog lives in this specific My library
// folder, so do not rediscover it by name at the ambiguous project root.
const CHRONIC_TV_MY_LIBRARY_FOLDER_URI = "/me/projects/25521298";

export async function getChronicTVVimeoFolder(): Promise<VimeoFolder> {
  const folder = await vimeoRequest(CHRONIC_TV_MY_LIBRARY_FOLDER_URI);
  if (!folder?.uri || folder.name !== "ChronicTV") {
    throw new Error("The canonical My library ChronicTV folder could not be found");
  }
  return folder as VimeoFolder;
}

export async function getChronicTVOriginalsFolder(): Promise<VimeoFolder> {
  const chronicTV = await getChronicTVVimeoFolder();
  return findOrCreateFolder("Originals", chronicTV.uri);
}

export async function getChronicTVQuestSeriesFolder(): Promise<VimeoFolder> {
  const originals = await getChronicTVOriginalsFolder();
  return findOrCreateFolder(CHRONIC_TV_QUEST_SERIES_NAME, originals.uri);
}

export async function getChronicTVEventVimeoFolder(competitionName: string): Promise<VimeoFolder> {
  const questSeries = await getChronicTVQuestSeriesFolder();
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  return findOrCreateFolder(safeName, questSeries.uri);
}

export async function getChronicTVContestantVimeoFolder(competitionName: string, talentName: string): Promise<VimeoFolder> {
  const eventFolder = await getChronicTVEventVimeoFolder(competitionName);
  const safeTalent = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  return findOrCreateFolder(safeTalent, eventFolder.uri);
}

export async function syncVideoToChronicTV(
  videoUri: string,
  competitionName: string,
  talentName: string,
  chronicTVName?: string
): Promise<void> {
  await addVideoToFolder(videoUri, (await getChronicTVEventVimeoFolder(competitionName)).uri);
}

// Admin10151992 folder (The Quest > Admin10151992, folder ID 28559983)
const ADMIN_FOLDER_URI = "/me/projects/28559983";

export async function createAdminLiveryUploadTicket(
  label: string,
  fileSize: number
): Promise<{ uploadLink: string; videoUri: string; completeUri: string }> {
  const data = await vimeoRequest("/me/videos", {
    method: "POST",
    body: JSON.stringify({
      upload: { approach: "tus", size: fileSize },
      name: label,
      folder_uri: ADMIN_FOLDER_URI,
    }),
  });
  return {
    uploadLink: data.upload.upload_link,
    videoUri: data.uri,
    completeUri: data.upload.complete_uri || "",
  };
}

export async function createCompetitionCoverUploadTicket(
  competitionName: string,
  fileSize: number
): Promise<{ uploadLink: string; videoUri: string; completeUri: string }> {
  let folderUri: string | undefined;
  try {
    const folder = await getChronicTVEventVimeoFolder(competitionName);
    folderUri = folder.uri;
  } catch (err: any) {
    console.warn("Could not find/create competition folder for cover:", err.message);
  }
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const body: any = {
    upload: { approach: "tus", size: fileSize },
    name: `${safeName} - Cover`,
  };
  if (folderUri) body.folder_uri = folderUri;
  const data = await vimeoRequest("/me/videos", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    uploadLink: data.upload.upload_link,
    videoUri: data.uri,
    completeUri: data.upload.complete_uri || "",
  };
}

export async function getVimeoStorageUsage(): Promise<{
  usedGB: number;
  totalGB: number;
  usedPercent: number;
  totalVideos: number;
  folders: Array<{ name: string; videoCount: number }>;
}> {
  let usedGB = 0;
  let totalGB = 0;
  let totalVideos = 0;
  const folders: Array<{ name: string; videoCount: number }> = [];

  try {
    const userData = await vimeoRequest("/me?fields=upload_quota");
    const quota = userData.upload_quota;
    if (quota?.space) {
      usedGB = Math.round(((quota.space.used || 0) / (1024 * 1024 * 1024)) * 100) / 100;
      totalGB = Math.round(((quota.space.max || 0) / (1024 * 1024 * 1024)) * 100) / 100;
    }

    const root = await getChronicTVQuestSeriesFolder();
    const listPath = `${root.uri}/items?type=folder&per_page=100`;
    const data = await vimeoRequest(listPath);
    const compFolders = data.data || [];

    for (const compItem of compFolders) {
      const compFolder = compItem.folder || compItem;
      if (!compFolder.uri) continue;
      const videoCount = compFolder.metadata?.connections?.videos?.total || 0;

      let subVideoCount = videoCount;
      try {
        const subListPath = `${compFolder.uri}/items?type=folder&per_page=100`;
        const subData = await vimeoRequest(subListPath);
        for (const subItem of subData.data || []) {
          const sub = subItem.folder || subItem;
          const subVids = sub.metadata?.connections?.videos?.total || 0;
          subVideoCount += subVids;
        }
      } catch {}

      totalVideos += subVideoCount;
      folders.push({ name: compFolder.name, videoCount: subVideoCount });
    }
  } catch (err: any) {
    console.error("Error getting Vimeo storage:", err.message);
  }

  return {
    usedGB,
    totalGB,
    usedPercent: totalGB > 0 ? Math.round((usedGB / totalGB) * 10000) / 100 : 0,
    totalVideos,
    folders,
  };
}
