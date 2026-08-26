#!/usr/bin/env python3
"""Probe the extension's autoplay behaviour over CDP.

Connects to a Chromium with --remote-debugging-port (desktop, or an Android
browser through `adb forward`), reloads the animexin episode tab, captures
[AXG] console output from every frame, and samples the <video> state in the
player iframe for a few seconds.

Usage:
    python3 probe_autoplay.py [--port 9191] [--reload/--no-reload] [--watch 10]
"""
import argparse
import json
import time

from playwright.sync_api import sync_playwright


def frame_video_state(frame):
    try:
        return frame.evaluate(
            """() => {
                const v = document.querySelector('video');
                return {
                    axgInit: !!window.__axgInit,
                    video: !v ? null : {
                        paused: v.paused, muted: v.muted, volume: v.volume,
                        currentTime: +v.currentTime.toFixed(1),
                        readyState: v.readyState, autoplay: v.autoplay,
                        error: v.error && v.error.message,
                    },
                };
            }"""
        )
    except Exception as e:
        return {"error": str(e)[:120]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=9191)
    ap.add_argument("--watch", type=int, default=10, help="seconds to sample after load")
    ap.add_argument("--no-reload", action="store_true", help="inspect current state only")
    args = ap.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(f"http://localhost:{args.port}")
        pages = [pg for ctx in browser.contexts for pg in ctx.pages]
        page = next((pg for pg in pages if "animexin" in pg.url), None)
        if not page:
            print("No animexin tab found. Open an episode page first. Tabs:")
            for pg in pages:
                print("  -", pg.url[:100])
            return

        print("Tab:", page.url)
        page.on(
            "console",
            lambda m: "[AXG]" in m.text and print(f"  console: {m.text}"),
        )
        # Adblockers killing the stream show up here (ERR_BLOCKED_BY_CLIENT on
        # the dmxleo manifest = no video source at all).
        page.on(
            "requestfailed",
            lambda r: ("dailymotion" in r.url or ".m3u8" in r.url)
            and print(f"  BLOCKED: {r.url[:90]} -> {r.failure}"),
        )

        if not args.no_reload:
            print("Reloading to observe autoplay from a cold load...")
            page.reload(wait_until="domcontentloaded")

        deadline = time.time() + args.watch
        while time.time() < deadline:
            time.sleep(2)
            states = []
            for f in page.frames:
                if f == page.main_frame:
                    continue
                s = frame_video_state(f)
                if s.get("video") or s.get("axgInit"):
                    states.append((f.url[:70], s))
            stamp = f"t+{args.watch - int(deadline - time.time())}s"
            if not states:
                print(f"{stamp}: no player frame with a <video> yet")
            for url, s in states:
                print(f"{stamp}: {url}\n        {json.dumps(s)}")

        for url, s in states:
            vid = s.get("video")
            if vid:
                # A click-to-play mirror parks the element with paused=false but
                # no source at all, so readyState is what says it is really
                # playing.
                started = vid["readyState"] > 0
                verdict = (
                    "NOT STARTED (no source - player still on its poster)" if not started
                    else "AUTOPLAY OK (unmuted)" if not vid["paused"] and not vid["muted"]
                    else "PLAYING BUT MUTED" if not vid["paused"]
                    else "PAUSED"
                )
                print(f"\nVERDICT: {verdict}  axgInit={s.get('axgInit')}")


if __name__ == "__main__":
    main()
