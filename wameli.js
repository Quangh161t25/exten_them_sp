(async function() {
    // Only run on the specific path
    if (!window.location.href.includes('phanmem.wameli.vn/admin/product')) return;

    // Create the button
    const btn = document.createElement('button');
    btn.textContent = 'Tải về DS_SP';
    btn.style.position = 'fixed';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = '9999';
    btn.style.padding = '10px 15px';
    btn.style.background = '#4CAF50';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '5px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = 'bold';
    
    document.body.appendChild(btn);

    // Get DS_SP data to check existing
    let existingIds = new Set();
    let headers = [];
    
    async function loadDsSp() {
        return new Promise(resolve => {
            chrome.runtime.sendMessage({ type: "FETCH_DS_SP" }, (res) => {
                if (res && res.ok && res.values && res.values.length > 0) {
                    headers = res.values[0];
                    const idColIndex = headers.indexOf('id_sp_ct') !== -1 ? headers.indexOf('id_sp_ct') : 0;
                    for (let i = 1; i < res.values.length; i++) {
                        if (res.values[i][idColIndex]) {
                            existingIds.add(res.values[i][idColIndex].toString().trim());
                        }
                    }
                }
                resolve();
            });
        });
    }

    // Function to parse the price safely
    function parsePrice(text) {
        if (!text) return '';
        // "1.249.500 đ" -> "1249500"
        return text.replace(/\D/g, '');
    }

    // Color rows based on existence in DS_SP
    function highlightRows() {
        // Find all rows (class row0 or row1 usually, or just any tr inside tbody)
        const trs = document.querySelectorAll('table tr');
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 10) {
                // Find "Mã" column
                const maNode = tds[4]?.querySelector('a') || tds[4];
                const ma = maNode ? maNode.textContent.trim() : '';
                if (ma) {
                    if (!existingIds.has(ma)) {
                        tr.style.backgroundColor = 'lightgreen'; // Chưa có
                    } else {
                        tr.style.backgroundColor = ''; // Có rồi
                    }
                }
            }
        });
    }

    // Initial check
    await loadDsSp();
    highlightRows();

    // Button click handler
    btn.addEventListener('click', async () => {
        btn.textContent = 'Đang đẩy...';
        btn.disabled = true;

        // Reload the DS_SP sheet just in case it was updated by someone else
        await loadDsSp();
        
        const trs = document.querySelectorAll('table tr');
        let newRows = [];
        
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 10) {
                const maNode = tds[4]?.querySelector('a') || tds[4];
                const tenNode = tds[5]?.querySelector('a') || tds[5];
                
                const ma = maNode ? maNode.textContent.trim() : '';
                const ten = tenNode ? tenNode.textContent.trim() : '';
                const gia_nhap = parsePrice(tds[6]?.textContent);
                const gia_ban = parsePrice(tds[7]?.textContent);
                const gia_dong_goi = parsePrice(tds[8]?.textContent);
                const gia_thap_nhat = parsePrice(tds[9]?.textContent);

                // Only push if not already in DS_SP
                if (ma && !existingIds.has(ma)) {
                    // Create an array with enough columns based on headers
                    let rowData = new Array(Math.max(headers.length, 7)).fill('');
                    
                    const id_sp_ct_idx = headers.indexOf('id_sp_ct') !== -1 ? headers.indexOf('id_sp_ct') : 0;
                    const id_sp_idx = headers.indexOf('id_sp') !== -1 ? headers.indexOf('id_sp') : 1;
                    const ten_sp_idx = headers.indexOf('ten_sp') !== -1 ? headers.indexOf('ten_sp') : 2;
                    const gia_nhap_ncc_idx = headers.indexOf('gia_nhap_ncc') !== -1 ? headers.indexOf('gia_nhap_ncc') : 3;
                    const gia_ban_idx = headers.indexOf('gia_ban') !== -1 ? headers.indexOf('gia_ban') : 4;
                    const gia_dong_goi_idx = headers.indexOf('gia_dong_goi') !== -1 ? headers.indexOf('gia_dong_goi') : 5;
                    const gia_thap_nhat_idx = headers.indexOf('gia_thap_nhat') !== -1 ? headers.indexOf('gia_thap_nhat') : 6;
                    
                    rowData[id_sp_ct_idx] = ma;
                    rowData[id_sp_idx] = ma.length >= 4 ? ma.substring(0, 4) : ma;
                    rowData[ten_sp_idx] = ten;
                    rowData[gia_nhap_ncc_idx] = gia_nhap;
                    rowData[gia_ban_idx] = gia_ban;
                    rowData[gia_dong_goi_idx] = gia_dong_goi;
                    rowData[gia_thap_nhat_idx] = gia_thap_nhat;
                    
                    newRows.push(rowData);
                    existingIds.add(ma); // Add to local cache immediately
                }
            }
        });

        if (newRows.length > 0) {
            chrome.runtime.sendMessage({ 
                type: "APPEND_DS_SP", 
                rowDatas: newRows 
            }, (res) => {
                if (chrome.runtime.lastError) {
                    alert('Lỗi: ' + chrome.runtime.lastError.message + ' (Vui lòng tải lại trang web - F5)');
                    btn.textContent = 'Tải về DS_SP';
                    btn.disabled = false;
                    return;
                }
                if (res && res.ok) {
                    alert('Đã đẩy ' + newRows.length + ' sản phẩm mới về sheet DS_SP!');
                    highlightRows(); // Update UI colors
                } else {
                    alert('Lỗi: ' + (res?.error || 'Không xác định'));
                }
                btn.textContent = 'Tải về DS_SP';
                btn.disabled = false;
            });
        } else {
            alert('Không có sản phẩm mới nào để đẩy (hoặc tất cả đã có trong sheet).');
            btn.textContent = 'Tải về DS_SP';
            btn.disabled = false;
        }
    });

    // Optionally handle DOM changes if table loads dynamically
    const observer = new MutationObserver((mutations) => {
        let changed = false;
        for (let m of mutations) {
            if (m.addedNodes.length > 0) {
                changed = true;
                break;
            }
        }
        if (changed) highlightRows();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
