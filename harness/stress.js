// Stress scenario: a slot-game render loop driven at 50x.
//
// Real slot games run an accumulator loop -- delta = now - lastFrame, then
// "simulate" that much game time in STEP-sized chunks. Each chunk costs real
// CPU time (WORK_MS), which feeds back into the next frame's delta. inject.js
// multiplies real elapsed time by the speed factor, so once the per-real-ms
// work ratio exceeds 1 the loop diverges -- the classic "spiral of death".
// With WORK_MS = 0.8 that knee sits at ~20x, matching the reported crash point.
//
// Prints one number: the stability score. LOWER IS BETTER.
const { createSandbox } = require("./env");

const SPEED = 50;
const FRAMES = 150;
const STEP = 16;            // ms of game time simulated per accumulator chunk
const WORK_MS = 0.8;        // real CPU cost of one accumulator chunk
const TICK_WORK_MS = 0.15;  // real CPU cost of one fired timer callback
const BASE_FRAME = 16;      // baseline real ms between frames
const STALLS = { 40: 200, 80: 200, 120: 200 }; // injected GC/layout pauses (ms)
const SPIRAL_LIMIT = 200000; // accumulator iterations that count as a frozen tab

const sb = createSandbox();
sb.sendSettings({
  speed: SPEED, setInterval: true, setTimeout: true,
  performance: true, dateNow: true, requestAnimationFrame: false
});

// The page schedules a recurring game-logic timer (100ms nominal).
sb.window.setInterval(() => {}, 100);

let accumulator = 0;
let lastNow = sb.fakeDate.now();
let worstFrame = 0;
let prevIters = 0;
let prevFires = 0;
let spiralCrash = false;
let saturationCrash = false;

for (let i = 0; i < FRAMES; i++) {
  const realDelta = BASE_FRAME + (STALLS[i] || 0) + prevIters * WORK_MS + prevFires * TICK_WORK_MS;
  const res = sb.tick(realDelta);
  prevFires = res.fired;
  if (res.saturated) { saturationCrash = true; break; }

  const now = sb.fakeDate.now();
  let delta = now - lastNow;
  lastNow = now;
  if (delta < 0) delta = 0;
  accumulator += delta;

  let iters = 0;
  while (accumulator >= STEP && iters < SPIRAL_LIMIT) {
    accumulator -= STEP;
    iters++;
  }
  prevIters = iters;
  if (iters > worstFrame) worstFrame = iters;
  if (iters >= SPIRAL_LIMIT) { spiralCrash = true; break; }
}

const crashPenalty = spiralCrash || saturationCrash ? 1000000 : 0;
const score = Math.round(worstFrame + 0.1 * sb.stats.intervalFires + crashPenalty);
process.stdout.write(String(score) + "\n");
