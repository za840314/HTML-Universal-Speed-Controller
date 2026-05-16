// Correctness guard: confirms a stability fix has NOT broken the extension's
// actual job -- speeding the page up. Runs two scenarios at 10x and checks the
// virtual clock still advances ~10x real time. Exits 0 (pass) or 1 (fail).
//
// Scenario A: a smooth site polling time every frame (16ms) -- a stability fix
//   must leave normal-speed operation untouched.
// Scenario B: a site driving its countdown from a coarse 2s timer -- catches
//   over-aggressive delta clamping that would clip legitimate elapsed time.
const { createSandbox } = require("./env");

const SPEED = 10;
const failures = [];

// --- Scenario A: fine-grained 16ms frames ---
{
  const sb = createSandbox();
  sb.sendSettings({
    speed: SPEED, setInterval: true, setTimeout: true,
    performance: true, dateNow: true, requestAnimationFrame: false
  });
  sb.window.setInterval(() => {}, 100);

  const realStart = sb.clock.t;
  const virtualStart = sb.fakeDate.now();
  for (let i = 0; i < 120; i++) {
    sb.tick(16);
    sb.fakeDate.now(); // page polls time every frame
  }
  const realElapsed = sb.clock.t - realStart;
  const ratio = (sb.fakeDate.now() - virtualStart) / realElapsed;
  // At 10x a 100ms timer should fire ~every 10ms. A 30% margin tolerates a
  // small timer-delay floor but rejects any floor that caps the speedup.
  const expectedFires = realElapsed / (100 / SPEED);
  if (ratio < 8 || ratio > 12)
    failures.push(`A: ${SPEED}x speedup ratio ${ratio.toFixed(2)} outside [8,12]`);
  if (sb.stats.intervalFires < expectedFires * 0.7)
    failures.push(`A: timer fired ${sb.stats.intervalFires}, expected >= ${(expectedFires * 0.7).toFixed(0)}`);
}

// --- Scenario B: coarse-grained 2s timer drives the clock reads ---
{
  const sb = createSandbox();
  sb.sendSettings({
    speed: SPEED, setInterval: true, setTimeout: true,
    performance: true, dateNow: true, requestAnimationFrame: false
  });

  const samples = [];
  sb.window.setInterval(() => { samples.push(sb.fakeDate.now()); }, 2000);
  for (let i = 0; i < 60; i++) sb.tick(200); // 200ms real == 2s/10x between fires

  if (samples.length < 5) {
    failures.push(`B: coarse timer fired only ${samples.length} times`);
  } else {
    const virtualSpan = samples[samples.length - 1] - samples[0];
    const realSpan = 200 * (samples.length - 1);
    const ratio = virtualSpan / realSpan;
    if (ratio < 8.5 || ratio > 11.5)
      failures.push(`B: coarse-timer speedup ratio ${ratio.toFixed(2)} outside [8.5,11.5]`);
  }
}

if (failures.length === 0) {
  console.log(`GUARD PASS - ${SPEED}x speedup preserved in both scenarios`);
  process.exit(0);
}
console.error("GUARD FAIL\n  " + failures.join("\n  "));
process.exit(1);
