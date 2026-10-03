import dotenv from "dotenv";

dotenv.config();

const env = {
    PORT: process.env.PORT || "5000",
    NODE_ENV: process.env.NODE_ENV || "development",
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || "default_secret",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "default_refresh_secret",
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    REDIS_URL: process.env.REDIS_URL,
    REDIS_CACHE_TTL_SECONDS: process.env.REDIS_CACHE_TTL_SECONDS || "60",
    RABBITMQ_URL: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",
    OUTBOX_POLL_INTERVAL_MS: process.env.OUTBOX_POLL_INTERVAL_MS || "1000",
    OUTBOX_BATCH_SIZE: process.env.OUTBOX_BATCH_SIZE || "50",
    OUTBOX_MAX_ATTEMPTS: process.env.OUTBOX_MAX_ATTEMPTS || "25",
    OUTBOX_CLAIM_TIMEOUT_MS: process.env.OUTBOX_CLAIM_TIMEOUT_MS || "300000",
};

export default env;
