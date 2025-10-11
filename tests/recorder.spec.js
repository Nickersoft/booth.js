import { expect, test } from "@playwright/test";

test.describe("Recorder", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/index.html");
  });

  test("should handle multiple event listeners", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();
      const recorder = new Recorder(stream);

      let listener1Count = 0;
      let listener2Count = 0;

      recorder.on("stop", () => {
        listener1Count++;
      });

      recorder.on("stop", () => {
        listener2Count++;
      });

      await recorder.start();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await recorder.stop();

      return {
        listener1Count,
        listener2Count,
        bothReceived: listener1Count > 0 && listener2Count > 0,
        equalCounts: listener1Count === listener2Count,
      };
    });

    expect(result.bothReceived).toBe(true);
    expect(result.equalCounts).toBe(true);
  });

  test("should create an instance with default options", async ({ page }) => {
    const created = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();
      const recorder = new Recorder(stream);

      return recorder !== null;
    });

    expect(created).toBe(true);
  });

  test("should create an instance with custom options", async ({ page }) => {
    const mimeTypeSet = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();
      const recorder = new Recorder(stream, {
        mimeType: ["audio/webm", "audio/mp4"],
      });

      return recorder.mimeType;
    });

    expect(mimeTypeSet).toBe("audio/webm");
  });

  test("should start recording", async ({ page }) => {
    const started = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();
      const recorder = new Recorder(stream);

      try {
        await recorder.start();
        return true;
      } catch (e) {
        console.error("Start failed:", e);
        return false;
      }
    });

    expect(started).toBe(true);
  });

  test("should stop recording and return a blob", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();
      const recorder = new Recorder(stream);

      await recorder.start();

      // Record for 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      const blob = await recorder.stop();

      return {
        hasBlob: blob !== null,
        isBlob: blob instanceof Blob,
        size: blob.size,
        type: blob.type,
      };
    });

    expect(result.hasBlob).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });

  test("should record for specified duration", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();
      const recorder = new Recorder(stream);

      await recorder.start();

      // Record for 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const blob = await recorder.stop();

      return {
        size: blob.size,
      };
    });

    // Recording should produce data
    expect(result.size).toBeGreaterThan(0);
  });

  test("should handle multiple start/stop cycles", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();
      const recorder = new Recorder(stream);

      const blobs = [];

      // First recording
      await recorder.start();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const blob1 = await recorder.stop();
      blobs.push(blob1.size);

      // Second recording
      await recorder.start();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const blob2 = await recorder.stop();
      blobs.push(blob2.size);

      return {
        firstSize: blobs[0],
        secondSize: blobs[1],
        bothValid: blobs.every((size) => size > 0),
      };
    });

    expect(result.bothValid).toBe(true);
    expect(result.firstSize).toBeGreaterThan(0);
    expect(result.secondSize).toBeGreaterThan(0);
  });

  test("should respect mime type preference", async ({ page }) => {
    const mimeType = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();

      const recorder = new Recorder(stream, {
        mimeType: ["audio/webm", "audio/mp4", "audio/ogg"],
      });

      return recorder.mimeType;
    });

    // Should select first supported type
    expect(mimeType).toBeDefined();
    expect(typeof mimeType).toBe("string");
  });

  test("should support single mime type", async ({ page }) => {
    const mimeType = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();

      const recorder = new Recorder(stream, {
        mimeType: "audio/webm",
      });

      return recorder.mimeType;
    });

    expect(mimeType).toBe("audio/webm");
  });
});
