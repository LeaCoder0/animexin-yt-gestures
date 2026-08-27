# Project Rules

## Quality
- Don't mark a task done without verifying it works.
- If a fix feels like a workaround, say so and propose the clean
  solution separately.
- Never contradict `.ai/DECISIONS.md` without explicit user discussion.

## Reproducing the user's environment
The phone is Edge Canary + built-in adblock + uBlock, so a playback bug
must always be tested with an adblocker in the loop.

- Use **Brave**, not plain Chrome: Chrome blocks no ads and hides
  adblock-caused differences (user correction, 2026-08-27).
- **Always** put uBO Lite in `--load-extension` alongside our own
  extension, not only for adblock-specific runs (user correction,
  2026-08-27). Without it AnimeXin's dtscout stack fires a `pt:"tabup"`
  popunder on every tap that reaches the page, stealing test taps and
  reading as extension misbehaviour. It lives at
  `~/user/lib/testing/ubolite` — a durable path, because the previous
  copy in `/tmp` vanished on reboot and left the rig unprotected.
- Adblock changes which code paths exist, so cover both states. With uBO
  Lite on, Ok.ru never creates its autoplay stub, so stub rejection can
  only be exercised with adblock **off**.

## Driving the extension over CDP
- Content-script state is invisible to main-world `evaluate`; check the
  injected DOM (`#axg-overlay`) instead of `window.__axgInit`. The same
  world split means `Object.defineProperty` on a DOM node from Playwright
  does not change what the content script reads.
- Hide the controls before testing a gesture. `#axg-controls` is
  `inset: 0` with the play button dead centre, and it stops propagation —
  so a tap at the player's centre while it is open hits the button, not
  the gesture layer, and toggles play twice.
- A first tap on a cold profile can miss the double-tap window; retry
  before believing a pairing failure.
- When an assertion fails, check its precondition actually held. Two
  "failures" this session were the harness, not the code.
- Long python-over-CDP probes: run `python3 -u` inside `timeout N`, with
  per-step try/except — a hung `page.goto` or buffered stdout otherwise
  loses all output.

## Updates (maintenance happens inline during the session)
- Append any finalised design decision to `.ai/DECISIONS.md`.
- On completing a task, move it to **Done** in `.ai/TASKS.md` (one line;
  the reasoning belongs in DECISIONS) and promote the next Todo.
- Keep testing *rules* here and machine *facts* in `.ai/CONTEXT.md`;
  don't state the same thing in both.
- Add a pattern to `## Conventions` in CONTEXT after it is used twice,
  and significant new files to `## Key Files`.
