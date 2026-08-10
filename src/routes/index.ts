import { Router } from "express";
import healthRoutes from "./health.route.js";
import authRoutes from "./auth.route.js"
import categoryRoutes from "./category.routes.js"


const router = Router();


router.use("/health", healthRoutes)
router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes)

export default router;