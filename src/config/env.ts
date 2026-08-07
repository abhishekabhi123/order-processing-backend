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
};

export default env;