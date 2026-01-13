import { env } from '$env/dynamic/private';
import { MailtrapClient } from 'mailtrap';
import { building, dev } from '$app/environment';
import type { EmailOutbox } from '$prisma/generated/client';

if (!building && !env.MAILTRAP_API_KEY) throw new Error('MAILTRAP_API_KEY is not set');

const mailtrap = new MailtrapClient({
	token: env.MAILTRAP_API_KEY!
});

const defaultFrom = { name: 'certs.email', email: 'support@certs.email' };

export const EmailOutboxPriorities = {
	High: 0,
	Medium: 5,
	Low: 10
} as const;

export async function sendQueuedEmail(job: EmailOutbox) {
	let category = undefined;
	if (job.templateName) {
		category = dev ? `DEV-CERTS-${job.templateName}` : `PROD-CERTS-${job.templateName}`;
	}

	await mailtrap.send({
		from: defaultFrom,
		to: job.recipients.map((email) => ({ email })),
		subject: job.subject,
		html: job.body,
		category
	});
}
