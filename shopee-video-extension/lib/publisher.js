// Đăng 1 item (dùng chung cho trang Soạn và Dashboard)
(() => {
  async function getVideoBlob(item) {
    if (Shopee.isDemo()) return new Blob([new Uint8Array(16)], { type: 'video/mp4' });
    if (item.source === 'file') {
      const b = await Blobs.get(item.id);
      if (!b) throw new Error('Không còn file video đã chọn (có thể đã bị xoá khỏi bộ nhớ)');
      return b;
    }
    if (!item.sourceUrl || item.sourceUrl === 'demo') throw new Error('Item không có link video');
    const res = await fetch(item.sourceUrl);
    if (!res.ok) throw new Error(`Tải video nguồn lỗi HTTP ${res.status}`);
    return res.blob();
  }

  /** Đăng item lên Shopee, cập nhật trạng thái vào Store. Trả về item mới. */
  async function run(item, shop, onStep = () => {}) {
    try {
      if (!item.caption || !item.caption.trim()) throw new Error('Thiếu tiêu đề / mô tả');
      if (!item.products || !item.products.length) throw new Error('Cần gắn ít nhất 1 sản phẩm');
      onStep('Đang lấy file video...');
      const blob = await getVideoBlob(item);
      const r = await Shopee.api.publish(blob, { caption: item.caption.trim(), products: item.products, shopId: shop.shopId }, onStep);
      let patch = { status: 'done', errorMsg: '', mmsVid: r.mmsVid, videoId: r.videoId, postedAt: new Date().toISOString(), duration: r.duration || item.duration || 0 };
      if (r.videoId) {
        try { patch = { ...patch, ...(await Shopee.api.getMetrics(r.videoId)) }; } catch {}
      }
      return await Store.updateItem(item.id, patch);
    } catch (e) {
      await Store.updateItem(item.id, { status: 'error', errorMsg: UI.errText(e).slice(0, 300) });
      throw e;
    }
  }

  /** Hỏi xác nhận trước khi đăng thật */
  async function confirmPublish(count, shop) {
    if (Shopee.isDemo()) return true;
    return UI.dialog({
      title: count > 1 ? `Đăng ${count} video lên Shopee?` : 'Đăng video lên Shopee?',
      body: `Video sẽ được upload và <b>đăng công khai</b> trên kênh Shopee Video của shop <b>${UI.esc(shop.shopName || shop.shopId)}</b>. Thao tác này dùng tài khoản Kênh Người Bán đang đăng nhập.`,
      okText: 'Đăng thật',
    });
  }

  window.Publisher = { run, confirmPublish };
})();
