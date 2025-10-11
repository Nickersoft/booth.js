type DeviceFilters = {
  [key in keyof MediaDeviceInfo]: MediaDeviceInfo[key];
};

/**
 * Lists all of the users available audio devices
 * @returns The list of Device objects
 */
export async function getDevices(
  filters: Partial<DeviceFilters> = {},
): Promise<MediaDeviceInfo[]> {
  return navigator.mediaDevices
    .enumerateDevices()
    .then((list) =>
      list.filter((d) =>
        filters
          ? Object.entries(filters).every(([key, value]) => d[key] === value)
          : true,
      ),
    );
}

/**
 * Finds a media stream given the provided constraints
 * @param constraints - The constraints to use when finding the media stream
 * @returns The media stream
 */
export async function getMediaStream(
  constraints: MediaStreamConstraints = { audio: true, video: false },
) {
  return navigator.mediaDevices.getUserMedia(constraints);
}
