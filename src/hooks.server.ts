import type { HandleServerError, ServerInit } from '@sveltejs/kit';
// @ts-expect-error - SvelteKitError exists but types aren't exported
import { SvelteKitError } from '@sveltejs/kit/internal';
import { startWorker } from '$lib/server/worker';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('hooks');

export const init: ServerInit = async () => {
	logger.info('Initializing...');
	startWorker();
};

export const handleError: HandleServerError = async ({ error }) => {
	// Ignore 404 errors
	if (error instanceof SvelteKitError && (error as SvelteKitError).status === 404) {
		return;
	}

	const err = error instanceof Error ? error : new Error(String(error));
	logger.error(err, `Unhandled error: ${err.message}`);
};
