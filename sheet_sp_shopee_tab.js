(function() {
    // Variables
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-sheet-sp-shopee"]');
    const tbody = document.getElementById('sheet-sp-shopee-tbody');
    const thead = document.getElementById('sheet-sp-shopee-thead');
    const searchInput = document.getElementById('sheet-sp-shopee-search');

    let allData = [];
    let headers = [];
    let dataLoaded = false;

    // Reload whenever the tab is clicked to ensure it is always synchronized
    if (tabBtn) {
        tabBtn.addEventListener('click', () => {
            loadSheetSpShopeeData();
        });
    }

    // Load immediately when the popup opens
    loadSheetSpShopeeData();

    function loadSheetSpShopeeData() {
        tbody.innerHTML = '<tr><td style="padding: 10px; text-align: center; color: #64748b;">Đang tải dữ liệu từ sheet SP_SHOPEE...</td></tr>';
        
        chrome.storage.local.get(["maGian", "dhHoanTextValue"], (storageRes) => {
            const currentMaGian = (storageRes.maGian || storageRes.dhHoanTextValue || "").trim().toLowerCase();

            chrome.runtime.sendMessage({ type: "FETCH_SP_SHOPEE" }, (res) => {
                if (res && res.ok && res.values && res.values.length > 0) {
                    const rows = res.values;
                    chrome.storage.local.set({ sp_shopee_cache_data: rows });
                    headers = rows[0].map(h => String(h || "").trim());
                    
                    // Find indices
                    window.sheetMaSpIdx = headers.findIndex(h => h.toLowerCase().includes('mã sản phẩm') || h.toLowerCase() === 'ma sp' || h.toLowerCase() === 'mã sp' || h.toLowerCase() === 'id');
                    window.sheetTenSpIdx = headers.findIndex(h => h.toLowerCase().includes('tên sản phẩm') || h.toLowerCase() === 'ten sp' || h.toLowerCase() === 'tên sp' || h.toLowerCase() === 'name');
                    
                    let gianIdx = headers.findIndex(h => h.toLowerCase() === 'gian' || h.toLowerCase() === 'mã gian' || h.toLowerCase() === 'ma gian' || h.toLowerCase() === 'ma_gian');
                    if (gianIdx === -1) gianIdx = 11; // default to Column L (index 11)

                    // Build the header HTML dynamically
                    let theadHtml = '<tr>';
                    headers.forEach(h => {
                        theadHtml += `<th style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 600;">${h}</th>`;
                    });
                    theadHtml += '</tr>';
                    thead.innerHTML = theadHtml;

                    allData = [];
                    // Load from bottom to top (newest first)
                    for (let i = rows.length - 1; i >= 1; i--) {
                        const row = rows[i];
                        
                        // Check if gian matches currentMaGian (if currentMaGian is set)
                        if (currentMaGian) {
                            const rowGian = String(row[gianIdx] || "").trim().toLowerCase();
                            if (rowGian !== currentMaGian) {
                                continue; // skip if doesn't match
                            }
                        }

                        // At least first column must be present to count as a valid row
                        if (row[0]) {
                            const rowData = [];
                            for(let j = 0; j < headers.length; j++) {
                                rowData.push(String(row[j] || '').trim());
                            }
                            allData.push(rowData);
                        }
                    }
                    
                    dataLoaded = true;
                    renderTable();
                } else {
                    tbody.innerHTML = '<tr><td style="padding: 10px; text-align: center; color: red;">Lỗi tải dữ liệu hoặc sheet trống. (Kiểm tra lại tên sheet "SP_SHOPEE")</td></tr>';
                }
            });
        });
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
        if (!dataLoaded) return;

        let filtered = allData;

        const rawQuery = searchInput ? searchInput.value : '';
        const tokens = parseSearchTokens(rawQuery);
        const filterMode = document.querySelector('input[name="sheet-sp-shopee-filter-mode"]:checked')?.value || 'OR';

        if (tokens.length > 0) {
            const checkMatch = (row, token) => {
                return row.some(cellValue => String(cellValue || '').toLowerCase().includes(token));
            };

            if (filterMode === 'AND') {
                filtered = filtered.filter(row => tokens.every(token => checkMatch(row, token)));
            } else {
                // OR mode
                filtered = filtered.filter(row => tokens.some(token => checkMatch(row, token)));
            }
        }

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${headers.length}" style="padding: 10px; text-align: center; color: #64748b;">Không tìm thấy kết quả</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        filtered.forEach(row => {
            const tr = document.createElement('tr');
            
            row.forEach((cellValue, cellIndex) => {
                let cellHtml = cellValue;
                // If value looks like an image link, render it as an image
                if (cellValue.startsWith('http') && (cellValue.match(/\.(jpeg|jpg|gif|png|webp)/i) || cellValue.includes('googleusercontent') || cellValue.includes('drive.google'))) {
                    cellHtml = `<img src="${cellValue}" style="max-width: 60px; max-height: 60px; object-fit: contain; border-radius: 4px;" alt="ảnh">`;
                } 
                // Truncate long text
                else if (cellValue.length > 80) {
                    let shortText = cellValue.substring(0, 80) + '...';
                    cellHtml = `<span title="${cellValue.replace(/"/g, '&quot;')}">${shortText}</span>`;
                }

                if (cellIndex === window.sheetMaSpIdx) {
                    const maSp = row[window.sheetMaSpIdx];
                    if (maSp) {
                        cellHtml = `<div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                            <div>${cellHtml}</div>
                            <button class="copy-ma-sp-btn" data-ma="${maSp.replace(/"/g, '&quot;')}" style="padding: 2px 4px; font-size: 10px; cursor: pointer; border: 1px solid #cbd5e1; border-radius: 3px; background: #fff; min-width: 24px;" title="Copy Mã Sản Phẩm">📋</button>
                        </div>`;
                    }
                } else if (cellIndex === window.sheetTenSpIdx) {
                    const tenSp = row[window.sheetTenSpIdx];
                    if (tenSp) {
                        cellHtml = `<div style="display:flex; align-items:center; gap:6px;">
                            <div>${cellHtml}</div>
                            <button class="copy-ma-sp-btn" data-ma="${tenSp.replace(/"/g, '&quot;')}" style="padding: 2px 4px; font-size: 10px; cursor: pointer; border: 1px solid #cbd5e1; border-radius: 3px; background: #fff; min-width: 24px;" title="Copy Tên Sản Phẩm">📋</button>
                        </div>`;
                    }
                }

                const td = document.createElement('td');
                td.style.cssText = "padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569; max-width: 200px; word-wrap: break-word;";
                td.innerHTML = cellHtml;
                tr.appendChild(td);
            });
            
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }

    document.querySelectorAll('input[name="sheet-sp-shopee-filter-mode"]').forEach(radio => {
        radio.addEventListener('change', renderTable);
    });

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-ma-sp-btn');
        if (btn) {
            const maSp = btn.getAttribute('data-ma');
            if (maSp) {
                navigator.clipboard.writeText(maSp).then(() => {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '✅';
                    setTimeout(() => { btn.innerHTML = originalText; }, 1000);
                }).catch(err => console.error('Copy failed', err));
            }
        }
    });
})();
