// Auto Chat: phần chạy ngầm, nạp bằng importScripts từ extension/background.js
// (sau autochat/shared.js và autochat/engine.js).
// Báo thức 30 giây/lần gọi AUTOCHAT_ENGINE.tick(): quét + tự nhắn qua API, không cần mở tab webchat.
// Cập nhật số khách chờ trên icon và mở hội thoại khi bấm "Mở chat" ở side panel.
/* global AUTOCHAT, AUTOCHAT_ENGINE */
(() => {
  const WEBCHAT_URL = 'https://banhang.shopee.vn/new-webchat/conversations';
  const ALARM = 'autochat-tick';

  async function updateBadge() {
    const st = await AUTOCHAT.getSettings();
    const n = st.mode === 'off' ? 0 : AUTOCHAT.waitingList(await AUTOCHAT.getQueue()).length;
    await chrome.action.setBadgeText({ text: n ? String(n) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#ee4d2d' });
  }

  function init() {
    chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
    updateBadge();
  }

  // Request API chat do chính background gọi (không thuộc tab nào, tabId -1) mặc định mang nguồn
  // chrome-extension://… → gắn lại Origin/Referer của webchat cho giống request từ trang Shopee.
  // Luật phiên (session rule) mất khi tắt Chrome nên đặt lại mỗi lần service worker chạy.
  const ORIGIN_RULE_ID = 9101;
  try {
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ORIGIN_RULE_ID],
      addRules: [{
        id: ORIGIN_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'set', value: 'https://banhang.shopee.vn' },
            { header: 'referer', operation: 'set', value: WEBCHAT_URL }
          ]
        },
        condition: {
          urlFilter: '||banhang.shopee.vn/webchat/api/',
          tabIds: [chrome.tabs.TAB_ID_NONE],
          resourceTypes: ['xmlhttprequest']
        }
      }]
    }).catch((e) => console.warn('[AutoChat] Không đặt được luật Origin', e));
  } catch (e) {
    // Thiếu quyền (extension chưa được Reload sau khi thêm declarativeNetRequestWithHostAccess):
    // bỏ qua luật này, Auto Chat vẫn gửi qua tab Shopee đang mở.
    console.warn('[AutoChat] declarativeNetRequest chưa sẵn sàng', e);
  }

  // Đọc token phiên chat từ một tab banhang.shopee.vn (không tải lại tab).
  async function readSessionFromTab(tabId) {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          return JSON.parse(localStorage.getItem('chat-session') || 'null');
        } catch (e) {
          return null;
        }
      }
    });
    const s = r && r.result;
    if (!s || !s.token || !s.user || !s.shop) return false;
    await chrome.storage.local.set({
      [AUTOCHAT.K.session]: { token: s.token, userId: s.user.id, shopId: s.shop.id, shopName: s.shop.name, at: Date.now() }
    });
    return true;
  }

  chrome.runtime.onInstalled.addListener(init);
  chrome.runtime.onStartup.addListener(init);

  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM) AUTOCHAT_ENGINE.tick();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[AUTOCHAT.K.queue] || changes[AUTOCHAT.K.settings]) updateBadge();
    // Vừa bật / đổi chế độ, hoặc vừa có token mới: chạy ngay, không đợi báo thức.
    const st = changes[AUTOCHAT.K.settings];
    if ((st && st.newValue && (!st.oldValue || st.newValue.mode !== st.oldValue.mode)) || changes[AUTOCHAT.K.session]) {
      AUTOCHAT_ENGINE.tick();
    }
  });

  function webchatTabs() {
    return chrome.tabs.query({ url: ['https://banhang.shopee.vn/new-webchat/*', 'https://banhang.shopee.vn/webchat/*'] });
  }

  function waitTabLoaded(tabId) {
    return new Promise((resolve) => {
      const done = () => { chrome.tabs.onUpdated.removeListener(onUpd); clearTimeout(timer); resolve(); };
      const onUpd = (id, info) => { if (id === tabId && info.status === 'complete') done(); };
      const timer = setTimeout(done, 30000);
      chrome.tabs.onUpdated.addListener(onUpd);
    });
  }

  // Content script có thể chưa kịp nạp ngay sau khi tab tải xong: thử lại vài lần.
  async function sendToTab(tabId, msg) {
    for (let i = 0; i < 10; i++) {
      try {
        await chrome.tabs.sendMessage(tabId, msg);
        return true;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    return false;
  }

  // Web (tab AUTO CHAT) gửi tin tay cho khách. Chỉ gửi được khi phiên Shopee trên máy này đúng shop của hội thoại.
  async function sendManual(msg) {
    const text = String(msg.text || '').trim();
    if (!text || !msg.convId || !msg.buyerId) return { ok: false, error: 'Thiếu nội dung hoặc khách nhận.' };
    if (text.length > 1000) return { ok: false, error: 'Tin nhắn quá dài (tối đa 1000 ký tự).' };
    const s = (await AUTOCHAT_ENGINE.syncSessionFromTab()) || (await AUTOCHAT.getSession());
    if (!s || !s.token) return { ok: false, error: 'Chưa có phiên chat Shopee: mở Kênh Người Bán trên máy này rồi bấm Lấy lại phiên trong Auto Chat.' };
    if (String(s.shopId) !== String(msg.shopId)) return { ok: false, error: `Máy này đang đăng nhập shop ${s.shopName || s.shopId}, không phải shop của khách này. Hãy gửi từ máy đang chạy gian đó.` };
    const res = await AUTOCHAT_ENGINE.sendManual(s, String(msg.convId), String(msg.buyerId), text);
    if (!res || !res.id) return { ok: false, error: 'Shopee không trả về id tin nhắn.' };
    await AUTOCHAT.addLog({ at: Date.now(), convId: msg.convId, shopId: s.shopId, name: msg.name || '', kind: 'manual', text, ok: true });
    return { ok: true, id: String(res.id), at: Date.now() };
  }
  const replyManual = (msg, sendResponse) => {
    sendManual(msg).then(sendResponse, (err) => sendResponse({ ok: false, error: err.message }));
    return true;
  };
  // Web deploy chỉ được gửi tin từ các trang của mình (không mở cho mọi tên miền trong externally_connectable).
  const SEND_ORIGINS = [/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https:\/\/quangh161t25\.github\.io$/i];
  chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== 'autochat-send-text') return false;
    if (!SEND_ORIGINS.some((re) => re.test(sender?.origin || ''))) {
      sendResponse({ ok: false, error: `Trang ${sender?.origin || ''} không được phép gửi tin. Mở web trong extension để chat.` });
      return false;
    }
    return replyManual(msg, sendResponse);
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return false;
    if (msg.type === 'autochat-send-text' && sender?.id === chrome.runtime.id && /^chrome-extension:/.test(sender?.url || '')) return replyManual(msg, sendResponse);
    if (msg.type === 'autochat-tick-now') {
      AUTOCHAT_ENGINE.tick().then(() => sendResponse({ ok: true }));
      return true;
    }
    if (msg.type === 'autochat-send-now') {
      (async () => {
        try {
          const s = (await AUTOCHAT_ENGINE.syncSessionFromTab()) || (await AUTOCHAT.getSession());
          if (!s || !s.token) {
            sendResponse({ ok: false, error: 'Phiên Shopee chưa có hoặc đã hết hạn: hãy mở lại Kênh Người Bán.' });
            return;
          }
          const q = await AUTOCHAT.getQueue();
          const e = q[msg.convId];
          if (!e) {
            sendResponse({ ok: false, error: 'Không tìm thấy cuộc trò chuyện này.' });
            return;
          }
          const st = await AUTOCHAT.getSettings();
          const ok = await AUTOCHAT_ENGINE.sendTo(s, e, st);
          await AUTOCHAT.saveQueue(q);
          sendResponse({
            ok,
            error: e.greet?.error || (ok ? '' : 'Khách đã được trả lời (hoặc vừa nhắn xong) nên không cần gửi thêm.')
          });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    if (msg.type === 'autochat-refresh-session') {
      (async () => {
        try {
          // Đọc lại token từ tab Kênh Người Bán đang mở, KHÔNG tải lại tab (tránh mất việc bạn đang làm dở).
          // Không có tab nào thì mở tab webchat ở nền để trang tạo phiên chat rồi đọc.
          let ok = false;
          for (const t of await chrome.tabs.query({ url: 'https://banhang.shopee.vn/*' })) {
            try {
              if (await readSessionFromTab(t.id)) { ok = true; break; }
            } catch (e) {
              // tab không chạy được script: thử tab khác
            }
          }
          if (!ok) {
            const tab = await chrome.tabs.create({ url: WEBCHAT_URL, active: false, pinned: true });
            await waitTabLoaded(tab.id);
            await new Promise((r) => setTimeout(r, 3000)); // webchat tạo chat-session sau khi tải xong
            ok = await readSessionFromTab(tab.id).catch(() => false);
          }
          await AUTOCHAT.saveMeta({ lastError: '' });
          await AUTOCHAT_ENGINE.tick();
          sendResponse({ ok });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    if (msg.type !== 'autochat-open-conv') return false;
    // "Mở chat": đưa tab webchat lên (mở mới nếu chưa có) rồi bảo content script tìm và mở khách.
    (async () => {
      let [tab] = await webchatTabs();
      if (!tab) {
        tab = await chrome.tabs.create({ url: WEBCHAT_URL });
        await waitTabLoaded(tab.id);
      } else {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      await sendToTab(tab.id, { type: 'autochat-open', convId: msg.convId });
      sendResponse({ ok: true });
    })();
    return true;
  });
})();
