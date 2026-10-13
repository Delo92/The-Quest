import { firestoreInvitations, type FirestoreInvitation } from "./firestore-collections";
import { storage } from "./storage";
import { isEmailConfigured, sendInviteEmail } from "./email";

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SCAN_INTERVAL_MS = 30 * 60 * 1000;

function centralHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
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
    if (running || centralHour(new Date()) < 9 || !isEmailConfigured()) return;
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

  void run();
  const timer = setInterval(() => void run(), SCAN_INTERVAL_MS);
  timer.unref();
}
