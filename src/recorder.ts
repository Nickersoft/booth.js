import type {
  AudioEventListener,
  AudioEventListenerMap,
  AudioEventListeners,
  AudioRecorderOptions,
  InstallWorkletVars,
} from "./types.js";
import { getUserMedia } from "./utils.js";

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
   * Installs a custom audio worklet to the current audio context
   *
   * @param name The registered name of the worklet
   * @param path The absolute path to the worklet
   * @param callback A registration callback containing the current audio context, audio stream, and worklet node
   */
  async installWorklet(
    name: string,
    path: string,
    callback: (args: InstallWorkletVars) => void | Promise<void>
  ) {
    const context = this.getAudioContext();
    const stream = await this.getAudioStream();

    await context.audioWorklet.addModule(path);

    const node = new AudioWorkletNode(context, name);

    await callback({ context, stream, node });
  }

  /**
   * Attaches an event listener to the recorder
   * @param eventName The name of the event
   * @param callback The callback
   */
  on<T extends keyof AudioEventListenerMap>(
    eventName: T,
    callback: AudioEventListener<AudioEventListenerMap[T]>
  ) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }

    this.listeners[eventName]?.push(callback);
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

    recorder.addEventListener("dataavailable", ({ data }) => {
      if (data.size > 0) {
        this.buffer?.push(data);
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
    event: AudioEventListenerMap[T]
  ) {
    for (const listener of this.listeners?.[name] ?? []) {
      listener(event);
    }
  }

  /**
   * Returns the active audio stream or creates one if one doesn't exist
   *
   * @returns The MediaStream object
   */
  private async getAudioStream(): Promise<MediaStream> {
    if (!this.stream) {
      this.stream = await getUserMedia();
    }

    return this.stream;
  }

  /**
   * Returns the active audio context or creates one if one doesn't exist
   *
   * @returns The AudioContext object
   */
  private getAudioContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }

    return this.context;
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
    return this.installWorklet(
      "volume-meter",
      this.getWorkletPath("volume-meter.js"),
      ({ node, context, stream }) => {
        const micNode = context.createMediaStreamSource(stream);

        node.port.addEventListener(
          "message",
          ({ data: volume }: { data: number }) => {
            this.fireEvent("volumechange", { volume });
          }
        );

        node.port.start();

        micNode.connect(node).connect(context.destination);
      }
    );
  }
}
