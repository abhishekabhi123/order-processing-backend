import { z } from "zod";

const orderIdSchema = z.string().cuid("Invalid order ID");
const productIdSchema = z.string().cuid("Invalid product ID");

export const createOrderSchema = z.object({
    items: z.array(z.object({
        productId: productIdSchema,
        quantity: z.number().int("Quantity must be an integer").safe().positive("Quantity must be greater than 0").max(1_000, "Quantity cannot exceed 1000"),
    })).min(1, "An order must contain at least one item").max(50, "An order cannot contain more than 50 items").superRefine((items, ctx) => {
        const productIds = new Set<string>();

        items.forEach((item, index) => {
            if (productIds.has(item.productId)) {
                ctx.addIssue({
                    code: "custom",
                    message: "Each product can only appear once in an order",
                    path: [index, "productId"],
                });
            }
            productIds.add(item.productId);
        });
    }),
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export const orderParamsSchema = z.object({
    id: orderIdSchema,
});

export const orderQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
