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

export async function findOrCreateFolder(name: string, parentUri?: string): Promise<VimeoFolder> {
  const listPath = parentUri
    ? `${parentUri}/items?type=folder&per_page=100`
    : `/me/projects?per_page=100`;

  try {
    const data = await vimeoRequest(listPath);
    const items = data.data || [];
    for (const item of items) {
      const folder = parentUri ? (item.folder || item) : item;
      if (folder.name === name) return folder;
    }
  } catch (err: any) {
    console.warn(`Could not list folders at ${listPath}:`, err.message);
  }

  const body: any = { name };
  if (parentUri) {
    body.parent_folder_uri = parentUri;
  }
  const created = await vimeoRequest("/me/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return created;
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

export async function createCompetitionVimeoFolder(competitionName: string): Promise<VimeoFolder> {
  return getCompetitionFolder(competitionName);
}

export async function createContestantVimeoFolder(competitionName: string, talentName: string): Promise<VimeoFolder> {
  return getTalentFolderInCompetition(competitionName, talentName);
}

export async function listTalentVideos(competitionName: string, talentName: string): Promise<VimeoVideo[]> {
  const safeTalentName = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const safeCompName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  try {
    const folder = await getTalentFolderInCompetition(competitionName, talentName);
    const videosUri = folder.metadata?.connections?.videos?.uri || `${folder.uri}/videos`;
    const data = await vimeoRequest(`${videosUri}?per_page=50&sort=date&direction=desc`);
    return data.data || [];
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

export async function listAllTalentVideos(talentName: string): Promise<(VimeoVideo & { competitionFolder: string })[]> {
  const safeTalentName = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  try {
    const root = await getRootFolder();
    const listPath = `${root.uri}/items?type=folder&per_page=100`;
    const data = await vimeoRequest(listPath);
    const compFolders = data.data || [];

    // Parallel: all competition folders checked simultaneously
    const results = await Promise.all(
      compFolders.map(async (compItem: any) => {
        const compFolder = compItem.folder || compItem;
        if (!compFolder.uri) return [];
        try {
          const talentData = await vimeoRequest(`${compFolder.uri}/items?type=folder&per_page=100`);
          const talentFolder = (talentData.data || [])
            .map((t: any) => t.folder || t)
            .find((f: any) => f.name === safeTalentName);
          if (!talentFolder) return [];
          const videosUri = talentFolder.metadata?.connections?.videos?.uri || `${talentFolder.uri}/videos`;
          const videosData = await vimeoRequest(`${videosUri}?per_page=50&sort=date&direction=desc`);
          return (videosData.data || []).map((v: VimeoVideo) => ({ ...v, competitionFolder: compFolder.name }));
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
  let folderUri: string | undefined;
  try {
    const folder = await getTalentFolderInCompetition(competitionName, talentName);
    folderUri = folder.uri;
  } catch (folderErr: any) {
    console.warn("Could not create/find Vimeo folder (uploading without folder):", folderErr.message);
  }

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
  if (!video.pictures.active || video.pictures.type === "default") return "";
  const sorted = [...video.pictures.sizes].sort((a, b) => Math.abs(a.width - width) - Math.abs(b.width - width));
  return sorted[0]?.link || "";
}

export function getVideoEmbedUrl(video: VimeoVideo): string {
  return video.player_embed_url || "";
}

export async function getVideoById(videoId: string): Promise<VimeoVideo> {
  return vimeoRequest(`/videos/${videoId}`);
}

// ChronicTV sync — parallel catalog under ChronicTV > Originals > CB Publishing The Quest
const CHRONIC_TV_QUEST_SERIES_NAME = "CB Publishing The Quest";

export async function getChronicTVVimeoFolder(): Promise<VimeoFolder> {
  return findOrCreateFolder("ChronicTV");
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

export async function syncVideoToChronicTV(videoUri: string, competitionName: string, talentName: string): Promise<void> {
  const contestantFolder = await getChronicTVContestantVimeoFolder(competitionName, talentName);
  await addVideoToFolder(videoUri, contestantFolder.uri);
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
    const folder = await getCompetitionFolder(competitionName);
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

    const root = await getRootFolder();
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
