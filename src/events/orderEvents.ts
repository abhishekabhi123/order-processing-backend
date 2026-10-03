import type { Prisma } from "../generated/prisma/client.js";

export const ORDER_EVENT_TYPES = {
    CREATED: "order.created",
    STATUS_CHANGED: "order.status_changed",
    CANCELLED: "order.cancelled",
} as const;

export type OrderEventType = (typeof ORDER_EVENT_TYPES)[keyof typeof ORDER_EVENT_TYPES];

export const ORDER_EVENT_VERSION = 1;

export const ORDER_EVENT_ROUTING_KEYS = {
    [ORDER_EVENT_TYPES.CREATED]: "order.created.v1",
    [ORDER_EVENT_TYPES.STATUS_CHANGED]: "order.status_changed.v1",
    [ORDER_EVENT_TYPES.CANCELLED]: "order.cancelled.v1",
} as const;

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

export interface OrderEventEnvelope {
    eventId: string;
    eventType: OrderEventType;
    eventVersion: number;
    aggregateType: "order";
    aggregateId: string;
    occurredAt: string;
    actorUserId?: string;
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

const toItemSnapshot = (item: OrderWithItems["items"][number]) => ({
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    unitPrice: item.unitPrice.toString(),
    quantity: item.quantity,
});

const toOrderSnapshot = (order: OrderWithItems) => ({
    orderId: order.id,
    userId: order.userId,
    status: order.status,
    total: order.total.toString(),
    items: order.items.map(toItemSnapshot),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
});

export const buildOrderCreatedEvent = (
    order: OrderWithItems,
    actorUserId: string,
): Omit<OrderEventEnvelope, "eventId" | "occurredAt"> => ({
    eventType: ORDER_EVENT_TYPES.CREATED,
    eventVersion: ORDER_EVENT_VERSION,
    aggregateType: "order",
    aggregateId: order.id,
    actorUserId,
    payload: toOrderSnapshot(order),
    metadata: { toStatus: order.status },
});

export const buildOrderStatusChangedEvent = (
    order: OrderWithItems,
    fromStatus: string,
    actorUserId?: string,
): Omit<OrderEventEnvelope, "eventId" | "occurredAt"> => ({
    eventType: ORDER_EVENT_TYPES.STATUS_CHANGED,
    eventVersion: ORDER_EVENT_VERSION,
    aggregateType: "order",
    aggregateId: order.id,
    ...(actorUserId ? { actorUserId } : {}),
    payload: toOrderSnapshot(order),
    metadata: { fromStatus, toStatus: order.status },
});

export const buildOrderCancelledEvent = (
    order: OrderWithItems,
    fromStatus: string,
    actorUserId?: string,
): Omit<OrderEventEnvelope, "eventId" | "occurredAt"> => ({
    eventType: ORDER_EVENT_TYPES.CANCELLED,
    eventVersion: ORDER_EVENT_VERSION,
    aggregateType: "order",
    aggregateId: order.id,
    ...(actorUserId ? { actorUserId } : {}),
    payload: {
        ...toOrderSnapshot(order),
        restoredItems: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
        })),
    },
    metadata: { fromStatus, toStatus: order.status },
});
