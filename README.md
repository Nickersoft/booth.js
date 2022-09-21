<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Nickersoft/booth.js/raw/main/images/dark.svg" width="300px">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/Nickersoft/booth.js/raw/main/images/light.svg" width="300px">
    <img alt="Booth.js Logo" src="https://github.com/Nickersoft/booth.js/raw/main/images/light.svg">
  </picture>
</div>

---

BoothJS (or booth.js) is a zero-dependency wrapper around the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) that makes recording audio on the web _super easy_. 

Booth fully supports ESM, CJS & TypeScript, and can even be imported with one file (`booth.js`).

Instead of following  [super long tutorials](https://web.dev/media-recording-audio) on how to record on the web, just use BoothJS:

```typescript
import { AudioRecorder } from 'booth.js';

const recorder = new AudioRecorder();

await recorder.start();

// A little while later...

const data = await recorder.stop();

// Yay we have our recorded data as a blob object!
console.log(data);

```

Wasn't that easy?

## Installing

Getting up and running with Booth is as simple as:

```bash
$ npm install booth.js
```

Or, if you use [Yarn](https://yarnpkg.com):

```bash
$ yarn add booth.js
```

### Dealing with Bundlers

Seeing the new Audio Worklets API loads JavaScript files asynchronously for some dumb reason, there's a chance you may need to manually specify a worklets directory in order for Booth to function correctly. By default, Booth will just look in the relative path for worklets. 

However, in the case in which you're using a bundler like [Vite](https://vitejs.dev), you'll probably need to update the [`assetsInclude` config option](https://vitejs.dev/config/shared-options.html#assetsinclude) to contain Booth's worklets:

```typescript
{
  assetsInclude: ['./node_modules/booth.js/dist/worklets/cjs'],
}
```

Then, you can point Booth to this directory:

```typescript
const recorder = new AudioRecorder({
  workletPath: '/node_modules/booth.js/dist/worklets/cjs' 
});
```

Sucks, I know, but it's necessary.

## Motivation

In case you aren't sold on why this is needed, let me be frank: recording audio on the web is _much_ harder than it should be. Just to monitor something as fundamental as input volume requires [_so much code_](https://stackoverflow.com/a/62732195). My God.

A little while ago (as in 5+ years ago), the Google Chrome team announced support for [Audio Worklets](https://developer.chrome.com/blog/audio-worklet/), a new way to manage web audio that was built to replace the [ScriptProcessorNode](https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode). BoothJS uses Audio Worklets out-of-the-box, whereas older, similar libraries still rely mostly on ScriptProcessorNodes.  

### An Important Note

Unlike Booth's sister library [PushJS](https://github.com/Nickersoft/push.js), Booth was created to provide a more intuitive way to use the Web Audio API, _not_ provide backwards-compatibility for it. There is no guarantee BoothJS will work on older browsers, _but_ if you need to fill the gap in some way, I encourage you to use Google's [audio worklet polyfill](https://github.com/GoogleChromeLabs/audioworklet-polyfill) for the time being.

## Finding & Using Devices

Even though calling `recorder.start()` will automatically create a stream for you using the default device, there's a chance you may want to use a different device if you have multiple devices plugged in. Fortunately, with Booth using one of these devices is super easy:

```typescript
import { AudioRecorder } from 'booth.js';

const deviceList = await AudioRecorder.listDevices();

const recorder = new AudioRecorder({ 
  deviceId: deviceList[0].id 
});

await recorder.start();
```

## Monitoring Volume & Other Events

Booth supports a number of basic event listeners, including listening for volume changes. Instead of going through the extremely long code linked to earlier, you can monitor input volume using:

```typescript
recorder.on('volumechange', ({ volume }) => {
  console.log("Input volume is " + volume);
})
```

Booth also supports a few other event listeners, such as `stop` and `start`.

## The Name

I originally wanted to name this project record.js, as I thought it sounded much cooler, but apparently NPM won't let you create packages that are too similar to other packages. Seeing record-js and recordjs beat me out, I settled for booth, as in [isolation booth](https://en.wikipedia.org/wiki/Recording_studio#Isolation_booth).

## Future Plans

This library came out of my own needs for web audio, so it will be definitely maintained for the time being. I'd like to see it eventually grow to encapsulate other kinds of web media management, such as video and screen recording as well.

## Similar Projects

- **[RecordRTC](https://github.com/muaz-khan/RecordRTC)** (last published 2+ years ago)
- **[recorderjs](https://github.com/mattdiamond/recorderjs)** (last published 8+ years ago)