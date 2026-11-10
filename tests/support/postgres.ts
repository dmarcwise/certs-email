import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export interface TestDatabase {
	url: string;
	stop: () => Promise<void>;
}

/**
 * Starts a disposable Postgres container and applies all migrations.
 *
 * SSL is enabled (with the image's snakeoil certificate) because the production
 * build of the app always connects with SSL.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
	const container = await new PostgreSqlContainer('postgres:18')
		.withDatabase('certs-email')
		.withCommand([
			'postgres',
			'-c',
			'ssl=on',
			'-c',
			'ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem',
			'-c',
			'ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key',
			'-c',
			'fsync=off',
		])
		.start();

	const url = container.getConnectionUri();

	execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
		env: { ...process.env, DATABASE_URL: url },
		stdio: 'pipe',
	});

	return {
		url,
		stop: async () => {
			await container.stop();
		},
	};
}
