# Tasks

## In Progress
- Autoplay-on-mobile: user to confirm root cause on phone (disable
  uBlock on animexin.dev / check with `tools/probe_autoplay.py --port
  9222` over `adb forward`).

## Todo
- Verify TOP_GAP fullscreen dead-zone on the real device.
- (idea, not approved) Auto-switch server/mirror when the stream is
  blocked by an adblocker.

## Done
- Read/understood project (2026-08-26).
- TOP_GAP=48px top dead zone in fullscreen — as a separate
  `#axg-topgap` element, after the first (overlay-offset) attempt hid
  the control buttons. See DECISIONS 2026-08-27.
- Verified on-device over adb+CDP: layout rework, prev/next resolution,
  overlay injection and single-tap toggle all working in Edge Canary.
- Root-caused mobile autoplay failure: adblocker blocks
  dmxleo.dailymotion.com HLS manifest → video has no source. Extension
  itself verified working (Brave, cold profile, mobile UA: unmuted
  autoplay OK without uBlock; blocked with uBO Lite).
- `tools/probe_autoplay.py` CDP probe written (works desktop + Android).
