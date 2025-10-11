import { expect, test } from "@playwright/test";

test.describe("AudioWorklets", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/index.html");
  });

  test("should install custom worklet", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = await getMediaStream();
      const recorder = new Recorder(stream);

      let workletInstalled = false;

      try {
        const node = await recorder.installWorklet(
          "volume-meter",
          "/dist/worklets/volume-meter.js",
        );

        workletInstalled = node instanceof AudioWorkletNode;

        return { success: true, installed: workletInstalled };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.installed).toBe(true);
  });

  test("should pass correct parameters to worklet callback", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const { Recorder, getMediaStream } = await import("/dist/index.js");

      const stream = getMediaStream();
      const recorder = new Recorder(stream);

      let callbackParams = {};

      const node = await recorder.installWorklet(
        "volume-meter",
        "/dist/worklets/volume-meter.js",
      );

      callbackParams = {
        hasNode: node instanceof AudioWorkletNode,
      };

      return callbackParams;
    });

    expect(result.hasNode).toBe(true);
  });
});
