import { Prisma } from "../generated/prisma/client.js";
import { productRepository } from "../repositories/product.repository.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { toProductResponse } from "../mappers/product.mapper.js";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";
import type { CreateProductInput } from "../types/product.types.js";

export const productService = {
    create: async (data: CreateProductInput) => {
        const category = await categoryRepository.findById(data.categoryId);

        if (!category) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, "Category not found");
        }
        const existingProduct = await productRepository.findBySku(data.sku);
        if (existingProduct) {
            throw new ApiError(HTTP_STATUS.CONFLICT, "Product with this sku already exists");
        }

        const product = await productRepository.create({
            name: data.name,
            sku: data.sku,
            price: new Prisma.Decimal(data.price),
            stock: data.stock,
            description: data.description ?? null,
            imageUrl: data.imageUrl ?? null,

            category: {
                connect: {
                    id: data.categoryId,
                },
            },
        });

        return toProductResponse(product);
    },

    getAll: async () => {
        const products = await productRepository.findAll()
        return products.map(toProductResponse);

    },


    getById: async (id: string) => {
        const product = await productRepository.findById(id);
        if (!product) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, "Product not found");
        }
        return toProductResponse(product);
    }
}