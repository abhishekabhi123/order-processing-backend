import type { NextFunction, Request, Response } from "express";
import { categoryService } from "../services/category.service.js";
import { sendSuccess } from "../utils/responses.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";


export const categoryController = {
    create: async (req: Request, res: Response) => {
        const { name, description } = req.body;
        const category = await categoryService.create({ name, description });
        sendSuccess(res, category, HTTP_STATUS.CREATED, "Category created successfully");
    },
    getAll: async (req: Request, res: Response) => {
        const categories = await categoryService.getAll();
        sendSuccess(res, categories, HTTP_STATUS.OK, "Categories fetched successfully");
    },

    getById: async (req: Request, res: Response) => {
        const category = await categoryService.getById(req.params.id as string);
        sendSuccess(res, category, HTTP_STATUS.OK, "Category fetched successfully");
    }

}