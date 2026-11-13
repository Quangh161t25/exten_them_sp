// Auto Chat: dùng chung cho background (importScripts), side panel và content script.
// Toàn bộ dữ liệu lưu trong chrome.storage.local:
//   autochat_settings : cài đặt (chế độ Tắt / Chỉ theo dõi / Tự nhắn, câu chào, giãn cách...)
//   autochat_session  : token phiên chat Shopee (token.js lấy từ trang banhang.shopee.vn)
//   autochat_queue    : { [convId]: entry } danh sách khách chờ / đã xong
//   autochat_meta     : trạng thái lần quét gần nhất, lỗi gần nhất
//   autochat_log      : nhật ký các tin Auto Chat đã gửi / lỗi (mới nhất trước)
/* exported AUTOCHAT */
var AUTOCHAT = (function () {
  'use strict';

  const MODES = {
    off: 'Tắt',
    watch: 'Chỉ theo dõi', // quét + lập danh sách khách chờ, không gửi gì
    auto: 'Tự nhắn' // quét + tự gửi qua API để shop luôn là người nhắn cuối
  };

  const DEFAULT_SETTINGS = {
    mode: 'off',
    replyBacklog: true, // tự nhắn cả khách đang chờ từ trước khi bật
    autoSince: 0, // thời điểm bật "Tự nhắn": chỉ nhắn khách nhắn SAU lúc này, không nhắn khách tồn đọng cũ
    greetText: 'Dạ shop chào anh/chị ạ! Shop đã nhận được tin nhắn, nhân viên sẽ trả lời mình ngay trong ít phút nữa ạ!',
    // Khách nhắn tiếp sau câu chào (hoặc sau tin tự động của Shopee) → gửi câu này để shop luôn là người nhắn cuối.
    followText: 'Dạ shop đã nhận được tin nhắn của mình rồi ạ, nhân viên đang kiểm tra và sẽ trả lời anh/chị ngay ạ!',
    greetMaxAgeMin: 120, // tin của khách cũ hơn mức này thì không tự nhắn nữa (chỉ nằm trong danh sách chờ)
    followDelaySec: 60, // khách chờ bấy nhiêu giây chưa ai trả lời mới gửi câu nhắn tiếp (để nhân viên kịp trả lời tay)
    followGapMin: 5, // 2 tin Auto Chat liên tiếp cho cùng 1 khách cách nhau ít nhất bấy nhiêu phút
    maxPerHour: 60, // chốt an toàn: tổng số tin Auto Chat gửi trong 1 giờ
    pollSec: 30, // quét mỗi bấy nhiêu giây (Chrome cho báo thức tối thiểu 30 giây)
    keepDoneHours: 48
  };

  const K = {
    settings: 'autochat_settings',
    session: 'autochat_session',
    queue: 'autochat_queue',
    meta: 'autochat_meta',
    log: 'autochat_log'
  };

  async function getSettings() {
    const r = await chrome.storage.local.get(K.settings);
    const s = Object.assign({}, DEFAULT_SETTINGS, r[K.settings] || {});
    // Bản cũ dùng công tắc greetEnabled
    if (r[K.settings] && !r[K.settings].mode && r[K.settings].greetEnabled) {
      s.mode = 'auto';
      s.autoSince = r[K.settings].greetEnabledAt || Date.now();
    }
    return s;
  }

  async function saveSettings(patch) {
    const cur = await getSettings();
    if (patch.mode === 'auto' && cur.mode !== 'auto') patch.autoSince = Date.now();
    const next = Object.assign(cur, patch);
    await chrome.storage.local.set({ [K.settings]: next });
    return next;
  }

  async function getSession() {
    const r = await chrome.storage.local.get(K.session);
    return r[K.session] || null;
  }

  async function getQueue() {
    const r = await chrome.storage.local.get(K.queue);
    return r[K.queue] || {};
  }

  async function saveQueue(q) {
    await chrome.storage.local.set({ [K.queue]: q });
  }

  async function getMeta() {
    const r = await chrome.storage.local.get(K.meta);
    return r[K.meta] || {};
  }

  async function saveMeta(patch) {
    const cur = await getMeta();
    await chrome.storage.local.set({ [K.meta]: Object.assign(cur, patch) });
  }

  async function getLog() {
    const r = await chrome.storage.local.get(K.log);
    return r[K.log] || [];
  }

  // item: { at, name, kind: 'greet' | 'follow', text, ok, error }
  async function addLog(item) {
    const log = await getLog();
    log.unshift(item);
    await chrome.storage.local.set({ [K.log]: log.slice(0, 200) });
  }

  function waitingList(q) {
    return Object.values(q)
      .filter((e) => e.status === 'waiting')
      .sort((a, b) => a.firstAt - b.firstAt); // khách chờ lâu nhất lên đầu
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'vừa xong';
    if (m < 60) return m + ' phút';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' giờ ' + (m % 60) + ' phút';
    return Math.floor(h / 24) + ' ngày';
  }

  // Shopee tính tỷ lệ phản hồi trong 12 giờ: tô màu theo thời gian chờ.
  function urgency(ts) {
    const h = (Date.now() - ts) / 3600000;
    if (h >= 8) return 'red';
    if (h >= 2) return 'orange';
    return 'green';
  }

  const hhmm = (ts) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Nhãn trạng thái của 1 khách; cls = tiền tố class ("ac-tag" trên trang webchat, "tag" ở side panel).
  function greetTags(e, cls) {
    const g = e.greet || {};
    const tag = (kind, text, title) =>
      `<span class="${cls}${kind ? ' ' + kind : ''}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
    const out = [];
    if (g.sentAt) {
      const n = g.count > 1 ? ` (${g.count} lần)` : '';
      out.push(tag('ok', `✅ Auto Chat đã nhắn ${hhmm(g.sentAt)}${n}`));
    } else if (e.acknowledged) {
      out.push(tag('', 'ℹ️ Shopee đã tự trả lời'));
    }
    if (e.status === 'waiting') {
      out.push(e.lastIsBuyer ? tag('warn', '💬 Khách đang là người nhắn cuối') : tag('ok', '✔ Shop là người nhắn cuối'));
    }
    if (g.error) out.push(tag('warn', '⚠️ ' + g.error, g.error));
    return out.join('');
  }

  return {
    MODES, DEFAULT_SETTINGS, K, getSettings, saveSettings, getSession, getQueue, saveQueue, getMeta, saveMeta,
    getLog, addLog, waitingList, esc, timeAgo, urgency, hhmm, greetTags
  };
})();
