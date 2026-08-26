export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),

  db: {
    path: process.env.DB_PATH ?? "/data/iotstack.db",
  },

  mosquitto: {
    host: process.env.MOSQUITTO_HOST ?? "localhost",
    port: parseInt(process.env.MOSQUITTO_PORT ?? "1883", 10),
  },

  dynsec: {
    controllerUsername: process.env.DYNSEC_CONTROLLER_USERNAME ?? "",
    controllerPassword: process.env.DYNSEC_CONTROLLER_PASSWORD ?? "",
  },

  admin: {
    email: process.env.ADMIN_EMAIL ?? "",
    password: process.env.ADMIN_PASSWORD ?? "",
  },

  sessionSecret: process.env.SESSION_SECRET ?? "",

  limits: {
    rateLimitMsgPerMin: parseInt(process.env.RATE_LIMIT_MSG_PER_MIN ?? "60", 10),
    storageCapMB: parseInt(process.env.STORAGE_CAP_MB ?? "500", 10),
    rawRetentionDays: parseInt(process.env.RAW_RETENTION_DAYS ?? "14", 10),
  },
};
