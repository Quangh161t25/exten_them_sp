(function() {
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-ds-sp"]');
    const table = document.getElementById('ds-sp-table');
    const theadRow = table ? table.querySelector('thead tr') : null;
    const tbody = document.getElementById('ds-sp-tbody');
    const filter1Container = document.getElementById('filter-1-char-container');
    const filter2Container = document.getElementById('filter-2-char-container');
    const searchInput = document.getElementById('ds-sp-search');

    let allData = [];
    let tableColumns = [];
    let dataLoaded = false;
    let activeFilter1 = 'ALL';
    let activeFilter2 = 'ALL';
    const prefixes1 = new Set();
    const prefixes2 = new Set();

    if (tabBtn) {
        tabBtn.addEventListener('click', () => {
            loadDsSpData();
        });
    }

    loadDsSpData();

    function getColspan() {
        return Math.max(tableColumns.length || 23, 1);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeHeader(value) {
        return String(value || '').trim().toLowerCase();
    }

    function renderHeaders(headersRaw) {
        if (!theadRow) return;
        theadRow.innerHTML = tableColumns.map((column) => {
            const minWidth = column.key === 'virtual_sku' ? '170px' : (normalizeHeader(column.label) === 'ten_sp' ? '150px' : '80px');
            return `<th style="padding: 8px; border-bottom: 2px solid #e2e8f0; font-weight: bold; color: #1e293b; white-space: nowrap; min-width: ${minWidth}; max-width: ${minWidth};">${escapeHtml(column.label)}</th>`;
        }).join('');
    }

    function formatNumber(numStr) {
        if (!numStr) return '0';
        let num = parseInt(String(numStr).replace(/\D/g, ''), 10);
        if (isNaN(num)) return numStr;
        return num.toLocaleString('vi-VN');
    }

    function loadDsSpData(forceRefresh = false) {
        if (!tbody) return;

        // Nếu đã có dữ liệu trong biến toàn cục và không bắt buộc làm mới, hiển thị ngay
        if (dataLoaded && allData.length > 0 && !forceRefresh) {
            renderFilters();
            renderTable();
            return;
        }

        tbody.innerHTML = `<tr><td colspan="${getColspan()}" style="padding: 10px; text-align: center; color: #64748b;">Đang tải dữ liệu từ sheet TINH_GIA...</td></tr>`;

        chrome.storage.local.get(["maGian", "dhHoanTextValue", "dsSpCache_data", "dsSpCache_time"], (storageRes) => {
            const rawMaGian = (storageRes.maGian || storageRes.dhHoanTextValue || '').trim();
            const currentMaGian = rawMaGian.toLowerCase();
            const virtualGianCode = (rawMaGian || 'BCE').toUpperCase();

            // Nếu có bộ nhớ đệm cache còn hiệu lực (dưới 10 phút), dùng ngay không cần tải lại API
            const cacheTime = storageRes.dsSpCache_time || 0;
            const isCacheValid = Date.now() - cacheTime < 10 * 60 * 1000;
            if (storageRes.dsSpCache_data && isCacheValid && !forceRefresh) {
                const cached = storageRes.dsSpCache_data;
                allData = cached.allData || [];
                tableColumns = cached.tableColumns || [];
                prefixes1.clear();
                (cached.prefixes1 || []).forEach(p => prefixes1.add(p));
                prefixes2.clear();
                (cached.prefixes2 || []).forEach(p => prefixes2.add(p));

                if (tableColumns.length > 0) {
                    renderHeaders();
                }
                dataLoaded = true;
                renderFilters();
                renderTable();
                return;
            }

            const fetchTinhGiaPromise = new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'FETCH_TINH_GIA' }, (res) => {
                    resolve(res || { ok: false, error: 'Không nhận được phản hồi từ tiện ích. Vui lòng tải lại trang (F5).' });
                });
            });

            const fetchShopeePromise = new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'FETCH_SP_SHOPEE' }, (res) => {
                    resolve(res || { ok: false, error: 'Không nhận được phản hồi từ tiện ích. Vui lòng tải lại trang (F5).' });
                });
            });

            const fetchTestPromise = new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'FETCH_TEST_SHEET' }, (res) => {
                    resolve(res || { ok: false, values: [] });
                });
            });

            Promise.all([fetchTinhGiaPromise, fetchShopeePromise, fetchTestPromise]).then(([tinhGiaRes, shopeeRes, testRes]) => {
                if (tinhGiaRes && tinhGiaRes.ok && tinhGiaRes.values && tinhGiaRes.values.length > 0) {
                    const tinhGiaRows = tinhGiaRes.values;
                    const headersRaw = tinhGiaRows[0].map((h, index) => String(h || '').trim() || `COL_${index + 1}`);
                    const headers = headersRaw.map(normalizeHeader);

                    const hiddenHeaders = new Set(['gia_nhap_ncc', 'gia_dong_goi']);
                    tableColumns = headersRaw
                        .map((label, index) => ({
                            key: `col_${index}`,
                            label,
                            index,
                            virtual: false
                        }))
                        .filter(column => !hiddenHeaders.has(normalizeHeader(column.label)));
                    const tenSpColumnIndex = tableColumns.findIndex(column => normalizeHeader(column.label) === 'ten_sp');
                    const virtualColumn = { key: 'virtual_sku', label: 'COT_AO', virtual: true };
                    if (tenSpColumnIndex !== -1) {
                        tableColumns.splice(tenSpColumnIndex + 1, 0, virtualColumn);
                    } else {
                        tableColumns.push(virtualColumn);
                    }
                    renderHeaders(headersRaw);

                    let activeKeys = new Set();
                    if (shopeeRes && shopeeRes.ok && shopeeRes.values && shopeeRes.values.length > 0) {
                        const shopeeRows = shopeeRes.values;
                        const shopeeHeaders = shopeeRows[0].map(h => normalizeHeader(h));
                        const skuIdx = shopeeHeaders.findIndex(h => h === 'sku' || h === 'so sku phan loai hang (tuy chon)' || h === 'sku phan loai');
                        const productSkuIdx = 4; // Cột E (Index 4: SKU sản phẩm)
                        let gianIdx = shopeeHeaders.findIndex(h => h === 'gian' || h === 'ma gian' || h === 'ma_gian');
                        if (gianIdx === -1) gianIdx = 11;

                        for (let i = 1; i < shopeeRows.length; i++) {
                            const row = shopeeRows[i];
                            const rowGian = String(row[gianIdx] || '').trim().toLowerCase();
                            if (currentMaGian && rowGian !== currentMaGian) continue;

                            // Ưu tiên lấy SKU phân loại (Cột F), nếu trống thì lấy SKU sản phẩm (Cột E)
                            let skuValue = String(row[skuIdx !== -1 ? skuIdx : 5] || '').trim();
                            if (!skuValue) {
                                skuValue = String(row[productSkuIdx] || '').trim();
                            }
                            if (skuValue) activeKeys.add(skuValue.substring(0, 10).toUpperCase());
                        }
                    }

                    const id_sp_con_idx = headers.indexOf('id_sp_con') !== -1 ? headers.indexOf('id_sp_con') : (headers.indexOf('id_sp_ct') !== -1 ? headers.indexOf('id_sp_ct') : 0);
                    const id_sp_idx = headers.indexOf('id_sp') !== -1 ? headers.indexOf('id_sp') : 1;
                    const ten_sp_idx = headers.indexOf('ten_sp') !== -1 ? headers.indexOf('ten_sp') : 2;

                    let testAnhMap = {};
                    if (testRes && testRes.ok && testRes.values && testRes.values.length > 0) {
                        const testRows = testRes.values;
                        const testHeaders = testRows[0].map(h => String(h || "").trim().toLowerCase());
                        const sku_idx = testHeaders.indexOf('sku') !== -1 ? testHeaders.indexOf('sku') : 0;
                        let anh_idx = testHeaders.findIndex(h => h === 'anh' || h === 'ảnh' || h === 'hinh anh' || h === 'hình ảnh');
                        if (anh_idx === -1) anh_idx = 4;
                        
                        for (let i = 1; i < testRows.length; i++) {
                             const sku = String(testRows[i][sku_idx] || '').trim().toUpperCase();
                             let anh = String(testRows[i][anh_idx] || '').trim();
                             if (sku && anh) {
                                 anh = anh.split(/[\n,;]/)[0].trim();
                                 if (anh) testAnhMap[sku] = anh;
                             }
                        }
                    }

                    allData = [];
                    prefixes1.clear();
                    prefixes2.clear();

                    for (let i = 1; i < tinhGiaRows.length; i++) {
                        const rowValues = headersRaw.map((_, index) => String(tinhGiaRows[i][index] ?? '').trim());
                        const idCon = rowValues[id_sp_con_idx] || '';
                        if (idCon.length <= 5) continue;

                        const tenSp = rowValues[ten_sp_idx] || '';
                        if (idCon || tenSp) {
                            if (idCon.length >= 1) prefixes1.add(idCon.substring(0, 1).toUpperCase());
                            if (idCon.length >= 2) prefixes2.add(idCon.substring(0, 2).toUpperCase());

                            const virtualSku = `${idCon}-${virtualGianCode}-00-001-${tenSp}`;
                            allData.push({
                                row_values: rowValues,
                                id_sp_con: idCon,
                                id_sp: rowValues[id_sp_idx] || '',
                                ten_sp: tenSp,
                                virtual_sku: virtualSku,
                                isGreen: activeKeys.has(idCon.toUpperCase()),
                                anh_sp_con: testAnhMap[idCon.toUpperCase()] || null
                            });
                        }
                    }

                    // Lưu vào bộ nhớ đệm trình duyệt (chrome.storage.local) trong 10 phút
                    chrome.storage.local.set({
                        dsSpCache_data: {
                            allData,
                            tableColumns,
                            prefixes1: Array.from(prefixes1),
                            prefixes2: Array.from(prefixes2)
                        },
                        dsSpCache_time: Date.now()
                    });

                    dataLoaded = true;
                    renderFilters();
                    renderTable();
                } else {
                    tbody.innerHTML = `<tr><td colspan="${getColspan()}" style="padding: 10px; text-align: center; color: red;">Lỗi tải dữ liệu: ${escapeHtml(err || tinhGiaRes?.error || "Không thể đọc dữ liệu")}</td></tr>`;
                }
            }).catch(err => {
                tbody.innerHTML = `<tr><td colspan="${getColspan()}" style="padding: 10px; text-align: center; color: red;">Lỗi tải dữ liệu: ${escapeHtml(err || tinhGiaRes?.error || "Không thể đọc dữ liệu")}</td></tr>`;
            });
        });
    }

    function createFilterBtn(text, isActive, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.padding = '4px 8px';
        btn.style.fontSize = '11px';
        btn.style.fontWeight = 'bold';
        btn.style.border = '1px solid #d8dee8';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.minWidth = '28px';
        btn.style.width = 'auto';
        btn.style.minHeight = '24px';

        if (isActive) {
            btn.style.background = '#6366f1';
            btn.style.color = 'white';
            btn.style.borderColor = '#6366f1';
        } else {
            btn.style.background = 'white';
            btn.style.color = '#475569';
        }

        btn.addEventListener('click', onClick);
        return btn;
    }

    function renderFilters() {
        if (!filter1Container || !filter2Container) return;
        filter1Container.innerHTML = '';
        filter2Container.innerHTML = '';

        filter1Container.appendChild(createFilterBtn('Tat ca', activeFilter1 === 'ALL', () => {
            activeFilter1 = 'ALL';
            activeFilter2 = 'ALL';
            renderFilters();
            renderTable();
        }));

        Array.from(prefixes1).sort().forEach(p1 => {
            filter1Container.appendChild(createFilterBtn(p1, activeFilter1 === p1, () => {
                activeFilter1 = p1;
                activeFilter2 = 'ALL';
                renderFilters();
                renderTable();
            }));
        });

        filter2Container.appendChild(createFilterBtn('Tat ca', activeFilter2 === 'ALL', () => {
            activeFilter2 = 'ALL';
            renderFilters();
            renderTable();
        }));

        Array.from(prefixes2).sort().forEach(p2 => {
            if (activeFilter1 === 'ALL' || p2.startsWith(activeFilter1)) {
                filter2Container.appendChild(createFilterBtn(p2, activeFilter2 === p2, () => {
                    activeFilter2 = p2;
                    renderFilters();
                    renderTable();
                }));
            }
        });
    }

    function renderVirtualSkuCell(item) {
        const escapedVirtualSku = escapeHtml(item.virtual_sku);
        const escapedIdSp = escapeHtml(item.id_sp);
        return `
            <div style="max-width: 170px; max-height: 38px; overflow: hidden; line-height: 1.25; word-break: break-word;" title="${escapedVirtualSku}">${escapedVirtualSku}</div>
            <div style="display: flex; gap: 3px; margin-top: 3px; align-items: center;">
                <button class="copy-virtual-sku" data-value="${escapedVirtualSku}" style="width: auto !important; min-height: 16px; padding: 1px 4px; font-size: 8px; cursor: pointer; border: 1px solid #16a34a; border-radius: 3px; background: #dcfce7; color: #166534; font-weight: bold; line-height: 1.2;">Copy</button>
                <button class="fill-product-id" data-id="${escapedIdSp}" style="width: auto !important; min-height: 16px; padding: 1px 4px; font-size: 8px; cursor: pointer; border: 1px solid #6366f1; border-radius: 3px; background: #eef2ff; color: #4338ca; font-weight: bold; line-height: 1.2;">ID</button>
            </div>
        `;
    }

    function renderSourceCell(item, column) {
        const value = item.row_values[column.index] || '';
        const header = normalizeHeader(column.label);
        if (header === 'ten_sp') {
            const escapedName = escapeHtml(value);
            return `
                <div style="font-weight: 500; margin-bottom: 4px; width: 150px; max-height: 34px; overflow: hidden; line-height: 1.25; word-break: break-word;" title="${escapedName}">${escapedName}</div>
                <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                    <button class="search-btn search-shopee" data-name="${escapedName}" style="width: auto !important; padding: 2px 3px; font-size: 8px; cursor: pointer; border: 1px solid #ee4d2d; border-radius: 3px; background: #fee2e2; color: #ee4d2d; font-weight: bold; display: inline-block; line-height: 1;">Shopee</button>
                    <button class="search-btn search-google" data-name="${escapedName}" style="width: auto !important; padding: 2px 3px; font-size: 8px; cursor: pointer; border: 1px solid #4285f4; border-radius: 3px; background: #dbeafe; color: #4285f4; font-weight: bold; display: inline-block; line-height: 1;">Google</button>
                    <button class="search-btn search-youtube" data-name="${escapedName}" style="padding: 2px 4px; width: auto !important; font-size: 9px; cursor: pointer; border: 1px solid #ff0000; border-radius: 3px; background: #ffe4e6; color: #ff0000; font-weight: bold; display: inline-block; line-height: 1;">Youtube</button>
                    <button class="search-btn search-tiktok" data-name="${escapedName}" style="padding: 2px 4px; width: auto !important; font-size: 9px; cursor: pointer; border: 1px solid #010101; border-radius: 3px; background: #e2e8f0; color: #010101; font-weight: bold; display: inline-block; line-height: 1;">Tiktok</button>
                </div>
            `;
        }
        if (header === 'id_sp_con' || header === 'id_sp_ct') {
            const escapedIdCon = escapeHtml(value);
            let html = `<div>${escapedIdCon}</div>`;
            if (item.anh_sp_con) {
                 html += `<div style="margin-top: 5px;"><img src="${escapeHtml(item.anh_sp_con)}" style="max-width: 60px; max-height: 60px; border: 1px solid #ccc; border-radius: 4px; object-fit: contain;"></div>`;
            }
            return html;
        }
        return escapeHtml(value);
    }

    function parseSearchTokens(rawQuery) {
        if (!rawQuery) return [];
        let text = String(rawQuery).trim();
        if (!text) return [];

        if (/[,;|\n]/.test(text)) {
            return text.split(/[,;|\n]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
        }

        if (/\s+(?:và|hoặc|and|or|\+)\s+/i.test(text)) {
            return text.split(/\s+(?:và|hoặc|and|or|\+)\s+/i).map(t => t.trim().toLowerCase()).filter(Boolean);
        }

        return text.split(/\s+/).map(t => t.trim().toLowerCase()).filter(Boolean);
    }

    function renderTable() {
        if (!dataLoaded || !tbody) return;

        let filtered = allData;
        if (activeFilter2 !== 'ALL') {
            filtered = filtered.filter(item => item.id_sp_con.toUpperCase().startsWith(activeFilter2));
        } else if (activeFilter1 !== 'ALL') {
            filtered = filtered.filter(item => item.id_sp_con.toUpperCase().startsWith(activeFilter1));
        }

        const rawQuery = searchInput ? searchInput.value : '';
        const tokens = parseSearchTokens(rawQuery);
        const filterMode = document.querySelector('input[name="ds-sp-filter-mode"]:checked')?.value || 'OR';

        if (tokens.length > 0) {
            const checkMatch = (item, token) => {
                const idCon = String(item.id_sp_con || '').toLowerCase();
                const idCha = String(item.id_sp || '').toLowerCase();
                const vSku = String(item.virtual_sku || '').toLowerCase();
                if (idCon.includes(token) || idCha.includes(token) || vSku.includes(token)) return true;
                return (item.row_values || []).some(value => String(value || '').toLowerCase().includes(token));
            };

            if (filterMode === 'AND') {
                filtered = filtered.filter(item => tokens.every(token => checkMatch(item, token)));
            } else {
                // OR mode
                filtered = filtered.filter(item => tokens.some(token => checkMatch(item, token)));
            }
        }

        filtered.sort((a, b) => b.id_sp_con.localeCompare(a.id_sp_con));

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${getColspan()}" style="padding: 10px; text-align: center; color: #64748b;">Khong tim thay ket qua</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        filtered.forEach(item => {
            const tr = document.createElement('tr');
            if (item.isGreen) tr.style.backgroundColor = '#00FFFF';

            tr.innerHTML = tableColumns.map((column) => {
                const content = column.virtual ? renderVirtualSkuCell(item) : renderSourceCell(item, column);
                const minWidth = column.key === 'virtual_sku' ? '170px' : (normalizeHeader(column.label) === 'ten_sp' ? '150px' : '80px');
                return `<td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569; vertical-align: top; word-break: break-word; min-width: ${minWidth}; max-width: ${minWidth};">${content}</td>`;
            }).join('');
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }

    document.querySelectorAll('input[name="ds-sp-filter-mode"]').forEach(radio => {
        radio.addEventListener('change', renderTable);
    });

    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.copy-virtual-sku');
            if (copyBtn) {
                const value = copyBtn.getAttribute('data-value') || '';
                if (value) {
                    const showCopied = () => {
                        const oldText = copyBtn.textContent;
                        copyBtn.textContent = 'OK';
                        setTimeout(() => { copyBtn.textContent = oldText; }, 700);
                    };
                    const fallbackCopy = () => {
                        const tempInput = document.createElement('textarea');
                        tempInput.value = value;
                        document.body.appendChild(tempInput);
                        tempInput.select();
                        document.execCommand('copy');
                        tempInput.remove();
                        showCopied();
                    };
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(value).then(showCopied).catch(fallbackCopy);
                    } else {
                        fallbackCopy();
                    }
                }
                return;
            }

            const fillBtn = e.target.closest('.fill-product-id');
            if (fillBtn) {
                const idSp = fillBtn.getAttribute('data-id') || '';
                const productIdInput = document.getElementById('product-id');
                if (productIdInput && idSp) {
                    productIdInput.value = idSp;
                    productIdInput.dispatchEvent(new Event('input', { bubbles: true }));
                    productIdInput.dispatchEvent(new Event('change', { bubbles: true }));
                    const toolsTabBtn = document.querySelector('.tab-btn[data-tab="tab-tools"]');
                    if (toolsTabBtn) toolsTabBtn.click();
                }
                return;
            }

            const btn = e.target.closest('.search-btn');
            if (!btn) return;

            const name = btn.getAttribute('data-name');
            if (!name) return;

            let url = '';
            if (btn.classList.contains('search-shopee')) {
                url = `https://shopee.vn/search?keyword=${encodeURIComponent(name)}`;
            } else if (btn.classList.contains('search-google')) {
                url = `https://www.google.com/search?q=${encodeURIComponent(name)}`;
            } else if (btn.classList.contains('search-youtube')) {
                url = `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`;
            } else if (btn.classList.contains('search-tiktok')) {
                url = `https://www.tiktok.com/search?q=${encodeURIComponent(name)}`;
            }

            if (url) chrome.tabs.create({ url, active: true });
        });
    }
})();