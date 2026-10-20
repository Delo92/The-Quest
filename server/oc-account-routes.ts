import type { Express } from "express";
import { z } from "zod";
import { firebaseAuth } from "./auth-middleware";
import {
  beginOCAccountConnection,
  completeOCAccountConnection,
  consumeOCAccountOAuthState,
  disconnectOCAccount,
  getOCAccountConnectionSummary,
  getSelectedOCBrandKitId,
  isAllowedOCAccountReturnTo,
  isOCAccountOAuthConfigured,
  OCAccountError,
  requestOCAccountApi,
  saveSelectedOCBrandKit,
} from "./oc-account-connection";

const safeHttpsUrl = z.string().url().refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "URL must use HTTPS");

const brandKitSummarySchema = z.object({
  id: z.string().trim().min(1).max(256),
  name: z.string().trim().min(1).max(160),
  businessName: z.string().trim().max(160).optional(),
  brandSlug: z.string().trim().max(160).optional(),
  logoUrl: safeHttpsUrl.optional(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

const brandKitDetailsSchema = z.object({
  id: z.string().trim().min(1).max(256),
  name: z.string().trim().min(1).max(160),
  identity: z.object({
    businessName: z.string().trim().max(160).optional(),
    brandSlug: z.string().trim().max(160).optional(),
    tagline: z.string().max(500).optional(),
    description: z.string().max(4_000).optional(),
    logoUrl: safeHttpsUrl.optional(),
    websiteUrl: safeHttpsUrl.optional(),
    primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  }),
  media: z.array(z.object({
    id: z.string().trim().min(1).max(256),
    name: z.string().trim().min(1).max(180),
    kind: z.enum(["image", "video"]),
    mimeType: z.string().trim().min(1).max(100),
    previewUrl: safeHttpsUrl,
    canPublish: z.boolean(),
  })).max(250),
  socialAccounts: z.array(z.object({
    id: z.string().trim().min(1).max(256),
    platform: z.string().trim().min(1).max(60),
    displayName: z.string().trim().min(1).max(180),
    canPublish: z.boolean(),
  })).max(50),
});

const publishRequestSchema = z.object({
  targetIds: z.array(z.string().trim().min(1).max(256)).min(1).max(20),
  caption: z.string().trim().min(1).max(2_200),
  mediaAssetId: z.string().trim().min(1).max(256).optional(),
  idempotencyKey: z.string().uuid(),
});

const publishResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    targetId: z.string().trim().min(1).max(256),
    platform: z.string().trim().min(1).max(60),
    success: z.boolean(),
    postUrl: safeHttpsUrl.optional(),
    error: z.string().max(500).optional(),
  })).max(20),
});

function sendOCError(res: any, error: unknown, fallback: string) {
  if (error instanceof OCAccountError) {
    return res.status(error.status).json({ message: error.message, code: error.code });
  }
  return res.status(500).json({ message: fallback });
}

function getUid(req: any): string | null {
  return typeof req.firebaseUser?.uid === "string" ? req.firebaseUser.uid : null;
}

async function fetchBrandKit(uid: string, kitId: string) {
  const response = await requestOCAccountApi(
    uid,
    `/api/quest/v1/brand-kits/${encodeURIComponent(kitId)}`,
  );
  const parsed = brandKitDetailsSchema.safeParse(response?.brandKit || response);
  if (!parsed.success || parsed.data.id !== kitId) {
    throw new OCAccountError(502, "oc_brand_kit_invalid", "OC returned brand-kit data in an unsupported format.");
  }
  return parsed.data;
}

export function registerOCAccountRoutes(app: Express): void {
  app.post("/api/oc/account/connect", firebaseAuth, async (req: any, res): Promise<void> => {
    const uid = getUid(req);
    if (!uid) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    if (!isOCAccountOAuthConfigured()) {
      res.status(503).json({ message: "OC account connection is not configured yet." });
      return;
    }
    if (!isAllowedOCAccountReturnTo(req.body?.returnTo)) {
      res.status(400).json({ message: "Choose a valid Quest account page to return to." });
      return;
    }
    try {
      const authorizationUrl = await beginOCAccountConnection(uid, req.body.returnTo);
      res.json({ authorizationUrl });
    } catch (error) {
      sendOCError(res, error, "Could not start the OC account connection.");
    }
  });

  app.get("/api/oc/account/callback", async (req: any, res): Promise<void> => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    try {
      const providerError = typeof req.query.error === "string" ? req.query.error : "";
      if (providerError) {
        const authorization = await consumeOCAccountOAuthState(state);
        res.redirect(`${authorization.returnTo}?ocConnection=cancelled`);
        return;
      }

      const code = typeof req.query.code === "string" ? req.query.code : "";
      const authorizationState = typeof req.query.state === "string" ? req.query.state : "";
      const result = await completeOCAccountConnection(code, authorizationState);
      res.redirect(`${result.returnTo}?ocConnection=connected`);
    } catch (error) {
      const returnTo = error instanceof OCAccountError
        && isAllowedOCAccountReturnTo(error.returnTo)
        ? error.returnTo
        : "/thequest/dashboard";
      res.redirect(`${returnTo}?ocConnection=error`);
    }
  });

  app.get("/api/oc/account/status", firebaseAuth, async (req: any, res): Promise<void> => {
    const uid = getUid(req);
    if (!uid) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    try {
      res.set("Cache-Control", "no-store");
      res.json(await getOCAccountConnectionSummary(uid));
    } catch {
      res.status(500).json({ message: "Could not load OC account status." });
    }
  });

  app.get("/api/oc/account/brand-kits", firebaseAuth, async (req: any, res): Promise<void> => {
    const uid = getUid(req);
    if (!uid) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    try {
      const response = await requestOCAccountApi(uid, "/api/quest/v1/brand-kits");
      const brandKits = z.array(brandKitSummarySchema).max(250).safeParse(response?.brandKits);
      if (!brandKits.success) {
        res.status(502).json({ message: "OC returned brand-kit data in an unsupported format." });
        return;
      }
      res.set("Cache-Control", "no-store");
      res.json({ brandKits: brandKits.data });
    } catch (error) {
      sendOCError(res, error, "Could not load OC brand kits.");
    }
  });

  app.put("/api/oc/account/brand-kit", firebaseAuth, async (req: any, res): Promise<void> => {
    const uid = getUid(req);
    const kitId = typeof req.body?.brandKitId === "string" ? req.body.brandKitId.trim() : "";
    if (!uid) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    if (!kitId || kitId.length > 256) {
      res.status(400).json({ message: "Choose a valid OC brand kit." });
      return;
    }
    try {
      const brandKit = await fetchBrandKit(uid, kitId);
      await saveSelectedOCBrandKit(uid, brandKit.id, brandKit.name);
      res.set("Cache-Control", "no-store");
      res.json({ selectedBrandKitId: brandKit.id, brandKit });
    } catch (error) {
      sendOCError(res, error, "Could not select this OC brand kit.");
    }
  });

  app.get("/api/oc/account/brand-kit", firebaseAuth, async (req: any, res): Promise<void> => {
    const uid = getUid(req);
    if (!uid) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    try {
      const kitId = await getSelectedOCBrandKitId(uid);
      const brandKit = await fetchBrandKit(uid, kitId);
      res.set("Cache-Control", "no-store");
      res.json({ brandKit });
    } catch (error) {
      sendOCError(res, error, "Could not load the selected OC brand kit.");
    }
  });

  app.post("/api/oc/account/publish", firebaseAuth, async (req: any, res): Promise<void> => {
    const uid = getUid(req);
    if (!uid) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    const parsed = publishRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Enter a caption, choose at least one connected social account, and try again.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
      return;
    }
    try {
      const kitId = await getSelectedOCBrandKitId(uid);
      const brandKit = await fetchBrandKit(uid, kitId);
      const selectedTargets = new Set(brandKit.socialAccounts
        .filter((account) => account.canPublish)
        .map((account) => account.id));
      if (parsed.data.targetIds.some((targetId) => !selectedTargets.has(targetId))) {
        res.status(403).json({ message: "One or more selected social accounts are not available for publishing." });
        return;
      }
      if (parsed.data.mediaAssetId) {
        const media = brandKit.media.find((item) => item.id === parsed.data.mediaAssetId);
        if (!media?.canPublish) {
          res.status(400).json({ message: "Choose media that is available for social publishing." });
          return;
        }
      }

      const response = await requestOCAccountApi(
        uid,
        `/api/quest/v1/brand-kits/${encodeURIComponent(kitId)}/posts`,
        {
          method: "POST",
          headers: { "Idempotency-Key": parsed.data.idempotencyKey },
          body: JSON.stringify({
            targetIds: parsed.data.targetIds,
            caption: parsed.data.caption,
            ...(parsed.data.mediaAssetId ? { mediaAssetId: parsed.data.mediaAssetId } : {}),
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        },
      );
      const result = publishResponseSchema.safeParse(response);
      if (!result.success) {
        res.status(502).json({ message: "OC returned an unsupported publishing result." });
        return;
      }
      res.json(result.data);
    } catch (error) {
      sendOCError(res, error, "Could not publish to the selected OC brand kit.");
    }
  });

  app.delete("/api/oc/account/connection", firebaseAuth, async (req: any, res): Promise<void> => {
    const uid = getUid(req);
    if (!uid) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    try {
      const result = await disconnectOCAccount(uid);
      res.set("Cache-Control", "no-store");
      res.json({
        disconnected: true,
        revocationConfirmed: result.revocationConfirmed,
      });
    } catch {
      res.status(500).json({ message: "Could not disconnect the OC account." });
    }
  });
}
