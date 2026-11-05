import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	// Keep credentials optional during builds; db.ts and email.ts require them at runtime.
	WEBSITE_URL: { schema: (input) => input },
	DATABASE_URL: { schema: (input) => input },
	LETTERMINT_API_TOKEN: { schema: (input) => input },
});
