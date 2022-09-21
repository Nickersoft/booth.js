/**
 * Gets a new audio stream using either the given device ID or the default device
 * if none is provided
 * @param deviceId An optional device ID
 * @returns The MediaStream object
 */
export async function getUserMedia(deviceId?: string): Promise<MediaStream> {
	return navigator.mediaDevices.getUserMedia({
		audio: deviceId ? {deviceId} : true,
		video: false,
	});
}
