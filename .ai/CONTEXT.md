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
Done: eye button moved to the top-left, and the Ok.ru wrong-duration /
dead-double-tap bug fixed by choosing the mirror's content `<video>`
instead of the first one in the DOM. See DECISIONS 2026-08-27.

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
  `~/user/lib/testing/ubolite` (v2026.825.1619) for adblock repros —
  it must be in every rig launch, not just adblock-specific ones.
- Ok.ru's stream CDN (`vd471.okcdn.ru`) is unreachable from this
  machine (ERR_ABORTED, geo), so an Ok.ru mirror cannot be played
  locally. To exercise the Ok.ru code path, inject a real long video
  into the frame (`ffmpeg -f lavfi -i color=...:r=2 -t 1337`, ~39 KB,
  loaded as a blob URL). Faking `duration` with
  `Object.defineProperty` from Playwright does NOT work: each world
  has its own DOM wrappers, so the content script still sees the
  native value.
- The default mirror differs per episode — ep212 is Ok.ru, ep283 is
  Dailymotion. Always check which mirror an episode actually loads
  before assuming a bug is general.
- User's phone: Edge Canary + built-in adblock enabled + uBlock
  extension installed.
