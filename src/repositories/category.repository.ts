import prisma from "../config/database.js";
import type { Category, Prisma } from "../generated/prisma/client.js";

export const categoryRepository = {
    async create(data: Prisma.CategoryCreateInput): Promise<Category> {
        return prisma.category.create({ data });
    },

    async findAll(): Promise<Category[]> {
        return prisma.category.findMany({
            orderBy: { createdAt: "desc" },
        });
    },

    async findById(id: string): Promise<Category | null> {
        return prisma.category.findUnique({ where: { id } });
    },

    async update(id: string, data: Prisma.CategoryUpdateInput) {
        return prisma.category.update({ where: { id }, data });
    },

    async delete(id: string) {
        return prisma.category.delete({ where: { id } });
    },

    async findByName(name: string) {
        return prisma.category.findUnique({ where: { name } });
    },
}