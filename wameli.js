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
            /* Split 2-Column Layout */
            #wameli-split-layout-wrapper {
                display: flex;
                gap: 16px;
                width: 100%;
                align-items: flex-start;
                margin-top: 8px;
                box-sizing: border-box;
            }
            #wameli-left-col {
                flex: 1 1 56%;
                min-width: 0;
            }
            #wameli-right-col {
                flex: 0 0 44%;
                min-width: 440px;
                max-width: 46%;
                position: sticky;
                top: 10px;
            }
            @media (max-width: 1200px) {
                #wameli-split-layout-wrapper {
                    flex-direction: column;
                }
                #wameli-right-col {
                    width: 100%;
                    max-width: 100%;
                    position: static;
                }
            }

            /* Narrow form controls */
            .wameli-control-narrow {
                width: 170px !important;
                max-width: 170px !important;
                display: inline-block !important;
                vertical-align: middle !important;
            }

            /* Inline suggestion chips */
            .wameli-inline-chips {
                display: inline-flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 5px;
                margin-left: 8px;
                vertical-align: middle;
            }
            .wameli-chip {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 4px 9px;
                font-size: 11.5px;
                font-weight: 500;
                line-height: 1.2;
                border-radius: 4px;
                border: 1px solid #cbd5e1;
                background: #ffffff;
                color: #334155;
                cursor: pointer;
                transition: all 0.15s ease;
                user-select: none;
                white-space: nowrap;
            }
            .wameli-chip:hover {
                background: #f1f5f9;
                border-color: #94a3b8;
                color: #0f172a;
            }
            .wameli-chip.active {
                background: #0284c7 !important;
                border-color: #0284c7 !important;
                color: #ffffff !important;
                font-weight: 600;
                box-shadow: 0 1px 3px rgba(2, 132, 199, 0.3);
            }

            /* Right File Manager Panel */
            .wameli-panel-card {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .wameli-panel-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            }
            .wameli-panel-title {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
                font-weight: 700;
                color: #0284c7;
                white-space: nowrap;
            }
            .wameli-folder-name-input {
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                color: #334155;
                background: #ffffff;
                width: 140px;
                outline: none;
                transition: border-color 0.15s;
            }
            .wameli-folder-name-input:focus {
                border-color: #0284c7;
            }
            .wameli-header-actions {
                display: flex;
                align-items: center;
                gap: 5px;
                margin-left: auto;
            }
            .wameli-btn-blue {
                background: #0284c7;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 4px 10px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transition: background 0.15s ease;
                white-space: nowrap;
            }
            .wameli-btn-blue:hover {
                background: #0369a1;
            }
            .wameli-btn-toggle {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                color: #475569;
                cursor: pointer;
                transition: all 0.15s;
            }
            .wameli-btn-toggle:hover {
                background: #f1f5f9;
            }

            /* Status Bar */
            .wameli-status-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #ecfdf5;
                border-bottom: 1px solid #a7f3d0;
                padding: 6px 12px;
                font-size: 11.5px;
            }
            .wameli-status-text {
                color: #166534;
                font-weight: 600;
            }
            .wameli-status-actions {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .wameli-btn-sub-action {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 3px 8px;
                font-size: 11px;
                font-weight: 600;
                color: #334155;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.15s ease;
            }
            .wameli-btn-sub-action:hover {
                background: #f8fafc;
                border-color: #94a3b8;
                color: #0f172a;
            }

            /* Column Headers */
            .wameli-col-headers {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 7px 12px;
                border-bottom: 1px solid #e2e8f0;
                background: #ffffff;
                font-size: 12px;
                font-weight: 700;
                color: #334155;
            }
            .wameli-col-title-left {
                padding-left: 24px;
            }
            .wameli-col-title-right {
                margin-right: 105px;
            }

            /* Group Container & List */
            .wameli-groups-container {
                max-height: 480px;
                overflow-y: auto;
                background: #ffffff;
            }
            .wameli-group-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 12px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                font-size: 12px;
            }
            .wameli-group-header-left {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .wameli-group-title {
                font-weight: 700;
                color: #0284c7;
            }
            .wameli-group-actions {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .wameli-btn-group-action {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 2px 7px;
                font-size: 11px;
                font-weight: 600;
                color: #0284c7;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.15s ease;
            }
            .wameli-btn-group-action:hover {
                background: #f0f9ff;
                border-color: #0284c7;
            }

            /* File Item Row */
            .wameli-file-row {
                display: flex;
                align-items: center;
                padding: 5px 12px;
                border-bottom: 1px solid #f1f5f9;
                font-size: 12px;
                color: #1e293b;
                transition: background 0.1s ease;
            }
            .wameli-file-row:hover {
                background: #f8fafc;
            }
            .wameli-file-row.selected {
                background: #f0fdf4;
            }
            .wameli-file-left {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 1;
                min-width: 0;
            }
            .wameli-file-name-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: #1e293b;
                font-weight: 500;
                max-width: 190px;
            }
            .wameli-file-date-text {
                font-size: 11px;
                color: #64748b;
                margin-left: auto;
                margin-right: 8px;
                white-space: nowrap;
            }
            .wameli-file-row-actions {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-left: 4px;
            }
            .wameli-btn-row-action {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 3px;
                padding: 2px 5px;
                font-size: 11px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #334155;
                line-height: 1;
                transition: all 0.15s ease;
            }
            .wameli-btn-row-action:hover {
                background: #f1f5f9;
                border-color: #94a3b8;
            }
            .wameli-btn-nap {
                font-weight: 700;
                color: #0284c7;
                background: #f0f9ff;
                border-color: #bae6fd;
            }
            .wameli-btn-nap:hover {
                background: #e0f2fe;
                border-color: #0284c7;
            }

            /* Toast */
            .wameli-toast {
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: #0f172a;
                color: #ffffff;
                padding: 9px 16px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 999999;
                display: flex;
                align-items: center;
                gap: 8px;
                animation: wameliFadeIn 0.2s ease;
            }
            @keyframes wameliFadeIn {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    function showWameliToast(message, isSuccess = true) {
        const oldToast = document.querySelector('.wameli-toast');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.className = 'wameli-toast';
        toast.style.borderLeft = isSuccess ? '4px solid #10b981' : '4px solid #ef4444';
        toast.innerHTML = `<span>${isSuccess ? '✅' : 'ℹ️'}</span> <span>${message}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.transition = 'opacity 0.3s ease';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }
        }, 2200);
    }

    function formatWameliDate(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    }

    function getDateKey(d) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    function formatFileDateVi(d) {
        const dateStr = getDateKey(d);
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'CH' : 'SA';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${dateStr} ${hours}:${minutes} ${ampm}`;
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

    function findWameliOrderFormElements() {
        let sanSelect = null;
        let khoSelect = null;
        let shopSelect = null;
        let gioSelect = null;
        let ngayInput = null;
        let fileNameInput = null;
        let pdfFileInput = null;
        let excelFileInput = null;
        let formTable = null;

        // 1. Scan Select elements
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

            if (!sanSelect && (nameOrId.includes('san') || (rowText.includes('sàn') && !rowText.includes('kho')))) sanSelect = sel;
            if (!khoSelect && (nameOrId.includes('kho') || rowText.includes('kho'))) khoSelect = sel;
            if (!shopSelect && (nameOrId.includes('shop') || rowText.includes('shop'))) shopSelect = sel;
            if (!gioSelect && (nameOrId.includes('gio') || nameOrId.includes('hour') || rowText.includes('giờ'))) gioSelect = sel;
        }

        // 2. Scan Input elements
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

        // Fallback for file inputs
        if (!pdfFileInput || !excelFileInput) {
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]:not(#wameli-native-folder-input):not(#wameli-native-files-input)'));
            if (fileInputs.length >= 2) {
                if (!pdfFileInput) pdfFileInput = fileInputs[0];
                if (!excelFileInput) excelFileInput = fileInputs[1];
            } else if (fileInputs.length === 1) {
                if (!pdfFileInput) pdfFileInput = fileInputs[0];
            }
        }

        const anyTarget = sanSelect || ngayInput || pdfFileInput;
        if (anyTarget) {
            formTable = anyTarget.closest('table') || anyTarget.closest('form') || anyTarget.parentElement;
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
            formTable
        };
    }

    // --- Split Layout Setup ---
    function setupSplitLayout(formElements) {
        const refEl = formElements.sanSelect || formElements.ngayInput || formElements.pdfFileInput;
        if (!refEl) return null;

        const existingWrapper = document.getElementById('wameli-split-layout-wrapper');
        if (existingWrapper) {
            if (existingWrapper.contains(refEl)) {
                return {
                    wrapper: existingWrapper,
                    leftCol: document.getElementById('wameli-left-col'),
                    rightCol: document.getElementById('wameli-right-col')
                };
            } else {
                existingWrapper.remove();
            }
        }

        let mainTable = refEl.closest('table');
        if (!mainTable) {
            mainTable = refEl.closest('.form-horizontal, .card-body, .panel-body, form');
        }
        if (!mainTable) return null;

        const wrapper = document.createElement('div');
        wrapper.id = 'wameli-split-layout-wrapper';

        const leftCol = document.createElement('div');
        leftCol.id = 'wameli-left-col';

        const rightCol = document.createElement('div');
        rightCol.id = 'wameli-right-col';

        // Insert wrapper before mainTable and move mainTable into leftCol
        mainTable.parentNode.insertBefore(wrapper, mainTable);
        leftCol.appendChild(mainTable);
        wrapper.appendChild(leftCol);
        wrapper.appendChild(rightCol);

        // Add "Chương trình thêm mới" row at top of mainTable if not already present
        if (!document.getElementById('wameli-program-row')) {
            const programRow = document.createElement('tr');
            programRow.id = 'wameli-program-row';
            programRow.innerHTML = `
                <td style="width: 140px; font-weight: 500; font-size: 13px; color: #1e293b; padding: 6px 10px; vertical-align: middle;">Chương trình thêm mới</td>
                <td style="padding: 6px 10px; vertical-align: middle;">
                    <div style="display: flex; width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #ffffff;">
                        <input type="text" id="wameli-program-input" placeholder="Nhập tên chương trình..." style="flex: 1; border: none; padding: 6px 12px; font-size: 13px; outline: none; background: transparent; color: #1e293b;" />
                        <button type="button" id="wameli-program-save-btn" style="border: none; border-left: 1px solid #cbd5e1; background: #f8fafc; color: #475569; padding: 6px 16px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;">Lưu chương trình</button>
                    </div>
                </td>
            `;

            const firstTr = mainTable.querySelector('tr');
            if (firstTr && firstTr.parentElement) {
                firstTr.parentElement.insertBefore(programRow, firstTr);
            } else {
                mainTable.prepend(programRow);
            }

            // Restore saved program name
            const savedProgram = localStorage.getItem('wameli_saved_program');
            if (savedProgram) {
                const pInput = programRow.querySelector('#wameli-program-input');
                if (pInput) pInput.value = savedProgram;
            }

            programRow.querySelector('#wameli-program-save-btn').addEventListener('click', () => {
                const pInput = programRow.querySelector('#wameli-program-input');
                const val = pInput ? pInput.value.trim() : '';
                localStorage.setItem('wameli_saved_program', val);
                showWameliToast('Đã lưu chương trình: ' + (val || '(Để trống)'));
            });
        }

        return { wrapper, leftCol, rightCol };
    }

    // --- Inline Chips Setup for Form Fields ---
    function setupSanChips(sanSelect) {
        if (!sanSelect || sanSelect.dataset.wameliEnhanced === 'true') return;
        sanSelect.dataset.wameliEnhanced = 'true';

        sanSelect.classList.add('wameli-control-narrow');
        const parentCell = sanSelect.parentElement;
        if (parentCell) {
            parentCell.style.display = 'flex';
            parentCell.style.alignItems = 'center';
            parentCell.style.flexWrap = 'wrap';
        }

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'wameli-inline-chips';
        chipsWrap.id = 'wameli-san-chips';

        const sanList = ['Shopee', 'Tiktok', 'Best', 'Đơn ngoài', 'Viettel', 'Lazada', 'Tiki'];

        sanList.forEach(name => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wameli-chip';
            chip.textContent = name;
            chip.dataset.name = name;

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                let matchedOpt = Array.from(sanSelect.options).find(o =>
                    o.text.trim().toLowerCase().includes(name.toLowerCase()) ||
                    (o.value && o.value.trim().toLowerCase().includes(name.toLowerCase()))
                );
                if (matchedOpt) {
                    sanSelect.value = matchedOpt.value;
                } else {
                    sanSelect.value = name;
                }
                dispatchChangeEvent(sanSelect);
                localStorage.setItem('wameli_pref_san', name);

                chipsWrap.querySelectorAll('.wameli-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });

            chipsWrap.appendChild(chip);
        });

        sanSelect.addEventListener('change', () => {
            const currentText = sanSelect.selectedOptions[0] ? sanSelect.selectedOptions[0].text.trim().toLowerCase() : '';
            chipsWrap.querySelectorAll('.wameli-chip').forEach(c => {
                if (currentText.includes(c.dataset.name.toLowerCase())) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
        });

        // Restore preference
        const savedSan = localStorage.getItem('wameli_pref_san');
        if (savedSan) {
            const targetChip = chipsWrap.querySelector(`[data-name="${savedSan}"]`);
            if (targetChip && (!sanSelect.value || sanSelect.value === '0' || sanSelect.value === '')) {
                targetChip.click();
            }
        }

        sanSelect.parentNode.insertBefore(chipsWrap, sanSelect.nextSibling);
    }

    function setupKhoChips(khoSelect) {
        if (!khoSelect || khoSelect.dataset.wameliEnhanced === 'true') return;
        khoSelect.dataset.wameliEnhanced = 'true';

        khoSelect.classList.add('wameli-control-narrow');
        const parentCell = khoSelect.parentElement;
        if (parentCell) {
            parentCell.style.display = 'flex';
            parentCell.style.alignItems = 'center';
            parentCell.style.flexWrap = 'wrap';
        }

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'wameli-inline-chips';
        chipsWrap.id = 'wameli-kho-chips';

        const khoList = ['Kho Hà Nội', 'Kho Hồ Chí Minh'];

        khoList.forEach(name => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wameli-chip';
            chip.textContent = name;
            chip.dataset.name = name;

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                let matchedOpt = Array.from(khoSelect.options).find(o =>
                    o.text.trim().toLowerCase().includes(name.toLowerCase()) ||
                    (o.value && o.value.trim().toLowerCase().includes(name.toLowerCase()))
                );
                if (matchedOpt) {
                    khoSelect.value = matchedOpt.value;
                } else {
                    khoSelect.value = name;
                }
                dispatchChangeEvent(khoSelect);
                localStorage.setItem('wameli_pref_kho', name);

                chipsWrap.querySelectorAll('.wameli-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });

            chipsWrap.appendChild(chip);
        });

        khoSelect.addEventListener('change', () => {
            const currentText = khoSelect.selectedOptions[0] ? khoSelect.selectedOptions[0].text.trim().toLowerCase() : '';
            chipsWrap.querySelectorAll('.wameli-chip').forEach(c => {
                if (currentText.includes(c.dataset.name.toLowerCase())) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
        });

        // Restore preference
        const savedKho = localStorage.getItem('wameli_pref_kho');
        if (savedKho) {
            const targetChip = chipsWrap.querySelector(`[data-name="${savedKho}"]`);
            if (targetChip && (!khoSelect.value || khoSelect.value === '0' || khoSelect.value === '')) {
                targetChip.click();
            }
        }

        khoSelect.parentNode.insertBefore(chipsWrap, khoSelect.nextSibling);
    }

    function setupShopField(shopSelect) {
        if (!shopSelect) return;
        // User requested: "shop k cần gợi ý nữa". Shop dropdown spans 100% full width, no chips.
        shopSelect.style.width = '100%';
        shopSelect.style.maxWidth = '100%';
        shopSelect.style.display = 'block';

        const oldChips = document.getElementById('wameli-shop-chips');
        if (oldChips) oldChips.remove();
    }

    function setupDateChips(ngayInput) {
        if (!ngayInput || ngayInput.dataset.wameliEnhanced === 'true') return;
        ngayInput.dataset.wameliEnhanced = 'true';

        ngayInput.classList.add('wameli-control-narrow');
        const parentCell = ngayInput.parentElement;
        if (parentCell) {
            parentCell.style.display = 'flex';
            parentCell.style.alignItems = 'center';
            parentCell.style.flexWrap = 'wrap';
        }

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'wameli-inline-chips';
        chipsWrap.id = 'wameli-date-chips';

        const now = new Date();
        const todayStr = formatWameliDate(now);
        const yesterdayStr = formatWameliDate(new Date(Date.now() - 86400000));
        const tomorrowStr = formatWameliDate(new Date(Date.now() + 86400000));

        // Default value if empty
        if (!ngayInput.value.trim()) {
            ngayInput.value = todayStr;
        }

        const dateConfigs = [
            { label: 'Hôm nay', val: todayStr },
            { label: 'Hôm qua', val: yesterdayStr },
            { label: 'Ngày mai', val: tomorrowStr }
        ];

        dateConfigs.forEach(cfg => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wameli-chip';
            chip.textContent = cfg.label;
            chip.dataset.val = cfg.val;

            if (ngayInput.value.trim() === cfg.val) {
                chip.classList.add('active');
            }

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                ngayInput.value = cfg.val;
                dispatchChangeEvent(ngayInput);

                chipsWrap.querySelectorAll('.wameli-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });

            chipsWrap.appendChild(chip);
        });

        ngayInput.addEventListener('input', () => {
            const curVal = ngayInput.value.trim();
            chipsWrap.querySelectorAll('.wameli-chip').forEach(c => {
                if (c.dataset.val === curVal) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
        });

        ngayInput.parentNode.insertBefore(chipsWrap, ngayInput.nextSibling);
    }

    function setupHourChips(gioSelect) {
        if (!gioSelect || gioSelect.dataset.wameliEnhanced === 'true') return;
        gioSelect.dataset.wameliEnhanced = 'true';

        gioSelect.classList.add('wameli-control-narrow');
        const parentCell = gioSelect.parentElement;
        if (parentCell) {
            parentCell.style.display = 'flex';
            parentCell.style.alignItems = 'center';
            parentCell.style.flexWrap = 'wrap';
        }

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'wameli-inline-chips';
        chipsWrap.id = 'wameli-hour-chips';

        const hourList = ['0H', '8H', '9H', '10H', '11H', '13H', '14H', '15H', '16H', '23H'];

        hourList.forEach((hText, idx) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wameli-chip';
            chip.textContent = hText;
            chip.dataset.hour = hText;

            // In mockup, 0H is active by default
            if (idx === 0) {
                chip.classList.add('active');
            }

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                const num = parseInt(hText.replace('H', ''), 10);
                const numPad = String(num).padStart(2, '0');

                let matchedOpt = Array.from(gioSelect.options).find(o => {
                    const txt = o.text.trim().toLowerCase();
                    const val = o.value.trim().toLowerCase();
                    return val === String(num) ||
                        txt.includes(`${num}h`) ||
                        txt.includes(`${numPad}:`) ||
                        val.includes(`${numPad}:`);
                });

                if (matchedOpt) {
                    gioSelect.value = matchedOpt.value;
                } else if (gioSelect.options.length > num + 1) {
                    gioSelect.selectedIndex = num + 1;
                } else {
                    gioSelect.value = String(num);
                }

                dispatchChangeEvent(gioSelect);

                chipsWrap.querySelectorAll('.wameli-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });

            chipsWrap.appendChild(chip);
        });

        gioSelect.addEventListener('change', () => {
            const currentVal = gioSelect.value;
            const currentText = gioSelect.selectedOptions[0] ? gioSelect.selectedOptions[0].text.trim().toLowerCase() : '';

            chipsWrap.querySelectorAll('.wameli-chip').forEach(c => {
                const num = c.dataset.hour.replace('H', '');
                if (currentVal === num || currentText.includes(`${num}h`) || currentText.startsWith(`${num}:`)) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
        });

        gioSelect.parentNode.insertBefore(chipsWrap, gioSelect.nextSibling);
    }

    function setupFileNameField(fileNameInput) {
        if (!fileNameInput) return;
        fileNameInput.style.width = '100%';
        fileNameInput.style.maxWidth = '100%';
        fileNameInput.style.display = 'block';
    }

    // --- Right Column: File Manager Panel ---
    let scannedFolderState = {
        folderName: 'tải xuống 2',
        files: [], // Array of { id, file, name, date, isPdf, isExcel, isMock }
        selectedIds: new Set()
    };

    function generateMockFiles() {
        const today = new Date();
        const yesterday = new Date(Date.now() - 86400000);

        function createTime(baseDate, h, m) {
            const d = new Date(baseDate);
            d.setHours(h, m, 0, 0);
            return d;
        }

        const mockList = [
            // Group Today (5 files)
            { name: 'mass_update_sales_info_808.xlsx', date: createTime(today, 9, 37) },
            { name: '0610-gdd-0931-1.xlsx', date: createTime(today, 9, 33) },
            { name: '0610-gdd-0931-1.pdf', date: createTime(today, 9, 31) },
            { name: '0610-bce-0809-1.xlsx', date: createTime(today, 8, 9) },
            { name: '0610-bce-0809-1.pdf', date: createTime(today, 8, 9) },

            // Group Yesterday (7 files)
            { name: 'Mau_Nhap_San_Pham_SoSanh_2026.xlsx', date: createTime(yesterday, 23, 42) },
            { name: '0510-gdd-0808-1.xlsx', date: createTime(yesterday, 8, 8) },
            { name: '0510-gdd-0807-3.pdf', date: createTime(yesterday, 8, 8) },
            { name: '0510-gdd-0807-2.pdf', date: createTime(yesterday, 8, 7) },
            { name: '0510-gdd-0807-1.pdf', date: createTime(yesterday, 8, 7) },
            { name: '0510-joy-0804-1.xlsx', date: createTime(yesterday, 8, 4) },
            { name: '0510-joy-0804-1.pdf', date: createTime(yesterday, 8, 4) }
        ];

        return mockList.map((item, idx) => {
            const isPdf = item.name.toLowerCase().endsWith('.pdf');
            const isExcel = !isPdf;
            const mime = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const mockBlob = new Blob(['mock content ' + item.name], { type: mime });
            const mockFile = new File([mockBlob], item.name, { type: mime, lastModified: item.date.getTime() });

            return {
                id: 'mock_' + idx,
                file: mockFile,
                name: item.name,
                date: item.date,
                isPdf,
                isExcel,
                isMock: true
            };
        });
    }

    function renderFileManagerPanel(rightCol) {
        if (!rightCol) return;
        if (document.getElementById('wameli-file-panel-root')) return;

        // Init with default sample files from screenshot if none loaded
        if (scannedFolderState.files.length === 0) {
            scannedFolderState.files = generateMockFiles();
        }

        const panel = document.createElement('div');
        panel.id = 'wameli-file-panel-root';
        panel.className = 'wameli-panel-card';

        panel.innerHTML = `
            <!-- Panel Header -->
            <div class="wameli-panel-header">
                <div class="wameli-panel-title">
                    <span style="font-size: 15px;">📁</span>
                    <span>Thư mục file</span>
                </div>
                <input type="text" id="wameli-folder-name-input" value="${scannedFolderState.folderName}" class="wameli-folder-name-input" title="Tên thư mục" />
                <div class="wameli-header-actions">
                    <input type="file" id="wameli-native-folder-input" webkitdirectory directory multiple style="display: none;" />
                    <input type="file" id="wameli-native-files-input" multiple style="display: none;" />
                    <button type="button" id="wameli-btn-select-folder" class="wameli-btn-blue" title="Chọn thư mục từ máy">
                        📁 Chọn
                    </button>
                    <button type="button" id="wameli-btn-reload-folder" class="wameli-btn-blue" title="Tải lại thư mục">
                        🔄 Tải lại
                    </button>
                    <button type="button" id="wameli-btn-collapse-panel" class="wameli-btn-toggle" title="Thu gọn / Mở rộng">
                        ▲
                    </button>
                </div>
            </div>

            <div id="wameli-panel-body-wrapper">
                <!-- Status Bar -->
                <div class="wameli-status-bar">
                    <div id="wameli-selection-count-text" class="wameli-status-text">
                        Đã chọn: 0 file (0 PDF, 0 Excel)
                    </div>
                    <div class="wameli-status-actions">
                        <button type="button" id="wameli-btn-load-selected-pdf" class="wameli-btn-sub-action">
                            ⚡ Nạp file PDF vào Form
                        </button>
                        <button type="button" id="wameli-btn-deselect-all" class="wameli-btn-sub-action">
                            Bỏ chọn
                        </button>
                    </div>
                </div>

                <!-- Column Headers -->
                <div class="wameli-col-headers">
                    <div class="wameli-col-title-left">Tên</div>
                    <div class="wameli-col-title-right">Ngày sửa đổi</div>
                </div>

                <!-- Date Groups Container -->
                <div id="wameli-groups-container" class="wameli-groups-container">
                    <!-- Groups rendered dynamically -->
                </div>
            </div>
        `;

        rightCol.appendChild(panel);

        // Bind panel controls
        const folderNameInput = panel.querySelector('#wameli-folder-name-input');
        const folderPicker = panel.querySelector('#wameli-native-folder-input');
        const filePicker = panel.querySelector('#wameli-native-files-input');
        const selectBtn = panel.querySelector('#wameli-btn-select-folder');
        const reloadBtn = panel.querySelector('#wameli-btn-reload-folder');
        const toggleBtn = panel.querySelector('#wameli-btn-collapse-panel');
        const bodyWrapper = panel.querySelector('#wameli-panel-body-wrapper');
        const deselectBtn = panel.querySelector('#wameli-btn-deselect-all');
        const loadPdfBtn = panel.querySelector('#wameli-btn-load-selected-pdf');

        // Toggle collapse
        toggleBtn.addEventListener('click', () => {
            if (bodyWrapper.style.display === 'none') {
                bodyWrapper.style.display = 'block';
                toggleBtn.textContent = '▲';
            } else {
                bodyWrapper.style.display = 'none';
                toggleBtn.textContent = '▼';
            }
        });

        // Trigger Folder Picker
        selectBtn.addEventListener('click', () => {
            folderPicker.click();
        });

        // Reload Folder
        reloadBtn.addEventListener('click', () => {
            folderPicker.click();
        });

        // Folder selected
        folderPicker.addEventListener('change', async (e) => {
            const rawFiles = Array.from(e.target.files || []);
            if (rawFiles.length === 0) return;
            const dirName = rawFiles[0]?.webkitRelativePath ? rawFiles[0].webkitRelativePath.split('/')[0] : 'Thư mục';
            scannedFolderState.folderName = dirName;
            folderNameInput.value = dirName;
            await processRawFiles(rawFiles);
        });

        // Drag & Drop onto panel
        panel.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.style.boxShadow = '0 0 0 2px #0284c7';
        });
        panel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.style.boxShadow = '';
        });
        panel.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.style.boxShadow = '';

            const items = e.dataTransfer.items;
            if (items && items.length > 0) {
                const files = await scanDataTransferItems(items);
                if (items[0].webkitGetAsEntry && items[0].webkitGetAsEntry()?.isDirectory) {
                    const name = items[0].webkitGetAsEntry().name;
                    scannedFolderState.folderName = name;
                    folderNameInput.value = name;
                }
                await processRawFiles(files);
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await processRawFiles(Array.from(e.dataTransfer.files));
            }
        });

        // Deselect all
        deselectBtn.addEventListener('click', () => {
            scannedFolderState.selectedIds.clear();
            renderGroupsList();
            updateStatusBar();
        });

        // Load selected PDF into form
        loadPdfBtn.addEventListener('click', () => {
            const selectedFiles = scannedFolderState.files.filter(f => scannedFolderState.selectedIds.has(f.id));
            let pdfsToLoad = selectedFiles.filter(f => f.isPdf);
            if (pdfsToLoad.length === 0) {
                // If none selected, take all PDFs from top group or entire list
                pdfsToLoad = scannedFolderState.files.filter(f => f.isPdf);
            }

            if (pdfsToLoad.length === 0) {
                showWameliToast('Không có file PDF nào để nạp!', false);
                return;
            }

            const formEls = findWameliOrderFormElements();
            if (formEls.pdfFileInput) {
                applyFilesToInput(formEls.pdfFileInput, pdfsToLoad.map(item => item.file));
                showWameliToast(`Đã nạp ${pdfsToLoad.length} file PDF vào Hóa đơn PDF!`);
            } else {
                showWameliToast('Không tìm thấy ô upload Hóa đơn PDF trên form!', false);
            }
        });

        renderGroupsList();
        updateStatusBar();
    }

    async function scanDataTransferItems(items) {
        const allFiles = [];
        async function readEntry(entry) {
            if (!entry) return;
            if (entry.isFile) {
                return new Promise(resolve => {
                    entry.file(f => {
                        allFiles.push(f);
                        resolve();
                    }, () => resolve());
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                const readAll = async () => {
                    return new Promise(resolve => {
                        dirReader.readEntries(async (entries) => {
                            if (entries.length === 0) {
                                resolve();
                            } else {
                                for (const sub of entries) {
                                    await readEntry(sub);
                                }
                                await readAll();
                                resolve();
                            }
                        }, () => resolve());
                    });
                };
                await readAll();
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

    async function processRawFiles(files) {
        const validItems = [];
        files.forEach((f, idx) => {
            const name = f.name;
            const lower = name.toLowerCase();
            const isPdf = lower.endsWith('.pdf');
            const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');

            if (isPdf || isExcel) {
                validItems.push({
                    id: 'real_' + Date.now() + '_' + idx,
                    file: f,
                    name: f.name,
                    date: new Date(f.lastModified || Date.now()),
                    isPdf,
                    isExcel,
                    isMock: false
                });
            }
        });

        if (validItems.length > 0) {
            scannedFolderState.files = validItems;
            scannedFolderState.selectedIds.clear();
            renderGroupsList();
            updateStatusBar();
            showWameliToast(`Đã nạp ${validItems.length} file từ thư mục!`);
        } else {
            showWameliToast('Không tìm thấy file PDF hoặc Excel trong thư mục!', false);
        }
    }

    function renderGroupsList() {
        const container = document.getElementById('wameli-groups-container');
        if (!container) return;

        container.innerHTML = '';

        if (scannedFolderState.files.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">Chưa có file nào trong thư mục</div>';
            return;
        }

        // Group files by date
        const todayKey = getDateKey(new Date());
        const yesterdayKey = getDateKey(new Date(Date.now() - 86400000));

        const groupsMap = new Map(); // dateKey -> array of files
        scannedFolderState.files.forEach(item => {
            const key = getDateKey(item.date);
            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
            }
            groupsMap.get(key).push(item);
        });

        // Sort groups (newest date first)
        const sortedDateKeys = Array.from(groupsMap.keys()).sort((a, b) => {
            const [da, ma, ya] = a.split('/').map(Number);
            const [db, mb, yb] = b.split('/').map(Number);
            return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
        });

        sortedDateKeys.forEach(dateKey => {
            const groupFiles = groupsMap.get(dateKey);
            // Sort files in group by date descending (newest first)
            groupFiles.sort((a, b) => b.date.getTime() - a.date.getTime());

            // Build Title
            let dateLabel = `Ngày (${dateKey})`;
            if (dateKey === todayKey) {
                dateLabel = `Hôm nay (${dateKey})`;
            } else if (dateKey === yesterdayKey) {
                dateLabel = `Hôm qua (${dateKey})`;
            }

            const pdfCount = groupFiles.filter(f => f.isPdf).length;
            const allChecked = groupFiles.every(f => scannedFolderState.selectedIds.has(f.id));

            const groupEl = document.createElement('div');
            groupEl.className = 'wameli-date-group-block';

            // Group Header HTML
            const headerEl = document.createElement('div');
            headerEl.className = 'wameli-group-header';
            headerEl.innerHTML = `
                <div class="wameli-group-header-left">
                    <input type="checkbox" class="wameli-group-checkbox" ${allChecked ? 'checked' : ''} style="cursor: pointer;" />
                    <span class="wameli-group-title">${dateLabel} (${groupFiles.length})</span>
                </div>
                <div class="wameli-group-actions">
                    <button type="button" class="wameli-btn-group-action btn-group-load-pair" title="Nạp file Excel và PDF mới nhất">
                        ⚡ Nạp cặp mới nhất
                    </button>
                    ${pdfCount > 0 ? `
                        <button type="button" class="wameli-btn-group-action btn-group-load-pdfs" title="Nạp toàn bộ ${pdfCount} file PDF trong nhóm này">
                            ⚡ Nạp ${pdfCount} PDF
                        </button>
                    ` : ''}
                </div>
            `;

            // Group Checkbox toggle
            const groupCheckbox = headerEl.querySelector('.wameli-group-checkbox');
            groupCheckbox.addEventListener('change', () => {
                const checked = groupCheckbox.checked;
                groupFiles.forEach(f => {
                    if (checked) {
                        scannedFolderState.selectedIds.add(f.id);
                    } else {
                        scannedFolderState.selectedIds.delete(f.id);
                    }
                });
                renderGroupsList();
                updateStatusBar();
            });

            // Action: Nạp cặp mới nhất
            headerEl.querySelector('.btn-group-load-pair').addEventListener('click', () => {
                const newestExcel = groupFiles.find(f => f.isExcel);
                const newestPdf = groupFiles.find(f => f.isPdf);

                const formEls = findWameliOrderFormElements();
                let loadedCount = 0;

                if (newestExcel && formEls.excelFileInput) {
                    applyFilesToInput(formEls.excelFileInput, [newestExcel.file]);
                    loadedCount++;
                }
                if (newestPdf && formEls.pdfFileInput) {
                    applyFilesToInput(formEls.pdfFileInput, [newestPdf.file]);
                    loadedCount++;
                }

                // Set file name
                if (newestExcel && formEls.fileNameInput) {
                    const baseName = newestExcel.name.replace(/\.[^/.]+$/, '');
                    formEls.fileNameInput.value = baseName;
                    dispatchChangeEvent(formEls.fileNameInput);
                } else if (newestPdf && formEls.fileNameInput) {
                    const baseName = newestPdf.name.replace(/\.[^/.]+$/, '');
                    formEls.fileNameInput.value = baseName;
                    dispatchChangeEvent(formEls.fileNameInput);
                }

                if (loadedCount > 0) {
                    showWameliToast(`Đã nạp cặp file mới nhất (${newestExcel?.name || newestPdf?.name})!`);
                } else {
                    showWameliToast('Không tìm thấy cặp file Excel & PDF trong nhóm này!', false);
                }
            });

            // Action: Nạp X PDF
            const loadPdfsBtn = headerEl.querySelector('.btn-group-load-pdfs');
            if (loadPdfsBtn) {
                loadPdfsBtn.addEventListener('click', () => {
                    const groupPdfs = groupFiles.filter(f => f.isPdf);
                    const formEls = findWameliOrderFormElements();
                    if (formEls.pdfFileInput && groupPdfs.length > 0) {
                        applyFilesToInput(formEls.pdfFileInput, groupPdfs.map(item => item.file));
                        showWameliToast(`Đã nạp ${groupPdfs.length} file PDF vào Hóa đơn PDF!`);
                    }
                });
            }

            groupEl.appendChild(headerEl);

            // Group File Items
            const itemsListEl = document.createElement('div');
            itemsListEl.className = 'wameli-group-items-list';

            groupFiles.forEach(item => {
                const isSelected = scannedFolderState.selectedIds.has(item.id);
                const rowEl = document.createElement('div');
                rowEl.className = 'wameli-file-row' + (isSelected ? ' selected' : '');

                const icon = item.isExcel ?
                    '<span style="color: #16a34a; font-size: 13px;">📊</span>' :
                    '<span style="color: #dc2626; font-size: 13px;">📄</span>';

                rowEl.innerHTML = `
                    <div class="wameli-file-left">
                        <input type="checkbox" class="wameli-file-item-checkbox" ${isSelected ? 'checked' : ''} style="cursor: pointer;" />
                        ${icon}
                        <span class="wameli-file-name-text" title="${item.name}">${item.name}</span>
                    </div>
                    <div class="wameli-file-date-text">
                        ${formatFileDateVi(item.date)}
                    </div>
                    <div class="wameli-file-row-actions">
                        <button type="button" class="wameli-btn-row-action wameli-btn-nap btn-row-nap" title="Nạp file này vào Form">
                            ⚡ Nạp
                        </button>
                        <button type="button" class="wameli-btn-row-action btn-row-copy" title="Copy tên file">
                            📋
                        </button>
                        <button type="button" class="wameli-btn-row-action btn-row-preview" title="Xem trước file">
                            👁️
                        </button>
                    </div>
                `;

                // Checkbox toggle
                const itemCheckbox = rowEl.querySelector('.wameli-file-item-checkbox');
                itemCheckbox.addEventListener('change', () => {
                    if (itemCheckbox.checked) {
                        scannedFolderState.selectedIds.add(item.id);
                        rowEl.classList.add('selected');
                    } else {
                        scannedFolderState.selectedIds.delete(item.id);
                        rowEl.classList.remove('selected');
                    }
                    updateStatusBar();
                });

                // Row Action: Nạp
                rowEl.querySelector('.btn-row-nap').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const formEls = findWameliOrderFormElements();
                    const baseName = item.name.replace(/\.[^/.]+$/, '');

                    if (item.isExcel && formEls.excelFileInput) {
                        applyFilesToInput(formEls.excelFileInput, [item.file]);
                        if (formEls.fileNameInput) {
                            formEls.fileNameInput.value = baseName;
                            dispatchChangeEvent(formEls.fileNameInput);
                        }
                        showWameliToast(`Đã nạp file Excel: ${item.name}`);
                    } else if (item.isPdf && formEls.pdfFileInput) {
                        applyFilesToInput(formEls.pdfFileInput, [item.file]);
                        showWameliToast(`Đã nạp file PDF: ${item.name}`);
                    }
                });

                // Row Action: Copy
                rowEl.querySelector('.btn-row-copy').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const baseName = item.name.replace(/\.[^/.]+$/, '');
                    navigator.clipboard.writeText(baseName).then(() => {
                        showWameliToast(`Đã copy: ${baseName}`);
                    });
                });

                // Row Action: Preview
                rowEl.querySelector('.btn-row-preview').addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        const url = URL.createObjectURL(item.file);
                        window.open(url, '_blank');
                    } catch (err) {
                        showWameliToast('Không thể mở xem trước file này', false);
                    }
                });

                itemsListEl.appendChild(rowEl);
            });

            groupEl.appendChild(itemsListEl);
            container.appendChild(groupEl);
        });
    }

    function updateStatusBar() {
        const statusText = document.getElementById('wameli-selection-count-text');
        if (!statusText) return;

        const selectedFiles = scannedFolderState.files.filter(f => scannedFolderState.selectedIds.has(f.id));
        const total = selectedFiles.length;
        const pdfCount = selectedFiles.filter(f => f.isPdf).length;
        const excelCount = selectedFiles.filter(f => f.isExcel).length;

        statusText.textContent = `Đã chọn: ${total} file (${pdfCount} PDF, ${excelCount} Excel)`;
    }

    function applyFilesToInput(inputEl, files) {
        if (!inputEl || !files || files.length === 0) return;
        try {
            const dt = new DataTransfer();
            files.forEach(f => dt.items.add(f));
            inputEl.files = dt.files;
            dispatchChangeEvent(inputEl);

            const parentRow = inputEl.closest('tr, .form-group, .row, div') || inputEl.parentElement;
            if (parentRow) {
                const label = parentRow.querySelector('.custom-file-label, .file-name, span');
                if (label && label.textContent.includes('Không')) {
                    label.textContent = files.length === 1 ? files[0].name : `Đã chọn ${files.length} tệp`;
                }
            }
        } catch (err) {
            console.warn('[Wameli Helper] Error applying files to input:', err);
        }
    }

    // --- Main Initializer for Order Upload Page ---
    function initWameliOrderUploadPage() {
        injectOrderUploadStyles();

        const formElements = findWameliOrderFormElements();
        const { sanSelect, khoSelect, shopSelect, gioSelect, ngayInput, fileNameInput } = formElements;

        // 1. Setup 2-Column Split Layout
        const layout = setupSplitLayout(formElements);
        const rightCol = layout ? layout.rightCol : document.getElementById('wameli-right-col');

        // 2. Setup Inline Form Chips
        if (sanSelect) setupSanChips(sanSelect);
        if (khoSelect) setupKhoChips(khoSelect);
        if (shopSelect) setupShopField(shopSelect);
        if (ngayInput) setupDateChips(ngayInput);
        if (gioSelect) setupHourChips(gioSelect);
        if (fileNameInput) setupFileNameField(fileNameInput);

        // 3. Setup Right File Manager Panel
        if (rightCol) {
            renderFileManagerPanel(rightCol);
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
