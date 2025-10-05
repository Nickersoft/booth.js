type Volume = number;

interface VolumeChangeEvent {
	volume: Volume;
}

export interface InstallWorkletVars {
	context: AudioContext;
	stream: MediaStream;
	node: AudioWorkletNode;
}

export interface AudioRecorderOptions
	extends Omit<MediaRecorderOptions, "mimeType"> {
	deviceId?: string;
	workletPath?: string;
	mimeType?: string | string[];
}

export interface AudioEventListenerMap {
	volumechange: VolumeChangeEvent;
}

export type AudioEventListener<T> = (event: T) => void;

export type AudioEventListeners = {
	[k in keyof AudioEventListenerMap]?: Array<
		AudioEventListener<AudioEventListenerMap[k]>
	>;
};
