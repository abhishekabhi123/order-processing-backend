import { connect, type Channel, type ChannelModel, type ConfirmChannel } from "amqplib";
import env from "./env.js";

export const ORDERFLOW_EXCHANGE = "orderflow.events";

let connection: ChannelModel | null = null;
let confirmChannel: ConfirmChannel | null = null;
let connectPromise: Promise<ConfirmChannel> | null = null;

const createChannel = async (): Promise<ConfirmChannel> => {
    const freshConnection = await connect(env.RABBITMQ_URL);
    connection = freshConnection;
    freshConnection.on("error", () => {
        void resetRabbitMq();
    });
    freshConnection.on("close", () => {
        void resetRabbitMq();
    });

    const channel = await freshConnection.createConfirmChannel();
    await channel.assertExchange(ORDERFLOW_EXCHANGE, "topic", { durable: true });
    return channel;
};

export const getRabbitConfirmChannel = async (): Promise<ConfirmChannel> => {
    if (confirmChannel) {
        return confirmChannel;
    }
    if (!connectPromise) {
        connectPromise = createChannel().then((channel) => {
            confirmChannel = channel;
            connectPromise = null;
            return channel;
        }).catch((error) => {
            connectPromise = null;
            throw error;
        });
    }
    return connectPromise;
};

export const resetRabbitMq = async (): Promise<void> => {
    connectPromise = null;
    const channelToClose: Channel | null = confirmChannel;
    confirmChannel = null;
    if (channelToClose) {
        try {
            await channelToClose.close();
        } catch {
            // Best effort; a broken channel is simply discarded.
        }
    }
    const connectionToClose = connection;
    connection = null;
    if (connectionToClose) {
        try {
            await connectionToClose.close();
        } catch {
            // Best effort; a broken connection is simply discarded.
        }
    }
};

export const closeRabbitMq = async (): Promise<void> => {
    await resetRabbitMq();
};

export interface OutboxPublishInput {
    eventId: string;
    eventType: string;
    eventVersion: number;
    routingKey: string;
    body: string;
}

/**
 * Publishes one outbox event with publisher confirms. The message is
 * persistent and carries the outbox eventId as the AMQP messageId so
 * consumers can deduplicate redeliveries.
 */
export const publishOutboxMessage = async (message: OutboxPublishInput): Promise<void> => {
    let channel: ConfirmChannel;
    try {
        channel = await getRabbitConfirmChannel();
    } catch (error) {
        throw error instanceof Error ? error : new Error("RabbitMQ connection failed");
    }

    try {
        channel.publish(ORDERFLOW_EXCHANGE, message.routingKey, Buffer.from(message.body), {
            persistent: true,
            messageId: message.eventId,
            contentType: "application/json",
            headers: {
                eventType: message.eventType,
                eventVersion: message.eventVersion,
            },
        });
        await channel.waitForConfirms();
    } catch (error) {
        // A failed channel cannot be reused; drop it so the next publish reconnects.
        await resetRabbitMq();
        throw error instanceof Error ? error : new Error("RabbitMQ publish failed");
    }
};
