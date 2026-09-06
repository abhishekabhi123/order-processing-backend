import { z } from "zod";

export const createProductSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(200, "Name cannot exceed 200 characters"),

    description: z
        .string()
        .trim()
        .max(1000, "Description cannot exceed 1000 characters")
        .optional(),

    sku: z
        .string()
        .trim()
        .min(2, "SKU must be at least 2 characters")
        .max(100, "SKU cannot exceed 100 characters"),

    price: z
        .number()
        .positive("Price must be greater than 0"),

    stock: z
        .number()
        .int("Stock must be an integer")
        .nonnegative("Stock cannot be negative"),

    imageUrl: z
        .string()
        .url("Invalid image URL")
        .optional(),

    categoryId: z
        .string()
        .min(1, "Category is required"),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
     page: z.coerce
        .number()
        .int()
        .positive()
        .default(1),

    limit: z.coerce
        .number()
        .int()
        .positive()
        .max(100)
        .default(10),

    search: z
        .string()
        .trim()
        .optional(),

    categoryId: z
        .string()
        .optional(),

    minPrice: z.coerce
        .number()
        .nonnegative()
        .optional(),

    maxPrice: z.coerce
        .number()
        .nonnegative()
        .optional(),

    sort: z
        .enum(["name", "price", "createdAt"])
        .default("createdAt"),

    order: z
        .enum(["asc", "desc"])
        .default("desc"),
})