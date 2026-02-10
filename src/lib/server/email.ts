import { env } from '$env/dynamic/private';
import { MailtrapClient } from 'mailtrap';
import { Lettermint } from 'lettermint';
import { building, dev } from '$app/environment';
import type { EmailOutbox } from '$prisma/generated/client';

const provider = env.EMAIL_PROVIDER || 'lettermint';

if (!building) {
	if (provider === 'mailtrap' && !env.MAILTRAP_API_KEY) {
		throw new Error('MAILTRAP_API_KEY is not set');
	}
	if (provider === 'lettermint' && !env.LETTERMINT_API_TOKEN) {
		throw new Error('LETTERMINT_API_TOKEN is not set');
	}
}

let mailtrap: MailtrapClient | undefined;
let lettermint: Lettermint | undefined;

function getMailtrap() {
	if (!mailtrap) mailtrap = new MailtrapClient({ token: env.MAILTRAP_API_KEY! });
	return mailtrap;
}

function getLettermint() {
	if (!lettermint) lettermint = new Lettermint({ apiToken: env.LETTERMINT_API_TOKEN! });
	return lettermint;
}

const defaultFrom = { name: 'certs.email', email: dev ? 'support@dev.certs.email' : 'support@certs.email' };

export const EmailOutboxPriorities = {
	High: 0,
	Medium: 5,
	Low: 10
} as const;

async function sendEmail(options: { to: string[]; subject: string; html: string; tag?: string }) {
	if (provider === 'mailtrap') {
		await getMailtrap().send({
			from: defaultFrom,
			to: options.to.map((email) => ({ email })),
			subject: options.subject,
			html: options.html,
			category: options.tag
		});
	} else {
		const email = getLettermint()
			.email.from(`${defaultFrom.name} <${defaultFrom.email}>`)
			.to(...options.to)
			.subject(options.subject)
			.html(options.html);

		if (options.tag) email.tag(options.tag);

		await email.send();
	}
}

export async function sendQueuedEmail(job: EmailOutbox) {
	let tag = undefined;
	if (job.templateName) {
		tag = dev ? `DEV-CERTS-${job.templateName}` : `PROD-CERTS-${job.templateName}`;
	}

	await sendEmail({
		to: job.recipients,
		subject: job.subject,
		html: job.body,
		tag
	});
}
