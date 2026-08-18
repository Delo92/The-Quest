import type { Request, Response, NextFunction } from "express";
import { verifyFirebaseToken } from "./firebase-admin";

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: {
        uid: string;
        email: string;
        level: number;
      };
    }
  }
}

export async function firebaseAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No authentication token provided" });
  }

  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    return res.status(401).json({ message: "Invalid token format" });
  }

  try {
    const decoded = await verifyFirebaseToken(token);
    req.firebaseUser = {
      uid: decoded.uid,
      email: decoded.email || "",
      level: (decoded.level as number) || 0,
    };
    next();
  } catch (error: any) {
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid authentication token" });
  }
}

export function requireLevel(minLevel: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.firebaseUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.firebaseUser.level < minLevel) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireLevel(4)(req, res, next);
}

export function requireHost(req: Request, res: Response, next: NextFunction) {
  return requireLevel(3)(req, res, next);
}

export function requireTalent(req: Request, res: Response, next: NextFunction) {
  return requireLevel(2)(req, res, next);
}
