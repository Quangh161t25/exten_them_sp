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

/* ---------- Tải dữ liệu ---------- */
async function start(target) {
  const token = (state.token = (state.token || 0) + 1); // lượt quét cũ sẽ tự dừng
  Object.assign(state, { rows: [], filtered: [], page: 1, selected: new Set(), cancelled: false });
  detailQ.items = []; detailQ.blocked = '';
  show('err', false);
  show('head', false);
  show('body', false);

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
    td('', thumbs(r, 'images', r.images)),
    // --- nhóm cột phân loại chèn vào đây ---
    td('', r.descImages === null ? loadBtn(r) : r.descImages.length ? thumbs(r, 'descImages', r.descImages) : '<span class="muted">Không có</span>'),
    td('', r.description === null ? loadBtn(r) : r.description
      ? `<div class="desc" data-act="desc" data-id="${r.itemId}" title="Bấm để xem đầy đủ">${escapeHtml(r.description.slice(0, 300))}</div>`
      : '<span class="muted">Không có</span>'),
  ];
}

/** Các dòng phân loại: mỗi phần tử là chuỗi 5 ô (Phân loại, Ảnh, Giá, Giá gốc, Giảm) */
function variationRows(r) {
  if (r.models === null) {
    const strip = r.variationImages.length ? thumbs(r, 'variationImages', r.variationImages.map((v) => v.url)) : '<span class="muted">–</span>';
    return [`<td class="v">${loadBtn(r)}</td><td class="v">${strip}</td><td class="v r muted">–</td><td class="v r muted">–</td><td class="v r muted">–</td>`];
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
const DETAIL_WORKERS = 3; // số request chi tiết chạy song song
const detailQ = { items: [], workers: 0, done: 0, failed: 0, blocked: '', manual: false };
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function visibleRows() {
  const start = (state.page - 1) * state.pageSize;
  return state.filtered.slice(start, start + state.pageSize);
}
const needsDetail = (r) => r.description === null && !state.detailLoading.has(r.itemId);

/** Tự động: trang đang xem lên đầu, sau đó là toàn bộ sản phẩm còn lại (gọi khi quét/đổi trang/lọc/sắp xếp) */
function autoLoadVisible() {
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
  if (!detailQ.workers) { detailQ.done = 0; detailQ.failed = 0; }
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
    } catch (e) {
      detailQ.failed++;
      if (/anti-bot/.test(e.message)) detailQ.blocked = e.message;
    }
    scheduleRender();
    await sleep(150 + Math.random() * 250); // giãn nhẹ để tránh bị Shopee chặn
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
function exportCsv() {
  const cols = [
    ['ID', 'itemId'], ['Tên sản phẩm', 'name'], ['Link', 'url'], ['Thương hiệu', 'brand'], ['Ngành hàng', 'categoryName'],
    ['Danh mục đầy đủ', 'categoryTree'], ['Shop', 'shopName'], ['Kho hàng', 'location'],
    ['Giá', 'price'], ['Giá gốc', 'priceOrigin'], ['Giảm (%)', 'discountPercent'], ['Đã bán', 'sold'],
    ['Doanh thu', 'sale'], ['Bán 30 ngày', 'soldMonth'], ['DT 30 ngày', 'saleMonth'], ['Bán/ngày', 'soldPerDay'],
    ['Sao', 'ratingStar'], ['Lượt đánh giá', 'ratingCount'], ['Lượt thích', 'liked'], ['Tồn kho', 'stock'],
    ['Flash sale', 'isFlashSale'], ['Loại khuyến mãi', 'promotionName'], ['Ngày tạo', 'ctime'],
    ['Ảnh sản phẩm chính', 'images'], ['Ảnh phân loại', 'variationImages'], ['Giá & giảm phân loại', 'models'], ['Ảnh mô tả', 'descImages'],
    ['Mô tả sản phẩm', 'description'],
  ];
  const cell = (v) => {
    if (v instanceof Date) v = v.toLocaleDateString('vi-VN');
    if (Array.isArray(v)) {
      v = v.map((x) => (typeof x === 'string' ? x
        : 'price' in x ? `${x.name}: ${x.price} (gốc ${x.priceOrigin}, -${x.discount}%)${x.inStock ? '' : ' [hết]'}`
        : `${x.label}: ${x.url}`)).join('\n');
    }
    if (typeof v === 'boolean') v = v ? 'Có' : '';
    if (typeof v === 'number') v = Math.round(v * 100) / 100;
    const s = String(v ?? '');
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
$('loadDetail').addEventListener('click', toggleBulkLoad);
try { $('autoDetail').checked = localStorage.getItem('autoDetail') !== '0'; } catch {}
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
if (initial) {
  $('q').value = initial.shopId || initial.username;
  start(initial);
}
