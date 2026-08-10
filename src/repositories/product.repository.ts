import prisma from "../config/database.js";
import type { Prisma, Product } from "../generated/prisma/client.js";

export const productRepository = {
    async create(data: Prisma.ProductCreateInput) {
        return prisma.product.create({
            data,
            include: {
                category: true,
            },
        });
    },

    async findAll() {
        return prisma.product.findMany({
            include: {
                category: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    },

    async findById(id: string) {
        return prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
            },
        });
    },

    async findBySku(sku: string): Promise<Product | null> {
        return prisma.product.findUnique({
            where: { sku },
        });
    },
};