# Project Context — animexin-yt-gestures

## Goal
MV3 browser extension that makes watching donghua on animexin.dev feel
like the YouTube mobile app (gestures, overlay controls, layout,
autoplay, resume, correct prev/next episode navigation).

## Stack
Plain JS/CSS, Manifest V3, no build step. Target: Edge Canary on
Android, sideloaded as `.crx`. Tested on desktop via Brave + Playwright
over CDP.

## Current Task
None open. Last shipped: the eye button moved to the top-left, and the
Ok.ru wrong-duration / dead-double-tap fix. Awaiting on-device
confirmation — see TASKS.

## Blocker
none

## Conventions
- All player-frame constants live at the top of `src/player.js`
  (SEEK_STEP, TOP_GAP, NATIVE_STRIP, MIN_CONTENT_DUR, …).
- Never use `document.querySelector("video")` — mirrors carry decoy
  elements. Resolve through `pickVideo()`, and reach the current element
  through `v()`.
- `window.__axg` debug handle in player.js for DevTools/CDP driving.
- Content-script world is isolated: from CDP, detect injection via the
  `#axg-overlay` DOM node, never `window.__axgInit`.

## Key Files
- `src/manifest.json` — content scripts per host + background worker
- `src/animexin.js` — top frame: YT layout + prev/next resolution
- `src/player.js` — video frame: gestures, overlay, autoplay, resume
- `src/player.css` — overlay/badge/seekbar styling
- `src/background.js` — relays prev/next to tab navigation
- `tools/probe_autoplay.py` — CDP/Playwright autoplay probe (desktop or
  Android via `adb forward`)

## Environment facts
Testing *rules* (which browser, adblock) live in RULES.md; these are the
plain facts about this machine.

- Rig: Brave (`/usr/bin/brave-browser`) via `launch_persistent_context`,
  loading `src` **and** `~/user/lib/testing/ubolite`, with mobile UA +
  `is_mobile` + touch.
- The desktop Chrome on CDP port 9191 has no extensions loaded. Useful
  for reading page/DOM structure, useless for judging our behaviour.
- The default mirror differs per episode (ep212 → Ok.ru, ep283 →
  Dailymotion). Check which one an episode actually loads before
  treating a bug as general.
- Ok.ru's stream CDN (`vd471.okcdn.ru`) is unreachable from here
  (ERR_ABORTED, geo), so an Ok.ru mirror cannot be played locally. To
  exercise that path, inject a real long video as a blob URL:
  `ffmpeg -f lavfi -i color=c=black:s=64x64:r=2 -t 1337` (~39 KB).
- Faking `duration` with `Object.defineProperty` from Playwright does
  **not** work: each world has its own DOM wrappers, so the content
  script still reads the native value.
- There is no signing key in this checkout by design. The pack command,
  which names the vault key, lives in the vault's README.
