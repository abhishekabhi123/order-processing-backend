import { Prisma } from "../generated/prisma/client.js";
import { productRepository } from "../repositories/product.repository.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { toProductResponse } from "../mappers/product.mapper.js";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";
import type { CreateProductInput, ProductQuery, UpdateProductInput } from "../types/product.types.js";
import { productCache } from "./productCache.service.js";


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

        const response = toProductResponse(product);
        await productCache.invalidateProduct();
        return response;
    },

    getAll: async (query : ProductQuery) => {
        const {page, limit } = query;
        let skip =  (page - 1) * limit;
        const cachedProducts = await productCache.getProducts<ReturnType<typeof toProductResponse>[]>(query);
        if (cachedProducts) {
            return cachedProducts;
        }

        const products = await productRepository.findAll({
            skip, take : limit,
        })
        const response = products.map(toProductResponse);
        await productCache.setProducts(query, response);
        return response;

    },


    getById: async (id: string) => {
        const cachedProduct = await productCache.getProduct<ReturnType<typeof toProductResponse>>(id);
        if (cachedProduct) {
            return cachedProduct;
        }

        const product = await productRepository.findById(id);
        if (!product) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, "Product not found");
        }
        const response = toProductResponse(product);
        await productCache.setProduct(id, response);
        return response;
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

        const response = toProductResponse(product);
        await productCache.invalidateProduct(id);
        return response;
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

        const response = toProductResponse(deactivatedProduct);
        await productCache.invalidateProduct(id);
        return response;
    },
}
