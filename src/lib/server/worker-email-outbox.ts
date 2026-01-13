import { db } from '$lib/server/db';
import type { EmailOutbox } from '$prisma/generated/client';
import { createLogger } from '$lib/server/logger';
import { sendQueuedEmail } from '$lib/server/email';

export const EMAIL_OUTBOX_POLL_INTERVAL_MS = 10_000;
const EMAIL_OUTBOX_BATCH_SIZE = 10;
const EMAIL_OUTBOX_MAX_ATTEMPTS = 15;
const EMAIL_OUTBOX_INITIAL_DELAY_MS = 10_000;
const EMAIL_OUTBOX_MAX_DELAY_MS = 20 * 60 * 1000;

const logger = createLogger('worker-email-outbox');

export async function runEmailOutbox() {
	const jobs = await db.emailOutbox.findMany({
		where: {
			status: 'Pending',
			AND: [
				{
					OR: [{ sendAfter: null }, { sendAfter: { lte: new Date() } }]
				},
				{
					OR: [{ retryAfter: null }, { retryAfter: { lte: new Date() } }]
				}
			]
		},
		orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
		take: EMAIL_OUTBOX_BATCH_SIZE
	});

	if (jobs.length === 0) {
		return;
	}

	logger.info(`Processing ${jobs.length} queued emails`);

	for (const job of jobs) {
		await deliverEmailOutboxJob(job);
	}
}

async function deliverEmailOutboxJob(job: EmailOutbox) {
	logger.info(`Sending email ${job.id} to ${job.recipients.join(', ')}`);

	try {
		await sendQueuedEmail(job);

		await db.emailOutbox.update({
			where: { id: job.id },
			data: {
				status: 'Completed',
				completedAt: new Date(),
				retryAfter: null
			}
		});
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		const nextAttempts = job.failedAttempts + 1;

		if (nextAttempts >= EMAIL_OUTBOX_MAX_ATTEMPTS) {
			await db.emailOutbox.update({
				where: { id: job.id },
				data: {
					status: 'Failed',
					failedAttempts: nextAttempts
				}
			});

			logger.error(err, `Email outbox job ${job.id} failed permanently`);
			return;
		}

		const exponentialDelayMs = Math.min(2 ** job.failedAttempts * 1000, EMAIL_OUTBOX_MAX_DELAY_MS);
		const retryDelayMs = EMAIL_OUTBOX_INITIAL_DELAY_MS + exponentialDelayMs;
		const retryAfter = new Date(Date.now() + retryDelayMs);

		await db.emailOutbox.update({
			where: { id: job.id },
			data: {
				failedAttempts: nextAttempts,
				retryAfter
			}
		});

		logger.warn(
			err,
			`Email outbox job ${job.id} failed; retrying in ${retryDelayMs / 1000} seconds`
		);
	}
}
