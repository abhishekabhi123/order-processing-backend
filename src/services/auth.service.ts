import type { RegisterUserInput } from "../types/auth.types.js";
import { userRepository } from "../repositories/user.repository.js";
import bcrypt from "bcrypt";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/httpCodes.js";


export const authService = {
    async register(data: RegisterUserInput) {
        const { name, email, password } = data;
        const user = await userRepository.findByEmail(email);
        if (user) {
            throw new ApiError(HTTP_STATUS.CONFLICT, "User already exists");
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        return userRepository.create({ name, email, password: hashedPassword });
    }
}

