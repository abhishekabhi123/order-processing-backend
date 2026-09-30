import { redisClient } from "../config/redis.js";

export const redisCache = {
    async get(key: string): Promise<string | null> {
        if (!redisClient?.isOpen) {
            return null;
        }

        try {
            return await redisClient.get(key);
        } catch {
            return null;
        }
    },

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (!redisClient?.isOpen) {
            return;
        }

        try {
            if (ttlSeconds) {
                await redisClient.set(key, value, { EX: ttlSeconds });
            } else {
                await redisClient.set(key, value);
            }
        } catch {
            // Cache writes are best effort; PostgreSQL remains the source of truth.
        }
    },

    async delete(key: string): Promise<void> {
        if (!redisClient?.isOpen) {
            return;
        }

        try {
            await redisClient.del(key);
        } catch {
            // Cache invalidation failures must not fail product writes.
        }
    },

    async increment(key: string): Promise<void> {
        if (!redisClient?.isOpen) {
            return;
        }

        try {
            await redisClient.incr(key);
        } catch {
            // A failed version bump degrades to a cache miss when Redis recovers.
        }
    },
};
