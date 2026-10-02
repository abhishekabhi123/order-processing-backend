import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import prisma from "../src/config/database.js";
import { Role } from "../src/generated/prisma/client.js";
import { toProductResponse } from "../src/mappers/product.mapper.js";
import { productRepository } from "../src/repositories/product.repository.js";
import { productCache, productCacheKeys, productCacheTtlSeconds } from "../src/services/productCache.service.js";
import { productService } from "../src/services/product.service.js";
import { jwtService } from "../src/services/jwt.service.js";
import { redisCache } from "../src/services/redisCache.service.js";

const api = request(app);

const createProduct = async () => {
    const category = await prisma.category.create({
        data: { name: `cache-category-${crypto.randomUUID()}` },
    });

    return prisma.product.create({
        data: {
            name: "Cached product",
            sku: `cache-sku-${crypto.randomUUID()}`,
            price: "12.50",
            stock: 5,
            categoryId: category.id,
        },
        include: { category: true },
    });
};

const createUserWithToken = async (role: Role = Role.CUSTOMER) => {
    const user = await prisma.user.create({
        data: {
            name: "Cache order user",
            email: `cache-order-${crypto.randomUUID()}@example.test`,
            password: "not-used",
            role,
        },
    });
    return {
        user,
        token: jwtService.generateAccessToken({ sub: user.id, role: user.role }),
    };
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe("Product cache", () => {
    it("returns a cached product without querying PostgreSQL", async () => {
        const product = await createProduct();
        const cachedProduct = toProductResponse(product);
        vi.spyOn(redisCache, "get").mockResolvedValue(JSON.stringify(cachedProduct));
        const repositorySpy = vi.spyOn(productRepository, "findById");

        const response = await api.get(`/api/products/${product.id}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ id: product.id, name: "Cached product" });
        expect(repositorySpy).not.toHaveBeenCalled();
    });

    it("reads PostgreSQL on a cache miss and stores the mapped product with the configured TTL", async () => {
        const product = await createProduct();
        vi.spyOn(redisCache, "get").mockResolvedValue(null);
        const setSpy = vi.spyOn(redisCache, "set").mockResolvedValue();

        const response = await api.get(`/api/products/${product.id}`);

        expect(response.status).toBe(200);
        expect(setSpy).toHaveBeenCalledWith(
            productCacheKeys.product(product.id),
            expect.any(String),
            45,
        );
        expect(productCacheTtlSeconds).toBe(45);
    });

    it("returns cached product lists without querying PostgreSQL", async () => {
        const product = await createProduct();
        const cachedProduct = toProductResponse(product);
        vi.spyOn(redisCache, "get")
            .mockResolvedValueOnce("3")
            .mockResolvedValueOnce(JSON.stringify([cachedProduct]));
        const repositorySpy = vi.spyOn(productRepository, "findAll");

        const response = await api.get("/api/products?page=1&limit=10");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(repositorySpy).not.toHaveBeenCalled();
    });

    it("invalidates the product key and collection version after product updates and deactivation", async () => {
        const product = await createProduct();
        const deleteSpy = vi.spyOn(redisCache, "delete").mockResolvedValue();
        const incrementSpy = vi.spyOn(redisCache, "increment").mockResolvedValue();
        vi.spyOn(redisCache, "persist").mockResolvedValue();

        await productService.update(product.id, { name: "Updated cached product" });
        await productService.deactivate(product.id);

        expect(deleteSpy).toHaveBeenCalledWith(productCacheKeys.product(product.id));
        expect(incrementSpy).toHaveBeenCalledWith(productCacheKeys.version());
        expect(deleteSpy).toHaveBeenCalledTimes(2);
        expect(incrementSpy).toHaveBeenCalledTimes(2);
    });

    it("falls back to PostgreSQL when Redis reads fail", async () => {
        const product = await createProduct();
        vi.spyOn(redisCache, "get").mockRejectedValue(new Error("Redis unavailable"));
        const repositorySpy = vi.spyOn(productRepository, "findById");

        const response = await api.get(`/api/products/${product.id}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ id: product.id, name: "Cached product" });
        expect(repositorySpy).toHaveBeenCalledWith(product.id);
    });

    it("invalidates product caches after order stock changes", async () => {
        const product = await createProduct();
        const invalidateSpy = vi.spyOn(productCache, "invalidateProduct").mockResolvedValue();
        const { token } = await createUserWithToken();

        const response = await api
            .post("/api/orders")
            .set("Authorization", `Bearer ${token}`)
            .send({ items: [{ productId: product.id, quantity: 1 }] });

        expect(response.status).toBe(201);
        expect(invalidateSpy).toHaveBeenCalledWith(product.id);
    });

    it("bumps the collection version on product creation without deleting an individual key", async () => {
        const category = await prisma.category.create({
            data: { name: `cache-create-category-${crypto.randomUUID()}` },
        });
        const deleteSpy = vi.spyOn(redisCache, "delete").mockResolvedValue();
        const incrementSpy = vi.spyOn(redisCache, "increment").mockResolvedValue();
        vi.spyOn(redisCache, "persist").mockResolvedValue();

        await productService.create({
            name: "New cached product",
            sku: `cache-create-sku-${crypto.randomUUID()}`,
            price: 9.99,
            stock: 3,
            categoryId: category.id,
        });

        expect(incrementSpy).toHaveBeenCalledWith(productCacheKeys.version());
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it("invalidates product caches when an order is cancelled and stock is restored", async () => {
        const product = await createProduct();
        const customer = await createUserWithToken(Role.CUSTOMER);
        const admin = await createUserWithToken(Role.ADMIN);

        const created = await api
            .post("/api/orders")
            .set("Authorization", `Bearer ${customer.token}`)
            .send({ items: [{ productId: product.id, quantity: 1 }] });
        expect(created.status).toBe(201);

        const invalidateSpy = vi.spyOn(productCache, "invalidateProduct").mockResolvedValue();

        const cancelled = await api
            .patch(`/api/orders/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "CANCELLED" });

        expect(cancelled.status).toBe(200);
        expect(invalidateSpy).toHaveBeenCalledWith(product.id);
        await expect(
            prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
        ).resolves.toMatchObject({ stock: 5 });
    });

    it("stores collection entries with the configured TTL while the version key never gets a TTL", async () => {
        await createProduct();
        // version lookup -> missing, re-read after seed -> default "1", list entry -> miss
        vi.spyOn(redisCache, "get").mockResolvedValue(null);
        const setSpy = vi.spyOn(redisCache, "set").mockResolvedValue();
        const setIfAbsentSpy = vi.spyOn(redisCache, "setIfAbsent").mockResolvedValue();

        const response = await api.get("/api/products?page=2&limit=5");

        expect(response.status).toBe(200);
        // Collection entry itself respects the configured TTL.
        expect(setSpy).toHaveBeenCalledWith(
            productCacheKeys.list("1", { page: 2, limit: 5 }),
            expect.any(String),
            productCacheTtlSeconds,
        );
        expect(productCacheTtlSeconds).toBe(45);
        // The version key is seeded without expiry and never via set-with-TTL.
        expect(setIfAbsentSpy).toHaveBeenCalledWith(productCacheKeys.version(), "1");
        expect(
            setSpy.mock.calls.some(([key]) => key === productCacheKeys.version()),
        ).toBe(false);
    });

    it("persists the collection version on invalidation so it can never expire and resurrect stale lists", async () => {
        const product = await createProduct();
        const incrementSpy = vi.spyOn(redisCache, "increment").mockResolvedValue();
        const persistSpy = vi.spyOn(redisCache, "persist").mockResolvedValue();
        vi.spyOn(redisCache, "delete").mockResolvedValue();

        await productCache.invalidateProduct(product.id);

        expect(incrementSpy).toHaveBeenCalledWith(productCacheKeys.version());
        expect(persistSpy).toHaveBeenCalledWith(productCacheKeys.version());
    });

    it("makes stale collection entries unreachable after a version bump", async () => {
        await createProduct();
        const store = new Map<string, string>([
            [productCacheKeys.version(), "7"],
            [productCacheKeys.list("7", { page: 1, limit: 10 }), JSON.stringify([{ stale: true }])],
        ]);
        vi.spyOn(redisCache, "get").mockImplementation(async (key: string) => store.get(key) ?? null);
        vi.spyOn(redisCache, "set").mockImplementation(async (key: string, value: string) => {
            store.set(key, value);
        });
        const incrementSpy = vi.spyOn(redisCache, "increment").mockImplementation(async (key: string) => {
            store.set(key, String(Number(store.get(key) ?? "0") + 1));
        });
        vi.spyOn(redisCache, "persist").mockResolvedValue();
        vi.spyOn(redisCache, "delete").mockResolvedValue();
        const repositorySpy = vi.spyOn(productRepository, "findAll");

        // First read hits the v7 collection entry without touching PostgreSQL.
        const first = await api.get("/api/products?page=1&limit=10");
        expect(first.status).toBe(200);
        expect(first.body.data).toEqual([{ stale: true }]);
        expect(repositorySpy).not.toHaveBeenCalled();

        // A product write bumps the version; the old v7 entry must be orphaned.
        const product = await createProduct();
        await productService.update(product.id, { name: "Bumped version" });
        expect(incrementSpy).toHaveBeenCalledWith(productCacheKeys.version());
        expect(store.get(productCacheKeys.version())).toBe("8");

        // The next read uses the v8 key and misses, falling back to PostgreSQL.
        const second = await api.get("/api/products?page=1&limit=10");
        expect(second.status).toBe(200);
        expect(repositorySpy).toHaveBeenCalled();
        expect(second.body.data).not.toEqual([{ stale: true }]);
    });

    it("keeps product writes succeeding when Redis writes fail", async () => {
        const product = await createProduct();
        vi.spyOn(redisCache, "delete").mockRejectedValue(new Error("Redis unavailable"));
        vi.spyOn(redisCache, "increment").mockRejectedValue(new Error("Redis unavailable"));
        vi.spyOn(redisCache, "persist").mockRejectedValue(new Error("Redis unavailable"));

        const updated = await productService.update(product.id, { name: "Survives Redis outage" });

        expect(updated).toMatchObject({ id: product.id, name: "Survives Redis outage" });
    });

    it("falls back to PostgreSQL for list reads when Redis is unavailable", async () => {
        await createProduct();
        // Simulates redisCache.get returning null because the client is not open.
        vi.spyOn(redisCache, "get").mockResolvedValue(null);
        vi.spyOn(redisCache, "set").mockRejectedValue(new Error("Redis unavailable"));
        vi.spyOn(redisCache, "setIfAbsent").mockRejectedValue(new Error("Redis unavailable"));
        const repositorySpy = vi.spyOn(productRepository, "findAll");

        const response = await api.get("/api/products?page=1&limit=10");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(repositorySpy).toHaveBeenCalled();
    });
});
