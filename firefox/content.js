// Isolated-world content script. Injects the page-world script (inject.js) and
// bridges messages between the popup and that page script.

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
