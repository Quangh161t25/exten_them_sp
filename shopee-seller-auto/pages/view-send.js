self.Views = self.Views || {};

const SEND_STATUS = {
  pending: ['Chờ gửi', ''], sending: ['Đang gửi', 'badge--info'], completed: ['Hoàn thành', 'badge--ok'],
  sent: ['Đã gửi', 'badge--ok'], failed: ['Lỗi', 'badge--err'], skipped: ['Bỏ qua', 'badge--warn'],
};
const sendBadge = (s) => { const [t, c] = SEND_STATUS[s] || [s, '']; return `<span class="badge ${c}">${UI.esc(t)}</span>`; };

Views.send = async (el, id) => (id ? sendDetail(el, id) : sendList(el));

async function sendList(el) {
  const { $, esc, toast, fmtTime } = UI;
  const camps = await Store.listCampaigns();
  const rows = await Promise.all(camps.map(async (c) => {
    const cs = await Store.getCustomers(c.id);
    const n = (s) => cs.filter((x) => x.status === s).length;
    return { c, total: cs.length, sent: n('sent'), failed: n('failed'), pending: cs.filter((x) => x.status === 'pending' && x.active !== false).length };
  }));
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Gửi tin nhắn hàng loạt</h1><p>Tạo chiến dịch → thu thập khách (từ đánh giá, đơn hàng hoặc dán danh sách) → soạn kịch bản → gửi.</p></div>
      <button class="btn btn--primary" id="create">+ Chiến dịch mới</button>
    </div>
    <div class="card">
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Chiến dịch</th><th>Trạng thái</th><th class="num">Khách</th><th class="num">Đã gửi</th><th class="num">Lỗi</th><th class="num">Còn chờ</th><th>Tạo lúc</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td><a href="#send/${esc(r.c.id)}"><b>${esc(r.c.name)}</b></a></td><td>${sendBadge(r.c.status)}</td>
          <td class="num">${r.total}</td><td class="num">${r.sent}</td><td class="num">${r.failed}</td><td class="num">${r.pending}</td>
          <td class="small">${fmtTime(r.c.createdAt)}</td>
          <td style="white-space:nowrap"><a class="btn btn--sm" href="#send/${esc(r.c.id)}">Mở</a> <button class="link-btn link-btn--danger small" data-del="${esc(r.c.id)}">Xoá</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Chưa có chiến dịch nào. Bấm "+ Chiến dịch mới" để bắt đầu.</div>'}
    </div>`;
  $('#create').addEventListener('click', async () => {
    const name = await UI.dialog({ title: 'Tên chiến dịch', input: `Chiến dịch ${new Date().toLocaleDateString('vi-VN')}`, okText: 'Tạo' });
    if (!name) return;
    const c = await Store.createCampaign(name);
    location.hash = `send/${c.id}`;
  });
  el.addEventListener('click', async (e) => {
    const id = e.target.dataset.del;
    if (!id) return;
    const c = camps.find((x) => x.id === id);
    if (!(await UI.dialog({ title: 'Xoá chiến dịch?', body: `Xoá "${esc(c.name)}" và toàn bộ danh sách khách của nó.`, danger: true, okText: 'Xoá' }))) return;
    await Store.removeCampaign(id);
    toast('Đã xoá', 'ok');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

async function sendDetail(el, id) {
  const { $, $$, esc, toast, fmtTime } = UI;
  let camp = await Store.getCampaign(id);
  if (!camp) { el.innerHTML = '<div class="card empty">Không tìm thấy chiến dịch. <a href="#send">Quay lại</a></div>'; return; }
  let tab = 'customers';
  let filter = 'all';
  let page = 1;
  const PAGE = 50;

  el.innerHTML = `
    <div class="page-head">
      <div><a href="#send" class="small">← Tất cả chiến dịch</a><h1 class="mt" id="title"></h1><p id="sub"></p></div>
      <div class="row"><button class="btn" id="rename">Đổi tên</button></div>
    </div>
    <div class="stats" id="stats"></div>
    <div class="tabs" id="tabs">
      <button data-tab="customers">1 · Khách hàng</button><button data-tab="script">2 · Kịch bản</button><button data-tab="run">3 · Gửi</button>
    </div>
    <div class="mt" id="pane"></div>`;

  async function head() {
    camp = await Store.getCampaign(id);
    const cs = await Store.getCustomers(id);
    const n = (s) => cs.filter((x) => x.status === s).length;
    const pending = cs.filter((x) => x.status === 'pending' && x.active !== false).length;
    $('#title').textContent = camp.name;
    $('#sub').innerHTML = `${sendBadge(camp.status)} ${camp.lastRun ? `<span class="small muted">· gửi gần nhất ${fmtTime(camp.lastRun)}</span>` : ''}`;
    $('#stats').innerHTML = [
      ['Tổng khách', cs.length, ''], ['Còn chờ', pending, ''], ['Đã gửi', n('sent'), 'stat--ok'], ['Lỗi', n('failed'), 'stat--err'], ['Bỏ qua', n('skipped'), 'stat--warn'],
    ].map(([l, v, c]) => `<div class="stat ${c}"><div class="stat__label">${l}</div><div class="stat__value">${UI.fmtNum(v)}</div></div>`).join('');
    return cs;
  }

  $('#rename').addEventListener('click', async () => {
    const name = await UI.dialog({ title: 'Đổi tên chiến dịch', input: camp.name, okText: 'Lưu' });
    if (name) { await Store.updateCampaign(id, { name }); head(); }
  });
  $('#tabs').addEventListener('click', (e) => { if (e.target.dataset.tab) { tab = e.target.dataset.tab; render(); } });

  async function render() {
    $$('#tabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    await head();
    if (tab === 'customers') return paneCustomers();
    if (tab === 'script') return paneScript();
    return paneRun();
  }

  // ---------------- Tab 1: khách hàng ----------------
  async function paneCustomers() {
    const pane = $('#pane');
    pane.innerHTML = `
      <div class="grid3">
        <div class="card"><div class="card__title">Từ đánh giá</div><div class="card__desc">Lấy người mua đã đánh giá shop.</div>
          <div class="stars">${[5, 4, 3, 2, 1].map((s) => `<label><input class="sr" type="checkbox" data-cstar="${s}" ${s >= 4 ? 'checked' : ''}>${s}★</label>`).join('')}</div>
          <div class="row mt"><input type="date" class="input" id="cFrom" title="Từ ngày"><input type="date" class="input" id="cTo" title="Đến ngày"></div>
          <div class="row mt"><span class="small grow">Số trang (40/trang)</span><input type="number" class="input input--num" id="cPages" value="20" min="1"></div>
          <button class="btn btn--primary mt" id="fromRating">Thu thập</button></div>
        <div class="card"><div class="card__title">Từ đơn hoàn thành</div><div class="card__desc">Lấy người mua trong các đơn đã hoàn thành gần đây.</div>
          <div class="row"><span class="small grow">Số trang (40 đơn/trang)</span><input type="number" class="input input--num" id="oPages" value="10" min="1"></div>
          <button class="btn btn--primary mt" id="fromOrder">Thu thập</button></div>
        <div class="card"><div class="card__title">Dán danh sách</div><div class="card__desc">Mỗi dòng 1 khách: <code>userId</code> hoặc <code>username</code>, thêm <code>, Tên</code> nếu muốn.</div>
          <textarea class="input" id="importText" rows="4" placeholder="123456789, Chị Lan&#10;ngoc.tran"></textarea>
          <button class="btn btn--primary mt" id="import">Thêm vào danh sách</button></div>
      </div>
      <div class="card">
        <div class="row row--wrap">
          <div class="tabs" id="filter">${['all', 'pending', 'sent', 'failed', 'skipped'].map((f) => `<button data-f="${f}" class="${f === filter ? 'is-active' : ''}">${f === 'all' ? 'Tất cả' : SEND_STATUS[f][0]}</button>`).join('')}</div>
          <span class="grow"></span>
          <button class="btn btn--sm" id="resetFail">Đặt lại Lỗi/Bỏ qua → Chờ</button>
          <button class="btn btn--sm" id="clearSent">Xoá khách đã gửi</button>
        </div>
        <div class="table-wrap mt"><table><thead><tr><th>Khách</th><th>User ID</th><th>Nguồn</th><th>Trạng thái</th><th>Gửi lúc</th><th>Bật</th><th></th></tr></thead><tbody id="custBody"></tbody></table></div>
        <div class="row mt" id="pager"></div>
      </div>
      <div class="card hidden" id="collectCard"><div class="row"><div class="card__title grow">Tiến trình thu thập</div><button class="btn btn--danger btn--sm hidden" id="cStop">Dừng</button></div><div class="log mt" id="cLog"></div></div>`;

    const cLog = (type, msg) => {
      $('#collectCard').classList.remove('hidden');
      $('#cLog').insertAdjacentHTML('afterbegin', `<div class="${type}"><time>${fmtTime(Date.now())}</time>${esc(msg)}</div>`);
    };
    const collect = async (btn, fn) => {
      let stopped = false;
      btn.disabled = true;
      $('#cStop').classList.remove('hidden');
      $('#cStop').onclick = () => { stopped = true; };
      try {
        const r = await fn(() => stopped);
        cLog('ok', `Thêm ${r.added} khách mới, ${r.skipped} khách đã có trong danh sách.`);
        toast(`Đã thêm ${r.added} khách`, 'ok');
      } catch (e) { cLog('error', Jobs.errMsg(e)); toast(Jobs.errMsg(e), 'error', 6000); }
      finally { btn.disabled = false; $('#cStop').classList.add('hidden'); render(); }
    };
    const dateSec = (v, end) => (v ? Math.floor(new Date(v + (end ? 'T23:59:59' : 'T00:00:00')).getTime() / 1000) : 0);
    $('#fromRating').addEventListener('click', (e) => {
      const stars = $$('[data-cstar]').filter((x) => x.checked).map((x) => Number(x.dataset.cstar));
      if (!stars.length) return toast('Chọn ít nhất 1 mức sao', 'warn');
      collect(e.target, (stop) => Jobs.collectFromRatings(id, { stars, timeStart: dateSec($('#cFrom').value), timeEnd: dateSec($('#cTo').value, true), maxPages: Number($('#cPages').value) || 20 }, cLog, stop));
    });
    $('#fromOrder').addEventListener('click', (e) => collect(e.target, (stop) => Jobs.collectFromOrders(id, { maxPages: Number($('#oPages').value) || 10 }, cLog, stop)));
    $('#import').addEventListener('click', async () => {
      const { list, errors } = Jobs.parseImport($('#importText').value);
      errors.forEach((x) => cLog('error', x));
      if (!list.length) return toast('Không có dòng hợp lệ', 'warn');
      const r = await Store.addCustomers(id, list);
      $('#importText').value = '';
      toast(`Đã thêm ${r.added} khách${r.skipped ? `, ${r.skipped} trùng` : ''}`, 'ok');
      render();
    });

    $('#filter').addEventListener('click', (e) => { if (e.target.dataset.f) { filter = e.target.dataset.f; page = 1; paneCustomers(); } });
    $('#resetFail').addEventListener('click', async () => {
      const cs = await Store.getCustomers(id);
      let n = 0;
      cs.forEach((c) => { if (c.status === 'failed' || c.status === 'skipped') { c.status = 'pending'; c.error = ''; n++; } });
      await Store.saveCustomers(id, cs);
      if (n) await Store.updateCampaign(id, { status: 'pending' });
      toast(`Đã đặt lại ${n} khách`, 'ok'); render();
    });
    $('#clearSent').addEventListener('click', async () => {
      const cs = await Store.getCustomers(id);
      const keep = cs.filter((c) => c.status !== 'sent');
      if (keep.length === cs.length) return toast('Không có khách đã gửi');
      if (!(await UI.dialog({ title: `Xoá ${cs.length - keep.length} khách đã gửi?`, danger: true, okText: 'Xoá' }))) return;
      await Store.saveCustomers(id, keep); render();
    });

    const all = (await Store.getCustomers(id)).filter((c) => filter === 'all' || c.status === filter);
    const pages = Math.max(1, Math.ceil(all.length / PAGE));
    page = Math.min(page, pages);
    const list = all.slice((page - 1) * PAGE, page * PAGE);
    const SRC = { rating: 'Đánh giá', order: 'Đơn hàng', import: 'Dán tay' };
    $('#custBody').innerHTML = list.length ? list.map((c) => `<tr data-k="${esc(c.key)}">
        <td><b>${esc(c.name)}</b>${c.username ? `<div class="small muted">@${esc(c.username)}</div>` : ''}</td>
        <td class="small">${c.userId || '<span class="muted">chưa tra</span>'}</td>
        <td class="small">${esc(SRC[c.source] || c.source)}</td>
        <td>${sendBadge(c.status)}${c.error ? `<div class="small" style="color:var(--err);max-width:260px">${esc(c.error)}</div>` : ''}</td>
        <td class="small">${fmtTime(c.sentAt)}</td>
        <td><input type="checkbox" data-act="active" ${c.active !== false ? 'checked' : ''}></td>
        <td><button class="link-btn link-btn--danger small" data-act="del">Xoá</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">Chưa có khách nào. Thu thập bằng 1 trong 3 cách ở trên.</td></tr>';
    $('#pager').innerHTML = pages > 1 ? `<button class="btn btn--sm" data-p="${page - 1}" ${page > 1 ? '' : 'disabled'}>‹</button><span class="small">Trang ${page}/${pages} · ${all.length} khách</span><button class="btn btn--sm" data-p="${page + 1}" ${page < pages ? '' : 'disabled'}>›</button>` : `<span class="small muted">${all.length} khách</span>`;
    $('#pager').onclick = (e) => { if (e.target.dataset.p) { page = Number(e.target.dataset.p); paneCustomers(); } };
    $('#custBody').onclick = async (e) => {
      const act = e.target.dataset.act;
      const k = e.target.closest('tr') && e.target.closest('tr').dataset.k;
      if (!act || !k) return;
      if (act === 'active') await Store.updateCustomer(id, k, { active: e.target.checked });
      if (act === 'del') { await Store.saveCustomers(id, (await Store.getCustomers(id)).filter((c) => c.key !== k)); paneCustomers(); }
      head();
    };
  }

  // ---------------- Tab 2: kịch bản ----------------
  async function paneScript() {
    const pane = $('#pane');
    let contents = JSON.parse(JSON.stringify(camp.contents || []));
    const cfg = { ...camp.config };
    const TYPES = { text: 'Văn bản', sticker: 'Sticker', image: 'Hình ảnh', product: 'Sản phẩm', voucher: 'Voucher' };
    pane.innerHTML = `
      <div class="grid2" style="grid-template-columns:3fr 2fr">
        <div class="card"><div class="card__title">Nội dung gửi (theo thứ tự)</div>
          <div class="card__desc">Mỗi khách sẽ nhận lần lượt các nội dung dưới đây, cách nhau 1 giây. Văn bản hỗ trợ <code>{ten}</code>, <code>{shop}</code> và biến thể <code>---</code>.</div>
          <div class="script" id="script"></div>
          <div class="row row--wrap mt">${Object.entries(TYPES).map(([k, t]) => `<button class="btn btn--sm" data-add="${k}">+ ${t}</button>`).join('')}</div>
        </div>
        <div class="card"><div class="card__title">Tốc độ gửi</div><div class="card__desc">Giữ giãn cách hợp lý để tránh bị Shopee hạn chế chat.</div>
          ${[['delaySec', 'Giãn cách giữa 2 khách (giây)', 0], ['pauseAfter', 'Nghỉ sau mỗi … khách', 0], ['pauseSec', 'Thời gian nghỉ (giây)', 0], ['cooldownMin', 'Không gửi lại 1 khách trong (phút)', 0], ['maxSend', 'Tối đa khách mỗi lần bấm Gửi (0 = không giới hạn)', 0]]
            .map(([k, l, m]) => `<div class="field row"><span class="grow small">${l}</span><input type="number" class="input input--num" data-cfg="${k}" min="${m}" value="${esc(cfg[k])}"></div>`).join('')}
          <button class="btn btn--primary" id="saveScript">Lưu kịch bản</button>
        </div>
      </div>`;

    const stickerImg = (p, s) => self.stickerUrl(p, s);
    function draw() {
      $('#script').innerHTML = contents.map((it, i) => {
        const p = it.payload || {};
        let body = '';
        if (it.type === 'text') body = `<textarea class="input" data-f="text" rows="3">${esc(it.text)}</textarea>`;
        if (it.type === 'sticker') {
          body = `<div class="sel-preview">${p.stickerId ? `<img src="${esc(stickerImg(p.stickerPackage, p.stickerId))}" alt="">` : '<span class="muted small">Chưa chọn</span>'}<button class="btn btn--sm" data-act="stickers">Chọn sticker</button></div>
            <div class="sticker-grid mt hidden" data-grid>${self.STICKERS.map((s) => `<button title="${esc(s.n)}" data-sp="${esc(s.p)}" data-sid="${esc(s.s)}" class="${s.s === p.stickerId && s.p === p.stickerPackage ? 'is-selected' : ''}"><img loading="lazy" src="${esc(stickerImg(s.p, s.s))}" alt="${esc(s.n)}"></button>`).join('')}</div>`;
        }
        if (it.type === 'image') body = `<div class="sel-preview">${p.imageId ? `<img src="https://down-sg.img.susercontent.com/${esc(p.imageId)}" alt="">` : '<span class="muted small">Chưa có ảnh</span>'}<label class="btn btn--sm">Tải ảnh lên (≤5MB)<input type="file" accept="image/*" data-act="upload" hidden></label></div>`;
        if (it.type === 'product') body = `<div class="sel-preview">${p.productId ? `${p.productImage ? `<img src="${esc(p.productImage)}" alt="">` : ''}<span class="small">${esc(p.productName)} <span class="muted">#${esc(p.productId)}</span></span>` : '<span class="muted small">Chưa chọn</span>'}</div>
            <div class="row mt"><input class="input grow" data-f="pq" placeholder="Tìm sản phẩm theo tên/ID…"><button class="btn btn--sm" data-act="psearch">Tìm</button></div><div class="picker hidden" data-plist></div>`;
        if (it.type === 'voucher') body = `<div class="sel-preview">${p.voucherId ? `<span class="badge badge--info">${esc(p.voucherCode)}</span><span class="small">${esc(p.voucherName || '')}</span>` : '<span class="muted small">Chưa chọn</span>'}<button class="btn btn--sm" data-act="vload">Chọn voucher</button></div><div class="picker hidden" data-vlist></div>`;
        return `<div class="sitem" data-i="${i}"><div class="sitem__head"><span class="sitem__type grow">${i + 1}. ${TYPES[it.type]}</span>
          <button class="btn btn--sm" data-act="up" ${i ? '' : 'disabled'}>↑</button><button class="btn btn--sm" data-act="down" ${i < contents.length - 1 ? '' : 'disabled'}>↓</button>
          <button class="link-btn link-btn--danger small" data-act="del">Xoá</button></div>${body}</div>`;
      }).join('') || '<div class="empty small">Chưa có nội dung. Thêm bằng các nút bên dưới.</div>';
      $$('#script textarea[data-f=text]').forEach((t) => UI.varButtons(t, [['{ten}', 'Tên khách'], ['{shop}', 'Tên shop']]));
    }
    draw();

    pane.querySelector('.row.row--wrap').addEventListener('click', (e) => {
      const t = e.target.dataset.add;
      if (t) { contents.push({ type: t, text: '', payload: {} }); draw(); }
    });
    $('#script').addEventListener('input', (e) => {
      const box = e.target.closest('[data-i]');
      if (box && e.target.dataset.f === 'text') contents[Number(box.dataset.i)].text = e.target.value;
    });
    $('#script').addEventListener('change', async (e) => {
      if (e.target.dataset.act !== 'upload') return;
      const i = Number(e.target.closest('[data-i]').dataset.i);
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) return toast('Ảnh tối đa 5MB', 'warn');
      try {
        toast('Đang tải ảnh lên Shopee…');
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
        const imageId = await Shopee.uploadChatImage(b64, f.type, f.name);
        contents[i].payload = { imageId };
        draw(); toast('Đã tải ảnh', 'ok');
      } catch (err) { toast('Lỗi tải ảnh: ' + Jobs.errMsg(err), 'error', 6000); }
    });
    $('#script').addEventListener('click', async (e) => {
      const box = e.target.closest('[data-i]');
      if (!box) return;
      const i = Number(box.dataset.i);
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'del') { contents.splice(i, 1); return draw(); }
      if (act === 'up' && i > 0) { [contents[i - 1], contents[i]] = [contents[i], contents[i - 1]]; return draw(); }
      if (act === 'down' && i < contents.length - 1) { [contents[i + 1], contents[i]] = [contents[i], contents[i + 1]]; return draw(); }
      if (act === 'stickers') return box.querySelector('[data-grid]').classList.toggle('hidden');
      if (btn.dataset.sid) { contents[i].payload = { stickerId: btn.dataset.sid, stickerPackage: btn.dataset.sp }; return draw(); }
      if (act === 'psearch') {
        const list = box.querySelector('[data-plist]');
        list.classList.remove('hidden');
        list.innerHTML = '<div class="empty small">Đang tìm…</div>';
        try {
          const r = await Shopee.searchProducts(box.querySelector('[data-f=pq]').value.trim(), 1, 20);
          box._prods = r.list;
          list.innerHTML = r.list.map((p, k) => `<div class="picker__item" data-pk="${k}">${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="">` : '<span class="thumb"></span>'}<div class="grow clamp">${esc(p.name)}</div></div>`).join('') || '<div class="empty small">Không có kết quả</div>';
        } catch (err) { list.innerHTML = `<div class="empty small" style="color:var(--err)">${esc(Jobs.errMsg(err))}</div>`; }
        return;
      }
      if (act === 'vload') {
        const list = box.querySelector('[data-vlist]');
        list.classList.remove('hidden');
        list.innerHTML = '<div class="empty small">Đang tải voucher…</div>';
        try {
          const vs = await Shopee.listVouchers();
          box._vs = vs;
          list.innerHTML = vs.map((v, k) => `<div class="picker__item" data-vk="${k}"><span class="badge badge--info">${esc(v.code)}</span><div class="grow small">${esc(v.name)}</div></div>`).join('') || '<div class="empty small">Shop chưa có voucher</div>';
        } catch (err) { list.innerHTML = `<div class="empty small" style="color:var(--err)">${esc(Jobs.errMsg(err))}</div>`; }
      }
    });
    // chọn sản phẩm / voucher trong danh sách (phần tử div, không phải button)
    $('#script').addEventListener('click', (e) => {
      const box = e.target.closest('[data-i]');
      const pk = e.target.closest('[data-pk]');
      const vk = e.target.closest('[data-vk]');
      if (!box || (!pk && !vk)) return;
      const i = Number(box.dataset.i);
      if (pk) { const p = box._prods[Number(pk.dataset.pk)]; contents[i].payload = { productId: p.id, productName: p.name, productImage: p.image }; }
      if (vk) { const v = box._vs[Number(vk.dataset.vk)]; contents[i].payload = { voucherId: v.id, voucherCode: v.code, voucherName: v.name }; }
      draw();
    });

    $('#saveScript').addEventListener('click', async () => {
      $$('[data-cfg]').forEach((x) => { cfg[x.dataset.cfg] = Math.max(0, Number(x.value) || 0); });
      const bad = contents.filter((c) => !Jobs.validContent(c)).length;
      await Store.updateCampaign(id, { contents: contents.filter(Jobs.validContent), config: cfg });
      camp = await Store.getCampaign(id);
      contents = JSON.parse(JSON.stringify(camp.contents));
      draw();
      toast(bad ? `Đã lưu (bỏ ${bad} mục chưa hoàn chỉnh)` : 'Đã lưu kịch bản', bad ? 'warn' : 'ok');
    });
  }

  // ---------------- Tab 3: gửi ----------------
  async function paneRun() {
    const pane = $('#pane');
    const cs = await Store.getCustomers(id);
    const pending = cs.filter((x) => x.status === 'pending' && x.active !== false).length;
    const done = cs.filter((x) => x.status !== 'pending').length;
    const pct = cs.length ? Math.round((done / cs.length) * 100) : 0;
    const valid = (camp.contents || []).filter(Jobs.validContent);
    const c = camp.config;
    pane.innerHTML = `
      <div class="card">
        <div class="row"><div class="grow"><div class="card__title">Gửi tin nhắn</div>
          <div class="card__desc">${valid.length} nội dung/khách · cách ${c.delaySec}s, nghỉ ${c.pauseSec}s sau mỗi ${c.pauseAfter} khách · không gửi lại trong ${c.cooldownMin} phút${Number(c.maxSend) ? ` · tối đa ${c.maxSend} khách/lần` : ''}</div></div>
          <button class="btn btn--primary" id="start" ${pending && valid.length ? '' : 'disabled'}>Bắt đầu gửi (${pending})</button><button class="btn btn--danger hidden" id="stop">Dừng</button></div>
        <div class="progress mt"><div id="bar" style="width:${pct}%"></div></div>
        <div class="small muted mt" id="pct">${done}/${cs.length} khách đã xử lý</div>
        ${!valid.length ? '<div class="notice notice--warn mt">Kịch bản chưa có nội dung — vào tab "Kịch bản" để soạn.</div>' : ''}
        ${!pending && cs.length ? '<div class="notice mt">Không còn khách ở trạng thái Chờ. Có thể "Đặt lại Lỗi/Bỏ qua → Chờ" ở tab Khách hàng.</div>' : ''}
        <div class="notice mt">Cần để trang này mở trong lúc gửi. Có thể làm việc khác ở tab khác.</div>
      </div>
      <div class="card"><div class="row"><div class="card__title grow">Nhật ký gửi</div><button class="link-btn small" id="clearLog">Xoá nhật ký</button></div><div class="log mt" id="log"></div></div>`;
    const drawLog = await UI.bindLog($('#log'), 'send');
    $('#clearLog').addEventListener('click', async () => { await Store.clearLog('send'); drawLog(); });
    const progress = async () => {
      const l = await Store.getCustomers(id);
      const d = l.filter((x) => x.status !== 'pending').length;
      $('#bar').style.width = `${l.length ? Math.round((d / l.length) * 100) : 0}%`;
      $('#pct').textContent = `${d}/${l.length} khách đã xử lý`;
      head();
    };
    $('#start').addEventListener('click', async () => {
      if (!(await UI.dialog({ title: 'Bắt đầu gửi?', body: `Gửi kịch bản ${valid.length} nội dung cho ${Number(c.maxSend) ? Math.min(pending, c.maxSend) : pending} khách.${Shopee.isDemo() ? ' (Chế độ thử: không gửi thật)' : ''}`, okText: 'Gửi' }))) return;
      await UI.runInPage('send_' + id, $('#start'), $('#stop'), (stop) => Jobs.runCampaign(id, { stop, onLog: () => drawLog(), onProgress: progress }));
      paneRun();
    });
  }

  render();
}
