// Routes prev/next requests from the player iframe to the animexin top frame,
// which resolves the adjacent episode and swaps it in without a page load. The
// top frame falls back to a normal navigation itself if that fails, so the
// worst case is the full reload this replaced.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "axg-nav" || !sender.tab?.id) return;
  chrome.tabs.sendMessage(sender.tab.id, { type: "axg-gonav", dir: msg.dir }, { frameId: 0 });
  sendResponse({ ok: true });
});
