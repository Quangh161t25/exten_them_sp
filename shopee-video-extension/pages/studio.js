// Trang Tổng hợp: 3 cột song song (Tải video | Soạn & đăng | Dashboard), mỗi cột là 1 trang chạy ở chế độ nhúng
(async () => {
  await UI.header('studio');

  const cols = {
    download: document.getElementById('col-download'),
    compose: document.getElementById('col-compose'),
    dashboard: document.getElementById('col-dashboard'),
  };
  const src = (page, query = {}) => UI.pageUrl(page, { ...query, embed: '1' });
  const open = (page, query) => { if (cols[page]) cols[page].src = src(page, query); };

  const q = new URLSearchParams(location.search);
  open('download', q.get('link') ? { link: q.get('link') } : {});
  open('compose');
  open('dashboard');

  // Tin nhắn từ các cột
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || !e.data.svx) return;
    const from = Object.values(cols).find((f) => f.contentWindow === e.source);
    if (!from) return;
    const d = e.data;
    if (d.svx === 'nav') {
      if (d.page === 'studio') return;
      open(d.page, d.query);
      cols[d.page] && cols[d.page].closest('.studio__col').scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
    if (d.svx === 'changed') {
      cols.dashboard.contentWindow.postMessage({ svx: 'refresh', campaign: d.campaign || '' }, location.origin);
    }
  });

  // Nút "+ Video" trên shopee.vn → nạp link vào cột Tải video
  UI.onLinkFromShopee((link) => {
    open('download', { link });
    UI.toast('Đã nhận sản phẩm từ Shopee', 'success');
  });
})();
