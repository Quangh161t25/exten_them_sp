import { wameli, toWameliDate } from './wameli-api.js';
import { readXlsx, base64ToBuffer, splitHeader } from './xlsx.js';
import { getTableConfig, saveTableConfig, applyTableStyles, attachColumnResizers, openColumnCustomizerModal } from './table-customizer.js';

const PAGE_SIZE = 100; // số dòng hiển thị mỗi trang

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let toastTimer = null;
function toast(msg, type = 'info') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}
const status = (msg, cls = '') => {
  $('#wStatus').className = 'hint ' + cls;
  $('#wStatus').textContent = msg;
};

const state = { head: [], rows: [], page: 1, loading: false, stop: false, source: '' };

// Cách lấy theo loại dữ liệu
const MODES = {
  orders: [['excel_misa', 'Xuất Excel Misa (nhanh)'], ['excel_nhat', 'Xuất File Nhặt (nhanh)'], ['pages', 'Đọc từng trang (chậm)']],
  products: [['export', 'Xuất Excel (nhanh)'], ['pages', 'Đọc từng trang (chậm)']]
};
const kind = () => $('#wKind').value;
const kindLabel = () => (kind() === 'products' ? 'sản phẩm' : 'đơn xuất kho');

function syncKind() {
  $('#wMode').innerHTML = MODES[kind()].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  $('#dateOpts').classList.toggle('hidden', kind() === 'products');
  $('#wMaxPages').value = kind() === 'products' ? 80 : 20;
  syncMode();
  restoreDataCache().catch(() => {});
}
function syncMode() {
  $('#pageOpts').classList.toggle('hidden', $('#wMode').value !== 'pages');
}

// Bỏ các cột không cần (ô chọn, nút Sửa) của bảng trang web
function cleanTable(head, rows) {
  const keep = head.map((h, i) => (h && !/^sửa$/i.test(h) ? i : -1)).filter((i) => i !== -1);
  return { head: keep.map((i) => head[i]), rows: rows.map((r) => keep.map((i) => r[i] ?? '')) };
}

const PRODUCT_CACHE_KEY = 'wameliProductsCache'; // { head, rows, source, at }
const ORDERS_CACHE_KEY = 'wameliOrdersCache'; // { head, rows, source, at }

const cacheKey = () => (kind() === 'products' ? PRODUCT_CACHE_KEY : ORDERS_CACHE_KEY);

function setData(head, rows, source) {
  state.head = head;
  state.rows = rows;
  state.page = 1;
  state.source = source;
  render();
  saveDataCache();
}

// Lưu danh sách vào bộ nhớ máy (tự động lưu cả sản phẩm và đơn xuất kho)
function saveDataCache() {
  if (!state.rows.length) return;
  const key = cacheKey();
  chrome.storage.local.set({ [key]: { head: state.head, rows: state.rows, source: state.source, at: Date.now() } })
    .catch((e) => toast('Không lưu được vào bộ nhớ máy: ' + e.message, 'error'));
}

async function restoreDataCache() {
  const key = cacheKey();
  const { [key]: cache } = await chrome.storage.local.get(key);
  if (!cache || !Array.isArray(cache.rows) || !cache.rows.length) return;
  state.head = cache.head || [];
  state.rows = cache.rows;
  state.page = 1;
  const at = new Date(cache.at).toLocaleString('vi-VN');
  state.source = `${cache.source || ''} · đã lưu lúc ${at}`;
  render();
  status(`Đang hiển thị ${cache.rows.length} ${kindLabel()} đã lưu trong bộ nhớ máy lúc ${at}. Bấm "Lấy dữ liệu" để làm mới.`);
}

// ---------- Lưu sản phẩm mới vào sheet DS_SP ----------
// id_sp_con = Mã · id_sp = 4 ký tự đầu của Mã · ten_sp = Tên · gia_nhap_ncc = Giá nhập
// gia_ban = Giá bán lẻ · gia_dong_goi = Giá bán đóng gói · gia_thap_nhat = Giá bán thấp nhất
const normHead = (h) => String(h || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const digits = (v) => String(v ?? '').replace(/[^\d]/g, '');

function productColumns() {
  const heads = state.head.map(normHead);
  const find = (test) => heads.findIndex(test);
  return {
    ma: find((h) => h === 'ma' || h === 'ma sp' || h === 'ma san pham'),
    ten: find((h) => h === 'ten' || h === 'ten sp' || h === 'ten san pham'),
    giaNhap: find((h) => h.startsWith('gia nhap')),
    giaBan: find((h) => h === 'gia ban le' || h === 'gia ban'),
    giaDongGoi: find((h) => /dong goi|don goi/.test(h)),
    giaThapNhat: find((h) => h.includes('thap nhat'))
  };
}

function updateLastSyncInfo(newCount) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN');
  const countStr = newCount > 0 ? `+${newCount} SP mới` : 'không có SP mới';
  const text = `Đã đồng bộ lúc ${timeStr} (${countStr})`;
  const el = $('#wLastSyncInfo');
  if (el) el.textContent = text;
  chrome.storage.local.set({ wml_last_sync_info: text }).catch(() => {});
}

async function saveToSheet(silent = false) {
  if (!state.rows.length) {
    if (!silent) toast('Chưa có sản phẩm. Bấm "Lấy dữ liệu" trước.', 'error');
    return { ok: false, count: 0 };
  }
  const col = productColumns();
  const LABELS = { ma: 'Mã', ten: 'Tên', giaNhap: 'Giá nhập', giaBan: 'Giá bán lẻ', giaDongGoi: 'Giá bán đóng gói', giaThapNhat: 'Giá bán thấp nhất' };
  const missing = Object.keys(LABELS).filter((k) => col[k] < 0).map((k) => LABELS[k]);
  if (missing.length) {
    const err = 'Không thấy cột: ' + missing.join(', ');
    if (!silent) toast(err, 'error');
    return { ok: false, error: err };
  }

  const btn = $('#wToSheet');
  if (btn) btn.disabled = true;
  const qBtn = $('#wQuickSync');
  if (qBtn) qBtn.disabled = true;

  try {
    status('Đang đọc sheet DS_SP để đối chiếu sản phẩm mới...');
    const res = await chrome.runtime.sendMessage({ type: 'FETCH_DS_SP' });
    if (!res || !res.ok) throw new Error((res && res.error) || 'Không đọc được sheet DS_SP');
    const values = res.values || [];
    const header = (values[0] || []).map((h) => String(h || '').trim());
    const at = (name, fallback) => (header.indexOf(name) !== -1 ? header.indexOf(name) : fallback);
    const idx = {
      id_sp_con: header.indexOf('id_sp_con') !== -1 ? header.indexOf('id_sp_con') : at('id_sp_ct', 0),
      id_sp: at('id_sp', 1), ten_sp: at('ten_sp', 2), gia_nhap_ncc: at('gia_nhap_ncc', 3),
      gia_ban: at('gia_ban', 4), gia_dong_goi: at('gia_dong_goi', 5), gia_thap_nhat: at('gia_thap_nhat', 6)
    };
    // Mã -> số dòng trên sheet (dòng đầu tiên nếu trùng)
    const existingRow = new Map();
    values.slice(1).forEach((r, i) => { const k = String((r || [])[idx.id_sp_con] ?? '').trim(); if (k && !existingRow.has(k)) existingRow.set(k, i + 2); });
    const existing = new Set(existingRow.keys());
    // SP đã có: so 4 cột giá với Wameli, khác thì cập nhật đúng ô đó
    const PRICE = [['gia_nhap_ncc', 'giaNhap'], ['gia_ban', 'giaBan'], ['gia_dong_goi', 'giaDongGoi'], ['gia_thap_nhat', 'giaThapNhat']];
    const updates = [];
    const changed = new Set();
    for (const r of state.rows) {
      const ma = String(r[col.ma] ?? '').trim();
      const rowNum = existingRow.get(ma);
      if (!rowNum) continue;
      const old = values[rowNum - 1] || [];
      for (const [sheetKey, wmlKey] of PRICE) {
        const v = digits(r[col[wmlKey]]);
        if (v && v !== digits(old[idx[sheetKey]])) { updates.push({ row: rowNum, col: idx[sheetKey], value: v }); changed.add(ma); }
      }
    }

    const width = Math.max(header.length, ...Object.values(idx).map((i) => i + 1));
    const newRows = [];
    for (const r of state.rows) {
      const ma = String(r[col.ma] ?? '').trim();
      if (!ma || existing.has(ma)) continue;
      existing.add(ma);
      const row = new Array(width).fill('');
      row[idx.id_sp_con] = ma;
      row[idx.id_sp] = ma.slice(0, 4);
      row[idx.ten_sp] = String(r[col.ten] ?? '').trim();
      row[idx.gia_nhap_ncc] = digits(r[col.giaNhap]);
      row[idx.gia_ban] = digits(r[col.giaBan]);
      row[idx.gia_dong_goi] = digits(r[col.giaDongGoi]);
      row[idx.gia_thap_nhat] = digits(r[col.giaThapNhat]);
      newRows.push(row);
    }

    if (updates.length) {
      status(`Đang cập nhật giá ${changed.size} sản phẩm đã có trong DS_SP...`);
      const up = await chrome.runtime.sendMessage({ type: 'UPDATE_DS_SP_CELLS', updates });
      if (!up || !up.ok) throw new Error((up && up.error) || 'Không cập nhật được giá trong DS_SP');
    }
    const updMsg = changed.size ? ` · cập nhật giá ${changed.size} SP` : '';
    if (!newRows.length) {
      status(`Không có SP mới${updMsg || ' · giá các SP đã có đều khớp'}.`);
      if (!silent) toast(changed.size ? `Đã cập nhật giá ${changed.size} sản phẩm trong DS_SP` : 'Không có sản phẩm mới, giá đều khớp', changed.size ? 'success' : 'info');
      updateLastSyncInfo(0);
      return { ok: true, count: 0, updated: changed.size };
    }

    if (!silent) {
      if (!confirm(`Thêm ${newRows.length} sản phẩm mới vào sheet DS_SP?\n(${state.rows.length - newRows.length} sản phẩm đã có sẵn sẽ bỏ qua)`)) {
        status('Đã huỷ lưu vào sheet.');
        return { ok: false, cancelled: true };
      }
    }

    status(`Đang thêm ${newRows.length} sản phẩm mới vào sheet DS_SP...`);
    const add = await chrome.runtime.sendMessage({ type: 'APPEND_DS_SP', rowDatas: newRows });
    if (!add || !add.ok) throw new Error((add && add.error) || 'Không thêm được vào DS_SP');
    const succMsg = `Đã lưu ${newRows.length} sản phẩm mới vào sheet DS_SP${updMsg}.`;
    status(`✅ ${succMsg}`);
    toast(succMsg, 'success');
    updateLastSyncInfo(newRows.length);
    return { ok: true, count: newRows.length };
  } catch (e) {
    status('Lỗi lưu vào sheet: ' + e.message, 'err');
    toast(e.message, 'error');
    return { ok: false, error: e.message };
  } finally {
    if (btn) btn.disabled = false;
    if (qBtn) qBtn.disabled = false;
  }
}

// ---------- Hiển thị ----------
function getColId(h, idx) {
  if (!h) return `col_${idx}`;
  const slug = String(h).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug ? `col_${slug}` : `col_${idx}`;
}

function buildWameliDefaultCols(head) {
  return head.map((h, idx) => {
    const colId = getColId(h, idx);
    const norm = normHead(h);
    let defaultWidth = 100;
    let defaultAlign = 'left';
    let defaultWrap = false;

    if (norm === 'ten' || norm === 'ten sp' || norm === 'ten san pham' || norm.includes('san pham') || norm.includes('ten')) {
      defaultWidth = 260; // Đảm bảo cột Tên đủ rộng hiển thị rõ ràng, không bị co ép 40px
      defaultWrap = true;
    } else if (norm === 'id') {
      defaultWidth = 65;
      defaultAlign = 'center';
    } else if (norm === 'ma' || norm === 'ma sp' || norm === 'ma vach' || norm.includes('sku') || norm.includes('ma don')) {
      defaultWidth = 120;
    } else if (norm.includes('gia') || norm.includes('tien') || norm.includes('phi')) {
      defaultWidth = 110;
      defaultAlign = 'right';
    } else if (norm.includes('ngay') || norm.includes('thoi gian') || norm.includes('gio')) {
      defaultWidth = 125;
      defaultAlign = 'center';
    } else if (norm === 'loai' || norm === 'trang thai' || norm.includes('trang thai')) {
      defaultWidth = 110;
      defaultAlign = 'center';
    } else if (norm.includes('so luong') || norm === 'sl') {
      defaultWidth = 65;
      defaultAlign = 'right';
    }

    return {
      id: colId,
      originalIndex: idx,
      label: h,
      visible: true,
      align: defaultAlign,
      wrap: defaultWrap,
      width: defaultWidth,
      fixed: false
    };
  });
}

function openWameliCustomizer() {
  if (!state.head.length) {
    toast('Chưa có dữ liệu bảng để tuỳ chỉnh. Hãy lấy dữ liệu trước.', 'info');
    return;
  }
  const tableConfigId = 'wTable_' + kind();
  const defaultCols = buildWameliDefaultCols(state.head);
  const currentConfig = getTableConfig(tableConfigId, defaultCols);

  openColumnCustomizerModal({
    tableId: 'wTable',
    storageKey: tableConfigId,
    tableName: kind() === 'products' ? 'Sản phẩm WML' : 'Đơn xuất kho WML',
    defaultCols,
    currentConfig,
    onSave: (newCfg) => {
      saveTableConfig(tableConfigId, newCfg);
      render();
    }
  });
}

function filtered() {
  const q = $('#wSearch').value.trim().toLowerCase();
  if (!q) return state.rows;
  return state.rows.filter((r) => r.join(' ').toLowerCase().includes(q));
}

function render() {
  const list = filtered();
  $('#wCount').textContent = list.length;
  $('#wSource').textContent = state.source;

  const tableConfigId = 'wTable_' + kind();
  const defaultCols = buildWameliDefaultCols(state.head);
  const config = getTableConfig(tableConfigId, defaultCols);

  if (state.head.length) {
    const theadHtml = config.map((c) => `<th data-col="${c.id}">${esc(c.label)}</th>`).join('') +
      `<th class="th-settings-gear" title="Tuỳ chỉnh chi tiết các cột">⚙️</th>`;
    $('#wTable thead').innerHTML = `<tr>${theadHtml}</tr>`;
  } else {
    $('#wTable thead').innerHTML = '';
  }

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const rows = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  if (rows.length) {
    $('#wTable tbody').innerHTML = rows.map((r) =>
      `<tr>${config.map((c) => `<td data-col="${c.id}">${esc(r[c.originalIndex] ?? '')}</td>`).join('')}<td style="width:32px;min-width:32px;max-width:32px;padding:0;"></td></tr>`
    ).join('');
  } else {
    $('#wTable tbody').innerHTML = `<tr><td colspan="${Math.max(1, config.length + 1)}" class="muted">${state.rows.length ? 'Không có dòng khớp.' : 'Chưa có dữ liệu.'}</td></tr>`;
  }

  $('#wPager').innerHTML = pages > 1
    ? `<button class="btn small" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹ Trước</button>
       <span>Trang ${state.page}/${pages}</span>
       <button class="btn small" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>Sau ›</button>`
    : '';

  if (state.head.length) {
    applyTableStyles('wTable', config);
    attachColumnResizers('wTable', (newCfg) => {
      saveTableConfig(tableConfigId, newCfg);
    }, tableConfigId);

    const gear = $('#wTable thead .th-settings-gear');
    if (gear) {
      gear.onclick = openWameliCustomizer;
    }
  }
}

// ---------- Lấy dữ liệu ----------
function filterOpts() {
  const opts = { kind: kind(), keyword: $('#wKeyword').value.trim() };
  if (kind() === 'orders') {
    opts.from = toWameliDate($('#wFrom').value);
    opts.to = toWameliDate($('#wTo').value);
  }
  return opts;
}

async function loadExcel(task) {
  status('Đang yêu cầu Wameli xuất file Excel (có thể mất tới 1–2 phút)...');
  const opts = filterOpts();
  // Áp bộ lọc trước (Wameli lưu bộ lọc theo phiên), rồi xuất file
  const first = await wameli.filter(opts);
  status(`Wameli có ${first.total} dòng khớp bộ lọc. Đang xuất file...`);
  await sleep(2000);
  const res = await wameli.exportExcel(task, opts);
  const { head, rows } = splitHeader(await readXlsx(base64ToBuffer(res.base64)));
  const fileName = { excel_misa: 'Misa', excel_nhat: 'Nhặt', export: 'Excel sản phẩm' }[task] || task;
  setData(head, rows, `Nguồn: file ${fileName} (${Math.round(res.size / 1024)} KB) – Wameli báo ${first.total} ${kindLabel()}`);
  status(`Xong: ${rows.length} dòng từ file Excel.`, '');
  toast(`Đã lấy & lưu ${rows.length} dòng vào bộ nhớ máy`, 'success');
}

async function loadPages() {
  const delay = Math.max(3, Number($('#wDelay').value) || 5) * 1000;
  const maxPages = Math.max(1, Number($('#wMaxPages').value) || 20);
  status('Đang áp bộ lọc trên Wameli...');
  const first = await wameli.filter(filterOpts());
  const { head } = cleanTable(first.head, []);
  const all = cleanTable(first.head, first.rows).rows;
  const lastPage = Math.min(first.maxPage || 1, maxPages);
  setData(head, all, `Nguồn: đọc trang – Wameli báo ${first.total} dòng`);
  for (let p = 2; p <= lastPage && !state.stop; p++) {
    status(`Đã lấy ${all.length}/${first.total} dòng. Nghỉ ${delay / 1000}s rồi đọc trang ${p}/${lastPage}...`);
    await sleep(delay);
    if (state.stop) break;
    const res = await wameli.page(p, kind());
    all.push(...cleanTable(res.head, res.rows).rows);
    render();
  }
  const more = first.maxPage > lastPage ? ` (còn ${first.maxPage - lastPage} trang chưa đọc – tăng "Tối đa" nếu cần)` : '';
  status(`${state.stop ? 'Đã dừng' : 'Xong'}: ${all.length}/${first.total} dòng${more}.`);
  saveDataCache();
  toast(`Đã lấy & lưu ${all.length} dòng vào bộ nhớ máy`, 'success');
}

async function checkAutoSyncSheet() {
  if (kind() !== 'products') return;
  const isAuto = $('#wAutoSyncSheet')?.checked;
  if (!isAuto) return;
  await saveToSheet(true);
}

async function quickSync() {
  if (state.loading) return;
  const syncChk = $('#wAutoSyncSheet');
  const oldVal = syncChk ? syncChk.checked : false;
  if (syncChk) syncChk.checked = true;
  await load();
  if (syncChk && !oldVal) syncChk.checked = false;
}

let autoPeriodicTimer = null;
let scheduledDailyCheckTimer = null;

function setupPeriodicSync() {
  if (autoPeriodicTimer) {
    clearInterval(autoPeriodicTimer);
    autoPeriodicTimer = null;
  }
  if (scheduledDailyCheckTimer) {
    clearInterval(scheduledDailyCheckTimer);
    scheduledDailyCheckTimer = null;
  }

  const isEnabled = $('#wAutoPeriodic')?.checked;
  if (!isEnabled || pageKind !== 'products') return;

  const numVal = Math.max(0.05, parseFloat($('#wAutoHoursInput')?.value) || 1);
  const unit = $('#wAutoUnit')?.value || 'hours';
  const minutes = unit === 'minutes' ? numVal : numVal * 60;
  const ms = Math.max(5000, minutes * 60 * 1000);

  const specificTimesRaw = ($('#wSpecificTimesInput')?.value || '').trim();
  const specificTimes = specificTimesRaw
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter((t) => /^([01]?\d|2[0-3]):([0-5]\d)$/.test(t))
    .map((t) => {
      const [h, m] = t.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    });

  // 1. Chạy theo chu kỳ số giờ/phút người dùng nhập
  if (ms > 0) {
    console.log(`[Wameli] Bật chạy định kỳ mỗi ${numVal} ${unit === 'minutes' ? 'phút' : 'giờ'} (${Math.round(ms / 1000)}s)`);
    autoPeriodicTimer = setInterval(() => {
      if (!state.loading && pageKind === 'products') {
        console.log('[Wameli] Bắt đầu tự động đồng bộ theo chu kỳ...');
        load();
      }
    }, ms);
  }

  // 2. Chạy theo các mốc khung giờ cố định trong ngày (nếu có điền)
  if (specificTimes.length > 0) {
    let lastTriggeredMinute = '';
    console.log(`[Wameli] Đã cài đặt khung giờ cố định: ${specificTimes.join(', ')}`);
    scheduledDailyCheckTimer = setInterval(() => {
      if (state.loading || pageKind !== 'products') return;
      const now = new Date();
      const currentHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (specificTimes.includes(currentHm) && lastTriggeredMinute !== currentHm) {
        lastTriggeredMinute = currentHm;
        console.log(`[Wameli] Bắt đầu tự động đồng bộ theo khung giờ ${currentHm}...`);
        load();
      }
    }, 15000);
  }
}

async function initAutoSyncSettings() {
  const stored = await chrome.storage.local.get([
    'wml_auto_sync_sheet',
    'wml_auto_load_open',
    'wml_auto_periodic',
    'wml_auto_hours',
    'wml_auto_unit',
    'wml_specific_times',
    'wml_last_sync_info'
  ]);

  const chkSync = $('#wAutoSyncSheet');
  if (chkSync) {
    chkSync.checked = stored.wml_auto_sync_sheet !== undefined ? !!stored.wml_auto_sync_sheet : true;
    chkSync.onchange = () => {
      chrome.storage.local.set({ wml_auto_sync_sheet: chkSync.checked });
      toast(chkSync.checked ? 'Đã bật: Tự động lưu SP mới vào Sheet DS_SP' : 'Đã tắt tự động lưu DS_SP', 'info');
    };
  }

  const chkOpen = $('#wAutoLoadOnOpen');
  if (chkOpen) {
    chkOpen.checked = !!stored.wml_auto_load_open;
    chkOpen.onchange = () => {
      chrome.storage.local.set({ wml_auto_load_open: chkOpen.checked });
      toast(chkOpen.checked ? 'Đã bật: Tự động lấy khi mở tab' : 'Đã tắt tự động lấy khi mở tab', 'info');
    };
  }

  const chkPeriodic = $('#wAutoPeriodic');
  const inpVal = $('#wAutoHoursInput');
  const selUnit = $('#wAutoUnit');
  const inpSpecific = $('#wSpecificTimesInput');

  if (inpVal && stored.wml_auto_hours !== undefined) {
    inpVal.value = stored.wml_auto_hours;
  }
  if (selUnit && stored.wml_auto_unit) {
    selUnit.value = stored.wml_auto_unit;
  }
  if (inpSpecific && stored.wml_specific_times) {
    inpSpecific.value = stored.wml_specific_times;
  }

  const updatePeriodicConfig = () => {
    const num = parseFloat(inpVal?.value) || 1;
    const unit = selUnit?.value || 'hours';
    const specific = inpSpecific?.value || '';
    chrome.storage.local.set({
      wml_auto_hours: num,
      wml_auto_unit: unit,
      wml_specific_times: specific
    });
    if (chkPeriodic?.checked) setupPeriodicSync();
  };

  if (inpVal) inpVal.onchange = updatePeriodicConfig;
  if (selUnit) selUnit.onchange = updatePeriodicConfig;
  if (inpSpecific) inpSpecific.onchange = updatePeriodicConfig;

  if (chkPeriodic) {
    chkPeriodic.checked = !!stored.wml_auto_periodic;
    chkPeriodic.onchange = () => {
      chrome.storage.local.set({ wml_auto_periodic: chkPeriodic.checked });
      setupPeriodicSync();
      const num = parseFloat(inpVal?.value) || 1;
      const unit = selUnit?.value === 'minutes' ? 'phút' : 'giờ';
      toast(chkPeriodic.checked ? `Đã bật tự động đồng bộ định kỳ (mỗi ${num} ${unit})` : 'Đã tắt tự động chạy định kỳ', 'info');
    };
  }

  if (stored.wml_last_sync_info && $('#wLastSyncInfo')) {
    $('#wLastSyncInfo').textContent = stored.wml_last_sync_info;
  }

  if (pageKind === 'products') {
    if (chkPeriodic?.checked) {
      setupPeriodicSync();
    }
    if (chkOpen?.checked && !state.loading) {
      setTimeout(() => { load(); }, 600);
    }
  }
}

async function load() {
  if (state.loading) return;
  if (kind() === 'orders' && (!$('#wFrom').value || !$('#wTo').value)) return toast('Chọn Từ ngày và Đến ngày', 'error');
  state.loading = true;
  state.stop = false;
  $('#wLoad').disabled = true;
  if ($('#wQuickSync')) $('#wQuickSync').disabled = true;
  $('#wStop').classList.remove('hidden');
  try {
    const mode = $('#wMode').value;
    if (mode === 'pages') await loadPages();
    else await loadExcel(mode);
    if (kind() === 'products') {
      await checkAutoSyncSheet();
    }
  } catch (e) {
    // Gặp lỗi (bị chặn, quá thời gian...) thì dừng hẳn, không thử lại dồn dập
    status(`Dừng do lỗi: ${e.message}. Đợi 15–30 phút rồi thử lại, hoặc tự xuất file trên Wameli và nhập vào ô bên trên.`, 'err');
    toast(e.message, 'error');
  } finally {
    state.loading = false;
    $('#wLoad').disabled = false;
    if ($('#wQuickSync')) $('#wQuickSync').disabled = false;
    $('#wStop').classList.add('hidden');
    render();
  }
}

async function importFile(file) {
  try {
    const { head, rows } = splitHeader(await readXlsx(await file.arrayBuffer()));
    setData(head, rows, `Nguồn: file ${file.name}`);
    status(`Đã đọc ${rows.length} dòng từ ${file.name}.`);
    toast(`Đã đọc & lưu ${rows.length} dòng vào bộ nhớ máy`, 'success');
    if (kind() === 'products') {
      await checkAutoSyncSheet();
    }
  } catch (e) {
    toast('Không đọc được file: ' + e.message, 'error');
  }
}

function exportCsv() {
  const list = filtered();
  if (!list.length) return toast('Không có dữ liệu để xuất', 'error');
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [state.head.map(cell).join(','), ...list.map((r) => r.map(cell).join(','))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = kind() === 'products' ? `wameli-san-pham-${today}.csv` : `wameli-don-${$('#wFrom').value}_${$('#wTo').value}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Sự kiện ----------
const today = new Date().toISOString().slice(0, 10);
$('#wFrom').value = today;
$('#wTo').value = today;
const pageKind = new URLSearchParams(location.search).get('kind') === 'products' ? 'products' : 'orders';
$('#wKind').value = pageKind;
document.querySelector(`.nav-tab[data-nav="${pageKind}"]`)?.classList.add('active');
document.title = pageKind === 'products' ? 'Sản phẩm WML' : 'Đơn xuất kho WML';
$('.brand').textContent = pageKind === 'products' ? '🧾 Sản phẩm WML' : '🏬 Đơn xuất kho WML';
$('#upCard').classList.toggle('hidden', pageKind === 'products');
$('#wToSheet').classList.toggle('hidden', pageKind !== 'products');
$('#wQuickSync')?.classList.toggle('hidden', pageKind !== 'products');
$('#wAutoSyncBar')?.classList.toggle('hidden', pageKind !== 'products');
$('#wKind').onchange = syncKind;
$('#wMode').onchange = syncMode;
syncKind();
$('#wToSheet').onclick = () => saveToSheet(false);
if ($('#wQuickSync')) $('#wQuickSync').onclick = quickSync;
restoreDataCache().catch(() => {});
if (pageKind === 'products') {
  initAutoSyncSettings();
}
$('#wLoad').onclick = load;
$('#wStop').onclick = () => { state.stop = true; status('Sẽ dừng sau trang đang đọc...'); };
$('#wFile').onchange = (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; };
let t = null;
$('#wSearch').oninput = () => { clearTimeout(t); t = setTimeout(() => { state.page = 1; render(); }, 250); };
$('#wPager').onclick = (e) => {
  const b = e.target.closest('button[data-page]');
  if (!b) return;
  state.page = Number(b.dataset.page);
  render();
};
$('#wCsv').onclick = exportCsv;
if ($('#wColCustom')) $('#wColCustom').onclick = openWameliCustomizer;
render();
