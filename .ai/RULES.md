# Project Rules

## Quality
- Don't mark a task done without verifying it works.
- If a fix feels like a workaround, say so and propose the clean
  solution separately.
- Never contradict `.ai/DECISIONS.md` without explicit user discussion.

## Project-specific
- To reproduce the user's mobile environment, use Brave (built-in
  shields) — NOT plain Chrome, which blocks no ads and hides
  adblock-caused differences (user correction, 2026-08-27).
- The user's phone setup is Edge Canary + built-in adblock + uBlock;
  any playback bug must be tested with an adblocker in the loop.
- From CDP/Playwright, content-script state is invisible to main-world
  `evaluate`; check injected DOM (`#axg-overlay`) instead.
- Long python-over-CDP probes: always run `python3 -u` inside
  `timeout N`, and keep per-step try/except — a hung `page.goto` or
  buffered stdout otherwise loses all output.

## Updates (maintenance happens inline during the session)
- After any design decision is finalised, append it to
  `.ai/DECISIONS.md`.
- After a task is completed, move it from **In Progress** → **Done**
  in `.ai/TASKS.md`, and promote the first **Todo** item.
- When a pattern is applied 2+ times, add it to `## Conventions` in
  `.ai/CONTEXT.md`.
- When a significant new file is created, add it to `## Key Files` in
  `.ai/CONTEXT.md`.
