// =========================================================================
// MODULE: SHOP SPY + VIDEO STUDIO — gộp từ shop-spy-extension và shopee-video-extension
// Mỗi tab nhúng giao diện gốc (iframe) và có nút mở trang đầy đủ ở tab riêng.
// =========================================================================

(function() {
  const MODULES = [
    { tab: "tab-shop-spy", frame: "shop-spy-iframe", url: "extension/shop-spy/spy.html",
      open: [["btn-shop-spy-open", "extension/shop-spy/spy.html"]] },
    { tab: "tab-video-studio", frame: "video-studio-iframe", url: "extension/video-studio/pages/studio.html",
      open: [["btn-video-studio-open", "extension/video-studio/pages/studio.html"],
             ["btn-video-download-open", "extension/video-studio/pages/download.html"],
             ["btn-video-dashboard-open", "extension/video-studio/pages/dashboard.html"]] },
    { tab: "tab-clone-schedule", frame: "clone-schedule-iframe", url: "extension/clone-schedule/app.html",
      open: [["btn-clone-schedule-open", "extension/clone-schedule/app.html"]] },
    { tab: "tab-seller-auto", frame: "seller-auto-iframe", url: "extension/seller-auto/pages/app.html",
      open: [["btn-seller-auto-open", "extension/seller-auto/pages/app.html"]] }
  ];
  for (const m of MODULES) {
    const tab = document.getElementById(m.tab), frame = document.getElementById(m.frame);
    if (!tab || !frame) continue;
    const ensureLoaded = () => { if (!tab.hidden && !frame.getAttribute("src")) frame.setAttribute("src", chrome.runtime.getURL(m.url)); };
    for (const [id, page] of m.open) {
      document.getElementById(id)?.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL(page) }));
    }
    // Chỉ nạp khi tab hiện ra
    new MutationObserver(ensureLoaded).observe(tab, { attributes: true, attributeFilter: ["hidden"] });
    ensureLoaded();
  }
})();
