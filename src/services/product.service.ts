import { Prisma } from "../generated/prisma/client.js";
import { productRepository } from "../repositories/product.repository.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { toProductResponse } from "../mappers/product.mapper.js";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";
import type { CreateProductInput, ProductQuery, UpdateProductInput } from "../types/product.types.js";


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

    getAll: async (query : ProductQuery) => {
        const {page, limit } = query;
        let skip =  (page - 1) * limit;
        const products = await productRepository.findAll({
            skip, take : limit,
        })
        return products.map(toProductResponse);

    },


    getById: async (id: string) => {
        const product = await productRepository.findById(id);
        if (!product) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, "Product not found");
        }
        return toProductResponse(product);
    },
    update: async (id: string, data: UpdateProductInput) => {
        const existingProduct = await productRepository.findById(id);

        if (!existingProduct) {
            throw new ApiError(
                HTTP_STATUS.NOT_FOUND,
                "Product not found"
            );
        }

        if (data.categoryId) {
            const category = await categoryRepository.findById(
                data.categoryId
            );

            if (!category) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    "Category not found"
                );
            }
        }

        if (data.sku && data.sku !== existingProduct.sku) {
            const existingSku =
                await productRepository.findBySku(data.sku);

            if (existingSku) {
                throw new ApiError(
                    HTTP_STATUS.CONFLICT,
                    "Product with this SKU already exists"
                );
            }
        }

        const updateData: Prisma.ProductUpdateInput = {
            ...(data.name !== undefined && {
                name: data.name,
            }),

            ...(data.description !== undefined && {
                description: data.description,
            }),

            ...(data.sku !== undefined && {
                sku: data.sku,
            }),

            ...(data.price !== undefined && {
                price: new Prisma.Decimal(data.price),
            }),

            ...(data.stock !== undefined && {
                stock: data.stock,
            }),

            ...(data.imageUrl !== undefined && {
                imageUrl: data.imageUrl,
            }),

            ...(data.categoryId !== undefined && {
                category: {
                    connect: {
                        id: data.categoryId,
                    },
                },
            }),
        };

        const product = await productRepository.update(
            id,
            updateData
        );

        return toProductResponse(product);
    },
    deactivate: async (id: string) => {
        const product = await productRepository.findById(id);

        if (!product || !product.isActive) {
            throw new ApiError(
                HTTP_STATUS.NOT_FOUND,
                "Product not found"
            );
        }

        const deactivatedProduct =
            await productRepository.deactivate(id);

        return toProductResponse(deactivatedProduct);
    },
}