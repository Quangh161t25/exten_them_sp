const { parseShopInput, getShopBase, getShopItems, getItemDetail, getCategoryMap, rememberCategory, mapItem, fmt, escapeHtml, renderShopHead } = window.SpyApi;
const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle('hidden', !on);

const state = {
  shopId: '',
  shopName: '',
  rows: [],
  filtered: [],
  sort: { key: 'sold', dir: 'desc' },
  page: 1,
  pageSize: 50,
  selected: new Set(),
  detailLoading: new Set(),
  cancelled: false,
  loading: false,
};

/* ---------- Lưu dữ liệu đã quét (chrome.storage, theo shop) ---------- */
const cacheKey = (shopId) => `spy_shop_${shopId}`;
const aliasKey = (username) => `spy_alias_${String(username).toLowerCase()}`;
async function loadCache(target) {
  let shopId = target.shopId;
  if (!shopId && target.username) shopId = (await chrome.storage.local.get(aliasKey(target.username)))[aliasKey(target.username)];
  if (!shopId) return null;
  const c = (await chrome.storage.local.get(cacheKey(shopId)))[cacheKey(shopId)];
  if (!c?.rows?.length) return null;
  // ctime lưu dạng số (ms). Dữ liệu lưu bản cũ mất ngày (Date thành {}): tính lại từ số ngày tuổi lúc quét
  c.rows.forEach((r) => {
    const t = typeof r.ctime === 'number' || typeof r.ctime === 'string' ? new Date(r.ctime) : null;
    r.ctime = t && !isNaN(t) ? t : r.ageDay ? new Date(c.at - r.ageDay * 864e5) : null;
    if (r.ctime) r.ageDay = Math.max(1, Math.round((Date.now() - r.ctime.getTime()) / 864e5)); // tuổi tính tới hôm nay
  });
  return c;
}
async function saveCache() {
  if (!state.shopId || !state.rows.length) return;
  const info = state.shopInfo || {};
  const username = info.account && info.account.username;
  await chrome.storage.local.set({
    // chrome.storage không lưu được Date: đổi ctime sang số ms
    [cacheKey(state.shopId)]: { at: Date.now(), info, rows: state.rows.map((r) => ({ ...r, ctime: r.ctime instanceof Date ? r.ctime.getTime() : r.ctime })) },
    ...(username ? { [aliasKey(username)]: state.shopId } : {})
  }).catch((e) => console.warn('Shop Spy: không lưu được dữ liệu đã quét', e));
}
// Dòng báo "dữ liệu đã quét lúc …" + nút Quét lại, đặt dưới thẻ thông tin shop
function showCacheNote(at, target) {
  const note = document.createElement('div');
  note.className = 'muted';
  note.style.cssText = 'margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  const ago = Date.now() - at, agoText = ago < 3600e3 ? `${Math.max(1, Math.round(ago / 60e3))} phút trước` : ago < 864e5 ? `${Math.round(ago / 3600e3)} giờ trước` : `${Math.round(ago / 864e5)} ngày trước`;
  note.innerHTML = `📦 Đang xem dữ liệu đã quét lúc <b>${new Date(at).toLocaleString('vi-VN')}</b> (${agoText})`;
  const btn = document.createElement('button');
  btn.className = 'btn primary';
  btn.textContent = '🔄 Quét lại';
  btn.onclick = () => start(target, true);
  note.appendChild(btn);
  $('head').appendChild(note);
}

/* ---------- Tải dữ liệu ---------- */
async function start(target, force = false) {
  const token = (state.token = (state.token || 0) + 1); // lượt quét cũ sẽ tự dừng
  Object.assign(state, { rows: [], filtered: [], page: 1, selected: new Set(), cancelled: false });
  detailQ.items = []; detailQ.blocked = '';
  show('err', false);
  show('head', false);
  show('body', false);

  // Shop đã quét trước đó: hiện ngay dữ liệu đã lưu, không gọi Shopee (bấm "Quét lại" để quét mới)
  if (!force) {
    const cached = await loadCache(target).catch(() => null);
    if (cached && token === state.token) {
      const info = cached.info || {};
      state.shopInfo = info;
      state.shopId = String(info.shopid || cached.rows[0].shopId || target.shopId);
      state.shopName = info.name || (info.account && info.account.username) || state.shopId;
      document.title = `Shop Spy – ${state.shopName}`;
      $('head').innerHTML = renderShopHead(info, state.shopId);
      showCacheNote(cached.at, { shopId: state.shopId });
      show('head', true);
      history.replaceState(null, '', `?shopId=${state.shopId}`);
      state.rows = cached.rows;
      refreshAll();
      return;
    }
  }

  state.catMapPromise = state.catMapPromise || getCategoryMap().catch(() => new Map());
  try {
    const info = await getShopBase(target);
    state.shopInfo = info;
    state.shopId = String(info.shopid || target.shopId);
    state.shopName = info.name || (info.account && info.account.username) || state.shopId;
    document.title = `Shop Spy – ${state.shopName}`;
    $('head').innerHTML = renderShopHead(info, state.shopId);
    show('head', true);
    history.replaceState(null, '', `?shopId=${state.shopId}`);
    if (token !== state.token) return;
    await scan(info.item_count || 0, token);
  } catch (e) {
    $('err').textContent = e.message || String(e);
    show('err', true);
  }
}

async function scan(expected, token) {
  const limit = 40;
  let total = expected || 400;
  const seen = new Map();
  const t0 = Date.now();
  const catMap = await state.catMapPromise;
  const info = state.shopInfo || {};
  const enrich = (row) => {
    const c = catMap.get(String(row.catid));
    if (c) { row.categoryName = c.name; row.categoryTree = c.tree; }
    if (!row.shopName) row.shopName = (info.account && info.account.username) || state.shopName;
    if (!row.location) row.location = info.shop_location || '';
    if (!row.isMall && info.is_official_shop) row.isMall = true;
    return row;
  };
  state.loading = true;
  show('loading', true);
  $('loadTitle').textContent = 'Đang quét sản phẩm…';

  for (let page = 0; page * limit < total && !state.cancelled && token === state.token; page++) {
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { res = await getShopItems(state.shopId, limit, page); break; }
      catch { await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); }
    }
    if (token !== state.token) return;
    if (!res || state.cancelled) break;
    if (typeof res.total === 'number' && res.total > 0) total = res.total;
    if (!res.items.length) break;
    for (const it of res.items) {
      const row = enrich(mapItem(it));
      if (row.itemId && !seen.has(row.itemId)) seen.set(row.itemId, row);
    }
    const done = seen.size;
    const pct = Math.min(100, Math.round((done / total) * 100));
    const eta = done ? Math.round(((Date.now() - t0) / done) * Math.max(0, total - done) / 1000) : 0;
    $('bar').style.width = pct + '%';
    $('loadText').textContent = `${fmt.num(done)} / ${fmt.num(total)} sản phẩm · ${pct}%` + (eta ? ` · còn ~${eta}s` : '');

    // Hiển thị dần sau trang đầu
    state.rows = [...seen.values()];
    if (page === 0 || page % 5 === 0) refreshAll();
    else autoLoadVisible(); // tải chi tiết song song ngay trong lúc quét
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 250)); // tránh spam API
  }

  if (token !== state.token) return;
  state.rows = [...seen.values()];
  state.loading = false;
  show('loading', false);
  refreshAll();
  // Lưu lại để lần sau nhập shop này hiện ngay (chỉ khi quét xong, không lưu khi bấm Dừng)
  if (!state.cancelled) saveCache().then(() => { showCacheNote(Date.now(), { shopId: state.shopId }); closeAutoTab(); });
  else closeAutoTab();
  if (!state.rows.length) {
    $('err').textContent = 'Không lấy được sản phẩm của shop. Hãy mở shopee.vn (đã đăng nhập) trong một tab rồi thử lại.';
    show('err', true);
  }
}

/* ---------- Thống kê ---------- */
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
const uniq = (rows, k) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;

function renderStats() {
  const rows = state.filtered;
  const items = [
    ['Sản phẩm', fmt.num(rows.length)],
    ['Ngành hàng', fmt.num(uniq(rows, 'categoryName'))],
    ['Thương hiệu', fmt.num(uniq(rows, 'brand'))],
    ['Tổng đã bán', fmt.num(sum(rows, 'sold'))],
    ['Tổng doanh thu', fmt.short(sum(rows, 'sale')), fmt.money(sum(rows, 'sale'))],
    ['Bán 30 ngày', fmt.num(sum(rows, 'soldMonth'))],
    ['Doanh thu 30 ngày', fmt.short(sum(rows, 'saleMonth')), fmt.money(sum(rows, 'saleMonth'))],
  ];
  $('stats').innerHTML = items
    .map(([l, v, title]) => `<div class="card stat" ${title ? `title="${title}"` : ''}><div class="label">${l}</div><div class="value">${v}</div></div>`)
    .join('');
}

/* ---------- Bộ lọc ---------- */
const AGE_RANGES = {
  a30: [0, 30], recent90: [0, 90], a90: [31, 90], a180: [91, 180], a365: [181, 365], old: [366, Infinity],
};
// Nút lọc nhanh: mỗi preset bật thêm một điều kiện
const PRESETS = {
  all: {},
  flashSale: { onlyFlashSale: true },
  deepDiscount: { discountMin: 50 },
  noDiscount: { discountMin: 0, discountMax: 0 },
  recent: { age: 'recent90' },
  newItem: { onlyNewItem: true },
  mall: { onlyMall: true },
  video: { onlyVideo: true },
  noVideo: { onlyNoVideo: true },
};
let activePreset = 'all';

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

function countBy(rows, k) {
  const m = new Map();
  rows.forEach((r) => r[k] && m.set(String(r[k]), (m.get(String(r[k])) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Dropdown chọn nhiều, có ô tìm kiếm */
class MultiSelect {
  constructor(el, onChange) {
    this.el = el;
    this.field = el.dataset.field;
    this.placeholder = el.dataset.placeholder;
    this.selected = new Set();
    this.options = [];
    this.onChange = onChange;
    el.innerHTML = `
      <button type="button" class="ms-btn"><span class="val"></span></button>
      <div class="ms-pop">
        <input class="input" placeholder="Tìm…" />
        <div class="ms-list"></div>
      </div>`;
    this.btn = el.querySelector('.ms-btn');
    this.search = el.querySelector('.ms-pop .input');
    this.list = el.querySelector('.ms-list');
    this.btn.addEventListener('click', () => {
      const open = !el.classList.contains('open');
      document.querySelectorAll('.ms.open').forEach((x) => x.classList.remove('open'));
      el.classList.toggle('open', open);
      if (open) { this.search.value = ''; this.renderList(); this.search.focus(); }
    });
    this.search.addEventListener('input', () => this.renderList());
    this.list.addEventListener('change', (e) => {
      const v = e.target.value;
      e.target.checked ? this.selected.add(v) : this.selected.delete(v);
      this.renderButton();
      this.onChange();
    });
    this.renderButton();
  }
  setOptions(entries) {
    this.options = entries;
    if (this.el.classList.contains('open')) this.renderList();
  }
  renderList() {
    const q = norm(this.search.value);
    const opts = this.options.filter(([v]) => !q || norm(v).includes(q));
    this.list.innerHTML = opts.length
      ? opts.map(([v, n]) => `<label><input type="checkbox" value="${escapeHtml(v)}" ${this.selected.has(v) ? 'checked' : ''}>
          <span class="txt" title="${escapeHtml(v)}">${escapeHtml(v)}</span><span class="cnt">${n}</span></label>`).join('')
      : '<div class="ms-empty">Không có lựa chọn</div>';
  }
  renderButton() {
    const vals = [...this.selected];
    this.btn.querySelector('.val').innerHTML = vals.length
      ? escapeHtml(vals.length > 2 ? `${vals.slice(0, 2).join(', ')} +${vals.length - 2}` : vals.join(', '))
      : `<span class="ph">${escapeHtml(this.placeholder)}</span>`;
  }
  clear() { this.selected.clear(); this.renderButton(); }
}

const multiSelects = [...document.querySelectorAll('.ms')].map((el) => new MultiSelect(el, () => onFilterChange()));
document.addEventListener('click', (e) => {
  if (!e.target.closest('.ms')) document.querySelectorAll('.ms.open').forEach((x) => x.classList.remove('open'));
});

const NUM_INPUTS = ['fPriceMin', 'fPriceMax', 'fDiscMin', 'fDiscMax', 'fSoldMin', 'fSaleMin'];
const CHECKS = { fFlash: 'onlyFlashSale', fMall: 'onlyMall', fVideo: 'onlyVideo', fNoVideo: 'onlyNoVideo', fCross: 'onlyCrossBorder', fVoucher: 'onlyShopVoucher' };
const numVal = (id) => ($(id).value === '' ? undefined : Number($(id).value));

function readFilter() {
  const f = {
    search: norm($('fSearch').value.trim()),
    priceMin: numVal('fPriceMin'), priceMax: numVal('fPriceMax'),
    discountMin: numVal('fDiscMin'), discountMax: numVal('fDiscMax'),
    soldMin: numVal('fSoldMin'), saleMin: numVal('fSaleMin'),
    age: $('fAge').value || undefined,
    ratingMin: $('fRating').value === '' ? undefined : Number($('fRating').value),
    lists: multiSelects.filter((m) => m.selected.size).map((m) => [m.field, m.selected]),
  };
  Object.entries(CHECKS).forEach(([id, k]) => (f[k] = $(id).checked));
  for (const [k, v] of Object.entries(PRESETS[activePreset] || {})) {
    if (f[k] === undefined || f[k] === false) f[k] = v;
  }
  return f;
}

function matches(r, f) {
  if (f.search && !norm(`${r.name} ${r.shopName}`).includes(f.search)) return false;
  if (f.priceMin !== undefined && r.price < f.priceMin) return false;
  if (f.priceMax !== undefined && r.price > f.priceMax) return false;
  if (f.discountMin !== undefined && r.discountPercent < f.discountMin) return false;
  if (f.discountMax !== undefined && r.discountPercent > f.discountMax) return false;
  if (f.soldMin !== undefined && r.sold < f.soldMin) return false;
  if (f.saleMin !== undefined && r.sale < f.saleMin) return false;
  if (f.age) {
    const [a, b] = AGE_RANGES[f.age];
    if (r.ageDay == null || r.ageDay < a || r.ageDay > b) return false;
  }
  if (f.ratingMin !== undefined && r.ratingStar < f.ratingMin) return false;
  for (const [field, set] of f.lists) if (!set.has(String(r[field]))) return false;
  if (f.onlyFlashSale && !r.isFlashSale) return false;
  if (f.onlyMall && !r.isMall) return false;
  if (f.onlyVideo && !r.hasVideo) return false;
  if (f.onlyNoVideo && r.hasVideo) return false;
  if (f.onlyCrossBorder && !r.isCrossBorder) return false;
  if (f.onlyShopVoucher && !r.hasShopVoucher) return false;
  if (f.onlyNewItem && !r.isNewItem) return false;
  return true;
}

function activeCount() {
  let n = activePreset !== 'all' ? 1 : 0;
  if ($('fSearch').value.trim()) n++;
  n += multiSelects.filter((m) => m.selected.size).length;
  n += [...NUM_INPUTS, 'fAge', 'fRating'].filter((id) => $(id).value !== '').length;
  n += Object.keys(CHECKS).filter((id) => $(id).checked).length;
  return n;
}

function applyFilter() {
  const f = readFilter();
  state.filtered = state.rows.filter((r) => matches(r, f));
  const { key, dir } = state.sort;
  const m = dir === 'asc' ? 1 : -1;
  state.filtered.sort((a, b) => {
    const x = a[key] ?? 0, y = b[key] ?? 0;
    return typeof x === 'string' ? x.localeCompare(y, 'vi') * m : (x - y) * m;
  });
  const n = activeCount();
  $('fCount').textContent = n;
  show('fReset', n > 0);
}

function onFilterChange() { state.page = 1; refresh(); }

function setPreset(key) {
  activePreset = key;
  document.querySelectorAll('#presets .chip').forEach((c) => c.classList.toggle('active', c.dataset.preset === key));
  onFilterChange();
}

function resetFilter() {
  ['fSearch', ...NUM_INPUTS, 'fAge', 'fRating'].forEach((id) => ($(id).value = ''));
  Object.keys(CHECKS).forEach((id) => ($(id).checked = false));
  multiSelects.forEach((m) => m.clear());
  setPreset('all');
}

/* ---------- Bảng ---------- */
function discClass(p) { return p >= 50 ? 'd3' : p >= 20 ? 'd2' : p > 0 ? 'd1' : 'd0'; }

function renderTable() {
  const totalPage = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPage);
  const startIdx = (state.page - 1) * state.pageSize;
  const rows = state.filtered.slice(startIdx, startIdx + state.pageSize);

  // Mỗi sản phẩm = 1 <tbody>; mỗi phân loại = 1 dòng, các cột sản phẩm gộp bằng rowspan
  $('table').querySelectorAll('tbody').forEach((tb) => tb.remove());
  $('table').insertAdjacentHTML('beforeend', rows.map((r, i) => {
    const subs = variationRows(r);
    const rs = subs.length > 1 ? ` rowspan="${subs.length}"` : '';
    const cells = productCells(r, startIdx + i + 1).map((c) => c.replace(/^<td/, `<td${rs}`));
    const pre = cells.slice(0, PRODUCT_CELLS_BEFORE).join('');
    const post = cells.slice(PRODUCT_CELLS_BEFORE).join('');
    return `<tbody class="grp ${r.isFlashSale ? 'fs' : ''}">
      ${subs.map((s, k) => `<tr>${k === 0 ? pre : ''}${s}${k === 0 ? post : ''}</tr>`).join('')}
    </tbody>`;
  }).join(''));

  show('empty', !rows.length && !state.loading);
  $('pageInfo').textContent = `${state.page} / ${totalPage}`;
  $('prev').disabled = state.page <= 1;
  $('next').disabled = state.page >= totalPage;
  renderTableFooter(rows);
}

// Số cột sản phẩm đứng TRƯỚC nhóm cột phân loại (phần còn lại đứng sau)
const PRODUCT_CELLS_BEFORE = 18;

/** Các ô của sản phẩm (dùng chung cho mọi dòng phân loại) */
function productCells(r, index) {
  const td = (cls, html) => `<td${cls ? ` class="${cls}"` : ''}>${html}</td>`;
  return [
    td('c-check', `<input type="checkbox" data-id="${r.itemId}" ${state.selected.has(r.itemId) ? 'checked' : ''}>`),
    td('muted', index),
    td('', `<a class="name" href="${escapeHtml(r.url)}" target="_blank" title="${escapeHtml(r.name)}">${escapeHtml(r.name.length > 100 ? r.name.slice(0, 100) + '…' : r.name)}</a>
        <div class="sub">
          ${r.isFlashSale ? '<span class="badge fs">Flash sale</span> ' : ''}
          ${r.videoUrl ? `<a href="${escapeHtml(r.videoUrl)}" target="_blank">[Video]</a> ` : ''}
          ${r.isNewItem ? '<span class="badge pref">Đang lên</span> ' : ''}ID ${r.itemId}
        </div>`),
    td('', `<a href="${escapeHtml(r.url)}" target="_blank"><img loading="lazy" src="${escapeHtml(r.image)}_tn" alt=""></a>`),
    td('', `<span class="cat" title="${escapeHtml(r.categoryTree || r.categoryName)}">${escapeHtml(r.categoryName)}</span>`),
    td('', escapeHtml(r.brand)),
    td('', `<a class="shop" href="https://shopee.vn/shop/${r.shopId}" target="_blank">${escapeHtml(r.shopName)}</a>`),
    td('r', `${fmt.date(r.ctime)}<div class="sub">${r.ageDay ? r.ageDay + ' ngày' : ''}</div>`),
    td('r', `<b>${fmt.num(r.price)}</b>${r.priceOrigin > r.price ? `<del>${fmt.num(r.priceOrigin)}</del>` : ''}`),
    td('r', `<span class="disc ${discClass(r.discountPercent)}">${r.discountPercent}%</span>${r.promotionType ? `<div class="sub">${escapeHtml(r.promotionName)}</div>` : ''}`),
    td('r', `<b>${fmt.num(r.sold)}</b>`),
    td('r', fmt.num(Math.round(r.sale))),
    td('r', fmt.num(r.soldMonth)),
    td('r', fmt.num(Math.round(r.saleMonth))),
    td('r', r.soldPerDay),
    td('r', `★ ${r.ratingStar.toFixed(1)} <span class="muted">(${fmt.num(r.ratingCount)})</span>`),
    td('r', fmt.num(r.liked)),
    td('c-act', `<button class="btn" data-act="clone" data-id="${r.itemId}" title="Mở sản phẩm và đưa vào Sao chép sản phẩm (SKU để trống)">📋 Sao chép</button>`),
    td('', thumbs(r, 'images', r.images)),
    // --- nhóm cột phân loại chèn vào đây ---
  ];
}

/** Các dòng phân loại: mỗi phần tử là chuỗi 5 ô (Phân loại, Ảnh, Giá, Giá gốc, Giảm) */
function variationRows(r) {
  if (r.models === null) {
    // Không tải chi tiết: phân loại + ảnh lấy từ bước quét; giá / giảm là giá của sản phẩm
    // (danh sách Shopee không có giá riêng từng phân loại)
    const list = r.variationList?.length ? r.variationList : [{ label: 'Mặc định', url: '' }];
    return list.map((v) => `
    <td class="v vname">${escapeHtml(v.label || 'Mặc định')}</td>
    <td class="v">${v.url ? `<a href="${escapeHtml(v.url)}" target="_blank"><img class="vimg" loading="lazy" src="${escapeHtml(v.url)}_tn" alt=""></a>` : '<span class="muted">–</span>'}</td>
    <td class="v r"><b>${fmt.num(r.price)}</b></td>
    <td class="v r">${r.priceOrigin > r.price ? `<del class="inline">${fmt.num(r.priceOrigin)}</del>` : '<span class="muted">–</span>'}</td>
    <td class="v r"><span class="disc ${discClass(r.discountPercent)}">${r.discountPercent ? '-' + r.discountPercent : 0}%</span></td>`);
  }
  const models = r.models.length ? r.models : [{ name: '', price: r.price, priceOrigin: r.priceOrigin, discount: r.discountPercent, inStock: true, image: '' }];
  return models.map((m) => `
    <td class="v vname">${escapeHtml(m.name || 'Mặc định')}${m.inStock ? '' : ' <span class="badge off">Hết hàng</span>'}</td>
    <td class="v">${m.image ? `<a href="${escapeHtml(m.image)}" target="_blank"><img class="vimg" loading="lazy" src="${escapeHtml(m.image)}_tn" alt=""></a>` : '<span class="muted">–</span>'}</td>
    <td class="v r"><b>${fmt.num(m.price)}</b></td>
    <td class="v r">${m.priceOrigin > m.price ? `<del class="inline">${fmt.num(m.priceOrigin)}</del>` : '<span class="muted">–</span>'}</td>
    <td class="v r"><span class="disc ${discClass(m.discount)}">${m.discount ? '-' + m.discount : 0}%</span></td>`);
}

function renderTableFooter(rows) {
  $('resultCount').textContent = `${fmt.num(state.filtered.length)} / ${fmt.num(state.rows.length)} sản phẩm`;
  $('selCount').textContent = state.selected.size;
  $('checkAll').checked = rows.length > 0 && rows.every((r) => state.selected.has(r.itemId));

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === state.sort.key);
    th.classList.toggle('asc', th.dataset.sort === state.sort.key && state.sort.dir === 'asc');
  });
}

/* ---------- Ảnh & mô tả ---------- */
function thumbs(r, field, urls) {
  const shown = urls.slice(0, 3);
  return `<div class="thumbs" data-act="gallery" data-field="${field}" data-id="${r.itemId}" title="Bấm để xem ${urls.length} ảnh">
    ${shown.map((u) => `<img loading="lazy" src="${escapeHtml(u)}_tn" alt="">`).join('')}
    ${urls.length > shown.length ? `<span class="more">+${urls.length - shown.length}</span>` : ''}
  </div>`;
}

function loadBtn(r) {
  if (state.detailLoading.has(r.itemId)) return '<span class="spinner" style="width:14px;height:14px"></span>';
  // Đang bật tự động tải → chỉ hiện trạng thái chờ, không bắt người dùng bấm
  if ($('autoDetail').checked && !detailQ.blocked) return '<span class="muted wait">Đang chờ…</span>';
  return `<button class="link-btn" data-act="load" data-id="${r.itemId}">Tải</button>`;
}

/** Gán tên ngành hàng thật (từ chi tiết sản phẩm) cho mọi sản phẩm cùng ngành */
function applyCategory(catid, cat) {
  state.rows.forEach((x) => {
    if (String(x.catid) === String(catid)) { x.categoryName = cat.name; x.categoryTree = cat.tree; }
  });
}

async function loadDetail(r) {
  if (r.description !== null || state.detailLoading.has(r.itemId)) return;
  state.detailLoading.add(r.itemId);
  try {
    const d = await getItemDetail(r.shopId, r.itemId);
    r.description = d.description;
    r.descImages = d.descImages;
    r.models = d.models || [];
    if (d.categories && d.categories.length) {
      const last = d.categories[d.categories.length - 1];
      const cat = { name: last.name, tree: d.categories.map((c) => c.name).join(' > ') };
      rememberCategory(last.id, cat);
      applyCategory(r.catid, cat);
      if (String(last.id) !== String(r.catid)) applyCategory(last.id, cat);
      state.catsChanged = true;
    }
  } finally {
    state.detailLoading.delete(r.itemId);
  }
}

/* ---------- Hàng đợi tải chi tiết: tự động tải toàn bộ, ưu tiên trang đang xem ---------- */
const DETAIL_WORKERS = 1; // tải lần lượt từng sản phẩm: gọi song song dễ bị Shopee chặn (90309999)
const detailQ = { items: [], workers: 0, done: 0, failed: 0, blocked: '', manual: false };
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function visibleRows() {
  const start = (state.page - 1) * state.pageSize;
  return state.filtered.slice(start, start + state.pageSize);
}
const needsDetail = (r) => r.description === null && !state.detailLoading.has(r.itemId);

/** Tự động: trang đang xem lên đầu, sau đó là toàn bộ sản phẩm còn lại (gọi khi quét/đổi trang/lọc/sắp xếp) */
function autoLoadVisible() {
  // Đã bỏ tải chi tiết (mô tả, ảnh mô tả, giá từng phân loại): chỉ dùng dữ liệu bước quét
  return;
  if (!$('autoDetail').checked || detailQ.blocked) return;
  const vis = visibleRows().filter(needsDetail);
  const visSet = new Set(vis);
  const rest = [...state.filtered, ...state.rows].filter((r) => needsDetail(r) && !visSet.has(r));
  detailQ.items = [...new Set([...vis, ...rest])];
  if (detailQ.items.length) startWorkers();
}

/** Nút "Tải chi tiết tất cả": thêm SP đang lọc (hoặc đang chọn) vào hàng đợi; bấm lần nữa để dừng */
function toggleBulkLoad() {
  if (detailQ.workers && detailQ.manual) {
    detailQ.items = [];
    detailQ.manual = false;
    updateDetailProgress('Đã dừng.');
    return;
  }
  detailQ.blocked = '';
  const base = state.selected.size ? state.rows.filter((r) => state.selected.has(r.itemId)) : state.filtered;
  const todo = base.filter(needsDetail);
  if (!todo.length) { updateDetailProgress('Đã tải hết chi tiết.'); return; }
  const set = new Set(todo);
  detailQ.items = [...todo, ...detailQ.items.filter((r) => !set.has(r))];
  detailQ.manual = true;
  startWorkers();
}

let renderTimer;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderTable();
    if (state.catsChanged) {
      state.catsChanged = false;
      multiSelects.forEach((m) => m.setOptions(countBy(state.rows, m.field)));
      renderStats();
      if (!$('tab-report').classList.contains('hidden')) renderReport();
    }
  }, 300);
}

function startWorkers() {
  if (!detailQ.workers) { detailQ.done = 0; detailQ.failed = 0; detailQ.strikes = 0; }
  while (detailQ.workers < DETAIL_WORKERS && detailQ.items.length) {
    detailQ.workers++;
    worker();
  }
  updateDetailProgress();
}

async function worker() {
  while (detailQ.items.length && !detailQ.blocked) {
    const r = detailQ.items.shift();
    if (!needsDetail(r)) continue;
    updateDetailProgress();
    try {
      await loadDetail(r);
      detailQ.done++;
      detailQ.strikes = 0;
    } catch (e) {
      if (/anti-bot/.test(e.message)) {
        // Bị chặn: nghỉ 45 giây rồi thử lại sản phẩm này; 3 lần liên tiếp mới dừng hẳn
        detailQ.strikes = (detailQ.strikes || 0) + 1;
        if (detailQ.strikes >= 3) { detailQ.failed++; detailQ.blocked = e.message; }
        else {
          detailQ.items.unshift(r);
          updateDetailProgress(`Shopee tạm chặn, nghỉ 45 giây rồi tải tiếp (lần ${detailQ.strikes}/3)…`);
          await sleep(45000);
          continue;
        }
      } else detailQ.failed++;
    }
    scheduleRender();
    await sleep(900 + Math.random() * 600); // giãn ~1-1,5 giây/sản phẩm để tránh bị Shopee chặn
  }
  detailQ.workers--;
  if (detailQ.workers === 0) {
    detailQ.manual = false;
    updateDetailProgress(detailQ.blocked
      ? detailQ.blocked + ' Bấm "Tải chi tiết tất cả" để thử lại.'
      : detailQ.done || detailQ.failed ? `Đã tải chi tiết ${detailQ.done} sản phẩm${detailQ.failed ? ` · lỗi ${detailQ.failed}` : ''}.` : '');
    scheduleRender();
  }
}

function updateDetailProgress(msg) {
  const left = detailQ.items.filter(needsDetail).length + state.detailLoading.size;
  $('detailProgress').innerHTML = msg !== undefined ? escapeHtml(msg)
    : `<span class="spinner" style="width:12px;height:12px"></span> Đang tải chi tiết… ${detailQ.done} xong · còn ${left}`;
  $('loadDetail').textContent = detailQ.workers && detailQ.manual ? 'Dừng tải' : 'Tải chi tiết tất cả';
}

let modalText = '';
function openModal(title, html, copyText) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = html;
  modalText = copyText;
  show('modal', true);
}

function openGallery(r, field) {
  const labels = { images: 'Ảnh sản phẩm chính', variationImages: 'Ảnh phân loại', descImages: 'Ảnh mô tả' };
  const list = field === 'variationImages' ? r.variationImages : r[field].map((url, i) => ({ url, label: `Ảnh ${i + 1}` }));
  openModal(`${labels[field]} (${list.length}) – ${r.name}`,
    `<div class="gallery">${list.map((x) => `<figure><a href="${escapeHtml(x.url)}" target="_blank"><img src="${escapeHtml(x.url)}" loading="lazy" alt=""></a><figcaption title="${escapeHtml(x.label)}">${escapeHtml(x.label)}</figcaption></figure>`).join('')}</div>`,
    list.map((x) => x.url).join('\n'));
}

/* ---------- Báo cáo ---------- */
function bars(list, valueFmt) {
  const max = Math.max(1, ...list.map((x) => x.value));
  return list.length
    ? list.map((x) => `
      <div class="hbar">
        <div class="lbl" title="${escapeHtml(x.label)}">${x.href ? `<a href="${escapeHtml(x.href)}" target="_blank">${escapeHtml(x.label)}</a>` : escapeHtml(x.label)}</div>
        <div class="track"><div class="fill" style="width:${(x.value / max) * 100}%"></div></div>
        <div class="val">${valueFmt(x.value)}${x.extra ? `<div class="muted">${x.extra}</div>` : ''}</div>
      </div>`).join('')
    : '<div class="muted">Chưa có dữ liệu</div>';
}

function renderReport() {
  const rows = state.filtered;
  const total = sum(rows, 'sale') || 1;

  const top = [...rows].sort((a, b) => b.sale - a.sale).slice(0, 10)
    .map((r) => ({ label: r.name, value: r.sale, href: r.url, extra: fmt.num(r.sold) + ' bán' }));
  $('rTop').innerHTML = bars(top, fmt.short);

  const byCat = new Map();
  rows.forEach((r) => {
    const k = r.categoryName || 'Khác';
    const o = byCat.get(k) || { sale: 0, n: 0 };
    o.sale += r.sale; o.n++;
    byCat.set(k, o);
  });
  $('rCat').innerHTML = bars([...byCat.entries()].sort((a, b) => b[1].sale - a[1].sale).slice(0, 10)
    .map(([k, o]) => ({ label: `${k} (${o.n} SP)`, value: o.sale, extra: Math.round((o.sale / total) * 100) + '%' })), fmt.short);

  const bands = [[0, 50e3], [50e3, 100e3], [100e3, 200e3], [200e3, 500e3], [500e3, 1e6], [1e6, Infinity]];
  $('rPrice').innerHTML = bars(bands.map(([a, b]) => {
    const g = rows.filter((r) => r.price >= a && r.price < b);
    return {
      label: b === Infinity ? `≥ ${fmt.short(a)}` : `${fmt.short(a)} – ${fmt.short(b)}`,
      value: sum(g, 'sold'),
      extra: `${g.length} SP · ${fmt.short(sum(g, 'sale'))}`,
    };
  }), (v) => fmt.num(v) + ' bán');

  const byYear = new Map();
  rows.forEach((r) => {
    const y = r.ctime ? r.ctime.getFullYear() : '?';
    const o = byYear.get(y) || { n: 0, sold: 0 };
    o.n++; o.sold += r.sold;
    byYear.set(y, o);
  });
  $('rAge').innerHTML = bars([...byYear.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([y, o]) => ({ label: 'Năm ' + y, value: o.n, extra: fmt.num(o.sold) + ' bán' })), (v) => v + ' SP');
}

function refreshAll() {
  if (!state.rows.length) return;
  show('body', true);
  multiSelects.forEach((m) => m.setOptions(countBy(state.rows, m.field)));
  refresh();
}

function refresh() {
  applyFilter();
  renderStats();
  renderTable();
  if (!$('tab-report').classList.contains('hidden')) renderReport();
  autoLoadVisible();
}

/* ---------- Xuất / sao chép ---------- */
const SPY_COLS = [
    ['ID', 'itemId'], ['Tên sản phẩm', 'name'], ['Link', 'url'], ['Thương hiệu', 'brand'], ['Ngành hàng', 'categoryName'],
    ['Danh mục đầy đủ', 'categoryTree'], ['Shop', 'shopName'], ['Kho hàng', 'location'],
    ['Giá', 'price'], ['Giá gốc', 'priceOrigin'], ['Giảm (%)', 'discountPercent'], ['Đã bán', 'sold'],
    ['Doanh thu', 'sale'], ['Bán 30 ngày', 'soldMonth'], ['DT 30 ngày', 'saleMonth'], ['Bán/ngày', 'soldPerDay'],
    ['Sao', 'ratingStar'], ['Lượt đánh giá', 'ratingCount'], ['Lượt thích', 'liked'], ['Tồn kho', 'stock'],
    ['Flash sale', 'isFlashSale'], ['Loại khuyến mãi', 'promotionName'], ['Ngày tạo', 'ctime'],
    ['Ảnh sản phẩm chính', 'images'], ['Phân loại', 'variationNames'], ['Ảnh phân loại', 'variationImages'],
];
// Giá trị 1 ô, dùng chung cho CSV và Google Sheet
function spyValue(v) {
  if (v instanceof Date) v = v.toLocaleDateString('vi-VN');
  if (Array.isArray(v)) {
    v = v.map((x) => (typeof x === 'string' ? x
      : 'price' in x ? `${x.name}: ${x.price} (gốc ${x.priceOrigin}, -${x.discount}%)${x.inStock ? '' : ' [hết]'}`
      : `${x.label}: ${x.url}`)).join('\n');
  }
  if (typeof v === 'boolean') v = v ? 'Có' : '';
  if (typeof v === 'number') v = Math.round(v * 100) / 100;
  return v ?? '';
}
function exportCsv() {
  const cols = SPY_COLS;
  const cell = (v) => {
    const s = String(spyValue(v));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map((c) => c[0]).join(','), ...state.filtered.map((r) => cols.map(([, k]) => cell(r[k])).join(','))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Shop [${state.shopName.replace(/[\\/:*?"<>|]/g, '')}].csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Tải vào Google Sheet SHOP_SPY theo ID sản phẩm: mới thì thêm, đã có mà khác thì cập nhật
async function exportSheet() {
  const btn = $('toSheet');
  const list = state.selected.size ? state.rows.filter((r) => state.selected.has(r.itemId)) : state.filtered;
  if (!list.length) return alert('Không có sản phẩm để tải vào sheet.');
  if (!confirm(`Tải ${list.length} sản phẩm của shop "${state.shopName}" vào sheet SHOP_SPY?\nSản phẩm mới được thêm, sản phẩm đã có mà khác thì cập nhật.`)) return;
  const now = new Date().toLocaleString('vi-VN');
  const header = [...SPY_COLS.map((c) => c[0]), 'Shop ID', 'Cập nhật lúc'];
  const rows = list.map((r) => [...SPY_COLS.map(([, k]) => String(spyValue(r[k])).slice(0, 49000)), state.shopId || '', now]);
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Đang tải vào sheet…';
  try {
    const res = await chrome.runtime.sendMessage({ type: 'SPY_TO_SHEET', header, rows });
    if (!res?.ok) throw new Error(res?.error || 'Không ghi được sheet');
    alert(`✔ Sheet ${res.sheetTitle}: thêm ${res.added} sản phẩm mới, cập nhật ${res.updated}, không đổi ${res.same}.`);
  } catch (e) {
    alert('Lỗi tải vào sheet: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

async function copyLinks() {
  const list = (state.selected.size ? state.rows.filter((r) => state.selected.has(r.itemId)) : state.filtered).map((r) => r.url);
  await navigator.clipboard.writeText(list.join('\r\n'));
  const btn = $('copy');
  const old = btn.innerHTML;
  btn.textContent = `Đã sao chép ${list.length} link ✓`;
  setTimeout(() => { btn.innerHTML = old; $('selCount').textContent = state.selected.size; }, 1500);
}

/* ---------- Sự kiện ---------- */
function go() {
  const t = parseShopInput($('q').value);
  if (!t) {
    $('err').textContent = 'Không nhận diện được shop. Dán link shop, link sản phẩm, username hoặc shop ID.';
    show('err', true);
    return;
  }
  start(t);
}
$('go').addEventListener('click', go);
$('q').addEventListener('keydown', (e) => e.key === 'Enter' && go());
$('cancel').addEventListener('click', () => { state.cancelled = true; $('loadTitle').textContent = 'Đang dừng…'; });

let debounce;
['fSearch', ...NUM_INPUTS].forEach((id) =>
  $(id).addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(onFilterChange, 250); }));
['fAge', 'fRating', ...Object.keys(CHECKS)].forEach((id) => $(id).addEventListener('change', onFilterChange));
document.querySelectorAll('#presets .chip').forEach((c) => c.addEventListener('click', () => setPreset(c.dataset.preset)));
$('fToggle').addEventListener('click', () => {
  const open = $('fPanel').classList.contains('hidden');
  show('fPanel', open);
  $('fToggle').classList.toggle('open', open);
});
$('fReset').addEventListener('click', resetFilter);

document.querySelectorAll('th[data-sort]').forEach((th) => th.addEventListener('click', () => {
  const k = th.dataset.sort;
  state.sort = { key: k, dir: state.sort.key === k && state.sort.dir === 'desc' ? 'asc' : 'desc' };
  refresh();
}));

$('table').addEventListener('change', (e) => {
  const id = e.target.dataset && e.target.dataset.id;
  if (!id) return;
  const n = Number(id);
  e.target.checked ? state.selected.add(n) : state.selected.delete(n);
  $('selCount').textContent = state.selected.size;
});
$('checkAll').addEventListener('change', (e) => {
  const startIdx = (state.page - 1) * state.pageSize;
  state.filtered.slice(startIdx, startIdx + state.pageSize)
    .forEach((r) => (e.target.checked ? state.selected.add(r.itemId) : state.selected.delete(r.itemId)));
  renderTable();
});

$('prev').addEventListener('click', () => { state.page--; renderTable(); autoLoadVisible(); });
$('next').addEventListener('click', () => { state.page++; renderTable(); autoLoadVisible(); });
$('pageSize').addEventListener('change', (e) => { state.pageSize = Number(e.target.value); state.page = 1; renderTable(); autoLoadVisible(); });
$('export').addEventListener('click', exportCsv);
$('toSheet').addEventListener('click', exportSheet);
$('loadDetail').addEventListener('click', toggleBulkLoad);
$('autoDetail').checked = false; // tắt tải chi tiết
$('autoDetail').addEventListener('change', () => {
  try { localStorage.setItem('autoDetail', $('autoDetail').checked ? '1' : '0'); } catch {}
  if ($('autoDetail').checked) { detailQ.blocked = ''; autoLoadVisible(); }
  else if (!detailQ.manual) detailQ.items = [];
});

// Bấm ảnh / mô tả / nút Tải trong bảng
$('table').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const r = state.rows.find((x) => String(x.itemId) === el.dataset.id);
  if (!r) return;
  if (el.dataset.act === 'gallery') openGallery(r, el.dataset.field);
  if (el.dataset.act === 'desc') openModal(`Mô tả – ${r.name}`, `<pre>${escapeHtml(r.description)}</pre>`, r.description);
  if (el.dataset.act === 'load') {
    const p = loadDetail(r);
    renderTable(); // hiện spinner
    try { await p; } catch (err) { $('detailProgress').textContent = err.message; }
    renderTable();
  }
});
$('modalClose').addEventListener('click', () => show('modal', false));
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') show('modal', false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') show('modal', false); });
$('modalCopy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(modalText);
  $('modalCopy').textContent = 'Đã sao chép ✓';
  setTimeout(() => ($('modalCopy').textContent = 'Sao chép'), 1200);
});
$('copy').addEventListener('click', copyLinks);

document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  show('tab-products', b.dataset.tab === 'products');
  show('tab-report', b.dataset.tab === 'report');
  if (b.dataset.tab === 'report') renderReport();
}));

/* ---------- Khởi động từ URL: spy.html?shopId=… hoặc ?username=… ---------- */
const params = new URLSearchParams(location.search);
const initial = params.get('shopId') ? { shopId: params.get('shopId') } : params.get('username') ? { username: params.get('username') } : null;
// ?auto=1: tab nền do lịch tự quét mở → quét mới, lưu, rồi tự đóng tab
const AUTO_MODE = params.get('auto') === '1';
if (initial) {
  $('q').value = initial.shopId || initial.username;
  start(initial, AUTO_MODE);
}
function closeAutoTab() { if (AUTO_MODE) chrome.tabs.getCurrent((t) => t && chrome.tabs.remove(t.id)); }
if (AUTO_MODE) setTimeout(closeAutoTab, 15 * 60e3); // chốt an toàn: quét quá 15 phút thì đóng

/* ---------- Danh sách shop đã quét + lịch tự quét ---------- */
const AUTO_KEY = 'spy_auto'; // { enabled, times: ['08:00'], shops: [shopId] }
async function renderShopList() {
  const all = await chrome.storage.local.get(null);
  const auto = all[AUTO_KEY] || { enabled: false, times: [], shops: [] };
  const scanned = Object.entries(all).filter(([k]) => k.startsWith('spy_shop_')).map(([, v]) => v)
    .filter((v) => v && v.rows).sort((a, b) => (b.at || 0) - (a.at || 0));
  // Shop tự thêm (spy_manual) mà chưa quét: hiện cuối danh sách, chưa có số liệu
  const ids = new Set(scanned.map((c) => String((c.info || {}).shopid || c.rows[0]?.shopId || '')));
  const manual = (all.spy_manual || []).filter((m) => !ids.has(String(m.shopId)))
    .map((m) => ({ info: { shopid: m.shopId, name: m.name }, rows: null, at: 0 }));
  const shops = [...scanned, ...manual];
  $('shopListCount').textContent = shops.length ? `(${shops.length})` : '';
  $('autoOn').checked = !!auto.enabled;
  $('autoTimes').value = (auto.times || []).join(', ');
  $('autoNote').textContent = auto.lastRun ? `Lần tự quét gần nhất: ${new Date(auto.lastRun).toLocaleString('vi-VN')}` : '';
  $('shopListBody').innerHTML = shops.map((c) => {
    const info = c.info || {}, id = String(info.shopid || c.rows?.[0]?.shopId || '');
    const name = info.name || (info.account && info.account.username) || id;
    return `<tr data-id="${escapeHtml(id)}">
      <td><input type="checkbox" data-auto ${auto.shops?.includes(id) ? 'checked' : ''}></td>
      <td><b>${escapeHtml(name)}</b> <span class="muted">ID ${escapeHtml(id)}</span></td>
      <td class="r">${c.rows ? fmt.num(c.rows.length) : '<span class="muted">chưa quét</span>'}</td>
      <td>${c.at ? new Date(c.at).toLocaleString('vi-VN') : ''}</td>
      <td>${c.rows ? '<button class="btn" data-open>Xem</button>' : ''}<button class="btn" data-rescan>${c.rows ? 'Quét lại' : 'Quét'}</button><button class="btn" data-del>Xoá</button></td></tr>`;
  }).join('') || '<tr><td colspan="5" class="muted">Chưa có shop nào. Dán link shop vào ô trên rồi bấm Thêm, hoặc quét một shop ở tab Soi shop.</td></tr>';
}
async function saveAuto(patch) {
  const cur = (await chrome.storage.local.get(AUTO_KEY))[AUTO_KEY] || { enabled: false, times: [], shops: [] };
  await chrome.storage.local.set({ [AUTO_KEY]: { ...cur, ...patch } });
}
$('autoSave').addEventListener('click', async () => {
  const times = $('autoTimes').value.split(/[,;\s]+/).map((t) => t.trim()).filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    .map((t) => t.padStart(5, '0'));
  // Các giờ đã qua hôm nay coi như đã chạy, để không quét ngay khi vừa lưu
  await saveAuto({ enabled: $('autoOn').checked, times, done: Object.fromEntries(times.map((t) => [t, Date.now()])) });
  chrome.runtime.sendMessage({ type: 'SPY_AUTO_SCHEDULE' }).catch(() => {});
  renderShopList();
  alert(times.length ? `Đã lưu: tự quét lúc ${times.join(', ')}${$('autoOn').checked ? '' : ' (đang tắt)'}` : 'Chưa có giờ hợp lệ (dạng 08:00).');
});
$('shopListBody').addEventListener('change', async (e) => {
  if (!e.target.matches('[data-auto]')) return;
  const id = e.target.closest('tr').dataset.id;
  const cur = (await chrome.storage.local.get(AUTO_KEY))[AUTO_KEY] || { shops: [] };
  const shops = new Set(cur.shops || []);
  if (e.target.checked) shops.add(id); else shops.delete(id);
  await saveAuto({ shops: [...shops] });
});
$('shopListBody').addEventListener('click', async (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const id = tr.dataset.id;
  if (e.target.matches('[data-open]')) { $('q').value = id; start({ shopId: id }); }
  if (e.target.matches('[data-rescan]')) { $('q').value = id; start({ shopId: id }, true); }
  if (e.target.matches('[data-del]') && confirm('Xoá dữ liệu đã quét của shop này?')) {
    await chrome.storage.local.remove(`spy_shop_${id}`);
    const cur = (await chrome.storage.local.get(AUTO_KEY))[AUTO_KEY];
    if (cur?.shops) await saveAuto({ shops: cur.shops.filter((x) => x !== id) });
    renderShopList();
  }
});
chrome.storage.onChanged.addListener((c) => { if (Object.keys(c).some((k) => k.startsWith('spy_shop_') || k === AUTO_KEY)) renderShopList(); });
renderShopList();

// 2 tab: Soi shop / Danh sách shop
function showPage(page) {
  document.querySelector('main').dataset.page = page;
  document.querySelectorAll('#pageTabs .page-tab').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
}
$('pageTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) showPage(b.dataset.page); });
// Xem / Quét từ danh sách thì chuyển sang tab Soi shop; Xoá thì bỏ cả khỏi danh sách tự thêm
$('shopListBody').addEventListener('click', async (e) => {
  if (e.target.matches('[data-open], [data-rescan]')) showPage('spy');
  if (e.target.matches('[data-del]')) {
    const id = e.target.closest('tr').dataset.id;
    const { spy_manual: list = [] } = await chrome.storage.local.get('spy_manual');
    await chrome.storage.local.set({ spy_manual: list.filter((m) => String(m.shopId) !== id) });
  }
}, true);
// Tự thêm shop vào danh sách (chỉ đọc thông tin shop, chưa quét sản phẩm)
$('addShopBtn').addEventListener('click', async () => {
  const t = parseShopInput($('addShopInput').value);
  if (!t) return alert('Không nhận diện được shop. Dán link shop, link sản phẩm, username hoặc shop ID.');
  const btn = $('addShopBtn');
  btn.disabled = true;
  try {
    const info = await getShopBase(t);
    const shopId = String(info.shopid || t.shopId);
    const name = info.name || (info.account && info.account.username) || shopId;
    const { spy_manual: list = [] } = await chrome.storage.local.get('spy_manual');
    if (!list.some((m) => String(m.shopId) === shopId)) list.push({ shopId, name, addedAt: Date.now() });
    await chrome.storage.local.set({ spy_manual: list });
    $('addShopInput').value = '';
    renderShopList();
  } catch (e) {
    alert('Không thêm được shop: ' + (e.message || e));
  } finally { btn.disabled = false; }
});

// Nút "Sao chép" ở mỗi sản phẩm: mở trang sản phẩm + mở Sao chép sản phẩm trong side panel, SKU phân loại để trống
let myWindowId = null;
chrome.windows.getCurrent((w) => { myWindowId = w && w.id; });
async function cloneProduct(itemId) {
  const r = state.rows.find((x) => String(x.itemId) === String(itemId));
  if (!r) return;
  // Side panel phải mở ngay trong lúc bấm (Chrome yêu cầu thao tác của người dùng)
  try { if (myWindowId != null) chrome.sidePanel.open({ windowId: myWindowId }); } catch (e) { /* đã mở sẵn */ }
  // scl_auto_start: Sao chép sản phẩm tự bấm "⚡ Tự động" khi đã nạp xong sản phẩm này
  await chrome.storage.local.set({ [`modelSkus_${r.itemId}`]: {}, qlsp_open_tab: { tab: 'tab-in-nang-cao', at: Date.now() }, scl_auto_start: { itemId: String(r.itemId), at: Date.now() } });
  await chrome.tabs.create({ url: r.url, active: true });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act="clone"]');
  if (b) cloneProduct(b.dataset.id);
});

/* ---------- Tab "Đọc từ Sheet": xem lại dữ liệu trong sheet SHOP_SPY ---------- */
const sheetState = { head: [], rows: [], loaded: false };
const SHEET_SHOW = ['Shop', 'Tên sản phẩm', 'Ảnh sản phẩm chính', 'Ngành hàng', 'Giá', 'Giá gốc', 'Giảm (%)', 'Đã bán', 'Doanh thu', 'Bán 30 ngày', 'Sao', 'Ngày tạo', 'Phân loại', 'Link', 'Cập nhật lúc'];
async function loadSheet() {
  $('sheetInfo').textContent = 'Đang đọc sheet SHOP_SPY…';
  $('sheetLoad').disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'SPY_READ_SHEET' });
    if (!res?.ok) throw new Error(res?.error || 'Không đọc được sheet');
    const [head = [], ...rows] = res.values || [];
    Object.assign(sheetState, { head: head.map((h) => String(h).trim()), rows: rows.filter((r) => r.some((c) => c !== '')), loaded: true });
    const shopCol = sheetState.head.indexOf('Shop');
    const shops = [...new Set(sheetState.rows.map((r) => r[shopCol]).filter(Boolean))].sort();
    const cur = $('sheetShop').value;
    $('sheetShop').innerHTML = '<option value="">Tất cả shop</option>' + shops.map((s) => `<option${s === cur ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('');
    renderSheet();
  } catch (e) {
    $('sheetInfo').textContent = 'Lỗi: ' + (e.message || e);
  } finally { $('sheetLoad').disabled = false; }
}
function renderSheet() {
  const { head, rows } = sheetState;
  const col = (h) => head.indexOf(h);
  const shop = $('sheetShop').value, q = $('sheetSearch').value.trim().toLowerCase();
  const list = rows.filter((r) => (!shop || r[col('Shop')] === shop) && (!q || `${r[col('Tên sản phẩm')]} ${r[col('ID')]}`.toLowerCase().includes(q)));
  const cols = SHEET_SHOW.filter((h) => col(h) >= 0);
  $('sheetInfo').textContent = `${fmt.num(list.length)} / ${fmt.num(rows.length)} sản phẩm trong sheet`;
  sheetState.visible = list.slice(0, 500);
  // Chỉ giữ các sản phẩm đã chọn còn nằm trong kết quả lọc hiện tại
  if (typeof sheetPicked !== 'undefined') {
    const inView = new Set(sheetState.visible.map((r) => r[col('Link')]));
    for (const l of [...sheetPicked]) if (!inView.has(l)) sheetPicked.delete(l);
    updatePickCount();
  }
  $('sheetTable').querySelector('thead').innerHTML = `<tr><th><input type="checkbox" id="sheetPickAll" title="Chọn tất cả đang hiện"></th>${cols.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
  $('sheetTable').querySelector('tbody').innerHTML = sheetState.visible.map((r) => `<tr><td><input type="checkbox" data-pick="${escapeHtml(r[col('Link')] || '')}" ${sheetPicked.has(r[col('Link')]) ? 'checked' : ''}></td>${cols.map((h) => {
    const v = String(r[col(h)] ?? '');
    if (h === 'Ảnh sản phẩm chính') { const u = v.split('\n')[0].trim(); return `<td>${u ? `<img loading="lazy" src="${escapeHtml(u)}" alt="">` : ''}</td>`; }
    if (h === 'Link') return `<td>${v ? `<a href="${escapeHtml(v)}" target="_blank">Mở</a>` : ''}</td>`;
    return `<td>${escapeHtml(v.length > 160 ? v.slice(0, 160) + '…' : v)}</td>`;
  }).join('')}</tr>`).join('') || `<tr><td class="muted">${sheetState.loaded ? 'Không có dòng nào.' : 'Bấm "Đọc từ Sheet".'}</td></tr>`;
}
// Chọn sản phẩm (theo link) + "Đăng toàn bộ": xếp lịch vào Hẹn giờ sao chép, mỗi sản phẩm cách nhau N phút
const sheetPicked = new Set();
const updatePickCount = () => { $('sheetPickCount').textContent = sheetPicked.size; };
$('sheetTable').addEventListener('change', (e) => {
  if (e.target.id === 'sheetPickAll') {
    $('sheetTable').querySelectorAll('[data-pick]').forEach((cb) => { cb.checked = e.target.checked; if (cb.dataset.pick) e.target.checked ? sheetPicked.add(cb.dataset.pick) : sheetPicked.delete(cb.dataset.pick); });
  } else if (e.target.dataset.pick !== undefined && e.target.dataset.pick) {
    e.target.checked ? sheetPicked.add(e.target.dataset.pick) : sheetPicked.delete(e.target.dataset.pick);
  }
  updatePickCount();
});
$('sheetPost').addEventListener('click', async () => {
  const links = [...sheetPicked].filter(Boolean);
  if (!links.length) return alert('Tích chọn sản phẩm cần đăng trước (ô đầu mỗi dòng, hoặc ô trên cùng để chọn tất cả).');
  const st = await chrome.storage.local.get(['tcdd-shop-code', 'maGian', 'dhHoanTextValue']);
  const gian = String(st['tcdd-shop-code'] || st.maGian || st.dhHoanTextValue || '').trim().toUpperCase();
  if (!gian) return alert('Chưa có Mã gian trên Chrome (nhập ở Auto In / Sao chép sản phẩm).');
  const delay = Math.max(1, Number($('sheetDelay').value) || 5);
  if (!confirm(`Đăng ${links.length} sản phẩm vào gian ${gian}, lần lượt từng cái, cách nhau ${delay} phút (xong khoảng ${Math.round(links.length * delay / 60 * 10) / 10} giờ)?`)) return;
  const p2 = (n) => String(n).padStart(2, '0');
  const fmtT = (t) => { const d = new Date(t); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const start = Date.now() + 60e3;
  const rows = links.map((link, i) => ({ link, gian, time: fmtT(start + i * delay * 60e3) }));
  const btn = $('sheetPost');
  btn.disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'CSCH_ADD', rows });
    if (!res?.ok) throw new Error(res?.error || 'Không thêm được lịch');
    alert(`✔ Đã xếp lịch ${res.added} sản phẩm: bắt đầu ${rows[0].time}, xong lúc ${rows[rows.length - 1].time}. Theo dõi ở tab "Hẹn giờ sao chép".`);
    sheetPicked.clear();
    renderSheet();
    updatePickCount();
  } catch (e) {
    alert('Lỗi: ' + (e.message || e));
  } finally { btn.disabled = false; }
});
$('sheetLoad').addEventListener('click', loadSheet);
$('sheetShop').addEventListener('change', renderSheet);
$('sheetSearch').addEventListener('input', renderSheet);
$('pageTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-page="sheet"]'); if (b && !sheetState.loaded) loadSheet(); });
