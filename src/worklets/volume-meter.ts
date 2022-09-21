// Copyright (c) 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/* global currentTime */

const smoothingFactor = 0.8;
const framePerSecond = 60;
const frameInterval = 1 / framePerSecond;

/**
 *  Measure microphone volume.
 *
 * @class VolumeMeter
 * @extends AudioWorkletProcessor
 */
class VolumeMeter extends AudioWorkletProcessor {
	private lastUpdate: number = currentTime;
	private volume = 0;

	calculateRms(inputChannelData: Float32Array) {
		// Calculate the squared-sum.
		let sum = 0;

		for (const inputChannelDatum of inputChannelData) {
			sum += inputChannelDatum * inputChannelDatum;
		}

		// Calculate the RMS level and update the volume.
		const rms = Math.sqrt(sum / inputChannelData.length);

		this.volume = Math.max(rms, this.volume * smoothingFactor);
	}

	process(inputs: Float32Array[][], outputs: Float32Array[][]) {
		// This example only handles mono channel.
		const inputChannelData = inputs[0][0];

		// Post a message to the node every 16ms.
		if (currentTime - this.lastUpdate > frameInterval) {
			this.calculateRms(inputChannelData);
			this.port.postMessage(this.volume);
			this.lastUpdate = currentTime;
		}

		return true;
	}
}

registerProcessor("volume-meter", VolumeMeter);
