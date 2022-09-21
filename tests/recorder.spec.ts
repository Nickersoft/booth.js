import {describe, expect, it, jest} from "@jest/globals";

import {AudioRecorder} from "../src/recorder.js";

describe("AudioRecorder", () => {
	it("works", () => {
		const recorder = new AudioRecorder();

		console.log(recorder);

		expect(recorder).toBeTruthy();
	});
});
