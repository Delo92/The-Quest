import type {
  OwnerAnalyticsCompetition,
  OwnerAnalyticsEntry,
  OwnerAnalyticsResponse,
} from "../../shared/owner-analytics";
import { slugify } from "../../shared/slugify";
import { firestoreStageSubmissions } from "../firestore-collections";
import { storage } from "../storage";
import { extractVimeoVideoId, getVimeoVideoAnalyticsByUris } from "../vimeo";
import { getPageVisitorsForPaths } from "./ga4Analytics";

type ProfileForAnalytics = {
  id: number;
  displayName: string;
  stageName?: string | null;
  videoUrls?: string[] | null;
  hiddenVideoUris?: string[] | null;
};

type CompetitionForAnalytics = {
  id: number;
  title: string;
  category: string;
};

type EntryForAnalytics = {
  competition: CompetitionForAnalytics;
  contestantId: number;
  talentProfile: ProfileForAnalytics;
  pagePath: string;
  stageVideoUris: string[];
};

function getProfileVideoUris(profile: ProfileForAnalytics): string[] {
  const hiddenUris = new Set(profile.hiddenVideoUris || []);
  return [...new Set((profile.videoUrls || []).filter(
    (uri): uri is string => typeof uri === "string" && uri.length > 0 && !hiddenUris.has(uri),
  ))];
}

function getEntryPath(competition: CompetitionForAnalytics, profile: ProfileForAnalytics): string {
  const categorySlug = slugify(competition.category || "competition") || "competition";
  const competitionSlug = slugify(competition.title || "competition") || "competition";
  const talentSlug = slugify(profile.stageName || profile.displayName || "contestant") || "contestant";
  return `/thequest/${categorySlug}/${competitionSlug}/${talentSlug}`;
}

function playsForIds(ids: Set<string>, videosById: Map<string, { plays: number | null }>): number {
  let total = 0;
  for (const id of ids) total += videosById.get(id)?.plays || 0;
  return total;
}

function videoIdsForUris(uris: string[]): Set<string> {
  return new Set(
    uris
      .map(extractVimeoVideoId)
      .filter((id): id is string => Boolean(id)),
  );
}

function videoIdsForEntry(
  entry: EntryForAnalytics,
  videosById: Map<string, { name: string; plays: number | null }>,
  entriesPerTalentProfile: Map<number, number>,
  allowUnscopedFallback: boolean,
): Set<string> {
  const ids = videoIdsForUris(entry.stageVideoUris);
  const safeCompetitionName = entry.competition.title
    .replace(/[^a-zA-Z0-9_\-\s]/g, "_")
    .trim();
  const competitionPrefixes = new Set([
    `${entry.competition.title} -`,
    `${safeCompetitionName} -`,
  ]);
  const contestantName = (entry.talentProfile.stageName || entry.talentProfile.displayName).trim();
  const hasSingleEntry = allowUnscopedFallback
    && entriesPerTalentProfile.get(entry.talentProfile.id) === 1;

  for (const id of videoIdsForUris(getProfileVideoUris(entry.talentProfile))) {
    const video = videosById.get(id);
    const matchesCompetition = video
      ? [...competitionPrefixes].some((prefix) => video.name.startsWith(prefix))
      : false;
    const matchesContestantName = video
      ? video.name === contestantName || video.name.startsWith(`${contestantName} —`)
      : false;
    if (matchesCompetition || matchesContestantName || hasSingleEntry) ids.add(id);
  }
  return ids;
}

async function getStageVideoUrisByEntry(
  competitionIds: number[],
): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();
  const uniqueCompetitionIds = [...new Set(competitionIds)];
  const submissionsByCompetition = await Promise.all(
    uniqueCompetitionIds.map((competitionId) =>
      firestoreStageSubmissions.getByCompetition(competitionId),
    ),
  );

  for (const submissions of submissionsByCompetition) {
    for (const submission of submissions) {
      if (submission.mediaType !== "video" || !submission.mediaUrl) continue;
      const key = `${submission.competitionId}:${submission.contestantId}`;
      const existing = grouped.get(key) || [];
      existing.push(submission.mediaUrl);
      grouped.set(key, existing);
    }
  }
  return grouped;
}

function emptyResponse(role: "host" | "talent"): OwnerAnalyticsResponse {
  return {
    role,
    visitorPeriod: "Last 30 days",
    playPeriod: "Lifetime",
    summary: {
      websiteVisitors: 0,
      uniquePlays: 0,
      competitionCount: 0,
      entryCount: 0,
    },
    competitions: [],
  };
}

export async function getOwnerAnalytics(
  uid: string,
  role: "host" | "talent",
): Promise<OwnerAnalyticsResponse> {
  const entries: EntryForAnalytics[] = [];
  let competitions: CompetitionForAnalytics[] = [];

  if (role === "host") {
    const hostCompetitions = await storage.getCompetitionsByCreator(uid);
    competitions = hostCompetitions;
    const contestantsByCompetition = await Promise.all(
      hostCompetitions.map(async (competition) => ({
        competition,
        contestants: await storage.getContestantsByCompetition(competition.id),
      })),
    );

    for (const { competition, contestants } of contestantsByCompetition) {
      for (const contestant of contestants) {
        if (contestant.applicationStatus !== "approved" || !contestant.talentProfile) continue;
        const talentProfile = contestant.talentProfile as ProfileForAnalytics;
        entries.push({
          competition,
          contestantId: contestant.id,
          talentProfile,
          pagePath: getEntryPath(competition, talentProfile),
          stageVideoUris: [],
        });
      }
    }
  } else {
    const profile = await storage.getTalentProfileByUserId(uid);
    if (!profile) return emptyResponse(role);

    const contestantEntries = await storage.getContestantsByTalent(profile.id);
    const approvedEntries = contestantEntries.filter((entry) => entry.applicationStatus === "approved");
    const competitionIds = [...new Set(approvedEntries.map((entry) => entry.competitionId))];
    const competitionsById = new Map<number, CompetitionForAnalytics>();
    await Promise.all(competitionIds.map(async (competitionId) => {
      const competition = await storage.getCompetition(competitionId);
      if (competition) competitionsById.set(competitionId, competition);
    }));
    competitions = [...competitionsById.values()];

    for (const contestant of approvedEntries) {
      const competition = competitionsById.get(contestant.competitionId);
      if (!competition) continue;
      entries.push({
        competition,
        contestantId: contestant.id,
        talentProfile: profile as ProfileForAnalytics,
        pagePath: getEntryPath(competition, profile as ProfileForAnalytics),
        stageVideoUris: [],
      });
    }
  }

  const stageVideoUrisByEntry = await getStageVideoUrisByEntry(
    entries.map((entry) => entry.competition.id),
  );
  for (const entry of entries) {
    entry.stageVideoUris = stageVideoUrisByEntry.get(
      `${entry.competition.id}:${entry.contestantId}`,
    ) || [];
  }

  const competitionPaths = competitions.map((competition) => {
    const categorySlug = slugify(competition.category || "competition") || "competition";
    const competitionSlug = slugify(competition.title || "competition") || "competition";
    return `/thequest/${categorySlug}/${competitionSlug}`;
  });
  const entryPaths = entries.map((entry) => entry.pagePath);
  const visitorPaths = role === "host" ? [...competitionPaths, ...entryPaths] : entryPaths;
  const visitorReport = await getPageVisitorsForPaths(visitorPaths);

  const candidateVideoIds = new Set<string>();
  for (const entry of entries) {
    for (const id of videoIdsForUris([
      ...getProfileVideoUris(entry.talentProfile),
      ...entry.stageVideoUris,
    ])) candidateVideoIds.add(id);
  }

  const videoStats = await getVimeoVideoAnalyticsByUris(
    [...candidateVideoIds].map((id) => `/videos/${id}`),
  );
  const videosById = new Map(videoStats.videos.map((video) => [video.id, video]));
  const entriesPerTalentProfile = new Map<number, number>();
  for (const entry of entries) {
    entriesPerTalentProfile.set(
      entry.talentProfile.id,
      (entriesPerTalentProfile.get(entry.talentProfile.id) || 0) + 1,
    );
  }

  const allVideoIds = new Set<string>();
  const videoIdsByEntry = new Map<string, Set<string>>();
  const videoIdsByCompetition = new Map<number, Set<string>>();
  for (const entry of entries) {
    const key = `${entry.competition.id}:${entry.contestantId}`;
    const ids = videoIdsForEntry(entry, videosById, entriesPerTalentProfile, role === "talent");
    videoIdsByEntry.set(key, ids);
    const competitionIds = videoIdsByCompetition.get(entry.competition.id) || new Set<string>();
    for (const id of ids) {
      allVideoIds.add(id);
      competitionIds.add(id);
    }
    videoIdsByCompetition.set(entry.competition.id, competitionIds);
  }

  const analyticsEntriesByCompetition = new Map<number, OwnerAnalyticsEntry[]>();
  for (const entry of entries) {
    const key = `${entry.competition.id}:${entry.contestantId}`;
    const entryVideoIds = videoIdsByEntry.get(key) || new Set<string>();
    const analyticsEntry: OwnerAnalyticsEntry = {
      contestantId: entry.contestantId,
      talentProfileId: entry.talentProfile.id,
      displayName: entry.talentProfile.stageName || entry.talentProfile.displayName,
      pagePath: entry.pagePath,
      websiteVisitors: visitorReport.byPath[entry.pagePath] || 0,
      uniquePlays: playsForIds(entryVideoIds, videosById),
    };
    const competitionEntries = analyticsEntriesByCompetition.get(entry.competition.id) || [];
    competitionEntries.push(analyticsEntry);
    analyticsEntriesByCompetition.set(entry.competition.id, competitionEntries);
  }

  const analyticsCompetitions: OwnerAnalyticsCompetition[] = competitions
    .map((competition) => {
      const categorySlug = slugify(competition.category || "competition") || "competition";
      const competitionSlug = slugify(competition.title || "competition") || "competition";
      const pagePath = `/thequest/${categorySlug}/${competitionSlug}`;
      const entriesForCompetition = analyticsEntriesByCompetition.get(competition.id) || [];
      return {
        competitionId: competition.id,
        title: competition.title,
        category: competition.category,
        pagePath,
        websiteVisitors: role === "host"
          ? visitorReport.byPath[pagePath] || 0
          : entriesForCompetition.reduce((total, entry) => total + entry.websiteVisitors, 0),
        uniquePlays: playsForIds(
          videoIdsByCompetition.get(competition.id) || new Set<string>(),
          videosById,
        ),
        entries: entriesForCompetition,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    role,
    visitorPeriod: "Last 30 days",
    playPeriod: "Lifetime",
    summary: {
      websiteVisitors: visitorReport.websiteVisitors,
      uniquePlays: playsForIds(allVideoIds, videosById),
      competitionCount: competitions.length,
      entryCount: entries.length,
    },
    competitions: analyticsCompetitions,
  };
}