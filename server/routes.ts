import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { firebaseAuth, requireAdmin, requireHost, requireTalent } from "./auth-middleware";
import {
  verifyFirebaseToken,
  createFirebaseUser,
  deleteFirebaseUser,
  setUserLevel,
  getFirestoreUser,
  createFirestoreUser,
  updateFirestoreUser,
  getFirebaseAuth,
  getFirestore,
  uploadToFirebaseStorage,
  deleteFromFirebaseStorage,
  listFirebaseStorageFiles,
} from "./firebase-admin";
import {
  firestoreCategories,
  firestoreVotePackages,
  firestoreSettings,
  firestoreViewerProfiles,
  firestoreVotePurchases,
  firestoreVotes,
  firestoreJoinSettings,
  firestoreJoinSubmissions,
  firestoreHostSettings,
  firestoreHostSubmissions,
  firestoreInvitations,
  firestoreReferrals,
  firestoreCompetitions,
} from "./firestore-collections";
import { chargePaymentNonce, getPublicConfig } from "./authorize-net";
import { sendInviteEmail, sendPurchaseReceipt, sendTestEmail, isEmailConfigured, getGmailAuthUrl, exchangeGmailCode } from "./email";
import {
  uploadImageToDrive,
  uploadFileToDriveFolder,
  listFilesInFolder,
  getFileStream,
  deleteFile,
  getDriveImageUrl,
  getDriveThumbnailUrl,
  createCompetitionDriveFolder,
  createContestantDriveFolders,
  getDriveStorageUsage,
} from "./google-drive";
import {
  listTalentVideos,
  listAllTalentVideos,
  createUploadTicket,
  deleteVideo,
  renameVideo,
  addVideoToFolder,
  getVideoThumbnail,
  createCompetitionVimeoFolder,
  createContestantVimeoFolder,
  getCompetitionFolder,
  getTalentFolderInCompetition,
  getVimeoStorageUsage,
} from "./vimeo";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { slugify, extractIdFromSlug } from "../shared/slugify";

function generateUniqueFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}${ext}`;
}

const compCoverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const allowedVideo = [".mp4", ".webm", ".mov"];
    if (allowedImage.includes(ext) || allowedVideo.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});

const liveryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const allowedVideo = [".mp4", ".webm", ".mov"];
    if (allowedImage.includes(ext) || allowedVideo.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});

function isVideoFile(filename: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(filename);
}

async function getVideoDurationFromBuffer(buffer: Buffer): Promise<number> {
  const { execSync } = await import("child_process");
  const os = await import("os");
  const tmpPath = path.join(os.tmpdir(), `vid-check-${Date.now()}.mp4`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpPath}"`,
      { encoding: "utf-8", timeout: 10000 }
    );
    return parseFloat(output.trim());
  } catch {
    return -1;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

const talentImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/firebase-config", (_req, res) => {
    res.json({
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: "thequest-2dc77.firebaseapp.com",
      projectId: "thequest-2dc77",
      storageBucket: "thequest-2dc77.firebasestorage.app",
      messagingSenderId: "886107413539",
      appId: "1:886107413539:web:f7c6bdf8adb2b032bf2596",
      measurementId: "G-7LBW9HVXWE",
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, displayName, stageName, level: requestedLevel, socialLinks, billingAddress, inviteToken } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      let level = [1, 2, 3].includes(requestedLevel) ? requestedLevel : 1;
      let invitation = null;

      if (inviteToken) {
        invitation = await firestoreInvitations.getByToken(inviteToken);
        if (invitation && invitation.status === "pending") {
          if (invitation.invitedEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
            return res.status(403).json({ message: "This invitation was sent to a different email address" });
          }
          level = invitation.targetLevel;
        }
      }

      const firebaseUser = await createFirebaseUser(email, password, displayName);
      await setUserLevel(firebaseUser.uid, level);

      await createFirestoreUser({
        uid: firebaseUser.uid,
        email,
        displayName: displayName || email.split("@")[0],
        stageName: stageName || undefined,
        level,
        socialLinks: socialLinks || undefined,
        billingAddress: billingAddress || undefined,
      });

      if (invitation && invitation.status === "pending") {
        await firestoreInvitations.markAccepted(inviteToken, firebaseUser.uid);
      }

      const roleMap: Record<number, string> = { 1: "viewer", 2: "talent", 3: "host", 4: "admin" };
      if (level >= 2) {
        await storage.createTalentProfile({
          userId: firebaseUser.uid,
          displayName: displayName || email.split("@")[0],
          stageName: stageName || null,
          bio: null,
          category: null,
          location: null,
          imageUrls: [],
          videoUrls: [],
          socialLinks: socialLinks ? JSON.stringify(socialLinks) : null,
          role: roleMap[level],
        });
      }

      res.status(201).json({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        level,
      });
    } catch (error: any) {
      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({ message: "Email already in use" });
      }
      if (error.code === "auth/weak-password") {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/sync", firebaseAuth, async (req, res) => {
    try {
      const { uid, email } = req.firebaseUser!;

      let firestoreUser = await getFirestoreUser(uid);
      if (!firestoreUser) {
        firestoreUser = await createFirestoreUser({
          uid,
          email,
          displayName: email.split("@")[0],
          level: 1,
        });
      }

      const profile = await storage.getTalentProfileByUserId(uid);

      res.json({
        uid,
        email: firestoreUser.email,
        displayName: firestoreUser.displayName,
        stageName: firestoreUser.stageName || null,
        level: firestoreUser.level,
        profileImageUrl: firestoreUser.profileImageUrl || null,
        socialLinks: firestoreUser.socialLinks || null,
        billingAddress: firestoreUser.billingAddress || null,
        hasProfile: !!profile,
        profileRole: profile?.role || null,
      });
    } catch (error: any) {
      console.error("Auth sync error:", error);
      res.status(500).json({ message: "Auth sync failed" });
    }
  });

  app.get("/api/auth/user", firebaseAuth, async (req, res) => {
    try {
      const { uid } = req.firebaseUser!;
      const firestoreUser = await getFirestoreUser(uid);
      if (!firestoreUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const profile = await storage.getTalentProfileByUserId(uid);

      res.json({
        uid: firestoreUser.uid,
        email: firestoreUser.email,
        displayName: firestoreUser.displayName,
        stageName: firestoreUser.stageName || null,
        level: firestoreUser.level,
        profileImageUrl: firestoreUser.profileImageUrl || null,
        socialLinks: firestoreUser.socialLinks || null,
        billingAddress: firestoreUser.billingAddress || null,
        hasProfile: !!profile,
        profileRole: profile?.role || null,
      });
    } catch (error: any) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/auth/set-admin", firebaseAuth, async (req, res) => {
    try {
      const { uid } = req.firebaseUser!;

      const admins = await storage.getAdminProfiles();
      if (admins.length > 0) {
        const firestoreUser = await getFirestoreUser(uid);
        if (!firestoreUser || firestoreUser.level < 4) {
          return res.status(403).json({ message: "Admin already exists. Contact existing admin." });
        }
      }

      await setUserLevel(uid, 4);
      await updateFirestoreUser(uid, { level: 4 });

      let profile = await storage.getTalentProfileByUserId(uid);
      if (profile) {
        profile = await storage.updateTalentProfile(uid, { role: "admin" }) || profile;
      } else {
        const firestoreUser = await getFirestoreUser(uid);
        profile = await storage.createTalentProfile({
          userId: uid,
          displayName: firestoreUser?.displayName || "Admin",
          stageName: null,
          bio: "Platform administrator",
          category: null,
          location: null,
          imageUrls: [],
          videoUrls: [],
          socialLinks: null,
          role: "admin",
        });
      }

      res.json({ message: "Admin access granted", level: 4, profile });
    } catch (error: any) {
      console.error("Set admin error:", error);
      res.status(500).json({ message: "Failed to set admin" });
    }
  });


  app.get("/api/stats/total-votes", async (req, res) => {
    try {
      const total = await firestoreVotes.getTotalPlatformVotes();
      res.json({ totalVotes: total });
    } catch (error: any) {
      console.error("Total votes error:", error);
      res.status(500).json({ message: "Failed to get total votes" });
    }
  });

  app.get("/api/competitions", async (req, res) => {
    try {
      const { category, status } = req.query;
      let comps;
      if (category && status) {
        comps = await storage.getCompetitionsByCategoryAndStatus(String(category), String(status));
      } else if (category) {
        comps = await storage.getCompetitionsByCategory(String(category));
      } else if (status) {
        comps = await storage.getCompetitionsByStatus(String(status));
      } else {
        comps = await storage.getCompetitions();
      }
      const enriched = await Promise.all(comps.map(async (c: any) => {
        if (c.createdBy) {
          const creatorProfile = await storage.getTalentProfileByUserId(c.createdBy);
          if (creatorProfile?.role === "admin") {
            return { ...c, hostedBy: "admin" };
          } else if (creatorProfile?.role === "host") {
            return { ...c, hostedBy: creatorProfile.displayName || "Host" };
          }
        }
        return { ...c, hostedBy: null };
      }));
      res.json(enriched);
    } catch (error: any) {
      console.error("Get competitions error:", error);
      res.status(500).json({ message: "Failed to get competitions" });
    }
  });

  app.get("/api/hero-gallery", async (req, res) => {
    try {
      const categories = await firestoreCategories.getAll();
      const activeCategories = categories.filter((c: any) => c.isActive !== false);
      const competitions = await storage.getCompetitions();
      const liveryItems = await storage.getAllLivery();

      const galleryItems = await Promise.all(
        activeCategories.map(async (cat: any) => {
          const catComps = competitions.filter(c =>
            (c.status === "active" || c.status === "voting") &&
            c.category === cat.name
          );

          let topContestant: any = null;
          let topVoteCount = 0;
          let topCompetition: any = null;

          for (const comp of catComps) {
            const contestants = await storage.getContestantsByCompetition(comp.id);
            for (const contestant of contestants) {
              if (contestant.voteCount > topVoteCount) {
                topVoteCount = contestant.voteCount;
                topContestant = contestant;
                topCompetition = comp;
              }
            }
          }

          let videoEmbedUrl: string | null = null;
          let displayName: string | null = null;
          let coverVideoUrl: string | null = null;
          let thumbnail: string | null = cat.imageUrl || null;
          if (cat.videoUrl) {
            coverVideoUrl = cat.videoUrl;
          }

          if (topContestant && topVoteCount > 0 && topCompetition) {
            displayName = topContestant.talentProfile.stageName || topContestant.talentProfile.displayName;
            if (topContestant.talentProfile.imageUrls?.length > 0) {
              thumbnail = topContestant.talentProfile.imageUrls[0];
            }
            coverVideoUrl = topCompetition.coverVideo || null;
            try {
              const talentName = (topContestant.talentProfile.displayName || topContestant.talentProfile.stageName || "").replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
              const videos = await listTalentVideos(topCompetition.title, talentName);
              if (videos.length > 0 && videos[0].player_embed_url) {
                const baseUrl = videos[0].player_embed_url;
                const separator = baseUrl.includes("?") ? "&" : "?";
                videoEmbedUrl = baseUrl + separator + "autoplay=1&muted=1&loop=1&background=1";
              }
            } catch {}
          }

          let competitionSlug: string | null = null;
          let contestantSlug: string | null = null;
          if (topCompetition && topContestant) {
            competitionSlug = slugify(topCompetition.title);
            contestantSlug = slugify(topContestant.talentProfile.displayName || topContestant.talentProfile.stageName || "");
          }

          return {
            categoryId: cat.id,
            categoryName: cat.name,
            thumbnail,
            videoEmbedUrl,
            coverVideoUrl,
            topContestantName: displayName,
            voteCount: topVoteCount,
            competitionCount: catComps.length,
            competitionSlug,
            contestantSlug,
          };
        })
      );

      res.json(galleryItems);
    } catch (error: any) {
      console.error("Hero gallery error:", error);
      res.status(500).json({ message: "Failed to load hero gallery" });
    }
  });

  app.get("/api/competitions/featured", async (_req, res) => {
    const now = new Date();
    const all = await storage.getCompetitions();
    const nonDraft = all.filter(c => c.status !== "draft");

    const explicitly = nonDraft.find(c => (c as any).isFeatured && c.votingEndDate && new Date(c.votingEndDate) > now);
    if (explicitly) return res.json(explicitly);

    const withEnd = nonDraft.filter(c => c.votingEndDate && new Date(c.votingEndDate) > now);
    if (withEnd.length === 0) return res.json(null);
    withEnd.sort((a, b) => new Date(a.votingEndDate!).getTime() - new Date(b.votingEndDate!).getTime());
    return res.json(withEnd[0]);
  });

  app.post("/api/competitions/:id/feature", firebaseAuth, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

    const all = await storage.getCompetitions();
    const target = all.find(c => c.id === id);
    if (!target) return res.status(404).json({ message: "Competition not found" });

    const isAlreadyFeatured = !!(target as any).isFeatured;
    for (const c of all) {
      if ((c as any).isFeatured) {
        await storage.updateCompetition(c.id, { isFeatured: false } as any);
      }
    }
    if (!isAlreadyFeatured) {
      await storage.updateCompetition(id, { isFeatured: true } as any);
    }
    const updated = await storage.getCompetition(id);
    res.json(updated);
  });

  app.get("/api/competitions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

    const comp = await storage.getCompetition(id);
    if (!comp) return res.status(404).json({ message: "Competition not found" });

    const contestantsData = await storage.getContestantsByCompetition(id);
    const totalVotes = await storage.getTotalVotesByCompetition(id);

    const enrichedContestants = await Promise.all(
      contestantsData.map(async (contestant) => {
        let videoThumbnail: string | null = null;
        try {
          const talentName = (contestant.talentProfile.displayName || contestant.talentProfile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
          const videos = await listTalentVideos(comp.title, talentName);
          if (videos.length > 0) {
            videoThumbnail = getVideoThumbnail(videos[0]);
          }
        } catch {}
        return { ...contestant, videoThumbnail };
      })
    );

    let hostedBy: string | null = null;
    if (comp.createdBy) {
      const creatorProfile = await storage.getTalentProfileByUserId(comp.createdBy);
      if (creatorProfile?.role === "admin") {
        hostedBy = "admin";
      } else if (creatorProfile?.role === "host") {
        hostedBy = creatorProfile.displayName || "Host";
      }
    }

    res.json({
      ...comp,
      hostedBy,
      contestants: enrichedContestants,
      totalVotes,
    });
  });

  const createCompetitionSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().default(""),
    category: z.string().min(1, "Category is required"),
    status: z.enum(["draft", "active", "voting", "completed"]).optional().default("active"),
    voteCost: z.number().min(0).optional().default(0),
    maxVotesPerDay: z.number().int().min(1).optional().default(10),
    maxImagesPerContestant: z.number().int().min(1).optional().nullable(),
    maxVideosPerContestant: z.number().int().min(1).optional().nullable(),
    coverImage: z.string().optional(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    startDateTbd: z.boolean().optional().default(false),
    endDateTbd: z.boolean().optional().default(false),
    votingStartDate: z.string().optional().nullable(),
    votingEndDate: z.string().optional().nullable(),
    expectedContestants: z.number().int().min(0).optional().nullable(),
    onlineVoteWeight: z.number().int().min(1).max(100).optional().default(100),
    inPersonOnly: z.boolean().optional().default(false),
  });

  app.post("/api/competitions", firebaseAuth, requireHost, async (req, res) => {
    const parsed = createCompetitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid data" });
    }

    const platformDoc = await getFirestore().collection("platformSettings").doc("global").get();
    const platformData = platformDoc.exists ? platformDoc.data() : {};
    const globalMaxImages = platformData?.maxImagesPerContestant ?? 10;
    const globalMaxVideos = platformData?.maxVideosPerContestant ?? 3;
    const minVoteCost = platformData?.defaultVoteCost ?? 0;
    const minMaxVotesPerDay = platformData?.defaultMaxVotesPerDay ?? 1;

    let finalVoteCost = parsed.data.voteCost ?? 0;
    if (finalVoteCost < minVoteCost) finalVoteCost = minVoteCost;

    let finalMaxVotesPerDay = parsed.data.maxVotesPerDay ?? 10;
    if (finalMaxVotesPerDay > minMaxVotesPerDay && minMaxVotesPerDay > 0) finalMaxVotesPerDay = Math.min(finalMaxVotesPerDay, minMaxVotesPerDay);

    let compMaxImages = parsed.data.maxImagesPerContestant ?? null;
    let compMaxVideos = parsed.data.maxVideosPerContestant ?? null;
    if (compMaxImages !== null && compMaxImages > globalMaxImages) compMaxImages = globalMaxImages;
    if (compMaxVideos !== null && compMaxVideos > globalMaxVideos) compMaxVideos = globalMaxVideos;

    const comp = await storage.createCompetition({
      ...parsed.data,
      voteCost: finalVoteCost,
      maxVotesPerDay: finalMaxVotesPerDay,
      description: parsed.data.description || null,
      coverImage: parsed.data.coverImage || null,
      coverVideo: null,
      maxImagesPerContestant: compMaxImages,
      maxVideosPerContestant: compMaxVideos,
      startDate: parsed.data.startDate || null,
      endDate: parsed.data.endDate || null,
      votingStartDate: parsed.data.votingStartDate || null,
      votingEndDate: parsed.data.votingEndDate || null,
      expectedContestants: parsed.data.expectedContestants ?? null,
      createdAt: new Date().toISOString(),
      createdBy: req.firebaseUser!.uid,
    });

    try {
      await Promise.all([
        createCompetitionDriveFolder(comp.title),
        createCompetitionVimeoFolder(comp.title),
      ]);
    } catch (folderErr: any) {
      console.error("Auto-create competition folders error (non-blocking):", folderErr.message);
    }

    res.status(201).json(comp);
  });

  app.patch("/api/competitions/:id", firebaseAuth, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const profile = await storage.getTalentProfileByUserId(uid);
    const role = profile?.role;
    if (role !== "admin" && role !== "host") {
      return res.status(403).json({ message: "Admin or host access required" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

    if (role === "host") {
      const comp = await storage.getCompetition(id);
      if (!comp || comp.createdBy !== uid) {
        return res.status(403).json({ message: "Not your competition" });
      }
    }

    const updateData = { ...req.body };

    const platformDoc = await getFirestore().collection("platformSettings").doc("global").get();
    const platformData = platformDoc.exists ? platformDoc.data() : {};
    const minVoteCost = platformData?.defaultVoteCost ?? 0;
    const minMaxVotesPerDay = platformData?.defaultMaxVotesPerDay ?? 1;
    const globalMaxImages = platformData?.maxImagesPerContestant ?? 10;
    const globalMaxVideos = platformData?.maxVideosPerContestant ?? 3;

    if (updateData.voteCost !== undefined && updateData.voteCost < minVoteCost) {
      updateData.voteCost = minVoteCost;
    }
    if (updateData.maxVotesPerDay !== undefined && minMaxVotesPerDay > 0 && updateData.maxVotesPerDay > minMaxVotesPerDay) {
      updateData.maxVotesPerDay = minMaxVotesPerDay;
    }
    if (updateData.maxImagesPerContestant !== undefined && updateData.maxImagesPerContestant > globalMaxImages) {
      updateData.maxImagesPerContestant = globalMaxImages;
    }
    if (updateData.maxVideosPerContestant !== undefined && updateData.maxVideosPerContestant > globalMaxVideos) {
      updateData.maxVideosPerContestant = globalMaxVideos;
    }

    const updated = await storage.updateCompetition(id, updateData);
    if (!updated) return res.status(404).json({ message: "Competition not found" });
    res.json(updated);
  });

  app.delete("/api/competitions/:id", firebaseAuth, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });
    await storage.deleteCompetition(id);
    res.json({ message: "Deleted" });
  });

  app.get("/api/competitions/:id/qrcode", firebaseAuth, requireHost, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

      const comp = await storage.getCompetition(id);
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const categorySlug = slugify(comp.category);
      const compSlug = slugify(comp.title);
      const baseUrl = process.env.BASE_URL || `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host || "thequest-2dc77.firebaseapp.com"}`;
      const votingUrl = `${baseUrl}/thequest/${categorySlug}/${compSlug}?source=in_person`;

      const format = (req.query.format as string) || "png";

      if (format === "svg") {
        const svg = await QRCode.toString(votingUrl, {
          type: "svg",
          width: 400,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Content-Disposition", `attachment; filename="qr-${slug}.svg"`);
        return res.send(svg);
      }

      const pngBuffer = await QRCode.toBuffer(votingUrl, {
        type: "png",
        width: 600,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="qr-${slug}.png"`);
      return res.send(pngBuffer);
    } catch (err: any) {
      console.error("QR code generation error:", err);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.get("/api/competitions/:id/vote-breakdown", firebaseAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

      const comp = await storage.getCompetition(id);
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const breakdown = await storage.getVoteBreakdownByCompetition(id);

      const contestants = await storage.getContestantsByCompetition(id);
      const contestantBreakdowns = await Promise.all(
        contestants.map(async (c) => {
          const cb = await storage.getContestantVoteBreakdown(c.id, id);
          return {
            contestantId: c.id,
            displayName: c.talentProfile.displayName,
            ...cb,
          };
        })
      );

      res.json({
        competitionId: id,
        ...breakdown,
        onlineVoteWeight: (comp as any).onlineVoteWeight ?? 100,
        inPersonOnly: (comp as any).inPersonOnly ?? false,
        contestants: contestantBreakdowns,
      });
    } catch (err: any) {
      console.error("Vote breakdown error:", err);
      res.status(500).json({ message: "Failed to get vote breakdown" });
    }
  });

  const voteBodySchema = z.object({
    contestantId: z.number().int().positive("contestantId is required"),
    source: z.enum(["online", "in_person"]).optional().default("online"),
    refCode: z.string().optional().nullable(),
  });

  app.post("/api/competitions/:id/vote", async (req, res) => {
    const compId = parseInt(req.params.id);
    if (isNaN(compId)) return res.status(400).json({ message: "Invalid competition ID" });

    const parsed = voteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "contestantId required" });
    }

    const { contestantId } = parsed.data;

    const comp = await storage.getCompetition(compId);
    if (!comp) return res.status(404).json({ message: "Competition not found" });

    if (comp.status !== "voting" && comp.status !== "active") {
      return res.status(400).json({ message: "Voting is not open for this competition" });
    }

    if ((comp as any).inPersonOnly && parsed.data.source !== "in_person") {
      return res.status(400).json({ message: "This is an in-person only event. Please scan the QR code at the venue to vote." });
    }

    const voterIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

    const freeVotesToday = await firestoreVotes.getVotesTodayByIp(compId, voterIp);
    if (freeVotesToday >= 1) {
      return res.status(429).json({ message: `You've already used your free vote for this competition today. Purchase additional votes to keep supporting your favorite!` });
    }

    const { source, refCode } = parsed.data;
    let resolvedRefCode = refCode || null;
    if (refCode) {
      try {
        const resolved = await firestoreReferrals.resolveCode(refCode);
        resolvedRefCode = resolved?.code || refCode;
      } catch (e) {
        console.error("Referral resolve error:", e);
      }
    }

    const vote = await storage.castVote({
      contestantId,
      competitionId: compId,
      voterIp,
      source,
      refCode: resolvedRefCode,
    });

    if (resolvedRefCode) {
      try {
        await firestoreReferrals.trackReferralVote(resolvedRefCode, voterIp, 1);
      } catch (e) {
        console.error("Referral tracking error:", e);
      }
    }

    res.status(201).json(vote);
  });

  app.post("/api/competitions/:id/apply", firebaseAuth, async (req, res) => {
    const uid = req.firebaseUser!.uid;

    const profile = await storage.getTalentProfileByUserId(uid);
    if (!profile) return res.status(400).json({ message: "Create a talent profile first" });

    const compId = parseInt(req.params.id);
    if (isNaN(compId)) return res.status(400).json({ message: "Invalid competition ID" });

    const comp = await storage.getCompetition(compId);
    if (!comp) return res.status(404).json({ message: "Competition not found" });

    const existing = await storage.getContestant(compId, profile.id);
    if (existing) return res.status(400).json({ message: "Already applied to this competition" });

    const allMyContests = await storage.getContestantsByTalent(profile.id);
    const activeEntries = allMyContests.filter(c => c.applicationStatus === "approved" || c.applicationStatus === "pending");

    const userDoc = await getFirestore().collection("users").doc(uid).get();
    const userLevel = userDoc.exists ? (userDoc.data()?.level || 1) : 1;
    const isAdminOrHost = userLevel >= 4;

    if (activeEntries.length > 0 && !isAdminOrHost) {
      return res.status(400).json({ message: "You can only be in one competition at a time. Contact an admin to join additional competitions." });
    }

    const applicationStatus = "approved";

    const contestant = await storage.createContestant({
      competitionId: compId,
      talentProfileId: profile.id,
      applicationStatus,
      appliedAt: new Date().toISOString(),
    });

    try {
      const talentName = (profile.displayName || profile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
      await Promise.all([
        createContestantDriveFolders(comp.title, talentName),
        createContestantVimeoFolder(comp.title, talentName),
      ]);
    } catch (folderErr: any) {
      console.error("Auto-create contestant folders error (non-blocking):", folderErr.message);
    }

    res.status(201).json(contestant);
  });


  app.get("/api/talent-profiles/me", firebaseAuth, async (req, res) => {
    const uid = req.firebaseUser!.uid;
    const profile = await storage.getTalentProfileByUserId(uid);
    res.json(profile || null);
  });

  const createProfileSchema = z.object({
    displayName: z.string().min(1, "Display name is required"),
    stageName: z.string().optional().nullable(),
    bio: z.string().optional().default(""),
    category: z.string().optional().default(""),
    location: z.string().optional().default(""),
    imageUrls: z.array(z.string()).optional().default([]),
    videoUrls: z.array(z.string()).optional().default([]),
    socialLinks: z.string().optional().nullable(),
  });

  app.post("/api/talent-profiles", firebaseAuth, async (req, res) => {
    const uid = req.firebaseUser!.uid;

    const existing = await storage.getTalentProfileByUserId(uid);
    if (existing) return res.status(400).json({ message: "Profile already exists" });

    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid data" });
    }

    const profile = await storage.createTalentProfile({
      ...parsed.data,
      userId: uid,
      role: "talent",
    });
    res.status(201).json(profile);
  });

  app.patch("/api/talent-profiles/me", firebaseAuth, async (req, res) => {
    const uid = req.firebaseUser!.uid;
    const { role, userId: _, ...safeData } = req.body;
    if (safeData.socialLinks && typeof safeData.socialLinks === "string") {
      try {
        const parsed = JSON.parse(safeData.socialLinks);
        const sanitized: Record<string, string> = {};
        for (const [key, val] of Object.entries(parsed)) {
          if (typeof val === "string" && /^https?:\/\//i.test(val)) {
            sanitized[key] = val;
          }
        }
        safeData.socialLinks = Object.keys(sanitized).length > 0 ? JSON.stringify(sanitized) : null;
      } catch {
        safeData.socialLinks = null;
      }
    }
    const updated = await storage.updateTalentProfile(uid, safeData);
    if (!updated) return res.status(404).json({ message: "Profile not found" });
    res.json(updated);
  });

  const profileBgUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = /\.(jpg|jpeg)$/i;
      if (allowed.test(path.extname(file.originalname))) {
        cb(null, true);
      } else {
        cb(new Error("Only JPEG images are allowed (.jpg or .jpeg)"));
      }
    },
  });

  app.post("/api/talent-profiles/me/bg-image", firebaseAuth, profileBgUpload.single("image"), async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const profile = await storage.getTalentProfileByUserId(uid);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded. Only JPEG images are accepted." });

      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
      const storagePath = `profile-backgrounds/${uid}/${uniqueName}`;
      const firebaseUrl = await uploadToFirebaseStorage(storagePath, req.file.buffer, req.file.mimetype);

      await storage.updateTalentProfile(uid, { profileBgImage: firebaseUrl });
      res.json({ url: firebaseUrl });
    } catch (error: any) {
      console.error("Profile background upload error:", error);
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  app.get("/api/talent-profiles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid profile ID" });
    const profile = await storage.getTalentProfile(id);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    let videos: any[] = [];
    try {
      const talentName = (profile.displayName || profile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
      const rawVideos = await listAllTalentVideos(talentName);
      videos = rawVideos.map(v => ({
        uri: v.uri,
        name: v.name,
        link: v.link,
        embedUrl: v.player_embed_url,
        duration: v.duration,
        thumbnail: getVideoThumbnail(v),
        competitionFolder: v.competitionFolder,
      }));
    } catch {}

    res.json({ ...profile, videos });
  });

  app.get("/api/contestants/me", firebaseAuth, async (req, res) => {
    const uid = req.firebaseUser!.uid;
    const profile = await storage.getTalentProfileByUserId(uid);
    if (!profile) return res.json([]);
    const myContests = await storage.getContestantsByTalent(profile.id);
    const enriched = await Promise.all(myContests.map(async (c) => {
      const comp = await storage.getCompetition(c.competitionId);
      return { ...c, competitionCategory: comp?.category || "" };
    }));
    res.json(enriched);
  });


  app.get("/api/host/competitions", firebaseAuth, requireHost, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const competitions = await storage.getCompetitionsByCreator(uid);
    res.json(competitions);
  });

  app.get("/api/host/stats", firebaseAuth, requireHost, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const competitions = await storage.getCompetitionsByCreator(uid);
    let totalContestants = 0;
    let totalVotes = 0;
    let pendingApplications = 0;

    for (const comp of competitions) {
      const allContestants = await storage.getContestantsByCompetition(comp.id);
      totalContestants += allContestants.length;
      for (const c of allContestants) {
        totalVotes += c.voteCount;
      }
      const allContestantsRaw = await storage.getAllContestants();
      const pending = allContestantsRaw.filter(
        c => c.competitionId === comp.id && c.applicationStatus === "pending"
      );
      pendingApplications += pending.length;
    }

    res.json({
      totalCompetitions: competitions.length,
      totalContestants,
      totalVotes,
      pendingApplications,
    });
  });

  app.get("/api/host/contestants", firebaseAuth, requireHost, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const competitions = await storage.getCompetitionsByCreator(uid);
    const compIds = new Set(competitions.map(c => c.id));
    const allContestants = await storage.getAllContestants();
    const hostContestants = allContestants.filter(c => compIds.has(c.competitionId));
    res.json(hostContestants);
  });

  app.get("/api/host/competitions/:id/contestants", firebaseAuth, requireHost, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

    const comp = await storage.getCompetition(id);
    if (!comp || comp.createdBy !== uid) {
      return res.status(403).json({ message: "Not your competition" });
    }

    const allContestants = await storage.getAllContestants();
    const compContestants = allContestants.filter(c => c.competitionId === id);
    res.json(compContestants);
  });

  app.patch("/api/host/contestants/:id/status", firebaseAuth, requireHost, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid contestant ID" });

    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const allContestants = await storage.getAllContestants();
    const contestant = allContestants.find(c => c.id === id);
    if (!contestant) return res.status(404).json({ message: "Contestant not found" });

    const comp = await storage.getCompetition(contestant.competitionId);
    if (!comp || comp.createdBy !== uid) {
      return res.status(403).json({ message: "Not your competition" });
    }

    const updated = await storage.updateContestantStatus(id, status);

    if (status === "approved" && updated) {
      try {
        const profile = await storage.getTalentProfile(updated.talentProfileId);
        if (profile && comp) {
          const talentName = (profile.displayName || profile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
          await Promise.all([
            createContestantDriveFolders(comp.title, talentName),
            createContestantVimeoFolder(comp.title, talentName),
          ]);
        }
      } catch (folderErr: any) {
        console.error("Auto-create contestant folders error (non-blocking):", folderErr.message);
      }
    }

    res.json(updated);
  });

  app.patch("/api/host/competitions/:id", firebaseAuth, requireHost, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

    const comp = await storage.getCompetition(id);
    if (!comp || comp.createdBy !== uid) {
      return res.status(403).json({ message: "Not your competition" });
    }

    const updateData = { ...req.body };
    if (updateData.maxImagesPerContestant !== undefined || updateData.maxVideosPerContestant !== undefined) {
      const settingsDoc = await getFirestore().collection("platformSettings").doc("global").get();
      const globalMaxImages = settingsDoc.exists ? (settingsDoc.data()?.maxImagesPerContestant ?? 10) : 10;
      const globalMaxVideos = settingsDoc.exists ? (settingsDoc.data()?.maxVideosPerContestant ?? 3) : 3;
      if (updateData.maxImagesPerContestant != null && updateData.maxImagesPerContestant > globalMaxImages) {
        updateData.maxImagesPerContestant = globalMaxImages;
      }
      if (updateData.maxVideosPerContestant != null && updateData.maxVideosPerContestant > globalMaxVideos) {
        updateData.maxVideosPerContestant = globalMaxVideos;
      }
    }

    const updated = await storage.updateCompetition(id, updateData);
    if (!updated) return res.status(404).json({ message: "Competition not found" });
    res.json(updated);
  });

  app.put("/api/host/competitions/:id/cover", firebaseAuth, requireHost, compCoverUpload.single("cover"), async (req, res) => {
    try {
      const { uid } = req.firebaseUser!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

      const comp = await storage.getCompetition(id);
      if (!comp || comp.createdBy !== uid) {
        return res.status(403).json({ message: "Not your competition" });
      }

      if (!req.file) return res.status(400).json({ message: "No file provided" });

      const isVideo = isVideoFile(req.file.originalname);

      if (isVideo) {
        const duration = await getVideoDurationFromBuffer(req.file.buffer);
        if (duration > 30) {
          return res.status(400).json({ message: `Video must be 30 seconds or less. Uploaded video is ${Math.round(duration)} seconds.` });
        }
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const storagePath = `covers/${id}-${Date.now()}${ext}`;
      const firebaseUrl = await uploadToFirebaseStorage(storagePath, req.file.buffer, req.file.mimetype);

      const updateData: any = {};
      if (isVideo) {
        updateData.coverVideo = firebaseUrl;
      } else {
        updateData.coverImage = firebaseUrl;
      }

      const updated = await storage.updateCompetition(id, updateData);
      if (!updated) return res.status(404).json({ message: "Competition not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Host cover upload error:", error);
      res.status(500).json({ message: "Failed to upload cover" });
    }
  });

  app.delete("/api/host/competitions/:id", firebaseAuth, requireHost, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

    const comp = await storage.getCompetition(id);
    if (!comp || comp.createdBy !== uid) {
      return res.status(403).json({ message: "Not your competition" });
    }

    await storage.deleteCompetition(id);
    res.json({ message: "Deleted" });
  });

  app.get("/api/host/competitions/:id/report", firebaseAuth, requireHost, async (req, res) => {
    const { uid } = req.firebaseUser!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

    const comp = await storage.getCompetition(id);
    if (!comp || comp.createdBy !== uid) {
      return res.status(403).json({ message: "Not your competition" });
    }

    const contestants = await storage.getContestantsByCompetition(id);
    const totalVotes = contestants.reduce((sum, c) => sum + c.voteCount, 0);
    const leaderboard = contestants
      .sort((a, b) => b.voteCount - a.voteCount)
      .map((c, i) => ({
        rank: i + 1,
        contestantId: c.id,
        displayName: c.talentProfile.displayName,
        voteCount: c.voteCount,
        votePercentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 100) : 0,
      }));

    const purchases = await storage.getVotePurchasesByCompetition(id);
    const totalRevenue = purchases.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      competition: comp,
      leaderboard,
      totalVotes,
      totalRevenue,
      totalContestants: contestants.length,
      totalPurchases: purchases.length,
    });
  });

  app.post("/api/admin/test-email", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { to, template } = req.body;
      if (!to) return res.status(400).json({ error: "Missing 'to' email address" });

      const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;

      if (template === "welcome") {
        await sendInviteEmail({
          to,
          inviterName: "The Quest Admin",
          role: "talent",
          siteUrl,
          nomineeName: "Sample Talent",
          nominatorName: "The Quest Admin",
          competitionName: "Sample Competition 2026",
          defaultPassword: "CBP2026!",
          accountCreated: true,
        });
      } else if (template === "receipt") {
        await sendPurchaseReceipt({
          to,
          buyerName: "Sample Buyer",
          items: [
            { description: "10 Votes Bundle", amount: "$9.99" },
            { description: "25 Votes Bundle", amount: "$19.99" },
          ],
          tax: "$2.50",
          total: "$32.48",
          transactionId: "TEST-" + Date.now(),
          competitionName: "Sample Competition 2026",
          contestantName: "Sample Talent",
        });
      } else {
        await sendTestEmail(to);
      }

      const templateLabel = template === "welcome" ? "Welcome/Invite" : template === "receipt" ? "Purchase Receipt" : "Generic Test";
      res.json({ success: true, message: `${templateLabel} email sent to ${to}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/contestants", firebaseAuth, requireAdmin, async (_req, res) => {
    const allContestants = await storage.getAllContestants();
    res.json(allContestants);
  });

  app.patch("/api/admin/contestants/:id/status", firebaseAuth, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid contestant ID" });

    const { status } = req.body;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await storage.updateContestantStatus(id, status);
    if (!updated) return res.status(404).json({ message: "Contestant not found" });

    if (status === "approved") {
      try {
        const profile = await storage.getTalentProfile(updated.talentProfileId);
        const comp = await storage.getCompetition(updated.competitionId);
        if (profile && comp) {
          const talentName = (profile.displayName || profile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
          await Promise.all([
            createContestantDriveFolders(comp.title, talentName),
            createContestantVimeoFolder(comp.title, talentName),
          ]);
        }
      } catch (folderErr: any) {
        console.error("Auto-create contestant folders error (non-blocking):", folderErr.message);
      }
    }

    res.json(updated);
  });

  app.delete("/api/admin/contestants/:id", firebaseAuth, requireHost, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid contestant ID" });

      const allContestants = await storage.getAllContestants();
      const contestant = allContestants.find(c => c.id === id);
      if (!contestant) return res.status(404).json({ message: "Contestant not found" });

      const isAdmin = req.firebaseUser!.level >= 4;
      if (!isAdmin) {
        const comp = await storage.getCompetition(contestant.competitionId);
        if (!comp || comp.createdBy !== req.firebaseUser!.uid) {
          return res.status(403).json({ message: "You can only remove contestants from your own competitions" });
        }
      }

      const deleted = await storage.deleteContestant(id);
      if (!deleted) return res.status(404).json({ message: "Contestant not found" });
      res.json({ message: "Contestant removed successfully" });
    } catch (error: any) {
      console.error("Delete contestant error:", error);
      res.status(500).json({ message: "Failed to remove contestant" });
    }
  });

  app.get("/api/admin/storage", firebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const [driveUsage, vimeoUsage] = await Promise.all([
        getDriveStorageUsage().catch(err => {
          console.error("Drive storage error:", err.message);
          return { totalFiles: 0, totalSizeBytes: 0, totalSizeMB: 0, folders: [] };
        }),
        getVimeoStorageUsage().catch(err => {
          console.error("Vimeo storage error:", err.message);
          return { usedGB: 0, totalGB: 0, usedPercent: 0, totalVideos: 0, folders: [] };
        }),
      ]);
      res.json({ drive: driveUsage, vimeo: vimeoUsage });
    } catch (error: any) {
      console.error("Storage usage error:", error);
      res.status(500).json({ message: error.message || "Failed to get storage usage" });
    }
  });

  app.get("/api/admin/stats", firebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const comps = await storage.getCompetitions();
      const profiles = await storage.getAllTalentProfiles();
      const allContestants = await storage.getAllContestants();

      let totalVotes = 0;
      const competitionStats = [];
      for (const comp of comps) {
        const compVotes = await storage.getTotalVotesByCompetition(comp.id);
        totalVotes += compVotes;
        const compContestants = allContestants.filter(c => c.competitionId === comp.id);
        competitionStats.push({
          id: comp.id,
          title: comp.title,
          category: comp.category,
          status: comp.status,
          totalVotes: compVotes,
          totalContestants: compContestants.length,
          pendingApplications: compContestants.filter(c => c.applicationStatus === "pending").length,
          approvedContestants: compContestants.filter(c => c.applicationStatus === "approved").length,
        });
      }

      const statusCounts: Record<string, number> = {};
      for (const comp of comps) {
        statusCounts[comp.status] = (statusCounts[comp.status] || 0) + 1;
      }

      const categoryCounts: Record<string, number> = {};
      for (const comp of comps) {
        categoryCounts[comp.category] = (categoryCounts[comp.category] || 0) + 1;
      }

      res.json({
        totalCompetitions: comps.length,
        totalTalentProfiles: profiles.length,
        totalContestants: allContestants.length,
        totalVotes,
        pendingApplications: allContestants.filter((c) => c.applicationStatus === "pending").length,
        competitionsByStatus: statusCounts,
        competitionsByCategory: categoryCounts,
        competitionStats,
      });
    } catch (error: any) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  app.get("/api/admin/competitions/:id/report", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

      const comp = await storage.getCompetition(id);
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const contestantsData = await storage.getContestantsByCompetition(id);
      const totalVotes = await storage.getTotalVotesByCompetition(id);
      const purchases = await storage.getVotePurchasesByCompetition(id);

      const totalRevenue = purchases.reduce((sum, p) => sum + p.amount, 0);
      const totalPurchasedVotes = purchases.reduce((sum, p) => sum + p.voteCount, 0);

      const leaderboard = contestantsData
        .sort((a, b) => b.voteCount - a.voteCount)
        .map((c, index) => ({
          rank: index + 1,
          contestantId: c.id,
          talentProfileId: c.talentProfileId,
          displayName: c.talentProfile.displayName,
          stageName: c.talentProfile.stageName,
          voteCount: c.voteCount,
          votePercentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 10000) / 100 : 0,
        }));

      res.json({
        competition: comp,
        totalVotes,
        totalContestants: contestantsData.length,
        totalRevenue,
        totalPurchasedVotes,
        totalPurchases: purchases.length,
        leaderboard,
      });
    } catch (error: any) {
      console.error("Competition report error:", error);
      res.status(500).json({ message: "Failed to get competition report" });
    }
  });

  app.get("/api/competitions/:id/leaderboard", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

      const comp = await storage.getCompetition(id);
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const contestantsData = await storage.getContestantsByCompetition(id);
      const totalVotes = await storage.getTotalVotesByCompetition(id);

      const leaderboard = contestantsData
        .sort((a, b) => b.voteCount - a.voteCount)
        .map((c, index) => ({
          rank: index + 1,
          contestantId: c.id,
          talentProfileId: c.talentProfileId,
          displayName: c.talentProfile.displayName,
          stageName: c.talentProfile.stageName,
          category: c.talentProfile.category,
          voteCount: c.voteCount,
          votePercentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 10000) / 100 : 0,
        }));

      res.json({ competitionId: id, totalVotes, leaderboard });
    } catch (error: any) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  app.get("/api/admin/users", firebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const profiles = await storage.getAllTalentProfiles();
      res.json(profiles);
    } catch (error: any) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.get("/api/admin/hosts", firebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const hostProfiles = await storage.getHostProfiles();
      const allComps = await storage.getCompetitions();
      const hosts = hostProfiles.map(h => {
        const hostComps = allComps.filter(c => c.createdBy === h.userId);
        return {
          ...h,
          competitionCount: hostComps.length,
          activeCompetitions: hostComps.filter(c => c.status === "active" || c.status === "voting").length,
        };
      });
      res.json(hosts);
    } catch (error: any) {
      console.error("Get hosts error:", error);
      res.status(500).json({ message: "Failed to get hosts" });
    }
  });

  app.get("/api/admin/hosts/:uid/competitions", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { uid } = req.params;
      const comps = await storage.getCompetitionsByCreator(uid);
      const result = [];
      for (const comp of comps) {
        const contestants = await storage.getContestantsByCompetition(comp.id);
        result.push({
          ...comp,
          contestants: contestants.map(c => ({
            id: c.id,
            talentProfileId: c.talentProfileId,
            applicationStatus: c.applicationStatus,
            displayName: c.talentProfile.displayName,
            stageName: c.talentProfile.stageName,
            category: c.talentProfile.category,
            imageUrls: c.talentProfile.imageUrls,
            imageBackupUrls: (c.talentProfile as any).imageBackupUrls || [],
            voteCount: c.voteCount,
          })),
        });
      }
      res.json(result);
    } catch (error: any) {
      console.error("Get host competitions error:", error);
      res.status(500).json({ message: "Failed to get host competitions" });
    }
  });

  app.patch("/api/admin/competitions/:id/assign-host", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });
      const { hostUid } = req.body;
      if (!hostUid) return res.status(400).json({ message: "hostUid is required" });
      const updated = await storage.updateCompetition(id, { createdBy: hostUid });
      if (!updated) return res.status(404).json({ message: "Competition not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Assign host error:", error);
      res.status(500).json({ message: "Failed to assign host" });
    }
  });

  app.put("/api/admin/competitions/:id/cover", firebaseAuth, requireAdmin, compCoverUpload.single("cover"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

      if (!req.file) return res.status(400).json({ message: "No file provided" });

      const isVideo = isVideoFile(req.file.originalname);

      if (isVideo) {
        const duration = await getVideoDurationFromBuffer(req.file.buffer);
        if (duration > 30) {
          return res.status(400).json({ message: `Video must be 30 seconds or less. Uploaded video is ${Math.round(duration)} seconds.` });
        }
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const storagePath = `covers/${id}-${Date.now()}${ext}`;
      const firebaseUrl = await uploadToFirebaseStorage(storagePath, req.file.buffer, req.file.mimetype);

      const updateData: any = {};
      if (isVideo) {
        updateData.coverVideo = firebaseUrl;
      } else {
        updateData.coverImage = firebaseUrl;
      }

      const updated = await storage.updateCompetition(id, updateData);
      if (!updated) return res.status(404).json({ message: "Competition not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Cover upload error:", error);
      res.status(500).json({ message: "Failed to upload cover" });
    }
  });

  app.delete("/api/admin/competitions/:id/cover", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });
      const { type } = req.query;
      const updateData: any = {};
      if (type === "video") {
        updateData.coverVideo = null;
      } else {
        updateData.coverImage = null;
      }
      const updated = await storage.updateCompetition(id, updateData);
      if (!updated) return res.status(404).json({ message: "Competition not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Cover delete error:", error);
      res.status(500).json({ message: "Failed to remove cover" });
    }
  });

  app.delete("/api/admin/users/:uid", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { uid } = req.params;

      const profile = await storage.getTalentProfileByUserId(uid);
      if (profile) {
        const contestantEntries = await storage.getContestantsByTalent(profile.id);
        for (const entry of contestantEntries) {
          await storage.deleteContestant(entry.id);
        }
      }

      await storage.deleteTalentProfileByUserId(uid);

      try {
        await getFirestore().collection("users").doc(uid).delete();
      } catch (e) {}

      try {
        await deleteFirebaseUser(uid);
      } catch (e) {}

      res.json({ message: "User fully deleted" });
    } catch (error: any) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.patch("/api/admin/users/:uid/level", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { uid } = req.params;
      const { level } = req.body;
      if (![1, 2, 3, 4].includes(level)) {
        return res.status(400).json({ message: "Level must be 1, 2, 3, or 4" });
      }

      await setUserLevel(uid, level);
      await updateFirestoreUser(uid, { level });

      const roleMap: Record<number, string> = { 1: "viewer", 2: "talent", 3: "host", 4: "admin" };
      await storage.updateTalentProfile(uid, { role: roleMap[level] as any });

      res.json({ message: "User level updated", uid, level });
    } catch (error: any) {
      console.error("Update user level error:", error);
      res.status(500).json({ message: "Failed to update user level" });
    }
  });

  app.post("/api/admin/users/create", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { email, password, displayName, level, stageName, socialLinks } = req.body;
      if (!email || !password || !displayName) {
        return res.status(400).json({ message: "Email, password, and display name are required" });
      }
      if (![1, 2, 3].includes(level)) {
        return res.status(400).json({ message: "Level must be 1, 2, or 3" });
      }

      const firebaseUser = await createFirebaseUser(email, password, displayName);
      await setUserLevel(firebaseUser.uid, level);

      await createFirestoreUser({
        uid: firebaseUser.uid,
        email,
        displayName,
        level,
        stageName: stageName || undefined,
        socialLinks: socialLinks || undefined,
      });

      const roleMap: Record<number, string> = { 1: "viewer", 2: "talent", 3: "host", 4: "admin" };
      await storage.createTalentProfile({
        userId: firebaseUser.uid,
        displayName,
        stageName: stageName || null,
        bio: null,
        category: null,
        location: null,
        imageUrls: [],
        videoUrls: [],
        socialLinks: socialLinks ? JSON.stringify(socialLinks) : null,
        role: roleMap[level],
      });

      res.status(201).json({
        uid: firebaseUser.uid,
        email,
        displayName,
        level,
      });
    } catch (error: any) {
      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({ message: "Email already in use" });
      }
      console.error("Admin create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/invitations", firebaseAuth, requireTalent, async (req, res) => {
    try {
      const { email, name, phone, targetLevel, message, competitionId, suggestedCategory, suggestedEventName } = req.body;
      if (!email || !name || !targetLevel) {
        return res.status(400).json({ message: "Email, name, and target level are required" });
      }

      const senderLevel = req.firebaseUser!.level;
      if (targetLevel > senderLevel) {
        return res.status(403).json({ message: "You can only invite users at your level or below" });
      }
      if (targetLevel < 1) {
        return res.status(400).json({ message: "Invalid target level" });
      }

      const senderUser = await getFirestoreUser(req.firebaseUser!.uid);
      const invitation = await firestoreInvitations.create({
        invitedBy: req.firebaseUser!.uid,
        invitedByEmail: req.firebaseUser!.email,
        invitedByName: senderUser?.displayName || req.firebaseUser!.email,
        invitedEmail: email,
        invitedName: name,
        invitedPhone: phone || undefined,
        targetLevel,
        message: message || undefined,
        suggestedCategory: suggestedCategory || undefined,
        suggestedEventName: suggestedEventName || undefined,
      });

      const siteUrl = process.env.SITE_URL || `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host || ""}`;
      const inviterName = senderUser?.displayName || req.firebaseUser!.email || "Someone";
      const roleName = targetLevel >= 4 ? "admin" : targetLevel >= 3 ? "host" : targetLevel >= 2 ? "talent" : "viewer";

      const DEFAULT_PASSWORD = "CBP2026!";
      const inviteeEmail = email.toLowerCase().trim();
      const inviteeName = name.trim();
      let accountCreated = false;

      try {
        let existingUser: any = null;
        let firebaseUid: string | null = null;
        try {
          existingUser = await getFirebaseAuth().getUserByEmail(inviteeEmail);
          firebaseUid = existingUser.uid;
        } catch (e: any) {
          if (e.code === "auth/user-not-found") {
            const newUser = await createFirebaseUser(inviteeEmail, DEFAULT_PASSWORD, inviteeName);
            firebaseUid = newUser.uid;
            await setUserLevel(firebaseUid, targetLevel);
            await createFirestoreUser({
              uid: firebaseUid,
              email: inviteeEmail,
              displayName: inviteeName,
              level: targetLevel,
            });
            accountCreated = true;
          } else {
            throw e;
          }
        }

        if (firebaseUid) {
          let existingProfile = await storage.getTalentProfileByUserId(firebaseUid);
          if (!existingProfile && targetLevel >= 2) {
            existingProfile = await storage.createTalentProfile({
              userId: firebaseUid,
              displayName: inviteeName,
              stageName: null,
              email: inviteeEmail,
              bio: null,
              category: null,
              location: "Hawaii",
              imageUrls: [],
              videoUrls: [],
              socialLinks: null,
              role: "talent",
            });
          }

          if (firebaseUid && existingProfile && competitionId && targetLevel >= 2) {
            try {
              const comp = await storage.getCompetition(Number(competitionId));
              if (comp) {
                if (comp.category && !existingProfile.category) {
                  await storage.updateTalentProfile(firebaseUid, { category: comp.category });
                }
                const existingContestant = await storage.getContestant(comp.id, existingProfile.id);
                if (!existingContestant) {
                  await storage.createContestant({
                    competitionId: comp.id,
                    talentProfileId: existingProfile.id,
                    applicationStatus: "approved",
                    appliedAt: new Date().toISOString(),
                  });
                }
              }
            } catch (contestantErr: any) {
              console.error("Auto-add invited contestant error (non-fatal):", contestantErr.message);
            }
          }
        }
      } catch (autoCreateErr: any) {
        console.error("Auto-create invited user account error (non-fatal):", autoCreateErr.message);
      }

      if (isEmailConfigured()) {
        sendInviteEmail({
          to: inviteeEmail,
          inviterName,
          inviteToken: accountCreated ? undefined : invitation.token,
          role: roleName,
          siteUrl,
          nomineeName: inviteeName,
          nominatorName: inviterName,
          defaultPassword: accountCreated ? DEFAULT_PASSWORD : undefined,
          accountCreated,
        }).catch(err => console.error("Invite email send failed:", err));
      }

      res.status(201).json(invitation);
    } catch (error: any) {
      console.error("Create invitation error:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations/sent", firebaseAuth, requireTalent, async (req, res) => {
    try {
      const invitations = await firestoreInvitations.getBySender(req.firebaseUser!.uid);
      res.json(invitations);
    } catch (error: any) {
      console.error("Get sent invitations error:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  app.get("/api/invitations/all", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const invitations = await firestoreInvitations.getAll();
      res.json(invitations);
    } catch (error: any) {
      console.error("Get all invitations error:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  app.get("/api/invitations/token/:token", async (req, res) => {
    try {
      const invitation = await firestoreInvitations.getByToken(req.params.token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: `Invitation has already been ${invitation.status}` });
      }
      res.json({
        invitedEmail: invitation.invitedEmail,
        invitedName: invitation.invitedName,
        invitedPhone: invitation.invitedPhone || null,
        targetLevel: invitation.targetLevel,
        invitedByName: invitation.invitedByName,
        message: invitation.message,
        suggestedCategory: invitation.suggestedCategory || null,
        suggestedEventName: invitation.suggestedEventName || null,
      });
    } catch (error: any) {
      console.error("Get invitation by token error:", error);
      res.status(500).json({ message: "Failed to get invitation" });
    }
  });

  app.delete("/api/invitations/:id", firebaseAuth, requireTalent, async (req, res) => {
    try {
      await firestoreInvitations.delete(req.params.id);
      res.json({ message: "Invitation deleted" });
    } catch (error: any) {
      console.error("Delete invitation error:", error);
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });

  app.get("/api/competitions/:id/detail", firebaseAuth, async (req, res) => {
    try {
      const { uid } = req.firebaseUser!;
      const profile = await storage.getTalentProfileByUserId(uid);
      const role = profile?.role;
      if (role !== "admin" && role !== "host") {
        return res.status(403).json({ message: "Admin or host access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid competition ID" });

      const comp = await storage.getCompetition(id);
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      if (role === "host" && comp.createdBy !== uid) {
        return res.status(403).json({ message: "Not your competition" });
      }

      const allContestantsRaw = await storage.getAllContestants();
      const compContestants = allContestantsRaw.filter(c => c.competitionId === id);
      const totalVotes = await storage.getTotalVotesByCompetition(id);

      let creatorRole: string | null = null;
      if (comp.createdBy) {
        const creatorProfile = await storage.getTalentProfileByUserId(comp.createdBy);
        creatorRole = creatorProfile?.role || null;
      }

      const hostSubs = await firestoreHostSubmissions.getAll();
      const matchingHosts = hostSubs.filter(h =>
        h.eventName?.toLowerCase().includes(comp.title.toLowerCase()) ||
        comp.title.toLowerCase().includes(h.eventName?.toLowerCase() || "")
      );

      const contestantDetails = [];
      for (const c of compContestants) {
        const voteCount = await storage.getVoteCountForContestantInCompetition(c.id, id);
        contestantDetails.push({
          id: c.id,
          talentProfileId: c.talentProfileId,
          applicationStatus: c.applicationStatus,
          appliedAt: c.appliedAt,
          displayName: c.talentProfile.displayName,
          stageName: (c.talentProfile as any).stageName || null,
          category: c.talentProfile.category,
          imageUrls: c.talentProfile.imageUrls,
          imageBackupUrls: (c.talentProfile as any).imageBackupUrls || [],
          bio: c.talentProfile.bio,
          email: (c.talentProfile as any).email || null,
          location: (c.talentProfile as any).location || null,
          socialLinks: (c.talentProfile as any).socialLinks || null,
          voteCount,
        });
      }

      res.json({
        competition: comp,
        totalVotes,
        createdByAdmin: creatorRole === "admin",
        hosts: matchingHosts.map(h => ({
          id: h.id,
          fullName: h.fullName,
          email: h.email,
          organization: h.organization,
          eventName: h.eventName,
          status: h.status,
          amountPaid: h.amountPaid,
        })),
        contestants: contestantDetails,
      });
    } catch (error: any) {
      console.error("Competition detail error:", error);
      res.status(500).json({ message: "Failed to get competition detail" });
    }
  });

  app.get("/api/admin/users/:profileId/detail", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const profile = await storage.getTalentProfile(profileId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const firestoreUser = await getFirestoreUser(profile.userId);

      const contestantEntries = await storage.getContestantsByTalent(profileId);

      const votingStats = [];
      for (const entry of contestantEntries) {
        const comp = await storage.getCompetition(entry.competitionId);
        if (!comp) continue;
        const voteCount = await storage.getVoteCountForContestantInCompetition(entry.id, entry.competitionId);
        const totalCompVotes = await storage.getTotalVotesByCompetition(entry.competitionId);
        const allContestants = await storage.getContestantsByCompetition(entry.competitionId);
        const sorted = allContestants.sort((a, b) => b.voteCount - a.voteCount);
        const rank = sorted.findIndex(c => c.id === entry.id) + 1;

        votingStats.push({
          competitionId: comp.id,
          competitionTitle: comp.title,
          competitionStatus: comp.status,
          applicationStatus: entry.applicationStatus,
          voteCount,
          totalVotes: totalCompVotes,
          votePercentage: totalCompVotes > 0 ? Math.round((voteCount / totalCompVotes) * 10000) / 100 : 0,
          rank: rank > 0 ? rank : null,
          totalContestants: allContestants.length,
        });
      }

      const talentName = ((profile as any).displayName || (profile as any).stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();

      const profileImageUrls = (profile as any).imageUrls || [];
      const driveImages = profileImageUrls.map((url: string, idx: number) => ({
        id: `img-${idx}`,
        name: url.split("/").pop() || `image-${idx}`,
        imageUrl: url,
        thumbnailUrl: url,
      }));

      let vimeoVideos: any[] = [];
      try {
        const rawVideos = await listAllTalentVideos(talentName);
        vimeoVideos = rawVideos.map(v => ({
          uri: v.uri,
          name: v.name,
          link: v.link,
          embedUrl: v.player_embed_url,
          duration: v.duration,
          thumbnail: getVideoThumbnail(v),
          competitionFolder: v.competitionFolder,
        }));
      } catch {}

      const activeStats = votingStats.filter(s => s.competitionStatus === "active" || s.competitionStatus === "voting");
      const pastStats = votingStats.filter(s => s.competitionStatus === "completed");
      const upcomingEvents = votingStats.filter(s => s.competitionStatus === "draft" && s.applicationStatus === "approved");

      res.json({
        profile: {
          ...profile,
          email: firestoreUser?.email || null,
          level: firestoreUser?.level || 2,
          socialLinks: (profile as any).socialLinks || firestoreUser?.socialLinks || null,
        },
        activeStats,
        pastStats,
        upcomingEvents,
        driveImages,
        vimeoVideos,
      });
    } catch (error: any) {
      console.error("User detail error:", error);
      res.status(500).json({ message: "Failed to get user detail" });
    }
  });

  app.post("/api/admin/users/:profileId/assign", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const profileId = parseInt(req.params.profileId);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const { competitionId } = req.body;
      if (!competitionId) return res.status(400).json({ message: "competitionId is required" });

      const compId = parseInt(competitionId);
      const profile = await storage.getTalentProfile(profileId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const comp = await storage.getCompetition(compId);
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const existing = await storage.getContestant(compId, profileId);
      if (existing) return res.status(400).json({ message: "Already assigned to this competition" });

      const contestant = await storage.createContestant({
        competitionId: compId,
        talentProfileId: profileId,
        applicationStatus: "approved",
        appliedAt: new Date().toISOString(),
      });

      try {
        const talentName = ((profile as any).displayName || (profile as any).stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
        await Promise.all([
          createContestantDriveFolders(comp.title, talentName),
          createContestantVimeoFolder(comp.title, talentName),
        ]);
      } catch (folderErr: any) {
        console.error("Auto-create assigned contestant folders error (non-blocking):", folderErr.message);
      }

      res.status(201).json(contestant);
    } catch (error: any) {
      console.error("Assign user error:", error);
      res.status(500).json({ message: "Failed to assign user to competition" });
    }
  });


  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await firestoreCategories.getAll();
      res.json(categories);
    } catch (error: any) {
      console.error("Get categories error:", error);
      res.status(500).json({ message: "Failed to get categories" });
    }
  });

  app.post("/api/admin/categories", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { name, description, imageUrl, videoUrl, order, isActive } = req.body;
      if (!name) return res.status(400).json({ message: "Category name is required" });

      const category = await firestoreCategories.create({
        name,
        description: description || "",
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        order: order || 0,
        isActive: isActive !== false,
      });
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Create category error:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch("/api/admin/categories/:id", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await firestoreCategories.update(id, req.body);
      if (!updated) return res.status(404).json({ message: "Category not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Update category error:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.put("/api/admin/categories/:id/media", firebaseAuth, requireAdmin, liveryUpload.single("file"), async (req, res) => {
    try {
      const { id } = req.params;
      const category = await firestoreCategories.get(id);
      if (!category) return res.status(404).json({ message: "Category not found" });
      if (!req.file) return res.status(400).json({ message: "No file provided" });

      const isVideo = isVideoFile(req.file.originalname);

      if (isVideo) {
        const duration = await getVideoDurationFromBuffer(req.file.buffer);
        if (duration > 15) {
          return res.status(400).json({ message: `Video must be 15 seconds or less. Uploaded video is ${Math.round(duration)} seconds.` });
        }
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const storagePath = `categories/${id}-${Date.now()}${ext}`;
      const firebaseUrl = await uploadToFirebaseStorage(storagePath, req.file.buffer, req.file.mimetype);

      const updateData: any = {};
      if (isVideo) {
        updateData.videoUrl = firebaseUrl;
        updateData.imageUrl = null;
      } else {
        updateData.imageUrl = firebaseUrl;
        updateData.videoUrl = null;
      }

      const updated = await firestoreCategories.update(id, updateData);
      res.json(updated);
    } catch (error: any) {
      console.error("Category media upload error:", error);
      res.status(500).json({ message: "Failed to upload category media" });
    }
  });

  app.delete("/api/admin/categories/:id", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await firestoreCategories.delete(id);
      res.json({ message: "Category deleted" });
    } catch (error: any) {
      console.error("Delete category error:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });


  app.get("/api/shop/packages", async (_req, res) => {
    try {
      const packages = await firestoreVotePackages.getActive();
      res.json(packages);
    } catch (error: any) {
      console.error("Get vote packages error:", error);
      res.status(500).json({ message: "Failed to get vote packages" });
    }
  });

  app.get("/api/admin/shop/packages", firebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const packages = await firestoreVotePackages.getAll();
      res.json(packages);
    } catch (error: any) {
      console.error("Get all vote packages error:", error);
      res.status(500).json({ message: "Failed to get vote packages" });
    }
  });

  app.post("/api/admin/shop/packages", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { name, description, voteCount, bonusVotes, price, isActive, order } = req.body;
      if (!name || !voteCount || price === undefined) {
        return res.status(400).json({ message: "name, voteCount, and price are required" });
      }

      const pkg = await firestoreVotePackages.create({
        name,
        description: description || "",
        voteCount,
        bonusVotes: bonusVotes || 0,
        price,
        isActive: isActive !== false,
        order: order || 0,
      });
      res.status(201).json(pkg);
    } catch (error: any) {
      console.error("Create vote package error:", error);
      res.status(500).json({ message: "Failed to create vote package" });
    }
  });

  app.patch("/api/admin/shop/packages/:id", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await firestoreVotePackages.update(id, req.body);
      if (!updated) return res.status(404).json({ message: "Vote package not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Update vote package error:", error);
      res.status(500).json({ message: "Failed to update vote package" });
    }
  });

  app.delete("/api/admin/shop/packages/:id", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await firestoreVotePackages.delete(id);
      res.json({ message: "Vote package deleted" });
    } catch (error: any) {
      console.error("Delete vote package error:", error);
      res.status(500).json({ message: "Failed to delete vote package" });
    }
  });


  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await firestoreSettings.get();
      res.json(settings || {
        siteName: "The Quest",
        siteDescription: "Competition & Voting Platform",
        contactEmail: "admin@thequest.com",
        defaultVoteCost: 0,
        defaultMaxVotesPerDay: 10,
      });
    } catch (error: any) {
      console.error("Get settings error:", error);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.put("/api/admin/settings", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const updated = await firestoreSettings.update(req.body);
      
      const minVoteCost = req.body.defaultVoteCost;
      if (minVoteCost !== undefined && minVoteCost > 0) {
        const allComps = await firestoreCompetitions.getAll();
        for (const comp of allComps) {
          if ((comp.voteCost ?? 0) < minVoteCost) {
            await firestoreCompetitions.update(comp.id, { voteCost: minVoteCost });
          }
        }
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Update settings error:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });


  app.post("/api/admin/enforce-min-vote-cost", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const platformDoc = await getFirestore().collection("platformSettings").doc("global").get();
      const minVoteCost = platformDoc.exists ? (platformDoc.data()?.defaultVoteCost ?? 0) : 0;
      if (minVoteCost <= 0) return res.json({ message: "No minimum set", updated: 0 });
      
      const allComps = await firestoreCompetitions.getAll();
      let updated = 0;
      for (const comp of allComps) {
        if ((comp.voteCost ?? 0) < minVoteCost) {
          await firestoreCompetitions.update(comp.id, { voteCost: minVoteCost });
          updated++;
        }
      }
      res.json({ message: `Updated ${updated} competitions to minimum vote cost $${minVoteCost}`, updated });
    } catch (error: any) {
      console.error("Enforce min vote cost error:", error);
      res.status(500).json({ message: "Failed to enforce min vote cost" });
    }
  });

  app.post("/api/admin/set-all-comp-dates", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, votingStartDate, votingEndDate, status } = req.body;
      const allComps = await firestoreCompetitions.getAll();
      let updated = 0;
      for (const comp of allComps) {
        const updateData: any = {};
        if (startDate !== undefined) { updateData.startDate = startDate; updateData.startDateTbd = false; }
        if (endDate !== undefined) { updateData.endDate = endDate; updateData.endDateTbd = false; }
        if (votingStartDate !== undefined) updateData.votingStartDate = votingStartDate;
        if (votingEndDate !== undefined) updateData.votingEndDate = votingEndDate;
        if (status !== undefined) updateData.status = status;
        await firestoreCompetitions.update(comp.id, updateData);
        updated++;
      }
      res.json({ message: `Updated ${updated} competitions`, updated });
    } catch (error: any) {
      console.error("Set all comp dates error:", error);
      res.status(500).json({ message: "Failed to update competition dates" });
    }
  });

  app.get("/api/join/settings", async (_req, res) => {
    try {
      const settings = await firestoreJoinSettings.get();
      const { freeNominationPromoCode, ...publicSettings } = settings;
      res.json({ ...publicSettings, hasPromoCode: !!freeNominationPromoCode });
    } catch (error: any) {
      console.error("Get join settings error:", error);
      res.status(500).json({ message: "Failed to get join settings" });
    }
  });

  app.post("/api/join/validate-promo", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ valid: false });
      const settings = await firestoreJoinSettings.get();
      const valid = !!(settings.freeNominationPromoCode && code.trim().toUpperCase() === settings.freeNominationPromoCode.trim().toUpperCase());
      res.json({ valid });
    } catch (error: any) {
      res.status(500).json({ valid: false });
    }
  });

  app.get("/api/admin/join/settings", firebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const settings = await firestoreJoinSettings.get();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to load join settings" });
    }
  });

  app.put("/api/admin/join/settings", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const updated = await firestoreJoinSettings.update(req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Update join settings error:", error);
      res.status(500).json({ message: "Failed to update join settings" });
    }
  });

  app.post("/api/join/submit", async (req, res) => {
    try {
      const settings = await firestoreJoinSettings.get();
      if (!settings.isActive) {
        return res.status(400).json({ message: "Join applications are currently closed" });
      }

      const { fullName, email, phone, address, city, state, zip, bio, category, socialLinks, mediaUrls, competitionId, dataDescriptor, dataValue, chosenNonprofit } = req.body;
      if (!fullName || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      if (!competitionId) {
        return res.status(400).json({ message: "Please select a competition to apply for" });
      }
      if (settings.nonprofitRequired && !chosenNonprofit?.trim()) {
        return res.status(400).json({ message: "Choice of Non-Profit is required" });
      }

      let transactionId: string | null = null;
      let amountPaid = 0;
      if (settings.mode === "purchase" && settings.price > 0) {
        if (!dataDescriptor || !dataValue) {
          return res.status(400).json({ message: "Payment is required to join" });
        }
        const chargeResult = await chargePaymentNonce(
          settings.price / 100,
          dataDescriptor,
          dataValue,
          `Join competition application`,
          email,
          fullName,
        );
        transactionId = chargeResult.transactionId;
        amountPaid = settings.price;
      }

      const autoApproved = settings.mode === "purchase" && amountPaid > 0;
      const submission = await firestoreJoinSubmissions.create({
        competitionId: competitionId || null,
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        bio: bio || null,
        category: category || null,
        socialLinks: socialLinks || null,
        mediaUrls: mediaUrls || [],
        transactionId,
        amountPaid,
        type: "application",
        chosenNonprofit: chosenNonprofit?.trim() || null,
        nominatorName: null,
        nominatorEmail: null,
        nominatorPhone: null,
        nominationStatus: null,
      });

      if (autoApproved) {
        await firestoreJoinSubmissions.updateStatus(submission.id, "approved");
        if (competitionId) {
          try {
            const comp = await storage.getCompetition(competitionId);
            if (comp) {
              const safeTalentName = fullName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "_");
              await Promise.all([
                createContestantDriveFolders(comp.title, safeTalentName),
                createContestantVimeoFolder(comp.title, safeTalentName),
              ]);
            }
          } catch (folderErr: any) {
            console.error("Auto-create join contestant folders error (non-blocking):", folderErr.message);
          }
        }
      }

      res.status(201).json({ ...submission, status: autoApproved ? "approved" : submission.status });
    } catch (error: any) {
      console.error("Join submission error:", error);
      if (error.errorMessage) {
        return res.status(400).json({ message: `Payment failed: ${error.errorMessage}` });
      }
      res.status(500).json({ message: "Submission failed. Please try again." });
    }
  });

  const nominationImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
      if (allowed.test(path.extname(file.originalname))) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });

  app.post("/api/join/nomination-image", nominationImageUpload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No image file provided" });
      const ext = path.extname(req.file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const storagePath = `nominations/${uniqueName}`;
      const url = await uploadToFirebaseStorage(storagePath, req.file.buffer, req.file.mimetype);
      res.json({ url });
    } catch (error: any) {
      console.error("Nomination image upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.post("/api/join/nominate", async (req, res) => {
    try {
      const settings = await firestoreJoinSettings.get();
      if (!settings.isActive) {
        return res.status(400).json({ message: "Join applications are currently closed" });
      }
      if (!settings.nominationEnabled) {
        return res.status(400).json({ message: "Nominations are not currently accepted" });
      }

      const { fullName, email, phone, bio, category, competitionId, nominatorName, nominatorEmail, nominatorPhone, dataDescriptor, dataValue, chosenNonprofit, mediaUrls, promoCode } = req.body;
      if (!fullName || !email) {
        return res.status(400).json({ message: "Nominee name and email are required" });
      }
      if (!nominatorName || !nominatorEmail) {
        return res.status(400).json({ message: "Your name and email are required" });
      }
      if (!competitionId) {
        return res.status(400).json({ message: "Please select a competition" });
      }
      if (settings.nonprofitRequired && !chosenNonprofit?.trim()) {
        return res.status(400).json({ message: "Choice of Non-Profit is required" });
      }

      const promoValid = !!(promoCode && settings.freeNominationPromoCode && promoCode.trim().toUpperCase() === settings.freeNominationPromoCode.trim().toUpperCase());

      let transactionId: string | null = null;
      let amountPaid = 0;
      if (settings.nominationFee > 0 && !promoValid) {
        if (!dataDescriptor || !dataValue) {
          return res.status(400).json({ message: "Payment is required for nominations" });
        }
        const chargeResult = await chargePaymentNonce(
          settings.nominationFee / 100,
          dataDescriptor,
          dataValue,
          `Nomination fee for ${fullName}`,
          nominatorEmail,
          nominatorName,
        );
        transactionId = chargeResult.transactionId;
        amountPaid = settings.nominationFee;
      }

      const nomineeEmail = email.toLowerCase().trim();
      const nomineeName = fullName.trim();
      const DEFAULT_PASSWORD = "CBP2026!";

      let firebaseUid: string | null = null;
      let talentProfileId: number | null = null;
      let contestantId: number | null = null;
      let emailSent = false;

      try {
        let existingUser: any = null;
        try {
          existingUser = await getFirebaseAuth().getUserByEmail(nomineeEmail);
          firebaseUid = existingUser.uid;
        } catch (e: any) {
          if (e.code === "auth/user-not-found") {
            const newUser = await createFirebaseUser(nomineeEmail, DEFAULT_PASSWORD, nomineeName);
            firebaseUid = newUser.uid;
            await setUserLevel(firebaseUid, 2);
            await createFirestoreUser({
              uid: firebaseUid,
              email: nomineeEmail,
              displayName: nomineeName,
              level: 2,
            });
          } else {
            throw e;
          }
        }

        if (firebaseUid) {
          let existingProfile = await storage.getTalentProfileByUserId(firebaseUid);
          if (!existingProfile) {
            existingProfile = await storage.createTalentProfile({
              userId: firebaseUid,
              displayName: nomineeName,
              stageName: null,
              email: nomineeEmail,
              bio: bio || null,
              category: category || null,
              location: "Hawaii",
              imageUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
              videoUrls: [],
              socialLinks: null,
              role: "talent",
            });
          }
          talentProfileId = existingProfile.id;

          if (competitionId && talentProfileId) {
            const existingContestant = await storage.getContestant(Number(competitionId), talentProfileId);
            if (!existingContestant) {
              const newContestant = await storage.createContestant({
                competitionId: Number(competitionId),
                talentProfileId,
                applicationStatus: "approved",
                appliedAt: new Date().toISOString(),
              });
              contestantId = newContestant.id;
            } else {
              contestantId = existingContestant.id;
            }
          }

          if (!existingUser) {
            let competitionName = "a competition on The Quest";
            if (competitionId) {
              const comp = await storage.getCompetition(Number(competitionId));
              if (comp) competitionName = comp.title;
            }
            const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
            emailSent = await sendInviteEmail({
              to: nomineeEmail,
              inviterName: nominatorName.trim(),
              role: "talent",
              siteUrl,
              nomineeName,
              nominatorName: nominatorName.trim(),
              competitionName,
              defaultPassword: DEFAULT_PASSWORD,
              accountCreated: true,
            });
          }
        }
      } catch (autoCreateErr: any) {
        console.error("Auto-create nominee account error (non-fatal):", autoCreateErr.message);
      }

      const submission = await firestoreJoinSubmissions.create({
        competitionId: competitionId || null,
        fullName: nomineeName,
        email: nomineeEmail,
        phone: phone || null,
        address: null,
        city: null,
        state: null,
        zip: null,
        bio: bio || null,
        category: category || null,
        socialLinks: null,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
        transactionId,
        amountPaid,
        type: "nomination",
        chosenNonprofit: chosenNonprofit?.trim() || null,
        nominatorName: nominatorName.trim(),
        nominatorEmail: nominatorEmail.toLowerCase().trim(),
        nominatorPhone: nominatorPhone || null,
        nominationStatus: "joined",
      });

      await firestoreJoinSubmissions.updateStatus(submission.id, "approved");

      res.status(201).json({
        ...submission,
        accountCreated: !!firebaseUid,
        talentProfileId,
        contestantId,
        emailSent,
      });
    } catch (error: any) {
      console.error("Nomination submission error:", error);
      if (error.errorMessage) {
        return res.status(400).json({ message: `Payment failed: ${error.errorMessage}` });
      }
      res.status(500).json({ message: "Nomination failed. Please try again." });
    }
  });

  app.patch("/api/admin/join/submissions/:id/nomination-status", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { nominationStatus } = req.body;
      if (!["pending", "joined", "unsure", "not_interested"].includes(nominationStatus)) {
        return res.status(400).json({ message: "Invalid nomination status" });
      }
      const updated = await firestoreJoinSubmissions.updateNominationStatus(req.params.id, nominationStatus);
      if (!updated) return res.status(404).json({ message: "Submission not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Update nomination status error:", error);
      res.status(500).json({ message: "Failed to update nomination status" });
    }
  });

  app.get("/api/admin/join/submissions", firebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const submissions = await firestoreJoinSubmissions.getAll();
      res.json(submissions);
    } catch (error: any) {
      console.error("Get join submissions error:", error);
      res.status(500).json({ message: "Failed to get submissions" });
    }
  });

  app.patch("/api/admin/join/submissions/:id/status", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const updated = await firestoreJoinSubmissions.updateStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ message: "Submission not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Update join submission error:", error);
      res.status(500).json({ message: "Failed to update submission" });
    }
  });

  app.get("/api/host/settings", async (_req, res) => {
    try {
      const settings = await firestoreHostSettings.get();
      res.json(settings);
    } catch (error: any) {
      console.error("Get host settings error:", error);
      res.status(500).json({ message: "Failed to get host settings" });
    }
  });

  app.put("/api/admin/host/settings", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const updated = await firestoreHostSettings.update(req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Update host settings error:", error);
      res.status(500).json({ message: "Failed to update host settings" });
    }
  });

  app.post("/api/host/submit", async (req, res) => {
    try {
      const settings = await firestoreHostSettings.get();
      if (!settings.isActive) {
        return res.status(400).json({ message: "Host applications are currently closed" });
      }

      const { fullName, email, phone, organization, address, city, state, zip, eventName, eventDescription, eventCategory, eventDate, socialLinks, mediaUrls, dataDescriptor, dataValue, selectedPackageName, selectedPackagePrice, inviteToken } = req.body;
      if (!fullName || !email || !eventName) {
        return res.status(400).json({ message: "Name, email, and event name are required" });
      }

      let transactionId: string | null = null;
      let amountPaid = 0;
      let verifiedPackageName = selectedPackageName || null;
      let verifiedPackagePrice = 0;

      if (selectedPackageName) {
        const db = getFirestore();
        const settingsDoc = await db.collection("platformSettings").doc("global").get();
        const platformData = settingsDoc.exists ? settingsDoc.data() : null;
        const packages = platformData?.hostingPackages || [
          { name: "Starter", price: 49, maxContestants: 5, revenueSharePercent: 20 },
          { name: "Pro", price: 149, maxContestants: 15, revenueSharePercent: 35 },
          { name: "Premium", price: 399, maxContestants: 25, revenueSharePercent: 50 },
        ];
        const matchedPkg = packages.find((p: any) => p.name === selectedPackageName);
        if (!matchedPkg) {
          return res.status(400).json({ message: "Invalid hosting package selected" });
        }
        verifiedPackageName = matchedPkg.name;
        verifiedPackagePrice = matchedPkg.price;
      }

      if (verifiedPackagePrice > 0) {
        if (!dataDescriptor || !dataValue) {
          return res.status(400).json({ message: "Payment is required for the selected hosting package" });
        }
        const chargeResult = await chargePaymentNonce(
          verifiedPackagePrice,
          dataDescriptor,
          dataValue,
          `Host package (${verifiedPackageName}): ${eventName}`,
          email,
          fullName,
        );
        transactionId = chargeResult.transactionId;
        amountPaid = Math.round(verifiedPackagePrice * 100);
      }

      const submission = await firestoreHostSubmissions.create({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || null,
        organization: organization || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        eventName: eventName.trim(),
        eventDescription: eventDescription || null,
        eventCategory: eventCategory || null,
        eventDate: eventDate || null,
        socialLinks: socialLinks || null,
        mediaUrls: mediaUrls || [],
        transactionId,
        amountPaid,
        selectedPackageName: verifiedPackageName || null,
        selectedPackagePrice: verifiedPackagePrice || 0,
      });

      if (inviteToken) {
        try {
          const db = getFirestore();
          const invSnap = await db.collection("invitations").where("token", "==", inviteToken).limit(1).get();
          if (!invSnap.empty) {
            await invSnap.docs[0].ref.update({ status: "accepted", acceptedAt: new Date().toISOString() });
          }
        } catch (invErr) {
          console.warn("Failed to mark invitation as accepted:", invErr);
        }
      }

      res.status(201).json(submission);
    } catch (error: any) {
      console.error("Host submission error:", error);
      if (error.errorMessage) {
        return res.status(400).json({ message: `Payment failed: ${error.errorMessage}` });
      }
      res.status(500).json({ message: "Submission failed. Please try again." });
    }
  });

  app.get("/api/admin/host/submissions", firebaseAuth, requireAdmin, async (_req, res) => {
    try {
      const submissions = await firestoreHostSubmissions.getAll();
      res.json(submissions);
    } catch (error: any) {
      console.error("Get host submissions error:", error);
      res.status(500).json({ message: "Failed to get submissions" });
    }
  });

  app.patch("/api/admin/host/submissions/:id/status", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const updated = await firestoreHostSubmissions.updateStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ message: "Submission not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Update host submission error:", error);
      res.status(500).json({ message: "Failed to update submission" });
    }
  });


  app.get("/api/payment-config", (_req, res) => {
    const config = getPublicConfig();
    res.json(config);
  });

  const guestCheckoutSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
    competitionId: z.number().int().positive(),
    contestantId: z.number().int().positive(),
    packageId: z.string().min(1, "Package is required"),
    packageIndex: z.number().int().min(0).optional(),
    individualVoteCount: z.number().int().min(1).max(10000).optional(),
    createAccount: z.boolean().default(false),
    dataDescriptor: z.string().min(1, "Payment token is required"),
    dataValue: z.string().min(1, "Payment token is required"),
  });

  app.post("/api/guest/checkout", async (req, res) => {
    try {
      const parsed = guestCheckoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid data" });
      }

      const { name, email, competitionId, contestantId, packageId, packageIndex, individualVoteCount, createAccount, dataDescriptor, dataValue } = parsed.data;

      const comp = await storage.getCompetition(competitionId);
      if (!comp) return res.status(404).json({ message: "Competition not found" });
      if (comp.status !== "voting" && comp.status !== "active") {
        return res.status(400).json({ message: "Voting is not open for this competition" });
      }

      let pkg: { voteCount: number; bonusVotes: number; price: number; name: string } | null = null;

      if (packageId === "individual" && individualVoteCount) {
        const settingsDoc = await getFirestore().collection("platformSettings").doc("global").get();
        const settings = settingsDoc.exists ? settingsDoc.data() : null;
        const pricePerVote = settings?.pricePerVote || 1;
        const totalPrice = individualVoteCount * pricePerVote * 100;
        pkg = { voteCount: individualVoteCount, bonusVotes: 0, price: totalPrice, name: `${individualVoteCount} Individual Vote${individualVoteCount !== 1 ? "s" : ""}` };
      } else if (packageIndex !== undefined) {
        const settingsDoc = await getFirestore().collection("platformSettings").doc("global").get();
        const settings = settingsDoc.exists ? settingsDoc.data() : null;
        const votePackages = settings?.votePackages || [
          { name: "Starter Pack", voteCount: 500, bonusVotes: 0, price: 10 },
          { name: "Fan Pack", voteCount: 1000, bonusVotes: 300, price: 15 },
          { name: "Super Fan Pack", voteCount: 2000, bonusVotes: 600, price: 30 },
        ];
        if (packageIndex >= 0 && packageIndex < votePackages.length) {
          const vpkg = votePackages[packageIndex];
          pkg = { voteCount: vpkg.voteCount, bonusVotes: vpkg.bonusVotes || 0, price: vpkg.price * 100, name: vpkg.name };
        }
      }

      if (!pkg) {
        const firestorePkg = await firestoreVotePackages.get(packageId);
        if (firestorePkg && firestorePkg.isActive) {
          pkg = { voteCount: firestorePkg.voteCount, bonusVotes: firestorePkg.bonusVotes || 0, price: firestorePkg.price, name: firestorePkg.name };
        }
      }

      if (!pkg) return res.status(404).json({ message: "Vote package not found" });

      const totalVotes = pkg.voteCount + (pkg.bonusVotes || 0);
      const subtotalDollars = pkg.price / 100;

      const settingsForTax = await getFirestore().collection("platformSettings").doc("global").get();
      const salesTaxPercent = settingsForTax.exists ? (settingsForTax.data()?.salesTaxPercent || 0) : 0;
      const taxAmount = subtotalDollars * (salesTaxPercent / 100);
      const amountInDollars = Math.round((subtotalDollars + taxAmount) * 100) / 100;

      const chargeResult = await chargePaymentNonce(
        amountInDollars,
        dataDescriptor,
        dataValue,
        `${totalVotes} votes for ${comp.title}`,
        email,
        name,
      );

      let viewerId: string | null = null;
      if (createAccount) {
        const viewer = await firestoreViewerProfiles.getOrCreate(email, name);
        viewerId = viewer.id;
        await firestoreViewerProfiles.recordPurchase(viewer.id, totalVotes, pkg.price);
      }

      const purchase = await firestoreVotePurchases.create({
        userId: null,
        viewerId,
        guestEmail: email.toLowerCase().trim(),
        guestName: name.trim(),
        competitionId,
        contestantId,
        voteCount: totalVotes,
        amount: pkg.price,
        transactionId: chargeResult.transactionId,
      });

      await storage.castBulkVotes({
        contestantId,
        competitionId,
        userId: viewerId || `guest_${purchase.id}`,
        purchaseId: purchase.id,
        voteCount: totalVotes,
      });

      if (isEmailConfigured() && email) {
        const contestant = await storage.getContestant(contestantId);
        const contestantName = contestant?.talentProfile?.displayName || undefined;
        sendPurchaseReceipt({
          to: email,
          buyerName: name,
          items: [{ description: pkg.name, amount: `$${subtotalDollars.toFixed(2)}` }],
          total: `$${amountInDollars.toFixed(2)}`,
          tax: salesTaxPercent > 0 ? `$${taxAmount.toFixed(2)}` : undefined,
          transactionId: chargeResult.transactionId,
          competitionName: comp.title,
          contestantName,
        }).catch(err => console.error("Receipt email send failed:", err));
      }

      res.status(201).json({
        success: true,
        purchase,
        transactionId: chargeResult.transactionId,
        votesAdded: pkg.voteCount,
        accountCreated: createAccount,
        viewerId,
      });
    } catch (error: any) {
      console.error("Guest checkout error:", error);
      if (error.errorMessage) {
        return res.status(400).json({ message: `Payment failed: ${error.errorMessage}` });
      }
      res.status(500).json({ message: "Checkout failed. Please try again." });
    }
  });

  const guestLookupSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
  });

  app.post("/api/guest/lookup", async (req, res) => {
    try {
      const parsed = guestLookupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid data" });
      }

      const { name, email } = parsed.data;
      const viewer = await firestoreViewerProfiles.lookup(email, name);
      if (!viewer) {
        return res.status(404).json({ message: "No account found with that name and email. Make sure they match exactly what you used at checkout." });
      }

      const purchases = await firestoreVotePurchases.getByViewer(viewer.id);

      const purchaseDetails = [];
      for (const p of purchases) {
        const comp = await storage.getCompetition(p.competitionId);
        purchaseDetails.push({
          ...p,
          competitionTitle: comp?.title || "Unknown Competition",
          competitionCategory: comp?.category || "",
        });
      }

      res.json({
        viewer,
        purchases: purchaseDetails,
      });
    } catch (error: any) {
      console.error("Guest lookup error:", error);
      res.status(500).json({ message: "Lookup failed" });
    }
  });


  app.get("/api/platform-settings", async (_req, res) => {
    try {
      const db = getFirestore();
      const doc = await db.collection("platformSettings").doc("global").get();
      if (!doc.exists) {
        res.json({
          hostingPackages: [
            { name: "Starter", price: 49, maxContestants: 5, revenueSharePercent: 20, description: "Up to 5 competitors per event" },
            { name: "Pro", price: 149, maxContestants: 15, revenueSharePercent: 35, description: "Up to 15 competitors per event" },
            { name: "Premium", price: 399, maxContestants: 25, revenueSharePercent: 50, description: "25+ competitors with top revenue share" },
          ],
          votePackages: [
            { name: "Starter Pack", voteCount: 500, bonusVotes: 0, price: 10, description: "500 votes to support your favorite" },
            { name: "Fan Pack", voteCount: 1000, bonusVotes: 300, price: 15, description: "1,000 votes + 300 bonus votes" },
            { name: "Super Fan Pack", voteCount: 2000, bonusVotes: 600, price: 30, description: "2,000 votes + 600 bonus votes" },
          ],
          salesTaxPercent: 0,
          maxImagesPerContestant: 10,
          maxVideosPerContestant: 3,
          defaultVoteCost: 0,
          freeVotesPerDay: 5,
          votePricePerVote: 1,
          joinPrice: 0,
          hostPrice: 0,
        });
        return;
      }
      res.json(doc.data());
    } catch (error: any) {
      console.error("Platform settings error:", error);
      res.status(500).json({ message: "Failed to get platform settings" });
    }
  });

  app.put("/api/admin/platform-settings", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const fsDb = getFirestore();
      const settings = req.body;
      await fsDb.collection("platformSettings").doc("global").set(settings, { merge: true });

      if (settings.defaultVoteCost !== undefined && settings.defaultVoteCost > 0) {
        const minVoteCost = settings.defaultVoteCost;
        const allComps = await firestoreCompetitions.getAll();
        let enforced = 0;
        for (const comp of allComps) {
          if ((comp.voteCost ?? 0) < minVoteCost) {
            await firestoreCompetitions.update(comp.id, { voteCost: minVoteCost });
            enforced++;
          }
        }
        if (enforced > 0) {
          console.log(`[Settings] Enforced min vote cost $${minVoteCost} on ${enforced} competitions`);
        }
      }

      res.json({ message: "Settings saved", ...settings });
    } catch (error: any) {
      console.error("Save platform settings error:", error);
      res.status(500).json({ message: "Failed to save platform settings" });
    }
  });

  app.get("/api/livery", async (_req, res) => {
    const items = await storage.getAllLivery();
    res.json(items);
  });

  app.put("/api/admin/livery/:imageKey", firebaseAuth, requireAdmin, liveryUpload.single("image"), async (req, res) => {
    const { imageKey } = req.params;
    const existing = await storage.getLiveryByKey(imageKey);
    if (!existing) return res.status(404).json({ message: "Livery item not found" });

    let imageUrl: string | null = null;
    let mediaType: "image" | "video" = "image";

    if (req.file) {
      if (isVideoFile(req.file.originalname)) {
        mediaType = "video";
      }
      const ext = path.extname(req.file.originalname).toLowerCase();
      const storagePath = `livery/${imageKey}${ext}`;
      try {
        imageUrl = await uploadToFirebaseStorage(storagePath, req.file.buffer, req.file.mimetype);
      } catch (err: any) {
        console.error("Firebase Storage livery upload error:", err);
        return res.status(500).json({ message: "Failed to upload to storage: " + err.message });
      }
    } else if (req.body.imageUrl !== undefined) {
      imageUrl = req.body.imageUrl || null;
      if (req.body.mediaType === "video") mediaType = "video";
    }

    const updated = await storage.updateLiveryImage(imageKey, imageUrl, mediaType);
    res.json(updated);
  });

  app.put("/api/admin/livery/:imageKey/url", firebaseAuth, requireAdmin, async (req, res) => {
    const { imageKey } = req.params;
    const { url } = req.body;
    const existing = await storage.getLiveryByKey(imageKey);
    if (!existing) return res.status(404).json({ message: "Livery item not found" });
    const updated = await storage.updateLiveryImage(imageKey, url || null, "image");
    res.json(updated);
  });

  app.put("/api/admin/livery/:imageKey/text", firebaseAuth, requireAdmin, async (req, res) => {
    const { imageKey } = req.params;
    const { textContent } = req.body;
    const existing = await storage.getLiveryByKey(imageKey);
    if (!existing) return res.status(404).json({ message: "Livery item not found" });
    const updated = await storage.updateLiveryText(imageKey, textContent ?? null);
    res.json(updated);
  });

  app.delete("/api/admin/livery/:imageKey", firebaseAuth, requireAdmin, async (req, res) => {
    const { imageKey } = req.params;
    const updated = await storage.updateLiveryImage(imageKey, null);
    if (!updated) return res.status(404).json({ message: "Livery item not found" });
    res.json(updated);
  });

  app.delete("/api/admin/livery/:imageKey/permanent", firebaseAuth, requireAdmin, async (req, res) => {
    const { imageKey } = req.params;
    const existing = await storage.getLiveryByKey(imageKey);
    if (!existing) return res.status(404).json({ message: "Livery item not found" });
    const relatedKeys = [imageKey, `${imageKey}_title`, `${imageKey}_desc`];
    for (const key of relatedKeys) {
      try { await storage.deleteLiverySlot(key); } catch {}
    }
    res.json({ success: true });
  });

  app.post("/api/drive/upload", firebaseAuth, talentImageUpload.single("image"), async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const profile = await storage.getTalentProfileByUserId(uid);
      if (!profile) return res.status(400).json({ message: "Create a talent profile first" });

      if (!req.file) return res.status(400).json({ message: "No image file provided" });

      const { competitionId } = req.body;
      if (!competitionId) return res.status(400).json({ message: "competitionId is required" });

      const comp = await storage.getCompetition(parseInt(competitionId));
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const settingsDoc = await getFirestore().collection("platformSettings").doc("global").get();
      const globalMaxImages = settingsDoc.exists ? (settingsDoc.data()?.maxImagesPerContestant ?? 10) : 10;
      const compMaxImages = comp.maxImagesPerContestant;
      const maxImages = compMaxImages != null ? Math.min(compMaxImages, globalMaxImages) : globalMaxImages;

      const currentUrls = profile.imageUrls || [];
      if (currentUrls.length >= maxImages) {
        return res.status(400).json({ message: `Upload limit reached. Maximum ${maxImages} images allowed per contestant.` });
      }

      const talentName = (profile.displayName || profile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
      const uniqueName = generateUniqueFilename(req.file.originalname);
      const storagePath = `talent-images/${comp.title}/${talentName}/${uniqueName}`;

      const firebaseUrl = await uploadToFirebaseStorage(
        storagePath,
        req.file.buffer,
        req.file.mimetype
      );

      let primaryUrl = firebaseUrl;
      let driveFileId: string | null = null;
      try {
        const result = await uploadImageToDrive(
          comp.title,
          talentName,
          req.file.originalname,
          req.file.mimetype,
          req.file.buffer
        );
        driveFileId = result.id;
        primaryUrl = getDriveImageUrl(result.id);
      } catch (driveErr: any) {
        console.log("Google Drive upload skipped, using Firebase Storage:", driveErr.message?.substring(0, 100));
      }

      const backupRef = getFirestore().collection("imageBackups").doc();
      await backupRef.set({
        talentProfileId: profile.id,
        userId: uid,
        primaryUrl,
        firebaseUrl,
        storagePath,
        driveFileId,
        competitionId: comp.id,
        createdAt: new Date().toISOString(),
      });

      const currentBackupUrls = (profile as any).imageBackupUrls || [];
      await storage.updateTalentProfile(uid, {
        imageUrls: [...currentUrls, primaryUrl],
        imageBackupUrls: [...currentBackupUrls, firebaseUrl],
      });

      res.json({
        fileId: driveFileId || uniqueName,
        imageUrl: primaryUrl,
        thumbnailUrl: driveFileId ? getDriveThumbnailUrl(driveFileId) : firebaseUrl,
        fallbackUrl: firebaseUrl,
        driveSync: !!driveFileId,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.get("/api/drive/images", firebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const profile = await storage.getTalentProfileByUserId(uid);
      if (!profile) return res.json([]);

      const imageUrls = profile.imageUrls || [];
      const backupUrls = (profile as any).imageBackupUrls || [];

      res.json(imageUrls.map((url: string, idx: number) => ({
        id: `img-${idx}`,
        name: url.split("/").pop() || `image-${idx}`,
        imageUrl: url,
        thumbnailUrl: url,
        fallbackUrl: backupUrls[idx] || null,
      })));
    } catch (error: any) {
      console.error("Image list error:", error);
      res.status(500).json({ message: "Failed to list images" });
    }
  });

  app.delete("/api/drive/images/:fileId", firebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const profile = await storage.getTalentProfileByUserId(uid);
      if (!profile) return res.status(400).json({ message: "Profile not found" });

      const { fileId } = req.params;
      const currentUrls = profile.imageUrls || [];

      const imageIndex = parseInt(fileId.replace("img-", ""));
      const imageUrl = currentUrls[imageIndex];
      if (!imageUrl) return res.status(404).json({ message: "Image not found" });

      const backupsSnap = await getFirestore().collection("imageBackups")
        .where("userId", "==", uid)
        .where("primaryUrl", "==", imageUrl)
        .limit(1)
        .get();

      if (!backupsSnap.empty) {
        const backupData = backupsSnap.docs[0].data();

        if (backupData.storagePath) {
          try {
            await deleteFromFirebaseStorage(backupData.storagePath);
          } catch {}
        }

        if (backupData.driveFileId) {
          try {
            await deleteFile(backupData.driveFileId);
          } catch {}
        }

        await backupsSnap.docs[0].ref.delete();
      } else {
        if (imageUrl.includes("storage.googleapis.com")) {
          const bucketMatch = imageUrl.match(/storage\.googleapis\.com\/([^/]+)\/(.+)$/);
          if (bucketMatch) {
            try { await deleteFromFirebaseStorage(decodeURIComponent(bucketMatch[2])); } catch {}
          }
        }
        const driveMatch = imageUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
          try { await deleteFile(driveMatch[1]); } catch {}
        }
      }

      const currentBackupUrls = (profile as any).imageBackupUrls || [];
      await storage.updateTalentProfile(uid, {
        imageUrls: currentUrls.filter((_: string, i: number) => i !== imageIndex),
        imageBackupUrls: currentBackupUrls.filter((_: string, i: number) => i !== imageIndex),
      });

      res.json({ message: "Image deleted" });
    } catch (error: any) {
      console.error("Image delete error:", error);
      res.status(500).json({ message: "Failed to delete image" });
    }
  });

  app.get("/api/drive/proxy/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const stream = await getFileStream(fileId);
      res.setHeader("Cache-Control", "public, max-age=86400");
      stream.pipe(res);
    } catch (error: any) {
      console.error("Drive proxy error:", error);
      res.status(404).json({ message: "File not found" });
    }
  });


  app.get("/api/vimeo/videos", firebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const profile = await storage.getTalentProfileByUserId(uid);
      if (!profile) return res.json([]);

      const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : null;
      const talentName = (profile.displayName || profile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();

      if (competitionId) {
        const comp = await storage.getCompetition(competitionId);
        if (!comp) return res.json([]);
        const videos = await listTalentVideos(comp.title, talentName);
        res.json(videos.map(v => ({
          uri: v.uri,
          name: v.name,
          description: v.description,
          link: v.link,
          embedUrl: v.player_embed_url,
          duration: v.duration,
          status: v.status,
          thumbnail: getVideoThumbnail(v),
          createdTime: v.created_time,
        })));
      } else {
        const allVideos = await listAllTalentVideos(talentName);
        res.json(allVideos.map(v => ({
          uri: v.uri,
          name: v.name,
          description: v.description,
          link: v.link,
          embedUrl: v.player_embed_url,
          duration: v.duration,
          status: v.status,
          thumbnail: getVideoThumbnail(v),
          createdTime: v.created_time,
          competitionFolder: v.competitionFolder,
        })));
      }
    } catch (error: any) {
      console.error("Vimeo list error:", error);
      res.status(500).json({ message: "Failed to list videos" });
    }
  });

  app.post("/api/vimeo/upload-ticket", firebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const profile = await storage.getTalentProfileByUserId(uid);
      if (!profile) return res.status(400).json({ message: "Create a talent profile first" });

      const { fileName, fileSize, competitionId } = req.body;
      if (!fileName || !fileSize) {
        return res.status(400).json({ message: "fileName and fileSize are required" });
      }
      if (!competitionId) {
        return res.status(400).json({ message: "competitionId is required" });
      }

      const comp = await storage.getCompetition(parseInt(competitionId));
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const settingsDoc = await getFirestore().collection("platformSettings").doc("global").get();
      const globalMaxVideos = settingsDoc.exists ? (settingsDoc.data()?.maxVideosPerContestant ?? 3) : 3;
      const compMaxVideos = comp.maxVideosPerContestant;
      const maxVideos = compMaxVideos != null ? Math.min(compMaxVideos, globalMaxVideos) : globalMaxVideos;

      const talentName = (profile.displayName || profile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();

      try {
        const existingVideos = await listTalentVideos(comp.title, talentName);
        if (existingVideos.length >= maxVideos) {
          return res.status(400).json({ message: `Upload limit reached. Maximum ${maxVideos} videos allowed per contestant.` });
        }
      } catch {}

      const ticket = await createUploadTicket(comp.title, talentName, fileName, fileSize);

      res.json(ticket);
    } catch (error: any) {
      console.error("Vimeo upload ticket error:", error);
      let userMessage = "Failed to create upload ticket";
      if (error.message?.includes("scope")) {
        userMessage = "Vimeo API permissions need to be updated. The access token requires the 'upload', 'interact', and 'edit' scopes. Please contact the administrator.";
      } else if (error.message?.includes("403")) {
        userMessage = "Vimeo API access denied. Please contact the administrator to check API permissions.";
      } else if (error.message?.includes("quota") || error.message?.includes("limit")) {
        userMessage = "Vimeo storage quota reached. Please contact the administrator.";
      }
      res.status(500).json({ message: userMessage });
    }
  });

  app.delete("/api/vimeo/videos/:videoId", firebaseAuth, async (req, res) => {
    try {
      const { videoId } = req.params;
      await deleteVideo(`/videos/${videoId}`);
      res.json({ message: "Video deleted" });
    } catch (error: any) {
      console.error("Vimeo delete error:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  app.patch("/api/vimeo/videos/:videoId", firebaseAuth, async (req, res) => {
    try {
      const { videoId } = req.params;
      const { name } = req.body;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Name is required" });
      }
      const updated = await renameVideo(`/videos/${videoId}`, name.trim());
      res.json({
        uri: updated.uri,
        name: updated.name,
        link: updated.link,
      });
    } catch (error: any) {
      console.error("Vimeo rename error:", error);
      res.status(500).json({ message: "Failed to rename video" });
    }
  });

  app.post("/api/vimeo/backfill-folders", firebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const firestoreUser = await getFirestoreUser(uid);
      if (!firestoreUser || firestoreUser.level < 4) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const competitions = await storage.getCompetitions();
      const results: Array<{ competition: string; status: string; folderUri?: string }> = [];

      for (const comp of competitions) {
        try {
          const folder = await createCompetitionVimeoFolder(comp.title);
          results.push({ competition: comp.title, status: "ok", folderUri: folder.uri });
        } catch (err: any) {
          results.push({ competition: comp.title, status: `error: ${err.message}` });
        }
      }

      res.json({ message: `Processed ${results.length} competitions`, results });
    } catch (error: any) {
      console.error("Vimeo backfill error:", error);
      res.status(500).json({ message: "Failed to backfill folders" });
    }
  });


  app.patch("/api/auth/profile", firebaseAuth, async (req, res) => {
    try {
      const { uid } = req.firebaseUser!;
      const { displayName, stageName, socialLinks, billingAddress } = req.body;

      const updateData: Record<string, any> = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (stageName !== undefined) updateData.stageName = stageName;
      if (socialLinks !== undefined) updateData.socialLinks = socialLinks;
      if (billingAddress !== undefined) updateData.billingAddress = billingAddress;

      if (Object.keys(updateData).length > 0) {
        await updateFirestoreUser(uid, updateData);
      }

      const firestoreUser = await getFirestoreUser(uid);
      const profile = await storage.getTalentProfileByUserId(uid);

      res.json({
        uid: firestoreUser?.uid,
        email: firestoreUser?.email,
        displayName: firestoreUser?.displayName,
        stageName: firestoreUser?.stageName || null,
        level: firestoreUser?.level,
        profileImageUrl: firestoreUser?.profileImageUrl || null,
        socialLinks: firestoreUser?.socialLinks || null,
        billingAddress: firestoreUser?.billingAddress || null,
        hasProfile: !!profile,
        profileRole: profile?.role || null,
      });
    } catch (error: any) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/vote-purchases", firebaseAuth, async (req, res) => {
    try {
      const { uid } = req.firebaseUser!;
      const purchases = await storage.getVotePurchasesByUser(uid);
      res.json(purchases);
    } catch (error: any) {
      console.error("Get vote purchases error:", error);
      res.status(500).json({ message: "Failed to get purchase history" });
    }
  });

  app.post("/api/vote-purchases", firebaseAuth, async (req, res) => {
    try {
      const { uid } = req.firebaseUser!;
      const { competitionId, contestantId, voteCount, amount } = req.body;

      if (!competitionId || !contestantId || !voteCount) {
        return res.status(400).json({ message: "competitionId, contestantId, and voteCount are required" });
      }

      const purchase = await storage.createVotePurchase({
        userId: uid,
        competitionId,
        contestantId,
        voteCount,
        amount: amount || 0,
      });

      for (let i = 0; i < voteCount; i++) {
        await storage.castVote({
          contestantId,
          competitionId,
          voterIp: null,
          userId: uid,
          purchaseId: purchase.id,
        });
      }

      res.status(201).json(purchase);
    } catch (error: any) {
      console.error("Vote purchase error:", error);
      res.status(500).json({ message: "Failed to process vote purchase" });
    }
  });

  app.get("/api/resolve/competition/:categorySlug/:compSlug", async (req, res) => {
    try {
      const { categorySlug, compSlug } = req.params;
      const competitions = await storage.getCompetitions();
      const comp = competitions.find(c =>
        slugify(c.category) === categorySlug && slugify(c.title) === compSlug
      );
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const contestantsData = await storage.getContestantsByCompetition(comp.id);
      const totalVotes = await storage.getTotalVotesByCompetition(comp.id);

      const enrichedContestants = await Promise.all(
        contestantsData.map(async (contestant) => {
          let videoThumbnail: string | null = null;
          try {
            const talentName = (contestant.talentProfile.displayName || contestant.talentProfile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
            const videos = await listTalentVideos(comp.title, talentName);
            if (videos.length > 0) {
              videoThumbnail = getVideoThumbnail(videos[0]);
            }
          } catch {}
          return { ...contestant, videoThumbnail };
        })
      );

      let hostedBy: string | null = null;
      if (comp.createdBy) {
        const creatorProfile = await storage.getTalentProfileByUserId(comp.createdBy);
        if (creatorProfile?.role === "admin") {
          hostedBy = null;
        } else if (creatorProfile) {
          hostedBy = creatorProfile.stageName || creatorProfile.displayName;
        }
      }

      res.json({
        ...comp,
        contestants: enrichedContestants,
        totalVotes,
        hostedBy,
      });
    } catch (error: any) {
      console.error("Competition slug resolution error:", error);
      res.status(500).json({ message: "Failed to resolve competition" });
    }
  });

  app.get("/api/resolve/host/:hostSlug", async (req, res) => {
    try {
      const { hostSlug } = req.params;
      const { baseSlug, id: hostId } = extractIdFromSlug(hostSlug);
      const hostProfiles = await storage.getHostProfiles();
      const host = hostId
        ? hostProfiles.find(p => p.id === hostId)
        : hostProfiles.find(p =>
            slugify(p.displayName) === hostSlug ||
            (p.stageName && slugify(p.stageName) === hostSlug)
          );
      if (!host) return res.status(404).json({ message: "Host not found" });

      const user = await storage.getUser(host.userId);
      const hostComps = await storage.getCompetitionsByCreator(host.userId);

      res.json({
        host: {
          ...host,
          email: user?.email || null,
          socialLinks: (host as any).socialLinks || user?.socialLinks || null,
          profileImageUrl: user?.profileImageUrl || null,
        },
        competitions: hostComps,
      });
    } catch (error: any) {
      console.error("Host slug resolution error:", error);
      res.status(500).json({ message: "Failed to resolve host profile" });
    }
  });

  app.get("/api/resolve/:categorySlug/:compSlug/:talentSlug", async (req, res) => {
    try {
      const { categorySlug, compSlug, talentSlug } = req.params;
      const competitions = await storage.getCompetitions();
      const comp = competitions.find(c =>
        slugify(c.category) === categorySlug && slugify(c.title) === compSlug
      );
      if (!comp) return res.status(404).json({ message: "Competition not found" });

      const contestants = await storage.getContestantsByCompetition(comp.id);
      const { baseSlug: talentBase, id: talentId } = extractIdFromSlug(talentSlug);
      let contestant = talentId
        ? contestants.find(c => c.talentProfile.id === talentId)
        : contestants.find(c =>
            slugify(c.talentProfile.displayName) === talentSlug ||
            (c.talentProfile.stageName && slugify(c.talentProfile.stageName) === talentSlug)
          );
      if (!contestant) return res.status(404).json({ message: "Contestant not found in this competition" });

      let videoThumbnail: string | null = null;
      let videos: any[] = [];
      try {
        const talentName = (contestant.talentProfile.displayName || contestant.talentProfile.stageName).replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
        const talentVideos = await listTalentVideos(comp.title, talentName);
        if (talentVideos.length > 0) {
          videoThumbnail = getVideoThumbnail(talentVideos[0]);
        }
        videos = talentVideos.map(v => ({
          uri: v.uri,
          name: v.name,
          link: v.link,
          embedUrl: v.player_embed_url,
          duration: v.duration,
          thumbnail: getVideoThumbnail(v),
        }));
      } catch {}

      const totalVotes = await storage.getTotalVotesByCompetition(comp.id);

      res.json({
        competition: comp,
        contestant: { ...contestant, videoThumbnail, videos },
        totalVotes,
      });
    } catch (error: any) {
      console.error("Slug resolution error:", error);
      res.status(500).json({ message: "Failed to resolve profile" });
    }
  });

  const driveUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
  });

  app.post("/api/admin/drive/upload", driveUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
      const { folderUrl } = req.body;
      const file = req.file;
      if (!file) { res.status(400).json({ message: "No file provided" }); return; }
      if (!folderUrl) { res.status(400).json({ message: "No folder URL provided" }); return; }

      const folderIdMatch = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (!folderIdMatch) { res.status(400).json({ message: "Invalid Google Drive folder URL" }); return; }
      const folderId = folderIdMatch[1];

      const customFileName = req.body.customFileName;
      const finalFilename = customFileName || file.originalname;

      const result = await uploadFileToDriveFolder(folderId, finalFilename, file.mimetype, file.buffer);
      console.log(`File uploaded to Google Drive: ${result.name} (${result.id})`);
      res.json({
        message: "File uploaded successfully",
        file: { id: result.id, name: result.name, link: result.webViewLink, size: result.size },
      });
    } catch (error: any) {
      console.error("Google Drive upload error:", error);
      if (error.code === 403) {
        res.status(403).json({ message: "Permission denied. The service account may not have Editor access to this folder." });
      } else {
        res.status(500).json({ message: error.message || "Failed to upload file to Google Drive" });
      }
    }
  });

  app.get("/api/admin/drive/folder-files", async (req: Request, res: Response): Promise<void> => {
    try {
      const folderUrl = req.query.folderUrl as string;
      if (!folderUrl) { res.status(400).json({ message: "folderUrl query parameter required" }); return; }
      const folderIdMatch = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (!folderIdMatch) { res.status(400).json({ message: "Invalid Google Drive folder URL" }); return; }
      const folderId = folderIdMatch[1];
      const files = await listFilesInFolder(folderId);
      res.json({ files });
    } catch (error: any) {
      console.error("List Drive folder files error:", error);
      res.status(500).json({ message: error.message || "Failed to list files" });
    }
  });

  app.delete("/api/admin/drive/file/:fileId", async (req: Request, res: Response): Promise<void> => {
    try {
      const { fileId } = req.params;
      await deleteFile(fileId);
      console.log(`Deleted Drive file: ${fileId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Drive file error:", error);
      res.status(500).json({ message: error.message || "Failed to delete file" });
    }
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const baseUrl = process.env.SITE_URL || "https://thequest-2dc77.firebaseapp.com";
      const competitions = await storage.getCompetitions();
      const profiles = await storage.getAllTalentProfiles();

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${baseUrl}/thequest</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${baseUrl}/thequest/competitions</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${baseUrl}/thequest/about</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${baseUrl}/thequest/nominate</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${baseUrl}/thequest/host</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${baseUrl}/thequest/login</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`;

      for (const comp of competitions) {
        if (comp.status === "draft") continue;
        const compSlug = `${slugify(comp.title)}-${comp.id}`;
        xml += `\n  <url><loc>${baseUrl}/competition/${compSlug}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`;
      }

      for (const profile of profiles) {
        if (profile.role === "admin" || profile.role === "host") continue;
        xml += `\n  <url><loc>${baseUrl}/thequest/talent/${profile.id}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
      }

      xml += `\n</urlset>`;
      res.set("Content-Type", "application/xml").send(xml);
    } catch (err) {
      console.error("Sitemap error:", err);
      res.status(500).send("Error generating sitemap");
    }
  });

  // ── Vote Detail Routes (admin) ──────────────────────────────────
  app.get("/api/analytics/contestant/:contestantId/competition/:competitionId/votes", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const contestantId = parseInt(req.params.contestantId);
      const competitionId = parseInt(req.params.competitionId);
      const votes = await firestoreVotes.getVotesByContestant(contestantId, competitionId);
      const purchases = await firestoreVotePurchases.getByCompetition(competitionId);
      const contestantPurchases = purchases.filter(p => p.contestantId === contestantId);
      const contributors = contestantPurchases.map(p => ({
        name: p.guestName || null,
        email: p.guestEmail || null,
        userId: p.userId || p.viewerId || null,
        voteCount: p.voteCount,
        amount: (p.amount || 0) / 100,
        date: p.purchasedAt,
      }));
      const onlineVotes = votes.filter(v => v.source === "online").length;
      const inPersonVotes = votes.filter(v => v.source === "in_person").length;
      const referralVotes = votes.filter(v => v.refCode).length;
      const freeVotes = votes.filter(v => !v.purchaseId).length;
      const purchasedVotes = votes.filter(v => v.purchaseId).length;
      res.json({
        total: votes.length,
        online: onlineVotes,
        inPerson: inPersonVotes,
        referral: referralVotes,
        free: freeVotes,
        purchased: purchasedVotes,
        contributors,
      });
    } catch (err: any) {
      console.error("Contestant vote detail error:", err);
      res.status(500).json({ message: "Failed to get vote details" });
    }
  });

  app.get("/api/analytics/competition/:competitionId/votes", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const competitionId = parseInt(req.params.competitionId);
      const votes = await firestoreVotes.getVotesByCompetition(competitionId);
      const purchases = await firestoreVotePurchases.getByCompetition(competitionId);
      const contributors = purchases.map(p => ({
        name: p.guestName || null,
        email: p.guestEmail || null,
        userId: p.userId || p.viewerId || null,
        contestantId: p.contestantId,
        voteCount: p.voteCount,
        amount: (p.amount || 0) / 100,
        date: p.purchasedAt,
      }));
      const onlineVotes = votes.filter(v => v.source === "online").length;
      const inPersonVotes = votes.filter(v => v.source === "in_person").length;
      const referralVotes = votes.filter(v => v.refCode).length;
      const freeVotes = votes.filter(v => !v.purchaseId).length;
      const purchasedVotes = votes.filter(v => v.purchaseId).length;
      const byContestant: Record<number, number> = {};
      votes.forEach(v => { byContestant[v.contestantId] = (byContestant[v.contestantId] || 0) + 1; });
      res.json({
        total: votes.length,
        online: onlineVotes,
        inPerson: inPersonVotes,
        referral: referralVotes,
        free: freeVotes,
        purchased: purchasedVotes,
        byContestant,
        contributors,
      });
    } catch (err: any) {
      console.error("Competition vote detail error:", err);
      res.status(500).json({ message: "Failed to get vote details" });
    }
  });

  // ── Referral Code Routes ──────────────────────────────────────────
  app.post("/api/referral/create", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { name, email, customCode, competitionId, contestantId } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const customId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let result;
      if (customCode && customCode.trim()) {
        const codeStr = customCode.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, "");
        if (codeStr.length < 3 || codeStr.length > 20) {
          return res.status(400).json({ message: "Custom code must be 3-20 characters (letters, numbers, dashes, underscores)" });
        }
        const existing = await firestoreReferrals.getCodeByCode(codeStr);
        if (existing) {
          return res.status(400).json({ message: "This code is already taken" });
        }
        result = await firestoreReferrals.generateCode(
          customId,
          "custom",
          name,
          null,
          { ownerEmail: email || undefined, competitionId: competitionId || undefined, contestantId: contestantId || undefined, skipDuplicateCheck: true, customCode: codeStr }
        );
      } else {
        result = await firestoreReferrals.generateCode(
          customId,
          "custom",
          name,
          null,
          { ownerEmail: email || undefined, competitionId: competitionId || undefined, contestantId: contestantId || undefined, skipDuplicateCheck: true }
        );
      }
      res.json(result);
    } catch (err: any) {
      console.error("Create referral code error:", err);
      res.status(500).json({ message: err.message || "Failed to create referral code" });
    }
  });

  app.post("/api/referral/generate", firebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const fsUser = await getFirestoreUser(uid);
      if (!fsUser) return res.status(404).json({ message: "User not found" });

      let ownerType: "talent" | "host" | "admin" = "talent";
      if (fsUser.level === "admin") ownerType = "admin";
      else if (fsUser.level === "host") ownerType = "host";

      const profile = await storage.getTalentProfileByUserId(uid);
      const ownerName = profile?.displayName || fsUser.email || uid;
      let competitionIds: number[] = [];
      if (profile) {
        const contests = await storage.getContestantsByTalent(profile.id);
        competitionIds = contests
          .filter(c => c.applicationStatus === "approved")
          .map(c => c.competitionId);
      }
      const code = await firestoreReferrals.generateCode(uid, ownerType, ownerName, profile?.id || null, {
        competitionId: competitionIds[0] || undefined,
        competitionIds,
      });
      res.json(code);
    } catch (err: any) {
      console.error("Generate referral code error:", err);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  app.put("/api/referral/my-code", firebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const { newCode } = req.body;
      if (!newCode) return res.status(400).json({ message: "New code is required" });

      const cleaned = newCode.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, "");
      if (cleaned.length < 3 || cleaned.length > 20) {
        return res.status(400).json({ message: "Code must be 3-20 characters (letters, numbers, dashes, underscores)" });
      }

      const profile = await storage.getTalentProfileByUserId(uid);
      let competitionIds: number[] = [];
      if (profile) {
        const contests = await storage.getContestantsByTalent(profile.id);
        competitionIds = contests
          .filter(c => c.applicationStatus === "approved")
          .map(c => c.competitionId);
      }

      const existing = await firestoreReferrals.getCodeByOwner(uid);
      if (existing) {
        const updated = await firestoreReferrals.updateCode(existing.code, {
          newCode: cleaned,
          competitionIds,
          competitionId: competitionIds[0] || null,
        });
        res.json(updated);
      } else {
        const fsUser = await getFirestoreUser(uid);
        if (!fsUser) return res.status(404).json({ message: "User not found" });
        const userLevel = typeof fsUser.level === "number" ? fsUser.level : (fsUser.level === "admin" ? 4 : fsUser.level === "host" ? 3 : fsUser.level === "talent" ? 2 : 1);
        if (userLevel < 2) return res.status(403).json({ message: "Only talents, hosts, and admins can create promo codes" });
        let ownerType: "talent" | "host" | "admin" = "talent";
        if (userLevel >= 4) ownerType = "admin";
        else if (userLevel >= 3) ownerType = "host";
        const ownerName = profile?.displayName || fsUser.email || uid;
        const created = await firestoreReferrals.generateCode(uid, ownerType, ownerName, profile?.id || null, {
          customCode: cleaned,
          competitionId: competitionIds[0] || undefined,
          competitionIds,
        });
        res.json(created);
      }
    } catch (err: any) {
      console.error("Update own referral code error:", err);
      res.status(500).json({ message: err.message || "Failed to update referral code" });
    }
  });

  app.get("/api/referral/my-code", firebaseAuth, async (req, res) => {
    try {
      const uid = req.firebaseUser!.uid;
      const code = await firestoreReferrals.getCodeByOwner(uid);
      res.json(code || null);
    } catch (err: any) {
      console.error("Get referral code error:", err);
      res.status(500).json({ message: "Failed to get referral code" });
    }
  });

  app.get("/api/referral/stats", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await firestoreReferrals.getAllStats();
      const codes = await firestoreReferrals.getAllCodes();
      res.json({ stats, codes });
    } catch (err: any) {
      console.error("Get referral stats error:", err);
      res.status(500).json({ message: "Failed to get referral stats" });
    }
  });

  app.put("/api/referral/:code", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const { newCode, ownerName, ownerEmail, ownerType, competitionId, contestantId } = req.body;
      if (newCode) {
        const cleaned = newCode.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, "");
        if (cleaned.length < 3 || cleaned.length > 20) {
          return res.status(400).json({ message: "Code must be 3-20 characters (letters, numbers, dashes, underscores)" });
        }
      }
      const sanitizedCode = newCode ? newCode.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, "") : undefined;
      const updated = await firestoreReferrals.updateCode(req.params.code, {
        newCode: sanitizedCode || undefined,
        ownerName: ownerName || undefined,
        ownerEmail: ownerEmail !== undefined ? ownerEmail : undefined,
        ownerType: ownerType || undefined,
        competitionId: competitionId !== undefined ? competitionId : undefined,
        contestantId: contestantId !== undefined ? contestantId : undefined,
      });
      res.json(updated);
    } catch (err: any) {
      console.error("Update referral code error:", err);
      res.status(500).json({ message: err.message || "Failed to update referral code" });
    }
  });

  app.delete("/api/referral/:code", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      await firestoreReferrals.deleteCode(req.params.code);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete referral code error:", err);
      res.status(500).json({ message: "Failed to delete referral code" });
    }
  });

  // ── Analytics Routes ─────────────────────────────────────────────
  app.get("/api/analytics/overview", firebaseAuth, requireAdmin, async (req, res) => {
    try {
      const competitions = await storage.getCompetitions();
      const allContestants = await storage.getAllContestants();

      let totalVotes = 0;
      let totalOnline = 0;
      let totalInPerson = 0;
      let totalRevenue = 0;

      const competitionStats = [];
      for (const comp of competitions) {
        const breakdown = await storage.getVoteBreakdownByCompetition(comp.id);
        totalVotes += breakdown.total;
        totalOnline += breakdown.online;
        totalInPerson += breakdown.inPerson;

        const purchases = await firestoreVotePurchases.getByCompetition(comp.id);
        const revenue = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
        totalRevenue += revenue;

        const contestants = allContestants.filter(c => c.competitionId === comp.id && c.applicationStatus === "approved");

        competitionStats.push({
          id: comp.id,
          title: comp.title,
          category: comp.category,
          status: comp.status,
          totalVotes: breakdown.total,
          onlineVotes: breakdown.online,
          inPersonVotes: breakdown.inPerson,
          contestantCount: contestants.length,
          revenue: revenue / 100,
        });
      }

      const topContestants = [];
      for (const c of allContestants.filter(ct => ct.applicationStatus === "approved")) {
        const voteBreakdown = await storage.getContestantVoteBreakdown(c.id, c.competitionId);
        topContestants.push({
          id: c.id,
          name: c.talentProfile?.displayName || "Unknown",
          competitionTitle: c.competitionTitle,
          competitionId: c.competitionId,
          totalVotes: voteBreakdown.total,
          onlineVotes: voteBreakdown.online,
          inPersonVotes: voteBreakdown.inPerson,
        });
      }
      topContestants.sort((a, b) => b.totalVotes - a.totalVotes);

      res.json({
        totalVotes,
        totalOnline,
        totalInPerson,
        totalRevenue: totalRevenue / 100,
        totalCompetitions: competitions.length,
        activeCompetitions: competitions.filter(c => c.status === "active" || c.status === "voting").length,
        totalContestants: allContestants.filter(c => c.applicationStatus === "approved").length,
        competitionStats: competitionStats.sort((a, b) => b.totalVotes - a.totalVotes),
        topContestants,
      });
    } catch (err: any) {
      console.error("Analytics overview error:", err);
      res.status(500).json({ message: "Failed to get analytics" });
    }
  });

  const socialCrawlerPattern = /facebookexternalhit|facebot|twitterbot|whatsapp|linkedinbot|slackbot|discordbot|telegrambot|applebot|googlebot|bingbot|yandexbot|pinterestbot|redditbot|rogerbot|embedly|quora|outbrain|vkShare|skypeuripreview|iframely|Slurp/i;

  app.get("/competition/:slug", async (req, res, next) => {
    try {
      const ua = req.headers["user-agent"] || "";
      if (!socialCrawlerPattern.test(ua)) return next();

      const slug = req.params.slug;
      const { id: compId } = extractIdFromSlug(slug);
      const competitions = await storage.getCompetitions();
      const comp = compId
        ? competitions.find(c => c.id === compId)
        : competitions.find(c => slugify(c.title) === slug);
      if (!comp) return next();

      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const ogTitle = `${comp.title} - ${comp.category} Competition | The Quest`;
      const ogDescription = comp.description || `Vote in the ${comp.title} ${comp.category} competition on The Quest. Browse contestants, cast your vote, and help decide the winner!`;
      const ogImage = comp.coverImage || "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/livery%2Fcompetition_card_fallback.jpg";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const ogUrl = `${protocol}://${req.get("host")}/competition/${slug}`;

      const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escHtml(ogTitle)}" />
    <meta property="og:description" content="${escHtml(ogDescription)}" />
    <meta property="og:image" content="${escHtml(ogImage)}" />
    <meta property="og:url" content="${escHtml(ogUrl)}" />
    <meta property="og:site_name" content="The Quest" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escHtml(ogImage)}" />
    <meta name="description" content="${escHtml(ogDescription)}" />
    <title>${escHtml(ogTitle)}</title>`;

      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(/<title>.*?<\/title>/, ogTags);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (error) {
      console.error("Competition OG meta injection error:", error);
      next();
    }
  });

  app.get("/thequest/:categorySlug/:compSlug/:talentSlug", async (req, res, next) => {
    try {
      const { categorySlug, compSlug, talentSlug } = req.params;
      if (categorySlug.startsWith("api") || categorySlug.startsWith("assets") || categorySlug.includes(".")) {
        return next();
      }

      const ua = req.headers["user-agent"] || "";
      if (!socialCrawlerPattern.test(ua)) return next();

      const competitions = await storage.getCompetitions();
      const comp = competitions.find(c => slugify(c.category) === categorySlug && slugify(c.title) === compSlug);
      if (!comp) return next();

      const contestants = await storage.getContestantsByCompetition(comp.id);
      const contestant = contestants.find(c =>
        slugify(c.talentProfile.displayName) === talentSlug ||
        (c.talentProfile.stageName && slugify(c.talentProfile.stageName) === talentSlug)
      );
      if (!contestant) return next();

      const profile = contestant.talentProfile;
      const displayName = profile.displayName || profile.stageName || "Contestant";
      const ogTitle = `Vote for ${displayName} - ${comp.title} | The Quest`;
      const ogDescription = `Hey, I need your vote to win! Vote for ${displayName} in ${comp.title} on The Quest!`;
      const ogImage = profile.imageUrls?.[0] || comp.coverImage || "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/livery%2Fcompetition_card_fallback.jpg";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const ogUrl = `${protocol}://${req.get("host")}/thequest/${categorySlug}/${compSlug}/${talentSlug}`;

      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escHtml(ogTitle)}" />
    <meta property="og:description" content="${escHtml(ogDescription)}" />
    <meta property="og:image" content="${escHtml(ogImage)}" />
    <meta property="og:url" content="${escHtml(ogUrl)}" />
    <meta property="og:site_name" content="The Quest" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escHtml(ogImage)}" />
    <meta name="description" content="${escHtml(ogDescription)}" />
    <title>${escHtml(ogTitle)}</title>`;

      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(/<title>.*?<\/title>/, ogTags);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (error) {
      console.error("3-segment OG meta injection error:", error);
      next();
    }
  });

  app.get("/thequest/:categorySlug/:compSlug", async (req, res, next) => {
    try {
      const { categorySlug, compSlug } = req.params;
      if (categorySlug.startsWith("api") || categorySlug.startsWith("assets") || categorySlug.includes(".")) {
        return next();
      }

      const ua = req.headers["user-agent"] || "";
      if (!socialCrawlerPattern.test(ua)) return next();

      const competitions = await storage.getCompetitions();
      const comp = competitions.find(c => slugify(c.category) === categorySlug && slugify(c.title) === compSlug);
      if (!comp) return next();

      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const ogTitle = `${comp.title} - ${comp.category} Competition | The Quest`;
      const ogDescription = comp.description || `Vote in the ${comp.title} ${comp.category} competition on The Quest. Browse contestants, cast your vote, and help decide the winner!`;
      const ogImage = comp.coverImage || "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/livery%2Fcompetition_card_fallback.jpg";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const ogUrl = `${protocol}://${req.get("host")}/thequest/${categorySlug}/${compSlug}`;

      const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escHtml(ogTitle)}" />
    <meta property="og:description" content="${escHtml(ogDescription)}" />
    <meta property="og:image" content="${escHtml(ogImage)}" />
    <meta property="og:url" content="${escHtml(ogUrl)}" />
    <meta property="og:site_name" content="The Quest" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escHtml(ogImage)}" />
    <meta name="description" content="${escHtml(ogDescription)}" />
    <title>${escHtml(ogTitle)}</title>`;

      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(/<title>.*?<\/title>/, ogTags);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (error) {
      console.error("2-segment competition OG meta injection error:", error);
      next();
    }
  });

  app.get("/thequest/:compSlug/:talentSlug", async (req, res, next) => {
    try {
      const { compSlug, talentSlug } = req.params;
      if (compSlug.startsWith("api") || compSlug.startsWith("assets") || compSlug.includes(".")) {
        return next();
      }

      const ua = req.headers["user-agent"] || "";
      if (!socialCrawlerPattern.test(ua)) {
        return next();
      }

      const { baseSlug: _compBase, id: compId } = extractIdFromSlug(compSlug);
      const competitions = await storage.getCompetitions();
      const comp = compId
        ? competitions.find(c => c.id === compId)
        : competitions.find(c => slugify(c.title) === compSlug);
      if (!comp) return next();

      const contestants = await storage.getContestantsByCompetition(comp.id);
      const { baseSlug: _talentBase, id: talentId } = extractIdFromSlug(talentSlug);
      const contestant = talentId
        ? contestants.find(c => c.talentProfile.id === talentId)
        : contestants.find(c =>
            slugify(c.talentProfile.displayName) === talentSlug ||
            (c.talentProfile.stageName && slugify(c.talentProfile.stageName) === talentSlug)
          );
      if (!contestant) return next();

      const profile = contestant.talentProfile;
      const displayName = profile.displayName || profile.stageName || "Contestant";
      const ogTitle = `Vote for ${displayName} - ${comp.title} | The Quest`;
      const ogDescription = `Hey, I need your vote to win! Vote for ${displayName} in ${comp.title} on The Quest!`;
      const ogImage = profile.imageUrls?.[0] || comp.coverImage || "";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const ogUrl = `${protocol}://${req.get("host")}/thequest/${compSlug}/${talentSlug}`;

      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escHtml(ogTitle)}" />
    <meta property="og:description" content="${escHtml(ogDescription)}" />
    <meta property="og:image" content="${escHtml(ogImage)}" />
    <meta property="og:url" content="${escHtml(ogUrl)}" />
    <meta property="og:site_name" content="The Quest" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escHtml(ogImage)}" />
    <meta name="description" content="${escHtml(ogDescription)}" />
    <title>${escHtml(ogTitle)}</title>`;

      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        /<title>.*?<\/title>/,
        ogTags
      );
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (error) {
      console.error("OG meta injection error:", error);
      next();
    }
  });

  return httpServer;
}
