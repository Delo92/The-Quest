import { createHash, randomBytes } from "node:crypto";
import { buildOCReferralUrl } from "../shared/oc-referral";
import {
  benefitMessages, evaluateOCEventBenefit, OC_EVENT_OFFER,
  type OCBenefitEvent, type OCBenefitEntry, type OCEventRole,
} from "../shared/oc-event-benefit";

export class OCReferralError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export interface OCReferralRecord {
  uid: string;
  role: OCEventRole;
  competitionId: number;
  contestantId: number | null;
  profileId: number | null;
  createdAt: string;
  handoffExpiresAt: string;
  ocAccountId: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface OCReferralClaim {
  competitionId: number;
  role: OCEventRole;
  contestantId: number | null;
  profileId: number | null;
  ocAccountId: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
}

export interface OCReferralStore {
  create(key: string, value: OCReferralRecord): Promise<void>;
  get(key: string): Promise<OCReferralRecord | null>;
  getClaim(uid: string): Promise<OCReferralClaim | null>;
  activate(key: string, value: OCReferralRecord, ocAccountId: string, at: string): Promise<void>;
  revoke(key: string, value: OCReferralRecord, reason: string, at: string): Promise<void>;
}

export interface OCReferralDependencies {
  store: OCReferralStore;
  getUser(uid: string): Promise<{ level: number; email: string; displayName: string; stageName?: string; socialLinks?: unknown } | null>;
  getProfile(uid: string): Promise<{ id: number; displayName: string; stageName: string | null; socialLinks: unknown } | null>;
  getEvent(id: number): Promise<OCBenefitEvent | null>;
  getHostedEvents(uid: string): Promise<OCBenefitEvent[]>;
  getEntries(profileId: number): Promise<OCBenefitEntry[]>;
  getEntry(eventId: number, profileId: number): Promise<OCBenefitEntry | null>;
  now?: () => number;
}

export const hashReferralValue = (value: string) => createHash("sha256").update(value).digest("hex");

export function sameOCReferralEvent(claim: OCReferralClaim, record: Pick<OCReferralRecord, "competitionId" | "role" | "contestantId" | "profileId">): boolean {
  return claim.competitionId === record.competitionId && claim.role === record.role
    && claim.contestantId === record.contestantId && claim.profileId === record.profileId;
}

export function createOCReferralService(deps: OCReferralDependencies) {
  const now = deps.now ?? Date.now;
  const getContext = async (uid: string, role: OCEventRole, competitionId: number, original?: OCReferralRecord) => {
    const [user, profile, event] = await Promise.all([
      deps.getUser(uid), deps.getProfile(uid), deps.getEvent(competitionId),
    ]);
    const entry = role === "artist" && profile ? await deps.getEntry(competitionId, profile.id) : null;
    const decision = evaluateOCEventBenefit({
      uid, role, accountLevel: user?.level ?? null, event, entry,
      profileId: profile?.id ?? null, originalEntryId: original?.contestantId,
      originalProfileId: original?.profileId, now: now(),
    });
    return { user, profile, event, entry, ...decision };
  };
  const eventSummary = (event: OCBenefitEvent, entry: OCBenefitEntry | null) => ({
    competitionId: event.id, title: event.title, category: event.category, status: event.status,
    startDate: event.startDate, endDate: event.endDateTbd ? null : event.endDate,
    contestantId: entry?.id ?? null,
  });
  const getRole = (level: number | undefined): OCEventRole => {
    if (level === 3) return "host";
    if (level === 2) return "artist";
    throw new OCReferralError(403, "role_not_eligible", "This offer is for Quest hosts and contestants.");
  };

  return {
    async listEvents(uid: string) {
      const [user, profile, claim] = await Promise.all([
        deps.getUser(uid), deps.getProfile(uid), deps.store.getClaim(uid),
      ]);
      const role = getRole(user?.level);
      const entries = role === "artist" && profile ? await deps.getEntries(profile.id) : [];
      const events = role === "host" ? await deps.getHostedEvents(uid)
        : (await Promise.all(entries.map((entry) => deps.getEvent(entry.competitionId))))
          .filter((event): event is OCBenefitEvent => event !== null);
      return {
        role, claimedCompetitionId: claim?.competitionId ?? null,
        events: events.map((event) => {
          const entry = entries.find((value) => value.competitionId === event.id) ?? null;
          const decision = evaluateOCEventBenefit({
            uid, role, event, entry, accountLevel: user?.level ?? null,
            profileId: profile?.id ?? null, now: now(),
          });
          const candidate = { competitionId: event.id, role, contestantId: entry?.id ?? null, profileId: role === "artist" ? profile?.id ?? null : null };
          const reason = claim?.revokedAt ? claim.revocationReason || "offer_already_assigned"
            : claim && !sameOCReferralEvent(claim, candidate) ? "offer_already_assigned" : decision.reason;
          return { ...eventSummary(event, entry), eligible: reason === "eligible", reason, message: benefitMessages[reason] || reason };
        }),
      };
    },

    async start(uid: string, competitionId: number) {
      const role = getRole((await deps.getUser(uid))?.level);
      const context = await getContext(uid, role, competitionId);
      if (!context.eligible || !context.event || !context.user) {
        throw new OCReferralError(403, context.reason, benefitMessages[context.reason] || "This event is not eligible.");
      }
      if (!context.user.email?.trim()) throw new OCReferralError(409, "email_required", "Save your Quest account email before continuing.");
      const at = new Date(now()).toISOString();
      const record: OCReferralRecord = {
        uid, role, competitionId, contestantId: context.entry?.id ?? null,
        profileId: role === "artist" ? context.profile?.id ?? null : null,
        createdAt: at, handoffExpiresAt: new Date(now() + 24 * 60 * 60 * 1000).toISOString(),
        ocAccountId: null, claimedAt: null, revokedAt: null, revocationReason: null,
      };
      const claim = await deps.store.getClaim(uid);
      if (claim && (claim.revokedAt || !sameOCReferralEvent(claim, record))) {
        throw new OCReferralError(409, "offer_already_assigned", benefitMessages.offer_already_assigned);
      }
      const referralId = randomBytes(32).toString("base64url");
      await deps.store.create(hashReferralValue(referralId), record);
      const event = eventSummary(context.event, context.entry);
      return {
        referralUrl: buildOCReferralUrl({
          role, email: context.user.email,
          displayName: context.profile?.displayName || context.user.displayName,
          stageName: context.profile?.stageName || context.user.stageName,
          socialLinks: context.profile?.socialLinks || context.user.socialLinks,
          event, referralId,
        }),
        event,
      };
    },

    async verify(referralId: string, ocAccountId: string, verifiedEmail: string) {
      const key = hashReferralValue(referralId);
      const record = await deps.store.get(key);
      if (!record) throw new OCReferralError(404, "referral_not_found", "The Quest referral does not exist.");
      if (record.ocAccountId && record.ocAccountId !== ocAccountId) {
        throw new OCReferralError(403, "account_mismatch", "This referral belongs to another OC account.");
      }
      const context = await getContext(record.uid, record.role, record.competitionId, record);
      if (!record.ocAccountId && (!context.user?.email
        || context.user.email.trim().toLowerCase() !== verifiedEmail.trim().toLowerCase())) {
        throw new OCReferralError(403, "email_mismatch", "The OC account's verified email must match the Quest account.");
      }
      const at = new Date(now()).toISOString();
      const claim = await deps.store.getClaim(record.uid);
      if (claim && (claim.ocAccountId !== ocAccountId || !sameOCReferralEvent(claim, record))) {
        throw new OCReferralError(409, "offer_already_assigned", benefitMessages.offer_already_assigned);
      }
      let reason = record.revocationReason || claim?.revocationReason || context.reason;
      if (!record.claimedAt && Date.parse(record.handoffExpiresAt) <= now()) reason = "handoff_expired";
      let revokedAt = record.revokedAt || claim?.revokedAt || null;
      if (reason !== "eligible") {
        revokedAt ||= at;
        await deps.store.revoke(key, record, reason, revokedAt);
      } else {
        await deps.store.activate(key, record, ocAccountId, at);
      }
      return {
        eligible: reason === "eligible", reason, referralId, role: record.role,
        questUserId: record.uid, ocAccountId,
        offer: OC_EVENT_OFFER, checkedAt: at,
        expiresAt: reason === "eligible" ? context.expiresAt : null, revokedAt,
        event: context.event ? eventSummary(context.event, context.entry) : null,
        profile: {
          email: context.user?.email ?? null,
          displayName: context.profile?.displayName || context.user?.displayName || null,
          stageName: context.profile?.stageName || context.user?.stageName || null,
        },
      };
    },
  };
}
