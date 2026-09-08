import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";

type validationType = "body" | "params" | "query"

export const validate = (schema: ZodType, target : validationType= "body") => (req: Request, res: Response, next: NextFunction) => {

    const result = schema.safeParse(req[target]);
    if (!result.success) {
        return next(new ApiError(HTTP_STATUS.BAD_REQUEST, result.error.issues.map(i => i.message).join(", ")));
    }

    (req as any).validated = result.data;
    next();

}