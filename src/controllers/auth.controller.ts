import type { NextFunction, Request, Response } from "express"
import { authService } from "../services/auth.service.js";
import { sendSuccess } from "../utils/responses.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";


export const authController = {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, email, password } = req.body;
            const user = await authService.register({ name, email, password });
            return sendSuccess(
                res,
                user,
                HTTP_STATUS.CREATED,
                "User registered successfully"
            );
        } catch (error) {
            next(error);
        }
    }
}
