import { afterAll, beforeEach, inject, vi } from 'vitest';

// Never use the env values from .env files (that could point to a real database):
// read them lazily from process.env, which is populated below.
vi.mock('$app/env/private', () => ({
	get WEBSITE_URL() {
		return process.env.WEBSITE_URL;
	},
	get DATABASE_URL() {
		return process.env.DATABASE_URL;
	},
	get LETTERMINT_API_TOKEN() {
		return process.env.LETTERMINT_API_TOKEN;
	},
	get LETTERMINT_BASE_URL() {
		return process.env.LETTERMINT_BASE_URL;
	},
	EMAIL_OUTBOX_POLL_INTERVAL_MS: undefined,
}));

// Keep the test output clean, unless TEST_LOGS is set
vi.mock('#lib/server/logger.ts', async (importOriginal) => {
	if (process.env.TEST_LOGS) return importOriginal();

	const { default: pino } = await import('pino');
	const logger = pino({ level: 'silent' });
	return { logger, createLogger: () => logger };
});

process.env.WEBSITE_URL = 'https://certs.test';
process.env.DATABASE_URL = inject('databaseUrl');
process.env.LETTERMINT_API_TOKEN = 'test-token';

const { db } = await import('#lib/server/db.ts');

beforeEach(async () => {
	await db.$executeRawUnsafe(
		'TRUNCATE TABLE users, domains, checks, email_outbox RESTART IDENTITY CASCADE',
	);
});

afterAll(async () => {
	await db.$disconnect();
});
