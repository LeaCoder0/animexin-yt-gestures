# AnimeXin YT Gestures

A Manifest V3 browser extension that makes watching donghua on
[animexin.dev](https://animexin.dev) feel like the YouTube mobile app —
gestures, player controls, layout and playback behaviour included.

Built for **Microsoft Edge Canary on Android** (sideloaded via
*Developer options → Extension install by crx*), works in any Chromium
browser that loads extensions.

## What it does to feel like YouTube

### Touch gestures on the video

| Gesture | Action |
|---|---|
| Swipe **up** on the video | Enter fullscreen + lock landscape |
| Swipe **down** in fullscreen | Exit fullscreen, back to portrait |
| **Double-tap right** | Seek forward 10s — cumulative (+10, +20, +30…) with an on-screen badge |
| **Double-tap left** | Seek backward 10s — cumulative, with badge |
| **Double-tap center** | Pause / play |
| **Long-press** (hold) | 2× playback speed until released, YouTube-style badge |
| **Single tap** | Toggle the control overlay |

### Player control overlay

- **Previous / Play-Pause / Next** round buttons — monochrome SVG icons
  (no emoji-font color glyphs), subtle monochrome hover states.
- **Seekbar** with live progress and `current / total` time label,
  draggable to scrub.
- Auto-hides after 3 seconds; tapping any empty area hides it instantly.
- Gestures keep working while the overlay is visible — only the buttons
  and the seekbar swallow touches.
- The site's native long-press context menu ("Video ID / Ad console")
  is suppressed so it never fights the 2× gesture.

### Correct episode navigation

**Next / Previous actually go to the adjacent episode.** The stock
player's next button jumps to a random video; this extension reads the
episode page's own `rel="prev"` / `rel="next"` links (with a URL-slug
fallback) and navigates the tab to episode *n−1* / *n+1*.

### Playback behaviour

- **Auto-play, never a black screen** — starts playback on load; if the
  browser blocks unmuted autoplay it falls back to muted playback and
  finishes on the first touch.
- **Auto-unmute** — dismisses the player's "tap to unmute" state on
  load via the player's own button so its UI cleans up.
- **Resume where you left off** — playback position is saved every ~2s
  (per video id, in localStorage) and restored after reloads/restarts.
  Positions in the last 30s are cleared so finished episodes restart
  fresh.

### YouTube-style page layout

The episode page is rearranged top-to-bottom into: **video → title →
server select + prev/next → series info → related episodes**, and the
noise is removed — breadcrumbs, announcements, schedule strip, download
links, recommended series, comments, sidebar and footer.

### Works on every mirror the site offers

The gesture layer injects into all current video hosts — Dailymotion,
Ok.ru, Mega, Rumble, gdriveplayer, Dood — but only when the frame is
embedded under animexin.\*; visiting those sites directly leaves the
extension inert.

## Install (Edge Canary on Android)

1. Pack `src/` into a `.crx` (Chromium: `--pack-extension=src`).
2. Copy the `.crx` to the phone (`adb push … /sdcard/Download/`).
3. Edge Canary → Settings → **About** → tap build number 5× if
   Developer options are hidden.
4. Settings → **Developer options → Extension install by crx** → pick
   the file.

## Project layout

```
src/
├── manifest.json    # MV3, content scripts per host + background worker
├── animexin.js      # top frame: layout rework + prev/next resolution
├── player.js        # video frame: gestures, overlay, autoplay, resume
├── player.css       # overlay, buttons, badges, seekbar styling
└── background.js    # relays prev/next requests to tab navigation
```
