// Hẹn giờ sao chép sản phẩm (nạp bằng importScripts trong extension/background.js).
// Sheet HEN_GIO_SAO_CHEP (file sheet của extension): mỗi dòng = 1 link sản phẩm × 1 gian × 1 thời điểm.
// Mỗi phút: dòng "Chờ đăng" đã tới giờ và đúng Mã gian đang dùng trên Chrome → mở trang sản phẩm (tab nền)
// + mở Sao chép sản phẩm với ?item=<id>, tự bấm "⚡ Tự động"; kết quả (scl_clone_result) ghi lại vào sheet.
// Dòng tới giờ nhưng Chrome đang ở gian khác: ghi Kết quả "chờ đăng nhập gian X", phút sau kiểm tra lại.
(() => {
  const SHEET = 'HEN_GIO_SAO_CHEP';
  const HEAD = ['ID', 'Link sản phẩm', 'Mã gian', 'Thời gian đăng', 'Trạng thái', 'Kết quả', 'Cập nhật lúc'];
  const ACTIVE = 'csch_active'; // { row, itemId, gian, productTab, appTab, startedAt }
  const TIMEOUT = 20 * 60e3;
  const q = `'${SHEET}'`;
  const p2 = (n) => String(n).padStart(2, '0');
  const nowText = () => { const d = new Date(); return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
  // "dd/mm/yyyy hh:mm" -> ms
  const parseTime = (s) => {
    const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/);
    return m ? new Date(+m[3], m[2] - 1, +m[1], +m[4], +m[5]).getTime() : 0;
  };
  const itemIdOf = (url) => {
    const m = String(url).match(/-i\.\d+\.(\d+)/) || String(url).match(/\/product\/\d+\/(\d+)/);
    return m ? m[1] : '';
  };

  async function ctx() {
    const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
    await ensureSheetExists(SHEET, token, sheetId);
    return { token, sheetId };
  }
  async function readAll(c) {
    const values = await fetchSheetValues(`${q}!A:G`, c.token, 30000, c.sheetId);
    if (!values.length || values[0][0] !== 'ID') await writeRange(c, `${q}!A1:G1`, [HEAD]);
    return values.slice(1).map((r, i) => ({ row: i + 2, id: r[0] || '', link: r[1] || '', gian: String(r[2] || '').trim().toUpperCase(), time: r[3] || '', status: r[4] || '', result: r[5] || '' }));
  }
  async function writeRange(c, range, values) {
    const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${c.sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT', headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values })
    }, 30000);
    if (!res.ok) throw new Error(data?.error?.message || 'Không ghi được sheet ' + SHEET);
  }
  const setStatus = (c, row, status, result) => writeRange(c, `${q}!E${row}:G${row}`, [[status, result, nowText()]]);
  const currentGian = async () => {
    const st = await chrome.storage.local.get(['tcdd-shop-code', 'maGian', 'dhHoanTextValue']);
    return String(st['tcdd-shop-code'] || st.maGian || st.dhHoanTextValue || '').trim().toUpperCase();
  };

  let ticking = false;
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const { [ACTIVE]: active } = await chrome.storage.local.get(ACTIVE);
      if (active) {
        if (Date.now() - active.startedAt < TIMEOUT) return; // đang chạy, chờ scl_clone_result
        const c = await ctx();
        await setStatus(c, active.row, 'Lỗi', 'Quá 20 phút chưa đăng xong (AI / Shopee không phản hồi)');
        await finish(active);
        return;
      }
      const c = await ctx();
      const rows = await readAll(c);
      const gian = await currentGian();
      const now = Date.now();
      for (const r of rows) {
        if (!(r.status === '' || r.status === 'Chờ đăng') || !r.link) continue;
        const at = parseTime(r.time);
        if (!at || at > now) continue;
        if (r.gian && r.gian !== gian) {
          const note = `Tới giờ nhưng Chrome đang ở gian ${gian || '(chưa đặt Mã gian)'} — chờ đăng nhập gian ${r.gian}`;
          if (r.result !== note) await setStatus(c, r.row, 'Chờ đăng', note);
          continue;
        }
        const itemId = itemIdOf(r.link);
        if (!itemId) { await setStatus(c, r.row, 'Lỗi', 'Link không phải trang sản phẩm Shopee'); continue; }
        await start(c, r, itemId, gian);
        return; // mỗi lần 1 sản phẩm
      }
    } catch (e) {
      console.warn('Hẹn giờ sao chép lỗi:', e);
    } finally { ticking = false; }
  }

  async function start(c, r, itemId, gian) {
    await setStatus(c, r.row, 'Đang đăng', `Bắt đầu ${nowText()} · gian ${gian}`);
    // SKU phân loại để trống; Sao chép sản phẩm tự bấm "⚡ Tự động" khi đã nạp xong sản phẩm này
    await chrome.storage.local.set({ [`modelSkus_${itemId}`]: {}, scl_auto_start: { itemId, at: Date.now() }, scl_clone_result: null });
    const productTab = await chrome.tabs.create({ url: r.link, active: false });
    await new Promise((res) => setTimeout(res, 5000)); // trang sản phẩm tải để bắt dữ liệu chi tiết
    const appTab = await chrome.tabs.create({ url: chrome.runtime.getURL(`extension/clone-tool/app.html?item=${itemId}`), active: false });
    await chrome.storage.local.set({ [ACTIVE]: { row: r.row, itemId, gian, productTab: productTab.id, appTab: appTab.id, startedAt: Date.now() } });
  }
  async function finish(active) {
    for (const id of [active.productTab, active.appTab]) if (id) await chrome.tabs.remove(id).catch(() => {});
    await chrome.storage.local.remove(ACTIVE);
  }

  // Kết quả từ Sao chép sản phẩm
  chrome.storage.onChanged.addListener(async (ch, area) => {
    if (area !== 'local' || !ch.scl_clone_result?.newValue) return;
    const res = ch.scl_clone_result.newValue;
    const { [ACTIVE]: active } = await chrome.storage.local.get(ACTIVE);
    if (!active || String(res.itemId) !== String(active.itemId)) return;
    try {
      const c = await ctx();
      await setStatus(c, active.row, res.ok ? 'Đã đăng' : 'Lỗi', res.ok ? `ID sản phẩm mới ${res.productId} · gian ${active.gian}` : res.error);
    } finally { await finish(active); }
  });

  // Trang Hẹn giờ: đọc / thêm / đổi trạng thái / xoá dòng
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (!msg || !String(msg.type).startsWith('CSCH_')) return false;
    (async () => {
      const c = await ctx();
      if (msg.type === 'CSCH_LIST') return { ok: true, rows: await readAll(c), gian: await currentGian() };
      if (msg.type === 'CSCH_ADD') {
        const rows = await readAll(c);
        const next = rows.length + 2;
        const add = (msg.rows || []).map((x, i) => [`HG${Date.now()}${i}`, x.link, String(x.gian || '').toUpperCase(), x.time, 'Chờ đăng', '', nowText()]);
        if (add.length) await writeRange(c, `${q}!A${next}:G${next + add.length - 1}`, add);
        tick();
        return { ok: true, added: add.length };
      }
      if (msg.type === 'CSCH_SET') { await setStatus(c, msg.row, msg.status, msg.result || ''); tick(); return { ok: true }; }
      if (msg.type === 'CSCH_DELETE') { await writeRange(c, `${q}!A${msg.row}:G${msg.row}`, [['', '', '', '', '', '', '']]); return { ok: true }; }
      return { ok: false, error: 'Lệnh không hợp lệ' };
    })().then(reply, (e) => reply({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true;
  });

  chrome.alarms.get('csch-tick', (a) => { if (!a) chrome.alarms.create('csch-tick', { periodInMinutes: 1 }); });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'csch-tick') tick(); });
})();
