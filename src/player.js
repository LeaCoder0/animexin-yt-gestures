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
  const NATIVE_STRIP = 56;  // bottom px left for the native seekbar
  const TOP_GAP = 48;       // top px left free in fullscreen so pulling down the
                            // notification shade never reads as a swipe-down
  const LONG_MS = 500;      // hold time before 2x speed kicks in
  const LONG_RATE = 2;

  let video, overlay, topgap, controls, playBtn, eyeBtn, badge, seek, timeLabel, seeking = false;
  let seekAccum = 0, seekTimer = null, lastSeekDir = 0;
  let lastTap = { t: 0, zone: "" };
  let tapTimer = null, hideTimer = null, pStart = null;
  let lpTimer = null, lpActive = false, lpPrevRate = 1;

  const v = () => (video = document.querySelector("video") || video);

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

  function boot() {
    if (!document.body) return void setTimeout(boot, 300);
    if (!document.querySelector("video")) {
      // Click-to-play mirrors (Rumble, Dood, ...) create the <video> lazily —
      // wait for it without polling.
      const mo = new MutationObserver(() => {
        if (document.querySelector("video")) {
          mo.disconnect();
          boot();
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      return;
    }
    v();
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
    if (!vid.duration || vid.seeking) return;
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
    " .vjs-big-play-button, button[aria-label*='play' i], button[title*='play' i]";

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

    // Show/hide toggle, pinned top-right of the player. Lives outside
    // #axg-controls so it stays reachable while the controls are hidden.
    eyeBtn = document.createElement("button");
    eyeBtn.type = "button";
    eyeBtn.id = "axg-eye";
    eyeBtn.addEventListener("click", toggleControls);
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

    v().addEventListener("play", syncPlayIcon);
    v().addEventListener("pause", syncPlayIcon);
    v().addEventListener("timeupdate", syncSeekbar);
    v().addEventListener("timeupdate", savePos);
    syncPlayIcon();
    syncSeekbar();

    overlay.addEventListener("pointerdown", onDown);
    overlay.addEventListener("pointerup", onUp);
    overlay.addEventListener("pointermove", onMove);
    overlay.addEventListener("pointercancel", () => { endLongPress(); pStart = null; });
    // Long-press must mean 2x speed, not the context menu (Video ID / Ad console).
    document.addEventListener("contextmenu", (e) => {
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
  }

  function syncChrome() {
    const fs = !!document.fullscreenElement;
    if (topgap) topgap.style.display = fs ? "block" : "none";
    // Keep the eye out of the dead zone, which is stacked above the overlay and
    // would otherwise swallow taps meant for it.
    if (eyeBtn) eyeBtn.style.top = (fs ? TOP_GAP + 8 : 8) + "px";
  }

  function syncEye() {
    if (eyeBtn)
      eyeBtn.innerHTML = icon(controls.classList.contains("show") ? ICONS.eyeOff : ICONS.eye);
  }

  const zoneOf = (x) => {
    const w = overlay.clientWidth;
    return x < w / 3 ? "left" : x > (2 * w) / 3 ? "right" : "center";
  };

  function onDown(e) {
    gestureKick();
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
    v().playbackRate = lpPrevRate;
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
    const dir = Math.sign(delta);
    if (dir !== lastSeekDir) seekAccum = 0;
    lastSeekDir = dir;
    seekAccum += Math.abs(delta);
    const vid = v();
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
    if (vid.paused) vid.play();
    else vid.pause();
  }

  function syncPlayIcon() {
    playBtn.innerHTML = icon(v().paused ? ICONS.play : ICONS.pause);
  }

  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = h ? String(m).padStart(2, "0") : m;
    return (h ? h + ":" : "") + mm + ":" + String(sec).padStart(2, "0");
  };

  function updateTimeLabel() {
    const vid = v();
    timeLabel.textContent = `${fmt(vid.currentTime)} / ${fmt(vid.duration)}`;
  }

  function syncSeekbar() {
    if (seeking || !controls.classList.contains("show")) return;
    const vid = v();
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
