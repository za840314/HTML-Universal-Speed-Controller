// Isolated-world content script. Bridges messages between the popup and the
// page-world script (inject.js, registered in the manifest as a "world":
// "MAIN" content script).

const browser = globalThis.browser || globalThis.chrome;
const MSG_SOURCE = "hsc-speed-controller";

const postToPage = (action, settings) => {
  window.postMessage({ source: MSG_SOURCE, action, settings }, "*");
};

// Apply the saved keep-alive setting to this page.
async function applyKeepAlive() {
  try {
    const { keepAlive = false } = await browser.storage.local.get("keepAlive");
    postToPage("updateKeepAlive", { keepAlive });
  } catch (error) {
    console.error("Speed Controller: error reading keep-alive setting:", error);
  }
}

// inject.js posts "ready" once its overrides are installed; (re)apply
// keep-alive then, in case the call below raced ahead of it.
window.addEventListener("message", (e) => {
  const data = e.data;
  if (e.source === window && data && data.source === MSG_SOURCE && data.action === "ready") {
    applyKeepAlive();
  }
});

// Relay messages from the popup to the page-world script.
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "updateSettings") {
    postToPage("updateSettings", message.settings);
  } else if (message.action === "updateKeepAlive") {
    postToPage("updateKeepAlive", message.settings);
  }
});

// Apply keep-alive on load too — covers inject.js installing before the
// "ready" listener above was attached.
applyKeepAlive();
