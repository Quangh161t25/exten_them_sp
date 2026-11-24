// Điều hướng theo hash: #dashboard, #push, #reply, #rate, #send, #send/<id>, #settings
(async () => {
  const { $, $$, esc } = UI;
  const view = $('#view');
  const settings = await Store.getSettings();
  Shopee.setDemo(settings.demo);
  Shopee.setBoostConfig(settings.boost);

  const demo = $('#demoToggle');
  demo.checked = Shopee.isDemo();
  demo.disabled = !Store.HAS_EXT;
  demo.addEventListener('change', async () => { await Store.saveSettings({ demo: demo.checked }); location.reload(); });

  // Thông tin shop
  (async () => {
    try {
      const s = await Shopee.shopInfo();
      self.CURRENT_SHOP = s;
      $('#shopBox').innerHTML = `Shop: <b>${esc(s.shopName)}</b><br><span class="small">ID ${esc(s.shopId)}</span>`;
    } catch (e) {
      $('#shopBox').innerHTML = `<span style="color:var(--err)">Chưa đăng nhập Kênh Người Bán</span><br><a href="https://banhang.shopee.vn/" target="_blank">Mở banhang.shopee.vn ↗</a>`;
    }
  })();

  // Chấm xanh = đang bật tự động
  async function dots() {
    for (const k of ['push', 'reply', 'rate']) {
      const c = await Store.getConfig(k);
      const d = $(`[data-dot="${k}"]`);
      d.classList.toggle('on', !!c.enabled);
      d.title = c.enabled ? 'Đang bật tự động' : 'Đang tắt';
    }
  }
  dots();
  Store.onChange((ch) => { if (ch.cfg_push || ch.cfg_reply || ch.cfg_rate) dots(); });
  self.refreshDots = dots;

  let cleanup = null;
  async function route() {
    const [name, arg] = (location.hash.slice(1) || 'dashboard').split('/');
    const fn = Views[name] || Views.dashboard;
    $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === (Views[name] ? name : 'dashboard')));
    if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
    view.innerHTML = '';
    if (Shopee.isDemo()) view.insertAdjacentHTML('afterbegin', `<div class="demo-banner">Đang ở <b>CHẾ ĐỘ THỬ</b>: dữ liệu giả, không có gì được gửi lên Shopee.${Store.HAS_EXT ? ' Tắt ở góc trái dưới để chạy thật.' : ' (Trang đang mở ngoài extension.)'}</div>`);
    const host = document.createElement('div');
    view.appendChild(host);
    try { cleanup = (await fn(host, arg)) || null; }
    catch (e) { host.innerHTML = `<div class="card"><b>Lỗi:</b> ${esc(Jobs.errMsg(e))}</div>`; }
    window.scrollTo(0, 0);
  }
  let current = location.hash;
  window.addEventListener('hashchange', () => {
    if (window.onbeforeunload && location.hash !== current) {
      if (!confirm('Tác vụ đang chạy sẽ bị dừng nếu rời trang này. Tiếp tục?')) {
        history.replaceState(null, '', current || '#dashboard'); // giữ nguyên trang đang chạy
        return;
      }
      window.onbeforeunload = null;
      if (self.__stopRunning) self.__stopRunning();
    }
    current = location.hash;
    route();
  });
  route();
})();
