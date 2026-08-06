

import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error(err);

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            error: err.name
        });
    }

    res.status(500).json({
        success: false,
        message: "Internal Server Error",
    });
};