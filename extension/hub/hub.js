// Trang chung: thanh bên trái + mỗi tool một iframe (nạp 1 lần, giữ nguyên khi chuyển mục)
const MODULES = {
  'fs-products': { frame: 'fs', fsTab: 'products' },
  'fs-list': { frame: 'fs', fsTab: 'list' },
  'fs-editor': { frame: 'fs', fsTab: 'editor' },
  'fs-auto': { frame: 'fs', fsTab: 'auto' },
  'fs-logs': { frame: 'fs', fsTab: 'logs' },
  'order-shopee': { frame: 'orders' },
  'hh-api': { frame: 'hhApi' },
  'order-wml': { frame: 'wmlOrders' },
  'product-wml': { frame: 'wmlProducts' }
};
const FRAMES = {
  fs: '../flash-sale/app.html',
  orders: '../order-tool/app.html',
  hhApi: '../hh-api/app.html',
  wmlOrders: '../order-tool/wameli.html?kind=orders',
  wmlProducts: '../order-tool/wameli.html?kind=products'
};
const LAST_KEY = 'hubLastModule';
const frames = {};
let current = '';

function getFrame(name) {
  if (!frames[name]) {
    const f = document.createElement('iframe');
    f.src = FRAMES[name];
    f.dataset.frame = name;
    document.getElementById('frames').appendChild(f);
    frames[name] = f;
  }
  return frames[name];
}

function highlight(m) {
  document.querySelectorAll('.item').forEach((b) => b.classList.toggle('active', b.dataset.m === m));
}

function open(m) {
  const mod = MODULES[m] || MODULES['order-shopee'];
  if (!MODULES[m]) m = 'order-shopee';
  current = m;
  const f = getFrame(mod.frame);
  Object.values(frames).forEach((x) => x.classList.toggle('hidden', x !== f));
  if (mod.fsTab) {
    const send = () => f.contentWindow.postMessage({ type: 'HUB_SHOW_FS_TAB', tab: mod.fsTab }, '*');
    if (f.dataset.ready) send();
    else f.addEventListener('load', () => { f.dataset.ready = '1'; send(); }, { once: true });
  }
  highlight(m);
  history.replaceState(null, '', '?m=' + m);
  chrome.storage.local.set({ [LAST_KEY]: m }).catch(() => {});
}

document.getElementById('menu').addEventListener('click', (e) => {
  const b = e.target.closest('.item');
  if (b) open(b.dataset.m);
});

// Flash Sale tự chuyển tab (VD bấm "Nhân bản" -> Tạo / Sửa): cập nhật thanh bên
window.addEventListener('message', (e) => {
  if (!frames.fs || e.source !== frames.fs.contentWindow || !e.data || e.data.type !== 'HUB_FS_TAB') return;
  const m = 'fs-' + e.data.tab;
  if (MODULES[m] && MODULES[current]?.frame === 'fs') {
    current = m;
    highlight(m);
    history.replaceState(null, '', '?m=' + m);
  }
});

// Mục mở đầu: theo ?m=..., không có thì mục dùng lần trước
(async () => {
  const fromUrl = new URLSearchParams(location.search).get('m');
  let last = '';
  try { last = (await chrome.storage.local.get(LAST_KEY))[LAST_KEY] || ''; } catch (e) { /* bỏ qua */ }
  open(fromUrl || last || 'order-shopee');
})();

// Side panel yêu cầu mở 1 mục khi trang chung đã đang mở
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'HUB_OPEN' && msg.m) open(msg.m);
});
