import env from "../config/env.js";
import type { ProductQuery } from "../types/product.types.js";
import { redisCache } from "./redisCache.service.js";

const PRODUCT_CACHE_PREFIX = "products";
const PRODUCT_VERSION_KEY = `${PRODUCT_CACHE_PREFIX}:version`;
const DEFAULT_VERSION = "1";

const parsedTtl = Number(env.REDIS_CACHE_TTL_SECONDS);
export const productCacheTtlSeconds = Number.isSafeInteger(parsedTtl) && parsedTtl > 0 ? parsedTtl : 60;

export const productCacheKeys = {
    product: (id: string) => `${PRODUCT_CACHE_PREFIX}:${id}`,
    version: () => PRODUCT_VERSION_KEY,
    list: (version: string, query: Pick<ProductQuery, "page" | "limit">) => (
        `${PRODUCT_CACHE_PREFIX}:list:v${version}:page:${query.page}:limit:${query.limit}`
    ),
};

const parseCachedValue = <T>(value: string | null): T | null => {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

const getCollectionVersion = async (): Promise<string> => {
    try {
        const version = await redisCache.get(productCacheKeys.version());
        if (version) {
            return version;
        }

        // The version key must never expire: if it expired and was recreated
        // as DEFAULT_VERSION, stale collection entries written under the old
        // version could become reachable again. setIfAbsent uses NX with no EX
        // so it never overwrites a live version and never attaches a TTL.
        await redisCache.setIfAbsent(productCacheKeys.version(), DEFAULT_VERSION);
        return (await redisCache.get(productCacheKeys.version())) ?? DEFAULT_VERSION;
    } catch {
        return DEFAULT_VERSION;
    }
};

export const productCache = {
    async getProduct<T>(id: string): Promise<T | null> {
        try {
            return parseCachedValue<T>(await redisCache.get(productCacheKeys.product(id)));
        } catch {
            return null;
        }
    },

    async setProduct(id: string, product: unknown): Promise<void> {
        try {
            await redisCache.set(
                productCacheKeys.product(id),
                JSON.stringify(product),
                productCacheTtlSeconds,
            );
        } catch {
            // The cache adapter already handles failures; this protects callers and tests.
        }
    },

    async getProducts<T>(query: Pick<ProductQuery, "page" | "limit">): Promise<T | null> {
        try {
            const version = await getCollectionVersion();
            return parseCachedValue<T>(await redisCache.get(productCacheKeys.list(version, query)));
        } catch {
            return null;
        }
    },

    async setProducts(query: Pick<ProductQuery, "page" | "limit">, products: unknown): Promise<void> {
        try {
            const version = await getCollectionVersion();
            await redisCache.set(
                productCacheKeys.list(version, query),
                JSON.stringify(products),
                productCacheTtlSeconds,
            );
        } catch {
            // The cache adapter already handles failures; this protects callers and tests.
        }
    },

    async invalidateProduct(id?: string): Promise<void> {
        try {
            const operations = [
                redisCache.increment(productCacheKeys.version()),
                // INCR preserves any existing TTL, so strip it: the version
                // key must never expire, or stale collection entries could
                // become reachable again after a reset to DEFAULT_VERSION.
                redisCache.persist(productCacheKeys.version()),
            ];
            if (id) {
                operations.push(redisCache.delete(productCacheKeys.product(id)));
            }
            await Promise.all(operations);
        } catch {
            // PostgreSQL writes must succeed even when Redis is unavailable.
        }
    },
};
