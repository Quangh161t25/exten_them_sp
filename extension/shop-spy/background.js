// Shop Spy (gộp từ shop-spy-extension) — nạp bằng importScripts trong extension/background.js
(() => {
// Shop Spy - background service worker
// Mọi request tới API Shopee được chạy bên trong một tab shopee.vn (world MAIN),
// để dùng đúng cookie + header chống bot mà trang Shopee tự gắn vào fetch.

const SHOPEE = 'https://shopee.vn';

async function findShopeeTab() {
  const tabs = await chrome.tabs.query({ url: SHOPEE + '/*' });
  return tabs.find((t) => t.status === 'complete' && !t.url.includes('/verify/')) || tabs[0] || null;
}

function waitTabComplete(tabId, timeout = 30000) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeout);
    function done() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') done();
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => t.status === 'complete' && done()).catch(done);
  });
}

async function getShopeeTab() {
  let tab = await findShopeeTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url: SHOPEE, active: false });
    await waitTabComplete(tab.id);
    await new Promise((r) => setTimeout(r, 2000)); // chờ SDK của Shopee khởi tạo
  } else if (tab.status !== 'complete') {
    await waitTabComplete(tab.id);
  }
  return tab;
}

// Hàm này được inject vào trang shopee.vn (world MAIN)
async function pageFetch(url, method, body) {
  const getCsrf = () => {
    const m = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
    return m ? m[1] : '';
  };
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-api-source': 'pc',
    'x-requested-with': 'XMLHttpRequest',
    'x-shopee-language': 'vi',
  };
  const opts = { method, headers, credentials: 'include' };
  if (method === 'POST') {
    opts.body = JSON.stringify(body || {});
    const csrf = getCsrf();
    if (csrf) headers['x-csrftoken'] = csrf;
  }
  // Dùng XMLHttpRequest: Shopee tự gắn chữ ký chống bot cho XHR, còn fetch tự gọi hay bị chặn (lỗi 90309999)
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    x.withCredentials = true;
    for (const [k, v] of Object.entries(headers)) { try { x.setRequestHeader(k, v); } catch (e) { /* header bị trình duyệt chặn */ } }
    x.timeout = 30000;
    x.onload = () => {
      try { resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, data: JSON.parse(x.responseText) }); }
      catch (e) { resolve({ ok: false, status: x.status, error: 'INVALID_JSON' }); }
    };
    x.onerror = () => resolve({ ok: false, status: 0, error: 'NETWORK_ERROR' });
    x.ontimeout = () => resolve({ ok: false, status: 0, error: 'TIMEOUT' });
    x.send(opts.body ?? null);
  });
}

async function shopeeRequest({ url, method = 'GET', body = null }) {
  const tab = await getShopeeTab();
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: pageFetch,
    args: [url, method, body],
  });
  return result ? result.result : { ok: false, error: 'NO_RESULT' };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'SHOPEE_REQUEST') {
    shopeeRequest(msg.payload)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true;
  }
  // Tải vào Google Sheet SHOP_SPY (cùng file sheet của extension): khóa = cột ID, dùng upsertSheetRows của extension/background.js
  if (msg && msg.type === 'SPY_TO_SHEET') {
    (async () => {
      const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
      const title = await ensureSheetExists('SHOP_SPY', token, sheetId);
      const q = `'${String(title).replace(/'/g, "''")}'`;
      const [head = []] = await fetchSheetValues(`${q}!1:1`, token, 30000, sheetId);
      if (!head.length) {
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${q}!A1`)}?valueInputOption=RAW`, {
          method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [msg.header] })
        });
        if (!res.ok) throw new Error(data?.error?.message || 'Không ghi được tiêu đề SHOP_SPY');
      }
      // Bỏ cột "Cập nhật lúc" khi so sánh, để sản phẩm không đổi không bị ghi lại
      const rows = msg.rows || [];
      const r = await upsertSheetRows(title, rows, (row) => String(row[0] || ''), token, sheetId, [msg.header.length - 1]);
      return { ok: true, sheetTitle: title, ...r };
    })().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true;
  }
  // Đọc lại sheet SHOP_SPY (tab "Đọc từ Sheet")
  if (msg && msg.type === 'SPY_READ_SHEET') {
    (async () => {
      const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
      const values = await fetchSheetValues("'SHOP_SPY'!A:AF", token, 60000, sheetId).catch(() => []);
      return { ok: true, values };
    })().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true;
  }
  if (msg && msg.type === 'OPEN_SPY') {
    const q = new URLSearchParams(msg.query || {}).toString();
    chrome.tabs.create({ url: chrome.runtime.getURL('extension/shop-spy/spy.html') + (q ? '?' + q : '') });
    sendResponse({ ok: true });
  }
  return false;
});


// ---------- Tự quét lại các shop đã tích theo khung giờ (spy_auto: { enabled, times, shops, done }) ----------
const AUTO_KEY = 'spy_auto';
// Hàng đợi lưu trong storage (service worker có thể bị Chrome tắt giữa chừng): mỗi phút xử lý 1 bước
async function autoTick() {
  const cfg = (await chrome.storage.local.get(AUTO_KEY))[AUTO_KEY];
  if (!cfg?.enabled) return;
  const save = (patch) => chrome.storage.local.set({ [AUTO_KEY]: { ...cfg, ...patch } });
  // Đang quét 1 shop: chờ tab đó tự đóng (tối đa 16 phút)
  if (cfg.activeTab) {
    const alive = await chrome.tabs.get(cfg.activeTab).then(() => true, () => false);
    if (alive && Date.now() - (cfg.activeAt || 0) < 16 * 60e3) return;
    if (alive) await chrome.tabs.remove(cfg.activeTab).catch(() => {});
    cfg.activeTab = null;
  }
  let queue = cfg.queue || [];
  if (!queue.length) {
    // Khung giờ đã tới hôm nay mà chưa chạy (chạy bù nếu lúc đó Chrome tắt)
    const now = new Date(), done = cfg.done || {};
    const dueTime = (cfg.times || []).find((t) => {
      const [h, m] = t.split(':').map(Number);
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
      return now.getTime() >= at && (done[t] || 0) < at;
    });
    if (!dueTime || !cfg.shops?.length) {
      if (cfg.queueStarted && !cfg.activeTab) await save({ activeTab: null, queueStarted: false, lastRun: Date.now() });
      return;
    }
    queue = [...cfg.shops];
    cfg.done = { ...done, [dueTime]: Date.now() };
    cfg.queueStarted = true;
  }
  const shopId = queue.shift();
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('extension/shop-spy/spy.html') + '?auto=1&shopId=' + encodeURIComponent(shopId), active: false });
  await save({ queue, activeTab: tab.id, activeAt: Date.now() });
}
chrome.alarms.get('spy-auto', (a) => { if (!a) chrome.alarms.create('spy-auto', { periodInMinutes: 1 }); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'spy-auto') autoTick(); });
chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === 'SPY_AUTO_SCHEDULE') autoTick(); return false; });

})();
