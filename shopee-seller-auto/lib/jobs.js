// Các tác vụ tự động. Dùng chung cho background (chạy theo lịch) và trang (bấm "Chạy ngay").
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const errMsg = (e) => String((e && e.message) || e).replace(/^NEED_LOGIN:\s*/, '');
  const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

  async function prepare() {
    const s = await Store.getSettings();
    Shopee.setDemo(s.demo);
    Shopee.setBoostConfig(s.boost);
    return s;
  }

  function makeCtx(name, ctx = {}) {
    return {
      stop: ctx.stop || (() => false),
      log: async (type, msg) => { await Store.addLog(name, type, msg); ctx.onLog && ctx.onLog(type, msg); },
    };
  }

  // ======================= ĐẨY SẢN PHẨM =======================
  function inWindow(cfg, d = new Date()) {
    if (!cfg.days.includes(d.getDay())) return false;
    const m = d.getHours() * 60 + d.getMinutes();
    const a = toMin(cfg.from), b = toMin(cfg.to);
    return a <= b ? m >= a && m < b : m >= a || m < b; // hỗ trợ khung qua đêm, vd 20:00 → 02:00
  }

  /** Mỗi lần chạy: lấp đầy các suất đẩy còn trống bằng sản phẩm kế tiếp trong danh sách (xoay vòng) */
  async function pushTick(opts = {}) {
    await prepare();
    const c = makeCtx('push', opts);
    const cfg = await Store.getConfig('push');
    if (!opts.manual && !cfg.enabled) return { skipped: 'off' };
    if (!opts.manual && !inWindow(cfg)) return { skipped: 'window' };
    const items = cfg.items.filter((i) => i.enabled !== false);
    if (!items.length) { if (opts.manual) await c.log('warn', 'Chưa chọn sản phẩm nào để đẩy.'); return { skipped: 'empty' }; }

    const now = Date.now();
    const dur = (Number(cfg.durationHours) || 4) * 3600e3;
    const lastBoost = { ...cfg.lastBoost };
    const remote = await Shopee.boostedList();
    const localActive = (id) => lastBoost[id] && now - lastBoost[id] < dur;
    let activeIds;
    if (remote) {
      activeIds = new Set(remote.filter((b) => !b.endsAt || b.endsAt > now).map((b) => String(b.id)));
      // Đồng bộ thời điểm hết hạn thật từ Shopee
      remote.forEach((b) => { if (b.endsAt) lastBoost[b.id] = b.endsAt - dur; });
    } else {
      activeIds = new Set(items.filter((i) => localActive(i.id)).map((i) => String(i.id)));
    }

    let slots = Math.max(0, (Number(cfg.maxActive) || 5) - activeIds.size);
    let boosted = 0, failed = 0, idx = cfg.nextIndex % items.length || 0;
    const order = items.slice(idx).concat(items.slice(0, idx));
    for (let k = 0; k < order.length && slots > 0 && !c.stop(); k++) {
      const it = order[k];
      if (activeIds.has(String(it.id)) || localActive(it.id)) continue;
      try {
        await Shopee.boost(it.id);
        lastBoost[it.id] = Date.now();
        boosted++; slots--;
        idx = (items.indexOf(it) + 1) % items.length;
        await Store.bump('push', 'ok');
        await c.log('ok', `Đã đẩy: ${it.name} (#${it.id})`);
      } catch (e) {
        failed++;
        await Store.bump('push', 'fail');
        const m = errMsg(e);
        await c.log('error', `Lỗi đẩy ${it.name} (#${it.id}): ${m}`);
        if (/NEED_LOGIN|tối đa|limit|max/i.test(String(e))) break;
      }
      await sleep(800);
    }
    if (opts.manual && !boosted && !failed) await c.log('info', slots ? 'Không có sản phẩm nào đến lượt (đều đang đẩy hoặc chưa hết 4 giờ).' : `Đã đủ ${cfg.maxActive} sản phẩm đang đẩy, chờ lượt sau.`);
    await Store.saveConfig('push', { lastBoost, nextIndex: idx, lastRun: Date.now(), lastError: failed ? 'Có lỗi, xem nhật ký' : '' });
    return { boosted, failed, active: activeIds.size + boosted };
  }

  // ======================= TRẢ LỜI ĐÁNH GIÁ =======================
  async function replyJob(opts = {}) {
    await prepare();
    const c = makeCtx('reply', opts);
    const cfg = await Store.getConfig('reply');
    if (!opts.manual && !cfg.enabled) return { skipped: 'off' };
    if (!cfg.text.trim()) { await c.log('error', 'Chưa nhập nội dung trả lời.'); return {}; }
    const limit = opts.limit || Number(cfg.perRun) || 30;
    const shop = await Shopee.shopInfo();
    const done = await Store.getDone('reply');
    const failed = new Set();
    let sent = 0, fail = 0, page = 1, emptyPages = 0;

    while (sent + fail < limit && !c.stop()) {
      const list = await Shopee.listRatings({ stars: cfg.stars, page, size: 20, replyStatus: 1 });
      if (!list.length) break;
      const fresh = list.filter((r) => !r.reply && cfg.stars.includes(Number(r.star)) && !failed.has(r.commentId) && !done[r.commentId]);
      if (!fresh.length) { page++; if (++emptyPages > 5) break; continue; }
      emptyPages = 0;
      for (const r of fresh) {
        if (c.stop() || sent + fail >= limit) break;
        done[r.commentId] = 1; // không xử lý lại trong cùng lượt dù Shopee chưa kịp cập nhật
        const vars = { name: r.userName, orderId: r.orderId, star: r.star, shop: shop.shopName };
        const text = Tpl.render(cfg.text, vars);
        try {
          await Shopee.replyRating(r.orderId, r.commentId, text);
          await Store.markDone('reply', r.commentId);
          sent++;
          await Store.bump('reply', 'ok');
          await c.log('ok', `Đã trả lời ${r.userName} (${r.star}★): ${Array.from(text).slice(0, 80).join('')}`);
          if (cfg.chat.trim() && r.userId) {
            try {
              await Shopee.sendScript(r.userId, shop.shopId, [{ type: 'text', text: cfg.chat }], { vars, closeAfter: (await Store.getSettings()).closeConversation });
              await c.log('ok', `↳ Đã nhắn tin cho ${r.userName}`);
            } catch (e) { await c.log('error', `↳ Không nhắn được cho ${r.userName}: ${errMsg(e)}`); }
          }
        } catch (e) {
          failed.add(r.commentId); fail++;
          await Store.bump('reply', 'fail');
          await c.log('error', `Lỗi trả lời ${r.userName} (đơn ${r.orderId}): ${errMsg(e)}`);
          if (/NEED_LOGIN/.test(String(e))) throw e;
        }
        if (opts.touch) await opts.touch();
        await sleep(Number(cfg.delayMs) || 800);
      }
    }
    await Store.saveConfig('reply', { lastRun: Date.now(), lastError: fail ? `${fail} lỗi ở lần chạy gần nhất` : '' });
    if (opts.manual || sent || fail) await c.log('info', `Xong lượt: ${sent} đã trả lời, ${fail} lỗi.`);
    return { sent, fail };
  }

  // ======================= ĐÁNH GIÁ NGƯỜI MUA =======================
  async function rateJob(opts = {}) {
    await prepare();
    const c = makeCtx('rate', opts);
    const cfg = await Store.getConfig('rate');
    if (!opts.manual && !cfg.enabled) return { skipped: 'off' };
    if (!cfg.text.trim()) { await c.log('error', 'Chưa nhập nội dung đánh giá.'); return {}; }
    const limit = opts.limit || Number(cfg.perRun) || 50;
    const maxPages = opts.pages || Number(cfg.pages) || 3;
    const shop = await Shopee.shopInfo();
    const done = await Store.getDone('rate');
    let sent = 0, fail = 0, sentinel = '';

    for (let page = 1; page <= maxPages && sent + fail < limit && !c.stop(); page++) {
      const r = await Shopee.listOrderPage(page, 40, sentinel);
      if (!r.orders.length) break;
      sentinel = r.next;
      const todo = r.orders.filter((o) => o.ratable && !done[o.orderId]);
      if (opts.manual) await c.log('info', `Trang ${page}: ${r.orders.length} đơn hoàn thành, ${todo.length} đơn cần đánh giá.`);
      for (const o of todo) {
        if (c.stop() || sent + fail >= limit) break;
        done[o.orderId] = 1;
        const vars = { name: o.buyerName, orderId: o.orderId, orderSn: o.orderSn, star: cfg.star, shop: shop.shopName };
        const text = Tpl.render(cfg.text, vars);
        try {
          await Shopee.rateOrder(o.orderId, text, Number(cfg.star) || 5);
          await Store.markDone('rate', o.orderId);
          sent++;
          await Store.bump('rate', 'ok');
          await c.log('ok', `Đã đánh giá ${cfg.star}★ cho ${o.buyerName || o.buyerId} (đơn ${o.orderSn || o.orderId})`);
          if (cfg.chat.trim() && o.buyerId) {
            try {
              await Shopee.sendScript(o.buyerId, shop.shopId, [{ type: 'text', text: cfg.chat }], { vars, closeAfter: (await Store.getSettings()).closeConversation });
              await c.log('ok', `↳ Đã nhắn tin cho ${o.buyerName || o.buyerId}`);
            } catch (e) { await c.log('error', `↳ Không nhắn được: ${errMsg(e)}`); }
          }
        } catch (e) {
          fail++;
          await Store.bump('rate', 'fail');
          await c.log('error', `Lỗi đánh giá đơn ${o.orderSn || o.orderId}: ${errMsg(e)}`);
          if (/NEED_LOGIN/.test(String(e))) throw e;
        }
        if (opts.touch) await opts.touch();
        await sleep(Number(cfg.delayMs) || 500);
      }
      if (!sentinel) break;
      await sleep(2500);
    }
    await Store.saveConfig('rate', { lastRun: Date.now(), lastError: fail ? `${fail} lỗi ở lần chạy gần nhất` : '' });
    if (opts.manual || sent || fail) await c.log('info', `Xong lượt: ${sent} đơn đã đánh giá, ${fail} lỗi.`);
    return { sent, fail };
  }

  // ======================= THU THẬP KHÁCH (cho gửi tin nhắn) =======================
  async function collectFromRatings(cid, { stars, timeStart, timeEnd, search, maxPages = 20 }, onLog, stop = () => false) {
    await prepare();
    const found = new Map();
    for (let page = 1; page <= maxPages && !stop(); page++) {
      const list = await Shopee.listRatings({ stars, page, size: 40, replyStatus: 0, timeStart, timeEnd, search });
      if (!list.length) break;
      list.forEach((r) => r.userId && !found.has(r.userId) && found.set(r.userId, { userId: r.userId, name: r.userName, source: 'rating' }));
      onLog && onLog('info', `Trang ${page}: +${list.length} đánh giá, ${found.size} khách khác nhau`);
      await sleep(600);
    }
    return Store.addCustomers(cid, [...found.values()]);
  }

  async function collectFromOrders(cid, { maxPages = 10 }, onLog, stop = () => false) {
    await prepare();
    const found = new Map();
    let sentinel = '';
    for (let page = 1; page <= maxPages && !stop(); page++) {
      const r = await Shopee.listOrderPage(page, 40, sentinel);
      if (!r.orders.length) break;
      sentinel = r.next;
      r.orders.forEach((o) => o.buyerId && !found.has(o.buyerId) && found.set(o.buyerId, { userId: o.buyerId, name: o.buyerName, source: 'order' }));
      onLog && onLog('info', `Trang ${page}: ${r.orders.length} đơn, ${found.size} khách khác nhau`);
      if (!sentinel) break;
      await sleep(1500);
    }
    return Store.addCustomers(cid, [...found.values()]);
  }

  /** Mỗi dòng: "userId" hoặc "username", tuỳ chọn thêm tên sau dấu phẩy/tab */
  function parseImport(text) {
    const out = [], errors = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      const s = line.trim();
      if (!s) return;
      const parts = s.split(/\t|,|;/).map((x) => x.trim()).filter(Boolean);
      const first = parts[0].replace(/^@/, '').replace(/^https?:\/\/shopee\.vn\//, '').split(/[/?#]/)[0];
      if (!first) { errors.push(`Dòng ${i + 1}: không hợp lệ`); return; }
      const name = parts[1] || first;
      if (/^\d+$/.test(first)) out.push({ userId: Number(first), name, source: 'import' });
      else out.push({ username: first, name, source: 'import' });
    });
    return { list: out, errors };
  }

  // ======================= GỬI TIN NHẮN HÀNG LOẠT =======================
  async function runCampaign(cid, opts = {}) {
    await prepare();
    const c = makeCtx('send', opts);
    const camp = await Store.getCampaign(cid);
    if (!camp) throw new Error('Không tìm thấy chiến dịch');
    const cfg = camp.config;
    const contents = (camp.contents || []).filter(validContent);
    if (!contents.length) throw new Error('Kịch bản chưa có nội dung hợp lệ');
    const settings = await Store.getSettings();
    const shop = await Shopee.shopInfo();
    const queue = (await Store.getCustomers(cid)).filter((x) => x.status === 'pending' && x.active !== false);
    if (!queue.length) { await c.log('warn', `[${camp.name}] Không còn khách nào ở trạng thái Chờ.`); return { sent: 0 }; }

    await Store.updateCampaign(cid, { status: 'sending' });
    const maxSend = Number(cfg.maxSend) || Infinity;
    let sent = 0, fail = 0, skip = 0, sinceBreak = 0;
    await c.log('info', `[${camp.name}] Bắt đầu gửi cho ${Math.min(queue.length, maxSend)} khách.`);
    try {
      for (const cu of queue) {
        if (c.stop()) break;
        if (sent >= maxSend) { await c.log('warn', `Đã đạt giới hạn ${maxSend} khách/lần chạy.`); break; }
        // Tra userId từ username
        if (!cu.userId && cu.username) {
          try {
            const id = await Shopee.resolveUsername(cu.username);
            if (!id) throw new Error('không tìm thấy');
            cu.userId = id;
            await Store.updateCustomer(cid, cu.key, { userId: id });
          } catch (e) {
            fail++;
            await Store.updateCustomer(cid, cu.key, { status: 'failed', error: 'Không tra được username: ' + errMsg(e) });
            await c.log('error', `${cu.name}: không tra được userId từ "${cu.username}"`);
            continue;
          }
        }
        const cd = Number(cfg.cooldownMin) || 0;
        if (cd) {
          const last = await Store.lastSent(shop.shopId, cu.userId);
          if (last && Date.now() - last < cd * 60e3) {
            skip++;
            await Store.updateCustomer(cid, cu.key, { status: 'skipped', error: `Đã nhắn lúc ${new Date(last).toLocaleString('vi-VN')}` });
            await c.log('warn', `${cu.name}: bỏ qua, đã nhắn trong ${cd} phút gần đây`);
            continue;
          }
        }
        try {
          await Shopee.sendScript(cu.userId, shop.shopId, contents, { vars: { name: cu.name, shop: shop.shopName }, closeAfter: settings.closeConversation });
          sent++; sinceBreak++;
          await Store.setLastSent(shop.shopId, cu.userId);
          await Store.updateCustomer(cid, cu.key, { status: 'sent', error: '', sentAt: Date.now() });
          await Store.bump('send', 'ok');
          await c.log('ok', `Đã gửi cho ${cu.name}`);
        } catch (e) {
          fail++; sinceBreak++;
          await Store.updateCustomer(cid, cu.key, { status: 'failed', error: errMsg(e) });
          await Store.bump('send', 'fail');
          await c.log('error', `${cu.name}: ${errMsg(e)}`);
          if (/NEED_LOGIN/.test(String(e))) throw e;
        }
        opts.onProgress && opts.onProgress();
        if (Number(cfg.pauseAfter) > 0 && sinceBreak >= Number(cfg.pauseAfter)) {
          sinceBreak = 0;
          await c.log('info', `Nghỉ ${cfg.pauseSec} giây…`);
          await waitStoppable(Number(cfg.pauseSec) * 1000, c.stop);
        } else {
          await waitStoppable(Number(cfg.delaySec) * 1000, c.stop);
        }
      }
    } finally {
      const left = (await Store.getCustomers(cid)).filter((x) => x.status === 'pending' && x.active !== false).length;
      await Store.updateCampaign(cid, { status: left ? 'pending' : 'completed', lastRun: Date.now() });
      await c.log('info', `[${camp.name}] ${c.stop() ? 'Đã dừng' : 'Kết thúc'}: ${sent} gửi, ${fail} lỗi, ${skip} bỏ qua.`);
    }
    return { sent, fail, skip };
  }

  async function waitStoppable(ms, stop) {
    const end = Date.now() + ms;
    while (Date.now() < end && !stop()) await sleep(Math.min(500, end - Date.now()));
  }

  function validContent(x) {
    if (!x || !x.type) return false;
    const p = x.payload || {};
    return (x.type === 'text' && x.text && x.text.trim()) || (x.type === 'sticker' && p.stickerId) || (x.type === 'image' && p.imageId)
      || (x.type === 'product' && p.productId) || (x.type === 'voucher' && p.voucherId);
  }

  self.Jobs = { inWindow, pushTick, replyJob, rateJob, collectFromRatings, collectFromOrders, parseImport, runCampaign, validContent, errMsg, prepare };
})();
