import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests",
	fullyParallel: false, // Audio tests should not run in parallel
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1, // Run tests sequentially to avoid audio conflicts
	reporter: "html",

	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				permissions: ["microphone"],
				launchOptions: {
					args: [
						"--use-fake-ui-for-media-stream", // Auto-accept permission prompts
						"--use-fake-device-for-media-stream", // Use fake camera/mic
					],
				},
			},
		},
		{
			name: "firefox",
			use: {
				...devices["Desktop Firefox"],
				launchOptions: {
					firefoxUserPrefs: {
						// Auto-grant microphone permissions
						"media.navigator.permission.disabled": true,
						// Use fake media devices
						"media.navigator.streams.fake": true,
					},
				},
			},
		},
	],

	webServer: {
		command: "bunx serve . -p 3000 --no-port-switching",
		port: 3000,
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
	},
});
