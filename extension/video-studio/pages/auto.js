// Hẹn giờ đăng video: chọn SP của shop + giờ → tới giờ tự tìm tên SP trên shopee.vn, lấy video SP đầu tiên có video,
// gắn SP của shop, chọn chiến dịch, AI viết tiêu đề + hashtag rồi đăng lên Shopee Video.
// Lịch lưu ở chrome.storage.local "svx_auto_jobs". Background mở trang này (?runner=1) khi có lịch tới giờ.
(async () => {
  const { $, esc, toast, errText } = UI;
  const JKEY = 'svx_auto_jobs';
  const PCACHE = 'fs_productCache'; // danh sách "Sản phẩm của Shop" (module Sản phẩm)
  const isRunner = new URLSearchParams(location.search).get('runner') === '1';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const p2 = (n) => String(n).padStart(2, '0');
  const fmt = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const localInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };

  await UI.header('auto');
  Shopee.setDemo(false);

  const st = { products: [], selected: new Set(), selectedJobs: new Set(), shop: null, campaigns: [], running: false };
  const readJobs = async () => (await chrome.storage.local.get(JKEY))[JKEY] || [];
  const writeJobs = (jobs) => chrome.storage.local.set({ [JKEY]: jobs });
  async function patchJob(id, patch) {
    const jobs = await readJobs();
    const j = jobs.find((x) => x.id === id);
    if (j) Object.assign(j, patch, { updatedAt: Date.now() });
    await writeJobs(jobs);
    renderJobs();
    return j;
  }

  // ---------- Sản phẩm của shop ----------
  async function loadProducts() {
    const c = (await chrome.storage.local.get(PCACHE))[PCACHE];
    st.products = (c && Array.isArray(c.products) ? c.products : []).map((p) => ({
      itemId: String(p.itemId), name: p.name || '', image: p.image || '', sku: p.parentSku || p.models?.[0]?.sku || '',
      active: p.status === 1 && !p.unlisted
    }));
    renderProducts();
  }
  async function renderProducts() {
    const q = $('#q').value.trim().toLowerCase();
    const jobs = await readJobs();
    const countBy = new Map();
    jobs.forEach((j) => countBy.set(j.itemId, (countBy.get(j.itemId) || 0) + 1));
    const list = st.products.filter((p) => !q || `${p.name} ${p.itemId} ${p.sku}`.toLowerCase().includes(q));
    $('#plist').innerHTML = list.slice(0, 500).map((p) => `<tr>
      <td><input type="checkbox" data-id="${esc(p.itemId)}" ${st.selected.has(p.itemId) ? 'checked' : ''}></td>
      <td>${p.image ? `<img src="${esc(p.image)}">` : ''}</td>
      <td>${esc(p.name)}<div class="small muted">ID ${esc(p.itemId)}${p.sku ? ' · ' + esc(p.sku) : ''}${p.active ? '' : ' · <b style="color:#dc2626">không đang bán</b>'}</div></td>
      <td class="small">${countBy.get(p.itemId) || ''}</td></tr>`).join('')
      || `<tr><td colspan="4" class="muted">${st.products.length ? 'Không khớp.' : 'Chưa có danh sách sản phẩm — mở module Sản phẩm và bấm "Tải toàn bộ sản phẩm".'}</td></tr>`;
    $('#selCount').textContent = st.selected.size;
  }
  $('#q').oninput = renderProducts;
  $('#plist').onchange = (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    e.target.checked ? st.selected.add(id) : st.selected.delete(id);
    $('#selCount').textContent = st.selected.size;
  };
  $('#chkAll').onchange = (e) => {
    const q = $('#q').value.trim().toLowerCase();
    st.products.filter((p) => !q || `${p.name} ${p.itemId} ${p.sku}`.toLowerCase().includes(q))
      .forEach((p) => (e.target.checked ? st.selected.add(p.itemId) : st.selected.delete(p.itemId)));
    renderProducts();
  };

  // ---------- Thêm lịch ----------
  $('#startAt').value = localInput(Date.now() + 10 * 60e3);
  try { $('#campaign').value = localStorage.getItem('svx_auto_campaign') || ''; } catch {}
  $('#btnAdd').onclick = async () => {
    const ids = [...st.selected];
    const start = new Date($('#startAt').value).getTime();
    const gap = Math.max(1, Number($('#gapMin').value) || 30) * 60e3;
    const campaign = $('#campaign').value.trim();
    if (!ids.length) return ($('#addMsg').textContent = 'Chọn ít nhất 1 sản phẩm.');
    if (!start) return ($('#addMsg').textContent = 'Chọn thời gian bắt đầu.');
    if (!campaign) return ($('#addMsg').textContent = 'Nhập hoặc chọn chiến dịch.');
    try { localStorage.setItem('svx_auto_campaign', campaign); } catch {}
    const jobs = await readJobs();
    ids.forEach((id, i) => {
      const p = st.products.find((x) => x.itemId === id);
      jobs.push({ id: Store.uid(), itemId: id, name: p ? p.name : id, image: p ? p.image : '', at: start + i * gap,
        campaign, aiCaption: $('#aiCaption').checked, status: 'wait', result: '', createdAt: Date.now() });
    });
    await writeJobs(jobs);
    st.selected.clear();
    $('#addMsg').textContent = `✔ Đã thêm ${ids.length} lịch, bắt đầu ${fmt(start)}.`;
    renderProducts(); renderJobs();
  };

  // ---------- Danh sách lịch ----------
  const ST = { wait: 'Chờ', run: 'Đang chạy', done: 'Đã đăng', err: 'Lỗi' };

  function updateJobSelectionUI() {
    const totalSelected = st.selectedJobs.size;
    const countEl = $('#jobSelCount');
    if (countEl) countEl.textContent = totalSelected;
    const btnDel = $('#btnDelSelected');
    if (btnDel) {
      btnDel.disabled = totalSelected === 0;
      btnDel.style.opacity = totalSelected > 0 ? '1' : '0.5';
    }
    const chkAll = $('#chkAllJobs');
    if (chkAll) {
      const inputs = document.querySelectorAll('#jobs input[data-job-id]');
      const totalVisible = inputs.length;
      let checkedVisible = 0;
      inputs.forEach((input) => { if (input.checked) checkedVisible++; });
      chkAll.checked = totalVisible > 0 && checkedVisible === totalVisible;
      chkAll.indeterminate = checkedVisible > 0 && checkedVisible < totalVisible;
    }
  }

  async function renderJobs() {
    const f = $('#fStatus').value;
    const allJobs = await readJobs();
    const existingIds = new Set(allJobs.map((j) => j.id));
    for (const id of st.selectedJobs) {
      if (!existingIds.has(id)) st.selectedJobs.delete(id);
    }

    const jobs = allJobs.filter((j) => !f || j.status === f).sort((a, b) => a.at - b.at);
    $('#jobs').innerHTML = jobs.map((j) => `<tr data-id="${esc(j.id)}">
      <td><input type="checkbox" data-job-id="${esc(j.id)}" ${st.selectedJobs.has(j.id) ? 'checked' : ''}></td>
      <td class="small" style="white-space:nowrap">${fmt(j.at)}</td>
      <td>${esc(j.name)}<div class="small muted">ID ${esc(j.itemId)}</div></td>
      <td class="small">${esc(j.campaign)}</td>
      <td><span class="st ${j.status}">${ST[j.status] || j.status}</span></td>
      <td class="small">${esc(j.result || '')}${j.videoId ? `<div>Mã video: <b>${esc(j.videoId)}</b></div>` : ''}${j.sourceName ? `<div class="muted">Video từ: ${esc(j.sourceName.slice(0, 50))}</div>` : ''}</td>
      <td style="white-space:nowrap"><button class="btn btn--sm" data-act="now" title="Đăng ngay">▶</button> <button class="btn btn--sm" data-act="reset" title="Đặt lại Chờ">↺</button> <button class="btn btn--sm" data-act="del" title="Xoá lịch">✕</button></td></tr>`).join('')
      || '<tr><td colspan="7" class="muted">Chưa có lịch nào.</td></tr>';
    updateJobSelectionUI();
  }
  $('#fStatus').onchange = renderJobs;
  $('#jobs').onchange = (e) => {
    const id = e.target.dataset.jobId;
    if (!id) return;
    e.target.checked ? st.selectedJobs.add(id) : st.selectedJobs.delete(id);
    updateJobSelectionUI();
  };
  $('#chkAllJobs').onchange = (e) => {
    const checked = e.target.checked;
    const inputs = document.querySelectorAll('#jobs input[data-job-id]');
    inputs.forEach((input) => {
      input.checked = checked;
      const id = input.dataset.jobId;
      if (id) {
        checked ? st.selectedJobs.add(id) : st.selectedJobs.delete(id);
      }
    });
    updateJobSelectionUI();
  };
  $('#btnDelSelected').onclick = async () => {
    const count = st.selectedJobs.size;
    if (!count) return;
    if (!confirm(`Xoá ${count} lịch đã chọn?`)) return;
    const all = await readJobs();
    const remain = all.filter((j) => !st.selectedJobs.has(j.id));
    await writeJobs(remain);
    st.selectedJobs.clear();
    toast(`Đã xoá ${count} lịch đã chọn.`, 'success');
    renderJobs();
    renderProducts();
  };
  $('#jobs').onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('tr').dataset.id;
    if (b.dataset.act === 'del') {
      if (!confirm('Xoá lịch này?')) return;
      st.selectedJobs.delete(id);
      await writeJobs((await readJobs()).filter((j) => j.id !== id));
      renderJobs();
      return renderProducts();
    }
    if (b.dataset.act === 'reset') return patchJob(id, { status: 'wait', result: '' });
    if (b.dataset.act === 'now') { await patchJob(id, { status: 'wait', at: Date.now(), result: '' }); runDue(); }
  };
  $('#btnClearDone').onclick = async () => {
    const all = await readJobs();
    const doneIds = new Set(all.filter((j) => j.status === 'done').map((j) => j.id));
    for (const id of doneIds) st.selectedJobs.delete(id);
    await writeJobs(all.filter((j) => j.status !== 'done'));
    renderJobs();
    renderProducts();
  };
  $('#btnRunNow').onclick = () => runDue();
  chrome.storage.onChanged.addListener((c, a) => { if (a === 'local' && c[JKEY] && !st.running) renderJobs(); });

  // ---------- Các bước tự động ----------
  // Tìm tên SP trên shopee.vn, trả về SP đầu tiên có video (không thuộc shop mình)
  async function findVideoSource(name, myShopId) {
    const kw = name.replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    const q = new URLSearchParams({ by: 'relevancy', keyword: kw, limit: '30', newest: '0', order: 'desc', page_type: 'search', scenario: 'PAGE_GLOBAL_SEARCH', version: '2' });
    const r = await Bridge.fetch('shopee', { url: `https://shopee.vn/api/v4/search/search_items?${q}`, headers: { 'x-api-source': 'pc', 'x-shopee-language': 'vi', 'x-requested-with': 'XMLHttpRequest' } });
    const d = r.data || {};
    if (`${d.error}` === '90309999') throw new Error('Shopee chặn tìm kiếm (anti-bot) — mở shopee.vn, đăng nhập / xác minh rồi thử lại');
    const items = (d.items || []).map((x) => x.item_basic || x).filter((x) => x && (x.itemid || x.item_id));
    const cands = items.filter((x) => `${x.shopid || x.shop_id}` !== `${myShopId}`);
    // Ưu tiên SP mà kết quả tìm kiếm báo có video
    cands.sort((a, b) => (b.video_info_list?.length ? 1 : 0) - (a.video_info_list?.length ? 1 : 0));
    for (const x of cands.slice(0, 12)) {
      const link = `https://shopee.vn/product/${x.shopid || x.shop_id}/${x.itemid || x.item_id}`;
      try {
        const p = await Shopee.api.getProduct(link);
        if (p.videos && p.videos.length) return { link, name: p.name, video: p.videos[0] };
      } catch (e) { if (/anti-bot/.test(errText(e))) throw e; }
      await sleep(1200);
    }
    throw new Error('Không tìm thấy sản phẩm nào có video cho từ khoá này');
  }

  async function askGemini(prompt) {
    const r = await chrome.storage.local.get(['geminiApiKey', 'geminiApiKeys', 'geminiModel']);
    const keys = (Array.isArray(r.geminiApiKeys) && r.geminiApiKeys.length ? r.geminiApiKeys : [r.geminiApiKey]).map((k) => String(k || '').trim()).filter(Boolean);
    if (!keys.length) throw new Error('Chưa có khoá Gemini');
    let last = '';
    for (const key of keys) for (const m of [...new Set([r.geminiModel, 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))]) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048, ...(/2\.5-flash/.test(m) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } })
        });
        const data = await res.json();
        if (!res.ok) { last = data.error?.message || `HTTP ${res.status}`; continue; }
        const cand = data.candidates?.[0] || {};
        const t = (cand.content?.parts || []).map((p) => p.text || '').join('').trim();
        if (cand.finishReason === 'MAX_TOKENS') { last = 'AI trả lời bị cắt'; continue; }
        if (t) return t;
      } catch (e) { last = e.message; }
    }
    throw new Error(last || 'AI không trả lời');
  }
  async function makeCaption(name, useAi) {
    const base = name.slice(0, 150);
    if (!useAi) return `${base} #ShopeeVideo`;
    try {
      const out = await askGemini(`Bạn là chuyên gia Shopee Video Việt Nam. Viết 1 tiêu đề/mô tả ngắn (tối đa 150 ký tự) hấp dẫn cho video sản phẩm "${name}", rồi thêm 6-10 hashtag phổ biến (tiếng Việt không dấu + tiếng Anh, luôn có #ShopeeVideo). Chỉ trả về nội dung cần dán, không giải thích.`);
      let cap = out.replace(/^["'`]+|["'`]+$/g, '').trim();
      if (!cap) return `${base} #ShopeeVideo`;
      if (!/#[\p{L}\p{N}_]+/u.test(cap)) cap += ' #ShopeeVideo';
      else if (!/#shopeevideo/i.test(cap)) cap += ' #ShopeeVideo';
      return cap.slice(0, 2200);
    } catch { return `${base} #ShopeeVideo`; }
  }

  async function resolveCampaign(name) {
    st.campaigns = await Store.listCampaigns(st.shop.shopId);
    const found = st.campaigns.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
    return found || Store.createCampaign({ name, shopId: st.shop.shopId, shopName: st.shop.shopName });
  }

  async function runJob(job) {
    await patchJob(job.id, { status: 'run', result: 'Đang tìm video trên Shopee…' });
    try {
      if (!st.shop) st.shop = await Shopee.api.getShop();
      // 1) Gắn SP của shop (tìm trong kho SP Shopee Video theo tên, ưu tiên đúng ID)
      const mine = await Shopee.api.searchItems(job.name.slice(0, 60));
      const product = mine.find((x) => `${x.itemId}` === `${job.itemId}`) || null;
      if (!product) throw new Error('Không tìm thấy SP này trong danh sách gắn video của shop (SP ẩn / hết hàng?)');
      // 2) Video: SP đầu tiên có video khi tìm tên trên shopee.vn
      const src = await findVideoSource(job.name, st.shop.shopId);
      await patchJob(job.id, { result: 'Đã có video, đang viết tiêu đề…', sourceName: src.name, sourceLink: src.link });
      // 3) Chiến dịch + tiêu đề
      const camp = await resolveCampaign(job.campaign);
      const caption = await makeCaption(job.name, job.aiCaption !== false);
      // 4) Lưu vào Video Studio rồi đăng
      let item = await Store.createItem({
        campaignId: camp.id, shopId: st.shop.shopId, source: 'shopee', sourceUrl: src.video.url, sourceName: src.name,
        caption, products: [product], status: 'pending', errorMsg: '', duration: src.video.duration || 0,
      });
      await patchJob(job.id, { result: 'Đang tải video lên Shopee…', studioItemId: item.id });
      item = await Publisher.run(item, st.shop, (t) => { $('#runnerLine').textContent = `${job.name.slice(0, 40)}: ${t}`; });
      await patchJob(job.id, { status: 'done', result: `Đã đăng lúc ${fmt(Date.now())}`, videoId: item.videoId || '' });
      UI.notify && UI.notify('changed', { campaign: camp.id });
    } catch (e) {
      await patchJob(job.id, { status: 'err', result: errText(e).slice(0, 250) });
    }
  }

  async function runDue() {
    if (st.running) return;
    st.running = true;
    try {
      for (;;) {
        const due = (await readJobs()).filter((j) => j.status === 'wait' && j.at <= Date.now()).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        $('#runnerLine').textContent = `Đang đăng: ${due.name}`;
        await runJob(due);
        await sleep(3000);
      }
    } finally {
      st.running = false;
      $('#runnerLine').textContent = '';
      renderJobs();
    }
  }

  // ---------- Khởi tạo ----------
  try {
    st.shop = await Shopee.api.getShop();
    $('#shopLine').innerHTML = `Shop đang đăng nhập: <b>${esc(st.shop.shopName || st.shop.shopId)}</b>`;
    st.campaigns = await Store.listCampaigns(st.shop.shopId);
    $('#campList').innerHTML = st.campaigns.map((c) => `<option value="${esc(c.name)}"></option>`).join('');
  } catch (e) {
    $('#shopLine').innerHTML = `<span class="err-msg">${esc(errText(e))}</span>`;
  }
  await loadProducts();
  await renderJobs();
  // Trang đang mở: mỗi phút kiểm tra lịch tới giờ
  setInterval(runDue, 60e3);
  if (isRunner) {
    await runDue();
    setTimeout(() => window.close(), 5000);
  } else {
    runDue();
  }
})();
