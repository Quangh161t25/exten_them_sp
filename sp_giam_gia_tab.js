(function() {
    // Variables
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-sp-giam-gia"]');
    const tbody = document.getElementById('sp-giam-gia-tbody');
    const thead = document.getElementById('sp-giam-gia-thead');
    const searchInput = document.getElementById('sp-giam-gia-search');

    let allData = [];
    let headers = [];
    let dataLoaded = false;

    // Reload whenever the tab is clicked to ensure it is always synchronized
    if (tabBtn) {
        tabBtn.addEventListener('click', () => {
            loadSpGiamGiaData();
        });
    }

    // Load immediately when the popup opens
    loadSpGiamGiaData();

    function loadSpGiamGiaData() {
        if (!tbody) return;
        tbody.innerHTML = '<tr><td style="padding: 10px; text-align: center; color: #64748b;">Đang tải dữ liệu từ sheet SP_GIAM_GIA...</td></tr>';
        
        chrome.storage.local.get(["maGian", "dhHoanTextValue"], (storageRes) => {
            const currentMaGian = (storageRes.maGian || storageRes.dhHoanTextValue || "").trim().toLowerCase();

            chrome.runtime.sendMessage({ type: "FETCH_SP_GIAM_GIA" }, (res) => {
                if (res && res.ok && res.values && res.values.length > 0) {
                    const rows = res.values;
                    headers = rows[0].map(h => String(h || "").trim());
                    
                    // Find Gian index
                    let gianIdx = headers.findIndex(h => h.toLowerCase() === 'gian' || h.toLowerCase() === 'mã gian' || h.toLowerCase() === 'ma gian' || h.toLowerCase() === 'ma_gian');
                    if (gianIdx === -1) {
                        gianIdx = headers.findIndex(h => h.toLowerCase().includes('gian'));
                    }
                    if (gianIdx === -1) gianIdx = 8; // Column I (index 8) is 'gian'

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

                        // At least one column must be present to count as a valid row
                        if (row.some(c => c)) {
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
                    tbody.innerHTML = `<tr><td style="padding: 10px; text-align: center; color: red;">Lỗi tải dữ liệu hoặc sheet trống. (Kiểm tra lại tên sheet "SP_GIAM_GIA")</td></tr>`;
                }
            });
        });
    }

    function renderTable() {
        if (!dataLoaded) return;

        let filtered = allData;

        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        if (query) {
            filtered = filtered.filter(row => {
                // Search across all columns
                return row.some(cellValue => cellValue.toLowerCase().includes(query));
            });
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

                // Add copy buttons for SKU column (Index 5 - Column F in sheet) or Product Name column (Index 1 - Column B)
                if (cellIndex === 5 || cellIndex === 1) {
                    if (cellValue) {
                        cellHtml = `<div style="display:flex; align-items:center; gap:6px;">
                            <div>${cellHtml}</div>
                            <button class="copy-cell-btn" data-text="${cellValue.replace(/"/g, '&quot;')}" style="padding: 2px 4px; font-size: 10px; cursor: pointer; border: 1px solid #cbd5e1; border-radius: 3px; background: #fff; min-width: 24px;" title="Copy">📋</button>
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

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-cell-btn');
        if (btn) {
            const text = btn.getAttribute('data-text');
            if (text) {
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '✅';
                    setTimeout(() => { btn.innerHTML = originalText; }, 1000);
                }).catch(err => console.error('Copy failed', err));
            }
        }
    });
})();
