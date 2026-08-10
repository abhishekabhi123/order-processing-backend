import type { Prisma } from "../generated/prisma/client.js"

type ProductWithCategory = Prisma.ProductGetPayload<{
    include: {
        category: true;
    };
}>;

export const toProductResponse = (
    product: ProductWithCategory
) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    sku: product.sku,
    price: product.price,
    stock: product.stock,
    imageUrl: product.imageUrl,
    isActive: product.isActive,

    category: {
        id: product.category.id,
        name: product.category.name,
    },

    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
});

export const toProductResponses = (
    products: ProductWithCategory[]
) => {
    return products.map(toProductResponse);
};