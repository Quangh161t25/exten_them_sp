// Shopee Video Studio (gộp từ shopee-video-extension) — nạp bằng importScripts trong extension/background.js
(() => {
// Shopee Video Studio - background service worker
// Việc nặng (gọi API Shopee, upload) chạy ở các trang của extension (lib/bridge.js)
// để không phụ thuộc thời gian sống của service worker. Ở đây chỉ mở trang / chuyển link.

const pageBase = (page) => chrome.runtime.getURL(`extension/video-studio/pages/${page}.html`);

function openPage(page, query) {
  const q = new URLSearchParams(query || {}).toString();
  return chrome.tabs.create({ url: pageBase(page) + (q ? '?' + q : '') });
}

async function focus(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}

/** Đưa link sản phẩm vào module "Tải video": ưu tiên tab Tổng hợp, rồi tab Tải video, không có thì mở Tổng hợp */
async function addLink(link) {
  const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('extension/video-studio/pages/*') });
  const studio = tabs.find((t) => t.url.startsWith(pageBase('studio')));
  const download = tabs.find((t) => t.url.startsWith(pageBase('download')));
  const target = studio || download;
  if (target) {
    await chrome.runtime.sendMessage({ type: 'SVX_LOAD_LINK', tabId: target.id, link }).catch(() => {});
    await focus(target);
    return;
  }
  await openPage('studio', { link });
}

// ---- Hẹn giờ đăng video: mỗi phút xem lịch (svx_auto_jobs); có lịch tới giờ mà chưa mở trang Hẹn giờ thì mở ngầm ----
const AUTO_ALARM = 'svx_auto_tick';
chrome.alarms.get(AUTO_ALARM).then((a) => { if (!a) chrome.alarms.create(AUTO_ALARM, { periodInMinutes: 1 }); });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== AUTO_ALARM) return;
  const jobs = (await chrome.storage.local.get('svx_auto_jobs')).svx_auto_jobs || [];
  const now = Date.now();
  // Lịch kẹt ở "Đang chạy" quá 30 phút (trang bị đóng giữa chừng) → báo lỗi để đặt lại
  let changed = false;
  for (const j of jobs) {
    if (j.status === 'run' && now - (j.updatedAt || j.at) > 30 * 60e3) { j.status = 'err'; j.result = 'Bị gián đoạn (trang đóng giữa chừng) — bấm ↺ để chạy lại'; changed = true; }
  }
  if (changed) await chrome.storage.local.set({ svx_auto_jobs: jobs });
  if (!jobs.some((j) => j.status === 'wait' && j.at <= now)) return;
  const open = await chrome.tabs.query({ url: pageBase('auto') + '*' });
  if (open.length) return; // trang đang mở tự chạy mỗi phút
  chrome.tabs.create({ url: pageBase('auto') + '?runner=1', active: false });
});

// Extension chính dùng popup riêng: mở Video Studio từ tab "Video Studio" trong popup

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'SVX_OPEN') {
    openPage(msg.page || 'studio', msg.query).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg && msg.type === 'SVX_ADD_LINK' && msg.link) {
    addLink(msg.link).then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});

})();
