import express from "express";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFoundHandler } from "./middleware/notFound.middleware.js";


const app = express();
app.use(express.json());
app.use("/api",routes);
app.use(errorHandler);
app.use(notFoundHandler);

export default app;
