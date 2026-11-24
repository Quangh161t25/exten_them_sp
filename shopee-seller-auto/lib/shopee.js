// Gọi API Shopee Kênh Người Bán (banhang.shopee.vn). Endpoint lấy theo AutoShopee Kit v3.56,
// riêng phần "Đẩy sản phẩm" bản gốc chưa làm (COMING_SOON) nên endpoint là của Kênh Người Bán, có thể sửa trong Cài đặt.
(() => {
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x'.repeat(32).replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Endpoint đẩy sản phẩm (mặc định) – người dùng có thể đổi trong Cài đặt nếu Shopee thay đổi
  // boostPath đã xác nhận từ request thật của Kênh Người Bán (11/2026). boostedListPath để trống = theo dõi cục bộ.
  const DEFAULT_BOOST = {
    boostPath: '/api/v3/opt/product/boost_product/',
    boostedListPath: '',
  };

  let demo = !self.Bridge || !Bridge.HAS_EXT;
  let boostCfg = { ...DEFAULT_BOOST };

  // ---------------- Lớp gọi chung ----------------
  async function baseQuery() {
    const cds = await Bridge.getCookie('seller', 'SPC_CDS');
    return cds ? { version: '3.1.0', SPC_CDS: cds, SPC_CDS_VER: 2 } : { version: '3.1.0' };
  }

  function pickError(d) {
    if (!d) return '';
    if (d.code && d.code !== 0) return d.message || d.msg || d.user_message || `code ${d.code}`;
    if (d.error && d.error !== 0 && d.error !== '0') return d.error_msg || d.message || `error ${d.error}`;
    return '';
  }

  async function call(method, path, { query, body, headers, form, raw } = {}) {
    const r = await Bridge.fetch('seller', { method, path, query: { ...(await baseQuery()), ...(query || {}) }, body, headers, form });
    if (raw) return r;
    if (!r.data) throw new Error(`HTTP ${r.status}: ${r.text || 'không đọc được phản hồi'}`);
    const err = pickError(r.data);
    if (err) throw new Error(err);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.data;
  }
  const get = (path, query) => call('GET', path, { query });
  const post = (path, body, opt = {}) => call('POST', path, { ...opt, body });

  // ---------------- Shop ----------------
  async function shopInfo() {
    if (demo) return Demo.shop;
    try {
      const d = await get('/api/forward/accountservice/v2/shop/');
      if (d.shop_id) return { shopId: d.shop_id, shopName: d.shop_name || d.username, username: d.username };
    } catch {}
    const d = await get('/api/selleraccount/shop_info/');
    const x = d.data || d;
    if (!x.shop_id) throw new Error('Không lấy được thông tin shop. Hãy đăng nhập Kênh Người Bán.');
    return { shopId: x.shop_id, shopName: x.name || x.shop_name, username: x.username || '' };
  }

  // ---------------- Sản phẩm & đẩy sản phẩm ----------------
  const imgUrl = (id) => (!id ? '' : /^https?:/.test(id) ? id : `https://down-vn.img.susercontent.com/file/${id}`);

  async function searchProducts(keyword = '', page = 1, size = 20) {
    if (demo) return Demo.products(keyword, page, size);
    const q = { page_number: page, page_size: size };
    if (keyword) { q.keyword = keyword; q.search_type = /^\d+$/.test(keyword) ? 'id' : 'name'; }
    const d = await get('/api/v3/mpsku/list/search_product_list', q);
    const list = (d.data && d.data.products) || [];
    return {
      total: (d.data && d.data.page_info && d.data.page_info.total) || list.length,
      list: list.map((p) => ({
        id: p.id,
        name: p.name,
        image: imgUrl(p.cover_image),
        stock: (p.stock_detail && p.stock_detail.total_available_stock) ?? '',
        sold: (p.statistics && p.statistics.sold_count) ?? '',
      })),
    };
  }

  /** Danh sách đang được đẩy: [{ id, endsAt(ms) }] – null nếu không lấy được */
  async function boostedList() {
    if (demo) return Demo.boosted();
    if (!boostCfg.boostedListPath) return null; // không có API danh sách → jobs tự theo dõi 4 giờ/lượt
    try {
      const d = await get(boostCfg.boostedListPath);
      const raw = (d.data && (d.data.list || d.data.products || d.data)) || [];
      if (!Array.isArray(raw)) return null;
      const now = Date.now();
      return raw.map((x) => {
        const id = x.id || x.item_id || x.product_id;
        const cd = Number(x.cool_down_seconds ?? x.cooldown_seconds ?? x.remaining_seconds ?? 0);
        return { id, endsAt: cd ? now + cd * 1000 : 0 };
      }).filter((x) => x.id);
    } catch { return null; }
  }

  async function boost(itemId) {
    if (demo) { await sleep(300); return Demo.boost(itemId); }
    return post(boostCfg.boostPath, { id: Number(itemId) });
  }

  // ---------------- Đánh giá của khách (trả lời) ----------------
  /** reply_status: 1 = chưa trả lời, 2 = đã trả lời, 0 = tất cả */
  async function listRatings({ stars = [5, 4], page = 1, size = 20, replyStatus = 1, cursor = 0, timeStart, timeEnd, search } = {}) {
    if (demo) return Demo.ratings(stars, page, size, replyStatus);
    const q = { rating_star: stars.join(','), page_number: page, page_size: size, cursor, from_page_number: page > 1 ? page - 1 : 0, language: 'vi' };
    if (replyStatus) q.reply_status = replyStatus;
    if (timeStart) q.time_start = timeStart;
    if (timeEnd) q.time_end = timeEnd;
    if (search) q.search_request = search;
    const d = await get('/api/v3/settings/search_shop_rating_comments_new/', q);
    return ((d.data && d.data.list) || []).map((x) => ({
      commentId: x.comment_id,
      orderId: x.order_id,
      userId: x.user_id,
      userName: x.user_name || '',
      star: x.rating_star,
      comment: x.comment || '',
      reply: x.reply,
      ctime: x.ctime || x.submit_time || 0,
      productName: x.product_name || (x.product && x.product.name) || '',
    }));
  }

  async function ratingCounts(stars = [5, 4]) {
    if (demo) return { toReply: 12 };
    const d = await get('/api/v3/settings/search_shop_rating_comments_new/', {
      rating_star: stars.join(','), page_number: 1, page_size: 1, cursor: 0, from_page_number: 0, reply_status: 1, language: 'vi',
    });
    const c = (d.data && d.data.counts) || {};
    return { toReply: c.to_reply_count ?? 0, raw: c };
  }

  async function replyRating(orderId, commentId, text) {
    if (demo) { await sleep(200); return { ok: true }; }
    const d = await post('/api/v3/settings/reply_shop_rating/', { order_id: orderId, comment_id: commentId, comment: text });
    if (d.message && d.message !== 'success') throw new Error(d.message);
    return d;
  }

  // ---------------- Đơn hàng (đánh giá người mua) ----------------
  const COMPLETED_TAB = 500;
  async function listOrderPage(page = 1, size = 40, sentinel = '') {
    if (demo) return Demo.orders(page, size);
    const body = {
      order_list_tab: COMPLETED_TAB, entity_type: 1,
      pagination: { from_page_number: page > 1 ? page - 1 : 1, page_number: page, page_size: size, page_sentinel: sentinel || '' },
      filter: { fulfillment_type: 0, is_drop_off: 0, fulfillment_source: 0, action_filter: 0 },
    };
    const d = await post('/api/v3/order/search_order_list_index', body);
    const idx = (d.data && d.data.index_list) || [];
    const pg = (d.data && d.data.pagination) || {};
    const orders = [];
    for (let i = 0; i < idx.length; i += 5) {
      const part = idx.slice(i, i + 5);
      try {
        const c = await post('/api/v3/order/get_order_list_card_list', { order_list_tab: COMPLETED_TAB, need_count_down_desc: false, order_param_list: part });
        ((c.data && c.data.card_list) || []).forEach((x) => {
          const o = x.order_card || x;
          const ext = o.order_ext_info || {};
          const head = o.card_header || {};
          orders.push({
            orderId: ext.order_id,
            orderSn: head.order_sn || ext.order_sn || '',
            buyerId: ext.buyer_user_id,
            buyerName: (head.buyer_info && head.buyer_info.username) || '',
            ratable: !!ext.is_order_ratable,
          });
        });
      } catch {}
    }
    // Shopee trả 2 sentinel ngược tên nhau, bản gốc dùng previous_page_sentinel để sang trang sau
    return { orders, total: pg.total || 0, next: pg.previous_page_sentinel || pg.next_page_sentinel || '' };
  }

  async function rateOrder(orderId, text, star = 5) {
    if (demo) { await sleep(200); return { ok: true }; }
    return post('/api/v3/order/rate_order/', { order_id: orderId, rate_star: star, rate_comment: text });
  }

  // ---------------- Chat ----------------
  let chatAuth = null;
  async function chatLogin(force) {
    if (!force && chatAuth && Date.now() - chatAuth.at < 15 * 60e3) return chatAuth;
    const lg = await call('POST', '/webchat/api/coreapi/v1.2/mini/login/sc', { raw: true });
    const ld = lg.data || {};
    const token = ld.token || (ld.data && ld.data.token);
    let me = {};
    try { me = (await call('GET', '/api/v2/login/', { raw: true })).data || {}; } catch {}
    const userId = me.id || me.userid || me.user_id || (ld.user && ld.user.uid) || ld.uid;
    const ctoken = await Bridge.getCookie('seller', 'CTOKEN');
    if (!token || !userId || !ctoken) throw new Error('Không đăng nhập được Shopee Chat (thiếu token/userId/CTOKEN). Hãy mở banhang.shopee.vn/webchat một lần rồi thử lại.');
    chatAuth = { token, userId, ctoken, at: Date.now() };
    return chatAuth;
  }

  async function chatOpt() {
    const a = await chatLogin();
    return {
      query: { _uid: `1-${a.userId}`, _v: '8.8.9', csrf_token: a.ctoken, SPC_CDS_CHAT: uuid(), 'x-shop-region': 'VN', _api_source: 'sc' },
      headers: { authorization: `Bearer ${a.token}`, 'content-type': 'text/plain;charset=UTF-8', 'x-shop-region': 'VN' },
    };
  }

  async function chatCall(method, path, body, extra = {}) {
    const o = await chatOpt();
    const r = await Bridge.fetch('seller', { method, path, query: { ...(await baseQuery()), ...o.query }, headers: { ...o.headers, ...(extra.headers || {}) }, body: body !== undefined ? JSON.stringify(body) : undefined, form: extra.form });
    if (r.status === 401) { chatAuth = null; }
    if (!r.data) throw new Error(`Chat HTTP ${r.status}: ${r.text}`);
    const err = pickError(r.data);
    if (err) throw new Error(err);
    return r.data;
  }

  async function openConversation(toUserId, shopId) {
    if (demo) return 'demo-conv';
    try {
      const d = await chatCall('POST', '/webchat/api/v1.2/mini/conversation/redirection', { user_id: Number(toUserId), shop_id: Number(shopId), biz_id: 0, on_message_received: true, entry_point: 'seller_contact_buyer' });
      return d.conversation_id || (d.data && d.data.conversation_id) || (d.conversation && d.conversation.id) || '';
    } catch { return ''; }
  }

  async function setConversationStatus(convId, shopId, status) {
    if (demo || !convId) return;
    try { await chatCall('PUT', `/webchat/api/v1.2/mini/conversations/${convId}/status`, { shop_id: Number(shopId), status, biz_id: 2 }); } catch {}
  }

  /** item: { type: text|sticker|image|product|voucher, text, payload } */
  async function sendChat(toUserId, shopId, item, convId) {
    if (demo) { await sleep(250); return Demo.send(toUserId); }
    const a = await chatLogin();
    const type = item.type || 'text';
    const p = item.payload || {};
    const body = {
      to_id: Number(toUserId), shop_id: Number(shopId), type,
      content: { text: item.text || '', uid: uuid() },
      request_id: uuid(),
      chat_send_option: { force_send_cancel_order_warning: false, comply_cancel_order_warning: false },
      entry_point: 'direct_chat_entry_point', choice_info: { real_shop_id: null }, biz_id: 0, source: 'minichat',
    };
    if (type === 'text' && !body.content.text) throw new Error('Tin nhắn trống');
    if (type === 'sticker') { body.content = { uid: body.content.uid, sticker_id: p.stickerId, sticker_package_id: p.stickerPackage }; }
    if (type === 'image') { body.content = { uid: body.content.uid, image_id: p.imageId, url: `https://down-sg.img.susercontent.com/${p.imageId}` }; }
    if (type === 'product') { body.content = { uid: body.content.uid, product_id: Number(p.productId), shop_id: Number(p.shopId || shopId), product_name: p.productName || '' }; }
    if (type === 'voucher') { body.content = { uid: body.content.uid, voucher_id: p.voucherId, voucher_code: p.voucherCode, source: 'webchat' }; }
    if (convId) body.conversation_id = convId;

    const ts = Date.now();
    const plat = '7.3.4';
    const sign = [
      'key=396c15ad-6d3e-4018-98be-cef58cb45cd0', `plat=${plat}`, 'ver=v1.2', `fromID=${a.userId}`, `reqID=${body.request_id}`,
      `toID=${body.to_id}`, `timestamp=${ts}`, `type=${type}`, `strinput=${type === 'text' ? body.content.text : ''}`,
    ].join('&');
    const r = await Bridge.fetch('seller', {
      method: 'POST', path: '/webchat/api/v1.2/mini/messages',
      query: { ...(await baseQuery()), _uid: `0-${a.userId}`, _v: plat, _api_source: 'sc', csrf_token: a.ctoken },
      headers: { 'x-v': '1', 'x-s': await sha256(sign), ts: String(ts), Authorization: `Bearer ${a.token}`, 'content-type': 'application/json' },
      body,
    });
    if (r.status === 401) chatAuth = null;
    if (!r.data) throw new Error(`Chat HTTP ${r.status}: ${r.text}`);
    const err = pickError(r.data);
    if (err) throw new Error(err);
    return { conversationId: r.data.conversation_id || (r.data.data && r.data.data.conversation_id) || convId || '' };
  }

  /** Gửi trọn 1 kịch bản (nhiều nội dung) cho 1 khách */
  async function sendScript(toUserId, shopId, items, { delayMs = 1000, closeAfter = true, vars = {} } = {}) {
    let conv = await openConversation(toUserId, shopId);
    if (conv) await setConversationStatus(conv, shopId, 'activated');
    for (let i = 0; i < items.length; i++) {
      const it = items[i].type === 'text' ? { ...items[i], text: Tpl.render(items[i].text, vars) } : items[i];
      const r = await sendChat(toUserId, shopId, it, conv);
      conv = r.conversationId || conv;
      if (i < items.length - 1) await sleep(delayMs);
    }
    if (conv && closeAfter) await setConversationStatus(conv, shopId, 'closed');
    return conv;
  }

  async function uploadChatImage(b64, type, name) {
    if (demo) return 'demo-image';
    const d = await chatCall('POST', '/webchat/api/coreapi/v1.2/images', undefined, {
      headers: { 'content-type': undefined }, form: { b64, type, name, field: 'file' },
    });
    const id = d.url_hash || (d.data && d.data.url_hash);
    if (!id) throw new Error('Upload ảnh không trả về url_hash');
    return id;
  }

  async function listVouchers() {
    if (demo) return Demo.vouchers;
    const d = await get('/api/marketing/v3/voucher/list/', { limit: 50, offset: 0, promotion_type: 0 });
    return ((d.data && d.data.voucher_list) || []).map((v) => ({
      id: v.voucher_id, code: v.voucher_code, name: v.voucher_name || v.name || v.voucher_code, start: v.start_time, end: v.end_time,
    }));
  }

  /** Tra userId từ username (gọi trang shopee.vn công khai) */
  async function resolveUsername(username) {
    if (demo) return 100000 + (username.length * 7919);
    const r = await Bridge.fetch('shopee', { path: '/api/v4/shop/get_shop_base_v2', query: { username } });
    const d = r.data && (r.data.data || r.data);
    return (d && (d.userid || d.user_id)) || 0;
  }

  // ---------------- Mẫu nội dung ----------------
  const Tpl = {
    /** {ten} {ma_don} {sao} {shop}; giữ tương thích BUYER_NAME/ORDER_ID/RATING_STAR của bản gốc. Biến thể ngăn bởi dòng "---" → chọn ngẫu nhiên */
    render(text, v = {}) {
      const variants = String(text || '').split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean);
      const t = variants.length ? variants[Math.floor(Math.random() * variants.length)] : '';
      return t
        .replace(/\{ten\}|BUYER_NAME/g, v.name || 'bạn')
        .replace(/\{ma_don\}|ORDER_ID/g, v.orderSn || v.orderId || '')
        .replace(/\{sao\}|RATING_STAR/g, v.star || '')
        .replace(/\{shop\}/g, v.shop || '');
    },
  };

  // ---------------- Dữ liệu giả (chế độ thử / xem giao diện ngoài extension) ----------------
  const Demo = (() => {
    const names = ['minh.anh', 'thuha_92', 'quang.le', 'ngoc.tran', 'hoangvu88', 'linh.pham', 'tuan_kiet', 'maithao', 'bao.nguyen', 'phuongdung'];
    const comments = ['Hàng đẹp, giao nhanh', 'Đóng gói cẩn thận, sẽ ủng hộ tiếp', 'Sản phẩm đúng mô tả', 'Tạm ổn', 'Giao hơi chậm nhưng hàng ok', 'Rất hài lòng!'];
    const prods = ['Áo thun cotton basic', 'Quần jean ống suông', 'Túi tote canvas', 'Dép quai ngang', 'Mũ lưỡi trai', 'Áo khoác gió', 'Váy hoa nhí', 'Balo laptop 15"', 'Ví da mini', 'Kính râm thời trang', 'Tất cổ cao', 'Áo sơ mi linen'];
    const boosted = {};
    return {
      shop: { shopId: 123456789, shopName: 'Shop Demo', username: 'shopdemo' },
      products(kw, page, size) {
        const all = prods.map((n, i) => ({ id: 2000000 + i, name: n, image: '', stock: 20 + i * 3, sold: 100 - i * 5 }))
          .filter((p) => !kw || p.name.toLowerCase().includes(kw.toLowerCase()) || String(p.id) === kw);
        return { total: all.length, list: all.slice((page - 1) * size, page * size) };
      },
      boosted() { const now = Date.now(); return Object.entries(boosted).filter(([, t]) => t > now).map(([id, t]) => ({ id: Number(id), endsAt: t })); },
      boost(id) { if (Object.values(boosted).filter((t) => t > Date.now()).length >= 99) throw new Error('Đã đạt tối đa sản phẩm đang đẩy'); boosted[id] = Date.now() + 4 * 3600e3; return { ok: true }; },
      ratings(stars, page, size, rs) {
        if (page > 2) return [];
        return Array.from({ length: Math.min(size, 6) }, (_, i) => {
          const n = (page - 1) * 6 + i;
          return { commentId: 9000 + n, orderId: 7000 + n, userId: 50000 + n, userName: names[n % names.length], star: stars[n % stars.length], comment: comments[n % comments.length], reply: rs === 2 ? 'Cảm ơn bạn' : null, ctime: Math.floor(Date.now() / 1000) - n * 3600, productName: prods[n % prods.length] };
        });
      },
      orders(page, size) {
        if (page > 2) return { orders: [], total: 12, next: '' };
        return { total: 12, next: 's' + page, orders: Array.from({ length: 6 }, (_, i) => { const n = (page - 1) * 6 + i; return { orderId: 8000 + n, orderSn: '2411' + (100000 + n), buyerId: 60000 + n, buyerName: names[n % names.length], ratable: n % 4 !== 0 }; }) };
      },
      send(uid) { if (Number(uid) % 13 === 0) throw new Error('Người dùng không nhận tin nhắn (dữ liệu giả)'); return { conversationId: 'demo' }; },
      vouchers: [
        { id: 1, code: 'SHOPDEMO10', name: 'Giảm 10K đơn 99K', start: 0, end: 0 },
        { id: 2, code: 'SHOPDEMOFS', name: 'Freeship 15K', start: 0, end: 0 },
      ],
    };
  })();

  self.Shopee = {
    setDemo(v) { demo = !!v || !self.Bridge || !Bridge.HAS_EXT; },
    isDemo: () => demo,
    setBoostConfig(c) {
      const x = { ...(c || {}) };
      // Bỏ các endpoint đoán sai của bản 1.0.0 nếu người dùng đã lỡ lưu
      if (x.boostPath === '/api/v3/product/boost_product/') delete x.boostPath;
      if (x.boostedListPath === '/api/v3/product/get_boosted_list/') delete x.boostedListPath;
      boostCfg = { ...DEFAULT_BOOST, ...x };
    },
    getBoostConfig: () => ({ ...boostCfg }),
    DEFAULT_BOOST,
    imgUrl,
    shopInfo, searchProducts, boostedList, boost,
    listRatings, ratingCounts, replyRating,
    listOrderPage, rateOrder,
    chatLogin, sendChat, sendScript, openConversation, uploadChatImage, listVouchers, resolveUsername,
  };
  self.Tpl = Tpl;
})();
