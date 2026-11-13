// FILE TỰ SINH bởi `npm run build:fs` — không sửa tay, sửa các file nguồn trong extension/flash-sale/
(function () {
  'use strict';

  // Lớp gọi API Kênh Người Bán Shopee.
  // Mọi request được chạy BÊN TRONG một tab banhang.shopee.vn (qua chrome.scripting),
  // nên trình duyệt tự gửi kèm cookie đăng nhập như khi bạn thao tác trên web.

  const SELLER_ORIGIN = 'https://banhang.shopee.vn';

  let cachedTabId = null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function waitTabComplete(tabId, timeout = 45000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Hết thời gian chờ tải trang Kênh Người Bán'));
      }, timeout);
      function listener(id, info, tab) {
        if (id === tabId && info.status === 'complete') {
          cleanup();
          resolve(tab);
        }
      }
      function cleanup() {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
      }
      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.get(tabId).then((t) => {
        if (t.status === 'complete') {
          cleanup();
          resolve(t);
        }
      }).catch((e) => {
        cleanup();
        reject(e);
      });
    });
  }

  // Tìm (hoặc mở ngầm) một tab Kênh Người Bán để chạy request.
  async function getSellerTab() {
    if (cachedTabId !== null) {
      try {
        const t = await chrome.tabs.get(cachedTabId);
        if (t.url && t.url.startsWith(SELLER_ORIGIN)) {
          if (t.status !== 'complete') await waitTabComplete(t.id);
          return t.id;
        }
      } catch (e) { /* tab đã đóng */ }
      cachedTabId = null;
    }

    const tabs = await chrome.tabs.query({ url: SELLER_ORIGIN + '/*' });
    let tab = tabs.find((t) => t.status === 'complete') || tabs[0];
    if (!tab) {
      // Chưa có tab Kênh Người Bán: tự mở trang Đơn cần xử lý ở tab nền rồi chạy tiếp
      tab = await chrome.tabs.create({ url: 'https://banhang.shopee.vn/portal/sale/order?type=toship&source=to_process&sort_by=ship_by_date_asc', active: false });
      await waitTabComplete(tab.id);
      await new Promise((r) => setTimeout(r, 2000)); // chờ trang khởi tạo phiên
    }
    tab = await waitTabComplete(tab.id);
    if (!tab.url || !tab.url.startsWith(SELLER_ORIGIN)) {
      throw new Error('Bạn chưa đăng nhập Kênh Người Bán Shopee. Hãy mở banhang.shopee.vn và đăng nhập.');
    }
    cachedTabId = tab.id;
    return tab.id;
  }

  // Hàm này được inject và chạy trong tab Shopee.
  function pageFetch(url, method, body) {
    return fetch(url, {
      method,
      credentials: 'include',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json'
      },
      body: body == null ? undefined : JSON.stringify(body)
    })
      .then(async (r) => ({ status: r.status, text: await r.text() }))
      .catch((e) => ({ status: 0, text: '', error: String(e) }));
  }

  async function getSpcCds() {
    const c = await chrome.cookies.get({ url: SELLER_ORIGIN, name: 'SPC_CDS' });
    return (c && c.value) || '';
  }

  async function request(method, path, { params = {}, body = null } = {}) {
    const tabId = await getSellerTab();
    const spc = await getSpcCds();
    const qs = new URLSearchParams({ SPC_CDS: spc, SPC_CDS_VER: '2', version: '3.1.0' });
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const url = `${SELLER_ORIGIN}${path}?${qs.toString()}`;

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageFetch,
      args: [url, method, body]
    });
    const result = injection && injection.result;
    if (!result) throw new Error('Không chạy được request trong tab Shopee');
    if (result.error) throw new Error('Lỗi mạng: ' + result.error);
    if (result.status === 401 || result.status === 403) {
      throw new Error(`Shopee từ chối (HTTP ${result.status}). Hãy đăng nhập lại Kênh Người Bán.`);
    }

    let json;
    try {
      json = JSON.parse(result.text);
    } catch (e) {
      throw new Error(`Phản hồi không phải JSON (HTTP ${result.status})`);
    }
    const code = json.code ?? json.error ?? 0;
    if (code) {
      const err = new Error(json.message || json.msg || json.err_msg || `Shopee trả lỗi code ${code}`);
      err.code = code;
      err.response = json;
      throw err;
    }
    return json.data;
  }

  const LIST_TYPES = { all: 0, next: 1, current: 2, end: 3 };

  const flashSale = {
    // Khung giờ Flash Sale còn trống của shop trong `days` ngày tới.
    async timeSlots(days = 30) {
      const now = Math.floor(Date.now() / 1000);
      const d = await request('GET', '/api/marketing/v4/shop_flash_sale/time_slot/', {
        params: { start_time: now, end_time: now + days * 86400 }
      });
      const list = Array.isArray(d) ? d : (d && (d.time_slot_list || d.list)) || [];
      return list
        .map((s) => ({ id: Number(s.timeslot_id ?? s.time_slot_id), start: Number(s.start_time), end: Number(s.end_time) }))
        .sort((a, b) => a.start - b.start);
    },

    async list(type = 'next', offset = 0, limit = 50) {
      const d = await request('GET', '/api/marketing/v4/shop_flash_sale/list/', {
        params: { offset, limit, type: LIST_TYPES[type] ?? 0 }
      });
      return (d && d.flash_sale_list) || [];
    },

    async listAll(type = 'next', maxPages = 10) {
      const all = [];
      for (let page = 0; page < maxPages; page++) {
        const part = await this.list(type, page * 50, 50);
        all.push(...part);
        if (part.length < 50) break;
      }
      return all;
    },

    async get(flashSaleId) {
      return request('GET', '/api/marketing/v4/shop_flash_sale/get/', {
        params: { flash_sale_id: Number(flashSaleId) }
      });
    },

    // Toàn bộ sản phẩm/phân loại đang có trong 1 Flash Sale.
    async getItems(flashSaleId) {
      const items = [];
      const itemInfo = [];
      let modelInfo = [];
      for (let offset = 0; offset < 2000; offset += 100) {
        const d = await request('GET', '/api/marketing/v4/shop_flash_sale/batch_items/get', {
          params: { flash_sale_id: Number(flashSaleId), offset, limit: 100 }
        });
        const part = (d && d.items) || [];
        items.push(...part);
        itemInfo.push(...((d && d.item_info) || []));
        if (d && d.model_info_str) {
          try { modelInfo = modelInfo.concat(JSON.parse(d.model_info_str) || []); } catch (e) { /* bỏ qua */ }
        }
        if (part.length < 100) break;
      }
      return { items, itemInfo, modelInfo };
    },

    async create(timeSlotId) {
      return request('POST', '/api/marketing/v4/shop_flash_sale/set/', {
        body: { time_slot_id: Number(timeSlotId) }
      });
    },

    // Xoá FS sắp diễn ra: Shopee dùng chính lệnh set/ với status 0 (DELETED; 1 = bật, 2 = tắt)
    async remove(flashSaleId, timeSlotId) {
      return request('POST', '/api/marketing/v4/shop_flash_sale/set/', {
        body: { flash_sale_id: Number(flashSaleId), time_slot_id: Number(timeSlotId), status: 0 }
      });
    },

    async setItems(flashSaleId, items) {
      return request('POST', '/api/marketing/v4/shop_flash_sale/batch_items/set/', {
        body: { flash_sale_id: Number(flashSaleId), items, use_global_category: true }
      });
    },

    async setSequence(flashSaleId, displaySequenceList) {
      return request('POST', '/api/marketing/v4/shop_flash_sale/item_seq/', {
        body: { flash_sale_id: Number(flashSaleId), display_sequence_list: displaySequenceList }
      });
    }
  };

  // Nghiệp vụ Flash Sale dùng chung cho giao diện và chạy ngầm.

  // Thứ tự hiển thị theo thứ tự sản phẩm trong danh sách.
  function toSequence(items) {
    const seen = [];
    for (const it of items) {
      const id = Number(it.item_id ?? it.itemId);
      if (!seen.includes(id)) seen.push(id);
    }
    return seen.map((item_id, i) => ({ item_id, display_sequence: i + 1 }));
  }

  async function findFlashSaleIdBySlot(slotId) {
    const upcoming = await flashSale.listAll('next');
    const found = upcoming.find((f) => Number(f.timeslot_id) === Number(slotId));
    return found ? found.flash_sale_id : null;
  }

  // Tạo Flash Sale cho 1 khung giờ (hoặc cập nhật FS có sẵn) và đăng ký sản phẩm.
  async function registerFlashSale({ slotId, flashSaleId, items, sequence, onLog = () => {} }) {
    let id = flashSaleId;
    if (!id) {
      try {
        const d = await flashSale.create(slotId);
        id = d && d.flash_sale_id;
      } catch (e) {
        // Có thể khung giờ đã có FS rồi -> thử tìm lại.
        id = await findFlashSaleIdBySlot(slotId);
        if (!id) throw e;
        onLog('warn', `Khung giờ ${slotId} đã có Flash Sale #${id}, sẽ thêm sản phẩm vào FS này`);
      }
      if (!id) throw new Error(`Không tạo được Flash Sale cho khung giờ ${slotId}`);
      await sleep(800);
    }

    let res = await flashSale.setItems(id, items);
    let failed = (res && res.failed_items) || [];

    // Thử lại một lần cho các phân loại lỗi.
    if (failed.length && failed.length < items.length) {
      await sleep(1500);
      const retry = items.filter((it) =>
        failed.some((f) => Number(f.item_id) === it.item_id && Number(f.model_id) === it.model_id));
      res = await flashSale.setItems(id, retry);
      failed = (res && res.failed_items) || [];
    }

    if (sequence && sequence.length) {
      await sleep(600);
      try {
        await flashSale.setSequence(id, sequence);
      } catch (e) {
        onLog('warn', `FS #${id}: không sắp xếp được thứ tự sản phẩm (${e.message})`);
      }
    }

    return { flashSaleId: id, failed, okCount: items.length - failed.length };
  }

  function describeFailed(f) {
    const reason = f.err_msg || f.error_msg || f.message || f.reason || f.err_code || f.error || f.code || '';
    return `SP ${f.item_id} / PL ${f.model_id}${reason !== '' ? ': ' + reason : ''}`;
  }

  // Lưu cấu hình, mẫu tự động và nhật ký vào chrome.storage.local.
  // Khóa có tiền tố fs_ để không trùng dữ liệu của extension chính.


  const DEFAULT_SETTINGS = {
    autoEnabled: true,
    intervalMinutes: 60
  };

  async function getSettings() {
    const { fs_settings: settings } = await chrome.storage.local.get('fs_settings');
    return { ...DEFAULT_SETTINGS, ...(settings || {}) };
  }

  async function getRules() {
    const { fs_rules: rules } = await chrome.storage.local.get('fs_rules');
    return rules || [];
  }

  async function saveRules(rules) {
    await chrome.storage.local.set({ fs_rules: rules });
  }

  // Đọc lại danh sách mới nhất rồi mới ghi, tránh ghi đè chỉnh sửa khác.
  async function patchRule(id, patch) {
    const rules = await getRules();
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rules[idx] = { ...rules[idx], ...patch };
    await saveRules(rules);
    return rules[idx];
  }

  async function getLogs() {
    const { fs_logs: logs } = await chrome.storage.local.get('fs_logs');
    return logs || [];
  }

  async function addLog(level, message) {
    const logs = await getLogs();
    logs.push({ time: Date.now(), level, message });
    await chrome.storage.local.set({ fs_logs: logs.slice(-300) });
  }

  // Tự động đăng ký Flash Sale theo "mẫu" (rule) cho các khung giờ còn trống.

  let running = false;

  function hourInRange(hour, from, to) {
    return from <= to ? hour >= from && hour <= to : hour >= from || hour <= to;
  }

  async function runRule(rule) {
    const now = Math.floor(Date.now() / 1000);
    const daysAhead = Math.max(1, Number(rule.daysAhead) || 3);
    const minLead = Math.max(0, Number(rule.minLeadHours) || 0);
    const maxPerRun = Math.max(1, Number(rule.maxPerRun) || 3);
    const registered = rule.registered || [];

    const [slots, upcoming] = await Promise.all([
      flashSale.timeSlots(daysAhead + 1),
      flashSale.listAll('next')
    ]);
    const usedSlotIds = new Set(upcoming.map((f) => Number(f.timeslot_id)));

    const candidates = slots
      .filter((s) => {
        const hour = new Date(s.start * 1000).getHours();
        return hourInRange(hour, Number(rule.hourFrom) || 0, Number(rule.hourTo ?? 23))
          && s.start - now >= minLead * 3600
          && s.start - now <= daysAhead * 86400
          && !usedSlotIds.has(s.id)
          && !registered.includes(s.id);
      })
      .slice(0, maxPerRun);

    if (!candidates.length) {
      await patchRule(rule.id, { lastRun: Date.now(), lastResult: 'Không có khung giờ mới phù hợp' });
      return { created: 0 };
    }

    const items = rule.items || [];
    const sequence = rule.sequence && rule.sequence.length ? rule.sequence : toSequence(items);
    const newlyRegistered = [];
    let created = 0;

    for (const slot of candidates) {
      const when = new Date(slot.start * 1000).toLocaleString('vi-VN');
      try {
        const res = await registerFlashSale({
          slotId: slot.id,
          items,
          sequence,
          onLog: (level, msg) => addLog(level, `[${rule.name}] ${msg}`)
        });
        created++;
        newlyRegistered.push(slot.id);
        await addLog(res.failed.length ? 'warn' : 'success',
          `[${rule.name}] Đã tạo FS #${res.flashSaleId} lúc ${when}: ${res.okCount}/${items.length} phân loại thành công`
          + (res.failed.length ? `. Lỗi: ${res.failed.slice(0, 5).map(describeFailed).join('; ')}` : ''));
      } catch (e) {
        await addLog('error', `[${rule.name}] Lỗi khung giờ ${when}: ${e.message}`);
      }
      await sleep(2000);
    }

    const latest = (await getRules()).find((r) => r.id === rule.id) || rule;
    await patchRule(rule.id, {
      registered: [...(latest.registered || []), ...newlyRegistered].slice(-500),
      lastRun: Date.now(),
      lastResult: `Đã tạo ${created}/${candidates.length} Flash Sale`
    });
    return { created };
  }

  async function runAllRules({ onlyId = null } = {}) {
    if (running) return { skipped: true };
    running = true;
    let total = 0;
    try {
      const rules = (await getRules()).filter((r) => (onlyId ? r.id === onlyId : r.enabled));
      for (const rule of rules) {
        try {
          const { created } = await runRule(rule);
          total += created;
        } catch (e) {
          await addLog('error', `[${rule.name}] ${e.message}`);
          await patchRule(rule.id, { lastRun: Date.now(), lastResult: 'Lỗi: ' + e.message });
        }
      }
    } finally {
      running = false;
    }
    return { created: total };
  }

  // Phần chạy ngầm của Flash Sale Tool (tự động đăng ký theo mẫu).
  // File này là ES module, được rollup đóng gói thành fs-background.bundle.js
  // (script thường) để background chính nạp bằng importScripts:
  //   npm run build:fs

  const ALARM = 'fsAutoRegister';

  async function syncAlarm() {
    const settings = await getSettings();
    const rules = await getRules();
    await chrome.alarms.clear(ALARM);
    if (settings.autoEnabled && rules.some((r) => r.enabled)) {
      const minutes = Math.max(15, Number(settings.intervalMinutes) || 60);
      await chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: minutes });
    }
  }

  chrome.runtime.onInstalled.addListener(syncAlarm);
  chrome.runtime.onStartup.addListener(syncAlarm);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.fs_settings || changes.fs_rules)) syncAlarm();
  });

  async function runAndNotify(onlyId) {
    const res = await runAllRules({ onlyId });
    if (res.created > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('extension/flash-sale/icon.png'),
        title: 'Flash Sale Tool',
        message: `Đã tự động tạo ${res.created} Flash Sale mới`
      });
    }
    return res;
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) runAndNotify(null);
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'FS_RUN_RULES') {
      runAndNotify(msg.ruleId || null)
        .then((res) => sendResponse({ ok: true, ...res }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });

})();
