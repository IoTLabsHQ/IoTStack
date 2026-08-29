export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),

  db: {
    path: process.env.DB_PATH ?? "/data/iotstack.db",
  },

  firmware: {
    // Same api_data volume the DB lives in — no new volume needed.
    dir: process.env.FIRMWARE_DIR ?? "/data/firmware",
    // A .bin must fit inside a single ESP32 OTA app-partition slot with
    // margin; boards.ts's otaAppSlotBytes is 1_310_720 for every board this
    // project supports today, so this cap is deliberately generous rather
    // than per-board — firmware.routes.ts does the real per-board check.
    maxUploadBytes: parseInt(process.env.FIRMWARE_MAX_UPLOAD_BYTES ?? "2097152", 10),
  },

  mosquitto: {
    host: process.env.MOSQUITTO_HOST ?? "localhost",
    port: parseInt(process.env.MOSQUITTO_PORT ?? "1883", 10),
  },

  dynsec: {
    controllerUsername: process.env.DYNSEC_CONTROLLER_USERNAME ?? "",
    controllerPassword: process.env.DYNSEC_CONTROLLER_PASSWORD ?? "",
  },

  mqttCollector: {
    username: process.env.MQTT_COLLECTOR_USERNAME ?? "",
    password: process.env.MQTT_COLLECTOR_PASSWORD ?? "",
  },

  mqttApiCommand: {
    username: process.env.MQTT_API_COMMAND_USERNAME ?? "",
    password: process.env.MQTT_API_COMMAND_PASSWORD ?? "",
  },

  admin: {
    email: process.env.ADMIN_EMAIL ?? "",
    password: process.env.ADMIN_PASSWORD ?? "",
  },

  sessionSecret: process.env.SESSION_SECRET ?? "",

  ota: {
    // Signs the stateless firmware-download token — separate from
    // sessionSecret because a leaked download secret should never also
    // grant dashboard session forgery, and vice versa.
    downloadSecret: process.env.OTA_DOWNLOAD_SECRET ?? "",
    downloadTokenTtlSeconds: parseInt(process.env.OTA_DOWNLOAD_TOKEN_TTL_SECONDS ?? "1800", 10),
    defaultBatchSize: parseInt(process.env.OTA_DEFAULT_BATCH_SIZE ?? "5", 10),
    targetTimeoutSeconds: parseInt(process.env.OTA_TARGET_TIMEOUT_SECONDS ?? "600", 10),
    jobMaxAgeHours: parseInt(process.env.OTA_JOB_MAX_AGE_HOURS ?? "24", 10),
    sweepIntervalSeconds: parseInt(process.env.OTA_SWEEP_INTERVAL_SECONDS ?? "15", 10),
  },

  // "Online" is a staleness heuristic, not a live socket claim — threshold
  // = ping_interval(5s) * safety_multiplier(3), per PRD §29's own guidance.
  onlineThresholdSeconds: parseInt(process.env.ONLINE_THRESHOLD_SECONDS ?? "15", 10),

  domain: process.env.DOMAIN ?? "",

  settingsShared: {
    domainFile: process.env.DOMAIN_FILE_PATH ?? "/settings-shared/domain.txt",
  },

  caddy: {
    adminUrl: process.env.CADDY_ADMIN_URL ?? "http://caddy:2019",
    host: process.env.CADDY_HOST ?? "caddy",
    httpsPort: parseInt(process.env.CADDY_HTTPS_PORT ?? "443", 10),
  },

  limits: {
    rateLimitMsgPerMin: parseInt(process.env.RATE_LIMIT_MSG_PER_MIN ?? "60", 10),
    storageCapMB: parseInt(process.env.STORAGE_CAP_MB ?? "500", 10),
    rawRetentionDays: parseInt(process.env.RAW_RETENTION_DAYS ?? "14", 10),
    maxPayloadBytes: parseInt(process.env.MAX_PAYLOAD_BYTES ?? "4096", 10),
    maxPayloadKeys: parseInt(process.env.MAX_PAYLOAD_KEYS ?? "32", 10),
    maxPayloadDepth: parseInt(process.env.MAX_PAYLOAD_DEPTH ?? "3", 10),
  },

  resources: {
    agentSocketPath: process.env.RESOURCE_AGENT_SOCKET_PATH ?? "/run/iotstack-agent.sock",
    pollIntervalSeconds: parseInt(process.env.RESOURCE_POLL_INTERVAL_SECONDS ?? "30", 10),
  },
};
