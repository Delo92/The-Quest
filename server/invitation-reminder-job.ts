import {
  firestoreArtistProfileReminders,
  firestoreContestants,
  firestoreInvitations,
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
  const competitionVideos = Object.values(profile.competitionVideoUris || {}).filter(
    (url) => typeof url === "string" && url.trim(),
  );
  if (competitionId) {
    const competitionVideo = profile.competitionVideoUris?.[String(competitionId)];
    if (typeof competitionVideo === "string" && competitionVideo.trim()) return true;
    // Older profiles may only have unscoped videos. Once any competition-scoped
    // videos exist, don't let one competition's video satisfy every entry.
    return competitionVideos.length === 0
      && Boolean(profile.videoUrls?.some((url) => typeof url === "string" && url.trim()));
  }
  return Boolean(
    profile.videoUrls?.some((url) => typeof url === "string" && url.trim())
    || competitionVideos.length,
  );
}

function profileIsComplete(profile: FirestoreTalentProfile | null, competitionId?: number | null): boolean {
  return hasPhoto(profile) && hasVideo(profile, competitionId);
}

function normalizeEmail(email: string | null | undefined): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

interface ReminderTask {
  stateKey: string;
  email: string;
  profile: FirestoreTalentProfile | null;
  competitionId: number | null;
  competitionName?: string;
  name: string;
  invitation?: FirestoreInvitation;
  inviterName: string;
  replyTo?: string;
  needsLogin: boolean;
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

      const [invitations, profiles, users, contestants, competitions] = await Promise.all([
        firestoreInvitations.getAll(),
        storage.getAllTalentProfiles(),
        getAllFirestoreUsers(),
        firestoreContestants.getAll(),
        storage.getCompetitions(),
      ]);
      const usersById = new Map(users.map((user) => [user.uid, user]));
      const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
      const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
      const competitionsById = new Map(competitions.map((competition) => [competition.id, competition]));
      const tasksByStateKey = new Map<string, ReminderTask>();
      const activeProfileIds = new Set<number>();
      const pendingInviteEmails = new Set<string>();
      const now = new Date();

      for (const contestant of contestants) {
        if (contestant.applicationStatus !== "approved" && contestant.applicationStatus !== "pending") continue;
        const profile = profilesById.get(contestant.talentProfileId);
        if (!profile || profile.role?.toLowerCase() !== "talent") continue;
        activeProfileIds.add(profile.id);
        const email = (profile.email || usersById.get(profile.userId)?.email || "").trim();
        if (!email) continue;

        const competition = competitionsById.get(contestant.competitionId);
        const competitionName = competition?.title;
        const stateKey = `profile:${profile.userId}:competition:${contestant.competitionId}`;
        if (profileIsComplete(profile, contestant.competitionId)) continue;

        tasksByStateKey.set(stateKey, {
          stateKey,
          email,
          profile,
          competitionId: contestant.competitionId,
          competitionName,
          name: profile.stageName || profile.displayName || email.split("@")[0],
          inviterName: "The Quest team",
          needsLogin: false,
        });
      }

      for (const invitation of invitations) {
        if (invitation.targetLevel !== 2 || invitation.status === "expired") continue;
        if (invitation.status === "accepted" && invitation.acceptedBy) {
          const profile = profilesByUserId.get(invitation.acceptedBy) || null;
          if (profile && profileIsComplete(profile, invitation.competitionId)) {
            await firestoreInvitations.markRemindersCompleted(invitation.id, now.toISOString());
            continue;
          }
          if (invitation.remindersCompletedAt || !profile) continue;
          const email = (profile.email || usersById.get(profile.userId)?.email || "").trim();
          if (!email) continue;
          const stateKey = `profile:${profile.userId}:competition:${invitation.competitionId ?? "profile"}`;
          const competition = invitation.competitionId
            ? competitionsById.get(invitation.competitionId)
            : null;
          const existingTask = tasksByStateKey.get(stateKey);
          if (existingTask) {
            existingTask.invitation ||= invitation;
          } else if (!invitation.remindersPausedAt) {
            tasksByStateKey.set(stateKey, {
              stateKey,
              email,
              profile,
              competitionId: invitation.competitionId ?? null,
              competitionName: competition?.title || invitation.suggestedEventName || undefined,
              name: profile.stageName || profile.displayName || invitation.invitedName || email.split("@")[0],
              invitation,
              inviterName: invitation.invitedByName || "The Quest team",
              replyTo: invitation.invitedByEmail || undefined,
              needsLogin: false,
            });
          }
          continue;
        }

        if (invitation.remindersPausedAt || invitation.remindersCompletedAt) continue;
        const email = invitation.invitedEmail.trim();
        if (!email) continue;
        pendingInviteEmails.add(normalizeEmail(email));
        const competition = invitation.competitionId
          ? competitionsById.get(invitation.competitionId)
          : null;
        const stateKey = `invitation:${invitation.id}`;
        tasksByStateKey.set(stateKey, {
          stateKey,
          email,
          profile: null,
          competitionId: invitation.competitionId ?? null,
          competitionName: competition?.title || invitation.suggestedEventName || undefined,
          name: invitation.invitedName || email.split("@")[0],
          invitation,
          inviterName: invitation.invitedByName || "The Quest team",
          replyTo: invitation.invitedByEmail || undefined,
          needsLogin: true,
        });
      }

      // Keep the existing reminder behavior for talent accounts that have not
      // joined a competition yet, without sending a second generic email to
      // profiles that already have active competition entries.
      for (const profile of profiles) {
        if (profile.role?.toLowerCase() !== "talent" || activeProfileIds.has(profile.id)) continue;
        const email = (profile.email || usersById.get(profile.userId)?.email || "").trim();
        if (!email || pendingInviteEmails.has(normalizeEmail(email)) || profileIsComplete(profile)) continue;
        const stateKey = `profile:${profile.userId}:profile`;
        tasksByStateKey.set(stateKey, {
          stateKey,
          email,
          profile,
          competitionId: null,
          name: profile.stageName || profile.displayName || email.split("@")[0],
          inviterName: "The Quest team",
          needsLogin: false,
        });
      }

      for (const task of tasksByStateKey.values()) {
        const reminderState = await firestoreArtistProfileReminders.getOrCreate(task.email, task.stateKey);
        if (reminderState.stoppedAt) continue;
        const attemptedAt = new Date().toISOString();
        const claimed = await firestoreArtistProfileReminders.claimDaily(
          task.email,
          task.stateKey,
          attemptedAt,
          DAILY_INTERVAL_MS,
        );
        if (!claimed) continue;

        const hasProfilePhoto = hasPhoto(task.profile);
        const hasProfileVideo = hasVideo(task.profile, task.competitionId);
        const sent = await sendInviteEmail({
          to: task.email,
          inviterName: task.inviterName,
          ...(task.invitation && task.needsLogin ? { inviteToken: task.invitation.token } : {}),
          role: "talent",
          siteUrl,
          nomineeName: task.name,
          competitionName: task.competitionName,
          replyTo: task.replyTo,
          isReminder: true,
          needsLogin: task.needsLogin,
          needsAccountSetup: false,
          needsProfilePhoto: !hasProfilePhoto,
          needsVideo: !hasProfileVideo,
          reminderStopUrl: `${siteUrl}/api/artist-profile-reminders/stop?token=${encodeURIComponent(reminderState.stopToken)}`,
        });

        await firestoreArtistProfileReminders.recordResult(task.stateKey, new Date().toISOString(), sent);
        if (task.invitation) {
          await firestoreInvitations.recordReminderResult(task.invitation.id, new Date().toISOString(), sent);
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
