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

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  domain TEXT NOT NULL DEFAULT '',
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_from TEXT,
  smtp_verified_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- target: 'host', 'disk:<mount>', or an iotstack-* container name.
-- cpu_pct is null for disk targets; used_bytes/total_bytes hold mem
-- used/total (host+containers) or disk used/total (disk targets).
CREATE TABLE IF NOT EXISTS resource_samples_raw (
  id INTEGER PRIMARY KEY,
  target TEXT NOT NULL,
  sampled_at TEXT NOT NULL DEFAULT (datetime('now')),
  cpu_pct REAL,
  used_bytes INTEGER,
  total_bytes INTEGER
);
CREATE INDEX IF NOT EXISTS idx_resource_samples_raw_target_time
  ON resource_samples_raw(target, sampled_at DESC);

CREATE TABLE IF NOT EXISTS resource_samples_hourly (
  target TEXT NOT NULL,
  bucket TEXT NOT NULL,
  avg_cpu_pct REAL,
  max_cpu_pct REAL,
  avg_used_bytes INTEGER,
  max_used_bytes INTEGER,
  total_bytes INTEGER,
  PRIMARY KEY (target, bucket)
);

CREATE TABLE IF NOT EXISTS resource_samples_daily (
  target TEXT NOT NULL,
  bucket TEXT NOT NULL,
  avg_cpu_pct REAL,
  max_cpu_pct REAL,
  avg_used_bytes INTEGER,
  max_used_bytes INTEGER,
  total_bytes INTEGER,
  PRIMARY KEY (target, bucket)
);

CREATE TABLE IF NOT EXISTS resource_thresholds (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  host_ram_warn_pct INTEGER NOT NULL DEFAULT 70,
  host_ram_critical_pct INTEGER NOT NULL DEFAULT 85,
  host_cpu_warn_pct INTEGER NOT NULL DEFAULT 70,
  host_cpu_critical_pct INTEGER NOT NULL DEFAULT 90,
  host_disk_warn_pct INTEGER NOT NULL DEFAULT 80,
  host_disk_critical_pct INTEGER NOT NULL DEFAULT 90,
  container_mem_warn_pct INTEGER NOT NULL DEFAULT 80,
  container_mem_critical_pct INTEGER NOT NULL DEFAULT 95,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

/** Seeds the single settings row from env vars, once, on first boot. */
export function seedSettings(): void {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM settings WHERE id = 1").get();
  if (existing) return;

  database.prepare("INSERT INTO settings (id, domain) VALUES (1, ?)").run(config.domain);
  logger.info(`seeded settings row (domain=${config.domain || "<none>"})`);
}

export interface SettingsRow {
  id: number;
  domain: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_from: string | null;
  smtp_verified_at: string | null;
  updated_at: string;
}

export function getSettingsRow(): SettingsRow {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get() as SettingsRow;
}

export interface ResourceThresholdsRow {
  id: number;
  host_ram_warn_pct: number;
  host_ram_critical_pct: number;
  host_cpu_warn_pct: number;
  host_cpu_critical_pct: number;
  host_disk_warn_pct: number;
  host_disk_critical_pct: number;
  container_mem_warn_pct: number;
  container_mem_critical_pct: number;
  updated_at: string;
}

/** Seeds the resource-thresholds row with defaults, once, on first boot. */
export function seedResourceThresholds(): void {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM resource_thresholds WHERE id = 1").get();
  if (existing) return;

  database.prepare("INSERT INTO resource_thresholds (id) VALUES (1)").run();
  logger.info("seeded resource_thresholds row with defaults");
}

export function getResourceThresholdsRow(): ResourceThresholdsRow {
  return getDb()
    .prepare("SELECT * FROM resource_thresholds WHERE id = 1")
    .get() as ResourceThresholdsRow;
}
