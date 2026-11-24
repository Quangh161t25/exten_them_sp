// Trang Hẹn giờ sao chép: thêm lịch (link × gian × thời gian) và xem trạng thái từ sheet HEN_GIO_SAO_CHEP.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const send = (msg) => chrome.runtime.sendMessage(msg);
const p2 = (n) => String(n).padStart(2, '0');
// datetime-local "2026-11-10T09:00" -> "10/11/2026 09:00"
const toSheetTime = (v) => { const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : ''; };
let rows = [];

const ONKEY = 'csch_gian_on';
const loadOn = () => { try { return JSON.parse(localStorage.getItem(ONKEY) || '{}'); } catch { return {}; } };
const saveOn = () => { try { localStorage.setItem(ONKEY, JSON.stringify(Object.fromEntries([...document.querySelectorAll('.gian-row')].map((d) => [d.querySelector('[data-k=gian]').value.trim().toUpperCase(), d.querySelector('[data-k=on]').checked])))); } catch {} };
function addGianRow(code = '', time = '', on = true) {
  const d = document.createElement('div');
  d.className = 'row gian-row';
  if (!time) { const t = new Date(Date.now() + 10 * 60e3); time = `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}T${p2(t.getHours())}:${p2(t.getMinutes())}`; }
  d.innerHTML = `<label title="Bật/tắt gian này"><input type="checkbox" data-k="on" ${on ? 'checked' : ''}> </label>Mã gian <input type="text" data-k="gian" value="${esc(code)}" placeholder="BCE"> đăng lúc <input type="datetime-local" data-k="time" value="${esc(time)}"> <button class="btn" data-del>✕</button>`;
  d.querySelector('[data-del]').onclick = () => { d.remove(); saveOn(); };
  d.querySelector('[data-k=on]').onchange = saveOn;
  $('#gians').appendChild(d);
}

$('#addGian').onclick = () => addGianRow();
$('#save').onclick = async () => {
  const links = $('#links').value.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\/(\w+\.)?shopee\.vn\//.test(s));
  const gians = [...document.querySelectorAll('.gian-row')].filter((d) => d.querySelector('[data-k=on]').checked).map((d) => ({ gian: d.querySelector('[data-k=gian]').value.trim().toUpperCase(), time: toSheetTime(d.querySelector('[data-k=time]').value) }))
    .filter((g) => g.gian && g.time);
  if (!links.length) return ($('#msg').textContent = 'Dán ít nhất 1 link sản phẩm shopee.vn.');
  if (!gians.length) return ($('#msg').textContent = 'Bật (tích) ít nhất 1 gian kèm thời gian đăng.');
  const add = links.flatMap((link) => gians.map((g) => ({ link, gian: g.gian, time: g.time })));
  $('#save').disabled = true;
  $('#msg').textContent = 'Đang ghi sheet…';
  const res = await send({ type: 'CSCH_ADD', rows: add });
  $('#save').disabled = false;
  $('#msg').textContent = res?.ok ? `✔ Đã thêm ${res.added} lịch (${links.length} link × ${gians.length} gian).` : 'Lỗi: ' + (res?.error || '');
  if (res?.ok) { $('#links').value = ''; load(); }
};

const stClass = (s) => (s === 'Đã đăng' ? 'ok' : s === 'Lỗi' ? 'err' : s === 'Đang đăng' ? 'run' : 'wait');
function render() {
  const f = $('#filter').value;
  const list = rows.filter((r) => r.link && (!f || (r.status || 'Chờ đăng') === f));
  $('#list').innerHTML = list.map((r) => `<tr data-row="${r.row}">
    <td>${esc(r.time)}</td><td><b>${esc(r.gian)}</b></td><td class="link"><a href="${esc(r.link)}" target="_blank">${esc(r.link.slice(0, 70))}</a></td>
    <td><span class="st ${stClass(r.status)}">${esc(r.status || 'Chờ đăng')}</span></td><td class="muted">${esc(r.result)}</td>
    <td><button class="btn" data-act="retry" title="Đặt lại Chờ đăng">↺</button> <button class="btn" data-act="del" title="Xoá lịch">✕</button></td></tr>`).join('')
    || '<tr><td colspan="6" class="muted">Chưa có lịch nào.</td></tr>';
}
async function load() {
  $('#info').textContent = 'Đang đọc sheet…';
  const res = await send({ type: 'CSCH_LIST' });
  if (!res?.ok) return ($('#info').textContent = 'Lỗi: ' + (res?.error || ''));
  const tv = (s) => { const m = String(s).match(/(\d+)\/(\d+)\/(\d+)\D+(\d+):(\d+)/); return m ? new Date(+m[3], m[2] - 1, +m[1], +m[4], +m[5]).getTime() : 0; };
  rows = res.rows.sort((x, y) => tv(y.time) - tv(x.time)); // mới nhất trước
  $('#info').textContent = `Gian đang dùng trên Chrome: ${res.gian || '(chưa đặt)'} · ${rows.filter((r) => r.link).length} lịch`;
  render();
}
$('#list').onclick = async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const row = Number(b.closest('tr').dataset.row);
  if (b.dataset.act === 'del' && !confirm('Xoá lịch này?')) return;
  await send(b.dataset.act === 'del' ? { type: 'CSCH_DELETE', row } : { type: 'CSCH_SET', row, status: 'Chờ đăng', result: '' });
  load();
};
$('#reload').onclick = load;
$('#filter').onchange = render;

// Danh sách gian lấy từ cột "gian" sheet CAI_DAT; mặc định chỉ bật gian đang dùng
(async () => {
  const st = await chrome.storage.local.get(['tcdd-shop-code', 'maGian', 'dhHoanTextValue']);
  const cur = String(st['tcdd-shop-code'] || st.maGian || st.dhHoanTextValue || '').toUpperCase();
  let list = [];
  try {
    const res = await send({ type: 'FETCH_CAI_DAT' });
    const v = res?.values || [];
    const ci = (v[0] || []).findIndex((h) => String(h).trim().toLowerCase() === 'gian');
    if (ci >= 0) list = [...new Set(v.slice(1).map((r) => String(r[ci] || '').trim().toUpperCase()).filter(Boolean))];
  } catch {}
  if (!list.length) list = [cur];
  const on = loadOn();
  list.forEach((g) => addGianRow(g, '', g in on ? on[g] : g === cur));
})();
load();
setInterval(load, 60000);
