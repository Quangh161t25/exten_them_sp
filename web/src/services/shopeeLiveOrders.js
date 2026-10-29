// Đọc đơn Shopee trực tiếp (không qua Google Sheets) cho module "Chờ lấy hàng".
//
// Có 2 cách chạy web:
//   1) Mở ngay trong extension: chrome-extension://<id>/dist/index.html  -> gọi background qua sendMessage thường.
//   2) Deploy lên web (Vercel/Netlify/GitHub Pages/tên miền riêng...): trang web gọi background qua
//      chrome.runtime.sendMessage(EXTENSION_ID, ...) — cần extension khai báo "externally_connectable"
//      đúng domain trong manifest.json (đã khai báo sẵn localhost + các host phổ biến).
// Cả 2 cách đều dùng lại đúng đường API của AutoIn (extension/autoin/background.js: bgFetchIndex + bgFetchCards)
// nên vẫn cần 1 tab banhang.shopee.vn đang mở và đã đăng nhập Kênh Người Bán.
//
// Trạng thái (order_to_ship_status trong tab "Chờ lấy hàng" - order_list_tab 300):
//   1 = Chưa xử lý
//   2 = Đã xử lý
//   0 = cả hai

export const SHOPEE_SELLER_URL = 'https://banhang.shopee.vn/';

// Các ID extension có thể gặp trên máy người dùng (mỗi thư mục unpacked có 1 ID riêng):
//   - dcpmlfofoocofipfgogcbfccoclodobb : D:\tải xuống 2\exten them sp12 - Sao chép  (bản đang phát triển)
//   - fmioeaffjfappcimopogpnfmbbelbnh : D:\tải xuống 2\exten them sp12              (bản cài trước đó)
// Web sẽ thử lần lượt, ID nào trả lời thì dùng. Có thể chỉ định tay bằng ?ext=<id>.
export const EXTENSION_IDS = [
    'dcpmlfofoocofipfgogcbfccoclodobb',
    'fmioeaffjfappcimopogpnfmbbelbnh'
];

// Giữ tên cũ cho code/README đang tham chiếu.
export const EXTENSION_ID = EXTENSION_IDS[0];

const LAST_ID_KEY = 'choLayHang.extensionId';

export const STAGE_LABELS = {
    1: 'Chưa xử lý',
    2: 'Đã xử lý'
};

// ID đang dùng được (nhớ trong phiên + localStorage để lần sau khỏi dò lại).
let activeId = '';

function isId(v) {
    return typeof v === 'string' && /^[a-p]{32}$/.test(v);
}

function candidateIds() {
    const out = [];
    try {
        const fromUrl = new URLSearchParams(window.location.search).get('ext');
        if (isId(fromUrl)) out.push(fromUrl);
    } catch (_) { /* ignore */ }
    try {
        const saved = localStorage.getItem(LAST_ID_KEY);
        if (isId(saved) && !out.includes(saved)) out.push(saved);
    } catch (_) { /* ignore */ }
    EXTENSION_IDS.forEach((id) => { if (!out.includes(id)) out.push(id); });
    return out;
}

function rememberId(id) {
    activeId = id;
    try { localStorage.setItem(LAST_ID_KEY, id); } catch (_) { /* ignore */ }
}

// Trang đang chạy bên trong extension (chrome-extension://...).
export function isExtensionPage() {
    try {
        return typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);
    } catch (_) {
        return false;
    }
}

// Có gọi được background không: trang extension (id) hoặc web đã deploy (chỉ có sendMessage).
export function hasExtensionBridge() {
    try {
        return typeof chrome !== 'undefined'
            && !!chrome.runtime
            && typeof chrome.runtime.sendMessage === 'function';
    } catch (_) {
        return false;
    }
}

function bridgeHint() {
    if (isExtensionPage()) {
        return 'Hãy Reload extension ở chrome://extensions rồi tải lại trang này.';
    }
    let origin = '';
    try { origin = window.location.origin; } catch (_) { /* ignore */ }
    return `Kiểm tra: (1) extension đã cài và đang bật; (2) tên miền ${origin || 'này'} đã có trong `
        + '"externally_connectable" của manifest.json; (3) đã bấm Reload extension.';
}

// Gửi 1 message tới 1 ID cụ thể (dùng cho web đã deploy).
function sendToId(id, message) {
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage(id, message, (res) => {
                const err = chrome.runtime && chrome.runtime.lastError;
                if (err) {
                    const text = err.message || '';
                    const e = new Error(text);
                    if (/Invalid extension id/i.test(text)) {
                        e.code = 'not-installed';
                        e.message = `Không thấy extension ${id} trên trình duyệt này.`;
                    } else if (/Receiving end does not exist|Could not establish connection/i.test(text)) {
                        e.code = 'not-updated';
                        e.message = 'Extension chưa cập nhật. Hãy bấm ↻ Reload ở chrome://extensions (hoặc thoát hẳn Chrome rồi mở lại).';
                    } else {
                        e.code = 'unknown';
                    }
                    reject(e);
                    return;
                }
                if (!res) {
                    const e = new Error('Background không phản hồi. ' + bridgeHint());
                    e.code = 'unknown';
                    reject(e);
                    return;
                }
                resolve(res);
            });
        } catch (e) {
            const text = (e && e.message) || String(e);
            const err = new Error(text);
            if (/Invalid extension id/i.test(text)) {
                err.code = 'not-installed';
                err.message = `Không thấy extension ${id} trên trình duyệt này.`;
            } else {
                err.code = 'unknown';
            }
            reject(err);
        }
    });
}

function sendMessage(message) {
    if (isExtensionPage()) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage(message, (res) => {
                    const err = chrome.runtime && chrome.runtime.lastError;
                    if (err) {
                        const e = new Error(err.message || 'Không gọi được background của extension.');
                        e.code = /Receiving end does not exist|Could not establish connection/i.test(err.message || '')
                            ? 'not-updated' : 'unknown';
                        reject(e);
                        return;
                    }
                    if (!res) {
                        reject(new Error('Background không phản hồi. ' + bridgeHint()));
                        return;
                    }
                    resolve(res);
                });
            } catch (e) {
                reject(new Error((e && e.message) || String(e)));
            }
        });
    }
    const id = activeId || candidateIds()[0];
    return sendToId(id, message);
}

// Tìm ra ID extension đang chạy (thử lần lượt các ID đã biết).
// Lỗi trả về được ưu tiên theo mức độ hữu ích: "cần reload" > "chưa cài" > lỗi khác.
async function resolveExtensionId() {
    if (isExtensionPage()) return 'self';
    if (activeId) return activeId;
    const tried = [];
    for (const id of candidateIds()) {
        try {
            const res = await sendToId(id, { type: 'autoin-ping' });
            if (res && res.ok) {
                rememberId(id);
                return id;
            }
            tried.push({ id, code: 'unknown', message: 'Extension không phản hồi.' });
        } catch (e) {
            tried.push({ id, code: (e && e.code) || 'unknown', message: (e && e.message) || String(e) });
        }
    }
    const pick = tried.find((e) => e.code === 'not-updated')
        || tried.find((e) => e.code === 'unknown')
        || tried[tried.length - 1];
    const err = new Error(pick ? pick.message : ('Không tìm thấy extension đang chạy. ' + bridgeHint()));
    err.code = pick ? pick.code : 'not-installed';
    err.tried = tried.map((e) => e.id.slice(0, 8) + '…: ' + e.code).join(' · ');
    throw err;
}

// Kiểm tra nhanh xem extension có trả lời không (dùng để hiện trạng thái kết nối).
export async function pingExtension() {
    if (!hasExtensionBridge()) {
        return { ok: false, code: 'no-bridge', error: 'Trình duyệt này chưa có extension (hoặc trang chưa được cấp quyền gọi extension).' };
    }
    try {
        const id = await resolveExtensionId();
        return { ok: true, id: id === 'self' ? '' : id, at: Date.now() };
    } catch (e) {
        return {
            ok: false,
            code: (e && e.code) || 'unknown',
            error: (e && e.message) || String(e),
            tried: (e && e.tried) || ''
        };
    }
}

/**
 * Lấy danh sách đơn "Chờ lấy hàng" từ Shopee.
 * @param {{ status?: 0|1|2, limit?: number }} options
 * @returns {Promise<{ rows: Array, total: number, at: number, errors: string[] }>}
 */
export async function fetchChoLayHang({ status = 0, limit = 200 } = {}) {
    if (!hasExtensionBridge()) {
        throw new Error('Chưa kết nối được extension. ' + bridgeHint());
    }

    // Đảm bảo đã biết ID extension đang chạy trước khi gửi yêu cầu nặng.
    // Nếu chưa tìm ra ID nào thì báo đúng lỗi (chưa cài / cần reload) thay vì gửi mù.
    if (!activeId) await resolveExtensionId();
    const res = await sendMessage({ type: 'autoin-cho-lay-hang', status, limit });
    if (!res) {
        throw new Error('Background không phản hồi. ' + bridgeHint());
    }
    if (res.error) {
        throw new Error(res.error);
    }
    // ok === false nghĩa là 1 nhóm trạng thái lỗi: vẫn trả về phần đọc được + danh sách lỗi.
    return {
        rows: Array.isArray(res.rows) ? res.rows : [],
        total: Number(res.total) || 0,
        at: Number(res.at) || Date.now(),
        errors: Array.isArray(res.errors) ? res.errors : []
    };
}

// Mở (hoặc chuyển sang) tab Kênh Người Bán — điều kiện bắt buộc để background gọi được API Shopee.
// Trong trang extension thì chuyển tab; trên web đã deploy thì mở tab mới (không có quyền chrome.tabs).
export async function openShopeeSeller() {
    if (!hasExtensionBridge()) return false;
    const canUseTabs = isExtensionPage() && chrome.tabs && typeof chrome.tabs.create === 'function';
    if (!canUseTabs) {
        try {
            window.open(SHOPEE_SELLER_URL, '_blank', 'noopener');
            return true;
        } catch (_) {
            return false;
        }
    }
    try {
        const tabs = await chrome.tabs.query({ url: 'https://banhang.shopee.vn/*' });
        if (tabs.length) {
            const target = tabs[0];
            await chrome.tabs.update(target.id, { active: true });
            if (target.windowId != null) {
                await chrome.windows.update(target.windowId, { focused: true }).catch(() => {});
            }
            return true;
        }
        await chrome.tabs.create({ url: SHOPEE_SELLER_URL });
        return true;
    } catch (_) {
        return false;
    }
}
