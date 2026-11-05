import { getAllOrders } from './db.js';
import { getTableConfig, saveTableConfig, applyTableStyles, tagAndReorderDOM, openColumnCustomizerModal } from './table-customizer.js';

// Đơn Shopee: 2 tab — "Đơn Shopee" (bảng hiện có) và "Đơn trên Sheet" (đọc sheet DH)
// Cùng thứ tự cột với bảng Đơn Shopee (trừ Chọn / Thao tác); cột cuối ẩn sẵn
const COLS = [
  ['mdh', 'Mã đơn'], ['gian', 'Gian'], ['ngay_gio', 'Ngày đặt'], ['ten_khach', 'Người mua'], ['trang_thai', 'Trạng thái'],
  ['ten_sp', 'Sản phẩm'], ['phan_loai', 'Phân loại'], ['sku_san_pham', 'SKU sản phẩm'], ['sku', 'SKU phân loại'],
  ['slg', 'SL'], ['don_gia', 'Đơn giá'], ['gia_sp', 'Giá SP'], ['thanh_tien_sp', 'Thành tiền SP'], ['tong_tien', 'Tổng đơn'],
  ['vc_nguoi_mua', 'Phí VC người mua trả'], ['phi_vc', 'Phí VC ước tính'], ['vc_tro_gia', 'Shopee trợ giá VC'],
  ['phi_co_dinh', 'Phí cố định'], ['phi_dich_vu', 'Phí dịch vụ'], ['phi_giao_dich', 'Phí xử lý GD'],
  ['thue_gtgt', 'Thuế GTGT'], ['thue_tncn', 'Thuế TNCN'], ['doanh_thu', 'Doanh thu ước tính'],
  ['tong_thanh_tien_sp', 'Tổng thành tiền SP'], ['loi_nhuan', 'Lợi nhuận'], ['thanh_toan', 'Thanh toán'],
  ['don_vi_vc', 'Vận chuyển'], ['mvd', 'Mã vận đơn'], ['han_giao', 'Hạn giao'], ['ghi_chu', 'Ghi chú'],
  ['thanh_tien', 'Thành tiền'], ['phu_phi', 'Phụ phí'], ['thue', 'Thuế'], ['ngay_hoan_thanh', 'Ngày hoàn thành'], ['ly_do_huy', 'Lý do hủy']
];
const HIDDEN = new Set(['thanh_tien', 'phu_phi', 'thue', 'ngay_hoan_thanh', 'ly_do_huy']);
const TIME = new Set(['ngay_gio', 'han_giao', 'ngay_hoan_thanh']);
// Cột chỉ dùng cho thống kê / load lại, không hiện trong bảng
const EXTRA = ['nguoi_mua_id', 'order_id', 'shop_id'];
const RELOAD_MAX = 200; // tối đa số đơn đọc lại từ Shopee mỗi lần bấm
const MONEY = new Set(['don_gia', 'gia_sp', 'thanh_tien_sp', 'tong_tien', 'vc_nguoi_mua', 'phi_vc', 'vc_tro_gia', 'phi_co_dinh', 'phi_dich_vu', 'phi_giao_dich',
  'thue_gtgt', 'thue_tncn', 'doanh_thu', 'tong_thanh_tien_sp', 'loi_nhuan', 'thanh_tien', 'phu_phi', 'thue']);
const PAGE = 100;
const DEFAULT_COLS = COLS.map(([id, label]) => ({
  id, label, defaultWidth: id === 'ten_sp' ? 260 : id === 'mdh' ? 155 : id === 'slg' ? 50 : MONEY.has(id) ? 100 : 120,
  defaultAlign: MONEY.has(id) || id === 'slg' ? 'right' : TIME.has(id) ? 'center' : 'left',
  defaultWrap: id === 'ten_sp', defaultFixed: id === 'mdh', visible: !HIDDEN.has(id)
}));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => { const n = Number(String(v).replace(/[^\d.-]/g, '')); return v !== '' && Number.isFinite(n) ? n.toLocaleString('vi-VN') + 'đ' : esc(v); };
// Ngày giờ ISO (UTC) trên sheet -> dd/mm/yyyy HH:mm giờ máy
const fmtTime = (v) => {
  const t = /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? new Date(v) : null;
  if (!t || isNaN(t)) return v;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`;
};
// "dd/mm/yyyy hh:mm" hoặc ISO -> số để sắp xếp
function timeValue(s) {
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  return Date.parse(s) || 0;
}

// Cột chọn đơn (cho Load lại đơn hàng), luôn ở đầu và ghim
DEFAULT_COLS.unshift({ id: 'pick', label: 'Chọn', defaultWidth: 40, defaultAlign: 'center', defaultFixed: true });
const state = { rows: [], loaded: false, page: 1, group: 'all', picked: new Set(), from: null, to: null, rangeLabel: 'Tất cả ngày' };
const main = document.querySelector('main');

const bar = document.createElement('div');
bar.className = 'page-tabs';
bar.innerHTML = '<button type="button" class="page-tab active" data-pane="shopee">📦 Đơn Shopee</button><button type="button" class="page-tab" data-pane="sheet">📄 Đơn trên Sheet</button>';
const paneShopee = document.createElement('div');
while (main.firstChild) paneShopee.appendChild(main.firstChild);
const paneSheet = document.createElement('div');
paneSheet.style.display = 'none';
paneSheet.innerHTML = `
  <div class="card">
    <div class="toolbar">
      <input id="dhSearch" placeholder="Tìm mã đơn, người mua, sản phẩm, SKU, mã vận đơn" style="min-width:300px">
      <select id="dhGian"><option value="">Tất cả gian</option></select>
      <select id="dhStatus"><option value="">Tất cả trạng thái</option></select>
      <span class="dp-wrap"><button type="button" id="dhDate" class="btn">📅 <span id="dhDateText">Tất cả ngày</span></button><div id="dhDatePop" class="dp-pop" hidden></div></span>
      <button id="dhReload" class="btn primary">🔄 Đọc lại Sheet</button>
      <button id="dhShopee" class="btn" title="Đọc lại từ Shopee các đơn đang tích (nếu không tích: các đơn đang lọc, tối đa ${RELOAD_MAX} đơn mới nhất) rồi ghi vào sheet DH">🔁 Load lại đơn hàng (<span id="dhPickCount">0</span>)</button>
      <button id="dhCols" class="btn small">⚙ Tùy chỉnh cột</button>
      <span id="dhInfo" class="muted"></span>
    </div>
    <div id="dhStats" class="stats"></div>
    <div id="dhTabs" class="status-tabs"></div>
    <div class="table-wrap"><table id="dhSheetTable"><thead><tr>${DEFAULT_COLS.map((c) => c.id === 'pick' ? '<th data-col="pick"><input type="checkbox" id="dhPickAll" title="Chọn tất cả đơn trong trang"></th>' : `<th data-col="${c.id}">${c.label}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
    <div id="dhPager" class="pager"></div>
  </div>`;
main.append(bar, paneShopee, paneSheet);

const $ = (s) => paneSheet.querySelector(s);
bar.onclick = (e) => {
  const b = e.target.closest('.page-tab');
  if (!b) return;
  bar.querySelectorAll('.page-tab').forEach((x) => x.classList.toggle('active', x === b));
  const sheet = b.dataset.pane === 'sheet';
  paneShopee.style.display = sheet ? 'none' : '';
  paneSheet.style.display = sheet ? '' : 'none';
  if (sheet && !state.loaded) load();
};

async function load() {
  $('#dhReload').disabled = true;
  $('#dhInfo').textContent = 'Đang đọc sheet DH...';
  const res = await new Promise((r) => chrome.runtime.sendMessage({ type: 'FETCH_DH_WEB', cols: [...COLS.map(([k]) => k), ...EXTRA] }, r));
  $('#dhReload').disabled = false;
  if (!res?.ok) { $('#dhInfo').textContent = 'Không đọc được sheet DH: ' + (res?.error || ''); return; }
  const [head = [], ...body] = res.values || [];
  const idx = Object.fromEntries(head.map((h, i) => [String(h).trim(), i]));
  state.rows = body.filter((r) => r.some((c) => c !== '')).map((r) => {
    const o = {};
    for (const k of [...new Set([...COLS.map(([c]) => c), ...EXTRA])]) o[k] = idx[k] !== undefined ? r[idx[k]] ?? '' : '';
    o._t = timeValue(o.ngay_gio);
    o._s = COLS.map(([k]) => o[k]).join(' ').toLowerCase();
    return o;
  }).sort((a, b) => b._t - a._t);
  state.loaded = true;
  fill('#dhGian', 'gian', 'Tất cả gian');
  fill('#dhStatus', 'trang_thai', 'Tất cả trạng thái');
  // Mặc định lọc đúng Mã gian đang dùng (Auto In)
  const cfg = await chrome.storage.local.get(['tcdd-shop-code', 'maGian', 'dhHoanTextValue']);
  const code = String(cfg['tcdd-shop-code'] || cfg.maGian || cfg.dhHoanTextValue || '').trim().toUpperCase();
  if (code && [...$('#dhGian').options].some((o) => o.value === code)) $('#dhGian').value = code;
  state.page = 1;
  render();
  addMissing(code);
}
function fill(sel, key, all) {
  const cur = $(sel).value;
  const vals = [...new Set(state.rows.map((r) => r[key]).filter(Boolean))].sort();
  $(sel).innerHTML = `<option value="">${all}</option>` + vals.map((v) => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
}
// Nhóm trạng thái giống tab Đơn Shopee (trang_thai trên sheet là kết quả statusOf)
const STATUS_GROUPS = [['all', 'Tất cả'], ['unpaid', 'Chờ xác nhận'], ['toship', 'Chờ lấy hàng'], ['shipping', 'Đang giao'], ['completed', 'Đã giao'], ['return', 'Trả hàng/Hoàn tiền/Hủy']];
function groupOf(s) {
  if (['Chờ xác nhận', 'Chờ thanh toán'].includes(s)) return 'unpaid';
  if (s === 'Chờ lấy hàng') return 'toship';
  if (s === 'Đang giao') return 'shipping';
  if (['Đã giao', 'Hoàn thành'].includes(s)) return 'completed';
  if (['Đã hủy', 'Trả hàng', 'Hoàn tiền', 'Hoàn hàng', 'Trả hàng / Hoàn tiền'].includes(s)) return 'return';
  return 'other';
}
function render() {
  const q = $('#dhSearch').value.trim().toLowerCase(), gian = $('#dhGian').value, st = $('#dhStatus').value;
  const base = state.rows.filter((r) => (!gian || r.gian === gian) && (!st || r.trang_thai === st) && (!q || r._s.includes(q))
    && (state.from == null || r._t >= state.from) && (state.to == null || r._t < state.to));
  // Tab trạng thái: đếm theo đơn (không theo dòng sản phẩm)
  const counts = {};
  const seenOrder = new Set();
  for (const r of base) { const k = r.gian + '|' + r.mdh; if (seenOrder.has(k)) continue; seenOrder.add(k); const g = groupOf(r.trang_thai); counts[g] = (counts[g] || 0) + 1; }
  $('#dhTabs').innerHTML = STATUS_GROUPS.map(([k, label]) =>
    `<button type="button" class="status-tab${state.group === k ? ' active' : ''}" data-group="${k}">${label}${k === 'all' ? '' : ` (${counts[k] || 0})`}</button>`).join('');
  const list = state.group === 'all' ? base : base.filter((r) => groupOf(r.trang_thai) === state.group);
  lastList = list;
  const orders = new Set(list.map((r) => r.gian + '|' + r.mdh)).size;
  renderStats(list);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  state.page = Math.min(state.page, pages);
  $('#dhInfo').textContent = `${orders} đơn · ${list.length} dòng (sheet có ${state.rows.length} dòng)`;
  $('#dhSheetTable tbody').innerHTML = list.slice((state.page - 1) * PAGE, state.page * PAGE).map((r) =>
    `<tr>${DEFAULT_COLS.map(({ id: k }) => { if (k === 'pick') return `<td data-col="pick"><input type="checkbox" class="dh-pick" data-id="${esc(r.order_id)}"${state.picked.has(String(r.order_id)) ? ' checked' : ''}${r.order_id ? '' : ' disabled'}></td>`; const m = MONEY.has(k); return `<td data-col="${k}"${m ? ' class="money"' : ''}>${m ? money(r[k]) : esc(TIME.has(k) ? fmtTime(r[k]) : r[k])}</td>`; }).join('')}</tr>`).join('')
    || `<tr><td colspan="${DEFAULT_COLS.length}" class="muted">Không có dòng nào.</td></tr>`;
  const cfg = getTableConfig('dhSheetTable', DEFAULT_COLS);
  applyTableStyles('dhSheetTable', cfg);
  tagAndReorderDOM('dhSheetTable', cfg);
  updatePick();
  $('#dhPager').innerHTML = pages > 1
    ? `<button class="btn small" data-p="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹ Trước</button> <span>Trang ${state.page}/${pages}</span> <button class="btn small" data-p="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>Sau ›</button>`
    : '';
}
// Đơn đã tải ở tab "Đơn Shopee" (lưu trên máy) mà sheet DH chưa có -> tự đọc từ Shopee và ghi vào DH.
// Mỗi đơn chỉ thử 1 lần mỗi lần mở trang, để đơn lỗi không bị gọi lặp.
const tried = new Set();
async function addMissing(code) {
  if (!code) return;
  const onSheet = new Set(state.rows.filter((r) => String(r.gian).toUpperCase() === code).map((r) => String(r.mdh)));
  const saved = await getAllOrders().catch(() => []);
  // Gửi thẳng đơn đã tải (có chi tiết + doanh thu) để ghi DH, không gọi lại Shopee
  const missing = saved.filter((o) => o.orderId && o.orderSn && !onSheet.has(String(o.orderSn)) && !tried.has(String(o.orderId)));
  if (!missing.length) return;
  missing.forEach((o) => tried.add(String(o.orderId)));
  const info = $('#dhInfo').textContent;
  let res = { count: 0 };
  const batch = 'm' + Date.now();
  for (let i = 0; i < missing.length; i += 40) {
    $('#dhInfo').textContent = `Đang thêm ${Math.min(i + 40, missing.length)}/${missing.length} đơn có ở Đơn Shopee mà sheet chưa có...`;
    const r = await new Promise((ok) => chrome.runtime.sendMessage({ type: 'dh-write-orders', orders: missing.slice(i, i + 40), batch, last: i + 40 >= missing.length }, ok));
    if (!r?.ok) { $('#dhInfo').textContent = `${info} · Chưa thêm được đơn thiếu: ${r?.error || chrome.runtime.lastError?.message || ''}`; return; }
    res = r;
  }
  await load();
  $('#dhInfo').textContent = `✔ Đã thêm ${res.count} đơn còn thiếu vào sheet · ` + $('#dhInfo').textContent;
}
// Thống kê theo bộ lọc: tiền của đơn ghi ở mọi dòng sản phẩm, chỉ tính 1 lần mỗi đơn
function renderStats(list) {
  const n = (v) => { const x = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return v !== '' && Number.isFinite(x) ? x : null; };
  const orders = new Map();
  for (const r of list) { const k = r.gian + '|' + r.mdh; if (!orders.has(k)) orders.set(k, r); }
  const first = [...orders.values()];
  const sum = (key) => first.reduce((s, r) => s + (n(r[key]) || 0), 0);
  const has = (key) => first.filter((r) => n(r[key]) !== null).length;
  const note = (key) => has(key) < first.length ? ` (${has(key)}/${first.length} đơn)` : '';
  const total = sum('tong_tien');
  const stat = (v, l, cls = '') => `<div class="stat ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  $('#dhStats').innerHTML = first.length ? [
    stat(first.length, 'Đơn'), stat(money(total), 'Tổng tiền đơn'),
    stat(money(sum('doanh_thu')), 'Doanh thu ước tính' + note('doanh_thu'), 'income'),
    stat(money(sum('phu_phi')), 'Tổng phụ phí' + note('phu_phi')), stat(money(sum('thue')), 'Tổng thuế' + note('thue')),
    stat(money(sum('tong_thanh_tien_sp')), 'Tổng thành tiền SP' + note('tong_thanh_tien_sp')),
    stat(money(sum('loi_nhuan')), 'Lợi nhuận' + note('loi_nhuan'), 'income')
  ].join('') : '';
}
// Đồng bộ DH ghi xong (đơn mới từ tab Đơn Shopee) -> đọc lại sheet nếu đang mở
chrome.storage.onChanged.addListener((c) => { if (c.dh_sheet_meta && state.loaded) load(); });
// ---------- Chọn đơn ----------
function updatePick() {
  $('#dhPickCount').textContent = state.picked.size;
  const boxes = [...paneSheet.querySelectorAll('.dh-pick:not(:disabled)')];
  $('#dhPickAll').checked = boxes.length > 0 && boxes.every((b) => b.checked);
}
paneSheet.addEventListener('change', (e) => {
  if (e.target.classList.contains('dh-pick')) {
    const id = e.target.dataset.id;
    paneSheet.querySelectorAll('.dh-pick').forEach((b) => { if (b.dataset.id === id) b.checked = e.target.checked; });
    if (e.target.checked) state.picked.add(id); else state.picked.delete(id);
    updatePick();
  } else if (e.target.id === 'dhPickAll') {
    paneSheet.querySelectorAll('.dh-pick:not(:disabled)').forEach((b) => {
      b.checked = e.target.checked;
      if (e.target.checked) state.picked.add(b.dataset.id); else state.picked.delete(b.dataset.id);
    });
    updatePick();
  }
});

// ---------- Lọc ngày: lọc nhanh + lịch 2 tháng ----------
const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const ddmm = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
function quickRanges() {
  const t = day(new Date()), dow = (t.getDay() + 6) % 7; // thứ 2 = 0
  const week = addDays(t, -dow), month = new Date(t.getFullYear(), t.getMonth(), 1);
  return [
    ['Hôm nay', t, t], ['Hôm qua', addDays(t, -1), addDays(t, -1)],
    ['Tuần này', week, t], ['Tuần trước', addDays(week, -7), addDays(week, -1)],
    ['Tháng này', month, t], ['Tháng trước', new Date(t.getFullYear(), t.getMonth() - 1, 1), addDays(month, -1)],
    ['Tất cả ngày', null, null]
  ];
}
const dp = { month: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), start: null, end: null };
function setRange(a, b, label) {
  state.from = a ? a.getTime() : null;
  state.to = b ? addDays(b, 1).getTime() : null;
  state.rangeLabel = label || (a ? (+a === +b ? ddmm(a) : `${ddmm(a)} - ${ddmm(b)}`) : 'Tất cả ngày');
  $('#dhDateText').textContent = state.rangeLabel;
  $('#dhDatePop').hidden = true;
  state.page = 1;
  render();
}
function monthHtml(m) {
  const first = new Date(m.getFullYear(), m.getMonth(), 1).getDay(), days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const today = +day(new Date()), a = dp.start && +dp.start, b = dp.end && +dp.end;
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<span></span>';
  for (let d = 1; d <= days; d++) {
    const t = +new Date(m.getFullYear(), m.getMonth(), d);
    const cls = [t === today ? 'today' : '', t === a || t === b ? 'sel' : '', a && b && t > a && t < b ? 'in' : ''].join(' ');
    cells += `<button type="button" class="dp-day ${cls}" data-t="${t}">${d}</button>`;
  }
  return `<div class="dp-month"><div class="dp-title">Tháng ${m.getMonth() + 1}/${m.getFullYear()}</div>
    <div class="dp-grid">${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((x) => `<b>${x}</b>`).join('')}${cells}</div></div>`;
}
function drawPicker() {
  const m2 = new Date(dp.month.getFullYear(), dp.month.getMonth() + 1, 1);
  $('#dhDatePop').innerHTML = `<div class="dp-quick">${quickRanges().map(([l], i) => `<button type="button" data-q="${i}" class="${l === state.rangeLabel ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="dp-cal"><div class="dp-nav"><button type="button" data-nav="-12" title="Lùi 1 năm">«</button><button type="button" data-nav="-1">‹</button><span class="muted small">${dp.start && !dp.end ? 'Chọn ngày kết thúc' : 'Chọn ngày bắt đầu'}</span><button type="button" data-nav="1">›</button><button type="button" data-nav="12" title="Tới 1 năm">»</button></div>
    <div class="dp-months">${monthHtml(dp.month)}${monthHtml(m2)}</div></div>`;
}
$('#dhDate').onclick = (e) => {
  e.stopPropagation();
  const p = $('#dhDatePop');
  p.hidden = !p.hidden;
  if (!p.hidden) { dp.start = state.from ? new Date(state.from) : null; dp.end = state.to ? addDays(new Date(state.to), -1) : null; drawPicker(); }
};
$('#dhDatePop').onclick = (e) => {
  e.stopPropagation();
  const q = e.target.closest('[data-q]'), nav = e.target.closest('[data-nav]'), d = e.target.closest('[data-t]');
  if (q) { const [l, a, b] = quickRanges()[+q.dataset.q]; setRange(a, b, l); return; }
  if (nav) { dp.month = new Date(dp.month.getFullYear(), dp.month.getMonth() + +nav.dataset.nav, 1); drawPicker(); return; }
  if (d) {
    const t = new Date(+d.dataset.t);
    if (!dp.start || dp.end) { dp.start = t; dp.end = null; drawPicker(); return; }
    const [a, b] = t < dp.start ? [t, dp.start] : [dp.start, t];
    setRange(a, b);
  }
};
document.addEventListener('click', () => { $('#dhDatePop').hidden = true; });

$('#dhTabs').onclick = (e) => { const b = e.target.closest('[data-group]'); if (b) { state.group = b.dataset.group; state.page = 1; render(); } };
$('#dhPager').onclick = (e) => { const p = e.target.closest('[data-p]'); if (p) { state.page = +p.dataset.p; render(); } };
$('#dhSearch').oninput = () => { state.page = 1; render(); };
$('#dhGian').onchange = $('#dhStatus').onchange = () => { state.page = 1; render(); };
$('#dhReload').onclick = load;
let lastList = [];
$('#dhShopee').onclick = async () => {
  const seen = new Map();
  const src = state.picked.size ? state.rows.filter((r) => state.picked.has(String(r.order_id))) : lastList;
  for (const r of src) if (r.order_id && !seen.has(r.order_id)) seen.set(r.order_id, r.shop_id);
  const ids = [...seen.keys()].slice(0, RELOAD_MAX);
  if (!ids.length) { $('#dhInfo').textContent = 'Không có đơn nào để load lại (chọn bộ lọc trước).'; return; }
  const shops = new Set(ids.map((id) => seen.get(id)).filter(Boolean));
  if (shops.size > 1) { $('#dhInfo').textContent = 'Đang có đơn của nhiều gian: chọn 1 gian trong bộ lọc rồi bấm lại.'; return; }
  $('#dhShopee').disabled = true;
  $('#dhInfo').textContent = `Đang đọc lại ${ids.length} đơn từ Shopee và ghi sheet DH...`;
  const res = await new Promise((r) => chrome.runtime.sendMessage({ type: 'dh-reload-orders', orderIds: ids, shopId: [...shops][0] }, r));
  $('#dhShopee').disabled = false;
  if (!res?.ok) { $('#dhInfo').textContent = 'Không load lại được: ' + (res?.error || chrome.runtime.lastError?.message || ''); return; }
  state.picked.clear();
  await load();
  $('#dhInfo').textContent = `✔ Đã load lại ${res.count} đơn từ Shopee${res.fail ? ` (${res.fail} đơn không đọc được)` : ''} · ` + $('#dhInfo').textContent;
};
$('#dhCols').onclick = () => openColumnCustomizerModal({
  tableId: 'dhSheetTable', tableName: 'Đơn trên Sheet', defaultCols: DEFAULT_COLS,
  currentConfig: getTableConfig('dhSheetTable', DEFAULT_COLS),
  onSave: (cfg) => { saveTableConfig('dhSheetTable', cfg); render(); }
});
// Áp cấu hình cột ngay cả khi chưa đọc sheet
{ const cfg = getTableConfig('dhSheetTable', DEFAULT_COLS); applyTableStyles('dhSheetTable', cfg); tagAndReorderDOM('dhSheetTable', cfg); }
