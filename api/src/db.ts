import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { config } from "./config";
import { logger } from "./logger";

let db: Database.Database | null = null;

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  mqtt_username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  payload_bytes INTEGER NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_device_time ON messages(device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at);

CREATE TABLE IF NOT EXISTS storage_usage (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  bytes INTEGER NOT NULL DEFAULT 0
);
`;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.db.path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function runMigrations(): void {
  getDb().exec(MIGRATIONS);
  logger.info("database migrations applied");
}

/** Seeds the single dashboard admin account from env vars, once, on first boot. */
export function seedAdmin(): void {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM admin_users LIMIT 1").get();
  if (existing) return;

  if (!config.admin.email || !config.admin.password) {
    logger.warn(
      "ADMIN_EMAIL/ADMIN_PASSWORD not set — no admin account created, dashboard login will fail",
    );
    return;
  }

  const passwordHash = bcrypt.hashSync(config.admin.password, 10);
  database
    .prepare("INSERT INTO admin_users (email, password_hash) VALUES (?, ?)")
    .run(config.admin.email, passwordHash);
  logger.info(`seeded admin account: ${config.admin.email}`);
}
