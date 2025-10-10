import type {
  AudioEventListener,
  AudioEventListenerMap,
  CreateAnalyzerOptions,
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
  #listeners: Partial<{
    [K in keyof MediaRecorderEventMap]: MediaRecorderEventMap[K][];
  }> = {};

  /**
   * Buffer of currently recorded blob chunks
   */
  #buffer?: Blob[] = [];

  /**
   * Array of analyser nodes associated with the recorder
   */
  #analyzers: AnalyserNode[] = [];

  /**
   * Underlying media recorder object
   */
  #recorder?: MediaRecorder;

  /**
   * Underlying media stream source node
   */
  #source?: MediaStreamAudioSourceNode;

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

  async getSource(): Promise<MediaStreamAudioSourceNode> {
    if (!this.#source) {
      this.#source = this.#audioContext.createMediaStreamSource(
        await this.getStream(),
      );
    }

    return this.#source;
  }

  get destination(): AudioDestinationNode {
    return this.#audioContext.destination;
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
  get #audioContext(): AudioContext {
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
  async #getMediaRecorder(): Promise<MediaRecorder> {
    if (!this.#recorder) {
      const stream = await this.getStream();

      this.#recorder = new MediaRecorder(stream, {
        ...this.options,
        mimeType: this.mimeType,
      });

      this.#recorder.addEventListener("dataavailable", ({ data }) => {
        if (data.size > 0) {
          this.#buffer?.push(data);
        }
      });

      for (const [type, callbacks] of Object.entries(this.#listeners)) {
        for (const callback of callbacks) {
          this.#recorder.addEventListener(type, callback as any);
        }
      }
    }

    return this.#recorder;
  }

  /**
   * Returns the active audio stream or creates one if one doesn't exist
   *
   * @returns The MediaStream object
   */
  async getStream(): Promise<MediaStream> {
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
    const recorder = await this.#getMediaRecorder();
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

  async createAnalyzer({
    fftSize,
    minDecibels,
    maxDecibels,
    smoothingTimeConstant,
  }: CreateAnalyzerOptions): Promise<AnalyserNode> {
    const analyzer = this.#audioContext.createAnalyser();

    if (fftSize) {
      analyzer.fftSize = fftSize;
    }

    if (minDecibels) {
      analyzer.minDecibels = minDecibels;
    }

    if (maxDecibels) {
      analyzer.maxDecibels = maxDecibels;
    }

    if (smoothingTimeConstant) {
      analyzer.smoothingTimeConstant = smoothingTimeConstant;
    }

    this.#analyzers.push(analyzer);

    return analyzer;
  }

  /**
   * Installs a custom audio worklet to the current audio context
   *
   * @param name The registered name of the worklet
   * @param path The absolute path to the worklet
   */
  async createWorklet(name: string, path: string): Promise<AudioWorkletNode> {
    await this.#audioContext.audioWorklet.addModule(path);
    return new AudioWorkletNode(this.#audioContext, name);
  }

  /**
   * Attaches an event listener to the recorder
   * @param eventName The name of the event
   * @param callback The callback
   */
  on<T extends keyof MediaRecorderEventMap>(
    eventName: T,
    callback: MediaRecorderEventMap[T],
  ) {
    this.#listeners[eventName]?.push(callback);
  }
}
