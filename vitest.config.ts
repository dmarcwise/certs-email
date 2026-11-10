import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			include: ['tests/integration/**/*.test.ts'],
			// Vitest replaces CSS imports with empty strings by default, but the email
			// templates need the real styles to be inlined
			css: { include: [/src\/templates\/.*\.css/] },
			globalSetup: ['tests/integration/global-setup.ts'],
			setupFiles: ['tests/integration/setup.ts'],
			// All test files share one database
			fileParallelism: false,
			testTimeout: 15_000,
			hookTimeout: 120_000,
		},
	}),
);
