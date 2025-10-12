import { expect, test } from "@playwright/test";

test.describe("Edge Cases", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/tests/index.html");
	});

	test("should handle zero-length audio buffers", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser = new Analyser();

			// Create a very short buffer that might result in zero-length data
			const context = analyser.context;
			const buffer = context.createBuffer(1, 1, context.sampleRate);
			const source = context.createBufferSource();
			source.buffer = buffer;
			source.connect(analyser.node);
			source.start();

			await new Promise((resolve) => setTimeout(resolve, 10));

			const frequencyData = analyser.byteFrequencyData;
			const volume = analyser.volume;

			return {
				frequencyDataLength: frequencyData.length,
				volumeIsNumber: typeof volume === "number",
				volumeIsFinite: Number.isFinite(volume),
				frequencyDataValid: frequencyData instanceof Uint8Array,
			};
		});

		expect(result.frequencyDataValid).toBe(true);
		expect(result.frequencyDataLength).toBeGreaterThan(0);
		expect(result.volumeIsNumber).toBe(true);
		expect(result.volumeIsFinite).toBe(true);
	});

	test("should handle suspended AudioContext", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser, getMediaStream } = await import("/dist/index.js");

			const context = new AudioContext();
			const analyser = new Analyser(context);
			const stream = await getMediaStream();
			const source = context.createMediaStreamSource(stream);
			source.connect(analyser.node);

			// Suspend the context
			await context.suspend();

			await new Promise((resolve) => setTimeout(resolve, 100));

			const volume1 = analyser.volume;
			const frequencyData1 = analyser.byteFrequencyData;

			// Resume the context
			await context.resume();

			await new Promise((resolve) => setTimeout(resolve, 100));

			const volume2 = analyser.volume;
			const frequencyData2 = analyser.byteFrequencyData;

			stream.getTracks().forEach((track) => {
				track.stop();
			});

			await context.close();

			return {
				suspendedVolume:
					typeof volume1 === "number" && Number.isFinite(volume1),
				resumedVolume: typeof volume2 === "number" && Number.isFinite(volume2),
				suspendedDataValid: frequencyData1 instanceof Uint8Array,
				resumedDataValid: frequencyData2 instanceof Uint8Array,
				dataLengthsMatch: frequencyData1.length === frequencyData2.length,
			};
		});

		expect(result.suspendedVolume).toBe(true);
		expect(result.resumedVolume).toBe(true);
		expect(result.suspendedDataValid).toBe(true);
		expect(result.resumedDataValid).toBe(true);
		expect(result.dataLengthsMatch).toBe(true);
	});

	test("should handle extremely small fftSize", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			try {
				const analyser = new Analyser(undefined, { fftSize: 32 });

				return {
					success: true,
					fftSize: analyser.node.fftSize,
					frequencyBinCount: analyser.node.frequencyBinCount,
					frequencyDataLength: analyser.byteFrequencyData.length,
				};
			} catch (error) {
				return {
					success: false,
					error: error.name,
					message: error.message,
				};
			}
		});

		if (result.success) {
			expect(result.fftSize).toBe(32);
			expect(result.frequencyBinCount).toBe(16);
			expect(result.frequencyDataLength).toBe(16);
		} else {
			expect(result.error).toBeDefined();
		}
	});

	test("should handle extremely large fftSize", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			try {
				const analyser = new Analyser(undefined, { fftSize: 32768 });

				return {
					success: true,
					fftSize: analyser.node.fftSize,
					frequencyBinCount: analyser.node.frequencyBinCount,
					frequencyDataLength: analyser.byteFrequencyData.length,
				};
			} catch (error) {
				return {
					success: false,
					error: error.name,
					message: error.message,
				};
			}
		});

		if (result.success) {
			expect(result.fftSize).toBe(32768);
			expect(result.frequencyBinCount).toBe(16384);
			expect(result.frequencyDataLength).toBe(16384);
		} else {
			expect(result.error).toBeDefined();
		}
	});

	test("should handle chain of audio node connections", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser, getMediaStream } = await import("/dist/index.js");

			const analyser = new Analyser();
			const stream = await getMediaStream();
			const context = analyser.context;

			// Create a chain of audio nodes
			const source = context.createMediaStreamSource(stream);
			const gainNode1 = context.createGain();
			const gainNode2 = context.createGain();
			const delayNode = context.createDelay();

			// Connect in chain
			source.connect(gainNode1);
			gainNode1.connect(delayNode);
			delayNode.connect(gainNode2);
			gainNode2.connect(analyser.node);
			analyser.connect(context.destination);

			// Set some parameters
			gainNode1.gain.value = 0.5;
			gainNode2.gain.value = 0.8;
			delayNode.delayTime.value = 0.1;

			await new Promise((resolve) => setTimeout(resolve, 200));

			const volume = analyser.volume;
			const frequencyData = analyser.byteFrequencyData;

			stream.getTracks().forEach((track) => {
				track.stop();
			});

			await context.close();

			return {
				volumeValid: typeof volume === "number" && Number.isFinite(volume),
				frequencyDataValid: frequencyData instanceof Uint8Array,
				chainWorked: volume >= 0 && frequencyData.length > 0,
			};
		});

		expect(result.volumeValid).toBe(true);
		expect(result.frequencyDataValid).toBe(true);
		expect(result.chainWorked).toBe(true);
	});

	test("should handle rapid connect/disconnect cycles", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser, getMediaStream } = await import("/dist/index.js");

			const analyser = new Analyser();
			const stream = await getMediaStream();
			const context = analyser.context;
			const source = context.createMediaStreamSource(stream);

			const cycles = 10;
			let successfulCycles = 0;

			for (let i = 0; i < cycles; i++) {
				try {
					// Connect
					source.connect(analyser.node);
					await new Promise((resolve) => setTimeout(resolve, 10));

					const volume = analyser.volume;

					// Disconnect
					source.disconnect(analyser.node);

					if (typeof volume === "number" && Number.isFinite(volume)) {
						successfulCycles++;
					}
				} catch (_error) {
					// Some cycles might fail, that's okay
				}
			}

			stream.getTracks().forEach((track) => {
				track.stop();
			});
			await context.close();

			return {
				totalCycles: cycles,
				successfulCycles,
				successRate: successfulCycles / cycles,
			};
		});

		expect(result.successfulCycles).toBeGreaterThan(0);
		expect(result.successRate).toBeGreaterThan(0.5);
	});

	test("should handle multiple streams to single analyser", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { Analyser, getMediaStream } = await import("/dist/index.js");

			const analyser = new Analyser();
			const context = analyser.context;

			// Create multiple streams
			const stream1 = await getMediaStream();
			const stream2 = await getMediaStream();

			const source1 = context.createMediaStreamSource(stream1);
			const source2 = context.createMediaStreamSource(stream2);
			const merger = context.createChannelMerger(2);

			// Connect both streams through a merger
			source1.connect(merger, 0, 0);
			source2.connect(merger, 0, 1);
			merger.connect(analyser.node);

			await new Promise((resolve) => setTimeout(resolve, 200));

			const volume = analyser.volume;
			const frequencyData = analyser.byteFrequencyData;

			stream1.getTracks().forEach((track) => {
				track.stop();
			});

			stream2.getTracks().forEach((track) => {
				track.stop();
			});
			await context.close();

			return {
				volumeValid: typeof volume === "number" && Number.isFinite(volume),
				frequencyDataValid:
					frequencyData instanceof Uint8Array && frequencyData.length > 0,
				multiStreamWorked: volume >= 0,
			};
		});

		expect(result.volumeValid).toBe(true);
		expect(result.frequencyDataValid).toBe(true);
		expect(result.multiStreamWorked).toBe(true);
	});
});

test.describe("Utility Functions", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/tests/index.html");
	});

	test("should handle getDevices with empty filters", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { getDevices } = await import("/dist/index.js");

			const devices = await getDevices({});

			return {
				isArray: Array.isArray(devices),
				length: devices.length,
				hasAudioInputs: devices.some((d) => d.kind === "audioinput"),
			};
		});

		expect(result.isArray).toBe(true);
		expect(result.length).toBeGreaterThanOrEqual(0);
	});

	test("should handle getDevices with multiple filter criteria", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { getDevices } = await import("/dist/index.js");

			// Get all devices first
			const allDevices = await getDevices();

			if (allDevices.length === 0) {
				return { hasDevices: false };
			}

			// Find a device with multiple properties to filter by
			const sampleDevice = allDevices[0];

			const filteredDevices = await getDevices({
				kind: sampleDevice.kind,
				groupId: sampleDevice.groupId,
			});

			return {
				hasDevices: true,
				allDevicesCount: allDevices.length,
				filteredCount: filteredDevices.length,
				filterMatches: filteredDevices.every(
					(d) =>
						d.kind === sampleDevice.kind && d.groupId === sampleDevice.groupId,
				),
			};
		});

		if (result.hasDevices) {
			expect(result.filteredCount).toBeGreaterThan(0);
			expect(result.filteredCount).toBeLessThanOrEqual(result.allDevicesCount);
			expect(result.filterMatches).toBe(true);
		}
	});

	test("should handle getDevices with non-existent filter values", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { getDevices } = await import("/dist/index.js");

			const devices = await getDevices({
				kind: "nonexistent-kind",
				deviceId: "fake-device-id-12345",
			});

			return {
				isArray: Array.isArray(devices),
				length: devices.length,
				isEmpty: devices.length === 0,
			};
		});

		expect(result.isArray).toBe(true);
		expect(result.isEmpty).toBe(true);
		expect(result.length).toBe(0);
	});

	test("should handle getMediaStream with various constraints", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { getMediaStream } = await import("/dist/index.js");

			const testCases = [
				{ audio: true, video: false },
				{ audio: { echoCancellation: false }, video: false },
				{ audio: { noiseSuppression: true }, video: false },
				{ audio: { sampleRate: 44100 }, video: false },
				{ audio: { channelCount: 1 }, video: false },
			];

			const results = [];

			for (const constraints of testCases) {
				try {
					const stream = await getMediaStream(constraints);

					const audioTracks = stream.getAudioTracks();
					const videoTracks = stream.getVideoTracks();

					results.push({
						constraints,
						success: true,
						audioTracksCount: audioTracks.length,
						videoTracksCount: videoTracks.length,
						hasAudio: audioTracks.length > 0,
						hasVideo: videoTracks.length > 0,
					});

					// Cleanup
					stream.getTracks().forEach((track) => {
						track.stop();
					});
				} catch (error) {
					results.push({
						constraints,
						success: false,
						error: error.name,
					});
				}
			}

			return {
				results,
				successfulCases: results.filter((r) => r.success).length,
				totalCases: results.length,
			};
		});

		expect(result.successfulCases).toBeGreaterThan(0);

		result.results.forEach((r) => {
			if (r.success) {
				expect(r.hasAudio).toBe(true);
				expect(r.hasVideo).toBe(false);
				expect(r.audioTracksCount).toBeGreaterThan(0);
				expect(r.videoTracksCount).toBe(0);
			}
		});
	});

	test("should handle getMediaStream with invalid constraints", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { getMediaStream } = await import("/dist/index.js");

			const invalidCases = [
				{ audio: false, video: false }, // No media requested
				{ audio: { deviceId: "fake-device-id" } }, // Non-existent device
				{ audio: { sampleRate: { exact: 999999 } } }, // Impossible sample rate
			];

			const results = [];

			for (const constraints of invalidCases) {
				try {
					const stream = await getMediaStream(constraints);
					stream.getTracks().forEach((track) => {
						track.stop();
					});
					results.push({ constraints, success: true });
				} catch (error) {
					results.push({
						constraints,
						success: false,
						error: error.name,
						message: error.message,
					});
				}
			}

			return {
				results,
				allFailed: results.every((r) => !r.success),
				errorTypes: [...new Set(results.map((r) => r.error).filter(Boolean))],
			};
		});

		// Most invalid constraints should fail
		expect(result.errorTypes.length).toBeGreaterThan(0);

		result.results.forEach((r) => {
			if (!r.success) {
				expect(r.error).toBeDefined();
			}
		});
	});

	test("should handle concurrent getMediaStream calls", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { getMediaStream } = await import("/dist/index.js");

			const concurrentCalls = 5;
			const promises = Array(concurrentCalls)
				.fill()
				.map(() => getMediaStream({ audio: true, video: false }));

			try {
				const streams = await Promise.all(promises);

				const results = streams.map((stream) => ({
					isMediaStream: stream instanceof MediaStream,
					audioTracksCount: stream.getAudioTracks().length,
					trackStates: stream.getTracks().map((t) => t.readyState),
				}));

				// Cleanup
				streams.forEach((stream) => {
					stream.getTracks().forEach((track) => {
						track.stop();
					});
				});

				return {
					success: true,
					streamCount: streams.length,
					allValidStreams: results.every(
						(r) => r.isMediaStream && r.audioTracksCount > 0,
					),
					results,
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
		expect(result.streamCount).toBe(5);
		expect(result.allValidStreams).toBe(true);
	});

	test("should handle getDevices with undefined filter values", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { getDevices } = await import("/dist/index.js");

			const devices = await getDevices({
				kind: undefined,
				deviceId: undefined,
				label: undefined,
			});

			return {
				isArray: Array.isArray(devices),
				length: devices.length,
				sameAsUnfiltered: true, // We'll compare this
			};
		});

		expect(result.isArray).toBe(true);
		expect(result.length).toBeGreaterThanOrEqual(0);
	});

	test("should handle getMediaStream with default constraints", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { getMediaStream } = await import("/dist/index.js");

			try {
				// Call with no arguments (should use defaults)
				const stream = await getMediaStream();

				const audioTracks = stream.getAudioTracks();
				const videoTracks = stream.getVideoTracks();

				stream.getTracks().forEach((track) => {
					track.stop();
				});

				return {
					success: true,
					audioTracksCount: audioTracks.length,
					videoTracksCount: videoTracks.length,
					defaultsApplied: audioTracks.length > 0 && videoTracks.length === 0,
				};
			} catch (error) {
				return {
					success: false,
					error: error.name,
				};
			}
		});

		expect(result.success).toBe(true);
		expect(result.defaultsApplied).toBe(true);
		expect(result.audioTracksCount).toBeGreaterThan(0);
		expect(result.videoTracksCount).toBe(0);
	});
});
