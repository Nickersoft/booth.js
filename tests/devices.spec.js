import { expect, test } from "@playwright/test";

test.describe("Device Enumeration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/index.html");
  });

  test("should list audio input devices", async ({ page }) => {
    const devices = await page.evaluate(async () => {
      const { getDevices } = await import("/dist/index.js");
      const deviceList = await getDevices();

      return {
        count: deviceList.length,
        devices: deviceList.map((d) => ({
          deviceId: d.deviceId,
          kind: d.kind,
          label: d.label,
          groupId: d.groupId,
        })),
      };
    });

    expect(devices.count).toBeGreaterThan(0);
    expect(Array.isArray(devices.devices)).toBe(true);
  });

  test("devices should have required properties", async ({ page }) => {
    const devicesValid = await page.evaluate(async () => {
      const { getDevices } = await import("/dist/index.js");
      const devices = await getDevices();

      if (devices.length === 0) return false;

      return devices.every(
        (d) =>
          typeof d.deviceId === "string" &&
          typeof d.kind === "string" &&
          typeof d.label === "string" &&
          typeof d.groupId === "string",
      );
    });

    expect(devicesValid).toBe(true);
  });

  test("should create recorder with specific device", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { getDevices, getMediaStream, Recorder } = await import(
        "/dist/index.js"
      );

      const devices = await getDevices();

      if (devices.length === 0) {
        return { success: false, reason: "no devices" };
      }

      const deviceId = devices[0].deviceId;
      const recorder = new Recorder(await getMediaStream(), { deviceId });

      try {
        recorder.start();
        await new Promise((resolve) => setTimeout(resolve, 200));
        await recorder.stop();
        return { success: true };
      } catch (e) {
        return { success: false, reason: e.message };
      }
    });

    expect(result.success).toBe(true);
  });

  test("should filter only audio inputs from all devices", async ({ page }) => {
    const comparison = await page.evaluate(async () => {
      const { getDevices } = await import("/dist/index.js");

      // Get all devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter((d) => d.kind === "audioinput");

      // Get filtered devices
      const filteredDevices = await getDevices({ kind: "audioinput" });

      return {
        allDevicesCount: allDevices.length,
        audioInputsCount: audioInputs.length,
        filteredCount: filteredDevices.length,
        match: audioInputs.length === filteredDevices.length,
      };
    });

    expect(comparison.match).toBe(true);
    expect(comparison.filteredCount).toBeLessThanOrEqual(
      comparison.allDevicesCount,
    );
  });
});
