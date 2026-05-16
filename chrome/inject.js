// Runs in the page's main world. Loaded as a web-accessible resource so it is
// not blocked by the page's Content-Security-Policy (an inline <script> would be).
(function () {
  "use strict";

  let speedConfig = {
    speed: 1.0,
    setInterval: true,
    setTimeout: true,
    performance: true,
    dateNow: true,
    requestAnimationFrame: false,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    developerMode: false,
    logTimingMethods: false,
    logPerformance: false,
    logFrameUpdates: false,
    logMobileOptimization: false
  };

  const log = (type, ...args) => {
    if (!speedConfig.developerMode) return;
    const shouldLog = {
      timing: speedConfig.logTimingMethods,
      performance: speedConfig.logPerformance,
      frame: speedConfig.logFrameUpdates,
      mobile: speedConfig.logMobileOptimization
    }[type];
    if (shouldLog) console.log(`[Speed Controller ${type}]`, ...args);
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
  const MAX_TICK_ELAPSED = 200;

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
    log("timing", `setInterval ${delay}ms -> id ${realId}`);
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
    log("timing", `clearInterval ${id}`);
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
    log("timing", `Reloaded ${intervals.size} interval(s) at ${speedConfig.speed}x`);
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

  // Receive configuration updates from the extension's content script.
  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data || data.source !== "hsc-speed-controller") return;

    if (data.action === "updateSettings") {
      advanceClock(); // flush elapsed time at the OLD speed before switching
      const oldSpeed = speedConfig.speed;
      speedConfig = {
        ...speedConfig,
        ...data.settings,
        isMobile: speedConfig.isMobile
      };
      log("timing", `Settings updated: ${oldSpeed}x -> ${speedConfig.speed}x`);
      reloadIntervals();
    } else if (data.action === "updateLoggingSettings") {
      speedConfig = { ...speedConfig, ...data.settings };
    }
  });

  // Tell the content script we are ready to receive settings.
  window.postMessage({ source: "hsc-speed-controller", action: "ready" }, "*");
})();
