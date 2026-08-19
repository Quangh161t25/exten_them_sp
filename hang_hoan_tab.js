(function() {
    const btnRead = document.getElementById('btn-read-hang-hoan');
    const tbody = document.getElementById('hang-hoan-tbody');
    
    // Filters state
    let activeInfoFilter = 'ALL'; // 'ALL', 'NO', 'YES'
    let activeReturnFilter = 'ALL'; // 'ALL', 'YES', 'NO'
    let allHangHoanData = [];

    function ensureContentScriptInjected(tabId, callback) {
        chrome.tabs.sendMessage(tabId, { type: "PING" }, (res) => {
            if (chrome.runtime.lastError || !res || !res.ok) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ["xlsx.full.min.js", "content.js"]
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Lỗi inject script:", chrome.runtime.lastError);
                        callback(false);
                    } else {
                        setTimeout(() => callback(true), 150);
                    }
                });
            } else {
                callback(true);
            }
        });
    }

    function renderHangHoanTable() {
        if (!tbody) return;
        
        let filtered = allHangHoanData;

        // 1. Filter by hhBhInfo (Thẻ thông tin)
        if (activeInfoFilter === 'NO') {
            filtered = filtered.filter(item => !item.hhBhInfo || item.hhBhInfo === 'Chưa có');
        } else if (activeInfoFilter === 'YES') {
            filtered = filtered.filter(item => item.hhBhInfo && item.hhBhInfo !== 'Chưa có');
        }

        // 2. Filter by returnId (Mã YC trả hàng)
        if (activeReturnFilter === 'YES') {
            filtered = filtered.filter(item => item.returnId && item.returnId !== '-');
        } else if (activeReturnFilter === 'NO') {
            filtered = filtered.filter(item => !item.returnId || item.returnId === '-');
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 10px; text-align: center; color: #64748b;">Không tìm thấy dữ liệu phù hợp.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        filtered.forEach(item => {
            const tr = document.createElement('tr');
            
            // hhBhStyle formatting
            let hhBhStyle = "";
            let hhBhContent = item.hhBhInfo || 'Chưa có';
            if (hhBhContent !== 'Chưa có') {
                hhBhStyle = "background-color: #e2f0d9; color: #155724; font-weight: bold; border: 1px solid #c3e6cb; padding: 2px 6px; border-radius: 4px; display: inline-block; font-size: 10px;";
            } else {
                hhBhStyle = "color: #7f8c8d; font-style: italic;";
            }

            // Render product images and names
            let productsHtml = '';
            if (item.products && item.products.length > 0) {
                item.products.forEach(p => {
                    productsHtml += `
                        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
                            ${p.imgUrl ? `<img src="${p.imgUrl}" style="width: 40px; height: 40px; border-radius: 4px; border: 1px solid #cbd5e1; object-fit: cover; flex: 0 0 auto;">` : ''}
                            <div style="font-weight: 500; font-size: 11px; line-height: 1.3; color: #1e293b; word-break: break-word;">${p.pName || '-'}</div>
                        </div>
                    `;
                });
            } else {
                productsHtml = '-';
            }

            tr.innerHTML = `
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 220px; min-width: 220px;">${productsHtml}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 500; width: 110px; min-width: 110px; vertical-align: top;">${item.orderId || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569; width: 110px; min-width: 110px; vertical-align: top;">${item.returnId || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569; width: 130px; min-width: 130px; vertical-align: top;">${item.trackingNum || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 10px; line-height: 1.3; width: 180px; min-width: 180px; vertical-align: top;">${item.returnLogistics || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; width: 200px; min-width: 200px; vertical-align: top;"><span style="${hhBhStyle}">${hhBhContent}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Set up filter buttons click handlers
    function setupFilterButtons() {
        const infoBtns = document.querySelectorAll('.filter-info-btn');
        const returnBtns = document.querySelectorAll('.filter-return-btn');

        infoBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                infoBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'white';
                    b.style.color = '#475569';
                });
                btn.classList.add('active');
                btn.style.background = '#6366f1';
                btn.style.color = 'white';

                activeInfoFilter = btn.getAttribute('data-val');
                renderHangHoanTable();
            });
        });

        returnBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                returnBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'white';
                    b.style.color = '#475569';
                });
                btn.classList.add('active');
                btn.style.background = '#6366f1';
                btn.style.color = 'white';

                activeReturnFilter = btn.getAttribute('data-val');
                renderHangHoanTable();
            });
        });
    }

    // Initialize button listeners
    setupFilterButtons();

    if (btnRead) {
        btnRead.addEventListener('click', () => {
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 10px; text-align: center; color: #64748b;">Đang đọc dữ liệu từ trang Shopee...</td></tr>';

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                if (!activeTab) {
                    tbody.innerHTML = '<tr><td colspan="6" style="padding: 10px; text-align: center; color: red;">Không tìm thấy tab hoạt động.</td></tr>';
                    return;
                }

                // Check URL
                const url = activeTab.url || "";
                const isReturnPage = url.includes("banhang.shopee.vn/portal/sale/return") || url.includes("banhang.shopee.vn/portal/sale/order");

                if (!isReturnPage) {
                    tbody.innerHTML = `<tr><td colspan="6" style="padding: 10px; text-align: center; color: red;">
                        Bạn chưa ở đúng trang Hàng hoàn của Shopee.<br>
                        <button id="btn-open-return-page" type="button" style="margin-top: 8px; padding: 6px 12px; background: #ee4d2d; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Mở trang Hàng Hoàn Shopee</button>
                    </td></tr>`;

                    const btnOpen = document.getElementById('btn-open-return-page');
                    if (btnOpen) {
                        btnOpen.addEventListener('click', () => {
                            chrome.tabs.create({ url: 'https://banhang.shopee.vn/portal/sale/returnrefundcancel', active: true });
                        });
                    }
                    return;
                }

                ensureContentScriptInjected(activeTab.id, (injected) => {
                    if (!injected) {
                        tbody.innerHTML = '<tr><td colspan="6" style="padding: 10px; text-align: center; color: red;">Không thể kết nối tới trang Shopee (Lỗi tự động tiêm script). Vui lòng F5 tải lại trang Shopee và thử lại.</td></tr>';
                        return;
                    }

                    chrome.tabs.sendMessage(activeTab.id, { type: "READ_HANG_HOAN_LIST" }, (res) => {
                        if (chrome.runtime.lastError) {
                            tbody.innerHTML = '<tr><td colspan="6" style="padding: 10px; text-align: center; color: red;">Không thể kết nối tới trang Shopee. Hãy tải lại trang Shopee Trả hàng/Hoàn tiền và thử lại.</td></tr>';
                            return;
                        }

                        if (res && res.ok && res.data) {
                            allHangHoanData = res.data;
                            renderHangHoanTable();
                        } else {
                            tbody.innerHTML = `<tr><td colspan="6" style="padding: 10px; text-align: center; color: red;">Lỗi đọc dữ liệu: ${res && res.error ? res.error : 'Không phản hồi'}</td></tr>`;
                        }
                    });
                });
            });
        });
    }
})();
