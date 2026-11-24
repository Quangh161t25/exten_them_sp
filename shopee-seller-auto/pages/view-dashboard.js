self.Views = self.Views || {};
Views.dashboard = async (el) => {
  const { esc, fmtNum, fmtTime } = UI;
  const [stats, push, reply, rate, camps] = await Promise.all([
    Store.getStats(), Store.getConfig('push'), Store.getConfig('reply'), Store.getConfig('rate'), Store.listCampaigns(),
  ]);
  const st = (k) => {
    const x = stats[k] || {};
    const isToday = x.date === Store.today();
    return { ok: x.ok || 0, fail: x.fail || 0, todayOk: isToday ? x.todayOk || 0 : 0, todayFail: isToday ? x.todayFail || 0 : 0 };
  };
  const onOff = (c) => (c.enabled ? '<span class="badge badge--ok">Đang bật</span>' : '<span class="badge">Đang tắt</span>');
  const feat = (href, name, cfg, k, desc, extra = '') => {
    const s = st(k);
    return `<a class="card feat" href="#${href}">
      <div class="feat__top"><span class="feat__name">${name}</span>${cfg ? onOff(cfg) : ''}</div>
      <div class="muted small">${desc}</div>
      <div class="row"><div class="grow"><div class="stat__value" style="font-size:22px">${fmtNum(s.todayOk)}</div><div class="stat__sub">hôm nay${s.todayFail ? ` · <span style="color:var(--err)">${s.todayFail} lỗi</span>` : ''}</div></div>
      <div class="grow"><div class="stat__value" style="font-size:22px;color:var(--muted)">${fmtNum(s.ok)}</div><div class="stat__sub">tổng cộng</div></div></div>
      <div class="small muted">${cfg ? esc(UI.lastRunText(cfg)) : extra}</div>
    </a>`;
  };
  const pending = camps.filter((c) => c.status !== 'completed').length;
  el.innerHTML = `
    <div class="page-head"><div><h1>Tổng quan</h1><p>Các tác vụ tự động chạy nền khi trình duyệt đang mở và bạn đã đăng nhập Kênh Người Bán.</p></div></div>
    <div class="grid2">
      ${feat('push', 'Đẩy sản phẩm', push, 'push', `Xoay vòng ${push.items.length} sản phẩm, tối đa ${push.maxActive} SP cùng lúc, khung giờ ${esc(push.from)}–${esc(push.to)}`)}
      ${feat('reply', 'Trả lời đánh giá', reply, 'reply', `Trả lời đánh giá ${reply.stars.join(', ')}★ chưa phản hồi, mỗi ${reply.intervalMin} phút`)}
      ${feat('rate', 'Đánh giá người mua', rate, 'rate', `Đánh giá ${rate.star}★ cho đơn hoàn thành, mỗi ${rate.intervalMin} phút`)}
      ${feat('send', 'Gửi tin nhắn', null, 'send', `${camps.length} chiến dịch, ${pending} chưa gửi xong`, 'Gửi thủ công theo chiến dịch (cần để tab mở khi gửi)')}
    </div>
    <div class="card mt2">
      <div class="card__title">Lưu ý an toàn</div>
      <ul class="small muted" style="margin:8px 0 0;padding-left:18px;line-height:1.7">
        <li>Mọi lệnh gọi chạy trong tab <b>banhang.shopee.vn</b> bằng chính phiên đăng nhập của bạn; dữ liệu chỉ lưu trong máy (chrome.storage).</li>
        <li>Gửi tin nhắn hàng loạt quá dày có thể bị Shopee hạn chế chat. Nên giữ giãn cách mặc định (5 giây/khách, nghỉ 60 giây sau 10 khách) và không gửi lại 1 khách trong 24 giờ.</li>
        <li>Số SP đẩy cùng lúc theo số bạn nhập (Shopee mặc định 5, làm nhiệm vụ được tăng thêm; vượt mức Shopee cho phép thì dừng lượt đó), mỗi lượt 4 giờ. Endpoint đẩy SP có thể chỉnh trong <a href="#settings">Cài đặt</a> nếu Shopee thay đổi.</li>
      </ul>
    </div>`;
};
