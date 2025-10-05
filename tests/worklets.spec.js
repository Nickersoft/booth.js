import { expect, test } from "@playwright/test";

test.describe("AudioWorklets", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/tests/index.html");
	});

	test("should install custom worklet", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { AudioRecorder } = await import("/dist/index.js");

			const recorder = new AudioRecorder({ workletPath: "/dist/worklets" });

			let workletInstalled = false;

			try {
				const { node, context, stream } = await recorder.installWorklet(
					"volume-meter",
					"/dist/worklets/volume-meter.js",
				);

				workletInstalled =
					context instanceof AudioContext &&
					stream instanceof MediaStream &&
					node instanceof AudioWorkletNode;

				return { success: true, installed: workletInstalled };
			} catch (e) {
				return { success: false, error: e.message };
			}
		});

		expect(result.success).toBe(true);
		expect(result.installed).toBe(true);
	});

	test("should emit volume change events", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { AudioRecorder } = await import("/dist/index.js");

			const recorder = new AudioRecorder({ workletPath: "/dist/worklets" });

			const volumeEvents = [];

			recorder.on("volumechange", ({ volume }) => {
				volumeEvents.push(volume);
			});

			await recorder.start();

			// Wait for volume events to be collected
			await new Promise((resolve) => setTimeout(resolve, 3000));

			await recorder.stop();

			return {
				eventCount: volumeEvents.length,
				hasEvents: volumeEvents.length > 0,
				allNumbers: volumeEvents.every((v) => typeof v === "number"),
				allInRange: volumeEvents.every((v) => v >= 0 && v <= 1),
				sampleVolumes: volumeEvents.slice(0, 5),
			};
		});

		expect(result.hasEvents).toBe(true);
		expect(result.eventCount).toBeGreaterThan(0);
		expect(result.allNumbers).toBe(true);
		expect(result.allInRange).toBe(true);
	});

	test("should setup audio meter automatically when volumechange listener is attached", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { AudioRecorder } = await import("/dist/index.js");

			const recorder = new AudioRecorder({ workletPath: "/dist/worklets" });

			let volumeReceived = false;

			// Attach listener before starting
			recorder.on("volumechange", ({ volume }) => {
				volumeReceived = typeof volume === "number";
			});

			await recorder.start();

			// Wait for audio processing
			await new Promise((resolve) => setTimeout(resolve, 500));

			await recorder.stop();

			return { volumeReceived };
		});

		expect(result.volumeReceived).toBe(true);
	});

	test("should pass correct parameters to worklet callback", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { AudioRecorder } = await import("/dist/index.js");

			const recorder = new AudioRecorder({ workletPath: "/dist/worklets" });

			let callbackParams = {};

			const { context, stream, node } = await recorder.installWorklet(
				"volume-meter",
				"/dist/worklets/volume-meter.js",
			);

			callbackParams = {
				hasContext: context instanceof AudioContext,
				contextState: context.state,
				hasStream: stream instanceof MediaStream,
				streamActive: stream.active,
				hasNode: node instanceof AudioWorkletNode,
				nodeContext: node.context === context,
			};

			return callbackParams;
		});

		expect(result.hasContext).toBe(true);
		expect(result.hasStream).toBe(true);
		expect(result.hasNode).toBe(true);
		expect(result.nodeContext).toBe(true);
		expect(["suspended", "running", "closed"]).toContain(result.contextState);
	});

	test("should handle worklet path configuration", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { AudioRecorder } = await import("/dist/index.js");

			// Test with custom worklet path
			const recorder = new AudioRecorder({
				workletPath: "/dist/worklets",
			});

			let installed = false;

			try {
				await recorder.installWorklet(
					"volume-meter",
					"/dist/worklets/volume-meter.js",
				);

				installed = true;

				return { success: true, installed };
			} catch (e) {
				return { success: false, error: e.message };
			}
		});

		expect(result.success).toBe(true);
		expect(result.installed).toBe(true);
	});

	test("should process audio through worklet", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { AudioRecorder } = await import("/dist/index.js");

			const recorder = new AudioRecorder({ workletPath: "/dist/worklets" });

			const volumes = [];

			recorder.on("volumechange", ({ volume }) => {
				volumes.push(volume);
			});

			await recorder.start();

			// Record and collect volume data
			await new Promise((resolve) => setTimeout(resolve, 1500));

			await recorder.stop();

			return {
				totalEvents: volumes.length,
				minVolume: Math.min(...volumes),
				maxVolume: Math.max(...volumes),
				avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
			};
		});

		expect(result.totalEvents).toBeGreaterThan(0);
		expect(result.minVolume).toBeGreaterThanOrEqual(0);
		expect(result.maxVolume).toBeLessThanOrEqual(1);
		expect(result.avgVolume).toBeGreaterThanOrEqual(0);
		expect(result.avgVolume).toBeLessThanOrEqual(1);
	});

	test("should handle multiple event listeners", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { AudioRecorder } = await import("/dist/index.js");

			const recorder = new AudioRecorder({ workletPath: "/dist/worklets" });

			let listener1Count = 0;
			let listener2Count = 0;

			recorder.on("volumechange", () => {
				listener1Count++;
			});

			recorder.on("volumechange", () => {
				listener2Count++;
			});

			await recorder.start();
			await new Promise((resolve) => setTimeout(resolve, 500));
			await recorder.stop();

			return {
				listener1Count,
				listener2Count,
				bothReceived: listener1Count > 0 && listener2Count > 0,
				equalCounts: listener1Count === listener2Count,
			};
		});

		expect(result.bothReceived).toBe(true);
		expect(result.equalCounts).toBe(true);
	});
});
