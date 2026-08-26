# Decision Log
<!-- Append new entries below. Never delete old ones. -->

### 2026-08-27 — The eye is a bypass switch, not a controls toggle
**Decision**: Pressing `#axg-eye` stands our whole layer down: the
overlay gets `.off` (`pointer-events: none; touch-action: auto`), the
fullscreen dead zone hides, the context-menu suppression lifts, and
gestures/controls go inert — so every touch reaches the mirror's own
player UI. Pressing it again restores everything. Single-tap on the
video remains the controls toggle. While bypassed the eye does not
auto-hide (it is dimmed to 0.6 instead), because it re-enables
pointer-events on itself and is then the only way back.
**Why**: The user needs the mirror's native UI (quality, captions, its
own seekbar) reachable on demand; our overlay covers the player and
swallows those touches. An on/off switch beats trying to guess which
taps to forward.

### 2026-08-27 — Start click-to-play mirrors by pressing their own poster
**Decision**: When the `<video>` has no source (`!currentSrc &&
readyState === 0`), `player.js` clicks the mirror's own play button
(`POSTER_BTN` selector list) instead of calling `video.play()`. Done from
both `autoStart()` (retrying) and `gestureKick()`. The eye/controls path
is untouched.
**Why**: On Android the mirror stays on its click-to-play poster and
keeps the element sourceless. `play()` on a sourceless element never
settles — not resolve, not reject — so `await vid.play()` stalled
`autoStart()` on its first attempt and silently killed the retry chain.
Verified on-device that a *programmatic* click needs no user gesture: it
attaches the source and plays unmuted.

### 2026-08-27 — Signing key lives in a separate private vault repo
**Decision**: `signing-key.pem` stays gitignored here; the canonical copy
lives in the private repo `LeaCoder0/private-vault` (checked out at
`~/user/lib/private-vault`), under
`extensions/animexin-yt-gestures/`, with a README recording the derived
extension ID `nkcddjnclmanbilibnfbdoakgjldnnkg` and the pack/restore
commands.
**Why**: This repo is public, so committing the key would publish it
permanently and let anyone sign a CRX with our extension ID. The key
still needs to survive a fresh clone, because signing with a different
key changes the extension ID and Edge installs the result as a second
extension instead of an update.

### 2026-08-27 — Fullscreen-only top dead zone as its own element
**Decision**: The dead zone is a separate `#axg-topgap` element (sibling
of the overlay, `z-index` above it, default `touch-action`), shown only
while `document.fullscreenElement` is set. `#axg-overlay` geometry is
never modified. Visibility is re-derived by `syncTopGap()` from
`fullscreenchange`, `resize` and `orientationchange`.
**Why**: The first attempt offset `#axg-overlay.style.top` instead —
but `#axg-controls` is `inset: 0` *inside* the overlay, so a 48px top
offset plus the existing 56px `NATIVE_STRIP` bottom inset squeezed the
64px round buttons out of view on a short embedded player (the "hide
and show button is missing" report), and a missed exit event left the
offset applied permanently. Keeping the gesture surface untouched and
layering a transparent, default-`touch-action` strip above it solves the
shade pull without touching the controls' geometry.

### 2026-08-27 — Repro browser is Brave, not Chrome
**Decision**: Desktop reproductions of the phone setup use Brave with
`--load-extension`, mobile UA emulation, and uBO Lite when adblock
matters.
**Why**: User's phone runs Edge Canary with built-in adblock + uBlock;
Chrome without adblock hides adblock-caused failures (user correction).
