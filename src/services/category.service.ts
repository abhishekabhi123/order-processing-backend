import type { Category, Prisma } from "../generated/prisma/client.js";
import type { CategoryInput } from "../types/category.types.js";
import { toCategoryResponse } from "../mappers/category.mapper.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";


export const categoryService = {

    async create(data: CategoryInput) {
        const existing = await categoryRepository.findByName(data.name);

        if (existing) {
            throw new ApiError(
                HTTP_STATUS.CONFLICT,
                "Category already exists"
            );
        }

        const category = await categoryRepository.create({
            name: data.name,
            description: data.description as string | undefined,
        } as Prisma.CategoryCreateInput);

        return toCategoryResponse(category);
    },


    async getAll() {
        const categories = await categoryRepository.findAll();

        return categories.map(toCategoryResponse)
    },

    async getById(id: string): Promise<Category | null> {
        return categoryRepository.findById(id);
    },


}