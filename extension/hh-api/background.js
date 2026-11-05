// Hàng hoàn API: đọc / cập nhật sheet HH API trong bảng tính web và tự cập nhật 100 yêu cầu mới nhất mỗi ngày.
// Chạy trong service worker chính (importScripts sau hh-api/returns.js).
(() => {
  const R = self.HHReturns;
  const quote = (t) => `'${String(t).replace(/'/g, "''")}'`;
  const colName = (n) => { let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const p2 = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

  const AUTO_KEY = 'hh_api_auto';          // { enabled, time: 'HH:MM' }
  const AUTO_LAST = 'hh_api_auto_last';    // kết quả lần tự cập nhật gần nhất
  const PAGE_LIMIT_KEY = 'hh_api_page_limit'; // Số trang lấy ở tab 1 (40 yêu cầu/trang)
  const DEFAULT_AUTO = { enabled: true, time: '10:00' };
  const CODE_KEYS = ['hh_api_code', 'tcdd-shop-code', 'maGian', 'dhHoanTextValue'];

  // ---------- Google Sheet ----------

  async function context() {
    const spreadsheetId = self.SHARED_GOOGLE_CONFIG.webSpreadsheetId;
    if (!spreadsheetId) throw new Error('Chưa cấu hình bảng tính web');
    const token = await getGoogleAccessToken();
    const meta = await fetchSpreadsheetMetadata(token, spreadsheetId);
    const sheet = (meta.sheets || []).find((s) => s.properties.title.trim() === R.SHEET_TITLE);
    return { spreadsheetId, token, sheet };
  }

  async function api(ctx, path, body, method = 'POST') {
    const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${ctx.spreadsheetId}${path}`, {
      method,
      headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }, 60000);
    if (!res.ok) throw new Error(data.error?.message || 'Không cập nhật được Sheet HH API');
    return data;
  }

  async function readValues(ctx) {
    if (!ctx.sheet) return [];
    return fetchSheetValues(quote(ctx.sheet.properties.title), ctx.token, 30000, ctx.spreadsheetId);
  }

  async function read() {
    const ctx = await context();
    if (!ctx.sheet) return { values: [], missing: true };
    const values = await readValues(ctx);
    if (values.length && !values[0].includes('ID dòng')) return { values: [], oldFormat: true };
    return { values };
  }

  // Bảo đảm sheet có đúng tiêu đề HEADERS, trả về giá trị hiện có (đọc 1 lần)
  async function prepareSheet(ctx) {
    let values = await readValues(ctx);
    if (ctx.sheet && values.length && !values[0].includes('ID dòng')) {
      // Sheet của module cũ: đổi tên để lưu lại, không xóa
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      await api(ctx, ':batchUpdate', { requests: [{ updateSheetProperties: { properties: { sheetId: ctx.sheet.properties.sheetId, title: `HH API cu ${stamp}` }, fields: 'title' } }] });
      ctx.sheet = null;
      values = [];
    }
    if (!ctx.sheet) {
      const added = await api(ctx, ':batchUpdate', { requests: [{ addSheet: { properties: { title: R.SHEET_TITLE, gridProperties: { frozenRowCount: 1, columnCount: R.HEADERS.length } } } }] });
      ctx.sheet = added.replies[0].addSheet;
    }
    const head = values[0] || [];
    const sameHead = R.HEADERS.every((h, i) => head[i] === h);
    if (!sameHead) {
      // Chỉ tự sửa khi tiêu đề là bản trước (thiếu cột Khóa ở cuối); cấu trúc khác thì dừng để không ghi lệch cột
      const prefixOk = head.length && head.every((h, i) => !h || h === R.HEADERS[i]);
      if (head.length && !prefixOk) throw new Error('Tiêu đề Sheet HH API khác cấu trúc module, chưa ghi để tránh lệch cột');
      const grid = ctx.sheet.properties.gridProperties || {};
      if ((grid.columnCount || 0) < R.HEADERS.length) {
        await api(ctx, ':batchUpdate', { requests: [{ appendDimension: { sheetId: ctx.sheet.properties.sheetId, dimension: 'COLUMNS', length: R.HEADERS.length - (grid.columnCount || 0) } }] });
      }
      await api(ctx, `/values/${encodeURIComponent(`${quote(R.SHEET_TITLE)}!A1`)}?valueInputOption=RAW`, { values: [R.HEADERS] }, 'PUT');
      values = [R.HEADERS, ...values.slice(1)];
    }
    return values;
  }

  // Thêm đơn mới ở cuối, cập nhật đúng dòng đã đổi, bỏ qua dòng không đổi. Ghi RAW để mã số dài không bị đổi.
  async function upsert(rows) {
    const ctx = await context();
    const values = await prepareSheet(ctx);
    const diff = R.diffRows(values, rows);
    const last = colName(R.HEADERS.length - 1);
    if (diff.update.length) {
      await api(ctx, '/values:batchUpdate', {
        valueInputOption: 'RAW',
        data: diff.update.map((u) => ({ range: `${quote(R.SHEET_TITLE)}!A${u.row}:${last}${u.row}`, values: [u.values] }))
      });
    }
    if (diff.append.length) {
      await api(ctx, `/values/${encodeURIComponent(`${quote(R.SHEET_TITLE)}!A1:${last}1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: diff.append });
    }
    return { added: diff.append.length, updated: diff.update.length, unchanged: diff.unchanged };
  }

  // ---------- Sheet HH_SHOP_DIEN (bảng tính kho, cấu trúc cột riêng) ----------
  // Chỉ Trả hàng + Giao không thành công. Khóa = mdh + sku (10 ký tự đầu SKU phân loại).
  // Chưa có -> thêm dòng (CHỜ XÁC NHẬN); đã có -> chỉ điền ô đang trống, không ghi đè dữ liệu kho đã nhập.
  const SHOP_DIEN = { spreadsheetId: '1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo', title: 'HH_SHOP_DIEN' };
  // Map mdh -> mvd từ sheet DH (chỉ đọc 2 cột mdh, mvd)
  async function dhTracking(mdhs) {
    const out = new Map();
    if (!mdhs.length) return out;
    const id = self.SHARED_GOOGLE_CONFIG.webSpreadsheetId, token = await getGoogleAccessToken();
    const [head = []] = await fetchSheetValues('DH!1:1', token, 30000, id);
    const a = head.indexOf('mdh'), b = head.indexOf('mvd');
    if (a < 0 || b < 0) return out;
    const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet?ranges=${encodeURIComponent(`DH!${colName(a)}2:${colName(a)}`)}&ranges=${encodeURIComponent(`DH!${colName(b)}2:${colName(b)}`)}&majorDimension=COLUMNS`, { headers: { Authorization: `Bearer ${token}` } }, 60000);
    if (!res.ok) return out;
    const [m = [], v = []] = (data.valueRanges || []).map((x) => x.values?.[0] || []);
    const want = new Set(mdhs);
    m.forEach((x, i) => { if (want.has(String(x)) && v[i] && !out.has(String(x))) out.set(String(x), String(v[i])); });
    return out;
  }
  async function upsertShopDien(rows) {
    const token = await getGoogleAccessToken();
    const ctx = { spreadsheetId: SHOP_DIEN.spreadsheetId, token };
    const values = await fetchSheetValues(quote(SHOP_DIEN.title), token, 30000, SHOP_DIEN.spreadsheetId);
    const head = (values[0] || []).map((h) => String(h).trim());
    for (const h of ['id', 'mdh', 'sku']) if (!head.includes(h)) throw new Error(`Sheet HH_SHOP_DIEN thiếu cột ${h}`);
    const col = (h) => head.indexOf(h), H = (r, h) => r[R.HEADERS.indexOf(h)] ?? '';
    const p2 = (n) => String(n).padStart(2, '0'), now = new Date();
    const created = `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())} ${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()}`;
    // Mỗi mã đơn chỉ 1 dòng (đơn có nhiều yêu cầu trả cũng chỉ ghi 1 lần)
    const byKey = new Map();
    values.slice(1).forEach((r, i) => {
      const mdh = String(r[col('mdh')] ?? '').trim();
      if (mdh && !byKey.has(mdh)) byKey.set(mdh, { row: i + 2, cells: r });
    });
    // mvd trống: tra theo mdh trong sheet DH
    const mvdOf = await dhTracking(rows.filter((r) => !H(r, 'Vận đơn giao')).map((r) => String(H(r, 'Mã đơn')).trim())).catch(() => new Map());
    const seen = new Set(), append = [], updates = [];
    let id = Date.now(), unchanged = 0;
    for (const r of rows) {
      const type = H(r, 'Loại');
      if (type !== 'Trả hàng/Hoàn tiền' && type !== 'Giao không thành công') continue;
      const sku = String(H(r, 'SKU phân loại') || H(r, 'SKU sản phẩm')).trim().slice(0, 10).toUpperCase();
      const mdh = String(H(r, 'Mã đơn')).trim();
      if (!mdh || seen.has(mdh)) continue;
      seen.add(mdh);
      const data = {
        // Ngày trả = ngày của "Cập nhật vận chuyển" (dd/mm/yyyy), không có thì Ngày hoàn hàng
        ngay_tra: String(H(r, 'Cập nhật vận chuyển')).split(' ')[0] || H(r, 'Ngày hoàn hàng'),
        mvd: H(r, 'Vận đơn giao') || mvdOf.get(mdh) || '', mdh, ma_gian: H(r, 'Mã gian'), sku, ten_sp: H(r, 'Tên sản phẩm'),
        // Mã hoàn: bỏ khi chỉ hoàn tiền (trạng thái hoàn "Không có" hoặc trùng vận đơn giao) — dữ liệu Sheet HH API cũ có thể còn sai
        mvd_tra: /^không có$/i.test(String(H(r, 'Trạng thái hoàn')).trim()) || H(r, 'Vận đơn hoàn') === H(r, 'Vận đơn giao') ? '' : H(r, 'Vận đơn hoàn'),
        sku_tra: sku, sl: String(H(r, 'Số lượng')), hoan_tra: type === 'Giao không thành công' ? 'Hoàn' : 'Trả'
      };
      const hit = byKey.get(mdh);
      if (!hit) {
        Object.assign(data, { id: String(id++), ngay_tao: created, xac_nhan: 'CHỜ XÁC NHẬN', nguoi_nhap: 'HH API' });
        append.push(head.map((h) => data[h] ?? ''));
        continue;
      }
      // Đã có: cập nhật các cột lấy từ Shopee khi khác (không ghi ô rỗng đè; không đụng id, ngay_tao, ghi_chu, xac_nhan, nguoi_nhap, anh)
      const fill = Object.entries(data).filter(([h, v]) => col(h) >= 0 && v !== '' && String(hit.cells[col(h)] ?? '').trim() !== String(v).trim());
      if (!fill.length) { unchanged++; continue; }
      for (const [h, v] of fill) updates.push({ range: `${quote(SHOP_DIEN.title)}!${colName(col(h))}${hit.row}`, values: [[v]] });
    }
    if (updates.length) await api(ctx, '/values:batchUpdate', { valueInputOption: 'RAW', data: updates });
    if (append.length) {
      await api(ctx, `/values/${encodeURIComponent(`${quote(SHOP_DIEN.title)}!A1:${colName(head.length - 1)}1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: append });
    }
    const rowsTouched = new Set(updates.map((u) => u.range.replace(/^.*?(\d+)$/, '$1'))).size;
    return { added: append.length, updated: rowsTouched, unchanged };
  }

  // ---------- Ghi N đơn mới nhất trong bảng tab 1 (lần đọc Shopee gần nhất) sang sheet ----------
  // Hai đích: HH API (mọi loại) và HH_SHOP_DIEN (Trả hàng + Giao không thành công). Cài đặt { count, auto, min } lưu theo key.
  const RETURN_TYPES = ['Trả hàng/Hoàn tiền', 'Giao không thành công'];
  const TARGETS = {
    hh: { key: 'hh_api_sheet', last: 'hh_api_sheet_last', alarm: 'hh-api-sheet', types: null, write: (rows) => upsert(rows) },
    sd: { key: 'hh_shop_dien', last: 'hh_shop_dien_last', alarm: 'hh-shop-dien', types: RETURN_TYPES, write: (rows) => upsertShopDien(rows) }
  };
  async function tableRows() {
    const st = await chrome.storage.local.get(['hh_api_table', AUTO_LAST]);
    const a = st.hh_api_table, b = st[AUTO_LAST];
    const pickB = Array.isArray(b?.rows) && b.rows.length && (!a?.rows?.length || (b.at || 0) > (a.at || 0));
    return (pickB ? b.rows : a?.rows) || [];
  }
  async function writeTop(target, code, count) {
    const t = TARGETS[target];
    if (!t) throw new Error('Đích ghi không hợp lệ');
    if (!code) throw new Error('Chưa có Mã gian');
    const H = (r, h) => r[R.HEADERS.indexOf(h)] ?? '';
    const want = (await tableRows()).filter((r) => String(H(r, 'Mã gian')).toUpperCase() === code && (!t.types || t.types.includes(H(r, 'Loại'))));
    if (!want.length) throw new Error('Bảng bên dưới chưa có đơn phù hợp (bấm Đọc từ Shopee trước)');
    // Mới nhất theo Ngày hoàn hàng, rồi Ngày đặt đơn; lấy N đơn (mọi dòng sản phẩm của đơn đó)
    const time = (r) => R.timeValue(H(r, 'Ngày hoàn hàng')) || R.timeValue(H(r, 'Ngày đặt đơn'));
    want.sort((x, y) => time(y) - time(x));
    const orders = [...new Set(want.map((r) => H(r, 'Mã đơn')))].slice(0, Math.max(1, count || 50));
    const keep = new Set(orders);
    return { orders: orders.length, ...(await t.write(want.filter((r) => keep.has(H(r, 'Mã đơn'))))) };
  }

  // ---------- Shopee (chạy trong tab banhang.shopee.vn đã đăng nhập) ----------

  async function sellerTab() {
    const tabs = await chrome.tabs.query({ url: 'https://banhang.shopee.vn/*' });
    return tabs.find((t) => t.status === 'complete' && !t.discarded) || null;
  }

  async function shopee(tabId, path, body, params = {}) {
    const cookie = await chrome.cookies.get({ url: 'https://banhang.shopee.vn', name: 'SPC_CDS' });
    const qs = new URLSearchParams({ SPC_CDS: cookie?.value || '', SPC_CDS_VER: '2', ...params });
    const url = `https://banhang.shopee.vn${path}?${qs}`;
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [url, body ?? null],
      func: (u, b) => fetch(u, {
        method: b ? 'POST' : 'GET', credentials: 'include',
        headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined
      }).then((r) => r.json()).catch((e) => ({ error: -1, error_msg: String(e) }))
    });
    const json = res?.result;
    if (!json) throw new Error('Không chạy được request trong tab Shopee');
    const code = json.code ?? json.error ?? 0;
    if (code) throw new Error(json.error_msg || json.message || json.msg || `Shopee trả lỗi ${code}`);
    return json.data;
  }

  async function readLatest(tabId, code, limit) {
    const shop = await shopee(tabId, '/api/selleraccount/shop_info/');
    const shopId = shop?.shop_id || shop?.shopid;
    const syncedAt = new Date().toLocaleString('vi-VN');
    const cases = [];
    const seen = new Set();
    for (let page = 1; cases.length < limit && page <= R.MAX_PAGES; page++) {
      let data;
      for (let attempt = 0; ; attempt++) {
        try {
          data = await shopee(tabId, R.LIST_PATH, { ...R.LIST_BODY, page_number: page });
          break;
        } catch (e) {
          if (attempt >= 3) throw e;
          await sleep(1500 * (attempt + 1));
        }
      }
      const list = data?.exceptional_case_list || [];
      for (const c of list) {
        const id = R.caseId(c);
        if (seen.has(id) || cases.length >= limit) continue;
        seen.add(id);
        cases.push(c);
      }
      if (list.length < R.PAGE_SIZE || data?.pagination_info?.has_more === false) break;
      await sleep(250);
    }
    return { shopName: shop?.name || shop?.shop_name || '', cases: cases.length, rows: cases.flatMap((c) => R.caseToRows(c, { code, shopId, syncedAt })) };
  }

  // ---------- Tự cập nhật hằng ngày ----------

  let autoRunning = null;

  async function autoSettings() {
    const store = await chrome.storage.local.get([AUTO_KEY, AUTO_LAST, PAGE_LIMIT_KEY, ...CODE_KEYS]);
    const code = String(CODE_KEYS.map((k) => store[k]).find((v) => String(v || '').trim()) || '').trim().toUpperCase();
    const pages = Math.min(R.MAX_PAGES, Math.max(1, parseInt(store[PAGE_LIMIT_KEY], 10) || 1));
    return { settings: { ...DEFAULT_AUTO, ...(store[AUTO_KEY] || {}) }, last: store[AUTO_LAST] || null, code, pages };
  }

  // Đến giờ (hoặc đã quá giờ) mà hôm nay chưa chạy xong thì chạy; force = bấm tay
  async function autoCheck(force = false) {
    if (autoRunning) return autoRunning;
    const { settings, last, code, pages } = await autoSettings();
    if (!force) {
      if (!settings.enabled) return { skipped: 'off' };
      const [h, m] = String(settings.time || '10:00').split(':').map(Number);
      const now = new Date();
      if (now.getHours() * 60 + now.getMinutes() < (h || 0) * 60 + (m || 0)) return { skipped: 'early' };
      if (last?.ok && last.date === today()) return { skipped: 'done' };
    }
    autoRunning = (async () => {
      const base = { date: today(), at: Date.now() };
      try {
        if (!code) throw new Error('Chưa có Mã gian. Nhập Mã gian ở Hàng hoàn API.');
        const tab = await sellerTab();
        if (!tab) {
          // Chưa mở Shopee: giữ trạng thái chờ, lần kiểm tra sau chạy lại
          const result = { ...base, ok: false, waiting: true, error: 'Chờ mở Kênh Người Bán Shopee (banhang.shopee.vn)' };
          await chrome.storage.local.set({ [AUTO_LAST]: { ...(last || {}), ...result, rows: last?.rows || [] } });
          return result;
        }
        await chrome.storage.local.set({ [AUTO_LAST]: { ...(last || {}), running: true, at: Date.now() } });
        const read = await readLatest(tab.id, code, pages * R.PAGE_SIZE);
        const saved = await upsert(read.rows);
        const result = { ...base, ok: true, code, pages, shopName: read.shopName, cases: read.cases, ...saved, rows: read.rows };
        await chrome.storage.local.set({ [AUTO_LAST]: result });
        return result;
      } catch (e) {
        const result = { ...base, ok: false, error: e.message, rows: last?.rows || [] };
        await chrome.storage.local.set({ [AUTO_LAST]: result });
        return result;
      }
    })().finally(() => { autoRunning = null; });
    return autoRunning;
  }

  chrome.alarms.create('hh-api-auto', { periodInMinutes: 15 });
  // Tự ghi theo chu kỳ (số phút người dùng nhập) cho từng đích
  async function runAuto(target) {
    const t = TARGETS[target], cfg = (await chrome.storage.local.get(t.key))[t.key];
    if (!cfg?.auto) return;
    const { code } = await autoSettings();
    if (!code) return;
    try {
      const r = await writeTop(target, code, Number(cfg.count) || 50);
      await chrome.storage.local.set({ [t.last]: { at: Date.now(), ok: true, code, added: r.added, updated: r.updated } });
    } catch (e) {
      await chrome.storage.local.set({ [t.last]: { at: Date.now(), ok: false, code, error: e.message } });
    }
  }
  async function schedule(target) {
    const t = TARGETS[target], cfg = (await chrome.storage.local.get(t.key))[t.key];
    const min = Math.max(1, Number(cfg?.min) || 15), cur = await chrome.alarms.get(t.alarm);
    // Service worker khởi động lại thường xuyên: chỉ tạo lại khi đổi cài đặt, không làm lùi lịch
    if (!cfg?.auto) { if (cur) await chrome.alarms.clear(t.alarm); return; }
    if (!cur || cur.periodInMinutes !== min) chrome.alarms.create(t.alarm, { periodInMinutes: min });
  }
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === 'hh-api-auto') autoCheck();
    for (const k of Object.keys(TARGETS)) if (a.name === TARGETS[k].alarm) runAuto(k);
  });
  Object.keys(TARGETS).forEach(schedule);
  chrome.runtime.onStartup.addListener(() => autoCheck());

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    const handle = (p) => { p.then((r) => reply({ ok: true, ...r })).catch((e) => reply({ ok: false, error: e.message })); return true; };
    if (msg?.type === 'HH_API_READ') return handle(read());
    if (msg?.type === 'HH_API_UPSERT') return handle(upsert(msg.rows || []));
    if (msg?.type === 'HH_API_SHOP_DIEN') return handle(upsertShopDien(msg.rows || []));
    // Đổi cài đặt tự ghi: đặt lại lịch và chạy ngay 1 lần
    if (msg?.type === 'HH_API_SYNC_AUTO') return handle(schedule(msg.target).then(() => runAuto(msg.target)).then(() => ({})));
    if (msg?.type === 'HH_API_SYNC_TOP') return handle(writeTop(msg.target, String(msg.code || '').trim().toUpperCase(), Number(msg.count) || 50));
    if (msg?.type === 'HH_API_UPDATE_TOP') return handle((async () => {
      const { code } = await autoSettings();
      if (!code) throw new Error('Chưa có Mã gian. Nhập Mã gian ở tab 1.');
      const tab = await sellerTab();
      if (!tab) throw new Error('Chưa mở Kênh Người Bán Shopee (banhang.shopee.vn)');
      const count = Math.min(R.MAX_PAGES * R.PAGE_SIZE, Math.max(1, parseInt(msg.count, 10) || 100));
      const read = await readLatest(tab.id, code, count);
      return { cases: read.cases, ...(await upsert(read.rows)) };
    })());
    if (msg?.type === 'HH_API_AUTO_CHECK') return handle(autoCheck(false).then((r) => ({ result: r })));
    if (msg?.type === 'HH_API_AUTO_RUN') return handle(autoCheck(true).then((r) => ({ result: r })));
    return false;
  });
})();
