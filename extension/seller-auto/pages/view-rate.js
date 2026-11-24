self.Views = self.Views || {};
Views.rate = async (el) => {
  const { $, esc, toast, fmtTime } = UI;
  let cfg = await Store.getConfig('rate');
  const VARS = [['{ten}', 'Tên người mua'], ['{ma_don}', 'Mã đơn'], ['{shop}', 'Tên shop']];

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Đánh giá người mua</h1><p>Tự động đánh giá lại người mua cho các đơn đã hoàn thành (shop đánh giá khách), có thể kèm tin nhắn cảm ơn.</p></div>
      <label class="toggle"><input type="checkbox" id="enabled" ${cfg.enabled ? 'checked' : ''}><i></i><span>Tự động</span></label>
    </div>
    <div class="grid2">
      <div class="card">
        <div class="card__title">Cấu hình đánh giá</div>
        <div class="field mt"><span class="field__label">Số sao</span>
          <div class="stars">${[5, 4, 3, 2, 1].map((s) => `<label><input class="sr" type="radio" name="star" value="${s}" ${Number(cfg.star) === s ? 'checked' : ''}>${s}★</label>`).join('')}</div></div>
        <div class="field"><span class="field__label">Nội dung đánh giá</span><textarea class="input" id="text" rows="3">${esc(cfg.text)}</textarea></div>
        <div class="field"><span class="field__label">Tin nhắn chat gửi kèm (tuỳ chọn)</span><textarea class="input" id="chat" rows="2" placeholder="Để trống nếu không gửi chat">${esc(cfg.chat)}</textarea></div>
      </div>
      <div class="card">
        <div class="card__title">Lịch & phạm vi</div>
        <div class="row mt">
          <div class="field grow"><span class="field__label">Chạy mỗi (phút)</span><input type="number" class="input input--num" id="intervalMin" min="10" value="${cfg.intervalMin}"></div>
          <div class="field grow"><span class="field__label">Tối đa mỗi lượt</span><input type="number" class="input input--num" id="perRun" min="1" value="${cfg.perRun}"></div>
        </div>
        <div class="row">
          <div class="field grow"><span class="field__label">Số trang quét (40 đơn/trang)</span><input type="number" class="input input--num" id="pages" min="1" max="100" value="${cfg.pages}">
            <div class="field__tip">Lượt tự động chỉ quét vài trang đầu (đơn mới). Muốn quét hết đơn cũ thì bấm "Quét toàn bộ".</div></div>
          <div class="field grow"><span class="field__label">Giãn cách (ms)</span><input type="number" class="input input--num" id="delayMs" min="200" step="100" value="${cfg.delayMs}"></div>
        </div>
        <div class="small muted" id="last"></div>
        <div class="row row--wrap mt"><button class="btn btn--primary" id="save">Lưu</button><button class="btn" id="runNow">Chạy ngay</button><button class="btn" id="runAll">Quét toàn bộ</button><button class="btn btn--danger hidden" id="stop">Dừng</button></div>
      </div>
    </div>
    <div class="card"><div class="row"><div class="card__title grow">Nhật ký</div><button class="link-btn small" id="clearLog">Xoá nhật ký</button></div><div class="log mt" id="log"></div></div>`;

  UI.varButtons($('#text'), VARS);
  UI.varButtons($('#chat'), VARS);

  const readForm = () => ({
    star: Number((el.querySelector('input[name=star]:checked') || {}).value) || 5,
    text: $('#text').value, chat: $('#chat').value,
    intervalMin: Math.max(10, Number($('#intervalMin').value) || 60),
    perRun: Math.max(1, Number($('#perRun').value) || 50),
    pages: Math.min(100, Math.max(1, Number($('#pages').value) || 3)),
    delayMs: Math.max(200, Number($('#delayMs').value) || 500),
  });
  const showLast = () => { $('#last').textContent = UI.lastRunText(cfg); };
  const save = async (p) => { cfg = { ...cfg, ...p }; await Store.saveConfig('rate', p); showLast(); };
  const valid = (f) => { if (!f.text.trim()) { toast('Nhập nội dung đánh giá', 'warn'); return false; } return true; };

  $('#save').addEventListener('click', async () => { const f = readForm(); if (!valid(f)) return; await save(f); toast('Đã lưu', 'ok'); });
  $('#enabled').addEventListener('change', async (e) => {
    const f = readForm();
    if (e.target.checked && !valid(f)) { e.target.checked = false; return; }
    await save({ ...f, enabled: e.target.checked });
    self.refreshDots && refreshDots();
    toast(e.target.checked ? `Đã bật: chạy mỗi ${f.intervalMin} phút` : 'Đã tắt', e.target.checked ? 'ok' : 'info');
  });
  const run = (all) => async () => {
    const f = readForm();
    if (!valid(f)) return;
    await save(f);
    await UI.runInPage('rate', all ? $('#runAll') : $('#runNow'), $('#stop'), (stop) => Jobs.rateJob({
      manual: true, stop, onLog: () => drawLog(), ...(all ? { pages: 1000, limit: 100000 } : {}),
    }));
    cfg = await Store.getConfig('rate');
    showLast();
  };
  $('#runNow').addEventListener('click', run(false));
  $('#runAll').addEventListener('click', run(true));
  $('#clearLog').addEventListener('click', async () => { await Store.clearLog('rate'); drawLog(); });

  showLast();
  const drawLog = await UI.bindLog($('#log'), 'rate');
};
