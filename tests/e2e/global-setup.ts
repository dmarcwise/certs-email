import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { E2E_PORT } from '../../playwright.config.ts';
import { startTestDatabase } from '../support/postgres.ts';
import { FakeLettermint } from '../support/fake-lettermint.ts';

/**
 * Runs the production build (`build/`) against a disposable database and a fake Lettermint API.
 * The background worker runs too, so the emails are actually delivered to the fake API.
 */
export default async function globalSetup() {
	if (!existsSync('build/index.js')) {
		throw new Error('The app is not built: run `npm run build` first');
	}

	const database = await startTestDatabase();
	const lettermint = await new FakeLettermint().start();
	const baseUrl = `http://localhost:${E2E_PORT}`;

	// Tests read the delivered emails from here
	process.env.E2E_EMAILS_URL = lettermint.emailsUrl;

	const server = spawn('node', ['build'], {
		env: {
			...process.env,
			NODE_ENV: 'production',
			HOST: '127.0.0.1',
			PORT: String(E2E_PORT),
			PROTOCOL_HEADER: 'x-forwarded-proto',
			WEBSITE_URL: baseUrl,
			DATABASE_URL: database.url,
			LETTERMINT_API_TOKEN: 'test-token',
			LETTERMINT_BASE_URL: lettermint.baseUrl,
			EMAIL_OUTBOX_POLL_INTERVAL_MS: '500',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	let output = '';
	server.stdout.on('data', (chunk) => (output += chunk));
	server.stderr.on('data', (chunk) => (output += chunk));

	const exited = once(server, 'exit').then(([code]) => {
		throw new Error(`The app exited early with code ${code}:\n${output}`);
	});

	await Promise.race([waitForServer(baseUrl), exited]);

	return async () => {
		server.removeAllListeners('exit');
		exited.catch(() => {});
		server.kill();
		await lettermint.stop();
		await database.stop();

		if (process.env.E2E_SERVER_LOGS) console.log(output);
	};
}

async function waitForServer(url: string, timeoutMs = 30_000) {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// Not listening yet
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	throw new Error(`The app did not start within ${timeoutMs}ms`);
}
