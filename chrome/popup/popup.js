// Cross-browser alias: Chrome exposes `chrome`, Firefox exposes `browser`.
const browser = globalThis.browser || globalThis.chrome;

// Timing-method toggles and the Settings button.
const setIntervalToggle = document.getElementById('setIntervalToggle');
const setTimeoutToggle = document.getElementById('setTimeoutToggle');
const performanceToggle = document.getElementById('performanceToggle');
const dateNowToggle = document.getElementById('dateNowToggle');
const requestAnimationFrameToggle = document.getElementById('requestAnimationFrameToggle');
const keepAliveToggle = document.getElementById('keepAliveToggle');
const optionsButton = document.getElementById('optionsButton');

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Build a settings object from the current toggle states.
function readSettings(speed) {
  return {
    speed,
    setInterval: setIntervalToggle.checked,
    setTimeout: setTimeoutToggle.checked,
    performance: performanceToggle.checked,
    dateNow: dateNowToggle.checked,
    requestAnimationFrame: requestAnimationFrameToggle.checked
  };
}

// Save settings and send them to the active tab's content script.
async function pushSettings(settings) {
  await browser.storage.local.set(settings);
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    try {
      await browser.tabs.sendMessage(tabs[0].id, { action: 'updateSettings', settings });
    } catch (e) {
      // Active tab has no content script (e.g. a chrome:// page).
    }
  }
}

// The speed of the currently highlighted button (1x if none).
function currentSpeed() {
  const active = document.querySelector('.speed-btn.active');
  return active ? parseInt(active.dataset.speed) : 1;
}

// Speed button click handler.
async function handleSpeedButtonClick() {
  const speed = parseInt(this.dataset.speed);

  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  if (speed !== 0) this.classList.add('active'); // don't highlight Stop

  await pushSettings(readSettings(speed));

  this.style.transform = 'scale(0.95)';
  setTimeout(() => { this.style.transform = 'scale(1)'; }, 100);
}

// Build the popup once the DOM is ready.
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await browser.storage.local.get({
    speed: 1,
    setInterval: false,
    setTimeout: false,
    performance: true,
    dateNow: false,
    requestAnimationFrame: true,
    keepAlive: false,
    speedSteps: [20, 50, 100, 200, 500]
  });

  // Build the speed buttons from the saved presets.
  const container = document.querySelector('.speed-buttons');
  container.innerHTML = `
    <button class="speed-btn" data-speed="1">Normal</button>
    ${settings.speedSteps.map(s => `<button class="speed-btn" data-speed="${s}">${s}x</button>`).join('')}
    <button class="speed-btn stop-btn" data-speed="0">Stop</button>
  `;

  document.querySelectorAll('.speed-btn').forEach(btn => {
    const handler = (e) => {
      e.preventDefault(); // avoid double-firing on touch devices
      if (!btn.disabled) handleSpeedButtonClick.call(btn);
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchend', handler);
    if (parseInt(btn.dataset.speed) === settings.speed) btn.classList.add('active');
  });

  // Restore toggle states.
  setIntervalToggle.checked = settings.setInterval;
  setTimeoutToggle.checked = settings.setTimeout;
  performanceToggle.checked = settings.performance;
  dateNowToggle.checked = settings.dateNow;
  requestAnimationFrameToggle.checked = settings.requestAnimationFrame;
  keepAliveToggle.checked = settings.keepAlive;

  // On mobile, add a Mobile Optimization toggle above the Settings button.
  if (isMobileDevice()) {
    const section = document.createElement('div');
    section.className = 'toggle-section mobile-only';
    section.innerHTML = `
      <label class="toggle">
        <input type="checkbox" id="mobileOptimizationToggle" checked>
        <span class="toggle-label">Mobile Optimization</span>
      </label>
    `;
    optionsButton.parentNode.insertBefore(section, optionsButton);
    document.getElementById('mobileOptimizationToggle').addEventListener('change', (e) => {
      browser.storage.local.set({ mobileOptimized: e.target.checked });
    });
  }
});

// Timing-method toggles: re-push settings at the current speed when changed.
[setIntervalToggle, setTimeoutToggle, performanceToggle, dateNowToggle, requestAnimationFrameToggle]
  .forEach(toggle => {
    toggle.addEventListener('change', () => {
      // On mobile, keep the most reliable methods enabled.
      if (isMobileDevice()) {
        setIntervalToggle.checked = true;
        setTimeoutToggle.checked = true;
        requestAnimationFrameToggle.checked = true;
      }
      pushSettings(readSettings(currentSpeed()));
    });
  });

// Keep-alive toggle: independent of speed, sent as its own message.
keepAliveToggle.addEventListener('change', async () => {
  const keepAlive = keepAliveToggle.checked;
  await browser.storage.local.set({ keepAlive });
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    try {
      await browser.tabs.sendMessage(tabs[0].id, { action: 'updateKeepAlive', settings: { keepAlive } });
    } catch (e) {
      // Active tab has no content script.
    }
  }
});

// Settings button: open the options page.
const handleOptionsClick = (e) => {
  e.preventDefault();
  optionsButton.style.transform = 'scale(0.95)';
  setTimeout(() => { optionsButton.style.transform = 'scale(1)'; }, 100);
  browser.runtime.openOptionsPage();
  window.close();
};
optionsButton.addEventListener('click', handleOptionsClick);
optionsButton.addEventListener('touchend', handleOptionsClick);
