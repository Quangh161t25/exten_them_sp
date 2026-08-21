(function() {
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-web-sp"]');
    const skuInput = document.getElementById('web-sp-sku-input');
    const tbody = document.getElementById('web-sp-tbody');

    // Fields
    const inputPhanLoai = document.getElementById('web-sp-phan-loai');
    const inputTen = document.getElementById('web-sp-ten');
    const inputNganhHang = document.getElementById('web-sp-nganh-hang');
    const inputMoTa = document.getElementById('web-sp-mo-ta');
    const containerAnh = document.getElementById('web-sp-khung-anh');
    const containerAnhMoTa = document.getElementById('web-sp-khung-anh-mo-ta');
    const containerVideo = document.getElementById('web-sp-khung-video');

    // Sku mota box & prices
    const boxSkuMota = document.getElementById('web-sp-sku-mota-box');
    const inputGiaBan = document.getElementById('web-sp-gia-ban');
    const inputGiaThapNhat = document.getElementById('web-sp-gia-thap-nhat');
    const inputGia08 = document.getElementById('web-sp-gia-08');
    const btnCopy = document.getElementById('web-sp-btn-copy');

    let allRows = [];
    let dataLoaded = false;
    let colIndices = {
        id: 0,
        gian: 1,
        sku: 2,
        phan_loai: 3,
        ten_sp: 4,
        nganh_hang: 5,
        mo_ta: 6,
        anh: 7,
        anh_mota: 8,
        anh_phan_loai: 9,
        link_video: 10,
        gia: 11,
        gia_khuyen_mai: 12,
        link_shopee: 14
    };
    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderShopeeLink(value) {
        const link = String(value || "").trim();
        if (!link) return "";
        const safeLink = escapeHtml(link);
        if (/^https?:\/\//i.test(link)) {
            return `<a href="${safeLink}" target="_blank" rel="noreferrer" title="${safeLink}" style="color: #2563eb; text-decoration: underline;">link</a>`;
        }
        return `<span title="${safeLink}">${safeLink}</span>`;
    }

    if (tabBtn) {
        tabBtn.addEventListener('click', () => {
            loadWebSpData();
        });
    }

    // Tự động tải ngay khi mở popup
    loadWebSpData();

    function loadWebSpData() {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 10px; text-align: center; color: #64748b;">Đang tải dữ liệu từ sheet WEB_SP...</td></tr>';
        
        chrome.runtime.sendMessage({ type: "FETCH_WEB_SP" }, (res) => {
            if (res && res.ok && res.values && res.values.length > 0) {
                const rows = res.values;
                const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
                
                // Map column indices dynamically
                headers.forEach((h, idx) => {
                    if (h === 'id' || h.includes('mã sp')) colIndices.id = idx;
                    else if (h === 'gian' || h.includes('mã gian')) colIndices.gian = idx;
                    else if (h === 'sku' || h.includes('mã sku')) colIndices.sku = idx;
                    else if (h === 'phan_loai' || h.includes('phân loại')) colIndices.phan_loai = idx;
                    else if (h === 'ten_sp' || h.includes('tên sản phẩm') || h.includes('tên sp')) colIndices.ten_sp = idx;
                    else if (h === 'nganh_hang' || h.includes('ngành hàng')) colIndices.nganh_hang = idx;
                    else if (h === 'mo_ta' || h.includes('mô tả')) colIndices.mo_ta = idx;
                    else if (h === 'anh' || h === 'ảnh') colIndices.anh = idx;
                    else if (h === 'anh_mota' || h.includes('ảnh mô tả')) colIndices.anh_mota = idx;
                    else if (h === 'link_shopee' || h === 'link shopee' || h === 'link' || h.includes('link_shopee') || h.includes('link shopee')) colIndices.link_shopee = idx;
                    else if (h === 'link_video' || h.includes('video')) colIndices.link_video = idx;
                    else if (h === 'gia_khuyen_mai' || h.includes('giá km') || h.includes('giá thấp nhất') || h.includes('khuyến mãi') || h.includes('giá km/thấp nhất')) colIndices.gia_khuyen_mai = idx;
                    else if (h === 'gia' || h === 'giá' || h.includes('giá bán') || h.includes('gia ban')) colIndices.gia = idx;
                });

                allRows = [];
                // Lấy toàn bộ dòng từ dưới lên (mới nhất xếp trên)
                for (let i = rows.length - 1; i >= 1; i--) {
                    const row = rows[i];
                    if (row && row.some(cell => String(cell || "").trim() !== "")) {
                        allRows.push(row);
                    }
                }

                dataLoaded = true;
                filterAndRender();
            } else {
                const errDetail = (res && res.error) ? res.error : 'Sheet WEB_SP trống hoặc sai tên';
                tbody.innerHTML = `<tr><td colspan="6" style="padding: 10px; text-align: center; color: red;">Lỗi tải dữ liệu: ${errDetail}</td></tr>`;
            }
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

    function filterAndRender() {
        if (!dataLoaded) return;
        const searchVal = (skuInput.value || "").trim();
        const tokens = parseSearchTokens(searchVal);
        const filterMode = document.querySelector('input[name="web-sp-filter-mode"]:checked')?.value || 'OR';
        
        let filtered = [];

        if (tokens.length > 0) {
            const checkMatch = (row, token) => {
                const rowSku = String(row[colIndices.sku] || "").trim().toLowerCase();
                const rowTen = String(row[colIndices.ten_sp] || "").trim().toLowerCase();
                const rowPhanLoai = String(row[colIndices.phan_loai] || "").trim().toLowerCase();
                const rowGian = String(row[colIndices.gian] || "").trim().toLowerCase();
                
                if (rowSku.includes(token) || rowTen.includes(token) || rowPhanLoai.includes(token) || rowGian.includes(token)) {
                    return true;
                }
                return row.some(cell => String(cell || '').toLowerCase().includes(token));
            };

            if (filterMode === 'AND') {
                filtered = allRows.filter(row => tokens.every(token => checkMatch(row, token)));
            } else {
                // OR mode
                filtered = allRows.filter(row => tokens.some(token => checkMatch(row, token)));
            }
        } else {
            // Mặc định chưa gõ SKU: Hiển thị 10 sản phẩm cuối cùng (mới nhất)
            filtered = allRows.slice(0, 10);
        }

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 10px; text-align: center; color: #64748b;">Không tìm thấy dòng phù hợp với SKU.</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();
        filtered.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #f1f5f9";
            
            const linkVal = row[colIndices.link_shopee] || '';
            const gianVal = row[colIndices.gian] || '';
            const skuVal = row[colIndices.sku] || '';
            const phanLoaiVal = row[colIndices.phan_loai] || '';
            const tenVal = row[colIndices.ten_sp] || '';

            tr.innerHTML = `
                <td style="padding: 6px; text-align: center;">
                    <button class="btn-view-row" data-idx="${idx}" style="cursor: pointer; border: none; background: transparent; font-size: 14px;" title="Xem chi tiết">👁️</button>
                </td>
                <td style="padding: 6px; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${renderShopeeLink(linkVal)}</td>
                <td style="padding: 6px; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(gianVal)}</td>
                <td style="padding: 6px; max-width: 100px; font-weight: 600; color: #2563eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(skuVal)}</td>
                <td style="padding: 6px; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(phanLoaiVal)}</td>
                <td style="padding: 6px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(tenVal)}">${escapeHtml(tenVal)}</td>
            `;

            // Attach row data to button element for easy access
            const btn = tr.querySelector('.btn-view-row');
            btn._rowData = row;

            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    }

    function updateSkuMotaAndPricesFromInput() {
        const inputVal = (skuInput.value || "").trim();
        if (!inputVal) return;

        const sku4Char = inputVal.substring(0, 4);
        const dsSpMatch = findDsSpDataBySkuPrefix(sku4Char);

        chrome.storage.local.get(["maGian", "dhHoanTextValue"], (storageRes) => {
            const currentMaGian = (storageRes.maGian || storageRes.dhHoanTextValue || "BCE").trim();
            
            let idSpCon = dsSpMatch ? dsSpMatch.idSpCon : "";
            if (!idSpCon) {
                idSpCon = inputVal;
            }

            const tenSpVal = inputTen ? inputTen.value.trim() : "";
            const formattedSkuMota = tenSpVal ? `${idSpCon}-${currentMaGian}-00-001-${tenSpVal}` : `${idSpCon}-${currentMaGian}-00-001`;
            boxSkuMota.textContent = formattedSkuMota;
        });

        if (dsSpMatch) {
            function parsePrice(val) {
                if (!val) return 0;
                let str = String(val).trim().toLowerCase().replace(/đ|vnd|vnđ/g, '');
                if (str.endsWith('k')) {
                    const n = parseFloat(str.replace('k', '').replace(',', '.'));
                    return isNaN(n) ? 0 : Math.round(n * 1000);
                }
                const cleanStr = str.replace(/[^\d]/g, '');
                return parseInt(cleanStr, 10) || 0;
            }

            const giaBanRaw = dsSpMatch.giaBan;
            const giaKmRaw = dsSpMatch.giaThapNhat || giaBanRaw;

            const giaNum = parsePrice(giaBanRaw);
            const giaKmNum = parsePrice(giaKmRaw) || giaNum;
            const gia08Num = giaKmNum > 0 ? Math.round(giaKmNum / 0.8) : (giaNum > 0 ? Math.round(giaNum / 0.8) : 0);

            if (giaNum) inputGiaBan.value = giaNum.toLocaleString('vi-VN');
            if (giaKmNum) inputGiaThapNhat.value = giaKmNum.toLocaleString('vi-VN');
            if (gia08Num) inputGia08.value = gia08Num.toLocaleString('vi-VN');
        }
    }

    if (skuInput) {
        skuInput.addEventListener('input', () => {
            filterAndRender();
            updateSkuMotaAndPricesFromInput();
        });
    }

    document.querySelectorAll('input[name="web-sp-filter-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            filterAndRender();
        });
    });

    // Handle view row click (con mắt 👁️)
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-view-row');
        if (btn && btn._rowData) {
            displayRowDetails(btn._rowData);
        }
    });

    const btnCopySkuMota = document.getElementById('web-sp-btn-copy-sku-mota');

    let dsSpRows = [];
    let dsSpLoaded = false;

    // Load dữ liệu từ sheet DS_SP / TINH_GIA để tra cứu id_sp_con
    function loadDsSpMapping() {
        chrome.runtime.sendMessage({ type: 'FETCH_TINH_GIA' }, (res) => {
            if (res && res.ok && res.values && res.values.length > 0) {
                dsSpRows = res.values;
                dsSpLoaded = true;
            }
        });
    }
    loadDsSpMapping();

    function renderImageList(container, urlsString, placeholderText) {
        container.innerHTML = '';
        if (!urlsString) {
            container.innerHTML = `<span style="font-size: 10px; color: #94a3b8; align-self: center;">${placeholderText}</span>`;
            return;
        }

        // Tách danh sách ảnh theo dấu gạch đứng '|', dấu phẩy, dấu chấm phẩy hoặc xuống dòng
        const urls = String(urlsString)
            .split(/[\n|;,]+/)
            .map(u => u.trim())
            .filter(u => u.startsWith('http'));

        if (urls.length === 0) {
            container.innerHTML = `<span style="font-size: 10px; color: #94a3b8; align-self: center;">${placeholderText}</span>`;
            return;
        }

        urls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.width = "48px";
            img.style.height = "48px";
            img.style.objectFit = "cover";
            img.style.borderRadius = "4px";
            img.style.border = "1px solid #cbd5e1";
            img.style.cursor = "pointer";
            img.title = "Click để xem ảnh kích thước đầy đủ";
            img.onclick = () => window.open(url, '_blank');
            container.appendChild(img);
        });
    }

    function renderVideoContainer(container, videoStr) {
        container.innerHTML = '';
        if (!videoStr) {
            container.textContent = 'Chưa có video';
            return;
        }

        const urls = String(videoStr)
            .split(/[\n|;,]+/)
            .map(u => u.trim())
            .filter(u => u.startsWith('http'));

        if (urls.length === 0) {
            container.textContent = videoStr;
            return;
        }

        urls.forEach(videoUrl => {
            const videoWrapper = document.createElement('div');
            videoWrapper.style.margin = '4px 0';
            
            // Render thẻ video có controls xem trực tiếp
            videoWrapper.innerHTML = `
                <video src="${videoUrl}" controls style="max-width: 100%; max-height: 160px; border-radius: 4px; background: #000; display: block; margin-bottom: 4px;"></video>
                <a href="${videoUrl}" target="_blank" style="font-size: 11px; color: #2563eb; text-decoration: underline;">🎬 Mở video trong tab mới</a>
            `;
            container.appendChild(videoWrapper);
        });
    }

    const skuMotaContainer = document.getElementById('web-sp-sku-mota-container');
    const pricesContainer = document.getElementById('web-sp-prices-container');

    function findAllDsSpDataBySkuPrefix(inputSkuPrefix) {
        if (!dsSpLoaded || !dsSpRows || dsSpRows.length < 2 || !inputSkuPrefix) return [];
        const targetPrefix = inputSkuPrefix.trim().toLowerCase();
        
        const headers = dsSpRows[0].map(h => String(h || "").trim().toLowerCase());
        const idSpIdx = headers.indexOf('id_sp') !== -1 ? headers.indexOf('id_sp') : 1;
        const idSpConIdx = headers.indexOf('id_sp_con') !== -1 ? headers.indexOf('id_sp_con') : (headers.indexOf('id_sp_ct') !== -1 ? headers.indexOf('id_sp_ct') : 0);
        const giaBanIdx = headers.indexOf('gia_ban') !== -1 ? headers.indexOf('gia_ban') : (headers.indexOf('giá bán') !== -1 ? headers.indexOf('giá bán') : -1);
        const giaThapNhatIdx = headers.indexOf('gia_thap_nhat') !== -1 ? headers.indexOf('gia_thap_nhat') : (headers.indexOf('giá thấp nhất') !== -1 ? headers.indexOf('giá thấp nhất') : -1);

        const results = [];
        for (let i = 1; i < dsSpRows.length; i++) {
            const row = dsSpRows[i];
            const rowIdSp = String(row[idSpIdx] || "").trim().toLowerCase();
            if (rowIdSp === targetPrefix || rowIdSp.substring(0, 4) === targetPrefix.substring(0, 4)) {
                results.push({
                    idSpCon: String(row[idSpConIdx] || "").trim(),
                    giaBan: giaBanIdx !== -1 ? String(row[giaBanIdx] || "").trim() : "",
                    giaThapNhat: giaThapNhatIdx !== -1 ? String(row[giaThapNhatIdx] || "").trim() : ""
                });
            }
        }
        return results;
    }

    function renderSkuMotaAndPrices(matches, defaultSku, defaultGian, defaultTenSp, defaultGiaBan, defaultGiaKm) {
        if (!skuMotaContainer || !pricesContainer) return;

        chrome.storage.local.get(["maGian", "dhHoanTextValue"], (storageRes) => {
            const settingMaGian = (storageRes.maGian || storageRes.dhHoanTextValue || "").trim();
            const currentMaGian = settingMaGian || defaultGian || "BCE";

            // 1. Render các dòng SKU mô tả
            skuMotaContainer.innerHTML = '';
            const skuListToRender = matches.length > 0 ? matches : [{ idSpCon: defaultSku || 'LK49-SI-00' }];

            skuListToRender.forEach(item => {
                const idSpCon = item.idSpCon || defaultSku || 'LK49-SI-00';
                const formattedSku = defaultTenSp ? `${idSpCon}-${currentMaGian}-00-001-${defaultTenSp}` : `${idSpCon}-${currentMaGian}-00-001`;

                const rowDiv = document.createElement('div');
                rowDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; color: #334155; min-height: 32px; font-weight: 500;';
                rowDiv.innerHTML = `
                    <div class="web-sp-sku-mota-box" style="flex: 1; word-break: break-all; min-width: 0; font-size: 11px;">
                        ${formattedSku}
                    </div>
                    <div style="display: flex; gap: 4px; flex-shrink: 0;">
                        <button type="button" class="web-sp-btn-fill-sku-mota" style="width: auto !important; min-height: 22px !important; height: 22px !important; background: #ee4d2d; color: #ffffff; border: none; border-radius: 3px; padding: 0 8px; font-size: 10px; font-weight: bold; cursor: pointer; line-height: 22px;" title="Điền SKU vào Shopee">Điền</button>
                        <button type="button" class="web-sp-btn-copy-sku-mota" style="width: auto !important; min-height: 22px !important; height: 22px !important; background: #e2e8f0; color: #334155; border: 1px solid #cbd5e1; border-radius: 3px; padding: 0 8px; font-size: 10px; font-weight: bold; cursor: pointer; line-height: 22px;" title="Copy SKU Mô tả">Copy</button>
                    </div>
                `;

                // Add click event for Fill SKU to Shopee
                const btnFillSku = rowDiv.querySelector('.web-sp-btn-fill-sku-mota');
                btnFillSku.addEventListener('click', async () => {
                    btnFillSku.textContent = 'Đang...';
                    try {
                        await sendMessageToActiveShopeeTab({
                            type: "FILL_SKU_TO_SHOPEE",
                            sku: formattedSku
                        });
                        btnFillSku.textContent = 'Đã điền!';
                    } catch (err) {
                        btnFillSku.textContent = 'Lỗi!';
                    } finally {
                        setTimeout(() => { btnFillSku.textContent = 'Điền'; }, 1500);
                    }
                });

                // Add copy event for SKU Mota row
                const btnCopySku = rowDiv.querySelector('.web-sp-btn-copy-sku-mota');
                btnCopySku.addEventListener('click', () => {
                    navigator.clipboard.writeText(formattedSku).then(() => {
                        btnCopySku.textContent = 'Đã Copy!';
                        btnCopySku.style.backgroundColor = '#22c55e';
                        btnCopySku.style.color = '#ffffff';
                        setTimeout(() => {
                            btnCopySku.textContent = 'Copy';
                            btnCopySku.style.backgroundColor = '#e2e8f0';
                            btnCopySku.style.color = '#334155';
                        }, 1200);
                    });
                });

                // Save current formattedSku to storage for instant quick fill
                chrome.storage.local.set({ webSpLastSku: formattedSku });

                skuMotaContainer.appendChild(rowDiv);
            });

            // 2. Render các dòng Đơn giá
            pricesContainer.innerHTML = '';
            const priceListToRender = matches.length > 0 ? matches : [{ giaBan: defaultGiaBan, giaThapNhat: defaultGiaKm }];

            function parsePrice(val) {
                if (!val) return 0;
                let str = String(val).trim().toLowerCase().replace(/đ|vnd|vnđ/g, '');
                if (str.endsWith('k')) {
                    const n = parseFloat(str.replace('k', '').replace(',', '.'));
                    return isNaN(n) ? 0 : Math.round(n * 1000);
                }
                const cleanStr = str.replace(/[^\d]/g, '');
                return parseInt(cleanStr, 10) || 0;
            }

            priceListToRender.forEach(pItem => {
                const giaRaw = pItem.giaBan || defaultGiaBan || '0';
                const giaKmRaw = pItem.giaThapNhat || defaultGiaKm || giaRaw;

                const giaNum = parsePrice(giaRaw);
                const giaKmNum = parsePrice(giaKmRaw) || giaNum;
                const gia08Num = giaKmNum > 0 ? Math.round(giaKmNum / 0.8) : (giaNum > 0 ? Math.round(giaNum / 0.8) : 0);

                const strGiaBan = giaNum ? giaNum.toLocaleString('vi-VN') : (giaRaw || '0');
                const strGiaKm = giaKmNum ? giaKmNum.toLocaleString('vi-VN') : (giaKmRaw || strGiaBan);
                const strGia08 = gia08Num ? gia08Num.toLocaleString('vi-VN') : '';

                // Save current price / 0.8 to storage for quick fill
                if (strGia08) {
                    chrome.storage.local.set({ webSpLastPrice: strGia08 });
                }

                const pRowDiv = document.createElement('div');
                pRowDiv.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr auto auto; gap: 4px; align-items: center;';
                pRowDiv.innerHTML = `
                    <input type="text" class="web-sp-gia-ban" value="${strGiaBan}" placeholder="Giá Bán" style="padding: 6px; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 4px; width: 100%; box-sizing: border-box;">
                    <input type="text" class="web-sp-gia-thap-nhat" value="${strGiaKm}" placeholder="Giá Thấp Nhất" style="padding: 6px; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 4px; width: 100%; box-sizing: border-box;">
                    <input type="text" class="web-sp-gia-08" value="${strGia08}" placeholder="Gia / 0.8" style="padding: 6px; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 4px; width: 100%; box-sizing: border-box;">
                    <button type="button" class="web-sp-btn-fill-08" style="width: auto !important; min-height: 28px !important; height: 28px !important; background-color: #ee4d2d; color: white; border: none; border-radius: 4px; padding: 0 8px; font-size: 11px; font-weight: bold; cursor: pointer; line-height: 28px;" title="Điền Giá / 0.8 vào Shopee">Điền</button>
                    <button type="button" class="web-sp-btn-copy-08" style="width: auto !important; min-height: 28px !important; height: 28px !important; background-color: #2563eb; color: white; border: none; border-radius: 4px; padding: 0 8px; font-size: 11px; font-weight: bold; cursor: pointer; line-height: 28px;" title="Copy Giá / 0.8">Copy</button>
                `;

                // Add fill event for Price / 0.8
                const btnFill08 = pRowDiv.querySelector('.web-sp-btn-fill-08');
                btnFill08.addEventListener('click', async () => {
                    const inputGia08Val = pRowDiv.querySelector('.web-sp-gia-08').value.trim();
                    if (!inputGia08Val) return;
                    btnFill08.textContent = 'Đang...';
                    try {
                        await sendMessageToActiveShopeeTab({
                            type: "FILL_PRICE_TO_SHOPEE",
                            price: inputGia08Val
                        });
                        btnFill08.textContent = 'Đã điền!';
                    } catch (err) {
                        btnFill08.textContent = 'Lỗi!';
                    } finally {
                        setTimeout(() => { btnFill08.textContent = 'Điền'; }, 1500);
                    }
                });

                // Add copy event for Price / 0.8
                const btnCopy08 = pRowDiv.querySelector('.web-sp-btn-copy-08');
                btnCopy08.addEventListener('click', () => {
                    const inputGia08Val = pRowDiv.querySelector('.web-sp-gia-08').value.trim();
                    if (!inputGia08Val) return;
                    navigator.clipboard.writeText(inputGia08Val).then(() => {
                        btnCopy08.textContent = 'OK!';
                        btnCopy08.style.backgroundColor = '#16a34a';
                        setTimeout(() => {
                            btnCopy08.textContent = 'Copy';
                            btnCopy08.style.backgroundColor = '#2563eb';
                        }, 1200);
                    }).catch(err => console.error('Copy lỗi:', err));
                });

                pricesContainer.appendChild(pRowDiv);
            });
        });
    }

    function updateSkuMotaAndPricesFromInput() {
        const inputVal = (skuInput.value || "").trim();
        if (!inputVal) return;

        const sku4Char = inputVal.substring(0, 4);
        const matches = findAllDsSpDataBySkuPrefix(sku4Char);
        const tenSpVal = inputTen ? inputTen.value.trim() : "";

        renderSkuMotaAndPrices(matches, inputVal, "BCE", tenSpVal, "", "");
    }

    if (skuInput) {
        skuInput.addEventListener('input', () => {
            filterAndRender();
            updateSkuMotaAndPricesFromInput();
        });
    }

    // Handle view row click (con mắt 👁️)
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-view-row');
        if (btn && btn._rowData) {
            displayRowDetails(btn._rowData);
        }
    });

    function displayRowDetails(row) {
        const phanLoai = row[colIndices.phan_loai] || '';
        const tenSp = row[colIndices.ten_sp] || '';
        const nganhHang = row[colIndices.nganh_hang] || '';
        const moTa = row[colIndices.mo_ta] || '';
        const anhStr = row[colIndices.anh] || '';
        const anhMoTaStr = row[colIndices.anh_mota] || '';
        const videoStr = row[colIndices.link_video] || '';
        const rawSku = String(row[colIndices.sku] || '').trim();
        const gianVal = String(row[colIndices.gian] || '').trim();
        
        let giaRaw = row[colIndices.gia] || '0';
        let giaKhuyenMaiRaw = row[colIndices.gia_khuyen_mai] || giaRaw;

        inputPhanLoai.value = phanLoai;
        inputTen.value = tenSp;
        inputNganhHang.value = nganhHang;
        inputMoTa.value = moTa;

        renderImageList(containerAnh, anhStr, 'Chưa có ảnh');
        renderImageList(containerAnhMoTa, anhMoTaStr, 'Chưa có ảnh mô tả');
        renderVideoContainer(containerVideo, videoStr);

        const sku4Char = rawSku.substring(0, 4);
        const matches = findAllDsSpDataBySkuPrefix(sku4Char);

        renderSkuMotaAndPrices(matches, rawSku, gianVal, tenSp, giaRaw, giaKhuyenMaiRaw);
    }

    // --- Các nút thao tác mới: Viết lại AI, Điền vào SP, Tải ảnh, Drag-Drop Video ---

    // Helper gửi message tới tab Shopee active hoặc mở mới trang thêm SP nếu chưa mở
    async function sendMessageToActiveShopeeTab(message) {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url || !tab.url.includes("banhang.shopee.vn/portal/product/")) {
            const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/portal/product/*" });
            if (tabs && tabs.length > 0) {
                tab = tabs[0];
                await chrome.tabs.update(tab.id, { active: true });
            } else {
                tab = await chrome.tabs.create({ url: "https://banhang.shopee.vn/portal/product/new?from=sidebar" });
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        return new Promise((resolve) => chrome.tabs.sendMessage(tab.id, message, resolve));
    }

    // Helper gọi Gemini API trực tiếp
    async function callGeminiApiDirect(promptText) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(["geminiApiKey", "geminiModel"], async (res) => {
                const apiKey = res.geminiApiKey ? res.geminiApiKey.trim() : "";
                const model = res.geminiModel || "gemini-2.5-flash";

                if (!apiKey) {
                    alert("Chưa có API Key Gemini! Vui lòng lưu API Key ở Tab Cài đặt (ô cai_dat!E2) trước.");
                    return reject(new Error("Thiếu API Key Gemini"));
                }

                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
                    const response = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: promptText }] }]
                        })
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error?.message || `Lỗi HTTP ${response.status}`);
                    }

                    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    resolve(resultText.trim());
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    // 1. Nút Viết lại AI - Tên sản phẩm
    const btnRewriteName = document.getElementById('web-sp-btn-rewrite-name');
    if (btnRewriteName) {
        btnRewriteName.addEventListener('click', async () => {
            const currentName = inputTen.value.trim();
            const currentDesc = inputMoTa.value.trim();
            if (!currentName && !currentDesc) {
                alert("Vui lòng nhập tên hoặc mô tả sản phẩm trước khi viết lại bằng AI!");
                return;
            }
            btnRewriteName.textContent = "Đang viết...";
            btnRewriteName.disabled = true;

            try {
                const prompt = `Bạn là chuyên gia viết tiêu đề sản phẩm chuẩn SEO Shopee. Hãy dựa vào tên và nội dung mô tả sản phẩm dưới đây để viết lại 1 tên sản phẩm mới chuẩn SEO cực kỳ thu hút, có độ dài KHOẢNG 99 KÝ TỰ (tối đa 99 ký tự, không vượt quá 99 ký tự), không chứa các ký tự định dạng markdown như **, không chứa ngoặc kép, chỉ trả về duy nhất câu tên sản phẩm:\nTên hiện tại: ${currentName}\nMô tả sản phẩm: ${currentDesc}`;
                let newTitle = await callGeminiApiDirect(prompt);
                if (newTitle) {
                    // Loại bỏ markdown **, *, ngoặc kép và làm sạch khoảng trắng
                    newTitle = newTitle
                        .replace(/\*\*/g, '')
                        .replace(/\*/g, '')
                        .replace(/^["']|["']$/g, '')
                        .trim();
                    
                    // Cắt nếu quá 99 ký tự
                    if (newTitle.length > 99) {
                        newTitle = newTitle.substring(0, 99).trim();
                    }
                    inputTen.value = newTitle;
                }
            } catch (err) {
                alert("Lỗi viết lại tên AI: " + err.message);
            } finally {
                btnRewriteName.textContent = "Viết lại AI";
                btnRewriteName.disabled = false;
            }
        });
    }

    // 2. Nút Viết lại AI - Mô tả sản phẩm
    const btnRewriteDesc = document.getElementById('web-sp-btn-rewrite-desc');
    if (btnRewriteDesc) {
        btnRewriteDesc.addEventListener('click', async () => {
            const currentName = inputTen.value.trim();
            const currentDesc = inputMoTa.value.trim();
            if (!currentName && !currentDesc) {
                alert("Vui lòng nhập tên hoặc mô tả sản phẩm để AI viết lại!");
                return;
            }
            btnRewriteDesc.textContent = "Đang viết...";
            btnRewriteDesc.disabled = true;

            try {
                const prompt = `Bạn là chuyên gia marketing Shopee. Hãy viết lại bài mô tả sản phẩm chuyên nghiệp, đầy đủ công dụng, thông số kỹ thuật, bảo hành, dùng biểu tượng emoji đẹp mắt. Giữ nguyên định dạng xuống dòng.\nTUYỆT ĐỐI KHÔNG dùng ký tự in đậm markdown ** (không được dùng dấu ** ở bất kỳ đâu trong văn bản).\nTên sản phẩm: ${currentName}\nMô tả cũ (nếu có): ${currentDesc}`;
                let newDesc = await callGeminiApiDirect(prompt);
                if (newDesc) {
                    // Loại bỏ triệt để tất cả dấu ** và * markdown
                    newDesc = newDesc.replace(/\*\*/g, '').replace(/\*/g, '');
                    inputMoTa.value = newDesc;
                }
            } catch (err) {
                alert("Lỗi viết lại mô tả AI: " + err.message);
            } finally {
                btnRewriteDesc.textContent = "Viết lại AI";
                btnRewriteDesc.disabled = false;
            }
        });
    }

    // Helper sao chép văn bản vào clipboard
    function copyToClipboard(text, btnElement, successMsg = "Đã copy!") {
        if (!text) {
            alert("Không có nội dung để copy!");
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            const originalText = btnElement.textContent;
            btnElement.textContent = successMsg;
            setTimeout(() => { btnElement.textContent = originalText; }, 1500);
        }).catch(err => {
            console.error("Lỗi copy:", err);
            alert("Lỗi copy: " + err.message);
        });
    }

    // Nút Copy Tên sản phẩm
    const btnCopyName = document.getElementById('web-sp-btn-copy-name');
    if (btnCopyName) {
        btnCopyName.addEventListener('click', () => {
            copyToClipboard(inputTen.value, btnCopyName);
        });
    }

    // Nút Copy Mô tả
    const btnCopyDesc = document.getElementById('web-sp-btn-copy-desc');
    if (btnCopyDesc) {
        btnCopyDesc.addEventListener('click', () => {
            copyToClipboard(inputMoTa.value, btnCopyDesc);
        });
    }

    // Nút Copy Khung ảnh sản phẩm
    const btnCopyAnh = document.getElementById('web-sp-btn-copy-anh');
    if (btnCopyAnh) {
        btnCopyAnh.addEventListener('click', () => {
            const imgs = Array.from(containerAnh.querySelectorAll('img')).map(img => img.src).filter(Boolean);
            if (!imgs.length) {
                alert("Chưa có ảnh trong Khung ảnh sản phẩm!");
                return;
            }
            copyToClipboard(imgs.join("\n"), btnCopyAnh);
        });
    }

    // Nút Copy Khung ảnh mô tả
    const btnCopyAnhMota = document.getElementById('web-sp-btn-copy-anh-mota');
    if (btnCopyAnhMota) {
        btnCopyAnhMota.addEventListener('click', () => {
            const imgs = Array.from(containerAnhMoTa.querySelectorAll('img')).map(img => img.src).filter(Boolean);
            if (!imgs.length) {
                alert("Chưa có ảnh trong Khung ảnh mô tả!");
                return;
            }
            copyToClipboard(imgs.join("\n"), btnCopyAnhMota);
        });
    }

    // 3. Nút Điền vào SP - Tên
    const btnFillName = document.getElementById('web-sp-btn-fill-name');
    if (btnFillName) {
        btnFillName.addEventListener('click', async () => {
            const val = inputTen.value.trim();
            if (!val) {
                alert("Chưa có tên sản phẩm để điền!");
                return;
            }
            btnFillName.textContent = "Đang điền...";
            try {
                const response = await sendMessageToActiveShopeeTab({
                    type: "FILL_PRODUCT_TEXT",
                    product: { name: val }
                });
                if (response?.message) {
                    btnFillName.textContent = "Đã điền!";
                } else {
                    btnFillName.textContent = "Đã gửi điền tên";
                }
            } catch (err) {
                alert("Lỗi điền tên: " + err.message);
            } finally {
                setTimeout(() => { btnFillName.textContent = "Điền vào SP"; }, 1500);
            }
        });
    }

    // 4. Nút Điền vào SP - Mô tả
    const btnFillDesc = document.getElementById('web-sp-btn-fill-desc');
    if (btnFillDesc) {
        btnFillDesc.addEventListener('click', async () => {
            const val = inputMoTa.value.trim();
            if (!val) {
                alert("Chưa có nội dung mô tả để điền!");
                return;
            }
            btnFillDesc.textContent = "Đang điền...";
            try {
                const response = await sendMessageToActiveShopeeTab({
                    type: "FILL_PRODUCT_TEXT",
                    product: { description: val }
                });
                if (response?.message) {
                    btnFillDesc.textContent = "Đã điền!";
                } else {
                    btnFillDesc.textContent = "Đã gửi điền mô tả";
                }
            } catch (err) {
                alert("Lỗi điền mô tả: " + err.message);
            } finally {
                setTimeout(() => { btnFillDesc.textContent = "Điền vào SP"; }, 1500);
            }
        });
    }

    // 5. Nút Đưa vào ảnh chính & Nút Đưa vào mô tả
    const btnDuaAnhChinh = document.getElementById('web-sp-btn-dua-anh-chinh');
    if (btnDuaAnhChinh) {
        btnDuaAnhChinh.addEventListener('click', async () => {
            const imgs = Array.from(containerAnh.querySelectorAll('img')).map(img => img.src).filter(Boolean);
            if (!imgs.length) {
                alert("Chưa có ảnh trong Khung ảnh sản phẩm!");
                return;
            }
            btnDuaAnhChinh.textContent = "Đang đưa...";
            try {
                // Convert blob/url images to file payload dataUrl
                const files = await Promise.all(imgs.map(async (url, index) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    return {
                        name: `product-image-${index + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`,
                        type: blob.type || 'image/jpeg',
                        lastModified: Date.now(),
                        dataUrl
                    };
                }));

                const response = await sendMessageToActiveShopeeTab({
                    type: "UPLOAD_PRODUCT_IMAGES",
                    files
                });
                btnDuaAnhChinh.textContent = "Đã đưa ảnh!";
            } catch (err) {
                console.error("Lỗi đưa ảnh sản phẩm:", err);
                btnDuaAnhChinh.textContent = "Lỗi đưa ảnh";
            } finally {
                setTimeout(() => { btnDuaAnhChinh.textContent = "Đưa vào ảnh chính"; }, 1500);
            }
        });
    }

    const btnDuaAnhMota = document.getElementById('web-sp-btn-dua-anh-mota');
    if (btnDuaAnhMota) {
        btnDuaAnhMota.addEventListener('click', async () => {
            const imgs = Array.from(containerAnh.querySelectorAll('img')).map(img => img.src).filter(Boolean);
            if (!imgs.length) {
                return;
            }
            btnDuaAnhMota.textContent = "Đang đưa...";
            try {
                const files = await Promise.all(imgs.map(async (url, index) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    return {
                        name: `description-image-${index + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`,
                        type: blob.type || 'image/jpeg',
                        lastModified: Date.now(),
                        dataUrl
                    };
                }));

                const response = await sendMessageToActiveShopeeTab({
                    type: "UPLOAD_DESCRIPTION_IMAGES",
                    files
                });
                btnDuaAnhMota.textContent = "Đã đưa ảnh mô tả!";
            } catch (err) {
                console.error("Lỗi đưa ảnh mô tả:", err);
                btnDuaAnhMota.textContent = "Lỗi đưa ảnh";
            } finally {
                setTimeout(() => { btnDuaAnhMota.textContent = "Đưa vào mô tả"; }, 1500);
            }
        });
    }

    // 5b. Các nút cho Khung ảnh mô tả
    const btnDuaAnhChinhMota = document.getElementById('web-sp-btn-dua-anh-chinh-mota');
    if (btnDuaAnhChinhMota) {
        btnDuaAnhChinhMota.addEventListener('click', async () => {
            const imgs = Array.from(containerAnhMoTa.querySelectorAll('img')).map(img => img.src).filter(Boolean);
            if (!imgs.length) {
                alert("Chưa có ảnh trong Khung ảnh mô tả!");
                return;
            }
            btnDuaAnhChinhMota.textContent = "Đang đưa...";
            try {
                const files = await Promise.all(imgs.map(async (url, index) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    return {
                        name: `product-image-${index + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`,
                        type: blob.type || 'image/jpeg',
                        lastModified: Date.now(),
                        dataUrl
                    };
                }));

                await sendMessageToActiveShopeeTab({
                    type: "UPLOAD_PRODUCT_IMAGES",
                    files
                });
                btnDuaAnhChinhMota.textContent = "Đã đưa ảnh!";
            } catch (err) {
                btnDuaAnhChinhMota.textContent = "Lỗi!";
            } finally {
                setTimeout(() => { btnDuaAnhChinhMota.textContent = "Đưa vào ảnh chính"; }, 1500);
            }
        });
    }

    const btnDuaAnhMotaMota = document.getElementById('web-sp-btn-dua-anh-mota-mota');
    if (btnDuaAnhMotaMota) {
        btnDuaAnhMotaMota.addEventListener('click', async () => {
            const imgs = Array.from(containerAnhMoTa.querySelectorAll('img')).map(img => img.src).filter(Boolean);
            if (!imgs.length) {
                alert("Chưa có ảnh trong Khung ảnh mô tả!");
                return;
            }
            btnDuaAnhMotaMota.textContent = "Đang đưa...";
            try {
                const files = await Promise.all(imgs.map(async (url, index) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    return {
                        name: `description-image-${index + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`,
                        type: blob.type || 'image/jpeg',
                        lastModified: Date.now(),
                        dataUrl
                    };
                }));

                await sendMessageToActiveShopeeTab({
                    type: "UPLOAD_DESCRIPTION_IMAGES",
                    files
                });
                btnDuaAnhMotaMota.textContent = "Đã đưa ảnh mô tả!";
            } catch (err) {
                btnDuaAnhMotaMota.textContent = "Lỗi!";
            } finally {
                setTimeout(() => { btnDuaAnhMotaMota.textContent = "Đưa vào mô tả"; }, 1500);
            }
        });
    }

    // 6. Nút Tải ảnh sản phẩm
    const btnUploadAnh = document.getElementById('web-sp-btn-upload-anh');
    const fileAnh = document.getElementById('web-sp-file-anh');
    if (btnUploadAnh && fileAnh) {
        btnUploadAnh.addEventListener('click', () => fileAnh.click());
        fileAnh.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            files.forEach(file => {
                const url = URL.createObjectURL(file);
                const img = document.createElement('img');
                img.src = url;
                img.style.cssText = "width: 48px; height: 48px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; cursor: pointer;";
                img.onclick = () => window.open(url, '_blank');
                containerAnh.appendChild(img);
            });
        });
    }

    // 6. Nút Tải ảnh mô tả
    const btnUploadAnhMota = document.getElementById('web-sp-btn-upload-anh-mota');
    const fileAnhMota = document.getElementById('web-sp-file-anh-mota');
    if (btnUploadAnhMota && fileAnhMota) {
        btnUploadAnhMota.addEventListener('click', () => fileAnhMota.click());
        fileAnhMota.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            files.forEach(file => {
                const url = URL.createObjectURL(file);
                const img = document.createElement('img');
                img.src = url;
                img.style.cssText = "width: 48px; height: 48px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; cursor: pointer;";
                img.onclick = () => window.open(url, '_blank');
                containerAnhMoTa.appendChild(img);
            });
        });
    }

    // 7. Nút & Kéo thả Video vào Khung Video
    const btnUploadVideo = document.getElementById('web-sp-btn-upload-video');
    const fileVideo = document.getElementById('web-sp-file-video');

    function handleVideoFile(file) {
        if (!file || !file.type.startsWith('video/')) {
            alert("Vui lòng chọn hoặc kéo thả đúng định dạng file video!");
            return;
        }
        const videoUrl = URL.createObjectURL(file);
        containerVideo.innerHTML = '';
        const videoWrapper = document.createElement('div');
        videoWrapper.style.margin = '4px 0';
        videoWrapper.innerHTML = `
            <video src="${videoUrl}" controls style="max-width: 100%; max-height: 160px; border-radius: 4px; background: #000; display: block; margin-bottom: 4px;"></video>
            <span style="font-size: 11px; color: #16a34a; font-weight: bold;">📹 ${file.name}</span>
        `;
        containerVideo.appendChild(videoWrapper);
    }

    if (btnUploadVideo && fileVideo) {
        btnUploadVideo.addEventListener('click', () => fileVideo.click());
        fileVideo.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleVideoFile(e.target.files[0]);
            }
        });
    }

    if (containerVideo) {
        containerVideo.addEventListener('click', (e) => {
            if (e.target.tagName !== 'VIDEO' && e.target.tagName !== 'A' && fileVideo) {
                fileVideo.click();
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            containerVideo.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        containerVideo.addEventListener('dragover', () => {
            containerVideo.style.borderColor = '#0284c7';
            containerVideo.style.background = '#f0f9ff';
        });

        containerVideo.addEventListener('dragleave', () => {
            containerVideo.style.borderColor = '#cbd5e1';
            containerVideo.style.background = '#fff';
        });

        containerVideo.addEventListener('drop', (e) => {
            containerVideo.style.borderColor = '#cbd5e1';
            containerVideo.style.background = '#fff';
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files[0]) {
                handleVideoFile(dt.files[0]);
            }
        });
    }
})();
