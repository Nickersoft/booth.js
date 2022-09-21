import type {
	AudioEventListener,
	AudioEventListenerMap,
	AudioEventListeners,
	AudioRecorderOptions,
} from "./types.js";

export class AudioRecorder {
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
	 * The live audio context
	 */
	private context?: AudioContext;

	/**
	 * Dictionary of event listeners associated with the recorder
	 */
	private listeners: AudioEventListeners = {};

	/**
	 * Buffer of currently recorded blob chunks
	 */
	private buffer?: Blob[] = [];

	/**
	 * Underlying media recorder object
	 */
	private recorder?: MediaRecorder;

	/**
	 * The currently active media stream
	 */
	private stream?: MediaStream;

	constructor(private readonly options: AudioRecorderOptions = {}) {}

	/**
	 * Starts recording audio using the given device ID or, if none is provided, the default device
	 * @param deviceId Optional device ID to record with
	 */
	async start(deviceId?: string): Promise<void> {
		this.recorder = await this.createAudioRecorder();
		this.recorder.start();
	}

	/**
	 * Stops recording
	 * @returns The recorded data as a Blob object
	 */
	async stop() {
		return new Promise((resolve) => {
			// Wait for the audio to stop and for the data to be available
			this.recorder?.addEventListener("stop", () => {
				resolve(this.flush());
			});

			this.recorder?.stop();

			void this.context?.suspend();

			for (const track of this.stream?.getTracks() ?? []) {
				track.stop();
			}
		});
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
		if (!this.listeners[eventName]) {
			this.listeners[eventName] = [];
		}

		this.listeners[eventName]?.push(callback);
	}

	/**
	 * Gets a new audio stream using either the given device ID or the default device
	 * if none is provided
	 * @param deviceId An optional device ID
	 * @returns The MediaStream object
	 */
	async setStream(deviceId?: string): Promise<MediaStream> {
		return navigator.mediaDevices.getUserMedia({
			audio: deviceId ? {deviceId} : true,
			video: false,
		});
	}

	/**
	 * Clears the currently recorded chunks and returns the existing
	 * chunks as a single blob object
	 * @returns The recorded chunks as a single
	 */
	private flush() {
		const blob = new Blob(this.buffer);
		this.buffer = [];
		return blob;
	}

	/**
	 * Initializes a new audio recorder with the correct event listeners attached
	 * @param stream The MediaStream object for which to create the recorder
	 * @param options Recorder options
	 * @returns
	 */
	private async createAudioRecorder(): Promise<MediaRecorder> {
		const stream = await this.getAudioStream();

		const recorder = new MediaRecorder(stream, this.options);

		if ("volumechange" in this.listeners) {
			await this.setupAudioMeter();
		}

		recorder.addEventListener("dataavailable", ({data}) => {
			if (data.size > 0) {
				this.buffer?.push(data);
			}
		});

		return recorder;
	}

	private fireEvent<T extends keyof AudioEventListenerMap>(
		name: T,
		event: AudioEventListenerMap[T],
	) {
		for (const listener of this.listeners?.[name] ?? []) {
			listener(event);
		}
	}

	private async getAudioStream() {
		if (!this.stream) {
			this.stream = await this.setStream();
		}

		return this.stream;
	}

	private getAudioContext() {
		if (!this.context) {
			this.context = new AudioContext();
		}

		return this.context;
	}

	private getWorkletPath(name: string) {
		return [this.options.workletPath ?? "worklets", "volume-meter.js"].join(
			"/",
		);
	}

	private async setupAudioMeter() {
		const context = this.getAudioContext();
		const stream = await this.getAudioStream();

		await context.audioWorklet.addModule(this.getWorkletPath("video-meter.js"));

		const name = "volume-meter";
		const micNode = context.createMediaStreamSource(stream);
		const volumeMeterNode = new AudioWorkletNode(context, name);

		volumeMeterNode.port.addEventListener(
			"message",
			({data: volume}: {data: number}) => {
				this.fireEvent("volumechange", {volume});
			},
		);

		micNode.connect(volumeMeterNode).connect(context.destination);
	}
}
