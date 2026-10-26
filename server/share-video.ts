import type { Express } from "express";
import { storage } from "./storage";
import { getCompetitionScopedTalentVideos } from "./competition-videos";
import { extractVimeoVideoId, getVideoById, getVideoPlayUrls } from "./vimeo";
import {
  shareCompetitionVideoPath,
  shareCompetitionVideoPlayerPath,
  shareVideoPath,
  shareVideoPlayerPath,
  type VideoShareMetadata,
} from "../shared/video-share";

type Profile = Parameters<typeof getCompetitionScopedTalentVideos>[0] & {
  id: number;
  displayName: string;
  stageName?: string | null;
};
type Competition = Parameters<typeof getCompetitionScopedTalentVideos>[1] & {
  coverVideo?: string | null;
  coverImage?: string | null;
  promoVideos?: string[] | null;
};
type MediaDependencies = {
  getVideos?: typeof getCompetitionScopedTalentVideos;
  getVideoById?: typeof getVideoById;
  getPlayUrls?: typeof getVideoPlayUrls;
};
const metadataCache = new Map<string, { expiresAt: number; value: VideoShareMetadata | null }>();
const metadataPending = new Map<string, Promise<VideoShareMetadata | null>>();

export async function getContestantShareVideo(
  competition: Competition,
  profile: Profile,
  origin: string,
  dependencies: MediaDependencies = {},
): Promise<VideoShareMetadata | null> {
  const key = JSON.stringify([origin, competition.id, competition.vimeoFolderUrl, competition.title,
    profile.id, profile.stageName, profile.displayName, profile.competitionVideoUris?.[String(competition.id)],
    profile.hiddenVideoUris]);
  const cached = !Object.keys(dependencies).length && metadataCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = !Object.keys(dependencies).length && metadataPending.get(key);
  if (pending) return pending;
  const load = async () => {
    try {
      const [video] = await (dependencies.getVideos || getCompetitionScopedTalentVideos)(
        profile, competition, profile.stageName || profile.displayName,
      );
      if (!video) return null;
      const videoId = extractVimeoVideoId(video.uri);
      if (!videoId || !video.player_embed_url?.startsWith("https://player.vimeo.com/video/")) return null;
      let posterUrl = [...(video.pictures?.sizes || [])].sort((a, b) => b.width - a.width)[0]?.link;
      let hasStream = false;
      try {
        const play = await (dependencies.getPlayUrls || getVideoPlayUrls)(videoId);
        posterUrl = play.thumbnailUrl || posterUrl;
        hasStream = play.progressive.length > 0;
      } catch {
        // The Vimeo player and its real video poster still work without MP4 access.
      }
      if (!posterUrl) return null;
      return {
        playerUrl: hasStream
          ? `${origin}${shareVideoPlayerPath(competition.id, profile.id, videoId)}`
          : video.player_embed_url,
        ...(hasStream ? { streamUrl: `${origin}${shareVideoPath(competition.id, profile.id, videoId)}` } : {}),
        posterUrl,
        width: video.width || 640,
        height: video.height || 360,
        duration: video.duration,
        uploadDate: video.created_time,
      };
    } catch {
      console.warn("[share-video] Competition video metadata is temporarily unavailable");
      return null;
    }
  };
  const promise = load();
  if (Object.keys(dependencies).length) return promise;
  metadataPending.set(key, promise);
  try {
    const value = await promise;
    if (metadataCache.size >= 256) metadataCache.delete(metadataCache.keys().next().value!);
    metadataCache.set(key, { value, expiresAt: Date.now() + (value ? 60_000 : 15_000) });
    return value;
  } finally {
    metadataPending.delete(key);
  }
}

const competitionVideoMetadataCache = new Map<string, { expiresAt: number; value: VideoShareMetadata | null }>();

export async function getCompetitionShareVideo(
  competition: Competition,
  origin: string,
  dependencies: Pick<MediaDependencies, "getVideoById" | "getPlayUrls"> = {},
): Promise<VideoShareMetadata | null> {
  const sources = [competition.coverVideo, ...(competition.promoVideos || [])]
    .filter((source): source is string => typeof source === "string" && source.length > 0);
  const directCoverMp4 = getDirectMp4Url(competition.coverVideo);
  if (directCoverMp4) {
    return {
      streamUrl: directCoverMp4,
      posterUrl: competition.coverImage || `${origin}/cb-logo-favicon.png?v=cbp-20260905`,
      width: 1280,
      height: 720,
    };
  }
  const videoIds = [...new Set(sources.map(extractVimeoVideoId).filter((id): id is string => !!id))];

  const key = JSON.stringify([origin, competition.id, sources, competition.coverImage]);
  const cached = !Object.keys(dependencies).length && competitionVideoMetadataCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const load = async (): Promise<VideoShareMetadata | null> => {
    for (const videoId of videoIds) {
      try {
        const video = await (dependencies.getVideoById || getVideoById)(videoId);
        if (!video.player_embed_url?.startsWith("https://player.vimeo.com/video/")) continue;
        let posterUrl = [...(video.pictures?.sizes || [])].sort((a, b) => b.width - a.width)[0]?.link;
        let hasStream = false;
        try {
          const play = await (dependencies.getPlayUrls || getVideoPlayUrls)(videoId);
          posterUrl = play.thumbnailUrl || posterUrl;
          hasStream = play.progressive.length > 0;
        } catch {
          // The saved Vimeo player and thumbnail can still provide a valid fallback.
        }
        if (!posterUrl) continue;
        return {
          playerUrl: hasStream
            ? `${origin}${shareCompetitionVideoPlayerPath(competition.id, videoId)}`
            : video.player_embed_url,
          ...(hasStream ? { streamUrl: `${origin}${shareCompetitionVideoPath(competition.id, videoId)}` } : {}),
          posterUrl,
          width: video.width || 640,
          height: video.height || 360,
          duration: video.duration,
          uploadDate: video.created_time,
        };
      } catch {
        // Try the next saved competition video if one is unavailable.
      }
    }
    const directPromoMp4 = (competition.promoVideos || [])
      .map(getDirectMp4Url)
      .find((url): url is string => !!url);
    if (directPromoMp4) {
      return {
        streamUrl: directPromoMp4,
        posterUrl: competition.coverImage || `${origin}/cb-logo-favicon.png?v=cbp-20260905`,
        width: 1280,
        height: 720,
      };
    }
    return null;
  };

  const value = await load();
  if (!Object.keys(dependencies).length) {
    if (competitionVideoMetadataCache.size >= 256) {
      competitionVideoMetadataCache.delete(competitionVideoMetadataCache.keys().next().value!);
    }
    competitionVideoMetadataCache.set(key, { value, expiresAt: Date.now() + (value ? 60_000 : 15_000) });
  }
  return value;
}

function getDirectMp4Url(source: string | null | undefined): string | null {
  if (!source || extractVimeoVideoId(source)) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || !url.pathname.toLowerCase().endsWith(".mp4")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function resolveShareVideoStream(
  competitionId: number,
  talentProfileId: number,
  videoId: string,
  dependencies: MediaDependencies & Pick<typeof storage, "getCompetition" | "getContestantsByCompetition"> = storage,
): Promise<string | null> {
  const competition = await dependencies.getCompetition(competitionId);
  if (!competition || competition.status === "draft") return null;
  // This storage method returns approved, public contestants only.
  const contestants = await dependencies.getContestantsByCompetition(competition.id);
  const contestant = contestants.find((entry) => entry.talentProfile.id === talentProfileId);
  if (!contestant) return null;
  const profile = contestant.talentProfile;
  const [video] = await (dependencies.getVideos || getCompetitionScopedTalentVideos)(
    profile, competition, profile.stageName || profile.displayName,
  );
  // Old previews must not expose removed/replaced videos or another entry's clip.
  if (!video || extractVimeoVideoId(video.uri) !== videoId) return null;
  const play = await (dependencies.getPlayUrls || getVideoPlayUrls)(videoId);
  const rendition = play.progressive.find((item) => item.rendition === "360p")
    || play.progressive.find((item) => item.rendition === "480p")
    || play.progressive[0];
  if (!rendition) return null;
  const target = new URL(rendition.link);
  if (target.protocol !== "https:") return null;
  return target.href;
}

export async function resolveCompetitionShareVideoStream(
  competitionId: number,
  videoId: string,
  dependencies: Pick<typeof storage, "getCompetition"> & Pick<MediaDependencies, "getPlayUrls"> = storage,
): Promise<string | null> {
  const competition = await dependencies.getCompetition(competitionId);
  if (!competition || competition.status === "draft") return null;
  const currentVideoIds = [competition.coverVideo, ...(competition.promoVideos || [])]
    .filter((source): source is string => typeof source === "string")
    .map(extractVimeoVideoId)
    .filter((id): id is string => !!id);
  if (!currentVideoIds.includes(videoId)) return null;
  const play = await (dependencies.getPlayUrls || getVideoPlayUrls)(videoId);
  const rendition = play.progressive.find((item) => item.rendition === "360p")
    || play.progressive.find((item) => item.rendition === "480p")
    || play.progressive[0];
  if (!rendition) return null;
  const target = new URL(rendition.link);
  if (target.protocol !== "https:") return null;
  return target.href;
}

export function renderShareVideoPlayer(streamPath: string, posterUrl: string): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Competition video | The Quest</title>
<style>html,body{margin:0;width:100%;height:100%;background:#111;color:#fff}video{display:block;width:100%;height:100%;object-fit:contain}</style>
</head><body><video controls playsinline loop preload="metadata" aria-label="Contestant competition video" poster="${escape(posterUrl)}">
<source src="${escape(streamPath)}" type="video/mp4">
Your browser does not support this video. <a href="${escape(streamPath)}">Open the competition video</a>.
</video></body></html>`;
}

export function registerShareVideoRoutes(
  app: Express,
  resolveStream = resolveShareVideoStream,
  getPlayUrls = getVideoPlayUrls,
  resolveCompetitionStream = resolveCompetitionShareVideoStream,
) {
  // Stable metadata URL; Vimeo's signed CDN destination is refreshed server-side.
  // Express also handles HEAD using this GET handler. Redirects preserve Range
  // requests so crawlers/players can fetch only the bytes they need from Vimeo.
  app.get("/api/share-video/:competitionId/:talentProfileId/:videoFile", async (req, res) => {
    const { competitionId, talentProfileId, videoFile } = req.params;
    const match = /^(\d+)\.(mp4|html)$/.exec(videoFile);
    if (!/^[1-9]\d*$/.test(competitionId) || !/^[1-9]\d*$/.test(talentProfileId) || !match) {
      res.status(400).json({ message: "Invalid shared video" });
      return;
    }
    try {
      const stream = await resolveStream(Number(competitionId), Number(talentProfileId), match[1]);
      if (!stream) {
        res.status(404).json({ message: "This competition video is not available" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      if (match[2] === "html") {
        const play = await getPlayUrls(match[1]);
        res.removeHeader("X-Frame-Options");
        res.setHeader("Content-Security-Policy", "default-src 'none'; media-src 'self' https:; img-src https:; style-src 'unsafe-inline'; frame-ancestors https:; base-uri 'none'; form-action 'none'");
        res.setHeader("X-Robots-Tag", "noindex");
        res.type("html").send(renderShareVideoPlayer(
          shareVideoPath(Number(competitionId), Number(talentProfileId), match[1]),
          play.thumbnailUrl || "",
        ));
        return;
      }
      res.redirect(302, stream);
    } catch {
      res.status(503).json({ message: "The shared video is temporarily unavailable" });
    }
  });

  app.get("/api/share-competition-video/:competitionId/:videoFile", async (req, res) => {
    const { competitionId, videoFile } = req.params;
    const match = /^(\d+)\.(mp4|html)$/.exec(videoFile);
    if (!/^[1-9]\d*$/.test(competitionId) || !match) {
      res.status(400).json({ message: "Invalid shared competition video" });
      return;
    }
    try {
      const stream = await resolveCompetitionStream(Number(competitionId), match[1]);
      if (!stream) {
        res.status(404).json({ message: "This competition video is not available" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      if (match[2] === "html") {
        const play = await getPlayUrls(match[1]);
        res.removeHeader("X-Frame-Options");
        res.setHeader("Content-Security-Policy", "default-src 'none'; media-src 'self' https:; img-src https:; style-src 'unsafe-inline'; frame-ancestors https:; base-uri 'none'; form-action 'none'");
        res.setHeader("X-Robots-Tag", "noindex");
        res.type("html").send(renderShareVideoPlayer(
          shareCompetitionVideoPath(Number(competitionId), match[1]),
          play.thumbnailUrl || "",
        ));
        return;
      }
      res.redirect(302, stream);
    } catch {
      res.status(503).json({ message: "The competition video is temporarily unavailable" });
    }
  });
}
