// Tiện ích giao diện dùng chung: thanh điều hướng, thông báo, hộp thoại, định dạng
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtPrice = (min, max) => {
    if (!min) return '';
    const a = Math.round(min), b = Math.round(max || 0);
    const f = (n) => n.toLocaleString('vi-VN') + 'đ';
    return b && b !== a ? `${f(a)} - ${f(b)}` : f(a);
  };
  const fmtCompact = (n) => {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  };
  const fmtTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  const fmtDuration = (s) => {
    s = Number(s) || 0;
    if (s > 3600) s /= 1000; // Shopee trả thời lượng theo mili giây
    s = Math.round(s);
    return s ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : '';
  };

  function toast(msg, type = 'info', ms = 3200) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  /** Hộp thoại: trả về Promise<boolean | string> */
  function dialog({ title, body = '', input = null, okText = 'Đồng ý', cancelText = 'Huỷ', danger = false }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML = `
        <div class="modal__box" role="dialog" aria-modal="true">
          <h3 class="modal__title">${esc(title)}</h3>
          <div class="modal__body">${body}</div>
          ${input !== null ? `<input class="input modal__input" value="${esc(input)}">` : ''}
          <div class="modal__actions">
            <button class="btn btn--ghost" data-act="cancel">${esc(cancelText)}</button>
            <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="ok">${esc(okText)}</button>
          </div>
        </div>`;
      const inp = $('.modal__input', wrap);
      const close = (v) => { wrap.remove(); resolve(v); };
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) close(false);
        const act = e.target.dataset && e.target.dataset.act;
        if (act === 'cancel') close(false);
        if (act === 'ok') close(inp ? inp.value.trim() : true);
      });
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter' && inp) close(inp.value.trim());
      });
      document.body.appendChild(wrap);
      (inp || $('[data-act=ok]', wrap)).focus();
    });
  }

  const pageUrl = (page, query) => {
    const q = new URLSearchParams(query || {}).toString();
    return `${page}.html${q ? '?' + q : ''}`;
  };

  // Chế độ nhúng: trang đang nằm trong 1 cột của trang Tổng hợp (studio.html)
  const EMBED = new URLSearchParams(location.search).has('embed') && window.parent !== window;
  const PAGES = ['download', 'compose', 'dashboard', 'studio', 'auto'];

  /** Chuyển trang: khi nhúng thì nhờ trang Tổng hợp mở ở đúng cột */
  function go(page, query = {}) {
    if (EMBED) window.parent.postMessage({ svx: 'nav', page, query }, location.origin);
    else location.href = pageUrl(page, query);
  }
  /** Báo cho trang Tổng hợp (nếu có) */
  function notify(type, data = {}) {
    if (EMBED) window.parent.postMessage({ svx: type, ...data }, location.origin);
  }

  if (EMBED) {
    // Link nội bộ (Sửa, + Soạn video mới...) mở ở cột tương ứng thay vì trong cột hiện tại
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank') return;
      const u = new URL(a.href, location.href);
      const m = u.pathname.match(/\/(\w+)\.html$/);
      if (u.origin !== location.origin || !m || !PAGES.includes(m[1])) return;
      e.preventDefault();
      go(m[1], Object.fromEntries(u.searchParams));
    }, true);
  }

  /** Vẽ thanh trên cùng + công tắc chế độ demo. Trả về settings */
  async function header(active) {
    const s = await Store.getSettings();
    Shopee.setDemo(s.demoMode);
    if (EMBED) { document.body.classList.add('embed'); return s; }
    const nav = [['studio', 'Tổng hợp'], ['download', 'Tải video'], ['compose', 'Soạn & đăng'], ['dashboard', 'Dashboard'], ['auto', 'Hẹn giờ đăng']];
    const el = document.createElement('header');
    el.className = 'topbar';
    el.innerHTML = `
      <div class="topbar__brand"><span class="topbar__logo">▶</span> Shopee Video Studio</div>
      <nav class="topbar__nav">${nav.map(([k, t]) => `<a href="${pageUrl(k)}" class="${k === active ? 'is-active' : ''}">${t}</a>`).join('')}</nav>
      <label class="switch" title="Chế độ thử: dùng dữ liệu giả, không gọi Shopee">
        <input type="checkbox" id="demoToggle" ${s.demoMode ? 'checked' : ''} ${Store.HAS_EXT ? '' : 'disabled'}>
        <span>Chế độ thử</span>
      </label>`;
    document.body.prepend(el);
    if (s.demoMode) {
      const b = document.createElement('div');
      b.className = 'demo-banner';
      b.textContent = 'Đang ở CHẾ ĐỘ THỬ: dữ liệu giả, không có gì được gửi lên Shopee.';
      el.after(b);
    }
    $('#demoToggle').addEventListener('change', async (e) => {
      await Store.saveSettings({ demoMode: e.target.checked });
      location.reload();
    });
    return s;
  }

  const errText = (e) => String((e && e.message) || e).replace(/^NEED_(SELLER_)?LOGIN:\s*/, '');

  /** Nhận link sản phẩm từ nút "+ Video" trên shopee.vn (background gửi kèm tabId đích) */
  function onLinkFromShopee(handler) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage || window.top !== window) return;
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'SVX_LOAD_LINK') return;
      chrome.tabs.getCurrent((tab) => { if (tab && tab.id === msg.tabId) handler(msg.link); });
    });
  }

  window.UI = { $, esc, fmtPrice, fmtCompact, fmtTime, fmtDuration, toast, dialog, header, pageUrl, errText, go, notify, EMBED, onLinkFromShopee };
})();
