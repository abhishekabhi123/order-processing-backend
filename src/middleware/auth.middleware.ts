import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { jwtService } from "../services/jwt.service.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            throw new ApiError(
                HTTP_STATUS.UNAUTHORIZED,
                "Authentication required"
            );
        }
        const token = authHeader?.split(" ")[1];
        if (!token) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication token not provided");
        }
        const payload = jwtService.verifyToken(token);
        req.user = payload;
        next();
    } catch (error) {
        next(error);
    }
}