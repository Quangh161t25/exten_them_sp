(async () => {
  const { $, esc, toast, dialog, header, pageUrl, errText, fmtCompact, fmtTime, fmtDuration, fmtPrice } = UI;
  await header('dashboard');

  const STALE_MS = 5 * 60 * 1000;
  const st = { shop: null, campaigns: [], items: [], active: new URLSearchParams(location.search).get('campaign') || '', filter: 'all', busy: new Set(), open: new Set(), bulk: false };

  $('#lnkManage').href = Shopee.links.manage;
  const norm = (i) => (i.status === 'done' ? 'done' : i.status === 'error' ? 'error' : 'pending');
  const STATUS = { done: 'Đã đăng', error: 'Lỗi', pending: 'Chờ' };

  // ---------- Render ----------
  async function renderStats() {
    const s = await Store.stats(st.shop.shopId);
    const cell = (label, v, cls = '') => `<div class="stat ${cls}"><div class="stat__label">${label}</div><div class="stat__value">${v}</div></div>`;
    $('#stats').innerHTML = cell('Chiến dịch', s.campaigns) + cell('Tổng video', s.items) + cell('Đã đăng', s.done, 'stat--ok') + cell('Lỗi', s.error, 'stat--err') + cell('Chờ', s.pending, 'stat--warn');
    $('#btnSeed').classList.toggle('hidden', !(Shopee.isDemo() && s.campaigns === 0));
  }

  async function renderCamps() {
    const counts = {};
    (await Store.listItems()).forEach((i) => { counts[i.campaignId] = (counts[i.campaignId] || 0) + 1; });
    $('#camps').innerHTML = st.campaigns.length ? st.campaigns.map((c) => `
      <div class="camp ${c.id === st.active ? 'is-active' : ''}" data-id="${c.id}">
        <div class="grow"><div class="camp__name" title="${esc(c.name)}">${esc(c.name)}</div><div class="small muted">${counts[c.id] || 0} video</div></div>
        <button class="link-btn" data-rename="${c.id}" title="Đổi tên">✎</button>
        <button class="link-btn link-btn--danger" data-del="${c.id}" title="Xoá">🗑</button>
      </div>`).join('') : '<p class="muted small" style="margin-top:10px">Chưa có chiến dịch. Bấm “+ Tạo”.</p>';
  }

  const pendingItems = () => st.items.filter((i) => norm(i) !== 'done');

  function itemHtml(i) {
    const s = norm(i);
    const busy = st.busy.has(i.id);
    const thumb = i.cover ? `<img src="${esc(i.cover)}" alt="">`
      : (i.sourceUrl && i.sourceUrl !== 'demo') ? `<video src="${esc(i.sourceUrl)}#t=0.5" preload="metadata" muted></video>` : '▶';
    const synced = i.metricsSyncedAt ? `Đồng bộ: ${fmtTime(i.metricsSyncedAt)}` : 'Chưa đồng bộ';
    const prods = (i.products || []);
    return `
    <div class="vitem vitem--${s}" data-id="${i.id}">
      <div class="vitem__thumb">${thumb}${i.duration ? `<span class="vitem__dur">${fmtDuration(i.duration)}</span>` : ''}</div>
      <div class="grow">
        <div class="vitem__title">${esc(i.caption || '(chưa có tiêu đề)')} <button class="link-btn small" data-act="caption" title="Sửa tiêu đề">✎</button></div>
        <div class="vitem__meta">
          <span class="badge badge--${s}">${busy ? 'Đang xử lý…' : STATUS[s]}</span>
          <span>🕒 ${fmtTime(i.postedAt || i.createdAt)}</span>
          <span>📦 ${prods.length} sản phẩm</span>
          ${i.videoId ? `<span class="code">ID: ${esc(i.videoId)}</span>` : ''}
          ${i.source === 'file' ? `<span>📁 ${esc(i.sourceName || 'File từ máy')}</span>` : ''}
          ${prods.length ? `<button class="link-btn small" data-act="toggle">${st.open.has(i.id) ? 'Thu gọn ▲' : 'Xem ▼'}</button>` : ''}
        </div>
        ${s === 'error' && i.errorMsg ? `<div class="err-msg">${esc(i.errorMsg)}</div>` : ''}
        ${i.progressText && busy ? `<div class="small muted" style="margin-top:4px">${esc(i.progressText)}</div>` : ''}
        ${st.open.has(i.id) ? `<div class="vitem__products">${prods.map((p) => `
          <div class="vitem__product">${p.cover ? `<img class="thumb" src="${esc(Shopee.imgUrl(p.cover))}_tn" alt="">` : '<div class="thumb"></div>'}
          <div class="grow">${esc(p.name)}<div class="small"><span class="price">${fmtPrice(p.snapshot.minPrice, p.snapshot.maxPrice)}</span> <span class="muted">· Kho: ${p.snapshot.stock}</span></div></div></div>`).join('')}</div>` : ''}
        ${s === 'done' ? `<div class="metrics">
          <span title="Lượt xem">👁 ${fmtCompact(i.viewCount)}</span><span title="Lượt thích">♥ ${fmtCompact(i.likeCount)}</span>
          <span title="Bình luận">💬 ${fmtCompact(i.commentCount)}</span><span title="Chia sẻ">↗ ${fmtCompact(i.shareCount)}</span>
          ${i.soldCount ? `<span title="Sản phẩm đã bán">🛒 ${fmtCompact(i.soldCount)}</span>` : ''}
          <span class="metrics__sync">${synced}</span></div>` : ''}
      </div>
      <div class="vitem__actions">
        ${s !== 'done' ? `<button class="btn btn--sm btn--danger" data-act="post" ${busy || st.bulk ? 'disabled' : ''}>${s === 'error' ? 'Đăng lại' : 'Đăng'}</button>
          <a class="btn btn--sm" href="${pageUrl('compose', { item: i.id })}">Sửa</a>` : ''}
        ${s === 'done' && i.videoId ? `<button class="btn btn--sm" data-act="sync" ${busy ? 'disabled' : ''}>Đồng bộ</button>
          <a class="btn btn--sm btn--ghost" href="${Shopee.links.insight(i.videoId)}" target="_blank" rel="noopener">Thống kê ↗</a>` : ''}
        <button class="link-btn link-btn--danger small" data-act="delete" ${busy ? 'disabled' : ''}>Xoá</button>
      </div>
    </div>`;
  }

  function renderItems() {
    const list = st.filter === 'all' ? st.items : st.items.filter((i) => norm(i) === st.filter);
    $('#items').innerHTML = !st.active ? '<div class="empty">Tạo một chiến dịch để bắt đầu.</div>'
      : list.length ? list.map(itemHtml).join('') : '<div class="empty">Không có video nào.</div>';
    const n = pendingItems().length;
    $('#btnPostAll').textContent = `Đăng tất cả (${n})`;
    $('#btnPostAll').disabled = !n || st.bulk;
    $('#btnSyncAll').disabled = !st.items.some((i) => norm(i) === 'done' && i.videoId);
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.f === st.filter));
  }

  async function loadItems() {
    st.items = st.active ? await Store.listItems(st.active) : [];
    renderItems();
  }
  async function reloadAll() {
    st.campaigns = await Store.listCampaigns(st.shop.shopId);
    if (!st.campaigns.some((c) => c.id === st.active)) st.active = st.campaigns[0] ? st.campaigns[0].id : '';
    await Promise.all([renderStats(), renderCamps(), loadItems()]);
  }
  const patchLocal = (id, patch) => {
    const it = st.items.find((x) => x.id === id);
    if (it) Object.assign(it, patch);
    renderItems();
  };

  // ---------- Hành động ----------
  async function syncOne(item, silent = false) {
    if (!item.videoId) return;
    st.busy.add(item.id); if (!silent) renderItems();
    try {
      const m = await Shopee.api.getMetrics(item.videoId);
      await Store.updateItem(item.id, m);
      patchLocal(item.id, m);
      if (!silent) toast('Đã đồng bộ chỉ số', 'success');
    } catch (e) { if (!silent) toast('Đồng bộ lỗi: ' + errText(e), 'error'); }
    st.busy.delete(item.id); renderItems();
  }

  async function postOne(item) {
    st.busy.add(item.id); patchLocal(item.id, { progressText: 'Bắt đầu…' });
    try {
      const it = await Publisher.run(item, st.shop, (t, p) => patchLocal(item.id, { progressText: t + (p != null ? ` ${Math.round(p * 100)}%` : '') }));
      Object.assign(item, it, { progressText: '' });
      st.busy.delete(item.id);
      return true;
    } catch (e) {
      Object.assign(item, { status: 'error', errorMsg: errText(e), progressText: '' });
      st.busy.delete(item.id);
      return false;
    } finally { renderItems(); renderStats(); }
  }

  $('#items').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('.vitem').dataset.id;
    const item = st.items.find((x) => x.id === id);
    if (!item) return;
    const act = btn.dataset.act;
    if (act === 'toggle') { st.open.has(id) ? st.open.delete(id) : st.open.add(id); renderItems(); }
    if (act === 'sync') syncOne(item);
    if (act === 'caption') {
      if (norm(item) === 'done') toast('Video đã đăng: sửa ở đây chỉ đổi trong danh sách, không đổi trên Shopee', 'warn', 5000);
      editCaption(item);
    }
    if (act === 'post') {
      if (!(await Publisher.confirmPublish(1, st.shop))) return;
      const ok = await postOne(item);
      toast(ok ? 'Đăng thành công' : 'Đăng thất bại: ' + item.errorMsg, ok ? 'success' : 'error', 6000);
    }
    if (act === 'delete') {
      if (!(await dialog({ title: 'Xoá video khỏi danh sách?', body: esc(item.caption || ''), okText: 'Xoá', danger: true }))) return;
      if (norm(item) === 'done' && item.videoId && !Shopee.isDemo()) {
        const alsoShopee = await dialog({
          title: 'Xoá luôn video trên Shopee?',
          body: `Video ID <span class="code">${esc(item.videoId)}</span> đang hiển thị công khai trên kênh Shopee Video. Xoá trên Shopee không hoàn tác được.`,
          okText: 'Xoá cả trên Shopee', cancelText: 'Chỉ xoá ở đây', danger: true,
        });
        if (alsoShopee) {
          try { await Shopee.api.deleteVideo(item.videoId); toast('Đã xoá video trên Shopee', 'success'); }
          catch (err) { toast('Xoá trên Shopee lỗi: ' + errText(err) + '. Vẫn giữ trong danh sách.', 'error', 7000); return; }
        }
      }
      await Store.removeItem(id);
      await reloadAll();
    }
  });

  async function editCaption(item) {
    const v = await dialog({ title: 'Sửa tiêu đề / mô tả', input: item.caption || '', okText: 'Lưu' });
    if (v === false) return;
    await Store.updateItem(item.id, { caption: v });
    patchLocal(item.id, { caption: v });
    toast('Đã lưu', 'success');
  }

  $('#btnPostAll').addEventListener('click', async () => {
    const list = pendingItems();
    if (!list.length || st.bulk) return;
    if (!(await Publisher.confirmPublish(list.length, st.shop))) return;
    st.bulk = true; renderItems();
    const bar = $('#bulkProg'); bar.classList.remove('hidden');
    let ok = 0, fail = 0;
    for (let k = 0; k < list.length; k++) {
      (await postOne(list[k])) ? ok++ : fail++;
      bar.firstElementChild.style.width = `${Math.round(((k + 1) / list.length) * 100)}%`;
    }
    st.bulk = false; bar.classList.add('hidden'); renderItems();
    toast(`Xong: ${ok} thành công, ${fail} lỗi`, fail ? 'warn' : 'success', 6000);
  });

  $('#btnSyncAll').addEventListener('click', async () => {
    const list = st.items.filter((i) => norm(i) === 'done' && i.videoId);
    for (const it of list) { await syncOne(it, true); await new Promise((r) => setTimeout(r, 500)); }
    toast(`Đã đồng bộ ${list.length} video`, 'success');
  });

  async function autoSyncStale() {
    const list = st.items.filter((i) => norm(i) === 'done' && i.videoId &&
      (!i.metricsSyncedAt || Date.now() - new Date(i.metricsSyncedAt).getTime() > STALE_MS));
    if (!list.length) return;
    $('#syncInfo').textContent = `Đang tự đồng bộ ${list.length} video…`;
    for (const it of list) { await syncOne(it, true); await new Promise((r) => setTimeout(r, 500)); }
    $('#syncInfo').textContent = '';
  }

  $('#tabs').addEventListener('click', (e) => { const f = e.target.dataset.f; if (f) { st.filter = f; renderItems(); } });

  $('#camps').addEventListener('click', async (e) => {
    const ren = e.target.dataset.rename, del = e.target.dataset.del;
    if (ren) {
      const c = st.campaigns.find((x) => x.id === ren);
      const v = await dialog({ title: 'Đổi tên chiến dịch', input: c.name, okText: 'Lưu' });
      if (v) { await Store.renameCampaign(ren, v); await reloadAll(); }
      return;
    }
    if (del) {
      const c = st.campaigns.find((x) => x.id === del);
      if (await dialog({ title: `Xoá chiến dịch “${c.name}”?`, body: 'Tất cả video trong chiến dịch sẽ bị xoá khỏi danh sách (không xoá video đã đăng trên Shopee).', okText: 'Xoá', danger: true })) {
        await Store.removeCampaign(del); await reloadAll(); toast('Đã xoá chiến dịch', 'success');
      }
      return;
    }
    const row = e.target.closest('.camp');
    if (row && row.dataset.id !== st.active) { st.active = row.dataset.id; st.filter = 'all'; await renderCamps(); await loadItems(); autoSyncStale(); }
  });

  $('#btnNewCamp').addEventListener('click', async () => {
    const v = await dialog({ title: 'Tạo chiến dịch', input: '', okText: 'Tạo' });
    if (!v) return;
    if (st.campaigns.some((c) => c.name.toLowerCase() === v.toLowerCase())) return toast('Tên chiến dịch đã tồn tại', 'warn');
    const c = await Store.createCampaign({ name: v, shopId: st.shop.shopId, shopName: st.shop.shopName });
    st.active = c.id; await reloadAll();
  });
  $('#btnReload').addEventListener('click', reloadAll);
  $('#btnSeed').addEventListener('click', async () => { await Store.seedDemo(st.shop.shopId, st.shop.shopName); st.active = ''; await reloadAll(); toast('Đã nạp dữ liệu mẫu', 'success'); });

  // ---------- Khởi tạo ----------
  try {
    st.shop = await Shopee.api.getShop();
  } catch (e) {
    $('#shopErr').textContent = errText(e) + ' (Dashboard cần đăng nhập Kênh Người Bán để biết shop nào.)';
    $('#shopErr').classList.remove('hidden');
    return;
  }
  await reloadAll();
  autoSyncStale();

  // Tự làm mới khi trang khác (cột Soạn & đăng, tab khác) lưu / đăng video
  const idle = () => !st.bulk && !st.busy.size;
  window.addEventListener('message', async (e) => {
    if (e.origin !== location.origin || !e.data || e.data.svx !== 'refresh') return;
    if (e.data.campaign) st.active = e.data.campaign;
    if (idle()) await reloadAll();
  });
  if (Store.HAS_EXT && chrome.storage.onChanged) {
    let t = null;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !(changes.svx_items || changes.svx_campaigns)) return;
      clearTimeout(t);
      t = setTimeout(() => { if (idle()) reloadAll(); }, 600);
    });
  }
})();
