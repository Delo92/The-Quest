import type { Express } from "express";
import { z } from "zod";
import { firebaseAuth, requireAdmin } from "./auth-middleware";
import { getFirestore } from "./firebase-admin";
import { logError } from "./services/errorLogger";
import {
  hasOCIntegrationToken,
  isOCAdapterConfigured,
  isValidOCIntegrationAuthorization,
} from "./services/ocAdapter";
import {
  runOCSocialProfileBackfill,
  storeOCSocialScanResults,
} from "./services/ocSocialProfileSync";

const httpUrlSchema = z.string().max(2_048).url().refine((value) => /^https?:\/\//i.test(value));

const scanLinkSchema = z.object({
  platform: z.string().trim().min(1).max(80),
  url: httpUrlSchema,
  scanStatus: z.enum(["complete", "partial", "unavailable", "error"]),
  postCountLast7Days: z.number().int().min(0).nullable().optional(),
  lastPostAt: z.string().datetime().nullable().optional(),
  evidenceUrls: z.array(httpUrlSchema).max(20).optional(),
});

const scanResultSchema = z.object({
  questProfileId: z.string().trim().regex(/^\d+$/).max(32),
  scanStatus: z.enum(["complete", "partial", "unavailable", "error"]),
  checkedAt: z.string().datetime(),
  windowStart: z.string().datetime().optional(),
  windowEnd: z.string().datetime().optional(),
  qualifyingPostCountLast7Days: z.number().int().min(0).nullable().optional(),
  message: z.string().max(1_000).optional(),
  links: z.array(scanLinkSchema).max(30).optional(),
});

const scanResultsRequestSchema = z.object({
  records: z.array(scanResultSchema).min(1).max(250),
});

export function registerOCSocialProfileRoutes(app: Express): void {
  app.post("/api/admin/oc/social-profiles/backfill", firebaseAuth, requireAdmin, async (_req, res): Promise<void> => {
    try {
      if (!isOCAdapterConfigured()) {
        res.status(503).json({ message: "The OC integration is not configured on Quest." });
        return;
      }
      const result = await runOCSocialProfileBackfill();
      res.status(result.failedCount > 0 ? 207 : 200).json(result);
    } catch (error: any) {
      const status = Number(error?.status) || 500;
      res.status(status).json({ message: error?.message || "OC social profile backfill failed." });
    }
  });

  app.post("/api/oc/social-profiles/results", async (req, res): Promise<void> => {
    if (!hasOCIntegrationToken()) {
      res.status(503).json({ message: "The OC integration is not configured on Quest." });
      return;
    }
    if (!isValidOCIntegrationAuthorization(req.headers.authorization)) {
      res.status(401).json({ message: "Invalid OC integration authorization." });
      return;
    }

    const parsed = scanResultsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid social scan result payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    try {
      const result = await storeOCSocialScanResults(parsed.data.records);
      res.status(202).json({ acceptedCount: result.storedCount, staleCount: result.staleCount });
    } catch (error) {
      await logError({
        errorType: "api",
        severity: "error",
        message: "Failed to store OC social scan results",
        endpoint: "/api/oc/social-profiles/results",
        method: "POST",
      });
      res.status(500).json({ message: "Failed to store social scan results." });
    }
  });

  app.get("/api/admin/oc/social-profiles/results", firebaseAuth, requireAdmin, async (req, res): Promise<void> => {
    try {
      const collection = getFirestore().collection("ocSocialScanResults");
      const requestedProfileId = String(req.query.profileId || "").trim();
      if (requestedProfileId) {
        if (!/^\d+$/.test(requestedProfileId)) {
          res.status(400).json({ message: "profileId must be a Quest profile ID." });
          return;
        }
        const doc = await collection.doc(requestedProfileId).get();
        res.json(doc.exists ? doc.data() : null);
        return;
      }

      const snapshot = await collection.orderBy("receivedAt", "desc").limit(250).get();
      res.json(snapshot.docs.map((doc) => doc.data()));
    } catch {
      res.status(500).json({ message: "Failed to load OC social scan results." });
    }
  });
}