import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import prisma from "../src/config/database.js";
import { Role } from "../src/generated/prisma/client.js";
import { jwtService } from "../src/services/jwt.service.js";
import { withSerializationRetry } from "../src/utils/transactionRetry.js";

const api = request(app);

type UserFixture = {
    token: string;
};

const createUser = async (role: Role = Role.CUSTOMER): Promise<UserFixture> => {
    const user = await prisma.user.create({
        data: {
            name: `${role.toLowerCase()} user`,
            email: `${role.toLowerCase()}-${crypto.randomUUID()}@example.test`,
            password: "not-used-by-order-tests",
            role,
        },
    });

    return {
        token: jwtService.generateAccessToken({ sub: user.id, role: user.role }),
    };
};

const createProduct = async (stock = 10, isActive = true) => {
    const category = await prisma.category.create({
        data: { name: `category-${crypto.randomUUID()}` },
    });

    return prisma.product.create({
        data: {
            name: "Test product",
            sku: `sku-${crypto.randomUUID()}`,
            price: "12.50",
            stock,
            isActive,
            categoryId: category.id,
        },
    });
};

const createOrder = async (token: string, productId: string, quantity = 1) => {
    return api
        .post("/api/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({ items: [{ productId, quantity }] });
};

describe("Orders API", () => {
    it("creates an order and decrements stock", async () => {
        const customer = await createUser();
        const product = await createProduct(5);

        const response = await createOrder(customer.token, product.id, 2);

        expect(response.status).toBe(201);
        expect(response.body.data).toMatchObject({ status: "PENDING", total: "25" });
        expect(response.body.data.items).toEqual([
            expect.objectContaining({ productId: product.id, quantity: 2, unitPrice: "12.5" }),
        ]);
        await expect(prisma.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ stock: 3 });
    });

    it("rejects unknown and inactive products", async () => {
        const customer = await createUser();
        const inactiveProduct = await createProduct(5, false);

        expect((await createOrder(customer.token, inactiveProduct.id)).status).toBe(404);
        await prisma.product.delete({ where: { id: inactiveProduct.id } });
        expect((await createOrder(customer.token, inactiveProduct.id)).status).toBe(404);
    });

    it("rejects orders that exceed available stock", async () => {
        const customer = await createUser();
        const product = await createProduct(1);

        expect((await createOrder(customer.token, product.id, 2)).status).toBe(409);
        await expect(prisma.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ stock: 1 });
    });

    it("rejects duplicate product lines", async () => {
        const customer = await createUser();
        const product = await createProduct();

        const response = await api
            .post("/api/orders")
            .set("Authorization", `Bearer ${customer.token}`)
            .send({ items: [{ productId: product.id, quantity: 1 }, { productId: product.id, quantity: 1 }] });

        expect(response.status).toBe(400);
    });

    it.each([0, -1, 1.5, 1001, Number.MAX_SAFE_INTEGER + 1])("rejects invalid quantity %s", async (quantity) => {
        const customer = await createUser();
        const product = await createProduct();

        expect((await createOrder(customer.token, product.id, quantity)).status).toBe(400);
    });

    it("limits customers to their own orders", async () => {
        const owner = await createUser();
        const otherCustomer = await createUser();
        const product = await createProduct();
        const created = await createOrder(owner.token, product.id);

        const response = await api
            .get(`/api/orders/${created.body.data.id}`)
            .set("Authorization", `Bearer ${otherCustomer.token}`);

        expect(response.status).toBe(403);
    });

    it("allows admins to list all customer orders", async () => {
        const firstCustomer = await createUser();
        const secondCustomer = await createUser();
        const admin = await createUser(Role.ADMIN);
        const firstProduct = await createProduct();
        const secondProduct = await createProduct();

        await createOrder(firstCustomer.token, firstProduct.id);
        await createOrder(secondCustomer.token, secondProduct.id);

        const response = await api.get("/api/orders").set("Authorization", `Bearer ${admin.token}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.headers["x-total-count"]).toBe("2");
    });

    it("allows valid order status transitions", async () => {
        const customer = await createUser();
        const admin = await createUser(Role.ADMIN);
        const product = await createProduct();
        const created = await createOrder(customer.token, product.id);

        for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]) {
            const response = await api
                .patch(`/api/orders/${created.body.data.id}/status`)
                .set("Authorization", `Bearer ${admin.token}`)
                .send({ status });
            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe(status);
        }
    });

    it("rejects invalid order status transitions", async () => {
        const customer = await createUser();
        const admin = await createUser(Role.ADMIN);
        const product = await createProduct();
        const created = await createOrder(customer.token, product.id);

        const response = await api
            .patch(`/api/orders/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "SHIPPED" });

        expect(response.status).toBe(400);
    });

    it("restores stock when an order is cancelled", async () => {
        const customer = await createUser();
        const admin = await createUser(Role.ADMIN);
        const product = await createProduct(4);
        const created = await createOrder(customer.token, product.id, 2);

        const response = await api
            .patch(`/api/orders/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "CANCELLED" });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe("CANCELLED");
        await expect(prisma.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ stock: 4 });
    });

    it("does not restore stock twice after repeated cancellation", async () => {
        const customer = await createUser();
        const admin = await createUser(Role.ADMIN);
        const product = await createProduct(4);
        const created = await createOrder(customer.token, product.id, 2);

        const firstCancellation = await api
            .patch(`/api/orders/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "CANCELLED" });
        const repeatedCancellation = await api
            .patch(`/api/orders/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "CANCELLED" });

        expect(firstCancellation.status).toBe(200);
        expect(repeatedCancellation.status).toBe(400);
        await expect(prisma.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ stock: 4 });
    });

    it("paginates order lists while retaining the array response body", async () => {
        const customer = await createUser();
        const product = await createProduct(5);

        await createOrder(customer.token, product.id);
        await createOrder(customer.token, product.id);
        await createOrder(customer.token, product.id);

        const response = await api
            .get("/api/orders?page=2&limit=2")
            .set("Authorization", `Bearer ${customer.token}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.headers).toMatchObject({
            "x-page": "2",
            "x-page-size": "2",
            "x-total-count": "3",
            "x-total-pages": "2",
        });
    });

    it("allows exactly one concurrent purchase of the final unit", async () => {
        const customer = await createUser();
        const product = await createProduct(1);

        const [first, second] = await Promise.all([
            createOrder(customer.token, product.id),
            createOrder(customer.token, product.id),
        ]);

        expect([first.status, second.status].sort()).toEqual([201, 409]);
        await expect(prisma.order.count()).resolves.toBe(1);
        await expect(prisma.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ stock: 0 });
    });

    it("retries serialization failures until an operation succeeds", async () => {
        let attempts = 0;

        const value = await withSerializationRetry(async () => {
            attempts += 1;
            if (attempts < 3) throw { code: "P2034" };
            return "completed";
        });

        expect(value).toBe("completed");
        expect(attempts).toBe(3);
    });

    it("returns 409 after exhausted serialization retries", async () => {
        const customer = await createUser();
        const product = await createProduct();
        const transactionSpy = vi.spyOn(prisma, "$transaction").mockRejectedValue({ code: "P2034" });

        const response = await createOrder(customer.token, product.id);

        expect(response.status).toBe(409);
        expect(transactionSpy).toHaveBeenCalledTimes(3);
        transactionSpy.mockRestore();
    });
});
