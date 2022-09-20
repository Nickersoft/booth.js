class AudioRecorder {
  /**
   * The live audio context
   */
  private context?: AudioContext;

  /**
   * Dictionary of event listeners associated with the recorder
   */
  private listeners?: Record<string, (...args: any) => void>;

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
  private activeStream?: MediaStream;

  constructor(private options: MediaRecorderOptions) {}

  /**
   * Starts recording audio using the given device ID or, if none is provided, the default device
   * @param deviceId Optional device ID to record with
   */
  async start(deviceId?: string) {
    this.prepareContext();

    this.activeStream = await this.getAudioStream(deviceId);
    this.recorder = this.createAudioRecorder(this.activeStream, this.options);
    this.recorder.start();
  }

  /**
   * Stops recording
   * @returns The recorded data as a Blob object
   */
  stop() {
    return new Promise((resolve) => {
      // Wait for the audio to stop and for the data to be available
      this.recorder?.addEventListener("stop", () => resolve(this.flushData()));
      this.recorder?.stop();
      this.context?.suspend();
      this.activeStream?.getTracks().forEach((track) => track.stop());
    });
  }

  /**
   * Lists all of the users available audio devices
   * @returns The list of Device objects
   */
  listDevices() {
    return navigator.mediaDevices
      .enumerateDevices()
      .then((list) => list.filter((d) => d.kind === "audioinput"));
  }

  /**
   * Clears the currently recorded chunks and returns the existing
   * chunks as a single blob object
   * @returns The recorded chunks as a single
   */
  private flushData() {
    const blob = new Blob(this.buffer);
    this.buffer = [];
    return blob;
  }

  /**
   * Gets a new audio stream using either the given device ID or the default device
   * if none is provided
   * @param deviceId An optional device ID
   * @returns The MediaStream object
   */
  private getAudioStream(deviceId?: string): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId } : true,
      video: false,
    });
  }

  /**
   * Initializes a new audio recorder with the correct event listeners attached
   * @param stream The MediaStream object for which to create the recorder
   * @param options Recorder options
   * @returns
   */
  private createAudioRecorder(
    stream: MediaStream,
    options: MediaRecorderOptions
  ) {
    const recorder = new MediaRecorder(stream, options);

    recorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) {
        this.buffer?.push(e.data);
      }
    });

    return recorder;
  }

  /**
   * Creates a new audio context if none exists, otherwise resumes the existing one
   */
  private prepareContext() {
    if (!this.context) {
      this.context = new AudioContext();
    } else {
      this.context.resume();
    }
  }
}

// const context = new AudioContext();

// const handleSuccess = async function (stream: MediaStream) {
//   const options = { mimeType: 'audio/webm' };
//   const recordedChunks = [];
//   const mediaRecorder = new MediaRecorder(stream, options);

//   mediaRecorder.addEventListener('stop', function () {
//     // downloadLink.href = URL.createObjectURL(new Blob(recordedChunks));
//     // downloadLink.download = 'acetest.wav';
//     console.log(recordedChunks);
//   });

//   // stopButton.addEventListener('click', function () {
//   // 	mediaRecorder.stop();
//   // });

//   mediaRecorder.start();

//   await context.audioWorklet.addModule('/volume-meter-processor.js');

//   const micNode = context.createMediaStreamSource(stream);
//   const volumeMeterNode = new AudioWorkletNode(context, 'volume-meter');

//   volumeMeterNode.port.onmessage = ({ data: level }) => {
//     phase += phaseShift;
//     amplitude = Math.max(level * 1.5, idleAmplitude);
//     window.requestAnimationFrame(draw);
//   };

//   setTimeout(() => {
//     mediaRecorder.stop();
//     context.suspend();
//     stream.getTracks().forEach((track) => track.stop());
//   }, 10000);

//   micNode.connect(volumeMeterNode).connect(context.destination);
// };

// .then(handleSuccess);
// }
