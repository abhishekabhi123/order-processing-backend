import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";


const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.me)

export default router;