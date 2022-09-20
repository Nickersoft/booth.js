type Volume = number;

interface VolumeChangeEvent {
  volume: Volume;
}

export interface AudioRecorderOptions extends MediaRecorderOptions {
  deviceId?: string;
}

export interface AudioEventListenerMap {
  volumechange: VolumeChangeEvent;
}

export type AudioEventListener<T> = (event: T) => void;

export type AudioEventListeners = {
  [k in keyof AudioEventListenerMap]?: AudioEventListener<
    AudioEventListenerMap[k]
  >[];
};
