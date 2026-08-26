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
Fix mobile-reported issues: (1) top dead-zone in fullscreen so the
notification-shade pull doesn't trigger swipe-down — DONE in code;
(2) autoplay broken on the user's phone — root-caused to the adblocker
(uBlock) blocking `dmxleo.dailymotion.com/cdn/manifest/*.m3u8`
(ERR_BLOCKED_BY_CLIENT), so the video never gets a source. Not an
extension bug.

## Blocker
none

## Conventions
- All player-frame constants live at the top of `src/player.js`
  (SEEK_STEP, TOP_GAP, NATIVE_STRIP, …).
- `window.__axg` debug handle in player.js for DevTools/CDP driving.
- Content-script world is isolated: from CDP, detect injection via the
  `#axg-overlay` DOM node (or hidden `#sidebar`), never `window.__axgInit`.

## Key Files
- `src/manifest.json` — content scripts per host + background worker
- `src/animexin.js` — top frame: YT layout + prev/next resolution
- `src/player.js` — video frame: gestures, overlay, autoplay, resume
- `src/player.css` — overlay/badge/seekbar styling
- `src/background.js` — relays prev/next to tab navigation
- `tools/probe_autoplay.py` — CDP/Playwright autoplay probe (desktop or
  Android via `adb forward`); prints blocked dailymotion requests

## Test environment notes (2026-08-27)
- User's desktop Chrome on CDP port 9191 does NOT have the extension
  loaded — don't use it to judge extension behaviour.
- Repro rig: Brave (`/usr/bin/brave-browser`) via
  `launch_persistent_context` with `--load-extension`, mobile UA +
  `is_mobile` + touch. Brave is preferred over Chrome (its shields
  approximate Edge's built-in adblock).
- uBlock Origin 1.74 (MV2) fails to load in Brave/Chromium 151 and
  poisons the whole `--load-extension` list; use uBO Lite (MV3) from
  `/tmp/ubolite` for adblock repros.
- User's phone: Edge Canary + built-in adblock enabled + uBlock
  extension installed.
