import { CONFIG } from '../config/sheetsConfig.js';
import { getAccessToken } from './googleAuth.js';
import { colName } from '../utils/formatters.js';

let sheetTitleToIdCache = null;
let spBoSetCache = null;
let spShopeeDataCache = null;
let spShopeeGianMapCache = null;
let isFetchingSpShopee = false;
let webSpImageMapCache = null;
let isFetchingWebSpImages = false;

function normalizeRow(row, tabName) {
    const headers = CONFIG.tabs[tabName]?.headers || [];
    const source = Array.isArray(row) ? row : [];
    return headers.map((_, idx) => String(source[idx] ?? '').trim());
}

export async function getSheetIdByTitle(title) {
    if (!sheetTitleToIdCache) {
        const token = await getAccessToken();
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}?fields=sheets.properties`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Không đọc được metadata sheet.');
        }
        const data = await res.json();
        sheetTitleToIdCache = new Map((data.sheets || []).map(sheet => [sheet.properties.title, sheet.properties.sheetId]));
    }
    if (!sheetTitleToIdCache.has(title)) {
        throw new Error(`Không tìm thấy sheet '${title}'.`);
    }
    return sheetTitleToIdCache.get(title);
}

export async function ensureSheetExists(sheetTitle, headers = []) {
    try {
        const token = await getAccessToken();
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}?fields=sheets.properties`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const titles = (data.sheets || []).map(s => s.properties.title);
        if (!titles.includes(sheetTitle)) {
            const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}:batchUpdate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{ addSheet: { properties: { title: sheetTitle } } }]
                })
            });
            if (addRes.ok && headers.length > 0) {
                const endCol = colName(headers.length - 1);
                await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${sheetTitle}!A1:${endCol}1?valueInputOption=USER_ENTERED`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: [headers] })
                });
            }
            sheetTitleToIdCache = null;
        }
    } catch (err) {
        console.warn(`Lỗi khi kiểm tra/tạo sheet '${sheetTitle}':`, err);
    }
}

export async function ensureDhSheetExists() {
    await ensureSheetExists('DH', CONFIG.tabs['DH']?.headers || []);
}

export async function ensureSpBoSheetExists() {
    await ensureSheetExists('SP_BO', ['id_sp_con', 'id_sp', 'ten_sp']);
}

export async function ensureSpGiamGiaSheetExists() {
    await ensureSheetExists('SP_GIAM_GIA', CONFIG.tabs['SP_GIAM_GIA']?.headers || []);
}

export async function fetchSheetDataWithFallback(tabName, onRetryNotice = null) {
    const tabConfig = CONFIG.tabs[tabName];
    if (!tabConfig) throw new Error(`Không tìm thấy cấu hình tab '${tabName}'`);

    const cacheKey = 'sheet_cache_' + tabName;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${encodeURIComponent(tabConfig.range)}`;

    let token = await getAccessToken();
    let res = null;
    let data = null;
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
        try {
            res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            data = await res.json();

            if (res.status === 429 || (data.error && (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED'))) {
                retries++;
                const waitSec = retries * 3;
                const noticeMsg = `Google API đang bận (HTTP 429 Limit Exceeded). Tự động thử lại (${retries}/${maxRetries}) sau ${waitSec} giây...`;
                if (onRetryNotice) onRetryNotice(noticeMsg);

                // Fallback to localStorage immediately on 429
                try {
                    const cachedStr = localStorage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        if (cached && Array.isArray(cached.values) && cached.values.length > 0) {
                            if (!tabConfig || !cached.values[0] || cached.values[0].length >= (tabConfig.headers?.length || 0)) {
                                console.warn(`[CACHE 429 Fallback] Dùng dữ liệu bộ nhớ đệm LocalStorage cho '${tabName}' (${cached.values.length} dòng).`);
                                return cached.values;
                            }
                        }
                    }
                } catch (_) {}

                await new Promise(r => setTimeout(r, waitSec * 1000));
                continue;
            }

            if (res.ok && data) {
                const valuesArr = Array.isArray(data.values) ? data.values : [];
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: Date.now(),
                        values: valuesArr
                    }));
                } catch (_) { /* ignore quota full */ }
                return valuesArr;
            }
            break;
        } catch (err) {
            retries++;
            if (retries >= maxRetries) break;
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // LocalStorage fallback if API fails or rate-limited
    try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            if (cached && Array.isArray(cached.values) && cached.values.length > 0) {
                if (!tabConfig || !cached.values[0] || cached.values[0].length >= (tabConfig.headers?.length || 0)) {
                    console.warn(`[CACHE] Dùng dữ liệu bộ nhớ đệm LocalStorage cho '${tabName}' (${cached.values.length} dòng).`);
                    return cached.values;
                }
            }
        }
    } catch (_) {}

    if (data && data.error) {
        if (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED') {
            throw new Error("Google Sheets API đang bị quá tải lượt truy cập (HTTP 429 Rate Limit Exceeded). Vui lòng đợi 30-60 giây và tải lại trang!");
        }
        throw new Error(data.error.message || `Lỗi Google API (${data.error.code || res?.status || 'Unknown'})`);
    }
    throw new Error(`Không thể kết nối đến Google Sheets cho '${tabName}'.`);
}

export async function writeRecordRow(tabName, row, sheetRow, startColIndex = 0) {
    const token = await getAccessToken();
    const cleanRow = normalizeRow(row, tabName).slice(startColIndex);
    const rowNum = Number(sheetRow);
    if (!rowNum || rowNum < 2) throw new Error('Không xác định được dòng cần cập nhật.');

    const headers = CONFIG.tabs[tabName]?.headers || [];
    const startColStr = colName(startColIndex);
    const endColStr = colName(headers.length - 1);

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${tabName}!${startColStr}${rowNum}:${endColStr}${rowNum}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [cleanRow] })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Cập nhật dòng thất bại.');
    }
}

export async function batchWriteRecordRows(tabName, items) {
    if (!items || !items.length) return;
    const headers = CONFIG.tabs[tabName]?.headers || [];
    const endCol = colName(headers.length - 1);

    const CHUNK_SIZE = 400;
    for (let c = 0; c < items.length; c += CHUNK_SIZE) {
        const chunk = items.slice(c, c + CHUNK_SIZE);
        const data = chunk.map(item => ({
            range: `${tabName}!A${item.sheetRow}:${endCol}${item.sheetRow}`,
            values: [normalizeRow(item.row, tabName)]
        }));

        let token = await getAccessToken();
        let retries = 0;
        const maxRetries = 4;
        let success = false;
        while (retries < maxRetries) {
            try {
                const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values:batchUpdate`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data })
                });
                if (res.status === 429) {
                    retries++;
                    const waitMs = retries * 2500;
                    await new Promise(r => setTimeout(r, waitMs));
                    token = await getAccessToken();
                    continue;
                }
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || 'Cập nhật dòng dữ liệu thất bại.');
                }
                success = true;
                break;
            } catch (err) {
                retries++;
                if (retries >= maxRetries) throw err;
                await new Promise(r => setTimeout(r, retries * 1500));
            }
        }
    }
}

export async function writeDsSpGiaDang(sheetRow, giaDang) {
    const rowNum = Number(sheetRow);
    if (!rowNum || rowNum < 2) throw new Error('Không xác định được dòng cần cập nhật.');
    const token = await getAccessToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/DS_SP!L${rowNum}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[giaDang]] })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Cập nhật giá đăng thất bại.');
    }
}

export async function batchWriteDsSpGiaDang(items) {
    if (!items || !items.length) return;
    const CHUNK_SIZE = 500;
    for (let c = 0; c < items.length; c += CHUNK_SIZE) {
        const chunk = items.slice(c, c + CHUNK_SIZE);
        const data = chunk.map(item => ({
            range: `DS_SP!L${item.sheetRow}`,
            values: [[item.giaDang]]
        }));

        let token = await getAccessToken();
        let retries = 0;
        const maxRetries = 4;
        while (retries < maxRetries) {
            try {
                const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values:batchUpdate`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data })
                });
                if (res.status === 429) {
                    retries++;
                    const waitMs = retries * 2000;
                    await new Promise(r => setTimeout(r, waitMs));
                    token = await getAccessToken();
                    continue;
                }
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || 'Cập nhật hàng loạt giá đăng thất bại.');
                }
                break;
            } catch (err) {
                retries++;
                if (retries >= maxRetries) throw err;
                await new Promise(r => setTimeout(r, retries * 1500));
            }
        }
    }
}

export async function deleteSheetRows(sheetTitle, sheetRows) {
    const sorted = [...new Set(sheetRows.filter(row => Number(row) >= 2))].sort((a, b) => b - a);
    if (!sorted.length) return;

    // Group contiguous rows into blocks from high to low
    const blocks = [];
    let curEnd = sorted[0];
    let curStart = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === curStart - 1) {
            curStart = sorted[i];
        } else {
            blocks.push({ start: curStart, end: curEnd });
            curStart = sorted[i];
            curEnd = sorted[i];
        }
    }
    blocks.push({ start: curStart, end: curEnd });

    const token = await getAccessToken();
    const sheetId = await getSheetIdByTitle(sheetTitle);
    const requests = blocks.map(b => ({
        deleteDimension: {
            range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: b.start - 1,
                endIndex: b.end
            }
        }
    }));

    const CHUNK_SIZE = 100;
    for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
        const chunk = requests.slice(i, i + CHUNK_SIZE);
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: chunk })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Xóa dòng thất bại.');
        }
    }
}

export async function appendRecordRows(tabName, rows) {
    if (!rows || !rows.length) return;
    const CHUNK_SIZE = 500;
    for (let c = 0; c < rows.length; c += CHUNK_SIZE) {
        const chunk = rows.slice(c, c + CHUNK_SIZE);
        const token = await getAccessToken();
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${tabName}!A2:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: chunk.map(r => normalizeRow(r, tabName)) })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Thêm dòng thất bại.');
        }
    }
}

export async function appendRowsToSheet(sheetTitle, rows) {
    if (!rows || !rows.length) return;
    const token = await getAccessToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${sheetTitle}!A2:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Thêm dòng vào sheet '${sheetTitle}' thất bại.`);
    }
}

export async function clearCurrentTabData(tabName) {
    const token = await getAccessToken();
    const headers = CONFIG.tabs[tabName]?.headers || [];
    const endCol = colName(headers.length - 1);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${tabName}!A2:${endCol}:clear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Xóa dữ liệu cũ thất bại.');
    }
}

export async function fetchSpBoSet(force = false) {
    if (spBoSetCache && !force) return spBoSetCache;
    try {
        const token = await getAccessToken();
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/SP_BO!A2:C`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            spBoSetCache = new Set();
            return spBoSetCache;
        }
        const data = await res.json();
        const rows = data.values || [];
        spBoSetCache = new Set();
        rows.forEach(r => {
            const idCon = String(r[0] || '').trim().toUpperCase();
            const idSp = String(r[1] || '').trim().toUpperCase();
            if (idCon) spBoSetCache.add(idCon);
            else if (idSp) spBoSetCache.add(idSp);
        });
        return spBoSetCache;
    } catch (e) {
        console.warn('Không đọc được SP_BO:', e);
        spBoSetCache = new Set();
        return spBoSetCache;
    }
}

export async function fetchSpShopeeData(force = false) {
    if (spShopeeDataCache && spShopeeDataCache.length > 0 && !force) return spShopeeDataCache;
    if (isFetchingSpShopee) return [];
    isFetchingSpShopee = true;
    try {
        const token = await getAccessToken();
        let targetSheetTitle = null;
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}?fields=sheets(properties(title))`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (metaRes.ok) {
            const metaData = await metaRes.json();
            const titles = (metaData.sheets || []).map(s => s.properties?.title).filter(Boolean);
            targetSheetTitle = titles.find(t => t.toLowerCase().includes('sp_shopee') || t.toLowerCase().includes('shopee'));
            if (!targetSheetTitle) {
                targetSheetTitle = titles.find(t => t.toLowerCase().includes('web_sp') || t.toLowerCase().includes('ds_sp'));
            }
        }
        if (!targetSheetTitle) targetSheetTitle = 'sp_shopee';

        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${encodeURIComponent(targetSheetTitle + '!A2:Z')}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            spShopeeDataCache = data.values || [];
            spShopeeGianMapCache = null;
        } else {
            spShopeeDataCache = [];
            spShopeeGianMapCache = null;
        }
    } catch (err) {
        console.warn('Lỗi khi tải sp_shopee:', err);
        spShopeeDataCache = [];
        spShopeeGianMapCache = null;
    } finally {
        isFetchingSpShopee = false;
    }
    return spShopeeDataCache;
}

export function buildSpShopeeGianMap(spShopeeData = spShopeeDataCache, customButtons = []) {
    const data = spShopeeData || [];
    if (!data.length) return new Map();
    const map = new Map();

    data.forEach(r => {
        if (!Array.isArray(r) || !r.length) return;

        let gianVal = String(r[11] || '').trim().toUpperCase();
        if (!gianVal) {
            for (const bText of customButtons) {
                const normB = bText.trim().toUpperCase();
                if (r.some(cell => String(cell || '').trim().toUpperCase() === normB)) {
                    gianVal = normB;
                    break;
                }
            }
        }

        if (!gianVal) return;

        if (!map.has(gianVal)) {
            map.set(gianVal, new Set());
        }
        const set = map.get(gianVal);

        r.forEach(cell => {
            const str = String(cell || '').trim().toUpperCase();
            if (!str || str.length < 2) return;

            if (str.length <= 35) set.add(str);
            if (str.length >= 4) {
                set.add(str.substring(0, 4));
            }

            const parts = str.split(/[\s\-_\/,\.]+/);
            parts.forEach(p => {
                if (p.length >= 3 && p.length <= 15) {
                    set.add(p);
                    if (p.length >= 4) set.add(p.substring(0, 4));
                }
            });
        });
    });

    return map;
}

export function isBtnInSpShopee(btnText, row, gianMap) {
    if (!gianMap || gianMap.size === 0) return false;
    const normBtn = String(btnText || '').trim().toUpperCase();
    if (!normBtn) return false;

    const valF = String(row[1] || row[5] || '').trim().toUpperCase();
    const valE = String(row[0] || row[4] || '').trim().toUpperCase();
    const rawIdSp = valF ? valF : valE;
    if (!rawIdSp) return false;

    const prefixF4 = valF.substring(0, 4);
    const prefixE4 = valE.substring(0, 4);

    for (const [gianKey, idSet] of gianMap.entries()) {
        if (gianKey === normBtn || gianKey.includes(normBtn) || normBtn.includes(gianKey)) {
            if (idSet.has(prefixF4) || idSet.has(prefixE4) || idSet.has(valF) || idSet.has(valE) || idSet.has(rawIdSp)) {
                return true;
            }
        }
    }

    return false;
}

export async function fetchWebSpImageMap(force = false) {
    if (webSpImageMapCache && !force) return webSpImageMapCache;
    if (isFetchingWebSpImages) return webSpImageMapCache || new Map();
    isFetchingWebSpImages = true;

    try {
        const token = await getAccessToken();
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/WEB_SP!C2:H`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        let webRows = [];
        if (res.ok) {
            const data = await res.json();
            webRows = data.values || [];
        }

        const map = new Map();
        if (Array.isArray(webRows)) {
            webRows.forEach(r => {
                if (!Array.isArray(r) || !r.length) return;
                const sku = String(r.length >= 8 ? r[2] : (r[0] || '')).trim();
                const rawAnh = String(r.length >= 8 ? r[7] : (r[5] || '')).trim();

                if (!sku || !rawAnh) return;
                const key = sku.substring(0, 4).toUpperCase();
                if (!map.has(key)) {
                    const firstImg = rawAnh.split('|')[0].trim().split(',')[0].trim();
                    if (firstImg && (firstImg.startsWith('http://') || firstImg.startsWith('https://'))) {
                        map.set(key, firstImg);
                    }
                }
            });
        }
        webSpImageMapCache = map;
    } catch (err) {
        console.warn('Lỗi khi tải ảnh WEB_SP:', err);
        if (!webSpImageMapCache) webSpImageMapCache = new Map();
    } finally {
        isFetchingWebSpImages = false;
    }

    return webSpImageMapCache;
}

// Danh sách mã gian ở cột "gian" của sheet CAI_DAT (dùng làm nút copy mặc định ở Tính giá)
export async function fetchCaiDatGians() {
    const token = await getAccessToken();
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}?fields=sheets(properties(title))`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!metaRes.ok) return [];
    const titles = ((await metaRes.json()).sheets || []).map(s => s.properties?.title).filter(Boolean);
    const title = titles.find(t => t.toLowerCase() === 'cai_dat');
    if (!title) return [];
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${encodeURIComponent(title + '!A1:Z')}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const values = (await res.json()).values || [];
    const ci = (values[0] || []).findIndex(h => String(h).trim().toLowerCase() === 'gian');
    if (ci < 0) return [];
    return [...new Set(values.slice(1).map(r => String(r[ci] || '').trim().toUpperCase()).filter(Boolean))];
}
