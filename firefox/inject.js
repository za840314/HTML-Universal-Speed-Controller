// Runs in the page's main world. Loaded as a web-accessible resource so it is
// not blocked by the page's Content-Security-Policy (an inline <script> would be).
(function () {
  "use strict";

  let speedConfig = {
    speed: 1.0,
    setInterval: false,
    setTimeout: false,
    performance: true,
    dateNow: false,
    requestAnimationFrame: true,
    keepAlive: false,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  };

  // Store the original timing functions before overriding them.
  const originalSetInterval = window.setInterval.bind(window);
  const originalClearInterval = window.clearInterval.bind(window);
  const originalSetTimeout = window.setTimeout.bind(window);
  const originalClearTimeout = window.clearTimeout.bind(window);
  const originalPerformanceNow = window.performance.now.bind(window.performance);
  const originalDateNow = Date.now.bind(Date);
  const originalRAF = window.requestAnimationFrame.bind(window);

  // Effectively-infinite delay used to "pause" timers when speed is 0.
  const MAX_DELAY = 2147483647;

  // Cap on the real elapsed time a single advanceClock() call will scale up.
  // A main-thread stall otherwise yields a huge virtual jump; a page running
  // an accumulator-based game loop then tries to simulate all of it at once
  // and freezes the tab ("spiral of death"). Clamping bounds the catch-up.
  const MAX_TICK_ELAPSED = 170;

  // Lower bound on the real delay handed to the browser when speed > 1.
  // Without it a fast timer is rescheduled every fraction of a millisecond;
  // its callbacks then run back-to-back with no idle time, pinning a CPU core
  // and exhausting memory. Only applied while compressing delays (speed > 1)
  // so 1x ("Normal") stays fully transparent.
  const MIN_REAL_DELAY = 8;

  // Virtual clock: accumulates the *extra* elapsed time produced by speed != 1.
  // performance.now()/Date.now() report originalNow + virtualOffset.
  let virtualOffset = 0;
  let lastClockUpdate = originalPerformanceNow();

  const advanceClock = () => {
    const now = originalPerformanceNow();
    const elapsed = Math.min(now - lastClockUpdate, MAX_TICK_ELAPSED);
    virtualOffset += elapsed * (speedConfig.speed - 1);
    lastClockUpdate = now;
    return virtualOffset;
  };

  const virtualPerfNow = () => originalPerformanceNow() + advanceClock();

  // Compute the real delay to hand to the browser for a given requested delay.
  const adjustDelay = (delay, enabled) => {
    delay = Number(delay) || 0;
    if (!enabled) return delay;
    if (speedConfig.speed <= 0) return MAX_DELAY; // paused
    const adjusted = delay / speedConfig.speed;
    return speedConfig.speed > 1 ? Math.max(adjusted, MIN_REAL_DELAY) : adjusted;
  };

  // Every interval the page creates is tracked here so a later speed change can
  // retroactively re-time it. Keyed by the id originally returned to the page.
  const intervals = new Map();

  window.setInterval = function (handler, delay, ...args) {
    delay = Number(delay) || 0;
    const realId = originalSetInterval(handler, adjustDelay(delay, speedConfig.setInterval), ...args);
    intervals.set(realId, { handler, delay, args, realId });
    return realId;
  };

  window.clearInterval = function (id) {
    const entry = intervals.get(id);
    if (entry) {
      originalClearInterval(entry.realId);
      intervals.delete(id);
    } else {
      originalClearInterval(id);
    }
  };

  window.setTimeout = function (handler, delay, ...args) {
    return originalSetTimeout(handler, adjustDelay(delay, speedConfig.setTimeout), ...args);
  };

  window.clearTimeout = function (id) {
    originalClearTimeout(id);
  };

  // Re-time every tracked interval after a speed change.
  const reloadIntervals = () => {
    for (const [, entry] of intervals) {
      originalClearInterval(entry.realId);
      entry.realId = originalSetInterval(
        entry.handler,
        adjustDelay(entry.delay, speedConfig.setInterval),
        ...entry.args
      );
    }
  };

  window.performance.now = function () {
    return speedConfig.performance ? virtualPerfNow() : originalPerformanceNow();
  };

  Date.now = function () {
    if (!speedConfig.dateNow) return originalDateNow();
    return Math.floor(originalDateNow() + advanceClock());
  };

  window.requestAnimationFrame = function (callback) {
    return originalRAF(function (timestamp) {
      if (speedConfig.requestAnimationFrame && speedConfig.speed > 0) {
        callback(virtualPerfNow());
      } else {
        callback(timestamp);
      }
    });
  };

  // --- Background-throttle keepalive ----------------------------------------
  // When enabled, the page is told it is always visible and focused, and a
  // near-silent tone is played so the browser keeps the tab "audible" and does
  // not throttle its timers while another window covers it. Best-effort: a page
  // cannot fully override the browser's own occlusion handling.
  let keepAliveAudio = null;

  const installVisibilitySpoof = () => {
    const spoof = (prop, value) => {
      const orig = Object.getOwnPropertyDescriptor(Document.prototype, prop);
      if (!orig || !orig.get) return;
      Object.defineProperty(document, prop, {
        configurable: true,
        get() { return speedConfig.keepAlive ? value : orig.get.call(this); }
      });
    };
    spoof("hidden", false);
    spoof("visibilityState", "visible");
    spoof("webkitHidden", false);
    spoof("webkitVisibilityState", "visible");

    const originalHasFocus = document.hasFocus.bind(document);
    document.hasFocus = () => (speedConfig.keepAlive ? true : originalHasFocus());

    // Stop visibility/blur events from reaching the page so it never pauses
    // itself. Capture phase at document_start runs before any page listener.
    const swallow = (e) => { if (speedConfig.keepAlive) e.stopImmediatePropagation(); };
    document.addEventListener("visibilitychange", swallow, true);
    document.addEventListener("webkitvisibilitychange", swallow, true);
    window.addEventListener("blur", swallow, true);
  };

  const startKeepAliveAudio = () => {
    if (keepAliveAudio) { keepAliveAudio.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0025; // far below audible volume, enough to mark the tab "audible"
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      keepAliveAudio = { ctx, osc };
      ctx.resume();
    } catch (e) {
      /* AudioContext unavailable — keepalive audio simply does not start */
    }
  };

  const stopKeepAliveAudio = () => {
    if (!keepAliveAudio) return;
    try { keepAliveAudio.osc.stop(); keepAliveAudio.ctx.close(); } catch (e) { /* already closed */ }
    keepAliveAudio = null;
  };

  const applyKeepAlive = () => {
    if (speedConfig.keepAlive) startKeepAliveAudio();
    else stopKeepAliveAudio();
  };

  // An AudioContext stays suspended until a user gesture; nudge it on each
  // gesture while keepalive is on (slot play supplies plenty of gestures).
  const keepAliveResume = () => {
    if (speedConfig.keepAlive && keepAliveAudio) keepAliveAudio.ctx.resume();
  };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, keepAliveResume, true)
  );

  installVisibilitySpoof();

  // Receive configuration updates from the extension's content script.
  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data || data.source !== "hsc-speed-controller") return;

    if (data.action === "updateSettings") {
      advanceClock(); // flush elapsed time at the OLD speed before switching
      speedConfig = {
        ...speedConfig,
        ...data.settings,
        isMobile: speedConfig.isMobile
      };
      reloadIntervals();
    } else if (data.action === "updateKeepAlive") {
      speedConfig.keepAlive = !!(data.settings && data.settings.keepAlive);
      applyKeepAlive();
    }
  });

  // Tell the content script we are ready to receive settings.
  window.postMessage({ source: "hsc-speed-controller", action: "ready" }, "*");
})();
