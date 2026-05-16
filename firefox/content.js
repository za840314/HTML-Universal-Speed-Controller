// Isolated-world content script. Injects the page-world script (inject.js) and
// bridges messages between the extension (popup/background) and that page script.

const MSG_SOURCE = "hsc-speed-controller";

// Inject inject.js into the page's main world. It is loaded from the extension
// origin (a web-accessible resource), so the page's CSP does not block it.
(function injectPageScript() {
  try {
    const script = document.createElement("script");
    script.src = browser.runtime.getURL("inject.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error("Speed Controller: failed to inject page script:", error);
  }
})();

const postToPage = (action, settings) => {
  window.postMessage({ source: MSG_SOURCE, action, settings }, "*");
};

// Wait for inject.js to signal it is ready, then apply any auto-speed config.
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
