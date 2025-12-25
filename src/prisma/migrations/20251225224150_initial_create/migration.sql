-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('OK', 'EXPIRING_30DAYS', 'EXPIRING_14DAYS', 'EXPIRING_7DAYS', 'EXPIRING_1DAY', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "port" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMPTZ,
    "lastNotifiedAt" TIMESTAMPTZ,
    "notBefore" TIMESTAMPTZ,
    "notAfter" TIMESTAMPTZ,
    "status" "DomainStatus" NOT NULL,
    "error" TEXT,
    "errorStartedAt" TIMESTAMPTZ,
    "issuer" TEXT,
    "cn" TEXT,
    "san" TEXT[],
    "serial" TEXT,
    "fingerprint" TEXT,
    "ip" TEXT,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checks" (
    "id" SERIAL NOT NULL,
    "domainId" INTEGER NOT NULL,
    "checkedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "notBefore" TIMESTAMPTZ,
    "notAfter" TIMESTAMPTZ,
    "issuer" TEXT,
    "cn" TEXT,
    "san" TEXT[],
    "serial" TEXT,
    "fingerprint" TEXT,
    "ip" TEXT,

    CONSTRAINT "checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "domains_userId_name_port_key" ON "domains"("userId", "name", "port");

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checks" ADD CONSTRAINT "checks_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
