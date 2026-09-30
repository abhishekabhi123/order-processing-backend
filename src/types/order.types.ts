import { z } from "zod";
import {
    createOrderSchema,
    orderParamsSchema,
    orderQuerySchema,
    updateOrderStatusSchema,
} from "../validators/order.validator.js";

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderParams = z.infer<typeof orderParamsSchema>;
export type OrderQuery = z.infer<typeof orderQuerySchema>;
