import { Analyser } from "./analyser.js";

export interface SetupAnalyzerArgs {
	analyser: Analyser;
	source: MediaStreamAudioSourceNode;
	destination: AudioDestinationNode;
	context: AudioContext;
}

export interface MonitorOptions {
	context?: AudioContext;
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
		this.analyser = new Analyser(this.context);

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
	 * Retrieves the current analyzer's frequency data
	 */
	get frequencyData() {
		return this.analyser.frequencyData;
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
