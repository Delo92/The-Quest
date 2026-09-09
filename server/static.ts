import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { applyShareMeta, getShareMeta } from "./share-meta";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", async (req, res, next) => {
    try {
      const indexPath = path.resolve(distPath, "index.html");
      let template = await fs.promises.readFile(indexPath, "utf-8");
      const shareMeta = await getShareMeta(req.originalUrl, req.get("host") || "localhost");
      if (shareMeta) template = applyShareMeta(template, shareMeta);
      res.type("html").send(template);
    } catch (error) {
      next(error);
    }
  });
}
