import type { NextFunction, Request, Response } from "express";
import type { ParamsFlatDictionary } from "express-serve-static-core";
import { storage } from "./storage";
import { getFirestore } from "./firebase-admin";

export interface TalentManagerScope {
  isAdmin: boolean;
  /** Competitions the requester may manage. Always every competition for admins. */
  competitionIds: Set<number> | null;
  profile: NonNullable<Awaited<ReturnType<typeof storage.getTalentProfile>>>;
}

declare global {
  namespace Express {
    interface Request {
      talentScope?: TalentManagerScope;
    }
  }
}

/**
 * Resolves what the requester may do to a talent profile.
 * Admins: everything. Hosts: only contestants entered in competitions the host created,
 * and never other hosts/admins or themselves.
 */
export async function resolveTalentManagerScope(
  requester: { uid: string; level: number },
  profile: TalentManagerScope["profile"],
): Promise<TalentManagerScope | null> {
  if (requester.level >= 4) return { isAdmin: true, competitionIds: null, profile };
  if (requester.level < 3) return null;
  if (profile.userId === requester.uid) return null;
  if ((profile as any).role === "host" || (profile as any).role === "admin") return null;

  const [entries, competitions] = await Promise.all([
    storage.getContestantsByTalent(profile.id),
    storage.getCompetitions(),
  ]);
  const owned = new Set(
    competitions.filter((c: any) => c.createdBy === requester.uid).map((c) => c.id),
  );
  const shared = new Set(entries.map((e) => e.competitionId).filter((id) => owned.has(id)));
  if (shared.size === 0) return null;
  return { isAdmin: false, competitionIds: owned, profile };
}

async function authorize(req: Request<ParamsFlatDictionary>, res: Response, next: NextFunction, profile: any) {
  if (!profile) return res.status(404).json({ message: "Profile not found" });
  const scope = await resolveTalentManagerScope(req.firebaseUser!, profile);
  if (!scope) return res.status(403).json({ message: "You can only manage contestants in your own events" });
  req.talentScope = scope;
  next();
}

/** For routes keyed by `:profileId`. Must run after firebaseAuth. */
export async function requireTalentManagerByProfileId(req: Request<ParamsFlatDictionary>, res: Response, next: NextFunction) {
  try {
    const profileId = parseInt(String(req.params.profileId));
    if (!Number.isSafeInteger(profileId)) return res.status(400).json({ message: "Invalid profile ID" });
    await authorize(req, res, next, await storage.getTalentProfile(profileId));
  } catch (error) {
    next(error);
  }
}

/** For routes keyed by `:uid`. Must run after firebaseAuth. */
export async function requireTalentManagerByUid(req: Request<ParamsFlatDictionary>, res: Response, next: NextFunction) {
  try {
    await authorize(req, res, next, await storage.getTalentProfileByUserId(String(req.params.uid)));
  } catch (error) {
    next(error);
  }
}

/** Records who looked at or changed a contestant's account access. Never stores passwords. */
export async function recordAccessAudit(entry: {
  action: "reset-password" | "reset-password-email" | "view-access-status";
  actorUid: string;
  actorLevel: number;
  targetUid: string;
  competitionIds: number[];
}) {
  try {
    await getFirestore().collection("accountAccessAudit").add({
      ...entry,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Account access audit write failed:", error.message);
  }
}

/**
 * Phone and text-message consent live in their own collection so they can never ride along
 * with the public talent profile objects returned by competition and profile routes.
 */
export async function getPrivateContact(uid: string): Promise<{ phone: string | null; smsOptIn: boolean; smsOptInAt: string | null }> {
  const doc = await getFirestore().collection("talentPrivateContacts").doc(uid).get();
  const data = doc.exists ? doc.data() || {} : {};
  return {
    phone: typeof data.phone === "string" && data.phone ? data.phone : null,
    smsOptIn: data.smsOptIn === true && !!data.phone,
    smsOptInAt: typeof data.smsOptInAt === "string" ? data.smsOptInAt : null,
  };
}

export async function savePrivateContact(uid: string, update: { phone?: string | null; smsOptIn?: boolean }) {
  const current = await getPrivateContact(uid);
  const smsOptIn = update.smsOptIn ?? current.smsOptIn;
  await getFirestore().collection("talentPrivateContacts").doc(uid).set({
    phone: update.phone === undefined ? current.phone : update.phone,
    smsOptIn,
    smsOptInAt: smsOptIn ? (current.smsOptIn ? current.smsOptInAt : new Date().toISOString()) : null,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}
