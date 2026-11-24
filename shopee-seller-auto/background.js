// Shopee Seller Auto – background: chạy các tác vụ theo lịch (đẩy SP, trả lời đánh giá, đánh giá người mua)
importScripts('lib/store.js', 'lib/bridge.js', 'lib/shopee.js', 'lib/jobs.js');

const APP = chrome.runtime.getURL('pages/app.html');
const PUSH_EVERY_MIN = 5;

chrome.action.onClicked.addListener(async () => {
  const [tab] = await chrome.tabs.query({ url: APP + '*' });
  if (tab) { await chrome.tabs.update(tab.id, { active: true }); await chrome.windows.update(tab.windowId, { focused: true }); }
  else await chrome.tabs.create({ url: APP });
});

function ensureAlarm() {
  chrome.alarms.get('tick', (a) => { if (!a) chrome.alarms.create('tick', { periodInMinutes: 1, delayInMinutes: 0.2 }); });
}
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

let lastNotify = 0;
function notifyLogin(msg) {
  if (Date.now() - lastNotify < 60 * 60e3) return; // tối đa 1 lần/giờ
  lastNotify = Date.now();
  chrome.notifications.create('ssa-login', {
    type: 'basic', iconUrl: 'icons/icon128.png', title: 'Shopee Seller Auto',
    message: msg || 'Cần đăng nhập Kênh Người Bán để tiếp tục chạy tự động.',
  });
}
chrome.notifications.onClicked.addListener((id) => { if (id === 'ssa-login') chrome.tabs.create({ url: 'https://banhang.shopee.vn/' }); });

async function runLocked(name, fn) {
  if (!(await Store.lock(name))) return; // trang đang chạy tay hoặc lượt trước chưa xong
  try { await fn(); }
  catch (e) {
    const m = Jobs.errMsg(e);
    await Store.addLog(name, 'error', 'Chạy tự động lỗi: ' + m);
    await Store.saveConfig(name, { lastRun: Date.now(), lastError: m });
    if (/NEED_LOGIN/.test(String(e))) notifyLogin(m);
  } finally { await Store.unlock(name); }
}

const due = (cfg, minutes) => !cfg.lastRun || Date.now() - cfg.lastRun >= minutes * 60e3 - 15e3;

let busy = false;
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== 'tick' || busy) return;
  busy = true;
  try {
    const push = await Store.getConfig('push');
    if (push.enabled && Jobs.inWindow(push) && due(push, PUSH_EVERY_MIN)) await runLocked('push', () => Jobs.pushTick());

    const reply = await Store.getConfig('reply');
    if (reply.enabled && due(reply, Number(reply.intervalMin) || 30)) {
      await runLocked('reply', () => Jobs.replyJob({ touch: () => Store.touchLock('reply') }));
    }

    const rate = await Store.getConfig('rate');
    if (rate.enabled && due(rate, Number(rate.intervalMin) || 60)) {
      await runLocked('rate', () => Jobs.rateJob({ touch: () => Store.touchLock('rate') }));
    }
  } finally { busy = false; }
});

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg && msg.type === 'SSA_RUN_NOW') {
    const map = { push: () => Jobs.pushTick({ manual: true }) };
    if (!map[msg.job]) return false;
    runLocked(msg.job, map[msg.job]).then(() => send({ ok: true }));
    return true;
  }
  return false;
});
