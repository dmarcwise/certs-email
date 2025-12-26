import { env } from '$env/dynamic/private';
import { MailtrapClient } from 'mailtrap';
import { dev } from '$app/environment';

const mailtrap = new MailtrapClient({
	token: env.MAILTRAP_API_KEY
});

export async function sendConfirmationEmail(to: string, confirmToken: string) {
	const confirmUrl = `${env.PUBLIC_URL}/confirm?token=${confirmToken}`;

	await mailtrap.send({
		from: { name: 'certs.email', email: 'support@certs.email' },
		to: [{ email: to }],
		subject: 'Confirm your certs.email subscription',
		html: `
			<p>Hello,</p>
			<p>please confirm your subscription by clicking the link below:</p>
			<a href="${confirmUrl}">Confirm subscription</a>
			<p>Thank you for using certs.email.</p>
		`,
		category: dev ? 'DEV-CERTS-Confirm' : 'PROD-CERTS-Confirm'
	});
}
