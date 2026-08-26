import { Request, Response, NextFunction } from "express";
import { resolveSession } from "./session";

export interface AuthedRequest extends Request {
  adminId?: number;
}

/** Requires a valid dashboard session token on every route it guards. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const adminId = token ? resolveSession(token) : null;
  if (!adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.adminId = adminId;
  next();
}
