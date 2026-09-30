import { afterAll, beforeEach } from "vitest";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL must point to a dedicated test database.");
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = "orderflow-test-access-secret";
process.env.JWT_REFRESH_SECRET = "orderflow-test-refresh-secret";
process.env.NODE_ENV = "test";

const { default: prisma } = await import("../src/config/database.js");

beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
});

afterAll(async () => {
    await prisma.$disconnect();
});
