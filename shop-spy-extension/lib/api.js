// Shop Spy - API helpers (dùng chung cho popup và trang spy)
(() => {
const SHOPEE = 'https://shopee.vn';

function request(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'SHOPEE_REQUEST', payload: { url, method, body } }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res) return reject(new Error('Không có phản hồi'));
      if (!res.ok && !res.data) return reject(new Error(res.error || 'HTTP ' + res.status));
      resolve(res.data);
    });
  });
}

// Cache nhỏ trong chrome.storage.session (hết khi đóng trình duyệt)
const cache = {
  async get(key) {
    try {
      const r = await chrome.storage.session.get(key);
      const v = r[key];
      if (v && Date.now() - v.t < 10 * 60 * 1000) return v.d;
    } catch {}
    return null;
  },
  async set(key, d) {
    try { await chrome.storage.session.set({ [key]: { t: Date.now(), d } }); } catch {}
  },
};

/** Nhận diện input: link shop, link sản phẩm, username hoặc shop id */
function parseShopInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return { shopId: s };
  let url;
  try { url = new URL(s.startsWith('http') ? s : 'https://' + s); } catch { url = null; }
  if (!url || !/shopee\./.test(url.hostname)) {
    if (/^[\w.\-]+$/.test(s)) return { username: s };
    return null;
  }
  const path = decodeURIComponent(url.pathname);
  let m;
  if ((m = path.match(/^\/shop\/(\d+)/))) return { shopId: m[1] };
  if ((m = path.match(/-i\.(\d+)\.(\d+)/))) return { shopId: m[1], itemId: m[2] };
  if ((m = path.match(/^\/product\/(\d+)\/(\d+)/))) return { shopId: m[1], itemId: m[2] };
  if ((m = path.match(/^\/([\w.\-]+)\/?$/))) {
    const reserved = ['search', 'cart', 'user', 'mall', 'daily_discover', 'flash_sale', 'buyer', 'verify'];
    if (!reserved.includes(m[1])) return { username: m[1] };
  }
  const sid = url.searchParams.get('shopid') || url.searchParams.get('shopId');
  if (sid) return { shopId: sid };
  return null;
}

async function getShopBase({ shopId, username }) {
  const key = 'shop:' + (shopId || '@' + username);
  const hit = await cache.get(key);
  if (hit) return hit;
  const body = shopId ? { shopid: Number(shopId) } : { username };
  let res = await request(`${SHOPEE}/api/v4/shop/get_shop_base_v2`, 'POST', body).catch(() => null);
  let data = res && res.data;
  if (!data) {
    // fallback GET API cũ
    const q = shopId ? `shopid=${shopId}` : `username=${encodeURIComponent(username)}`;
    res = await request(`${SHOPEE}/api/v4/shop/get_shop_detail?${q}`).catch(() => null);
    data = res && res.data;
  }
  if (!data) {
    const err = res && (res.error || res.error_msg);
    throw new Error(err === 90309999 || err === '90309999'
      ? 'Shopee chặn request (anti-bot). Hãy mở shopee.vn, đăng nhập rồi thử lại.'
      : 'Không tìm thấy thông tin shop');
  }
  await cache.set(key, data);
  return data;
}

async function getShopItems(shopId, limit = 40, page = 0) {
  const params = new URLSearchParams({
    bundle: 'shop_page_category_tab_main',
    item_card_use_scene: 'category_product_list_popular',
    limit: String(limit),
    offset: String(limit * page),
    shop_id: String(shopId),
    sort_type: '1',
    upstream: 'pdp',
    version: '1',
  });
  const url = `${SHOPEE}/api/v4/shop/rcmd_items?${params}`;
  const key = 'items:' + url;
  const hit = await cache.get(key);
  if (hit) return hit;
  const res = await request(url);
  const d = (res && res.data) || {};
  const out = { items: d.items || [], total: typeof d.total === 'number' ? d.total : null, error: res && res.error };
  if (out.items.length) await cache.set(key, out);
  return out;
}

/** Chi tiết sản phẩm (pdp/get_pc): mô tả + ảnh trong mô tả */
async function getItemDetail(shopId, itemId) {
  const key = `detail.v4:${shopId}:${itemId}`;
  const hit = await cache.get(key);
  if (hit) return hit;
  const url = `${SHOPEE}/api/v4/pdp/get_pc?item_id=${itemId}&shop_id=${shopId}&tz_offset_minutes=420&detail_level=0`;
  const res = await request(url);
  const item = res && res.data && res.data.item;
  if (!item) {
    const code = res && res.error;
    throw new Error(String(code) === '90309999'
      ? 'Shopee chặn request (anti-bot). Mở shopee.vn, đăng nhập / xác minh rồi thử lại.'
      : 'Không lấy được chi tiết sản phẩm' + (code ? ` (lỗi ${code})` : ''));
  }
  const paragraphs = (item.rich_text_description && item.rich_text_description.paragraph_list) || [];
  const out = {
    description: item.description || paragraphs.filter((p) => p.text).map((p) => p.text).join('\n'),
    descImages: [...new Set(paragraphs.filter((p) => p.img_id).map((p) => imageUrl(p.img_id)))],
    categories: (item.categories || []).map((c) => ({ id: c.catid, name: c.display_name || String(c.catid) })),
    // Giá & giảm từng phân loại (model)
    models: (item.models || []).map((m) => {
      // Ảnh phân loại: ảnh SKU riêng, nếu không có thì lấy ảnh của tier có ảnh theo tier_index
      const tierIdx = (m.extinfo && m.extinfo.tier_index) || [];
      let img = m.extinfo && m.extinfo.sku_image;
      if (!img) {
        const t = (item.tier_variations || []).findIndex((tv) => tv.images && tv.images.length);
        if (t >= 0) img = item.tier_variations[t].images[tierIdx[t]];
      }
      const price = (m.price || 0) / 1e5;
      const priceOrigin = (m.price_before_discount || 0) / 1e5;
      return {
        name: m.name || '',
        price,
        priceOrigin,
        discount: priceOrigin > price ? Math.round((1 - price / priceOrigin) * 100) : 0,
        inStock: m.has_stock !== false,
        image: imageUrl(img),
      };
    }),
  };
  await cache.set(key, out);
  return out;
}

/* Tên ngành hàng theo ID ngành toàn cầu (100xxx) – học dần từ chi tiết sản phẩm, lưu lâu dài.
   (Cây danh mục công khai của Shopee dùng ID hiển thị 110xxxxx nên không khớp với catid của sản phẩm.) */
const CAT_KEY = 'globalCategories.v1';
let catMapCache = null;
let catSaveTimer;
async function getCategoryMap() {
  if (catMapCache) return catMapCache;
  catMapCache = new Map();
  try {
    const r = await chrome.storage.local.get(CAT_KEY);
    Object.entries(r[CAT_KEY] || {}).forEach(([id, v]) => catMapCache.set(id, v));
  } catch {}
  return catMapCache;
}
function rememberCategory(id, cat) {
  if (!catMapCache || !id) return;
  catMapCache.set(String(id), cat);
  clearTimeout(catSaveTimer);
  catSaveTimer = setTimeout(() => {
    try { chrome.storage.local.set({ [CAT_KEY]: Object.fromEntries(catMapCache) }); } catch {}
  }, 1000);
}

function imageUrl(id) {
  if (!id) return '';
  return id.startsWith('http') ? id : `https://down-vn.img.susercontent.com/file/${id}`;
}

function slugify(name) {
  return String(name || 'san-pham')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

const PROMOTION_TYPES = {
  0: 'Không khuyến mãi', 201: 'Giảm giá', 202: 'Flash Sale', 301: 'Ưu đãi Shopee',
  312: 'Khuyến mãi chiến dịch', 323: 'Ưu đãi kèm', 324: 'Khuyến mãi Shop', 502: 'Ưu đãi thanh toán',
};

/** Ảnh phân loại: [{ label: 'Màu: Đỏ', url }] (bỏ ảnh trùng) */
function variationImages(tiers) {
  const out = [];
  const seen = new Set();
  (tiers || []).forEach((t) => (t.images || []).forEach((img, i) => {
    if (!img || seen.has(img)) return;
    seen.add(img);
    const opt = (t.options || [])[i];
    out.push({ label: t.name ? `${t.name}: ${opt || i + 1}` : String(opt || i + 1), url: imageUrl(img) });
  }));
  return out;
}

/** Chuẩn hoá 1 item Shopee thành row để hiển thị */
function mapItem(raw) {
  // rcmd_items trả các cờ (is_on_flash_sale, item_identities, cb_option, …) ở cấp ngoài cùng của item.
  // Gộp các object lồng (nếu có) nhưng ưu tiên field cấp ngoài, giống cách extension gốc đọc.
  const e = { ...(raw.item_data || {}), ...(raw.item_basic || {}), ...raw };
  const price = (e.price || e.price_min || 0) / 1e5;
  const priceOrigin = (e.price_before_discount || 0) / 1e5;
  const sold = e.historical_sold || e.global_sold_count || 0;
  const soldMonth = e.sold || 0;
  const ctime = e.ctime ? new Date(e.ctime * 1000) : null;
  const ageDay = ctime ? Math.max(1, Math.round((Date.now() - ctime.getTime()) / 864e5)) : null;
  let discountPercent = Number(e.raw_discount) || parseFloat(e.discount) || 0;
  if (!discountPercent && priceOrigin > price) discountPercent = Math.round((1 - price / priceOrigin) * 100);
  const rating = e.item_rating || {};
  const catid = e.global_cat && e.global_cat.catid ? e.global_cat.catid.at(-1) : e.catid;
  const video = (e.video_info_list || [])[0];
  const displayPrice = e.item_card_display_price || raw.item_card_display_price || {};
  const videoUrl = (video && ((video.formats && video.formats[0] && video.formats[0].url) || (video.default_format && video.default_format.url))) || '';
  return {
    itemId: e.itemid,
    shopId: e.shopid,
    name: e.name || '',
    image: imageUrl(e.image),
    images: [...new Set((e.images && e.images.length ? e.images : [e.image]).filter(Boolean).map(imageUrl))],
    variationImages: variationImages(e.tier_variations),
    description: null, // null = chưa tải; tải bằng getItemDetail
    descImages: null,
    models: null,
    url: `${SHOPEE}/${slugify(e.name)}-i.${e.shopid}.${e.itemid}`,
    videoUrl,
    price,
    priceOrigin,
    priceMin: (e.price_min || 0) / 1e5,
    priceMax: (e.price_max || 0) / 1e5,
    discountPercent,
    sold,
    soldMonth,
    sale: sold * price,
    saleMonth: soldMonth * price,
    stock: e.stock ?? null,
    liked: e.liked_count || 0,
    ratingStar: Number(rating.rating_star || 0),
    ratingCount: Array.isArray(rating.rating_count) ? rating.rating_count[0] || 0 : e.cmt_count || 0,
    brand: e.brand || 'No Brand',
    catid: catid || '',
    categoryName: catid ? String(catid) : 'Khác',
    categoryTree: '',
    shopName: e.shop_name || '',
    isMall: !!(e.is_official_shop || e.shopee_mall),
    isNewItem: (e.item_identities || []).includes('new_item'),
    isCrossBorder: e.cb_option === 1,
    hasShopVoucher: !!displayPrice.recommended_shop_voucher_info,
    ctime,
    ageDay,
    soldPerDay: ageDay ? Math.round((sold / ageDay) * 100) / 100 : 0,
    // Flash sale đang chạy: cờ is_on_flash_sale, hoặc giá/nhãn hiển thị thuộc khuyến mãi loại 202 (Flash Sale)
    isFlashSale: !!e.is_on_flash_sale || displayPrice.promotion_type === 202 ||
      (e.item_card_display_label && e.item_card_display_label.promotion_type === 202) || false,
    flashSaleStock: e.flash_sale_stock || 0,
    promotionType: displayPrice.promotion_type || 0,
    promotionName: PROMOTION_TYPES[displayPrice.promotion_type || 0] || `Loại ${displayPrice.promotion_type}`,
    hasVideo: !!videoUrl,
    location: e.shop_location || '',
  };
}

const fmt = {
  num: (n) => Number(n || 0).toLocaleString('vi-VN'),
  money: (n) => Number(Math.round(n || 0)).toLocaleString('vi-VN') + ' ₫',
  short(n) {
    n = Number(n || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  },
  date: (d) => (d ? d.toLocaleDateString('vi-VN') : ''),
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shopBadges(info) {
  const b = [];
  if (info.show_official_shop_label || info.is_official_shop) b.push(['Mall', 'mall']);
  if (info.is_preferred_plus_seller) b.push(['Yêu thích+', 'pref']);
  else if (info.show_shopee_verified_label || info.is_shopee_verified) b.push(['Yêu thích', 'pref']);
  if (info.vacation) b.push(['Đang nghỉ', 'off']);
  return b;
}

function renderShopHead(info, shopId) {
  const username = (info.account && info.account.username) || '';
  const avatar = imageUrl(info.account && info.account.portrait);
  const meta = [
    ['Sản phẩm', fmt.num(info.item_count)],
    ['Theo dõi', fmt.num(info.follower_count)],
    ['Đánh giá', '★ ' + Number(info.rating_star || 0).toFixed(1)],
  ];
  if (info.response_rate) meta.push(['Phản hồi', info.response_rate + '%']);
  if (info.ctime) meta.push(['Tham gia', fmt.date(new Date(info.ctime * 1000))]);
  if (info.shop_location) meta.push(['Khu vực', info.shop_location]);
  const badges = shopBadges(info).map(([t, c]) => `<span class="badge ${c}">${t}</span>`).join('');
  return `
    <div class="shop-head">
      ${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : ''}
      <div style="flex:1;min-width:0">
        <h1>${escapeHtml(info.name || username)}</h1>
        <div class="muted">@${escapeHtml(username)} · ID ${escapeHtml(shopId)}
          · <a href="https://shopee.vn/${escapeHtml(username || 'shop/' + shopId)}" target="_blank">Mở trên Shopee ↗</a></div>
        ${badges ? `<div class="badges">${badges}</div>` : ''}
        <div class="meta">${meta.map(([k, v]) => `<span>${k}: <b>${escapeHtml(v)}</b></span>`).join('')}</div>
      </div>
    </div>`;
}

window.SpyApi = { parseShopInput, getShopBase, getShopItems, getItemDetail, getCategoryMap, rememberCategory, mapItem, imageUrl, fmt, escapeHtml, shopBadges, renderShopHead };
})();
