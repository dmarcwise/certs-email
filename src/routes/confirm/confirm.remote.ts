import { form } from '$app/server';
import { z } from 'zod';
import { invalid, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sendConfirmedDomainsEmail } from '$lib/server/email';
import { createLogger } from '$lib/server/logger';

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
			logger.info({ email: confirmedUser.email }, 'Sending confirmed domains list email');
			await sendConfirmedDomainsEmail(
				confirmedUser.email,
				confirmedUser.domains.map((d) => d.name),
				confirmedUser.settingsToken
			);
		}

		redirect(303, '/confirmed');
	}
);
