// Đẩy Sản Phẩm Shopee – background: mỗi phút kiểm tra, trong khung giờ đã đặt thì cứ 5 phút
// chạy 1 lượt đẩy (giữ đủ số SP đang đẩy, xoay vòng danh sách). Tách từ module Seller Auto.
importScripts('lib/store.js', 'lib/bridge.js', 'lib/shopee.js', 'lib/jobs.js');

const APP = chrome.runtime.getURL('pages/app.html');
const PUSH_EVERY_MIN = 5;

// Bấm icon extension → mở trang Đẩy sản phẩm (dùng lại tab đang mở nếu có)
chrome.action.onClicked.addListener(async () => {
  const [tab] = await chrome.tabs.query({ url: APP + '*' });
  if (tab) { chrome.tabs.update(tab.id, { active: true }); chrome.windows.update(tab.windowId, { focused: true }); }
  else chrome.tabs.create({ url: APP });
});

function ensureAlarm() {
  chrome.alarms.get('dsp-tick', (a) => { if (!a) chrome.alarms.create('dsp-tick', { periodInMinutes: 1, delayInMinutes: 0.2 }); });
}
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

let lastNotify = 0;
function notifyLogin(msg) {
  if (Date.now() - lastNotify < 60 * 60e3) return; // tối đa 1 lần/giờ
  lastNotify = Date.now();
  chrome.notifications.create('dsp-login', {
    type: 'basic', iconUrl: 'icons/icon128.png', title: 'Đẩy Sản Phẩm Shopee',
    message: msg || 'Cần đăng nhập Kênh Người Bán để tiếp tục đẩy sản phẩm tự động.',
  });
}
chrome.notifications.onClicked.addListener((id) => { if (id === 'dsp-login') chrome.tabs.create({ url: 'https://banhang.shopee.vn/' }); });

const due = (cfg, minutes) => !cfg.lastRun || Date.now() - cfg.lastRun >= minutes * 60e3 - 15e3;

let busy = false;
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== 'dsp-tick' || busy) return;
  busy = true;
  try {
    const settings = await Store.getSettings();
    Shopee.setDemo(settings.demo);
    Shopee.setBoostConfig(settings.boost);
    const push = await Store.getConfig('push');
    if (!push.enabled || !Jobs.inWindow(push) || !due(push, PUSH_EVERY_MIN)) return;
    if (!(await Store.lock('push'))) return; // trang đang chạy tay hoặc lượt trước chưa xong
    try { await Jobs.pushTick(); }
    catch (e) {
      const m = Jobs.errMsg(e);
      await Store.addLog('push', 'error', 'Chạy tự động lỗi: ' + m);
      await Store.saveConfig('push', { lastRun: Date.now(), lastError: m });
      if (/NEED_LOGIN/.test(String(e))) notifyLogin(m);
    } finally { await Store.unlock('push'); }
  } finally { busy = false; }
});

// Nút "Đẩy ngay" trên trang danh sách sản phẩm: đẩy 1 SP ngay lập tức
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg?.type === 'DSP_OPEN') { chrome.tabs.create({ url: APP }); reply({ ok: true }); return false; }
  if (msg?.type === 'DSP_BOOST_NOW' && msg.id) {
    (async () => {
      await Jobs.prepare();
      await Shopee.boost(msg.id);
      const cfg = await Store.getConfig('push');
      await Store.saveConfig('push', { lastBoost: { ...(cfg.lastBoost || {}), [msg.id]: Date.now() } });
      await Store.addLog('push', 'ok', `Đã đẩy (bấm tay): ${msg.name || ''} (#${msg.id})`);
      return { ok: true };
    })().then(reply, async (e) => {
      const m = Jobs.errMsg(e);
      await Store.addLog('push', 'error', `Lỗi đẩy (bấm tay) ${msg.name || ''} (#${msg.id}): ${m}`);
      reply({ ok: false, error: m });
    });
    return true;
  }
  return false;
});
