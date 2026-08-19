(function() {
    // Variables
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-test"]');
    const tabContent = document.getElementById('tab-test');
    const tbody = document.getElementById('test-tbody');
    const searchInput = document.getElementById('test-search');

    let allData = [];
    let dataLoaded = false;

    // Reload whenever the tab is clicked to ensure it is always synchronized
    if (tabBtn) {
        tabBtn.addEventListener('click', () => {
            loadTestData();
        });
    }

    // Load immediately when the popup opens
    loadTestData();

    function loadTestData() {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748b;">Đang tải dữ liệu từ sheet test...</td></tr>';
        
        chrome.runtime.sendMessage({ type: "FETCH_TEST_SHEET" }, (res) => {
            if (res && res.ok && res.values && res.values.length > 0) {
                const rows = res.values;
                const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
                
                // Find column indices
                const sku_idx = headers.indexOf('sku') !== -1 ? headers.indexOf('sku') : 0;
                let ten_idx = headers.findIndex(h => h === 'ten' || h === 'tên' || h === 'ten_sp' || h === 'tên sản phẩm');
                if (ten_idx === -1) ten_idx = 1;
                
                let th_idx = headers.findIndex(h => h === 'thuong hieu' || h === 'thương hiệu');
                if (th_idx === -1) th_idx = 2;
                
                let mota_idx = headers.findIndex(h => h === 'mo ta' || h === 'mô tả');
                if (mota_idx === -1) mota_idx = 3;
                
                let anh_idx = headers.findIndex(h => h === 'anh' || h === 'ảnh' || h === 'hinh anh' || h === 'hình ảnh');
                if (anh_idx === -1) anh_idx = 4;

                allData = [];

                for (let i = rows.length - 1; i >= 1; i--) {
                    const row = rows[i];
                    // At least SKU or Tên must be present to count as a valid row
                    if (row[sku_idx] || row[ten_idx]) {
                        allData.push({
                            sku: String(row[sku_idx] || '').trim(),
                            ten: String(row[ten_idx] || '').trim(),
                            thuongHieu: String(row[th_idx] || '').trim(),
                            moTa: String(row[mota_idx] || '').trim(),
                            anh: String(row[anh_idx] || '').trim()
                        });
                    }
                }
                
                dataLoaded = true;
                renderTable();
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="padding: 10px; text-align: center; color: red;">Lỗi tải dữ liệu hoặc sheet trống. (Kiểm tra lại tên sheet "test")</td></tr>';
            }
        });
    }

    function renderTable() {
        if (!dataLoaded) return;

        let filtered = allData;

        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        if (query) {
            filtered = filtered.filter(item => 
                item.sku.toLowerCase().includes(query) || 
                item.ten.toLowerCase().includes(query)
            );
        }

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748b;">Không tìm thấy kết quả</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();
        filtered.forEach(item => {
            const tr = document.createElement('tr');
            
            // Limit Mot Ta length to avoid huge rows
            let shortMoTa = item.moTa;
            if (shortMoTa.length > 100) {
                shortMoTa = shortMoTa.substring(0, 100) + '...';
            }
            
            // Format Anh as an image tag if it's a URL
            let anhHtml = item.anh;
            if (item.anh.startsWith('http')) {
                anhHtml = `<img src="${item.anh}" style="max-width: 60px; max-height: 60px; object-fit: contain; border-radius: 4px;" title="${item.anh}" alt="ảnh">`;
            }

            tr.innerHTML = `
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-weight: 500;">${item.sku}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #1e293b; max-width: 200px; word-wrap: break-word;">${item.ten}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569;">${item.thuongHieu}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569; max-width: 250px; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.moTa.replace(/"/g, '&quot;')}">${shortMoTa}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: center;">${anhHtml}</td>
            `;
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
})();
