type Volume = number;

type VolumeChangeEvent = {
	volume: Volume;
};

export type AudioRecorderOptions = {
	deviceId?: string;
	workletPath?: string;
} & MediaRecorderOptions;

export type AudioEventListenerMap = {
	volumechange: VolumeChangeEvent;
};

export type AudioEventListener<T> = (event: T) => void;

export type AudioEventListeners = {
	[k in keyof AudioEventListenerMap]?: Array<
		AudioEventListener<AudioEventListenerMap[k]>
	>;
};
