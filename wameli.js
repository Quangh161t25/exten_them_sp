/**
 * Extension Support for phanmem.wameli.vn
 * 1. Admin Product: Sync products to Google Sheet DS_SP
 * 2. Admin Order Upload: Quick suggestions (Sàn, Kho, Shop, Ngày, Giờ) + Folder Reader (PDF & Excel)
 */

(function () {
    'use strict';

    function isProductPage() {
        return window.location.href.includes('phanmem.wameli.vn/admin/product');
    }

    function isOrderUploadPage() {
        return window.location.href.includes('phanmem.wameli.vn/admin/order/upload') ||
            window.location.href.includes('phanmem.wameli.vn/admin/order');
    }

    // ==========================================
    // MODULE 1: PRODUCT PAGE (DS_SP SYNC)
    // ==========================================
    let productPageInitialized = false;
    async function initWameliProductPage() {
        if (productPageInitialized) return;
        if (!document.body) return;
        productPageInitialized = true;

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
        btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

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

        function parsePrice(text) {
            if (!text) return '';
            return text.replace(/\D/g, '');
        }

        function highlightRows() {
            const trs = document.querySelectorAll('table tr');
            trs.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length >= 10) {
                    const maNode = tds[4]?.querySelector('a') || tds[4];
                    const ma = maNode ? maNode.textContent.trim() : '';
                    if (ma) {
                        if (!existingIds.has(ma)) {
                            tr.style.backgroundColor = 'lightgreen';
                        } else {
                            tr.style.backgroundColor = '';
                        }
                    }
                }
            });
        }

        await loadDsSp();
        highlightRows();

        btn.addEventListener('click', async () => {
            btn.textContent = 'Đang đẩy...';
            btn.disabled = true;

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

                    if (ma && !existingIds.has(ma)) {
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
                        existingIds.add(ma);
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
                        highlightRows();
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
    }

    // ==========================================
    // MODULE 2: ORDER UPLOAD PAGE HELPER
    // ==========================================
    function injectOrderUploadStyles() {
        if (document.getElementById('wameli-order-helper-styles')) return;
        const style = document.createElement('style');
        style.id = 'wameli-order-helper-styles';
        style.textContent = `
            .wameli-chips-wrap {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 5px;
                margin-bottom: 4px;
                align-items: center;
            }
            .wameli-chip-btn {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                padding: 3px 8px;
                font-size: 11px;
                font-weight: 600;
                line-height: 1.3;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.15s ease;
                border: 1px solid #cbd5e1;
                background: #f8fafc;
                color: #334155;
                user-select: none;
            }
            .wameli-chip-btn:hover {
                background: #e2e8f0;
                border-color: #94a3b8;
                color: #0f172a;
                transform: translateY(-1px);
            }
            .wameli-chip-btn.active {
                background: #2563eb !important;
                border-color: #1d4ed8 !important;
                color: #ffffff !important;
                box-shadow: 0 1px 3px rgba(37,99,235,0.3);
            }
            .wameli-chip-btn.active-kho {
                background: #059669 !important;
                border-color: #047857 !important;
                color: #ffffff !important;
                box-shadow: 0 1px 3px rgba(5,150,105,0.3);
            }
            .wameli-chip-btn.active-shop {
                background: #7c3aed !important;
                border-color: #6d28d9 !important;
                color: #ffffff !important;
                box-shadow: 0 1px 3px rgba(124,58,237,0.3);
            }
            .wameli-chip-btn.active-date {
                background: #ea580c !important;
                border-color: #c2410c !important;
                color: #ffffff !important;
                box-shadow: 0 1px 3px rgba(234,88,12,0.3);
            }
            .wameli-chip-btn.active-hour {
                background: #0284c7 !important;
                border-color: #0369a1 !important;
                color: #ffffff !important;
                box-shadow: 0 1px 3px rgba(2,132,199,0.3);
            }

            /* Folder Manager Box */
            .wameli-folder-box {
                margin: 10px 0 16px 0;
                background: #ffffff;
                border: 1.5px solid #3b82f6;
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 2px 10px rgba(59,130,246,0.12);
                font-family: inherit;
            }
            .wameli-folder-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e2e8f0;
            }
            .wameli-folder-title {
                font-size: 13px;
                font-weight: 700;
                color: #1e40af;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .wameli-dropzone {
                border: 2px dashed #60a5fa;
                border-radius: 6px;
                background: #f0f7ff;
                padding: 14px 16px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
            }
            .wameli-dropzone.dragover {
                border-color: #2563eb;
                background: #dbeafe;
                transform: scale(1.01);
            }
            .wameli-btn-action {
                padding: 5px 12px;
                font-size: 11px;
                font-weight: 700;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transition: all 0.15s ease;
            }
            .wameli-btn-primary {
                background: #2563eb;
                color: white;
            }
            .wameli-btn-primary:hover {
                background: #1d4ed8;
            }
            .wameli-btn-success {
                background: #16a34a;
                color: white;
            }
            .wameli-btn-success:hover {
                background: #15803d;
            }
            .wameli-btn-danger {
                background: #ef4444;
                color: white;
            }
            .wameli-btn-danger:hover {
                background: #dc2626;
            }
            .wameli-btn-ghost {
                background: #ffffff;
                color: #475569;
                border: 1px solid #cbd5e1;
            }
            .wameli-btn-ghost:hover {
                background: #f1f5f9;
            }

            /* File Lists */
            .wameli-files-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-top: 10px;
            }
            @media (max-width: 768px) {
                .wameli-files-container {
                    grid-template-columns: 1fr;
                }
            }
            .wameli-file-panel {
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                background: #f8fafc;
                padding: 8px;
            }
            .wameli-file-panel-header {
                font-size: 11px;
                font-weight: 700;
                margin-bottom: 6px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-bottom: 4px;
                border-bottom: 1px solid #e2e8f0;
            }
            .wameli-file-list {
                max-height: 150px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .wameli-file-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 4px;
                padding: 3px 6px;
                font-size: 11px;
            }
            .wameli-file-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 80%;
                color: #1e293b;
            }
            .wameli-file-size {
                font-size: 10px;
                color: #64748b;
                white-space: nowrap;
                margin-left: 4px;
            }
            .wameli-summary-banner {
                background: #ecfdf5;
                border: 1px solid #a7f3d0;
                border-radius: 6px;
                padding: 6px 10px;
                margin-top: 8px;
                font-size: 11px;
                color: #065f46;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 6px;
            }
        `;
        document.head.appendChild(style);
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatWameliDate(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    }

    function findWameliOrderFormElements() {
        let sanSelect = null;
        let khoSelect = null;
        let shopSelect = null;
        let gioSelect = null;
        let ngayInput = null;
        let fileNameInput = null;
        let pdfFileInput = null;
        let excelFileInput = null;
        let formContainer = null;

        // 1. Scan all Select elements
        const selects = Array.from(document.querySelectorAll('select'));
        for (const sel of selects) {
            const row = sel.closest('tr, .form-group, .row, div') || sel.parentElement;
            const rowText = (row ? row.textContent : '').toLowerCase();
            const nameOrId = ((sel.name || '') + ' ' + (sel.id || '')).toLowerCase();

            for (const opt of sel.options) {
                const optText = (opt.text || '').toLowerCase().trim();
                if (optText.includes('--sàn--') || optText.includes('--san--') || optText === 'sàn') {
                    sanSelect = sel;
                } else if (optText.includes('--kho--') || optText === 'kho') {
                    khoSelect = sel;
                } else if (optText.includes('--shop--') || optText === 'shop') {
                    shopSelect = sel;
                } else if (optText.includes('--giờ--') || optText.includes('--gio--') || optText === 'giờ') {
                    gioSelect = sel;
                }
            }

            // Check by row text if not found
            if (!sanSelect && (nameOrId.includes('san') || (rowText.includes('sàn') && !rowText.includes('kho')))) sanSelect = sel;
            if (!khoSelect && (nameOrId.includes('kho') || rowText.includes('kho'))) khoSelect = sel;
            if (!shopSelect && (nameOrId.includes('shop') || rowText.includes('shop'))) shopSelect = sel;
            if (!gioSelect && (nameOrId.includes('gio') || nameOrId.includes('hour') || rowText.includes('giờ'))) gioSelect = sel;
        }

        // 2. Scan all Input elements
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const inp of inputs) {
            const type = (inp.type || 'text').toLowerCase();
            const row = inp.closest('tr, .form-group, .row, div') || inp.parentElement;
            const rowText = (row ? row.textContent : '').toLowerCase();
            const nameOrId = ((inp.name || '') + ' ' + (inp.id || '') + ' ' + (inp.placeholder || '')).toLowerCase();

            if (type === 'file') {
                const accept = (inp.accept || '').toLowerCase();
                if (inp.multiple || accept.includes('pdf') || rowText.includes('pdf') || rowText.includes('hóa đơn')) {
                    pdfFileInput = inp;
                } else if (accept.includes('xls') || accept.includes('csv') || rowText.includes('excel') || rowText.includes('đơn hàng excel')) {
                    excelFileInput = inp;
                }
            } else if (type === 'text' || type === 'date') {
                const val = (inp.value || '').trim();
                if (/^\d{2}-\d{2}-\d{4}$/.test(val) || nameOrId.includes('ngay') || nameOrId.includes('date') || (rowText.includes('ngày') && !rowText.includes('hạn'))) {
                    ngayInput = inp;
                } else if (nameOrId.includes('file') || nameOrId.includes('name') || rowText.includes('file name') || rowText.includes('tên file')) {
                    fileNameInput = inp;
                }
            }
        }

        // Fallback for file inputs if not directly tagged
        if (!pdfFileInput || !excelFileInput) {
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
            if (fileInputs.length >= 2) {
                if (!pdfFileInput) pdfFileInput = fileInputs[0];
                if (!excelFileInput) excelFileInput = fileInputs[1];
            } else if (fileInputs.length === 1) {
                if (!pdfFileInput) pdfFileInput = fileInputs[0];
            }
        }

        // Find parent container
        const anyTarget = sanSelect || ngayInput || pdfFileInput;
        if (anyTarget) {
            formContainer = anyTarget.closest('.shopee-image-manager, .panel, .box, .card, form, table, .container') || anyTarget.parentElement;
        }

        return {
            sanSelect,
            khoSelect,
            shopSelect,
            gioSelect,
            ngayInput,
            fileNameInput,
            pdfFileInput,
            excelFileInput,
            formContainer
        };
    }

    function dispatchChangeEvent(element) {
        if (!element) return;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.$ && typeof window.$(element).trigger === 'function') {
            try {
                window.$(element).trigger('change');
            } catch (e) { }
        }
    }

    // --- Suggestion Chips Helpers ---
    function renderSanSuggestions(sanSelect) {
        if (!sanSelect || sanSelect.dataset.wameliEnhanced === 'true') return;
        sanSelect.dataset.wameliEnhanced = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'wameli-chips-wrap';
        wrapper.id = 'wameli-san-chips';

        // Extract options or fallback
        const options = Array.from(sanSelect.options)
            .filter(opt => opt.value && !opt.text.toLowerCase().includes('--sàn--') && !opt.text.toLowerCase().includes('--san--'));

        const fallbackList = ['Shopee', 'TikTok', 'Lazada', 'Tiki', 'Facebook'];
        const listToRender = options.length > 0 ? options.map(o => ({ value: o.value, text: o.text })) : fallbackList.map(t => ({ value: t, text: t }));

        listToRender.forEach(item => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wameli-chip-btn';
            chip.textContent = item.text;
            chip.dataset.val = item.value;

            if (sanSelect.value === item.value || (sanSelect.selectedOptions[0] && sanSelect.selectedOptions[0].text.trim() === item.text)) {
                chip.classList.add('active');
            }

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                // Set select value
                let matchedOpt = Array.from(sanSelect.options).find(o => o.value === item.value || o.text.trim().toLowerCase() === item.text.toLowerCase());
                if (matchedOpt) {
                    sanSelect.value = matchedOpt.value;
                } else {
                    sanSelect.value = item.value;
                }
                dispatchChangeEvent(sanSelect);
                localStorage.setItem('wameli_pref_san', sanSelect.value);

                wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => b.classList.remove('active'));
                chip.classList.add('active');
            });

            wrapper.appendChild(chip);
        });

        sanSelect.addEventListener('change', () => {
            const currentVal = sanSelect.value;
            wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => {
                if (b.dataset.val === currentVal || (sanSelect.selectedOptions[0] && b.textContent.trim() === sanSelect.selectedOptions[0].text.trim())) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            localStorage.setItem('wameli_pref_san', currentVal);

            // Re-render shop suggestions after delay if shops depend on platform
            setTimeout(() => {
                const els = findWameliOrderFormElements();
                if (els.shopSelect) renderShopSuggestions(els.shopSelect);
            }, 300);
            setTimeout(() => {
                const els = findWameliOrderFormElements();
                if (els.shopSelect) renderShopSuggestions(els.shopSelect);
            }, 800);
        });

        // Auto restore last preference
        const savedSan = localStorage.getItem('wameli_pref_san');
        if (savedSan && (!sanSelect.value || sanSelect.value === '0' || sanSelect.value === '')) {
            const matchedOpt = Array.from(sanSelect.options).find(o => o.value === savedSan);
            if (matchedOpt) {
                sanSelect.value = savedSan;
                dispatchChangeEvent(sanSelect);
                const activeBtn = wrapper.querySelector(`[data-val="${savedSan}"]`);
                if (activeBtn) activeBtn.classList.add('active');
            }
        }

        sanSelect.parentNode.insertBefore(wrapper, sanSelect.nextSibling);
    }

    function renderKhoSuggestions(khoSelect) {
        if (!khoSelect || khoSelect.dataset.wameliEnhanced === 'true') return;
        khoSelect.dataset.wameliEnhanced = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'wameli-chips-wrap';
        wrapper.id = 'wameli-kho-chips';

        const options = Array.from(khoSelect.options)
            .filter(opt => opt.value && !opt.text.toLowerCase().includes('--kho--'));

        const fallbackList = ['Kho Hà Nội', 'Kho Hồ Chí Minh', 'Kho Tổng'];
        const listToRender = options.length > 0 ? options.map(o => ({ value: o.value, text: o.text })) : fallbackList.map(t => ({ value: t, text: t }));

        listToRender.forEach(item => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wameli-chip-btn';
            chip.textContent = item.text;
            chip.dataset.val = item.value;

            if (khoSelect.value === item.value || (khoSelect.selectedOptions[0] && khoSelect.selectedOptions[0].text.trim() === item.text)) {
                chip.classList.add('active-kho');
            }

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                let matchedOpt = Array.from(khoSelect.options).find(o => o.value === item.value || o.text.trim().toLowerCase() === item.text.toLowerCase());
                if (matchedOpt) {
                    khoSelect.value = matchedOpt.value;
                } else {
                    khoSelect.value = item.value;
                }
                dispatchChangeEvent(khoSelect);
                localStorage.setItem('wameli_pref_kho', khoSelect.value);

                wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => b.classList.remove('active-kho'));
                chip.classList.add('active-kho');
            });

            wrapper.appendChild(chip);
        });

        khoSelect.addEventListener('change', () => {
            const currentVal = khoSelect.value;
            wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => {
                if (b.dataset.val === currentVal || (khoSelect.selectedOptions[0] && b.textContent.trim() === khoSelect.selectedOptions[0].text.trim())) {
                    b.classList.add('active-kho');
                } else {
                    b.classList.remove('active-kho');
                }
            });
            localStorage.setItem('wameli_pref_kho', currentVal);
        });

        // Auto restore last preference
        const savedKho = localStorage.getItem('wameli_pref_kho');
        if (savedKho && (!khoSelect.value || khoSelect.value === '0' || khoSelect.value === '')) {
            const matchedOpt = Array.from(khoSelect.options).find(o => o.value === savedKho);
            if (matchedOpt) {
                khoSelect.value = savedKho;
                dispatchChangeEvent(khoSelect);
                const activeBtn = wrapper.querySelector(`[data-val="${savedKho}"]`);
                if (activeBtn) activeBtn.classList.add('active-kho');
            }
        }

        khoSelect.parentNode.insertBefore(wrapper, khoSelect.nextSibling);
    }

    function renderShopSuggestions(shopSelect) {
        if (!shopSelect) return;

        let wrapper = document.getElementById('wameli-shop-chips');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'wameli-chips-wrap';
            wrapper.id = 'wameli-shop-chips';
            shopSelect.parentNode.insertBefore(wrapper, shopSelect.nextSibling);
        }

        const options = Array.from(shopSelect.options)
            .filter(opt => opt.value && !opt.text.toLowerCase().includes('--shop--'));

        if (options.length === 0) {
            wrapper.innerHTML = '<span style="font-size: 10px; color: #94a3b8; font-style: italic;">(Chọn Sàn để hiện danh sách Shop)</span>';
            return;
        }

        wrapper.innerHTML = '';
        options.forEach(opt => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wameli-chip-btn';
            chip.textContent = opt.text;
            chip.dataset.val = opt.value;

            if (shopSelect.value === opt.value) {
                chip.classList.add('active-shop');
            }

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                shopSelect.value = opt.value;
                dispatchChangeEvent(shopSelect);
                localStorage.setItem('wameli_pref_shop', shopSelect.value);

                wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => b.classList.remove('active-shop'));
                chip.classList.add('active-shop');
            });

            wrapper.appendChild(chip);
        });

        shopSelect.addEventListener('change', () => {
            const currentVal = shopSelect.value;
            wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => {
                if (b.dataset.val === currentVal) {
                    b.classList.add('active-shop');
                } else {
                    b.classList.remove('active-shop');
                }
            });
            localStorage.setItem('wameli_pref_shop', currentVal);
        });
    }

    function renderDateSuggestions(ngayInput) {
        if (!ngayInput || ngayInput.dataset.wameliEnhanced === 'true') return;
        ngayInput.dataset.wameliEnhanced = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'wameli-chips-wrap';
        wrapper.id = 'wameli-date-chips';

        const now = new Date();
        const todayStr = formatWameliDate(now);
        const yesterdayStr = formatWameliDate(new Date(Date.now() - 86400000));
        const tomorrowStr = formatWameliDate(new Date(Date.now() + 86400000));

        const dateConfigs = [
            { label: `📅 Hôm nay (${todayStr})`, value: todayStr, title: 'Chọn ngày hôm nay' },
            { label: `⏪ Hôm qua (${yesterdayStr})`, value: yesterdayStr, title: 'Chọn ngày hôm qua' },
            { label: `⏩ Ngày mai (${tomorrowStr})`, value: tomorrowStr, title: 'Chọn ngày mai' }
        ];

        dateConfigs.forEach(cfg => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wameli-chip-btn';
            chip.textContent = cfg.label;
            chip.dataset.val = cfg.value;
            chip.title = cfg.title;

            if (ngayInput.value.trim() === cfg.value) {
                chip.classList.add('active-date');
            }

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                ngayInput.value = cfg.value;
                dispatchChangeEvent(ngayInput);

                wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => b.classList.remove('active-date'));
                chip.classList.add('active-date');
            });

            wrapper.appendChild(chip);
        });

        ngayInput.addEventListener('input', () => {
            const val = ngayInput.value.trim();
            wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => {
                if (b.dataset.val === val) {
                    b.classList.add('active-date');
                } else {
                    b.classList.remove('active-date');
                }
            });
        });

        ngayInput.parentNode.insertBefore(wrapper, ngayInput.nextSibling);
    }

    function renderHourSuggestions(gioSelect) {
        if (!gioSelect || gioSelect.dataset.wameliEnhanced === 'true') return;
        gioSelect.dataset.wameliEnhanced = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'wameli-chips-wrap';
        wrapper.id = 'wameli-hour-chips';

        const currentHour = new Date().getHours();
        const currentHourStr = String(currentHour).padStart(2, '0');

        // Button: Giờ hiện tại
        const nowChip = document.createElement('button');
        nowChip.type = 'button';
        nowChip.className = 'wameli-chip-btn';
        nowChip.style.background = '#ffedd5';
        nowChip.style.borderColor = '#fdba74';
        nowChip.style.color = '#c2410c';
        nowChip.innerHTML = `⏰ <b>Giờ hiện tại (${currentHour}h)</b>`;
        nowChip.title = `Chọn giờ hiện tại (${currentHour}:00)`;

        nowChip.addEventListener('click', (e) => {
            e.preventDefault();
            // Match in gioSelect options
            let matched = Array.from(gioSelect.options).find(o => {
                const txt = o.text.trim().toLowerCase();
                const val = o.value.trim().toLowerCase();
                return val === String(currentHour) ||
                    txt.includes(`${currentHour}h`) ||
                    txt.includes(`${currentHourStr}:`) ||
                    val.includes(`${currentHourStr}:`);
            });
            if (matched) {
                gioSelect.value = matched.value;
                dispatchChangeEvent(gioSelect);
                wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => b.classList.remove('active-hour'));
                nowChip.classList.add('active-hour');
            } else if (gioSelect.options.length > 1) {
                // If index matches approximately
                gioSelect.selectedIndex = Math.min(currentHour + 1, gioSelect.options.length - 1);
                dispatchChangeEvent(gioSelect);
                nowChip.classList.add('active-hour');
            }
        });
        wrapper.appendChild(nowChip);

        // Render chips for options in select if available, or common hour milestones
        const validOptions = Array.from(gioSelect.options)
            .filter(opt => opt.value && !opt.text.toLowerCase().includes('--giờ--') && !opt.text.toLowerCase().includes('--gio--'));

        if (validOptions.length > 0) {
            validOptions.forEach(opt => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'wameli-chip-btn';
                chip.textContent = opt.text;
                chip.dataset.val = opt.value;

                if (gioSelect.value === opt.value) {
                    chip.classList.add('active-hour');
                }

                chip.addEventListener('click', (e) => {
                    e.preventDefault();
                    gioSelect.value = opt.value;
                    dispatchChangeEvent(gioSelect);

                    wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => b.classList.remove('active-hour'));
                    chip.classList.add('active-hour');
                });

                wrapper.appendChild(chip);
            });
        } else {
            // Milestone hours fallback: 8h, 9h, 10h, 11h, 12h, 14h, 16h, 18h, 20h, 22h
            const milestones = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22];
            milestones.forEach(h => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'wameli-chip-btn';
                chip.textContent = `${h}h`;
                chip.dataset.val = String(h);

                chip.addEventListener('click', (e) => {
                    e.preventDefault();
                    gioSelect.value = String(h);
                    dispatchChangeEvent(gioSelect);

                    wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => b.classList.remove('active-hour'));
                    chip.classList.add('active-hour');
                });
                wrapper.appendChild(chip);
            });
        }

        gioSelect.addEventListener('change', () => {
            const currentVal = gioSelect.value;
            wrapper.querySelectorAll('.wameli-chip-btn').forEach(b => {
                if (b.dataset.val === currentVal) {
                    b.classList.add('active-hour');
                } else {
                    b.classList.remove('active-hour');
                }
            });
        });

        gioSelect.parentNode.insertBefore(wrapper, gioSelect.nextSibling);
    }

    // --- Folder Reader & File Manager Component ---
    let scannedFolderState = {
        folderName: '',
        pdfFiles: [],
        excelFiles: [],
        selectedExcelIndex: 0
    };

    function renderFolderManagerBox(container, formElements) {
        if (!container || document.getElementById('wameli-folder-manager-box')) return;

        const box = document.createElement('div');
        box.id = 'wameli-folder-manager-box';
        box.className = 'wameli-folder-box';

        box.innerHTML = `
            <div class="wameli-folder-header">
                <div class="wameli-folder-title">
                    <span>📁</span> QUẢN LÝ THƯ MỤC ĐƠN HÀNG (Tự Động Nạp PDF & Excel)
                    <span style="font-size: 10px; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Mới ⚡</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button type="button" id="wameli-btn-clear-folder" class="wameli-btn-action wameli-btn-ghost" style="display: none;" title="Xóa danh sách file hiện tại">🗑️ Xóa danh sách</button>
                    <button type="button" id="wameli-btn-toggle-box" class="wameli-btn-action wameli-btn-ghost">Thu gọn ▲</button>
                </div>
            </div>

            <div id="wameli-folder-body">
                <!-- Dropzone Area -->
                <div id="wameli-folder-dropzone" class="wameli-dropzone">
                    <input type="file" id="wameli-folder-input" webkitdirectory directory multiple style="display: none;">
                    <div style="font-size: 26px;">📂</div>
                    <div style="font-size: 13px; font-weight: 700; color: #1e40af;">
                        Kéo thả thư mục vào đây hoặc Click để chọn thư mục
                    </div>
                    <div style="font-size: 11px; color: #64748b;">
                        Tự động quét & phân loại danh sách <b>Hóa đơn PDF (.pdf)</b> và <b>Đơn hàng Excel (.xlsx, .xls, .csv)</b>
                    </div>
                    <button type="button" id="wameli-btn-pick-folder" class="wameli-btn-action wameli-btn-primary" style="margin-top: 4px; padding: 6px 14px; font-size: 12px;">
                        📁 Chọn Thư Mục Chứa Đơn Hàng
                    </button>
                </div>

                <!-- Summary Status Banner (hidden by default) -->
                <div id="wameli-summary-banner" class="wameli-summary-banner" style="display: none;">
                    <div>
                        <b>Thư mục:</b> <span id="wameli-summary-folder-name" style="font-weight: 700; color: #1e40af;">...</span>
                        | <span style="color: #dc2626; font-weight: bold;">📄 <span id="wameli-summary-pdf-count">0</span> PDF</span>
                        | <span style="color: #16a34a; font-weight: bold;">📊 <span id="wameli-summary-excel-count">0</span> Excel</span>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button type="button" id="wameli-btn-reapply-form" class="wameli-btn-action wameli-btn-success" title="Nạp lại các file này vào ô Hóa đơn PDF và Đơn hàng Excel">
                            ⚡ Nạp lại vào Form
                        </button>
                    </div>
                </div>

                <!-- Classified Files List (2 Columns) -->
                <div id="wameli-files-container" class="wameli-files-container" style="display: none;">
                    <!-- Column 1: PDF Files -->
                    <div class="wameli-file-panel">
                        <div class="wameli-file-panel-header" style="color: #b91c1c;">
                            <span>📄 HÓA ĐƠN PDF (<span id="wameli-badge-pdf-count">0</span>)</span>
                            <span style="font-size: 10px; color: #64748b;">Tự động nạp ô "Hóa đơn PDF"</span>
                        </div>
                        <div id="wameli-pdf-file-list" class="wameli-file-list">
                            <div style="padding: 10px; text-align: center; color: #94a3b8; font-size: 11px;">Chưa có file PDF nào</div>
                        </div>
                    </div>

                    <!-- Column 2: Excel Files -->
                    <div class="wameli-file-panel">
                        <div class="wameli-file-panel-header" style="color: #15803d;">
                            <span>📊 ĐƠN HÀNG EXCEL (<span id="wameli-badge-excel-count">0</span>)</span>
                            <span style="font-size: 10px; color: #64748b;">Tự động nạp ô "Đơn hàng Excel"</span>
                        </div>
                        <div id="wameli-excel-file-list" class="wameli-file-list">
                            <div style="padding: 10px; text-align: center; color: #94a3b8; font-size: 11px;">Chưa có file Excel nào</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert before row "Hóa đơn PDF" or at top of form
        if (formElements.pdfFileInput) {
            const pdfRow = formElements.pdfFileInput.closest('tr, .form-group, .row');
            if (pdfRow && pdfRow.tagName === 'TR' && pdfRow.parentElement) {
                const tr = document.createElement('tr');
                tr.id = 'wameli-folder-tr';
                const td = document.createElement('td');
                td.colSpan = 10;
                td.style.padding = '8px 0';
                td.appendChild(box);
                tr.appendChild(td);
                pdfRow.parentElement.insertBefore(tr, pdfRow);
            } else if (pdfRow && pdfRow.parentElement) {
                pdfRow.parentElement.insertBefore(box, pdfRow);
            } else if (container) {
                container.prepend(box);
            }
        } else if (container) {
            container.prepend(box);
        }

        // --- Event Handlers ---
        const dropzone = box.querySelector('#wameli-folder-dropzone');
        const folderInput = box.querySelector('#wameli-folder-input');
        const pickFolderBtn = box.querySelector('#wameli-btn-pick-folder');
        const toggleBoxBtn = box.querySelector('#wameli-btn-toggle-box');
        const clearFolderBtn = box.querySelector('#wameli-btn-clear-folder');
        const reapplyBtn = box.querySelector('#wameli-btn-reapply-form');
        const folderBody = box.querySelector('#wameli-folder-body');

        // Toggle Box Collapse
        toggleBoxBtn.addEventListener('click', () => {
            if (folderBody.style.display === 'none') {
                folderBody.style.display = 'block';
                toggleBoxBtn.textContent = 'Thu gọn ▲';
            } else {
                folderBody.style.display = 'none';
                toggleBoxBtn.textContent = 'Mở rộng ▼';
            }
        });

        // Trigger Picker
        pickFolderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            folderInput.click();
        });
        dropzone.addEventListener('click', () => {
            folderInput.click();
        });

        // Folder input change
        folderInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            const folderName = files[0]?.webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Thư mục đã chọn';
            await processUploadedFiles(files, folderName);
        });

        // Drag & Drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');

            const items = e.dataTransfer.items;
            if (items && items.length > 0) {
                const files = await scanDataTransferItems(items);
                let folderName = 'Thư mục kéo thả';
                if (items[0].webkitGetAsEntry && items[0].webkitGetAsEntry()?.isDirectory) {
                    folderName = items[0].webkitGetAsEntry().name;
                }
                await processUploadedFiles(files, folderName);
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                await processUploadedFiles(files, 'File kéo thả');
            }
        });

        // Reapply to form
        reapplyBtn.addEventListener('click', () => {
            applyFilesToWameliForm();
        });

        // Clear folder
        clearFolderBtn.addEventListener('click', () => {
            scannedFolderState = {
                folderName: '',
                pdfFiles: [],
                excelFiles: [],
                selectedExcelIndex: 0
            };
            box.querySelector('#wameli-summary-banner').style.display = 'none';
            box.querySelector('#wameli-files-container').style.display = 'none';
            clearFolderBtn.style.display = 'none';
            folderInput.value = '';
        });
    }

    async function scanDataTransferItems(items) {
        const allFiles = [];

        async function readEntry(entry) {
            if (!entry) return;
            if (entry.isFile) {
                return new Promise(resolve => {
                    entry.file(file => {
                        allFiles.push(file);
                        resolve();
                    }, () => resolve());
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                const readAllEntries = async () => {
                    return new Promise(resolve => {
                        dirReader.readEntries(async (entries) => {
                            if (entries.length === 0) {
                                resolve();
                            } else {
                                for (const sub of entries) {
                                    await readEntry(sub);
                                }
                                await readAllEntries();
                                resolve();
                            }
                        }, () => resolve());
                    });
                };
                await readAllEntries();
            }
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.webkitGetAsEntry) {
                const entry = item.webkitGetAsEntry();
                if (entry) await readEntry(entry);
            } else if (item.getAsFile) {
                const f = item.getAsFile();
                if (f) allFiles.push(f);
            }
        }

        return allFiles;
    }

    async function processUploadedFiles(files, folderName) {
        const pdfFiles = [];
        const excelFiles = [];

        files.forEach(f => {
            const name = f.name.toLowerCase();
            if (name.endsWith('.pdf')) {
                pdfFiles.push(f);
            } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
                excelFiles.push(f);
            }
        });

        // Natural sort by filename
        pdfFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        excelFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        scannedFolderState.folderName = folderName;
        scannedFolderState.pdfFiles = pdfFiles;
        scannedFolderState.excelFiles = excelFiles;
        scannedFolderState.selectedExcelIndex = 0;

        renderScannedFilesUI();
        applyFilesToWameliForm();
    }

    function renderScannedFilesUI() {
        const box = document.getElementById('wameli-folder-manager-box');
        if (!box) return;

        const summaryBanner = box.querySelector('#wameli-summary-banner');
        const filesContainer = box.querySelector('#wameli-files-container');
        const clearFolderBtn = box.querySelector('#wameli-btn-clear-folder');

        summaryBanner.style.display = 'flex';
        filesContainer.style.display = 'grid';
        clearFolderBtn.style.display = 'inline-flex';

        box.querySelector('#wameli-summary-folder-name').textContent = scannedFolderState.folderName || 'Thư mục';
        box.querySelector('#wameli-summary-pdf-count').textContent = scannedFolderState.pdfFiles.length;
        box.querySelector('#wameli-summary-excel-count').textContent = scannedFolderState.excelFiles.length;
        box.querySelector('#wameli-badge-pdf-count').textContent = scannedFolderState.pdfFiles.length;
        box.querySelector('#wameli-badge-excel-count').textContent = scannedFolderState.excelFiles.length;

        // Render PDF list
        const pdfListEl = box.querySelector('#wameli-pdf-file-list');
        pdfListEl.innerHTML = '';
        if (scannedFolderState.pdfFiles.length === 0) {
            pdfListEl.innerHTML = '<div style="padding: 10px; text-align: center; color: #94a3b8; font-size: 11px;">Không tìm thấy file .pdf nào trong thư mục</div>';
        } else {
            scannedFolderState.pdfFiles.forEach((file, idx) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'wameli-file-item';
                itemEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; width: 85%;">
                        <span style="color: #dc2626; font-size: 12px;">📄</span>
                        <span class="wameli-file-name" title="${file.name}">${file.name}</span>
                        <span class="wameli-file-size">(${formatFileSize(file.size)})</span>
                    </div>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <button type="button" class="wameli-btn-action wameli-btn-ghost btn-preview-pdf" style="padding: 1px 5px; font-size: 10px;" title="Xem trước PDF">👁️</button>
                        <button type="button" class="wameli-btn-action wameli-btn-ghost btn-remove-pdf" style="padding: 1px 5px; font-size: 10px; color: #dc2626;" title="Gỡ file này">✕</button>
                    </div>
                `;

                // Preview PDF
                itemEl.querySelector('.btn-preview-pdf').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = URL.createObjectURL(file);
                    window.open(url, '_blank');
                });

                // Remove PDF from list
                itemEl.querySelector('.btn-remove-pdf').addEventListener('click', (e) => {
                    e.stopPropagation();
                    scannedFolderState.pdfFiles.splice(idx, 1);
                    renderScannedFilesUI();
                    applyFilesToWameliForm();
                });

                pdfListEl.appendChild(itemEl);
            });
        }

        // Render Excel list
        const excelListEl = box.querySelector('#wameli-excel-file-list');
        excelListEl.innerHTML = '';
        if (scannedFolderState.excelFiles.length === 0) {
            excelListEl.innerHTML = '<div style="padding: 10px; text-align: center; color: #94a3b8; font-size: 11px;">Không tìm thấy file .xlsx, .xls, .csv nào</div>';
        } else {
            scannedFolderState.excelFiles.forEach((file, idx) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'wameli-file-item';
                const isSelected = (idx === scannedFolderState.selectedExcelIndex);
                if (isSelected) {
                    itemEl.style.borderColor = '#16a34a';
                    itemEl.style.background = '#f0fdf4';
                }

                itemEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; width: 85%;">
                        <input type="radio" name="wameli-excel-radio" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
                        <span style="color: #16a34a; font-size: 12px;">📊</span>
                        <span class="wameli-file-name" title="${file.name}"><b>${file.name}</b></span>
                        <span class="wameli-file-size">(${formatFileSize(file.size)})</span>
                    </div>
                    <button type="button" class="wameli-btn-action wameli-btn-ghost btn-copy-excel-name" style="padding: 1px 6px; font-size: 10px;" title="Copy tên file">📋</button>
                `;

                // Change selected excel file
                const radio = itemEl.querySelector('input[type="radio"]');
                itemEl.addEventListener('click', () => {
                    scannedFolderState.selectedExcelIndex = idx;
                    renderScannedFilesUI();
                    applyFilesToWameliForm();
                });

                // Copy excel name
                itemEl.querySelector('.btn-copy-excel-name').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const baseName = file.name.replace(/\.[^/.]+$/, '');
                    navigator.clipboard.writeText(baseName);
                });

                excelListEl.appendChild(itemEl);
            });
        }
    }

    function applyFilesToWameliForm() {
        const formElements = findWameliOrderFormElements();
        const { pdfFileInput, excelFileInput, fileNameInput } = formElements;

        // 1. Assign PDF files
        if (pdfFileInput && scannedFolderState.pdfFiles.length > 0) {
            try {
                const dtPdf = new DataTransfer();
                scannedFolderState.pdfFiles.forEach(f => dtPdf.items.add(f));
                pdfFileInput.files = dtPdf.files;
                dispatchChangeEvent(pdfFileInput);

                // Update sibling / text label if any
                const parentRow = pdfFileInput.closest('tr, .form-group, .row, div') || pdfFileInput.parentElement;
                const statusSpan = parentRow.querySelector('.file-name, .custom-file-label, span');
                if (statusSpan && statusSpan.textContent.includes('Không có tệp')) {
                    statusSpan.textContent = `Đã chọn ${scannedFolderState.pdfFiles.length} file PDF`;
                }
            } catch (err) {
                console.warn('[Wameli Helper] Error assigning PDF files:', err);
            }
        }

        // 2. Assign Excel file
        if (excelFileInput && scannedFolderState.excelFiles.length > 0) {
            try {
                const selectedExcel = scannedFolderState.excelFiles[scannedFolderState.selectedExcelIndex] || scannedFolderState.excelFiles[0];
                if (selectedExcel) {
                    const dtExcel = new DataTransfer();
                    dtExcel.items.add(selectedExcel);
                    excelFileInput.files = dtExcel.files;
                    dispatchChangeEvent(excelFileInput);

                    const parentRow = excelFileInput.closest('tr, .form-group, .row, div') || excelFileInput.parentElement;
                    const statusSpan = parentRow.querySelector('.file-name, .custom-file-label, span');
                    if (statusSpan && statusSpan.textContent.includes('Không có tệp')) {
                        statusSpan.textContent = selectedExcel.name;
                    }
                }
            } catch (err) {
                console.warn('[Wameli Helper] Error assigning Excel file:', err);
            }
        }

        // 3. Auto-fill File name
        if (fileNameInput) {
            let suggestedName = '';
            if (scannedFolderState.excelFiles.length > 0) {
                const selectedExcel = scannedFolderState.excelFiles[scannedFolderState.selectedExcelIndex] || scannedFolderState.excelFiles[0];
                suggestedName = selectedExcel.name.replace(/\.[^/.]+$/, '');
            } else if (scannedFolderState.folderName && scannedFolderState.folderName !== 'Thư mục đã chọn') {
                suggestedName = scannedFolderState.folderName;
            }

            if (suggestedName) {
                fileNameInput.value = suggestedName;
                dispatchChangeEvent(fileNameInput);
            }
        }
    }

    function initWameliOrderUploadPage() {
        injectOrderUploadStyles();

        const formElements = findWameliOrderFormElements();
        const { sanSelect, khoSelect, shopSelect, gioSelect, ngayInput, formContainer } = formElements;

        if (sanSelect) renderSanSuggestions(sanSelect);
        if (khoSelect) renderKhoSuggestions(khoSelect);
        if (shopSelect) renderShopSuggestions(shopSelect);
        if (ngayInput) renderDateSuggestions(ngayInput);
        if (gioSelect) renderHourSuggestions(gioSelect);

        if (formContainer) {
            renderFolderManagerBox(formContainer, formElements);
        }
    }

    // ==========================================
    // MAIN ENTRYPOINT & URL ROUTER
    // ==========================================
    function main() {
        if (isProductPage()) {
            initWameliProductPage();
        } else if (isOrderUploadPage()) {
            initWameliOrderUploadPage();
        }

        // Periodic check & mutation observer for SPA navigation and dynamically rendered forms
        setInterval(() => {
            if (isOrderUploadPage()) {
                initWameliOrderUploadPage();
            } else if (isProductPage()) {
                initWameliProductPage();
            }
        }, 1200);

        let lastUrl = location.href;
        const navObserver = new MutationObserver(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                if (isOrderUploadPage()) {
                    initWameliOrderUploadPage();
                } else if (isProductPage()) {
                    initWameliProductPage();
                }
            }
        });
        navObserver.observe(document, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
