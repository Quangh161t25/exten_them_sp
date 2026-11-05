import { flashSale, products, getShopInfo, toNumber, sleep } from './shopee-api.js';
import { registerFlashSale, toApiItems, toSequence, validateRows, describeFailed } from './flashsale.js';
import { addLog, getLogs, clearLogs, getRules, saveRules, patchRule, getSettings, saveSettings } from './storage.js';
import { initProductsTab } from './products-tab.js';
import { getTableConfig, applyTableStyles, openColumnCustomizerModal } from './table-customizer.js';

// ---------- Tiện ích ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number(n) || 0).toLocaleString('vi-VN') + '₫';
const fmtTime = (sec) => new Date(sec * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const fmtHour = (sec) => new Date(sec * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (sec) => new Date(sec * 1000).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });

let toastTimer = null;
function toast(msg, type = 'info') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4500);
}

async function withBusy(btn, fn) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Đang xử lý...';
  try {
    return await fn();
  } catch (e) {
    toast(e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// ---------- Kết nối ----------
async function checkConnection() {
  const el = $('#connStatus');
  el.className = 'badge';
  el.textContent = 'Đang kết nối...';
  try {
    const info = await getShopInfo();
    el.className = 'badge ok';
    el.textContent = '✔ ' + (info.name || 'Đã kết nối');
    return true;
  } catch (e) {
    el.className = 'badge err';
    el.textContent = '✖ ' + e.message;
    return false;
  }
}
$('#btnConnect').onclick = checkConnection;

// ---------- Tabs ----------
const pageParams = new URLSearchParams(location.search);
const productsOnly = pageParams.get('view') === 'products';
function showTab(name) {
  // Module Sản phẩm: ẩn thanh mục, chỉ hiện lại khi sang Tạo / Sửa để còn đường quay về
  document.querySelector('nav.tabs').style.display = productsOnly && name === 'products' ? 'none' : '';
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'auto') renderAuto();
  if (name === 'logs') renderLogs();
  if (window.parent !== window) window.parent.postMessage({ type: 'HUB_FS_TAB', tab: name }, '*');
}
$$('.tab').forEach((t) => (t.onclick = () => showTab(t.dataset.tab)));
if (pageParams.has('hideProducts')) $('.tab[data-tab="products"]').style.display = 'none';
if (productsOnly) showTab('products');
// Trang chung (hub) yêu cầu chuyển tab
window.addEventListener('message', (e) => {
  if (e.source === window.parent && e.data && e.data.type === 'HUB_SHOW_FS_TAB') showTab(e.data.tab);
});

// =====================================================================
// DANH SÁCH FLASH SALE
// =====================================================================
let listType = 'next';
const STATUS_LABEL = { next: 'Sắp diễn ra', current: 'Đang diễn ra', end: 'Đã kết thúc' };

function fsPhase(f) {
  const now = Date.now() / 1000;
  if (f.end_time && f.end_time < now) return 'end';
  if (f.start_time && f.start_time <= now) return 'current';
  return 'next';
}

async function loadList() {
  const box = $('#fsList');
  box.innerHTML = '<div class="card">Đang tải...</div>';
  $('#fsDetail').classList.add('hidden');
  try {
    const list = await flashSale.listAll(listType, 4);
    if (!list.length) {
      box.innerHTML = '<div class="card muted">Không có Flash Sale nào.</div>';
      return;
    }
    box.innerHTML = `
      <div class="card table-wrap"><table class="grid">
        <thead><tr><th>ID</th><th>Khung giờ</th><th>Trạng thái</th><th>Sản phẩm</th><th>Thao tác</th></tr></thead>
        <tbody>${list.map((f) => {
          const phase = fsPhase(f);
          const count = f.enabled_item_count ?? f.item_count ?? f.total_item_count ?? f.product_count ?? '-';
          return `<tr>
            <td>#${esc(f.flash_sale_id)}</td>
            <td>${fmtDay(f.start_time)} ${fmtHour(f.start_time)} – ${fmtHour(f.end_time)}</td>
            <td><span class="status ${phase}">${STATUS_LABEL[phase]}</span></td>
            <td>${esc(count)}</td>
            <td class="row">
              <button class="btn small" data-act="view" data-id="${f.flash_sale_id}">Xem</button>
              <button class="btn small" data-act="clone" data-id="${f.flash_sale_id}">Nhân bản</button>
              ${phase === 'next' ? `<button class="btn small" data-act="edit" data-id="${f.flash_sale_id}" data-slot="${f.timeslot_id}" data-start="${f.start_time}">Sửa SP</button>` : ''}
              <button class="btn small" data-act="template" data-id="${f.flash_sale_id}">Làm mẫu</button>
            </td></tr>`;
        }).join('')}</tbody></table></div>`;
  } catch (e) {
    box.innerHTML = `<div class="card" style="color:var(--err)">Lỗi: ${esc(e.message)}</div>`;
  }
}

$('#listTypes').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  listType = b.dataset.type;
  $$('#listTypes button').forEach((x) => x.classList.toggle('active', x === b));
  loadList();
};
$('#btnReloadList').onclick = loadList;
$('#btnNewFs').onclick = () => {
  resetEditor();
  showTab('editor');
};

$('#fsList').onclick = async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  await withBusy(b, async () => {
    if (b.dataset.act === 'view') await viewFlashSale(id);
    if (b.dataset.act === 'clone') await loadFlashSaleIntoEditor(id, 'clone');
    if (b.dataset.act === 'edit') await loadFlashSaleIntoEditor(id, 'edit', { slotId: b.dataset.slot, start: b.dataset.start });
    if (b.dataset.act === 'template') await createRuleFromFlashSale(id);
  });
};

// Tải các phân loại của 1 FS rồi ghép thêm tên/giá gốc từ thông tin sản phẩm.
async function loadFlashSaleRows(id) {
  const { items, itemInfo } = await flashSale.getItems(id);
  const productCache = new Map();
  const itemIds = [...new Set(items.map((it) => Number(it.item_id)))];
  for (const itemId of itemIds) {
    try {
      productCache.set(itemId, await products.getInfo(itemId));
    } catch (e) {
      productCache.set(itemId, null);
    }
    await sleep(250);
  }
  return items.map((it) => {
    const p = productCache.get(Number(it.item_id));
    const info = itemInfo.find((x) => Number(x.itemid ?? x.item_id) === Number(it.item_id)) || {};
    const m = p && p.models.find((x) => x.modelId === Number(it.model_id));
    return {
      itemId: Number(it.item_id),
      modelId: Number(it.model_id),
      itemName: (p && p.name) || info.name || `SP ${it.item_id}`,
      modelName: (m && m.name) || '',
      image: (p && p.image) || '',
      price: m ? m.price : 0,
      promoPrice: m ? m.promoPrice : 0,
      stock: m ? m.stock : 0,
      fsPrice: toNumber(it.input_promotion_price ?? it.input_promo_price),
      fsStock: toNumber(it.stock),
      limit: toNumber(it.purchase_limit),
      enabled: Number(it.status ?? 1) === 1,
      checked: false
    };
  });
}

async function viewFlashSale(id) {
  const box = $('#fsDetail');
  box.classList.remove('hidden');
  box.innerHTML = 'Đang tải chi tiết...';
  const rows = await loadFlashSaleRows(id);
  box.innerHTML = `
    <div class="card-head"><h3>Flash Sale #${esc(id)} – ${rows.length} phân loại</h3>
      <button class="btn small" id="btnCloseDetail">Đóng</button></div>
    <div class="table-wrap"><table class="grid"><thead><tr>
      <th>Sản phẩm / Phân loại</th><th>Giá gốc</th><th>Giá FS</th><th>SL FS</th><th>Giới hạn</th><th>Bật</th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.enabled ? '' : 'disabled'}">
        <td><div class="prod">${r.image ? `<img src="${esc(r.image)}">` : ''}<div><div class="name">${esc(r.itemName)}</div><div class="model">${esc(r.modelName)}</div></div></div></td>
        <td>${r.price ? money(r.price) : '-'}</td><td>${money(r.fsPrice)}</td><td>${r.fsStock}</td><td>${r.limit || '∞'}</td><td>${r.enabled ? '✔' : '✖'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  $('#btnCloseDetail').onclick = () => box.classList.add('hidden');
  box.scrollIntoView({ behavior: 'smooth' });
}

// =====================================================================
// TRÌNH SOẠN THẢO
// =====================================================================
const editor = {
  mode: 'new', // new | clone | edit
  targetId: null,
  rows: [],
  slots: [],
  usedSlots: new Set(),
  selectedSlots: new Set(),
  searchCursor: '',
  searchResults: []
};

const rowKey = (r) => `${r.itemId}:${r.modelId}`;

function resetEditor() {
  editor.mode = 'new';
  editor.targetId = null;
  editor.rows = [];
  editor.selectedSlots.clear();
  $('#submitLog').innerHTML = '';
  renderBanner();
  renderRows();
  renderSlots();
}

function renderBanner() {
  const el = $('#editorBanner');
  if (editor.mode === 'new') {
    el.classList.add('hidden');
    $('#slotCard').classList.remove('hidden');
    return;
  }
  el.classList.remove('hidden');
  if (editor.mode === 'edit') {
    $('#slotCard').classList.add('hidden');
    el.innerHTML = `<span>Đang <b>sửa sản phẩm</b> của Flash Sale #${esc(editor.targetId)}. Sản phẩm sẽ được thêm/cập nhật vào FS này.</span>
      <button class="btn small" id="btnExitMode">Thoát, tạo mới</button>`;
  } else {
    $('#slotCard').classList.remove('hidden');
    el.innerHTML = `<span>Đang <b>nhân bản</b> từ Flash Sale #${esc(editor.targetId)}. Chọn khung giờ mới rồi bấm Đăng ký.</span>
      <button class="btn small" id="btnExitMode">Thoát, tạo mới</button>`;
  }
  $('#btnExitMode').onclick = resetEditor;
}

async function loadFlashSaleIntoEditor(id, mode) {
  const rows = await loadFlashSaleRows(id);
  editor.mode = mode;
  editor.targetId = id;
  editor.rows = rows;
  editor.selectedSlots.clear();
  $('#submitLog').innerHTML = '';
  renderBanner();
  renderRows();
  showTab('editor');
  if (mode === 'clone' && !editor.slots.length) loadSlots().catch((e) => toast(e.message, 'error'));
  toast(`Đã nạp ${rows.length} phân loại từ FS #${id}`, 'success');
}

// ----- Khung giờ -----
async function loadSlots() {
  const days = Number($('#slotDays').value);
  const [slots, upcoming] = await Promise.all([flashSale.timeSlots(days), flashSale.listAll('next')]);
  editor.slots = slots;
  editor.usedSlots = new Set(upcoming.map((f) => Number(f.timeslot_id)));
  for (const id of [...editor.selectedSlots]) {
    if (editor.usedSlots.has(id) || !slots.some((s) => s.id === id)) editor.selectedSlots.delete(id);
  }
  renderSlots();
}
$('#btnLoadSlots').onclick = (e) => withBusy(e.currentTarget, loadSlots);

function renderSlots() {
  const box = $('#slotList');
  if (!editor.slots.length) {
    box.innerHTML = '<div class="muted">Bấm "Tải khung giờ" để xem các khung giờ Flash Sale.</div>';
    return;
  }
  const byDay = new Map();
  for (const s of editor.slots) {
    const day = fmtDay(s.start);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(s);
  }
  // Ô tích chọn cả ngày / tất cả: chỉ tính khung giờ còn trống
  const free = (list) => list.filter((s) => !editor.usedSlots.has(s.id));
  const checkState = (list) => {
    const f = free(list);
    const n = f.filter((s) => editor.selectedSlots.has(s.id)).length;
    return { all: f.length > 0 && n === f.length, some: n > 0 && n < f.length, none: !f.length };
  };
  const allState = checkState(editor.slots);
  const dayKeys = [...byDay.keys()];
  box.innerHTML = `
    <label class="slot-all"><input type="checkbox" data-check="all" ${allState.all ? 'checked' : ''} ${allState.none ? 'disabled' : ''}
      ${allState.some ? 'data-some="1"' : ''}> Chọn tất cả khung giờ còn trống</label>` +
    [...byDay.entries()].map(([day, slots], di) => {
      const st = checkState(slots);
      return `
    <div class="slot-day"><input type="checkbox" class="slot-day-check" data-check="day" data-day="${di}" title="Chọn cả ngày"
        ${st.all ? 'checked' : ''} ${st.none ? 'disabled' : ''} ${st.some ? 'data-some="1"' : ''}><span class="day">${esc(day)}</span>
      ${slots.map((s) => {
        const used = editor.usedSlots.has(s.id);
        const sel = editor.selectedSlots.has(s.id);
        return `<span class="slot ${used ? 'used' : ''} ${sel ? 'selected' : ''}" data-id="${s.id}" title="${used ? 'Đã có Flash Sale' : ''}">
          ${fmtHour(s.start)} – ${fmtHour(s.end)}</span>`;
      }).join('')}
    </div>`;
    }).join('') + `<div class="hint">Đã chọn: <b>${editor.selectedSlots.size}</b> khung giờ</div>`;
  // Trạng thái "chọn một phần"
  box.querySelectorAll('input[data-some]').forEach((el) => { el.indeterminate = true; });
  editor.slotDays = dayKeys.map((k) => byDay.get(k));
}

// Tích ô cả ngày / tất cả: chọn hoặc bỏ chọn mọi khung giờ còn trống
$('#slotList').addEventListener('change', (e) => {
  const cb = e.target.closest('input[data-check]');
  if (!cb) return;
  const list = cb.dataset.check === 'all' ? editor.slots : (editor.slotDays || [])[Number(cb.dataset.day)] || [];
  for (const s of list) {
    if (editor.usedSlots.has(s.id)) continue;
    if (cb.checked) editor.selectedSlots.add(s.id);
    else editor.selectedSlots.delete(s.id);
  }
  renderSlots();
});

$('#slotList').onclick = (e) => {
  const el = e.target.closest('.slot');
  if (!el || el.classList.contains('used')) return;
  const id = Number(el.dataset.id);
  if (editor.selectedSlots.has(id)) editor.selectedSlots.delete(id);
  else editor.selectedSlots.add(id);
  renderSlots();
};

// ----- Tìm & thêm sản phẩm -----
async function searchProducts(append = false) {
  const keyword = $('#productKeyword').value.trim();
  const res = await products.search({ keyword, cursor: append ? editor.searchCursor : '' });
  editor.searchCursor = res.cursor;
  editor.searchResults = append ? editor.searchResults.concat(res.products) : res.products;
  $('#btnMoreProducts').classList.toggle('hidden', !res.cursor || !res.products.length);
  renderSearchResults();
}
$('#btnSearchProduct').onclick = (e) => withBusy(e.currentTarget, () => searchProducts(false));
$('#productKeyword').onkeydown = (e) => { if (e.key === 'Enter') $('#btnSearchProduct').click(); };
$('#btnMoreProducts').onclick = (e) => withBusy(e.currentTarget, () => searchProducts(true));

function isSellable(p) {
  return p.status === 1;
}

function renderSearchResults() {
  const box = $('#productResults');
  if (!editor.searchResults.length) {
    box.innerHTML = '<div class="muted">Không tìm thấy sản phẩm.</div>';
    return;
  }
  const keys = new Set(editor.rows.map(rowKey));
  box.innerHTML = editor.searchResults.map((p, i) => {
    const added = p.models.every((m) => keys.has(`${p.itemId}:${m.modelId}`));
    const prices = p.models.map((m) => m.price).filter(Boolean);
    const stock = p.models.reduce((a, m) => a + m.stock, 0);
    const priceText = prices.length ? (Math.min(...prices) === Math.max(...prices) ? money(prices[0]) : `${money(Math.min(...prices))} – ${money(Math.max(...prices))}`) : '';
    return `<div class="pcard ${added ? 'added' : ''}">
      ${p.image ? `<img src="${esc(p.image)}">` : '<img>'}
      <div class="info"><div class="name" title="${esc(p.name)}">${esc(p.name)}</div>
        <div class="meta">${priceText} · Kho ${stock} · ${p.models.length} phân loại${isSellable(p) ? '' : ' · <b style="color:var(--err)">Không bán được</b>'}</div></div>
      <button class="btn small" data-idx="${i}" ${added || !isSellable(p) ? 'disabled' : ''}>${added ? 'Đã thêm' : 'Thêm'}</button>
    </div>`;
  }).join('');
}

$('#productResults').onclick = (e) => {
  const b = e.target.closest('button[data-idx]');
  if (!b) return;
  addProduct(editor.searchResults[Number(b.dataset.idx)]);
  renderRows();
  renderSearchResults();
};

$('#btnAddAllResults').onclick = () => {
  const before = editor.rows.length;
  editor.searchResults.filter(isSellable).forEach(addProduct);
  renderRows();
  renderSearchResults();
  toast(`Đã thêm ${editor.rows.length - before} phân loại`);
};

function addProduct(p) {
  const keys = new Set(editor.rows.map(rowKey));
  for (const m of p.models) {
    if (keys.has(`${p.itemId}:${m.modelId}`)) continue;
    const fsPrice = m.promoPrice > 0 && m.promoPrice < m.price ? m.promoPrice : roundPrice(m.price * 0.9, 1000);
    editor.rows.push({
      itemId: p.itemId,
      modelId: m.modelId,
      itemName: p.name,
      modelName: m.name,
      image: p.image,
      price: m.price,
      promoPrice: m.promoPrice,
      stock: m.stock,
      fsPrice,
      fsStock: Math.min(m.stock, 10),
      limit: 0,
      enabled: m.stock > 0,
      checked: false
    });
  }
}

// ----- Bảng giá & số lượng -----
function roundPrice(v, step) {
  step = Number(step) || 1;
  return Math.max(0, Math.round(v / step) * step);
}

function discountText(r) {
  if (!r.price || !r.fsPrice) return '';
  const pct = Math.round((1 - r.fsPrice / r.price) * 100);
  return `<span class="discount ${pct <= 0 ? 'bad' : ''}">-${pct}%</span>`;
}

export const ROWS_TABLE_DEFAULT_COLS = [
  { id: 'chk', label: 'Chọn', defaultWidth: 42, defaultAlign: 'center', defaultWrap: false, defaultFixed: true },
  { id: 'enabled', label: 'Bật', defaultWidth: 45, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'item', label: 'Sản phẩm / Phân loại', defaultWidth: 260, defaultAlign: 'left', defaultWrap: true, defaultFixed: false },
  { id: 'origPrice', label: 'Giá gốc', defaultWidth: 95, defaultAlign: 'right', defaultWrap: false, defaultFixed: false },
  { id: 'promoPrice', label: 'Giá KM hiện tại', defaultWidth: 105, defaultAlign: 'right', defaultWrap: false, defaultFixed: false },
  { id: 'stock', label: 'Tồn kho', defaultWidth: 75, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'fsPrice', label: 'Giá Flash Sale', defaultWidth: 110, defaultAlign: 'right', defaultWrap: false, defaultFixed: false },
  { id: 'discount', label: 'Giảm', defaultWidth: 70, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'fsStock', label: 'SL FS', defaultWidth: 90, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'limit', label: 'Giới hạn', defaultWidth: 85, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'actions', label: 'Thao tác', defaultWidth: 60, defaultAlign: 'center', defaultWrap: false, defaultFixed: false }
];
let rowsTableCols = [];
const getActiveRowsCols = () => (rowsTableCols.length ? rowsTableCols : ROWS_TABLE_DEFAULT_COLS).filter((c) => c.visible !== false);

function renderRowsThead() {
  const thead = $('#rowsTable thead');
  if (!thead) return;
  const activeCols = getActiveRowsCols();
  thead.innerHTML = `<tr>${activeCols.map((c) => {
    if (c.id === 'chk') {
      return `<th data-col="chk" style="text-align:center;"><div style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" id="chkAllRows"><button class="btn-th-config" data-open-rows-cols title="Tuỳ chỉnh chi tiết các cột" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0;line-height:1;">⚙️</button></div></th>`;
    }
    return `<th data-col="${c.id}">${esc(c.label)}</th>`;
  }).join('')}</tr>`;

  const chkAll = $('#chkAllRows');
  if (chkAll) {
    chkAll.onchange = (e) => {
      editor.rows.forEach((r) => (r.checked = e.target.checked));
      renderRows();
    };
  }
}

function renderRows() {
  const tbody = $('#rowsTable tbody');
  $('#rowCount').textContent = editor.rows.length
    ? `(${editor.rows.filter((r) => r.enabled).length}/${editor.rows.length} phân loại bật)` : '';
  if (!editor.rows.length) {
    tbody.innerHTML = '<tr><td colspan="15" class="muted">Chưa có sản phẩm. Tìm và thêm sản phẩm ở bước 2.</td></tr>';
    return;
  }
  const activeCols = getActiveRowsCols();
  let prevItem = null;
  tbody.innerHTML = editor.rows.map((r, i) => {
    const first = r.itemId !== prevItem;
    prevItem = r.itemId;

    const cellBuilders = {
      chk: () => `<td data-col="chk"><input type="checkbox" data-f="checked" ${r.checked ? 'checked' : ''}></td>`,
      enabled: () => `<td data-col="enabled"><input type="checkbox" data-f="enabled" ${r.enabled ? 'checked' : ''}></td>`,
      item: () => `<td data-col="item"><div class="prod">${first && r.image ? `<img src="${esc(r.image)}">` : '<span style="width:40px"></span>'}
        <div><div class="name">${first ? esc(r.itemName) : ''}</div><div class="model">${esc(r.modelName || (first ? '' : '—'))}</div></div></div></td>`,
      origPrice: () => `<td data-col="origPrice">${r.price ? money(r.price) : '-'}</td>`,
      promoPrice: () => `<td data-col="promoPrice">${r.promoPrice ? money(r.promoPrice) : '-'}</td>`,
      stock: () => `<td data-col="stock">${r.stock}</td>`,
      fsPrice: () => `<td data-col="fsPrice"><input type="number" data-f="fsPrice" value="${r.fsPrice}" min="0"></td>`,
      discount: () => `<td data-col="discount" class="disc">${discountText(r)}</td>`,
      fsStock: () => `<td data-col="fsStock"><input type="number" data-f="fsStock" value="${r.fsStock}" min="0"></td>`,
      limit: () => `<td data-col="limit"><input type="number" data-f="limit" value="${r.limit}" min="0" title="0 = không giới hạn"></td>`,
      actions: () => `<td data-col="actions"><button class="btn small danger" data-remove="${i}">✕</button></td>`
    };

    const rowCells = activeCols
      .filter((c) => cellBuilders[c.id])
      .map((c) => cellBuilders[c.id]())
      .join('');

    return `<tr data-i="${i}" class="${r.enabled ? '' : 'disabled'} ${first ? 'first-model' : ''}">
      ${rowCells}
    </tr>`;
  }).join('');
}

$('#rowsTable tbody').addEventListener('input', (e) => {
  const tr = e.target.closest('tr[data-i]');
  const f = e.target.dataset.f;
  if (!tr || !f) return;
  const r = editor.rows[Number(tr.dataset.i)];
  if (e.target.type === 'checkbox') {
    r[f] = e.target.checked;
    if (f === 'enabled') {
      tr.classList.toggle('disabled', !r.enabled);
      $('#rowCount').textContent = `(${editor.rows.filter((x) => x.enabled).length}/${editor.rows.length} phân loại bật)`;
    }
  } else {
    r[f] = toNumber(e.target.value);
    if (f === 'fsPrice') $('.disc', tr).innerHTML = discountText(r);
  }
});

$('#rowsTable tbody').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-remove]');
  if (!b) return;
  editor.rows.splice(Number(b.dataset.remove), 1);
  renderRows();
  renderSearchResults();
});

$('#chkAllRows').onchange = (e) => {
  editor.rows.forEach((r) => (r.checked = e.target.checked));
  renderRows();
};

$('#btnClearRows').onclick = () => {
  if (!editor.rows.length || !confirm('Xoá toàn bộ sản phẩm trong danh sách?')) return;
  editor.rows = [];
  renderRows();
  renderSearchResults();
};

$('#btnApplyBulk').onclick = () => {
  const mode = $('#bulkMode').value;
  const value = toNumber($('#bulkValue').value);
  const step = Number($('#bulkRound').value);
  const stockRaw = $('#bulkStock').value.trim();
  const limitRaw = $('#bulkLimit').value.trim();
  const targets = editor.rows.some((r) => r.checked) ? editor.rows.filter((r) => r.checked) : editor.rows;

  for (const r of targets) {
    let p = r.fsPrice;
    if (mode === 'percent') p = r.price * (1 - value / 100);
    if (mode === 'amount') p = r.price - value;
    if (mode === 'fixed') p = value;
    if (mode === 'promo') p = r.promoPrice || r.fsPrice;
    if (mode !== 'keep') r.fsPrice = roundPrice(p, step);
    if (stockRaw !== '') r.fsStock = Math.min(toNumber(stockRaw), r.stock || Infinity);
    if (limitRaw !== '') r.limit = toNumber(limitRaw);
  }
  renderRows();
  toast(`Đã áp dụng cho ${targets.length} phân loại`, 'success');
};

// ----- Đăng ký -----
function submitLog(level, msg) {
  const box = $('#submitLog');
  const line = document.createElement('div');
  line.className = 'log-line ' + level;
  line.innerHTML = `<span class="t">${new Date().toLocaleTimeString('vi-VN')}</span>${esc(msg)}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

$('#btnSubmit').onclick = (e) => withBusy(e.currentTarget, async () => {
  const enabled = editor.rows.filter((r) => r.enabled);
  if (!enabled.length) return toast('Chưa có phân loại nào được bật', 'error');

  const errors = validateRows(editor.rows);
  if (errors.length) {
    const more = errors.length > 10 ? `\n... và ${errors.length - 10} lỗi khác` : '';
    if (!confirm(`Có ${errors.length} cảnh báo:\n\n${errors.slice(0, 10).join('\n')}${more}\n\nVẫn tiếp tục gửi lên Shopee?`)) return;
  }

  const targets = editor.mode === 'edit'
    ? [{ flashSaleId: editor.targetId, label: `FS #${editor.targetId}` }]
    : [...editor.selectedSlots].map((id) => {
      const s = editor.slots.find((x) => x.id === id);
      return { slotId: id, label: s ? `${fmtDay(s.start)} ${fmtHour(s.start)}` : `khung ${id}` };
    });
  if (!targets.length) return toast('Hãy chọn ít nhất 1 khung giờ', 'error');

  const items = toApiItems(editor.rows);
  if (!confirm(`Đăng ký ${items.length} phân loại vào ${targets.length} Flash Sale?`)) return;

  const sequence = toSequence(items);
  let okTargets = 0;
  for (const t of targets) {
    submitLog('info', `Đang xử lý ${t.label}...`);
    try {
      const res = await registerFlashSale({
        slotId: t.slotId,
        flashSaleId: t.flashSaleId,
        items,
        sequence,
        onLog: submitLog
      });
      okTargets++;
      const msg = `${t.label}: FS #${res.flashSaleId} – thành công ${res.okCount}/${items.length} phân loại`;
      submitLog(res.failed.length ? 'warn' : 'success', msg);
      res.failed.forEach((f) => submitLog('error', '  ✖ ' + describeFailed(f)));
      await addLog(res.failed.length ? 'warn' : 'success', msg);
    } catch (err) {
      submitLog('error', `${t.label}: ${err.message}`);
      await addLog('error', `${t.label}: ${err.message}`);
    }
    await sleep(1500);
  }
  toast(`Hoàn tất ${okTargets}/${targets.length} Flash Sale`, okTargets ? 'success' : 'error');
  if (editor.mode !== 'edit') loadSlots().catch(() => {});
});

// =====================================================================
// MẪU TỰ ĐỘNG
// =====================================================================
function newRule(name, items) {
  return {
    id: (typeof self !== 'undefined' && self.crypto && typeof self.crypto.randomUUID === 'function')
      ? self.crypto.randomUUID()
      : 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
    name,
    enabled: false,
    items,
    sequence: toSequence(items),
    hourFrom: 0,
    hourTo: 23,
    daysAhead: 3,
    minLeadHours: 2,
    maxPerRun: 3,
    registered: [],
    lastRun: null,
    lastResult: ''
  };
}

$('#btnSaveTemplate').onclick = async () => {
  const items = toApiItems(editor.rows);
  if (!items.length) return toast('Chưa có phân loại nào được bật', 'error');
  const name = prompt('Đặt tên cho mẫu tự động:', `Mẫu ${new Date().toLocaleDateString('vi-VN')}`);
  if (!name) return;
  const rules = await getRules();
  rules.push(newRule(name, items));
  await saveRules(rules);
  toast('Đã lưu mẫu. Vào tab "Tự động đăng ký" để bật.', 'success');
};

async function createRuleFromFlashSale(id) {
  const { items } = await flashSale.getItems(id);
  const apiItems = items
    .filter((it) => Number(it.status ?? 1) === 1)
    .map((it) => ({
      item_id: Number(it.item_id),
      model_id: Number(it.model_id),
      status: 1,
      input_promo_price: toNumber(it.input_promotion_price ?? it.input_promo_price),
      stock: toNumber(it.stock),
      purchase_limit: toNumber(it.purchase_limit)
    }));
  if (!apiItems.length) return toast('Flash Sale này không có phân loại nào đang bật', 'error');
  const name = prompt('Đặt tên cho mẫu tự động:', `Mẫu từ FS #${id}`);
  if (!name) return;
  const rules = await getRules();
  rules.push(newRule(name, apiItems));
  await saveRules(rules);
  toast(`Đã tạo mẫu với ${apiItems.length} phân loại`, 'success');
  showTab('auto');
}

async function renderAuto() {
  const settings = await getSettings();
  $('#autoEnabled').checked = settings.autoEnabled;
  $('#intervalMinutes').value = String(settings.intervalMinutes);

  const rules = await getRules();
  const box = $('#ruleList');
  if (!rules.length) {
    box.innerHTML = '<div class="card muted">Chưa có mẫu tự động nào.</div>';
    return;
  }
  box.innerHTML = rules.map((r) => `
    <div class="card rule ${r.enabled ? 'on' : ''}" data-id="${r.id}">
      <div class="card-head">
        <h3>${esc(r.name)} <span class="muted">· ${r.items.length} phân loại · ${new Set(r.items.map((x) => x.item_id)).size} sản phẩm</span></h3>
        <label class="switch-label"><input type="checkbox" data-f="enabled" ${r.enabled ? 'checked' : ''}> Bật</label>
      </div>
      <div class="grid-form">
        <label>Khung giờ bắt đầu từ <input type="number" data-f="hourFrom" min="0" max="23" value="${r.hourFrom}"> h</label>
        <label>đến <input type="number" data-f="hourTo" min="0" max="23" value="${r.hourTo}"> h</label>
        <label>Đăng ký trước tối đa <input type="number" data-f="daysAhead" min="1" max="30" value="${r.daysAhead}"> ngày</label>
        <label>Bỏ qua khung bắt đầu trong <input type="number" data-f="minLeadHours" min="0" value="${r.minLeadHours}"> giờ tới</label>
        <label>Tối đa mỗi lần chạy <input type="number" data-f="maxPerRun" min="1" max="20" value="${r.maxPerRun}"> FS</label>
      </div>
      <div class="hint">Lần chạy cuối: ${r.lastRun ? new Date(r.lastRun).toLocaleString('vi-VN') : 'chưa chạy'}${r.lastResult ? ' – ' + esc(r.lastResult) : ''} · Đã đăng ký ${(r.registered || []).length} khung giờ</div>
      <div class="row">
        <button class="btn small primary" data-act="save">Lưu</button>
        <button class="btn small" data-act="run">Chạy ngay</button>
        <button class="btn small" data-act="reset">Xoá lịch sử khung đã đăng ký</button>
        <button class="btn small danger" data-act="delete">Xoá mẫu</button>
      </div>
    </div>`).join('');
}

function readRuleForm(card) {
  const patch = {};
  $$('[data-f]', card).forEach((el) => {
    patch[el.dataset.f] = el.type === 'checkbox' ? el.checked : toNumber(el.value);
  });
  return patch;
}

$('#ruleList').addEventListener('change', async (e) => {
  if (e.target.dataset.f !== 'enabled') return;
  const card = e.target.closest('.rule');
  await patchRule(card.dataset.id, { enabled: e.target.checked });
  card.classList.toggle('on', e.target.checked);
  toast(e.target.checked ? 'Đã bật mẫu' : 'Đã tắt mẫu');
});

$('#ruleList').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const card = b.closest('.rule');
  const id = card.dataset.id;
  const act = b.dataset.act;
  if (act === 'save') {
    await patchRule(id, readRuleForm(card));
    toast('Đã lưu', 'success');
    renderAuto();
  }
  if (act === 'reset') {
    await patchRule(id, { registered: [] });
    renderAuto();
  }
  if (act === 'delete') {
    if (!confirm('Xoá mẫu này?')) return;
    await saveRules((await getRules()).filter((r) => r.id !== id));
    renderAuto();
  }
  if (act === 'run') {
    await patchRule(id, readRuleForm(card));
    await withBusy(b, async () => {
      const res = await chrome.runtime.sendMessage({ type: 'FS_RUN_RULES', ruleId: id });
      if (!res || !res.ok) throw new Error((res && res.error) || 'Không có phản hồi');
      if (res.skipped) toast('Đang có một lượt chạy khác, thử lại sau');
      else toast(`Đã tạo ${res.created} Flash Sale. Xem tab Nhật ký.`, 'success');
    });
    renderAuto();
  }
});

$('#autoEnabled').onchange = (e) => saveSettings({ autoEnabled: e.target.checked });
$('#intervalMinutes').onchange = (e) => saveSettings({ intervalMinutes: Number(e.target.value) });

// =====================================================================
// NHẬT KÝ
// =====================================================================
async function renderLogs() {
  const logs = await getLogs();
  const box = $('#logList');
  box.innerHTML = logs.length
    ? logs.slice().reverse().map((l) => `<div class="log-line ${l.level}"><span class="t">${new Date(l.time).toLocaleString('vi-VN')}</span>${esc(l.message)}</div>`).join('')
    : '<div class="muted">Chưa có nhật ký.</div>';
}
$('#btnReloadLogs').onclick = renderLogs;
$('#btnClearLogs').onclick = async () => {
  if (!confirm('Xoá toàn bộ nhật ký?')) return;
  await clearLogs();
  renderLogs();
};
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.fs_logs && $('#tab-logs').classList.contains('active')) renderLogs();
});

// ---------- Khởi động ----------
rowsTableCols = getTableConfig('rowsTable', ROWS_TABLE_DEFAULT_COLS);
applyTableStyles('rowsTable', rowsTableCols);
renderRowsThead();

const openRowsTableCustomizer = () => {
  openColumnCustomizerModal({
    tableId: 'rowsTable',
    tableName: 'Bảng Flash Sale Editor',
    defaultCols: ROWS_TABLE_DEFAULT_COLS,
    currentConfig: rowsTableCols,
    onSave: (newCfg) => {
      rowsTableCols = newCfg;
      renderRowsThead();
      renderRows();
    }
  });
};

const btnRowsCols = $('#btnRowsTableCols');
if (btnRowsCols) btnRowsCols.onclick = openRowsTableCustomizer;

const rowsThead = $('#rowsTable thead');
if (rowsThead) {
  rowsThead.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-rows-cols]') || e.target.closest('.btn-th-config')) {
      e.stopPropagation();
      openRowsTableCustomizer();
    }
  });
}

renderRows();
renderSlots();
initProductsTab({
  toast,
  onFlashSale(list) {
    const before = editor.rows.length;
    list.forEach(addProduct);
    renderRows();
    showTab('editor');
    toast(`Đã thêm ${editor.rows.length - before} phân loại vào Flash Sale`, 'success');
  }
});

checkConnection().then((ok) => { if (ok) loadList(); });
