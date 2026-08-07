import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";

export const validate = (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {

    const result = schema.safeParse(req.body);
    if (!result.success) {
        return next(new ApiError(HTTP_STATUS.BAD_REQUEST, result.error.issues.map(i => i.message).join(", ")));
    }

    req.body = result.data;
    next();

}