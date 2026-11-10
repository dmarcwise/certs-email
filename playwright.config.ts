import { defineConfig, devices } from '@playwright/test';

export const E2E_PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	// All tests share one database and one app server
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${E2E_PORT}`,
		trace: 'retain-on-failure',
		// The app assumes HTTPS unless told otherwise (see PROTOCOL_HEADER in the global setup),
		// like a reverse proxy would
		extraHTTPHeaders: { 'x-forwarded-proto': 'http' },
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
