import { Analyser } from "./analyser.js";
import { Monitor, type MonitorOptions } from "./monitor.js";

export interface RecorderOptions extends MonitorOptions {
  mimeType?: string | string[];
}

export class Recorder extends Monitor {
  readonly mimeType: string | undefined;

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
   * Underlying media recorder object
   */
  #recorder?: MediaRecorder;

  /**
   * The currently active media stream
   */
  #stream?: MediaStream;

  constructor(stream: MediaStream, options: RecorderOptions = {}) {
    super(stream, options);

    this.mimeType = Array.isArray(options.mimeType)
      ? options.mimeType.find((type) => MediaRecorder.isTypeSupported(type))
      : options.mimeType;
  }

  /**
   * The recording state of the media recorder
   */
  get state(): RecordingState | undefined {
    return this.#recorder?.state;
  }

  /**
   * Returns the active audio recorder or creates one if one doesn't exist
   *
   * @returns The MediaRecorder object
   */
  get mediaRecorder(): MediaRecorder {
    if (!this.#recorder) {
      this.#recorder = new MediaRecorder(this.stream, {
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
   * Starts recording audio using the given device ID or, if none is provided, the default device
   * @param timeslice Optional timeslice in milliseconds
   */
  start(timeslice?: number) {
    return this.mediaRecorder.start(timeslice);
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

        void this.context?.suspend();

        resolve(blob);
      });

      this.#recorder?.stop();
    });
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
    if (!this.#listeners[eventName]) {
      this.#listeners[eventName] = [];
    }
    this.#listeners[eventName]?.push(callback);
  }
}
