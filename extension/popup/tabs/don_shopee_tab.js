// =========================================================================
// MODULE: ĐƠN SHOPEE — mở extension/order-tool/app.html (giống mục Đơn Shopee của Seller Hub)
// =========================================================================

(function() {
  const APP_URL = chrome.runtime.getURL("extension/order-tool/app.html");
  const tab = document.getElementById("tab-don-shopee");
  const iframeEl = document.getElementById("don-shopee-iframe");
  const statusEl = document.getElementById("don-shopee-status");
  if (!tab || !iframeEl) return;

  const ensureLoaded = () => {
    if (!tab.hidden && !iframeEl.getAttribute("src")) iframeEl.setAttribute("src", APP_URL);
  };

  document.getElementById("btn-don-shopee-open")?.addEventListener("click", () => {
    window.openSellerHub("order-shopee").catch((err) => {
      if (statusEl) statusEl.textContent = "❌ " + err.message;
    });
  });

  document.getElementById("btn-don-shopee-reload")?.addEventListener("click", () => {
    if (iframeEl.getAttribute("src")) iframeEl.setAttribute("src", APP_URL);
    else ensureLoaded();
  });

  // Chỉ nạp khi tab hiện ra, kể cả khi popup tự mở lại tab dùng lần trước
  new MutationObserver(ensureLoaded).observe(tab, { attributes: true, attributeFilter: ["hidden"] });
  ensureLoaded();
})();
