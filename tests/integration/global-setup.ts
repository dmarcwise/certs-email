import type { TestProject } from 'vitest/node';
import { startTestDatabase } from '../support/postgres';

declare module 'vitest' {
	export interface ProvidedContext {
		databaseUrl: string;
	}
}

export default async function setup(project: TestProject) {
	const database = await startTestDatabase();
	project.provide('databaseUrl', database.url);

	return async () => {
		await database.stop();
	};
}
