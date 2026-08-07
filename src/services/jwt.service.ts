import jwt from "jsonwebtoken";
import env from "../config/env.js";
import type { JwtPayload } from "../types/jwt.types.js";


export const jwtService = {
    generateAccessToken: (payload: JwtPayload): string => {
        return jwt.sign(payload, env.JWT_SECRET, {
            expiresIn: env.JWT_ACCESS_EXPIRES_IN,
        } as jwt.SignOptions);
    },

    generateRefreshToken: (payload: JwtPayload): string => {
        return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
            expiresIn: env.JWT_REFRESH_EXPIRES_IN,
        } as jwt.SignOptions);
    },

    verifyToken: (token: string, isRefreshToken: boolean = false): JwtPayload => {
        const secret = isRefreshToken ? env.JWT_REFRESH_SECRET : env.JWT_SECRET;
        return jwt.verify(token, secret) as JwtPayload;
    },
};