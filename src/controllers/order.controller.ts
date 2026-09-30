import type { NextFunction, Request, Response } from "express";
import { orderService } from "../services/order.service.js";
import { sendSuccess } from "../utils/responses.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";
import type { CreateOrderInput, OrderParams, OrderQuery, UpdateOrderStatusInput } from "../types/order.types.js";

export const orderController = {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const order = await orderService.create(req.user!.sub, req.validated as CreateOrderInput);
            return sendSuccess(res, order, HTTP_STATUS.CREATED, "Order created successfully");
        } catch (error) {
            next(error);
        }
    },

    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const query = req.validated as OrderQuery;
            const { orders, total } = await orderService.getAll(req.user!.sub, req.user!.role, query);
            res.set({
                "X-Page": String(query.page),
                "X-Page-Size": String(query.limit),
                "X-Total-Count": String(total),
                "X-Total-Pages": String(Math.ceil(total / query.limit)),
            });
            return sendSuccess(res, orders, HTTP_STATUS.OK, "Orders fetched successfully");
        } catch (error) {
            next(error);
        }
    },

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const order = await orderService.getById((req.validated as OrderParams).id, req.user!.sub, req.user!.role);
            return sendSuccess(res, order, HTTP_STATUS.OK, "Order fetched successfully");
        } catch (error) {
            next(error);
        }
    },

    async updateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const order = await orderService.updateStatus(req.params.id as string, (req.validated as UpdateOrderStatusInput).status);
            return sendSuccess(res, order, HTTP_STATUS.OK, "Order status updated successfully");
        } catch (error) {
            next(error);
        }
    },
};
