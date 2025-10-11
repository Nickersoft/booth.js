import { expect, test } from "@playwright/test";

test.describe("Analyser", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/tests/index.html");
	});

	test("should create an instance with default options", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser = new Analyser();

			return {
				created: analyser !== null,
				hasNode: analyser.node instanceof AnalyserNode,
				hasContext: analyser.context instanceof AudioContext,
				defaultFFTSize: analyser.node.fftSize,
				frequencyBinCount: analyser.node.frequencyBinCount,
			};
		});

		expect(result.created).toBe(true);
		expect(result.hasNode).toBe(true);
		expect(result.hasContext).toBe(true);
		expect(result.defaultFFTSize).toBe(2048); // Default Web Audio API value
		expect(result.frequencyBinCount).toBe(1024); // Half of fftSize
	});

	test("should create an instance with custom AudioContext", async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const customContext = new AudioContext();
			const analyser = new Analyser(customContext);

			return {
				contextMatches: analyser.context === customContext,
				sampleRate: analyser.context.sampleRate,
			};
		});

		expect(result.contextMatches).toBe(true);
		expect(result.sampleRate).toBeGreaterThan(0);
	});

	test("should apply custom fftSize option", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser = new Analyser(undefined, { fftSize: 1024 });

			return {
				fftSize: analyser.node.fftSize,
				frequencyBinCount: analyser.node.frequencyBinCount,
			};
		});

		expect(result.fftSize).toBe(1024);
		expect(result.frequencyBinCount).toBe(512);
	});

	test("should apply custom decibel range options", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser = new Analyser(undefined, {
				minDecibels: -90,
				maxDecibels: -10,
			});

			return {
				minDecibels: analyser.node.minDecibels,
				maxDecibels: analyser.node.maxDecibels,
			};
		});

		expect(result.minDecibels).toBe(-90);
		expect(result.maxDecibels).toBe(-10);
	});

	test("should apply custom smoothingTimeConstant option", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser = new Analyser(undefined, {
				smoothingTimeConstant: 0.5,
			});

			return {
				smoothingTimeConstant: analyser.node.smoothingTimeConstant,
			};
		});

		expect(result.smoothingTimeConstant).toBe(0.5);
	});

	test("should apply custom channel options", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser = new Analyser(undefined, {
				channelCount: 1,
				channelInterpretation: "discrete",
				channelCountMode: "explicit",
			});

			return {
				channelCount: analyser.node.channelCount,
				channelInterpretation: analyser.node.channelInterpretation,
				channelCountMode: analyser.node.channelCountMode,
			};
		});

		expect(result.channelCount).toBe(1);
		expect(result.channelInterpretation).toBe("discrete");
		expect(result.channelCountMode).toBe("explicit");
	});

	test("should return frequency data as Uint8Array", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser, getMediaStream } = await import("/dist/index.js");

			const analyser = new Analyser();
			const stream = await getMediaStream();
			const source = analyser.context.createMediaStreamSource(stream);
			source.connect(analyser.node);

			// Allow some time for audio processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			const frequencyData = analyser.frequencyData;

			return {
				isUint8Array: frequencyData instanceof Uint8Array,
				length: frequencyData.length,
				expectedLength: analyser.node.frequencyBinCount,
				hasData: Array.from(frequencyData).some((value) => value > 0),
			};
		});

		expect(result.isUint8Array).toBe(true);
		expect(result.length).toBe(result.expectedLength);
		expect(result.length).toBeGreaterThan(0);
	});

	test("should calculate volume correctly", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser, getMediaStream } = await import("/dist/index.js");

			const analyser = new Analyser();
			const stream = await getMediaStream();
			const source = analyser.context.createMediaStreamSource(stream);
			source.connect(analyser.node);

			// Allow some time for audio processing
			await new Promise((resolve) => setTimeout(resolve, 200));

			const volume = analyser.volume;

			return {
				isNumber: typeof volume === "number",
				isFinite: Number.isFinite(volume),
				isNonNegative: volume >= 0,
				volume: volume,
			};
		});

		expect(result.isNumber).toBe(true);
		expect(result.isFinite).toBe(true);
		expect(result.isNonNegative).toBe(true);
	});

	test("should connect to AudioNode", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser = new Analyser();
			const gainNode = analyser.context.createGain();

			try {
				const returnedNode = analyser.connect(gainNode);
				return {
					success: true,
					returnedCorrectNode: returnedNode === gainNode,
				};
			} catch (error) {
				return {
					success: false,
					error: error.message,
				};
			}
		});

		expect(result.success).toBe(true);
		expect(result.returnedCorrectNode).toBe(true);
	});

	test("should connect to AudioParam", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser = new Analyser();
			const gainNode = analyser.context.createGain();

			try {
				const returnValue = analyser.connect(gainNode.gain);
				return {
					success: true,
					returnedUndefined: returnValue === undefined,
				};
			} catch (error) {
				return {
					success: false,
					error: error.message,
				};
			}
		});

		expect(result.success).toBe(true);
		expect(result.returnedUndefined).toBe(true);
	});

	test("should handle multiple analyser instances", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Analyser } = await import("/dist/index.js");

			const analyser1 = new Analyser(undefined, { fftSize: 512 });
			const analyser2 = new Analyser(undefined, { fftSize: 1024 });

			return {
				differentContexts: analyser1.context !== analyser2.context,
				differentFFTSizes: analyser1.node.fftSize !== analyser2.node.fftSize,
				analyser1FFTSize: analyser1.node.fftSize,
				analyser2FFTSize: analyser2.node.fftSize,
			};
		});

		expect(result.differentContexts).toBe(true);
		expect(result.differentFFTSizes).toBe(true);
		expect(result.analyser1FFTSize).toBe(512);
		expect(result.analyser2FFTSize).toBe(1024);
	});
});

test.describe("Monitor with Default Analyser", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/tests/index.html");
	});

	test("should create Monitor with default analyser", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});

			return {
				hasAnalyser: monitor.analyser !== null,
				hasContext: monitor.context instanceof AudioContext,
				hasSource: monitor.source instanceof MediaStreamAudioSourceNode,
				hasDestination: monitor.destination instanceof AudioDestinationNode,
				analyserConnected: true, // We can't directly test connection, but constructor should handle it
			};
		});

		expect(result.hasAnalyser).toBe(true);
		expect(result.hasContext).toBe(true);
		expect(result.hasSource).toBe(true);
		expect(result.hasDestination).toBe(true);
	});

	test("should create Monitor with custom AudioContext", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const customContext = new AudioContext();
			const stream = await getMediaStream();
			const monitor = new Monitor(stream, { context: customContext });

			return {
				contextMatches: monitor.context === customContext,
				analyserUsesCustomContext: monitor.analyser.context === customContext,
			};
		});

		expect(result.contextMatches).toBe(true);
		expect(result.analyserUsesCustomContext).toBe(true);
	});

	test("should create Monitor with custom analyser", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, Analyser, getMediaStream } = await import(
				"/dist/index.js"
			);

			const customContext = new AudioContext();
			const customAnalyser = new Analyser(customContext, { fftSize: 512 });
			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {
				context: customContext,
				defaultAnalyser: customAnalyser,
			});

			return {
				analyserMatches: monitor.analyser === customAnalyser,
				customFFTSize: monitor.analyser.node.fftSize,
			};
		});

		expect(result.analyserMatches).toBe(true);
		expect(result.customFFTSize).toBe(512);
	});

	test("should provide volume through monitor", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});

			// Allow some time for audio processing
			await new Promise((resolve) => setTimeout(resolve, 200));

			const volume = monitor.volume;

			return {
				isNumber: typeof volume === "number",
				isFinite: Number.isFinite(volume),
				isNonNegative: volume >= 0,
				volume: volume,
			};
		});

		expect(result.isNumber).toBe(true);
		expect(result.isFinite).toBe(true);
		expect(result.isNonNegative).toBe(true);
	});

	test("should provide frequency data through monitor", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});

			// Allow some time for audio processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			const frequencyData = monitor.frequencyData;

			return {
				isUint8Array: frequencyData instanceof Uint8Array,
				length: frequencyData.length,
				hasValidLength: frequencyData.length > 0,
			};
		});

		expect(result.isUint8Array).toBe(true);
		expect(result.hasValidLength).toBe(true);
	});

	test("should install audio worklet", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});

			try {
				// Create a simple worklet module as a data URL
				const workletCode = `
          class TestWorklet extends AudioWorkletProcessor {
            process() {
              return true;
            }
          }
          registerProcessor('test-worklet', TestWorklet);
        `;
				const workletUrl = `data:application/javascript,${encodeURIComponent(workletCode)}`;

				const workletNode = await monitor.installWorklet(
					"test-worklet",
					workletUrl,
				);

				return {
					success: true,
					isAudioWorkletNode: workletNode instanceof AudioWorkletNode,
					correctContext: workletNode.context === monitor.context,
				};
			} catch (error) {
				return {
					success: false,
					error: error.message,
				};
			}
		});

		expect(result.success).toBe(true);
		expect(result.isAudioWorkletNode).toBe(true);
		expect(result.correctContext).toBe(true);
	});

	test("should handle volume changes over time", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});

			// Collect volume readings over time
			const volumes = [];
			for (let i = 0; i < 5; i++) {
				await new Promise((resolve) => setTimeout(resolve, 50));
				volumes.push(monitor.volume);
			}

			return {
				allNumbers: volumes.every((v) => typeof v === "number"),
				allFinite: volumes.every((v) => Number.isFinite(v)),
				allNonNegative: volumes.every((v) => v >= 0),
				readings: volumes.length,
			};
		});

		expect(result.allNumbers).toBe(true);
		expect(result.allFinite).toBe(true);
		expect(result.allNonNegative).toBe(true);
		expect(result.readings).toBe(5);
	});

	test("should handle frequency data consistency", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const stream = await getMediaStream();
			const monitor = new Monitor(stream, {});

			// Get multiple frequency data readings
			await new Promise((resolve) => setTimeout(resolve, 100));
			const data1 = monitor.frequencyData;
			const data2 = monitor.frequencyData;

			return {
				sameLength: data1.length === data2.length,
				bothUint8Array:
					data1 instanceof Uint8Array && data2 instanceof Uint8Array,
				length: data1.length,
			};
		});

		expect(result.sameLength).toBe(true);
		expect(result.bothUint8Array).toBe(true);
		expect(result.length).toBeGreaterThan(0);
	});

	test("should maintain separate monitor instances", async ({ page }) => {
		const result = await page.evaluate(async () => {
			const { Monitor, getMediaStream } = await import("/dist/index.js");

			const stream1 = await getMediaStream();
			const stream2 = await getMediaStream();
			const monitor1 = new Monitor(stream1, {});
			const monitor2 = new Monitor(stream2, {});

			return {
				differentContexts: monitor1.context !== monitor2.context,
				differentAnalysers: monitor1.analyser !== monitor2.analyser,
				differentSources: monitor1.source !== monitor2.source,
				bothHaveVolume:
					typeof monitor1.volume === "number" &&
					typeof monitor2.volume === "number",
			};
		});

		expect(result.differentContexts).toBe(true);
		expect(result.differentAnalysers).toBe(true);
		expect(result.differentSources).toBe(true);
		expect(result.bothHaveVolume).toBe(true);
	});
});
