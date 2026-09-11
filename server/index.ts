import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { logError } from "./services/errorLogger";
import { startOCPurchaseFeedWorker } from "./services/ocPurchaseFeed";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Gzip compress all responses — cuts JSON/HTML/JS payload size 60-80% on mobile
app.use(compression());

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const body = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${body.length > 300 ? body.slice(0, 300) + "…" : body}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  startOCPurchaseFeedWorker();

  const { seedDatabase, seedLivery, seedTestAccounts, seedCategories, seedStarrStruckCompetition, seedVotePackages, seedSettings, seedJoinTitle, synchronizeCompetitionMedia } = await import("./seed");
  await seedLivery().catch((err) => console.error("Livery seed error:", err));
  await seedCategories().catch((err) => console.error("Categories seed error:", err));
  await seedVotePackages().catch((err) => console.error("Vote packages seed error:", err));
  await seedSettings().catch((err) => console.error("Settings seed error:", err));
  await seedJoinTitle().catch((err) => console.error("Join title seed error:", err));
  await seedDatabase().catch((err) => console.error("Seed error:", err));
  await synchronizeCompetitionMedia().catch((err) => console.error("Competition media sync error:", err));
  await seedStarrStruckCompetition().catch((err) => console.error("Starr Struck seed error:", err));
  await seedTestAccounts().catch((err) => console.error("Test accounts seed error:", err));

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const firebaseUserLevel = req.firebaseUser?.level;

    console.error("Internal Server Error:", err);

    logError({
      errorType: status >= 500 ? 'system' : 'api',
      severity: status >= 500 ? 'critical' : 'error',
      message: `Unhandled server error: ${message}`,
      stackTrace: err.stack,
      endpoint: req.path,
      method: req.method,
      statusCode: status,
      wasShownToUser: false,
      context: {
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 250),
        userUid: req.firebaseUser?.uid,
        userEmail: req.firebaseUser?.email,
        userLevel: req.firebaseUser?.level,
      },
      userUid: req.firebaseUser?.uid,
      userEmail: req.firebaseUser?.email,
      userLevel: firebaseUserLevel !== undefined && firebaseUserLevel >= 1 && firebaseUserLevel <= 4
        ? firebaseUserLevel as 1 | 2 | 3 | 4
        : undefined,
    }).catch(() => {});

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
