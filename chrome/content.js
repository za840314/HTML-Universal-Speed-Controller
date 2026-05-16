// Isolated-world content script. Bridges messages between the extension
// (popup/background) and the page-world script (inject.js, registered in the
// manifest as a "world": "MAIN" content script).

const browser = globalThis.browser || globalThis.chrome;
const MSG_SOURCE = "hsc-speed-controller";

const postToPage = (action, settings) => {
  window.postMessage({ source: MSG_SOURCE, action, settings }, "*");
};

// inject.js posts "ready" once it has installed its overrides. Re-apply the
// auto-speed config then, in case our first attempt below raced ahead of it.
window.addEventListener("message", (e) => {
  const data = e.data;
  if (e.source === window && data && data.source === MSG_SOURCE && data.action === "ready") {
    checkAutoSpeedSite();
  }
});

// Handle messages from popup/background.
browser.runtime.onMessage.addListener(async (message) => {
  try {
    if (message.action === "updateSettings") {
      if (!message.isAutoSpeed) {
        const { autoSpeedSites = {} } = await browser.storage.local.get("autoSpeedSites");
        if (window.location.hostname in autoSpeedSites) return;
      }
      postToPage("updateSettings", message.settings);
    } else if (message.action === "checkAutoSpeed") {
      await checkAutoSpeedSite();
    } else if (message.action === "updateLoggingSettings") {
      postToPage("updateLoggingSettings", message.settings);
    } else if (message.action === "updateKeepAlive") {
      postToPage("updateKeepAlive", message.settings);
    }
  } catch (error) {
    console.error("Speed Controller: error handling message:", error);
  }
});

// Apply the saved auto-speed for this site (if any) and push logging settings.
async function checkAutoSpeedSite() {
  try {
    const currentHost = window.location.hostname;
    const {
      autoSpeedSites = {},
      developerMode = false,
      logTimingMethods = false,
      logPerformance = false,
      logFrameUpdates = false,
      logMobileOptimization = false,
      keepAlive = false
    } = await browser.storage.local.get([
      "autoSpeedSites",
      "developerMode",
      "logTimingMethods",
      "logPerformance",
      "logFrameUpdates",
      "logMobileOptimization",
      "keepAlive"
    ]);

    postToPage("updateLoggingSettings", {
      developerMode,
      logTimingMethods,
      logPerformance,
      logFrameUpdates,
      logMobileOptimization
    });

    postToPage("updateKeepAlive", { keepAlive });

    if (currentHost in autoSpeedSites) {
      const speed = autoSpeedSites[currentHost];

      browser.runtime.sendMessage({
        action: "showNotification",
        title: "Auto-Speed Activated",
        message: `Speed set to ${speed}x for ${currentHost}`
      }).catch(() => {});

      browser.runtime.sendMessage({
        action: "updateAutoSpeedStatus",
        status: { active: true, speed, domain: currentHost }
      }).catch(() => {});

      postToPage("updateSettings", {
        speed,
        setInterval: false,
        setTimeout: false,
        performance: true,
        dateNow: false,
        requestAnimationFrame: true
      });
    } else {
      browser.runtime.sendMessage({
        action: "updateAutoSpeedStatus",
        status: { active: false }
      }).catch(() => {});
    }
  } catch (error) {
    console.error("Speed Controller: error checking auto-speed site:", error);
  }
}

// Push config once on load too — covers the case where inject.js installed its
// overrides before this script's "ready" listener was attached.
checkAutoSpeedSite();
