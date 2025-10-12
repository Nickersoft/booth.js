<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Nickersoft/booth.js/raw/main/images/dark.svg" width="500px">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/Nickersoft/booth.js/raw/main/images/light.svg" width="500px">
    <img alt="Booth.js Logo" src="https://github.com/Nickersoft/booth.js/raw/main/images/light.svg" width="500px">
  </picture>
  <br/>

![npm version](https://img.shields.io/npm/v/booth.js?style=flat-square)
![dependencies](https://img.shields.io/librariesio/release/npm/booth.js?style=flat-square)
![license](https://img.shields.io/npm/l/booth.js?style=flat-square)
![minified size](https://img.shields.io/bundlephobia/minzip/booth.js?style=flat-square)
![build](https://img.shields.io/github/actions/workflow/status/Nickersoft/booth.js/release.yaml?branch=main&style=flat-square)

</div>

---

BoothJS (or booth.js) is a zero-dependency wrapper around the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to make working with audio on the web _super_ easy.

Instead of following [super long tutorials](https://web.dev/media-recording-audio) on how to record on the web, just use BoothJS:

```typescript
import { Recorder, getMediaStream } from "booth.js";

const stream = await getMediaStream({ audio: true });
const recorder = new Recorder(stream);

recorder.start();

// A little while later...

const data = await recorder.stop();

// Yay we have our recorded data as a blob object!
console.log(data);
```

Wasn't that easy?

## 🚀 Installing

Getting up and running with Booth is as simple as:

```bash
$ npm install booth.js
$ yarn add booth.js
$ pnpm add booth.js
$ bun add booth.js
```

## 🎙 Finding & Using Devices

If you have multiple devices plugged in, Booth makes it super easy to choose a single device to record:

```typescript
import { getMediaStream, getDevices } from "booth.js";

const devices = await getDevices({ kind: "audioinput" });
const stream = getMediaStream({ deviceId: devices[0].id });
const recorder = new AudioRecorder(stream);

recorder.start();
```

## 🔊 Working with Analysers

Booth also provides wrappers around the [`AnalyserNode` API](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) to make monitoring frequency data and volume easier.

### Get Frequency Data & Volume

The `Monitor` and `Recorder` classes both have built-in analysers that can be used to monitor frequency data and volume. As `Recorder` is itself a subclass of `Monitor`, you can use the same API on both classes:

```typescript
import { getMediaStream, Monitor } from "booth.js";

const stream = getMediaStream({ deviceId: devices[0].id });
const monitor = new Monitor(stream); // Monitor begins listening to the stream as soon as it's created

function showVolume() {
  const volume = monitor.volume;
  // Some kind of drawing code...
  requestAnimationFrame(showVolume);
}

function showWaveform() {
  const frequencyData = monitor.frequencyData;
  // Some kind of drawing code...
  requestAnimationFrame(showWaveform);
}

showVolume();
showWaveform();
```

### Using Analyser

You can also use the `Analyser` wrapper directly, which makes it easy to monitor frequency data without an external array. Take for example [this StackOverflow answer](https://stackoverflow.com/a/72928710) written in Booth:

```typescript
import { Analyser } from "booth.js";

const audioContext = new AudioContext(); // browser built-in
const samplebutton = document.createElement("button");

samplebutton.innerText = "sample";

samplebutton.addEventListener("click", async () => {
  const response = await fetch("testsong.wav");
  const soundBuffer = await response.arrayBuffer();
  const sampleBuffer = await audioContext.decodeAudioData(soundBuffer);
  const sampleSource = audioContext.createBufferSource();
  const analyser = new Analyser(audioContext, { fftSize: 2048 });

  sampleSource.buffer = sampleBuffer;
  sampleSource.connect(analyser);

  analyser.connectToDestination();

  sampleSource.start();

  function calculateVolume() {
    console.log(analyser.volume);
    requestAnimationFrame(caclculateVolume);
  }

  calculateVolume();
});
```

### Connecting Analyser to Other Sources

`Analyser` gives you access to the underlying `AnalyserNode` instance, allowing you to connect it to other sources or worklets. Take for example this snippet from MDN's [WebAudio voicechanger example](https://github.com/mdn/webaudio-examples/blob/main/voice-change-o-matic/scripts/app.js):

```typescript
import { Analyser } from "booth.js";

const audioCtx = new AudioContext(); // browser built-in

const analyser = new Analyser(audioCtx, {
  minDecibels: -90,
  maxDecibels: -10,
  smoothingTimeConstant: 0.85,
});

const distortion = audioCtx.createWaveShaper();
const gainNode = audioCtx.createGain();
const biquadFilter = audioCtx.createBiquadFilter();
const convolver = audioCtx.createConvolver();
const source = audioCtx.createMediaStreamSource(stream);

source.connect(distortion);
distortion.connect(biquadFilter);
biquadFilter.connect(gainNode);
convolver.connect(gainNode);
echoDelay.placeBetween(gainNode, analyser.node);
analyser.connectToDestination();
```

To access the same analyser for a `Monitor` or `Recorder`, you can use the `analyser` property. The built-in analyser is by default connected from the source to the destination of the audio stream. If you need to customize this logic entirely, such as above, you can pass a `setupAnalyser` callback to manually connect the analyser to your own nodes. Just remember to connect it to the source and destination as well!

```typescript
import { Recorder, getMediaStream } from "booth.js";

const stream = await getMediaStream();

const recorder = new Recorder(stream, {
  setupAnalyser: ({ analyser, source, context }) => {
    const distortion = context.createWaveShaper();
    const gainNode = context.createGain();
    const biquadFilter = context.createBiquadFilter();
    const convolver = context.createConvolver();

    source.connect(distortion);
    distortion.connect(biquadFilter);
    biquadFilter.connect(gainNode);
    convolver.connect(gainNode);
    echoDelay.placeBetween(gainNode, analyser.node);
    analyser.connectToDestination();
  },
});

// Some time later...
recorder.analyzer; // Access the Analyser
```

## 🧰 Extending Using Custom Worklets

Booth also supports custom worklets in case it doesn't do everything you need out-of-the-box. Let's take a look at registering a custom worklet that prints its data whenever it dispatches a new message:

```typescript
import { getMediaStream, Monitor } from "booth.js";

const stream = await getMediaStream();
const monitor = new Monitor(stream);

const node = await monitor.installWorklet(
  "my-custom-worklet",
  "/worklets/my-custom-worklet.js",
);

node.port.addEventListener("message", ({ data }) => {
  console.log("Received new worklet data: " + JSON.stringify(data));
});

monitor.source.connect(node).connect(monitor.destination);
```

## 🙋‍♀️ FAQs

### "Why build this?"

The short answer: it's 2025, and recording audio still requires a lot more code than it should. Notably, having to collect data chunks as recording data comes in is a pain (at least to me). I wanted to build a more intuitive API over the existing one to make my life a little easier.

Yes, it's true this is not the first library to tackle this problem. It is, however, the newest and most up-to-date (see "Similar Projects" below).

### "Why call it Booth?"

I originally wanted to name this project record.js, as I thought it sounded much cooler, but apparently NPM won't let you create packages that are too similar to other packages. Seeing record-js and recordjs beat me out, I settled for booth, as in [isolation booth](https://en.wikipedia.org/wiki/Recording_studio#Isolation_booth).

### "What's next?"

This library came out of my own needs for web audio, so it will be definitely maintained for the time being. I'd like to see it eventually grow to encapsulate other kinds of web media management, such as video and screen recording as well.

## 🚨 An Important Note:

Unlike Booth's sister library [PushJS](https://github.com/Nickersoft/push.js), Booth was created to provide a more intuitive way to use the Web Audio API, _not_ provide backwards-compatibility for it.

There is no guarantee BoothJS will work on older browsers, _but_ if you need to fill the gap in some way, I encourage you to use Google's [audio worklet polyfill](https://github.com/GoogleChromeLabs/audioworklet-polyfill) for the time being.

## ❤️ Similar Projects

- **[RecordRTC](https://github.com/muaz-khan/RecordRTC)** (last published 2+ years ago)
- **[recorderjs](https://github.com/mattdiamond/recorderjs)** (last published 8+ years ago)
