// Sao chép sản phẩm (Shopee Clone Tool) – phần chạy ngầm, nạp bằng importScripts từ extension/background.js.
// Script thường (không import/export) nên không cần build. Bọc trong IIFE để không lộ biến ra ngoài.
// Side panel do extension chính quản lý (tab "Sao chép sản phẩm" nhúng extension/clone-tool/app.html).
(() => {
  // Tải ảnh Gemini / ChatGPT đã tạo và lưu làm ảnh bìa mới cho sản phẩm vừa gửi sang AI.
  async function fetchImageAsDataUrl(url) {
    const candidates = [url.replace(/=s\d+(-[\w-]+)?$/, '=s0'), url].filter((u, i, a) => a.indexOf(u) === i);
    let lastErr = '';
    for (const u of candidates) {
      // Ưu tiên 'omit' để không bị lỗi CORS wildcard khi tải từ CDN OpenAI (files.oaiusercontent.com)
      // Nếu không được thì thử 'include' (cần thiết cho cookie Google Gemini)
      const credModes = ['omit', 'include'];
      for (const cred of credModes) {
        try {
          const r = await fetch(u, { credentials: cred });
          const type = (r.headers.get('content-type') || '').split(';')[0];
          if (r.ok && (type.startsWith('image/') || type === 'application/octet-stream' || !type)) {
            const buf = new Uint8Array(await r.arrayBuffer());
            let bin = '';
            for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
            const mime = type.startsWith('image/') ? type : 'image/png';
            return { dataUrl: `data:${mime};base64,${btoa(bin)}`, size: buf.length };
          }
          lastErr = `HTTP ${r.status} ${type}`;
        } catch (e) {
          lastErr = String((e && e.message) || e);
        }
      }
    }
    throw new Error(lastErr || 'fetch failed');
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Trang AI hỏi tab id của chính nó (để chỉ nhận lệnh dành cho mình)
    if (msg && msg.type === 'sclWhoAmI') {
      sendResponse({ tabId: sender.tab ? sender.tab.id : null });
      return;
    }
    if (msg && msg.type === 'sclFetchImageDataUrl' && msg.url) {
      (async () => {
        try {
          const { dataUrl } = await fetchImageAsDataUrl(msg.url);
          sendResponse({ ok: true, dataUrl });
        } catch (e) {
          sendResponse({ ok: false, error: String((e && e.message) || e) });
        }
      })();
      return true;
    }
    if (msg && msg.type === 'sclCaptureTab') {
      const winId = sender && sender.tab ? sender.tab.windowId : undefined;
      chrome.tabs.captureVisibleTab(winId, { format: 'png' })
        .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
        .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
      return true;
    }
    if (!msg || msg.type !== 'sclFetchImage' || !msg.url) return;
    (async () => {
      try {
        const { dataUrl, size } = await fetchImageAsDataUrl(msg.url);
        const { aiLastProductId } = await chrome.storage.local.get('aiLastProductId');
        await chrome.storage.local.set({
          aiCoverImage: { dataUrl, timestamp: Date.now(), source: msg.source || 'ai', productId: aiLastProductId || '' }
        });
        sendResponse({ ok: true, size });
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  });
})();
