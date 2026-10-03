-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'CLAIMED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "outbox_events" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL DEFAULT 'order',
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "outbox_events_status_nextAttemptAt_createdAt_idx" ON "outbox_events"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateId_createdAt_idx" ON "outbox_events"("aggregateId", "createdAt");
