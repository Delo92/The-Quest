import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { firebaseAuth } from "./auth-middleware";
import { storage } from "./storage";
import { hasOCIntegrationToken, isValidOCIntegrationAuthorization } from "./services/ocAdapter";
import { createOCReferralService, OCReferralError } from "./oc-referral-service";
import { ocReferralStore } from "./oc-referral-store";

const referralService = createOCReferralService({
  store: ocReferralStore,
  getUser: (uid) => storage.getUser(uid),
  getProfile: (uid) => storage.getTalentProfileByUserId(uid),
  getEvent: (id) => storage.getCompetition(id),
  getHostedEvents: (uid) => storage.getCompetitionsByCreator(uid),
  getEntries: (id) => storage.getContestantsByTalent(id),
  getEntry: (eventId, profileId) => storage.getContestant(eventId, profileId),
});
const startSchema = z.object({ competitionId: z.number().int().positive() }).strict();
const verifySchema = z.object({
  referralId: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  ocAccountId: z.string().trim().min(1).max(256),
  verifiedEmail: z.string().trim().email().max(320),
}).strict();

export function registerOCReferralRoutes(
  app: Express,
  options: {
    service?: typeof referralService;
    userAuth?: RequestHandler;
    integrationConfigured?: () => boolean;
    integrationAuthorized?: (value: string | undefined) => boolean;
  } = {},
) {
  const service = options.service ?? referralService;
  const userAuth = options.userAuth ?? firebaseAuth;
  const configured = options.integrationConfigured ?? hasOCIntegrationToken;
  const authorized = options.integrationAuthorized ?? isValidOCIntegrationAuthorization;
  const fail = (res: any, error: unknown) => {
    if (error instanceof OCReferralError) return res.status(error.status).json({ message: error.message, code: error.code });
    return res.status(503).json({ message: "Quest could not verify the event benefit. Do not grant automation access.", code: "eligibility_unavailable" });
  };
  app.get("/api/oc/referral/events", userAuth, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try { res.json(await service.listEvents(req.firebaseUser!.uid)); } catch (error) { fail(res, error); }
  });
  app.post("/api/oc/referral/start", userAuth, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Choose a valid Quest event." });
    if (!configured()) return res.status(503).json({ message: "OC event-benefit verification is not configured." });
    try { res.json(await service.start(req.firebaseUser!.uid, parsed.data.competitionId)); } catch (error) { fail(res, error); }
  });
  app.post("/api/integrations/oc/referral/eligibility", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!configured()) return res.status(503).json({ message: "OC integration is not configured." });
    if (!authorized(req.headers.authorization)) return res.status(401).json({ message: "OC integration authorization required." });
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "A referral reference, OC account ID, and verified account email are required." });
    try {
      res.json(await service.verify(parsed.data.referralId, parsed.data.ocAccountId, parsed.data.verifiedEmail));
    } catch (error) { fail(res, error); }
  });
}
