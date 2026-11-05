import { PrismaClient } from '#prisma/generated/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { building, dev } from '$app/env';
import { DATABASE_URL } from '$app/env/private';

if (!building && !DATABASE_URL) throw new Error('DATABASE_URL is not set');

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter: new PrismaPg({
			connectionString: DATABASE_URL,
			ssl: !dev && { rejectUnauthorized: false },
		}),
	});

if (dev) globalForPrisma.prisma = db;
