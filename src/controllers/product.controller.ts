import type { NextFunction, Request, Response } from "express";
import { productService } from "../services/product.service.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";
import { sendSuccess } from "../utils/responses.js";

export const productController = {
    create: async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const product = await productService.create(req.body);

            return sendSuccess(
                res,
                product,
                HTTP_STATUS.CREATED,
                "Product created successfully"
            );
        } catch (error) {
            next(error);
        }
    },
    getAll: async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const products = await productService.getAll();

            return sendSuccess(
                res,
                products,
                HTTP_STATUS.OK,
                "Products fetched successfully"
            );
        } catch (error) {
            next(error);
        }
    },
    getById: async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const product = await productService.getById(
                req.params.id as string
            );

            return sendSuccess(
                res,
                product,
                HTTP_STATUS.OK,
                "Product fetched successfully"
            );
        } catch (error) {
            next(error);
        }
    },
    update: async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const product = await productService.update(
                req.params.id as string,
                req.body
            );

            return sendSuccess(
                res,
                product,
                HTTP_STATUS.OK,
                "Product updated successfully"
            );
        } catch (error) {
            next(error);
        }
    },
    deactivate: async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const product = await productService.deactivate(
                req.params.id as string
            );

            return sendSuccess(
                res,
                product,
                HTTP_STATUS.OK,
                "Product deactivated successfully"
            );
        } catch (error) {
            next(error);
        }
    },
};