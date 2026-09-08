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

    async findAll({ skip, take }: { skip: number; take: number } ) {
        return prisma.product.findMany({
            where: { isActive: true },
            include: {
                category: true,
            },
            orderBy: {
                createdAt: "desc", 
            },
            skip : skip,
            take : take
        });
    },

    async findById(id: string) {
        return prisma.product.findFirst({
            where: { id, isActive: true },
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

    async update(
        id: string,
        data: Prisma.ProductUpdateInput
    ) {
        return prisma.product.update({
            where: { id },
            data,
            include: {
                category: true,
            },
        });
    },

    async deactivate(id: string) {
        return prisma.product.update({
            where: { id },
            data: {
                isActive: false,
            },
            include: {
                category: true,
            },
        });
    },

    async delete(id: string) {
        return prisma.product.delete({
            where: { id },
        });
    }
};