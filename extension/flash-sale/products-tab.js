// Tab "Sản phẩm": tải và hiển thị toàn bộ sản phẩm của shop.
import { products, getShopInfo, sleep, getShopWarehouses, extractLocationsStock, normalizeProduct } from './shopee-api.js';
import { extractMedia } from './media.js';
import { getTableConfig, applyTableStyles, openColumnCustomizerModal } from './table-customizer.js';
import { initProductEditModal, openProductEditModal } from './product-edit-modal.js';

export const P_TABLE_DEFAULT_COLS = [
  { id: 'chk', label: 'Chọn', isParent: true, defaultWidth: 46, defaultAlign: 'center', defaultWrap: false, defaultFixed: true },
  { id: 'itemId', label: 'ID chính', isParent: true, defaultWidth: 105, defaultAlign: 'left', defaultWrap: false, defaultFixed: false },
  { id: 'name', label: 'Tên sản phẩm', isParent: true, defaultWidth: 230, defaultAlign: 'left', defaultWrap: true, defaultFixed: false },
  { id: 'link', label: 'Link SP', isParent: true, defaultWidth: 70, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'desc', label: 'Mô tả SP', isParent: true, defaultWidth: 180, defaultAlign: 'left', defaultWrap: true, defaultFixed: false },
  { id: 'parentSku', label: 'SKU', isParent: true, defaultWidth: 110, defaultAlign: 'left', defaultWrap: false, defaultFixed: false },
  { id: 'modelId', label: 'ID phân loại', isParent: false, defaultWidth: 95, defaultAlign: 'left', defaultWrap: false, defaultFixed: false },
  { id: 'modelName', label: 'Tên phân loại', isParent: false, defaultWidth: 130, defaultAlign: 'left', defaultWrap: true, defaultFixed: false },
  { id: 'modelSku', label: 'SKU phân loại', isParent: false, defaultWidth: 115, defaultAlign: 'left', defaultWrap: false, defaultFixed: false },
  { id: 'modelImg', label: 'Ảnh phân loại', isParent: false, defaultWidth: 75, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'images', label: 'Ảnh chính', isParent: true, defaultWidth: 90, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'descImages', label: 'Ảnh mô tả', isParent: true, defaultWidth: 90, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'videos', label: 'Video', isParent: true, defaultWidth: 80, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'price', label: 'Giá', isParent: false, defaultWidth: 95, defaultAlign: 'right', defaultWrap: false, defaultFixed: false },
  { id: 'promoPrice', label: 'Giá KM', isParent: false, defaultWidth: 95, defaultAlign: 'right', defaultWrap: false, defaultFixed: false },
  { id: 'stock', label: 'Tồn kho', isParent: false, defaultWidth: 105, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'createTime', label: 'Ngày tạo', isParent: true, defaultWidth: 95, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'actions', label: 'Thao tác', isParent: true, defaultWidth: 320, defaultAlign: 'left', defaultWrap: true, defaultFixed: false }
];
let pTableCols = [];
const SHEET_TABLE_DEFAULT_COLS = [
  { id: 'chk', label: 'Chọn', isParent: true, defaultWidth: 46, defaultAlign: 'center', defaultWrap: false, defaultFixed: true },
  { id: 'gian', label: 'Gian', isParent: true, defaultWidth: 80, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'itemId', label: 'ID chính', isParent: true, defaultWidth: 140, defaultAlign: 'left', defaultWrap: false, defaultFixed: false },
  { id: 'name', label: 'Tên sản phẩm', isParent: true, defaultWidth: 230, defaultAlign: 'left', defaultWrap: true, defaultFixed: false },
  { id: 'link', label: 'Link SP', isParent: true, defaultWidth: 70, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'desc', label: 'Mô tả SP', isParent: true, defaultWidth: 180, defaultAlign: 'left', defaultWrap: true, defaultFixed: false },
  { id: 'parentSku', label: 'SKU', isParent: true, defaultWidth: 110, defaultAlign: 'left', defaultWrap: false, defaultFixed: false },
  { id: 'modelId', label: 'ID phân loại', isParent: false, defaultWidth: 95, defaultAlign: 'left', defaultWrap: false, defaultFixed: false },
  { id: 'modelName', label: 'Tên phân loại', isParent: false, defaultWidth: 130, defaultAlign: 'left', defaultWrap: true, defaultFixed: false },
  { id: 'modelSku', label: 'SKU phân loại', isParent: false, defaultWidth: 115, defaultAlign: 'left', defaultWrap: false, defaultFixed: false },
  { id: 'modelImg', label: 'Ảnh phân loại', isParent: false, defaultWidth: 75, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'images', label: 'Ảnh chính', isParent: true, defaultWidth: 90, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'descImages', label: 'Ảnh mô tả', isParent: true, defaultWidth: 90, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'videos', label: 'Video', isParent: true, defaultWidth: 80, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'price', label: 'Giá', isParent: false, defaultWidth: 95, defaultAlign: 'right', defaultWrap: false, defaultFixed: false },
  { id: 'promoPrice', label: 'Giá KM', isParent: false, defaultWidth: 95, defaultAlign: 'right', defaultWrap: false, defaultFixed: false },
  { id: 'stock', label: 'Tồn kho', isParent: false, defaultWidth: 105, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'createTime', label: 'Ngày tạo', isParent: true, defaultWidth: 95, defaultAlign: 'center', defaultWrap: false, defaultFixed: false },
  { id: 'actions', label: 'Thao tác', isParent: true, defaultWidth: 320, defaultAlign: 'left', defaultWrap: true, defaultFixed: false }
];
let sheetTableCols = [];
const getActiveSheetCols = () => (sheetTableCols.length ? sheetTableCols : SHEET_TABLE_DEFAULT_COLS).filter((c) => c.visible !== false);
export const getActivePTableCols = () => (pTableCols.length ? pTableCols : P_TABLE_DEFAULT_COLS).filter((c) => c.visible !== false);

const PAGE_SIZE = 50;
const CACHE_KEY = 'fs_productCache';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number(n) || 0).toLocaleString('vi-VN') + '₫';

const STATUS = {
  1: { label: 'Đang bán', cls: 'current' },
  4: { label: 'Bị khoá', cls: 'bad' },
  8: { label: 'Đã ẩn', cls: 'end' }
};

const state = {
  all: [],
  loadedAt: null,
  shopId: null,
  warehouses: [],
  loading: false,
  stop: false,
  page: 1,
  selected: new Set(),
  expanded: new Set()
};

function shortenWarehouseName(name) {
  if (!name) return 'Kho';
  let s = String(name).replace(/^Kho\s+/i, '').replace(/\(Mặc định\)/i, '').trim();
  if (/hà nội|hn/i.test(s)) return 'Hà Nội';
  if (/hồ chí minh|hcm|sài gòn/i.test(s)) return 'TP.HCM';
  if (/đà nẵng/i.test(s)) return 'Đà Nẵng';
  if (/bình dương/i.test(s)) return 'Bình Dương';
  if (s.length > 10) return s.slice(0, 9) + '…';
  return s || 'Kho';
}

let hooks = { toast: () => {}, onFlashSale: () => {} };

// ---------- Tính toán ----------
const totalStock = (p) => p.models.reduce((a, m) => a + m.stock, 0);
const minPrice = (p) => Math.min(...p.models.map((m) => m.price || Infinity));
const maxPrice = (p) => Math.max(...p.models.map((m) => m.price || 0));

function statusOf(p) {
  if (p.unlisted && p.status === 1) return { label: 'Đã ẩn', cls: 'end' };
  return STATUS[p.status] || { label: `Trạng thái ${p.status}`, cls: '' };
}

function priceText(p) {
  const lo = minPrice(p);
  const hi = maxPrice(p);
  if (!Number.isFinite(lo) || !hi) return '-';
  return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`;
}

function filtered() {
  const q = $('#pfSearch').value.trim().toLowerCase();
  const status = $('#pfStatus').value;
  const stock = $('#pfStock').value;
  const sort = $('#pfSort').value;

  let list = state.all.filter((p) => {
    if (q) {
      const hay = `${p.name} ${p.itemId} ${p.parentSku} ${p.models.map((m) => m.sku + ' ' + m.name).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (status === 'active' && !(p.status === 1 && !p.unlisted)) return false;
    if (status === 'hidden' && !(p.unlisted || p.status === 8)) return false;
    if (status === 'banned' && p.status !== 4) return false;
    const s = totalStock(p);
    if (stock === 'out' && s > 0) return false;
    if (stock === 'low' && !(s > 0 && s <= 10)) return false;
    if (stock === 'in' && s <= 0) return false;
    return true;
  });

  const sorters = {
    newest: (a, b) => b.createTime - a.createTime,
    name: (a, b) => a.name.localeCompare(b.name, 'vi'),
    priceAsc: (a, b) => minPrice(a) - minPrice(b),
    priceDesc: (a, b) => maxPrice(b) - maxPrice(a),
    stockAsc: (a, b) => totalStock(a) - totalStock(b),
    stockDesc: (a, b) => totalStock(b) - totalStock(a),
    sold: (a, b) => b.sold - a.sold
  };
  if (sorters[sort]) list = list.slice().sort(sorters[sort]);
  return list;
}

// ---------- Hiển thị ----------
function renderSummary() {
  const all = state.all;
  const active = all.filter((p) => p.status === 1 && !p.unlisted).length;
  const out = all.filter((p) => totalStock(p) <= 0).length;
  const models = all.reduce((a, p) => a + p.models.length, 0);
  $('#pSummary').innerHTML = all.length
    ? `<b>${all.length}</b> sản phẩm · ${models} phân loại · <b>${active}</b> đang bán · <b style="color:var(--err)">${out}</b> hết hàng`
      + (state.loadedAt ? ` · cập nhật ${new Date(state.loadedAt).toLocaleString('vi-VN')}` : '')
    : 'Chưa tải sản phẩm. Bấm "Tải toàn bộ sản phẩm".';
}

function render() {
  renderSummary();
  const list = filtered();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * PAGE_SIZE;
  const rows = list.slice(start, start + PAGE_SIZE);

  $('#pSelCount').textContent = state.selected.size;
  $('#pFilteredCount').textContent = list.length;

  const tbody = $('#pTable tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="18" class="muted">${state.all.length ? 'Không có sản phẩm khớp bộ lọc.' : 'Chưa có dữ liệu.'}</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(productRows).join('');
  }
  loadPageMedia(rows);

  $('#pPager').innerHTML = pages > 1
    ? `<button class="btn small" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹ Trước</button>
       <span>Trang ${state.page}/${pages}</span>
       <button class="btn small" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>Sau ›</button>`
    : '';
}

// ---------- Ô ảnh / video trong bảng ----------
const dateText = (p) => (p.createTime ? new Date(p.createTime * 1000).toLocaleDateString('vi-VN') : '-');

function thumb(img, title = '') {
  return `<a href="${esc(img.url)}" target="_blank" title="${esc(title || 'Mở ảnh gốc')}"><img class="cell-img" src="${esc(img.thumb)}" loading="lazy"></a>`;
}

function imagesCell(list, max = 3) {
  if (!list.length) return '<span class="muted">—</span>';
  const more = list.length > max ? `<button class="btn small" data-media title="Xem tất cả">+${list.length - max}</button>` : '';
  return `<div class="cell-imgs">${list.slice(0, max).map((x) => thumb(x)).join('')}${more}</div>`;
}

function videoCell(videos) {
  if (!videos.length) return '<span class="muted">—</span>';
  return videos.map((v) => (v.url
    ? `<a href="${esc(v.url)}" target="_blank" class="video-link" title="Mở video">${v.thumb ? `<img class="cell-img" src="${esc(v.thumb)}">` : ''}▶${v.duration ? ' ' + v.duration + 's' : ''}</a>`
    : `<span class="muted" title="Không có link phát">ID ${esc(v.id)}</span>`)).join(' ');
}

export function renderPTableThead() {
  const thead = $('#pTable thead');
  if (!thead) return;
  const activeCols = getActivePTableCols();
  thead.innerHTML = `<tr>${activeCols.map((c) => {
    if (c.id === 'chk') {
      return `<th data-col="chk" style="text-align:center;"><div style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" id="pChkAll" title="Chọn cả trang"><button class="btn-th-config" data-open-cols title="Tuỳ chỉnh chi tiết các cột" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0;line-height:1;">⚙️</button></div></th>`;
    }
    return `<th data-col="${c.id}">${esc(c.label)}</th>`;
  }).join('')}</tr>`;

  const chkAll = $('#pChkAll');
  if (chkAll) {
    chkAll.onchange = (e) => {
      const start = (state.page - 1) * PAGE_SIZE;
      filtered().slice(start, start + PAGE_SIZE).forEach((p) => {
        if (e.target.checked) state.selected.add(p.itemId);
        else state.selected.delete(p.itemId);
      });
      render();
    };
  }
}

// Ô SKU sửa được: modelId rỗng là SKU sản phẩm
const skuView = (value, itemId, modelId = '') => `<span class="sku-edit-view" data-item-id="${esc(itemId)}" data-model-id="${esc(modelId)}" title="Bấm để sửa SKU trên Shopee" style="cursor:pointer;">${esc(value) || '<span class="muted">—</span>'} <span style="font-size:10px;opacity:.65;">✏️</span></span>`;

function productRows(p) {
  const activeCols = getActivePTableCols();
  const st = statusOf(p);
  const media = mediaCache.get(p.itemId);
  const err = mediaErrors.get(p.itemId);
  const pending = !media && !err;
  const span = p.models.length;
  const loadingCell = pending ? '<span class="muted">…</span>' : `<span class="muted" title="${esc(err || '')}">lỗi</span>`;
  const shopLink = state.shopId ? `https://shopee.vn/product/${state.shopId}/${p.itemId}` : '';
  const sLink = shopLink || (p.itemId ? `https://shopee.vn/product/0/${p.itemId}` : '');
  const linkCell = sLink
    ? `<a class="btn small" target="_blank" href="${esc(sLink)}" title="${esc(sLink)}" style="color:#0284c7;font-weight:600;white-space:nowrap;">🔗 Mở</a>`
    : '<span class="muted">—</span>';
  const desc = p.description || (media && media.description) || '';
  const descShort = desc ? (desc.length > 70 ? desc.slice(0, 70) + '...' : desc) : '';
  const descCell = desc
    ? `<div class="desc-cell" style="max-height:55px;overflow:hidden;font-size:11.5px;color:#475569;line-height:1.35;white-space:pre-wrap;" title="${esc(desc)}">${esc(descShort)}</div>`
    : (pending ? loadingCell : '<span class="muted">—</span>');

  const rs = `rowspan="${span}"`;

  return p.models.map((m, i) => {
    const mImg = media && (media.modelImages || {})[m.modelId];
    const cellBuilders = {
      chk: () => `<td data-col="chk" ${rs}><input type="checkbox" data-sel ${state.selected.has(p.itemId) ? 'checked' : ''}></td>`,
      itemId: () => `<td data-col="itemId" ${rs}>${p.itemId}</td>`,
      name: () => `<td data-col="name" ${rs} class="name-cell"><div class="name">${esc(p.name)}</div><span class="status ${st.cls}">${st.label}</span></td>`,
      link: () => `<td data-col="link" ${rs}>${linkCell}</td>`,
      desc: () => `<td data-col="desc" ${rs}>${descCell}</td>`,
      parentSku: () => `<td data-col="parentSku" ${rs}>${skuView(p.parentSku, p.itemId)}</td>`,
      modelId: () => `<td data-col="modelId">${m.modelId || '—'}</td>`,
      modelName: () => `<td data-col="modelName">${esc(m.name) || '<span class="muted">Mặc định</span>'}</td>`,
      modelSku: () => `<td data-col="modelSku">${skuView(m.sku, p.itemId, m.modelId || 0)}</td>`,
      modelImg: () => `<td data-col="modelImg">${media ? (mImg ? thumb(mImg, m.name) : '<span class="muted">—</span>') : loadingCell}</td>`,
      images: () => `<td data-col="images" ${rs}>${media ? imagesCell(media.images) : (p.image ? `<img class="cell-img" src="${esc(p.image)}">` : loadingCell)}</td>`,
      descImages: () => `<td data-col="descImages" ${rs}>${media ? imagesCell(media.descImages) : loadingCell}</td>`,
      videos: () => `<td data-col="videos" ${rs}>${media ? videoCell(media.videos) : loadingCell}</td>`,
      price: () => `<td data-col="price">${m.price ? money(m.price) : '-'}</td>`,
      promoPrice: () => `<td data-col="promoPrice">${m.promoPrice && m.promoPrice < m.price ? money(m.promoPrice) : '<span class="muted">—</span>'}</td>`,
      stock: () => {
        const isOut = m.stock <= 0;
        const locs = m.locationStocks || [];
        const hasMultiWh = locs.length > 1;

        let locDetailsHtml = '';
        if (locs.length > 0) {
          locDetailsHtml = `
            <div class="stock-locations-breakdown" style="display:flex;flex-direction:column;gap:2px;margin-top:3px;font-size:10px;text-align:left;width:100%;max-width:105px;">
              ${locs.map((loc) => {
                const whShort = shortenWarehouseName(loc.warehouseName);
                const isLocOut = loc.stock <= 0;
                return `
                  <div class="wh-stock-item" title="${esc(loc.warehouseName)}: ${loc.stock}" style="display:flex;align-items:center;justify-content:space-between;gap:4px;background:#f8fafc;padding:1px 4px;border-radius:3px;border:1px solid #e2e8f0;line-height:1.2;">
                    <span style="color:#64748b;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:62px;">${esc(whShort)}:</span>
                    <b style="color:${isLocOut ? 'var(--err)' : '#0f172a'}">${loc.stock}</b>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        return `<td data-col="stock" class="stock-cell" data-item-id="${p.itemId}" data-model-id="${m.modelId || 0}" data-stock="${m.stock}" style="text-align:center;padding:4px 6px;">
          <div class="stock-display" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="display:inline-flex;align-items:center;gap:4px;justify-content:center;">
              <span class="stock-num" style="${isOut ? 'color:var(--err);font-weight:700;' : 'font-weight:700;'};font-size:12px;" title="${hasMultiWh ? 'Tổng tồn các kho: ' + m.stock : 'Bấm để sửa tồn kho trên Shopee'}">${m.stock}</span>
              <button type="button" class="btn-stock-edit" title="Sửa tồn kho trên Shopee" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;font-size:10.5px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:3px;cursor:pointer;opacity:0.75;" onmouseover="this.style.opacity=1;this.style.background='#e0f2fe'" onmouseout="this.style.opacity=0.75;this.style.background='#f8fafc'">✏️</button>
            </div>
            ${locDetailsHtml}
          </div>
        </td>`;
      },
      createTime: () => `<td data-col="createTime" ${rs}>${dateText(p)}</td>`,
      actions: () => `<td data-col="actions" ${rs} class="row">
        <button class="btn small" data-open-edit="${p.itemId}" title="Xem &amp; Chỉnh sửa chi tiết sản phẩm đầy đủ như Shopee Portal" style="font-weight:700;background:#f59e0b;border-color:#d97706;color:#fff;">📝 Sửa chi tiết</button>
        <button class="btn small primary" data-fill-sheet="${p.itemId}" title="Điền sản phẩm này vào sheet SP_SHOPEE" style="font-weight:700;background:#0284c7;border-color:#0284c7;color:#fff;">Điền Shopee</button>
        <button class="btn small" data-fill-websp="${p.itemId}" title="Điền sản phẩm này vào sheet WEB_SP" style="font-weight:700;background:#10b981;border-color:#10b981;color:#fff;">Điền Web SP</button>
        <button class="btn small" data-media>🖼 Ảnh &amp; Video</button>
        <button class="btn small" data-sync-item="${p.itemId}" title="Đồng bộ lại thông tin &amp; tồn kho của sản phẩm này từ Shopee" style="font-weight:700;background:#6366f1;border-color:#4f46e5;color:#fff;">🔄 Đồng bộ</button>
        <a class="btn small" target="_blank" href="https://banhang.shopee.vn/portal/product/${p.itemId}">Sửa</a>
        ${shopLink ? `<a class="btn small" target="_blank" href="${shopLink}">Xem</a>` : ''}
      </td>`
    };

    if (i > 0) {
      const subCells = activeCols
        .filter((c) => !c.isParent && cellBuilders[c.id])
        .map((c) => cellBuilders[c.id]())
        .join('');
      return `<tr class="model-row" data-id="${p.itemId}">${subCells}</tr>`;
    }

    const allCells = activeCols
      .filter((c) => cellBuilders[c.id])
      .map((c) => cellBuilders[c.id]())
      .join('');
    return `<tr class="first-model" data-id="${p.itemId}">${allCells}</tr>`;
  }).join('');
}

// Tải ảnh/video cho các sản phẩm ở trang đang xem (lần lượt, có nghỉ để tránh bị chặn).
const mediaErrors = new Map();
let mediaQueueToken = 0;

function syncProductWarehouseStock(p, raw) {
  if (!p || !raw) return;
  const warehouses = state.warehouses || [];
  if (Array.isArray(raw.model_list) && raw.model_list.length > 0) {
    raw.model_list.forEach((rm) => {
      const m = p.models.find((x) => Number(x.modelId) === Number(rm.id ?? rm.model_id ?? 0));
      if (m) {
        const locs = extractLocationsStock(rm, raw, warehouses);
        if (locs.length > 0) {
          m.locationStocks = locs;
          m.locationStocksSynced = true;
          const locSum = locs.reduce((sum, l) => sum + (Number(l.stock) || 0), 0);
          if (locSum > 0 || m.stock <= 0) {
            m.stock = locSum;
          } else if (locSum === 0 && m.stock > 0 && locs.length > 0) {
            locs[0].stock = m.stock;
          }
        }
      }
    });
    p.stock = p.models.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
  } else {
    const locs = extractLocationsStock(raw, raw, warehouses);
    if (locs.length > 0 && p.models[0]) {
      p.models[0].locationStocks = locs;
      p.models[0].locationStocksSynced = true;
      const locSum = locs.reduce((sum, l) => sum + (Number(l.stock) || 0), 0);
      if (locSum > 0 || p.models[0].stock <= 0) {
        p.models[0].stock = locSum;
      } else if (locSum === 0 && p.models[0].stock > 0 && locs.length > 0) {
        locs[0].stock = p.models[0].stock;
      }
      p.stock = p.models[0].stock;
    }
  }
}

// Cập nhật số tồn trên giao diện theo tồn kho Shopee đọc lại sau khi lưu (products.updateStock trả về)
function applySavedStock(p, res, editedModelId = null, expectedStock = null) {
  const list = res && res.stock;
  if (!p || !Array.isArray(list)) return;
  const whName = (id) => ((state.warehouses || []).find((w) => String(w.location_id) === String(id)) || {}).warehouse_name || id;
  list.forEach((ms, idx) => {
    const m = p.models.find((x) => Number(x.modelId) === ms.modelId) || (p.models.length === list.length ? p.models[idx] : null);
    if (!m) return;
    if (!Number(m.modelId) && ms.modelId) m.modelId = ms.modelId;

    const isTargetEdited = editedModelId === null || Number(m.modelId) === Number(editedModelId);
    if (isTargetEdited && expectedStock !== null && ms.stock !== expectedStock) {
      // Shopee replica lag: giữ số người dùng vừa lưu thay vì ghi đè số cũ
      m.stock = expectedStock;
    } else {
      m.stock = ms.stock;
    }

    if (ms.locations && ms.locations.length) {
      m.locationStocks = ms.locations.map((l) => ({ locationId: l.locationId, warehouseName: whName(l.locationId), stock: l.stock }));
    }
    m.locationStocksSynced = true;
  });
  p.stock = p.models.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
}

// Đọc tồn kho đúng theo từng kho (API get_product_stock, giống trang Kênh Người Bán) cho các SP đang xem.
async function syncStockFromShopee(rows) {
  const stockMap = await products.getStock(rows.map((p) => p.itemId));
  const whName = (id) => ((state.warehouses || []).find((w) => String(w.location_id) === String(id)) || {}).warehouse_name || id;
  const changed = [];
  for (const p of rows) {
    const list = stockMap.get(Number(p.itemId));
    if (!list || !list.length) continue;
    list.forEach((ms, idx) => {
      // SP không phân loại: danh sách SP có modelId 0, Shopee trả model_id thật -> gán theo thứ tự
      let m = p.models.find((x) => Number(x.modelId) === ms.modelId);
      if (!m && p.models.length === 1 && list.length === 1) m = p.models[0];
      if (!m && p.models[idx] && !Number(p.models[idx].modelId)) m = p.models[idx];
      if (!m) return;
      if (!Number(m.modelId) && ms.modelId) m.modelId = ms.modelId;
      m.locationStocks = ms.locations.map((l) => ({ locationId: l.locationId, warehouseName: whName(l.locationId), stock: l.stock }));
      m.locationStocksSynced = true;
      m.stock = ms.stock;
    });
    p.stock = p.models.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
    changed.push(p);
  }
  if (changed.length) refreshRows(changed);
}

async function loadPageMedia(rows) {
  // Tự động kiểm tra và đồng bộ chi tiết tồn kho các kho cho các SP trên trang đang xem
  const needStockSync = rows.filter((p) => p.models.some((m) => !m.locationStocks || !m.locationStocks.length || !m.locationStocksSynced));
  if (needStockSync.length > 0) {
    syncStockFromShopee(needStockSync).catch((e) => console.warn("Lỗi đọc tồn kho Shopee:", e));
  }

  const todo = rows.filter((p) => !mediaCache.has(p.itemId) && !mediaErrors.has(p.itemId));
  if (!todo.length) return;
  const token = ++mediaQueueToken;
  const progress = $('#pProgress');
  for (let i = 0; i < todo.length; i++) {
    if (token !== mediaQueueToken) return; // đã chuyển trang / lọc khác
    progress.textContent = `Đang tải ảnh/video ${i + 1}/${todo.length}...`;
    try {
      await getMedia(todo[i].itemId);
    } catch (e) {
      mediaErrors.set(todo[i].itemId, e.message);
    }
    if ((i + 1) % 5 === 0 || i === todo.length - 1) refreshRows(todo.slice(Math.max(0, i - 4), i + 1));
    await sleep(250);
  }
  if (token === mediaQueueToken) {
    progress.textContent = '';
    persistMedia();
  }
}

// Vẽ lại riêng các dòng của những sản phẩm vừa có ảnh/video.
function refreshRows(list) {
  const tbody = $('#pTable tbody');
  for (const p of list) {
    const old = [...tbody.querySelectorAll(`tr[data-id="${p.itemId}"]`)];
    if (!old.length) continue;
    const tmp = document.createElement('tbody');
    tmp.innerHTML = productRows(p);
    old[0].before(...tmp.children);
    old.forEach((tr) => tr.remove());
  }
}

// Lưu cache sản phẩm vào chrome.storage.local
function persistProductsCache() {
  if (!state.all || !state.all.length) return;
  chrome.storage.local.set({
    [CACHE_KEY]: {
      products: state.all,
      loadedAt: state.loadedAt || Date.now(),
      shopId: state.shopId,
      warehouses: state.warehouses
    }
  }).catch((e) => console.warn('Lỗi lưu cache sản phẩm:', e));
}

// ---------- Tải dữ liệu ----------
async function loadCache() {
  try {
    const { [CACHE_KEY]: cache } = await chrome.storage.local.get(CACHE_KEY);
    if (cache && Array.isArray(cache.products)) {
      state.all = cache.products;
      state.loadedAt = cache.loadedAt;
      state.shopId = cache.shopId;
      if (Array.isArray(cache.warehouses)) state.warehouses = cache.warehouses;
    }
  } catch (e) { /* bỏ qua */ }
}

async function loadAll() {
  if (state.loading) return;
  state.loading = true;
  state.stop = false;
  const btn = $('#btnPLoad');
  btn.disabled = true;
  $('#btnPStop').classList.remove('hidden');
  const progress = $('#pProgress');
  const result = [];
  try {
    const [shop, whs] = await Promise.all([
      getShopInfo().catch(() => ({})),
      getShopWarehouses(true).catch(() => [])
    ]);
    state.shopId = shop.shopId || state.shopId;
    state.warehouses = whs || [];
    let cursor = '';
    const seen = new Set();
    for (let i = 0; i < 200 && !state.stop; i++) {
      const res = await products.search({ cursor, pageSize: 48, pageNumber: i + 1 });
      // Bỏ trùng; nếu một trang không có sản phẩm mới thì coi như đã hết
      const fresh = res.products.filter((p) => !seen.has(p.itemId));
      fresh.forEach((p) => seen.add(p.itemId));
      result.push(...fresh);
      progress.textContent = `Đang tải... ${result.length}${res.total ? '/' + res.total : ''} sản phẩm`;
      if (!fresh.length) break;
      if (res.total && result.length >= res.total) break;
      cursor = res.cursor || '';
      await sleep(400);
    }
    state.all = result;
    mediaCache.clear();
    mediaErrors.clear();
    chrome.storage.local.remove(MEDIA_KEY).catch(() => {});
    state.loadedAt = Date.now();
    state.selected.clear();
    await chrome.storage.local.set({
      [CACHE_KEY]: { products: state.all, loadedAt: state.loadedAt, shopId: state.shopId, warehouses: state.warehouses }
    });
    progress.textContent = state.stop ? `Đã dừng – tải được ${state.all.length} sản phẩm` : '';
    hooks.toast(`Đã tải ${state.all.length} sản phẩm`, 'success');
  } catch (e) {
    progress.textContent = '';
    hooks.toast('Lỗi tải sản phẩm: ' + e.message, 'error');
  } finally {
    state.loading = false;
    btn.disabled = false;
    $('#btnPStop').classList.add('hidden');
    render();
  }
}

// Tải sản phẩm mới nhất: đọc các trang đầu, gộp vào danh sách đang có (SP mới thêm lên đầu, SP đã có cập nhật lại).
// Dừng khi một trang toàn sản phẩm đã có, tối đa 5 trang. silent: chạy tự động, không báo khi không có gì mới.
async function loadNewest(silent = false) {
  if (state.loading) return;
  if (!state.all.length) return silent ? undefined : loadAll(); // chưa có danh sách: tải toàn bộ
  state.loading = true;
  const btn = $('#btnPLoadNew'), progress = $('#pProgress');
  btn.disabled = true;
  try {
    const known = new Map(state.all.map((p, i) => [p.itemId, i]));
    const added = [];
    let updated = 0, cursor = '';
    for (let i = 0; i < 5; i++) {
      const res = await products.search({ cursor, pageSize: 48, pageNumber: i + 1 });
      if (!res.products.length) break;
      let allKnown = true;
      for (const p of res.products) {
        if (known.has(p.itemId)) { state.all[known.get(p.itemId)] = p; updated++; }
        else if (!added.some((x) => x.itemId === p.itemId)) { added.push(p); allKnown = false; }
      }
      progress.textContent = `Đang tải SP mới... trang ${i + 1}: ${added.length} mới`;
      if (allKnown) break;
      cursor = res.cursor || '';
      await sleep(400);
    }
    state.all = [...added, ...state.all];
    state.loadedAt = Date.now();
    await chrome.storage.local.set({
      [CACHE_KEY]: { products: state.all, loadedAt: state.loadedAt, shopId: state.shopId, warehouses: state.warehouses }
    });
    if (added.length || !silent) hooks.toast(added.length ? `Có ${added.length} sản phẩm mới, cập nhật ${updated} sản phẩm` : `Không có sản phẩm mới (cập nhật ${updated} sản phẩm)`, 'success');
  } catch (e) {
    if (!silent) hooks.toast('Lỗi tải sản phẩm mới: ' + e.message, 'error');
    else console.warn('Tự tải SP mới lỗi:', e);
  } finally {
    progress.textContent = '';
    state.loading = false;
    btn.disabled = false;
    render();
  }
}

// Tự tải SP mới nhất theo chu kỳ (lưu cài đặt trên máy)
let autoLoadTimer = null;
function setupAutoLoad() {
  clearInterval(autoLoadTimer);
  autoLoadTimer = $('#pAutoOn').checked ? setInterval(() => loadNewest(true), Math.max(1, Number($('#pAutoMin').value) || 30) * 60000) : null;
}
function initAutoLoad() {
  const save = () => { chrome.storage.local.set({ fs_products_auto: { on: $('#pAutoOn').checked, min: $('#pAutoMin').value } }); setupAutoLoad(); };
  chrome.storage.local.get('fs_products_auto').then(({ fs_products_auto: c }) => {
    if (c) { $('#pAutoOn').checked = !!c.on; $('#pAutoMin').value = c.min || 30; }
    setupAutoLoad();
  });
  $('#pAutoOn').onchange = $('#pAutoMin').onchange = save;
  $('#btnPLoadNew').onclick = () => loadNewest(false);
}

// Tự đồng bộ 3 sheet (SP_SHOPEE, WEB_SP, SP Shopee đầy đủ) theo chu kỳ khi trang đang mở:
// tải SP mới nhất trước, rồi ghi toàn bộ sản phẩm theo khóa (mới thì thêm, khác thì cập nhật).
let sheetSyncTimer = null, sheetSyncing = false;
async function runAutoSheetSync() {
  if (sheetSyncing || state.loading || !state.all.length) return;
  sheetSyncing = true;
  try {
    await loadNewest(true);
    await fillAllToSpShopee(true);
    await fillAllToWebSp(true);
    await fillAllToSpShopeeFull(true);
  } finally { sheetSyncing = false; }
}
function initAutoSheetSync() {
  const setup = () => {
    clearInterval(sheetSyncTimer);
    sheetSyncTimer = $('#pSheetAutoOn').checked ? setInterval(runAutoSheetSync, Math.max(5, Number($('#pSheetAutoMin').value) || 60) * 60000) : null;
  };
  const save = () => { chrome.storage.local.set({ fs_sheet_auto: { on: $('#pSheetAutoOn').checked, min: $('#pSheetAutoMin').value } }); setup(); };
  chrome.storage.local.get('fs_sheet_auto').then(({ fs_sheet_auto: c }) => {
    if (c) { $('#pSheetAutoOn').checked = !!c.on; $('#pSheetAutoMin').value = c.min || 60; }
    setup();
  });
  $('#pSheetAutoOn').onchange = $('#pSheetAutoMin').onchange = save;
}

// ---------- Xuất Excel (CSV) ----------
// Cùng cột với bảng; mỗi phân loại một dòng. Tự lấy ảnh/video còn thiếu.
async function exportCsv() {
  const list = state.selected.size ? state.all.filter((p) => state.selected.has(p.itemId)) : filtered();
  if (!list.length) return hooks.toast('Không có sản phẩm để xuất', 'error');
  const missing = list.filter((p) => !mediaCache.has(p.itemId));
  if (missing.length > 100 && !confirm(`Cần tải ảnh/video cho ${missing.length} sản phẩm (khoảng ${Math.ceil(missing.length * 0.6 / 60)} phút). Tiếp tục?`)) return;

  const progress = $('#pProgress');
  for (let i = 0; i < missing.length; i++) {
    progress.textContent = `Đang lấy ảnh/video ${i + 1}/${missing.length}...`;
    try { await getMedia(missing[i].itemId); } catch (e) { mediaErrors.set(missing[i].itemId, e.message); }
    await sleep(300);
  }
  progress.textContent = '';
  if (missing.length) persistMedia();

  const head = ['ID chính', 'Tên sản phẩm', 'Link sản phẩm', 'Mô tả sản phẩm', 'SKU', 'ID phân loại', 'Tên phân loại', 'SKU phân loại', 'Ảnh phân loại',
    'Ảnh chính', 'Ảnh mô tả', 'Video', 'Giá', 'Giá KM', 'Tồn kho', 'Ngày tạo', 'Trạng thái'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.map(cell).join(',')];
  for (const p of list) {
    const m0 = mediaCache.get(p.itemId);
    const sLink = state.shopId ? `https://shopee.vn/product/${state.shopId}/${p.itemId}` : `https://shopee.vn/product/0/${p.itemId}`;
    const descText = p.description || (m0 ? m0.description : '') || '';
    for (const m of p.models) {
      const mImg = m0 && (m0.modelImages || {})[m.modelId];
      lines.push([
        p.itemId, p.name, sLink, descText, p.parentSku, m.modelId || '', m.name, m.sku, mImg ? mImg.url : '',
        m0 ? m0.images.map((x) => x.url).join('\n') : '',
        m0 ? m0.descImages.map((x) => x.url).join('\n') : '',
        m0 ? m0.videos.map((v) => v.url || (v.id ? 'video_id ' + v.id : '')).join('\n') : '',
        m.price, m.promoPrice && m.promoPrice < m.price ? m.promoPrice : '', m.stock, dateText(p), statusOf(p).label
      ].map(cell).join(','));
    }
  }
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `san-pham-shopee-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  hooks.toast(`Đã xuất ${list.length} sản phẩm`, 'success');
  render();
}

// ---------- Thêm vào Sheet SP_SHOPEE ----------
function productToSpShopeeRows(p, maGian) {
  const hasMultipleModels = Array.isArray(p.models) && p.models.length > 1;

  return p.models.map((m) => {
    // sku: Cột "SKU" trên bảng Shopee Seller Tool -> Điền vào cột "SKU Sản phẩm" (Cột E trên Sheet)
    let parentSkuVal = String(p.parentSku ?? '').trim();

    // sku phân loại: Cột "SKU phân loại" trên bảng Shopee Seller Tool -> Điền vào cột "SKU" (Cột F trên Sheet)
    let modelSkuVal = String(m.sku ?? '').trim();

    // Đối với sản phẩm không có phân loại (hoặc 1 model mặc định duy nhất):
    // Cả 2 ô "SKU Sản phẩm" (Cột E) và "SKU" (Cột F) đều điền mã SKU của sản phẩm
    const isSingleDefaultModel = !hasMultipleModels && (!m.modelId || m.modelId === 0 || !m.name || m.name === 'Mặc định');
    if (isSingleDefaultModel) {
      const singleSku = parentSkuVal || modelSkuVal;
      parentSkuVal = singleSku;
      modelSkuVal = singleSku;
    }

    return [
      p.itemId,                                                // A: ID chính / Mã Sản phẩm
      p.name || '',                                            // B: Tên sản phẩm
      (isSingleDefaultModel && !m.modelId) ? '' : (m.modelId || ''), // C: Mã phân loại
      (isSingleDefaultModel && !m.name) ? '' : (m.name || ''),       // D: Tên phân loại
      parentSkuVal,                                            // E: SKU Sản phẩm (từ cột SKU trên bảng)
      modelSkuVal,                                             // F: SKU (từ cột SKU phân loại trên bảng)
      m.price || '',                                           // G: Giá
      m.stock ?? '',                                           // H: Kho hàng / Số lượng tồn kho
      m.stock ?? '',                                           // I: Tồn kho thực tế
      '',                                                      // J: (để trống)
      '',                                                      // K: (để trống)
      maGian || '',                                            // L: MÃ GIAN
      (m.promoPrice && m.promoPrice < m.price) ? m.promoPrice : '', // M: Giá KM
      m.stock ?? '',                                           // N: Tồn kho
      p.createTime ? new Date(p.createTime * 1000).toLocaleDateString('vi-VN') : '' // O: Ngày tạo
    ];
  });
}

// Tự động đồng bộ sản phẩm vào sheet SP_SHOPEE khi sửa tồn kho (nếu đã cài mã gian)
async function autoSyncProductToSpShopee(p) {
  try {
    const { maGian, dhHoanTextValue } = await chrome.storage.local.get(['maGian', 'dhHoanTextValue']);
    const currentMaGian = (maGian || dhHoanTextValue || '').trim();
    if (!currentMaGian) return;
    const rows = productToSpShopeeRows(p, currentMaGian);
    chrome.runtime.sendMessage({ type: 'UPSERT_SP_SHOPEE', values: rows }, (res) => {
      if (res && res.ok) {
        console.log(`[SP_SHOPEE] Đã tự động đồng bộ tồn kho SP #${p.itemId} vào Sheet.`);
      }
    });
  } catch (e) {
    console.warn('Lỗi tự động đồng bộ SP_SHOPEE:', e);
  }
}

// Cập nhật lại toàn diện sản phẩm sau khi sửa tồn kho
function onProductStockUpdated(itemId) {
  persistProductsCache();

  const p = state.all.find((x) => Number(x.itemId) === Number(itemId));
  if (p) {
    refreshRows([p]);
    renderSummary();

    const sheetP = sheetState.products.find((x) => Number(x.itemId) === Number(itemId));
    if (sheetP) {
      sheetP.stock = p.stock;
      p.models.forEach((m) => {
        const sm = sheetP.models.find((x) => Number(x.modelId) === Number(m.modelId));
        if (sm) {
          sm.stock = m.stock;
          sm.locationStocks = m.locationStocks;
        }
      });
      renderSheetProductsTable();
    }

    autoSyncProductToSpShopee(p);
  } else {
    render();
  }
}

// Đồng bộ 1 sản phẩm từ Shopee (lấy thông tin chi tiết và tồn kho đa kho mới nhất)
async function syncSingleProduct(itemId, btn) {
  const numId = Number(itemId);
  if (!numId) return;

  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Đang đồng bộ...';
  }

  try {
    if (!state.warehouses || !state.warehouses.length) {
      state.warehouses = await getShopWarehouses().catch(() => []);
    }

    const [raw, stockMap] = await Promise.all([
      products.getRaw(numId).catch(() => null),
      products.getStock([numId]).catch(() => new Map())
    ]);

    let p = state.all.find((x) => Number(x.itemId) === numId);

    if (raw) {
      const normalized = normalizeProduct(raw, state.warehouses);
      if (p) {
        normalized.sold = normalized.sold || p.sold || 0;
        normalized.views = normalized.views || p.views || 0;
        normalized.likes = normalized.likes || p.likes || 0;
        normalized.createTime = normalized.createTime || p.createTime || 0;
        const idx = state.all.findIndex((x) => Number(x.itemId) === numId);
        if (idx !== -1) state.all[idx] = normalized;
        p = normalized;
      } else {
        state.all.push(normalized);
        p = normalized;
      }
      try {
        const media = extractMedia(raw);
        mediaCache.set(numId, media);
        mediaErrors.delete(numId);
      } catch (_) {}
    }

    if (p) {
      const sList = stockMap.get(numId);
      if (sList && sList.length) {
        const whName = (id) => ((state.warehouses || []).find((w) => String(w.location_id) === String(id)) || {}).warehouse_name || id;
        sList.forEach((ms, idx) => {
          let m = p.models.find((x) => Number(x.modelId) === ms.modelId);
          if (!m && p.models.length === 1 && sList.length === 1) m = p.models[0];
          if (!m && p.models[idx] && !Number(p.models[idx].modelId)) m = p.models[idx];
          if (!m) return;
          if (!Number(m.modelId) && ms.modelId) m.modelId = ms.modelId;
          m.locationStocks = ms.locations.map((l) => ({ locationId: l.locationId, warehouseName: whName(l.locationId), stock: l.stock }));
          m.locationStocksSynced = true;
          m.stock = ms.stock;
        });
        p.stock = p.models.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
      } else if (raw) {
        syncProductWarehouseStock(p, raw);
      }

      onProductStockUpdated(numId);
      hooks.toast(`Đã đồng bộ sản phẩm #${numId} thành công!`, 'success');
    } else {
      const sheetP = sheetState.products.find((x) => Number(x.itemId) === numId);
      if (sheetP) {
        const sList = stockMap.get(numId);
        if (sList && sList.length) {
          const whName = (id) => ((state.warehouses || []).find((w) => String(w.location_id) === String(id)) || {}).warehouse_name || id;
          sList.forEach((ms, idx) => {
            let m = sheetP.models.find((x) => Number(x.modelId) === ms.modelId);
            if (!m && sheetP.models.length === 1 && sList.length === 1) m = sheetP.models[0];
            if (!m && sheetP.models[idx] && !Number(sheetP.models[idx].modelId)) m = sheetP.models[idx];
            if (!m) return;
            if (!Number(m.modelId) && ms.modelId) m.modelId = ms.modelId;
            m.locationStocks = ms.locations.map((l) => ({ locationId: l.locationId, warehouseName: whName(l.locationId), stock: l.stock }));
            m.locationStocksSynced = true;
            m.stock = ms.stock;
          });
          sheetP.stock = sheetP.models.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
        }
        renderSheetProductsTable();
        hooks.toast(`Đã đồng bộ tồn kho sản phẩm #${numId} từ Shopee!`, 'success');
      } else {
        hooks.toast(`Không tìm thấy sản phẩm #${numId}`, 'error');
      }
    }

    if (btn) {
      btn.innerHTML = '✓ Đã đồng bộ';
      btn.style.background = '#10b981';
      btn.style.borderColor = '#059669';
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        btn.style.background = '#6366f1';
        btn.style.borderColor = '#4f46e5';
      }, 2000);
    }
  } catch (err) {
    console.error('Lỗi khi đồng bộ sản phẩm:', err);
    hooks.toast('Lỗi khi đồng bộ SP: ' + (err.message || err), 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// Đồng bộ hàng loạt các sản phẩm đã chọn từ Shopee
async function syncBatchProducts(fromSheet = false) {
  const list = fromSheet ? selectedSheetProducts() : selectedProducts();
  if (!list.length) {
    return hooks.toast('Vui lòng tích chọn ít nhất 1 sản phẩm để đồng bộ!', 'error');
  }

  const btn = fromSheet ? $('#btnSheetSyncBatch') : $('#btnPSyncBatch');
  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = `⏳ Đang đồng bộ (0/${list.length})...`;
  }

  let successCount = 0;
  let failCount = 0;

  try {
    if (!state.warehouses || !state.warehouses.length) {
      state.warehouses = await getShopWarehouses().catch(() => []);
    }

    const itemIds = list.map((p) => Number(p.itemId)).filter(Boolean);
    const stockMap = await products.getStock(itemIds).catch(() => new Map());

    for (let i = 0; i < list.length; i++) {
      const targetP = list[i];
      const numId = Number(targetP.itemId);
      if (btn) btn.textContent = `⏳ Đang đồng bộ (${i + 1}/${list.length})...`;

      try {
        const raw = await products.getRaw(numId).catch(() => null);
        let mainP = state.all.find((x) => Number(x.itemId) === numId);

        if (raw) {
          const normalized = normalizeProduct(raw, state.warehouses);
          if (mainP) {
            normalized.sold = normalized.sold || mainP.sold || 0;
            normalized.views = normalized.views || mainP.views || 0;
            normalized.likes = normalized.likes || mainP.likes || 0;
            normalized.createTime = normalized.createTime || mainP.createTime || 0;
            const idx = state.all.findIndex((x) => Number(x.itemId) === numId);
            if (idx !== -1) state.all[idx] = normalized;
            mainP = normalized;
          } else {
            state.all.push(normalized);
            mainP = normalized;
          }
          try {
            const media = extractMedia(raw);
            mediaCache.set(numId, media);
            mediaErrors.delete(numId);
          } catch (_) {}
        }

        const currentP = mainP || targetP;
        if (currentP) {
          const sList = stockMap.get(numId);
          if (sList && sList.length) {
            const whName = (id) => ((state.warehouses || []).find((w) => String(w.location_id) === String(id)) || {}).warehouse_name || id;
            sList.forEach((ms, idx) => {
              let m = currentP.models.find((x) => Number(x.modelId) === ms.modelId);
              if (!m && currentP.models.length === 1 && sList.length === 1) m = currentP.models[0];
              if (!m && currentP.models[idx] && !Number(currentP.models[idx].modelId)) m = currentP.models[idx];
              if (!m) return;
              if (!Number(m.modelId) && ms.modelId) m.modelId = ms.modelId;
              m.locationStocks = ms.locations.map((l) => ({ locationId: l.locationId, warehouseName: whName(l.locationId), stock: l.stock }));
              m.locationStocksSynced = true;
              m.stock = ms.stock;
            });
            currentP.stock = currentP.models.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
          } else if (raw) {
            syncProductWarehouseStock(currentP, raw);
          }

          const sheetP = sheetState.products.find((x) => Number(x.itemId) === numId);
          if (sheetP && mainP) {
            sheetP.stock = mainP.stock;
            mainP.models.forEach((m) => {
              const sm = sheetP.models.find((x) => Number(x.modelId) === Number(m.modelId));
              if (sm) {
                sm.stock = m.stock;
                sm.locationStocks = m.locationStocks;
              }
            });
          }

          autoSyncProductToSpShopee(currentP);
          successCount++;
        }
      } catch (err) {
        console.warn(`Lỗi khi đồng bộ SP #${numId}:`, err);
        failCount++;
      }
      await sleep(150);
    }

    persistProductsCache();
    if (fromSheet) {
      renderSheetProductsTable();
    } else {
      render();
    }
    hooks.toast(`Đã đồng bộ thành công ${successCount}/${list.length} sản phẩm từ Shopee!${failCount ? ` (${failCount} lỗi)` : ''}`, successCount ? 'success' : 'error');
  } catch (err) {
    console.error('Lỗi khi đồng bộ hàng loạt:', err);
    hooks.toast('Lỗi khi đồng bộ hàng loạt: ' + (err.message || err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

async function fillAllToSpShopee(auto = false) {
  const list = (!auto && state.selected.size > 0) ? selectedProducts() : state.all;
  if (!list.length) return hooks.toast('Chưa có sản phẩm nào để thêm vào sheet SP_SHOPEE', 'error');

  const { maGian, dhHoanTextValue } = await chrome.storage.local.get(['maGian', 'dhHoanTextValue']);
  const shop = await getShopInfo().catch(() => ({}));
  let currentMaGian = (maGian || dhHoanTextValue || '').trim();
  if (!currentMaGian) {
    if (auto) return; // tự đồng bộ: chưa có Mã gian thì bỏ qua
    const input = prompt('Vui lòng nhập Mã gian để ghi vào Cột L (ví dụ: GDD):', shop.name || '');
    if (input === null) return;
    currentMaGian = input.trim();
    if (currentMaGian) {
      chrome.storage.local.set({ maGian: currentMaGian, dhHoanTextValue: currentMaGian });
    }
  }

  const isSel = (!auto && state.selected.size > 0);
  const msg = isSel
    ? `Cập nhật ${list.length} sản phẩm đã chọn vào sheet SP_SHOPEE?\n(Mã gian: "${currentMaGian || 'Chưa đặt'}")`
    : `Cập nhật toàn bộ ${list.length} sản phẩm vào sheet SP_SHOPEE?\n(Mã gian: "${currentMaGian || 'Chưa đặt'}")\nDữ liệu cũ của gian này trên Sheet sẽ được ghi đè/làm mới.`;

  if (!auto && !confirm(msg)) return;

  const allRows = [];
  for (const p of list) {
    allRows.push(...productToSpShopeeRows(p, currentMaGian));
  }

  const btn = $('#btnPToSpShopee');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang đẩy lên SP_SHOPEE...';
  }
  try {
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'UPLOAD_SP_SHOPEE', values: allRows, maGian: currentMaGian }, resolve);
    });
    if (res && res.ok) {
      hooks.toast(`SP_SHOPEE: thêm ${res.added ?? 0} dòng mới, cập nhật ${res.updated ?? 0}, không đổi ${res.same ?? 0}!`, 'success');
      if (sheetProductsRows.length > 0 && $('#sheetSourceSelect')?.value === 'SP_SHOPEE') {
        loadSheetProducts(true);
      }
    } else {
      throw new Error((res && res.error) || 'Lỗi không xác định');
    }
  } catch (err) {
    hooks.toast('Lỗi cập nhật Google Sheet SP_SHOPEE: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

async function fillSingleProductToSheet(itemId, btn) {
  const p = state.all.find((x) => x.itemId === itemId);
  if (!p) return hooks.toast('Không tìm thấy sản phẩm #' + itemId, 'error');

  const { maGian, dhHoanTextValue } = await chrome.storage.local.get(['maGian', 'dhHoanTextValue']);
  const shop = await getShopInfo().catch(() => ({}));
  let currentMaGian = (maGian || dhHoanTextValue || '').trim();
  if (!currentMaGian) {
    const input = prompt('Vui lòng nhập Mã gian để ghi vào Cột L (ví dụ: GDD):', shop.name || '');
    if (input === null) return;
    currentMaGian = input.trim();
    if (currentMaGian) {
      chrome.storage.local.set({ maGian: currentMaGian, dhHoanTextValue: currentMaGian });
    }
  }

  const rows = productToSpShopeeRows(p, currentMaGian);

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'APPEND_SP_SHOPEE', values: rows }, resolve);
    });
    if (res && res.ok) {
      hooks.toast(`Đã thêm ${rows.length} phân loại của SP #${p.itemId} vào sheet SP_SHOPEE!`, 'success');
      btn.textContent = '✔';
      btn.style.background = '#16a34a';
      btn.style.borderColor = '#16a34a';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = oldText;
        btn.style.background = '';
        btn.style.borderColor = '';
      }, 3000);
    } else {
      throw new Error((res && res.error) || 'Lỗi không xác định');
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = oldText;
    hooks.toast('Lỗi thêm vào sheet: ' + err.message, 'error');
  }
}

// ---------- Thêm vào Sheet SP Shopee Đầy Đủ ----------
function productToSpShopeeFullRows(p, maGian) {
  const hasMultipleModels = Array.isArray(p.models) && p.models.length > 1;
  const m0 = mediaCache.get(p.itemId);
  const sLink = state.shopId ? `https://shopee.vn/product/${state.shopId}/${p.itemId}` : `https://shopee.vn/product/0/${p.itemId}`;
  const desc = p.description || (m0 && m0.description) || '';
  const allImgs = (m0 && m0.images && m0.images.length)
    ? m0.images.map((x) => x.url).filter(Boolean).join('\n')
    : (p.image || '');
  const descImgs = (m0 && m0.descImages) ? m0.descImages.map((x) => x.url).join('\n') : '';
  const videos = (m0 && m0.videos) ? m0.videos.map((v) => v.url || (v.id ? 'video_id ' + v.id : '')).filter(Boolean).join('\n') : '';

  return p.models.map((m) => {
    let parentSkuVal = String(p.parentSku ?? '').trim();
    let modelSkuVal = String(m.sku ?? '').trim();
    const isSingleDefaultModel = !hasMultipleModels && (!m.modelId || m.modelId === 0 || !m.name || m.name === 'Mặc định');
    if (isSingleDefaultModel) {
      const singleSku = parentSkuVal || modelSkuVal;
      parentSkuVal = singleSku;
      modelSkuVal = singleSku;
    }
    const mImg = (m0 && m0.modelImages && m0.modelImages[m.modelId]) ? m0.modelImages[m.modelId].url : (m.image || '');

    return [
      p.itemId,                                                // A: ID chính / Mã Sản phẩm
      p.name || '',                                            // B: Tên sản phẩm
      (isSingleDefaultModel && !m.modelId) ? '' : (m.modelId || ''), // C: Mã phân loại
      (isSingleDefaultModel && !m.name) ? '' : (m.name || ''),       // D: Tên phân loại
      parentSkuVal,                                            // E: SKU Sản phẩm
      modelSkuVal,                                             // F: SKU (SKU phân loại)
      m.price || '',                                           // G: Giá
      m.stock ?? '',                                           // H: Kho hàng
      m.stock ?? '',                                           // I: Tồn kho thực tế
      '',                                                      // J: (trống)
      '',                                                      // K: (trống)
      maGian || '',                                            // L: Mã gian
      (m.promoPrice && m.promoPrice < m.price) ? m.promoPrice : '', // M: Giá KM
      m.stock ?? '',                                           // N: Tồn kho
      p.createTime ? new Date(p.createTime * 1000).toLocaleDateString('vi-VN') : '', // O: Ngày tạo
      sLink,                                                   // P: Link SP
      desc,                                                    // Q: Mô tả SP
      allImgs,                                                 // R: Ảnh chính
      descImgs,                                                // S: Ảnh mô tả
      mImg,                                                    // T: Ảnh phân loại
      videos,                                                  // U: Video
      statusOf(p).label                                        // V: Trạng thái (Đang bán / Đã ẩn / Hết hàng…)
    ];
  });
}

// Tải mô tả/ảnh/video của cả lô (5 SP cùng lúc, lỗi thì thử lại 1 lần). Trả về các SP không tải được.
async function ensureMediaForList(list, btn) {
  const queue = list.filter((p) => !mediaCache.has(p.itemId));
  const failed = [];
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        await getMedia(item.itemId);
      } catch {
        await sleep(1000);
        await getMedia(item.itemId).catch((e) => {
          console.warn(`Lỗi media SP ${item.itemId}:`, e);
          failed.push(item);
        });
      }
      done++;
      if (btn) btn.textContent = `Tải mô tả, ảnh, video (${done}/${total})...`;
    }
  };
  const total = queue.length;
  await Promise.all(Array.from({ length: 5 }, worker));
  return failed;
}

const mediaFailNote = (failed) => failed.length
  ? ` ${failed.length} SP thiếu mô tả/ảnh/video vì tải lỗi: ${failed.slice(0, 5).map((p) => p.itemId).join(', ')}${failed.length > 5 ? '...' : ''}. Bấm lại để thử tiếp.`
  : '';

async function fillAllToSpShopeeFull(auto = false) {
  const list = state.all;
  if (!list.length) return hooks.toast('Chưa có dữ liệu sản phẩm. Vui lòng bấm "Tải toàn bộ sản phẩm" trước!', 'error');

  const { maGian, dhHoanTextValue } = await chrome.storage.local.get(['maGian', 'dhHoanTextValue']);
  const shop = await getShopInfo().catch(() => ({}));
  let currentMaGian = (maGian || dhHoanTextValue || '').trim();
  if (!currentMaGian) {
    if (auto) return; // tự đồng bộ: chưa có Mã gian thì bỏ qua
    const input = prompt('Vui lòng nhập Mã gian để ghi vào Cột L (ví dụ: GDD):', shop.name || '');
    if (input === null) return;
    currentMaGian = input.trim();
    if (currentMaGian) {
      chrome.storage.local.set({ maGian: currentMaGian, dhHoanTextValue: currentMaGian });
    }
  }

  const msg = `Thêm toàn bộ ${list.length} sản phẩm của shop vào sheet SP Shopee đầy đủ?\n(Mã gian: "${currentMaGian || 'Chưa đặt'}")\nDữ liệu cũ của gian này trên Sheet sẽ được ghi đè/làm mới toàn bộ.`;
  if (!auto && !confirm(msg)) return;

  const btn = $('#btnPToSpShopeeFull');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang chuẩn bị...';
  }

  try {
    const failed = await ensureMediaForList(list, btn);
    const allRows = [];
    for (const p of list) {
      allRows.push(...productToSpShopeeFullRows(p, currentMaGian));
    }

    if (btn) btn.textContent = 'Đang đẩy lên Sheet đầy đủ...';
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'UPLOAD_SP_SHOPEE_DAY_DU', values: allRows, maGian: currentMaGian }, resolve);
    });
    if (res && res.ok) {
      hooks.toast(`${res.sheetTitle || 'SP Shopee đầy đủ'}: thêm ${res.added ?? 0} dòng mới, cập nhật ${res.updated ?? 0}, không đổi ${res.same ?? 0}!${mediaFailNote(failed)}`, failed.length ? 'error' : 'success');
      const sel = $('#sheetSourceSelect');
      if (sel) sel.value = 'SP_SHOPEE_DAY_DU';
      if (sheetProductsRows.length > 0) {
        loadSheetProducts(true);
      }
    } else {
      throw new Error((res && res.error) || 'Lỗi không xác định');
    }
  } catch (err) {
    hooks.toast('Lỗi cập nhật Google Sheet SP Shopee đầy đủ: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

// ---------- Thêm vào Sheet WEB_SP ----------
function productToWebSpRows(p, maGian) {
  const m0 = mediaCache.get(p.itemId);
  const sLink = state.shopId ? `https://shopee.vn/product/${state.shopId}/${p.itemId}` : `https://shopee.vn/product/0/${p.itemId}`;
  const desc = p.description || (m0 && m0.description) || '';
  const descImgs = (m0 && m0.descImages) ? m0.descImages.map((x) => x.url).join('\n') : '';
  const videos = (m0 && m0.videos) ? m0.videos.map((v) => v.url || (v.id ? 'video_id ' + v.id : '')).filter(Boolean).join('\n') : '';

  // Thu thập tất cả các ảnh sản phẩm
  const baseImgs = [];
  if (m0 && Array.isArray(m0.images) && m0.images.length) {
    m0.images.forEach((x) => {
      const u = typeof x === 'string' ? x : (x && x.url ? x.url : '');
      if (u && !baseImgs.includes(u)) baseImgs.push(u);
    });
  } else if (p.image && !baseImgs.includes(p.image)) {
    baseImgs.push(p.image);
  }

  return p.models.map((m, idx) => {
    const mImg = (m0 && m0.modelImages && m0.modelImages[m.modelId]) ? m0.modelImages[m.modelId].url : (m.image || '');
    const autoId = 'WEB_' + p.itemId + (m.modelId ? '_' + m.modelId : (p.models.length > 1 ? '_' + idx : ''));

    // Cột H: Điền tất cả các ảnh vào và ảnh cách nhau | (kèm ảnh phân loại nếu có)
    const rowImgs = [...baseImgs];
    if (mImg && !rowImgs.includes(mImg)) {
      rowImgs.push(mImg);
    }
    const allImgsStr = rowImgs.join('|');

    return [
      autoId,                                                    // A: ID TỰ SINH
      maGian || '',                                              // B: MÃ GIAN
      m.sku || '',                                               // C: SKU phân loại
      m.name || '',                                              // D: Tên phân loại
      p.name || '',                                              // E: Tên sản phẩm
      '',                                                        // F: (để trống)
      desc,                                                      // G: MÔ TẢ SẢN PHÂM
      allImgsStr,                                                // H: Ảnh (tất cả các ảnh cách nhau |)
      descImgs,                                                  // I: Ảnh mô tả
      mImg,                                                      // J: Ảnh phân loại
      videos,                                                    // K: Video
      m.price || '',                                             // L: Giá
      (m.promoPrice && m.promoPrice < m.price) ? m.promoPrice : '', // M: Giá KM
      p.itemId,                                                  // N: id
      sLink                                                      // O: link sản phâm
    ];
  });
}

async function fillAllToWebSp(auto = false) {
  const list = (!auto && state.selected.size > 0) ? selectedProducts() : state.all;
  if (!list.length) return hooks.toast('Chưa có sản phẩm nào để thêm vào sheet WEB_SP', 'error');

  const { maGian, dhHoanTextValue } = await chrome.storage.local.get(['maGian', 'dhHoanTextValue']);
  const shop = await getShopInfo().catch(() => ({}));
  let currentMaGian = (maGian || dhHoanTextValue || '').trim();
  if (!currentMaGian) {
    if (auto) return; // tự đồng bộ: chưa có Mã gian thì bỏ qua
    const input = prompt('Vui lòng nhập Mã gian để ghi vào Cột B (ví dụ: GDD):', shop.name || '');
    if (input === null) return;
    currentMaGian = input.trim();
    if (currentMaGian) {
      chrome.storage.local.set({ maGian: currentMaGian, dhHoanTextValue: currentMaGian });
    }
  }

  const isSel = (!auto && state.selected.size > 0);
  const msg = isSel
    ? `Cập nhật ${list.length} sản phẩm đã chọn vào sheet WEB_SP?\n(Mã gian: "${currentMaGian || 'Chưa đặt'}")`
    : `Cập nhật toàn bộ ${list.length} sản phẩm vào sheet WEB_SP?\n(Mã gian: "${currentMaGian || 'Chưa đặt'}")\nDữ liệu cũ của gian này sẽ được cập nhật lại toàn bộ.`;

  if (!auto && !confirm(msg)) return;

  const btn = $('#btnPToWebSp');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang chuẩn bị...';
  }

  try {
    const failed = await ensureMediaForList(list, btn);

    const allRows = [];
    for (const p of list) {
      allRows.push(...productToWebSpRows(p, currentMaGian));
    }

    if (btn) btn.textContent = 'Đang đẩy lên WEB_SP...';
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'UPLOAD_WEB_SP', values: allRows, maGian: currentMaGian, partial: isSel }, resolve);
    });
    if (res && res.ok) {
      hooks.toast(`WEB_SP: thêm ${res.added ?? 0} dòng mới, cập nhật ${res.updated ?? 0}, không đổi ${res.same ?? 0}!${mediaFailNote(failed)}`, failed.length ? 'error' : 'success');
    } else {
      throw new Error((res && res.error) || 'Lỗi không xác định');
    }
  } catch (err) {
    hooks.toast('Lỗi cập nhật Google Sheet WEB_SP: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

async function fillSingleProductToWebSp(itemId, btn) {
  const p = state.all.find((x) => x.itemId === itemId);
  if (!p) return hooks.toast('Không tìm thấy sản phẩm #' + itemId, 'error');

  const { maGian, dhHoanTextValue } = await chrome.storage.local.get(['maGian', 'dhHoanTextValue']);
  const shop = await getShopInfo().catch(() => ({}));
  let currentMaGian = (maGian || dhHoanTextValue || '').trim();
  if (!currentMaGian) {
    const input = prompt('Vui lòng nhập Mã gian để ghi vào Cột B (ví dụ: GDD):', shop.name || '');
    if (input === null) return;
    currentMaGian = input.trim();
    if (currentMaGian) {
      chrome.storage.local.set({ maGian: currentMaGian, dhHoanTextValue: currentMaGian });
    }
  }

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';

  try {
    if (!mediaCache.has(p.itemId)) {
      try {
        await getMedia(p.itemId);
      } catch (e) {
        console.warn('Không tải được media:', e);
      }
    }

    const rows = productToWebSpRows(p, currentMaGian);

    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'APPEND_WEB_SP', values: rows }, resolve);
    });
    if (res && res.ok) {
      hooks.toast(`Đã thêm ${rows.length} phân loại của SP #${p.itemId} vào sheet WEB_SP!`, 'success');
      btn.textContent = '✔';
      btn.style.background = '#16a34a';
      btn.style.borderColor = '#16a34a';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = oldText;
        btn.style.background = '#10b981';
        btn.style.borderColor = '#10b981';
      }, 3000);
    } else {
      throw new Error((res && res.error) || 'Lỗi không xác định');
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = oldText;
    hooks.toast('Lỗi thêm vào sheet WEB_SP: ' + err.message, 'error');
  }
}

// ---------- Ảnh & Video ----------
const mediaCache = new Map(); // itemId -> media
const MEDIA_KEY = 'fs_mediaCache_v3'; // v3: link video đầy đủ (kể cả khi nằm trong video_id)

async function loadMediaCache() {
  try {
    const { [MEDIA_KEY]: saved } = await chrome.storage.local.get(MEDIA_KEY);
    for (const [id, m] of Object.entries(saved || {})) mediaCache.set(Number(id), m);
  } catch (e) { /* bỏ qua */ }
}

function persistMedia() {
  chrome.storage.local.set({ [MEDIA_KEY]: Object.fromEntries(mediaCache) }).catch(() => {});
}

async function getMedia(itemId) {
  if (mediaCache.has(itemId)) {
    const cached = mediaCache.get(itemId);
    const p = state.all.find((x) => x.itemId === itemId);
    if (p && cached && cached.description && !p.description) {
      p.description = cached.description;
    }
    return cached;
  }
  const raw = await products.getRaw(itemId);
  if (!raw) throw new Error('Không lấy được dữ liệu sản phẩm');
  const media = extractMedia(raw);
  const p = state.all.find((x) => x.itemId === itemId);
  if (p) {
    if (media.description && !p.description) {
      p.description = media.description;
    }
    syncProductWarehouseStock(p, raw);
  }
  mediaCache.set(itemId, media);
  return media;
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    hooks.toast(`Đã copy ${label}`, 'success');
  } catch (e) {
    hooks.toast('Không copy được: ' + e.message, 'error');
  }
}

function mediaTile(img, caption = '') {
  return `<div class="media-tile">
    <a href="${esc(img.url)}" target="_blank" title="Mở ảnh gốc"><img src="${esc(img.thumb)}" loading="lazy"></a>
    ${caption ? `<div class="cap" title="${esc(caption)}">${esc(caption)}</div>` : ''}
    <button class="btn small" data-copy="${esc(img.url)}">Copy link</button>
  </div>`;
}

function mediaSection(title, items, html) {
  const links = items.map((x) => x.url).filter(Boolean).join('\n');
  return `<div class="media-section">
    <div class="card-head"><h4>${title} <span class="muted">(${items.length})</span></h4>
      ${items.length && links ? `<button class="btn small" data-copy-all="${esc(links)}">Copy tất cả link</button>` : ''}</div>
    ${items.length ? `<div class="media-grid">${html}</div>` : '<div class="muted">Không có</div>'}
  </div>`;
}

function renderMedia(p, media) {
  const videoHtml = media.videos.map((v) => `<div class="media-tile video">
      ${v.url
        ? `<video src="${esc(v.url)}" ${v.thumb ? `poster="${esc(v.thumb)}"` : ''} controls preload="none"></video>`
        : (v.thumb ? `<img src="${esc(v.thumb)}">` : '<div class="muted">Không có link phát</div>')}
      <div class="cap">${v.id ? 'ID ' + esc(v.id) : ''}${v.duration ? ` · ${v.duration}s` : ''}</div>
      ${v.url ? `<button class="btn small" data-copy="${esc(v.url)}">Copy link</button>` : ''}
    </div>`).join('');

  $('#pMediaBody').innerHTML = `
    ${mediaSection('Ảnh chính', media.images, media.images.map((img, i) => mediaTile(img, img.note || (i === 0 ? 'Ảnh bìa' : `Ảnh ${i + 1}`))).join(''))}
    ${mediaSection('Ảnh phân loại', media.variations, media.variations.map((v) => mediaTile(v, `${v.group}: ${v.option}`)).join(''))}
    ${mediaSection('Ảnh trong mô tả', media.descImages, media.descImages.map((img) => mediaTile(img)).join(''))}
    ${mediaSection('Video', media.videos, videoHtml)}`;
  $('#pMediaTitle').textContent = p ? p.name : '';
}

async function openMedia(itemId) {
  const p = state.all.find((x) => x.itemId === itemId);
  $('#pMediaTitle').textContent = p ? p.name : `Sản phẩm ${itemId}`;
  $('#pMediaBody').innerHTML = '<div class="muted">Đang tải ảnh & video...</div>';
  $('#pMedia').classList.remove('hidden');
  try {
    renderMedia(p, await getMedia(itemId));
  } catch (e) {
    $('#pMediaBody').innerHTML = `<div style="color:var(--err)">Lỗi: ${esc(e.message)}</div>`;
  }
}

async function exportMediaCsv() {
  const list = selectedProducts();
  if (!list.length) return hooks.toast('Hãy tích chọn sản phẩm cần xuất link ảnh/video', 'error');
  const btn = $('#btnPExportMedia');
  btn.disabled = true;
  const progress = $('#pProgress');
  const head = ['ID sản phẩm', 'Tên sản phẩm'];
  for (let i = 1; i <= 9; i++) head.push(`Ảnh ${i}`);
  head.push('Ảnh phân loại', 'Ảnh mô tả', 'Video');
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.map(cell).join(',')];
  let fail = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      progress.textContent = `Đang lấy ảnh/video ${i + 1}/${list.length}...`;
      try {
        const m = await getMedia(p.itemId);
        const imgs = m.images.map((x) => x.url);
        const row = [p.itemId, p.name];
        for (let k = 0; k < 9; k++) row.push(imgs[k] || '');
        row.push(m.variations.map((v) => `${v.group}: ${v.option} | ${v.url}`).join('\n'));
        row.push(m.descImages.map((x) => x.url).join('\n'));
        row.push(m.videos.map((v) => v.url || (v.id ? 'video_id ' + v.id : '')).join('\n'));
        lines.push(row.map(cell).join(','));
      } catch (e) {
        fail++;
        lines.push([p.itemId, p.name, 'LỖI: ' + e.message].map(cell).join(','));
      }
      await sleep(300);
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `anh-video-san-pham-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    hooks.toast(`Đã xuất link ảnh/video của ${list.length - fail} sản phẩm${fail ? `, ${fail} lỗi` : ''}`, fail ? 'error' : 'success');
  } finally {
    progress.textContent = '';
    btn.disabled = false;
  }
}

function selectedProducts() {
  return state.all.filter((p) => state.selected.has(p.itemId));
}

// ---------- Đọc sản phẩm từ Sheet SP_SHOPEE / SP_SHOPEE_DAY_DU ----------
let sheetProductsRows = [];
let sheetHeaders = [];
let isSheetLoading = false;

const sheetState = {
  rawRows: [],
  products: [],
  loadedAt: null,
  page: 1,
  pageSize: 50,
  selected: new Set(),
  loading: false
};

function getSheetColIdx(keywords, fallback) {
  if (!sheetHeaders.length) return fallback;
  for (const kw of keywords) {
    const idx = sheetHeaders.findIndex((h) => String(h || '').toLowerCase().trim().includes(kw));
    if (idx !== -1) return idx;
  }
  return fallback;
}

const getGianColIdx = () => getSheetColIdx(['mã gian', 'ma gian', 'gian', 'shop'], 11);
const getItemIdColIdx = () => getSheetColIdx(['mã sản phẩm', 'ma san pham', 'item id', 'id chính', 'mã sp', 'id sp'], 0);
const getNameColIdx = () => getSheetColIdx(['tên sản phẩm', 'ten san pham', 'tên sp', 'name'], 1);
const getModelIdColIdx = () => getSheetColIdx(['mã phân loại', 'ma phan loai', 'model id', 'id phân loại'], 2);
const getModelNameColIdx = () => getSheetColIdx(['tên phân loại', 'ten phan loai', 'model name'], 3);
const getParentSkuColIdx = () => getSheetColIdx(['sku sản phẩm', 'sku san pham', 'sku sp'], 4);
function getModelSkuColIdx() {
  const pIdx = getParentSkuColIdx();
  const idx = sheetHeaders.findIndex((h, i) => {
    if (i === pIdx) return false;
    const t = String(h || '').toLowerCase().trim();
    return t === 'sku' || t.includes('sku phân loại') || t.includes('sku model');
  });
  return idx !== -1 ? idx : 5;
}
const getPriceColIdx = () => getSheetColIdx(['giá gốc', 'giá', 'gia', 'price'], 6);
const getStockColIdx = () => getSheetColIdx(['kho hàng', 'kho hang', 'tồn kho', 'ton kho', 'gtin', 'số lượng'], 7);
const getPromoPriceColIdx = () => getSheetColIdx(['giá km', 'gia km', 'promo price'], 12);
const getCreateTimeColIdx = () => getSheetColIdx(['ngày tạo', 'ngay tao', 'create time'], 14);
const getLinkColIdx = () => getSheetColIdx(['link sp', 'link', 'url'], 15);
const getDescColIdx = () => getSheetColIdx(['mô tả sp', 'mo ta sp', 'mô tả', 'description'], 16);
const getImagesColIdx = () => getSheetColIdx(['ảnh chính', 'anh chinh', 'ảnh sp', 'images'], 17);
const getDescImagesColIdx = () => getSheetColIdx(['ảnh mô tả', 'anh mo ta', 'desc images'], 18);
const getModelImgColIdx = () => getSheetColIdx(['ảnh phân loại', 'anh phan loai', 'variation image'], 19);
const getVideosColIdx = () => getSheetColIdx(['video', 'videos'], 20);
const getStatusColIdx = () => getSheetColIdx(['trạng thái', 'trang thai', 'status'], 21);

function parseSheetProducts(rows) {
  const col = {
    itemId: getItemIdColIdx(),
    name: getNameColIdx(),
    modelId: getModelIdColIdx(),
    modelName: getModelNameColIdx(),
    parentSku: getParentSkuColIdx(),
    modelSku: getModelSkuColIdx(),
    price: getPriceColIdx(),
    stock: getStockColIdx(),
    gian: getGianColIdx(),
    promoPrice: getPromoPriceColIdx(),
    createTime: getCreateTimeColIdx(),
    link: getLinkColIdx(),
    desc: getDescColIdx(),
    images: getImagesColIdx(),
    descImages: getDescImagesColIdx(),
    modelImg: getModelImgColIdx(),
    videos: getVideosColIdx(),
    status: getStatusColIdx()
  };

  const parseImgList = (str) => {
    if (!str) return [];
    return String(str)
      .split(/[\r\n|]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('http'))
      .map((u) => ({ url: u, thumb: u }));
  };

  const parseVideoList = (str) => {
    if (!str) return [];
    return String(str)
      .split(/[\r\n|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        if (s.startsWith('http')) return { url: s, thumb: '' };
        if (s.startsWith('video_id ')) return { id: s.replace('video_id ', ''), url: '' };
        return { id: s, url: '' };
      });
  };

  const map = new Map();

  for (const r of rows) {
    const rawId = String(r[col.itemId] ?? '').trim();
    if (!rawId) continue;
    const itemId = Number(rawId) || rawId;
    const gian = String(r[col.gian] ?? '').trim();
    const key = (gian ? gian + '::' : '') + itemId;

    const name = String(r[col.name] ?? '').trim();
    const parentSku = String(r[col.parentSku] ?? '').trim();
    const link = String(r[col.link] ?? '').trim();
    const desc = String(r[col.desc] ?? '').trim();
    const createTimeStr = String(r[col.createTime] ?? '').trim();

    const rawModelId = String(r[col.modelId] ?? '').trim();
    const modelId = Number(rawModelId) || rawModelId || 0;
    const modelName = String(r[col.modelName] ?? '').trim();
    const modelSku = String(r[col.modelSku] ?? '').trim();
    const rawPrice = r[col.price];
    const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice ?? '').replace(/[^0-9.]/g, '')) || 0;
    const rawPromo = r[col.promoPrice];
    const promoPrice = typeof rawPromo === 'number' ? rawPromo : parseFloat(String(rawPromo ?? '').replace(/[^0-9.]/g, '')) || 0;
    const rawStock = r[col.stock];
    const stock = typeof rawStock === 'number' ? rawStock : parseInt(String(rawStock ?? '').replace(/[^0-9]/g, ''), 10) || 0;
    const modelImgUrl = String(r[col.modelImg] ?? '').trim();

    const rawImgs = r[col.images];
    const rawDescImgs = r[col.descImages];
    const rawVideos = r[col.videos];

    let product = map.get(key);
    if (!product) {
      const imgs = parseImgList(rawImgs);
      product = {
        key,
        itemId,
        gian,
        name,
        parentSku,
        link: link || (itemId ? `https://shopee.vn/product/0/${itemId}` : ''),
        description: desc,
        createTime: createTimeStr,
        image: imgs[0]?.url || '',
        images: imgs,
        descImages: parseImgList(rawDescImgs),
        videos: parseVideoList(rawVideos),
        status: String(r[col.status] || '').trim(),
        models: []
      };
      map.set(key, product);
    } else {
      if (!product.name && name) product.name = name;
      if (!product.parentSku && parentSku) product.parentSku = parentSku;
      if (!product.description && desc) product.description = desc;
      if (!product.link && link) product.link = link;
      if (!product.createTime && createTimeStr) product.createTime = createTimeStr;
      if (!product.images.length && rawImgs) {
        product.images = parseImgList(rawImgs);
        if (!product.image) product.image = product.images[0]?.url || '';
      }
      if (!product.descImages.length && rawDescImgs) product.descImages = parseImgList(rawDescImgs);
      if (!product.videos.length && rawVideos) product.videos = parseVideoList(rawVideos);
    }

    const mImgObj = modelImgUrl.startsWith('http') ? { url: modelImgUrl, thumb: modelImgUrl } : null;

    product.models.push({
      modelId,
      name: modelName,
      sku: modelSku,
      price,
      promoPrice,
      stock,
      image: modelImgUrl,
      imgObj: mImgObj
    });
  }

  for (const p of map.values()) {
    if (!p.models.length) {
      p.models.push({
        modelId: 0,
        name: 'Mặc định',
        sku: p.parentSku || '',
        price: 0,
        promoPrice: 0,
        stock: 0,
        image: '',
        imgObj: null
      });
    }
  }

  return Array.from(map.values());
}

const sheetTotalStock = (p) => p.models.reduce((a, m) => a + (Number(m.stock) || 0), 0);
const sheetMinPrice = (p) => Math.min(...p.models.map((m) => Number(m.price) || Infinity));
const sheetMaxPrice = (p) => Math.max(...p.models.map((m) => Number(m.price) || 0));

function selectedSheetProducts() {
  return sheetState.products.filter((p) => sheetState.selected.has(p.key));
}

function switchProductSubtab(tab) {
  const btnShop = $('#btnSubtabShopProducts');
  const btnSheet = $('#btnSubtabSheetProducts');
  const viewShop = $('#subtabShopProductsView');
  const viewSheet = $('#subtabSheetProductsView');

  if (tab === 'sheet') {
    if (btnShop) {
      btnShop.style.background = '#f1f5f9';
      btnShop.style.borderColor = '#cbd5e1';
      btnShop.style.color = '#475569';
    }
    if (btnSheet) {
      btnSheet.style.background = '#0284c7';
      btnSheet.style.borderColor = '#0284c7';
      btnSheet.style.color = '#ffffff';
    }
    if (viewShop) viewShop.style.display = 'none';
    if (viewSheet) viewSheet.style.display = '';

    if (!sheetState.products.length && !isSheetLoading) {
      loadSheetProducts();
    }
  } else {
    if (btnShop) {
      btnShop.style.background = '#0284c7';
      btnShop.style.borderColor = '#0284c7';
      btnShop.style.color = '#ffffff';
    }
    if (btnSheet) {
      btnSheet.style.background = '#f1f5f9';
      btnSheet.style.borderColor = '#cbd5e1';
      btnSheet.style.color = '#475569';
    }
    if (viewShop) viewShop.style.display = '';
    if (viewSheet) viewSheet.style.display = 'none';
  }
}

async function loadSheetProducts(forceRefresh = false) {
  if (isSheetLoading) return;
  isSheetLoading = true;
  const tbody = $('#sheetPTbody');
  const btnReload = $('#btnReloadSheetProducts');
  const source = $('#sheetSourceSelect')?.value || 'SP_SHOPEE_DAY_DU';
  const sourceName = source === 'SP_SHOPEE_DAY_DU' ? 'SP Shopee đầy đủ' : 'SP_SHOPEE';

  if (btnReload) {
    btnReload.disabled = true;
    btnReload.textContent = '🔄 Đang tải từ Sheet...';
  }
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="19" style="text-align:center;padding:30px;color:#0284c7;font-weight:600;"><span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> Đang đọc dữ liệu từ sheet ${esc(sourceName)}...</td></tr>`;
  }

  try {
    const msgType = source === 'SP_SHOPEE_DAY_DU' ? 'FETCH_SP_SHOPEE_DAY_DU' : 'FETCH_SP_SHOPEE';
    let res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: msgType }, resolve);
    });

    if (source === 'SP_SHOPEE_DAY_DU' && (!res || !res.ok || !res.values || res.values.length <= 1) && !forceRefresh) {
      const fallbackRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_SP_SHOPEE' }, resolve);
      });
      if (fallbackRes && fallbackRes.ok && fallbackRes.values && fallbackRes.values.length > 1) {
        console.log('SP_SHOPEE_DAY_DU chưa có dữ liệu, hiển thị dữ liệu từ SP_SHOPEE');
        res = fallbackRes;
        const sel = $('#sheetSourceSelect');
        if (sel) sel.value = 'SP_SHOPEE';
      }
    }

    if (!res || !res.ok) {
      throw new Error(res?.error || 'Không thể kết nối đến Google Sheets');
    }

    const rawValues = Array.isArray(res.values) ? res.values : [];
    if (!rawValues.length || rawValues.length <= 1) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="19" style="text-align:center;padding:30px;color:#64748b;">Sheet ${esc(sourceName)} trống, chưa có dữ liệu. Hãy bấm "Thêm vào SP Shopee đầy đủ" để nạp dữ liệu.</td></tr>`;
      sheetProductsRows = [];
      sheetState.rawRows = [];
      sheetState.products = [];
      renderSheetProductsTable();
      return;
    }

    sheetHeaders = rawValues[0] || [];
    sheetProductsRows = rawValues.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));

    sheetState.rawRows = sheetProductsRows;
    sheetState.products = parseSheetProducts(sheetProductsRows);
    sheetState.loadedAt = Date.now();
    sheetState.page = 1;

    chrome.storage.local.set({ sp_shopee_cache_data: rawValues });

    populateSheetGianDropdown();
    renderSheetProductsTable();

    const totalModels = sheetState.products.reduce((sum, p) => sum + p.models.length, 0);
    hooks.toast(`Đã tải thành công ${sheetState.products.length} sản phẩm (${totalModels} phân loại) từ sheet ${res.sheetTitle || sourceName}!`, 'success');
  } catch (err) {
    console.error('Lỗi nạp sheet:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="19" style="text-align:center;padding:30px;color:#ef4444;font-weight:600;">Lỗi đọc dữ liệu: ${esc(err.message)}<br><button id="btnRetryLoadSheet" class="btn small" style="margin-top:10px;">Thử lại</button></td></tr>`;
      const retryBtn = $('#btnRetryLoadSheet');
      if (retryBtn) retryBtn.onclick = () => loadSheetProducts(true);
    }
    hooks.toast('Lỗi đọc sheet: ' + err.message, 'error');
  } finally {
    isSheetLoading = false;
    if (btnReload) {
      btnReload.disabled = false;
      btnReload.textContent = '🔄 Đọc từ Sheet';
    }
  }
}

function populateSheetGianDropdown() {
  const select = $('#sheetGianFilter');
  if (!select) return;

  const currentVal = select.value;
  const gianCounts = {};
  for (const p of sheetState.products) {
    const g = p.gian || '(Không có gian)';
    gianCounts[g] = (gianCounts[g] || 0) + 1;
  }

  const sortedGians = Object.keys(gianCounts).sort((a, b) => {
    if (a === '(Không có gian)') return 1;
    if (b === '(Không có gian)') return -1;
    return a.localeCompare(b);
  });

  let html = `<option value="">Tất cả gian / shop (${sheetState.products.length} SP)</option>`;
  for (const g of sortedGians) {
    html += `<option value="${esc(g)}">${esc(g)} (${gianCounts[g]} SP)</option>`;
  }
  select.innerHTML = html;

  if (currentVal && gianCounts[currentVal]) {
    select.value = currentVal;
  }
}

// Ngày trên sheet dạng ngày/tháng/năm (vd 2/11/2026). SP không có ngày xếp cuối.
function sheetDateValue(text) {
  const m = String(text || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return Date.parse(text) || 0;
}

// Mở link khuyến mãi (cột link_km sheet CAI_DAT) theo mã gian của SP; trang KM tự bấm Chỉnh sửa + dán tên SP vào ô tìm.
let caiDatRowsCache = null;
async function getLinkKmByGian(gian) {
  if (!caiDatRowsCache) {
    const res = await new Promise((r) => chrome.runtime.sendMessage({ type: 'FETCH_CAI_DAT' }, r));
    if (!res?.ok) throw new Error(res?.error || 'Không đọc được sheet CAI_DAT');
    caiDatRowsCache = res.values || [];
  }
  const rows = caiDatRowsCache;
  const headers = (rows[0] || []).map((h) => String(h || '').trim().toLowerCase());
  let gi = headers.findIndex((h) => ['gian', 'ma gian', 'mã gian', 'ma_gian'].includes(h)); if (gi < 0) gi = 1;
  let ki = headers.findIndex((h) => h.includes('link_km') || h === 'link km'); if (ki < 0) ki = 8;
  const target = String(gian || '').trim().toLowerCase();
  const row = rows.slice(1).find((r) => String(r[gi] || '').trim().toLowerCase() === target && String(r[ki] || '').trim());
  return row ? String(row[ki]).trim() : '';
}

// Kết quả điền giá KM do content script trên trang Shopee báo về
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((ch) => {
    const r = ch.autoKmFillResult?.newValue;
    if (!r) return;
    if (r.ok) {
      const sp = sheetState.products.find((x) => x.key === r.key);
      const m = sp?.models?.[r.modelIdx];
      if (m) { m.promoPrice = r.price; renderSheetProductsTable(); }
    }
    alert(r.ok ? `✅ Đã lưu giá KM ${money(r.price)} cho "${r.name}".` : `⚠️ Chưa lưu được giá KM: ${r.msg}`);
  });
}

async function openKmLinkForProduct(p, fill = null) {
  try {
    const link = await getLinkKmByGian(p.gian);
    if (!link) { alert(`Không tìm thấy link KM cho gian "${p.gian || '(trống)'}" ở cột link_km sheet CAI_DAT.`); return; }
    const name = String(p.name || '').trim();
    try { await navigator.clipboard.writeText(name); } catch {}
    await chrome.storage.local.set({ autoClickEditKmTimestamp: Date.now(), autoSearchKmProductName: name, autoKmFill: fill ? { ...fill, name, ts: Date.now() } : null });
    let url = /^https?:\/\//.test(link) ? link : `https://${link}`;
    if (!url.includes('#auto_edit_km')) url = url.includes('#') ? url.replace('#', '#auto_edit_km=1&') : `${url}#auto_edit_km=1`;
    window.open(url, '_blank');
  } catch (e) {
    alert('Lỗi mở link KM: ' + e.message);
  }
}

// Tìm kiếm: ',' = HOẶC, '\' = VÀ. Vd "2633,3212" khớp 1 trong 2; "2633\3212" phải có cả 2.
function matchSearchKw(hay, kw) {
  const groups = String(kw || '').toLowerCase().split(',').map((g) => g.split('\\').map((t) => t.trim()).filter(Boolean)).filter((g) => g.length);
  if (!groups.length) return true;
  return groups.some((terms) => terms.every((t) => hay.includes(t)));
}

function filteredSheetProducts() {
  const kw = ($('#sheetSearchInput')?.value || '').trim().toLowerCase();
  const gianFilter = ($('#sheetGianFilter')?.value || '').trim().toLowerCase();
  const sort = $('#sheetSortFilter')?.value || 'newest';
  const stockF = $('#sheetStockFilter')?.value || '', videoF = $('#sheetVideoFilter')?.value || '';
  const modelF = $('#sheetModelFilter')?.value || '', descF = $('#sheetDescFilter')?.value || '';
  const statusF = $('#sheetStatusFilter')?.value || '';

  let list = sheetState.products.filter((p) => {
    if (statusF && (p.status || '(chưa có)') !== statusF) return false;
    if (stockF === 'in' && !(sheetTotalStock(p) > 0)) return false;
    if (stockF === 'out' && sheetTotalStock(p) > 0) return false;
    if (videoF === 'yes' && !p.videos?.length) return false;
    if (videoF === 'no' && p.videos?.length) return false;
    if (modelF === 'one' && p.models.length > 1) return false;
    if (modelF === 'many' && p.models.length <= 1) return false;
    const hasDesc = !!String(p.description || '').trim();
    if (descF === 'yes' && !hasDesc) return false;
    if (descF === 'no' && hasDesc) return false;
    if (descF === 'img' && !p.descImages?.length) return false;
    if (descF === 'noimg' && p.descImages?.length) return false;
    if (gianFilter) {
      const g = (p.gian || '').toLowerCase();
      if (gianFilter === '(không có gian)') {
        if (g !== '') return false;
      } else if (g !== gianFilter) {
        return false;
      }
    }

    if (kw) {
      const hay = `${p.name} ${p.itemId} ${p.parentSku} ${p.gian} ${p.models.map((m) => `${m.sku} ${m.name} ${m.modelId}`).join(' ')}`.toLowerCase();
      if (!matchSearchKw(hay, kw)) return false;
    }

    return true;
  });

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name, 'vi'),
    priceAsc: (a, b) => sheetMinPrice(a) - sheetMinPrice(b),
    priceDesc: (a, b) => sheetMaxPrice(b) - sheetMaxPrice(a),
    stockAsc: (a, b) => sheetTotalStock(a) - sheetTotalStock(b),
    stockDesc: (a, b) => sheetTotalStock(b) - sheetTotalStock(a),
    newest: (a, b) => sheetDateValue(b.createTime) - sheetDateValue(a.createTime)
  };

  if (sorters[sort]) list = list.slice().sort(sorters[sort]);
  // Lọc 1 ký tự đầu của SKU (số lượng tính trên các lọc khác)
  renderSheetPrefixChips(list);
  if (sheetState.prefix) list = list.filter((p) => sheetPrefixOf(p) === sheetState.prefix);
  return list;
}

const sheetPrefixOf = (p) => String(p.models[0]?.sku || p.parentSku || '').trim().charAt(0).toUpperCase() || '?';
function renderSheetPrefixChips(list) {
  const box = $('#sheetPrefixChips');
  if (!box) return;
  const counts = new Map();
  list.forEach((p) => { const k = sheetPrefixOf(p); counts.set(k, (counts.get(k) || 0) + 1); });
  if (sheetState.prefix && !counts.has(sheetState.prefix)) counts.set(sheetState.prefix, 0);
  const keys = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  const chip = (k, label, n) => `<button type="button" class="prefix-chip${(sheetState.prefix || '') === k ? ' active' : ''}" data-prefix="${esc(k)}">${esc(label)}<sub>${n}</sub></button>`;
  box.innerHTML = '<span class="muted">1 ký tự:</span>' + chip('', 'Tất cả', list.length) + keys.map((k) => chip(k, k, counts.get(k))).join('');
}

function renderSheetSummary() {
  const el = $('#sheetSummary');
  if (!el) return;
  const all = sheetState.products;
  if (!all.length) {
    el.innerHTML = '<span class="muted">Chưa nạp dữ liệu. Bấm <b>"🔄 Đọc từ Sheet"</b> để đọc sản phẩm.</span>';
    return;
  }
  const totalModels = all.reduce((sum, p) => sum + p.models.length, 0);
  const out = all.filter((p) => sheetTotalStock(p) <= 0).length;
  const inStock = all.length - out;
  const gianSet = new Set(all.map((p) => p.gian).filter(Boolean));
  const gianCount = gianSet.size;

  el.innerHTML = `<b>${all.length}</b> sản phẩm · ${totalModels} phân loại · <b>${gianCount}</b> gian/shop · <b>${inStock}</b> còn hàng · <b style="color:var(--err)">${out}</b> hết hàng`
    + (sheetState.loadedAt ? ` · cập nhật ${new Date(sheetState.loadedAt).toLocaleString('vi-VN')}` : '');
}

function sheetImagesCell(list, key, max = 3) {
  if (!list || !list.length) return '<span class="muted">—</span>';
  const more = list.length > max ? `<button class="btn small" data-sheet-media="${esc(key)}" title="Xem tất cả">+${list.length - max}</button>` : '';
  return `<div class="cell-imgs">${list.slice(0, max).map((x) => thumb(x)).join('')}${more}</div>`;
}

function sheetProductRows(p) {
  const span = p.models.length;
  const rs = `rowspan="${span}"`;
  const sLink = p.link || (p.itemId ? `https://shopee.vn/product/0/${p.itemId}` : '');
  const linkCell = sLink
    ? `<a class="btn small" target="_blank" href="${esc(sLink)}" title="${esc(sLink)}" style="color:#0284c7;font-weight:600;white-space:nowrap;">🔗 Mở</a>`
    : '<span class="muted">—</span>';
  const desc = p.description || '';
  const descShort = desc ? (desc.length > 70 ? desc.slice(0, 70) + '...' : desc) : '';
  const descCell = desc
    ? `<div class="desc-cell" style="max-height:55px;overflow:hidden;font-size:11.5px;color:#475569;line-height:1.35;white-space:pre-wrap;" title="${esc(desc)}">${esc(descShort)}</div>`
    : '<span class="muted">—</span>';

  const gianBadge = p.gian
    ? `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;font-size:11px;padding:2px 7px;border-radius:4px;" title="Gian: ${esc(p.gian)}">${esc(p.gian)}</span>`
    : '<span class="muted" style="font-size:11px;">—</span>';

  return p.models.map((m, i) => {
    const isOut = m.stock <= 0;
    const mImgCell = m.imgObj
      ? thumb(m.imgObj, m.name)
      : (m.image ? `<a href="${esc(m.image)}" target="_blank"><img class="cell-img" src="${esc(m.image)}" loading="lazy"></a>` : '<span class="muted">—</span>');

    const stockCell = `<td class="stock-cell" data-col="stock" data-item-id="${p.itemId}" data-model-id="${m.modelId || 0}" data-stock="${m.stock}">
      <div class="stock-display" style="display:inline-flex;align-items:center;gap:4px;justify-content:center;">
        <span class="stock-num" style="${isOut ? 'color:var(--err);font-weight:700;' : 'font-weight:600;'}" title="Bấm để sửa tồn kho trên Shopee">${m.stock}</span>
        <button type="button" class="btn-stock-edit" title="Sửa tồn kho trên Shopee" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;font-size:10.5px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:3px;cursor:pointer;opacity:0.75;" onmouseover="this.style.opacity=1;this.style.background='#e0f2fe'" onmouseout="this.style.opacity=0.75;this.style.background='#f8fafc'">✏️</button>
      </div>
    </td>`;

    const parentCell = {
      chk: () => `<input type="checkbox" data-sheet-sel="${esc(p.key)}" ${sheetState.selected.has(p.key) ? 'checked' : ''}>`,
      gian: () => gianBadge,
      itemId: () => `<span style="font-family:monospace;font-weight:600;color:#0f172a;">${esc(p.itemId)}</span>
        <button type="button" class="btn small" data-copy-sheet="${esc(p.itemId)}" title="Sao chép Mã SP" style="padding:1px 5px;font-size:11px;margin-left:4px;">📋</button>`,
      name: () => `<div class="name" title="${esc(p.name)}">${esc(p.name)}</div>`,
      link: () => linkCell,
      desc: () => descCell,
      parentSku: () => `<span style="font-family:monospace;font-size:11.5px;color:#334155;">${skuView(p.parentSku, p.itemId)}</span>`,
      images: () => sheetImagesCell(p.images, p.key),
      descImages: () => sheetImagesCell(p.descImages, p.key),
      videos: () => videoCell(p.videos),
      createTime: () => `<span style="font-size:12px;color:#64748b;">${esc(p.createTime) || '<span class="muted">—</span>'}</span>`,
      actions: () => `<div class="row" style="gap:4px;">
        <button class="btn small" data-open-edit="${p.itemId}" data-sheet-key="${esc(p.key)}" title="Xem &amp; Chỉnh sửa chi tiết sản phẩm đầy đủ như Shopee Portal" style="font-weight:700;background:#f59e0b;border-color:#d97706;color:#fff;">📝 Sửa chi tiết</button>
        <button class="btn small" data-open-km="${esc(p.key)}" title="Mở link khuyến mãi của gian ${esc(p.gian || '')} (cột link_km sheet CAI_DAT) để sửa giá KM" style="font-weight:700;background:#e11d48;border-color:#be123c;color:#fff;">💲 Sửa KM</button>
        <button class="btn small primary" data-sheet-to-fs="${esc(p.key)}" title="Đưa sản phẩm này vào Flash Sale">⚡ FS</button>
        <button class="btn small" data-sheet-media="${esc(p.key)}" title="Xem ảnh & video">🖼 Ảnh</button>
        <button class="btn small" data-sync-item="${p.itemId}" title="Đồng bộ lại thông tin &amp; tồn kho của sản phẩm này từ Shopee" style="font-weight:700;background:#6366f1;border-color:#4f46e5;color:#fff;">🔄 Đồng bộ</button>
        <a class="btn small" target="_blank" href="https://banhang.shopee.vn/portal/product/${p.itemId}">Sửa</a>
        ${sLink ? `<a class="btn small" target="_blank" href="${esc(sLink)}">Xem</a>` : ''}
      </div>`
    };
    const modelCell = {
      modelId: () => `<td data-col="modelId" style="font-family:monospace;font-size:11px;">${m.modelId || '<span class="muted">—</span>'}</td>`,
      modelName: () => `<td data-col="modelName" style="font-size:12px;color:#334155;">${esc(m.name) || '<span class="muted">Mặc định</span>'}</td>`,
      modelSku: () => `<td data-col="modelSku" style="font-family:monospace;font-size:11.5px;color:#334155;">${skuView(m.sku, p.itemId, m.modelId || 0)}</td>`,
      modelImg: () => `<td data-col="modelImg">${mImgCell}</td>`,
      price: () => `<td data-col="price" style="font-weight:600;font-size:12.5px;">${m.price ? money(m.price) : '<span class="muted">—</span>'}</td>`,
      promoPrice: () => `<td data-col="promoPrice" data-edit-km="${esc(p.key)}" data-model-idx="${i}" title="Bấm để sửa giá KM (tự vào link KM của gian, điền giá và lưu)" style="cursor:pointer;font-weight:600;color:#e11d48;font-size:12.5px;">${m.promoPrice && m.promoPrice < m.price ? money(m.promoPrice) : '<span class="muted">—</span>'} <span style="font-size:10px;opacity:.7;">✏️</span></td>`,
      stock: () => stockCell
    };
    const cells = getActiveSheetCols().map((c) => {
      if (modelCell[c.id]) return modelCell[c.id]();
      return i === 0 && parentCell[c.id] ? `<td ${rs} data-col="${c.id}">${parentCell[c.id]()}</td>` : '';
    }).join('');
    return `<tr class="${i === 0 ? 'first-model' : 'model-row'}" data-sheet-key="${esc(p.key)}" data-id="${p.itemId}">${cells}</tr>`;
  }).join('');
}

function renderSheetTableThead() {
  const thead = $('#sheetPTable thead');
  if (!thead) return;
  thead.innerHTML = `<tr>${getActiveSheetCols().map((c) => (c.id === 'chk'
    ? '<th data-col="chk"><input type="checkbox" id="sheetChkAll" title="Chọn cả trang"></th>'
    : `<th data-col="${c.id}">${esc(c.label)}</th>`)).join('')}</tr>`;
  const chkAll = $('#sheetChkAll');
  if (chkAll) {
    chkAll.onchange = (e) => {
      const start = (sheetState.page - 1) * sheetState.pageSize;
      filteredSheetProducts().slice(start, start + sheetState.pageSize).forEach((p) => {
        if (e.target.checked) sheetState.selected.add(p.key);
        else sheetState.selected.delete(p.key);
      });
      renderSheetProductsTable();
    };
  }
}

function renderSheetProductsTable() {
  // Danh sách trạng thái lấy từ dữ liệu sheet (giữ lựa chọn đang chọn)
  const stSel = $('#sheetStatusFilter');
  if (stSel) {
    const counts = new Map();
    sheetState.products.forEach((p) => { const k = p.status || '(chưa có)'; counts.set(k, (counts.get(k) || 0) + 1); });
    const cur = stSel.value;
    stSel.innerHTML = '<option value="">Trạng thái: tất cả</option>' + [...counts].sort((x, y) => y[1] - x[1])
      .map(([k, n]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(k)} (${n})</option>`).join('');
  }
  renderSheetSummary();
  const list = filteredSheetProducts();
  const totalPages = Math.max(1, Math.ceil(list.length / sheetState.pageSize));
  sheetState.page = Math.min(sheetState.page, totalPages);
  if (sheetState.page < 1) sheetState.page = 1;

  const start = (sheetState.page - 1) * sheetState.pageSize;
  const rows = list.slice(start, start + sheetState.pageSize);

  const selCount = $('#sheetSelCount');
  if (selCount) selCount.textContent = sheetState.selected.size;

  const fCount = $('#sheetFilteredCount');
  if (fCount) fCount.textContent = list.length;

  const badgeSubtab = $('#sheetProductsBadge');
  if (badgeSubtab) badgeSubtab.textContent = sheetState.products.length;

  const tbody = $('#sheetPTbody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${getActiveSheetCols().length}" class="muted" style="text-align:center;padding:30px;">${sheetState.products.length ? 'Không có sản phẩm khớp bộ lọc.' : 'Chưa có dữ liệu.'}</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(sheetProductRows).join('');
  }

  const pager = $('#sheetPPager');
  if (pager) {
    if (totalPages <= 1) {
      pager.innerHTML = '';
    } else {
      let pHtml = `<span class="muted" style="margin-right:8px;font-size:12px;">Trang ${sheetState.page}/${totalPages} (${list.length} sản phẩm)</span>`;
      pHtml += `<button class="btn small" data-sheet-page="1" ${sheetState.page === 1 ? 'disabled' : ''}>« Đầu</button>`;
      pHtml += `<button class="btn small" data-sheet-page="${sheetState.page - 1}" ${sheetState.page === 1 ? 'disabled' : ''}>‹ Trước</button>`;

      const startP = Math.max(1, sheetState.page - 2);
      const endP = Math.min(totalPages, sheetState.page + 2);
      for (let p = startP; p <= endP; p++) {
        pHtml += `<button class="btn small ${p === sheetState.page ? 'primary' : ''}" data-sheet-page="${p}">${p}</button>`;
      }

      pHtml += `<button class="btn small" data-sheet-page="${sheetState.page + 1}" ${sheetState.page === totalPages ? 'disabled' : ''}>Sau ›</button>`;
      pHtml += `<button class="btn small" data-sheet-page="${totalPages}" ${sheetState.page === totalPages ? 'disabled' : ''}>Cuối »</button>`;
      pager.innerHTML = pHtml;
    }
  }
}

// ---------- Sửa SKU tại ô ----------
function applySavedSku(itemId, modelId, sku) {
  const lists = [state.all, sheetState.products];
  for (const list of lists) {
    for (const p of list.filter((x) => Number(x.itemId) === Number(itemId))) {
      if (modelId === null) p.parentSku = sku;
      else (p.models.find((m) => Number(m.modelId || 0) === modelId) || (p.models.length === 1 ? p.models[0] : {})).sku = sku;
    }
  }
}

function onSkuEditClick(e) {
  const view = e.target.closest('.sku-edit-view');
  if (!view) return;
  e.stopPropagation();
  const td = view.closest('td');
  const itemId = view.dataset.itemId;
  const modelId = view.dataset.modelId === '' ? null : Number(view.dataset.modelId);
  const list = [...state.all, ...sheetState.products].find((x) => Number(x.itemId) === Number(itemId));
  const model = modelId === null ? null : list?.models.find((m) => Number(m.modelId || 0) === modelId) || (list?.models.length === 1 ? list.models[0] : null);
  const oldSku = String((modelId === null ? list?.parentSku : model?.sku) ?? '');
  const oldHtml = td.innerHTML;
  const oldWhiteSpace = td.style.whiteSpace;

  td.style.whiteSpace = 'normal';
  td.innerHTML = `<div class="sku-inline-form" style="display:flex;flex-wrap:wrap;gap:3px;">
    <input type="text" class="sku-inline-input" maxlength="100" value="${esc(oldSku)}" style="flex:1 1 100%;min-width:0;height:24px;padding:0 4px;font-size:11.5px;">
    <button type="button" class="btn small primary btn-sku-save" style="height:22px;padding:0 6px;background:#16a34a;border-color:#16a34a;color:#fff;">Lưu</button>
    <button type="button" class="btn small btn-sku-cancel" style="height:22px;padding:0 6px;" title="Hủy">✕</button>
  </div>`;
  const input = td.querySelector('.sku-inline-input');
  const saveBtn = td.querySelector('.btn-sku-save');
  const cancelBtn = td.querySelector('.btn-sku-cancel');
  input.focus();
  input.select();

  const close = () => {
    td.innerHTML = oldHtml;
    td.style.whiteSpace = oldWhiteSpace;
  };
  const save = async () => {
    const sku = input.value.trim();
    if (sku === oldSku.trim()) return close();
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    input.disabled = true;
    saveBtn.textContent = '⏳';
    try {
      await products.updateSku(itemId, modelId, sku);
      applySavedSku(itemId, modelId, sku);
      persistProductsCache();
      const mainP = state.all.find((x) => Number(x.itemId) === Number(itemId));
      if (mainP) autoSyncProductToSpShopee(mainP);
      const sheetRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'UPDATE_SKU_IN_SHEETS', itemId, modelId, sku }, resolve);
      });
      if (sheetRes && sheetRes.ok) hooks.toast(`✔ Đã lưu SKU "${sku || 'trống'}" lên Shopee và ${sheetRes.updated} ô trên Sheet`, 'success');
      else hooks.toast(`Đã lưu lên Shopee nhưng chưa ghi được Sheet: ${(sheetRes && sheetRes.error) || 'không rõ lỗi'}`, 'error');
      render();
      renderSheetProductsTable();
    } catch (err) {
      hooks.toast('Lỗi lưu SKU: ' + err.message, 'error');
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      input.disabled = false;
      saveBtn.textContent = 'Lưu';
    }
  };
  saveBtn.onclick = (ev) => { ev.stopPropagation(); save(); };
  cancelBtn.onclick = (ev) => { ev.stopPropagation(); close(); };
  input.onclick = (ev) => ev.stopPropagation();
  input.onkeydown = (ev) => {
    if (ev.key === 'Enter') save();
    if (ev.key === 'Escape') close();
  };
}

// ---------- Khởi tạo ----------
export async function initProductsTab(h) {
  hooks = { ...hooks, ...h };
  initProductEditModal(hooks);

  $('#btnPLoad').onclick = loadAll;
  initAutoLoad();
  $('#btnPStop').onclick = () => { state.stop = true; };
  if ($('#btnPExport')) $('#btnPExport').onclick = exportCsv;
  $('#btnPExportMedia').onclick = exportMediaCsv;

  // Subtabs Sản phẩm
  const btnSubShop = $('#btnSubtabShopProducts');
  if (btnSubShop) btnSubShop.onclick = () => switchProductSubtab('shop');
  const btnSubSheet = $('#btnSubtabSheetProducts');
  if (btnSubSheet) btnSubSheet.onclick = () => switchProductSubtab('sheet');

  // Sheet SP_SHOPEE Reader
  const btnReloadSheet = $('#btnReloadSheetProducts');
  if (btnReloadSheet) btnReloadSheet.onclick = () => loadSheetProducts(true);

  const sheetSortFilter = $('#sheetSortFilter');
  if (sheetSortFilter) {
    sheetSortFilter.onchange = () => {
      sheetState.page = 1;
      renderSheetProductsTable();
    };
  }

  const sheetGianSelect = $('#sheetGianFilter');
  if (sheetGianSelect) {
    sheetGianSelect.onchange = () => {
      sheetState.page = 1;
      renderSheetProductsTable();
    };
  }

  const sheetSearchInput = $('#sheetSearchInput');
  if (sheetSearchInput) {
    let searchDebounce = null;
    sheetSearchInput.oninput = () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        sheetState.page = 1;
        renderSheetProductsTable();
      }, 250);
    };
  }

  // Lọc tồn / video / phân loại / mô tả + chip 1 ký tự
  ['#sheetStatusFilter', '#sheetStockFilter', '#sheetVideoFilter', '#sheetModelFilter', '#sheetDescFilter'].forEach((sel) => {
    const el = $(sel);
    if (el) el.onchange = () => { sheetState.page = 1; renderSheetProductsTable(); };
  });
  const chips = $('#sheetPrefixChips');
  if (chips) chips.onclick = (e) => {
    const b = e.target.closest('[data-prefix]');
    if (!b) return;
    sheetState.prefix = b.dataset.prefix;
    sheetState.page = 1;
    renderSheetProductsTable();
  };

  const btnClearSheet = $('#btnClearSheetFilter');
  if (btnClearSheet) {
    btnClearSheet.onclick = () => {
      if (sheetGianSelect) sheetGianSelect.value = '';
      if (sheetSearchInput) sheetSearchInput.value = '';
      const sortEl = $('#sheetSortFilter');
      if (sortEl) sortEl.value = 'newest';
      sheetState.page = 1;
      renderSheetProductsTable();
    };
  }

  sheetTableCols = getTableConfig('sheetPTable', SHEET_TABLE_DEFAULT_COLS);
  applyTableStyles('sheetPTable', sheetTableCols);
  renderSheetTableThead();
  const btnSheetCols = $('#btnSheetTableCols');
  if (btnSheetCols) {
    btnSheetCols.onclick = () => openColumnCustomizerModal({
      tableId: 'sheetPTable',
      tableName: 'Bảng SP từ Sheet',
      defaultCols: SHEET_TABLE_DEFAULT_COLS,
      currentConfig: sheetTableCols,
      onSave: (newCfg) => {
        sheetTableCols = newCfg;
        renderSheetTableThead();
        renderSheetProductsTable();
      }
    });
  }

  const btnSheetSyncBatch = $('#btnSheetSyncBatch');
  if (btnSheetSyncBatch) {
    btnSheetSyncBatch.onclick = () => syncBatchProducts(true);
  }

  const btnSheetCopyIds = $('#btnSheetCopyIds');
  if (btnSheetCopyIds) {
    btnSheetCopyIds.onclick = async () => {
      const ids = [...new Set(filteredSheetProducts().map((p) => String(p.itemId || '').trim()).filter(Boolean))];
      if (!ids.length) { alert('Không có sản phẩm nào để copy.'); return; }
      try { await navigator.clipboard.writeText(ids.join(',')); }
      catch { const ta = document.createElement('textarea'); ta.value = ids.join(','); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      const old = btnSheetCopyIds.textContent;
      btnSheetCopyIds.textContent = `✅ Đã copy ${ids.length} ID`;
      setTimeout(() => { btnSheetCopyIds.textContent = old; }, 1800);
    };
  }

  const sheetTable = $('#sheetPTable');
  if (sheetTable) {
    sheetTable.addEventListener('click', async (e) => {
      // 1. Inline stock edit
      const editStockBtn = e.target.closest('.btn-stock-edit') || e.target.closest('.stock-num');
      if (editStockBtn) {
        e.stopPropagation();
        const td = editStockBtn.closest('td.stock-cell');
        if (!td || td.querySelector('.stock-inline-form')) return;

        const itemId = Number(td.dataset.itemId);
        const modelId = Number(td.dataset.modelId || 0);
        const currentStock = parseInt(td.dataset.stock, 10) || 0;
        const tr = td.closest('tr[data-sheet-key]');
        const sheetKey = tr ? tr.dataset.sheetKey : '';
        const product = sheetState.products.find((x) => x.key === sheetKey || x.itemId === itemId);
        const hasMultipleModels = product && Array.isArray(product.models) && product.models.length > 1;

        const oldHtml = td.innerHTML;

        td.innerHTML = `
          <div class="stock-inline-form" style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;padding:3px;background:#f0f9ff;border:1.5px solid #0284c7;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.15);position:relative;z-index:10;">
            <div style="display:inline-flex;align-items:center;gap:2px;">
              <input type="number" min="0" class="stock-inline-input" value="${currentStock}" style="width:58px;height:22px;padding:0 3px;font-size:12px;font-weight:700;text-align:center;border:1px solid #cbd5e1;border-radius:3px;outline:none;background:#fff;">
              <button type="button" class="btn small primary btn-stock-save" style="height:22px;line-height:20px;padding:0 6px;background:#16a34a;border-color:#16a34a;color:#fff;font-weight:700;font-size:11px;" title="Lưu lên Shopee">✔</button>
              <button type="button" class="btn small btn-stock-cancel" style="height:22px;line-height:20px;padding:0 4px;font-size:11px;" title="Hủy">✕</button>
            </div>
            ${hasMultipleModels ? `<label style="font-size:10px;color:#0369a1;display:inline-flex;align-items:center;gap:2px;cursor:pointer;margin:0;white-space:nowrap;"><input type="checkbox" class="chk-all-models" style="margin:0;transform:scale(0.85);"> Đổi cả SP</label>` : ''}
          </div>
        `;

        const input = td.querySelector('.stock-inline-input');
        const saveBtn = td.querySelector('.btn-stock-save');
        const cancelBtn = td.querySelector('.btn-stock-cancel');
        const chkAll = td.querySelector('.chk-all-models');

        if (input) {
          input.focus();
          input.select();
        }

        const cancelEdit = () => {
          td.innerHTML = oldHtml;
        };

        if (cancelBtn) cancelBtn.onclick = (ce) => { ce.stopPropagation(); cancelEdit(); };

        const doSave = async () => {
          const newVal = parseInt(input.value, 10);
          if (isNaN(newVal) || newVal < 0) {
            hooks.toast('Số lượng tồn kho phải là số >= 0', 'error');
            input.focus();
            return;
          }

          const applyAll = !!(chkAll && chkAll.checked);

          saveBtn.disabled = true;
          cancelBtn.disabled = true;
          input.disabled = true;
          saveBtn.textContent = '⏳';

          try {
            const saved = await products.updateStock(itemId, modelId, newVal, applyAll);

            if (product) {
              if (applyAll) {
                product.models.forEach((m) => { m.stock = newVal; m.locationStocksSynced = true; });
              } else {
                const m = product.models.find((x) => Number(x.modelId) === Number(modelId)) || product.models[0];
                if (m) {
                  m.stock = newVal;
                  m.locationStocksSynced = true;
                }
              }
              applySavedStock(product, saved, applyAll ? null : modelId, newVal);
            }

            // Đồng bộ sang state.all và Google Sheet
            const mainP = state.all.find((x) => Number(x.itemId) === Number(itemId));
            if (mainP) {
              if (applyAll) {
                mainP.models.forEach((m) => { m.stock = newVal; m.locationStocksSynced = true; });
                mainP.stock = newVal * mainP.models.length;
              } else {
                const mm = mainP.models.find((x) => Number(x.modelId) === Number(modelId)) || mainP.models[0];
                if (mm) {
                  mm.stock = newVal;
                  mm.locationStocksSynced = true;
                }
                mainP.stock = mainP.models.reduce((acc, x) => acc + (x.stock || 0), 0);
              }
              applySavedStock(mainP, saved, applyAll ? null : modelId, newVal);
              persistProductsCache();
              refreshRows([mainP]);
              autoSyncProductToSpShopee(mainP);
            }

            hooks.toast(`✔ Đã cập nhật tồn kho thành ${newVal} trên Shopee thành công!`, 'success');
            renderSheetProductsTable();
          } catch (err) {
            console.error('Lỗi cập nhật tồn kho Shopee:', err);
            hooks.toast('Lỗi cập nhật Shopee: ' + err.message, 'error');
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
            input.disabled = false;
            saveBtn.textContent = '✔';
            input.focus();
          }
        };

        if (saveBtn) saveBtn.onclick = (se) => { se.stopPropagation(); doSave(); };

        input.onkeydown = (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            doSave();
          } else if (ke.key === 'Escape') {
            ke.preventDefault();
            cancelEdit();
          }
        };
        return;
      }

      // 2. Checkbox selection
      const chkSel = e.target.closest('[data-sheet-sel]');
      if (chkSel) {
        const key = chkSel.dataset.sheetSel;
        if (chkSel.checked) sheetState.selected.add(key);
        else sheetState.selected.delete(key);
        const selCount = $('#sheetSelCount');
        if (selCount) selCount.textContent = sheetState.selected.size;
        return;
      }

      // 3. Copy button
      const copyBtn = e.target.closest('[data-copy-sheet]');
      if (copyBtn) {
        copyText(copyBtn.dataset.copySheet, 'Mã SP');
        return;
      }

      // 4. Add single product to Flash Sale
      const toFsBtn = e.target.closest('[data-sheet-to-fs]');
      if (toFsBtn) {
        const key = toFsBtn.dataset.sheetToFs;
        const p = sheetState.products.find((x) => x.key === key);
        if (p) hooks.onFlashSale([p]);
        return;
      }

      // 5. Open media modal
      const mediaBtn = e.target.closest('[data-sheet-media]');
      if (mediaBtn) {
        const key = mediaBtn.dataset.sheetMedia;
        const p = sheetState.products.find((x) => x.key === key);
        if (p) {
          const media = {
            images: p.images || [],
            variations: (p.models || []).filter((m) => m.image).map((m) => ({ url: m.image, thumb: m.image, group: 'Phân loại', option: m.name })),
            descImages: p.descImages || [],
            videos: p.videos || []
          };
          renderMedia(p, media);
          $('#pMedia').classList.remove('hidden');
        }
        return;
      }

      // 5.5. Sync product from Shopee
      const syncBtn = e.target.closest('[data-sync-item]');
      if (syncBtn) {
        const itemId = Number(syncBtn.dataset.syncItem);
        syncSingleProduct(itemId, syncBtn);
        return;
      }

      const kmEdit = e.target.closest('[data-edit-km]');
      if (kmEdit) {
        const sp = sheetState.products.find((x) => x.key === kmEdit.dataset.editKm);
        const m = sp?.models?.[Number(kmEdit.dataset.modelIdx)];
        if (!sp || !m) return;
        const label = `${sp.name}${m.name ? ' — ' + m.name : ''}`;
        const cur = m.promoPrice && m.promoPrice < m.price ? m.promoPrice : '';
        const raw = prompt(`Giá KM mới cho:
${label}
(Giá gốc ${money(m.price)})`, cur);
        if (raw == null) return;
        const price = Number(String(raw).replace(/[^0-9]/g, ''));
        if (!price) { alert('Giá không hợp lệ.'); return; }
        if (m.price && price >= m.price) { alert('Giá KM phải nhỏ hơn giá gốc.'); return; }
        openKmLinkForProduct(sp, { modelName: m.name || '', sku: m.sku || '', price, key: sp.key, modelIdx: Number(kmEdit.dataset.modelIdx), multi: sp.models.length > 1 });
        return;
      }

      const kmBtn = e.target.closest('[data-open-km]');
      if (kmBtn) {
        const sp = sheetState.products.find((x) => x.key === kmBtn.dataset.openKm);
        if (sp) openKmLinkForProduct(sp);
        return;
      }

      // 6. Open Product Edit Modal
      const editBtn = e.target.closest('[data-open-edit]');
      if (editBtn) {
        const itemId = Number(editBtn.dataset.openEdit);
        const sheetKey = editBtn.dataset.sheetKey;
        const sheetP = sheetState.products.find((x) => x.key === sheetKey || Number(x.itemId) === itemId);
        const mainP = state.all.find((x) => Number(x.itemId) === itemId);
        openProductEditModal(itemId, sheetP || mainP, (savedId, updates) => {
          if (sheetP) {
            if (updates.name) sheetP.name = updates.name;
            if (updates.parent_sku !== undefined) sheetP.sku = updates.parent_sku;
            if (Array.isArray(updates.model_list)) {
              updates.model_list.forEach((um) => {
                const m = sheetP.models?.find((x) => Number(x.modelId) === Number(um.model_id));
                if (m) {
                  if (um.normal_price !== undefined) m.price = um.normal_price;
                  if (um.stock_setting_list?.[0]?.normal_stock !== undefined) {
                    m.stock = um.stock_setting_list[0].normal_stock;
                  }
                }
              });
            }
          }
          if (mainP) {
            if (updates.name) mainP.name = updates.name;
            if (updates.parent_sku !== undefined) mainP.sku = updates.parent_sku;
            if (Array.isArray(updates.model_list)) {
              updates.model_list.forEach((um) => {
                const m = mainP.models?.find((x) => Number(x.modelId) === Number(um.model_id));
                if (m) {
                  if (um.normal_price !== undefined) m.price = um.normal_price;
                  if (um.stock_setting_list?.[0]?.normal_stock !== undefined) {
                    m.stock = um.stock_setting_list[0].normal_stock;
                  }
                }
              });
              mainP.stock = mainP.models?.reduce((acc, m) => acc + (m.stock || 0), 0);
            }
            persistProductsCache();
            refreshRows([mainP]);
            autoSyncProductToSpShopee(mainP);
          }
          renderSheetProductsTable();
        });
        return;
      }
    });
  }

  const sheetPager = $('#sheetPPager');
  if (sheetPager) {
    sheetPager.onclick = (e) => {
      const b = e.target.closest('button[data-sheet-page]');
      if (!b || b.disabled) return;
      sheetState.page = Number(b.dataset.sheetPage);
      renderSheetProductsTable();
      const wrap = $('#subtabSheetProductsView .table-wrap');
      if (wrap) wrap.scrollTop = 0;
    };
  }

  // Khôi phục cache SP_SHOPEE nếu có
  chrome.storage.local.get(['sp_shopee_cache_data'], (res) => {
    if (res && Array.isArray(res.sp_shopee_cache_data) && res.sp_shopee_cache_data.length > 1) {
      sheetHeaders = res.sp_shopee_cache_data[0] || [];
      sheetProductsRows = res.sp_shopee_cache_data.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
      sheetState.rawRows = sheetProductsRows;
      sheetState.products = parseSheetProducts(sheetProductsRows);
      sheetState.loadedAt = Date.now();
      populateSheetGianDropdown();
      renderSheetProductsTable();
    }
  });

  // Khung Ảnh & Video
  $('#pMediaClose').onclick = () => $('#pMedia').classList.add('hidden');
  $('#pMedia').addEventListener('click', (e) => {
    if (e.target.id === 'pMedia') $('#pMedia').classList.add('hidden');
    const one = e.target.closest('[data-copy]');
    if (one) copyText(one.dataset.copy, 'link');
    const all = e.target.closest('[data-copy-all]');
    if (all) copyText(all.dataset.copyAll, 'tất cả link');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('#pMedia').classList.add('hidden');
  });

  for (const id of ['#pfStatus', '#pfStock', '#pfSort']) {
    $(id).onchange = () => { state.page = 1; render(); };
  }
  let t = null;
  $('#pfSearch').oninput = () => {
    clearTimeout(t);
    t = setTimeout(() => { state.page = 1; render(); }, 250);
  };

  $('#pChkAll').onchange = (e) => {
    const start = (state.page - 1) * PAGE_SIZE;
    filtered().slice(start, start + PAGE_SIZE).forEach((p) => {
      if (e.target.checked) state.selected.add(p.itemId);
      else state.selected.delete(p.itemId);
    });
    render();
  };
  $('#btnPSelectFiltered').onclick = () => {
    filtered().forEach((p) => state.selected.add(p.itemId));
    render();
  };
  $('#btnPClearSel').onclick = () => {
    state.selected.clear();
    $('#pChkAll').checked = false;
    render();
  };

  $('#pTable tbody').addEventListener('click', (e) => {
    const editStockBtn = e.target.closest('.btn-stock-edit') || e.target.closest('.stock-num');
    if (editStockBtn) {
      e.stopPropagation();
      const td = editStockBtn.closest('td[data-col="stock"]');
      if (!td || td.querySelector('.stock-inline-form')) return;

      const itemId = Number(td.dataset.itemId);
      const modelId = Number(td.dataset.modelId || 0);
      const currentStock = parseInt(td.dataset.stock, 10) || 0;
      const product = state.all.find((x) => x.itemId === itemId);
      const model = (product && product.models.find((x) => Number(x.modelId) === modelId)) || product?.models[0];
      // Kho đang nghỉ (vd "belllhome") không nhận tồn kho -> không hiện, không gửi lên Shopee
      const offIds = new Set((state.warehouses || []).filter((w) => w.in_holiday_mode).map((w) => String(w.location_id)));
      let locs = (model?.locationStocks && model.locationStocks.length > 0) ? model.locationStocks.filter((l) => !offIds.has(String(l.locationId))) : [];
      const activeWhs = (state.warehouses || []).filter((w) => !w.in_holiday_mode);
      if (locs.length === 0 && activeWhs.length > 1) {
        locs = activeWhs.map((w, idx) => ({
          locationId: w.location_id,
          warehouseName: w.warehouse_name,
          stock: idx === 0 ? currentStock : 0
        }));
      }
      const hasMultiWh = locs.length > 1;
      const hasMultipleModels = product && Array.isArray(product.models) && product.models.length > 1;

      const oldHtml = td.innerHTML;

      if (hasMultiWh) {
        td.innerHTML = `
          <div class="stock-inline-form" style="display:flex;flex-direction:column;gap:4px;padding:6px 8px;background:#f0f9ff;border:1.5px solid #0284c7;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);position:relative;z-index:20;min-width:135px;">
            <div style="font-size:10.5px;font-weight:700;color:#0369a1;border-bottom:1px solid #bae6fd;padding-bottom:2px;display:flex;justify-content:space-between;align-items:center;">
              <span>🏢 Tồn theo kho</span>
              <span style="font-size:9.5px;color:#64748b;font-weight:normal;">Tổng: <b class="wh-sum-stock">${currentStock}</b></span>
            </div>
            ${locs.map((loc) => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:11px;">
                <span style="color:#475569;font-weight:600;white-space:nowrap;font-size:10.5px;" title="${esc(loc.warehouseName)}">${esc(shortenWarehouseName(loc.warehouseName))}:</span>
                <input type="number" min="0" class="wh-stock-input" data-loc-id="${esc(loc.locationId)}" value="${loc.stock}" style="width:58px;height:20px;padding:0 3px;font-size:11.5px;font-weight:700;text-align:center;border:1px solid #cbd5e1;border-radius:3px;background:#fff;">
              </div>
            `).join('')}
            <div style="display:flex;gap:4px;margin-top:2px;justify-content:flex-end;">
              <button type="button" class="btn small primary btn-stock-save" style="height:22px;padding:0 8px;background:#16a34a;border-color:#16a34a;color:#fff;font-weight:700;font-size:11px;" title="Lưu lên Shopee">✔ Lưu</button>
              <button type="button" class="btn small btn-stock-cancel" style="height:22px;padding:0 6px;font-size:11px;" title="Hủy">✕</button>
            </div>
            ${hasMultipleModels ? `<label style="font-size:9.5px;color:#0369a1;display:inline-flex;align-items:center;gap:3px;cursor:pointer;margin-top:2px;"><input type="checkbox" class="chk-all-models" style="margin:0;"> Đổi cả SP</label>` : ''}
          </div>
        `;
      } else {
        td.innerHTML = `
          <div class="stock-inline-form" style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;padding:3px;background:#f0f9ff;border:1.5px solid #0284c7;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.15);position:relative;z-index:10;">
            <div style="display:inline-flex;align-items:center;gap:2px;">
              <input type="number" min="0" class="stock-inline-input" value="${currentStock}" style="width:58px;height:22px;padding:0 3px;font-size:12px;font-weight:700;text-align:center;border:1px solid #cbd5e1;border-radius:3px;outline:none;background:#fff;">
              <button type="button" class="btn small primary btn-stock-save" style="height:22px;line-height:20px;padding:0 6px;background:#16a34a;border-color:#16a34a;color:#fff;font-weight:700;font-size:11px;" title="Lưu lên Shopee">✔</button>
              <button type="button" class="btn small btn-stock-cancel" style="height:22px;line-height:20px;padding:0 4px;font-size:11px;" title="Hủy">✕</button>
            </div>
            ${hasMultipleModels ? `<label style="font-size:10px;color:#0369a1;display:inline-flex;align-items:center;gap:2px;cursor:pointer;margin:0;white-space:nowrap;"><input type="checkbox" class="chk-all-models" style="margin:0;transform:scale(0.85);"> Đổi cả SP</label>` : ''}
          </div>
        `;
      }

      const whInputs = td.querySelectorAll('.wh-stock-input');
      const sumEl = td.querySelector('.wh-sum-stock');
      if (whInputs.length && sumEl) {
        whInputs.forEach((inp) => {
          inp.oninput = () => {
            const sum = [...whInputs].reduce((a, x) => a + (parseInt(x.value, 10) || 0), 0);
            sumEl.textContent = sum;
          };
        });
      }

      const input = td.querySelector('.stock-inline-input') || td.querySelector('.wh-stock-input');
      const saveBtn = td.querySelector('.btn-stock-save');
      const cancelBtn = td.querySelector('.btn-stock-cancel');
      const chkAll = td.querySelector('.chk-all-models');

      if (input) {
        input.focus();
        input.select();
      }

      const cancelEdit = () => {
        td.innerHTML = oldHtml;
      };

      if (cancelBtn) cancelBtn.onclick = (ce) => { ce.stopPropagation(); cancelEdit(); };

      const doSave = async () => {
        const applyAll = !!(chkAll && chkAll.checked);

        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        td.querySelectorAll('input').forEach((i) => { i.disabled = true; });
        saveBtn.textContent = '⏳';

        try {
          if (hasMultiWh) {
            const newLocations = [...td.querySelectorAll('.wh-stock-input')].map((inp) => ({
              locationId: inp.dataset.locId,
              stock: Math.max(0, parseInt(inp.value, 10) || 0)
            }));
            const totalVal = newLocations.reduce((a, b) => a + b.stock, 0);

            const saved = await products.updateStock(itemId, modelId, newLocations, applyAll);

            if (product) {
              if (applyAll) {
                product.models.forEach((m) => {
                  m.locationStocks = newLocations.map((l) => ({ ...l }));
                  m.stock = totalVal;
                  m.locationStocksSynced = true;
                });
                product.stock = totalVal * product.models.length;
              } else if (model) {
                model.locationStocks = newLocations.map((l) => ({ ...l }));
                model.stock = totalVal;
                model.locationStocksSynced = true;
                product.stock = product.models.reduce((acc, x) => acc + (x.stock || 0), 0);
              }
              applySavedStock(product, saved, applyAll ? null : modelId, totalVal);
            }
            hooks.toast(saved && saved.changed === 0 ? 'Tồn kho không thay đổi – không cần lưu.' : `✔ Đã cập nhật tồn kho đa kho (${totalVal}) lên Shopee thành công!`, 'success');
          } else {
            const singleInp = td.querySelector('.stock-inline-input');
            const newVal = parseInt(singleInp ? singleInp.value : '0', 10);
            if (isNaN(newVal) || newVal < 0) {
              hooks.toast('Số lượng tồn kho phải là số >= 0', 'error');
              if (singleInp) singleInp.focus();
              return;
            }

            const saved = await products.updateStock(itemId, modelId, newVal, applyAll);

            if (product) {
              if (applyAll) {
                product.models.forEach((m) => {
                  m.stock = newVal;
                  m.locationStocksSynced = true;
                });
                product.stock = newVal * product.models.length;
              } else if (model) {
                model.stock = newVal;
                model.locationStocksSynced = true;
                product.stock = product.models.reduce((acc, x) => acc + (x.stock || 0), 0);
              }
              applySavedStock(product, saved, applyAll ? null : modelId, newVal);
            }
            hooks.toast(saved && saved.changed === 0 ? 'Tồn kho không thay đổi – không cần lưu.' : `✔ Đã cập nhật tồn kho thành ${newVal} trên Shopee thành công!`, 'success');
          }

          onProductStockUpdated(itemId);
        } catch (err) {
          console.error('Lỗi cập nhật tồn kho Shopee:', err);
          hooks.toast('Lỗi cập nhật Shopee: ' + err.message, 'error');
          saveBtn.disabled = false;
          cancelBtn.disabled = false;
          td.querySelectorAll('input').forEach((i) => { i.disabled = false; });
          saveBtn.textContent = '✔';
          if (input) input.focus();
        }
      };

      if (saveBtn) saveBtn.onclick = (se) => { se.stopPropagation(); doSave(); };

      input.onkeydown = (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          doSave();
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          cancelEdit();
        }
      };
      return;
    }

    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    if (e.target.matches('[data-sel]')) {
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      $('#pSelCount').textContent = state.selected.size;
    }
    const editBtn = e.target.closest('[data-open-edit]');
    if (editBtn) {
      const p = state.all.find((x) => Number(x.itemId) === Number(id));
      openProductEditModal(id, p, (savedId, updates) => {
        if (p) {
          if (updates.name) p.name = updates.name;
          if (updates.parent_sku !== undefined) p.sku = updates.parent_sku;
          if (Array.isArray(updates.model_list)) {
            updates.model_list.forEach((um) => {
              const m = p.models?.find((x) => Number(x.modelId) === Number(um.model_id));
              if (m) {
                if (um.normal_price !== undefined) m.price = um.normal_price;
                if (um.stock_setting_list?.[0]?.normal_stock !== undefined) {
                  m.stock = um.stock_setting_list[0].normal_stock;
                }
              }
            });
            p.stock = p.models?.reduce((acc, m) => acc + (m.stock || 0), 0);
          }
          persistProductsCache();
          refreshRows([p]);
          autoSyncProductToSpShopee(p);
        }
      });
      return;
    }
    const fillBtn = e.target.closest('[data-fill-sheet]');
    if (fillBtn) {
      fillSingleProductToSheet(id, fillBtn);
      return;
    }
    const fillWebSpBtn = e.target.closest('[data-fill-websp]');
    if (fillWebSpBtn) {
      fillSingleProductToWebSp(id, fillWebSpBtn);
      return;
    }
    const syncBtn = e.target.closest('[data-sync-item]');
    if (syncBtn) {
      const syncId = Number(syncBtn.dataset.syncItem || id);
      syncSingleProduct(syncId, syncBtn);
      return;
    }
    if (e.target.closest('[data-media]')) openMedia(id);
    if (e.target.closest('[data-expand]')) {
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      render();
    }
  });

  $('#pPager').onclick = (e) => {
    const b = e.target.closest('button[data-page]');
    if (!b) return;
    state.page = Number(b.dataset.page);
    render();
    $('#pTable').scrollIntoView({ behavior: 'smooth' });
  };

  $('#btnPToFs').onclick = () => {
    const list = selectedProducts().filter((p) => p.status === 1 && !p.unlisted);
    if (!list.length) return hooks.toast('Chưa chọn sản phẩm đang bán nào', 'error');
    hooks.onFlashSale(list);
  };

  const btnSp = $('#btnPToSpShopee');
  if (btnSp) btnSp.onclick = () => fillAllToSpShopee();
  const btnWebSp = $('#btnPToWebSp');
  if (btnWebSp) btnWebSp.onclick = () => fillAllToWebSp();
  const btnSpFull = $('#btnPToSpShopeeFull');
  if (btnSpFull) btnSpFull.onclick = () => fillAllToSpShopeeFull();
  initAutoSheetSync();

  const btnBatchStock = $('#btnPEditStockBatch');
  if (btnBatchStock) {
    btnBatchStock.onclick = async () => {
      const list = selectedProducts();
      if (!list.length) return hooks.toast('Vui lòng tích chọn ít nhất 1 sản phẩm để sửa tồn kho!', 'error');

      const input = prompt(`Nhập số lượng tồn kho mới cho ${list.length} sản phẩm đã chọn:\n(Tồn kho sẽ được cập nhật trực tiếp lên Kênh Người Bán Shopee.
Shop nhiều kho: số này ghi vào kho đầu tiên – Hà Nội, các kho khác giữ nguyên)`, '100');
      if (input === null) return;
      const newStock = parseInt(input.trim(), 10);
      if (isNaN(newStock) || newStock < 0) {
        return hooks.toast('Số lượng tồn kho không hợp lệ (phải >= 0)', 'error');
      }

      if (!confirm(`Xác nhận cập nhật tồn kho = ${newStock} cho toàn bộ ${list.length} sản phẩm đã chọn trên Shopee?`)) return;

      btnBatchStock.disabled = true;
      const oldText = btnBatchStock.textContent;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        btnBatchStock.textContent = `Đang cập nhật (${i + 1}/${list.length})...`;
        try {
          const res = await products.updateStock(p.itemId, 0, newStock, true);
          p.models.forEach((m) => { m.stock = newStock; m.locationStocksSynced = true; });
          p.stock = newStock * p.models.length;
          applySavedStock(p, res, null, newStock);
          autoSyncProductToSpShopee(p);
          successCount++;
        } catch (err) {
          console.warn(`Lỗi sửa tồn kho SP #${p.itemId}:`, err);
          failCount++;
        }
        await sleep(200);
      }

      persistProductsCache();
      btnBatchStock.disabled = false;
      btnBatchStock.textContent = oldText;
      render();
      hooks.toast(`Đã cập nhật tồn kho thành công cho ${successCount}/${list.length} sản phẩm trên Shopee${failCount ? ` (${failCount} lỗi)` : ''}!`, successCount ? 'success' : 'error');
    };
  }

  const btnSyncBatch = $('#btnPSyncBatch');
  if (btnSyncBatch) {
    btnSyncBatch.onclick = () => syncBatchProducts(false);
  }

  const sourceSelect = $('#sheetSourceSelect');
  if (sourceSelect) sourceSelect.onchange = () => loadSheetProducts(true);

  pTableCols = getTableConfig('pTable', P_TABLE_DEFAULT_COLS);
  applyTableStyles('pTable', pTableCols);
  renderPTableThead();

  const openPTableCustomizer = () => {
    openColumnCustomizerModal({
      tableId: 'pTable',
      tableName: 'Bảng Sản phẩm',
      defaultCols: P_TABLE_DEFAULT_COLS,
      currentConfig: pTableCols,
      onSave: (newCfg) => {
        pTableCols = newCfg;
        renderPTableThead();
        render();
      }
    });
  };

  const btnPCols = $('#btnPTableCols');
  if (btnPCols) btnPCols.onclick = openPTableCustomizer;

  const theadEl = $('#pTable thead');
  if (theadEl) {
    theadEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-cols]') || e.target.closest('.btn-th-config')) {
        e.stopPropagation();
        openPTableCustomizer();
      }
    });
  }

  for (const table of [$('#pTable'), $('#sheetPTable')]) {
    if (table) table.addEventListener('click', onSkuEditClick);
  }

  state.warehouses = await getShopWarehouses().catch(() => []);
  await loadCache();
  await loadMediaCache();
  render();
}
