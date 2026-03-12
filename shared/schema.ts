export interface Competition {
  id: number;
  title: string;
  description: string | null;
  category: string;
  coverImage: string | null;
  coverVideo: string | null;
  status: string;
  voteCost: number;
  maxVotesPerDay: number;
  maxImagesPerContestant: number | null;
  maxVideosPerContestant: number | null;
  startDate: string | null;
  endDate: string | null;
  startDateTbd: boolean;
  endDateTbd: boolean;
  votingStartDate: string | null;
  votingEndDate: string | null;
  expectedContestants: number | null;
  onlineVoteWeight: number;
  inPersonOnly: boolean;
  isFeatured?: boolean;
  createdAt: string | null;
  createdBy: string | null;
}

export interface TalentProfile {
  id: number;
  userId: string;
  displayName: string;
  stageName: string | null;
  email?: string | null;
  showEmail?: boolean;
  bio: string | null;
  category: string | null;
  location: string | null;
  imageUrls: string[];
  imageBackupUrls?: string[];
  videoUrls: string[];
  socialLinks: string | null;
  profileColor?: string | null;
  profileBgImage?: string | null;
  role: string;
}

export interface SiteLivery {
  imageKey: string;
  label: string;
  imageUrl: string | null;
  defaultUrl: string;
  mediaType?: "image" | "video";
  textContent?: string | null;
  defaultText?: string | null;
  itemType?: "media" | "text";
}
