self.Views = self.Views || {};
Views.push = async (el) => {
  const { $, $$, esc, toast, fmtTime, fmtLeft } = UI;
  let cfg = await Store.getConfig('push');
  const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Đẩy sản phẩm</h1><p>Tự động bấm "Đẩy sản phẩm" trên Kênh Người Bán: luôn giữ đủ suất đẩy, xoay vòng danh sách sản phẩm theo khung giờ.</p></div>
      <label class="toggle"><input type="checkbox" id="enabled" ${cfg.enabled ? 'checked' : ''}><i></i><span>Tự động</span></label>
    </div>
    <div class="grid2">
      <div class="card">
        <div class="card__title">Lịch chạy</div>
        <div class="card__desc">Mỗi 5 phút extension kiểm tra, nếu còn suất trống thì đẩy sản phẩm kế tiếp.</div>
        <div class="field"><span class="field__label">Khung giờ</span>
          <div class="row"><input type="time" class="input input--time" id="from" value="${esc(cfg.from)}"> đến <input type="time" class="input input--time" id="to" value="${esc(cfg.to)}"></div>
          <div class="field__tip">Khung qua đêm (vd 20:00 → 02:00) cũng được.</div></div>
        <div class="field"><span class="field__label">Ngày trong tuần</span>
          <div class="days">${DAYS.map((d, i) => `<label><input type="checkbox" data-day="${i}" ${cfg.days.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div></div>
        <div class="row">
          <div class="field grow"><span class="field__label">Số SP đẩy cùng lúc</span><input type="number" class="input input--num" id="maxActive" min="1" value="${cfg.maxActive}"></div>
          <div class="field grow"><span class="field__label">Mỗi lượt kéo dài (giờ)</span><input type="number" class="input input--num" id="durationHours" min="1" max="24" value="${cfg.durationHours}"></div>
        </div>
        <div class="row"><button class="btn btn--primary" id="save">Lưu cài đặt</button><button class="btn" id="runNow">Đẩy ngay</button><span class="small muted grow" id="lastRun"></span></div>
      </div>
      <div class="card">
        <div class="card__title">Thêm sản phẩm</div>
        <div class="card__desc">Tìm theo tên hoặc ID sản phẩm trong shop của bạn.</div>
        <div class="row"><input class="input grow" id="kw" placeholder="Tên hoặc ID sản phẩm…"><button class="btn" id="search">Tìm</button></div>
        <div class="picker" id="results"><div class="empty small">Bấm Tìm để xem sản phẩm của shop.</div></div>
      </div>
    </div>
    <div class="card">
      <div class="row"><div class="card__title grow">Danh sách xoay vòng (<span id="count">0</span>)</div><button class="link-btn link-btn--danger small" id="clear">Xoá tất cả</button></div>
      <div class="card__desc">Thứ tự trong bảng là thứ tự được đẩy. Sản phẩm vừa đẩy sẽ chờ hết lượt mới được đẩy lại.</div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th></th><th>Sản phẩm</th><th>Lần đẩy gần nhất</th><th>Trạng thái</th><th>Bật</th><th></th></tr></thead><tbody id="items"></tbody></table></div>
    </div>
    <div class="card"><div class="row"><div class="card__title grow">Nhật ký</div><button class="link-btn small" id="clearLog">Xoá nhật ký</button></div><div class="log mt" id="log"></div></div>`;

  const save = async (p) => { cfg = { ...cfg, ...p }; await Store.saveConfig('push', p); };

  function renderItems() {
    const dur = cfg.durationHours * 3600e3;
    $('#count').textContent = cfg.items.length;
    $('#lastRun').textContent = UI.lastRunText(cfg);
    $('#items').innerHTML = cfg.items.length ? cfg.items.map((it, i) => {
      const last = cfg.lastBoost[it.id] || 0;
      const left = last ? last + dur - Date.now() : 0;
      const status = left > 0 ? `<span class="badge badge--ok">Đang đẩy · còn ${fmtLeft(left)}</span>` : '<span class="badge">Chờ lượt</span>';
      return `<tr data-i="${i}">
        <td class="muted">${i + 1}</td>
        <td>${it.image ? `<img class="thumb" src="${esc(it.image)}" alt="">` : '<span class="thumb"></span>'}</td>
        <td><div class="clamp">${esc(it.name)}</div><div class="small muted">#${esc(it.id)}</div></td>
        <td class="small">${fmtTime(last)}</td>
        <td>${status}</td>
        <td><input type="checkbox" data-act="toggle" ${it.enabled !== false ? 'checked' : ''}></td>
        <td style="white-space:nowrap"><button class="btn btn--sm" data-act="up" ${i ? '' : 'disabled'} title="Lên">↑</button> <button class="btn btn--sm" data-act="down" ${i < cfg.items.length - 1 ? '' : 'disabled'} title="Xuống">↓</button> <button class="link-btn link-btn--danger small" data-act="del">Xoá</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="empty">Chưa có sản phẩm. Tìm và bấm vào sản phẩm ở khung bên phải để thêm.</td></tr>';
  }

  $('#items').addEventListener('click', async (e) => {
    const act = e.target.dataset.act;
    const tr = e.target.closest('tr[data-i]');
    if (!act || !tr) return;
    const i = Number(tr.dataset.i);
    const items = cfg.items.slice();
    if (act === 'toggle') items[i] = { ...items[i], enabled: e.target.checked };
    if (act === 'del') items.splice(i, 1);
    if (act === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    if (act === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    await save({ items });
    renderItems();
  });

  $('#clear').addEventListener('click', async () => {
    if (!cfg.items.length || !(await UI.dialog({ title: 'Xoá toàn bộ danh sách?', danger: true, okText: 'Xoá' }))) return;
    await save({ items: [] });
    renderItems();
  });

  let found = [];
  async function search() {
    const box = $('#results');
    box.innerHTML = '<div class="empty small">Đang tải…</div>';
    try {
      const r = await Shopee.searchProducts($('#kw').value.trim(), 1, 30);
      found = r.list;
      const has = new Set(cfg.items.map((x) => String(x.id)));
      box.innerHTML = found.length ? found.map((p, i) => `<div class="picker__item ${has.has(String(p.id)) ? 'is-selected' : ''}" data-i="${i}">
          ${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="">` : '<span class="thumb"></span>'}
          <div class="grow"><div class="clamp">${esc(p.name)}</div><div class="small muted">#${esc(p.id)}${p.stock !== '' ? ` · Kho ${esc(p.stock)}` : ''}</div></div>
          <span class="small">${has.has(String(p.id)) ? '✓ Đã thêm' : '+ Thêm'}</span></div>`).join('') : '<div class="empty small">Không tìm thấy sản phẩm.</div>';
    } catch (e) { box.innerHTML = `<div class="empty small" style="color:var(--err)">${esc(Jobs.errMsg(e))}</div>`; }
  }
  $('#search').addEventListener('click', search);
  $('#kw').addEventListener('keydown', (e) => e.key === 'Enter' && search());
  $('#results').addEventListener('click', async (e) => {
    const row = e.target.closest('[data-i]');
    if (!row) return;
    const p = found[Number(row.dataset.i)];
    if (cfg.items.some((x) => String(x.id) === String(p.id))) return toast('Sản phẩm đã có trong danh sách');
    await save({ items: [...cfg.items, { id: p.id, name: p.name, image: p.image, enabled: true }] });
    row.classList.add('is-selected');
    row.lastElementChild.textContent = '✓ Đã thêm';
    renderItems();
  });

  function readForm() {
    const days = $$('[data-day]').filter((x) => x.checked).map((x) => Number(x.dataset.day));
    return {
      from: $('#from').value || '08:00', to: $('#to').value || '23:00', days,
      maxActive: Math.max(1, Math.floor(Number($('#maxActive').value)) || 5),
      durationHours: Math.min(24, Math.max(1, Number($('#durationHours').value) || 4)),
    };
  }
  $('#save').addEventListener('click', async () => {
    const f = readForm();
    if (!f.days.length) return toast('Chọn ít nhất 1 ngày', 'warn');
    await save(f); renderItems(); toast('Đã lưu', 'ok');
  });
  $('#enabled').addEventListener('change', async (e) => {
    if (e.target.checked && !cfg.items.length) { e.target.checked = false; return toast('Thêm sản phẩm trước khi bật tự động', 'warn'); }
    await save({ ...readForm(), enabled: e.target.checked });
    self.refreshDots && refreshDots();
    toast(e.target.checked ? 'Đã bật đẩy sản phẩm tự động' : 'Đã tắt', e.target.checked ? 'ok' : 'info');
  });
  $('#runNow').addEventListener('click', async () => {
    await save(readForm());
    await UI.runInPage('push', $('#runNow'), null, () => Jobs.pushTick({ manual: true, onLog: () => drawLog() }));
    cfg = await Store.getConfig('push');
    renderItems();
  });
  $('#clearLog').addEventListener('click', async () => { await Store.clearLog('push'); drawLog(); });

  const drawLog = await UI.bindLog($('#log'), 'push');
  renderItems();
  const t = setInterval(async () => { cfg = await Store.getConfig('push'); renderItems(); }, 30e3);
  return () => clearInterval(t);
};
