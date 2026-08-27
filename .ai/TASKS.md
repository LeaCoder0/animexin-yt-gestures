# Tasks

## In Progress
- On-device confirmation of the last two changes. The vault-signed crx
  (ID `nkcddjnclmanbilibnfbdoakgjldnnkg`, sha256 `c59b7865`) is sitting at
  `/sdcard/Download/animexin-yt-gestures.crx` on the phone, not yet
  installed. Its ID differs from the installed copy (`kbjnmhnl…`), so it
  lands as a **second** extension — uninstall the old one, and its saved
  playback positions will not carry over.
- Ok.ru cannot be played on this machine, so only the phone can confirm
  the real Ok.ru player end to end.

## Todo
- (idea, not approved) Tighten `POSTER_BTN`: the loose
  `button[aria-label*='play' i]` / `button[title*='play' i]` entries can
  match an ad overlay's button, and each synthetic click is a fresh user
  activation — a popunder surface. Not the cause of anything observed.
- (idea, not approved) Auto-switch server/mirror when a stream stays
  sourceless or is blocked.

## Done
One line each; the reasoning lives in DECISIONS.md under the same date.

### 2026-08-27
- Ok.ru content-video fix: ep212's wrong duration and dead double-tap.
- Eye button moved to the top-left corner.
- Signing-key record corrected; the older key archived to the vault and
  removed from this checkout.
- Established that the extra tab during mobile-size testing is AnimeXin's
  own dtscout `pt:"tabup"` popunder, not the extension — it fires with
  the extension disabled and on desktop too, and is gesture-gated, so it
  steals test taps. uBO Lite suppresses it.
- Prev/next swaps the episode in place, including the episode-bound
  `<head>` tags.
- Eye reworked from a controls toggle into a bypass switch for the whole
  overlay.
- Fullscreen top dead zone (TOP_GAP=48px) as its own `#axg-topgap`
  element, after a first attempt squeezed the control buttons out of view.
- Mobile autoplay fixed by pressing the mirror's own poster button. (An
  earlier note blamed the adblocker; that was a false positive from the
  probe reading `paused` on a sourceless element. Probe verdict fixed.)
- Signing key moved to the private vault repo.
- Hid the Chatbro + wpDiscuz chat popups and the `.sosmed` share row;
  made `.headlist` collapsible, collapsed by default.
- On-device verification in Edge Canary (adb + CDP + real OS-level
  touches): layout rework, prev/next resolution, overlay injection,
  single-tap toggle in portrait and fullscreen, swipe-up fullscreen +
  landscape lock, resume position, autoplay, controls, eye auto-hide.

### 2026-08-26
- `tools/probe_autoplay.py` CDP probe (desktop + Android via
  `adb forward`).
