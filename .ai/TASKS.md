# Tasks

## In Progress
- none

## Todo
- (idea, not approved) Auto-switch server/mirror when a stream stays
  sourceless or is blocked.

## Done
- Read/understood project (2026-08-26).
- TOP_GAP=48px top dead zone in fullscreen — as a separate
  `#axg-topgap` element, after the first (overlay-offset) attempt hid
  the control buttons. See DECISIONS 2026-08-27.
- Fixed mobile autoplay: the mirror parks its `<video>` sourceless until
  its own poster is pressed, and `play()` on a sourceless element never
  settles, so `autoStart()` stalled on attempt 1. Now presses the
  player's own play button. See DECISIONS 2026-08-27.
  **Correction**: an earlier note in this file blamed the adblocker
  (`dmxleo.dailymotion.com` manifest blocked). That block was real but
  was NOT the cause — the probe's "PLAYING BUT MUTED" verdict was a
  false positive (it read `paused === false` on a sourceless element)
  and masked the real bug. Verdict logic fixed in the probe.
- Added the top-right eye show/hide toggle (never existed before, despite
  being remembered as such — checked all of git history), auto-hiding
  after 1s with `pointer-events: none` while hidden.
- Hid the Chatbro + wpDiscuz chat popups and the `.sosmed` share row, and
  made `.headlist` collapsible (collapsed by default) via `animexin.css`.
- Signing key moved to the private vault repo. See DECISIONS 2026-08-27.
- `tools/probe_autoplay.py` CDP probe written (works desktop + Android
  via `adb forward`).
- Verified on-device in Edge Canary (adb + CDP + real OS-level touches):
  layout rework, prev/next resolution, overlay injection, single-tap
  toggle in portrait AND fullscreen, swipe-up fullscreen + landscape
  lock, resume position. User confirmed autoplay, controls and eye
  auto-hide all working on the phone (2026-08-27).
