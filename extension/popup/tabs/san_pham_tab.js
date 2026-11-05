// =========================================================================
// MODULE: SẢN PHẨM — mở mục Sản phẩm của extension/flash-sale/app.html
// =========================================================================

(function() {
  const APP_URL = chrome.runtime.getURL("extension/flash-sale/app.html?view=products");
  const tab = document.getElementById("tab-san-pham");
  const iframeEl = document.getElementById("san-pham-iframe");
  const statusEl = document.getElementById("san-pham-status");
  if (!tab || !iframeEl) return;

  const ensureLoaded = () => {
    if (!tab.hidden && !iframeEl.getAttribute("src")) iframeEl.setAttribute("src", APP_URL);
  };

  document.getElementById("btn-san-pham-open")?.addEventListener("click", () => {
    window.openSellerHub("fs-products").catch((err) => {
      if (statusEl) statusEl.textContent = "❌ " + err.message;
    });
  });

  document.getElementById("btn-san-pham-reload")?.addEventListener("click", () => {
    if (iframeEl.getAttribute("src")) iframeEl.setAttribute("src", APP_URL);
    else ensureLoaded();
  });

  // Chỉ nạp khi tab hiện ra, kể cả khi popup tự mở lại tab dùng lần trước
  new MutationObserver(ensureLoaded).observe(tab, { attributes: true, attributeFilter: ["hidden"] });
  ensureLoaded();
})();
