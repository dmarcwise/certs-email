import type { HandleServerError, ServerInit } from '@sveltejs/kit';
// @ts-expect-error - SvelteKitError exists but types aren't exported
import { SvelteKitError } from '@sveltejs/kit/internal';
import { startWorker } from '$lib/server/worker';

export const init: ServerInit = async () => {
	console.log('Init');
	startWorker();
};

export const handleError: HandleServerError = async ({ error }) => {
	// Ignore 404 errors
	if (error instanceof SvelteKitError && (error as SvelteKitError).status === 404) {
		return;
	}

	// TODO: use logger
	console.error('Unhandled error:', error);
};
