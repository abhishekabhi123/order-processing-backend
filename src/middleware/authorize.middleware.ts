import type { Request, Response, NextFunction } from "express";
import type { Role } from "../generated/prisma/client.js";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";


export function authorize(...roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "User not found");
        }
        if (!roles.includes(user.role)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, "User not authorized");
        }
        next();
    };
}