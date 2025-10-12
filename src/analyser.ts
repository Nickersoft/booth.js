export class Analyser {
	readonly node: AnalyserNode;

	#byteFrequencyData: Uint8Array<ArrayBuffer>;
	#byteTimeDomainData: Uint8Array<ArrayBuffer>;
	#floatFrequencyData: Float32Array<ArrayBuffer>;
	#floatTimeDomainData: Float32Array<ArrayBuffer>;

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

		this.#byteFrequencyData = new Uint8Array(this.node.frequencyBinCount);
		this.#byteTimeDomainData = new Uint8Array(this.node.frequencyBinCount);
		this.#floatFrequencyData = new Float32Array(this.node.frequencyBinCount);
		this.#floatTimeDomainData = new Float32Array(this.node.frequencyBinCount);
	}

	get byteFrequencyData(): Uint8Array {
		this.node.getByteFrequencyData(this.#byteFrequencyData);
		return this.#byteFrequencyData;
	}

	get floatFrequencyData(): Float32Array {
		this.node.getFloatFrequencyData(this.#floatFrequencyData);
		return this.#floatFrequencyData;
	}

	get byteTimeDomainData(): Uint8Array {
		this.node.getByteTimeDomainData(this.#byteTimeDomainData);
		return this.#byteTimeDomainData;
	}

	get floatTimeDomainData(): Float32Array {
		this.node.getFloatTimeDomainData(this.#floatTimeDomainData);
		return this.#floatTimeDomainData;
	}

	/**
	 * Retrieves the current volume (average of amplitude^2)
	 */
	get volume(): number {
		const data = this.byteFrequencyData;

		let sum = 0;

		for (const amplitude of data) {
			sum += amplitude * amplitude;
		}

		return Math.sqrt(sum / data.length);
	}

	disconnect(): void;
	disconnect(output: number): void;
	disconnect(destinationNode: AudioNode): void;
	disconnect(destinationNode: AudioNode, output: number): void;
	disconnect(destinationNode: AudioNode, output: number, input: number): void;
	disconnect(destinationParam: AudioParam): void;
	disconnect(destinationParam: AudioParam, output: number): void;
	disconnect(
		destinationNodeOrParam?: AudioNode | AudioParam | number,
		output?: number,
		input?: number,
	): void {
		if (destinationNodeOrParam === undefined) {
			this.node.disconnect();
		} else if (typeof destinationNodeOrParam === "number") {
			this.node.disconnect(destinationNodeOrParam);
		} else if (destinationNodeOrParam instanceof AudioNode) {
			if (output !== undefined && input !== undefined) {
				this.node.disconnect(destinationNodeOrParam, output, input);
			} else if (output !== undefined) {
				this.node.disconnect(destinationNodeOrParam, output);
			} else {
				this.node.disconnect(destinationNodeOrParam);
			}
		} else if (destinationNodeOrParam instanceof AudioParam) {
			if (output !== undefined) {
				this.node.disconnect(destinationNodeOrParam, output);
			} else {
				this.node.disconnect(destinationNodeOrParam);
			}
		}
	}

	connectToDestination() {
		this.node.connect(this.context.destination);
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
