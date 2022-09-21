import { beforeAll, describe, expect, it, jest } from "@jest/globals";

import { AudioRecorder } from "../src/recorder.js";
import { MockMediaRecorder } from "./__mocks__/mock-recorder.js";

describe("AudioRecorder", () => {
  beforeAll(() => {
    window.MediaRecorder = MockMediaRecorder;
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: jest.fn(),
      },
    });
  });

  it("works", async () => {
    const recorder = new AudioRecorder();

    await recorder.start();

    expect(recorder["recorder"]!.start).toHaveBeenCalled();
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
});
