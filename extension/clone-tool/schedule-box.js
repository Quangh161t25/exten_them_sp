// Khung "⏰ Hẹn giờ sao chép" trong trang Sao chép sản phẩm:
// tích gian + mã gian + thời gian → "Thêm vào lịch" ghi sản phẩm đang mở vào sheet HEN_GIO_SAO_CHEP
// (dùng chung lịch với trang Hẹn giờ sao chép — xử lý bởi extension/clone-schedule/background.js).
(() => {
  const $ = (s) => document.querySelector(s);
  const box = $('#schBox');
  if (!box) return;
  const p2 = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toSheetTime = (v) => { const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : ''; };
  const defTime = (addMin) => { const t = new Date(Date.now() + addMin * 60e3); return `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}T${p2(t.getHours())}:${p2(t.getMinutes())}`; };
  const ONKEY = 'scl_sch_gian_on';
  const loadOn = () => { try { return JSON.parse(localStorage.getItem(ONKEY) || '{}'); } catch { return {}; } };
  const saveOn = () => { try { localStorage.setItem(ONKEY, JSON.stringify(Object.fromEntries([...box.querySelectorAll('.sch-row')].map((d) => [d.querySelector('[data-k=gian]').value.trim().toUpperCase(), d.querySelector('[data-k=on]').checked])))); } catch {} };

  function addRow(code = '', on = true, time = '') {
    const d = document.createElement('div');
    d.className = 'sch-row';
    d.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0';
    d.innerHTML = `<input type="checkbox" data-k="on" ${on ? 'checked' : ''} title="Bật/tắt gian này">
      <input type="text" data-k="gian" value="${esc(code)}" placeholder="Mã gian" style="width:70px">
      <input type="datetime-local" data-k="time" value="${esc(time || defTime(10))}">
      <button type="button" class="btn" data-del title="Xoá dòng" style="padding:1px 7px">✕</button>`;
    d.querySelector('[data-del]').onclick = () => { d.remove(); saveOn(); };
    d.querySelector('[data-k=on]').onchange = saveOn;
    d.querySelector('[data-k=gian]').onchange = saveOn;
    $('#schRows').appendChild(d);
  }

  // Danh sách gian: cột "gian" sheet cai_dat; mặc định bật gian đang dùng
  (async () => {
    const st = await chrome.storage.local.get(['tcdd-shop-code', 'maGian', 'dhHoanTextValue']);
    const cur = String(st['tcdd-shop-code'] || st.maGian || st.dhHoanTextValue || '').trim().toUpperCase();
    let list = [];
    try {
      const res = await chrome.runtime.sendMessage({ type: 'FETCH_CAI_DAT' });
      const v = res?.values || [];
      const ci = (v[0] || []).findIndex((h) => String(h).trim().toLowerCase() === 'gian');
      if (ci >= 0) list = [...new Set(v.slice(1).map((r) => String(r[ci] || '').trim().toUpperCase()).filter(Boolean))];
    } catch {}
    if (!list.length) list = [cur || ''];
    const on = loadOn();
    list.forEach((g) => addRow(g, g in on ? on[g] : g === cur));
  })();

  $('#schAddRow').onclick = () => addRow('', true);

  $('#schAdd').onclick = async () => {
    const msg = $('#schMsg');
    const cur = window.__sclCurrent;
    if (!cur || !cur.itemId) { msg.textContent = 'Chưa có sản phẩm nguồn — mở một trang sản phẩm trên shopee.vn trước.'; return; }
    const link = `https://shopee.vn/product/${cur.shopId}/${cur.itemId}`;
    const gians = [...box.querySelectorAll('.sch-row')]
      .filter((d) => d.querySelector('[data-k=on]').checked)
      .map((d) => ({ gian: d.querySelector('[data-k=gian]').value.trim().toUpperCase(), time: toSheetTime(d.querySelector('[data-k=time]').value) }))
      .filter((g) => g.gian && g.time);
    if (!gians.length) { msg.textContent = 'Tích ít nhất 1 gian và điền Mã gian + thời gian.'; return; }
    $('#schAdd').disabled = true;
    msg.textContent = 'Đang thêm vào lịch…';
    try {
      const res = await chrome.runtime.sendMessage({ type: 'CSCH_ADD', rows: gians.map((g) => ({ link, gian: g.gian, time: g.time })) });
      msg.textContent = res?.ok ? `✔ Đã thêm ${res.added} lịch cho SP ${cur.itemId}: ${gians.map((g) => g.gian + ' lúc ' + g.time).join(', ')}` : 'Lỗi: ' + (res?.error || 'không rõ');
      msg.style.color = res?.ok ? '#15803d' : '#dc2626';
    } catch (e) {
      msg.textContent = 'Lỗi: ' + e.message;
      msg.style.color = '#dc2626';
    } finally {
      $('#schAdd').disabled = false;
    }
  };
})();
