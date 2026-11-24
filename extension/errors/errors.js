// Trang "Lỗi hôm nay": đọc danh sách lỗi gom từ mọi module (chrome.storage "qlsp_errors")
(() => {
  const KEY = 'qlsp_errors';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  let all = [], mod = '';

  const dayStart = (back) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - back); return d.getTime(); };
  function inDay(x) {
    const v = $('#day').value;
    if (v === 'all') return true;
    const s = dayStart(+v);
    return x.at >= s && x.at < s + 86400e3;
  }
  function visible() {
    const q = $('#q').value.trim().toLowerCase();
    return all.filter((x) => inDay(x) && (!mod || x.module === mod) && (!q || `${x.module} ${x.ref} ${x.message}`.toLowerCase().includes(q)));
  }
  function render() {
    const base = all.filter(inDay);
    const counts = new Map();
    base.forEach((x) => counts.set(x.module, (counts.get(x.module) || 0) + 1));
    if (mod && !counts.has(mod)) mod = '';
    $('#stats').innerHTML = `<span class="chip ${mod ? '' : 'on'}" data-m="">Tất cả · ${base.length}</span>` +
      [...counts].sort((a, b) => b[1] - a[1]).map(([m, n]) => `<span class="chip ${m === mod ? 'on' : ''}" data-m="${esc(m)}">${esc(m)} · ${n}</span>`).join('');
    const list = visible();
    $('#rows').innerHTML = list.map((x) => {
      const d = new Date(x.at);
      return `<tr><td class="t">${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}</td>
        <td class="m">${esc(x.module)}</td><td>${esc(x.ref)}</td><td class="msg">${esc(x.message)}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="empty">✔ Không có lỗi nào.</td></tr>';
    document.title = `Lỗi (${base.length})`;
  }
  async function load() {
    all = (await chrome.storage.local.get(KEY))[KEY] || [];
    render();
  }
  $('#stats').onclick = (e) => { const c = e.target.closest('[data-m]'); if (!c) return; mod = c.dataset.m; render(); };
  $('#day').onchange = render;
  $('#q').oninput = render;
  $('#reload').onclick = load;
  $('#clear').onclick = async () => {
    const del = new Set(visible());
    if (!del.size || !confirm(`Xoá ${del.size} lỗi đang xem?`)) return;
    all = all.filter((x) => !del.has(x));
    await chrome.storage.local.set({ [KEY]: all });
    render();
  };
  // Bật/tắt báo lỗi qua Telegram (dùng chung cài đặt của Auto In)
  chrome.storage.local.get('tcdd-tele-error', (r) => { $('#tele').checked = r['tcdd-tele-error'] !== '0'; });
  $('#tele').onchange = () => chrome.storage.local.set({ 'tcdd-tele-error': $('#tele').checked ? '1' : '0' });
  chrome.storage.onChanged.addListener((c, a) => { if (a === 'local' && c[KEY]) { all = c[KEY].newValue || []; render(); } });
  load();
})();
