import {
  firestoreJoinSubmissions,
  type FirestoreCompetition,
} from "./firestore-collections";
import { getFirebaseAuth } from "./firebase-admin";
import {
  isEmailConfigured,
  sendHostDailyStatsEmail,
  sendHostSignupNotification,
  type HostCompetitionDailyStat,
} from "./email";
import { storage } from "./storage";

const TIMEZONE = "America/Chicago";
const SEND_HOUR = 9;
const DAY_MS = 24 * 60 * 60 * 1000;

function centralParts(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
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
  const partsAtGuess = centralParts(new Date(utcGuess));
  const representedUtc = Date.UTC(
    partsAtGuess.year,
    partsAtGuess.month - 1,
    partsAtGuess.day,
    partsAtGuess.hour,
    partsAtGuess.minute,
    partsAtGuess.second,
  );
  return utcGuess - (representedUtc - utcGuess);
}

export function nextHostStatsSendAt(now: Date): Date {
  const parts = centralParts(now);
  const todayAtNine = centralWallTimeToUtc(parts.year, parts.month, parts.day, SEND_HOUR);
  if (now.getTime() < todayAtNine) return new Date(todayAtNine);

  const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return new Date(centralWallTimeToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    SEND_HOUR,
  ));
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function occurredSince(value: string | null | undefined, since: number): boolean {
  const timestamp = parseTimestamp(value);
  return Number.isFinite(timestamp) && timestamp > since;
}

function activeCompetition(competition: FirestoreCompetition): boolean {
  return !["draft", "completed", "cancelled"].includes(String(competition.status).toLowerCase());
}

async function getHostContact(uid: string): Promise<{ email: string; name: string } | null> {
  let email = "";
  let name = "Host";
  try {
    const [authUser, profile] = await Promise.all([
      getFirebaseAuth().getUser(uid),
      storage.getTalentProfileByUserId(uid),
    ]);
    email = (authUser.email || profile?.email || "").trim();
    name = profile?.displayName?.trim() || profile?.stageName?.trim() || authUser.displayName?.trim() || name;
  } catch {
    try {
      const profile = await storage.getTalentProfileByUserId(uid);
      email = (profile?.email || "").trim();
      name = profile?.displayName?.trim() || profile?.stageName?.trim() || name;
    } catch {}
  }
  return email ? { email, name } : null;
}

export async function notifyHostOfCompetitionSignup(opts: {
  competition: FirestoreCompetition;
  contestantName: string;
  signupType: "application" | "nomination" | "invitation";
  siteUrl: string;
}): Promise<void> {
  const uid = opts.competition.createdBy;
  if (!uid || !opts.siteUrl || !await isEmailConfigured()) return;
  const contact = await getHostContact(uid);
  if (!contact) {
    console.warn("[HostNotifications] Signup alert skipped because the competition host has no email address.");
    return;
  }
  const sent = await sendHostSignupNotification({
    to: contact.email,
    hostName: contact.name,
    contestantName: opts.contestantName,
    competitionName: opts.competition.title,
    signupType: opts.signupType,
    siteUrl: opts.siteUrl,
  });
  if (!sent) console.warn("[HostNotifications] Signup alert was not accepted by the mail provider.");
}

function toDollars(amountCents: number): number {
  return Number.isFinite(amountCents) ? amountCents / 100 : 0;
}

async function buildCompetitionStat(
  competition: FirestoreCompetition,
  since: number,
  submissions: Awaited<ReturnType<typeof firestoreJoinSubmissions.getAll>>,
): Promise<HostCompetitionDailyStat> {
  const [contestants, purchases] = await Promise.all([
    storage.getContestantsByCompetition(competition.id),
    storage.getVotePurchasesByCompetition(competition.id),
  ]);
  const competitionSubmissions = submissions.filter((submission) =>
    Number(submission.competitionId) === competition.id,
  );
  const recentSubmissions = competitionSubmissions.filter((submission) =>
    occurredSince(submission.createdAt, since),
  );
  const nominationRevenue = competitionSubmissions.reduce(
    (sum, submission) => sum + (Number(submission.amountPaid) || 0),
    0,
  );
  const recentNominationRevenue = recentSubmissions.reduce(
    (sum, submission) => sum + (Number(submission.amountPaid) || 0),
    0,
  );
  const voteRevenue = purchases.reduce((sum, purchase) => sum + (Number(purchase.amount) || 0), 0);
  const recentVoteRevenue = purchases.reduce(
    (sum, purchase) => sum + (
      occurredSince(purchase.purchasedAt, since) ? Number(purchase.amount) || 0 : 0
    ),
    0,
  );
  const totalVotes = contestants.reduce((sum, contestant) => sum + (Number(contestant.voteCount) || 0), 0);
  const contestantCount = contestants.filter((contestant) =>
    ["approved", "pending"].includes(contestant.applicationStatus),
  ).length;

  return {
    competitionName: competition.title,
    contestantCount,
    totalVotes,
    totalRevenue: voteRevenue + toDollars(nominationRevenue),
    newSignups: recentSubmissions.length,
    revenueLast24Hours: recentVoteRevenue + toDollars(recentNominationRevenue),
  };
}

export async function sendDailyHostCompetitionStats(now = new Date()): Promise<void> {
  if (!await isEmailConfigured()) return;
  const siteUrl = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (!siteUrl) {
    console.error("[HostNotifications] SITE_URL is not configured; daily stats were skipped.");
    return;
  }
  const since = now.getTime() - DAY_MS;
  const [competitions, submissions] = await Promise.all([
    storage.getCompetitions(),
    firestoreJoinSubmissions.getAll(),
  ]);
  const byHost = new Map<string, FirestoreCompetition[]>();
  for (const competition of competitions) {
    if (!competition.createdBy || !activeCompetition(competition)) continue;
    const hosted = byHost.get(competition.createdBy) || [];
    hosted.push(competition);
    byHost.set(competition.createdBy, hosted);
  }
  const reportDate = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  await Promise.all([...byHost.entries()].map(async ([uid, hostedCompetitions]) => {
    try {
      const contact = await getHostContact(uid);
      if (!contact) {
        console.warn("[HostNotifications] Daily stats skipped because a competition host has no email address.");
        return;
      }
      const stats = await Promise.all(
        hostedCompetitions.map((competition) => buildCompetitionStat(competition, since, submissions)),
      );
      const sent = await sendHostDailyStatsEmail({
        to: contact.email,
        hostName: contact.name,
        stats,
        siteUrl,
        reportDate,
      });
      if (!sent) console.warn("[HostNotifications] Daily stats email was not accepted by the mail provider.");
    } catch (error) {
      console.error("[HostNotifications] Could not build or send a host daily report:", error);
    }
  }));
}

export function startHostCompetitionStatsJob(): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[HostNotifications] Daily host stats are disabled outside production.");
    return;
  }

  let running = false;
  const schedule = () => {
    const now = new Date();
    const delay = Math.max(0, nextHostStatsSendAt(now).getTime() - now.getTime());
    const timer = setTimeout(async () => {
      if (!running) {
        running = true;
        try {
          await sendDailyHostCompetitionStats();
        } catch (error) {
          console.error("[HostNotifications] Daily stats job failed:", error);
        } finally {
          running = false;
        }
      }
      schedule();
    }, delay);
    timer.unref();
  };
  schedule();
}
