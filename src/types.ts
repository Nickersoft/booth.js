import type { Analyser } from "./analyser";

export interface MonitorOptions {
	mimeType?: string | string[];
	context?: AudioContext;
	defaultAnalyser?: Analyser;
}

export interface RecorderOptions
	extends Omit<MediaRecorderOptions, "mimeType"> {
	mimeType?: string | string[];
	context?: AudioContext;
	defaultAnalyser?: Analyser;
}
