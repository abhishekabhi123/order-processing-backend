import type { AuthTokens, RegisterUserInput, LoginUserInput } from "../types/auth.types.js";
import { userRepository } from "../repositories/user.repository.js";
import bcrypt from "bcrypt";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";
import { jwtService } from "./jwt.service.js";


export const authService = {
    async register(data: RegisterUserInput) {
        const { name, email, password } = data;
        const user = await userRepository.findByEmail(email);
        if (user) {
            throw new ApiError(HTTP_STATUS.CONFLICT, "User already exists");
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        return userRepository.create({ name, email, password: hashedPassword });
    },

    async login(data: LoginUserInput): Promise<AuthTokens> {
        const { email, password } = data;
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found");
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Invalid password");
        }
        const accessToken = jwtService.generateAccessToken({ sub: user.id, role: user.role });
        const refreshToken = jwtService.generateRefreshToken({ sub: user.id, role: user.role });
        return { accessToken, refreshToken };
    },

    async getCurrentUser(userId: string) {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found");
        }
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };
    }
}

