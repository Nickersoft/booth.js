import { jest } from "@jest/globals";

export class MockMediaRecorder implements MediaRecorder {
  static isTypeSupported(type: string): boolean {
    return true;
  }

  audioBitsPerSecond: number;
  mimeType: string;
  ondataavailable: ((this: MediaRecorder, ev: BlobEvent) => any) | null;
  onerror: ((this: MediaRecorder, ev: MediaRecorderErrorEvent) => any) | null;
  onpause: ((this: MediaRecorder, ev: Event) => any) | null;
  onresume: ((this: MediaRecorder, ev: Event) => any) | null;
  onstart: ((this: MediaRecorder, ev: Event) => any) | null;
  onstop: ((this: MediaRecorder, ev: Event) => any) | null;
  state: RecordingState;
  stream: MediaStream;
  videoBitsPerSecond: number;
  pause = jest.fn();
  requestData = jest.fn();
  resume = jest.fn();
  stop = jest.fn();
  removeEventListener = jest.fn();
  start = jest.fn();
  addEventListener = jest.fn();
  dispatchEvent = jest.fn<(event: Event) => boolean>();
}
