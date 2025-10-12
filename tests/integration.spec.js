import { expect, test } from "@playwright/test";

test.describe("Integration Tests", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/tests/index.html");
	});

	test("should integrate Monitor with Recorder using same stream", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { Monitor, Recorder, getMediaStream } = await import(
				"/dist/index.js"
			);

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});
			const recorder = new Recorder(stream);

			await recorder.start();
			await new Promise((resolve) => setTimeout(resolve, 200));

			const monitorVolume = monitor.volume;
			const recorderVolume = recorder.volume;
			const monitorFreqData = monitor.frequencyData;
			const recorderFreqData = recorder.frequencyData;

			const blob = await recorder.stop();

			return {
				bothHaveVolume:
					typeof monitorVolume === "number" &&
					typeof recorderVolume === "number",
				bothHaveFreqData:
					monitorFreqData instanceof Uint8Array &&
					recorderFreqData instanceof Uint8Array,
				sameSreamUsed: true, // Can't directly compare streams, but they should work together
				recordingSuccessful: blob instanceof Blob && blob.size > 0,
				dataLengthsMatch: monitorFreqData.length === recorderFreqData.length,
			};
		});

		expect(result.bothHaveVolume).toBe(true);
		expect(result.bothHaveFreqData).toBe(true);
		expect(result.recordingSuccessful).toBe(true);
		expect(result.dataLengthsMatch).toBe(true);
	});

	test("should handle multiple components with shared AudioContext", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { Monitor, Recorder, Analyser, getMediaStream } = await import(
				"/dist/index.js"
			);

			const sharedContext = new AudioContext();
			const stream = await getMediaStream();

			const analyser = new Analyser(sharedContext, { fftSize: 1024 });
			const monitor = new Monitor(stream, {
				context: sharedContext,
				defaultAnalyser: analyser,
			});
			const recorder = new Recorder(stream, { context: sharedContext });

			await recorder.start();
			await new Promise((resolve) => setTimeout(resolve, 300));

			const contexts = {
				analyser: analyser.context === sharedContext,
				monitor: monitor.context === sharedContext,
				recorder: recorder.context === sharedContext,
			};

			const volumes = {
				monitor: monitor.volume,
				recorder: recorder.volume,
			};

			const blob = await recorder.stop();

			return {
				allUseSharedContext: Object.values(contexts).every(Boolean),
				allVolumesValid: Object.values(volumes).every(
					(v) => typeof v === "number" && Number.isFinite(v),
				),
				recordingWorked: blob instanceof Blob && blob.size > 0,
				contexts,
				volumes,
			};
		});

		expect(result.allUseSharedContext).toBe(true);
		expect(result.allVolumesValid).toBe(true);
		expect(result.recordingWorked).toBe(true);
	});

	test("should handle worklet integration across components", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { Monitor, Recorder, getMediaStream } = await import(
				"/dist/index.js"
			);

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});
			const recorder = new Recorder(stream, { context: monitor.context });

			const workletCode = `
        class TestIntegrationWorklet extends AudioWorkletProcessor {
          process(inputs, outputs) {
            // Simple pass-through
            if (inputs[0] && outputs[0]) {
              for (let channel = 0; channel < inputs[0].length; channel++) {
                outputs[0][channel].set(inputs[0][channel]);
              }
            }
            return true;
          }
        }
        registerProcessor('test-integration-worklet', TestIntegrationWorklet);
      `;
			const workletUrl = `data:application/javascript,${encodeURIComponent(workletCode)}`;

			try {
				const monitorWorklet = await monitor.installWorklet(
					"test-integration-worklet",
					workletUrl,
				);
				const recorderWorklet = await recorder.installWorklet(
					"test-integration-worklet",
					workletUrl,
				);

				await recorder.start();
				await new Promise((resolve) => setTimeout(resolve, 300));

				const volume = recorder.volume;
				const blob = await recorder.stop();

				return {
					success: true,
					monitorWorkletValid: monitorWorklet instanceof AudioWorkletNode,
					recorderWorkletValid: recorderWorklet instanceof AudioWorkletNode,
					volumeValid: typeof volume === "number" && Number.isFinite(volume),
					recordingValid: blob instanceof Blob && blob.size > 0,
				};
			} catch (error) {
				return { success: false, error: error.message };
			}
		});

		expect(result.success).toBe(true);
		expect(result.monitorWorkletValid).toBe(true);
		expect(result.recorderWorkletValid).toBe(true);
		expect(result.volumeValid).toBe(true);
		expect(result.recordingValid).toBe(true);
	});
});

test.describe("Error Handling Tests", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/tests/index.html");
	});

	test("should handle invalid fftSize gracefully", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const results = [];

			// Test invalid fftSizes
			const invalidSizes = [0, 1, 3, 1025, -1, 65537];

			for (const size of invalidSizes) {
				try {
					const analyser = new Analyser(undefined, { fftSize: size });
					results.push({
						size,
						success: true,
						actualSize: analyser.node.fftSize,
					});
				} catch (error) {
					results.push({ size, success: false, error: error.name });
				}
			}

			return results;
		});

		// Should either throw errors or clamp to valid values
		result.forEach((r) => {
			if (r.success) {
				expect(r.actualSize).toBeGreaterThan(0);
				expect(r.actualSize).toBeLessThanOrEqual(32768);
				// Should be power of 2
				expect(Math.log2(r.actualSize) % 1).toBe(0);
			} else {
				expect(r.error).toBeDefined();
			}
		});
	});

	test("should handle invalid decibel ranges", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const testCases = [
				{ minDecibels: -30, maxDecibels: -40 }, // min > max
				{ minDecibels: 0, maxDecibels: 10 }, // positive values
				{ minDecibels: -200, maxDecibels: -180 }, // very low values
			];

			return testCases.map((options) => {
				try {
					const analyser = new Analyser(undefined, options);
					return {
						success: true,
						minDecibels: analyser.node.minDecibels,
						maxDecibels: analyser.node.maxDecibels,
						options,
					};
				} catch (error) {
					return { success: false, error: error.name, options };
				}
			});
		});

		result.forEach((r) => {
			if (r.success) {
				expect(r.minDecibels).toBeLessThan(r.maxDecibels);
			} else {
				expect(r.error).toBeDefined();
			}
		});
	});

	test("should handle disconnected media streams", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, Recorder, getMediaStream } = await import(
				"/dist/index.js"
			);

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});
			const recorder = new Recorder(stream);

			// Stop all tracks to simulate disconnection
			stream.getTracks().forEach((track) => {
				track.stop();
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			try {
				await recorder.start();
				await new Promise((resolve) => setTimeout(resolve, 200));

				const volume = monitor.volume;
				const blob = await recorder.stop();

				return {
					success: true,
					volume: typeof volume === "number",
					recordingSize: blob.size,
				};
			} catch (error) {
				return {
					success: false,
					error: error.name,
					message: error.message,
				};
			}
		});

		// Should either handle gracefully or throw appropriate error
		if (result.success) {
			expect(result.volume).toBe(true);
		} else {
			expect(result.error).toBeDefined();
		}
	});

	test("should handle worklet installation failures", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});

			const testCases = [
				{ name: "invalid-worklet", url: "/nonexistent/worklet.js" },
				{
					name: "malformed-worklet",
					url: "data:application/javascript,invalid javascript code here!",
				},
				{ name: "empty-worklet", url: "data:application/javascript," },
			];

			const results = [];

			for (const testCase of testCases) {
				try {
					await monitor.installWorklet(testCase.name, testCase.url);
					results.push({ ...testCase, success: true });
				} catch (error) {
					results.push({
						...testCase,
						success: false,
						error: error.name,
						message: error.message,
					});
				}
			}

			return results;
		});

		result.forEach((r) => {
			// All should fail with appropriate errors
			expect(r.success).toBe(false);
			expect(r.error).toBeDefined();
		});
	});
});

test.describe("Resource Management Tests", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/tests/index.html");
	});

	test("should properly clean up AudioContext resources", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser, Monitor, getMediaStream } = await import(
				"/dist/index.js"
			);

			const contexts = [];
			const components = [];

			// Create multiple components
			for (let i = 0; i < 3; i++) {
				const context = new AudioContext();
				const stream = await getMediaStream();
				const analyser = new Analyser(context);
				const monitor = new Monitor(stream, { context });

				contexts.push(context);
				components.push({ analyser, monitor, stream });
			}

			// Check initial states
			const initialStates = contexts.map((ctx) => ctx.state);

			// Clean up
			for (const { stream } of components) {
				stream.getTracks().forEach((track) => {
					track.stop();
				});
			}

			for (const context of contexts) {
				await context.close();
			}

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Check final states
			const finalStates = contexts.map((ctx) => ctx.state);

			return {
				initialStates,
				finalStates,
				properlyCreated: initialStates.every((state) =>
					["running", "suspended"].includes(state),
				),
				properlyClosed: finalStates.every((state) => state === "closed"),
			};
		});

		expect(result.properlyCreated).toBe(true);
		expect(result.properlyClosed).toBe(true);
	});

	test("should handle rapid creation and destruction", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, Recorder, getMediaStream } = await import(
				"/dist/index.js"
			);

			const iterations = 5;
			let successCount = 0;
			const errors = [];

			for (let i = 0; i < iterations; i++) {
				try {
					const stream = await getMediaStream();
					const context = new AudioContext();

					const monitor = new Monitor(stream, { context });
					const recorder = new Recorder(stream, { context });

					await recorder.start();
					await new Promise((resolve) => setTimeout(resolve, 50));

					const volume = monitor.volume;
					const blob = await recorder.stop();

					// Cleanup
					stream.getTracks().forEach((track) => {
						track.stop();
					});

					await context.close();

					if (typeof volume === "number" && blob instanceof Blob) {
						successCount++;
					}
				} catch (error) {
					errors.push({
						iteration: i,
						error: error.name,
						message: error.message,
					});
				}
			}

			return {
				iterations,
				successCount,
				successRate: successCount / iterations,
				errors,
			};
		});

		expect(result.successRate).toBeGreaterThanOrEqual(0.8); // Allow some failures due to rapid creation
		expect(result.successCount).toBeGreaterThan(0);
	});

	test("should handle memory pressure simulation", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser, getMediaStream } = await import("/dist/index.js");

			const analysers = [];
			const streams = [];
			let createdCount = 0;
			const maxAttempts = 10;

			try {
				// Create many analysers to test resource limits
				for (let i = 0; i < maxAttempts; i++) {
					const stream = await getMediaStream();
					const analyser = new Analyser();
					const source = analyser.context.createMediaStreamSource(stream);
					source.connect(analyser.node);

					analysers.push(analyser);
					streams.push(stream);
					createdCount++;

					// Test that they're still working
					await new Promise((resolve) => setTimeout(resolve, 10));
					const volume = analyser.volume;

					if (typeof volume !== "number") {
						break;
					}
				}

				return {
					createdCount,
					allWorking: true,
					maxReached: createdCount === maxAttempts,
				};
			} catch (error) {
				return {
					createdCount,
					allWorking: false,
					error: error.name,
					maxReached: false,
				};
			} finally {
				// Cleanup
				streams.forEach((stream) => {
					stream.getTracks().forEach((track) => {
						track.stop();
					});
				});

				for (const analyser of analysers) {
					try {
						await analyser.context.close();
					} catch {
						// Ignore cleanup errors
					}
				}
			}
		});

		expect(result.createdCount).toBeGreaterThan(0);
		// Should handle at least a few instances
		expect(result.createdCount).toBeGreaterThanOrEqual(3);
	});

	test("should handle concurrent operations", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, Recorder, getMediaStream } = await import(
				"/dist/index.js"
			);

			const concurrentOps = 3;
			const promises = [];

			for (let i = 0; i < concurrentOps; i++) {
				promises.push(
					(async () => {
						const stream = await getMediaStream();
						const monitor = new Monitor(stream, {});
						const recorder = new Recorder(stream);

						await recorder.start();
						await new Promise((resolve) => setTimeout(resolve, 200));

						const volume = monitor.volume;
						const frequencyData = monitor.frequencyData;
						const blob = await recorder.stop();

						stream.getTracks().forEach((track) => {
							track.stop();
						});

						await monitor.context.close();

						return {
							volume: typeof volume === "number",
							frequencyData: frequencyData instanceof Uint8Array,
							recording: blob instanceof Blob && blob.size > 0,
						};
					})(),
				);
			}

			try {
				const results = await Promise.all(promises);

				return {
					success: true,
					results,
					allVolumesValid: results.every((r) => r.volume),
					allFrequencyDataValid: results.every((r) => r.frequencyData),
					allRecordingsValid: results.every((r) => r.recording),
				};
			} catch (error) {
				return {
					success: false,
					error: error.name,
					message: error.message,
				};
			}
		});

		expect(result.success).toBe(true);
		expect(result.allVolumesValid).toBe(true);
		expect(result.allFrequencyDataValid).toBe(true);
		expect(result.allRecordingsValid).toBe(true);
	});
});
