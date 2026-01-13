-- CreateEnum
CREATE TYPE "email_outbox_status" AS ENUM ('Pending', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendAfter" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "status" "email_outbox_status" NOT NULL DEFAULT 'Pending',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "retryAfter" TIMESTAMPTZ,
    "priority" INTEGER NOT NULL,
    "recipients" TEXT[],
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateName" TEXT,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);
