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