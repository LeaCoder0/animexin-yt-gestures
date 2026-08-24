// Routes prev/next requests from the player iframe to the animexin top frame,
// then navigates the tab to the resolved episode URL.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "axg-nav" || !sender.tab?.id) return;
  chrome.tabs.sendMessage(sender.tab.id, { type: "axg-getnav" }, { frameId: 0 }, (nav) => {
    if (chrome.runtime.lastError || !nav) return;
    const url = msg.dir === "next" ? nav.next : nav.prev;
    if (url) chrome.tabs.update(sender.tab.id, { url });
  });
  sendResponse({ ok: true });
});
