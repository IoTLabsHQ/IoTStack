import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { createSession, destroySession } from "./session";
import { requireAuth, AuthedRequest } from "./middleware";
import { requireString, respondIfValidationError } from "./validation";
import { isLockedOut, recordFailure, recordSuccess } from "./auth-backoff";
import { logger } from "./logger";

export const authRouter = Router();

interface AdminRow {
  id: number;
  email: string;
  password_hash: string;
}

authRouter.post("/login", (req, res) => {
  try {
    const email = requireString(req.body?.email, "email");
    const password = requireString(req.body?.password, "password");

    if (isLockedOut(email)) {
      logger.warn(`login: "${email}" locked out (too many failed attempts)`);
      res.status(429).json({ error: "Too many failed attempts — try again later" });
      return;
    }

    const admin = getDb()
      .prepare("SELECT id, email, password_hash FROM admin_users WHERE email = ?")
      .get(email) as AdminRow | undefined;

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      recordFailure(email);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    recordSuccess(email);
    getDb()
      .prepare("UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?")
      .run(admin.id);

    const token = createSession(admin.id);
    logger.info(`admin "${admin.email}" logged in`);
    res.json({ token, admin: { id: admin.id, email: admin.email } });
  } catch (err) {
    if (respondIfValidationError(err, res)) return;
    logger.error("login error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

authRouter.post("/logout", requireAuth, (req, res) => {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) destroySession(token);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const admin = getDb()
    .prepare("SELECT id, email FROM admin_users WHERE id = ?")
    .get(req.adminId);
  res.json({ admin });
});
