import { Router } from "express";
import { productController } from "../controllers/product.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { Role } from "../generated/prisma/client.js";
import { createProductSchema, updateProductSchema } from "../validators/product.validator.js";

const router = Router();

router.post(
    "/",
    authMiddleware,
    authorize(Role.ADMIN),
    validate(createProductSchema),
    productController.create
);

router.get(
    "/",
    productController.getAll
);

router.get(
    "/:id",
    productController.getById
);
router.patch(
    "/:id",
    authMiddleware,
    authorize(Role.ADMIN),
    validate(updateProductSchema),
    productController.update
);
router.delete(
    "/:id",
    authMiddleware,
    authorize(Role.ADMIN),
    productController.deactivate
);

export default router;