import { firestoreInvitations, type FirestoreInvitation } from "./firestore-collections";
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

function hasProfilePhotoAndVideo(
  profile: { imageUrls?: string[] | null; videoUrls?: string[] | null; competitionVideoUris?: Record<string, string> | null } | null,
  competitionId: number,
): boolean {
  if (!profile) return false;
  const hasPhoto = Array.isArray(profile.imageUrls) && profile.imageUrls.some((url) => typeof url === "string" && url.trim());
  const hasProfileVideo = Array.isArray(profile.videoUrls) && profile.videoUrls.some((url) => typeof url === "string" && url.trim());
  const hasCompetitionVideo = Boolean(profile.competitionVideoUris?.[String(competitionId)]?.trim());
  return hasPhoto && (hasProfileVideo || hasCompetitionVideo);
}

function groupByInvitee(invitations: FirestoreInvitation[]): Map<string, FirestoreInvitation[]> {
  const groups = new Map<string, FirestoreInvitation[]>();
  for (const invitation of invitations) {
    const key = invitation.invitedEmail.trim().toLowerCase();
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(invitation);
    groups.set(key, group);
  }
  return groups;
}

export function startRaplahomaInvitationReminderJob(): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[invitation-reminders] Daily reminders are disabled outside production.");
    return;
  }

  let running = false;

  const run = async () => {
    if (running || !isEmailConfigured()) return;
    running = true;

    try {
      const siteUrl = process.env.SITE_URL?.trim().replace(/\/+$/, "");
      if (!siteUrl) {
        console.error("[invitation-reminders] SITE_URL is not configured; skipping reminder sends.");
        return;
      }

      const competition = (await storage.getCompetitions())
        .find((item) => item.title.trim().toLowerCase() === "raplahoma");
      if (!competition) {
        console.error("[invitation-reminders] Raplahoma competition was not found.");
        return;
      }

      const now = new Date();
      const invitations = await firestoreInvitations.getByCompetition(competition.id);
      const groups = groupByInvitee(
        invitations.filter((invitation) => invitation.targetLevel === 2 && invitation.status !== "expired"),
      );

      for (const group of groups.values()) {
        const activeInvitations = group.sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
        if (!activeInvitations.length || activeInvitations.some((item) => item.remindersPausedAt)) continue;

        const acceptedInvitations = activeInvitations.filter(
          (item) => item.status === "accepted" && Boolean(item.acceptedBy),
        );
        const invitation = acceptedInvitations[0] || activeInvitations[0];
        if (invitation.remindersCompletedAt) continue;

        const profile = invitation.acceptedBy
          ? await storage.getTalentProfileByUserId(invitation.acceptedBy)
          : null;
        const hasPhoto = Array.isArray(profile?.imageUrls) && profile.imageUrls.some((url) => typeof url === "string" && url.trim());
        const hasVideo = Boolean(
          (Array.isArray(profile?.videoUrls) && profile.videoUrls.some((url) => typeof url === "string" && url.trim())) ||
          profile?.competitionVideoUris?.[String(competition.id)]?.trim(),
        );

        if (invitation.status === "accepted" && hasProfilePhotoAndVideo(profile, competition.id)) {
          await Promise.all(activeInvitations.map((item) =>
            firestoreInvitations.markRemindersCompleted(item.id, now.toISOString()),
          ));
          continue;
        }

        const canSend = await firestoreInvitations.claimDailyReminder(
          invitation.id,
          now.toISOString(),
          DAILY_INTERVAL_MS,
        );
        if (!canSend) continue;

        const needsLogin = invitation.status !== "accepted";
        const sent = await sendInviteEmail({
          to: invitation.invitedEmail,
          inviterName: invitation.invitedByName,
          inviteToken: invitation.token,
          role: "talent",
          siteUrl,
          nomineeName: invitation.invitedName,
          nominatorName: invitation.invitedByName,
          competitionName: competition.title,
          replyTo: invitation.invitedByEmail,
          isReminder: true,
          needsLogin,
          needsProfilePhoto: !hasPhoto,
          needsVideo: !hasVideo,
        });

        await firestoreInvitations.recordReminderResult(invitation.id, new Date().toISOString(), sent);
      }
    } catch (error) {
      console.error("[invitation-reminders] Daily reminder scan failed:", error);
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
