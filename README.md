# HTML Universal Speed Controller

A browser extension that controls the speed of timing-based behavior on web
pages by hooking `setInterval`, `setTimeout`, `Date.now`, `performance.now`,
and (optionally) `requestAnimationFrame`. Useful for accelerating countdown
timers and "please wait X seconds" screens on ad and download pages.

Based on [patanahid/HTML-Universal-Speed-Controller](https://github.com/patanahid/HTML-Universal-Speed-Controller).
This repository contains bug-fixed builds for both Firefox and Chrome.

## Repository layout

| Folder     | Build                                  |
|------------|----------------------------------------|
| `firefox/` | Manifest V2 build for Firefox          |
| `chrome/`  | Manifest V3 build for Chrome           |

The two builds share the same speed-control logic (`inject.js`); they differ
only in manifest format and a few browser-API details.

## Install on Firefox

Firefox only allows unsigned extensions to be loaded *temporarily* (they unload
when Firefox restarts):

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `firefox/manifest.json`

To keep it installed permanently you would need Firefox Developer Edition or
Nightly with `xpinstall.signatures.required` set to `false` in `about:config`,
then install the packaged build via `about:addons`.

## Install on Chrome

Chrome's unpacked installs **persist across restarts**:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `chrome/` folder

Keep the folder where it is — Chrome reloads it from that path on every launch.
Developer mode must stay enabled.

## Usage

- Click the toolbar icon and pick a speed.
- The toggles choose which timing methods are hooked (`setInterval`,
  `setTimeout`, `performance`, `Date.now`, `requestAnimationFrame`).
  `requestAnimationFrame` is off by default — enable it if a site drives its
  countdown from the animation loop.
- The **Settings** page supports per-site auto-speed rules and custom presets.

## Fixes applied over the original

- **CSP-safe injection.** The page-world hook is now loaded as a real script
  resource instead of an inline `<script>`, so it is no longer blocked by a
  site's Content-Security-Policy.
- **`Date.now` infinite recursion** removed; `Date.now` / `performance.now` now
  share one virtual clock.
- **Timer re-timing** fixed so that changing the speed correctly re-times
  intervals that already exist, without double-firing them.
- **`notifications` permission** added and the notification icon path
  corrected.
- **Popup width** fixed — a stray mobile media query was collapsing the popup
  into a thin vertical strip.
- **Chrome build** ported to Manifest V3 (service worker, `world: "MAIN"`
  content script, PNG icons).

## Disclaimer

Provided for personal use. Speeding up a site only changes timing in your own
browser; it cannot affect anything decided by a server (e.g. game outcomes or
server-validated cooldowns).
