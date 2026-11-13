// Lớp gọi API Kênh Người Bán Shopee (cùng cách với ShopeeFlashSaleTool).
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

// Hàm này được inject và chạy trong tab Shopee: upload 1 ảnh (base64) dạng multipart.
function pageUpload(url, base64, mime, fileName) {
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type: mime }), fileName);
    return fetch(url, { method: 'POST', credentials: 'include', body: fd })
      .then(async (r) => ({ status: r.status, text: await r.text() }))
      .catch((e) => ({ status: 0, text: '', error: String(e) }));
  } catch (e) {
    return Promise.resolve({ status: 0, text: '', error: String(e) });
  }
}

async function getSpcCds() {
  const c = await chrome.cookies.get({ url: SELLER_ORIGIN, name: 'SPC_CDS' });
  return (c && c.value) || '';
}

async function buildUrl(path, params = {}) {
  const spc = await getSpcCds();
  const qs = new URLSearchParams({ SPC_CDS: spc, SPC_CDS_VER: '2', version: '3.1.0' });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  return `${SELLER_ORIGIN}${path}?${qs.toString()}`;
}

function parseResult(result) {
  if (!result) throw new Error('Không chạy được request trong tab Shopee');
  if (result.error) throw new Error('Lỗi mạng: ' + result.error);
  if (result.status === 401 || result.status === 403) {
    throw new Error(`Shopee từ chối (HTTP ${result.status}). Hãy đăng nhập lại Kênh Người Bán.`);
  }
  try {
    return JSON.parse(result.text);
  } catch (e) {
    throw new Error(`Phản hồi không phải JSON (HTTP ${result.status})`);
  }
}

// Trả về nguyên JSON của Shopee (không ném lỗi khi code != 0) – dùng khi cần đọc user_message.
export async function requestRaw(method, path, { params = {}, body = null } = {}) {
  const tabId = await getSellerTab();
  const url = await buildUrl(path, params);
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pageFetch,
    args: [url, method, body]
  });
  return parseResult(injection && injection.result);
}

export async function request(method, path, opts = {}) {
  const json = await requestRaw(method, path, opts);
  const code = json.code ?? json.error ?? 0;
  if (code) {
    const err = new Error(json.user_message || json.message || json.msg || json.err_msg || `Shopee trả lỗi code ${code}`);
    err.code = code;
    err.response = json;
    throw err;
  }
  return json.data;
}

// ---------- API ----------

export async function getShopInfo() {
  const d = await request('GET', '/api/selleraccount/shop_info/');
  return { name: (d && (d.name || d.shop_name)) || '', shopId: d && (d.shop_id || d.shopid) };
}

export const products = {
  async search({ keyword = '', searchType = 'name', pageSize = 10 } = {}) {
    const params = { page_number: 1, page_size: pageSize };
    if (keyword) {
      params.keyword = keyword;
      params.search_type = searchType;
    }
    const d = await request('GET', '/api/v3/mpsku/list/search_product_list', { params });
    return ((d && d.products) || []).map((p) => ({
      itemId: Number(p.id ?? p.item_id ?? p.product_id),
      name: p.name || '',
      cover: p.cover_image || (Array.isArray(p.images) && p.images[0]) || ''
    }));
  },

  // Chỉ gửi các trường cần đổi; trả về nguyên JSON để đọc user_message.
  async updateRaw(productId, productInfo) {
    return requestRaw('POST', '/api/v3/product/update_product_info/', {
      body: { is_draft: false, product_id: productId, product_info: productInfo }
    });
  },

  async getRaw(itemId) {
    const d = await request('GET', '/api/v3/product/get_product_info', {
      params: { product_id: itemId, is_draft: false }
    });
    return (d && d.product_info) || null;
  },

  // Thuộc tính bắt buộc / tuỳ chọn của 1 ngành hàng.
  async attributeTree(categoryId) {
    const d = await request('GET', '/api/v3/category/get_attribute_tree/', {
      params: { category_ids: categoryId }
    });
    const list = (d && d.list) || [];
    return (list[0] && (list[0].attribute_tree || list[0].attributes)) || [];
  },

  async create(productInfo) {
    return requestRaw('POST', '/api/v3/product/create_product_info', {
      body: { is_draft: false, product_info: productInfo }
    });
  }
};

export const shop = {
  // Đơn vị vận chuyển của shop: [{ channel_id, name, enabled, is_mask_channel, ... }]
  async channels() {
    const d = await request('GET', '/api/v3/logistics/get_channel_list/');
    return (d && d.list) || [];
  },

  // Kho của shop: [{ warehouse_id, warehouse_name, location_id, in_holiday_mode, ... }]
  async warehouses() {
    const d = await request('GET', '/api/v3/product/get_shop_warehouse/');
    return (d && d.warehouse_list) || [];
  }
};

// Upload ảnh (base64 không kèm tiền tố data:) -> mã ảnh Shopee
export async function uploadImage(base64, mime = 'image/jpeg', fileName = 'image.jpg') {
  const tabId = await getSellerTab();
  const url = await buildUrl('/api/v3/general/upload_image/');
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pageUpload,
    args: [url, base64, mime, fileName]
  });
  const json = parseResult(injection && injection.result);
  const id = json && json.data && (json.data.resource_id || json.data.image_id);
  if (!id) throw new Error(json.user_message || json.message || 'Upload ảnh thất bại');
  return id;
}
