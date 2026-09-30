import type { Prisma } from "../generated/prisma/client.js";

type OrderWithItems = Prisma.OrderGetPayload<{
    include: { items: true };
}>;

export const toOrderResponse = (order: OrderWithItems) => ({
    id: order.id,
    status: order.status,
    total: order.total,
    items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
});
