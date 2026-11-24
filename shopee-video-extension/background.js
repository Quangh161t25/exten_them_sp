// Shopee Video Studio - background service worker
// Việc nặng (gọi API Shopee, upload) chạy ở các trang của extension (lib/bridge.js)
// để không phụ thuộc thời gian sống của service worker. Ở đây chỉ mở trang / chuyển link.

const pageBase = (page) => chrome.runtime.getURL(`pages/${page}.html`);

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
  const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('pages/*') });
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

chrome.action.onClicked.addListener(() => openPage('studio'));

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
