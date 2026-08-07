export interface RegisterUserInput {
    name: string;
    email: string;
    password: string;
}

export interface LoginUserInput {
    email: string;
    password: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}