import type { HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { startWorker } from '#lib/server/worker.ts';
import { createLogger } from '#lib/server/logger.ts';

const logger = createLogger('hooks');

export const init: ServerInit = async () => {
	logger.info('Initializing...');
	startWorker();
};

export const handleError: HandleServerError = async ({ error, kind }) => {
	// Ignore expected, validation, and 404 errors
	if (kind === 'app' || kind === 'validation' || (kind === 'framework' && error.status === 404)) {
		return;
	}

	const err = error instanceof Error ? error : new Error(String(error));
	logger.error(err, `Unhandled error: ${err.message}`);
};
