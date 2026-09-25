export const MARKETING_GUIDELINES_ACKNOWLEDGMENT_VERSION = "marketing-guidelines-v1";
export const VOTED_ARTIST_REMINDER_ACKNOWLEDGMENT_VERSION = "voted-artist-reminders-v1";
export const WEEKLY_CONSENT_TIME_ZONE = "America/Chicago";

export const MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT =
  "I understand that following the marketing guidelines is crucial to the platform and my success. Lack of participation may result in disqualification or forfeit of earnings/winnings.";

export const VOTED_ARTIST_REMINDER_ACKNOWLEDGMENT_TEXT =
  "By using CB Publishing The Quest, you agree to be reminded about your voted artists and their competition info.";

export type WeeklyConsentRole = "contestant" | "host";

export interface WeeklyConsentStatus {
  required: boolean;
  accepted: boolean;
  weekStart: string;
  version: string;
  role: WeeklyConsentRole | null;
  acceptedAt: string | null;
}