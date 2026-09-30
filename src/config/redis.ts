import { createClient } from "redis";
import env from "./env.js";

export const redisClient = env.REDIS_URL
    ? createClient({
        url: env.REDIS_URL,
        socket: { reconnectStrategy: false },
    })
    : null;

redisClient?.on("error", (error) => {
    console.warn("Redis cache unavailable:", error.message);
});

export const connectRedis = async (): Promise<void> => {
    if (!redisClient || redisClient.isOpen) {
        return;
    }

    try {
        await redisClient.connect();
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Redis connection error";
        console.warn("Redis cache unavailable:", message);
    }
};
