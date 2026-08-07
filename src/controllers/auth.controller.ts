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
    },

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;
            const tokens = await authService.login({ email, password });
            return sendSuccess(
                res,
                tokens,
                HTTP_STATUS.OK,
                "User logged in successfully"
            );
        } catch (error) {
            next(error);
        }
    },

    async me(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await authService.getCurrentUser(req.user?.sub as string);
            return sendSuccess(res, user, HTTP_STATUS.OK, "User fetched successfully");
        } catch (error) {
            next(error);
        }
    }
}
