// Auto Chat: bộ máy chạy ngầm trong background (importScripts sau autochat/shared.js).
// Mỗi lượt (alarm 30 giây): gọi API webchat bằng token phiên chat → cập nhật danh sách khách chờ →
// ở chế độ "Tự nhắn" thì gửi tin qua API (POST /webchat/api/v1.2/messages) cho khách đang là người nhắn cuối.
// Không click giao diện. API chỉ cần token, không cần cookie.
//
// Đường gọi API (đã thử thật: gọi từ trang banhang.shopee.vn thì chạy):
//   1. "tab": chạy fetch bên trong một tab banhang.shopee.vn đang mở (chrome.scripting, không reload, không click)
//      → request mang đúng nguồn của Shopee.
//   2. "trực tiếp": không có tab nào thì background tự gọi; luật declarativeNetRequest trong autochat/background.js
//      gắn Origin/Referer banhang.shopee.vn cho request này.
/* global AUTOCHAT */
/* exported AUTOCHAT_ENGINE */
var AUTOCHAT_ENGINE = (function () {
  'use strict';

  const API = 'https://banhang.shopee.vn/webchat/api/v1.2';
  const BACKLOG_DAYS = 3; // lần đầu chạy: chỉ đưa vào danh sách khách nhắn trong 3 ngày gần nhất
  const MAX_DETAIL_PER_TICK = 10;
  const MAX_SEND_PER_TICK = 5;

  let running = false;

  // ---------- API ----------
  class SessionError extends Error {}

  // Chạy trong tab Shopee, môi trường của chính trang (world MAIN): fetch mang nguồn banhang.shopee.vn
  // và đi qua lớp bảo mật của Shopee giống hệt khi bạn tự bấm gửi trên webchat.
  // Token phiên chat bị Shopee đổi liên tục (webchat / khung chat nhỏ tự đăng nhập lại và huỷ token cũ),
  // nên luôn dùng token MỚI NHẤT trong localStorage của tab ngay lúc gọi; bị 401 thì đợi trang
  // lấy token mới rồi thử lại 1 lần. Trả về token đã dùng để background cập nhật bản lưu.
  async function fetchInPage(url, init) {
    const readToken = () => {
      try {
        return (JSON.parse(localStorage.getItem('chat-session') || 'null') || {}).token || '';
      } catch (e) {
        return '';
      }
    };
    const call = async (token) => {
      if (token) init.headers.Authorization = 'Bearer ' + token;
      // Cùng nguồn banhang.shopee.vn nên gửi kèm cookie phiên của trang (giống lúc webchat tự gửi).
      // Thiếu cookie thì Shopee trả 401 dù token còn hạn.
      init.credentials = 'include';
      const r = await fetch(url, init);
      return { status: r.status, text: await r.text(), token };
    };
    const first = readToken();
    let res = await call(first);
    if (res.status === 401) {
      await new Promise((ok) => setTimeout(ok, 2500));
      const fresh = readToken();
      if (fresh && fresh !== res.token) res = await call(fresh);
    }
    // Chẩn đoán (không lộ token): trang nào, có token trong trang không, đuôi token đã gửi
    try {
      const sent = (init.headers.Authorization || '').slice(-4);
      res.diag = `${location.pathname}${first ? '' : ', trang không có chat-session'}, token …${sent}`;
    } catch (e) {
      // chẩn đoán không được làm hỏng kết quả
    }
    return res;
  }

  // Đọc phiên chat (token, shop) hiện tại từ tab Shopee; khác bản lưu thì cập nhật.
  function readSessionInPage() {
    try {
      const s = JSON.parse(localStorage.getItem('chat-session') || 'null');
      return s && s.token && s.user && s.shop ? { token: s.token, userId: s.user.id, shopId: s.shop.id, shopName: s.shop.name } : null;
    } catch (e) {
      return null;
    }
  }

  async function syncSessionFromTab() {
    for (const t of await shopeeTabs()) {
      try {
        const [r] = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: readSessionInPage });
        if (r && r.result) return saveSessionIfChanged(r.result);
      } catch (e) {
        // thử tab khác
      }
    }
    return null;
  }

  async function saveSessionIfChanged(next) {
    const cur = await AUTOCHAT.getSession();
    if (cur && cur.token === next.token && cur.shopId === next.shopId) return cur;
    const s = Object.assign({}, cur || {}, next, { at: Date.now() });
    await chrome.storage.local.set({ [AUTOCHAT.K.session]: s });
    return s;
  }

  async function shopeeTabs() {
    const tabs = await chrome.tabs.query({ url: 'https://banhang.shopee.vn/*' });
    // Ưu tiên tab webchat, bỏ tab đang tải dở / đã bị Chrome tạm ngủ
    return tabs
      .filter((t) => t.status === 'complete' && !t.discarded)
      .sort((a, b) => (/webchat/.test(b.url) ? 1 : 0) - (/webchat/.test(a.url) ? 1 : 0));
  }

  async function transport(url, init) {
    const tabs = await shopeeTabs();
    const skipped = [];
    for (const t of tabs) {
      try {
        // world MAIN: dùng fetch của chính trang, đã được thư viện bảo mật Shopee bọc để tự gắn header
        // chống bot (x-sap-sec, af-ac-enc-dat...). Thiếu các header này thì lệnh gửi tin bị 401.
        const [r] = await chrome.scripting.executeScript({ target: { tabId: t.id }, world: 'MAIN', func: fetchInPage, args: [url, init] });
        if (r && r.result) return Object.assign(r.result, { via: 'tab' });
        skipped.push('tab ' + t.id + ' không trả kết quả');
      } catch (e) {
        // tab không chạy được script (trang lỗi, đang chuyển trang...): thử tab khác
        skipped.push('tab ' + t.id + ': ' + String(e && e.message || e).slice(0, 60));
      }
      // Gửi tin (POST) có thể ĐÃ tới Shopee dù script lỗi giữa chừng: không thử đường khác, tránh khách nhận trùng.
      if (init.method === 'POST') throw new Error('Không chắc tin đã gửi (' + skipped[skipped.length - 1] + '), kiểm tra hội thoại');
    }
    const r = await fetch(url, init);
    const diag = `${tabs.length} tab Shopee${skipped.length ? ' (' + skipped.join('; ') + ')' : ''}, token …${(init.headers.Authorization || '').slice(-4)}`;
    return { status: r.status, text: await r.text(), via: 'trực tiếp', diag };
  }

  async function api(session, path, params, body) {
    const u = new URL(API + path);
    Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
    const init = {
      method: body ? 'POST' : 'GET',
      credentials: 'include', // API webchat cần cookie phiên banhang.shopee.vn, không chỉ token
      headers: { Authorization: 'Bearer ' + session.token, Accept: 'application/json, text/plain, */*' }
    };
    if (body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await transport(u.toString(), init);
    if (res.via === 'tab' && res.token && res.token !== session.token && res.status < 300) {
      session.token = res.token; // tab vừa dùng token mới hơn: các lần gọi sau trong lượt này dùng luôn
      await saveSessionIfChanged({ token: res.token, userId: session.userId, shopId: session.shopId, shopName: session.shopName });
    }
    let json = null;
    try {
      json = JSON.parse(res.text);
    } catch (e) {
      // không phải JSON
    }
    if (res.status === 401 || res.status === 403) {
      const code = json && (json.error_code || json.error || json.message);
      const what = body ? 'gửi tin' : 'đọc ' + path.replace(/\/\d+/g, '/…');
      const err = new SessionError(`${what}: HTTP ${res.status}, gọi ${res.via}${code ? ', ' + String(code).slice(0, 60) : ''}${res.diag ? ' | ' + res.diag : ''}`);
      err.via = res.via;
      err.isSend = !!body;
      throw err;
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} (gọi ${res.via})`);
    if (json === null) throw new Error(`Shopee trả về dữ liệu lạ (gọi ${res.via})`);
    return json;
  }

  const listConversations = (s) =>
    api(s, '/conversations', { direction: 'older', limit: 50, type: 'all', biz_id: 0, on_message_received: true });

  const listMessages = (s, convId) =>
    api(s, '/conversations/' + convId + '/messages', {
      shop_id: s.shopId, offset: 0, limit: 20, direction: 'older', biz_id: 0, on_message_received: true
    });

  function genUuid() {
    // 1. Thử dùng self.crypto.randomUUID nếu có (tránh dùng bare crypto vì bị thư viện jsrsasign tạo biến var trùng)
    try {
      const c = (typeof self !== 'undefined' && self.crypto) || (typeof window !== 'undefined' && window.crypto);
      if (c && typeof c.randomUUID === 'function') {
        return c.randomUUID();
      }
    } catch (_) {}

    // 2. Thử dùng self.crypto.getRandomValues nếu có
    try {
      const c = (typeof self !== 'undefined' && self.crypto) || (typeof window !== 'undefined' && window.crypto);
      if (c && typeof c.getRandomValues === 'function') {
        const buf = new Uint8Array(16);
        c.getRandomValues(buf);
        buf[6] = (buf[6] & 0x0f) | 0x40; // Version 4
        buf[8] = (buf[8] & 0x3f) | 0x80; // Variant 10xx
        const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
    } catch (_) {}

    // 3. Fallback Math.random chuẩn RFC4122 v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      const v = ch === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Cùng định dạng với tin webchat tự gửi (bắt từ request thật).
  const sendText = (s, e, text) =>
    api(s, '/messages', { uuid: genUuid() }, {
      request_id: genUuid(),
      to_id: e.buyerId,
      type: 'text',
      content: { text, uid: genUuid() },
      shop_id: s.shopId,
      chat_send_option: { force_send_cancel_order_warning: false, comply_cancel_order_warning: false },
      source_content: {},
      entry_point: '',
      biz_id: 0,
      conversation_id: e.convId
    });

  // ---------- Phân loại tin ----------
  function msgText(type, content) {
    if (content && content.text) return content.text;
    const labels = {
      item: 'Sản phẩm', product: 'Sản phẩm', variation_card: 'Phân loại sản phẩm', bundle_message: 'Combo sản phẩm',
      order: 'Đơn hàng', image: 'Hình ảnh', sticker: 'Sticker', video: 'Video', voucher: 'Voucher',
      faq_liveagent: 'Khách muốn gặp nhân viên'
    };
    return '[' + (labels[type] || type || 'tin nhắn') + ']';
  }

  // Tin tự động của Shopee: "auto_reply" (tin tự động) và "offwork_autoreply" (tin ngoài giờ làm việc).
  // Có ở cả last_message_state của hội thoại lẫn status của từng tin nhắn.
  const isAuto = (state) => /auto_?reply/i.test(state || '');

  // Tin thật của khách: bỏ tin tự động và các thẻ hệ thống Shopee gửi dưới tên khách
  // (vd "out_of_stock_reminder_card", "notification").
  function isCustomerMsg(type, status) {
    if (isAuto(status)) return false;
    return !/notification|reminder/i.test(type || '');
  }

  const toMs = (t) => (t > 1e14 ? Math.floor(t / 1e6) : t > 1e11 ? t : t * 1000);

  // Tin do chính Auto Chat gửi (câu chào / câu nhắn tiếp): không tính là shop đã trả lời thật.
  const isOurText = (text, st) => [st.greetText, st.followText].some((t) => t && text.trim() === t.trim());

  // ---------- Cập nhật danh sách ----------
  // Trả về các entry cần đọc chi tiết tin nhắn.
  function applyConversations(convs, sellerId, st, q) {
    const backlogFrom = Date.now() - BACKLOG_DAYS * 86400000;
    const needDetail = [];

    for (const c of Array.isArray(convs) ? convs : []) {
      if (!c || !c.id || !c.to_id || c.is_blocked) continue;
      if (c.official_chat && c.official_chat.official_conv_type) continue; // chat hệ thống Shopee

      const lastAt = Date.parse(c.last_message_time) || Date.now();
      const text = msgText(c.latest_message_type, c.latest_message_content);
      const fromBuyer = c.latest_message_from_id === c.to_id;
      const fromSeller = c.latest_message_from_id === sellerId;
      let e = q[c.id];

      if (fromBuyer) {
        // tin tự động của shop khác / thẻ hệ thống: không phải khách hỏi
        if (!isCustomerMsg(c.latest_message_type, c.last_message_state)) continue;
        if (!e) {
          if (lastAt < backlogFrom) continue;
          e = q[c.id] = { convId: c.id, buyerId: c.to_id, status: 'waiting', firstAt: lastAt, msgs: [], greet: {} };
        }
        if (e.lastMsgId !== c.latest_message_id) {
          if (e.status !== 'waiting') {
            // khách nhắn tiếp sau khi đã xong → mở lại
            Object.assign(e, { status: 'waiting', firstAt: lastAt, msgs: [], greet: {}, acknowledged: false, doneAt: 0, doneReason: '' });
          }
          e.lastMsgId = c.latest_message_id;
          e.lastBuyerAt = lastAt;
          e.lastText = text;
          needDetail.push(e);
        }
        e.lastIsBuyer = true; // khách đang là người nhắn cuối → cần nhắn lại
        e.name = c.to_name;
        e.unread = c.unread_count;
      } else if (fromSeller) {
        const notReal = isOurText(text, st) || isAuto(c.last_message_state);
        if (!e && notReal && lastAt >= backlogFrom) {
          // Khách mới chỉ nhận tin tự động của Shopee (vd "Ngoài giờ làm việc"): vẫn đang chờ người trả lời.
          e = q[c.id] = { convId: c.id, buyerId: c.to_id, name: c.to_name, status: 'waiting', firstAt: lastAt, msgs: [], greet: {} };
          e.lastMsgId = c.latest_message_id;
          e.lastBuyerAt = lastAt;
          needDetail.push(e);
        }
        if (!e || e.status !== 'waiting') continue;
        e.lastIsBuyer = false;
        if (notReal) continue; // câu chào / câu nhắn tiếp / tin tự động không tính là đã trả lời
        e.status = 'done';
        e.doneAt = Date.now();
        e.doneReason = 'replied';
      }
    }
    return needDetail;
  }

  // Lấy các tin khách gửi kể từ lần cuối shop trả lời thật (bỏ qua tin của Auto Chat và tin tự động của Shopee).
  // Trả về:
  //   waiting      số tin khách đang chờ
  //   lastIsBuyer  tin mới nhất (bỏ thẻ hệ thống) là của khách → cần nhắn lại để shop là người nhắn cuối
  //   acknowledged trong đợt chờ này shop đã có tin tự động / tin Auto Chat (vd tin "Ngoài giờ làm việc")
  //                → lần sau gửi "câu nhắn tiếp" thay vì câu chào
  function applyMessages(e, msgs, sellerId, st) {
    const res = { waiting: 0, lastIsBuyer: false, acknowledged: false };
    if (!Array.isArray(msgs) || !msgs.length) return res;
    const sorted = msgs.slice().sort((a, b) => toMs(a.created_timestamp) - toMs(b.created_timestamp));
    const trailing = [];
    let newestSeen = false;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const m = sorted[i];
      const text = msgText(m.type, m.content);
      if (m.from_id === sellerId) {
        // Tin tự động của Shopee (ngoài giờ, auto reply) hoặc câu chào do Auto Chat gửi KHÔNG phải
        // nhân viên trả lời thật: bỏ qua nhưng cũng không đánh dấu "shop là người nhắn cuối",
        // để khách vẫn được gửi câu nhắn tiếp.
        if (isOurText(text, st) || isAuto(m.status)) {
          res.acknowledged = true;
          continue;
        }
        break; // shop đã trả lời thật: các tin cũ hơn không còn chờ
      }
      if (!isCustomerMsg(m.type, m.status)) continue;
      if (!newestSeen) res.lastIsBuyer = true;
      newestSeen = true;
      trailing.unshift({ at: toMs(m.created_timestamp), text });
    }
    res.waiting = trailing.length;
    e.lastIsBuyer = res.lastIsBuyer;
    if (!trailing.length) return res;
    e.msgs = trailing.slice(-6);
    e.firstAt = trailing[0].at;
    e.lastBuyerAt = trailing[trailing.length - 1].at;
    e.acknowledged = res.acknowledged;
    return res;
  }

  function cleanup(q, st) {
    const keepMs = st.keepDoneHours * 3600000;
    for (const [id, e] of Object.entries(q)) {
      if (e.status === 'done' && Date.now() - (e.doneAt || 0) > keepMs) delete q[id];
    }
  }

  // ---------- Chọn khách cần nhắn ----------
  // Lần đầu trong đợt chờ: câu chào. Khách nhắn tiếp (hoặc Shopee đã tự trả lời trước): câu nhắn tiếp,
  // chỉ gửi khi khách đã chờ followDelaySec giây chưa ai trả lời và cách tin Auto Chat trước ≥ followGapMin phút.
  const greetedThisRound = (e) => !!(e.greet.sentAt && e.greet.sentAt >= e.firstAt) || !!e.acknowledged;

  function pickTargets(q, st, now) {
    return AUTOCHAT.waitingList(q).filter((e) => {
      const g = e.greet || (e.greet = {});
      if (!e.lastIsBuyer) return false; // shop đang là người nhắn cuối
      if (!st.replyBacklog && e.lastBuyerAt < st.autoSince) return false;
      if (now - e.lastBuyerAt > st.greetMaxAgeMin * 60000) return false;
      if (g.failMsgId === e.lastMsgId && (g.tries || 0) >= 3) return false;
      if (!greetedThisRound(e)) return true;
      return now - e.lastBuyerAt >= st.followDelaySec * 1000 &&
        !(g.sentAt && now - g.sentAt < st.followGapMin * 60000);
    });
  }

  async function sendTo(s, e, st) {
    // Đọc lại tin nhắn ngay trước khi gửi: nếu Shopee vừa tự trả lời (vd tin ngoài giờ)
    // hoặc nhân viên vừa trả lời thì shop đã là người nhắn cuối → không gửi.
    e.greet = e.greet || {};
    const fresh = applyMessages(e, await listMessages(s, e.convId), s.userId, st);
    if (!fresh.lastIsBuyer) return false;
    const isFollow = greetedThisRound(e);
    const text = (isFollow ? st.followText : st.greetText).trim();
    const kind = isFollow ? 'follow' : 'greet';
    try {
      const res = await sendText(s, e, text);
      if (!res || !res.id) throw new Error('Shopee không trả về id tin nhắn');
      e.greet = { sentAt: Date.now(), count: (e.greet.count || 0) + 1, lastKind: kind };
      e.lastIsBuyer = false;
      try {
        const key = 'autochat_sent_' + s.shopId;
        const saved = await chrome.storage.local.get(key);
        const ledger = saved[key] || {};
        ledger[e.convId] = {at:Date.now(),messageId:res.id,text};
        await chrome.storage.local.set({[key]:ledger});
      } catch (storageError) { console.warn('[AutoChat] Không lưu được trạng thái tin đã gửi', storageError); }
      await AUTOCHAT.addLog({ at: Date.now(), convId:e.convId, shopId:s.shopId, name: e.name, kind, text, ok: true });
      return true;
    } catch (err) {
      if (err instanceof SessionError) throw err;
      const g = e.greet;
      g.tries = g.failMsgId === e.lastMsgId ? (g.tries || 0) + 1 : 1;
      g.failMsgId = e.lastMsgId;
      g.error = 'Gửi lỗi: ' + err.message;
      await AUTOCHAT.addLog({ at: Date.now(), name: e.name, kind, text, ok: false, error: err.message });
      return false;
    }
  }

  // ---------- Một lượt chạy ----------
  async function tick() {
    if (running) return;
    running = true;
    try {
      const st = await AUTOCHAT.getSettings();
      if (st.mode === 'off') return;
      // Có tab Kênh Người Bán thì lấy phiên mới nhất từ đó (token đổi liên tục, có thể vừa đổi shop).
      const s = (await syncSessionFromTab()) || (await AUTOCHAT.getSession());
      if (!s || !s.token) {
        await AUTOCHAT.saveMeta({ lastPollAt: Date.now(), lastError: 'Chưa có phiên Shopee: mở Kênh Người Bán (banhang.shopee.vn) 1 lần.' });
        return;
      }

      const q = await AUTOCHAT.getQueue();
      // Tự động xóa lỗi cũ do bug randomUUID gây ra để khách được gửi lại ngay
      for (const e of Object.values(q)) {
        if (e.greet && e.greet.error && e.greet.error.includes('randomUUID')) {
          delete e.greet.error;
          delete e.greet.failMsgId;
          e.greet.tries = 0;
        }
        if (e.greet && e.greet.error && /UNAUTHORIZED|Phiên Shopee/i.test(e.greet.error)) {
          delete e.greet.error;
          delete e.greet.failMsgId;
          e.greet.tries = 0;
        }
      }
      const needDetail = applyConversations(await listConversations(s), s.userId, st, q);
      for (const e of needDetail.slice(0, MAX_DETAIL_PER_TICK)) {
        try {
          const res = applyMessages(e, await listMessages(s, e.convId), s.userId, st);
          // Không còn tin nào của khách đang chờ (shop đã trả lời thật trước đó) → không phải khách chờ.
          if (!res.waiting && !e.msgs.length) delete q[e.convId];
        } catch (err) {
          if (err instanceof SessionError) throw err;
          console.warn('[AutoChat] Lỗi đọc tin nhắn', e.name, err);
        }
      }
      cleanup(q, st);

      let sent = 0;
      if (st.mode === 'auto') {
        const log = await AUTOCHAT.getLog();
        const hourAgo = Date.now() - 3600000;
        let budget = st.maxPerHour - log.filter((l) => l.ok && l.at > hourAgo).length;
        for (const e of pickTargets(q, st, Date.now()).slice(0, MAX_SEND_PER_TICK)) {
          if (budget <= 0) break;
          if (await sendTo(s, e, st)) {
            sent++;
            budget--;
          }
        }
      }

      await AUTOCHAT.saveQueue(q);
      await AUTOCHAT.saveMeta({ lastPollAt: Date.now(), lastError: '', lastSent: sent });
    } catch (err) {
      let msg = 'Lỗi quét: ' + err.message;
      if (err instanceof SessionError) {
        if (err.via !== 'tab') {
          msg = `Shopee từ chối khi gọi ngầm (${err.message}): mở 1 tab Kênh Người Bán bất kỳ, Auto Chat sẽ gửi qua tab đó.`;
        } else if (err.isSend) {
          msg = `Shopee từ chối lệnh gửi tin (${err.message}): thử F5 tab Kênh Người Bán rồi đợi lượt quét sau.`;
        } else {
          msg = `Shopee từ chối phiên chat (${err.message}): đăng nhập lại Kênh Người Bán rồi bấm "Lấy lại phiên".`;
        }
      }
      await AUTOCHAT.saveMeta({ lastPollAt: Date.now(), lastError: msg });
    } finally {
      running = false;
    }
  }

  return { tick, applyMessages, pickTargets, sendTo, syncSessionFromTab,
    readConversationsPage: (s, offset) => api(s, '/conversations', {direction:'older',limit:50,offset,type:'all',biz_id:0,on_message_received:true}),
    readMessagesPage: (s, convId, offset) => api(s, '/conversations/' + encodeURIComponent(convId) + '/messages', {shop_id:s.shopId,offset,limit:20,direction:'older',biz_id:0,on_message_received:true})
  };
})();
