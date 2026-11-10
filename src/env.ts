import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	// Keep credentials optional during builds; db.ts and email.ts require them at runtime.
	WEBSITE_URL: { schema: (input) => input },
	DATABASE_URL: { schema: (input) => input },
	LETTERMINT_API_TOKEN: { schema: (input) => input },
	// Optional, only used by tests to point to a fake Lettermint API server
	LETTERMINT_BASE_URL: { schema: (input) => input },
	// Optional, only used by tests to deliver queued emails faster
	EMAIL_OUTBOX_POLL_INTERVAL_MS: {
		schema: (input) => {
			if (!input) return undefined;
			const value = Number(input);
			if (!Number.isInteger(value) || value <= 0) throw new Error('Must be a positive integer');
			return value;
		},
	},
});
