import { z } from "zod";

export const createCategorySchema = z.object({
    name: z.string().trim().min(2, "Category name must be at least 2 characters long").max(100, "Category name must be at most 100 characters long"),
    description: z.string().trim().max(500, "Category description must be at most 500 characters long").nullish().transform((val) => val ?? null),
});


