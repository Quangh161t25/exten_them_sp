// TC Extension - trang danh sách: dán link shop -> tải và hiển thị toàn bộ SP (ảnh chính + tên)
const $ = (s) => document.querySelector(s);
const state = { data: null, selected: new Set() };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const imageUrl = (id, thumb) => !id ? '' : id.startsWith('http') ? id : `https://down-vn.img.susercontent.com/file/${id}${thumb ? '_tn' : ''}`;

function parseShop(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return { shopId: s };
  try {
    const u = new URL(s.startsWith('http') ? s : 'https://' + s);
    if (!/shopee\./.test(u.hostname)) throw 0;
    const path = decodeURIComponent(u.pathname);
    let m = path.match(/^\/shop\/(\d+)/);
    if (m) return { shopId: m[1] };
    m = path.match(/-i\.(\d+)\.(\d+)/);
    if (m) return { shopId: m[1] };
    m = path.match(/^\/([\w.\-]+)\/?$/);
    if (m) return { username: m[1] };
  } catch (e) {
    if (/^[\w.\-]+$/.test(s)) return { username: s };
  }
  return null;
}

function status(text, err = false) {
  $('#status').textContent = text;
  $('#status').className = err ? 'err' : 'muted';
}

function filtered() {
  const q = $('#search').value.trim().toLowerCase();
  const items = state.data ? state.data.items : [];
  return q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items;
}

function render() {
  const list = filtered();
  $('#count').textContent = list.length;
  $('#selCount').textContent = state.selected.size;
  const shopId = state.data.shopId;
  $('#tbody').innerHTML = list.map((it) => `
    <tr>
      <td><input type="checkbox" data-id="${esc(it.itemId)}" ${state.selected.has(it.itemId) ? 'checked' : ''}></td>
      <td class="idx">${it.stt}</td>
      <td class="img"><a href="${esc(imageUrl(it.image))}" target="_blank"><img loading="lazy" src="${esc(imageUrl(it.image, true))}" alt=""></a></td>
      <td class="name"><a href="https://shopee.vn/product/${esc(shopId)}/${esc(it.itemId)}" target="_blank">${esc(it.name)}</a><div class="id">ID ${esc(it.itemId)}</div></td>
      <td><button class="report" data-report="${esc(it.itemId)}" title="Mở sản phẩm, tự điền form Tố cáo và tự động bấm Gửi">🚩 Tố cáo</button></td>
    </tr>`).join('');
  $('#chkAll').checked = list.length > 0 && list.every((it) => state.selected.has(it.itemId));
}

function chosen() {
  const items = state.data ? state.data.items : [];
  return state.selected.size ? items.filter((it) => state.selected.has(it.itemId)) : filtered();
}

async function load() {
  const shop = parseShop($('#shopInput').value);
  if (!shop) return status('Link shop không hợp lệ. Dán link dạng https://shopee.vn/tenshop', true);
  $('#btnLoad').disabled = true;
  status('Đang tải danh sách sản phẩm...');
  chrome.runtime.sendMessage({ type: 'TC_FETCH_SHOP', ...shop }, (res) => {
    $('#btnLoad').disabled = false;
    if (chrome.runtime.lastError) return status('Lỗi: ' + chrome.runtime.lastError.message, true);
    if (!res || !res.ok) return status('Lỗi: ' + (res && res.error), true);
    res.data.items.forEach((it, i) => { it.stt = i + 1; });
    state.data = res.data;
    state.selected.clear();
    $('#result').hidden = false;
    status(`Shop ${res.data.shopName || res.data.shopId}: ${res.data.items.length} sản phẩm${res.data.total != null ? ' (Shopee báo ' + res.data.total + ')' : ''}`);
    render();
  });
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportCsv() {
  const list = chosen();
  const rows = [['STT', 'Tên sản phẩm', 'Link ảnh', 'Link sản phẩm', 'ID']];
  list.forEach((it) => rows.push([it.stt, it.name, imageUrl(it.image), `https://shopee.vn/product/${state.data.shopId}/${it.itemId}`, it.itemId]));
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `TC_${state.data.shopName || state.data.shopId}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function downloadImages() {
  const list = chosen();
  if (!list.length) return;
  if (!confirm(`Tải ${list.length} ảnh chính vào Downloads/TC_${state.data.shopName || state.data.shopId}/ ?`)) return;
  $('#btnImgs').disabled = true;
  status(`Đang tải ${list.length} ảnh...`);
  chrome.runtime.sendMessage({ type: 'TC_DOWNLOAD_IMAGES', shopName: state.data.shopName || state.data.shopId, items: list }, (res) => {
    $('#btnImgs').disabled = false;
    if (res && res.ok) status(`Đã tải ${res.ok}/${list.length} ảnh vào Downloads/${res.folder}`);
    else status('Lỗi tải ảnh: ' + ((res && res.error) || chrome.runtime.lastError?.message), true);
  });
}

async function copyNames() {
  const text = chosen().map((it) => it.name).join('\n');
  await navigator.clipboard.writeText(text);
  status(`Đã copy ${chosen().length} tên sản phẩm`);
}

$('#btnLoad').onclick = load;
$('#shopInput').onkeydown = (e) => { if (e.key === 'Enter') load(); };
$('#search').oninput = render;
$('#btnCsv').onclick = exportCsv;
$('#btnImgs').onclick = downloadImages;
$('#btnCopy').onclick = copyNames;
$('#tbody').onchange = (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  e.target.checked ? state.selected.add(id) : state.selected.delete(id);
  $('#selCount').textContent = state.selected.size;
};
$('#chkAll').onchange = (e) => {
  filtered().forEach((it) => (e.target.checked ? state.selected.add(it.itemId) : state.selected.delete(it.itemId)));
  render();
};

// Tự điền link shop từ tab đang mở (nếu là trang shop)
chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
  const url = tab && tab.url || '';
  const params = new URLSearchParams(location.search);
  const fromParam = params.get('shop');
  if (fromParam) { $('#shopInput').value = fromParam; load(); return; }
  if (/^https:\/\/shopee\.vn\/[\w.\-]+\/?(\?|$)/.test(url) || /shopee\.vn\/shop\/\d+/.test(url)) $('#shopInput').value = url;
});

// ===== Tố cáo =====
const DEFAULT_TEMPLATES = [
  'Dùng trái phép nhãn hiệu, không được tôi ủy quyền',
  'Sản phẩm giả mạo nhãn hiệu, không có ủy quyền bán',
  'Hàng nhái thương hiệu, vi phạm sở hữu trí tuệ',
  'Hàng giả không rõ nguồn gốc, xâm phạm nhãn hiệu',
  'Mạo danh hàng chính hãng, chưa được tôi cho phép'
];
const DEFAULT_REPORT = DEFAULT_TEMPLATES.join('\n');
const reportInput = $('#reportText');
const chkAutoSend = $('#chkAutoSend');
const btnReset = $('#btnResetTemplates');
const minDelayInput = $('#minDelay');
const maxDelayInput = $('#maxDelay');

chrome.storage.local.get(['tcReportText', 'tcAutoSend', 'tcMinDelay', 'tcMaxDelay'], (res) => {
  reportInput.value = res.tcReportText || DEFAULT_REPORT;
  if (chkAutoSend) chkAutoSend.checked = res.tcAutoSend !== false;
  if (minDelayInput) minDelayInput.value = res.tcMinDelay ?? 20;
  if (maxDelayInput) maxDelayInput.value = res.tcMaxDelay ?? 40;
});
reportInput.oninput = () => {
  chrome.storage.local.set({ tcReportText: reportInput.value.trim() });
};
if (btnReset) {
  btnReset.onclick = () => {
    reportInput.value = DEFAULT_REPORT;
    chrome.storage.local.set({ tcReportText: DEFAULT_REPORT });
  };
}
if (chkAutoSend) {
  chkAutoSend.onchange = () => {
    chrome.storage.local.set({ tcAutoSend: chkAutoSend.checked });
  };
}
if (minDelayInput) {
  minDelayInput.onchange = () => {
    let min = Math.max(1, parseInt(minDelayInput.value, 10) || 20);
    minDelayInput.value = min;
    chrome.storage.local.set({ tcMinDelay: min });
  };
}
if (maxDelayInput) {
  maxDelayInput.onchange = () => {
    let max = Math.max(1, parseInt(maxDelayInput.value, 10) || 40);
    maxDelayInput.value = max;
    chrome.storage.local.set({ tcMaxDelay: max });
  };
}

$('#tbody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-report]');
  if (!b) return;
  const lines = reportInput.value.trim().split('\n').map((l) => l.trim()).filter((l) => l.length >= 10);
  if (!lines.length) return status('Nội dung tố cáo cần ít nhất 1 dòng có từ 10 ký tự trở lên', true);
  chrome.tabs.create({ url: `https://shopee.vn/product/${state.data.shopId}/${b.dataset.report}?tc_report=1` });
  b.textContent = '✓ Đã mở';
});

$('#btnReportSel').onclick = () => {
  const items = state.data ? state.data.items.filter((it) => state.selected.has(it.itemId)) : [];
  if (!items.length) return status('Hãy tích chọn các sản phẩm cần tố cáo trước', true);
  const lines = reportInput.value.trim().split('\n').map((l) => l.trim()).filter((l) => l.length >= 10);
  if (!lines.length) return status('Nội dung tố cáo cần ít nhất 1 dòng có từ 10 ký tự trở lên', true);
  const autoTxt = chkAutoSend?.checked ? 'tự động bấm "Gửi Tố Cáo"' : 'bạn xem lại và bấm "Gửi Tố Cáo"';
  const minVal = parseInt(minDelayInput?.value, 10) || 20;
  const maxVal = parseInt(maxDelayInput?.value, 10) || 40;
  if (!confirm(`Mở lần lượt ${items.length} sản phẩm để tố cáo?
Mỗi sản phẩm: tool tự chọn ngẫu nhiên 1 trong 5 nội dung, ${autoTxt}.
Khoảng nghỉ giữa các sản phẩm: ngẫu nhiên từ ${minVal} đến ${maxVal} giây → tự sang sản phẩm tiếp theo.`)) return;
  chrome.runtime.sendMessage({ type: 'TC_QUEUE_START', shopId: state.data.shopId, items: items.map((it) => ({ itemId: it.itemId, name: it.name })) });
  status(`Đã bắt đầu tố cáo lần lượt ${items.length} sản phẩm (xem tab Shopee vừa mở)`);
};

// Cập nhật tiến độ khiếu nại trên giao diện bảng điều khiển
setInterval(async () => {
  const r = await chrome.storage.local.get('tcReportQueue').catch(() => ({}));
  const q = r.tcReportQueue;
  if (q && Array.isArray(q.items) && q.items.length) {
    status(`Tiến độ khiếu nại: Đã gửi xong ${q.done || 0}/${q.items.length} SP (đang xử lý SP ${q.index + 1})`);
  }
}, 2000);
