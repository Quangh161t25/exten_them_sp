// =========================================================================
// MODULE: FLASH SALE TOOL — mở trang quản lý extension/flash-sale/app.html
// =========================================================================

(function() {
  // Sản phẩm đã là module riêng nên Flash Sale trong popup không hiện mục này nữa
  const APP_URL = chrome.runtime.getURL("extension/flash-sale/app.html?hideProducts=1");
  const btnOpen = document.getElementById("btn-fs-tool-open");
  const btnReload = document.getElementById("btn-fs-tool-reload");
  const iframeEl = document.getElementById("fs-tool-iframe");
  const statusEl = document.getElementById("fs-tool-status");

  // Mở trang chung Seller Hub tại mục Danh sách Flash Sale
  function openApp() {
    return window.openSellerHub("fs-list");
  }

  const ensureLoaded = () => {
    if (iframeEl && !iframeEl.getAttribute("src")) iframeEl.setAttribute("src", APP_URL);
  };

  function reloadIframe() {
    if (iframeEl) {
      if (!iframeEl.getAttribute("src")) {
        ensureLoaded();
      } else {
        try {
          iframeEl.contentWindow?.location?.reload();
        } catch (e) {
          iframeEl.src = APP_URL;
        }
      }
    }
  }

  async function renderStatus() {
    if (!statusEl) return;
    const { fs_settings, fs_rules, fs_logs } = await chrome.storage.local.get(["fs_settings", "fs_rules", "fs_logs"]);
    const settings = { autoEnabled: true, intervalMinutes: 60, ...(fs_settings || {}) };
    const rules = Array.isArray(fs_rules) ? fs_rules : [];
    const enabled = rules.filter(r => r.enabled).length;
    const lastLog = Array.isArray(fs_logs) && fs_logs.length ? fs_logs[fs_logs.length - 1] : null;

    const autoText = settings.autoEnabled && enabled > 0
      ? `<b style="color:#15803d;">Đang bật</b> — ${enabled}/${rules.length} mẫu, chạy mỗi ${Math.max(15, Number(settings.intervalMinutes) || 60)} phút`
      : `<b style="color:#64748b;">Đang tắt</b> (${rules.length} mẫu, ${enabled} mẫu bật)`;

    statusEl.innerHTML = "";
    const autoLine = document.createElement("div");
    autoLine.innerHTML = `⏱ Tự động đăng ký: ${autoText}`;
    statusEl.appendChild(autoLine);

    if (lastLog) {
      const logLine = document.createElement("div");
      logLine.style.color = lastLog.level === "error" ? "#dc2626" : "#475569";
      logLine.textContent = `📝 ${new Date(lastLog.time).toLocaleString("vi-VN")}: ${lastLog.message}`;
      statusEl.appendChild(logLine);
    }
  }

  btnOpen?.addEventListener("click", () => {
    openApp().catch(err => { if (statusEl) statusEl.textContent = "❌ " + err.message; });
  });

  btnReload?.addEventListener("click", () => {
    reloadIframe();
  });

  document.querySelectorAll('.tab-btn[data-tab="tab-fs-tool"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureLoaded();
      renderStatus().catch(() => {});
    });
  });

  // Nếu mở side panel mà tab Flash Sale đang active thì nạp iframe
  const tab = document.getElementById("tab-fs-tool");
  if (tab && !tab.hidden) ensureLoaded();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.fs_settings || changes.fs_rules || changes.fs_logs)) renderStatus();
  });

  renderStatus().catch(() => {});
})();
