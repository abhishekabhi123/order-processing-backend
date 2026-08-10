import { Router } from "express";
import { categoryController } from "../controllers/category.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { createCategorySchema } from "../validators/category.validator.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { Role } from "../generated/prisma/enums.js";

const router = Router();

router.get("/", categoryController.getAll);
router.get("/:id", categoryController.getById);
router.post("/", authMiddleware, authorize(Role.ADMIN), validate(createCategorySchema), categoryController.create);

export default router;