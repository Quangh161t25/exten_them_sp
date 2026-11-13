// =========================================================================
// MODULE: SAO CHÉP SẢN PHẨM — nhúng extension/clone-tool/app.html (Shopee Clone Tool)
// Chỉ nạp giao diện khi mở tab lần đầu để side panel không chậm.
// =========================================================================

(function() {
  const getAppUrl = () => {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL("extension/clone-tool/app.html");
      }
    } catch (_) {}
    return "../clone-tool/app.html";
  };

  const iframeEl = document.getElementById("in-nang-cao-iframe");
  const btnReload = document.getElementById("btn-in-nang-cao-reload");
  if (!iframeEl) return;

  const ensureLoaded = (force = false) => {
    const appUrl = getAppUrl();
    const currentSrc = iframeEl.getAttribute("src") || iframeEl.src || "";
    if (force || !currentSrc || currentSrc === "about:blank" || !currentSrc.includes("clone-tool/app.html")) {
      const urlToSet = force ? `${appUrl}?_t=${Date.now()}` : appUrl;
      iframeEl.src = urlToSet;
      iframeEl.setAttribute("src", urlToSet);
    }
  };

  // Lắng nghe click chuyển sang tab Sao chép sản phẩm
  document.querySelectorAll('.tab-btn[data-tab="tab-in-nang-cao"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      setTimeout(() => ensureLoaded(false), 30);
    });
  });

  // Nút Tải lại giao diện
  btnReload?.addEventListener("click", () => {
    ensureLoaded(true);
  });

  // Side panel mở lại đúng tab Sao chép sản phẩm (tab đang active khi khởi động)
  const tab = document.getElementById("tab-in-nang-cao");
  if (tab && !tab.hidden) {
    ensureLoaded(false);
  }
  // Tab được mở bằng code (vd Shop Spy bấm "Sao chép"), không qua click: nạp khi tab hiện ra
  if (tab) new MutationObserver(() => { if (!tab.hidden) ensureLoaded(false); }).observe(tab, { attributes: true, attributeFilter: ["hidden"] });
})();
