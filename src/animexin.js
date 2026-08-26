// Top-frame script on animexin.dev: resolves the real prev/next episode URLs.
(() => {
  if (window.__axgTopInit) return;
  window.__axgTopInit = true;

  function getNav() {
    const rel = (r) => document.querySelector(`a[rel="${r}"]`)?.href || null;
    // Fallback: derive from the episode number in the URL slug.
    const m = location.pathname.match(/episode-(\d+)/);
    const mk = (n) =>
      n > 0 ? location.origin + location.pathname.replace(/episode-\d+/, `episode-${n}`) : null;
    return {
      prev: rel("prev") || (m ? mk(+m[1] - 1) : null),
      next: rel("next") || (m ? mk(+m[1] + 1) : null),
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "axg-getnav") {
      sendResponse(getNav());
      return;
    }
    if (msg?.type === "axg-gonav") {
      const url = getNav()[msg.dir];
      if (url) softNav(url);
      sendResponse({ ok: !!url });
    }
  });

  // Episode navigation without a page load: fetch the target episode and swap
  // the main column in place. The player iframe is recreated, so the gesture
  // layer re-injects itself into it, and the mirror's server dropdown keeps
  // working because its handler is an inline onchange="loadMi(this)" attribute
  // calling a function that already lives on the page. Scripts parsed by
  // DOMParser are inert, so nothing re-runs on insert.
  let navigating = false;

  // Episode-bound <head> metadata. Only .postbody is swapped, so these would
  // otherwise keep describing whichever episode was loaded from the network —
  // share sheets and bookmarks read them.
  const META = [
    ['link[rel="canonical"]', "href"],
    ['meta[property="og:title"]', "content"],
    ['meta[property="og:url"]', "content"],
    ['meta[property="og:image"]', "content"],
    ['meta[property="og:description"]', "content"],
    ['meta[name="description"]', "content"],
    ['meta[name="twitter:title"]', "content"],
    ['meta[name="twitter:image"]', "content"],
  ];

  function syncMeta(doc) {
    for (const [sel, attr] of META) {
      const from = doc.querySelector(sel);
      const to = document.querySelector(sel);
      if (from && to) to.setAttribute(attr, from.getAttribute(attr));
    }
  }

  async function softNav(url, push = true) {
    if (navigating) return;
    navigating = true;
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const fresh = doc.querySelector(".postbody");
      const here = document.querySelector(".postbody");
      if (!fresh || !here) throw new Error("no .postbody in response");
      here.replaceWith(fresh);
      document.title = doc.title;
      syncMeta(doc);
      if (push) history.pushState({ axg: 1 }, "", url);
      scrollTo(0, 0);
      ytLayout();
      collapsibleEpisodes();
      console.log("[AXG] switched episode in place:", url);
    } catch (e) {
      // Never leave the user stranded: fall back to the full load we replaced.
      console.warn("[AXG] in-place switch failed, loading normally", e);
      location.href = url;
    } finally {
      navigating = false;
    }
  }

  // Back/forward should swap in place too rather than reload.
  addEventListener("popstate", () => softNav(location.href, false));

  // YouTube-style layout: video first, title below it, only series-related
  // sections kept (server select, prev/next, series info, related episodes).
  function ytLayout() {
    const hide = (el) => el && (el.style.display = "none");

    // Title (.item.meta) currently sits above the player — move it below.
    const mve = document.querySelector(".mvelement");
    const meta = mve?.querySelector(".item.meta");
    const vid = mve?.querySelector(".video-content");
    if (meta && vid) vid.after(meta);

    // Site chrome and noise.
    document
      .querySelectorAll(".announ, .container.schedule, .pd-expand, .ts-breadcrumb, #sidebar, #footer")
      .forEach(hide);
    // Download links block.
    hide(document.querySelector(".entry-content"));

    // Whitelist the article boxes: series info + related episodes stay.
    document.querySelectorAll(".postbody .bixbox").forEach((b) => {
      if (b.closest(".mvelement") || b.closest(".entry-content")) return;
      if (b.classList.contains("single-info")) return;
      const head = (b.querySelector("h1,h2,h3,.releases")?.textContent || "").toLowerCase();
      if (head.includes("related episode")) return;
      hide(b); // recommended series, comments, anything else
    });

    // Sidebar is gone — let the main column use the full width.
    const pb = document.querySelector(".postbody");
    if (pb) {
      pb.style.width = "100%";
      pb.style.float = "none";
    }
  }

  // The episode list starts collapsed (animexin.css); tapping its header opens
  // it. Late-rendered lists are picked up too, since the site re-renders this
  // block when a different server is selected.
  function collapsibleEpisodes(root = document) {
    for (const head of root.querySelectorAll(".headlist")) {
      if (head.dataset.axgToggle) continue;
      head.dataset.axgToggle = "1";
      head.addEventListener("click", (e) => {
        e.preventDefault(); // the header wraps a link to the series page
        head.classList.toggle("axg-open");
      });
    }
  }

  ytLayout();
  collapsibleEpisodes();
  new MutationObserver(() => collapsibleEpisodes()).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
