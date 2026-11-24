// Gợi ý mã SKU từ sheet DS_SP trên trang sửa / thêm sản phẩm của Kênh Người Bán.
// Gõ mã hoặc TÊN / model (vd "LK-8924", "bếp từ 8924") vào ô SKU phân loại / SKU sản phẩm
// → hiện danh sách mã DS_SP, chọn thì điền mã + "-<mã gian>" (vd LK59-BK-00-GDD).
(() => {
  if (window.top !== window || window.__qlspSkuSuggest) return;
  window.__qlspSkuSuggest = true;

  const onEditPage = () => /^\/portal\/product\/(new|\d+)/.test(location.pathname);
  const FIELD_SEL = '.sku-textarea textarea, .batch-sku input, .parent-sku input';
  // Ô "Cột S" trên khung tài chính trang Đơn hàng cũng dùng gợi ý này
  const ORDER_SEL = '.qlsp-sku-input';

  let list = null, loading = null, maGian = '';
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').trim().toLowerCase();
  const compact = (s) => s.replace(/[^a-z0-9]/g, '');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  chrome.storage.local.get(['tcdd-shop-code', 'maGian', 'dhHoanTextValue'], (st) => {
    maGian = String(st['tcdd-shop-code'] || st.maGian || st.dhHoanTextValue || '').trim().toUpperCase();
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local') return;
    if (c.maGian || c['tcdd-shop-code']) chrome.storage.local.get(['tcdd-shop-code', 'maGian'], (st) => { maGian = String(st['tcdd-shop-code'] || st.maGian || '').trim().toUpperCase(); });
    if (c.ds_sp_cache_data) list = parse(c.ds_sp_cache_data.newValue);
  });

  function parse(values) {
    if (!Array.isArray(values) || values.length < 2) return [];
    const h = values[0].map((x) => String(x || '').trim().toLowerCase());
    const find = (names, def) => { const i = h.findIndex((x) => names.includes(x)); return i >= 0 ? i : def; };
    const ct = find(['id_sp_ct', 'id_sp_con'], 0), sp = find(['id_sp', 'mã sp', 'ma sp'], 1), ten = find(['ten_sp', 'tên sp'], 2), gia = find(['gia_ban', 'giá bán'], 4);
    const out = [], seen = new Set();
    for (const r of values.slice(1)) {
      const sku = String(r[ct] || r[sp] || '').trim();
      if (!sku || seen.has(sku.toUpperCase())) continue;
      seen.add(sku.toUpperCase());
      out.push({ sku, parent: String(r[sp] || '').trim(), name: String(r[ten] || '').trim(), price: String(r[gia] || '').trim() });
    }
    return out;
  }

  // Nguồn gợi ý: sheet DS_SP (cột A:G). Bản lưu trên máy chỉ dùng để hiện ngay;
  // mỗi lần mở trang (và quá 10 phút) đọc lại sheet để có mã mới thêm vào DS_SP.
  const FRESH_MS = 10 * 60 * 1000;
  let fetchedAt = 0;
  function fetchSheet() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'FETCH_DS_SP' }, (res) => {
        const vals = !chrome.runtime.lastError && res && res.ok !== false && res.values;
        if (vals && vals.length > 1) {
          list = parse(vals);
          fetchedAt = Date.now();
          chrome.storage.local.set({ ds_sp_cache_data: vals, ds_sp_cache_at: fetchedAt });
        }
        resolve(list || []);
      });
    });
  }
  function load(force = false) {
    if (loading) return loading;
    if (list && !force && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve(list);
    loading = new Promise((resolve) => {
      chrome.storage.local.get(['ds_sp_cache_data', 'ds_sp_cache_at'], ({ ds_sp_cache_data: v, ds_sp_cache_at: at }) => {
        if (!list && Array.isArray(v) && v.length > 1) list = parse(v);
        if (!force && list && at && Date.now() - at < FRESH_MS) { fetchedAt = at; return resolve(list); }
        if (list) { resolve(list); fetchSheet(); } // hiện ngay bản cũ, đọc sheet mới ở nền
        else fetchSheet().then(resolve);
      });
    }).finally(() => { loading = null; });
    return loading;
  }

  function search(q, limit = 20) {
    let query = norm(q);
    if (maGian && query.endsWith('-' + norm(maGian))) query = query.slice(0, -(maGian.length + 1));
    const items = list || [];
    if (!query) return items.slice(0, limit);
    const tokens = query.split(/\s+/).filter(Boolean);
    const bySku = [], byName = [];
    for (const it of items) {
      const skuN = norm(it.sku) + ' ' + norm(it.parent);
      const hay = skuN + ' ' + norm(it.name), hayC = compact(hay);
      if (!tokens.every((t) => hay.includes(t) || (compact(t) && hayC.includes(compact(t))))) continue;
      (tokens.every((t) => compact(skuN).includes(compact(t))) ? bySku : byName).push(it);
      if (bySku.length >= limit) break;
    }
    return bySku.concat(byName).slice(0, limit);
  }

  // ---- Dropdown ----
  const dd = document.createElement('div');
  dd.style.cssText = 'position:absolute;z-index:2147483646;background:#fff;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-height:320px;overflow:auto;font:12px/1.4 Arial,sans-serif;display:none;width:340px';
  let field = null, items = [], hi = -1;

  function finalSku(sku) {
    return maGian && !sku.toLowerCase().endsWith('-' + maGian.toLowerCase()) ? `${sku}-${maGian}` : sku;
  }
  function render() {
    if (!field) return;
    const head = `<div style="position:sticky;top:0;background:#f8fafc;padding:5px 8px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:6px;color:#475569"><b>Gợi ý DS_SP (${items.length}/${(list || []).length})</b><a href="#" data-reload style="color:#2563eb;text-decoration:underline">↻ Tải lại DS_SP</a><span style="color:${maGian ? '#047857' : '#ea580c'}">${maGian ? 'Mã gian: -' + esc(maGian) : 'Chưa có mã gian'}</span></div>`;
    const body = items.length ? items.map((it, i) => `<div data-i="${i}" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid #f1f5f9;${i === hi ? 'background:#eef2ff' : ''}">
        <div><b style="color:#1e3a8a">${esc(it.sku)}</b>${maGian ? ` <span style="color:#047857">➔ ${esc(finalSku(it.sku))}</span>` : ''}</div>
        ${it.name ? `<div style="color:#64748b">${esc(it.name)}${it.price ? ' · ' + esc(it.price) : ''}</div>` : ''}</div>`).join('')
      : `<div style="padding:10px;color:#94a3b8;text-align:center">${list ? 'Không tìm thấy mã phù hợp trong DS_SP.<br>Mã mới thêm vào sheet? Bấm ↻ Tải lại DS_SP' : 'Đang tải DS_SP…'}</div>`;
    dd.innerHTML = head + body;
    const r = field.getBoundingClientRect();
    dd.style.left = Math.max(8, Math.min(r.left + scrollX, scrollX + innerWidth - 350)) + 'px';
    dd.style.top = (r.bottom + scrollY + 2) + 'px';
    dd.style.display = 'block';
    if (!dd.isConnected) document.body.appendChild(dd);
  }
  function hide() { dd.style.display = 'none'; field = null; hi = -1; }

  function setValue(el, v) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function choose(i) {
    const it = items[i];
    if (!it || !field) return;
    const el = field;
    setValue(el, finalSku(it.sku));
    hide();
    el.focus();
  }

  async function update(el) {
    field = el;
    render();
    await load();
    if (field !== el) return;
    items = search(el.value);
    hi = -1;
    render();
  }

  dd.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-reload]')) {
      e.preventDefault();
      const el = field;
      list = null; items = []; render();
      fetchSheet().then(() => { if (el && field === el) { items = search(el.value); hi = -1; render(); } });
      return;
    }
    const row = e.target.closest('[data-i]');
    if (!row) return;
    e.preventDefault();
    choose(Number(row.dataset.i));
  });

  document.addEventListener('focusin', (e) => {
    if (!e.target.matches) return;
    const isOrderBox = e.target.matches(ORDER_SEL);
    if (!isOrderBox && (!onEditPage() || !e.target.matches(FIELD_SEL))) return;
    update(e.target);
  });
  document.addEventListener('input', (e) => {
    if (e.target === field && e.isTrusted) update(e.target);
  });
  document.addEventListener('keydown', (e) => {
    if (!field || e.target !== field || dd.style.display === 'none') return;
    if (e.key === 'ArrowDown') { hi = Math.min(items.length - 1, hi + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && hi >= 0) { choose(hi); e.preventDefault(); }
    else if (e.key === 'Escape') hide();
  }, true);
  document.addEventListener('focusout', (e) => {
    if (e.target === field) setTimeout(() => { if (document.activeElement !== field) hide(); }, 200);
  });
  addEventListener('scroll', () => { if (field) render(); }, true);
})();
