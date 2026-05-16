// Initialize default settings when extension is installed
browser.runtime.onInstalled.addListener(async () => {
  const defaultSettings = {
    speed: 2,
    setInterval: false,
    setTimeout: false,
    performance: true,
    dateNow: false,
    requestAnimationFrame: true,
    keepAlive: false,
    autoSpeedSites: []
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

// Listen for messages from content script
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "showNotification") {
    browser.notifications.create({
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-96.png"),
      title: message.title,
      message: message.message
    }).catch((e) => console.error("Speed Controller: notification failed:", e));
  }
  return true;
});

// Listen for tab updates to check if new page should have auto-speed
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      await browser.tabs.sendMessage(tabId, { action: "checkAutoSpeed" });
    } catch (e) {
      // Ignore errors for tabs that don't have our content script
    }
  }
});
