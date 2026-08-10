import type { User } from "../generated/prisma/client.js";


export const toUserResponse = (user: User) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    
}); 