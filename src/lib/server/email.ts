import { env } from '$env/dynamic/private';
import { MailtrapClient } from 'mailtrap';
import { dev } from '$app/environment';
import { renderConfirmationEmail } from './email-templates';

const mailtrap = new MailtrapClient({
	token: env.MAILTRAP_API_KEY
});

export async function sendConfirmationEmail(to: string, confirmToken: string) {
	const confirmUrl = `${env.WEBSITE_URL}/confirm?token=${confirmToken}`;

	const html = renderConfirmationEmail({ confirmUrl });

	await mailtrap.send({
		from: { name: 'certs.email', email: 'support@certs.email' },
		to: [{ email: to }],
		subject: 'Confirm your certs.email subscription',
		html,
		category: dev ? 'DEV-CERTS-Confirmation' : 'PROD-CERTS-Confirmation'
	});
}
