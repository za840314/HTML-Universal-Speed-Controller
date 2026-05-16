// Initialize default settings when the extension is installed.
browser.runtime.onInstalled.addListener(async () => {
  const defaultSettings = {
    speed: 2,
    setInterval: false,
    setTimeout: false,
    performance: true,
    dateNow: false,
    requestAnimationFrame: true,
    keepAlive: false
  };

  const existingSettings = await browser.storage.local.get(Object.keys(defaultSettings));

  const newSettings = {};
  for (const [key, value] of Object.entries(defaultSettings)) {
    if (existingSettings[key] === undefined) {
      newSettings[key] = value;
    }
  }

  if (Object.keys(newSettings).length > 0) {
    await browser.storage.local.set(newSettings);
  }

  // One-time migration to the performance + requestAnimationFrame default,
  // for installs still carrying the original all-methods-on settings.
  const { timingMethodsDefaultV2 } = await browser.storage.local.get("timingMethodsDefaultV2");
  if (!timingMethodsDefaultV2) {
    await browser.storage.local.set({
      setInterval: false,
      setTimeout: false,
      performance: true,
      dateNow: false,
      requestAnimationFrame: true,
      timingMethodsDefaultV2: true
    });
  }
});
