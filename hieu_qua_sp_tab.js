(function() {
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-hieu-qua-sp"]');
    const btnRead = document.getElementById('btn-read-hieu-qua-sp');
    const btnOpen = document.getElementById('btn-open-hieu-qua-sp');
    const btnCopy = document.getElementById('btn-copy-hieu-qua-sp');
    const searchInput = document.getElementById('input-search-hieu-qua-sp');
    const statusText = document.getElementById('hieu-qua-sp-status');
    const tableThead = document.getElementById('hieu-qua-sp-thead');
    const tableTbody = document.getElementById('hieu-qua-sp-tbody');

    let allRows = [];
    let dynamicHeaders = [];
    let isReading = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isTabActive() {
        const tab = document.getElementById('tab-hieu-qua-sp');
        return tab && !tab.hidden && tab.classList.contains('active');
    }

    function setStatus(msg, isError = false) {
        if (!statusText) return;
        statusText.textContent = msg;
        statusText.style.color = isError ? '#ef4444' : '#64748b';
    }

    function ensureContentScriptInjected(tabId) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: "PING" }, (res) => {
                if (chrome.runtime.lastError || !res || !res.ok) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ["xlsx.full.min.js", "content.js"]
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.warn("Lỗi inject content script:", chrome.runtime.lastError);
                            resolve(false);
                        } else {
                            setTimeout(() => resolve(true), 200);
                        }
                    });
                } else {
                    resolve(true);
                }
            });
        });
    }

    async function readPerformanceData(auto = false) {
        if (isReading) return;
        isReading = true;
        if (btnRead) btnRead.disabled = true;
        if (!auto) setStatus("Đang đọc dữ liệu từ trang Shopee...");

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                if (!auto) setStatus("Không tìm thấy tab trình duyệt đang mở.", true);
                return;
            }

            const isDataCenterUrl = tab.url && (tab.url.includes("/datacenter/product/performance") || tab.url.includes("/datacenter/product"));
            if (!isDataCenterUrl) {
                if (!auto) {
                    setStatus("Vui lòng mở trang Hiệu quả sản phẩm: banhang.shopee.vn/datacenter/product/performance", true);
                } else if (!allRows.length && tableTbody) {
                    tableTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 15px; color: #64748b;">Chờ mở trang <a href="https://banhang.shopee.vn/datacenter/product/performance" target="_blank" style="color:#2563eb; font-weight:600;">Hiệu quả sản phẩm Shopee</a>...</td></tr>`;
                }
                return;
            }

            await ensureContentScriptInjected(tab.id);

            const response = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PRODUCT_PERFORMANCE" }, (res) => {
                    resolve(res || { ok: false, error: chrome.runtime.lastError?.message || "Không phản hồi" });
                });
            });

            if (!response || !response.ok) {
                if (!auto) {
                    setStatus(`Lỗi: ${response?.error || "Không đọc được dữ liệu sản phẩm"}`, true);
                }
                return;
            }

            allRows = response.rows || [];
            dynamicHeaders = response.headers || [];

            renderTableHeaders(dynamicHeaders);
            renderTable();
            setStatus(`Đã đọc ${allRows.length} sản phẩm thành công.`);
        } catch (err) {
            if (!auto) setStatus(`Lỗi: ${err.message}`, true);
        } finally {
            isReading = false;
            if (btnRead) btnRead.disabled = false;
        }
    }

    function renderTableHeaders(headers) {
        if (!tableThead) return;

        // Custom clean headers or dynamic
        let html = `<tr>
            <th style="padding: 8px 6px; border-bottom: 1px solid #cbd5e1; min-width: 40px; text-align: center; background: #f8fafc;">STT</th>
            <th style="padding: 8px 6px; border-bottom: 1px solid #cbd5e1; min-width: 50px; text-align: center; background: #f8fafc;">Ảnh</th>
            <th style="padding: 8px 6px; border-bottom: 1px solid #cbd5e1; min-width: 200px; background: #f8fafc;">Tên sản phẩm</th>
            <th style="padding: 8px 6px; border-bottom: 1px solid #cbd5e1; min-width: 110px; background: #f8fafc;">Mã sản phẩm</th>`;

        // If extra metric columns exist in dynamic headers
        if (headers && headers.length > 0) {
            const metricHeaders = headers.filter(h => {
                const norm = h.toLowerCase();
                return !norm.includes("sản phẩm") && !norm.includes("thông tin") && !norm.includes("stt");
            });
            metricHeaders.forEach(mh => {
                html += `<th style="padding: 8px 6px; border-bottom: 1px solid #cbd5e1; min-width: 85px; white-space: nowrap; background: #f8fafc;">${escapeHtml(mh)}</th>`;
            });
        } else {
            html += `<th style="padding: 8px 6px; border-bottom: 1px solid #cbd5e1; min-width: 140px; background: #f8fafc;">Chỉ số hiệu quả</th>`;
        }

        html += `</tr>`;
        tableThead.innerHTML = html;
    }

    function renderTable() {
        if (!tableTbody) return;

        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        let filtered = allRows;

        if (query) {
            filtered = allRows.filter(row => {
                return (row.title && row.title.toLowerCase().includes(query)) ||
                       (row.productId && row.productId.toLowerCase().includes(query)) ||
                       (row.sku && row.sku.toLowerCase().includes(query)) ||
                       (row.subtitle && row.subtitle.toLowerCase().includes(query)) ||
                       (row.rawText && row.rawText.toLowerCase().includes(query));
            });
        }

        if (filtered.length === 0) {
            tableTbody.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 15px; color: #64748b;">${allRows.length === 0 ? 'Chưa có dữ liệu. Bấm "Đọc Trang Hiện Tại" để tải.' : 'Không tìm thấy sản phẩm phù hợp với từ khóa.'}</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        filtered.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #f1f5f9";

            const thumbImg = row.imgUrl ? 
                `<a href="${escapeHtml(row.imgUrl)}" target="_blank" rel="noreferrer" title="Xem ảnh">
                    <img src="${escapeHtml(row.imgUrl)}" style="width: 36px; height: 36px; border-radius: 4px; object-fit: cover; border: 1px solid #e2e8f0; display: block; margin: 0 auto;" loading="lazy">
                 </a>` : 
                `<div style="width: 36px; height: 36px; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 10px; margin: 0 auto;">No img</div>`;

            const copyIdBtn = row.productId ? 
                `<button class="btn-copy-mini" data-copy="${escapeHtml(row.productId)}" style="cursor: pointer; border: none; background: #eff6ff; color: #2563eb; font-size: 10px; padding: 2px 4px; border-radius: 3px; margin-left: 4px;" title="Copy Mã SP">📋</button>` : '';

            let metricsHtml = '';
            if (row.metricCells && row.metricCells.length > 0) {
                row.metricCells.forEach(cellVal => {
                    metricsHtml += `<td style="padding: 6px 8px; font-size: 11px; color: #334155; white-space: nowrap;">${escapeHtml(cellVal)}</td>`;
                });
            } else {
                metricsHtml = `<td style="padding: 6px 8px; font-size: 11px; color: #64748b;">-</td>`;
            }

            tr.innerHTML = `
                <td style="padding: 6px 4px; text-align: center; color: #64748b; font-size: 11px;">${idx + 1}</td>
                <td style="padding: 6px 4px; text-align: center;">${thumbImg}</td>
                <td style="padding: 6px 8px; font-size: 11px; font-weight: 500; color: #1e293b; max-width: 250px; word-break: break-word;" title="${escapeHtml(row.title)}">
                    ${escapeHtml(row.title)}
                </td>
                <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #2563eb; white-space: nowrap;">
                    ${escapeHtml(row.productId || row.subtitle || "-")} ${copyIdBtn}
                </td>
                ${metricsHtml}
            `;
            fragment.appendChild(tr);
        });

        tableTbody.innerHTML = '';
        tableTbody.appendChild(fragment);

        // Attach copy mini handlers
        tableTbody.querySelectorAll('.btn-copy-mini').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = btn.getAttribute('data-copy');
                if (text) {
                    navigator.clipboard.writeText(text);
                    btn.textContent = '✓';
                    setTimeout(() => { btn.textContent = '📋'; }, 1500);
                }
            });
        });
    }

    function rowsToTsv() {
        if (!allRows.length) return "";
        const lines = [];

        // Header
        const headerCols = ["STT", "Mã sản phẩm", "Tên sản phẩm", "SKU", ...(dynamicHeaders || [])];
        lines.push(headerCols.join("\t"));

        // Body
        allRows.forEach((row, index) => {
            const rowCols = [
                index + 1,
                row.productId || "",
                (row.title || "").replace(/\t|\n/g, ' '),
                row.sku || "",
                ...(row.metricCells || [])
            ];
            lines.push(rowCols.join("\t"));
        });

        return lines.join("\n");
    }

    // Event listeners
    if (btnRead) {
        btnRead.addEventListener('click', () => readPerformanceData(false));
    }

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            chrome.tabs.create({ url: "https://banhang.shopee.vn/datacenter/product/performance" });
        });
    }

    if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
            if (!allRows.length) {
                setStatus("Chưa có dữ liệu để copy TSV.", true);
                return;
            }
            const tsv = rowsToTsv();
            await navigator.clipboard.writeText(tsv);
            setStatus(`Đã copy ${allRows.length} dòng sản phẩm vào Clipboard!`);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderTable();
        });
    }

    if (tabBtn) {
        tabBtn.addEventListener('click', () => {
            window.setTimeout(() => {
                if (isTabActive() && !allRows.length) {
                    readPerformanceData(true);
                }
            }, 300);
        });
    }

    // Auto read check when opening popup if tab is active
    window.setTimeout(() => {
        if (isTabActive()) {
            readPerformanceData(true);
        }
    }, 600);
})();
