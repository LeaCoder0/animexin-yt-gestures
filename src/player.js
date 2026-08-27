// Gesture layer injected into the Dailymotion player frame.
// Gestures: swipe up = fullscreen+landscape, swipe down = exit fullscreen,
// double-tap left/right = seek -/+10s (cumulative), double-tap center = pause/play,
// single tap = Prev / Play-Pause / Next popup.
(() => {
  if (window.__axgInit) return;
  window.__axgInit = true;

  // Only activate inside frames embedded under animexin.* — the manifest
  // registers the current mirror hosts (Dailymotion, Ok.ru, Mega, Rumble,
  // gdriveplayer, Dood); this guard keeps us inert when those sites are
  // visited directly.
  const underAnimexin = (() => {
    try {
      if (window.top === window) return false;
      const anc = location.ancestorOrigins;
      if (anc && anc.length) return [...anc].some((o) => /animexin\./i.test(o));
      return /animexin\./i.test(document.referrer);
    } catch (_) {
      return false;
    }
  })();
  if (!underAnimexin) return;

  const SEEK_STEP = 10;
  const DBL_MS = 300;       // max gap between taps of a double-tap
  const SWIPE_MIN = 70;     // min vertical px for a swipe
  const HIDE_MS = 3000;     // controls auto-hide
  const EYE_MS = 1000;      // show/hide toggle auto-hide
  const NATIVE_STRIP = 56;  // bottom px left for the native seekbar
  const TOP_GAP = 48;       // top px left free in fullscreen so pulling down the
                            // notification shade never reads as a swipe-down
  const LONG_MS = 500;      // hold time before 2x speed kicks in
  const LONG_RATE = 2;

  let video, overlay, topgap, controls, playBtn, eyeBtn, badge, seek, timeLabel, seeking = false;
  let seekAccum = 0, seekTimer = null, lastSeekDir = 0;
  let lastTap = { t: 0, zone: "" };
  let tapTimer = null, hideTimer = null, eyeTimer = null, pStart = null;
  let lpTimer = null, lpActive = false, lpPrevRate = 1;
  let bypass = false;       // our layer stood down so the mirror's own UI works
  let nudging = false;      // poster-press chain already running

  // Ok.ru drops a 1-second `stub.mp4` element into the frame the first time it
  // sees a gesture — that is how it unlocks autoplay — and then collapses it to
  // 0x0. It is always the first <video> in the DOM, so `querySelector("video")`
  // latched onto it for good: the seekbar read a 1-second duration instead of
  // the episode's 22:17, and play/pause toggled a hidden element.
  const STUB_SRC = /res\/i\/video\/stub\.mp4/i;
  const MIN_CONTENT_DUR = 2;  // seconds; anything shorter is a stub, not an episode

  // Deciding the moment an element appears is what put us on the stub: a fresh
  // stub and a fresh player element are identical then — no source, duration
  // NaN, and 300x150, the intrinsic default box of a sourceless <video>
  // (measured on Ok.ru). Real metadata is the first unambiguous signal, so we
  // wait for it rather than guess.
  const isContent = (el) =>
    el.duration >= MIN_CONTENT_DUR &&          // NaN and the 1s stub both fail
    el.clientWidth > 0 && el.clientHeight > 0 &&  // a hidden element is not the one
    !STUB_SRC.test(el.currentSrc || el.src || "");

  // Among genuine candidates, playing beats paused and the bigger box wins.
  const rankOf = (el) => [el.paused ? 0 : 1, el.clientWidth * el.clientHeight];
  const outranks = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  };

  // The mirror's content element, or null while none has real metadata yet.
  function pickVideo() {
    let best = null, bestRank = null;
    for (const el of document.querySelectorAll("video")) {
      if (!isContent(el)) continue;
      const r = rankOf(el);
      if (!best || outranks(r, bestRank)) { best = el; bestRank = r; }
    }
    return best;
  }

  const v = () => video;

  // Our listeners have to follow the element. A mirror can replace its <video>
  // (or turn a stub into the real stream by swapping the src) long after we
  // booted, and listeners stranded on the old element freeze the seekbar, the
  // time label and the play icon.
  const VID_BINDINGS = [
    ["play", syncPlayIcon],
    ["pause", syncPlayIcon],
    ["durationchange", syncSeekbar],
    ["timeupdate", syncSeekbar],
    ["timeupdate", savePos],
  ];

  function attach(el) {
    if (!el || el === video) return;
    if (video) for (const [ev, fn] of VID_BINDINGS) video.removeEventListener(ev, fn);
    video = el;
    for (const [ev, fn] of VID_BINDINGS) el.addEventListener(ev, fn);
    if (overlay) { syncPlayIcon(); syncSeekbar(); }
  }

  // Inline SVG icons: emoji glyphs render as colored emoji on Android fonts.
  const ICONS = {
    prev: "M6 6h2v12H6zm3.5 6l8.5 6V6z",
    next: "M6 18l8.5-6L6 6v12zm10-12h2v12h-2z",
    play: "M8 5v14l11-7z",
    pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
    eye: "M12 5C7 5 2.7 8.1 1 12.5c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5C21.3 8.1 17 5 12 5zm0 12.5a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z",
    eyeOff:
      "M12 5C7 5 2.7 8.1 1 12.5c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5C21.3 8.1 17 5 12 5zm0 12.5a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6zM3.7 2.3L21.7 20.3l-1.4 1.4L2.3 3.7z",
  };
  const icon = (path) =>
    `<svg viewBox="0 0 24 24" width="30" height="30" fill="#fff" aria-hidden="true"><path d="${path}"/></svg>`;

  // Media events do not bubble, but they still travel the capture phase, so one
  // listener on the document sees every element's — including a stub element
  // that later becomes the real stream, which mutates no children and would
  // therefore be invisible to a MutationObserver.
  const MEDIA_EVENTS = ["loadedmetadata", "durationchange", "play", "playing", "emptied"];

  let booted = false, watching = false;

  function watchForVideo() {
    if (watching) return;
    watching = true;
    new MutationObserver(onMediaChange).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    for (const ev of MEDIA_EVENTS) document.addEventListener(ev, onMediaChange, true);
    // Neither hook covers a player that reveals itself by flipping a class:
    // no media event, no child added. A 1s re-check until we are up costs
    // nothing and makes the wait timing-proof.
    const poll = setInterval(() => (booted ? clearInterval(poll) : boot()), 1000);
  }

  // Before boot: keep looking for the content element. After: keep our
  // listeners on whichever element is currently the content element.
  function onMediaChange() {
    if (!booted) return void boot();
    const best = pickVideo();
    // Only ever upgrade. A momentary 0x0 (fullscreen transitions) must not
    // strand us on nothing, but a mirror swapping in a new element must win.
    if (best && best !== video) attach(best);
  }

  // Click-to-play mirrors (Ok.ru, Rumble, Dood, ...) only build their content
  // <video> once their own play control is pressed; a programmatic click is
  // enough. Bounded, because on a mirror that needs a real touch this would
  // otherwise click forever.
  function nudgePoster(attempt = 0) {
    // Stop the moment real content exists: the mirror's play button becomes its
    // pause button, and another click would stop the episode we just started.
    if (booted || attempt > 7 || pickVideo()) return;
    pressPoster();
    setTimeout(() => nudgePoster(attempt + 1), 1200);
  }

  function boot() {
    if (booted) return;
    if (!document.body) return void setTimeout(boot, 300);
    watchForVideo();
    const vid = pickVideo();
    if (!vid) {
      if (!nudging) { nudging = true; nudgePoster(); }
      return;
    }
    booted = true;
    attach(vid);
    build();
    restorePos();
    autoStart();
    console.log("[AXG] gesture layer attached");
  }

  // --- resume position across reloads (per Dailymotion video id) ---
  const posKey = () =>
    "axg-pos-" + (new URLSearchParams(location.search).get("video") || location.pathname);

  function restorePos() {
    const vid = v();
    if (!vid) return;
    const saved = parseFloat(localStorage.getItem(posKey()));
    if (!saved || saved < 5) return;
    const apply = () => {
      if (vid.duration && saved < vid.duration - 10) vid.currentTime = saved;
    };
    if (vid.readyState >= 1) apply();
    else vid.addEventListener("loadedmetadata", apply, { once: true });
  }

  let lastSave = 0;
  function savePos() {
    const vid = v();
    if (!vid || !vid.duration || vid.seeking) return;
    const now = Date.now();
    if (now - lastSave < 2000) return;
    lastSave = now;
    if (vid.currentTime > vid.duration - 30) localStorage.removeItem(posKey());
    else if (vid.currentTime > 5) localStorage.setItem(posKey(), String(vid.currentTime));
  }

  // A mirror in click-to-play state keeps its <video> sourceless, and play() on
  // a sourceless element never settles — awaiting it would stall autoStart for
  // good. Pressing the player's own poster button is what attaches the source;
  // a programmatic click is enough, no user gesture required.
  const POSTER_BTN =
    "button.button_play, .play_screen button, [class*='button_play']," +
    " .vjs-big-play-button, .vid_play, button[aria-label*='play' i]," +
    " button[title*='play' i]";

  const notStarted = (vid) => !vid.currentSrc && vid.readyState === 0;

  function pressPoster() {
    const btn = document.querySelector(POSTER_BTN);
    if (!btn) return false;
    btn.click();
    return true;
  }

  // Unmute via Dailymotion's own tap-to-unmute button so its UI cleans up,
  // falling back to direct video properties.
  function unmute() {
    const btn = document.querySelector("button.tap_to_unmute");
    if (btn) btn.click();
    const vid = v();
    if (vid && vid.muted) { vid.muted = false; vid.volume = 1; }
  }

  // Start playback unmuted if the browser allows it; otherwise fall back to
  // muted autoplay (no black screen) and finish unmuting on the first touch.
  async function autoStart(attempt = 0) {
    const vid = v();
    if (!vid) return;
    const retry = () => {
      if (attempt < 8) setTimeout(() => autoStart(attempt + 1), 1000);
    };
    // Click-to-play mirror: press its poster rather than awaiting a play() that
    // can never resolve. The source arrives a moment later, so come back round.
    if (notStarted(vid)) {
      pressPoster();
      return retry();
    }
    try {
      await vid.play();
      unmute();
      if (!vid.muted) return;
    } catch (_) {}
    try {
      vid.muted = true;
      await vid.play();
      unmute(); // may still be denied without a gesture; gestureKick finishes it
    } catch (_) {}
    if (vid.paused || vid.muted) retry();
  }

  // Any real touch counts as a user gesture: use it to unmute/start playback.
  // Only active until the video is playing unmuted once, so later touches
  // never fight deliberate pause/mute actions.
  let kicked = false;
  function gestureKick() {
    const vid = v();
    if (kicked || !vid) return;
    // Player still on its poster: spend the touch on starting it, and stay
    // armed so a later touch can finish the unmute.
    if (notStarted(vid)) { pressPoster(); return; }
    if (!vid.paused && !vid.muted) { kicked = true; return; }
    unmute();
    if (vid.paused) vid.play().catch(() => {});
    kicked = true;
  }

  function build() {
    overlay = document.createElement("div");
    overlay.id = "axg-overlay";
    overlay.style.bottom = NATIVE_STRIP + "px";

    badge = document.createElement("div");
    badge.id = "axg-badge";
    overlay.appendChild(badge);

    // Fullscreen-only dead zone: a sibling stacked above the overlay, so the
    // notification-shade pull never reaches the gesture handlers. Kept out of
    // the overlay so the controls layer is never squeezed by it.
    topgap = document.createElement("div");
    topgap.id = "axg-topgap";
    topgap.style.height = TOP_GAP + "px";
    document.body.appendChild(topgap);

    controls = document.createElement("div");
    controls.id = "axg-controls";
    // Shield only the interactive widgets from the gesture layer — taps on
    // the empty area still reach the overlay (gestures + tap-to-hide).
    const shield = (el) => {
      for (const ev of ["pointerdown", "pointerup", "pointermove", "click"])
        el.addEventListener(ev, (e) => e.stopPropagation());
    };
    const mk = (path, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = icon(path);
      b.addEventListener("click", () => { fn(); bump(); });
      shield(b);
      controls.appendChild(b);
      return b;
    };
    mk(ICONS.prev, () => nav("prev"));
    playBtn = mk(ICONS.pause, togglePlay);
    mk(ICONS.next, () => nav("next"));

    // Show/hide toggle, pinned top-left of the player. Lives outside
    // #axg-controls so it stays reachable while the controls are hidden.
    eyeBtn = document.createElement("button");
    eyeBtn.type = "button";
    eyeBtn.id = "axg-eye";
    eyeBtn.addEventListener("click", () => setBypass(!bypass));
    shield(eyeBtn);
    overlay.appendChild(eyeBtn);

    // Seekbar row at the bottom of the popup layer.
    const row = document.createElement("div");
    row.id = "axg-seekrow";
    seek = document.createElement("input");
    seek.type = "range";
    seek.min = 0;
    seek.max = 1000;
    seek.value = 0;
    timeLabel = document.createElement("span");
    timeLabel.id = "axg-time";
    timeLabel.textContent = "0:00 / 0:00";
    row.appendChild(seek);
    row.appendChild(timeLabel);
    shield(row);
    controls.appendChild(row);

    seek.addEventListener("input", () => {
      seeking = true;
      const vid = v();
      if (vid.duration) {
        vid.currentTime = (seek.value / 1000) * vid.duration;
        updateTimeLabel();
      }
      bump();
    });
    seek.addEventListener("change", () => (seeking = false));

    overlay.appendChild(controls);
    document.body.appendChild(overlay);

    // The per-element listeners live in attach(), so they can follow a mirror
    // that swaps its <video> out from under us.
    syncPlayIcon();
    syncSeekbar();

    overlay.addEventListener("pointerdown", onDown);
    overlay.addEventListener("pointerup", onUp);
    overlay.addEventListener("pointermove", onMove);
    overlay.addEventListener("pointercancel", () => { endLongPress(); pStart = null; });
    // Long-press must mean 2x speed, not the context menu (Video ID / Ad console)
    // — but while we are stood down, the mirror's own menus are the point.
    document.addEventListener("contextmenu", (e) => {
      if (bypass) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    document.addEventListener("fullscreenchange", () => {
      syncChrome();
      if (!document.fullscreenElement) {
        try { screen.orientation.unlock(); } catch (_) {}
      }
    });
    // fullscreenchange can be missed when the browser exits fullscreen itself
    // (back gesture, orientation change); re-derive from the live state so a
    // stale dead zone can never linger.
    window.addEventListener("resize", syncChrome);
    window.addEventListener("orientationchange", syncChrome);
    syncChrome();
    syncEye();
    bumpEye(); // visible briefly on load, then out of the way
  }

  // Stand our whole layer down so every touch reaches the mirror's own player
  // UI (quality, captions, its own seekbar), and back up again. The overlay
  // stops hit-testing entirely; only the eye keeps pointer-events, which is
  // why it must stay put while bypassed — it is the sole way back.
  function setBypass(on) {
    bypass = on;
    overlay.classList.toggle("off", on);
    if (eyeBtn) eyeBtn.classList.toggle("off", on);
    if (on) {
      endLongPress();
      hideControls();
      badge.classList.remove("show");
      pStart = null;
      clearTimeout(tapTimer);
    }
    syncChrome();
    syncEye();
    bumpEye();
  }

  function syncChrome() {
    const fs = !!document.fullscreenElement;
    // The dead zone is stacked above the overlay, so it has to stand down too.
    if (topgap) topgap.style.display = fs && !bypass ? "block" : "none";
    // Keep the eye clear of the dead zone, which would swallow taps meant for it.
    if (eyeBtn) eyeBtn.style.top = (fs && !bypass ? TOP_GAP + 8 : 8) + "px";
  }

  // Open eye = our layer is live; slashed = stood down.
  function syncEye() {
    if (eyeBtn) eyeBtn.innerHTML = icon(bypass ? ICONS.eyeOff : ICONS.eye);
  }

  // The toggle shows itself on any touch and fades back out a second later, so
  // it never sits over the video for long. Hidden means pointer-events: none,
  // so the corner it occupies keeps forwarding taps to the gesture layer. While
  // bypassed it stays visible: nothing else of ours would receive a touch.
  function bumpEye() {
    if (!eyeBtn) return;
    eyeBtn.classList.add("show");
    clearTimeout(eyeTimer);
    if (bypass) return;
    eyeTimer = setTimeout(() => eyeBtn.classList.remove("show"), EYE_MS);
  }

  const zoneOf = (x) => {
    const w = overlay.clientWidth;
    return x < w / 3 ? "left" : x > (2 * w) / 3 ? "right" : "center";
  };

  function onDown(e) {
    gestureKick();
    bumpEye();
    pStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    clearTimeout(lpTimer);
    lpTimer = setTimeout(startLongPress, LONG_MS);
  }

  function onMove(e) {
    // A drag is a swipe, not a long press.
    if (!pStart || lpActive) return;
    if (Math.abs(e.clientX - pStart.x) > 20 || Math.abs(e.clientY - pStart.y) > 20)
      clearTimeout(lpTimer);
  }

  function startLongPress() {
    const vid = v();
    if (!vid || vid.paused) return;
    lpActive = true;
    lpPrevRate = vid.playbackRate || 1;
    vid.playbackRate = LONG_RATE;
    badge.textContent = `${LONG_RATE}× ▶︎▶︎`;
    badge.className = "center show";
  }

  function endLongPress() {
    clearTimeout(lpTimer);
    if (!lpActive) return false;
    lpActive = false;
    if (v()) v().playbackRate = lpPrevRate;
    badge.classList.remove("show");
    return true;
  }

  function onUp(e) {
    if (endLongPress()) { pStart = null; return; }
    if (!pStart) return;
    const dx = e.clientX - pStart.x;
    const dy = e.clientY - pStart.y;
    const dt = Date.now() - pStart.t;
    pStart = null;
    if (Math.abs(dy) > SWIPE_MIN && Math.abs(dy) > Math.abs(dx) * 1.5) {
      if (dy < 0) enterFullscreen();
      else exitFullscreen();
      return;
    }
    if (dt > 500 || Math.abs(dx) > 20 || Math.abs(dy) > 20) return;
    handleTap(e.clientX);
  }

  function handleTap(x) {
    const zone = zoneOf(x);
    const now = Date.now();
    if (now - lastTap.t < DBL_MS && lastTap.zone === zone) {
      clearTimeout(tapTimer);
      lastTap = { t: 0, zone: "" };
      doubleTap(zone);
      return;
    }
    lastTap = { t: now, zone };
    clearTimeout(tapTimer);
    tapTimer = setTimeout(toggleControls, DBL_MS + 30);
  }

  function doubleTap(zone) {
    if (zone === "center") togglePlay();
    else seekBy(zone === "right" ? SEEK_STEP : -SEEK_STEP);
  }

  function seekBy(delta) {
    const vid = v();
    if (!vid) return;
    const dir = Math.sign(delta);
    if (dir !== lastSeekDir) seekAccum = 0;
    lastSeekDir = dir;
    seekAccum += Math.abs(delta);
    vid.currentTime = Math.max(0, Math.min(vid.duration || 1e9, vid.currentTime + delta));
    badge.textContent = dir > 0 ? `▶︎▶︎ +${seekAccum}s` : `◀︎◀︎ −${seekAccum}s`;
    badge.className = dir > 0 ? "right" : "left";
    badge.classList.add("show");
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
      badge.classList.remove("show");
      seekAccum = 0;
      lastSeekDir = 0;
    }, 800);
  }

  function togglePlay() {
    const vid = v();
    if (!vid) return;
    if (vid.paused) vid.play();
    else vid.pause();
  }

  function syncPlayIcon() {
    if (!playBtn || !video) return;
    playBtn.innerHTML = icon(video.paused ? ICONS.play : ICONS.pause);
  }

  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = h ? String(m).padStart(2, "0") : m;
    return (h ? h + ":" : "") + mm + ":" + String(sec).padStart(2, "0");
  };

  function updateTimeLabel() {
    const vid = v();
    if (!timeLabel || !vid) return;
    timeLabel.textContent = `${fmt(vid.currentTime)} / ${fmt(vid.duration)}`;
  }

  function syncSeekbar() {
    if (!controls || seeking || !controls.classList.contains("show")) return;
    const vid = v();
    if (!vid) return;
    if (vid.duration) seek.value = Math.round((vid.currentTime / vid.duration) * 1000);
    updateTimeLabel();
  }

  function toggleControls() {
    if (controls.classList.contains("show")) hideControls();
    else {
      controls.classList.add("show");
      syncSeekbar();
      syncEye();
      bump();
    }
  }
  function hideControls() {
    controls.classList.remove("show");
    syncEye();
    clearTimeout(hideTimer);
  }
  function bump() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideControls, HIDE_MS);
  }

  function enterFullscreen() {
    if (document.fullscreenElement) return;
    document.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .then(() => screen.orientation.lock("landscape"))
      .catch(() => {});
  }
  function exitFullscreen() {
    if (!document.fullscreenElement) return;
    document.exitFullscreen().catch(() => {});
  }

  function nav(dir) {
    try {
      chrome.runtime.sendMessage({ type: "axg-nav", dir });
    } catch (e) {
      console.warn("[AXG] nav failed", e);
    }
  }

  // Debug handle for driving gestures from DevTools/CDP.
  window.__axg = { handleTap, doubleTap, seekBy, togglePlay, toggleControls, enterFullscreen, exitFullscreen };

  boot();
})();
