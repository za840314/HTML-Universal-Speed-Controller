// Minimal browser-like sandbox that loads the real chrome/inject.js so its
// timing overrides can be exercised deterministically, with no browser.
//
// The harness owns a virtual "real clock" (clock.t). inject.js sees this clock
// through performance.now() / Date.now(); the harness advances it by hand and
// fires due timers, so a whole stress run is reproducible and instant.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createSandbox() {
  const clock = { t: 0 }; // virtual real-world clock in ms, driven by the harness
  let timerId = 1;
  const timers = new Map(); // id -> { handler, args, delay, next, type }
  const messageListeners = [];
  const stats = { intervalFires: 0, timeoutFires: 0 };

  const window = {};
  window.performance = { now: () => clock.t };
  window.navigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0"
  };
  window.location = { hostname: "luckylandslots.test" };

  window.setInterval = (handler, delay, ...args) => {
    const id = timerId++;
    const d = Math.max(0, Number(delay) || 0);
    timers.set(id, { handler, args, delay: d, next: clock.t + d, type: "interval" });
    return id;
  };
  window.clearInterval = (id) => { timers.delete(id); };
  window.setTimeout = (handler, delay, ...args) => {
    const id = timerId++;
    const d = Math.max(0, Number(delay) || 0);
    timers.set(id, { handler, args, delay: d, next: clock.t + d, type: "timeout" });
    return id;
  };
  window.clearTimeout = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (cb) => {
    const id = timerId++;
    timers.set(id, { handler: () => cb(clock.t), args: [], delay: 0, next: clock.t, type: "timeout" });
    return id;
  };
  window.cancelAnimationFrame = (id) => { timers.delete(id); };
  window.addEventListener = (type, fn) => { if (type === "message") messageListeners.push(fn); };
  window.removeEventListener = () => {};
  window.postMessage = () => {}; // inject.js posts a "ready" ping; harness ignores it

  const fakeDate = { now: () => clock.t };

  const sandbox = { window, navigator: window.navigator, Date: fakeDate, console };
  vm.createContext(sandbox);

  const injectPath = path.join(__dirname, "..", "chrome", "inject.js");
  vm.runInContext(fs.readFileSync(injectPath, "utf8"), sandbox, { filename: "inject.js" });

  // Deliver an extension settings update, exactly as content.js would.
  function sendSettings(settings) {
    const msg = { data: { source: "hsc-speed-controller", action: "updateSettings", settings } };
    for (const fn of messageListeners) fn(msg);
  }

  // Advance the real clock by realDeltaMs and fire every timer that comes due.
  // fireCap bounds runaway timers (delay driven near zero) so the harness
  // itself never hangs; hitting it signals main-thread saturation.
  function tick(realDeltaMs, fireCap = 200000) {
    clock.t += realDeltaMs;
    let fired = 0;
    while (true) {
      let due = null;
      for (const [id, t] of timers) {
        if (t.next <= clock.t && (due === null || t.next < due.t.next)) due = { id, t };
      }
      if (!due) break;
      const { id, t } = due;
      if (t.type === "timeout") timers.delete(id);
      else t.next += t.delay > 0 ? t.delay : 1;
      try { t.handler(...t.args); } catch (e) { /* page-side error, ignore */ }
      fired++;
      if (t.type === "interval") stats.intervalFires++;
      else stats.timeoutFires++;
      if (fired >= fireCap) return { fired, saturated: true };
    }
    return { fired, saturated: false };
  }

  return { window, clock, fakeDate, sendSettings, tick, stats };
}

module.exports = { createSandbox };
