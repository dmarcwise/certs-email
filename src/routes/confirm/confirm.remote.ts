import { form } from '$app/server';
import { z } from 'zod';
import { invalid, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { EmailOutboxPriorities } from '$lib/server/email';
import { createLogger } from '$lib/server/logger';
import { renderConfirmedDomainsEmail } from '$lib/server/email-templates';
import { env } from '$env/dynamic/private';

const logger = createLogger('confirm');

export const confirm = form(
	z.object({
		token: z.string()
	}),
	async ({ token }, issue) => {
		// Find user by confirmation token
		const user = await db.user.findUnique({
			where: { confirmToken: token }
		});

		if (!user) {
			invalid(issue.token('Invalid or expired confirmation link'));
		}

		// Check if token is expired
		if (user.confirmTokenExpiresAt && user.confirmTokenExpiresAt < new Date()) {
			invalid(issue.token('This confirmation link has expired. Please subscribe again'));
		}

		// Confirm user and their domains
		await db.user.update({
			where: { id: user.id },
			data: {
				confirmed: true,
				confirmToken: null,
				confirmTokenExpiresAt: null
			}
		});

		// Confirm all unconfirmed domains
		await db.domain.updateMany({
			where: {
				userId: user.id,
				confirmed: false
			},
			data: {
				confirmed: true
			}
		});

		// Get all domains after confirmation
		const confirmedUser = await db.user.findUnique({
			where: { id: user.id },
			include: { domains: true }
		});

		// Send email with confirmed domains list
		if (confirmedUser) {
			logger.info({ email: confirmedUser.email }, 'Queueing confirmed domains list email');
			await queueConfirmedDomainsEmail(
				confirmedUser.email,
				confirmedUser.domains.map((d) => d.name),
				confirmedUser.settingsToken
			);
		}

		redirect(303, '/confirmed');
	}
);

async function queueConfirmedDomainsEmail(to: string, domains: string[], settingsToken: string) {
	const settingsUrl = `${env.WEBSITE_URL}/?token=${settingsToken}`;
	const html = renderConfirmedDomainsEmail({ domains, settingsUrl });

	await db.emailOutbox.create({
		data: {
			recipients: [to],
			subject: 'Your domains are now being monitored',
			body: html,
			templateName: 'Confirmed',
			priority: EmailOutboxPriorities.Low
		}
	});
}
