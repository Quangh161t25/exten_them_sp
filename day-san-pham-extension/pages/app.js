// Trang Đẩy Sản Phẩm: chỉ hiển thị giao diện "Đẩy sản phẩm" (tách từ Seller Auto)
(async () => {
  const { $, esc } = UI;
  const view = $('#view');
  const settings = await Store.getSettings();
  Shopee.setDemo(settings.demo);
  Shopee.setBoostConfig(settings.boost);

  const demo = $('#demoToggle');
  demo.checked = Shopee.isDemo();
  demo.disabled = !Store.HAS_EXT;
  demo.addEventListener('change', async () => { await Store.saveSettings({ demo: demo.checked }); location.reload(); });

  (async () => {
    try {
      const s = await Shopee.shopInfo();
      self.CURRENT_SHOP = s;
      $('#shopBox').innerHTML = `Shop: <b>${esc(s.shopName)}</b> · ID ${esc(s.shopId)}`;
    } catch (e) {
      $('#shopBox').innerHTML = `<span style="color:var(--err)">Chưa đăng nhập Kênh Người Bán</span> · <a href="https://banhang.shopee.vn/" target="_blank">Mở banhang.shopee.vn ↗</a>`;
    }
  })();

  if (Shopee.isDemo()) view.insertAdjacentHTML('afterbegin', '<div class="demo-banner">Đang ở <b>CHẾ ĐỘ THỬ</b>: dữ liệu giả, không có gì được gửi lên Shopee. Tắt ở góc phải trên để chạy thật.</div>');
  const host = document.createElement('div');
  view.appendChild(host);
  try { await Views.push(host); }
  catch (e) { host.innerHTML = `<div class="card"><b>Lỗi:</b> ${esc(Jobs.errMsg(e))}</div>`; }
})();
