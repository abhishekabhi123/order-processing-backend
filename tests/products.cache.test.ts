import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import prisma from "../src/config/database.js";
import { toProductResponse } from "../src/mappers/product.mapper.js";
import { productRepository } from "../src/repositories/product.repository.js";
import { productCache, productCacheKeys, productCacheTtlSeconds } from "../src/services/productCache.service.js";
import { productService } from "../src/services/product.service.js";
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
        const user = await prisma.user.create({
            data: {
                name: "Cache order user",
                email: `cache-order-${crypto.randomUUID()}@example.test`,
                password: "not-used",
            },
        });
        const { jwtService } = await import("../src/services/jwt.service.js");
        const token = jwtService.generateAccessToken({ sub: user.id, role: user.role });

        const response = await api
            .post("/api/orders")
            .set("Authorization", `Bearer ${token}`)
            .send({ items: [{ productId: product.id, quantity: 1 }] });

        expect(response.status).toBe(201);
        expect(invalidateSpy).toHaveBeenCalledWith(product.id);
    });
});
