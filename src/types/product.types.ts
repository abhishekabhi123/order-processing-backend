import { z } from "zod";
import {
    createProductSchema,
    updateProductSchema,
} from "../validators/product.validator.js";

export type CreateProductInput = z.infer<
    typeof createProductSchema
>;

export type UpdateProductInput = z.infer<
    typeof updateProductSchema
>;

export type ProductSortField = "name" | "price" | "createdAt" | "updatedAt";

export type sortOrder = "asc" | "desc"

export interface ProductQuery{
    page :number,
    limit : number,
    search?: string,
    categoryId? : string,
    minPrice?: number,
    maxPrice?: number,
    sort?: ProductSortField,
    order?: sortOrder,
}