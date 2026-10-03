import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import prisma from "../src/config/database.js";
import { OutboxStatus, Role } from "../src/generated/prisma/client.js";
import { jwtService } from "../src/services/jwt.service.js";
import { processOutboxBatch } from "../src/workers/outboxPublisher.js";

const api = request(app);

const createUser = async (role: Role = Role.CUSTOMER) => {
    const user = await prisma.user.create({
        data: {
            name: "Outbox user",
            email: `outbox-${crypto.randomUUID()}@example.test`,
            password: "not-used-by-outbox-tests",
            role,
        },
    });

    return {
        user,
        token: jwtService.generateAccessToken({ sub: user.id, role: user.role }),
    };
};

const createProduct = async (stock = 10) => {
    const category = await prisma.category.create({
        data: { name: `outbox-category-${crypto.randomUUID()}` },
    });

    return prisma.product.create({
        data: {
            name: "Outbox product",
            sku: `outbox-sku-${crypto.randomUUID()}`,
            price: "12.50",
            stock,
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

afterEach(() => {
    vi.restoreAllMocks();
});

describe("Order outbox (Phase 1)", () => {
    it("creates exactly one order.created.v1 outbox event on successful order", async () => {
        const customer = await createUser();
        const product = await createProduct();

        // No broker is running in tests: a 201 here also proves the request
        // path is independent of RabbitMQ availability.
        const response = await createOrder(customer.token, product.id, 2);
        expect(response.status).toBe(201);

        const events = await prisma.outboxEvent.findMany({
            where: { aggregateId: response.body.data.id },
        });
        expect(events).toHaveLength(1);
        expect(events[0]!).toMatchObject({
            eventType: "order.created",
            eventVersion: 1,
            aggregateType: "order",
            status: OutboxStatus.PENDING,
            attempts: 0,
        });
        const payload = events[0]!.payload as unknown as Record<string, unknown>;
        expect(payload).toMatchObject({ status: "PENDING", total: "25" });
    });

    it("creates no outbox event when the order transaction rolls back", async () => {
        const customer = await createUser();
        const product = await createProduct(1);

        const response = await createOrder(customer.token, product.id, 2);
        expect(response.status).toBe(409);
        await expect(prisma.outboxEvent.count()).resolves.toBe(0);
    });

    it("creates an order.status_changed.v1 event on status change", async () => {
        const customer = await createUser();
        const admin = await createUser(Role.ADMIN);
        const product = await createProduct();
        const created = await createOrder(customer.token, product.id);
        expect(created.status).toBe(201);

        const response = await api
            .patch(`/api/orders/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "CONFIRMED" });
        expect(response.status).toBe(200);

        const events = await prisma.outboxEvent.findMany({
            where: { aggregateId: created.body.data.id },
            orderBy: { createdAt: "asc" },
        });
        expect(events).toHaveLength(2);
        expect(events[1]!).toMatchObject({
            eventType: "order.status_changed",
            eventVersion: 1,
            status: OutboxStatus.PENDING,
        });
        expect(events[1]!.metadata).toMatchObject({ fromStatus: "PENDING", toStatus: "CONFIRMED" });
    });

    it("creates an order.cancelled.v1 event with restored items on cancellation", async () => {
        const customer = await createUser();
        const admin = await createUser(Role.ADMIN);
        const product = await createProduct(4);
        const created = await createOrder(customer.token, product.id, 2);
        expect(created.status).toBe(201);

        const response = await api
            .patch(`/api/orders/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "CANCELLED" });
        expect(response.status).toBe(200);

        const events = await prisma.outboxEvent.findMany({
            where: { aggregateId: created.body.data.id },
            orderBy: { createdAt: "asc" },
        });
        expect(events).toHaveLength(2);
        expect(events[1]!).toMatchObject({
            eventType: "order.cancelled",
            eventVersion: 1,
            status: OutboxStatus.PENDING,
        });
        const payload = events[1]!.payload as unknown as {
            restoredItems: Array<{ productId: string; quantity: number }>;
        };
        expect(payload.restoredItems).toEqual([{ productId: product.id, quantity: 2 }]);
    });

    it("does not produce duplicate committed outbox events across P2034 retries", async () => {
        const customer = await createUser();
        const product = await createProduct();

        const transactionSpy = vi.spyOn(prisma, "$transaction");
        transactionSpy.mockRejectedValueOnce({ code: "P2034" });
        transactionSpy.mockRejectedValueOnce({ code: "P2034" });

        const response = await createOrder(customer.token, product.id);
        expect(response.status).toBe(201);
        expect(transactionSpy).toHaveBeenCalledTimes(3);

        // Only the committed attempt leaves an outbox row; rolled-back
        // attempts vanish with their transactions.
        await expect(
            prisma.outboxEvent.count({ where: { aggregateId: response.body.data.id } }),
        ).resolves.toBe(1);
    });

    it("leaves the event PENDING when the broker is unavailable", async () => {
        const customer = await createUser();
        const product = await createProduct();
        const created = await createOrder(customer.token, product.id);
        expect(created.status).toBe(201);

        const result = await processOutboxBatch({
            publish: async () => {
                throw new Error("connect ECONNREFUSED 127.0.0.1:5672");
            },
        });

        expect(result.claimed).toBe(1);
        expect(result.sent).toBe(0);
        const event = await prisma.outboxEvent.findFirstOrThrow({
            where: { aggregateId: created.body.data.id },
        });
        expect(event.status).toBe(OutboxStatus.PENDING);
        expect(event.attempts).toBe(1);
        expect(event.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("marks the event SENT on successful publish with the event ID as message ID", async () => {
        const customer = await createUser();
        const product = await createProduct();
        const created = await createOrder(customer.token, product.id);
        expect(created.status).toBe(201);

        const published: Array<{ eventId: string; routingKey: string; body: string }> = [];
        const result = await processOutboxBatch({
            publish: async (message) => {
                published.push(message);
            },
        });

        expect(result).toMatchObject({ claimed: 1, sent: 1 });
        expect(published).toHaveLength(1);
        const event = await prisma.outboxEvent.findFirstOrThrow({
            where: { aggregateId: created.body.data.id },
        });
        expect(published[0]!.eventId).toBe(event.eventId);
        expect(published[0]!.routingKey).toBe("order.created.v1");
        expect(JSON.parse(published[0]!.body)).toMatchObject({
            eventId: event.eventId,
            eventType: "order.created",
            aggregateId: created.body.data.id,
        });
        expect(event.status).toBe(OutboxStatus.SENT);
        expect(event.sentAt).not.toBeNull();
    });

    it("increments attempts and schedules retry on failed publish", async () => {
        const customer = await createUser();
        const product = await createProduct();
        const created = await createOrder(customer.token, product.id);
        expect(created.status).toBe(201);

        const before = Date.now();
        const result = await processOutboxBatch({
            publish: async () => {
                throw new Error("broker nack");
            },
        });

        expect(result).toMatchObject({ claimed: 1, sent: 0, pendingRetry: 1 });
        const event = await prisma.outboxEvent.findFirstOrThrow({
            where: { aggregateId: created.body.data.id },
        });
        expect(event).toMatchObject({ status: OutboxStatus.PENDING, attempts: 1 });
        expect(event.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(event.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it("recovers stale CLAIMED events while leaving fresh claims alone", async () => {
        const customer = await createUser();
        const staleProduct = await createProduct();
        const freshProduct = await createProduct();
        const staleOrder = await createOrder(customer.token, staleProduct.id);
        const freshOrder = await createOrder(customer.token, freshProduct.id);
        expect(staleOrder.status).toBe(201);
        expect(freshOrder.status).toBe(201);

        const staleEvent = await prisma.outboxEvent.findFirstOrThrow({
            where: { aggregateId: staleOrder.body.data.id },
        });
        await prisma.outboxEvent.update({
            where: { eventId: staleEvent.eventId },
            // Simulates a worker that crashed after claiming: the claim is
            // older than the staleness threshold.
            data: { status: OutboxStatus.CLAIMED, claimedAt: new Date(Date.now() - 600000), claimedBy: "dead-worker" },
        });
        const freshEvent = await prisma.outboxEvent.findFirstOrThrow({
            where: { aggregateId: freshOrder.body.data.id },
        });
        await prisma.outboxEvent.update({
            where: { eventId: freshEvent.eventId },
            data: { status: OutboxStatus.CLAIMED, claimedAt: new Date(), claimedBy: "live-worker" },
        });

        const published: string[] = [];
        const result = await processOutboxBatch({
            publish: async (message) => {
                published.push(message.eventId);
            },
            staleClaimMs: 60000,
        });

        expect(result.claimed).toBe(1);
        expect(published).toEqual([staleEvent.eventId]);
        await expect(
            prisma.outboxEvent.findUniqueOrThrow({ where: { eventId: staleEvent.eventId } }),
        ).resolves.toMatchObject({ status: OutboxStatus.SENT });
        await expect(
            prisma.outboxEvent.findUniqueOrThrow({ where: { eventId: freshEvent.eventId } }),
        ).resolves.toMatchObject({ status: OutboxStatus.CLAIMED });
    });
});
