import crypto from "node:crypto";
import env from "../config/env.js";
import { publishOutboxMessage } from "../config/rabbitmq.js";
import { ORDER_EVENT_ROUTING_KEYS } from "../events/orderEvents.js";
import type { OutboxEvent } from "../generated/prisma/client.js";
import { outboxRepository } from "../repositories/outbox.repository.js";

export const OUTBOX_WORKER_ID = crypto.randomUUID();

const MAX_BACKOFF_MS = 5 * 60 * 1000;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const outboxSettings = {
    get pollIntervalMs() {
        return parsePositiveInt(env.OUTBOX_POLL_INTERVAL_MS, 1000);
    },
    get batchSize() {
        return parsePositiveInt(env.OUTBOX_BATCH_SIZE, 50);
    },
    get maxAttempts() {
        return parsePositiveInt(env.OUTBOX_MAX_ATTEMPTS, 25);
    },
    get staleClaimMs() {
        return parsePositiveInt(env.OUTBOX_CLAIM_TIMEOUT_MS, 300000);
    },
};

/**
 * Bounded exponential backoff: 1s, 2s, 4s, … capped at 5 minutes.
 * `attempts` is the updated (post-increment) failure count, >= 1.
 */
export const computeBackoffMs = (attempts: number): number => {
    const safeAttempts = Math.max(1, Math.floor(attempts));
    return Math.min(1000 * 2 ** (safeAttempts - 1), MAX_BACKOFF_MS);
};

const routingKeyFor = (event: OutboxEvent): string => {
    const known = (ORDER_EVENT_ROUTING_KEYS as Record<string, string>)[event.eventType];
    if (known) {
        return known;
    }
    return `${event.eventType}.v${event.eventVersion}`;
};

const toEnvelopeBody = (event: OutboxEvent): string => {
    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const { actorUserId, occurredAt, ...rest } = metadata;
    return JSON.stringify({
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        occurredAt: typeof occurredAt === "string" ? occurredAt : event.createdAt.toISOString(),
        ...(typeof actorUserId === "string" ? { actorUserId } : {}),
        payload: event.payload,
        metadata: rest,
    });
};

export type OutboxPublishFn = (input: {
    eventId: string;
    eventType: string;
    eventVersion: number;
    routingKey: string;
    body: string;
}) => Promise<void>;

const defaultPublish: OutboxPublishFn = (input) => publishOutboxMessage(input);

export interface ProcessOutboxBatchOptions {
    publish?: OutboxPublishFn;
    batchSize?: number;
    workerId?: string;
    staleClaimMs?: number;
    maxAttempts?: number;
}

export interface OutboxBatchResult {
    claimed: number;
    sent: number;
    failed: number;
    pendingRetry: number;
}

/**
 * Claim one batch of due events (PENDING due + stale CLAIMED for crash
 * recovery) and publish each with confirms. Success marks SENT; failure
 * increments attempts and schedules the next attempt with bounded backoff
 * (PARKED as FAILED once maxAttempts is reached). Never throws: per-event
 * failures are recorded on the row so one poison event cannot block the batch.
 */
export const processOutboxBatch = async (
    options: ProcessOutboxBatchOptions = {},
): Promise<OutboxBatchResult> => {
    const publish = options.publish ?? defaultPublish;
    const batchSize = options.batchSize ?? outboxSettings.batchSize;
    const workerId = options.workerId ?? OUTBOX_WORKER_ID;
    const staleClaimMs = options.staleClaimMs ?? outboxSettings.staleClaimMs;
    const maxAttempts = options.maxAttempts ?? outboxSettings.maxAttempts;

    const result: OutboxBatchResult = { claimed: 0, sent: 0, failed: 0, pendingRetry: 0 };

    let claimed: OutboxEvent[];
    try {
        claimed = await outboxRepository.claimDue({ batchSize, workerId, staleClaimMs });
    } catch (error) {
        console.warn("Outbox claim failed:", error instanceof Error ? error.message : error);
        return result;
    }
    result.claimed = claimed.length;

    for (const event of claimed) {
        try {
            await publish({
                eventId: event.eventId,
                eventType: event.eventType,
                eventVersion: event.eventVersion,
                routingKey: routingKeyFor(event),
                body: toEnvelopeBody(event),
            });
            await outboxRepository.markSent(event.eventId);
            result.sent += 1;
        } catch (error) {
            const attempts = event.attempts + 1;
            const exhausted = attempts >= maxAttempts;
            const nextAttemptAt = new Date(Date.now() + computeBackoffMs(attempts));
            try {
                await outboxRepository.recordFailure(event.eventId, attempts, nextAttemptAt, exhausted);
            } catch (dbError) {
                console.warn(
                    "Outbox failure bookkeeping failed:",
                    dbError instanceof Error ? dbError.message : dbError,
                );
            }
            if (exhausted) {
                result.failed += 1;
            } else {
                result.pendingRetry += 1;
            }
            console.warn(
                `Outbox publish failed for ${event.eventId} (attempt ${attempts}):`,
                error instanceof Error ? error.message : error,
            );
        }
    }

    return result;
};

let timer: NodeJS.Timeout | null = null;
let running = false;

const runLoop = async (): Promise<void> => {
    if (running) {
        return;
    }
    running = true;
    try {
        await processOutboxBatch();
    } catch (error) {
        console.warn("Outbox publisher loop failed:", error instanceof Error ? error.message : error);
    } finally {
        running = false;
    }
};

/**
 * Starts the in-process relay. Safe to call in server.ts only: tests import
 * app.ts, never server.ts, so the loop never runs under Vitest. The request
 * path never awaits the publisher; broker outages only delay delivery.
 */
export const startOutboxPublisher = (): void => {
    if (timer) {
        return;
    }
    timer = setInterval(() => {
        void runLoop();
    }, outboxSettings.pollIntervalMs);
    if (typeof timer.unref === "function") {
        timer.unref();
    }
    void runLoop();
};

export const stopOutboxPublisher = (): void => {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
};

/** Wake the relay after a commit (fire-and-forget; never awaited by the API). */
export const notifyOutboxPublisher = (): void => {
    if (timer && !running) {
        void runLoop();
    }
};
