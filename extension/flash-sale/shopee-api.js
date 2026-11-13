// Lớp gọi API Kênh Người Bán Shopee.
// Mọi request được chạy BÊN TRONG một tab banhang.shopee.vn (qua chrome.scripting),
// nên trình duyệt tự gửi kèm cookie đăng nhập như khi bạn thao tác trên web.

const SELLER_ORIGIN = 'https://banhang.shopee.vn';

let cachedTabId = null;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitTabComplete(tabId, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Hết thời gian chờ tải trang Kênh Người Bán'));
    }, timeout);
    function listener(id, info, tab) {
      if (id === tabId && info.status === 'complete') {
        cleanup();
        resolve(tab);
      }
    }
    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => {
      if (t.status === 'complete') {
        cleanup();
        resolve(t);
      }
    }).catch((e) => {
      cleanup();
      reject(e);
    });
  });
}

// Tìm (hoặc mở ngầm) một tab Kênh Người Bán để chạy request.
async function getSellerTab() {
  if (cachedTabId !== null) {
    try {
      const t = await chrome.tabs.get(cachedTabId);
      if (t.url && t.url.startsWith(SELLER_ORIGIN)) {
        if (t.status !== 'complete') await waitTabComplete(t.id);
        return t.id;
      }
    } catch (e) { /* tab đã đóng */ }
    cachedTabId = null;
  }

  const tabs = await chrome.tabs.query({ url: SELLER_ORIGIN + '/*' });
  let tab = tabs.find((t) => t.status === 'complete') || tabs[0];
  if (!tab) {
    // Chưa có tab Kênh Người Bán: tự mở trang Đơn cần xử lý ở tab nền rồi chạy tiếp
    tab = await chrome.tabs.create({ url: 'https://banhang.shopee.vn/portal/sale/order?type=toship&source=to_process&sort_by=ship_by_date_asc', active: false });
    await waitTabComplete(tab.id);
    await new Promise((r) => setTimeout(r, 2000)); // chờ trang khởi tạo phiên
  }
  tab = await waitTabComplete(tab.id);
  if (!tab.url || !tab.url.startsWith(SELLER_ORIGIN)) {
    throw new Error('Bạn chưa đăng nhập Kênh Người Bán Shopee. Hãy mở banhang.shopee.vn và đăng nhập.');
  }
  cachedTabId = tab.id;
  return tab.id;
}

// Hàm này được inject và chạy trong tab Shopee.
function pageFetch(url, method, body) {
  return fetch(url, {
    method,
    credentials: 'include',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json'
    },
    body: body == null ? undefined : JSON.stringify(body)
  })
    .then(async (r) => ({ status: r.status, text: await r.text() }))
    .catch((e) => ({ status: 0, text: '', error: String(e) }));
}

async function getSpcCds() {
  const c = await chrome.cookies.get({ url: SELLER_ORIGIN, name: 'SPC_CDS' });
  return (c && c.value) || '';
}

export async function request(method, path, { params = {}, body = null } = {}) {
  const tabId = await getSellerTab();
  const spc = await getSpcCds();
  const qs = new URLSearchParams({ SPC_CDS: spc, SPC_CDS_VER: '2', version: '3.1.0' });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${SELLER_ORIGIN}${path}?${qs.toString()}`;

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pageFetch,
    args: [url, method, body]
  });
  const result = injection && injection.result;
  if (!result) throw new Error('Không chạy được request trong tab Shopee');
  if (result.error) throw new Error('Lỗi mạng: ' + result.error);
  if (result.status === 401 || result.status === 403) {
    throw new Error(`Shopee từ chối (HTTP ${result.status}). Hãy đăng nhập lại Kênh Người Bán.`);
  }

  let json;
  try {
    json = JSON.parse(result.text);
  } catch (e) {
    throw new Error(`Phản hồi không phải JSON (HTTP ${result.status})`);
  }
  const code = json.code ?? json.error ?? 0;
  if (code) {
    const err = new Error(json.message || json.msg || json.err_msg || `Shopee trả lỗi code ${code}`);
    err.code = code;
    err.response = json;
    throw err;
  }
  return json.data;
}

// ---------- Tiện ích chuẩn hoá dữ liệu ----------

export const toNumber = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const imageUrl = (hash) =>
  !hash ? '' : String(hash).startsWith('http') ? hash : `https://cf.shopee.vn/file/${hash}_tn`;

function pick(obj, paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

let cachedShopWarehouses = null;
export async function getShopWarehouses(forceRefresh = false) {
  if (cachedShopWarehouses && !forceRefresh) return cachedShopWarehouses;
  try {
    const d = await request('GET', '/api/v3/product/get_shop_warehouse/');
    const list = (d && (d.warehouse_list || d.list)) || [];
    cachedShopWarehouses = list.map((w) => ({
      location_id: String(w.location_id ?? w.warehouse_id ?? w.id ?? ''),
      warehouse_name: String(w.warehouse_name || w.name || '').trim(),
      warehouse_id: w.warehouse_id,
      in_holiday_mode: !!w.in_holiday_mode
    })).filter((w) => w.location_id);
    return cachedShopWarehouses;
  } catch (e) {
    console.warn('Lỗi lấy danh sách kho Shopee:', e);
    return [];
  }
}

export function extractLocationsStock(m, product, warehouses = []) {
  const whMap = new Map();
  if (Array.isArray(warehouses)) {
    warehouses.forEach((w) => {
      const id = String(w.location_id ?? w.warehouse_id ?? w.id ?? '');
      const name = w.warehouse_name || w.name || '';
      if (id) whMap.set(id, name);
    });
  }

  const foundMap = new Map();

  function inspectItem(item) {
    if (!item || typeof item !== 'object') return;
    const locId = String(item.location_id ?? item.warehouse_id ?? item.locationId ?? '');
    if (!locId || item.is_disabled) return; // kho đang tắt (vd kho nghỉ) không tính

    const rawVal = item.sellable_stock ?? item.stock ?? item.normal_stock ?? item.available_stock ?? item.seller_stock;
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      const stockNum = Math.max(0, parseInt(rawVal, 10) || 0);
      const locName = item.location_name || item.warehouse_name || item.name || whMap.get(locId) || '';
      if (!foundMap.has(locId) || stockNum > 0) {
        foundMap.set(locId, {
          locationId: locId,
          warehouseName: locName || whMap.get(locId) || `Kho ${foundMap.size + 1}`,
          stock: stockNum
        });
      }
    }
  }

  function deepScan(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 4) return;
    if (Array.isArray(obj)) {
      obj.forEach((it) => {
        inspectItem(it);
        deepScan(it, depth + 1);
      });
      return;
    }
    const candidates = [
      obj.stock_setting_list,
      obj.seller_stock,
      obj.seller_stock_list,
      obj.location_stocks,
      obj.stock_info_v2?.seller_stock,
      obj.stock_info?.seller_stock,
      obj.stock_detail?.seller_stock,
      obj.stock_detail?.stock_setting_list,
      obj.stock_detail?.seller_stock_info, // get_product_info: [{ location_id, sellable_stock, is_disabled }]
      obj.seller_stock_info?.location_detail, // get_product_stock
      obj.seller_stock_info?.location_stocks
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) c.forEach((it) => inspectItem(it));
    }
    inspectItem(obj);
  }

  deepScan(m);
  if (foundMap.size === 0 && product) deepScan(product);

  // Nếu không tìm thấy thông tin kho nào trong dữ liệu, trả về rỗng để không bị ghi đè số 0 giả
  if (foundMap.size === 0) return [];

  const result = [];
  if (Array.isArray(warehouses) && warehouses.length > 0) {
    warehouses.forEach((w, idx) => {
      const locId = String(w.location_id);
      if (locId) {
        const found = foundMap.get(locId);
        if (!found) return; // kho đang tắt / không có trong dữ liệu tồn kho của sản phẩm
        result.push({
          locationId: locId,
          warehouseName: w.warehouse_name || found?.warehouseName || `Kho ${idx + 1}`,
          stock: found ? found.stock : 0
        });
      }
    });
  } else {
    result.push(...foundMap.values());
  }

  return result;
}

const STOCK_PICK_KEYS = [
  'stock_detail.total_seller_stock',
  'stock_detail.total_available_stock',
  'stock_info_v2.summary_info.total_available_stock',
  'stock_info_v2.total_available_stock',
  'seller_stock_info.normal_stock',
  'stock_info.normal_stock',
  'total_available_stock',
  'sellable_stock',
  'normal_stock',
  'available_stock',
  'total_stock',
  'stock'
];

function normalizeModel(m, product, warehouses = []) {
  const modelSku = m.sku || m.model_sku || m.variation_sku || '';
  const productSku = product ? (product.parent_sku || product.item_sku || product.product_sku || product.sku || '') : '';
  const sku = modelSku || (!product?.model_list?.length ? productSku : '');
  const locationStocks = extractLocationsStock(m, product, warehouses);
  const rawStock = toNumber(pick(m, STOCK_PICK_KEYS) ?? pick(product, STOCK_PICK_KEYS));
  return {
    modelId: Number(m.id ?? m.model_id ?? 0),
    name: m.name || m.model_name || '',
    sku,
    sold: toNumber(pick(m, ['statistics.sold_count', 'sold_count', 'sold'])),
    price: toNumber(pick(m, ['price_info.input_normal_price', 'price_info.normal_price', 'input_normal_price', 'price'])
      ?? pick(product, ['price_info.input_normal_price', 'price_info.normal_price', 'price'])),
    promoPrice: toNumber(pick(m, ['price_info.input_promotion_price', 'price_info.promotion_price', 'input_promotion_price'])),
    stock: rawStock,
    locationStocks,
    locationStocksSynced: locationStocks.length > 0,
    raw: m
  };
}

export function normalizeProduct(p, warehouses = []) {
  const models = Array.isArray(p.model_list) && p.model_list.length
    ? p.model_list.map((m) => normalizeModel(m, p, warehouses))
    : [normalizeModel({ id: 0 }, p, warehouses)];
  return {
    itemId: Number(p.id ?? p.item_id ?? p.product_id),
    name: p.name || '',
    description: p.description || (p.description_info && p.description_info.description) || '',
    image: imageUrl(p.cover_image || (Array.isArray(p.images) && p.images[0])),
    status: Number(p.status ?? 1),
    unlisted: !!p.unlisted,
    parentSku: p.parent_sku || p.item_sku || p.product_sku || p.sku || '',
    sold: toNumber(pick(p, ['statistics.sold_count', 'sold', 'sales', 'historical_sold']))
      || models.reduce((a, m) => a + m.sold, 0),
    views: toNumber(pick(p, ['statistics.view_count', 'view_count'])),
    likes: toNumber(pick(p, ['statistics.liked_count', 'liked_count', 'like_count'])),
    createTime: Number(p.create_time ?? p.ctime ?? 0),
    models,
    raw: p
  };
}

// ---------- API ----------

export async function getShopInfo() {
  const d = await request('GET', '/api/selleraccount/shop_info/');
  return { name: (d && (d.name || d.shop_name)) || '', shopId: d && (d.shop_id || d.shopid) };
}

export const products = {
  async search({ keyword = '', cursor = '', pageSize = 24, pageNumber = 1 } = {}) {
    const params = { page_number: pageNumber, page_size: pageSize, cursor };
    if (keyword) {
      params.keyword = keyword;
      params.search_type = 'name';
    }
    const [d, warehouses] = await Promise.all([
      request('GET', '/api/v3/mpsku/list/search_product_list', { params }),
      getShopWarehouses().catch(() => [])
    ]);
    const list = (d && d.products) || [];
    return {
      products: list.map((p) => normalizeProduct(p, warehouses)),
      cursor: (d && d.page_info && d.page_info.cursor) || '',
      total: (d && d.page_info && d.page_info.total) || 0
    };
  },

  // Dữ liệu đầy đủ của 1 sản phẩm trong shop (dùng cho ảnh/video).
  async getRaw(itemId) {
    try {
      const d = await request('GET', '/api/v3/product/get_product_info', {
        params: { product_id: itemId, is_draft: false }
      });
      return (d && (d.product_info || d.item || d.product || d)) || null;
    } catch (e) {
      console.warn(`[Shopee API] getRaw lỗi SP #${itemId}:`, e.message);
      return null;
    }
  },

  async getInfo(itemId) {
    const raw = await this.getRaw(itemId);
    return raw ? normalizeProduct(raw) : null;
  },

  // Tồn kho theo từng kho của nhiều sản phẩm (API trang Kênh Người Bán dùng: get_product_stock).
  // Trả Map itemId -> [{ modelId, stock, locations: [{ locationId, stock }] }], đã bỏ kho đang tắt.
  async getStock(itemIds) {
    const out = new Map();
    const ids = [...new Set((itemIds || []).map(Number).filter(Boolean))];
    const parse = (d) => {
      for (const it of (d && d.stock_list) || []) {
        out.set(Number(it.item_id), (it.model_stock_list || []).map((ms) => {
          const info = ms.seller_stock_info || {};
          const locations = (info.location_detail || [])
            .filter((l) => l && l.location_id && !l.is_disabled)
            .map((l) => ({ locationId: String(l.location_id), stock: Math.max(0, parseInt(l.sellable_stock, 10) || 0) }));
          const stock = locations.length
            ? locations.reduce((a, l) => a + l.stock, 0)
            : Math.max(0, parseInt(info.sellable_stock ?? ms.total_available_stock, 10) || 0);
          return { modelId: Number(ms.model_id) || 0, stock, locations };
        }));
      }
    };
    for (let i = 0; i < ids.length; i += 20) {
      const part = ids.slice(i, i + 20);
      try {
        parse(await request('GET', '/api/v3/product/get_product_stock/', { params: { item_id_list: part.join(',') } }));
      } catch (e) {
        // Phòng khi Shopee không nhận nhiều sản phẩm một lần: hỏi lần lượt từng sản phẩm
        for (const id of part) {
          try { parse(await request('GET', '/api/v3/product/get_product_stock/', { params: { item_id_list: id } })); } catch (_) { /* bỏ qua SP lỗi */ }
          await sleep(120);
        }
      }
    }
    return out;
  },

  // Cập nhật tồn kho lên Shopee giống hệt trang "Sửa sản phẩm" của Kênh Người Bán:
  // POST update_product_info với product_info chỉ có model_list – mọi phân loại gửi { id, tier_index },
  // phân loại đổi tồn kho thêm stock_setting_list gồm các kho có số thay đổi { location_id, sellable_stock }.
  // newStock: số (SP 1 kho) hoặc [{ locationId, stock }] (đa kho). Trả về tồn kho đọc lại sau khi lưu.
  async updateStock(itemId, modelId, newStock, applyAllModels = false) {
    const raw = await this.getRaw(itemId);
    const models = (raw && Array.isArray(raw.model_list)) ? raw.model_list : [];
    if (!models.length) throw new Error('Không đọc được phân loại của sản phẩm #' + itemId + ' trên Shopee');

    const idOf = (m) => Number(m.id ?? m.model_id ?? 0);
    let targets;
    if (applyAllModels) targets = new Set(models.map(idOf));
    else {
      const hit = models.find((m) => idOf(m) === Number(modelId));
      if (hit) targets = new Set([idOf(hit)]);
      else if (models.length === 1) targets = new Set([idOf(models[0])]); // SP không phân loại: modelId 0
      else throw new Error('Không tìm thấy phân loại #' + modelId + ' của sản phẩm #' + itemId);
    }

    const wanted = Array.isArray(newStock)
      ? new Map(newStock.map((s) => [String(s.locationId || s.location_id || ''), Math.max(0, parseInt(s.stock, 10) || 0)]).filter(([k]) => k))
      : null;
    const single = Array.isArray(newStock) ? 0 : Math.max(0, parseInt(newStock, 10) || 0);

    let changedCount = 0;
    const modelList = models.map((m) => {
      const entry = { id: idOf(m), tier_index: m.tier_index || [0] };
      if (!targets.has(entry.id)) return entry;
      const cur = (m.stock_detail && Array.isArray(m.stock_detail.seller_stock_info)) ? m.stock_detail.seller_stock_info : [];
      let list = [];
      if (!cur.length || (cur.length === 1 && !cur[0].location_id)) {
        // Shop 1 kho không có mã kho: Shopee chỉ gửi sellable_stock
        const old = cur.length ? Number(cur[0].sellable_stock) || 0 : null;
        const val = wanted ? [...wanted.values()].reduce((a, b) => a + b, 0) : single;
        if (old !== val) list = [{ sellable_stock: val }];
      } else if (wanted) {
        list = cur
          .filter((l) => wanted.has(String(l.location_id)) && wanted.get(String(l.location_id)) !== (Number(l.sellable_stock) || 0))
          .map((l) => ({ location_id: String(l.location_id), sellable_stock: wanted.get(String(l.location_id)) }));
      } else {
        // Nhập 1 số cho SP có kho: ghi vào kho đang bật đầu tiên
        const first = cur.find((l) => !l.is_disabled) || cur[0];
        if ((Number(first.sellable_stock) || 0) !== single) list = [{ location_id: String(first.location_id), sellable_stock: single }];
      }
      if (list.length) {
        entry.stock_setting_list = list;
        changedCount++;
      }
      return entry;
    });

    if (changedCount) {
      try {
        await request('POST', '/api/v3/product/update_product_info', {
          body: { product_id: Number(itemId), product_info: { model_list: modelList }, is_draft: false }
        });
      } catch (err) {
        const msg = err.message || '';
        if (/lock|khoá|khóa/i.test(msg)) throw new Error('Shopee đang khoá tồn kho sản phẩm này (thường do đang chạy chiến dịch/Flash Sale): ' + msg);
        throw err;
      }
    }

    // Đợi 350ms để replica / cache của Shopee kịp cập nhật trước khi đọc lại
    await sleep(350);

    // Đọc lại tồn kho từ Shopee để chắc chắn đã lưu đúng
    const after = await this.getStock([itemId]).catch(() => new Map());
    return { changed: changedCount, stock: after.get(Number(itemId)) || null };
  },

  // Sửa SKU sản phẩm (modelId = null) hoặc SKU một phân loại, rồi đọc lại để chắc Shopee đã lưu.
  async updateSku(itemId, modelId, sku) {
    const value = String(sku || '').trim();
    const idOf = (m) => Number(m.id ?? m.model_id ?? 0);
    const skuOfModel = (raw) => {
      const list = (raw && raw.model_list) || [];
      return list.find((m) => idOf(m) === Number(modelId)) || (list.length === 1 ? list[0] : null);
    };
    const raw = await this.getRaw(itemId);
    const updates = {};
    if (modelId === null) {
      updates.parent_sku = value;
    } else {
      const target = skuOfModel(raw);
      if (!target) throw new Error('Không tìm thấy phân loại #' + modelId + ' của sản phẩm #' + itemId);
      updates.model_list = raw.model_list.map((m) => {
        const entry = { id: idOf(m), tier_index: m.tier_index || [0] };
        if (idOf(m) === idOf(target)) entry.sku = value;
        return entry;
      });
    }
    await this.updateFullProduct(itemId, updates);
    await sleep(350);
    const after = await this.getRaw(itemId);
    const saved = modelId === null ? after?.parent_sku : skuOfModel(after)?.sku;
    if (String(saved ?? '').trim() !== value) throw new Error('Shopee chưa lưu SKU mới, hãy kiểm tra lại sản phẩm');
    return value;
  },

  // Cập nhật thông tin chi tiết sản phẩm lên Shopee (Tên SP, Mô tả, SKU, Kích thước, Cân nặng, Phân loại, Tồn kho, Giá)
  async updateFullProduct(itemId, updates) {
    const productInfo = {};
    if (updates.name !== undefined) productInfo.name = updates.name;
    if (updates.parent_sku !== undefined) productInfo.parent_sku = updates.parent_sku;
    if (updates.description !== undefined) productInfo.description = updates.description;
    if (updates.weight !== undefined) productInfo.weight = updates.weight;
    if (updates.dimension !== undefined) productInfo.dimension = updates.dimension;
    if (updates.days_to_ship !== undefined) productInfo.days_to_ship = updates.days_to_ship;
    if (updates.model_list !== undefined) productInfo.model_list = updates.model_list;

    try {
      const res = await request('POST', '/api/v3/product/update_product_info', {
        body: { product_id: Number(itemId), product_info: productInfo, is_draft: false }
      });
      return res;
    } catch (err) {
      const msg = err.message || '';
      if (/lock|khoá|khóa/i.test(msg)) {
        throw new Error('Shopee đang khoá sản phẩm này (thường do đang tham gia chiến dịch / Flash Sale): ' + msg);
      }
      throw err;
    }
  }
};

const LIST_TYPES = { all: 0, next: 1, current: 2, end: 3 };

export const flashSale = {
  // Khung giờ Flash Sale còn trống của shop trong `days` ngày tới.
  async timeSlots(days = 30) {
    const now = Math.floor(Date.now() / 1000);
    const d = await request('GET', '/api/marketing/v4/shop_flash_sale/time_slot/', {
      params: { start_time: now, end_time: now + days * 86400 }
    });
    const list = Array.isArray(d) ? d : (d && (d.time_slot_list || d.list)) || [];
    return list
      .map((s) => ({ id: Number(s.timeslot_id ?? s.time_slot_id), start: Number(s.start_time), end: Number(s.end_time) }))
      .sort((a, b) => a.start - b.start);
  },

  async list(type = 'next', offset = 0, limit = 50) {
    const d = await request('GET', '/api/marketing/v4/shop_flash_sale/list/', {
      params: { offset, limit, type: LIST_TYPES[type] ?? 0 }
    });
    return (d && d.flash_sale_list) || [];
  },

  async listAll(type = 'next', maxPages = 10) {
    const all = [];
    for (let page = 0; page < maxPages; page++) {
      const part = await this.list(type, page * 50, 50);
      all.push(...part);
      if (part.length < 50) break;
    }
    return all;
  },

  async get(flashSaleId) {
    return request('GET', '/api/marketing/v4/shop_flash_sale/get/', {
      params: { flash_sale_id: Number(flashSaleId) }
    });
  },

  // Toàn bộ sản phẩm/phân loại đang có trong 1 Flash Sale.
  async getItems(flashSaleId) {
    const items = [];
    const itemInfo = [];
    let modelInfo = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const d = await request('GET', '/api/marketing/v4/shop_flash_sale/batch_items/get', {
        params: { flash_sale_id: Number(flashSaleId), offset, limit: 100 }
      });
      const part = (d && d.items) || [];
      items.push(...part);
      itemInfo.push(...((d && d.item_info) || []));
      if (d && d.model_info_str) {
        try { modelInfo = modelInfo.concat(JSON.parse(d.model_info_str) || []); } catch (e) { /* bỏ qua */ }
      }
      if (part.length < 100) break;
    }
    return { items, itemInfo, modelInfo };
  },

  async create(timeSlotId) {
    return request('POST', '/api/marketing/v4/shop_flash_sale/set/', {
      body: { time_slot_id: Number(timeSlotId) }
    });
  },

  // Xoá FS sắp diễn ra: Shopee dùng chính lệnh set/ với status 0 (DELETED; 1 = bật, 2 = tắt)
  async remove(flashSaleId, timeSlotId) {
    return request('POST', '/api/marketing/v4/shop_flash_sale/set/', {
      body: { flash_sale_id: Number(flashSaleId), time_slot_id: Number(timeSlotId), status: 0 }
    });
  },

  async setItems(flashSaleId, items) {
    return request('POST', '/api/marketing/v4/shop_flash_sale/batch_items/set/', {
      body: { flash_sale_id: Number(flashSaleId), items, use_global_category: true }
    });
  },

  async setSequence(flashSaleId, displaySequenceList) {
    return request('POST', '/api/marketing/v4/shop_flash_sale/item_seq/', {
      body: { flash_sale_id: Number(flashSaleId), display_sequence_list: displaySequenceList }
    });
  }
};
