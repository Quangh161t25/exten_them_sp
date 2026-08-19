(function() {
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-day-sp"]');
    const idsInput = document.getElementById('day-sp-ids-input');
    const btnGetFromHieuQua = document.getElementById('btn-get-ids-from-hieu-qua');
    const btnClear = document.getElementById('btn-clear-day-sp-ids');
    const btnStart = document.getElementById('btn-start-day-sp');
    const btnOpenList = document.getElementById('btn-open-shopee-product-list');
    const chkAutoRepeat = document.getElementById('chk-auto-repeat-4h');
    const statusText = document.getElementById('day-sp-status');
    const logList = document.getElementById('day-sp-log-list');

    const STORAGE_KEY = "shopee_auto_boost_config";
    let isRunning = false;

    // Load saved settings
    loadSavedConfig();

    function loadSavedConfig() {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
            const config = res[STORAGE_KEY] || {};
            if (idsInput && config.ids) {
                idsInput.value = config.ids;
            }
            if (chkAutoRepeat && config.autoRepeat !== undefined) {
                chkAutoRepeat.checked = !!config.autoRepeat;
            }
            if (config.lastLogs && logList) {
                renderLogs(config.lastLogs);
            }
        });
    }

    function saveConfig(extraData = {}) {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
            const current = res[STORAGE_KEY] || {};
            const updated = {
                ...current,
                ids: idsInput ? idsInput.value.trim() : current.ids,
                autoRepeat: chkAutoRepeat ? chkAutoRepeat.checked : current.autoRepeat,
                ...extraData
            };
            chrome.storage.local.set({ [STORAGE_KEY]: updated });
        });
    }

    function setStatus(msg, type = "info") {
        if (!statusText) return;
        statusText.textContent = msg;
        if (type === "error") {
            statusText.style.color = "#ef4444";
        } else if (type === "success") {
            statusText.style.color = "#10b981";
        } else {
            statusText.style.color = "#64748b";
        }
    }

    function parseInputIds() {
        const raw = (idsInput ? idsInput.value : '').trim();
        if (!raw) return [];
        // Split by comma, semicolon, space, newline
        const tokens = raw.split(/[\s,;\n\r\t]+/);
        const ids = [];
        for (const token of tokens) {
            const clean = token.replace(/[^0-9]/g, '');
            if (clean && clean.length >= 6 && !ids.includes(clean)) {
                ids.push(clean);
            }
        }
        return ids;
    }

    function renderLogs(results) {
        if (!logList) return;
        if (!results || !results.length) {
            logList.innerHTML = '<div style="padding: 10px; text-align: center; color: #94a3b8; font-size: 11px;">Chưa có lịch sử đẩy sản phẩm.</div>';
            return;
        }

        let html = '';
        results.forEach((item, idx) => {
            let icon = '⏳';
            let badgeBg = '#f1f5f9';
            let badgeColor = '#475569';

            if (item.status === 'boosted') {
                icon = '🚀';
                badgeBg = '#dcfce7';
                badgeColor = '#15803d';
            } else if (item.status === 'already_boosting') {
                icon = '⏱️';
                badgeBg = '#e0f2fe';
                badgeColor = '#0369a1';
            } else if (item.status === 'limit_reached') {
                icon = '⚠️';
                badgeBg = '#fef3c7';
                badgeColor = '#b45309';
            } else if (item.status === 'not_found' || item.status === 'error') {
                icon = '❌';
                badgeBg = '#fee2e2';
                badgeColor = '#b91c1c';
            }

            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; margin-bottom: 4px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-weight: bold; color: #64748b;">#${idx + 1}</span>
                        <span style="font-family: monospace; font-weight: 600; color: #1e293b;">${item.id}</span>
                        ${item.name ? `<span style="color: #64748b; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">- ${item.name}</span>` : ''}
                    </div>
                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; white-space: nowrap;">
                        ${icon} ${item.msg || item.status}
                    </span>
                </div>
            `;
        });
        logList.innerHTML = html;
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

    async function startAutoBoost() {
        if (isRunning) return;
        const ids = parseInputIds();
        if (!ids.length) {
            setStatus("Vui lòng nhập hoặc dán ít nhất 1 Mã sản phẩm hợp lệ!", "error");
            return;
        }

        isRunning = true;
        if (btnStart) {
            btnStart.disabled = true;
            btnStart.textContent = "⏳ Đang thực hiện đẩy SP...";
            btnStart.style.opacity = "0.7";
        }
        setStatus(`Đang tìm và đẩy tối đa 5 SP trong danh sách (${ids.length} mã)...`);

        try {
            saveConfig();

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                setStatus("Không tìm thấy tab trình duyệt đang mở.", "error");
                return;
            }

            const isProductListPage = tab.url && (tab.url.includes("/portal/product/list") || tab.url.includes("/portal/product"));
            if (!isProductListPage) {
                setStatus("Vui lòng chuyển sang tab danh sách sản phẩm Shopee (portal/product/list) trước khi bấm Đẩy!", "error");
                return;
            }

            await ensureContentScriptInjected(tab.id);

            const response = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "EXECUTE_AUTO_BOOST_LIST",
                    productIds: ids,
                    maxSlots: 5
                }, (res) => {
                    resolve(res || { ok: false, error: chrome.runtime.lastError?.message || "Không có phản hồi từ trang Shopee" });
                });
            });

            if (!response || !response.ok) {
                setStatus(`Lỗi: ${response?.error || "Không thể thực hiện đẩy SP"}`, "error");
                return;
            }

            const results = response.results || [];
            const boostedCount = response.boostedCount || 0;
            const alreadyBoostingCount = response.alreadyBoostingCount || 0;

            renderLogs(results);
            saveConfig({ lastLogs: results, lastRunTime: Date.now() });

            setStatus(`✓ Hoàn tất: Đã đẩy ${boostedCount} SP mới, ${alreadyBoostingCount} SP đang trong thời gian đẩy!`, "success");

            // Setup alarm if auto-repeat is checked
            if (chkAutoRepeat && chkAutoRepeat.checked) {
                chrome.runtime.sendMessage({
                    type: "SCHEDULE_AUTO_BOOST_ALARM",
                    intervalMinutes: 240 // 4 hours
                });
            }
        } catch (err) {
            setStatus(`Lỗi ngoại lệ: ${err.message}`, "error");
        } finally {
            isRunning = false;
            if (btnStart) {
                btnStart.disabled = false;
                btnStart.textContent = "🚀 BẮT ĐẦU ĐẨY 5 SP NGAY";
                btnStart.style.opacity = "1";
            }
        }
    }

    // Event listeners
    if (idsInput) {
        idsInput.addEventListener('input', () => saveConfig());
    }

    if (chkAutoRepeat) {
        chkAutoRepeat.addEventListener('change', () => {
            saveConfig();
            if (chkAutoRepeat.checked) {
                setStatus("Đã bật chế độ tự động lặp lại mỗi 4 tiếng.");
            } else {
                chrome.runtime.sendMessage({ type: "CANCEL_AUTO_BOOST_ALARM" });
                setStatus("Đã tắt chế độ tự động lặp lại.");
            }
        });
    }

    if (btnGetFromHieuQua) {
        btnGetFromHieuQua.addEventListener('click', () => {
            // Check if performance tab has loaded products
            chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
                // First try to read directly from table-hieu-qua-sp if present in DOM
                const hieuQuaRows = Array.from(document.querySelectorAll('#hieu-qua-sp-tbody tr'));
                const foundIds = [];
                hieuQuaRows.forEach(tr => {
                    const copyBtn = tr.querySelector('.btn-copy-mini');
                    const id = copyBtn ? copyBtn.getAttribute('data-copy') : '';
                    if (id && !foundIds.includes(id)) {
                        foundIds.push(id);
                    }
                });

                if (foundIds.length > 0) {
                    idsInput.value = foundIds.join(", ");
                    saveConfig();
                    setStatus(`Đã lấy ${foundIds.length} Mã sản phẩm từ tab Hiệu quả SP!`, "success");
                } else {
                    setStatus("Chưa có dữ liệu từ tab Hiệu quả SP. Hãy mở tab Hiệu quả SP bấm 'Đọc Trang Hiện Tại' trước!", "error");
                }
            });
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (idsInput) idsInput.value = '';
            saveConfig();
            setStatus("Đã xóa trắng danh sách mã sản phẩm.");
        });
    }

    if (btnStart) {
        btnStart.addEventListener('click', startAutoBoost);
    }

    if (btnOpenList) {
        btnOpenList.addEventListener('click', () => {
            chrome.tabs.create({ url: "https://banhang.shopee.vn/portal/product/list/live/all?operationSortBy=modified_time&page=1&size=48" });
        });
    }
})();
