// Nút trên trang danh sách sản phẩm (banhang.shopee.vn/portal/product/list):
//  "+ Đẩy"  : thêm / bỏ sản phẩm khỏi danh sách Đẩy sản phẩm tự động (xanh = đang trong danh sách)
//  "⚡ Ngay" : đẩy sản phẩm này lên ngay (nếu shop còn suất đẩy)
(() => {
  if (window.top !== window || window.__dspButtons) return;
  window.__dspButtons = true;

  const CFG = 'cfg_push';
  const onList = () => location.pathname.startsWith('/portal/product/list');

  const style = document.createElement('style');
  style.textContent = `
    .dsp-bar{display:flex;gap:4px;padding:4px 6px 6px}
    .dsp-bar button{flex:1;min-width:0;border:1px solid #fdba74;background:#fff7ed;color:#c2410c;border-radius:4px;font:600 11px/18px Arial,sans-serif;cursor:pointer;padding:0 4px;white-space:nowrap}
    .dsp-bar button:hover{filter:brightness(.96)}
    .dsp-bar button.on{background:#22c55e;border-color:#16a34a;color:#fff}
    .dsp-bar button:disabled{opacity:.6;cursor:default}`;
  (document.head || document.documentElement).appendChild(style);

  const idOf = (card) => {
    const a = card.querySelector("a[href*='/portal/product/']");
    const m = a && a.getAttribute('href').match(/\/portal\/product\/(\d+)/);
    if (m) return m[1];
    const cb = card.querySelector('.product-checkbox input[name]');
    return cb && /^\d+$/.test(cb.name) ? cb.name : '';
  };
  const nameOf = (card) => (card.querySelector('.product-name .eds-popover__ref, .product-name-wrap, .product-name')?.textContent || '').replace(/\s+/g, ' ').trim();

  async function getCfg() { return (await chrome.storage.local.get(CFG))[CFG] || {}; }
  async function inList(id) { return ((await getCfg()).items || []).some((x) => String(x.id) === String(id)); }

  function paint(btn, on) {
    btn.classList.toggle('on', on);
    btn.textContent = on ? '✓ Đẩy' : '+ Đẩy';
    btn.title = on ? 'Đang trong danh sách Đẩy sản phẩm — bấm để bỏ' : 'Thêm vào danh sách Đẩy sản phẩm tự động';
  }

  function addBar(card) {
    const id = idOf(card);
    if (!id) return;
    let bar = card.querySelector(':scope .dsp-bar');
    if (bar && bar.dataset.id === id) return;
    if (bar) bar.remove(); // thẻ được dùng lại cho SP khác (đổi trang / lọc)
    bar = document.createElement('div');
    bar.className = 'dsp-bar';
    bar.dataset.id = id;
    const tog = document.createElement('button');
    tog.type = 'button';
    const now = document.createElement('button');
    now.type = 'button';
    now.textContent = '⚡ Đẩy ngay';
    now.title = 'Đẩy sản phẩm này lên ngay (cần còn suất đẩy trống)';
    bar.append(tog, now);
    card.appendChild(bar);
    inList(id).then((on) => paint(tog, on));

    tog.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      const cfg = await getCfg();
      const items = (cfg.items || []).slice();
      const i = items.findIndex((x) => String(x.id) === id);
      if (i >= 0) items.splice(i, 1);
      else items.push({ id: Number(id) || id, name: nameOf(card), image: card.querySelector('img')?.src || '', enabled: true });
      await chrome.storage.local.set({ [CFG]: { ...cfg, items } });
      paint(tog, i < 0);
    });

    now.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      now.disabled = true;
      now.textContent = 'Đang đẩy…';
      const r = await chrome.runtime.sendMessage({ type: 'DSP_BOOST_NOW', id, name: nameOf(card) }).catch((err) => ({ ok: false, error: String(err) }));
      now.textContent = r && r.ok ? '✓ Đã đẩy' : '✗ Lỗi';
      now.title = r && r.ok ? 'Đã đẩy sản phẩm' : (r && r.error) || 'Không đẩy được';
      setTimeout(() => { now.disabled = false; now.textContent = '⚡ Đẩy ngay'; }, 3000);
    });
  }

  function scan() {
    if (!onList()) return;
    document.querySelectorAll('.product-item, .product-card-item').forEach(addBar);
  }
  setInterval(scan, 1500);
  scan();

  // Cập nhật màu nút khi danh sách đổi ở trang Đẩy sản phẩm
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local' || !c[CFG]) return;
    const ids = new Set(((c[CFG].newValue || {}).items || []).map((x) => String(x.id)));
    document.querySelectorAll('.dsp-bar').forEach((bar) => paint(bar.firstChild, ids.has(bar.dataset.id)));
  });
})();
