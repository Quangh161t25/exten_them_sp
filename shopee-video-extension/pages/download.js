(async () => {
  const { $, esc, toast, header, pageUrl, errText, fmtDuration } = UI;
  await header('download');

  const safeName = (s) => (s || 'video').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  let product = null;

  async function download(url, filename) {
    if (Shopee.isDemo() || url === 'demo') { toast(`(Thử) Sẽ tải: ${filename}`, 'info'); return; }
    try {
      await chrome.downloads.download({ url, filename, conflictAction: 'uniquify' });
    } catch (e) {
      toast('Không tải được: ' + errText(e), 'error');
    }
  }

  function render(p) {
    $('#result').classList.remove('hidden');
    $('#pName').textContent = p.name;
    $('#pMeta').textContent = `Shop ID ${p.shopId} · Item ID ${p.itemId}`;
    $('#pOpen').href = Shopee.links.product(p.shopId, p.itemId);
    $('#vCount').textContent = `(${p.videos.length})`;
    $('#iCount').textContent = `(${p.images.length})`;

    $('#videos').innerHTML = p.videos.length ? p.videos.map((v, i) => `
      <div class="media">
        ${v.url === 'demo' ? '<div class="ph">Video mẫu</div>' : `<video src="${esc(v.url)}" controls preload="metadata" ${v.thumb ? `poster="${esc(v.thumb)}"` : ''}></video>`}
        <div class="media__bar">
          <button class="btn btn--sm btn--ok" data-dl="${i}">Tải video</button>
          <button class="btn btn--sm btn--primary" data-post="${i}">Đăng video</button>
          <span class="muted small" style="margin-left:auto;align-self:center">${fmtDuration(v.duration)}</span>
        </div>
      </div>`).join('') : '<p class="muted">Sản phẩm này không có video.</p>';

    $('#images').innerHTML = p.images.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join('')
      || '<p class="muted small">Không có ảnh.</p>';
    $('#btnImgs').disabled = !p.images.length;
  }

  async function load(link) {
    $('#status').textContent = 'Đang lấy dữ liệu từ Shopee...';
    $('#btnFetch').disabled = true;
    try {
      product = await Shopee.api.getProduct(link);
      render(product);
      $('#status').textContent = '';
    } catch (e) {
      $('#status').textContent = '';
      toast(errText(e), 'error', 6000);
    }
    $('#btnFetch').disabled = false;
  }

  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const link = $('#link').value.trim();
    if (!link) return toast('Hãy dán link sản phẩm', 'warn');
    if (!Shopee.parseProductLink(link) && !Shopee.isDemo()) return toast('Link không hợp lệ. Cần link sản phẩm dạng ...-i.<shopId>.<itemId>', 'warn');
    load(link);
  });

  $('#videos').addEventListener('click', (e) => {
    const dl = e.target.dataset.dl, post = e.target.dataset.post;
    if (dl !== undefined) {
      const v = product.videos[+dl];
      download(v.url, `${safeName(product.name)}${product.videos.length > 1 ? '_' + (+dl + 1) : ''}.mp4`);
    }
    if (post !== undefined) {
      const v = product.videos[+post];
      UI.go('compose', { source: 'shopee', videoUrl: v.url, title: product.name, fromItem: product.itemId, fromShop: product.shopId });
    }
  });

  $('#btnImgs').addEventListener('click', async () => {
    const base = safeName(product.name);
    for (let i = 0; i < product.images.length; i++) {
      await download(product.images[i], `${base}/${base}_${i + 1}.jpg`);
    }
    toast(`Đã gửi ${product.images.length} ảnh tới trình tải xuống`, 'success');
  });

  const qLink = new URLSearchParams(location.search).get('link');
  if (qLink) { $('#link').value = qLink; load(qLink); }
  // Link gửi từ nút "+ Video" trên shopee.vn khi đang mở trang này riêng
  UI.onLinkFromShopee((link) => { $('#link').value = link; load(link); });
})();
