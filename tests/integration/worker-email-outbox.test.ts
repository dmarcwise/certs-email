import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { EmailOutboxPriorities } from '#lib/server/email.ts';
import { runEmailOutbox } from '#lib/server/worker-email-outbox.ts';
import type { Prisma } from '#prisma/generated/client.ts';
import { FakeLettermint } from '../support/fake-lettermint';
import { daysFromNow, getOutbox } from '../support/fixtures';

const lettermint = new FakeLettermint();

beforeAll(async () => {
	await lettermint.start();
	process.env.LETTERMINT_BASE_URL = lettermint.baseUrl;
});

afterAll(async () => {
	await lettermint.stop();
});

beforeEach(() => {
	lettermint.reset();
});

function queueEmail(data: Partial<Prisma.EmailOutboxCreateInput> = {}) {
	return db.emailOutbox.create({
		data: {
			recipients: ['user@example.com'],
			subject: 'Subject',
			body: '<p>HTML body</p>',
			textBody: 'Text body',
			templateName: 'Confirmation',
			priority: EmailOutboxPriorities.Medium,
			...data,
		},
	});
}

describe('runEmailOutbox', () => {
	it('sends pending emails through Lettermint and marks them as completed', async () => {
		const email = await queueEmail();

		await runEmailOutbox();

		expect(lettermint.emails).toEqual([
			{
				token: 'test-token',
				from: 'certs.email <support@dev.certs.email>',
				to: ['user@example.com'],
				subject: 'Subject',
				html: '<p>HTML body</p>',
				text: 'Text body',
				tag: 'DEV-CERTS-Confirmation',
			},
		]);

		const updated = await db.emailOutbox.findUniqueOrThrow({ where: { id: email.id } });
		expect(updated.status).toBe('Completed');
		expect(updated.completedAt).toBeInstanceOf(Date);
		expect(updated.failedAttempts).toBe(0);
	});

	it('sends emails by priority, then by creation order', async () => {
		await queueEmail({ subject: 'low', priority: EmailOutboxPriorities.Low });
		await queueEmail({ subject: 'medium-1', priority: EmailOutboxPriorities.Medium });
		await queueEmail({ subject: 'high', priority: EmailOutboxPriorities.High });
		await queueEmail({ subject: 'medium-2', priority: EmailOutboxPriorities.Medium });

		await runEmailOutbox();

		expect(lettermint.emails.map((email) => email.subject)).toEqual([
			'high',
			'medium-1',
			'medium-2',
			'low',
		]);
	});

	it('sends at most 10 emails per run', async () => {
		for (let i = 0; i < 12; i++) await queueEmail();

		await runEmailOutbox();
		expect(lettermint.emails).toHaveLength(10);

		await runEmailOutbox();
		expect(lettermint.emails).toHaveLength(12);
	});

	it('skips emails scheduled or waiting for a retry in the future', async () => {
		await queueEmail({ subject: 'later', sendAfter: daysFromNow(1) });
		await queueEmail({ subject: 'retry-later', retryAfter: daysFromNow(1) });
		await queueEmail({ subject: 'retry-now', retryAfter: daysFromNow(-1) });
		await queueEmail({ subject: 'completed', status: 'Completed' });

		await runEmailOutbox();

		expect(lettermint.emails.map((email) => email.subject)).toEqual(['retry-now']);
	});

	it('schedules a retry when sending fails', async () => {
		lettermint.failWithStatus = 422;
		const email = await queueEmail({ failedAttempts: 2 });

		const before = Date.now();
		await runEmailOutbox();

		const updated = await db.emailOutbox.findUniqueOrThrow({ where: { id: email.id } });
		expect(updated.status).toBe('Pending');
		expect(updated.failedAttempts).toBe(3);
		// 10s initial delay + 2^2 seconds of exponential backoff
		const delay = updated.retryAfter!.getTime() - before;
		expect(delay).toBeGreaterThanOrEqual(14_000);
		expect(delay).toBeLessThan(15_000);
	});

	it('gives up after 15 failed attempts', async () => {
		lettermint.failWithStatus = 422;
		const email = await queueEmail({ failedAttempts: 14 });

		await runEmailOutbox();

		const updated = await db.emailOutbox.findUniqueOrThrow({ where: { id: email.id } });
		expect(updated.status).toBe('Failed');
		expect(updated.failedAttempts).toBe(15);

		await runEmailOutbox();
		expect((await getOutbox())[0].failedAttempts).toBe(15);
	});
});
