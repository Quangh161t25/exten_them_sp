// Gom lỗi của mọi module về 1 chỗ (chrome.storage "qlsp_errors") + báo Telegram khi có lỗi.
// Nạp CUỐI trong extension/background.js (sau autoin, seller-auto…) để dùng được sendTelegram / getTelegramConfig / Store.
// Trang xem: extension/errors/errors.html (nút "⚠️ Lỗi hôm nay" trên panel).
(() => {
  const ERR_KEY = 'qlsp_errors';
  const KEEP_MS = 3 * 24 * 3600e3; // giữ 3 ngày
  const DEDUP_MS = 10 * 60e3;      // cùng 1 lỗi trong 10 phút chỉ báo Telegram 1 lần
  const recentTele = new Map();
  let chain = Promise.resolve();

  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  async function reportError(module, message, ref = '', opts = {}) {
    const item = { at: Date.now(), module: String(module || 'Khác'), message: String(message || '').slice(0, 500), ref: String(ref || '').slice(0, 120) };
    chain = chain.then(async () => {
      const list = ((await chrome.storage.local.get(ERR_KEY))[ERR_KEY] || []).filter((x) => Date.now() - x.at < KEEP_MS);
      list.unshift(item);
      await chrome.storage.local.set({ [ERR_KEY]: list.slice(0, 1000) });
    }).catch(() => {});
    await chain;
    const tele = self.AutoInTele;
    if (opts.tele === false || !tele) return;
    try {
      const cfg = await tele.config();
      if (!cfg.enabled || !cfg.notifyError) return;
      const key = item.module + '|' + item.ref + '|' + item.message.slice(0, 80);
      if (Date.now() - (recentTele.get(key) || 0) < DEDUP_MS) return;
      recentTele.set(key, Date.now());
      const store = await chrome.storage.local.get(['tcdd-shop-code', 'maGian']);
      const gian = String(store['tcdd-shop-code'] || store.maGian || '').toUpperCase();
      await tele.send(`❌ <b>LỖI · ${esc(item.module)}</b>${gian ? ` · Gian ${esc(gian)}` : ''}\n` +
        (item.ref ? `• ${esc(item.ref)}\n` : '') + `• ${esc(item.message)}\n⏰ ${new Date(item.at).toLocaleString('vi-VN')}`);
    } catch (e) { /* không chặn luồng chính */ }
  }
  self.qlspReportError = reportError;

  // Trang của extension gửi lỗi về: { type:'QLSP_ERROR', module, message, ref }
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg?.type !== 'QLSP_ERROR') return false;
    reportError(msg.module, msg.message, msg.ref, { tele: msg.tele !== false }).then(() => reply({ ok: true }));
    return true;
  });

  // Seller Auto (đẩy SP, trả lời đánh giá, đánh giá người mua) chạy nền: mọi log lỗi → gom về
  if (self.Store && typeof Store.addLog === 'function' && !Store.__qlspWrapped) {
    const orig = Store.addLog;
    const NAMES = { push: 'Đẩy SP', reply: 'Trả lời đánh giá', rate: 'Đánh giá người mua' };
    Store.addLog = (name, type, msg) => {
      if (type === 'error') reportError('Seller Auto · ' + (NAMES[name] || name), msg);
      return orig(name, type, msg);
    };
    Store.__qlspWrapped = true;
  }

  // Auto In: recordError() trong autoin/background.js tự gọi qlspReportError (không gửi Telegram lần 2)
})();
