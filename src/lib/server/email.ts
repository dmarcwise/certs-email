import { env } from '$env/dynamic/private';
import { Lettermint } from 'lettermint';
import { building, dev } from '$app/environment';
import type { EmailOutbox } from '$prisma/generated/client';

if (!building && !env.LETTERMINT_API_TOKEN) {
	throw new Error('LETTERMINT_API_TOKEN is not set');
}

let lettermint: Lettermint | undefined;

function getLettermint() {
	if (!lettermint) lettermint = new Lettermint({ apiToken: env.LETTERMINT_API_TOKEN! });
	return lettermint;
}

const defaultFrom = {
	name: 'certs.email',
	email: dev ? 'support@dev.certs.email' : 'support@certs.email',
};

export const EmailOutboxPriorities = {
	High: 0,
	Medium: 5,
	Low: 10,
} as const;

async function sendEmail(options: {
	to: string[];
	subject: string;
	html: string;
	text?: string;
	tag?: string;
}) {
	const email = getLettermint()
		.email.from(`${defaultFrom.name} <${defaultFrom.email}>`)
		.to(...options.to)
		.subject(options.subject)
		.html(options.html);

	if (options.text) email.text(options.text);
	if (options.tag) email.tag(options.tag);

	await email.send();
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
		text: job.textBody ?? undefined,
		tag,
	});
}
