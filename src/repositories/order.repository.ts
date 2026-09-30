import prisma from "../config/database.js";
import { OrderStatus, type Prisma } from "../generated/prisma/client.js";

const includeItems = { items: true } as const;
type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof includeItems }>;

export const orderRepository = {
    async findActiveProductsByIds(tx: Prisma.TransactionClient, ids: string[]) {
        return tx.product.findMany({
            where: { id: { in: ids }, isActive: true },
        });
    },

    async decrementProductStock(tx: Prisma.TransactionClient, productId: string, quantity: number) {
        return tx.product.updateMany({
            where: { id: productId, isActive: true, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
        });
    },

    async restoreProductStock(tx: Prisma.TransactionClient, productId: string, quantity: number) {
        return tx.product.update({
            where: { id: productId },
            data: { stock: { increment: quantity } },
        });
    },

    async create(tx: Prisma.TransactionClient, data: Prisma.OrderCreateInput): Promise<OrderWithItems> {
        return tx.order.create({ data, include: includeItems });
    },

    async findById(id: string): Promise<OrderWithItems | null> {
        return prisma.order.findUnique({ where: { id }, include: includeItems });
    },

    async findByIdInTransaction(tx: Prisma.TransactionClient, id: string): Promise<OrderWithItems | null> {
        return tx.order.findUnique({ where: { id }, include: includeItems });
    },

    async findAllByUserId(userId: string, skip: number, take: number): Promise<OrderWithItems[]> {
        return prisma.order.findMany({
            where: { userId },
            include: includeItems,
            orderBy: { createdAt: "desc" },
            skip,
            take,
        });
    },

    async countAllByUserId(userId: string): Promise<number> {
        return prisma.order.count({ where: { userId } });
    },

    async findAll(skip: number, take: number): Promise<OrderWithItems[]> {
        return prisma.order.findMany({
            include: includeItems,
            orderBy: { createdAt: "desc" },
            skip,
            take,
        });
    },

    async countAll(): Promise<number> {
        return prisma.order.count();
    },

    async updateStatusInTransaction(tx: Prisma.TransactionClient, id: string, status: OrderStatus): Promise<OrderWithItems> {
        return tx.order.update({
            where: { id },
            data: { status },
            include: includeItems,
        });
    },
};
