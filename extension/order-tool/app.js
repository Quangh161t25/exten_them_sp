import { orders as api, getShopInfo, sleep } from './shopee-api.js';
import { parseOrder, flatten, parseIncome, INCOME_FIELDS } from './orders.js';
import { openShipDialog } from './ship-wameli.js';
import { openArrangeDialog } from './arrange.js';
import { getAllOrders, saveOrder, saveOrders, clearAllOrders } from './db.js';
import { getTableConfig, saveTableConfig, applyTableStyles, attachColumnResizers, openColumnCustomizerModal, tagAndReorderDOM } from './table-customizer.js';

const PAGE_SIZE = 50; // số đơn mỗi trang hiển thị

async function showDhSync() {
  const saved=await chrome.storage.local.get(['dh_sheet_enabled','dh_sheet_meta','dh_sheet_error']);
  document.querySelector('#dhSheetOn').checked=saved.dh_sheet_enabled!==false;
  const m=saved.dh_sheet_meta;
  document.querySelector('#dhSheetInfo').textContent=saved.dh_sheet_error || (m?`Gian ${m.code} · Đã quét ${m.seen}/${m.total} đơn · ${m.complete?'Đã quét hết danh sách Shopee':'Đang tải lịch sử'} · ${new Date(m.at).toLocaleString('vi-VN')} ${m.warning||''}`:'Mỗi phút tải một đợt đơn, không giới hạn theo ô Tối đa phía trên. Mã gian lấy từ Auto In.');
}
document.querySelector('#dhSheetOn').onchange=async e=>{await chrome.storage.local.set({dh_sheet_enabled:e.target.checked});};
document.querySelector('#dhSheetNow').onclick=async e=>{
  const b=e.currentTarget;b.disabled=true;
  document.querySelector('#dhSheetInfo').textContent='Đang tải đơn và ghi Sheet DH…';
  try{await chrome.storage.local.set({dh_sheet_enabled:true});await chrome.runtime.sendMessage({type:'dh-sync-sheet'});await showDhSync();}
  catch(err){document.querySelector('#dhSheetInfo').textContent=err.message;}finally{b.disabled=false;}
};
chrome.storage.onChanged.addListener(changes=>{if(changes.dh_sheet_meta||changes.dh_sheet_error)showDhSync();});
showDhSync();

// ---------- Tiện ích ----------
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number(n) || 0).toLocaleString('vi-VN') + '₫';
const fmtTime = (sec) => (sec ? new Date(sec * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-');

let toastTimer = null;
function toast(msg, type = 'info') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4500);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const today = () => new Date().toISOString().slice(0, 10);
// Ngày đặt: lấy từ mã đơn (YYMMDD), dự phòng bằng thời gian Shopee trả về
const orderDate = (o) => o.orderDate || (o.createTime ? new Date(o.createTime * 1000).toLocaleDateString('vi-VN') : '-');

// ---------- Trạng thái ----------
const state = {
  all: [], // đơn đã chuẩn hoá
  loading: false,
  stop: false,
  page: 1,
  tabLabel: '',
  picked: new Set(), // đơn được tích chọn (để in phiếu + tải lên Wameli)
  statusGroup: 'all', // lọc trạng thái kiểu Kênh Người Bán
  statusSub: 'all' // Chờ lấy hàng: all | unprocessed | processed
};

// ---------- Nhóm trạng thái (giống các tab trên Kênh Người Bán) ----------
const STATUS_GROUPS = [
  ['all', 'Tất cả'],
  ['unpaid', 'Chờ xác nhận'],
  ['toship', 'Chờ lấy hàng'],
  ['shipping', 'Đang giao'],
  ['completed', 'Đã giao'],
  ['return', 'Trả hàng/Hoàn tiền/Hủy']
];
const TOSHIP_SUBS = [['all', 'Tất cả'], ['unprocessed', 'Chưa xử lý'], ['processed', 'Đã xử lý']];

const normVi = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

// Phân nhóm theo chữ trạng thái Shopee trả về (VD "Chờ lấy hàng", "Đã giao cho ĐVVC", "Đã hủy")
function statusGroupOf(o) {
  const t = normVi(o.status);
  if (/huy|tra hang|hoan tien/.test(t)) return 'return';
  if (/cho xac nhan|cho thanh toan|chua thanh toan/.test(t)) return 'unpaid';
  if (/cho lay hang|chuan bi hang|cho giao hang/.test(t)) return 'toship';
  if (/dang giao|dang van chuyen|da giao cho (dvvc|don vi)|da ban giao/.test(t)) return 'shipping';
  if (/da giao|giao hang thanh cong|giao thanh cong|hoan thanh|da nhan/.test(t)) return 'completed';
  return 'other';
}

// Chờ lấy hàng: "Đã xử lý" = đã chuẩn bị hàng (đã có mã vận đơn)
const isProcessed = (o) => !!String(o.tracking || '').trim();

// ---------- Kết nối ----------
async function checkConnection() {
  const el = $('#connStatus');
  el.className = 'badge';
  el.textContent = 'Đang kết nối...';
  try {
    const info = await getShopInfo();
    el.className = 'badge ok';
    el.textContent = '✔ ' + (info.name || 'Đã kết nối');
  } catch (e) {
    el.className = 'badge err';
    el.textContent = '✖ ' + e.message;
  }
}

// ---------- Tải đơn ----------
function currentTab() {
  const v = $('#tabSelect').value;
  return v === 'custom' ? Number($('#tabCustom').value) : Number(v);
}

function updateSavedCount() {
  const el = $('#savedCount');
  if (el) el.textContent = state.all.length;
}

async function loadOrders() {
  if (state.loading) return;
  const tab = currentTab();
  if (!tab) return toast('Nhập mã trạng thái', 'error');
  const max = Number($('#maxOrders').value) || 10;
  const autoIncome = $('#autoIncome').checked;

  state.loading = true;
  state.stop = false;
  state.page = 1;
  state.tabLabel = $('#tabSelect').selectedOptions[0]?.textContent || '';
  $('#btnLoad').disabled = true;
  $('#btnStop').classList.remove('hidden');
  const progress = $('#progress');

  // Tập hợp các mã đơn đã lưu để bỏ qua, không tải lại
  const savedKeys = new Set();
  for (const o of state.all) {
    if (o.orderId) savedKeys.add(String(o.orderId));
    if (o.orderSn) savedKeys.add(String(o.orderSn));
  }

  let newLoaded = 0; // Đếm số đơn mới tải thêm trong lần này
  let total = 0;

  try {
    let sentinel = '';
    for (let page = 1; !state.stop && newLoaded < max; page++) {
      progress.textContent = `Đang quét trang ${page} (đã tìm được ${newLoaded}/${max} đơn mới)...`;
      const res = await api.listIndex({ tab, page, pageSize: 40, sentinel });
      total = res.total || total;
      if (!res.index || !res.index.length) break;

      // Lọc các item trong index chưa có trong danh sách đã lưu
      const neededIndex = [];
      for (const item of res.index) {
        const id = item ? String(item.order_id ?? item.orderId ?? item.order_sn ?? item.orderSn ?? '') : '';
        if (id && savedKeys.has(id)) {
          continue; // Đơn đã có trong máy, bỏ qua
        }
        neededIndex.push(item);
      }

      // Giới hạn số đơn cần lấy thêm ở trang này (đủ max thì dừng)
      const toFetch = neededIndex.slice(0, max - newLoaded);

      // Lấy chi tiết từng nhóm 5 đơn
      for (let i = 0; i < toFetch.length && !state.stop && newLoaded < max; i += 5) {
        const chunk = toFetch.slice(i, Math.min(i + 5, toFetch.length, i + (max - newLoaded)));
        const cards = await api.cards({ tab, index: chunk });
        for (const c of cards) {
          if (newLoaded >= max || state.stop) break;
          const o = parseOrder(c);
          if (!o.status) o.status = tab !== 100 ? state.tabLabel : (o.statusCode !== '' ? `Mã trạng thái ${o.statusCode}` : '');
          // Giữ mã chỉ mục + tab để sau này "Load lại" đúng đơn này
          o.indexItem = chunk.find((it) => String(it?.order_id ?? '') === String(o.orderId)) || null;
          o.loadTab = tab;
          const k1 = o.orderId ? String(o.orderId) : '';
          const k2 = o.orderSn ? String(o.orderSn) : '';
          if ((k1 && savedKeys.has(k1)) || (k2 && savedKeys.has(k2))) {
            continue; // Đã lưu
          }
          if (k1) savedKeys.add(k1);
          if (k2) savedKeys.add(k2);

          if (autoIncome && o.orderId) {
            progress.textContent = `Đã tải ${newLoaded + 1}/${max} đơn mới – đang lấy doanh thu...`;
            try { await loadIncome(o); } catch (e) { o.incomeError = e.message; }
            await sleep(150);
          }

          // Lưu đơn vào IndexedDB
          await saveOrder(o);

          // Thêm vào danh sách bộ nhớ (đầu mảng để ưu tiên hiển thị)
          state.all.unshift(o);
          newLoaded++;
          updateSavedCount();
        }
        render();
        progress.textContent = `Đã tải ${newLoaded}/${max} đơn mới...`;
        await sleep(250);
      }

      // Nếu đã đủ số lượng đơn cần lấy
      if (newLoaded >= max) break;

      // Trang cuối cùng nếu Shopee trả ít hơn 40 đơn
      if (res.index.length < 40) break;

      // Dừng khi đã quét hết tổng số đơn Shopee trả về
      if (total && page * 40 >= total) break;
      if (!res.sentinel && page * 40 >= (total || 40)) break;

      sentinel = res.sentinel;
      await sleep(400);
    }

    if (state.stop) {
      progress.textContent = `Đã dừng – tải & lưu được ${newLoaded} đơn mới (tổng: ${state.all.length} đơn trong bộ nhớ máy)`;
      toast(`Đã dừng. Lấy thêm được ${newLoaded} đơn mới`, 'info');
    } else if (newLoaded === 0) {
      progress.textContent = `Tất cả đơn đã có trong bộ nhớ máy (tổng: ${state.all.length} đơn).`;
      toast('Tất cả các đơn đã có sẵn trong bộ nhớ máy (không có đơn mới)', 'info');
    } else {
      progress.textContent = `Đã tải & lưu thêm ${newLoaded} đơn mới vào bộ nhớ máy (tổng lưu: ${state.all.length} đơn)`;
      toast(`Đã tải & lưu ${newLoaded} đơn mới vào bộ nhớ máy thành công`, 'success');
    }
  } catch (e) {
    progress.textContent = '';
    toast('Lỗi tải đơn: ' + e.message, 'error');
    if (e.response) console.warn('Phản hồi Shopee:', e.response);
  } finally {
    state.loading = false;
    $('#btnLoad').disabled = false;
    $('#btnStop').classList.add('hidden');
    updateSavedCount();
    render();
  }
}

// ---------- Lọc ----------
// Lọc theo tìm kiếm + ngày (chưa lọc trạng thái) — dùng để đếm số đơn mỗi tab trạng thái
function baseFiltered() {
  const q = $('#fSearch').value.trim().toLowerCase();
  const from = $('#fFrom').value ? new Date($('#fFrom').value + 'T00:00:00').getTime() / 1000 : 0;
  const to = $('#fTo').value ? new Date($('#fTo').value + 'T23:59:59').getTime() / 1000 : 0;
  let list = state.all.filter((o) => {
    if (from && o.createTime && o.createTime < from) return false;
    if (to && o.createTime && o.createTime > to) return false;
    if (q) {
      const hay = [o.orderSn, o.orderId, o.buyer, o.tracking, o.status,
        ...o.items.map((i) => `${i.name} ${i.model} ${i.sku}`)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return list;
}

function filtered() {
  const list = baseFiltered().filter((o) => {
    if (state.statusGroup === 'all') return true;
    if (statusGroupOf(o) !== state.statusGroup) return false;
    if (state.statusGroup === 'toship' && state.statusSub !== 'all') {
      return state.statusSub === 'processed' ? isProcessed(o) : !isProcessed(o);
    }
    return true;
  });
  const sorters = {
    newest: (a, b) => b.createTime - a.createTime,
    oldest: (a, b) => a.createTime - b.createTime,
    totalDesc: (a, b) => b.total - a.total,
    totalAsc: (a, b) => a.total - b.total
  };
  return list.slice().sort(sorters[$('#fSort').value] || sorters.newest);
}

// ---------- Hiển thị ----------
function renderSummary(list) {
  const box = $('#summary');
  if (!state.all.length) {
    box.classList.add('hidden');
    return;
  }
  const revenue = list.reduce((s, o) => s + o.total, 0);
  const qty = list.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const buyers = new Set(list.map((o) => o.buyer).filter(Boolean)).size;
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="stat"><div class="v">${list.length}</div><div class="l">Đơn${state.tabLabel ? ` (${esc(state.tabLabel)})` : ''}</div></div>
    <div class="stat"><div class="v">${money(revenue)}</div><div class="l">Tổng tiền đơn</div></div>
    <div class="stat"><div class="v">${qty}</div><div class="l">Sản phẩm đã bán</div></div>
    <div class="stat"><div class="v">${list.length ? money(Math.round(revenue / list.length)) : '-'}</div><div class="l">Giá trị TB / đơn</div></div>
    <div class="stat"><div class="v">${buyers}</div><div class="l">Người mua</div></div>${incomeStats(list)}`;
}

// Thống kê doanh thu cho các đơn đã tải thông tin thanh toán
function incomeStats(list) {
  const withIncome = list.filter((o) => o.income && o.income.escrow !== null);
  if (!withIncome.length) return '';
  const sum = (f) => withIncome.reduce((s, o) => s + (o.income.byField[f] || 0), 0);
  const note = withIncome.length < list.length ? ` (${withIncome.length}/${list.length} đơn đã tải)` : '';
  return `
    <div class="stat income"><div class="v">${money(sum('ESCROW_AMOUNT'))}</div><div class="l">Doanh thu ước tính${note}</div></div>
    <div class="stat"><div class="v">${money(sum('FEES_AND_CHARGES'))}</div><div class="l">Tổng phụ phí${note}</div></div>
    <div class="stat"><div class="v">${money(sum('TAX_SUBTOTAL'))}</div><div class="l">Tổng thuế${note}</div></div>`;
}

const copyBtn = (text) => (text ? ` <button class="btn tiny" data-copy="${esc(text)}" title="Copy">C</button>` : '');
const orderKey = (o) => String(o.storageKey || o.orderId || o.orderSn || '');

// Các cột doanh thu hiển thị trong bảng (theo field_name của Shopee)
const INCOME_TABLE = [
  ['MERCHANDISE_SUBTOTAL', 'Tổng tiền SP'],
  ['SHIPPING_FEE_PAID_BY_BUYER', 'Phí VC người mua trả'],
  ['ACTUAL_SHIPPING_FEE', 'Phí VC ước tính'],
  ['SHIPPING_REBATE_FROM_SHOPEE', 'Shopee trợ giá VC'],
  ['COMMISSION_FEE', 'Phí cố định'],
  ['SERVICE_FEE', 'Phí dịch vụ'],
  ['TRANSACTION_FEE', 'Phí xử lý GD'],
  ['VAT_WHT_AMOUNT', 'Thuế GTGT'],
  ['PIT_WHT_AMOUNT', 'Thuế TNCN'],
  ['ESCROW_AMOUNT', 'Doanh thu ước tính']
];

const DEFAULT_ORDER_COLS = [
  { id: 'col_pick', label: 'Chọn', defaultWidth: 42, defaultAlign: 'center', defaultFixed: true },
  { id: 'col_order_sn', label: 'Mã đơn', defaultWidth: 155, defaultAlign: 'left', defaultFixed: true },
  { id: 'col_order_date', label: 'Ngày đặt', defaultWidth: 125, defaultAlign: 'center' },
  { id: 'col_buyer', label: 'Người mua', defaultWidth: 110, defaultAlign: 'left' },
  { id: 'col_status', label: 'Trạng thái', defaultWidth: 130, defaultAlign: 'left' },
  { id: 'col_product_name', label: 'Sản phẩm', defaultWidth: 260, defaultAlign: 'left', defaultWrap: true },
  { id: 'col_variation', label: 'Phân loại', defaultWidth: 120, defaultAlign: 'left' },
  { id: 'col_item_sku', label: 'SKU sản phẩm', defaultWidth: 110, defaultAlign: 'left' },
  { id: 'col_model_sku', label: 'SKU phân loại', defaultWidth: 110, defaultAlign: 'left' },
  { id: 'col_qty', label: 'SL', defaultWidth: 50, defaultAlign: 'right' },
  { id: 'col_price', label: 'Đơn giá', defaultWidth: 95, defaultAlign: 'right' },
  { id: 'col_total', label: 'Tổng đơn', defaultWidth: 105, defaultAlign: 'right' },
  { id: 'col_income_merchandise_subtotal', label: 'Tổng tiền SP', defaultWidth: 100, defaultAlign: 'right' },
  { id: 'col_income_shipping_fee_paid_by_buyer', label: 'Phí VC người mua trả', defaultWidth: 100, defaultAlign: 'right' },
  { id: 'col_income_actual_shipping_fee', label: 'Phí VC ước tính', defaultWidth: 100, defaultAlign: 'right' },
  { id: 'col_income_shipping_rebate_from_shopee', label: 'Shopee trợ giá VC', defaultWidth: 100, defaultAlign: 'right' },
  { id: 'col_income_commission_fee', label: 'Phí cố định', defaultWidth: 90, defaultAlign: 'right' },
  { id: 'col_income_service_fee', label: 'Phí dịch vụ', defaultWidth: 90, defaultAlign: 'right' },
  { id: 'col_income_transaction_fee', label: 'Phí xử lý GD', defaultWidth: 90, defaultAlign: 'right' },
  { id: 'col_income_vat_wht_amount', label: 'Thuế GTGT', defaultWidth: 90, defaultAlign: 'right' },
  { id: 'col_income_pit_wht_amount', label: 'Thuế TNCN', defaultWidth: 90, defaultAlign: 'right' },
  { id: 'col_income_escrow_amount', label: 'Doanh thu ước tính', defaultWidth: 115, defaultAlign: 'right' },
  { id: 'col_payment', label: 'Thanh toán', defaultWidth: 110, defaultAlign: 'left' },
  { id: 'col_shipping', label: 'Vận chuyển', defaultWidth: 140, defaultAlign: 'left' },
  { id: 'col_tracking', label: 'Mã vận đơn', defaultWidth: 140, defaultAlign: 'left' },
  { id: 'col_ship_by', label: 'Hạn giao', defaultWidth: 120, defaultAlign: 'center' },
  { id: 'col_note', label: 'Ghi chú', defaultWidth: 120, defaultAlign: 'left' },
  { id: 'col_actions', label: 'Thao tác', defaultWidth: 115, defaultAlign: 'center' }
];

function openOrderTableCustomizer() {
  const currentConfig = getTableConfig('orderTable', DEFAULT_ORDER_COLS);
  openColumnCustomizerModal({
    tableId: 'orderTable',
    tableName: 'Đơn Shopee',
    defaultCols: DEFAULT_ORDER_COLS,
    currentConfig,
    onSave: (newCfg) => {
      saveTableConfig('orderTable', newCfg);
      render();
    }
  });
}

function incomeCells(o, rs) {
  if (!o.income) {
    const first = o.incomeError
      ? `<span class="err small" title="${esc(o.incomeError)}">Lỗi</span> <button class="btn tiny" data-income="${esc(orderKey(o))}">Thử lại</button>`
      : `<button class="btn tiny" data-income="${esc(orderKey(o))}" title="Tải doanh thu đơn này">Tải</button>`;
    return `<td ${rs} class="nowrap" data-col="col_income_${INCOME_TABLE[0][0].toLowerCase()}">${first}</td>` +
      INCOME_TABLE.slice(1).map(([field]) => `<td ${rs} class="muted" data-col="col_income_${field.toLowerCase()}">—</td>`).join('');
  }
  const f = o.income.byField;
  return INCOME_TABLE.map(([field]) => {
    const v = f[field];
    const cls = field === 'ESCROW_AMOUNT' ? 'money income' : 'money' + (v < 0 ? ' neg' : '');
    const text = v === null || v === undefined ? '' : money(v);
    return `<td ${rs} class="${cls}" data-col="col_income_${field.toLowerCase()}">${field === 'ESCROW_AMOUNT' ? `<b>${text}</b>` : text}</td>`;
  }).join('');
}

function orderRows(o) {
  const items = o.items.length ? o.items : [{ name: '(không đọc được sản phẩm – xem Chi tiết)', model: '', itemSku: '', modelSku: '', qty: '', price: 0, image: '' }];
  const rs = `rowspan="${items.length}"`;
  return items.map((it, i) => {
    const itemCells = `
      <td data-col="col_product_name">${esc(it.name || '(chưa có tên sản phẩm)')}${copyBtn(it.name)}</td>
      <td data-col="col_variation">${esc(it.model)}${copyBtn(it.model)}</td>
      <td class="sku" data-col="col_item_sku">${esc(it.itemSku)}${copyBtn(it.itemSku)}</td>
      <td class="sku" data-col="col_model_sku">${esc(it.modelSku)}${copyBtn(it.modelSku)}</td>
      <td data-col="col_qty">${esc(it.qty)}</td>
      <td class="money" data-col="col_price">${it.price ? money(it.price) : ''}</td>`;
    if (i > 0) return `<tr>${itemCells}</tr>`;
    return `<tr class="first">
      <td ${rs} data-col="col_pick"><input type="checkbox" data-pick="${esc(orderKey(o))}" ${state.picked.has(orderKey(o)) ? 'checked' : ''}></td>
      <td ${rs} class="nowrap sticky" data-col="col_order_sn"><b>${esc(o.orderSn || o.orderId)}</b>${copyBtn(o.orderSn)}</td>
      <td ${rs} class="nowrap" data-col="col_order_date">${orderDate(o)}</td>
      <td ${rs} data-col="col_buyer">${esc(o.buyer)}</td>
      <td ${rs} data-col="col_status">${esc(o.status)}${o.statusNote ? `<div class="muted small">${esc(o.statusNote)}</div>` : ''}</td>
      ${itemCells}
      <td ${rs} class="money" data-col="col_total"><b>${o.total ? money(o.total) : ''}</b></td>
      ${incomeCells(o, rs)}
      <td ${rs} data-col="col_payment">${esc(o.payment)}</td>
      <td ${rs} data-col="col_shipping">${esc(o.shippingType)}${o.shippingType && o.shipping ? '<br>' : ''}${esc(o.shipping)}</td>
      <td ${rs} class="nowrap" data-col="col_tracking"><b>${esc(o.tracking)}</b>${copyBtn(o.tracking)}</td>
      <td ${rs} class="nowrap" data-col="col_ship_by">${o.shipBy ? fmtTime(o.shipBy) : ''}</td>
      <td ${rs} data-col="col_note">${esc(o.note)}</td>
      <td ${rs} class="nowrap" data-col="col_actions"><button class="btn small" data-reload="${esc(orderKey(o))}" title="Tải lại trạng thái, chi tiết, doanh thu mới nhất">🔄</button>
        <button class="btn small" data-detail="${esc(orderKey(o))}">Chi tiết${o.detail ? ' ✔' : ''}</button>
        ${o.orderId ? `<a class="btn small" target="_blank" href="https://banhang.shopee.vn/portal/sale/order/${esc(o.orderId)}" title="Mở đơn trên Kênh Người Bán">Mở đơn</a>` : ''}</td>
      <td style="width:32px;min-width:32px;max-width:32px;padding:0;"></td>
    </tr>`;
  }).join('');
}

function renderStatusTabs() {
  const base = baseFiltered();
  const counts = { all: base.length };
  for (const o of base) counts[statusGroupOf(o)] = (counts[statusGroupOf(o)] || 0) + 1;
  $('#statusTabs').innerHTML = STATUS_GROUPS.map(([k, label]) =>
    `<button class="status-tab${state.statusGroup === k ? ' active' : ''}" data-group="${k}">${label}${k === 'all' ? '' : ` (${counts[k] || 0})`}</button>`
  ).join('') + (counts.other ? `<span class="muted small" style="align-self:center" title="Trạng thái chưa nhận diện được">Khác: ${counts.other}</span>` : '');

  const sub = $('#statusSub');
  sub.classList.toggle('hidden', state.statusGroup !== 'toship');
  if (state.statusGroup === 'toship') {
    const toship = base.filter((o) => statusGroupOf(o) === 'toship');
    const subCount = { all: toship.length, processed: toship.filter(isProcessed).length };
    subCount.unprocessed = subCount.all - subCount.processed;
    sub.innerHTML = '<span class="muted">Trạng thái đơn hàng</span>' + TOSHIP_SUBS.map(([k, label]) =>
      `<button class="pill${state.statusSub === k ? ' active' : ''}" data-sub="${k}">${label}${k === 'all' ? '' : ` (${subCount[k]})`}</button>`
    ).join('');
  }
}

function render() {
  renderStatusTabs();
  const list = filtered();
  renderSummary(list);
  $('#matchCount').textContent = list.length;
  updatePicked();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const rows = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  $('#orderTable tbody').innerHTML = rows.length
    ? rows.map(orderRows).join('')
    : `<tr><td colspan="29" class="muted">${state.all.length ? 'Không có đơn khớp bộ lọc.' : 'Chọn trạng thái rồi bấm "Tải đơn hàng".'}</td></tr>`;
  $('#pager').innerHTML = pages > 1
    ? `<button class="btn small" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹ Trước</button>
       <span>Trang ${state.page}/${pages}</span>
       <button class="btn small" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>Sau ›</button>`
    : '';

  const config = getTableConfig('orderTable', DEFAULT_ORDER_COLS);
  applyTableStyles('orderTable', config);
  tagAndReorderDOM('orderTable', config);
  const gear = $('#orderTable thead .th-settings-gear');
  if (gear) gear.onclick = openOrderTableCustomizer;
  if ($('#btnColCustomOrder')) $('#btnColCustomOrder').onclick = openOrderTableCustomizer;
}

// ---------- Chọn đơn ----------
function updatePicked() {
  $('#pickCount').textContent = state.picked.size;
  $('#btnShip').disabled = !state.picked.size;
  $('#btnArrange').disabled = !state.picked.size;
  $('#pickCount2').textContent = state.picked.size;
  $('#pickCount3').textContent = state.picked.size;
  $('#btnReloadPicked').disabled = !state.picked.size || state.loading;
}

// ---------- Chi tiết đơn ----------
let modalJson = '';

// Tải chi tiết đầy đủ của 1 đơn rồi đọc lại (ưu tiên dữ liệu chi tiết).
async function loadDetail(o) {
  if (o.detail) return o;
  if (!o.orderId) throw new Error('Đơn không có ID để tải chi tiết');
  const detail = await api.getOne(o.orderId);
  const updated = parseOrder(o.raw, detail || {});
  updated.income = o.income;
  updated.incomeRaw = o.incomeRaw;
  const idx = state.all.indexOf(o);
  if (idx !== -1) state.all[idx] = updated;
  await saveOrder(updated);
  return updated;
}

// Tải thông tin thanh toán / doanh thu của 1 đơn (sửa trực tiếp trên đơn).
async function loadIncome(o) {
  if (o.income || !o.orderId) return o;
  let data;
  try {
    data = await api.income(o.orderId);
  } catch (e) {
    // Giữ lại phản hồi để xem trong "Chi tiết" và báo lỗi ở cột doanh thu
    o.incomeRaw = e.response || null;
    o.incomeError = e.message;
    await saveOrder(o);
    throw e;
  }
  o.incomeRaw = data;
  o.incomeError = '';
  o.income = parseIncome(data);
  await saveOrder(o);
  return o;
}

function incomeSection(o) {
  if (!o.income) return o.incomeError ? `<div class="section-title">Thông tin thanh toán</div><div class="err">Không lấy được: ${esc(o.incomeError)}</div>` : '';
  return `<div class="section-title">Thông tin thanh toán</div>
    <table class="kv income-table">${o.income.rows.map((r) => `
      <tr class="lvl${r.level}"><td>${esc(r.name)}${r.caption ? `<div class="muted small">${esc(r.caption.replace(/<[^>]+>/g, ''))}</div>` : ''}
        ${r.details.map((d) => `<div class="muted small">• ${esc(d.name || 'Chi tiết')}${d.rate ? ` (${d.rate}%)` : ''}${d.amount ? ': ' + money(d.amount) : ''}</div>`).join('')}</td>
        <td class="money">${r.amount === null ? '***' : money(r.amount)}</td></tr>`).join('')}
    </table>`;
}

function renderDetail(o, error = '') {
  const data = { card: o.raw, ...(o.detail ? { detail: o.detail } : {}), ...(o.incomeRaw ? { income: o.incomeRaw } : {}) };
  modalJson = JSON.stringify(data, null, 2);
  const flat = flatten(data);
  const summary = [
    ['Mã đơn', o.orderSn], ['ID đơn', o.orderId], ['Ngày đặt', orderDate(o)], ['Người mua', o.buyer],
    ['ID người mua', o.buyerId], ['Trạng thái', [o.status, o.statusNote].filter(Boolean).join(' – ')],
    ['Tổng tiền', o.total ? money(o.total) : ''], ['Thanh toán', o.payment],
    ['Vận chuyển', [o.shippingType, o.shipping].filter(Boolean).join(' · ')], ['Mã vận đơn', o.tracking],
    ['Hạn giao / lấy hàng', o.shipBy ? fmtTime(o.shipBy) : ''], ['Địa chỉ', o.address],
    ['Phí vận chuyển', o.shippingFee ? money(o.shippingFee) : ''], ['Tiền về shop', o.escrow ? money(o.escrow) : ''],
    ['Ghi chú', o.note]
  ].filter(([, v]) => v !== '' && v !== undefined);
  $('#modalTitle').textContent = `Đơn ${o.orderSn || o.orderId}`;
  $('#modalBody').innerHTML = `
    ${error ? `<div style="color:var(--err)">Không tải được chi tiết đầy đủ: ${esc(error)}. Đang hiển thị dữ liệu từ danh sách đơn.</div>` : ''}
    ${!o.detail && !error ? '<div class="muted">Đang tải chi tiết đầy đủ...</div>' : ''}
    <div class="section-title">Tóm tắt</div>
    <table class="kv">${summary.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}${copyBtn(String(v))}</td></tr>`).join('')}</table>
    <div class="section-title">Sản phẩm (${o.items.length})</div>
    <table class="grid">
      <thead><tr><th>Sản phẩm</th><th>Phân loại</th><th>SKU sản phẩm</th><th>SKU phân loại</th><th>SL</th><th>Đơn giá</th></tr></thead>
      <tbody>${o.items.map((i) => `<tr>
        <td><div class="prod">${i.image ? `<img src="${esc(i.image)}">` : ''}<span>${esc(i.name)}${copyBtn(i.name)}</span></div></td>
        <td>${esc(i.model)}${copyBtn(i.model)}</td>
        <td class="sku">${esc(i.itemSku)}${copyBtn(i.itemSku)}</td>
        <td class="sku">${esc(i.modelSku)}${copyBtn(i.modelSku)}</td>
        <td>${i.qty}</td><td class="money">${money(i.price)}</td></tr>`).join('')}</tbody>
    </table>
    ${incomeSection(o)}
    <div class="section-title">Toàn bộ dữ liệu (${Object.keys(flat).length} trường)</div>
    <table class="kv">${Object.entries(flat).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
}

async function openDetail(id) {
  let o = state.all.find((x) => orderKey(x) === id);
  if (!o) return;
  $('#modal').classList.remove('hidden');
  renderDetail(o);
  let error = '';
  if (!o.income) {
    try { await loadIncome(o); } catch (e) { error = 'doanh thu: ' + e.message; }
  }
  if (!o.detail) {
    try { o = await loadDetail(o); } catch (e) {
      error = [error, e.message].filter(Boolean).join(' · ');
      if (e.response) console.warn('Phản hồi Shopee:', e.response);
    }
  }
  renderDetail(o, error);
  render();
}

// ---------- Load lại đơn (lấy trạng thái / chi tiết / doanh thu mới nhất) ----------
// Mã chỉ mục: dùng mã đã lưu khi tải đơn; đơn lưu từ bản cũ thì dựng từ order_id.
const indexParamOf = (o) => o.indexItem || { order_id: Number(o.orderId) };

async function refreshOrders(list) {
  const todo = list.filter((o) => o.orderId);
  const statusFail = [];
  let fail = 0;
  for (let i = 0; i < todo.length && !state.stop; i += 5) {
    const chunk = todo.slice(i, i + 5);
    $('#progress').textContent = `Đang load lại ${Math.min(i + 5, todo.length)}/${todo.length} đơn...`;
    // 1. Card mới (trạng thái, mã vận đơn, kiện hàng) — gọi theo tab đã dùng khi tải đơn
    const fresh = new Map();
    const byTab = new Map();
    for (const o of chunk) {
      const tab = o.loadTab || 100;
      if (!byTab.has(tab)) byTab.set(tab, []);
      byTab.get(tab).push(o);
    }
    for (const [tab, group] of byTab) {
      try {
        const cards = await api.cards({ tab, index: group.map(indexParamOf) });
        for (const c of cards) {
          const id = parseOrder(c).orderId;
          if (id) fresh.set(id, c);
        }
      } catch (e) {
        if (e.response) console.warn('Load lại card lỗi:', e.response);
      }
    }
    // 2. Chi tiết + doanh thu mới, thay bản cũ (giữ khoá lưu)
    for (const old of chunk) {
      try {
        const card = fresh.get(String(old.orderId));
        if (!card) statusFail.push(old.orderSn || old.orderId);
        let detail = null;
        try { detail = await api.getOne(old.orderId); } catch (e) { detail = old.detail || null; }
        const updated = parseOrder(card || old.raw, detail);
        if (!updated.status) updated.status = old.status;
        if (!card) updated.statusNote = old.statusNote;
        Object.assign(updated, {
          storageKey: old.storageKey, savedAt: old.savedAt, indexItem: old.indexItem || null, loadTab: old.loadTab || 100,
          income: null, incomeRaw: null, incomeError: ''
        });
        try { await loadIncome(updated); } catch (e) { /* lỗi đã ghi vào updated.incomeError */ }
        const idx = state.all.indexOf(old);
        if (idx !== -1) state.all[idx] = updated;
        await saveOrder(updated);
      } catch (e) {
        fail++;
      }
      await sleep(250);
    }
    render();
  }
  $('#progress').textContent = '';
  return { total: todo.length, fail, statusFail };
}

// ---------- Tự động cập nhật (khi trang đang mở) ----------
// 1. Thêm đơn mới trong SYNC_DAYS ngày gần nhất chưa có trong máy (quét tab "Tất cả", mới nhất trước).
// 2. Load lại trạng thái các đơn chưa hoàn tất (không phải Đã giao / Hủy / Trả hàng).
const SYNC_DAYS = 2;
const SYNC_MAX_PAGES = 10; // tối đa 400 đơn mỗi lần quét
const SYNC_REFRESH_LIMIT = 40; // tối đa số đơn load lại trạng thái mỗi lần
const AUTO_SYNC_KEY = 'orderAutoSync'; // { enabled, minutes, lastAt, lastMsg }
let autoSyncTimer = null;
const syncSkippedOld = new Set(); // đơn ngoài khoảng ngày đã kiểm tra trong phiên này: không tải lại card

async function syncNewOrders() {
  // Ngày đặt lấy từ mã đơn (0 giờ của ngày đó) nên cắt từ 0 giờ của SYNC_DAYS ngày trước
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - SYNC_DAYS);
  const cutoff = Math.floor(start.getTime() / 1000);
  const tab = 100;
  const savedKeys = new Set(state.all.flatMap((o) => [o.orderId, o.orderSn].filter(Boolean).map(String)));
  const savedById = new Map(state.all.map((o) => [String(o.orderId), o]));
  const autoIncome = $('#autoIncome').checked;
  let added = 0;
  let sentinel = '';
  let reachedOld = false;

  for (let page = 1; page <= SYNC_MAX_PAGES && !reachedOld && !state.stop; page++) {
    $('#progress').textContent = `Tự động: quét đơn mới trang ${page}...`;
    const res = await api.listIndex({ tab, page, pageSize: 40, sentinel });
    if (!res.index || !res.index.length) break;

    const unsaved = [];
    for (const item of res.index) {
      const id = String(item?.order_id ?? '');
      const saved = savedById.get(id);
      if (saved) {
        if (saved.createTime && saved.createTime < cutoff) reachedOld = true;
        continue;
      }
      if (id && (savedKeys.has(id) || syncSkippedOld.has(id))) {
        if (syncSkippedOld.has(id)) reachedOld = true;
        continue;
      }
      unsaved.push(item);
    }

    for (let i = 0; i < unsaved.length && !state.stop; i += 5) {
      const chunk = unsaved.slice(i, i + 5);
      const cards = await api.cards({ tab, index: chunk });
      for (const c of cards) {
        const o = parseOrder(c);
        if (!o.status) o.status = o.statusCode !== '' ? `Mã trạng thái ${o.statusCode}` : '';
        if (o.createTime && o.createTime < cutoff) {
          reachedOld = true;
          if (o.orderId) syncSkippedOld.add(String(o.orderId));
          continue;
        }
        const k1 = String(o.orderId || '');
        const k2 = String(o.orderSn || '');
        if ((k1 && savedKeys.has(k1)) || (k2 && savedKeys.has(k2))) continue;
        if (k1) savedKeys.add(k1);
        if (k2) savedKeys.add(k2);
        o.indexItem = chunk.find((it) => String(it?.order_id ?? '') === k1) || null;
        o.loadTab = tab;
        if (autoIncome && o.orderId) {
          try { await loadIncome(o); } catch (e) { o.incomeError = e.message; }
          await sleep(150);
        }
        await saveOrder(o);
        state.all.unshift(o);
        added++;
      }
      await sleep(250);
    }
    updateSavedCount();
    render();

    if (res.index.length < 40) break;
    if (res.total && page * 40 >= res.total) break;
    sentinel = res.sentinel;
    await sleep(400);
  }
  return added;
}

async function runAutoSync() {
  if (state.loading) return; // đang tải / load lại thủ công: để lần sau
  state.loading = true;
  state.stop = false;
  $('#btnSyncNow').disabled = true;
  $('#btnStop').classList.remove('hidden');
  let msg = '';
  try {
    const added = await syncNewOrders();
    const pending = state.all
      .filter((o) => o.orderId && !['completed', 'return'].includes(statusGroupOf(o)))
      .sort((a, b) => (b.createTime || 0) - (a.createTime || 0))
      .slice(0, SYNC_REFRESH_LIMIT);
    let refreshed = 0;
    if (pending.length && !state.stop) {
      const r = await refreshOrders(pending);
      refreshed = r.total - r.fail;
    }
    msg = `+${added} đơn mới · cập nhật ${refreshed} đơn`;
  } catch (e) {
    msg = 'Lỗi: ' + e.message;
  } finally {
    state.loading = false;
    $('#btnSyncNow').disabled = false;
    $('#btnStop').classList.add('hidden');
    $('#progress').textContent = '';
    render();
  }
  const prefs = await getAutoSyncPrefs();
  await chrome.storage.local.set({ [AUTO_SYNC_KEY]: { ...prefs, lastAt: Date.now(), lastMsg: msg } });
  showAutoSyncInfo({ ...prefs, lastAt: Date.now(), lastMsg: msg });
}

async function getAutoSyncPrefs() {
  const { [AUTO_SYNC_KEY]: p } = await chrome.storage.local.get(AUTO_SYNC_KEY);
  return { enabled: true, minutes: 10, ...(p || {}) };
}

function showAutoSyncInfo(p) {
  const last = p.lastAt ? `Lần cuối ${new Date(p.lastAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}: ${p.lastMsg || ''}` : '';
  $('#autoSyncInfo').textContent = [p.enabled ? `Đang bật (${SYNC_DAYS} ngày gần nhất)` : 'Đang tắt', last].filter(Boolean).join(' · ');
}

function scheduleAutoSync(p) {
  clearInterval(autoSyncTimer);
  autoSyncTimer = null;
  if (p.enabled) autoSyncTimer = setInterval(runAutoSync, Math.max(5, Number(p.minutes) || 10) * 60000);
  showAutoSyncInfo(p);
}

async function initAutoSync() {
  const p = await getAutoSyncPrefs();
  $('#autoSyncOn').checked = !!p.enabled;
  $('#autoSyncMin').value = String(p.minutes);
  const onChange = async () => {
    const next = { ...(await getAutoSyncPrefs()), enabled: $('#autoSyncOn').checked, minutes: Number($('#autoSyncMin').value) };
    await chrome.storage.local.set({ [AUTO_SYNC_KEY]: next });
    scheduleAutoSync(next);
    if (next.enabled) runAutoSync();
  };
  $('#autoSyncOn').onchange = onChange;
  $('#autoSyncMin').onchange = onChange;
  $('#btnSyncNow').onclick = runAutoSync;
  scheduleAutoSync(p);
  if (p.enabled) runAutoSync(); // mở trang là cập nhật luôn
}

async function runRefresh(list) {
  if (state.loading || !list.length) return;
  state.loading = true;
  state.stop = false;
  $('#btnStop').classList.remove('hidden');
  updatePicked();
  try {
    const { total, fail, statusFail } = await refreshOrders(list);
    let msg = `Đã load lại ${total - fail}/${total} đơn`;
    if (statusFail.length) {
      msg += ` — ${statusFail.length} đơn chưa cập nhật được trạng thái (${statusFail.slice(0, 3).join(', ')}${statusFail.length > 3 ? '…' : ''})`;
    }
    toast(msg, fail || statusFail.length ? 'error' : 'success');
  } catch (e) {
    toast('Lỗi load lại đơn: ' + e.message, 'error');
  } finally {
    state.loading = false;
    $('#btnStop').classList.add('hidden');
    render();
  }
}

// Tải chi tiết cho tất cả đơn đang lọc (lấy mã vận đơn, địa chỉ, phí... đầy đủ).
async function loadAllDetails() {
  if (state.loading) return;
  const todo = filtered().filter((o) => (!o.detail || !o.income) && o.orderId);
  if (!todo.length) return toast('Các đơn đang lọc đã có chi tiết', 'success');
  if (todo.length > 200 && !confirm(`Tải chi tiết ${todo.length} đơn (khoảng ${Math.ceil(todo.length * 0.5 / 60)} phút)?`)) return;
  state.loading = true;
  state.stop = false;
  $('#btnStop').classList.remove('hidden');
  $('#btnDetailAll').disabled = true;
  let fail = 0;
  try {
    for (let i = 0; i < todo.length && !state.stop; i++) {
      $('#progress').textContent = `Đang tải chi tiết ${i + 1}/${todo.length}...`;
      let o = todo[i];
      try { await loadIncome(o); } catch (e) { fail++; }
      try { o = await loadDetail(o); } catch (e) { /* chi tiết đơn không bắt buộc */ }
      if ((i + 1) % 10 === 0) render();
      await sleep(300);
    }
  } finally {
    state.loading = false;
    $('#btnStop').classList.add('hidden');
    $('#btnDetailAll').disabled = false;
    $('#progress').textContent = '';
    render();
  }
  toast(`Đã tải chi tiết & doanh thu ${todo.length - fail} đơn${fail ? `, ${fail} lỗi doanh thu` : ''}`, fail ? 'error' : 'success');
}

// ---------- Xuất file ----------
const BUYER_COLS = ['Người mua', 'ID người mua', 'Địa chỉ'];

function exportCsv() {
  const list = filtered();
  if (!list.length) return toast('Không có đơn để xuất', 'error');
  const withBuyer = $('#withBuyer').checked;
  const head = ['Mã đơn', 'ID đơn', 'Ngày đặt', ...(withBuyer ? BUYER_COLS : []), 'Trạng thái', 'Ghi chú trạng thái',
    'Sản phẩm', 'ID sản phẩm', 'Phân loại', 'ID phân loại', 'SKU sản phẩm', 'SKU phân loại', 'Số lượng', 'Đơn giá',
    'Tổng đơn', 'Thanh toán', 'Hình thức giao', 'Đơn vị vận chuyển', 'Mã vận đơn', 'Hạn giao / lấy hàng',
    ...INCOME_FIELDS.map(([, label]) => label), 'Ghi chú'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.map(cell).join(',')];
  for (const o of list) {
    const items = o.items.length ? o.items : [{}];
    items.forEach((it, i) => {
      lines.push([
        o.orderSn, o.orderId, orderDate(o), ...(withBuyer ? [o.buyer, o.buyerId, o.address] : []), o.status, o.statusNote,
        it.name, it.itemId, it.model, it.modelId, it.itemSku, it.modelSku, it.qty, it.price,
        i === 0 ? o.total : '', o.payment, o.shippingType, o.shipping, o.tracking, o.shipBy ? fmtTime(o.shipBy) : '',
        ...INCOME_FIELDS.map(([f]) => (i === 0 && o.income && o.income.byField[f] !== undefined && o.income.byField[f] !== null ? o.income.byField[f] : '')), o.note
      ].map(cell).join(','));
    });
  }
  download(`don-hang-shopee-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast(`Đã xuất ${list.length} đơn`, 'success');
}

// Xoá thông tin người mua khỏi dữ liệu gốc khi người dùng không muốn xuất.
function stripBuyer(raw) {
  const copy = structuredClone(raw);
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (/^(buyer_info|buyer_username|username|buyer_user_id|buyer_userid|portrait|shipping_address|recipient|recipient_address|phone|phone_number|address|full_address|name_of_recipient|buyer_address_name|buyer_address_phone)$/i.test(k)) delete o[k];
      else walk(o[k]);
    }
  })(copy);
  return copy;
}

function exportJson() {
  const list = filtered();
  if (!list.length) return toast('Không có đơn để xuất', 'error');
  const withBuyer = $('#withBuyer').checked;
  const data = list.map((o) => {
    const full = { card: o.raw, ...(o.detail ? { detail: o.detail } : {}), ...(o.incomeRaw ? { income: o.incomeRaw } : {}) };
    return withBuyer ? full : stripBuyer(full);
  });
  download(`don-hang-shopee-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
  toast(`Đã xuất ${list.length} đơn (JSON đầy đủ)`, 'success');
}

function showTopProducts() {
  const list = filtered();
  const map = new Map();
  for (const o of list) {
    for (const i of o.items) {
      const k = `${i.itemId}:${i.modelId}`;
      const cur = map.get(k) || { name: i.name, model: i.model, qty: 0, revenue: 0, orders: 0 };
      cur.qty += Number(i.qty) || 0;
      cur.revenue += (Number(i.qty) || 0) * (Number(i.price) || 0);
      cur.orders++;
      map.set(k, cur);
    }
  }
  const top = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 50);
  modalJson = '';
  $('#modalTitle').textContent = `Sản phẩm bán chạy (${list.length} đơn đang lọc)`;
  $('#modalBody').innerHTML = top.length
    ? `<table class="grid"><thead><tr><th>#</th><th>Sản phẩm</th><th>Phân loại</th><th>Số lượng</th><th>Số đơn</th><th>Doanh thu</th></tr></thead><tbody>
      ${top.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.name)}</td><td>${esc(t.model)}</td><td>${t.qty}</td><td>${t.orders}</td><td class="money">${money(t.revenue)}</td></tr>`).join('')}
      </tbody></table>`
    : '<div class="muted">Chưa có dữ liệu.</div>';
  $('#modal').classList.remove('hidden');
}

// ---------- Sự kiện ----------
$('#btnConnect').onclick = checkConnection;
$('#tabSelect').onchange = () => $('#tabCustom').classList.toggle('hidden', $('#tabSelect').value !== 'custom');
$('#btnLoad').onclick = loadOrders;
$('#btnStop').onclick = () => { state.stop = true; };
let t = null;
$('#fSearch').oninput = () => { clearTimeout(t); t = setTimeout(() => { state.page = 1; render(); }, 250); };
for (const id of ['#fFrom', '#fTo', '#fSort']) $(id).onchange = () => { state.page = 1; render(); };
$('#pager').onclick = (e) => {
  const b = e.target.closest('button[data-page]');
  if (!b) return;
  state.page = Number(b.dataset.page);
  render();
  $('#orderTable').scrollIntoView({ behavior: 'smooth' });
};
$('#orderTable tbody').onclick = (e) => {
  const b = e.target.closest('button[data-detail]');
  if (b) openDetail(b.dataset.detail);
  const r = e.target.closest('button[data-reload]');
  if (r) {
    const o = state.all.find((x) => orderKey(x) === r.dataset.reload);
    if (o) runRefresh([o]);
  }
};
$('#btnReloadPicked').onclick = () => runRefresh(state.all.filter((o) => state.picked.has(orderKey(o))));
$('#statusTabs').onclick = (e) => {
  const b = e.target.closest('button[data-group]');
  if (!b) return;
  state.statusGroup = b.dataset.group;
  state.statusSub = 'all';
  state.page = 1;
  render();
};
$('#statusSub').onclick = (e) => {
  const b = e.target.closest('button[data-sub]');
  if (!b) return;
  state.statusSub = b.dataset.sub;
  state.page = 1;
  render();
};
// Nút "C" copy nhanh (trong bảng và khung chi tiết)
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-copy]');
  if (!b) return;
  try {
    await navigator.clipboard.writeText(b.dataset.copy);
    toast('Đã copy: ' + b.dataset.copy.slice(0, 60), 'success');
  } catch (err) {
    toast('Không copy được: ' + err.message, 'error');
  }
});
$('#btnDetailAll').onclick = loadAllDetails;
$('#orderTable tbody').addEventListener('change', (e) => {
  const key = e.target.dataset && e.target.dataset.pick;
  if (key === undefined) return;
  if (e.target.checked) state.picked.add(key);
  else state.picked.delete(key);
  updatePicked();
});
$('#pickAll').onchange = (e) => {
  // Chọn / bỏ chọn tất cả đơn đang lọc
  for (const o of filtered()) {
    if (e.target.checked) state.picked.add(orderKey(o));
    else state.picked.delete(orderKey(o));
  }
  render();
};
$('#btnArrange').onclick = () => {
  const list = state.all.filter((o) => state.picked.has(orderKey(o)));
  openArrangeDialog(list, {
    // Xong: load lại tất cả đơn đã chọn (trạng thái, mã vận đơn, chi tiết, doanh thu)
    onDone: () => runRefresh(list)
  });
};
$('#btnShip').onclick = () => {
  const list = state.all.filter((o) => state.picked.has(orderKey(o)));
  openShipDialog(list, { toast });
};
$('#orderTable tbody').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-income]');
  if (!b) return;
  const o = state.all.find((x) => orderKey(x) === b.dataset.income);
  if (!o) return;
  b.disabled = true;
  try {
    await loadIncome(o);
    render();
  } catch (err) {
    b.disabled = false;
    toast('Không tải được doanh thu: ' + err.message, 'error');
  }
});
$('#btnCsv').onclick = exportCsv;
$('#btnJson').onclick = exportJson;
$('#btnTop').onclick = showTopProducts;
$('#btnModalClose').onclick = () => $('#modal').classList.add('hidden');
$('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modal').classList.add('hidden'); });
$('#btnCopyJson').onclick = async () => {
  if (!modalJson) return;
  try {
    await navigator.clipboard.writeText(modalJson);
    toast('Đã copy JSON', 'success');
  } catch (e) {
    toast('Không copy được: ' + e.message, 'error');
  }
};
$('#btnClearSaved').onclick = async () => {
  if (!state.all.length) return toast('Hiện chưa có đơn nào được lưu', 'info');
  if (!confirm(`Bạn có chắc muốn xoá toàn bộ ${state.all.length} đơn hàng đã lưu trong máy không?\n(Sau khi xoá có thể bấm "Tải đơn hàng" để tải lại từ Kênh Người Bán)`)) return;
  await clearAllOrders();
  state.all = [];
  state.picked.clear();
  updateSavedCount();
  render();
  toast('Đã xoá toàn bộ đơn đã lưu', 'success');
};

async function initSavedOrders() {
  try {
    const list = await getAllOrders();
    if (list && list.length) {
      list.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
      // Đọc lại tên từ dữ liệu gốc để sửa cả các đơn đã lưu bằng parser cũ.
      state.all = list.map((o) => o.raw
        ? { ...o, items: parseOrder(o.raw, o.detail || null).items }
        : o);
      updateSavedCount();
      render();
      const p = $('#progress');
      if (p) p.textContent = `📦 Đang hiển thị ${list.length} đơn đã lưu trong bộ nhớ máy.`;
    }
  } catch (e) {
    console.warn('Lỗi đọc đơn đã lưu:', e);
  }
}

render();
checkConnection();
initSavedOrders().then(initAutoSync);
