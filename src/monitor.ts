import { Analyser } from "./analyser.js";

export interface SetupAnalyzerArgs {
	analyser: Analyser;
	source: MediaStreamAudioSourceNode;
	destination: AudioDestinationNode;
	context: AudioContext;
}

export interface MonitorOptions {
	context?: AudioContext;
	analyserOptions?: AnalyserOptions;
	setupAnalyser?: ((args: SetupAnalyzerArgs) => void) | false;
}

export class Monitor {
	readonly context: AudioContext;
	readonly source: MediaStreamAudioSourceNode;
	readonly destination: AudioDestinationNode;
	readonly analyser: Analyser;
	readonly #options: MonitorOptions;

	constructor(
		readonly stream: MediaStream,
		options: MonitorOptions,
	) {
		this.#options = options;
		this.context = this.#options.context ?? new AudioContext();
		this.destination = this.context.destination;
		this.source = this.context.createMediaStreamSource(this.stream);
		this.analyser = new Analyser(this.context, this.#options.analyserOptions);

		if (options.setupAnalyser) {
			options.setupAnalyser({
				analyser: this.analyser,
				source: this.source,
				destination: this.destination,
				context: this.context,
			});
		} else if (options.setupAnalyser !== false) {
			this.source.connect(this.analyser.node);
			this.analyser.connectToDestination();
		}
	}

	/**
	 * Retrieves the current volume (average of amplitude^2)
	 */
	get volume() {
		return this.analyser.volume;
	}

	/**
	 * Retrieves the current analyzer's frequency data as an Uint8Array
	 */
	get byteFrequencyData(): Uint8Array {
		return this.analyser.byteFrequencyData;
	}

	/**
	 * Retrieves the current analyzer's frequency data as an Float32Array
	 */
	get floatFrequencyData(): Float32Array {
		return this.analyser.floatFrequencyData;
	}

	/**
	 * Retrieves the current analyzer's time domain data as an Uint8Array
	 */
	get byteTimeDomainData(): Uint8Array {
		return this.analyser.byteTimeDomainData;
	}

	/**
	 * Retrieves the current analyzer's time domain data as an Float32Array
	 */
	get floatTimeDomainData(): Float32Array {
		return this.analyser.floatTimeDomainData;
	}

	/**
	 * Adds a custom audio worklet to the current audio context
	 *
	 * @param name The registered name of the worklet
	 * @param path The absolute path to the worklet
	 */
	async installWorklet(name: string, path: string): Promise<AudioWorkletNode> {
		await this.context.audioWorklet.addModule(path);
		return new AudioWorkletNode(this.context, name);
	}
}
