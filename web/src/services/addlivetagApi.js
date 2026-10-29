// API dữ liệu thị trường Shopee của data.addlivetag.com (bắt buộc API Key từ 01/10/2026).
// Key chỉ lưu trên máy người dùng (localStorage), không ghi vào mã nguồn.
const BASE = 'https://data.addlivetag.com';
const KEY_STORE = 'addlivetagApiKey';

export function getApiKey() {
    try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; }
}
export function setApiKey(key) {
    try { key ? localStorage.setItem(KEY_STORE, key.trim()) : localStorage.removeItem(KEY_STORE); } catch { /* bỏ qua */ }
}

async function call(path, params) {
    const key = getApiKey();
    if (!key) throw new Error('Chưa nhập API Key addlivetag');
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    const res = await fetch(`${BASE}${path}?${qs}`, {headers: {'X-API-Key': key}});
    let data;
    try { data = await res.json(); } catch { throw new Error(`HTTP ${res.status}`); }
    if (res.status === 429) throw new Error('Gọi quá nhanh, chờ một phút rồi thử lại');
    if (!res.ok || data.status === 'error') throw new Error(data.message || `HTTP ${res.status}`);
    return data;
}

// Nhận item_id hoặc link shopee.vn (…-i.shop.item hoặc /product/shop/item).
export function parseItemId(input) {
    const s = String(input || '').trim();
    if (/^\d{5,}$/.test(s)) return s;
    const m = s.match(/-i\.\d+\.(\d+)/) || s.match(/\/product\/\d+\/(\d+)/);
    return m ? m[1] : '';
}

export const searchMarket = (q, opts = {}) => call('/search/market.php', {q, ...opts});
export const fetchProduct = (itemId) => call('/product-data/product-data.php', {item_id: itemId});
export const fetchPriceHistory = (itemIds, days = 90) =>
    call('/price-tracking/history.php', {item_ids: [].concat(itemIds).join(','), days, type: 'price', changes_only: 1});
export const fetchShopProducts = (shopId, page = 1) =>
    call('/offers/shop-products.php', {shopId, page, limit: 50});
