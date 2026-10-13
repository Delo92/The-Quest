import {
  firestoreArtistProfileReminders,
  firestoreInvitations,
  firestoreJoinSubmissions,
  type FirestoreInvitation,
  type FirestoreTalentProfile,
} from "./firestore-collections";
import { getAllFirestoreUsers } from "./firebase-admin";
import { storage } from "./storage";
import { isEmailConfigured, sendInviteEmail } from "./email";

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REMINDER_TIMEZONE = "America/Chicago";
const DAILY_SCAN_HOUR = 9;

function getCentralParts(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: REMINDER_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function centralWallTimeToUtc(year: number, month: number, day: number, hour: number): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour);
  const localPartsAtGuess = getCentralParts(new Date(utcGuess));
  const representedUtc = Date.UTC(
    localPartsAtGuess.year,
    localPartsAtGuess.month - 1,
    localPartsAtGuess.day,
    localPartsAtGuess.hour,
    localPartsAtGuess.minute,
    localPartsAtGuess.second,
  );
  const timezoneOffset = representedUtc - utcGuess;
  return utcGuess - timezoneOffset;
}

function nextDailyScanAt(now: Date): Date {
  const centralNow = getCentralParts(now);
  const todayAtNine = centralWallTimeToUtc(
    centralNow.year,
    centralNow.month,
    centralNow.day,
    DAILY_SCAN_HOUR,
  );
  if (now.getTime() <= todayAtNine) return new Date(todayAtNine);

  const tomorrow = new Date(Date.UTC(centralNow.year, centralNow.month - 1, centralNow.day + 1));
  return new Date(centralWallTimeToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    DAILY_SCAN_HOUR,
  ));
}

function hasPhoto(profile: FirestoreTalentProfile | null): boolean {
  return Boolean(profile?.imageUrls?.some((url) => typeof url === "string" && url.trim()));
}

function hasVideo(profile: FirestoreTalentProfile | null, competitionId?: number | null): boolean {
  if (!profile) return false;
  const hasProfileVideo = profile.videoUrls?.some((url) => typeof url === "string" && url.trim());
  const hasCompetitionVideo = competitionId
    ? Boolean(profile.competitionVideoUris?.[String(competitionId)]?.trim())
    : Object.values(profile.competitionVideoUris || {}).some((url) => typeof url === "string" && url.trim());
  return Boolean(hasProfileVideo || hasCompetitionVideo);
}

function profileIsComplete(profile: FirestoreTalentProfile | null, competitionId?: number | null): boolean {
  return hasPhoto(profile) && hasVideo(profile, competitionId);
}

function normalizeEmail(email: string | null | undefined): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function groupInvitationsByEmail(invitations: FirestoreInvitation[]): Map<string, FirestoreInvitation[]> {
  const groups = new Map<string, FirestoreInvitation[]>();
  for (const invitation of invitations) {
    const email = normalizeEmail(invitation.invitedEmail);
    if (!email || invitation.targetLevel !== 2 || invitation.status === "expired") continue;
    const group = groups.get(email) || [];
    group.push(invitation);
    groups.set(email, group);
  }
  return groups;
}

export function startArtistProfileReminderJob(): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[artist-profile-reminders] Daily reminders are disabled outside production.");
    return;
  }

  let running = false;

  const run = async () => {
    if (running || !isEmailConfigured()) return;
    running = true;
    try {
      const siteUrl = process.env.SITE_URL?.trim().replace(/\/+$/, "");
      if (!siteUrl) {
        console.error("[artist-profile-reminders] SITE_URL is not configured; skipping sends.");
        return;
      }

      const [invitations, submissions, profiles, users, competitions] = await Promise.all([
        firestoreInvitations.getAll(),
        firestoreJoinSubmissions.getAll(),
        storage.getAllTalentProfiles(),
        getAllFirestoreUsers(),
        storage.getCompetitions(),
      ]);
      const usersById = new Map(users.map((user) => [user.uid, user]));
      const competitionsById = new Map(competitions.map((competition) => [competition.id, competition]));
      const invitationsByEmail = groupInvitationsByEmail(invitations);
      const profilesByEmail = new Map<string, FirestoreTalentProfile>();

      for (const profile of profiles) {
        if (profile.role?.toLowerCase() !== "talent") continue;
        const email = normalizeEmail(profile.email || usersById.get(profile.userId)?.email);
        if (!email) continue;
        const current = profilesByEmail.get(email);
        if (!current || profileIsComplete(profile) || !profileIsComplete(current)) {
          profilesByEmail.set(email, profile);
        }
      }

      const nominationByEmail = new Map<string, typeof submissions>();
      for (const submission of submissions) {
        if (submission.type !== "nomination" || submission.nominationStatus === "not_interested") continue;
        const email = normalizeEmail(submission.email);
        if (!email) continue;
        const group = nominationByEmail.get(email) || [];
        group.push(submission);
        nominationByEmail.set(email, group);
      }

      const allEmails = new Set([
        ...invitationsByEmail.keys(),
        ...profilesByEmail.keys(),
        ...nominationByEmail.keys(),
      ]);
      const now = new Date();

      for (const email of allEmails) {
        const profile = profilesByEmail.get(email) || null;
        const emailInvitations = (invitationsByEmail.get(email) || []).sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
        const eligibleInvitations: FirestoreInvitation[] = [];

        for (const invitation of emailInvitations) {
          if (invitation.status === "accepted" && invitation.acceptedBy) {
            const acceptedProfile = profile?.userId === invitation.acceptedBy
              ? profile
              : profiles.find((item) => item.userId === invitation.acceptedBy) || null;
            if (profileIsComplete(acceptedProfile, invitation.competitionId)) {
              await firestoreInvitations.markRemindersCompleted(invitation.id, now.toISOString());
              continue;
            }
          }
          if (!invitation.remindersPausedAt && !invitation.remindersCompletedAt) {
            eligibleInvitations.push(invitation);
          }
        }

        const nomination = (nominationByEmail.get(email) || []).sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        )[0];
        const hasInvitationPath = emailInvitations.length > 0;
        const hasDirectSignupPath = Boolean(profile && !hasInvitationPath);
        const chosenInvitation = eligibleInvitations[0] || null;

        let name = profile?.stageName || profile?.displayName || nomination?.fullName || email.split("@")[0];
        let competitionId: number | null = null;
        let competitionName: string | undefined;
        let inviteToken: string | undefined;
        let inviterName = "The Quest team";
        let replyTo: string | undefined;
        let needsLogin = false;
        let profilePathEligible = false;

        if (chosenInvitation) {
          const competition = chosenInvitation.competitionId
            ? competitionsById.get(chosenInvitation.competitionId)
            : null;
          name = chosenInvitation.invitedName || name;
          competitionId = chosenInvitation.competitionId ?? null;
          competitionName = competition?.title || chosenInvitation.suggestedEventName || undefined;
          inviteToken = chosenInvitation.token;
          inviterName = chosenInvitation.invitedByName || inviterName;
          replyTo = chosenInvitation.invitedByEmail || undefined;
          needsLogin = chosenInvitation.status !== "accepted" || !chosenInvitation.acceptedBy;
        } else if (nomination) {
          const competition = nomination.competitionId
            ? competitionsById.get(nomination.competitionId)
            : null;
          name = nomination.fullName || name;
          competitionId = nomination.competitionId;
          competitionName = competition?.title;
          profilePathEligible = true;
        } else if (hasDirectSignupPath) {
          profilePathEligible = true;
        }

        if (!chosenInvitation && !profilePathEligible) continue;
        if (chosenInvitation && chosenInvitation.status === "accepted" && !chosenInvitation.acceptedBy) {
          needsLogin = true;
        }

        const hasProfilePhoto = hasPhoto(profile);
        const hasProfileVideo = hasVideo(profile, competitionId);
        if (chosenInvitation && chosenInvitation.status === "accepted" && profileIsComplete(profile, competitionId)) {
          await firestoreInvitations.markRemindersCompleted(chosenInvitation.id, now.toISOString());
          continue;
        }
        if (!chosenInvitation && profileIsComplete(profile, competitionId)) continue;

        const reminderState = await firestoreArtistProfileReminders.getOrCreate(email);
        if (reminderState.stoppedAt) continue;
        const attemptedAt = new Date().toISOString();
        const claimed = await firestoreArtistProfileReminders.claimDaily(
          email,
          attemptedAt,
          DAILY_INTERVAL_MS,
        );
        if (!claimed) continue;

        const sent = await sendInviteEmail({
          to: email,
          inviterName,
          ...(inviteToken ? { inviteToken } : {}),
          role: "talent",
          siteUrl,
          nomineeName: name,
          competitionName,
          replyTo,
          isReminder: true,
          needsLogin,
          needsAccountSetup: !profile && !inviteToken,
          needsProfilePhoto: !hasProfilePhoto,
          needsVideo: !hasProfileVideo,
          reminderStopUrl: `${siteUrl}/api/artist-profile-reminders/stop?token=${encodeURIComponent(reminderState.stopToken)}`,
        });

        await firestoreArtistProfileReminders.recordResult(email, new Date().toISOString(), sent);
        if (chosenInvitation) {
          await firestoreInvitations.recordReminderResult(chosenInvitation.id, new Date().toISOString(), sent);
        }
      }
    } catch (error) {
      console.error("[artist-profile-reminders] Daily reminder scan failed:", error);
    } finally {
      running = false;
    }
  };

  const scheduleNextScan = () => {
    const now = new Date();
    const nextScan = nextDailyScanAt(now);
    const delay = Math.max(0, nextScan.getTime() - now.getTime());
    const timer = setTimeout(async () => {
      await run();
      scheduleNextScan();
    }, delay);
    timer.unref();
  };

  scheduleNextScan();
}
