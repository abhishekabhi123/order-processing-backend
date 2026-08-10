import type { Category } from "../generated/prisma/client.js";


export const toCategoryResponse = (category: Category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
});