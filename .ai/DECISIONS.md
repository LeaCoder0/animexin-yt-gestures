# Decision Log
<!-- Append new entries below. Never delete old ones. -->

### 2026-08-27 — Prev/next swaps the episode in place, no page load
**Decision**: `background.js` now relays prev/next to the top frame as
`axg-gonav` instead of calling `chrome.tabs.update`. `animexin.js`
resolves the adjacent URL, fetches it, and replaces `.postbody` with the
response's `.postbody`, then updates `document.title`, pushes history,
scrolls to top and re-runs `ytLayout()` + `collapsibleEpisodes()`.
`popstate` swaps too, so back/forward never reloads. Any failure falls
back to `location.href = url`. `syncMeta()` also copies the
episode-bound `<head>` tags (canonical, og:*, description, twitter:*),
which would otherwise keep describing the episode that was loaded from
the network — measured stale before this was added.
**Why**: A full reload tore down the player and the whole page on every
episode change. Swapping only the main column keeps it YouTube-like.
Safe because the site's server dropdown is wired with an inline
`onchange="loadMi(this)"` attribute calling a global that survives the
swap, and DOMParser-parsed scripts are inert so nothing re-executes.
Verified in the desktop browser: a canary global survived the swap
(proving no reload), URL/title/iframe video id all advanced, and
`loadMi` plus all 12 mirror options stayed intact.

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

### 2026-08-27 — Drive the mirror's *content* video, chosen by metadata
**Decision**: `player.js` no longer uses `document.querySelector("video")`.
`pickVideo()` returns the best candidate among elements that pass
`isContent()` — a duration of at least `MIN_CONTENT_DUR` (2s), a non-zero
rendered box, and not Ok.ru's `res/i/video/stub.mp4` — ranked by
playing-beats-paused then by area. The overlay is not built until such an
element exists, and `attach()` moves our `play`/`pause`/`durationchange`/
`timeupdate` listeners onto it, re-running from document-level **capture**
listeners for the media events plus a MutationObserver and a 1s poll, so a
mirror that swaps its `<video>` (or turns a stub into the real stream by
changing `src`) is followed instead of stranding us. Starting a click-to-play
mirror is now a separate concern: `nudgePoster()` presses `POSTER_BTN` (which
gained Ok.ru's `.vid_play`) up to 8 times pre-boot, and stops as soon as
`pickVideo()` is non-null so it can never click a control that has become
"pause".
**Why**: Episode 212 defaults to the Ok.ru mirror, which parks a 1-second
`stub.mp4` element in the frame to unlock autoplay and then collapses it to
0x0. It is always the first `<video>` in the DOM, so we latched onto it: the
seekbar read a 1-second duration instead of the episode's 22:17 and play/pause
toggled a hidden element — exactly the two symptoms reported. Dailymotion
episodes worked only by luck, their real element happening to come first (they
also carry two 0x0 `NaN` decoys).
Deciding at first sight cannot work and was tried first: in the instant a
`<video>` is appended, Ok.ru's stub and a genuine player element are
indistinguishable — no source, `duration` `NaN`, and a 300x150 box (the
intrinsic default of a sourceless `<video>`, measured on Ok.ru). Waiting for
real metadata is the first unambiguous signal.
**Verified** in Brave with the extension + uBO Lite loaded, mobile emulation:
ep212 shows `0:17 / 22:17` (matching the duration Ok.ru's own card advertises),
double-tap centre pauses the real element, double-tap right seeks 21.6s ->
31.6s; with adblock off, 7 stubs present and the overlay correctly stays out.
ep283 unchanged: attaches, `0:13 / 15:18`, double-tap pauses the 918.9s
element.

### 2026-08-27 — The eye sits in the top-LEFT corner
**Decision**: `#axg-eye` is `left: 8px` instead of `right: 8px`. Nothing else
moves; `syncChrome()` still pushes its `top` below `TOP_GAP` in fullscreen.
**Why**: User request. Reachability with the left thumb, and the top-right of
the player is where mirrors tend to put their own chrome.

### 2026-08-27 — The vault key is the signing key; an earlier key shipped before it
**Decision**: Pack with the vault copy
(`~/user/lib/private-vault/extensions/animexin-yt-gestures/signing-key.pem`),
extension ID `nkcddjnclmanbilibnfbdoakgjldnnkg` — the ID this log and the
vault README already record. Confirmed by deriving the ID from the key and
by checking the public key embedded in the packed CRX3 header.
**Correction to the record**: builds before today were *not* signed with that
key. `signing-key.pem` in this working copy is a different, older key
(2026-08-24) whose ID is `kbjnmhnlikmbdaclkngldbnbdnjbpaic`, and the CRX3
header of the previous `animexin-yt-gestures.crx` proves it signed that
build. So the phone's currently-installed copy is `kbjnmhnl…`, and a crx
signed with the vault key arrives as a **new** extension beside it rather
than an update — the old copy must be uninstalled and its saved playback
positions do not carry over. The user chose the vault key knowing this.
**Hazard left in place**: the working copy's `signing-key.pem` is still the
older key, so a future `--pack-extension-key=$PWD/signing-key.pem` would
silently produce `kbjnmhnl…` again. Pack with the vault path explicitly, or
replace the working copy from the vault (keep a backup of the old key first —
it signed real builds). Also note the vault README's "Working copy" path
(`~/user/projects/web/extensions/...`) does not exist; this checkout is at
`~/user/lib/own/web/edge-extensions/animexin-yt-gestures`.
**Why**: The ID is derived from the key, so which key signs is not a detail —
it decides whether Edge updates in place or installs a duplicate.
