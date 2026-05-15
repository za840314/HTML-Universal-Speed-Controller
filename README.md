# HTML Universal Speed Controller

A browser extension that speeds up (or pauses) timers, countdowns, and
animations on web pages. Handy for getting past "please wait 30 seconds"
screens and countdown timers on ad and download pages.

Works on **Google Chrome** and **Firefox**. Based on
[patanahid/HTML-Universal-Speed-Controller](https://github.com/patanahid/HTML-Universal-Speed-Controller),
with several bugs fixed (see [What was fixed](#what-was-fixed)).

---

## Download

**Easiest way:** click the green **`< > Code`** button near the top of this
page, then click **Download ZIP**. Unzip it anywhere — you'll get a `firefox`
folder and a `chrome` folder.

**Or download just one browser's build** from the [`dist`](dist) folder:

- [`dist/chrome.zip`](dist/chrome.zip) — for Google Chrome
- [`dist/firefox.zip`](dist/firefox.zip) — for Firefox

(Click the file, then click the **download** button on its page.)

---

## Install on Google Chrome

This stays installed after you restart Chrome.

1. **Download and unzip** the extension (see [Download](#download) above). Put
   the `chrome` folder somewhere you won't delete it — for example your
   Documents folder. *(Chrome loads it from that folder every time it starts,
   so don't move or delete it afterward.)*
2. Open a new tab and go to **`chrome://extensions`**
3. Turn on **Developer mode** — the switch in the **top-right corner**.
4. Click the **Load unpacked** button (top-left).
5. Select the **`chrome`** folder and confirm.
6. Done! Click the puzzle-piece icon in the toolbar and **pin** "HTML Universal
   Speed Controller" so its icon is always visible.

> If Chrome shows a warning bubble about developer-mode extensions when it
> starts, just close it — the extension keeps working. Developer mode must stay
> turned on.

---

## Install on Firefox

Firefox unloads this kind of add-on every time it restarts, so you'll redo
these quick steps after each restart.

1. **Download** [`dist/firefox.zip`](dist/firefox.zip) (see
   [Download](#download) above). You do **not** need to unzip it.
2. Open a new tab and go to **`about:debugging#/runtime/this-firefox`**
3. Click **Load Temporary Add-on…**
4. Select the **`firefox.zip`** file you downloaded.
5. Done! The Speed Controller icon appears in your toolbar.

> After you restart Firefox, repeat steps 2–4 to load it again. A permanent
> install requires a signed build, which needs a Mozilla developer account.

---

## How to use

1. Click the **Speed Controller** icon in your toolbar.
2. Click a speed — for example **5x** or **20x**.
3. The page's timers and countdowns now run that many times faster.
   - **Normal** = back to 1x (normal speed)
   - **Stop** = freeze timers
4. If a countdown doesn't speed up, **reload the page** and pick the speed
   again. If it still won't move, open the popup and turn on the
   **requestAnimationFrame** toggle (some sites run their countdown from the
   animation loop).
5. The **Settings** page lets you save custom speed presets and set a site to
   speed up automatically every time you visit it.

---

## What was fixed

Compared with the original project, these builds fix:

- **Didn't work on many sites** — the speed code is now injected in a way that
  a website's security policy (CSP) can't block.
- **`Date.now` crash** — an infinite loop in the date override was removed.
- **Speed changes not applying** — existing timers are now correctly re-timed
  when you change the speed, with no double-speed glitches.
- **Broken popup layout** — the popup no longer collapses into a thin strip.
- **Chrome support** — added a Manifest V3 build so it runs on modern Chrome.

---

## Repository layout

| Folder         | What it is                                  |
|----------------|---------------------------------------------|
| `chrome/`      | Chrome (Manifest V3) source files           |
| `firefox/`     | Firefox (Manifest V2) source files          |
| `dist/`        | Ready-to-download `.zip` bundles            |

---

## Disclaimer

For personal use. Speeding up a site only changes timing inside your own
browser — it cannot change anything decided by a server (such as game outcomes
or server-checked cooldown timers).
