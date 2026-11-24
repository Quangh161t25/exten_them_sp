// Tiện ích giao diện dùng chung
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (x) => String(x).padStart(2, '0');
  const fmtTime = (ms, withDate = true) => {
    if (!ms) return '—';
    const d = new Date(ms);
    const t = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    return withDate ? `${t} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}` : t;
  };
  const fmtLeft = (ms) => {
    if (ms <= 0) return 'hết';
    const m = Math.round(ms / 60e3);
    return m >= 60 ? `${Math.floor(m / 60)}g ${p2(m % 60)}p` : `${m} phút`;
  };
  const fmtNum = (n) => (Number(n) || 0).toLocaleString('vi-VN');

  function toast(msg, type = 'info', ms = 3200) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function dialog({ title, body = '', input = null, okText = 'Đồng ý', cancelText = 'Huỷ', danger = false }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML = `<div class="modal__box" role="dialog" aria-modal="true">
          <h3 class="modal__title">${esc(title)}</h3>
          <div class="modal__body">${body}</div>
          ${input !== null ? `<input class="input modal__input" value="${esc(input)}">` : ''}
          <div class="modal__actions">
            <button class="btn btn--ghost" data-act="cancel">${esc(cancelText)}</button>
            <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="ok">${esc(okText)}</button>
          </div></div>`;
      const inp = $('.modal__input', wrap);
      const close = (v) => { wrap.remove(); resolve(v); };
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) close(false);
        const act = e.target.dataset && e.target.dataset.act;
        if (act === 'cancel') close(false);
        if (act === 'ok') close(inp ? inp.value.trim() : true);
      });
      wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); if (e.key === 'Enter' && inp) close(inp.value.trim()); });
      document.body.appendChild(wrap);
      (inp || $('[data-act=ok]', wrap)).focus();
    });
  }

  /** Vẽ nhật ký vào phần tử, tự cập nhật khi có dòng mới */
  async function bindLog(el, name) {
    const draw = async () => {
      const l = await Store.getLog(name);
      el.innerHTML = l.slice(0, 200).map((x) => `<div class="${esc(x.type)}"><time>${esc(fmtTime(x.t))}</time>${esc(x.msg)}</div>`).join('');
    };
    await draw();
    let timer = null;
    const listener = (ch) => { if (ch['log_' + name]) { clearTimeout(timer); timer = setTimeout(draw, 150); } };
    Store.onChange(listener);
    if (!Store.HAS_EXT) el._redraw = draw;
    return draw;
  }

  /** Chạy 1 tác vụ ngay trong trang: khoá để background không chạy trùng, có nút Dừng */
  async function runInPage(name, btnRun, btnStop, fn) {
    if (!(await Store.lock(name))) {
      toast('Tác vụ này đang chạy (ở tab khác hoặc lịch tự động). Đợi xong rồi thử lại.', 'warn', 4500);
      return;
    }
    let stopped = false;
    const keep = setInterval(() => Store.touchLock(name), 60e3);
    btnRun.disabled = true;
    btnStop && btnStop.classList.remove('hidden');
    const onStop = () => { stopped = true; if (btnStop) { btnStop.disabled = true; btnStop.textContent = 'Đang dừng…'; } };
    self.__stopRunning = onStop;
    btnStop && btnStop.addEventListener('click', onStop, { once: true });
    window.onbeforeunload = () => 'Tác vụ đang chạy, đóng trang sẽ dừng lại.';
    try {
      const r = await fn(() => stopped);
      return r;
    } catch (e) {
      const m = Jobs.errMsg(e);
      await Store.addLog(name, 'error', m);
      toast(m, 'error', 6000);
    } finally {
      clearInterval(keep);
      if (self.__stopRunning === onStop) self.__stopRunning = null;
      await Store.unlock(name);
      window.onbeforeunload = null;
      btnRun.disabled = false;
      if (btnStop) { btnStop.classList.add('hidden'); btnStop.disabled = false; btnStop.textContent = 'Dừng'; btnStop.removeEventListener('click', onStop); }
      const el = document.querySelector('.log');
      el && el._redraw && el._redraw();
    }
  }

  /** Chèn biến vào textarea tại con trỏ */
  function varButtons(textarea, vars) {
    const box = document.createElement('div');
    box.className = 'vars';
    box.innerHTML = vars.map(([v, t]) => `<button type="button" data-v="${esc(v)}" title="${esc(t)}">${esc(v)}</button>`).join('')
      + '<button type="button" data-v="\n---\n" title="Thêm biến thể: mỗi lần gửi chọn ngẫu nhiên 1 đoạn">--- biến thể</button>';
    box.addEventListener('click', (e) => {
      const v = e.target.dataset.v;
      if (!v) return;
      const s = textarea.selectionStart ?? textarea.value.length;
      textarea.value = textarea.value.slice(0, s) + v + textarea.value.slice(textarea.selectionEnd ?? s);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = s + v.length;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    textarea.after(box);
  }

  const lastRunText = (cfg) => {
    if (!cfg.lastRun) return 'Chưa chạy lần nào';
    return `Lần chạy gần nhất: ${fmtTime(cfg.lastRun)}${cfg.lastError ? ' · ' + cfg.lastError : ''}`;
  };

  self.UI = { $, $$, esc, fmtTime, fmtLeft, fmtNum, toast, dialog, bindLog, runInPage, varButtons, lastRunText };
})();
