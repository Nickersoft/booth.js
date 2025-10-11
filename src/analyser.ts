export class Analyser {
	readonly node: AnalyserNode;
	readonly #data: Uint8Array<ArrayBuffer>;

	constructor(
		readonly context: AudioContext = new AudioContext(),
		readonly options: AnalyserOptions = {},
	) {
		this.node = this.context.createAnalyser();

		if (options?.fftSize) {
			this.node.fftSize = options.fftSize;
		}

		if (options?.minDecibels) {
			this.node.minDecibels = options.minDecibels;
		}

		if (options?.maxDecibels) {
			this.node.maxDecibels = options.maxDecibels;
		}

		if (options?.smoothingTimeConstant) {
			this.node.smoothingTimeConstant = options.smoothingTimeConstant;
		}

		if (options?.channelCount) {
			this.node.channelCount = options.channelCount;
		}

		if (options?.channelInterpretation) {
			this.node.channelInterpretation = options.channelInterpretation;
		}

		if (options?.channelCountMode) {
			this.node.channelCountMode = options.channelCountMode;
		}

		this.#data = new Uint8Array(this.node.frequencyBinCount);
	}

	/**
	 * Returns the frequency data provided by the default analyzer
	 */
	get frequencyData(): Uint8Array {
		this.node.getByteFrequencyData(this.#data);
		return this.#data;
	}

	/**
	 * Retrieves the current volume (average of amplitude^2)
	 */
	get volume(): number {
		const data = this.frequencyData;

		let sum = 0;

		for (const amplitude of data) {
			sum += amplitude * amplitude;
		}

		return Math.sqrt(sum / data.length);
	}

	connect(
		destinationNode: AudioNode,
		output?: number,
		input?: number,
	): AudioNode;
	connect(destinationParam: AudioParam, output?: number): void;
	connect(
		destination: AudioNode | AudioParam,
		output?: number,
		input?: number,
	): AudioNode | undefined {
		if (destination instanceof AudioNode) {
			return this.node.connect(destination, output, input);
		} else {
			this.node.connect(destination, output);
		}
	}
}
