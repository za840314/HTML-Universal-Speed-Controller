// Cross-browser alias: Chrome exposes `chrome`, Firefox exposes `browser`.
const browser = globalThis.browser || globalThis.chrome;

const speedStepsList = document.getElementById('speedStepsList');
const newSpeedStep = document.getElementById('newSpeedStep');
const addSpeedStep = document.getElementById('addSpeedStep');
const resetButton = document.getElementById('resetButton');
const saveStatus = document.getElementById('saveStatus');

const DEFAULT_SPEED_STEPS = [20, 50, 100, 200, 500];

// Show a transient status message.
function showStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.className = 'status-message show ' + (isError ? 'error' : 'success');
  setTimeout(() => { saveStatus.className = 'status-message'; }, 3000);
}

// Render the speed-step chips, each with a remove button.
function renderSpeedSteps(steps) {
  speedStepsList.innerHTML = steps
    .map(step => `
      <div class="speed-step">
        <span>${step}x</span>
        <button data-speed="${step}" title="Remove speed step">✕</button>
      </div>
    `).join('');

  speedStepsList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const speedToRemove = parseFloat(btn.dataset.speed);
      const { speedSteps = DEFAULT_SPEED_STEPS } = await browser.storage.local.get('speedSteps');
      const newSteps = speedSteps.filter(s => s !== speedToRemove).sort((a, b) => a - b);
      await browser.storage.local.set({ speedSteps: newSteps });
      renderSpeedSteps(newSteps);
      showStatus('Speed step removed.');
    });
  });
}

// Load the saved speed steps when the page opens.
document.addEventListener('DOMContentLoaded', async () => {
  const { speedSteps = DEFAULT_SPEED_STEPS } = await browser.storage.local.get('speedSteps');
  renderSpeedSteps(speedSteps);
});

// Add a new speed step.
addSpeedStep.addEventListener('click', async () => {
  const newSpeed = parseFloat(newSpeedStep.value);

  if (isNaN(newSpeed) || newSpeed < 1) {
    showStatus('Enter a valid speed (minimum 1).', true);
    return;
  }
  if (newSpeed > 500) {
    showStatus('Speed cannot exceed 500x.', true);
    return;
  }

  const { speedSteps = DEFAULT_SPEED_STEPS } = await browser.storage.local.get('speedSteps');
  if (speedSteps.includes(newSpeed)) {
    showStatus('That speed step already exists.', true);
    return;
  }

  const newSteps = [...speedSteps, newSpeed].sort((a, b) => a - b);
  await browser.storage.local.set({ speedSteps: newSteps });
  renderSpeedSteps(newSteps);
  newSpeedStep.value = '';
  showStatus('Speed step added.');
});

// Reset the speed steps to the default set.
resetButton.addEventListener('click', async () => {
  await browser.storage.local.set({ speedSteps: DEFAULT_SPEED_STEPS });
  renderSpeedSteps(DEFAULT_SPEED_STEPS);
  showStatus('Speed steps reset to default.');
});
