import { createLogger } from './logger';
import { CHECK_INTERVAL_MS, runChecks } from '$lib/server/worker-checks';
import { EMAIL_OUTBOX_POLL_INTERVAL_MS, runEmailOutbox } from '$lib/server/worker-email-outbox';
import { HEARTBEAT_INTERVAL_MS, runHeartbeat } from '$lib/server/worker-heartbeat';

const logger = createLogger('worker');

export function startWorker() {
	logger.info('Starting background tasks');

	scheduleLoop(
		runChecks,
		CHECK_INTERVAL_MS,
		() => logger.info('Starting domain checks run...'),
		() => logger.info('Domain checks finished'),
		(err) => logger.error(err, 'Domain checks run failed')
	);

	scheduleLoop(
		runHeartbeat,
		HEARTBEAT_INTERVAL_MS,
		() => logger.info('Starting heartbeat report run...'),
		() => logger.info('Heartbeat report finished'),
		(err) => logger.error(err, 'Heartbeat report run failed')
	);

	scheduleLoop(
		runEmailOutbox,
		EMAIL_OUTBOX_POLL_INTERVAL_MS,
		() => logger.debug('Checking email outbox...'),
		() => logger.debug('Email outbox poll finished'),
		(err) => logger.error(err, 'Email outbox poll failed')
	);
}

function scheduleLoop(
	task: () => Promise<void>,
	intervalMs: number,
	onRunStart: () => void = () => {},
	onRunFinish: () => void = () => {},
	onRunFail: (error: Error) => void = () => {}
) {
	let running = false;

	const run = async () => {
		if (running) return;
		running = true;

		try {
			onRunStart();
			await task();
			onRunFinish();
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			onRunFail(err);
		} finally {
			running = false;
			setTimeout(run, intervalMs);
		}
	};

	setTimeout(run, 0);
}
