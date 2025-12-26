import { env } from '$env/dynamic/private';
import { MailtrapClient } from 'mailtrap';
import { building, dev } from '$app/environment';
import { renderConfirmationEmail, renderConfirmedDomainsEmail } from './email-templates';

if (!building && !env.MAILTRAP_API_KEY) throw new Error('MAILTRAP_API_KEY is not set');

const mailtrap = new MailtrapClient({
	token: env.MAILTRAP_API_KEY!
});

const defaultFrom = { name: 'certs.email', email: 'support@certs.email' };

export async function sendConfirmationEmail(to: string, confirmToken: string) {
	const confirmUrl = `${env.WEBSITE_URL}/confirm?token=${confirmToken}`;

	const html = renderConfirmationEmail({ confirmUrl });

	await mailtrap.send({
		from: defaultFrom,
		to: [{ email: to }],
		subject: 'Confirm your certs.email subscription',
		html,
		category: dev ? 'DEV-CERTS-Confirmation' : 'PROD-CERTS-Confirmation'
	});
}

export async function sendConfirmedDomainsEmail(
	to: string,
	domains: string[],
	settingsToken: string
) {
	const settingsUrl = `${env.WEBSITE_URL}/settings?token=${settingsToken}`;

	const html = renderConfirmedDomainsEmail({ domains, settingsUrl });

	await mailtrap.send({
		from: defaultFrom,
		to: [{ email: to }],
		subject: 'Your domains are now being monitored',
		html,
		category: dev ? 'DEV-CERTS-Confirmed' : 'PROD-CERTS-Confirmed'
	});
}
