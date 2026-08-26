// =========================================================================
// TAB NHIỀU ĐƠN HÀNG - LẤY DỮ LIỆU TỪ SHEET "DH", HIỂN THỊ TỪ DƯỚI LÊN TRÊN, LỌC MÃ GIAN & REALTIME SYNC
// =========================================================================

(function () {
  const tabContent = document.getElementById("tab-nhieu-don-hang");
  const tabBtn = document.querySelector('.tab-btn[data-tab="tab-nhieu-don-hang"]');
  const thead = document.getElementById("nhieu-don-hang-thead");
  const tbody = document.getElementById("nhieu-don-hang-tbody");
  const inputSearch = document.getElementById("nhieu-don-hang-search");
  const inputGian = document.getElementById("nhieu-don-hang-gian-filter");
  const gianDatalist = document.getElementById("nhieu-don-hang-gian-list");
  const statusEl = document.getElementById("nhieu-don-hang-status");
  const realtimeToggle = document.getElementById("nhieu-don-hang-realtime-toggle");
  const btnReload = document.getElementById("btn-reload-nhieu-don-hang");
  const btnCopyTsv = document.getElementById("btn-copy-tsv-nhieu-don-hang");
  const btnExportExcel = document.getElementById("btn-export-excel-nhieu-don-hang");

  let allData = [];
  let headers = [];
  let gianColumnIdx = 0;
  let mdhColumnIdx = 3;
  let mvdColumnIdx = 4;
  let skuColumnIdx = 16;
  let dataLoaded = false;
  let isFetching = false;
  let lastDataHash = "";
  let lastFetchTime = 0;
  let realtimeTimer = null;

  // Kiểm tra tab có đang được mở không
  function isTabActive() {
    return tabContent && !tabContent.hidden && tabContent.classList.contains("active");
  }

  // Lắng nghe khi bấm vào tab để tự tải/đồng bộ dữ liệu ngay lập tức
  if (tabBtn) {
    tabBtn.addEventListener("click", () => {
      loadDhSheetData(false);
    });
  }

  // Tự động tải dữ liệu khi mở tiện ích
  setTimeout(() => loadDhSheetData(false), 200);

  // 1. Tải dữ liệu từ Sheet "DH" (hỗ trợ chế độ ngầm silent để không giật màn hình)
  function loadDhSheetData(silent = false) {
    if (isFetching) return;
    const now = Date.now();
    if (silent && now - lastFetchTime < 3000) return;

    isFetching = true;
    lastFetchTime = now;

    if (!silent && tbody && !dataLoaded) {
      tbody.innerHTML = '<tr><td colspan="15" style="padding: 18px; text-align: center; color: #2563eb; font-weight: 500;">⏳ Đang tải dữ liệu từ sheet "DH"...</td></tr>';
    }
    if (!silent && statusEl) {
      statusEl.innerHTML = "⏳ Đang tải dữ liệu sheet DH...";
    }

    chrome.storage.local.get(["maGian", "dhHoanTextValue"], (storageRes) => {
      const savedGian = (storageRes.maGian || storageRes.dhHoanTextValue || "").trim();
      if (inputGian && !inputGian.value && savedGian) {
        inputGian.value = savedGian;
      }

      chrome.runtime.sendMessage({ type: "FETCH_DH" }, (res) => {
        isFetching = false;

        if (!res || !res.ok || !res.values || res.values.length <= 1) {
          if (!silent) {
            if (tbody) {
              tbody.innerHTML = `<tr><td colspan="15" style="padding: 18px; text-align: center; color: #dc2626; font-weight: 500;">⚠️ ${res?.error || 'Sheet "DH" trống hoặc không thể đọc được dữ liệu.'}</td></tr>`;
            }
            if (statusEl) {
              statusEl.innerHTML = '<span style="color:#dc2626;">Lỗi tải dữ liệu sheet DH</span>';
            }
          }
          return;
        }

        const rows = res.values;
        headers = rows[0].map(h => String(h || "").trim());

        // Tìm chỉ số các cột quan trọng
        headers.forEach((h, idx) => {
          const lower = h.toLowerCase();
          if (lower === "gian" || lower === "mã gian" || lower === "ma gian" || lower === "ma_gian") gianColumnIdx = idx;
          if (lower === "mdh" || lower === "mã đơn hàng" || lower === "ma don hang" || lower === "order sn") mdhColumnIdx = idx;
          if (lower === "mvd" || lower === "mã vận đơn" || lower === "ma van don" || lower === "tracking no") mvdColumnIdx = idx;
          if (lower === "sku" || lower === "mã sku" || lower === "id_sp_ct") skuColumnIdx = idx;
        });

        // Tạo chữ ký dữ liệu để kiểm tra xem có đơn mới hoặc thay đổi gì không
        const currentHash = `${rows.length}_${rows[rows.length - 1]?.join('|') || ''}_${rows[1]?.join('|') || ''}`;
        const hasChanged = (currentHash !== lastDataHash);
        lastDataHash = currentHash;

        // Thu thập danh sách các gian duy nhất và các dòng dữ liệu (ĐẢO NGƯỢC: DƯỚI LÊN TRÊN)
        const uniqueGians = new Set();
        const newData = [];

        for (let i = rows.length - 1; i >= 1; i--) {
          const row = rows[i];
          if (row.some(cell => String(cell || "").trim())) {
            const gianVal = String(row[gianColumnIdx] || "").trim();
            if (gianVal) uniqueGians.add(gianVal);

            newData.push({
              rowOriginalIndex: i + 1, // Số dòng trên Google Sheet
              cells: row
            });
          }
        }

        allData = newData;

        // Đổ danh sách gian vào datalist để người dùng chọn nhanh
        if (gianDatalist) {
          gianDatalist.innerHTML = "";
          Array.from(uniqueGians).sort().forEach(g => {
            const opt = document.createElement("option");
            opt.value = g;
            gianDatalist.appendChild(opt);
          });
        }

        // Render header nếu chưa có
        if (!thead || thead.children.length === 0) {
          buildTableHeader(headers);
        }

        // Nếu dữ liệu có thay đổi hoặc tải lần đầu thì render lại bảng
        if (hasChanged || !dataLoaded || !silent) {
          dataLoaded = true;
          renderTable();
        } else {
          // Chỉ cập nhật trạng thái thời gian Realtime
          updateStatusText();
        }
      });
    });
  }

  // 2. Tạo Header bảng
  function buildTableHeader(colHeaders) {
    if (!thead) return;
    let html = '<tr>';
    html += '<th style="padding: 8px 6px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; position: sticky; top: 0; z-index: 2; width: 45px; text-align: center;">STT</th>';
    html += '<th style="padding: 8px 6px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; position: sticky; top: 0; z-index: 2; width: 55px; text-align: center;">Dòng</th>';

    colHeaders.forEach((h, idx) => {
      const isImportant = (idx === gianColumnIdx || idx === mdhColumnIdx || idx === mvdColumnIdx);
      html += `<th style="padding: 8px 8px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; position: sticky; top: 0; z-index: 2; white-space: nowrap; color: ${isImportant ? '#1e40af' : '#334155'}; font-weight: ${isImportant ? '700' : '600'};">${escapeHtml(h || `Cột ${idx + 1}`)}</th>`;
    });

    html += '</tr>';
    thead.innerHTML = html;
  }

  // 3. Render bảng và lọc theo Mã Gian + Từ Khóa
  function renderTable() {
    if (!dataLoaded || !tbody) return;

    const filterGian = inputGian ? inputGian.value.trim().toLowerCase() : "";
    const filterQuery = inputSearch ? inputSearch.value.trim().toLowerCase() : "";

    let count = 0;
    let html = "";

    for (let i = 0; i < allData.length; i++) {
      const item = allData[i];
      const cells = item.cells;

      // A. Lọc theo Mã Gian (nếu có nhập)
      if (filterGian) {
        const cellGian = String(cells[gianColumnIdx] || "").trim().toLowerCase();
        if (!cellGian.includes(filterGian) && cellGian !== filterGian) {
          continue;
        }
      }

      // B. Lọc theo Từ khóa tìm kiếm
      if (filterQuery) {
        const fullRowText = cells.join(" ").toLowerCase();
        if (!fullRowText.includes(filterQuery)) {
          continue;
        }
      }

      count++;
      const isEven = (count % 2 === 0);
      const rowBg = isEven ? '#f8fafc' : '#ffffff';

      html += `<tr style="background: ${rowBg}; transition: background 0.15s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'">`;
      html += `<td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-weight: 500;">${count}</td>`;
      html += `<td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px;">#${item.rowOriginalIndex}</td>`;

      for (let j = 0; j < headers.length; j++) {
        let val = String(cells[j] || "").trim();
        let displayVal = escapeHtml(val);
        let cellStyle = "padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; white-space: nowrap;";

        // Tô màu đặc biệt cho các cột quan trọng
        if (j === gianColumnIdx) {
          displayVal = `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${displayVal}</span>`;
        } else if (j === mdhColumnIdx || j === mvdColumnIdx) {
          displayVal = `<span class="nhieu-don-copyable" title="Bấm để copy" style="cursor: pointer; color: #2563eb; font-weight: 600; text-decoration: underline dotted;">${displayVal}</span>`;
        } else if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(val) || (/^\d+$/.test(val) && val.length >= 4 && val.length <= 9)) {
          // Định dạng tiền tệ
          const num = Number(val.replace(/,/g, ''));
          if (!isNaN(num) && num > 1000 && num < 100000000) {
            displayVal = `<span style="color: #16a34a; font-weight: 600;">${num.toLocaleString('vi-VN')}₫</span>`;
          }
        }

        html += `<td style="${cellStyle}">${displayVal}</td>`;
      }

      html += '</tr>';
    }

    if (count === 0) {
      html = '<tr><td colspan="20" style="padding: 20px; text-align: center; color: #94a3b8;">Không tìm thấy đơn hàng nào phù hợp với bộ lọc.</td></tr>';
    }

    tbody.innerHTML = html;

    // Gắn sự kiện copy nhanh cho Mã đơn / Mã vận đơn
    tbody.querySelectorAll('.nhieu-don-copyable').forEach(el => {
      el.addEventListener('click', () => {
        const text = el.textContent.trim();
        if (text) {
          navigator.clipboard.writeText(text);
          const oldColor = el.style.color;
          el.style.color = '#16a34a';
          el.textContent = '✓ Đã copy';
          setTimeout(() => {
            el.textContent = text;
            el.style.color = oldColor;
          }, 1200);
        }
      });
    });

    updateStatusText(count);
  }

  // 4. Cập nhật thanh trạng thái (Hiển thị thời gian Realtime)
  function updateStatusText(currentCount) {
    if (!statusEl) return;
    const filterGian = inputGian ? inputGian.value.trim() : "";
    const filterQuery = inputSearch ? inputSearch.value.trim() : "";

    let count = currentCount;
    if (typeof count !== 'number') {
      const rows = tbody ? tbody.querySelectorAll('tr') : [];
      count = (rows.length === 1 && rows[0].textContent.includes('Không tìm thấy')) ? 0 : rows.length;
    }

    const now = new Date();
    const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');

    const isRealtime = realtimeToggle ? realtimeToggle.checked : true;
    const realtimeBadge = isRealtime 
      ? `<span style="background: #dcfce7; color: #15803d; padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">🟢 Realtime [${timeStr}]</span>`
      : `<span style="background: #f1f5f9; color: #64748b; padding: 1px 6px; border-radius: 4px; font-size: 10px;">⚪ Thủ công [${timeStr}]</span>`;

    const gianLabel = filterGian ? `Gian: <b>${escapeHtml(filterGian)}</b> | ` : '';
    statusEl.innerHTML = `${realtimeBadge} ${gianLabel}Hiển thị: <b style="color:#2563eb;">${count}</b> / <b>${allData.length}</b> đơn (mới nhất ở trên cùng).`;
  }

  // 5. Khởi chạy bộ đếm Realtime Polling (Mỗi 5 giây)
  function setupRealtimePolling() {
    if (realtimeTimer) clearInterval(realtimeTimer);

    realtimeTimer = setInterval(() => {
      const isEnabled = realtimeToggle ? realtimeToggle.checked : true;
      if (isEnabled && isTabActive()) {
        loadDhSheetData(true);
      }
    }, 5000);
  }

  // 6. Lắng nghe các sự kiện cập nhật đơn hàng từ toàn bộ Extension
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.action === "DH_DATA_UPDATED" || msg?.type === "DH_DATA_UPDATED" || msg?.action === "REFRESH_DH_TABLE") {
      setTimeout(() => loadDhSheetData(false), 500);
    }
  });

  // 7. Copy TSV
  function copyTableTsv() {
    if (!allData.length) {
      alert("Không có dữ liệu để copy!");
      return;
    }

    const filterGian = inputGian ? inputGian.value.trim().toLowerCase() : "";
    const filterQuery = inputSearch ? inputSearch.value.trim().toLowerCase() : "";

    const lines = [];
    lines.push(headers.join("\t"));

    for (let i = 0; i < allData.length; i++) {
      const cells = allData[i].cells;
      if (filterGian) {
        const cellGian = String(cells[gianColumnIdx] || "").trim().toLowerCase();
        if (!cellGian.includes(filterGian) && cellGian !== filterGian) continue;
      }
      if (filterQuery) {
        const fullRowText = cells.join(" ").toLowerCase();
        if (!fullRowText.includes(filterQuery)) continue;
      }
      lines.push(cells.join("\t"));
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      alert(`Đã copy ${lines.length - 1} dòng đơn hàng vào clipboard!`);
    });
  }

  // 8. Xuất Excel
  function exportTableExcel() {
    if (typeof XLSX === "undefined") {
      alert("Thư viện Excel chưa được tải!");
      return;
    }

    const filterGian = inputGian ? inputGian.value.trim().toLowerCase() : "";
    const filterQuery = inputSearch ? inputSearch.value.trim().toLowerCase() : "";

    const exportRows = [headers];

    for (let i = 0; i < allData.length; i++) {
      const cells = allData[i].cells;
      if (filterGian) {
        const cellGian = String(cells[gianColumnIdx] || "").trim().toLowerCase();
        if (!cellGian.includes(filterGian) && cellGian !== filterGian) continue;
      }
      if (filterQuery) {
        const fullRowText = cells.join(" ").toLowerCase();
        if (!fullRowText.includes(filterQuery)) continue;
      }
      exportRows.push(cells);
    }

    const ws = XLSX.utils.aoa_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DH");

    const now = new Date();
    const dStr = String(now.getDate()).padStart(2, '0') + String(now.getMonth() + 1).padStart(2, '0');
    const gianSuffix = filterGian ? `_${filterGian}` : '';
    XLSX.writeFile(wb, `DH${gianSuffix}_${dStr}.xlsx`);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // EVENT LISTENERS
  if (inputGian) {
    inputGian.addEventListener("input", renderTable);
    inputGian.addEventListener("change", renderTable);
  }

  if (inputSearch) {
    inputSearch.addEventListener("input", renderTable);
  }

  if (btnReload) {
    btnReload.addEventListener("click", () => loadDhSheetData(false));
  }

  if (realtimeToggle) {
    realtimeToggle.addEventListener("change", () => {
      updateStatusText();
      if (realtimeToggle.checked) {
        loadDhSheetData(true);
      }
    });
  }

  if (btnCopyTsv) {
    btnCopyTsv.addEventListener("click", copyTableTsv);
  }

  if (btnExportExcel) {
    btnExportExcel.addEventListener("click", exportTableExcel);
  }

  // Bắt đầu Realtime Polling
  setupRealtimePolling();

})();
