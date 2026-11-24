import { extractVimeoVideoId, getVideoById, listTalentVideos, type VimeoVideo } from "./vimeo";

type VideoProfile = {
  competitionVideoUris?: Record<string, string>;
  competitionVideoLibraryUris?: Record<string, string[]>;
  hiddenVideoUris?: string[];
};
type VideoCompetition = { id: number; title: string; vimeoFolderUrl?: string | null };

export async function getCompetitionScopedTalentVideos(
  profile: VideoProfile,
  competition: VideoCompetition,
  talentName: string,
  dependencies: {
    getVideoById?: typeof getVideoById;
    listTalentVideos?: typeof listTalentVideos;
  } = {},
): Promise<VimeoVideo[]> {
  const hiddenUris = new Set<string>(Array.isArray(profile?.hiddenVideoUris) ? profile.hiddenVideoUris : []);
  const selectedUri = profile?.competitionVideoUris?.[String(competition.id)];
  const savedUris = profile?.competitionVideoLibraryUris?.[String(competition.id)] || [];
  const savedVideos = await Promise.all(
    [...new Set(savedUris)].filter((uri) => uri !== selectedUri && !hiddenUris.has(uri)).map(async (uri) => {
      const id = extractVimeoVideoId(uri);
      if (!id) return null;
      try {
        return await (dependencies.getVideoById || getVideoById)(id);
      } catch {
        return null;
      }
    }),
  );
  let selectedVideo: VimeoVideo | null = null;
  if (typeof selectedUri === "string" && selectedUri && !hiddenUris.has(selectedUri)) {
    const videoId = extractVimeoVideoId(selectedUri);
    if (videoId) {
      try {
        selectedVideo = await (dependencies.getVideoById || getVideoById)(videoId);
      } catch {
        // A just-uploaded video may not be indexed yet; try its competition folder.
      }
    }
  }
  // The saved URI chooses the featured clip, not the entire competition library.
  // Additional clips must belong to this artist inside this competition's folder.
  let folderVideos: VimeoVideo[] = [];
  try {
    folderVideos = await (dependencies.listTalentVideos || listTalentVideos)(
      competition.title, talentName, competition.vimeoFolderUrl, { competitionOnly: true },
    );
  } catch {
    // Preserve the explicitly saved video if the folder lookup is unavailable.
  }
  const seen = new Set<string>();
  return [...(selectedVideo?.uri ? [selectedVideo] : []), ...savedVideos.filter((video): video is VimeoVideo => !!video?.uri), ...folderVideos
    .slice()
    .sort((a, b) => Date.parse(b.created_time || "") - Date.parse(a.created_time || ""))]
    .filter((video) => video.uri && !hiddenUris.has(video.uri))
    .filter((video) => {
      const id = extractVimeoVideoId(video.uri) || video.uri;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}
