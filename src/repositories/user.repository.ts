import type { Prisma, User } from "../generated/prisma/client.js";
import prisma from "../config/database.js";


export const userRepository = {
    async create(data: Prisma.UserCreateInput): Promise<User> {
        return prisma.user.create({ data });
    },

    async findByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email }
        });
    },

    async findById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id }
        })
    }
}