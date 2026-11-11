# Fingerprint Shield - Android

Android build of Fingerprint Shield for Chromium-based mobile browsers that support MV3 extensions
(tested on ungoogled Chromium). The PC version lives in `../core` and is unchanged.

## Install
Install this folder the same way you installed the PC version in your Android browser
(load unpacked / zip the contents of this folder with `manifest.json` at the root).

## What it does (everything from the PC version, plus the phone-specific parts)
Shared with PC: Tor-style canvas readback blocking, WebGL vendor/renderer spoof, UTC timezone,
en-US language, `Accept-Language`/`DNT`/`Sec-GPC` headers, `chrome.privacy` hardening.

New in `mobile.js`:
- **Battery Status API**: `level = 1`, `charging = true`, `chargingTime = 0`, `dischargingTime = Infinity`;
  battery events are never delivered. Set `CONFIG.battery = "block"` to remove `navigator.getBattery` instead.
- **Network Information** (`navigator.connection`): `wifi` / `4g` / 10 Mbps / 50 ms / no data-saver; `change` events silenced.
- **Motion and orientation sensors**: `Accelerometer`, `Gyroscope`, `Magnetometer`, `Absolute/RelativeOrientationSensor`,
  `LinearAccelerationSensor`, `GravitySensor`, `AmbientLightSensor`, `DeviceMotionEvent`, `DeviceOrientationEvent`
  are removed, and `devicemotion` / `deviceorientation(absolute)` listeners are never called.
- **Hardware hints**: `hardwareConcurrency = 4`, `deviceMemory = 4`, `platform = "Linux armv8l"`.
- **Client Hints**: `navigator.userAgentData.getHighEntropyValues()` returns an empty device `model`,
  empty `architecture`/`bitness`, major-only OS and browser versions.
- **Headers** (`rules.json`): strips `Sec-CH-UA-Model`, `-Platform-Version`, `-Full-Version(-List)`, `-Arch`, `-Bitness`,
  `Sec-CH-Device-Memory`, `Sec-CH-DPR`, `Sec-CH-Viewport-Width`, `Downlink`, `ECT`, `RTT`, `Save-Data`, etc.

## Android differences
- `background.js` guards every API that mobile Chromium may not ship (`chrome.privacy`, `chrome.action`),
  so a missing API no longer stops the worker.
- Allow canvas on a site by tapping the extension's button in the browser menu (if your build exposes it).

## Files
- `inject.js` - timezone, language, WebGL strings (same as PC)
- `mobile.js` - battery, network info, sensors, hardware hints, client hints (new)
- `canvas.js`, `relay.js` - canvas blocking and badge relay (same as PC)
- `background.js` - allow-list, badge, hardening (mobile-safe)
- `rules.json` - request headers (PC rules + client-hint removal)

## Limits
- Web/Service Workers are not patched (`navigator.connection` and `hardwareConcurrency` are visible there).
- Screen size and `devicePixelRatio` are not spoofed: doing so breaks mobile page layout.
- JS-level spoofing can be detected by a determined site; it reduces entropy, it is not anonymity.
