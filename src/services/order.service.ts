import { Prisma, Role, OrderStatus } from "../generated/prisma/client.js";
import { orderRepository } from "../repositories/order.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import {
    buildOrderCancelledEvent,
    buildOrderCreatedEvent,
    buildOrderStatusChangedEvent,
} from "../events/orderEvents.js";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";
import { toOrderResponse } from "../mappers/order.mapper.js";
import type { CreateOrderInput, OrderQuery } from "../types/order.types.js";
import prisma from "../config/database.js";
import { withSerializationRetry } from "../utils/transactionRetry.js";
import { productCache } from "./productCache.service.js";

const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    PROCESSING: [OrderStatus.SHIPPED],
    SHIPPED: [OrderStatus.DELIVERED],
    DELIVERED: [],
    CANCELLED: [],
};

export const orderService = {
    async create(userId: string, data: CreateOrderInput) {
        const order = await withSerializationRetry(() => prisma.$transaction(async (tx) => {
            const productIds = data.items.map((item) => item.productId);
            const products = await orderRepository.findActiveProductsByIds(tx, productIds);

            if (products.length !== productIds.length) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, "One or more products were not found");
            }

            const productsById = new Map(products.map((product) => [product.id, product]));
            let total = new Prisma.Decimal(0);

            for (const item of data.items) {
                const product = productsById.get(item.productId)!;
                if (product.stock < item.quantity) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, `Insufficient stock for ${product.name}`);
                }

                const result = await orderRepository.decrementProductStock(tx, product.id, item.quantity);
                if (result.count !== 1) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, `Insufficient stock for ${product.name}`);
                }
                total = total.plus(product.price.mul(item.quantity));
            }

            const order = await orderRepository.create(tx, {
                user: { connect: { id: userId } },
                total,
                items: {
                    create: data.items.map((item) => {
                        const product = productsById.get(item.productId)!;
                        return {
                            product: { connect: { id: product.id } },
                            productName: product.name,
                            sku: product.sku,
                            unitPrice: product.price,
                            quantity: item.quantity,
                        };
                    }),
                },
            });

            // Outbox insert is part of the same serializable transaction:
            // it commits if and only if the order commits, and rolls back
            // with it (including on exhausted P2034 retries). The broker
            // is never touched here, so broker outages cannot fail the API.
            await outboxRepository.createInTransaction(tx, {
                eventId: crypto.randomUUID(),
                occurredAt: new Date().toISOString(),
                ...buildOrderCreatedEvent(order, userId),
            });
            return order;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

        await Promise.all(data.items.map((item) => productCache.invalidateProduct(item.productId)));
        return toOrderResponse(order);
    },

    async getAll(userId: string, role: Role, query: OrderQuery) {
        const skip = (query.page - 1) * query.limit;
        const [orders, total] = role === Role.ADMIN
            ? await Promise.all([
                orderRepository.findAll(skip, query.limit),
                orderRepository.countAll(),
            ])
            : await Promise.all([
                orderRepository.findAllByUserId(userId, skip, query.limit),
                orderRepository.countAllByUserId(userId),
            ]);

        return { orders: orders.map(toOrderResponse), total };
    },

    async getById(id: string, userId: string, role: Role) {
        const order = await orderRepository.findById(id);
        if (!order) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, "Order not found");
        }
        if (role !== Role.ADMIN && order.userId !== userId) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, "User not authorized to access this order");
        }
        return toOrderResponse(order);
    },

    async updateStatus(id: string, status: OrderStatus) {
        const updatedOrder = await withSerializationRetry(() => prisma.$transaction(async (tx) => {
            const order = await orderRepository.findByIdInTransaction(tx, id);
            if (!order) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, "Order not found");
            }
            if (!validTransitions[order.status].includes(status)) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Cannot change order status from ${order.status} to ${status}`);
            }

            if (status === OrderStatus.CANCELLED) {
                for (const item of order.items) {
                    await orderRepository.restoreProductStock(tx, item.productId, item.quantity);
                }
            }

            const fromStatus = order.status;
            const updated = await orderRepository.updateStatusInTransaction(tx, id, status);
            await outboxRepository.createInTransaction(tx, {
                eventId: crypto.randomUUID(),
                occurredAt: new Date().toISOString(),
                ...(status === OrderStatus.CANCELLED
                    ? buildOrderCancelledEvent(updated, fromStatus)
                    : buildOrderStatusChangedEvent(updated, fromStatus)),
            });
            return updated;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

        if (status === OrderStatus.CANCELLED) {
            await Promise.all(updatedOrder.items.map((item) => productCache.invalidateProduct(item.productId)));
        }
        return toOrderResponse(updatedOrder);
    },
};
