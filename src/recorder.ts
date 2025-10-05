import type {
	AudioEventListener,
	AudioEventListenerMap,
	AudioEventListeners,
	AudioRecorderOptions,
	InstallWorkletVars,
} from "./types.js";

export class AudioRecorder {
	/**
	 * The live audio context
	 */
	#context?: AudioContext;

	/**
	 * Dictionary of event listeners associated with the recorder
	 */
	#listeners: AudioEventListeners = {};

	/**
	 * Buffer of currently recorded blob chunks
	 */
	#buffer?: Blob[] = [];

	/**
	 * Underlying media recorder object
	 */
	#recorder?: MediaRecorder;

	/**
	 * The currently active media stream
	 */
	#stream?: MediaStream;

	constructor(private readonly options: AudioRecorderOptions = {}) {}

	/**
	 * Lists all of the users available audio devices
	 * @returns The list of Device objects
	 */
	static async listDevices(): Promise<MediaDeviceInfo[]> {
		return navigator.mediaDevices
			.enumerateDevices()
			.then((list) => list.filter((d) => d.kind === "audioinput"));
	}

	/**
	 * Returns the best available mime type from the provided options
	 * or undefined if none is supported
	 *
	 * @returns The supported mime type or undefined
	 */
	get mimeType(): string | undefined {
		return Array.isArray(this.options.mimeType)
			? this.options.mimeType.find((type) =>
					MediaRecorder.isTypeSupported(type),
				)
			: this.options.mimeType;
	}

	/**
	 * Returns the active audio context or creates one if one doesn't exist
	 *
	 * @returns The AudioContext object
	 */
	get audioContext(): AudioContext {
		if (!this.#context) {
			this.#context = new AudioContext();
		}

		return this.#context;
	}

	get state(): RecordingState | undefined {
		return this.#recorder?.state;
	}

	/**
	 * Returns the active audio recorder or creates one if one doesn't exist
	 *
	 * @returns The MediaRecorder object
	 */
	async #getAudioRecorder(): Promise<MediaRecorder> {
		if (!this.#recorder) {
			this.#recorder = await this.#createAudioRecorder();
		}

		return this.#recorder;
	}

	/**
	 * Returns the active audio stream or creates one if one doesn't exist
	 *
	 * @returns The MediaStream object
	 */
	async #getAudioStream(): Promise<MediaStream> {
		if (!this.#stream) {
			const { deviceId } = this.options;
			this.#stream = await navigator.mediaDevices.getUserMedia({
				audio: deviceId ? { deviceId } : true,
				video: false,
			});
		}

		return this.#stream;
	}

	/**
	 * Starts recording audio using the given device ID or, if none is provided, the default device
	 * @param deviceId Optional device ID to record with
	 */
	async start(): Promise<void> {
		const recorder = await this.#getAudioRecorder();
		recorder.start();
	}

	/**
	 * Stops recording
	 * @returns The recorded data as a Blob object
	 */
	async stop(): Promise<Blob> {
		return new Promise((resolve) => {
			// Wait for the audio to stop and for the data to be available
			this.#recorder?.addEventListener("stop", () => {
				const blob = new Blob(this.#buffer);

				this.#buffer = [];

				for (const track of this.#stream?.getTracks() ?? []) {
					track.stop();
				}

				this.#recorder = undefined;
				this.#stream = undefined;

				void this.#context?.suspend();

				resolve(blob);
			});

			this.#recorder?.stop();
		});
	}

	/**
	 * Installs a custom audio worklet to the current audio context
	 *
	 * @param name The registered name of the worklet
	 * @param path The absolute path to the worklet
	 * @param callback A registration callback containing the current audio context, audio stream, and worklet node
	 */
	async installWorklet(
		name: string,
		path: string,
	): Promise<InstallWorkletVars> {
		const stream = await this.#getAudioStream();

		await this.audioContext.audioWorklet.addModule(path);

		const node = new AudioWorkletNode(this.audioContext, name);

		return { context: this.audioContext, stream, node };
	}

	/**
	 * Attaches an event listener to the recorder
	 * @param eventName The name of the event
	 * @param callback The callback
	 */
	on<T extends keyof AudioEventListenerMap>(
		eventName: T,
		callback: AudioEventListener<AudioEventListenerMap[T]>,
	) {
		if (!this.#listeners[eventName]) {
			this.#listeners[eventName] = [];
		}

		this.#listeners[eventName]?.push(callback);
	}

	/**
	 * Initializes a new audio recorder with the correct event listeners attached
	 * @param stream The MediaStream object for which to create the recorder
	 * @param options Recorder options
	 * @returns
	 */
	async #createAudioRecorder(): Promise<MediaRecorder> {
		const stream = await this.#getAudioStream();

		const recorder = new MediaRecorder(stream, {
			...this.options,
			mimeType: this.mimeType,
		});

		if ("volumechange" in this.#listeners) {
			await this.setupAudioMeter();
		}

		recorder.addEventListener("dataavailable", ({ data }) => {
			if (data.size > 0) {
				this.#buffer?.push(data);
			}
		});

		return recorder;
	}

	/**
	 * Triggers an event
	 *
	 * @param name Event name to trigger
	 * @param event Event payload (if any)
	 */
	private fireEvent<T extends keyof AudioEventListenerMap>(
		name: T,
		event: AudioEventListenerMap[T],
	) {
		for (const listener of this.#listeners?.[name] ?? []) {
			listener(event);
		}
	}

	/**
	 * Resolves the path to the worklet with the specified name
	 * using the global options
	 *
	 * @param name The filename of the worklet to resolve
	 * @returns The absolute path to the worklet
	 */
	private getWorkletPath(name: string): string {
		return [this.options.workletPath ?? "worklets", name].join("/");
	}

	/**
	 * Sets up audio metering if a volumechange listener is attached
	 */
	private async setupAudioMeter(): Promise<void> {
		const { node, context, stream } = await this.installWorklet(
			"volume-meter",
			this.getWorkletPath("volume-meter.js"),
		);

		const micNode = context.createMediaStreamSource(stream);

		node.port.addEventListener("message", ({ data }) => {
			this.fireEvent("volumechange", {
				volume: data as number,
			});
		});

		node.port.start();

		micNode.connect(node).connect(context.destination);
	}
}
