import { Router } from "express";
import { Role } from "../generated/prisma/client.js";
import { orderController } from "../controllers/order.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
    createOrderSchema,
    orderParamsSchema,
    orderQuerySchema,
    updateOrderStatusSchema,
} from "../validators/order.validator.js";

const router = Router();

router.use(authMiddleware);
router.post("/", validate(createOrderSchema), orderController.create);
router.get("/", validate(orderQuerySchema, "query"), orderController.getAll);
router.get("/:id", validate(orderParamsSchema, "params"), orderController.getById);
router.patch("/:id/status", authorize(Role.ADMIN), validate(orderParamsSchema, "params"), validate(updateOrderStatusSchema), orderController.updateStatus);

export default router;
