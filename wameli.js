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
    const SVG_XLS = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M4 2C4 1.45 4.45 1 5 1H13L18 6V18C18 18.55 17.55 19 17 19H5C4.45 19 4 18.55 4 18V2Z" fill="#fff" stroke="#188038" stroke-width="1.4"></path><path d="M13 1V6H18" fill="#e6f4ea" stroke="#188038" stroke-width="1.4"></path><rect x="3.5" y="9.5" width="13" height="6.5" rx="1" fill="#188038"></rect><text x="4.5" y="14.3" font-size="4.2" font-weight="bold" fill="#fff" font-family="Arial, sans-serif">XLS</text></svg>`;
    const SVG_PDF = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M4 2C4 1.45 4.45 1 5 1H13L18 6V18C18 18.55 17.55 19 17 19H5C4.45 19 4 18.55 4 18V2Z" fill="#fff" stroke="#d93025" stroke-width="1.4"></path><path d="M13 1V6H18" fill="#fce8e6" stroke="#d93025" stroke-width="1.4"></path><rect x="3.5" y="9.5" width="13" height="6.5" rx="1" fill="#d93025"></rect><text x="4.5" y="14.3" font-size="4.2" font-weight="bold" fill="#fff" font-family="Arial, sans-serif">PDF</text></svg>`;

    function injectOrderUploadStyles() {
        if (document.getElementById('wameli-order-helper-styles')) return;
        const style = document.createElement('style');
        style.id = 'wameli-order-helper-styles';
        style.textContent = `
            /* Split 2-Column Layout matching exact user spec */
            #wqf-add-order-two-cols {
                display: flex;
                gap: 16px;
                width: 100%;
                align-items: flex-start;
                margin-top: 8px;
                box-sizing: border-box;
            }
            .wqf-add-order-left-col {
                flex: 1 1 54%;
                min-width: 0;
            }
            .wqf-add-order-right-col {
                flex: 0 0 46%;
                min-width: 440px;
                position: sticky;
                top: 10px;
            }
            @media (max-width: 1200px) {
                #wqf-add-order-two-cols {
                    flex-direction: column;
                }
                .wqf-add-order-right-col {
                    width: 100%;
                    max-width: 100%;
                    position: static;
                }
            }

            /* Preset Toolbar (Lưu & Điền nhanh cấu hình) */
            .wqf-preset-bar {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 6px;
                margin-bottom: 14px;
                flex-wrap: wrap;
                font-family: inherit;
            }
            .wqf-preset-title {
                font-size: 12.5px;
                font-weight: 700;
                color: #166534;
                display: flex;
                align-items: center;
                gap: 4px;
                white-space: nowrap;
            }
            .wqf-preset-list {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
                flex: 1;
            }
            .wqf-preset-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                background: #ffffff;
                border: 1px solid #86efac;
                border-radius: 20px;
                font-size: 11.5px;
                font-weight: 600;
                color: #15803d;
                cursor: pointer;
                transition: all 0.15s ease;
                user-select: none;
            }
            .wqf-preset-chip:hover {
                background: #dcfce7;
                border-color: #22c55e;
                color: #14532d;
                transform: translateY(-1px);
            }
            .wqf-preset-chip.active {
                background: #16a34a !important;
                border-color: #16a34a !important;
                color: #ffffff !important;
                box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3);
            }
            .wqf-preset-del-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 15px;
                height: 15px;
                border-radius: 50%;
                background: rgba(0,0,0,0.08);
                color: inherit;
                font-size: 10px;
                line-height: 1;
                cursor: pointer;
                border: none;
                padding: 0;
                margin-left: 2px;
                transition: background 0.1s;
            }
            .wqf-preset-del-btn:hover {
                background: #ef4444;
                color: #ffffff;
            }
            .wqf-btn-save-preset {
                background: #16a34a;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 5px 12px;
                font-size: 11.5px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transition: background 0.15s ease;
                white-space: nowrap;
            }
            .wqf-btn-save-preset:hover {
                background: #15803d;
            }

            /* Inline Field Group & Buttons */
            .wqf-inline-field-group {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                flex-wrap: wrap !important;
                width: 100% !important;
                min-height: 34px !important;
            }
            .wqf-inline-field-group > .select2-container,
            .wqf-inline-field-group > input.form-control {
                width: 220px !important;
                min-width: 220px !important;
                max-width: 220px !important;
                flex: 0 0 220px !important;
                display: inline-block !important;
                box-sizing: border-box !important;
            }
            .wqf-add-select-buttons,
            .wqf-add-date-buttons {
                display: inline-flex !important;
                align-items: center !important;
                gap: 4px !important;
                flex-wrap: wrap !important;
            }
            .wqf-add-select-btn {
                background: #ffffff !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 4px !important;
                padding: 4px 8px !important;
                font-size: 11.5px !important;
                font-weight: 500 !important;
                color: #334155 !important;
                cursor: pointer !important;
                transition: all 0.15s ease !important;
                white-space: nowrap !important;
                line-height: 1.2 !important;
                user-select: none !important;
            }
            .wqf-add-select-btn:hover {
                background: #f1f5f9 !important;
                border-color: #94a3b8 !important;
                color: #0f172a !important;
            }
            .wqf-add-select-btn.wqf-active {
                background: #0284c7 !important;
                border-color: #0284c7 !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                box-shadow: 0 1px 3px rgba(2, 132, 199, 0.3) !important;
            }

            /* Full width controls: Shop & File name */
            #shop_id + .select2-container,
            .select2-container[data-select2-id*="shop_id"] {
                width: 100% !important;
                min-width: 100% !important;
                max-width: 100% !important;
                display: block !important;
            }
            #name.form-control {
                width: 100% !important;
                max-width: 100% !important;
            }

            /* Enhanced Multi-PDF Upload & Drop Box */
            .wqf-pdf-upload-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
                width: 100%;
            }
            .wqf-pdf-action-row {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .wqf-btn-multi-pdf {
                background: #0284c7;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 6px 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                transition: background 0.15s;
            }
            .wqf-btn-multi-pdf:hover {
                background: #0369a1;
            }
            .wqf-btn-attach-checked-pdf {
                background: #10b981;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 6px 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                transition: background 0.15s;
            }
            .wqf-btn-attach-checked-pdf:hover {
                background: #059669;
            }
            .wqf-btn-attach-checked-pdf:disabled {
                background: #94a3b8;
                cursor: not-allowed;
                opacity: 0.7;
            }
            .wqf-drop-zone {
                border: 2px dashed #cbd5e1;
                border-radius: 6px;
                padding: 10px 14px;
                background: #f8fafc;
                transition: all 0.2s ease;
            }
            .wqf-drop-zone.wqf-dragover {
                background: #eff6ff !important;
                border-color: #0284c7 !important;
                box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
            }
            .wqf-pdf-attached-list {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 6px;
            }
            .wqf-pdf-file-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 3px 8px;
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 4px;
                font-size: 11.5px;
                color: #991b1b;
                max-width: 280px;
            }
            .wqf-pdf-chip-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-weight: 500;
            }
            .wqf-pdf-chip-del {
                cursor: pointer;
                font-weight: bold;
                color: #ef4444;
                padding: 0 2px;
                border: none;
                background: none;
                line-height: 1;
                font-size: 13px;
            }
            .wqf-pdf-chip-del:hover {
                color: #b91c1c;
            }
            .wqf-pdf-clear-all {
                font-size: 11px;
                color: #dc2626;
                background: none;
                border: none;
                cursor: pointer;
                text-decoration: underline;
                margin-left: 4px;
            }

            /* Right Directory Manager */
            #wameli-directory-manager {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .wqf-dir-head {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            }
            .wqf-dir-title {
                font-size: 13px;
                font-weight: 700;
                color: #0284c7;
                white-space: nowrap;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .wqf-dir-input {
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                color: #334155;
                background: #ffffff;
                flex: 1;
                min-width: 100px;
                outline: none;
                transition: border-color 0.15s;
            }
            .wqf-dir-input:focus {
                border-color: #0284c7;
            }
            .wqf-dir-btn {
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
            .wqf-dir-btn:hover {
                background: #0369a1;
            }
            .wqf-btn-secondary {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                color: #475569;
            }
            .wqf-btn-secondary:hover {
                background: #f1f5f9;
                color: #0f172a;
            }
            .wqf-dir-body {
                display: block;
            }

            /* Explorer Top Bar */
            .wqf-explorer-top-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #ecfdf5;
                border-bottom: 1px solid #a7f3d0;
                padding: 6px 12px;
                font-size: 11.5px;
            }
            .wqf-selected-count {
                color: #166534;
                font-weight: 600;
            }
            .wqf-dir-act-btn {
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
            .wqf-dir-act-btn:hover {
                background: #f8fafc;
                border-color: #94a3b8;
                color: #0f172a;
            }
            .wqf-btn-attach {
                color: #0284c7;
                border-color: #bae6fd;
                background: #f0f9ff;
            }
            .wqf-btn-attach:hover {
                background: #e0f2fe;
                border-color: #0284c7;
            }

            /* Explorer Column Head */
            .wqf-explorer-head {
                display: grid;
                grid-template-columns: 24px 1fr 140px 96px;
                align-items: center;
                padding: 6px 12px;
                border-bottom: 1px solid #e2e8f0;
                background: #ffffff;
                font-size: 12px;
                font-weight: 700;
                color: #334155;
            }

            /* Explorer List & Groups */
            .wqf-explorer-list {
                max-height: 480px;
                overflow-y: auto;
                background: #ffffff;
            }
            .wqf-explorer-group {
                border-bottom: 1px solid #e2e8f0;
            }
            .wqf-explorer-group-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                background: #f8fafc;
                border-bottom: 1px solid #f1f5f9;
                font-size: 12px;
            }
            .wqf-explorer-group-title {
                font-weight: 700;
                color: #0284c7;
                white-space: nowrap;
                cursor: pointer;
            }
            .wqf-explorer-group-line {
                flex: 1;
                height: 1px;
                background: #e2e8f0;
                margin: 0 4px;
            }
            .wqf-explorer-group-actions {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .wqf-explorer-btn {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 2px 7px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.15s ease;
            }
            .wqf-pair-btn, .wqf-all-pdf-btn {
                color: #0284c7;
                border-color: #cbd5e1;
            }
            .wqf-pair-btn:hover, .wqf-all-pdf-btn:hover {
                background: #f0f9ff;
                border-color: #0284c7;
            }

            /* Explorer Row */
            .wqf-explorer-row {
                display: grid;
                grid-template-columns: 24px 1fr 140px 96px;
                align-items: center;
                padding: 5px 12px;
                border-bottom: 1px solid #f8fafc;
                font-size: 12px;
                color: #1e293b;
                transition: background 0.1s ease;
            }
            .wqf-explorer-row:hover {
                background: #f8fafc;
            }
            .wqf-explorer-row.selected {
                background: #f0fdf4;
            }
            .wqf-explorer-checkbox {
                cursor: pointer;
            }
            .wqf-explorer-file-info {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
                overflow: hidden;
                cursor: grab;
            }
            .wqf-explorer-icon {
                display: inline-flex;
                align-items: center;
                flex-shrink: 0;
            }
            .wqf-explorer-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-weight: 500;
            }
            .wqf-explorer-date {
                font-size: 11px;
                color: #64748b;
                text-align: right;
                padding-right: 4px;
                white-space: nowrap;
            }
            .wqf-explorer-actions {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 4px;
            }
            .wqf-btn-row-attach {
                color: #0284c7;
                font-weight: 700;
                background: #f0f9ff;
                border-color: #bae6fd;
                padding: 2px 6px;
            }
            .wqf-btn-row-attach:hover {
                background: #e0f2fe;
                border-color: #0284c7;
            }
            .wqf-btn-row-copy, .wqf-btn-row-view {
                padding: 2px 5px;
                color: #475569;
            }
            .wqf-btn-row-copy:hover, .wqf-btn-row-view:hover {
                background: #f1f5f9;
                border-color: #94a3b8;
            }

            /* Toast Notification */
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
        toast.innerHTML = `<span>${isSuccess ? '✅' : 'ℹ️'}</span> <span>${escapeHtml(message)}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.transition = 'opacity 0.3s ease';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }
        }, 2200);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

    function setSelect2Value(selectEl, value) {
        if (!selectEl) return;
        selectEl.value = value;
        if (window.$ && typeof window.$(selectEl).val === 'function') {
            try {
                window.$(selectEl).val(value).trigger('change');
            } catch (e) { }
        }
        dispatchChangeEvent(selectEl);

        const rendered = document.getElementById('select2-' + selectEl.id + '-container');
        const selectedOpt = selectEl.selectedOptions[0];
        if (rendered && selectedOpt) {
            rendered.textContent = selectedOpt.text;
            rendered.title = selectedOpt.text;
        }
    }

    function findWameliOrderFormElements() {
        const sanSelect = document.getElementById('platform_id') || document.querySelector('select[name="platform_id"]');
        const khoSelect = document.getElementById('warehouse_id') || document.querySelector('select[name="warehouse_id"]');
        const shopSelect = document.getElementById('shop_id') || document.querySelector('select[name="shop_id"]');
        const gioSelect = document.getElementById('house_id') || document.querySelector('select[name="house_id"]');
        const ngayInput = document.getElementById('date') || document.querySelector('input[name="date"]');
        const fileNameInput = document.getElementById('name') || document.querySelector('input[name="name"]');
        const pdfFileInput = document.getElementById('file_pdf') || document.querySelector('input[name="file_pdf[]"]');
        const excelFileInput = document.getElementById('file_xlsx') || document.querySelector('input[name="file_xlsx"]');

        let panelBody = null;
        const refEl = sanSelect || khoSelect || ngayInput || pdfFileInput;
        if (refEl) {
            panelBody = refEl.closest('.panel-body') || refEl.closest('form') || refEl.parentElement;
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
            panelBody
        };
    }

    // --- Split 2-Column Layout Setup ---
    function setupOrderUploadLayout(panelBody) {
        if (!panelBody) return null;

        const existingTwoCols = document.getElementById('wqf-add-order-two-cols');
        if (existingTwoCols) {
            if (existingTwoCols.contains(panelBody)) {
                return {
                    wrapper: existingTwoCols,
                    leftCol: existingTwoCols.querySelector('.wqf-add-order-left-col'),
                    rightCol: existingTwoCols.querySelector('.wqf-add-order-right-col')
                };
            } else {
                existingTwoCols.remove();
            }
        }

        const twoCols = document.createElement('div');
        twoCols.id = 'wqf-add-order-two-cols';
        twoCols.className = 'wqf-add-order-two-cols';

        const leftCol = document.createElement('div');
        leftCol.className = 'wqf-add-order-left-col';

        const rightCol = document.createElement('div');
        rightCol.className = 'wqf-add-order-right-col';

        twoCols.appendChild(leftCol);
        twoCols.appendChild(rightCol);

        panelBody.parentNode.insertBefore(twoCols, panelBody);
        leftCol.appendChild(panelBody);

        return { wrapper: twoCols, leftCol, rightCol };
    }

    // ==========================================
    // PRESET TOOLBAR: LƯU & ĐIỀN NHANH CẤU HÌNH
    // ==========================================
    function setupPresetToolbar(panelBody) {
        if (!panelBody) return;
        if (document.getElementById('wqf-preset-bar')) return;

        const presetBar = document.createElement('div');
        presetBar.id = 'wqf-preset-bar';
        presetBar.className = 'wqf-preset-bar';

        presetBar.innerHTML = `
            <div class="wqf-preset-title">
                <span>⚡ Mẫu điền nhanh:</span>
            </div>
            <div id="wqf-preset-list" class="wqf-preset-list"></div>
            <button type="button" id="wqf-btn-save-preset" class="wqf-btn-save-preset" title="Lưu cấu hình Sàn, Kho, Giờ, Ngày hiện tại thành mẫu điền nhanh">
                💾 Lưu mẫu hiện tại
            </button>
        `;

        panelBody.insertBefore(presetBar, panelBody.firstChild);

        function getStoredPresets() {
            try {
                const raw = localStorage.getItem('wqf_saved_presets');
                if (raw) return JSON.parse(raw);
            } catch (e) { }

            // Default starter presets
            return [
                { id: 'p_shopee_8h', name: 'Shopee - Kho HN - 8H', platform_id: '2', warehouse_id: '1', house_id: '3', is_seeding: '0' },
                { id: 'p_tiktok_9h', name: 'Ticktok - Kho HN - 9H', platform_id: '9', warehouse_id: '1', house_id: '9', is_seeding: '0' }
            ];
        }

        function saveStoredPresets(presets) {
            localStorage.setItem('wqf_saved_presets', JSON.stringify(presets));
        }

        function applyPreset(preset, chipEl) {
            const formEls = findWameliOrderFormElements();

            // 1. Sàn
            if (preset.platform_id && formEls.sanSelect) {
                setSelect2Value(formEls.sanSelect, preset.platform_id);
                document.querySelectorAll('.wqf-add-select-buttons[data-key="platform"] .wqf-add-select-btn').forEach(b => {
                    if (b.getAttribute('data-value') === preset.platform_id) {
                        b.classList.add('wqf-active');
                    } else {
                        b.classList.remove('wqf-active');
                    }
                });
            }

            // 2. Kho
            if (preset.warehouse_id && formEls.khoSelect) {
                setSelect2Value(formEls.khoSelect, preset.warehouse_id);
                document.querySelectorAll('.wqf-add-select-buttons[data-key="warehouse"] .wqf-add-select-btn').forEach(b => {
                    if (b.getAttribute('data-value') === preset.warehouse_id) {
                        b.classList.add('wqf-active');
                    } else {
                        b.classList.remove('wqf-active');
                    }
                });
            }

            // 3. Giờ
            if (preset.house_id && formEls.gioSelect) {
                setSelect2Value(formEls.gioSelect, preset.house_id);
                document.querySelectorAll('.wqf-add-select-buttons[data-key="hour"] .wqf-add-select-btn').forEach(b => {
                    if (b.getAttribute('data-value') === preset.house_id) {
                        b.classList.add('wqf-active');
                    } else {
                        b.classList.remove('wqf-active');
                    }
                });
            }

            // 4. Ngày: Always apply today
            if (formEls.ngayInput) {
                const todayStr = formatWameliDate(new Date());
                formEls.ngayInput.value = todayStr;
                dispatchChangeEvent(formEls.ngayInput);
                document.querySelectorAll('.wqf-add-date-buttons .wqf-add-select-btn').forEach(b => {
                    if (b.textContent.trim().toLowerCase().includes('nay')) {
                        b.classList.add('wqf-active');
                    } else {
                        b.classList.remove('wqf-active');
                    }
                });
            }

            // 5. Seeding radio
            if (preset.is_seeding !== undefined) {
                const seedingRadio = document.getElementById('is_seeding_' + preset.is_seeding);
                if (seedingRadio) {
                    seedingRadio.checked = true;
                    dispatchChangeEvent(seedingRadio);
                }
            }

            // 6. Shop
            if (preset.shop_id && preset.shop_id !== '0' && formEls.shopSelect) {
                setSelect2Value(formEls.shopSelect, preset.shop_id);
            }

            // Active visual chip
            presetBar.querySelectorAll('.wqf-preset-chip').forEach(c => c.classList.remove('active'));
            if (chipEl) chipEl.classList.add('active');

            showWameliToast(`⚡ Đã áp dụng mẫu: ${preset.name}!`);
        }

        function renderPresets() {
            const listEl = presetBar.querySelector('#wqf-preset-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            const presets = getStoredPresets();
            presets.forEach(p => {
                const chip = document.createElement('div');
                chip.className = 'wqf-preset-chip';
                chip.innerHTML = `
                    <span>⭐ ${escapeHtml(p.name)}</span>
                    <button type="button" class="wqf-preset-del-btn" title="Xóa mẫu này">×</button>
                `;

                chip.addEventListener('click', (e) => {
                    if (e.target.classList.contains('wqf-preset-del-btn')) return;
                    applyPreset(p, chip);
                });

                chip.querySelector('.wqf-preset-del-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Bạn có chắc muốn xóa mẫu "${p.name}"?`)) {
                        const updated = getStoredPresets().filter(item => item.id !== p.id);
                        saveStoredPresets(updated);
                        renderPresets();
                        showWameliToast(`Đã xóa mẫu: ${p.name}`);
                    }
                });

                listEl.appendChild(chip);
            });
        }

        renderPresets();

        // Save current form values as new preset
        presetBar.querySelector('#wqf-btn-save-preset').addEventListener('click', () => {
            const formEls = findWameliOrderFormElements();

            const sanText = formEls.sanSelect?.selectedOptions[0]?.text?.replace(/--/g, '').trim() || 'Shopee';
            const khoText = formEls.khoSelect?.selectedOptions[0]?.text?.replace(/--/g, '').trim() || 'Kho HN';
            const gioText = formEls.gioSelect?.selectedOptions[0]?.text?.replace(/--/g, '').trim() || '8H';

            const defaultName = `${sanText} - ${khoText} - ${gioText}`;
            const name = prompt('Nhập tên mẫu điền nhanh để lưu:', defaultName);
            if (!name || !name.trim()) return;

            const seedingEl = document.querySelector('input[name="is_seeding"]:checked');

            const newPreset = {
                id: 'p_' + Date.now(),
                name: name.trim(),
                platform_id: formEls.sanSelect ? formEls.sanSelect.value : '2',
                warehouse_id: formEls.khoSelect ? formEls.khoSelect.value : '1',
                house_id: formEls.gioSelect ? formEls.gioSelect.value : '3',
                shop_id: formEls.shopSelect ? formEls.shopSelect.value : '0',
                is_seeding: seedingEl ? seedingEl.value : '0'
            };

            const presets = getStoredPresets();
            presets.push(newPreset);
            saveStoredPresets(presets);
            renderPresets();
            showWameliToast(`Đã lưu mẫu điền nhanh: ${newPreset.name}!`);
        });
    }

    // --- Sàn Suggestion Buttons ---
    function setupPlatformInlineButtons(platformSelect) {
        if (!platformSelect) return;
        const formGroup = platformSelect.closest('.form-group');
        if (!formGroup) return;
        const col10 = formGroup.querySelector('.col-md-10') || platformSelect.parentElement;
        if (!col10) return;

        if (col10.querySelector('.wqf-inline-field-group')) return;

        let select2Container = col10.querySelector('.select2-container');

        const inlineGroup = document.createElement('div');
        inlineGroup.className = 'wqf-inline-field-group';

        if (select2Container) {
            select2Container.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
            inlineGroup.appendChild(select2Container);
        } else {
            platformSelect.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
            inlineGroup.appendChild(platformSelect);
        }

        const buttonsWrap = document.createElement('span');
        buttonsWrap.className = 'wqf-add-select-buttons';
        buttonsWrap.setAttribute('data-key', 'platform');

        const platformItems = [
            { label: 'Shopee', value: '2' },
            { label: 'Ticktok', value: '9' },
            { label: 'Best', value: '8' },
            { label: 'Đơn ngoài', value: '6' },
            { label: 'Viettel', value: '10' },
            { label: 'Lazada', value: '1' },
            { label: 'Tiki', value: '3' }
        ];

        platformItems.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wqf-add-select-btn';
            btn.setAttribute('data-value', item.value);
            btn.title = item.label;
            btn.textContent = item.label;

            if (platformSelect.value === item.value) {
                btn.classList.add('wqf-active');
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                setSelect2Value(platformSelect, item.value);
                buttonsWrap.querySelectorAll('.wqf-add-select-btn').forEach(b => b.classList.remove('wqf-active'));
                btn.classList.add('wqf-active');
                localStorage.setItem('wqf_pref_platform', item.value);
            });

            buttonsWrap.appendChild(btn);
        });

        inlineGroup.appendChild(buttonsWrap);
        col10.appendChild(inlineGroup);

        platformSelect.setAttribute('data-wqf-add-buttons-ready', '1');

        platformSelect.addEventListener('change', () => {
            const curVal = platformSelect.value;
            buttonsWrap.querySelectorAll('.wqf-add-select-btn').forEach(b => {
                if (b.getAttribute('data-value') === curVal) {
                    b.classList.add('wqf-active');
                } else {
                    b.classList.remove('wqf-active');
                }
            });
        });

        const observer = new MutationObserver(() => {
            const s2 = col10.querySelector(':scope > .select2-container');
            if (s2 && !inlineGroup.contains(s2)) {
                s2.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
                inlineGroup.insertBefore(s2, inlineGroup.firstChild);
            }
        });
        observer.observe(col10, { childList: true });
    }

    // --- Kho Suggestion Buttons ---
    function setupWarehouseInlineButtons(warehouseSelect) {
        if (!warehouseSelect) return;
        const formGroup = warehouseSelect.closest('.form-group');
        if (!formGroup) return;
        const col10 = formGroup.querySelector('.col-md-10') || warehouseSelect.parentElement;
        if (!col10) return;

        if (col10.querySelector('.wqf-inline-field-group')) return;

        let select2Container = col10.querySelector('.select2-container');

        const inlineGroup = document.createElement('div');
        inlineGroup.className = 'wqf-inline-field-group';

        if (select2Container) {
            select2Container.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
            inlineGroup.appendChild(select2Container);
        } else {
            warehouseSelect.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
            inlineGroup.appendChild(warehouseSelect);
        }

        const buttonsWrap = document.createElement('span');
        buttonsWrap.className = 'wqf-add-select-buttons';
        buttonsWrap.setAttribute('data-key', 'warehouse');

        const warehouseItems = [
            { label: 'Kho Hà Nội', value: '1' },
            { label: 'Kho Hồ Chí Minh', value: '2' }
        ];

        warehouseItems.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wqf-add-select-btn';
            btn.setAttribute('data-value', item.value);
            btn.title = item.label;
            btn.textContent = item.label;

            if (warehouseSelect.value === item.value) {
                btn.classList.add('wqf-active');
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                setSelect2Value(warehouseSelect, item.value);
                buttonsWrap.querySelectorAll('.wqf-add-select-btn').forEach(b => b.classList.remove('wqf-active'));
                btn.classList.add('wqf-active');
                localStorage.setItem('wqf_pref_warehouse', item.value);
            });

            buttonsWrap.appendChild(btn);
        });

        inlineGroup.appendChild(buttonsWrap);
        col10.appendChild(inlineGroup);

        warehouseSelect.setAttribute('data-wqf-add-buttons-ready', '1');

        warehouseSelect.addEventListener('change', () => {
            const curVal = warehouseSelect.value;
            buttonsWrap.querySelectorAll('.wqf-add-select-btn').forEach(b => {
                if (b.getAttribute('data-value') === curVal) {
                    b.classList.add('wqf-active');
                } else {
                    b.classList.remove('wqf-active');
                }
            });
        });

        const observer = new MutationObserver(() => {
            const s2 = col10.querySelector(':scope > .select2-container');
            if (s2 && !inlineGroup.contains(s2)) {
                s2.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
                inlineGroup.insertBefore(s2, inlineGroup.firstChild);
            }
        });
        observer.observe(col10, { childList: true });
    }

    // --- Shop Field: 100% full width, no buttons ---
    function setupShopField(shopSelect) {
        if (!shopSelect) return;
        const formGroup = shopSelect.closest('.form-group');
        if (!formGroup) return;
        const col10 = formGroup.querySelector('.col-md-10') || shopSelect.parentElement;
        if (!col10) return;

        const s2 = col10.querySelector('.select2-container');
        if (s2) {
            s2.style.cssText = 'width: 100% !important; min-width: 100% !important; max-width: 100% !important; display: block !important;';
        }
        shopSelect.style.cssText = 'width: 100% !important; max-width: 100% !important;';

        const legacy = col10.querySelector('.wqf-add-select-buttons, .wameli-inline-chips');
        if (legacy) legacy.remove();
    }

    // --- Ngày Suggestion Buttons ---
    function setupDateInlineButtons(dateInput) {
        if (!dateInput) return;
        const formGroup = dateInput.closest('.form-group');
        if (!formGroup) return;
        const col10 = formGroup.querySelector('.col-md-10') || dateInput.parentElement;
        if (!col10) return;

        if (col10.querySelector('.wqf-inline-field-group')) return;

        const inlineGroup = document.createElement('div');
        inlineGroup.className = 'wqf-inline-field-group';

        dateInput.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
        dateInput.setAttribute('data-wqf-add-date-ready', '1');

        const now = new Date();
        const todayStr = formatWameliDate(now);
        const yesterdayStr = formatWameliDate(new Date(Date.now() - 86400000));
        const tomorrowStr = formatWameliDate(new Date(Date.now() + 86400000));

        if (!dateInput.value.trim()) {
            dateInput.value = todayStr;
        }

        const buttonsWrap = document.createElement('span');
        buttonsWrap.className = 'wqf-add-date-buttons';

        const dateOptions = [
            { label: 'Hom nay', val: todayStr },
            { label: 'Hom qua', val: yesterdayStr },
            { label: 'Ngay mai', val: tomorrowStr }
        ];

        dateOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wqf-add-select-btn';
            btn.textContent = opt.label;
            btn.dataset.val = opt.val;

            if (dateInput.value.trim() === opt.val) {
                btn.classList.add('wqf-active');
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                dateInput.value = opt.val;
                dispatchChangeEvent(dateInput);
                buttonsWrap.querySelectorAll('.wqf-add-select-btn').forEach(b => b.classList.remove('wqf-active'));
                btn.classList.add('wqf-active');
            });

            buttonsWrap.appendChild(btn);
        });

        dateInput.parentNode.insertBefore(inlineGroup, dateInput);
        inlineGroup.appendChild(dateInput);
        inlineGroup.appendChild(buttonsWrap);

        dateInput.addEventListener('input', () => {
            const cur = dateInput.value.trim();
            buttonsWrap.querySelectorAll('.wqf-add-select-btn').forEach(b => {
                if (b.dataset.val === cur) {
                    b.classList.add('wqf-active');
                } else {
                    b.classList.remove('wqf-active');
                }
            });
        });
    }

    // --- Giờ Suggestion Buttons ---
    function setupHourInlineButtons(hourSelect) {
        if (!hourSelect) return;
        const formGroup = hourSelect.closest('.form-group');
        if (!formGroup) return;
        const col10 = formGroup.querySelector('.col-md-10') || hourSelect.parentElement;
        if (!col10) return;

        if (col10.querySelector('.wqf-inline-field-group')) return;

        let select2Container = col10.querySelector('.select2-container');

        const inlineGroup = document.createElement('div');
        inlineGroup.className = 'wqf-inline-field-group';

        if (select2Container) {
            select2Container.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
            inlineGroup.appendChild(select2Container);
        } else {
            hourSelect.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
            inlineGroup.appendChild(hourSelect);
        }

        const buttonsWrap = document.createElement('span');
        buttonsWrap.className = 'wqf-add-select-buttons';
        buttonsWrap.setAttribute('data-key', 'hour');

        const hourOptions = [
            { label: '0H', value: '0' },
            { label: '8H', value: '3' },
            { label: '9H', value: '9' },
            { label: '10H', value: '5' },
            { label: '11H', value: '6' },
            { label: '13H', value: '7' },
            { label: '14H', value: '10' },
            { label: '15H', value: '11' },
            { label: '16H', value: '12' },
            { label: '23H', value: '18' }
        ];

        hourOptions.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wqf-add-select-btn';
            btn.setAttribute('data-value', opt.value);
            btn.title = opt.label;
            btn.textContent = opt.label;

            if (hourSelect.value === opt.value || (!hourSelect.value && idx === 0)) {
                btn.classList.add('wqf-active');
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                setSelect2Value(hourSelect, opt.value);
                buttonsWrap.querySelectorAll('.wqf-add-select-btn').forEach(b => b.classList.remove('wqf-active'));
                btn.classList.add('wqf-active');
                localStorage.setItem('wqf_pref_hour', opt.value);
            });

            buttonsWrap.appendChild(btn);
        });

        inlineGroup.appendChild(buttonsWrap);
        col10.appendChild(inlineGroup);

        hourSelect.setAttribute('data-wqf-add-buttons-ready', '1');

        hourSelect.addEventListener('change', () => {
            const curVal = hourSelect.value;
            buttonsWrap.querySelectorAll('.wqf-add-select-btn').forEach(b => {
                if (b.getAttribute('data-value') === curVal) {
                    b.classList.add('wqf-active');
                } else {
                    b.classList.remove('wqf-active');
                }
            });
        });

        const observer = new MutationObserver(() => {
            const s2 = col10.querySelector(':scope > .select2-container');
            if (s2 && !inlineGroup.contains(s2)) {
                s2.style.cssText = 'width: 220px !important; min-width: 220px !important; max-width: 220px !important; flex: 0 0 220px !important; display: inline-block !important; box-sizing: border-box !important;';
                inlineGroup.insertBefore(s2, inlineGroup.firstChild);
            }
        });
        observer.observe(col10, { childList: true });
    }

    // --- File Name: Full width ---
    function setupFileNameField(nameInput) {
        if (!nameInput) return;
        nameInput.style.cssText = 'width: 100% !important; max-width: 100% !important; display: block !important;';
    }

    // ==========================================
    // MULTI-PDF UPLOAD & DROP MANAGER
    // ==========================================
    let attachedPdfFiles = []; // Array of File objects currently attached to Hóa đơn PDF

    function setupPdfMultiFileManager(pdfFileInput) {
        if (!pdfFileInput) return;
        const formGroup = pdfFileInput.closest('.form-group');
        if (!formGroup || formGroup.dataset.wqfPdfManagerReady === '1') return;
        formGroup.dataset.wqfPdfManagerReady = '1';

        const col10 = formGroup.querySelector('.col-md-10') || pdfFileInput.parentElement;
        if (!col10) return;

        // Container
        const container = document.createElement('div');
        container.className = 'wqf-pdf-upload-container';

        // Action row with Quick Buttons
        const actionRow = document.createElement('div');
        actionRow.className = 'wqf-pdf-action-row';

        const hiddenPicker = document.createElement('input');
        hiddenPicker.type = 'file';
        hiddenPicker.multiple = true;
        hiddenPicker.accept = '.pdf,application/pdf';
        hiddenPicker.style.display = 'none';

        actionRow.innerHTML = `
            <button type="button" class="wqf-btn-multi-pdf wqf-pick-pdf-btn" title="Bấm để chọn 1 hoặc nhiều file PDF từ máy tính">
                📂 Chọn nhiều file PDF
            </button>
            <button type="button" class="wqf-btn-attach-checked-pdf wqf-attach-checked-btn" title="Nạp toàn bộ các file PDF đang được tích chọn ở danh sách bên phải vào ô này">
                ⚡ Nạp file PDF đã chọn từ thư mục (<span class="wqf-count-badge">0</span>)
            </button>
            <span style="font-size: 11.5px; color: #64748b;">
                (Hoặc kéo thả nhiều file PDF vào đây)
            </span>
        `;
        actionRow.appendChild(hiddenPicker);

        // Attached list container
        const listContainer = document.createElement('div');
        listContainer.className = 'wqf-pdf-attached-list';
        listContainer.id = 'wqf-pdf-attached-list';

        // Drop zone wrapper
        const dropBox = document.createElement('div');
        dropBox.className = 'wqf-drop-zone';

        // Move existing upload button inside dropBox
        const existingUpload = col10.querySelector('.fileUpload');
        if (existingUpload) {
            dropBox.appendChild(existingUpload);
        }
        dropBox.appendChild(actionRow);
        dropBox.appendChild(listContainer);

        col10.appendChild(dropBox);

        function updateAttachedPdfUI() {
            listContainer.innerHTML = '';
            const badge = actionRow.querySelector('.wqf-count-badge');
            const checkedPdfs = scannedFolderState.files.filter(f => scannedFolderState.selectedIds.has(f.id) && f.isPdf);
            if (badge) badge.textContent = checkedPdfs.length;

            if (attachedPdfFiles.length === 0) return;

            const headerInfo = document.createElement('div');
            headerInfo.style.cssText = 'width: 100%; font-size: 11.5px; font-weight: 700; color: #166534; display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;';
            headerInfo.innerHTML = `
                <span>📄 Đã nạp ${attachedPdfFiles.length} file PDF:</span>
                <button type="button" class="wqf-pdf-clear-all" title="Xóa tất cả file PDF đã nạp">Xóa tất cả</button>
            `;
            headerInfo.querySelector('.wqf-pdf-clear-all').addEventListener('click', () => {
                attachedPdfFiles = [];
                syncAttachedPdfsToNativeInput(pdfFileInput);
                updateAttachedPdfUI();
                showWameliToast('Đã xóa tất cả file PDF đã nạp!');
            });
            listContainer.appendChild(headerInfo);

            attachedPdfFiles.forEach((f, idx) => {
                const chip = document.createElement('div');
                chip.className = 'wqf-pdf-file-chip';
                chip.innerHTML = `
                    <span>📄</span>
                    <span class="wqf-pdf-chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
                    <span style="font-size: 10.5px; color: #64748b;">(${formatFileSize(f.size)})</span>
                    <button type="button" class="wqf-pdf-chip-del" title="Xóa file này">×</button>
                `;

                chip.querySelector('.wqf-pdf-chip-del').addEventListener('click', (e) => {
                    e.stopPropagation();
                    attachedPdfFiles.splice(idx, 1);
                    syncAttachedPdfsToNativeInput(pdfFileInput);
                    updateAttachedPdfUI();
                    showWameliToast(`Đã gỡ file: ${f.name}`);
                });

                listContainer.appendChild(chip);
            });
        }

        // Hidden input picker
        const pickBtn = actionRow.querySelector('.wqf-pick-pdf-btn');
        pickBtn.addEventListener('click', () => hiddenPicker.click());

        hiddenPicker.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            addPdfFiles(files);
            hiddenPicker.value = '';
        });

        // Quick attach checked button
        const attachCheckedBtn = actionRow.querySelector('.wqf-attach-checked-btn');
        attachCheckedBtn.addEventListener('click', () => {
            const checkedPdfs = scannedFolderState.files.filter(f => scannedFolderState.selectedIds.has(f.id) && f.isPdf);
            if (checkedPdfs.length === 0) {
                // If none checked, take all PDFs from active list
                const allPdfs = scannedFolderState.files.filter(f => f.isPdf);
                if (allPdfs.length > 0) {
                    addPdfFiles(allPdfs.map(item => item.file));
                    showWameliToast(`Đã nạp ${allPdfs.length} file PDF vào Hóa đơn PDF!`);
                } else {
                    showWameliToast('Không có file PDF nào trong thư mục!', false);
                }
                return;
            }

            addPdfFiles(checkedPdfs.map(item => item.file));
            showWameliToast(`Đã nạp ${checkedPdfs.length} file PDF đã chọn vào Hóa đơn PDF!`);
        });

        function addPdfFiles(files) {
            let addedCount = 0;
            files.forEach(f => {
                if (!f.name.toLowerCase().endsWith('.pdf')) return;
                // Avoid exact duplicate
                if (!attachedPdfFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
                    attachedPdfFiles.push(f);
                    addedCount++;
                }
            });

            syncAttachedPdfsToNativeInput(pdfFileInput);
            updateAttachedPdfUI();
            if (addedCount > 0) {
                showWameliToast(`Đã thêm ${addedCount} file PDF vào form!`);
            }
        }

        window._wqf_add_pdf_files = addPdfFiles;
        window._wqf_update_attached_pdf_ui = updateAttachedPdfUI;

        // Native PDF input listener
        pdfFileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
                addPdfFiles(files);
            }
        });

        // Drop zone listeners
        dropBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropBox.classList.add('wqf-dragover');
        });
        dropBox.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropBox.classList.remove('wqf-dragover');
        });
        dropBox.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropBox.classList.remove('wqf-dragover');

            let files = [];
            if (window._wqf_dragged_files && window._wqf_dragged_files.length > 0) {
                files = window._wqf_dragged_files;
            } else if (window._wqf_dragged_file) {
                files = [window._wqf_dragged_file];
            } else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                files = Array.from(e.dataTransfer.files);
            }

            const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
            if (pdfs.length > 0) {
                addPdfFiles(pdfs);
            } else {
                showWameliToast('Vui lòng chỉ thả file .pdf vào ô Hóa đơn PDF!', false);
            }
        });

        updateAttachedPdfUI();
    }

    function syncAttachedPdfsToNativeInput(inputEl) {
        if (!inputEl) return;
        try {
            const dt = new DataTransfer();
            attachedPdfFiles.forEach(f => dt.items.add(f));
            inputEl.files = dt.files;
            dispatchChangeEvent(inputEl);

            const container = inputEl.closest('.form-group, .fileUpload, div');
            if (container) {
                const helpBlock = container.querySelector('.help-block, .file-name');
                if (helpBlock) {
                    helpBlock.textContent = attachedPdfFiles.length === 0 ?
                        'Không có tệp nào được chọn' :
                        (attachedPdfFiles.length === 1 ? attachedPdfFiles[0].name : `Đã chọn ${attachedPdfFiles.length} tệp`);
                }
            }
        } catch (err) {
            console.warn('[Wameli] Error syncing attached PDFs:', err);
        }
    }

    // --- Drop Zones for Đơn hàng Excel ---
    function setupExcelDropZone(excelFileInput, nameInput) {
        if (!excelFileInput) return;
        const formGroup = excelFileInput.closest('.form-group');
        if (!formGroup || formGroup.dataset.wqfExcelBound === '1') return;
        formGroup.dataset.wqfExcelBound = '1';
        formGroup.classList.add('wqf-drop-zone');

        formGroup.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            formGroup.classList.add('wqf-dragover');
        });

        formGroup.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            formGroup.classList.remove('wqf-dragover');
        });

        formGroup.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            formGroup.classList.remove('wqf-dragover');

            let files = [];
            if (window._wqf_dragged_file) {
                files = [window._wqf_dragged_file];
            } else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                files = Array.from(e.dataTransfer.files);
            }

            const excels = files.filter(f => {
                const l = f.name.toLowerCase();
                return l.endsWith('.xlsx') || l.endsWith('.xls') || l.endsWith('.csv');
            });

            if (excels.length > 0) {
                applyFilesToInput(excelFileInput, [excels[0]]);
                if (nameInput) {
                    nameInput.value = excels[0].name.replace(/\.[^/.]+$/, '');
                    dispatchChangeEvent(nameInput);
                }
                showWameliToast(`Đã tải file Excel: ${excels[0].name}!`);
            } else {
                showWameliToast('Vui lòng chỉ thả file Excel (.xlsx, .xls) vào ô Đơn hàng Excel!', false);
            }
        });
    }

    // --- Right Directory Manager State & Handlers ---
    let scannedFolderState = {
        folderName: localStorage.getItem('wqf_last_folder') || 'tải xuống 2',
        files: [],
        selectedIds: new Set()
    };

    function isValidOrderFile(file) {
        if (!file || !file.name) return false;
        const name = file.name;
        if (name.startsWith('~$') || name.startsWith('._') || name.startsWith('.')) return false;

        const lower = name.toLowerCase();
        const isPdf = lower.endsWith('.pdf');
        const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
        return isPdf || isExcel;
    }

    function generateMockFiles() {
        const today = new Date();
        const yesterday = new Date(Date.now() - 86400000);
        const dayBeforeYesterday = new Date(Date.now() - 3 * 86400000);

        function createTime(baseDate, h, m) {
            const d = new Date(baseDate);
            d.setHours(h, m, 0, 0);
            return d;
        }

        const mockList = [
            // Group Hôm nay (06/10/2026) (5)
            { name: 'mass_update_sales_info_80369669_20261006103708.xlsx', size: 74.7 * 1024, date: createTime(today, 9, 37) },
            { name: '0610-gdd-0931-1.xlsx', size: 9.7 * 1024, date: createTime(today, 9, 33) },
            { name: '0610-gdd-0931-1.pdf', size: 186.0 * 1024, date: createTime(today, 9, 31) },
            { name: '0610-bce-0809-1.xlsx', size: 17.8 * 1024, date: createTime(today, 8, 9) },
            { name: '0610-bce-0809-1.pdf', size: 186.8 * 1024, date: createTime(today, 8, 9) },

            // Group Hôm qua (05/10/2026) (7)
            { name: 'Mau_Nhap_San_Pham_SoSanhGia.xlsx', size: 19.3 * 1024, date: createTime(yesterday, 23, 42) },
            { name: '0510-gdd-0808-1.xlsx', size: 19.5 * 1024, date: createTime(yesterday, 8, 8) },
            { name: '0510-gdd-0807-3.pdf', size: 186.5 * 1024, date: createTime(yesterday, 8, 8) },
            { name: '0510-gdd-0807-2.pdf', size: 218.7 * 1024, date: createTime(yesterday, 8, 7) },
            { name: '0510-gdd-0807-1.pdf', size: 185.9 * 1024, date: createTime(yesterday, 8, 7) },
            { name: '0510-joy-0804-1.xlsx', size: 17.8 * 1024, date: createTime(yesterday, 8, 4) },
            { name: '0510-joy-0804-1.pdf', size: 186.0 * 1024, date: createTime(yesterday, 8, 4) },

            // Group Ngày 03/10/2026 (9)
            { name: '0310-gdd-1005-4.xlsx', size: 17.7 * 1024, date: createTime(dayBeforeYesterday, 10, 5) },
            { name: '0310-gdd-1005-2.pdf', size: 234.2 * 1024, date: createTime(dayBeforeYesterday, 10, 5) },
            { name: '0310-bce-0921-2.xlsx', size: 17.8 * 1024, date: createTime(dayBeforeYesterday, 9, 21) },
            { name: '0310-bce-0921-2.pdf', size: 188.4 * 1024, date: createTime(dayBeforeYesterday, 9, 21) },
            { name: '0310-gdd-0901-2.xlsx', size: 9.9 * 1024, date: createTime(dayBeforeYesterday, 9, 2) },
            { name: '0310-bce-0759-1.xlsx', size: 17.8 * 1024, date: createTime(dayBeforeYesterday, 7, 59) },
            { name: '0310-bce-0759-1.pdf', size: 187.1 * 1024, date: createTime(dayBeforeYesterday, 7, 59) },
            { name: '0310-gdd-0759-1.xlsx', size: 17.7 * 1024, date: createTime(dayBeforeYesterday, 7, 59) },
            { name: '0310-gdd-0759-1.pdf', size: 218.4 * 1024, date: createTime(dayBeforeYesterday, 7, 59) }
        ];

        return mockList.map((item, idx) => {
            const isPdf = item.name.toLowerCase().endsWith('.pdf');
            const isExcel = !isPdf;
            const mime = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const dummyBytes = new Uint8Array(Math.round(item.size || 1024));
            const mockBlob = new Blob([dummyBytes], { type: mime });
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

    async function selectFolderFromDisk() {
        if (typeof window.showDirectoryPicker === 'function') {
            try {
                const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
                if (!dirHandle) return;

                const folderName = dirHandle.name;
                scannedFolderState.folderName = folderName;
                localStorage.setItem('wqf_last_folder', folderName);
                const folderInput = document.querySelector('.wqf-dir-input');
                if (folderInput) folderInput.value = folderName;

                const foundFiles = [];
                async function scanDir(dir, depth = 0) {
                    if (depth > 2) return;
                    for await (const entry of dir.values()) {
                        if (entry.kind === 'file') {
                            try {
                                const file = await entry.getFile();
                                if (isValidOrderFile(file)) {
                                    foundFiles.push(file);
                                }
                            } catch (e) { }
                        } else if (entry.kind === 'directory') {
                            try {
                                await scanDir(entry, depth + 1);
                            } catch (e) { }
                        }
                    }
                }

                await scanDir(dirHandle, 0);
                await processRawFiles(foundFiles);
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn('[Wameli Folder Picker] showDirectoryPicker error, using input fallback:', err);
            }
        }

        const folderPicker = document.getElementById('wqf-hidden-dir-picker');
        if (folderPicker) {
            folderPicker.click();
        }
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
            if (!isValidOrderFile(f)) return; // Strictly only Excel (.xlsx, .xls, .csv) & PDF (.pdf)

            validItems.push({
                id: 'real_' + Date.now() + '_' + idx,
                file: f,
                name: f.name,
                date: new Date(f.lastModified || Date.now()),
                isPdf: f.name.toLowerCase().endsWith('.pdf'),
                isExcel: !f.name.toLowerCase().endsWith('.pdf'),
                isMock: false
            });
        });

        if (validItems.length > 0) {
            scannedFolderState.files = validItems;
            scannedFolderState.selectedIds.clear();
            renderExplorerList();
            updateExplorerStatusBar();
            showWameliToast(`Đã nạp ${validItems.length} file (PDF & Excel) nhóm theo ngày!`);
        } else {
            scannedFolderState.files = [];
            renderExplorerList();
            updateExplorerStatusBar();
            showWameliToast('Không tìm thấy file Excel hoặc PDF nào trong thư mục!', false);
        }
    }

    function renderDirectoryManager(rightCol) {
        if (!rightCol) return;
        if (document.getElementById('wameli-directory-manager')) return;

        const manager = document.createElement('div');
        manager.id = 'wameli-directory-manager';
        manager.innerHTML = `
          <div class="wqf-dir-head">
            <div class="wqf-dir-title">📁 Thư mục file</div>
            <input type="text" class="wqf-dir-input" placeholder="Dán link / đường dẫn..." value="${escapeHtml(scannedFolderState.folderName)}">
            <button type="button" class="wqf-dir-btn wqf-dir-pick-btn" title="Chọn thư mục trên máy tính">📂 Chọn</button>
            <button type="button" class="wqf-dir-btn wqf-btn-secondary wqf-dir-refresh-btn" title="Quét tải lại các file mới nhất từ thư mục đã chọn mà không cần chọn lại">🔄 Tải lại</button>
            <button type="button" class="wqf-dir-btn wqf-btn-secondary wqf-dir-toggle-btn" title="Thu gọn / Mở rộng">▲</button>
            <input type="file" id="wqf-hidden-dir-picker" webkitdirectory="" directory="" multiple="" style="display: none;">
          </div>
          <div class="wqf-dir-body">
            <div class="wqf-explorer-top-bar">
              <span class="wqf-selected-count">Đã chọn: 0 file (0 PDF, 0 Excel)</span>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="wqf-dir-act-btn wqf-btn-attach wqf-batch-attach-pdf-btn" disabled="" style="opacity: 0.55; pointer-events: none;">⚡ Nạp file PDF vào Form</button>
                <button type="button" class="wqf-dir-act-btn wqf-unselect-all-btn" disabled="" style="opacity: 0.55;">Bỏ chọn</button>
              </div>
            </div>
            <div class="wqf-explorer-head">
              <div></div>
              <div>Tên</div>
              <div style="text-align: right; padding-right: 4px;">Ngày sửa đổi</div>
              <div></div>
            </div>
            <div class="wqf-explorer-list" id="wqf-explorer-list"></div>
          </div>
        `;

        rightCol.appendChild(manager);

        const dirInput = manager.querySelector('.wqf-dir-input');
        const pickBtn = manager.querySelector('.wqf-dir-pick-btn');
        const refreshBtn = manager.querySelector('.wqf-dir-refresh-btn');
        const toggleBtn = manager.querySelector('.wqf-dir-toggle-btn');
        const hiddenPicker = manager.querySelector('#wqf-hidden-dir-picker');
        const dirBody = manager.querySelector('.wqf-dir-body');
        const batchPdfBtn = manager.querySelector('.wqf-batch-attach-pdf-btn');
        const unselectAllBtn = manager.querySelector('.wqf-unselect-all-btn');

        toggleBtn.addEventListener('click', () => {
            if (dirBody.style.display === 'none') {
                dirBody.style.display = 'block';
                toggleBtn.textContent = '▲';
            } else {
                dirBody.style.display = 'none';
                toggleBtn.textContent = '▼';
            }
        });

        pickBtn.addEventListener('click', () => selectFolderFromDisk());
        refreshBtn.addEventListener('click', () => selectFolderFromDisk());

        hiddenPicker.addEventListener('change', async (e) => {
            const rawFiles = Array.from(e.target.files || []);
            if (rawFiles.length === 0) return;
            const dirName = rawFiles[0]?.webkitRelativePath ? rawFiles[0].webkitRelativePath.split('/')[0] : 'tải xuống 2';
            scannedFolderState.folderName = dirName;
            localStorage.setItem('wqf_last_folder', dirName);
            if (dirInput) dirInput.value = dirName;
            await processRawFiles(rawFiles);
        });

        manager.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            manager.style.boxShadow = '0 0 0 2px #0284c7';
        });
        manager.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            manager.style.boxShadow = '';
        });
        manager.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            manager.style.boxShadow = '';

            const items = e.dataTransfer.items;
            if (items && items.length > 0) {
                const files = await scanDataTransferItems(items);
                if (items[0].webkitGetAsEntry && items[0].webkitGetAsEntry()?.isDirectory) {
                    const name = items[0].webkitGetAsEntry().name;
                    scannedFolderState.folderName = name;
                    localStorage.setItem('wqf_last_folder', name);
                    if (dirInput) dirInput.value = name;
                }
                await processRawFiles(files);
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await processRawFiles(Array.from(e.dataTransfer.files));
            }
        });

        unselectAllBtn.addEventListener('click', () => {
            scannedFolderState.selectedIds.clear();
            renderExplorerList();
            updateExplorerStatusBar();
        });

        batchPdfBtn.addEventListener('click', () => {
            const selectedFiles = scannedFolderState.files.filter(f => scannedFolderState.selectedIds.has(f.id));
            let pdfsToLoad = selectedFiles.filter(f => f.isPdf);
            if (pdfsToLoad.length === 0) {
                pdfsToLoad = scannedFolderState.files.filter(f => f.isPdf);
            }
            if (pdfsToLoad.length === 0) {
                showWameliToast('Không có file PDF nào để nạp!', false);
                return;
            }

            if (typeof window._wqf_add_pdf_files === 'function') {
                window._wqf_add_pdf_files(pdfsToLoad.map(item => item.file));
                showWameliToast(`Đã nạp ${pdfsToLoad.length} file PDF vào Hóa đơn PDF!`);
            } else {
                const formEls = findWameliOrderFormElements();
                if (formEls.pdfFileInput) {
                    applyFilesToInput(formEls.pdfFileInput, pdfsToLoad.map(item => item.file));
                    showWameliToast(`Đã nạp ${pdfsToLoad.length} file PDF vào Hóa đơn PDF!`);
                }
            }
        });

        if (scannedFolderState.files.length === 0) {
            scannedFolderState.files = generateMockFiles();
        }

        renderExplorerList();
        updateExplorerStatusBar();
    }

    function renderExplorerList() {
        const listContainer = document.getElementById('wqf-explorer-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (scannedFolderState.files.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 28px 16px; text-align: center; color: #64748b; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 6px; margin: 10px;">
                    <div style="font-size: 32px; margin-bottom: 6px;">📂</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0284c7; margin-bottom: 4px;">
                        Chưa có file trong thư mục
                    </div>
                    <div style="font-size: 11.5px; color: #64748b; margin-bottom: 12px; line-height: 1.5;">
                        Bấm nút <b>[ 📂 Chọn ]</b> ở trên để chọn thư mục từ máy tính (ví dụ <i>${escapeHtml(scannedFolderState.folderName || 'tải xuống 2')}</i>)<br/>
                        <span style="color: #059669; font-weight: 600;">(Hệ thống tự động lọc chỉ lấy file Excel & PDF nhóm theo ngày)</span>
                    </div>
                    <button type="button" class="wqf-dir-btn btn-empty-pick-folder" style="font-size: 11.5px; padding: 5px 12px; margin: 0 auto;">
                        📂 Chọn Thư Mục
                    </button>
                </div>
            `;
            listContainer.querySelector('.btn-empty-pick-folder')?.addEventListener('click', () => selectFolderFromDisk());
            return;
        }

        const todayKey = getDateKey(new Date());
        const yesterdayKey = getDateKey(new Date(Date.now() - 86400000));

        const groupsMap = new Map();
        scannedFolderState.files.forEach(item => {
            const key = getDateKey(item.date);
            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
            }
            groupsMap.get(key).push(item);
        });

        const sortedDateKeys = Array.from(groupsMap.keys()).sort((a, b) => {
            const [da, ma, ya] = a.split('/').map(Number);
            const [db, mb, yb] = b.split('/').map(Number);
            return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
        });

        sortedDateKeys.forEach(dateKey => {
            const groupFiles = groupsMap.get(dateKey);
            groupFiles.sort((a, b) => b.date.getTime() - a.date.getTime());

            let dateLabel = `Ngày ${dateKey}`;
            if (dateKey === todayKey) {
                dateLabel = `Hôm nay (${dateKey})`;
            } else if (dateKey === yesterdayKey) {
                dateLabel = `Hôm qua (${dateKey})`;
            }

            const pdfCount = groupFiles.filter(f => f.isPdf).length;
            const allChecked = groupFiles.every(f => scannedFolderState.selectedIds.has(f.id));

            const groupEl = document.createElement('div');
            groupEl.className = 'wqf-explorer-group';

            const headerEl = document.createElement('div');
            headerEl.className = 'wqf-explorer-group-header';
            headerEl.innerHTML = `
                <input type="checkbox" class="wqf-group-checkbox" ${allChecked ? 'checked' : ''} title="Chọn tất cả file trong ngày này" style="cursor: pointer;" />
                <span class="wqf-explorer-group-title">${dateLabel} (${groupFiles.length})</span>
                <div class="wqf-explorer-group-line"></div>
                <div class="wqf-explorer-group-actions">
                  <button type="button" class="wqf-explorer-btn wqf-pair-btn" title="Nạp 1 cặp PDF &amp; Excel mới nhất của ngày này">⚡ Nạp cặp mới nhất</button>
                  ${pdfCount > 0 ? `
                    <button type="button" class="wqf-explorer-btn wqf-all-pdf-btn" title="Nạp tất cả ${pdfCount} file PDF của ngày này vào form">⚡ Nạp ${pdfCount} PDF</button>
                  ` : ''}
                </div>
            `;

            // Group checkbox toggles all files in this group
            headerEl.querySelector('.wqf-group-checkbox')?.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                groupFiles.forEach(f => {
                    if (isChecked) {
                        scannedFolderState.selectedIds.add(f.id);
                    } else {
                        scannedFolderState.selectedIds.delete(f.id);
                    }
                });
                renderExplorerList();
                updateExplorerStatusBar();
            });

            headerEl.querySelector('.wqf-pair-btn')?.addEventListener('click', () => {
                const newestExcel = groupFiles.find(f => f.isExcel);
                const newestPdf = groupFiles.find(f => f.isPdf);

                const formEls = findWameliOrderFormElements();
                let loadedCount = 0;

                if (newestExcel && formEls.excelFileInput) {
                    applyFilesToInput(formEls.excelFileInput, [newestExcel.file]);
                    loadedCount++;
                }
                if (newestPdf) {
                    if (typeof window._wqf_add_pdf_files === 'function') {
                        window._wqf_add_pdf_files([newestPdf.file]);
                    } else if (formEls.pdfFileInput) {
                        applyFilesToInput(formEls.pdfFileInput, [newestPdf.file]);
                    }
                    loadedCount++;
                }

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
                    showWameliToast('Không tìm thấy file Excel hoặc PDF trong nhóm này!', false);
                }
            });

            const loadPdfsBtn = headerEl.querySelector('.wqf-all-pdf-btn');
            if (loadPdfsBtn) {
                loadPdfsBtn.addEventListener('click', () => {
                    const groupPdfs = groupFiles.filter(f => f.isPdf);
                    if (groupPdfs.length > 0) {
                        if (typeof window._wqf_add_pdf_files === 'function') {
                            window._wqf_add_pdf_files(groupPdfs.map(item => item.file));
                        } else {
                            const formEls = findWameliOrderFormElements();
                            if (formEls.pdfFileInput) {
                                applyFilesToInput(formEls.pdfFileInput, groupPdfs.map(item => item.file));
                            }
                        }
                        showWameliToast(`Đã nạp ${groupPdfs.length} file PDF vào Hóa đơn PDF!`);
                    }
                });
            }

            groupEl.appendChild(headerEl);

            groupFiles.forEach(item => {
                const isSelected = scannedFolderState.selectedIds.has(item.id);
                const rowEl = document.createElement('div');
                rowEl.className = 'wqf-explorer-row' + (isSelected ? ' selected' : '');
                rowEl.draggable = true;
                rowEl.setAttribute('data-file-id', item.id);

                const iconSvg = item.isExcel ? SVG_XLS : SVG_PDF;
                const fileSizeStr = item.file?.size ? formatFileSize(item.file.size) : '';
                const tooltipTitle = `${item.name}${fileSizeStr ? ` (${fileSizeStr})` : ''} - Kéo thả vào ô upload`;

                rowEl.innerHTML = `
                  <input type="checkbox" class="wqf-explorer-checkbox" title="Chọn file" ${isSelected ? 'checked' : ''}>
                  <div class="wqf-explorer-file-info" title="${escapeHtml(tooltipTitle)}">
                    <span class="wqf-explorer-icon">${iconSvg}</span>
                    <span class="wqf-explorer-name">${escapeHtml(item.name)}</span>
                  </div>
                  <div class="wqf-explorer-date">${formatFileDateVi(item.date)}</div>
                  <div class="wqf-explorer-actions">
                    <button type="button" class="wqf-explorer-btn wqf-btn-row-attach" title="Nạp file ${item.isExcel ? 'Excel' : 'PDF'} này vào form">⚡ Nạp</button>
                    <button type="button" class="wqf-explorer-btn wqf-btn-row-copy" title="Sao chép tên file">📋</button>
                    <button type="button" class="wqf-explorer-btn wqf-btn-row-view" title="Xem trước file">👁</button>
                  </div>
                `;

                const checkbox = rowEl.querySelector('.wqf-explorer-checkbox');
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        scannedFolderState.selectedIds.add(item.id);
                        rowEl.classList.add('selected');
                    } else {
                        scannedFolderState.selectedIds.delete(item.id);
                        rowEl.classList.remove('selected');
                    }
                    updateExplorerStatusBar();
                });

                // Drag support: If this row or multiple rows are selected, drag all selected
                rowEl.addEventListener('dragstart', (e) => {
                    const selectedFiles = scannedFolderState.files.filter(f => scannedFolderState.selectedIds.has(f.id));
                    if (selectedFiles.length > 1 && scannedFolderState.selectedIds.has(item.id)) {
                        window._wqf_dragged_files = selectedFiles.map(x => x.file);
                        window._wqf_dragged_file = item.file;
                    } else {
                        window._wqf_dragged_files = [item.file];
                        window._wqf_dragged_file = item.file;
                    }

                    e.dataTransfer.setData('text/plain', item.name);
                    e.dataTransfer.effectAllowed = 'copyMove';
                });
                rowEl.addEventListener('dragend', () => {
                    window._wqf_dragged_file = null;
                    window._wqf_dragged_files = null;
                });

                rowEl.querySelector('.wqf-btn-row-attach').addEventListener('click', (e) => {
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
                    } else if (item.isPdf) {
                        if (typeof window._wqf_add_pdf_files === 'function') {
                            window._wqf_add_pdf_files([item.file]);
                        } else if (formEls.pdfFileInput) {
                            applyFilesToInput(formEls.pdfFileInput, [item.file]);
                        }
                        showWameliToast(`Đã nạp file PDF: ${item.name}`);
                    }
                });

                rowEl.querySelector('.wqf-btn-row-copy').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const baseName = item.name.replace(/\.[^/.]+$/, '');
                    navigator.clipboard.writeText(baseName).then(() => {
                        showWameliToast(`Đã sao chép: ${baseName}`);
                    });
                });

                rowEl.querySelector('.wqf-btn-row-view').addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        const url = URL.createObjectURL(item.file);
                        window.open(url, '_blank');
                    } catch (err) {
                        showWameliToast('Không thể mở xem trước file này', false);
                    }
                });

                groupEl.appendChild(rowEl);
            });

            listContainer.appendChild(groupEl);
        });
    }

    function updateExplorerStatusBar() {
        const statusText = document.querySelector('.wqf-selected-count');
        const batchPdfBtn = document.querySelector('.wqf-batch-attach-pdf-btn');
        const unselectAllBtn = document.querySelector('.wqf-unselect-all-btn');

        const selectedFiles = scannedFolderState.files.filter(f => scannedFolderState.selectedIds.has(f.id));
        const total = selectedFiles.length;
        const pdfCount = selectedFiles.filter(f => f.isPdf).length;
        const excelCount = selectedFiles.filter(f => f.isExcel).length;

        if (statusText) {
            statusText.textContent = `Đã chọn: ${total} file (${pdfCount} PDF, ${excelCount} Excel)`;
        }

        // Also update badge on form button
        const formPdfBadge = document.querySelector('.wqf-btn-attach-checked-pdf .wqf-count-badge');
        if (formPdfBadge) {
            formPdfBadge.textContent = pdfCount;
        }

        if (batchPdfBtn) {
            if (pdfCount > 0) {
                batchPdfBtn.disabled = false;
                batchPdfBtn.style.opacity = '1';
                batchPdfBtn.style.pointerEvents = 'auto';
                batchPdfBtn.textContent = `⚡ Nạp ${pdfCount} file PDF vào Form`;
            } else {
                batchPdfBtn.disabled = true;
                batchPdfBtn.style.opacity = '0.55';
                batchPdfBtn.style.pointerEvents = 'none';
                batchPdfBtn.textContent = '⚡ Nạp file PDF vào Form';
            }
        }

        if (unselectAllBtn) {
            if (total > 0) {
                unselectAllBtn.disabled = false;
                unselectAllBtn.style.opacity = '1';
            } else {
                unselectAllBtn.disabled = true;
                unselectAllBtn.style.opacity = '0.55';
            }
        }
    }

    function applyFilesToInput(inputEl, files) {
        if (!inputEl || !files || files.length === 0) return;
        try {
            const dt = new DataTransfer();
            files.forEach(f => dt.items.add(f));
            inputEl.files = dt.files;
            dispatchChangeEvent(inputEl);

            const container = inputEl.closest('.form-group, .fileUpload, div');
            if (container) {
                const helpBlock = container.querySelector('.help-block, .file-name');
                if (helpBlock) {
                    helpBlock.textContent = files.length === 1 ? files[0].name : `Đã nạp ${files.length} tệp`;
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
        const { sanSelect, khoSelect, shopSelect, gioSelect, ngayInput, fileNameInput, pdfFileInput, excelFileInput, panelBody } = formElements;

        if (!panelBody) return;

        // 1. Setup 2-Column Split Layout
        const layout = setupOrderUploadLayout(panelBody);
        const rightCol = layout ? layout.rightCol : document.querySelector('.wqf-add-order-right-col');

        // 2. Setup Preset Toolbar (Lưu & Điền nhanh cấu hình)
        setupPresetToolbar(panelBody);

        // 3. Setup Inline Form Suggestions
        if (sanSelect) setupPlatformInlineButtons(sanSelect);
        if (khoSelect) setupWarehouseInlineButtons(khoSelect);
        if (shopSelect) setupShopField(shopSelect);
        if (ngayInput) setupDateInlineButtons(ngayInput);
        if (gioSelect) setupHourInlineButtons(gioSelect);
        if (fileNameInput) setupFileNameField(fileNameInput);

        // 4. Setup Multi-PDF Upload & Excel Drop Zone
        if (pdfFileInput) setupPdfMultiFileManager(pdfFileInput);
        if (excelFileInput) setupExcelDropZone(excelFileInput, fileNameInput);

        // 5. Setup Right Directory Manager
        if (rightCol) {
            renderDirectoryManager(rightCol);
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
