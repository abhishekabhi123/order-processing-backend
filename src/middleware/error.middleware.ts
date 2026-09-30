

import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";
import { isPrismaSerializationFailure } from "../utils/transactionRetry.js";

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

    if (isPrismaSerializationFailure(err)) {
        return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: "The order could not be completed due to concurrent updates. Please retry.",
            error: "TransactionConflict",
        });
    }

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
    });
};
