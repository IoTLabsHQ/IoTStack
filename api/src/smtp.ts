import nodemailer from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export type SmtpVerifyResult = { ok: true } | { ok: false; error: string };

/** Opens a real connection and checks auth — sends nothing. */
export async function verifySmtp(cfg: SmtpConfig): Promise<SmtpVerifyResult> {
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.password },
    connectionTimeout: 8000,
  });

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "SMTP verification failed" };
  } finally {
    transporter.close();
  }
}
