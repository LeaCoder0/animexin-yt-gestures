# Decision Log
<!-- Append new entries below. A decision is never dropped; wording may  -->
<!-- be condensed, and an entry that a later finding corrects is merged   -->
<!-- with that correction rather than left to contradict it in sequence.  -->

### 2026-08-27 — Prev/next swaps the episode in place, no page load
**Decision**: `background.js` relays prev/next to the top frame as
`axg-gonav` instead of calling `chrome.tabs.update`. `animexin.js`
resolves the adjacent URL, fetches it, replaces `.postbody` with the
response's, then updates `document.title`, pushes history, scrolls to top
and re-runs `ytLayout()` + `collapsibleEpisodes()`. `popstate` swaps too,
so back/forward never reloads. Any failure falls back to
`location.href = url`. `syncMeta()` also copies the episode-bound
`<head>` tags (canonical, og:*, description, twitter:*), which were
measured stale before it was added.
**Why**: A full reload tore down the player and the whole page on every
episode change. Safe because the site's server dropdown is wired with an
inline `onchange="loadMi(this)"` calling a global that survives the swap,
and DOMParser-parsed scripts are inert so nothing re-executes. Verified:
a canary global survived the swap (proving no reload), URL/title/iframe
video id advanced, and `loadMi` plus all 12 mirror options stayed intact.

### 2026-08-27 — The eye is a bypass switch, not a controls toggle
**Decision**: Pressing `#axg-eye` stands our whole layer down — the
overlay gets `.off` (`pointer-events: none; touch-action: auto`), the
fullscreen dead zone hides, context-menu suppression lifts, gestures and
controls go inert — so every touch reaches the mirror's own player UI.
Pressing it again restores everything. Single-tap on the video remains
the controls toggle. While bypassed the eye does not auto-hide (dimmed to
0.6 instead), because it is then the only way back.
**Why**: The mirror's native UI (quality, captions, its own seekbar) has
to be reachable on demand, and our overlay covers the player and swallows
those touches. An on/off switch beats guessing which taps to forward.

### 2026-08-27 — Start click-to-play mirrors by pressing their own poster
**Decision**: Rather than calling `video.play()`, click the mirror's own
play button (`POSTER_BTN` selector list, which includes Ok.ru's
`.vid_play`). Driven by `nudgePoster()` before boot, and by
`gestureKick()` afterwards.
**Why**: On Android the mirror stays on its click-to-play poster and
keeps the element sourceless, and `play()` on a sourceless element never
settles — not resolve, not reject — so `await vid.play()` stalled
`autoStart()` on its first attempt and silently killed the retry chain.
A *programmatic* click needs no user gesture: verified on-device that it
attaches the source and plays unmuted.

### 2026-08-27 — Fullscreen-only top dead zone as its own element
**Decision**: The dead zone is a separate `#axg-topgap` element (sibling
of the overlay, `z-index` above it, default `touch-action`), shown only
while `document.fullscreenElement` is set. `#axg-overlay` geometry is
never modified; visibility is re-derived from `fullscreenchange`,
`resize` and `orientationchange`.
**Why**: The first attempt offset `#axg-overlay.style.top` instead — but
`#axg-controls` is `inset: 0` *inside* the overlay, so a 48px top offset
plus the existing 56px `NATIVE_STRIP` bottom inset squeezed the 64px
round buttons out of view on a short embedded player (the "hide and show
button is missing" report), and a missed exit event left the offset
applied permanently.

### 2026-08-27 — Repro browser is Brave with uBO Lite, not plain Chrome
**Decision**: Desktop reproductions use Brave with `--load-extension`
loading our `src` *and* uBO Lite, plus mobile UA emulation.
**Why**: The phone runs Edge Canary with built-in adblock + uBlock.
Chrome without an adblocker hides adblock-caused failures, and it also
lets AnimeXin's dtscout popunder fire on every tap that reaches the page,
stealing test taps and reading as extension misbehaviour.

### 2026-08-27 — Signing key lives in the private vault; the vault key is canonical
**Decision**: No signing key in this checkout at all. The keys live in
the private repo `LeaCoder0/private-vault` (checked out at
`~/user/lib/private-vault`) under `extensions/animexin-yt-gestures/`, and
packing names that path explicitly. `signing-key.pem` there is canonical:
extension ID `nkcddjnclmanbilibnfbdoakgjldnnkg`, public-key SHA-256
prefix `da2339d2…`.
**Correction absorbed**: this log originally recorded that ID as the one
being shipped, but it was not. Until 2026-08-27 every crx was signed by a
different, older key (2026-08-24) whose ID is
`kbjnmhnlikmbdaclkngldbnbdnjbpaic` — proved by the public key embedded in
the shipped crx's CRX3 header. Consequence: the phone's installed copy is
`kbjnmhnl…`, so a vault-signed crx arrives as a **new** extension beside
it, not an update; the old copy must be uninstalled and its saved
playback positions are orphaned. The user chose the vault key knowing
this. The older key is archived as
`signing-key.superseded-2026-08-24.pem` (byte-identical copy verified
before the original was deleted) and removed from this checkout, so a
`--pack-extension-key=$PWD/signing-key.pem` can no longer silently
produce the wrong ID — it just fails, and Chromium does not invent a
replacement key. It was never git-tracked here, so no history rewrite.
**Why**: This repo is public, so a committed key would be published
permanently and let anyone sign a CRX with our ID. And because the ID is
*derived* from the key, which key signs is not a detail — it decides
whether Edge updates in place or installs a duplicate.
**Note**: `gitarius push` cannot push the vault — its filter blocks
`*.pem` on a sensitive-*path* pattern, and `--no-secret-scan` only skips
the *content* scan. Never use `--auto-mitigate` there: it would gitignore
the keys the vault exists to hold. Push that repo with plain `git push`
after confirming it is still private.

### 2026-08-27 — Drive the mirror's *content* video, chosen by metadata
**Decision**: `player.js` no longer uses `document.querySelector("video")`.
`pickVideo()` returns the best element passing `isContent()` — duration
at least `MIN_CONTENT_DUR` (2s), a non-zero rendered box, and not Ok.ru's
`res/i/video/stub.mp4` — ranked playing-before-paused, then by area. The
overlay is not built until such an element exists, and `attach()` moves
the `play`/`pause`/`durationchange`/`timeupdate` listeners onto it,
re-resolving from document-level **capture** listeners for media events
plus a MutationObserver and a 1s poll, so a mirror that swaps its
`<video>` — or turns a stub into the real stream by changing `src` — is
followed instead of stranding us. Starting the player is a separate
concern (`nudgePoster()`), bounded and stopped as soon as real content
exists so it can never click a control that has become "pause".
**Why**: Ep212 defaults to the Ok.ru mirror, which parks a 1-second
`stub.mp4` in the frame to unlock autoplay and then collapses it to 0x0.
It is always the first `<video>` in the DOM, so we latched onto it: the
seekbar read a 1-second duration instead of 22:17, and play/pause toggled
a hidden element — exactly the two reported symptoms. Dailymotion worked
only by luck, its real element happening to come first (it also carries
two 0x0 `NaN` decoys).
Deciding at first sight cannot work, and was tried first: in the instant
a `<video>` is appended, Ok.ru's stub and a genuine player element are
indistinguishable — no source, `duration` `NaN`, and a 300x150 box, the
intrinsic default of a sourceless `<video>`. Real metadata is the first
unambiguous signal.
**Verified** in Brave with our extension + uBO Lite, mobile emulation:
ep212 reads `0:17 / 22:17`, matching Ok.ru's own card; double-tap centre
pauses the real element; double-tap right seeks 21.6s → 31.6s. With
adblock off, 7 stubs present and the overlay correctly stays out. ep283
unchanged: `0:13 / 15:18`, double-tap pauses the 918.9s element.

### 2026-08-27 — The eye sits in the top-LEFT corner
**Decision**: `#axg-eye` is `left: 8px` instead of `right: 8px`. Nothing
else moves; fullscreen still pushes its `top` below `TOP_GAP`.
**Why**: User request — left-thumb reach, and mirrors tend to put their
own chrome in the top-right.
