# Decision Log
<!-- Append new entries below. Never delete old ones. -->

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
