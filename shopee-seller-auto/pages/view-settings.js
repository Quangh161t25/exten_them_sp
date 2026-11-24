self.Views = self.Views || {};
Views.settings = async (el) => {
  const { $, esc, toast } = UI;
  const s = await Store.getSettings();
  const b = Shopee.getBoostConfig();
  el.innerHTML = `
    <div class="page-head"><div><h1>Cài đặt</h1><p>Tuỳ chỉnh chung và công cụ kiểm tra kết nối.</p></div></div>
    <div class="card">
      <div class="card__title">Kiểm tra kết nối</div>
      <div class="card__desc">Thử gọi các API chính bằng phiên đăng nhập Kênh Người Bán hiện tại (chỉ đọc, không gửi gì).</div>
      <button class="btn btn--primary" id="test">Kiểm tra</button>
      <div class="table-wrap mt hidden" id="testWrap"><table><tbody id="testBody"></tbody></table></div>
    </div>
    <div class="card">
      <div class="card__title">Tin nhắn</div>
      <label class="check mt"><input type="checkbox" id="closeConv" ${s.closeConversation ? 'checked' : ''}> Đánh dấu hội thoại "đã xử lý" sau khi gửi (giống AutoShopee Kit)</label>
      <div class="field__tip">Bỏ chọn nếu bạn muốn hội thoại vẫn hiện ở mục chưa xử lý trong Shopee Chat.</div>
    </div>
    <div class="card">
      <div class="card__title">Endpoint đẩy sản phẩm (nâng cao)</div>
      <div class="card__desc">API đẩy đã lấy từ request thật của Kênh Người Bán. Nếu sau này Shopee đổi, mở DevTools (F12 → Network), bấm "Đẩy sản phẩm" rồi chép đường dẫn mới vào đây.
        API danh sách đang đẩy có thể để trống: extension sẽ tự tính mỗi sản phẩm đẩy 4 giờ.</div>
      <div class="field"><span class="field__label">API đẩy (POST, body <code>{"id": itemId}</code>)</span><input class="input" id="boostPath" value="${esc(b.boostPath)}"></div>
      <div class="field"><span class="field__label">API danh sách đang đẩy (GET, tuỳ chọn)</span><input class="input" id="boostedListPath" value="${esc(b.boostedListPath)}"></div>
      <div class="row"><button class="btn btn--primary" id="saveBoost">Lưu</button><button class="btn" id="resetBoost">Khôi phục mặc định</button></div>
    </div>
    <div class="card">
      <div class="card__title">Dữ liệu</div>
      <div class="card__desc">Xoá bộ nhớ "đã xử lý" để lần quét sau kiểm tra lại toàn bộ đánh giá / đơn hàng.</div>
      <div class="row row--wrap"><button class="btn" id="resetReply">Quên đánh giá đã trả lời</button><button class="btn" id="resetRate">Quên đơn đã đánh giá</button><button class="btn" id="unlock">Mở khoá tác vụ bị kẹt</button></div>
    </div>`;

  $('#closeConv').addEventListener('change', async (e) => { await Store.saveSettings({ closeConversation: e.target.checked }); toast('Đã lưu', 'ok'); });
  $('#saveBoost').addEventListener('click', async () => {
    const boost = { boostPath: $('#boostPath').value.trim() || Shopee.DEFAULT_BOOST.boostPath, boostedListPath: $('#boostedListPath').value.trim() };
    await Store.saveSettings({ boost }); Shopee.setBoostConfig(boost); toast('Đã lưu', 'ok');
  });
  $('#resetBoost').addEventListener('click', async () => {
    await Store.saveSettings({ boost: {} }); Shopee.setBoostConfig({});
    $('#boostPath').value = Shopee.DEFAULT_BOOST.boostPath; $('#boostedListPath').value = Shopee.DEFAULT_BOOST.boostedListPath; toast('Đã khôi phục', 'ok');
  });
  $('#resetReply').addEventListener('click', async () => { await Store.write('done_reply', {}); toast('Đã xoá', 'ok'); });
  $('#resetRate').addEventListener('click', async () => { await Store.write('done_rate', {}); toast('Đã xoá', 'ok'); });
  $('#unlock').addEventListener('click', async () => {
    for (const k of ['push', 'reply', 'rate']) await Store.unlock(k);
    toast('Đã mở khoá', 'ok');
  });

  $('#test').addEventListener('click', async (e) => {
    e.target.disabled = true;
    $('#testWrap').classList.remove('hidden');
    const body = $('#testBody');
    body.innerHTML = '';
    const tests = [
      ['Thông tin shop', async () => { const x = await Shopee.shopInfo(); return `${x.shopName} (#${x.shopId})`; }],
      ['Danh sách sản phẩm', async () => `${(await Shopee.searchProducts('', 1, 5)).total} sản phẩm`],
      ['Đánh giá chờ trả lời', async () => `${(await Shopee.ratingCounts([5, 4, 3, 2, 1])).toReply} đánh giá`],
      ['Đơn hoàn thành', async () => { const r = await Shopee.listOrderPage(1, 10); return `${r.total || r.orders.length} đơn · ${r.orders.filter((o) => o.ratable).length}/${r.orders.length} đơn trang đầu có thể đánh giá`; }],
      ['Đăng nhập Shopee Chat', async () => { if (Shopee.isDemo()) return 'chế độ thử'; const a = await Shopee.chatLogin(true); return `userId ${a.userId}`; }],
      ['Danh sách voucher', async () => `${(await Shopee.listVouchers()).length} voucher`],
      ['Sản phẩm đang đẩy', async () => {
        if (!Shopee.isDemo() && !Shopee.getBoostConfig().boostedListPath) return 'Không dùng API danh sách — extension tự tính 4 giờ/lượt kể từ lúc đẩy';
        const r = await Shopee.boostedList();
        if (!r) throw new Error('Không đọc được — kiểm tra endpoint ở dưới');
        return `${r.length} sản phẩm`;
      }],
    ];
    for (const [name, fn] of tests) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(name)}</b></td><td><span class="badge">Đang kiểm tra…</span></td>`;
      body.appendChild(tr);
      try { tr.lastElementChild.innerHTML = `<span class="badge badge--ok">OK</span> <span class="small">${esc(await fn())}</span>`; }
      catch (err) { tr.lastElementChild.innerHTML = `<span class="badge badge--err">Lỗi</span> <span class="small">${esc(Jobs.errMsg(err))}</span>`; }
    }
    e.target.disabled = false;
  });
};
