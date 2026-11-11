// Fingerprint Shield (Android) - phone-specific trackers.
// Runs in the page's MAIN world at document_start, right after inject.js.
//
// Covers: Battery Status API, Network Information API, motion/orientation
// sensors, hardware hints (cores, RAM, platform/arch) and the User-Agent
// Client Hints "high entropy" values (device model, OS version, ...).

(() => {
  "use strict";

  const CONFIG = {
    // Battery Status API.
    //  "spoof": always reports a full battery on charger (level 1, charging, no timers)
    //  "block": navigator.getBattery is removed (like Firefox/Safari)
    battery: "spoof",

    // Network Information API (navigator.connection)
    connection: {
      type: "wifi",
      effectiveType: "4g",
      downlink: 10,
      downlinkMax: Infinity,
      rtt: 50,
      saveData: false,
    },

    // Common values so the phone model/class can't be guessed from them.
    hardwareConcurrency: 4,
    deviceMemory: 4,
    platform: "Linux armv8l",
  };

  // ---------------------------------------------------------------------
  // Helpers (chain onto the toString patch installed by inject.js/canvas.js)
  // ---------------------------------------------------------------------
  const prevToString = Function.prototype.toString;
  const fakeSource = new WeakMap();
  const patchedToString = function toString() {
    const s = fakeSource.get(this);
    return s !== undefined ? s : prevToString.call(this);
  };
  fakeSource.set(patchedToString, prevToString.call(prevToString));
  Object.defineProperty(Function.prototype, "toString", {
    value: patchedToString,
    writable: true,
    configurable: true,
  });

  function disguise(fn, original, name) {
    try {
      Object.defineProperty(fn, "name", { value: name, configurable: true });
      Object.defineProperty(fn, "length", { value: original.length, configurable: true });
    } catch (_) {}
    fakeSource.set(fn, prevToString.call(original));
    return fn;
  }

  function hook(obj, prop, make) {
    if (!obj) return;
    const desc = Object.getOwnPropertyDescriptor(obj, prop);
    if (!desc || typeof desc.value !== "function") return;
    const orig = desc.value;
    Object.defineProperty(obj, prop, { ...desc, value: disguise(make(orig), orig, orig.name) });
  }

  // Replace an accessor's getter and/or setter.
  function hookAccessor(obj, prop, makeGet, makeSet) {
    if (!obj) return;
    const desc = Object.getOwnPropertyDescriptor(obj, prop);
    if (!desc || typeof desc.get !== "function") return;
    const next = { ...desc };
    if (makeGet) next.get = disguise(makeGet(desc.get), desc.get, "get " + prop);
    if (makeSet && typeof desc.set === "function") {
      next.set = disguise(makeSet(desc.set), desc.set, "set " + prop);
    }
    Object.defineProperty(obj, prop, next);
  }

  const constant = (v) => () => function () { return v; };
  const noop = () => function () {};
  const has = (name) => typeof globalThis[name] === "function";

  // Event types that must never reach the page.
  const blockedEvents = new Set();
  const blockedTargets = []; // constructors whose instances must stay silent

  // ---------------------------------------------------------------------
  // Battery Status API
  // ---------------------------------------------------------------------
  if (CONFIG.battery === "block") {
    try { delete Navigator.prototype.getBattery; } catch (_) {}
  } else if (has("BatteryManager")) {
    const proto = BatteryManager.prototype;
    const fixed = { level: 1, charging: true, chargingTime: 0, dischargingTime: Infinity };
    for (const [k, v] of Object.entries(fixed)) hookAccessor(proto, k, constant(v));
    for (const k of [
      "onchargingchange", "onchargingtimechange", "ondischargingtimechange", "onlevelchange",
    ]) {
      hookAccessor(proto, k, constant(null), noop);
    }
    blockedTargets.push(BatteryManager);
  }

  // ---------------------------------------------------------------------
  // Network Information API (navigator.connection)
  // ---------------------------------------------------------------------
  if (has("NetworkInformation")) {
    const proto = NetworkInformation.prototype;
    for (const [k, v] of Object.entries(CONFIG.connection)) hookAccessor(proto, k, constant(v));
    hookAccessor(proto, "onchange", constant(null), noop);
    blockedTargets.push(NetworkInformation);
  }

  // ---------------------------------------------------------------------
  // Motion / orientation / ambient sensors
  // ---------------------------------------------------------------------
  // Sensor noise and calibration offsets are a well known per-device ID.
  // The APIs are removed (feature detection fails, like on a desktop) and the
  // legacy window events are never delivered.
  for (const name of [
    "Sensor", "Accelerometer", "LinearAccelerationSensor", "GravitySensor", "Gyroscope",
    "Magnetometer", "AbsoluteOrientationSensor", "RelativeOrientationSensor",
    "AmbientLightSensor", "DeviceMotionEvent", "DeviceOrientationEvent",
    "DeviceMotionEventAcceleration", "DeviceMotionEventRotationRate",
  ]) {
    try { delete globalThis[name]; } catch (_) {}
  }
  for (const t of ["devicemotion", "deviceorientation", "deviceorientationabsolute"]) {
    blockedEvents.add(t);
    hookAccessor(globalThis, "on" + t, constant(null), noop);
  }

  // Swallow listeners for the blocked events/targets above.
  hook(EventTarget.prototype, "addEventListener", (orig) => function (type) {
    if (blockedEvents.has(type)) return;
    for (const C of blockedTargets) if (this instanceof C) return;
    return orig.apply(this, arguments);
  });

  // ---------------------------------------------------------------------
  // Hardware hints
  // ---------------------------------------------------------------------
  hookAccessor(Navigator.prototype, "hardwareConcurrency", constant(CONFIG.hardwareConcurrency));
  hookAccessor(Navigator.prototype, "deviceMemory", constant(CONFIG.deviceMemory));
  hookAccessor(Navigator.prototype, "platform", constant(CONFIG.platform));

  // ---------------------------------------------------------------------
  // User-Agent Client Hints: device model, exact OS/browser versions, arch
  // ---------------------------------------------------------------------
  if (typeof NavigatorUAData !== "undefined") {
    const major = (v) => String(v).split(".")[0] + ".0.0.0";
    hook(NavigatorUAData.prototype, "getHighEntropyValues", (orig) => function () {
      return orig.apply(this, arguments).then((v) => {
        const o = Object.assign({}, v);
        if ("model" in o) o.model = "";
        if ("architecture" in o) o.architecture = "";
        if ("bitness" in o) o.bitness = "";
        if ("wow64" in o) o.wow64 = false;
        if ("platformVersion" in o) o.platformVersion = String(o.platformVersion).split(".")[0] + ".0.0";
        if ("uaFullVersion" in o) o.uaFullVersion = major(o.uaFullVersion);
        if (Array.isArray(o.fullVersionList)) {
          o.fullVersionList = o.fullVersionList.map((b) => ({ brand: b.brand, version: major(b.version) }));
        }
        return o;
      });
    });
  }
})();
