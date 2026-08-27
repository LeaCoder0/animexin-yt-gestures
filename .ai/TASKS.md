# Tasks

## In Progress
- Awaiting on-device confirmation for two changes: the prev/next
  in-place episode swap (verified in the desktop browser; the phone was
  disconnected from adb when that crx was built — SHA-256 `11f95a99`)
  and the Ok.ru content-video fix below. The Ok.ru stream CDN is
  unreachable from this machine, so only the phone can confirm the real
  Ok.ru player end to end.

## Todo
- (idea, not approved) Tighten `POSTER_BTN`: the loose
  `button[aria-label*='play' i]` / `button[title*='play' i]` entries can
  match an ad overlay's button, and each synthetic click is a fresh user
  activation — a popunder surface. Not the cause of anything observed.
- (idea, not approved) Auto-switch server/mirror when a stream stays
  sourceless or is blocked.

## Done
- Moved the eye button to the top-left corner (2026-08-27).
- Fixed episode 212: it defaults to the **Ok.ru** mirror, whose player
  parks a 1-second 0x0 `stub.mp4` element in the frame as its autoplay
  unlock. `querySelector("video")` returned that stub, so the seekbar
  showed a 1-second duration instead of 22:17 and double-tap play/pause
  toggled a hidden element. Now the content element is chosen by real
  metadata and our listeners follow it. See DECISIONS 2026-08-27.
- Established that the extra tab appearing during mobile-size testing is
  AnimeXin's own dtscout `pt:"tabup"` popunder, not the extension: it
  fires with the extension disabled and on desktop too, and is
  gesture-gated, so it can steal test taps. uBO Lite suppresses it.
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
- Added the top-right eye button (never existed before, despite being
  remembered as such — checked all of git history), auto-hiding after 1s
  with `pointer-events: none` while hidden. Reworked from a controls
  toggle into a **bypass switch** for the whole overlay on user feedback;
  see DECISIONS 2026-08-27.
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
