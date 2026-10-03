import app from "./app.js";

import env from "./config/env.js";
import { connectRedis } from "./config/redis.js";
import { startOutboxPublisher } from "./workers/outboxPublisher.js";

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

void connectRedis();
startOutboxPublisher();
