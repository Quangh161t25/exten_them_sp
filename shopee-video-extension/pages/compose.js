(async () => {
  const { $, esc, toast, header, pageUrl, errText, fmtPrice } = UI;
  await header('compose');

  const q = new URLSearchParams(location.search);
  const st = {
    shop: null, campaigns: [], products: [], results: [],
    source: q.get('source') || 'shopee', videoUrl: q.get('videoUrl') || '', file: null,
    editId: q.get('item') || '', busy: false, done: false, attempted: false,
  };
  const MAX = Shopee.MAX_PRODUCTS;

  // ---------- Video ----------
  function renderMedia() {
    const box = $('#mediaBox');
    if (st.videoUrl === 'demo') box.innerHTML = '<div class="ph">Video mẫu (chế độ thử)</div>';
    else if (st.videoUrl) box.innerHTML = `<video src="${esc(st.videoUrl)}" controls preload="metadata"></video>`;
    else box.innerHTML = '<div class="ph">Chưa có video</div>';
    $('#srcBadge').textContent = st.source === 'file' ? 'File từ máy' : 'Shopee';
  }
  $('#fileInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 500 * 1024 * 1024) return toast('File quá lớn (tối đa 500MB)', 'warn');
    if (st.videoUrl.startsWith('blob:')) URL.revokeObjectURL(st.videoUrl);
    st.file = f; st.source = 'file'; st.videoUrl = URL.createObjectURL(f);
    renderMedia(); renderChecklist();
  });

  // ---------- Sản phẩm ----------
  const isSel = (id) => st.products.some((p) => p.itemId === `${id}`);
  function renderPicker() {
    $('#pCount').textContent = `${st.products.length}/${MAX}`;
    $('#chips').innerHTML = st.products.map((p) => `<span class="chip"><span title="${esc(p.name)}">${esc(p.name)}</span><button data-rm="${esc(p.itemId)}" aria-label="Bỏ">×</button></span>`).join('');
    $('#picker').innerHTML = st.results.length ? st.results.map((p) => `
      <div class="picker__item ${isSel(p.itemId) ? 'is-selected' : ''}" data-id="${esc(p.itemId)}">
        ${p.cover ? `<img class="thumb" src="${esc(Shopee.imgUrl(p.cover))}_tn" alt="" onerror="this.style.visibility='hidden'">` : '<div class="thumb"></div>'}
        <div class="grow">
          <div class="picker__name">${esc(p.name)}</div>
          <div class="small"><span class="price">${fmtPrice(p.snapshot.minPrice, p.snapshot.maxPrice)}</span> <span class="muted">· Kho: ${p.snapshot.stock}</span></div>
        </div>
        ${isSel(p.itemId) ? '<span class="check">✓</span>' : ''}
      </div>`).join('') : '<div class="empty">Không tìm thấy sản phẩm</div>';
    renderChecklist();
  }
  async function search(name) {
    $('#picker').innerHTML = '<div class="empty">Đang tải…</div>';
    try { st.results = await Shopee.api.searchItems(name); } catch (e) { st.results = []; toast(errText(e), 'error', 6000); }
    renderPicker();
  }
  $('#pForm').addEventListener('submit', (e) => { e.preventDefault(); search($('#pq').value.trim()); });
  $('#picker').addEventListener('click', (e) => {
    const row = e.target.closest('.picker__item');
    if (!row || st.busy) return;
    const id = row.dataset.id;
    if (isSel(id)) st.products = st.products.filter((p) => p.itemId !== id);
    else if (st.products.length >= MAX) return toast(`Tối đa ${MAX} sản phẩm mỗi video`, 'warn');
    else st.products.push(st.results.find((p) => p.itemId === id));
    renderPicker();
  });
  $('#chips').addEventListener('click', (e) => {
    const id = e.target.dataset.rm;
    if (id && !st.busy) { st.products = st.products.filter((p) => p.itemId !== id); renderPicker(); }
  });

  // ---------- Checklist + log ----------
  const hasCampaign = () => !!$('#campaign').value.trim();
  const hasCaption = () => !!$('#caption').value.trim();
  const hasVideo = () => !!st.videoUrl;
  function renderChecklist() {
    const reqs = [
      ['Có video', hasVideo(), 'fMedia'],
      ['Chọn hoặc tạo chiến dịch', hasCampaign(), 'fCampaign'],
      ['Gắn ít nhất 1 sản phẩm vào video', st.products.length > 0, 'fProducts'],
      ['Nhập tiêu đề / mô tả', hasCaption(), 'fCaption'],
    ];
    $('#checklist').innerHTML = '<b class="small">Cần hoàn tất để đăng video:</b>' + reqs.map(([t, ok]) =>
      `<div class="checklist__item ${ok ? 'is-done' : ''}"><span class="checklist__dot">${ok ? '✓' : ''}</span>${t}</div>`).join('');
    reqs.forEach(([, ok, id]) => { const el = document.getElementById(id); if (el) el.classList.toggle('is-invalid', st.attempted && !ok); });
    $('#checklist').classList.toggle('hidden', st.done);
    $('#btnSave').disabled = st.busy || st.done || !hasVideo() || !hasCampaign();
    $('#btnPublish').disabled = st.busy || st.done;
    return reqs.every(([, ok]) => ok);
  }
  ['input', 'change'].forEach((ev) => { $('#campaign').addEventListener(ev, renderChecklist); $('#caption').addEventListener(ev, renderChecklist); });

  function log(text, type = 'pending', progress = null) {
    const el = $('#log');
    el.className = `log log--${type}`;
    el.textContent = text;
    const bar = $('#progress');
    bar.classList.toggle('hidden', progress === null);
    if (progress !== null) bar.firstElementChild.style.width = `${Math.round(progress * 100)}%`;
  }

  // ---------- Lưu ----------
  async function resolveCampaign() {
    const name = $('#campaign').value.trim();
    const found = st.campaigns.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (found) return found;
    const c = await Store.createCampaign({ name, shopId: st.shop.shopId, shopName: st.shop.shopName });
    st.campaigns.unshift(c);
    return c;
  }
  async function saveItem() {
    const camp = await resolveCampaign();
    try { sessionStorage.setItem('svx-last-campaign-' + st.shop.shopId, camp.name); } catch {}
    const data = {
      campaignId: camp.id, shopId: st.shop.shopId, source: st.source,
      sourceUrl: st.source === 'file' ? '' : st.videoUrl, sourceName: st.file ? st.file.name : '',
      caption: $('#caption').value.trim(), products: st.products.slice(0, MAX), status: 'pending', errorMsg: '',
    };
    let item = st.editId ? await Store.updateItem(st.editId, data) : null;
    if (!item) item = await Store.createItem(data);
    st.editId = item.id;
    if (st.source === 'file' && st.file) await Blobs.put(item.id, st.file);
    return item;
  }

  $('#btnSave').addEventListener('click', async () => {
    if (st.busy) return;
    st.busy = true; renderChecklist();
    try {
      const saved = await saveItem();
      log('Đã lưu vào hàng chờ. Có thể đăng sau ở Dashboard.', 'success');
      toast('Đã lưu video vào hàng chờ', 'success');
      st.done = true;
      UI.notify('changed', { campaign: saved.campaignId });
    } catch (e) { log('Lưu thất bại: ' + errText(e), 'error'); }
    st.busy = false; renderChecklist();
  });

  $('#btnPublish').addEventListener('click', async () => {
    if (st.busy) return;
    st.attempted = true;
    if (!renderChecklist()) return toast('Hãy hoàn tất các mục còn thiếu trước khi đăng', 'warn');
    if (!(await Publisher.confirmPublish(1, st.shop))) return;
    st.busy = true; renderChecklist();
    let item = null;
    try {
      item = await saveItem();
      log('Bắt đầu đăng...');
      item = await Publisher.run(item, st.shop, (t, p) => log(t, 'pending', p ?? null));
      st.done = true;
      log(item.videoId ? `Đăng thành công! Mã video: ${item.videoId}` : 'Đăng thành công! (chưa lấy được mã video, có thể đồng bộ sau)', 'success');
      toast('Đăng video thành công', 'success');
      if (UI.EMBED) UI.notify('changed', { campaign: item.campaignId });
      else setTimeout(() => { location.href = pageUrl('dashboard', { campaign: item.campaignId }); }, 1500);
    } catch (e) {
      log('Đăng thất bại: ' + errText(e) + (item ? ' — video đã được lưu với trạng thái Lỗi, có thể đăng lại ở Dashboard.' : ''), 'error');
      if (item) UI.notify('changed', { campaign: item.campaignId });
    }
    st.busy = false; renderChecklist();
  });

  // ---------- Khởi tạo ----------
  try {
    st.shop = await Shopee.api.getShop();
    $('#shopLine').innerHTML = `Shop đang đăng nhập: <b>${esc(st.shop.shopName || st.shop.shopId)}</b>`;
  } catch (e) {
    $('#shopLine').innerHTML = `<span class="err-msg">${esc(errText(e))}</span>`;
    toast(errText(e), 'error', 8000);
    $('#btnSave').disabled = $('#btnPublish').disabled = true;
    renderMedia();
    return;
  }
  st.campaigns = await Store.listCampaigns(st.shop.shopId);
  $('#campaignList').innerHTML = st.campaigns.map((c) => `<option value="${esc(c.name)}"></option>`).join('');

  if (st.editId) {
    const it = await Store.getItem(st.editId);
    if (it) {
      const c = st.campaigns.find((x) => x.id === it.campaignId);
      $('#campaign').value = c ? c.name : '';
      $('#caption').value = it.caption || '';
      st.products = (it.products || []).slice();
      st.source = it.source || 'shopee';
      if (it.source === 'file') {
        const b = await Blobs.get(it.id).catch(() => null);
        if (b) { st.file = b; st.videoUrl = URL.createObjectURL(b); }
      } else st.videoUrl = it.sourceUrl || '';
    } else st.editId = '';
  } else {
    $('#caption').value = q.get('title') || '';
    let last = '';
    try { last = sessionStorage.getItem('svx-last-campaign-' + st.shop.shopId) || ''; } catch {}
    if (last) $('#campaign').value = last;
  }
  renderMedia();
  await search('');
  // Nếu video lấy từ chính sản phẩm của shop mình thì tự gắn sản phẩm đó
  const fromItem = q.get('fromItem');
  if (fromItem && q.get('fromShop') === st.shop.shopId && !isSel(fromItem)) {
    let hit = st.results.find((p) => p.itemId === fromItem);
    if (!hit && q.get('title')) hit = (await Shopee.api.searchItems(q.get('title')).catch(() => [])).find((p) => p.itemId === fromItem);
    if (hit) { st.products.push(hit); renderPicker(); }
  }
})();
