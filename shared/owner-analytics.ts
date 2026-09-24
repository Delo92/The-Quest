export interface OwnerAnalyticsEntry {
  contestantId: number;
  talentProfileId: number;
  displayName: string;
  pagePath: string;
  websiteVisitors: number;
  uniquePlays: number;
}

export interface OwnerAnalyticsCompetition {
  competitionId: number;
  title: string;
  category: string;
  pagePath: string;
  websiteVisitors: number;
  uniquePlays: number;
  entries: OwnerAnalyticsEntry[];
}

export interface OwnerAnalyticsResponse {
  role: "host" | "talent";
  visitorPeriod: "Last 30 days";
  playPeriod: "Lifetime";
  summary: {
    websiteVisitors: number;
    uniquePlays: number;
    competitionCount: number;
    entryCount: number;
  };
  competitions: OwnerAnalyticsCompetition[];
}