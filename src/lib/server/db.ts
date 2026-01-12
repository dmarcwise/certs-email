import { PrismaClient } from '$prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';

if (!building && !env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
	globalForPrisma.prisma ??
	new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

if (dev) globalForPrisma.prisma = db;
