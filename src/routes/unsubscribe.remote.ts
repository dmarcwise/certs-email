import { form } from '$app/server';
import { z } from 'zod';
import { invalid, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('unsubscribe');

export const unsubscribe = form(
	z.object({
		settingsToken: z.string()
	}),
	async ({ settingsToken }, issue) => {
		const user = await db.user.findUnique({
			where: { settingsToken }
		});

		if (!user) {
			invalid(issue.settingsToken('Invalid or expired settings link.'));
		}

		await db.user.delete({
			where: { settingsToken }
		});

		logger.info({ email: user.email }, `Unsubscribed user ${user.email}`);

		redirect(303, '/success?message=unsubscribed');
	}
);
