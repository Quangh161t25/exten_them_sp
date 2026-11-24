// TC Extension - background
// 1) Chạy fetch API Shopee bên trong tab shopee.vn (world MAIN) để dùng đúng cookie + header chống bot.
// 2) Tải ảnh chính + file danh sách (CSV) về thư mục Downloads/TC_<shop>/.

// ---- Hàm chạy trong trang shopee.vn (world MAIN) ----
async function fetchShopProducts(username, shopIdHint) {
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-api-source': 'pc',
    'x-requested-with': 'XMLHttpRequest',
    'x-shopee-language': 'vi'
  };
  const csrf = (document.cookie.match(/(?:^|; )csrftoken=([^;]*)/) || [])[1] || '';
  let shopId = shopIdHint ? Number(shopIdHint) : 0;
  let shopName = username || '';
  const base = await fetch('/api/v4/shop/get_shop_base_v2', {
    method: 'POST',
    credentials: 'include',
    headers: { ...headers, 'x-csrftoken': csrf },
    body: JSON.stringify(shopId ? { shopid: shopId } : { username })
  }).then((r) => r.json()).catch(() => null);
  if (base && base.data) {
    shopId = base.data.shopid || shopId;
    shopName = base.data.account?.username || base.data.name || shopName;
  }
  if (!shopId) return { error: 'Không tìm thấy shop (Shopee có thể đang chặn — tải lại trang rồi thử lại).' };

  const items = [];
  const seen = new Set();
  const LIMIT = 30;
  let total = null;
  for (let page = 0; page < 200; page++) {
    const p = new URLSearchParams({
      bundle: 'shop_page_category_tab_main',
      item_card_use_scene: 'category_product_list_popular',
      limit: String(LIMIT),
      offset: String(page * LIMIT),
      shop_id: String(shopId),
      sort_type: '1',
      upstream: 'pdp',
      version: '1'
    });
    const r = await fetch('/api/v4/shop/rcmd_items?' + p, { headers, credentials: 'include' })
      .then((x) => x.json()).catch(() => null);
    const d = (r && r.data) || {};
    if (typeof d.total === 'number') total = d.total;
    const list = d.items || [];
    let fresh = 0;
    for (const it of list) {
      const id = it.itemid || it.item_id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      fresh++;
      items.push({ itemId: String(id), name: String(it.name || '').trim(), image: it.image || '' });
    }
    if (!list.length || !fresh) break;
    if (total != null && items.length >= total) break;
    await new Promise((res) => setTimeout(res, 500));
  }
  return { shopId: String(shopId), shopName, total, items };
}

// ---- Tiện ích ----
function imageUrl(id) {
  if (!id) return '';
  return id.startsWith('http') ? id : `https://down-vn.img.susercontent.com/file/${id}`;
}
function safeName(s, max = 80) {
  return String(s || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, max)
    .trim() || 'san-pham';
}
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function setProgress(tabId, text, done = false) {
  if (tabId) chrome.tabs.sendMessage(tabId, { type: 'TC_PROGRESS', text, done }).catch(() => {});
}

// Tìm (hoặc mở ngầm) một tab shopee.vn để gọi API trong đó
async function getShopeeTab(preferId) {
  if (preferId) {
    const t = await chrome.tabs.get(preferId).catch(() => null);
    if (t && /^https:\/\/shopee\.vn\//.test(t.url || '')) return t;
  }
  const tabs = await chrome.tabs.query({ url: 'https://shopee.vn/*' });
  let tab = tabs.find((t) => t.status === 'complete' && !(t.url || '').includes('/verify/')) || tabs[0];
  if (!tab) {
    tab = await chrome.tabs.create({ url: 'https://shopee.vn/', active: false });
    await new Promise((resolve) => {
      const done = () => { chrome.tabs.onUpdated.removeListener(l); clearTimeout(timer); resolve(); };
      const l = (id, info) => { if (id === tab.id && info.status === 'complete') done(); };
      const timer = setTimeout(done, 30000);
      chrome.tabs.onUpdated.addListener(l);
    });
    await new Promise((r) => setTimeout(r, 2000)); // chờ trang Shopee khởi tạo
  }
  return tab;
}

async function fetchShop(msg, sender) {
  const tab = await getShopeeTab(msg.tabId || sender.tab?.id);
  const [inj] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: fetchShopProducts,
    args: [msg.username || '', msg.shopId || '']
  });
  const data = inj && inj.result;
  if (!data || data.error) throw new Error((data && data.error) || 'Không đọc được sản phẩm');
  if (!data.items.length) throw new Error('Shop không có sản phẩm nào (hoặc Shopee chặn — mở shopee.vn, F5 rồi thử lại).');
  return data;
}

async function downloadImages(shopName, items, onProgress) {
  const folder = 'TC_' + safeName(shopName, 50);
  let ok = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const url = imageUrl(it.image);
    if (!url) continue;
    onProgress && onProgress(`Đang tải ảnh ${i + 1}/${items.length}...`);
    const stt = String(it.stt || i + 1).padStart(3, '0');
    try {
      await chrome.downloads.download({ url, filename: `${folder}/${stt}_${safeName(it.name)}.jpg`, conflictAction: 'overwrite', saveAs: false });
      ok++;
    } catch (e) { console.warn('Lỗi tải ảnh', it.name, e); }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { ok, folder };
}

const PANEL = chrome.runtime.getURL('panel.html');

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // Trang danh sách: đọc toàn bộ SP của shop
  if (msg?.type === 'TC_FETCH_SHOP') {
    fetchShop(msg, sender).then((data) => reply({ ok: true, data })).catch((e) => reply({ ok: false, error: e.message }));
    return true;
  }
  // Trang danh sách: tải ảnh chính của các SP đã chọn
  if (msg?.type === 'TC_DOWNLOAD_IMAGES') {
    downloadImages(msg.shopName, msg.items || []).then((r) => reply({ ok: r.ok, folder: r.folder })).catch((e) => reply({ ok: 0, error: e.message }));
    return true;
  }
  // Nút trên trang shop: mở trang danh sách của shop đó
  if (msg?.type === 'TC_OPEN_PANEL') {
    chrome.tabs.create({ url: PANEL + '?shop=' + encodeURIComponent(msg.url || '') });
    reply({ ok: true });
    return false;
  }
  return false;
});

// Bấm icon extension: mở trang danh sách (tự điền link shop nếu tab đang mở là trang shop)
chrome.action.onClicked.addListener((tab) => {
  const url = tab && tab.url || '';
  const isShop = /^https:\/\/shopee\.vn\/(shop\/\d+|[\w.\-]+\/?)(\?|$)/.test(url) && !/-i\.\d+\.\d+/.test(url);
  chrome.tabs.create({ url: PANEL + (isShop ? '?shop=' + encodeURIComponent(url) : '') });
});

// ===== Hàng đợi tố cáo: mở lần lượt từng SP đã chọn, tự động gửi (hoặc người dùng bấm Gửi).
// Khi gửi xong (hoặc Bỏ qua) trên trang SP -> mở SP tiếp theo trong cùng tab.
const QKEY = 'tcReportQueue';
const productUrl = (shopId, itemId) => `https://shopee.vn/product/${shopId}/${itemId}?tc_report=1&tc_q=1`;

async function openQueueItem(q) {
  const it = q.items[q.index];
  if (!it) {
    await chrome.storage.local.remove(QKEY);
    return null;
  }
  const url = productUrl(q.shopId, it.itemId);
  let tab = q.tabId ? await chrome.tabs.get(q.tabId).catch(() => null) : null;
  if (tab) await chrome.tabs.update(tab.id, { url, active: true });
  else tab = await chrome.tabs.create({ url, active: true });
  q.tabId = tab.id;
  await chrome.storage.local.set({ [QKEY]: q });
  return q;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'TC_QUEUE_START') {
    const q = { shopId: msg.shopId, items: msg.items || [], index: 0, done: 0, skipped: 0, tabId: null };
    openQueueItem(q).then(() => reply({ ok: true }));
    return true;
  }
  if (msg?.type === 'TC_QUEUE_STATUS') {
    chrome.storage.local.get(QKEY).then((r) => {
      const q = r[QKEY];
      const mine = q && sender.tab && q.tabId === sender.tab.id;
      reply(mine ? { active: true, pos: q.index + 1, total: q.items.length, done: q.done || 0, skipped: q.skipped || 0, name: q.items[q.index]?.name } : { active: false });
    });
    return true;
  }
  if (msg?.type === 'TC_QUEUE_NEXT' || msg?.type === 'TC_QUEUE_STOP') {
    chrome.storage.local.get(QKEY).then(async (r) => {
      const q = r[QKEY];
      if (!q || !sender.tab || q.tabId !== sender.tab.id) return reply({ ok: false });
      if (msg.type === 'TC_QUEUE_STOP') {
        await chrome.storage.local.remove(QKEY);
        return reply({ ok: true, finished: true, done: q.done, skipped: q.skipped });
      }
      msg.skipped ? q.skipped++ : q.done++;
      q.index++;
      if (q.index >= q.items.length) {
        await chrome.storage.local.remove(QKEY);
        return reply({ ok: true, finished: true, done: q.done, skipped: q.skipped });
      }
      await openQueueItem(q);
      reply({ ok: true });
    });
    return true;
  }
  return false;
});
