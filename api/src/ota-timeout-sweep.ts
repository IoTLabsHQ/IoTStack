/**
 * Periodic sweep — mirrors collector.ts's startRetentionSweep() pattern.
 * Three jobs per tick: advance each running job's staggered batch queue,
 * mark stale in-flight targets timed_out, and close out jobs whose targets
 * are all terminal (a backstop for checkJobCompletion, which only fires on
 * real MQTT replies — a target that never replies at all needs this).
 */
import { getDb } from "./db";
import { logger } from "./logger";
import { config } from "./config";
import { checkJobCompletion, sendOtaStartForTarget } from "./ota-jobs";

interface RunningJob {
  id: number;
  batch_size: number;
}

function advanceBatches(): void {
  const jobs = getDb()
    .prepare(`SELECT id, batch_size FROM ota_jobs WHERE status = 'running'`)
    .all() as RunningJob[];

  for (const job of jobs) {
    const inFlightCount = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM ota_job_targets
           WHERE ota_job_id = ? AND state IN ('sent','downloading','flashing','flash_ok')`,
        )
        .get(job.id) as { n: number }
    ).n;
    const slots = job.batch_size - inFlightCount;
    if (slots <= 0) continue;

    const pending = getDb()
      .prepare(`SELECT id FROM ota_job_targets WHERE ota_job_id = ? AND state = 'pending' ORDER BY id ASC LIMIT ?`)
      .all(job.id, slots) as { id: number }[];
    for (const t of pending) sendOtaStartForTarget(t.id);
  }
}

function markTimedOutTargets(): void {
  // Computed by SQLite itself, not new Date().toISOString() — that produces
  // "...T12:00:00.000Z" while sent_at is SQLite's own "YYYY-MM-DD HH:MM:SS"
  // (space, no ms/Z). String comparison against mismatched formats is not
  // reliably chronological (a space sorts before "T"), so every row looked
  // instantly stale. Real bug, caught by the Phase 2 real-hardware/MQTT
  // verification pass, not by types.
  const stale = getDb()
    .prepare(
      `SELECT t.id, t.ota_job_id FROM ota_job_targets t
       WHERE t.state IN ('sent','downloading','flashing','flash_ok')
         AND t.sent_at < datetime('now', '-' || ? || ' seconds')`,
    )
    .all(config.ota.targetTimeoutSeconds) as { id: number; ota_job_id: number }[];

  for (const t of stale) {
    getDb()
      .prepare(
        `UPDATE ota_job_targets SET state = 'timed_out', error_message = 'no reply within target timeout', last_update_at = datetime('now')
         WHERE id = ?`,
      )
      .run(t.id);
    logger.info(`[ota] target ${t.id} timed out`);
  }
  const affectedJobs = new Set(stale.map((t) => t.ota_job_id));
  for (const jobId of affectedJobs) checkJobCompletion(jobId);
}

function expireStaleJobs(): void {
  // Same SQLite-native cutoff reasoning as markTimedOutTargets() above.
  const stale = getDb()
    .prepare(
      `SELECT id FROM ota_jobs WHERE status = 'running' AND created_at < datetime('now', '-' || ? || ' hours')`,
    )
    .all(config.ota.jobMaxAgeHours) as { id: number }[];
  for (const job of stale) {
    getDb()
      .prepare(`UPDATE ota_jobs SET status = 'timed_out', completed_at = datetime('now') WHERE id = ?`)
      .run(job.id);
    getDb()
      .prepare(
        `UPDATE ota_job_targets SET state = 'timed_out', error_message = 'job exceeded max age', last_update_at = datetime('now')
         WHERE ota_job_id = ? AND state NOT IN ('verified','failed','timed_out','cancelled')`,
      )
      .run(job.id);
    logger.info(`[ota] job ${job.id} expired (exceeded ${config.ota.jobMaxAgeHours}h max age)`);
  }
}

export function startOtaTimeoutSweep(): void {
  setInterval(() => {
    try {
      advanceBatches();
      markTimedOutTargets();
      expireStaleJobs();
    } catch (err) {
      logger.error("ota sweep error:", err);
    }
  }, config.ota.sweepIntervalSeconds * 1000);
}
