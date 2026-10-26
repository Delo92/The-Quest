import { extractVimeoVideoId, getVideoById, listTalentVideos, type VimeoVideo } from "./vimeo";

type VideoProfile = {
  competitionVideoUris?: Record<string, string>;
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
  if (typeof selectedUri === "string" && selectedUri && !hiddenUris.has(selectedUri)) {
    const videoId = extractVimeoVideoId(selectedUri);
    if (videoId) {
      try {
        const selectedVideo = await (dependencies.getVideoById || getVideoById)(videoId);
        if (selectedVideo?.uri) return [selectedVideo];
      } catch {
        // A just-uploaded video may not be indexed yet; try its competition folder.
      }
    }
  }
  const folderVideos = await (dependencies.listTalentVideos || listTalentVideos)(
    competition.title, talentName, competition.vimeoFolderUrl, { competitionOnly: true },
  );
  return folderVideos
    .filter((video) => video.uri && !hiddenUris.has(video.uri))
    .sort((a, b) => Date.parse(b.created_time || "") - Date.parse(a.created_time || ""))
    .slice(0, 1);
}
