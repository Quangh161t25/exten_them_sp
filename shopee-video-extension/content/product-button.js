// shopee.vn: nút "+ Video" hiện trên ảnh của thẻ sản phẩm đang rê chuột (trang tìm kiếm, shop, gợi ý...)
// và nút nổi trên trang chi tiết sản phẩm.
// Dùng 1 nút duy nhất gắn vào <html>, định vị fixed theo toạ độ ảnh → không phụ thuộc DOM/CSS của Shopee.
(() => {
  const PRODUCT_RE = /-i\.\d+\.\d+|\/product\/\d+\/\d+/;

  function css(el, styles) {
    Object.entries(styles).forEach(([k, v]) => el.style.setProperty(k, v, 'important'));
  }
  const BASE = {
    margin: '0', 'box-sizing': 'border-box', cursor: 'pointer', color: '#fff', 'text-align': 'center',
    font: '700 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif', 'letter-spacing': '0',
    'text-transform': 'none', 'box-shadow': '0 2px 10px rgba(0,0,0,.3)', 'pointer-events': 'auto', opacity: '1',
  };

  function send(link, btn, label) {
    try {
      chrome.runtime.sendMessage({ type: 'SVX_ADD_LINK', link }, () => {
        void chrome.runtime.lastError;
        if (!btn) return;
        btn.textContent = '✓ Đã gửi';
        css(btn, { background: '#16a34a' });
        setTimeout(() => { btn.textContent = label; css(btn, { background: 'rgba(15,118,110,.95)' }); }, 1800);
      });
    } catch {
      alert('Shopee Video Studio vừa được cập nhật, hãy tải lại trang (F5).');
    }
  }

  // ---------- Nút trên thẻ sản phẩm ----------
  const LABEL = '🎬 + Video';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = LABEL;
  btn.title = 'Lấy video sản phẩm này vào Shopee Video Studio';
  css(btn, {
    ...BASE, position: 'fixed', 'z-index': '2147483646', display: 'none', height: '34px', padding: '0 10px',
    border: '0', 'border-top': '2px solid #fff', 'border-bottom': '2px solid #fff', 'border-radius': '0',
    background: 'rgba(15,118,110,.95)', left: '0', top: '0', width: '0',
  });
  let cur = null; // thẻ <a> sản phẩm đang rê chuột

  const productLink = (el) => {
    const a = el && el.closest ? el.closest('a[href]') : null;
    return a && PRODUCT_RE.test(a.getAttribute('href') || '') && a.querySelector('img') ? a : null;
  };
  const mainImage = (a) => {
    let best = null, area = 0;
    a.querySelectorAll('img').forEach((im) => {
      const r = im.getBoundingClientRect();
      if (r.width * r.height > area) { area = r.width * r.height; best = r; }
    });
    return area > 60 * 60 ? best : null; // bỏ qua icon nhỏ
  };

  function hide() { cur = null; btn.style.setProperty('display', 'none', 'important'); }
  function show() {
    if (!cur || !cur.isConnected) return hide();
    const r = mainImage(cur);
    if (!r) return hide();
    if (!btn.isConnected) document.documentElement.appendChild(btn);
    css(btn, { left: `${r.left}px`, top: `${r.top + r.height * 0.62}px`, width: `${r.width}px`, display: 'block' });
  }

  ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach((ev) => btn.addEventListener(ev, (e) => e.stopPropagation()));
  btn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (cur) send(new URL(cur.getAttribute('href'), location.origin).href, btn, LABEL);
  });

  document.addEventListener('mouseover', (e) => {
    if (e.target === btn) return;
    const a = productLink(e.target);
    if (a) { cur = a; show(); } else if (cur) hide();
  }, true);
  // Chuột rời khỏi trang
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) hide(); }, true);
  window.addEventListener('scroll', () => { if (cur) show(); }, true);
  window.addEventListener('resize', () => { if (cur) show(); });
  document.documentElement.appendChild(btn);

  // ---------- Nút nổi trên trang chi tiết sản phẩm ----------
  const FAB_LABEL = '🎬 + Video';
  let fab = null;
  function updateFab() {
    const isProduct = PRODUCT_RE.test(location.pathname);
    if (isProduct && !fab) {
      fab = document.createElement('button');
      fab.type = 'button';
      fab.textContent = FAB_LABEL;
      fab.title = 'Lấy video sản phẩm này vào Shopee Video Studio';
      css(fab, {
        ...BASE, position: 'fixed', right: '18px', bottom: '90px', 'z-index': '2147483000', padding: '10px 14px',
        border: '0', 'border-radius': '22px', background: 'rgba(15,118,110,.95)', display: 'block',
      });
      fab.addEventListener('click', () => send(location.href, fab, FAB_LABEL));
    }
    if (fab) {
      if (isProduct && !fab.isConnected) document.documentElement.appendChild(fab);
      fab.style.setProperty('display', isProduct ? 'block' : 'none', 'important');
    }
  }
  updateFab();
  let last = location.href;
  setInterval(() => { if (location.href !== last) { last = location.href; updateFab(); } else if (fab && !fab.isConnected) updateFab(); }, 1000);
})();
