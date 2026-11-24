self.Views = self.Views || {};
Views.reply = async (el) => {
  const { $, $$, esc, toast, fmtTime } = UI;
  let cfg = await Store.getConfig('reply');
  const VARS = [['{ten}', 'Tên người mua'], ['{ma_don}', 'Mã đơn'], ['{sao}', 'Số sao'], ['{shop}', 'Tên shop']];

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Trả lời đánh giá</h1><p>Tự động trả lời các đánh giá chưa phản hồi theo số sao, có thể kèm tin nhắn chat cho người mua.</p></div>
      <label class="toggle"><input type="checkbox" id="enabled" ${cfg.enabled ? 'checked' : ''}><i></i><span>Tự động</span></label>
    </div>
    <div class="grid2">
      <div class="card">
        <div class="card__title">Cấu hình trả lời</div>
        <div class="field mt"><span class="field__label">Lọc theo sao</span>
          <div class="stars">${[5, 4, 3, 2, 1].map((s) => `<label><input class="sr" type="checkbox" data-star="${s}" ${cfg.stars.includes(s) ? 'checked' : ''}>${s}★</label>`).join('')}</div>
          <div class="field__tip">Nên trả lời tay các đánh giá 1–3★ để xử lý khiếu nại cho đúng.</div></div>
        <div class="field"><span class="field__label">Nội dung trả lời</span><textarea class="input" id="text" rows="4">${esc(cfg.text)}</textarea></div>
        <div class="field"><span class="field__label">Tin nhắn chat gửi kèm (tuỳ chọn)</span><textarea class="input" id="chat" rows="2" placeholder="Để trống nếu không gửi chat">${esc(cfg.chat)}</textarea></div>
      </div>
      <div class="card">
        <div class="card__title">Lịch & tốc độ</div>
        <div class="row mt">
          <div class="field grow"><span class="field__label">Chạy mỗi (phút)</span><input type="number" class="input input--num" id="intervalMin" min="5" value="${cfg.intervalMin}"></div>
          <div class="field grow"><span class="field__label">Tối đa mỗi lượt</span><input type="number" class="input input--num" id="perRun" min="1" value="${cfg.perRun}"></div>
          <div class="field grow"><span class="field__label">Giãn cách (ms)</span><input type="number" class="input input--num" id="delayMs" min="200" step="100" value="${cfg.delayMs}"></div>
        </div>
        <div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat stat--warn"><div class="stat__label">Đang chờ trả lời</div><div class="stat__value" id="toReply">…</div></div>
          <div class="stat"><div class="stat__label">Lần chạy gần nhất</div><div class="stat__value" style="font-size:16px" id="last">—</div></div></div>
        <div class="row row--wrap"><button class="btn btn--primary" id="save">Lưu</button><button class="btn" id="preview">Xem đánh giá chờ</button><button class="btn" id="runNow">Chạy ngay</button><button class="btn btn--danger hidden" id="stop">Dừng</button></div>
      </div>
    </div>
    <div class="card hidden" id="previewCard"><div class="card__title">Đánh giá chưa trả lời</div><div class="table-wrap mt"><table><thead><tr><th>Người mua</th><th>Sao</th><th>Nội dung</th><th>Thời gian</th><th>Câu trả lời dự kiến</th></tr></thead><tbody id="previewBody"></tbody></table></div></div>
    <div class="card"><div class="row"><div class="card__title grow">Nhật ký</div><button class="link-btn small" id="clearLog">Xoá nhật ký</button></div><div class="log mt" id="log"></div></div>`;

  UI.varButtons($('#text'), VARS);
  UI.varButtons($('#chat'), VARS);

  const readForm = () => ({
    stars: $$('[data-star]').filter((x) => x.checked).map((x) => Number(x.dataset.star)),
    text: $('#text').value, chat: $('#chat').value,
    intervalMin: Math.max(5, Number($('#intervalMin').value) || 30),
    perRun: Math.max(1, Number($('#perRun').value) || 30),
    delayMs: Math.max(200, Number($('#delayMs').value) || 800),
  });
  const save = async (p) => { cfg = { ...cfg, ...p }; await Store.saveConfig('reply', p); $('#last').textContent = fmtTime(cfg.lastRun); };
  const valid = (f) => { if (!f.stars.length) { toast('Chọn ít nhất 1 mức sao', 'warn'); return false; } if (!f.text.trim()) { toast('Nhập nội dung trả lời', 'warn'); return false; } return true; };

  async function loadCount() {
    try { const c = await Shopee.ratingCounts(cfg.stars); $('#toReply').textContent = UI.fmtNum(c.toReply); }
    catch (e) { $('#toReply').textContent = '?'; $('#toReply').title = Jobs.errMsg(e); }
  }

  $('#save').addEventListener('click', async () => { const f = readForm(); if (!valid(f)) return; await save(f); toast('Đã lưu', 'ok'); loadCount(); });
  $('#enabled').addEventListener('change', async (e) => {
    const f = readForm();
    if (e.target.checked && !valid(f)) { e.target.checked = false; return; }
    await save({ ...f, enabled: e.target.checked });
    self.refreshDots && refreshDots();
    toast(e.target.checked ? `Đã bật: chạy mỗi ${f.intervalMin} phút` : 'Đã tắt', e.target.checked ? 'ok' : 'info');
  });
  $('#preview').addEventListener('click', async () => {
    const f = readForm();
    $('#previewCard').classList.remove('hidden');
    $('#previewBody').innerHTML = '<tr><td colspan="5" class="empty">Đang tải…</td></tr>';
    try {
      const list = await Shopee.listRatings({ stars: f.stars.length ? f.stars : [5], page: 1, size: 20, replyStatus: 1 });
      $('#previewBody').innerHTML = list.length ? list.map((r) => `<tr><td>${esc(r.userName)}</td><td>${r.star}★</td><td class="small"><div class="clamp">${esc(r.comment || '—')}</div></td><td class="small">${fmtTime(r.ctime * 1000)}</td>
        <td class="small muted"><div class="clamp">${esc(Tpl.render(f.text, { name: r.userName, orderId: r.orderId, star: r.star, shop: (self.CURRENT_SHOP || {}).shopName }))}</div></td></tr>`).join('')
        : '<tr><td colspan="5" class="empty">Không có đánh giá nào chờ trả lời 🎉</td></tr>';
    } catch (e) { $('#previewBody').innerHTML = `<tr><td colspan="5" class="empty" style="color:var(--err)">${esc(Jobs.errMsg(e))}</td></tr>`; }
  });
  $('#runNow').addEventListener('click', async () => {
    const f = readForm();
    if (!valid(f)) return;
    await save(f);
    await UI.runInPage('reply', $('#runNow'), $('#stop'), (stop) => Jobs.replyJob({ manual: true, stop, onLog: () => drawLog() }));
    cfg = await Store.getConfig('reply');
    $('#last').textContent = fmtTime(cfg.lastRun);
    loadCount();
  });
  $('#clearLog').addEventListener('click', async () => { await Store.clearLog('reply'); drawLog(); });

  $('#last').textContent = fmtTime(cfg.lastRun);
  const drawLog = await UI.bindLog($('#log'), 'reply');
  loadCount();
};
