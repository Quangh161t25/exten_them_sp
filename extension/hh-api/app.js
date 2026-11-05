import { request, getShopInfo } from '../clone-tool/shopee-api.js';
import { getTableConfig, saveTableConfig, applyTableStyles, tagAndReorderDOM, openColumnCustomizerModal } from '../order-tool/table-customizer.js';
// returns.js nạp bằng <script> trước file này (dùng chung với service worker)
const { timeValue, LIST_PATH, LIST_BODY, PAGE_SIZE, MAX_PAGES, HEADERS, TYPES, caseToRows, sheetRecords } = self.HHReturns;

const $ = (s) => document.querySelector(s);

// Tùy chỉnh cột (ẩn/hiện, thứ tự, độ rộng) — dùng chung table-customizer với Đơn Shopee
const HH_COLS = [{"id":"c_gian","label":"Gian / Loại","defaultWidth":130},{"id":"c_order","label":"Mã đơn / Yêu cầu","defaultWidth":130},{"id":"c_product","label":"Sản phẩm","defaultWidth":260},{"id":"c_qty","label":"SL","defaultWidth":60},{"id":"c_status","label":"Trạng thái","defaultWidth":130},{"id":"c_reason","label":"Lý do / Phương án","defaultWidth":130},{"id":"c_refund","label":"Tiền hoàn","defaultWidth":130},{"id":"c_track","label":"Vận đơn","defaultWidth":130},{"id":"c_logistics","label":"Cập nhật VC","defaultWidth":130},{"id":"c_order_date","label":"Ngày đặt đơn","defaultWidth":130},{"id":"c_return_date","label":"Ngày hoàn hàng","defaultWidth":130}];
function applyCols() {
  const cfg = getTableConfig('hhTable', HH_COLS);
  applyTableStyles('hhTable', cfg);
  tagAndReorderDOM('hhTable', cfg);
}
$('#btn-cols').onclick = () => openColumnCustomizerModal({
  tableId: 'hhTable', tableName: 'Hàng hoàn API', defaultCols: HH_COLS,
  currentConfig: getTableConfig('hhTable', HH_COLS),
  onSave: (cfg) => { saveTableConfig('hhTable', cfg); render(); }
});

const PER_PAGE = 100;
const CODE_KEYS = ['hh_api_code', 'tcdd-shop-code', 'maGian', 'dhHoanTextValue'];

let view = 'web';
let webValues = [];   // dòng đọc từ Shopee (chưa ghi), cùng thứ tự HEADERS
let webShop = null;
let sheetValues = [];
let busy = false;
let gianChosen = false; // đã tự chọn gian ở tab Sheet thì không tự đổi nữa
let stop = false;
const filter = { web: { q: '', type: '', gian: '', page: 1 }, sheet: { q: '', type: '', gian: '', page: 1 } };

const toRecord = (row) => Object.fromEntries(HEADERS.map((h, i) => [h, row[i] ?? '']));
const records = () => (view === 'web' ? (webValues.length ? webValues : autoRows).map(toRecord) : sheetRecords(sheetValues));

function setStatus(text, type = '') {
  const el = $('#status');
  el.textContent = text;
  el.className = 'status ' + type;
}

function cell(...parts) {
  const td = document.createElement('td');
  parts.forEach(([tag, text, cls]) => {
    if (!text && tag !== 'div') return;
    const el = document.createElement(tag);
    el.textContent = text ?? '';
    if (cls) el.className = cls;
    td.appendChild(el);
  });
  return td;
}

function render() {
  const f = filter[view];
  const q = f.q.trim().toLowerCase();
  const list = records().filter((r) => (!f.type || r['Loại'] === f.type)
    && (!f.gian || r['Mã gian'] === f.gian)
    && (!q || HEADERS.some((h) => String(r[h] ?? '').toLowerCase().includes(q))));
  if (view === 'sheet') list.sort((a, b) => timeValue(b['Ngày đặt đơn']) - timeValue(a['Ngày đặt đơn']) || timeValue(b['Ngày hoàn hàng']) - timeValue(a['Ngày hoàn hàng']));

  // Lọc theo loại kèm số lượng
  const counts = {};
  records().forEach((r) => { counts[r['Loại']] = (counts[r['Loại']] || 0) + 1; });
  const types = ['', ...Object.values(TYPES), ...Object.keys(counts).filter((t) => !Object.values(TYPES).includes(t))];
  $('#type-filter').replaceChildren(...types.map((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (f.type === t ? ' on' : '');
    b.textContent = `${t || 'Tất cả'} (${t ? counts[t] || 0 : records().length})`;
    b.onclick = () => { f.type = t; f.page = 1; render(); };
    return b;
  }));

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  f.page = Math.min(f.page, pages);
  const body = $('#rows');
  body.replaceChildren();
  for (const r of list.slice((f.page - 1) * PER_PAGE, f.page * PER_PAGE)) {
    const tr = document.createElement('tr');
    const order = cell(['div', r['Mã đơn']], ['small', r['Mã yêu cầu'] ? 'YC: ' + r['Mã yêu cầu'] : ''], ['small', r['Người mua']]);
    if (r['Link đơn']) {
      const a = document.createElement('a');
      a.href = r['Link đơn'];
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = order.firstChild.textContent;
      order.firstChild.replaceChildren(a);
    }
    tr.append(
      cell(['b', r['Mã gian']], ['span', r['Loại'], 'type']),
      order,
      cell(['div', r['Tên sản phẩm']], ['small', r['Phân loại']], ['code', r['SKU phân loại'] || r['SKU sản phẩm']]),
      cell(['div', String(r['Số lượng'] ?? '')]),
      cell(['div', r['Trạng thái']], ['small', r['Ghi chú trạng thái']]),
      cell(['div', r['Lý do']], ['small', r['Phương án']]),
      cell(['div', r['Tiền hoàn']]),
      cell(['div', 'Giao: ' + (r['Vận đơn giao'] || '—')], ['small', r['Trạng thái giao']], ['div', 'Hoàn: ' + (r['Vận đơn hoàn'] || '—')], ['small', r['Trạng thái hoàn']]),
      cell(['div', r['Cập nhật vận chuyển']]),
      cell(['div', r['Ngày đặt đơn']]),
      cell(['div', r['Ngày hoàn hàng']])
    );
    tr.querySelectorAll(':scope > td').forEach((td, i) => { td.dataset.col = HH_COLS[i].id; });
    body.appendChild(tr);
  }
  if (!list.length) {
    const td = document.createElement('td');
    td.colSpan = 11;
    td.className = 'empty';
    td.textContent = records().length ? 'Không có dòng phù hợp bộ lọc.' : (view === 'web' ? 'Chưa đọc đơn từ Shopee.' : 'Chưa có dữ liệu Sheet.');
    const tr = document.createElement('tr');
    tr.appendChild(td);
    body.appendChild(tr);
  }
  applyCols();
  $('#page-info').textContent = `Trang ${f.page}/${pages} · ${list.length} dòng`;
  $('#prev').disabled = f.page <= 1;
  $('#next').disabled = f.page >= pages;
}

function showView(v) {
  view = v;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === v));
  $('#bar-web').hidden = v !== 'web';
  $('#page-limit-hint').hidden = v !== 'web';
  $('#bar-auto').hidden = v !== 'web';
  $('#bar-sync').hidden = v !== 'web';
  $('#bar-sheet').hidden = v !== 'sheet';
  $('#search').value = filter[v].q;
  if (v === 'sheet' && !sheetValues.length) readSheet();
  render();
}

// ---------- Tab 1: đọc từ Shopee ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Shopee thỉnh thoảng trả lỗi tạm thời khi đọc liên tục nhiều trang: thử lại tối đa 3 lần
async function readPage(page) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request('POST', LIST_PATH, { body: { ...LIST_BODY, page_number: page } });
    } catch (e) {
      if (attempt >= 3 || stop) throw e;
      setStatus(`Shopee báo lỗi ở trang ${page}, thử lại lần ${attempt + 1}...`);
      await sleep(1500 * (attempt + 1));
    }
  }
}

async function readShopee() {
  if (busy) return;
  const code = $('#code').value.trim().toUpperCase();
  if (!code) return setStatus('Nhập Mã gian (mã shop như GDD, JOY) trước khi đọc.', 'err');
  const pageLimit = Number($('#page-limit').value);
  if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > MAX_PAGES) {
    return setStatus(`Nhập số trang lấy là số nguyên từ 1 đến ${MAX_PAGES}.`, 'err');
  }
  busy = true;
  stop = false;
  $('#btn-read').disabled = true;
  $('#page-limit').disabled = true;
  $('#btn-stop').hidden = false;
  try {
    await chrome.storage.local.set({ hh_api_page_limit: pageLimit });
    setStatus('Đang kết nối Shopee...');
    const shop = await getShopInfo();
    const syncedAt = new Date().toLocaleString('vi-VN');
    const seen = new Set();
    const rows = [];
    const cases = [];
    let total = null;
    let pagesRead = 0;
    let reachedEnd = false;
    for (let page = 1; page <= pageLimit; page++) {
      if (stop) throw new Error('Đã dừng. Chưa có gì được ghi vào Sheet.');
      const data = await readPage(page);
      pagesRead = page;
      const list = (data && data.exceptional_case_list) || [];
      const reportedTotal = data?.total ?? data?.pagination_info?.total;
      if (reportedTotal != null && Number.isFinite(Number(reportedTotal))) total = Number(reportedTotal);
      for (const c of list) {
        const id = String(c.entity_id_str || '');
        if (id && seen.has(id)) continue;
        seen.add(id);
        cases.push(c);
      }
      setStatus(`Đang đọc trang ${page}/${pageLimit}: ${seen.size}${total != null ? '/' + total : ''} yêu cầu...`);
      if (list.length < PAGE_SIZE || data?.pagination_info?.has_more === false || (total != null && seen.size >= total)) { reachedEnd = true; break; }
      if (page < pageLimit) await sleep(250);
    }
    cases.forEach((c) => rows.push(...caseToRows(c, { code, shopId: shop.shopId, syncedAt })));
    webValues = rows;
    // Lưu bảng vừa đọc để tự điền HH_SHOP_DIEN dùng (kể cả khi đóng popup)
    chrome.storage.local.set({ hh_api_table: { at: Date.now(), code, rows } });
    webShop = { ...shop, code };
    chrome.storage.local.set({ hh_api_code: code });
    const limited = !reachedEnd && pagesRead >= pageLimit;
    const short = !limited && total != null && seen.size < total;
    setStatus(`${short ? '⚠️' : '✔'} Đã đọc ${pagesRead}/${pageLimit} trang, ${seen.size}${total != null ? '/' + total : ''} yêu cầu (${rows.length} dòng sản phẩm) của shop ${shop.name || shop.shopId}.`
      + (limited ? ` Đã dừng theo giới hạn ${pageLimit} trang bạn chọn; các trang còn lại chưa đọc.` : short ? ' Shopee trả chưa đủ so với tổng số yêu cầu.' : ' Đã đến cuối danh sách.')
      + ' Dùng khung "Ghi sang Google Sheet" để ghi.', short ? 'err' : 'ok');
    filter.web.page = 1;
    render();
  } catch (e) {
    setStatus('Không đọc được: ' + e.message, 'err');
  } finally {
    busy = false;
    $('#btn-read').disabled = false;
    $('#page-limit').disabled = false;
    $('#btn-stop').hidden = true;
  }
}

const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

const resultText = (r) => `${r.added} dòng mới, ${r.updated} dòng cập nhật, ${r.unchanged} dòng không đổi`;

// ---------- Ghi sang Google Sheet: HH API (hh) và HH_SHOP_DIEN (sd) dùng chung một cách làm ----------
// Lấy N đơn mới nhất trong bảng bên dưới: chưa có thì thêm, có rồi mà khác thì cập nhật.
const SYNC = {
  hh: { name: 'Sheet HH API', key: 'hh_api_sheet', last: 'hh_api_sheet_last', btn: '#btn-write', what: 'đơn' },
  sd: { name: 'HH_SHOP_DIEN', key: 'hh_shop_dien', last: 'hh_shop_dien_last', btn: '#btn-shop-dien', what: 'đơn Trả hàng + Giao không thành công' }
};
async function writeTarget(t) {
  const s = SYNC[t];
  if (busy) return;
  const code = $('#code').value.trim().toUpperCase(), count = parseInt($(`#${t}-count`).value, 10) || 50;
  if (!code) return setStatus('Nhập Mã gian trước.', 'err');
  if (!confirm(`Ghi ${count} ${s.what} mới nhất của gian ${code} (trong bảng bên dưới) sang ${s.name}?\nĐơn chưa có được thêm; đơn đã có mà khác thì cập nhật.`)) return;
  busy = true;
  $(s.btn).disabled = true;
  try {
    setStatus(`Đang so sánh với ${s.name} và ghi...`);
    const res = await send({ type: 'HH_API_SYNC_TOP', target: t, code, count });
    if (!res?.ok) throw new Error(res?.error || 'Không ghi được');
    if (t === 'hh') sheetValues = [];
    setStatus(`✔ ${s.name} (gian ${code}, ${res.orders} đơn): ${resultText(res)}.`, 'ok');
  } catch (e) {
    setStatus(`Không ghi được ${s.name}: ${e.message}`, 'err');
  } finally {
    busy = false;
    $(s.btn).disabled = false;
  }
}
function showSyncLast(t, l) {
  if (!l) return;
  const when = new Date(l.at).toLocaleString('vi-VN');
  $(`#${t}-last`).textContent = l.ok ? `Tự động lần gần nhất ${when}: thêm ${l.added}, cập nhật ${l.updated || 0}` : `Tự động lần gần nhất ${when} lỗi: ${l.error}`;
}
for (const t of Object.keys(SYNC)) {
  const s = SYNC[t];
  // Đổi cài đặt: lưu, đặt lại lịch và (nếu bật tự động) chạy ngay 1 lần
  const save = () => chrome.storage.local.set({ [s.key]: { count: $(`#${t}-count`).value, auto: $(`#${t}-auto`).checked, min: $(`#${t}-min`).value } })
    .then(() => send({ type: 'HH_API_SYNC_AUTO', target: t }));
  chrome.storage.local.get([s.key, s.last]).then((x) => {
    const c = x[s.key];
    if (c) { $(`#${t}-count`).value = c.count || 50; $(`#${t}-auto`).checked = !!c.auto; $(`#${t}-min`).value = c.min || 15; }
    showSyncLast(t, x[s.last]);
  });
  $(`#${t}-count`).onchange = $(`#${t}-min`).onchange = $(`#${t}-auto`).onchange = save;
  $(s.btn).onclick = () => writeTarget(t);
}
chrome.storage.onChanged.addListener((c) => { for (const t of Object.keys(SYNC)) if (c[SYNC[t].last]) showSyncLast(t, c[SYNC[t].last].newValue); });

// ---------- Tab 2: đọc từ Sheet ----------

async function readSheet() {
  $('#btn-sheet').disabled = true;
  setStatus('Đang đọc Sheet HH API...');
  try {
    const res = await send({ type: 'HH_API_READ' });
    if (!res?.ok) throw new Error(res?.error || 'Không đọc được Sheet');
    sheetValues = res.values || [];
    const gians = [...new Set(sheetRecords(sheetValues).map((r) => r['Mã gian']).filter(Boolean))].sort();
    $('#gian-filter').replaceChildren(new Option('Tất cả gian', ''), ...gians.map((g) => new Option(g, g)));
    // Mở tab Sheet lần đầu: lọc sẵn theo Mã gian đang dùng ở tab 1
    if (!gianChosen) filter.sheet.gian = $('#code').value.trim().toUpperCase();
    $('#gian-filter').value = gians.includes(filter.sheet.gian) ? filter.sheet.gian : '';
    filter.sheet.gian = $('#gian-filter').value;
    setStatus(res.missing || res.oldFormat
      ? 'Sheet HH API chưa có dữ liệu theo cấu trúc mới. Đọc từ Shopee rồi bấm "Ghi ngay" ở dòng HH API.'
      : `✔ Sheet HH API có ${sheetRecords(sheetValues).length} dòng.`, res.missing || res.oldFormat ? '' : 'ok');
  } catch (e) {
    setStatus('Không đọc được Sheet: ' + e.message, 'err');
  } finally {
    $('#btn-sheet').disabled = false;
    render();
  }
}

// ---------- Tự cập nhật 100 yêu cầu mới nhất ----------

function showAutoLast(last) {
  const el = $('#auto-last');
  if (!last) { el.textContent = 'Chưa chạy lần nào.'; return; }
  const when = last.at ? new Date(last.at).toLocaleString('vi-VN') : '';
  el.textContent = last.running ? 'Đang tự cập nhật...'
    : last.ok ? `Lần gần nhất ${when}: ${last.pages ? last.pages + ' trang, ' : ''}${last.cases} yêu cầu · ${resultText(last)}.`
    : `Lần gần nhất ${when}: ${last.error}`;
  // Chưa đọc tay thì bảng tab 1 hiện kết quả lần tự cập nhật gần nhất
  if (!webValues.length && Array.isArray(last.rows) && last.rows.length && !busy) {
    autoRows = last.rows;
    render();
  }
}

let autoRows = [];
async function saveAuto() {
  await chrome.storage.local.set({ hh_api_auto: { enabled: $('#auto-on').checked, time: $('#auto-time').value || '10:00' } });
  send({ type: 'HH_API_AUTO_CHECK' });
}

// ---------- Khởi động ----------

document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => showView(t.dataset.view); });
$('#btn-read').onclick = readShopee;
$('#btn-stop').onclick = () => { stop = true; };
$('#btn-sheet').onclick = readSheet;
$('#gian-filter').onchange = (e) => { gianChosen = true; filter.sheet.gian = e.target.value; filter.sheet.page = 1; render(); };
$('#search').oninput = (e) => { filter[view].q = e.target.value; filter[view].page = 1; render(); };
$('#prev').onclick = () => { filter[view].page--; render(); };
$('#next').onclick = () => { filter[view].page++; render(); };
$('#auto-on').onchange = saveAuto;
// Tab 2: đọc lại N yêu cầu mới nhất từ Shopee rồi cập nhật Sheet
$('#btn-top').onclick = async () => {
  const count = parseInt($('#top-count').value, 10);
  if (!(count >= 1)) return setStatus('Nhập số đơn cần cập nhật (từ 1).', 'err');
  chrome.storage.local.set({ hh_api_top_count: count });
  $('#btn-top').disabled = true;
  setStatus(`Đang đọc ${count} yêu cầu mới nhất từ Shopee và cập nhật Sheet...`);
  const res = await send({ type: 'HH_API_UPDATE_TOP', count });
  $('#btn-top').disabled = false;
  if (!res?.ok) return setStatus('Không cập nhật được: ' + (res?.error || ''), 'err');
  setStatus(`✔ Đã đọc ${res.cases} yêu cầu: ${resultText(res)}.`, 'ok');
  await readSheet();
};
$('#auto-time').onchange = saveAuto;
$('#btn-auto-run').onclick = async () => {
  $('#btn-auto-run').disabled = true;
  const res = await send({ type: 'HH_API_AUTO_RUN' });
  $('#btn-auto-run').disabled = false;
  if (!res?.ok) setStatus('Không tự cập nhật được: ' + (res?.error || ''), 'err');
};
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.hh_api_auto_last) showAutoLast(changes.hh_api_auto_last.newValue);
});
chrome.storage.local.get(['hh_api_auto', 'hh_api_auto_last', 'hh_api_top_count']).then((store) => {
  if (Number(store.hh_api_top_count) >= 1) $('#top-count').value = String(store.hh_api_top_count);
  const auto = { enabled: true, time: '10:00', ...(store.hh_api_auto || {}) };
  $('#auto-on').checked = auto.enabled;
  $('#auto-time').value = auto.time;
  showAutoLast(store.hh_api_auto_last);
});
// Quá giờ mà hôm nay chưa cập nhật thì chạy bù khi mở trang
send({ type: 'HH_API_AUTO_CHECK' });

chrome.storage.local.get([...CODE_KEYS, 'hh_api_page_limit']).then((store) => {
  $('#code').value = String(CODE_KEYS.map((k) => store[k]).find((v) => String(v || '').trim()) || '').trim().toUpperCase();
  const savedLimit = Number(store.hh_api_page_limit);
  if (Number.isInteger(savedLimit) && savedLimit >= 1 && savedLimit <= MAX_PAGES) $('#page-limit').value = String(savedLimit);
});
render();
// Tự cập nhật dùng Số trang lấy đang điền
$('#page-limit').addEventListener('change', () => {
  const n = parseInt($('#page-limit').value, 10);
  if (n >= 1 && n <= MAX_PAGES) chrome.storage.local.set({ hh_api_page_limit: n });
});
