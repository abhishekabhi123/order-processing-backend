import prisma from "../config/database.js";
import { OutboxStatus, type OutboxEvent, type Prisma } from "../generated/prisma/client.js";
import type { OrderEventEnvelope } from "../events/orderEvents.js";

export interface OutboxClaimOptions {
    batchSize: number;
    workerId: string;
    staleClaimMs: number;
}

interface ClaimRow {
    eventId: string;
}

export const outboxRepository = {
    async createInTransaction(
        tx: Prisma.TransactionClient,
        event: OrderEventEnvelope,
    ): Promise<OutboxEvent> {
        // actorUserId/occurredAt live at envelope level but must survive in
        // the row, so they are mirrored into metadata. The publisher
        // reconstructs the full envelope from these columns.
        const metadata = {
            ...(event.metadata ?? {}),
            ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
            occurredAt: event.occurredAt,
        };
        return tx.outboxEvent.create({
            data: {
                eventId: event.eventId,
                eventType: event.eventType,
                eventVersion: event.eventVersion,
                aggregateType: event.aggregateType,
                aggregateId: event.aggregateId,
                payload: event.payload as Prisma.InputJsonValue,
                metadata: metadata as Prisma.InputJsonValue,
            },
        });
    },

    /**
     * Atomically claim due events: PENDING rows whose retry time has come,
     * plus CLAIMED rows whose claim went stale (worker crash recovery).
     * Uses FOR UPDATE SKIP LOCKED so concurrent workers never double-claim.
     */
    async claimDue(options: OutboxClaimOptions): Promise<OutboxEvent[]> {
        const staleBefore = new Date(Date.now() - options.staleClaimMs);
        const now = new Date();

        return prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw<ClaimRow[]>`
                SELECT "eventId"
                FROM "outbox_events"
                WHERE (
                    ("status" = 'PENDING' AND "nextAttemptAt" <= ${now})
                    OR ("status" = 'CLAIMED' AND "claimedAt" <= ${staleBefore})
                )
                ORDER BY "createdAt" ASC
                LIMIT ${options.batchSize}
                FOR UPDATE SKIP LOCKED
            `;

            if (rows.length === 0) {
                return [];
            }

            const ids = rows.map((row) => row.eventId);
            await tx.outboxEvent.updateMany({
                where: { eventId: { in: ids } },
                data: {
                    status: OutboxStatus.CLAIMED,
                    claimedAt: now,
                    claimedBy: options.workerId,
                },
            });

            return tx.outboxEvent.findMany({ where: { eventId: { in: ids } } });
        });
    },

    async markSent(eventId: string): Promise<void> {
        await prisma.outboxEvent.update({
            where: { eventId },
            data: { status: OutboxStatus.SENT, sentAt: new Date() },
        });
    },

    async recordFailure(eventId: string, attempts: number, nextAttemptAt: Date, failed: boolean): Promise<void> {
        await prisma.outboxEvent.update({
            where: { eventId },
            data: {
                status: failed ? OutboxStatus.FAILED : OutboxStatus.PENDING,
                attempts,
                nextAttemptAt,
                claimedAt: null,
                claimedBy: null,
            },
        });
    },

    async findById(eventId: string): Promise<OutboxEvent | null> {
        return prisma.outboxEvent.findUnique({ where: { eventId } });
    },

    async countByAggregate(aggregateId: string): Promise<number> {
        return prisma.outboxEvent.count({ where: { aggregateId } });
    },
};
