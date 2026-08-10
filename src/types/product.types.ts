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