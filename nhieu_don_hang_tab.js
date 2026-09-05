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
  const btnReadOrder = document.getElementById("btn-read-order-to-nhieu-don-hang");
  const autoReadToggle = document.getElementById("nhieu-don-hang-autoread-toggle");
  const autoSaveToggle = document.getElementById("nhieu-don-hang-autosave-toggle");
  const previewCard = document.getElementById("nhieu-don-preview-card");
  const previewTitle = document.getElementById("nhieu-don-preview-title");
  const previewThead = document.getElementById("nhieu-don-preview-thead");
  const previewTbody = document.getElementById("nhieu-don-preview-tbody");
  const btnSavePreview = document.getElementById("btn-save-preview-to-sheet");
  const btnCopyPreviewTsv = document.getElementById("btn-copy-preview-tsv");
  const btnExportExcelPreview = document.getElementById("btn-export-excel-preview");
  const btnToggleViewModePreview = document.getElementById("btn-toggle-view-mode-preview");
  const nhieuDonPreviewStatus = document.getElementById("nhieu-don-preview-status");
  const btnTogglePreviewBody = document.getElementById("btn-toggle-preview-body");
  const previewBody = document.getElementById("nhieu-don-preview-body");
  const btnClosePreview = document.getElementById("btn-close-preview");

  // Các phần tử Xử lý hàng loạt (10.000 đơn/tháng)
  const btnReadOrderListPage = document.getElementById("btn-read-order-list-page");
  const btnAutoPaginateOrderList = document.getElementById("btn-auto-paginate-order-list");
  const btnAutoFillMissingDetail = document.getElementById("btn-auto-fill-missing-detail");
  const listScanStatusBox = document.getElementById("nhieu-don-list-scan-status-box");
  const listScanText = document.getElementById("nhieu-don-list-scan-text");
  const btnStopListScan = document.getElementById("btn-stop-list-scan");
  const listScanBar = document.getElementById("nhieu-don-list-scan-bar");
  let isListScanning = false;
  let cancelListScanRequested = false;
  let isAutoFillingDetails = false;
  let cancelAutoFillRequested = false;

  const btnUploadExcelShopee = document.getElementById("btn-upload-excel-shopee-dh");
  const fileUploadExcelShopee = document.getElementById("upload-excel-shopee-dh");
  const btnToggleApiScanner = document.getElementById("btn-toggle-api-scanner");
  const btnCloseApiScanner = document.getElementById("btn-close-api-scanner");
  const apiScanPanel = document.getElementById("nhieu-don-api-scan-panel");
  const datePresetSelect = document.getElementById("nhieu-don-scan-date-preset");
  const customDateContainer = document.getElementById("nhieu-don-scan-custom-date-container");
  const scanFromDate = document.getElementById("nhieu-don-scan-from-date");
  const scanToDate = document.getElementById("nhieu-don-scan-to-date");
  const scanStatusFilter = document.getElementById("nhieu-don-scan-status-filter");
  const btnStartApiScan = document.getElementById("btn-start-api-scan");
  const btnStopApiScan = document.getElementById("btn-stop-api-scan");
  const scanProgressBox = document.getElementById("nhieu-don-scan-progress-box");
  const scanStatusText = document.getElementById("nhieu-don-scan-status-text");
  const scanPercentText = document.getElementById("nhieu-don-scan-percent-text");
  const scanProgressBar = document.getElementById("nhieu-don-scan-progress-bar");
  let isApiScanning = false;
  let cancelApiScanRequested = false;

  let isReadingShopeeOrder = false;
  let lastAutoReadUrl = "";
  let lastAutoReadAt = 0;
  let latestPreviewRows = [];
  let latestPreviewDhValues = [];
  let currentPreviewExistingInfo = { exists: false, rowNums: [] };
  let previewViewMode = localStorage.getItem("shopee_preview_view_mode") || "row";

  const DEFAULT_DH_HEADERS = [
    "gian", "ngay", "ngay_gio", "mdh", "mvd", "tong_tien", "ma_giam_gia",
    "phi_vc", "phu_phi", "thue", "doanh_thu", "phi_khac", "tien_sp", "loi_nhuan",
    "tinh_trang", "trang_thai", "sku", "id_sp", "slg", "don_gia", "thanh_tien",
    "ten_khach", "ng_nhan", "dia_chi", "link_don"
  ];

  let allData = [];
  let headers = [];
  let gianColumnIdx = 0;
  let mdhColumnIdx = 3;
  let mvdColumnIdx = 4;
  let maGiamGiaColumnIdx = 6;
  let tinhTrangColumnIdx = 14;
  let trangThaiColumnIdx = 15;
  let skuColumnIdx = 16;
  let linkDonColumnIdx = 24;
  let dataLoaded = false;
  let isFetching = false;
  let lastDataHash = "";
  let lastFetchTime = 0;
  let realtimeTimer = null;

  const btnPreviewStatusHuy = document.getElementById("btn-preview-status-huy");
  const btnPreviewStatusHoan = document.getElementById("btn-preview-status-hoan");
  const btnPreviewStatusTra = document.getElementById("btn-preview-status-tra");

  // Kiểm tra tab có đang được mở không
  function isTabActive() {
    return tabContent && !tabContent.hidden && tabContent.classList.contains("active");
  }

  // Lắng nghe khi bấm vào tab để tự tải/đồng bộ dữ liệu ngay lập tức
  if (tabBtn) {
    tabBtn.addEventListener("click", () => {
      loadDhSheetData(false);
      window.setTimeout(triggerAutoReadOrder, 350);
    });
  }

  // Tự động tải dữ liệu khi mở tiện ích
  setTimeout(() => loadDhSheetData(false), 200);

  // Khôi phục đơn hàng vừa đọc để bảng đọc đơn hàng luôn hiển thị
  chrome.storage.local.get(["nhieuDonLastPreviewRows", "nhieuDonLastPreviewExistingInfo", "nhieuDonLastPreviewWasSaved"], (res) => {
    if (res && Array.isArray(res.nhieuDonLastPreviewRows) && res.nhieuDonLastPreviewRows.length > 0) {
      renderPreviewRows(res.nhieuDonLastPreviewRows, res.nhieuDonLastPreviewExistingInfo, !!res.nhieuDonLastPreviewWasSaved);
    } else {
      if (previewCard) previewCard.style.display = "block";
      const rowCols = window.orderTabUtils?.rowViewColumns || previewRowColumns;
      if (previewThead) {
        previewThead.innerHTML = `<tr>${rowCols.map(c => `<th style="padding: 7px 8px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; white-space: nowrap; font-size: 11px; font-weight: 600; color: #334155;">${c.label}</th>`).join("")}</tr>`;
      }
      if (previewTbody) {
        previewTbody.innerHTML = `<tr><td colspan="${rowCols.length || 10}" style="text-align: center; padding: 15px; color: #64748b;">Chưa có dữ liệu đơn hàng vừa đọc. Mở trang chi tiết đơn hoặc bấm <b>🕹️ Đọc đơn</b>.</td></tr>`;
      }
    }
  });

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
          if (lower === "ma_giam_gia" || lower === "mã giảm giá" || lower === "ma giam gia" || lower === "giam_gia" || lower === "voucher") maGiamGiaColumnIdx = idx;
          if (lower === "tinh_trang" || lower === "tình trạng" || lower === "tinh trang") tinhTrangColumnIdx = idx;
          if (lower === "trang_thai" || lower === "trạng thái" || lower === "trang thai") trangThaiColumnIdx = idx;
          if (lower === "sku" || lower === "mã sku" || lower === "id_sp_ct") skuColumnIdx = idx;
          if (lower === "link_don" || lower === "link đơn" || lower === "link don" || lower === "link") linkDonColumnIdx = idx;
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
          const mdhVal = String(row[mdhColumnIdx] || "").trim();
          const mvdVal = String(row[mvdColumnIdx] || "").trim();
          const skuVal = String(row[skuColumnIdx] || "").trim();

          // BỎ QUA DÒNG RÁC / DÒNG TRỐNG: Dòng chỉ có mỗi tên gian hoặc hoàn toàn trống rỗng
          if (!mdhVal && !mvdVal && !skuVal) {
            continue;
          }

          const gianVal = String(row[gianColumnIdx] || "").trim();
          if (gianVal) uniqueGians.add(gianVal);

          newData.push({
            rowOriginalIndex: i + 1, // Số dòng trên Google Sheet
            cells: row
          });
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

        // Kiểm tra xem đơn hàng đã được đổi tình trạng (Hủy, Hoàn, Trả, hoặc trạng thái tùy chỉnh) hay chưa
  function isOrderCustomOrModifiedStatus(statusStr) {
    if (!statusStr) return false;
    const s = String(statusStr).trim().toLowerCase();
    if (!s) return false;
    if (/hủy|huy|hoàn|hoan|trả|tra/i.test(s)) return true;
    const normalProgression = ["", "đang giao", "chờ giao", "chờ lấy hàng", "chờ xác nhận", "đã giao", "hoàn thành"];
    return !normalProgression.includes(s);
  }

  // 1. Thêm hoặc cập nhật đơn hàng vào danh sách hiển thị và Sheet DH
  function addDhRows(dhValues, sampleMdh, sampleMvd, saveToSheet = true) {
    if (!Array.isArray(dhValues) || dhValues.length === 0) return;

    if (!headers.length) {
      headers = [
        "Mã Gian", "Ngày đặt", "Giờ đặt", "Mã đơn hàng", "Mã vận đơn",
        "tong_tien", "ma_giam_gia", "phi_vc", "phu_phi", "thue",
        "doanh_thu", "phi_khac", "tien_sp", "loi_nhuan", "tinh_trang",
        "trang_thai", "SKU", "Tên SP", "SLG", "don_gia",
        "thanh_tien", "NV", "Ghi chú", "link_anh", "link_don"
      ];
      gianColumnIdx = 0;
      mdhColumnIdx = 3;
      mvdColumnIdx = 4;
      skuColumnIdx = 16;
      buildTableHeader(headers);
    }

    // Lọc bỏ mọi dòng rác không có MDH, MVD hoặc SKU
    const validDhValues = dhValues.filter(row => {
      if (!Array.isArray(row) || row.length === 0) return false;
      const rMdh = String(row[mdhColumnIdx] || "").trim();
      const rMvd = String(row[mvdColumnIdx] || "").trim();
      const rSku = String(row[skuColumnIdx] || "").trim();
      return rMdh || rMvd || rSku;
    });

    if (validDhValues.length === 0) {
      console.warn("[Nhiều đơn hàng] Bỏ qua vì các dòng dữ liệu không có MDH, MVD hoặc SKU.");
      return;
    }

    const normMdh = String(sampleMdh || "").trim().toLowerCase();
    const normMvd = String(sampleMvd || "").trim().toLowerCase();

    // Tìm xem đơn hàng cũ đã có trong allData chưa để lấy tình trạng / trạng thái cũ
    let oldTinhTrang = "";
    let oldTrangThai = "";
    if (normMdh || normMvd) {
      const existingItem = allData.find(item => {
        const rMdh = String(item.cells[mdhColumnIdx] || "").trim().toLowerCase();
        const rMvd = String(item.cells[mvdColumnIdx] || "").trim().toLowerCase();
        return (normMdh && rMdh && rMdh === normMdh) || (normMvd && rMvd && rMvd === normMvd);
      });
      if (existingItem && existingItem.cells) {
        oldTinhTrang = String(existingItem.cells[tinhTrangColumnIdx] || "").trim();
        oldTrangThai = String(existingItem.cells[trangThaiColumnIdx] || "").trim();
      }
    }

    // Nếu đơn hàng cũ có tình trạng (ví dụ Hủy, Hoàn, Trả,...) thì giữ nguyên tình trạng đó cho các dòng mới!
    if (oldTinhTrang || oldTrangThai) {
      const statusToCheck = (oldTrangThai || oldTinhTrang).toLowerCase();
      validDhValues.forEach(row => {
        if (tinhTrangColumnIdx !== -1 && oldTinhTrang) row[tinhTrangColumnIdx] = oldTinhTrang;
        if (trangThaiColumnIdx !== -1 && oldTrangThai) row[trangThaiColumnIdx] = oldTrangThai;

        // Nếu trạng thái là Hủy: doanh thu = 0, tiền sp = 0, lợi nhuận = 0
        if (/hủy|huy/i.test(statusToCheck)) {
          row[10] = "0"; // doanh_thu
          row[12] = "0"; // tien_sp
          row[13] = "0"; // loi_nhuan
        } else if (/hoàn|hoan|trả|tra/i.test(statusToCheck)) {
          row[12] = "0"; // tien_sp
          const dt = Number(String(row[10] || 0).replace(/[^0-9.-]/g, '')) || 0;
          const pk = Number(String(row[11] || 0).replace(/[^0-9.-]/g, '')) || 0;
          row[13] = String(dt - pk); // loi_nhuan
        }
      });
    }

    // 1. Nếu đơn hàng đã có trong danh sách -> xóa dòng cũ để cập nhật mới
    if (normMdh || normMvd) {
      allData = allData.filter(item => {
        const rMdh = String(item.cells[mdhColumnIdx] || "").trim().toLowerCase();
        const rMvd = String(item.cells[mvdColumnIdx] || "").trim().toLowerCase();
        if (normMdh && rMdh && rMdh === normMdh) return false;
        if (normMvd && rMvd && rMvd === normMvd) return false;
        return true;
      });
    }

    // 2. Chèn dòng mới lên đầu danh sách
    for (let i = validDhValues.length - 1; i >= 0; i--) {
      allData.unshift({
        rowOriginalIndex: "Mới",
        cells: validDhValues[i],
        isNewRead: true
      });
    }

    dataLoaded = true;
    renderTable();

    // 3. Cuộn bảng lên đầu
    const tableContainer = tbody ? tbody.closest('.table-responsive') : null;
    if (tableContainer) {
      tableContainer.scrollTop = 0;
    }

    // 4. Lưu vào Sheet DH
    if (saveToSheet && (normMdh || normMvd)) {
      chrome.runtime.sendMessage({
        type: "SAVE_DH_ORDER",
        values: validDhValues,
        mdh: sampleMdh,
        mvd: sampleMvd
      }, (res) => {
        if (res && res.ok) {
          console.log("[Nhiều đơn hàng] Đã lưu vào Sheet DH:", sampleMdh);
        } else {
          console.warn("[Nhiều đơn hàng] Lỗi lưu Sheet DH:", res?.error);
        }
      });
    }
  }

  // 2. Tạo Header bảng
  function buildTableHeader(colHeaders) {
    if (!thead) return;
    let html = '<tr>';
    html += '<th style="padding: 8px 6px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; position: sticky; top: 0; z-index: 2; width: 40px; text-align: center;">STT</th>';
    html += '<th style="padding: 8px 6px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; position: sticky; top: 0; z-index: 2; width: 50px; text-align: center;">Dòng</th>';
    html += '<th style="padding: 8px 6px; border-bottom: 2px solid #cbd5e1; background: #fef3c7; position: sticky; top: 0; z-index: 2; width: 140px; text-align: center; color: #b45309; font-weight: 700;">HỦY / HOÀN / TRẢ</th>';

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
      let rowBg = isEven ? '#f8fafc' : '#ffffff';
      let rowStyleExtra = '';
      if (item.isNewRead) {
        rowBg = '#f0fdf4';
        rowStyleExtra = 'border-left: 3px solid #10b981; font-weight: 500;';
      }

      const mdhVal = String(cells[mdhColumnIdx] || "").trim();
      const mvdVal = String(cells[mvdColumnIdx] || "").trim();
      const gianVal = String(cells[gianColumnIdx] || "").trim();
      const tinhTrangVal = String(cells[tinhTrangColumnIdx] || "").trim();
      const trangThaiVal = String(cells[trangThaiColumnIdx] || "").trim();
      const currentStatus = trangThaiVal || tinhTrangVal;
      const isStatusChanged = isOrderCustomOrModifiedStatus(currentStatus);

      const tongTienVal = Number(String(cells[5] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const doanhThuVal = Number(String(cells[10] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const tienSpVal = Number(String(cells[12] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const skuVal = String(cells[skuColumnIdx] || "").trim();
      let linkVal = String(cells[linkDonColumnIdx] || "").trim();
      if (!linkVal && mdhVal) {
        linkVal = `https://banhang.shopee.vn/portal/sale/order/${mdhVal}`;
      } else if (linkVal && linkVal.startsWith('/')) {
        linkVal = `https://banhang.shopee.vn${linkVal}`;
      }

      const isMissingDetail = !isStatusChanged && (((tongTienVal === 0 && doanhThuVal === 0 && tienSpVal === 0) || !skuVal));

      let statusBadge = "";
      const isHuyActive = /hủy|huy/i.test(currentStatus);
      const isHoanActive = /hoàn|hoan/i.test(currentStatus);
      const isTraActive = /trả|tra/i.test(currentStatus);

      if (isHuyActive) {
        statusBadge = `<span style="background: #fee2e2; color: #dc2626; border: 1px solid #f87171; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 9px;">🔴 HỦY</span>`;
      } else if (isHoanActive) {
        statusBadge = `<span style="background: #fef3c7; color: #d97706; border: 1px solid #fcd34d; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 9px;">🟠 HOÀN</span>`;
      } else if (isTraActive) {
        statusBadge = `<span style="background: #faf5ff; color: #7e22ce; border: 1px solid #d8b4fe; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 9px;">🟣 TRẢ</span>`;
      }

      html += `<tr class="dh-order-row-clickable" data-order-link="${escapeHtml(linkVal)}" style="background: ${rowBg}; ${rowStyleExtra} cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'" title="Bấm vào dòng để mở chi tiết đơn hàng: ${escapeHtml(mdhVal || '')}">`;
      html += `<td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-weight: 500;">${count}</td>`;
      const dongBadge = item.isNewRead 
        ? `<span style="background: #10b981; color: white; padding: 1px 5px; border-radius: 3px; font-weight: bold; font-size: 9px;">MỚI</span>` 
        : `#${item.rowOriginalIndex}`;
      html += `<td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px;">${dongBadge}</td>`;

      // Cột nút thao tác Hủy / Hoàn / Trả / Đọc nhanh chi tiết
      html += `
        <td style="padding: 4px 6px; border-bottom: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
          <div style="display: flex; gap: 3px; align-items: center; justify-content: center;">
            ${statusBadge ? `<span style="margin-right: 2px;">${statusBadge}</span>` : ''}
            ${isMissingDetail ? `<button type="button" class="btn-dh-quick-fill-detail" data-mdh="${escapeHtml(mdhVal)}" data-link="${escapeHtml(linkVal)}" data-gian="${escapeHtml(gianVal)}" title="Mở link và tự động cập nhật chi tiết tài chính/SKU vào Sheet DH" style="padding: 2px 5px; font-size: 10px; font-weight: bold; border-radius: 3px; border: 1px solid #e11d48; background: #fff1f2; color: #e11d48; cursor: pointer; white-space: nowrap;">⚡ Đọc CT</button>` : ''}
            <button type="button" class="btn-dh-status-action btn-status-huy" data-mdh="${escapeHtml(mdhVal)}" data-mvd="${escapeHtml(mvdVal)}" data-gian="${escapeHtml(gianVal)}" data-status="Hủy" title="Đánh dấu HỦY ĐƠN (Doanh thu=0, Vốn=0, Lợi nhuận=0)" style="padding: 2px 5px; font-size: 10px; font-weight: bold; border-radius: 3px; border: 1px solid ${isHuyActive ? '#dc2626' : '#fca5a5'}; background: ${isHuyActive ? '#dc2626' : '#fff'}; color: ${isHuyActive ? '#fff' : '#dc2626'}; cursor: pointer;">Hủy</button>
            <button type="button" class="btn-dh-status-action btn-status-hoan" data-mdh="${escapeHtml(mdhVal)}" data-mvd="${escapeHtml(mvdVal)}" data-gian="${escapeHtml(gianVal)}" data-status="Hoàn" title="Đánh dấu HOÀN HÀNG (Vốn=0)" style="padding: 2px 5px; font-size: 10px; font-weight: bold; border-radius: 3px; border: 1px solid ${isHoanActive ? '#d97706' : '#fcd34d'}; background: ${isHoanActive ? '#d97706' : '#fff'}; color: ${isHoanActive ? '#fff' : '#d97706'}; cursor: pointer;">Hoàn</button>
            <button type="button" class="btn-dh-status-action btn-status-tra" data-mdh="${escapeHtml(mdhVal)}" data-mvd="${escapeHtml(mvdVal)}" data-gian="${escapeHtml(gianVal)}" data-status="Trả" title="Đánh dấu TRẢ HÀNG (Vốn=0)" style="padding: 2px 5px; font-size: 10px; font-weight: bold; border-radius: 3px; border: 1px solid ${isTraActive ? '#7e22ce' : '#d8b4fe'}; background: ${isTraActive ? '#7e22ce' : '#fff'}; color: ${isTraActive ? '#fff' : '#7e22ce'}; cursor: pointer;">Trả</button>
          </div>
        </td>
      `;

      for (let j = 0; j < headers.length; j++) {
        let val = String(cells[j] || "").trim();
        let displayVal = escapeHtml(val);
        let cellStyle = "padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; white-space: nowrap;";

        // Tô màu đặc biệt cho các cột quan trọng
        if (j === gianColumnIdx) {
          displayVal = `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${displayVal}</span>`;
        } else if (j === mdhColumnIdx || j === mvdColumnIdx) {
          displayVal = `<span class="nhieu-don-copyable" title="Bấm để copy" style="cursor: pointer; color: #2563eb; font-weight: 600; text-decoration: underline dotted;">${displayVal}</span>`;
        } else if (j === maGiamGiaColumnIdx) {
          const num = Number(val.replace(/[^0-9]/g, ''));
          if (!isNaN(num) && num > 0) {
            displayVal = `<span style="color: #ef4444; font-weight: 600;">-${num.toLocaleString('vi-VN')}₫</span>`;
          } else {
            displayVal = `<span style="color: #94a3b8;">0</span>`;
          }
        } else if (j === linkDonColumnIdx || val.startsWith("http://") || val.startsWith("https://")) {
          if (val) {
            displayVal = `<a href="${escapeHtml(val)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;" title="Mở liên kết đơn hàng: ${escapeHtml(val)}">🔗 Mở link ↗</a>`;
          } else {
            displayVal = `<span style="color:#94a3b8;">—</span>`;
          }
        } else if (j === tinhTrangColumnIdx || j === trangThaiColumnIdx) {
          if (/hủy|huy/i.test(val)) {
            displayVal = `<span style="background: #fee2e2; color: #dc2626; border: 1px solid #f87171; padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">🔴 HỦY</span>`;
          } else if (/hoàn|hoan/i.test(val)) {
            displayVal = `<span style="background: #fef3c7; color: #d97706; border: 1px solid #fcd34d; padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">🟠 HOÀN</span>`;
          } else if (/trả|tra/i.test(val)) {
            displayVal = `<span style="background: #faf5ff; color: #7e22ce; border: 1px solid #d8b4fe; padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">🟣 TRẢ</span>`;
          }
        } else if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(val) || (/^-?\d+$/.test(val) && val.length >= 4 && val.length <= 9)) {
          // Định dạng tiền tệ
          const num = Number(val.replace(/,/g, ''));
          if (!isNaN(num) && Math.abs(num) > 1000 && Math.abs(num) < 100000000) {
            const color = num < 0 ? '#ef4444' : '#16a34a';
            displayVal = `<span style="color: ${color}; font-weight: 600;">${num.toLocaleString('vi-VN')}₫</span>`;
          }
        }

        html += `<td style="${cellStyle}">${displayVal}</td>`;
      }

      html += '</tr>';
    }

    if (count === 0) {
      html = '<tr><td colspan="25" style="padding: 20px; text-align: center; color: #94a3b8;">Không tìm thấy đơn hàng nào phù hợp với bộ lọc.</td></tr>';
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

    // Gắn sự kiện cập nhật trạng thái Hủy / Hoàn / Trả trực tiếp trên từng dòng
    tbody.querySelectorAll('.btn-dh-status-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mdh = btn.getAttribute('data-mdh');
        const mvd = btn.getAttribute('data-mvd');
        const gian = btn.getAttribute('data-gian');
        const status = btn.getAttribute('data-status');

        if (!mdh) {
          alert("Không tìm thấy Mã đơn hàng của dòng này!");
          return;
        }

        const confirmMsg = `Bạn có chắc muốn cập nhật trạng thái "${status}" cho đơn hàng "${mdh}" vào Sheet DH?`;
        if (!confirm(confirmMsg)) return;

        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "⏳...";

        if (statusEl) {
          statusEl.innerHTML = `⏳ Đang cập nhật trạng thái "${status}" cho đơn ${mdh} vào Sheet DH...`;
        }

        chrome.runtime.sendMessage({
          type: "UPDATE_DH_RETURN_STATUS",
          status: status,
          orderId: mdh,
          tracking: mvd,
          maGian: gian
        }, (res) => {
          btn.disabled = false;
          btn.textContent = oldText;

          if (res && res.ok) {
            // Cập nhật giá trị trực tiếp trong allData cho tất cả dòng có cùng MDH
            allData.forEach(item => {
              const rMdh = String(item.cells[mdhColumnIdx] || "").trim();
              if (rMdh && rMdh.toLowerCase() === mdh.toLowerCase()) {
                if (status === "Hủy") {
                  item.cells[10] = "0"; // doanh_thu
                  item.cells[12] = "0"; // tien_sp
                  item.cells[13] = "0"; // loi_nhuan
                  if (tinhTrangColumnIdx !== -1) item.cells[tinhTrangColumnIdx] = "Hủy";
                  if (trangThaiColumnIdx !== -1) item.cells[trangThaiColumnIdx] = "Hủy";
                } else if (status === "Hoàn" || status === "Trả") {
                  item.cells[12] = "0"; // tien_sp
                  if (trangThaiColumnIdx !== -1) item.cells[trangThaiColumnIdx] = status;
                  const dt = Number(String(item.cells[10] || 0).replace(/[^0-9.-]/g, '')) || 0;
                  const pk = Number(String(item.cells[11] || 0).replace(/[^0-9.-]/g, '')) || 0;
                  item.cells[13] = String(dt - pk); // loi_nhuan
                }
              }
            });
            renderTable();
            if (statusEl) {
              statusEl.innerHTML = `<span style="color:#16a34a; font-weight:bold;">✅ Đã cập nhật thành công trạng thái "${status}" cho đơn ${mdh} vào Sheet DH!</span>`;
            }
          } else {
            alert("Lỗi cập nhật: " + (res?.error || "Không thể cập nhật Sheet DH"));
          }
        });
      });
    });

    // Gắn sự kiện Đọc nhanh chi tiết đơn hàng trực tiếp trên từng dòng
    tbody.querySelectorAll('.btn-dh-quick-fill-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mdh = btn.getAttribute('data-mdh');
        const link = btn.getAttribute('data-link');
        const gian = btn.getAttribute('data-gian');
        handleQuickFillSingleOrder(mdh, link, gian, btn);
      });
    });

    // Gắn sự kiện BẤM VÀO CẢ DÒNG để mở link chi tiết đơn hàng
    tbody.querySelectorAll('.dh-order-row-clickable').forEach(tr => {
      tr.addEventListener('click', (e) => {
        // Nếu click vào nút bấm, input, liên kết thẻ a, hoặc vùng copy thì bỏ qua
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('.nhieu-don-copyable')) {
          return;
        }
        const link = tr.getAttribute('data-order-link');
        if (link && (link.startsWith('http://') || link.startsWith('https://'))) {
          window.open(link, '_blank');
        } else if (link) {
          window.open('https://banhang.shopee.vn' + (link.startsWith('/') ? link : '/' + link), '_blank');
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

  // =========================================================================
  // TỰ ĐỘNG ĐỌC ĐƠN & HIỂN THỊ BẢNG NỘI DUNG ĐỌC ĐƯỢC (Y HỆT TAB ĐƠN HÀNG)
  // =========================================================================

  function openOrderLink(url) {
    if (!url) return;
    try {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: url });
        return;
      }
    } catch (e) {}
    window.open(url, "_blank");
  }

  function formatMoneyDisplay(val) {
    if (val === null || val === undefined || val === "") return "";
    const text = String(val).trim();
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("vi-VN") + "₫";
  }

  function moneyToNumber(value) {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (!text) return "";
    const digits = text.replace(/[^0-9]/g, "");
    return digits || "";
  }

  const previewRowColumns = [
    { label: "STT", render: (r, idx) => idx + 1, style: "text-align:center; color:#64748b;" },
    { 
      label: "Mã đơn hàng", 
      render: (r) => {
        const link = r.linkDon || r.link_don || (r.orderId ? `https://banhang.shopee.vn/portal/sale/order/${r.orderId}` : "");
        return `<a href="${escapeHtml(link)}" class="preview-order-link-anchor" data-order-link="${escapeHtml(link)}" style="color:#2563eb; font-weight:bold; text-decoration:underline; cursor:pointer;" title="Bấm để mở chi tiết đơn: ${escapeHtml(r.orderId || '')}">${escapeHtml(r.orderId || "")}</a>`;
      }
    },
    { label: "Mã vận đơn", render: (r) => `<span style="font-weight:600; color:#0f172a;">${escapeHtml(r.tracking || "")}</span>` },
    { label: "Tổng tiền SP", render: (r) => `<b style="color:#0f172a;">${formatMoneyDisplay(r.totalProductAmount)}</b>` },
    { 
      label: "Mã giảm giá", 
      render: (r) => {
        const num = moneyToNumber(r.shopVoucher || r.maGiamGia);
        return num ? `<span style="color:#ef4444; font-weight:600;">-${Number(num).toLocaleString('vi-VN')}₫</span>` : "-0₫";
      }
    },
    { label: "Phí VC", render: (r) => formatMoneyDisplay(r.estimatedShippingTotal) },
    { label: "Phụ phí", render: (r) => formatMoneyDisplay(r.surcharge) },
    { label: "Thuế", render: (r) => formatMoneyDisplay(r.tax) },
    { label: "Doanh thu", render: (r) => `<b style="color:#16a34a;">${formatMoneyDisplay(r.estimatedOrderIncome)}</b>` },
    { label: "Tổng vốn", render: (r) => `<span style="color:#b45309; font-weight:600;">${formatMoneyDisplay(r.lineCost || r.totalCapital)}</span>` },
    { 
      label: "Lợi nhuận", 
      render: (r) => {
        const pNum = moneyToNumber(r.profit);
        const col = (pNum && Number(pNum) >= 0) ? '#16a34a' : '#dc2626';
        return `<b style="color:${col};">${formatMoneyDisplay(r.profit)}</b>`;
      }
    },
    { label: "SKU phân loại", render: (r) => `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:600; color:#0f172a;">${escapeHtml(r.sku || "")}</span>` },
    { label: "Số lượng", render: (r) => `<b style="font-size:12px;">${escapeHtml(r.quantity || "1")}</b>`, style: "text-align:center;" },
    { label: "Giá SP", render: (r) => formatMoneyDisplay(r.productPrice || r.unitCost) },
    { label: "Tên khách", render: (r) => escapeHtml(r.tenKhach || "") },
    { label: "Người nhận", render: (r) => escapeHtml(r.ngNhan || "") },
    { label: "Địa chỉ", render: (r) => `<span title="${escapeHtml(r.diaChi || "")}" style="display:inline-block; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(r.diaChi || "")}</span>` },
    { label: "Ngày tạo", render: (r) => `<span style="color:#64748b; font-size:10px;">${escapeHtml(r.orderCreatedAt || "")}</span>` },
    { 
      label: "Link đơn", 
      render: (r) => {
        const link = r.linkDon || r.link_don || (r.orderId ? `https://banhang.shopee.vn/portal/sale/order/${r.orderId}` : "");
        return link ? `<a href="${escapeHtml(link)}" class="preview-order-link-anchor" data-order-link="${escapeHtml(link)}" target="_blank" style="color:#2563eb; font-weight:600; text-decoration:underline; cursor:pointer;" title="Mở trang chi tiết đơn hàng">Link</a>` : '';
      }
    }
  ];

  function updateTogglePreviewViewBtnText() {
    if (!btnToggleViewModePreview) return;
    if (previewViewMode === "row") {
      btnToggleViewModePreview.innerHTML = "🔄 Xem: Dạng thẻ dọc";
      btnToggleViewModePreview.title = "Đang ở kiểu xem dạng dòng. Bấm để chuyển sang dạng thẻ dọc";
      btnToggleViewModePreview.style.background = "#f0fdf4";
      btnToggleViewModePreview.style.color = "#047857";
      btnToggleViewModePreview.style.borderColor = "#86efac";
    } else {
      btnToggleViewModePreview.innerHTML = "🔄 Xem: Dạng dòng";
      btnToggleViewModePreview.title = "Đang ở kiểu xem dạng thẻ. Bấm để chuyển sang dạng dòng";
      btnToggleViewModePreview.style.background = "#eff6ff";
      btnToggleViewModePreview.style.color = "#1d4ed8";
      btnToggleViewModePreview.style.borderColor = "#bfdbfe";
    }
  }

  if (btnToggleViewModePreview) {
    updateTogglePreviewViewBtnText();
    btnToggleViewModePreview.addEventListener("click", () => {
      previewViewMode = (previewViewMode === "row") ? "vertical" : "row";
      localStorage.setItem("shopee_preview_view_mode", previewViewMode);
      updateTogglePreviewViewBtnText();
      renderPreviewRows(latestPreviewRows, currentPreviewExistingInfo);
    });
  }

  function compareOrderRows(newValues, existingRows) {
    if (!Array.isArray(existingRows) || existingRows.length === 0) {
      return { isMatch: false, diffs: ["Đơn hàng chưa có trong Sheet DH"], isNew: true, hasModifiedStatus: false, existingStatus: "" };
    }

    let hasModifiedStatus = false;
    let existingStatus = "";
    for (const r of existingRows) {
      if (!Array.isArray(r)) continue;
      const tt = String(r[tinhTrangColumnIdx] || r[14] || "").trim();
      const st = String(r[trangThaiColumnIdx] || r[15] || "").trim();
      const fullSt = st || tt;
      if (isOrderCustomOrModifiedStatus(fullSt)) {
        hasModifiedStatus = true;
        existingStatus = fullSt;
        break;
      }
    }

    if (newValues.length !== existingRows.length) {
      return {
        isMatch: false,
        diffs: [`Số dòng sản phẩm khác nhau (Sheet: ${existingRows.length} dòng, Shopee: ${newValues.length} dòng)`],
        isNew: false,
        hasModifiedStatus,
        existingStatus
      };
    }

    const diffs = [];

    for (let i = 0; i < newValues.length; i++) {
      const n = newValues[i] || [];
      const e = existingRows[i] || [];

      const normNum = (val) => {
        if (typeof val === 'number') return val;
        const str = String(val || "").replace(/[^\d.-]/g, '');
        return str === '' ? 0 : Number(str);
      };

      const normStr = (val) => String(val || "").trim().toLowerCase();

      // So sánh SKU
      if (normStr(n[16]) && normStr(e[16]) && normStr(n[16]) !== normStr(e[16])) {
        diffs.push(`Dòng ${i+1}: SKU khác nhau (Sheet: "${e[16]}", Shopee: "${n[16]}")`);
      }

      // So sánh Số lượng (SLG)
      const nQty = normNum(n[18]);
      const eQty = normNum(e[18]);
      if (nQty !== eQty) {
        diffs.push(`Dòng ${i+1}: Số lượng khác nhau (Sheet: ${eQty}, Shopee: ${nQty})`);
      }

      // So sánh Đơn giá (don_gia)
      const nPrice = normNum(n[19]);
      const ePrice = normNum(e[19]);
      if (nPrice !== ePrice && Math.abs(nPrice - ePrice) > 1) {
        diffs.push(`Dòng ${i+1}: Đơn giá khác nhau (Sheet: ${ePrice.toLocaleString('vi-VN')}₫, Shopee: ${nPrice.toLocaleString('vi-VN')}₫)`);
      }

      // So sánh Thành tiền (thanh_tien)
      const nTotal = normNum(n[20]);
      const eTotal = normNum(e[20]);
      if (nTotal !== eTotal && Math.abs(nTotal - eTotal) > 1) {
        diffs.push(`Dòng ${i+1}: Thành tiền khác nhau (Sheet: ${eTotal.toLocaleString('vi-VN')}₫, Shopee: ${nTotal.toLocaleString('vi-VN')}₫)`);
      }

      // So sánh Doanh thu (doanh_thu)
      const nIncome = normNum(n[10]);
      const eIncome = normNum(e[10]);
      if (nIncome !== eIncome && Math.abs(nIncome - eIncome) > 1) {
        diffs.push(`Dòng ${i+1}: Doanh thu khác nhau (Sheet: ${eIncome.toLocaleString('vi-VN')}₫, Shopee: ${nIncome.toLocaleString('vi-VN')}₫)`);
      }

      // So sánh Tổng tiền (tong_tien)
      const nTong = normNum(n[5]);
      const eTong = normNum(e[5]);
      if (nTong !== eTong && Math.abs(nTong - eTong) > 1) {
        diffs.push(`Dòng ${i+1}: Tổng tiền khác nhau (Sheet: ${eTong.toLocaleString('vi-VN')}₫, Shopee: ${nTong.toLocaleString('vi-VN')}₫)`);
      }
    }

    return {
      isMatch: diffs.length === 0,
      diffs,
      isNew: false,
      hasModifiedStatus,
      existingStatus
    };
  }

  function renderPreviewRows(rows, existingInfo = { exists: false, rowNums: [], comparison: null }, wasSaved = false) {
    latestPreviewRows = Array.isArray(rows) ? rows : [];
    currentPreviewExistingInfo = existingInfo || { exists: false, rowNums: [], comparison: null };
    if (!previewCard) return;

    if (latestPreviewRows.length > 0) {
      try {
        chrome.storage.local.set({
          nhieuDonLastPreviewRows: latestPreviewRows,
          nhieuDonLastPreviewExistingInfo: currentPreviewExistingInfo,
          nhieuDonLastPreviewWasSaved: wasSaved
        });
      } catch (e) {}
    }

    previewCard.style.display = "block";
    if (previewBody) previewBody.style.display = "block";
    if (btnTogglePreviewBody) btnTogglePreviewBody.textContent = "▲ Thu gọn";

    if (!latestPreviewRows.length) {
      const rowCols = window.orderTabUtils?.rowViewColumns || previewRowColumns;
      if (previewThead) {
        previewThead.innerHTML = `<tr>${rowCols.map(c => `<th style="padding: 7px 8px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; white-space: nowrap; font-size: 11px; font-weight: 600; color: #334155;">${c.label}</th>`).join("")}</tr>`;
      }
      if (previewTbody) {
        previewTbody.innerHTML = `<tr><td colspan="${rowCols.length || 10}" style="text-align: center; padding: 15px; color: #64748b;">Chưa có dữ liệu đơn hàng vừa đọc. Mở trang chi tiết đơn hoặc bấm <b>🕹️ Đọc đơn</b>.</td></tr>`;
      }
      return;
    }

    const isExisting = !!currentPreviewExistingInfo?.exists;
    const rowNums = currentPreviewExistingInfo?.rowNums || [];
    const comparison = currentPreviewExistingInfo?.comparison;
    const sampleMdh = latestPreviewRows[0]?.orderId || "";
    const sampleMvd = latestPreviewRows[0]?.tracking || "";

    if (previewTitle) {
      previewTitle.innerHTML = `Đơn hàng vừa đọc: <b style="color:#2563eb;">${escapeHtml(sampleMdh)}</b> ${sampleMvd ? `| MVD: <b style="color:#0f172a;">${escapeHtml(sampleMvd)}</b>` : ""}`;
    }

    // Banner trạng thái & đối soát chi tiết giữa bản đọc và Sheet DH Realtime
    if (nhieuDonPreviewStatus) {
      if (comparison && comparison.hasModifiedStatus) {
        const rowText = rowNums && rowNums.length > 0 ? ` (Dòng ${rowNums.join(", ")})` : "";
        nhieuDonPreviewStatus.innerHTML = `
          <div style="background: #fefce8; border: 1.5px solid #eab308; border-radius: 6px; padding: 6px 10px; color: #854d0e; font-size: 11px;">
            <div style="font-weight: bold; margin-bottom: 3px;">ℹ️ ĐƠN HÀNG ĐÃ ĐƯỢC ĐỔI TÌNH TRẠNG: <span style="color:#dc2626; font-weight:bold;">${escapeHtml(comparison.existingStatus || "")}</span>${rowText}</div>
            <div style="font-size: 10px; color: #713f12;">Hệ thống đã khóa tự động cập nhật để bảo toàn tình trạng bạn đã chọn. Bấm nút bên dưới nếu muốn cập nhật đè.</div>
          </div>
        `;
      } else if (wasSaved && isExisting && comparison && !comparison.isMatch) {
        nhieuDonPreviewStatus.innerHTML = `
          <div style="background: #f0fdf4; border: 1.5px solid #10b981; border-radius: 6px; padding: 6px 10px; color: #15803d; font-size: 11px;">
            <div style="font-weight: bold; margin-bottom: 3px;">✅ ĐÃ CẬP NHẬT LẠI VÀO SHEET DH & BẢNG REALTIME KHỚP 100%!</div>
            <div style="font-size: 10px; color: #047857;">Mã đơn: <b>${escapeHtml(sampleMdh)}</b> (Dòng ${rowNums.join(", ")}). Đã sửa các sai lệch: ${escapeHtml(comparison.diffs.join("; "))}</div>
          </div>
        `;
      } else if (wasSaved) {
        nhieuDonPreviewStatus.innerHTML = `<span style="color: #15803d; font-weight: bold; background: #dcfce7; padding: 4px 8px; border-radius: 4px; border: 1px solid #86efac; display: block;">✅ Đã lưu thành công vào Sheet DH (Mã đơn: ${escapeHtml(sampleMdh)})</span>`;
      } else if (isExisting && comparison && !comparison.isMatch) {
        const rowText = rowNums && rowNums.length > 0 ? ` (Dòng ${rowNums.join(", ")})` : "";
        nhieuDonPreviewStatus.innerHTML = `
          <div style="background: #fef2f2; border: 1.5px solid #ef4444; border-radius: 6px; padding: 6px 10px; color: #991b1b; font-size: 11px;">
            <div style="font-weight: bold; margin-bottom: 3px;">⚠️ DỮ LIỆU TRONG SHEET DH CHƯA KHỚP VỚI BẢNG TRÊN SHOPEE (Dòng ${rowNums.join(", ")})!</div>
            <div style="font-size: 10px; margin-bottom: 4px;">Chi tiết sai lệch:${comparison.diffs.map(d => `<br>• ${escapeHtml(d)}`).join("")}</div>
            <div style="font-weight: bold; color: #dc2626;">👉 Bấm "Cập nhật khớp DH" ngay để đồng bộ khớp 100%!</div>
          </div>
        `;
      } else if (isExisting && comparison && comparison.isMatch) {
        const rowText = rowNums && rowNums.length > 0 ? ` (Dòng ${rowNums.join(", ")})` : "";
        nhieuDonPreviewStatus.innerHTML = `<span style="color: #15803d; font-weight: bold; background: #ecfdf5; padding: 4px 8px; border-radius: 4px; border: 1px solid #a7f3d0; display: block;">✅ Dữ liệu trên trang KHỚP 100% với Sheet DH${rowText}. (Không cần cập nhật)</span>`;
      } else if (isExisting) {
        const rowText = rowNums && rowNums.length > 0 ? ` (Dòng ${rowNums.join(", ")})` : "";
        nhieuDonPreviewStatus.innerHTML = `<span style="color: #b45309; font-weight: bold; background: #fef08a; padding: 4px 8px; border-radius: 4px; border: 1px solid #fde047; display: block;">⚠️ Đơn hàng đã có trong Sheet DH${rowText}. Bấm "Cập nhật DH" để lưu đè.</span>`;
      } else {
        nhieuDonPreviewStatus.innerHTML = `<span style="color: #0369a1; font-weight: bold; background: #e0f2fe; padding: 4px 8px; border-radius: 4px; border: 1px solid #bae6fd; display: block;">✨ Đơn hàng mới (Chưa có trong Sheet). Mã đơn: ${escapeHtml(sampleMdh)}</span>`;
      }
    }

    if (btnSavePreview) {
      if (comparison && comparison.hasModifiedStatus) {
        btnSavePreview.textContent = "Cập nhật DH";
        btnSavePreview.style.background = "#d97706";
        btnSavePreview.style.borderColor = "#b45309";
      } else if (wasSaved || (isExisting && comparison && comparison.isMatch)) {
        btnSavePreview.textContent = "✓ Đã khớp Sheet DH";
        btnSavePreview.style.background = "#10b981";
        btnSavePreview.style.borderColor = "#059669";
      } else if (isExisting && comparison && !comparison.isMatch) {
        btnSavePreview.textContent = "🔄 Cập nhật khớp DH";
        btnSavePreview.style.background = "#dc2626";
        btnSavePreview.style.borderColor = "#b91c1c";
      } else if (isExisting) {
        btnSavePreview.textContent = "Cập nhật DH";
        btnSavePreview.style.background = "#d97706";
        btnSavePreview.style.borderColor = "#b45309";
      } else {
        btnSavePreview.textContent = "Lưu DH";
        btnSavePreview.style.background = "#16a34a";
        btnSavePreview.style.borderColor = "#15803d";
      }
      btnSavePreview.disabled = false;
    }

    const rowCols = window.orderTabUtils?.rowViewColumns || previewRowColumns;
    const renderVerticalFn = window.orderTabUtils?.renderVerticalDetails;

    if (previewViewMode === "row") {
      // 1. Header dạng dòng (Bảng ngang chuẩn như tab Đơn hàng)
      if (previewThead) {
        previewThead.innerHTML = `<tr>${rowCols.map(c => `<th style="padding: 7px 8px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; white-space: nowrap; font-size: 11px; font-weight: 600; color: #334155; position: sticky; top: 0; z-index: 2;">${c.label}</th>`).join("")}</tr>`;
      }

      // 2. Body dạng dòng
      if (previewTbody) {
        previewTbody.innerHTML = latestPreviewRows.map((row, idx) => {
          const isEven = idx % 2 === 0;
          let rowBg = isEven ? "#ffffff" : "#f8fafc";
          const rowLink = row.linkDon || row.link_don || (row.orderId ? `https://banhang.shopee.vn/portal/sale/order/${row.orderId}` : "");
          return `
            <tr class="preview-order-row-clickable" data-order-link="${escapeHtml(rowLink)}" style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'" title="Bấm vào dòng để mở chi tiết đơn hàng: ${escapeHtml(row.orderId || '')}">
              ${rowCols.map(col => `
                <td style="padding: 6px 8px; font-size: 11px; white-space: nowrap; ${col.style || ''}">${col.render(row, idx)}</td>
              `).join("")}
            </tr>
          `;
        }).join("");

        previewTbody.querySelectorAll('.preview-order-row-clickable').forEach(tr => {
          tr.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.nhieu-don-copyable')) return;
            const aEl = e.target.closest('a');
            if (aEl) {
              e.preventDefault();
              e.stopPropagation();
              const href = aEl.getAttribute('data-order-link') || aEl.getAttribute('href');
              if (href && href !== '#' && !href.startsWith('javascript:')) {
                openOrderLink(href);
                return;
              }
            }
            const link = tr.getAttribute('data-order-link');
            if (link) {
              openOrderLink(link);
            }
          });
        });
      }
    } else {
      // Header dạng thẻ dọc
      if (previewThead) {
        previewThead.innerHTML = `<tr><th style="padding: 6px; border-bottom: 1px solid #cbd5e1;">Thong tin don hang</th></tr>`;
      }
      if (previewTbody) {
        if (renderVerticalFn) {
          previewTbody.innerHTML = latestPreviewRows.map((row) => `
            <tr>
              <td style="padding: 6px; border-bottom: 1px solid #edf2f7; vertical-align: top; white-space: normal;">${renderVerticalFn(row, isExisting, rowNums)}</td>
            </tr>
          `).join("");
        }
      }
    }
  }

  async function readShopeeOrderDetail(options = {}) {
    const isAuto = !!options.auto;
    if (isReadingShopeeOrder) return;

    try {
      // 1. Tìm tab Shopee chi tiết đơn hàng (CHỈ ĐỌC LINK CÓ ID: ví dụ /portal/sale/order/242102147201615)
      let targetTab = null;
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const isShopeeOrderDetailUrl = (url) => {
        if (!url || typeof url !== "string") return false;
        if (!/^https:\/\/banhang\.shopee\.vn\/portal\/sale\/order/i.test(url)) return false;
        if (/(returnrefundcancel|\/sale\/return|\/cancel|\/refund)/i.test(url)) return false;

        // Bắt buộc link phải có ID đơn hàng: /portal/sale/order/[ID] (ví dụ: /portal/sale/order/242102147201615)
        const matchPath = url.match(/^https:\/\/banhang\.shopee\.vn\/portal\/sale\/order\/(?:detail\/)?([0-9a-zA-Z]{8,})(?:[?#\/]|$)/i);
        if (matchPath) {
          const idSegment = matchPath[1].toLowerCase();
          const systemSegments = /^(order|list|mass|shipping|shipment|return|setting|settings|batch|all|unprocessed|toship|completed|cancelled)$/i;
          if (!systemSegments.test(idSegment)) {
            return true;
          }
        }

        const matchQuery = url.match(/^https:\/\/banhang\.shopee\.vn\/portal\/sale\/order.*[?&](?:order_sn|orderId|order_id|ordersn)=([0-9a-zA-Z]{8,})/i);
        if (matchQuery) {
          return true;
        }

        return false;
      };

      if (isShopeeOrderDetailUrl(activeTab?.url)) {
        targetTab = activeTab;
      } else if (!isAuto) {
        // Chỉ khi người dùng bấm nút đọc thủ công mới quét các tab khác đang mở
        const tabs = await chrome.tabs.query({ url: "*://banhang.shopee.vn/portal/sale/order/*" });
        if (tabs && tabs.length > 0) {
          targetTab = tabs.find(t => isShopeeOrderDetailUrl(t.url));
        }
      }

      if (!targetTab?.id || !isShopeeOrderDetailUrl(targetTab.url)) {
        if (!isAuto) {
          alert("Chỉ đọc link chi tiết đơn hàng có ID (ví dụ: https://banhang.shopee.vn/portal/sale/order/242102147201615).\nVui lòng mở trang chi tiết đơn hàng trước!");
        }
        return;
      }

      // Throttle khi tự động đọc (không lặp lại nếu cùng URL trong 3s)
      const now = Date.now();
      if (isAuto) {
        if (targetTab.url === lastAutoReadUrl && (now - lastAutoReadAt < 3000)) {
          return;
        }
      }

      isReadingShopeeOrder = true;
      if (btnReadOrder && !isAuto) {
        btnReadOrder.disabled = true;
        btnReadOrder.innerHTML = "⏳ Đang đọc...";
      }

      const readOrderFn = window.orderTabUtils?.readOrderFromTab;
      if (!readOrderFn) {
        if (!isAuto) alert("Tiện ích đọc đơn hàng chưa sẵn sàng. Hãy thử lại!");
        return;
      }

      const response = await readOrderFn(targetTab.id);
      if (!response?.ok || !response.rows || response.rows.length === 0) {
        if (!isAuto) alert(response?.error || response?.message || "Không đọc được dữ liệu đơn từ trang Shopee.");
        return;
      }

      const sampleMdh = String(response.orderId || response.rows[0]?.orderId || "").trim();
      const sampleMvd = String(response.tracking || response.rows[0]?.tracking || "").trim();

      // Bắt buộc phải có mã đơn hàng hoặc mã vận đơn
      if (!sampleMdh && !sampleMvd) {
        if (!isAuto) alert("Không tìm thấy Mã đơn hàng hoặc Mã vận đơn trên trang.");
        return;
      }

      lastAutoReadUrl = targetTab.url;
      lastAutoReadAt = now;

      const getCurrentMaGianFn = window.orderTabUtils?.getCurrentMaGian;
      const rowsToDhValuesFn = window.orderTabUtils?.rowsToDhValues;
      const maGian = getCurrentMaGianFn ? await getCurrentMaGianFn() : "";
      const dhValues = rowsToDhValuesFn ? await rowsToDhValuesFn(response.rows, maGian) : [];

      if (!dhValues.length) {
        if (!isAuto) alert("Không thể chuyển đổi dữ liệu đơn sang định dạng dòng Sheet DH.");
        return;
      }

      latestPreviewRows = response.rows;
      latestPreviewDhValues = dhValues;

      // 1. Kiểm tra đơn hàng đã tồn tại trong Sheet DH chưa và lấy dữ liệu đang lưu trong Sheet
      let exists = false;
      let rowNums = [];
      let existingRows = [];
      try {
        const checkRes = await new Promise((res) => {
          chrome.runtime.sendMessage({
            type: "CHECK_DH_ORDER_EXISTS",
            mdh: sampleMdh,
            mvd: sampleMvd
          }, res);
        });
        if (checkRes?.ok && checkRes.exists) {
          exists = true;
          rowNums = checkRes.rowNums || [];
          existingRows = checkRes.existingRows || [];
        }
      } catch (e) {
        console.warn("Lỗi kiểm tra đơn hàng:", e);
      }

      // Nếu không có existingRows từ background, tìm trong allData của tab Nhiều đơn hàng
      if (exists && (!existingRows || existingRows.length === 0)) {
        const normMdh = sampleMdh.toLowerCase();
        const normMvd = sampleMvd.toLowerCase();
        existingRows = allData
          .filter(item => {
            const rMdh = String(item.cells[mdhColumnIdx] || "").trim().toLowerCase();
            const rMvd = String(item.cells[mvdColumnIdx] || "").trim().toLowerCase();
            return (normMdh && rMdh === normMdh) || (normMvd && rMvd === normMvd);
          })
          .map(item => item.cells);
      }

      // 2. 🔍 ĐỐI SOÁT CHI TIẾT DỮ LIỆU BẢN ĐỌC SHOPEE VS DỮ LIỆU ĐANG LƯU TRONG SHEET DH REALTIME
      const comparison = compareOrderRows(dhValues, existingRows);
      const hasModifiedStatus = comparison.hasModifiedStatus;
      currentPreviewExistingInfo = { exists, rowNums, existingRows, comparison, hasModifiedStatus };

      let wasSaved = false;

      // 3. NẾU ĐƠN ĐÃ CÓ TÌNH TRẠNG ĐƯỢC ĐỔI (HỦY / HOÀN / TRẢ / TÌNH TRẠNG KHÁC)
      // -> TUYỆT ĐỐI KHÔNG TỰ ĐỘNG CẬP NHẬT ĐÈ!
      if (hasModifiedStatus) {
        wasSaved = false;
      } else if (exists && !comparison.isMatch) {
        // Nếu đơn thường chưa đổi tình trạng nhưng bị lệch dữ liệu -> Tự động cập nhật
        addDhRows(dhValues, sampleMdh, sampleMvd, true);
        wasSaved = true;
      } else if (!exists && autoSaveToggle && autoSaveToggle.checked) {
        addDhRows(dhValues, sampleMdh, sampleMvd, true);
        wasSaved = true;
      }

      // 4. 🌟 LUÔN HIỂN THỊ ĐẦY ĐỦ BẢNG NỘI DUNG ĐỌC ĐƯỢC LÊN GIAO DIỆN
      renderPreviewRows(latestPreviewRows, currentPreviewExistingInfo, wasSaved);

      if (statusEl) {
        if (hasModifiedStatus) {
          statusEl.innerHTML = `<span style="color:#b45309; font-weight:bold;">ℹ️ Đơn ${sampleMdh} đã đổi tình trạng (${escapeHtml(comparison.existingStatus || "Đã xử lý")}). KHÔNG TỰ ĐỘNG CẬP NHẬT. Bấm "Cập nhật DH" nếu muốn lưu đè.</span>`;
        } else if (exists && !comparison.isMatch) {
          statusEl.innerHTML = `<span style="color:#059669; font-weight:bold;">🔄 Đơn ${sampleMdh} không khớp với Sheet (Khác: ${escapeHtml(comparison.diffs[0] || "")}). ĐÃ TỰ ĐỘNG CẬP NHẬT LẠI KHỚP 100%! ✅</span>`;
        } else if (wasSaved) {
          statusEl.innerHTML = `<span style="color:#059669; font-weight:bold;">✅ Đã đọc thành công đơn ${sampleMdh} (${dhValues.length} sản phẩm) & lưu vào Sheet DH!</span>`;
        } else if (exists && comparison.isMatch) {
          statusEl.innerHTML = `<span style="color:#15803d; font-weight:bold;">✅ Đã đọc đơn ${sampleMdh} (Dòng ${rowNums.join(", ")}) - Dữ liệu KHỚP 100% với Sheet DH.</span>`;
        } else {
          statusEl.innerHTML = `<span style="color:#0284c7; font-weight:bold;">ℹ️ Đã đọc xong đơn ${sampleMdh} (${dhValues.length} sản phẩm). Bấm "Lưu DH" để ghi vào Sheet.</span>`;
        }
      }
    } catch (err) {
      console.error("Lỗi đọc đơn Shopee:", err);
      if (!isAuto) alert("Lỗi đọc đơn: " + err.message);
    } finally {
      isReadingShopeeOrder = false;
      if (btnReadOrder) {
        btnReadOrder.disabled = false;
        btnReadOrder.innerHTML = "📥 Đọc đơn";
      }
    }
  }

  // Nút Lưu đơn từ bảng xem trước vào Sheet DH
  if (btnSavePreview) {
    btnSavePreview.addEventListener("click", () => {
      if (!latestPreviewDhValues?.length) {
        alert("Chưa có dữ liệu đơn hàng để lưu!");
        return;
      }
      const sampleMdh = latestPreviewRows[0]?.orderId || "";
      const sampleMvd = latestPreviewRows[0]?.tracking || "";

      addDhRows(latestPreviewDhValues, sampleMdh, sampleMvd, true);
      currentPreviewExistingInfo = {
        exists: true,
        rowNums: currentPreviewExistingInfo.rowNums || [],
        existingRows: latestPreviewDhValues,
        comparison: { isMatch: true, diffs: [], isNew: false }
      };
      renderPreviewRows(latestPreviewRows, currentPreviewExistingInfo, true);

      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#059669; font-weight:bold;">✅ Đã cập nhật đồng bộ đơn ${sampleMdh} vào Sheet DH & Bảng Realtime!</span>`;
      }
    });
  }

  // 7. Xử lý các nút Cập nhật trạng thái HỦY / HOÀN / TRẢ trên Preview Card
  function handlePreviewStatusUpdate(status) {
    if (!latestPreviewRows || latestPreviewRows.length === 0) {
      alert("Chưa có dữ liệu đơn hàng xem trước để cập nhật trạng thái!");
      return;
    }
    const sampleMdh = latestPreviewRows[0]?.orderId || "";
    const sampleMvd = latestPreviewRows[0]?.tracking || "";
    if (!sampleMdh) {
      alert("Không tìm thấy Mã đơn hàng!");
      return;
    }

    if (!confirm(`Bạn có chắc muốn cập nhật trạng thái "${status}" cho đơn hàng "${sampleMdh}" vào Sheet DH?`)) {
      return;
    }

    chrome.storage.local.get(["maGian", "dhHoanTextValue"], (storageRes) => {
      const maGian = (inputGian?.value || storageRes.maGian || storageRes.dhHoanTextValue || "").trim();
      
      if (statusEl) {
        statusEl.innerHTML = `⏳ Đang cập nhật trạng thái "${status}" cho đơn ${sampleMdh} vào Sheet DH...`;
      }

      chrome.runtime.sendMessage({
        type: "UPDATE_DH_RETURN_STATUS",
        status: status,
        orderId: sampleMdh,
        tracking: sampleMvd,
        maGian: maGian
      }, (res) => {
        if (res && res.ok) {
          // Cập nhật lại trong allData
          allData.forEach(item => {
            const rMdh = String(item.cells[mdhColumnIdx] || "").trim();
            if (rMdh && rMdh.toLowerCase() === sampleMdh.toLowerCase()) {
              if (status === "Hủy") {
                item.cells[10] = "0";
                item.cells[12] = "0";
                item.cells[13] = "0";
                if (tinhTrangColumnIdx !== -1) item.cells[tinhTrangColumnIdx] = "Hủy";
                if (trangThaiColumnIdx !== -1) item.cells[trangThaiColumnIdx] = "Hủy";
              } else if (status === "Hoàn" || status === "Trả") {
                item.cells[12] = "0";
                if (trangThaiColumnIdx !== -1) item.cells[trangThaiColumnIdx] = status;
                const dt = Number(String(item.cells[10] || 0).replace(/[^0-9.-]/g, '')) || 0;
                const pk = Number(String(item.cells[11] || 0).replace(/[^0-9.-]/g, '')) || 0;
                item.cells[13] = String(dt - pk);
              }
            }
          });
          renderTable();
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#16a34a; font-weight:bold;">✅ Đã cập nhật trạng thái "${status}" cho đơn ${sampleMdh} vào Sheet DH!</span>`;
          }
          if (nhieuDonPreviewStatus) {
            nhieuDonPreviewStatus.innerHTML = `<span style="color:#15803d; font-weight:bold; background:#dcfce7; padding:4px 8px; border-radius:4px; border:1px solid #86efac; display:block;">✅ Đã cập nhật trạng thái "${status}" cho đơn ${sampleMdh} vào Sheet DH!</span>`;
          }
        } else {
          alert("Lỗi cập nhật trạng thái: " + (res?.error || "Không xác định"));
        }
      });
    });
  }

  btnPreviewStatusHuy?.addEventListener("click", () => handlePreviewStatusUpdate("Hủy"));
  btnPreviewStatusHoan?.addEventListener("click", () => handlePreviewStatusUpdate("Hoàn"));
  btnPreviewStatusTra?.addEventListener("click", () => handlePreviewStatusUpdate("Trả"));

  // Nút Copy dữ liệu đơn xem trước dạng TSV
  if (btnCopyPreviewTsv) {
    btnCopyPreviewTsv.addEventListener("click", () => {
      if (!latestPreviewRows?.length) {
        alert("Chưa có dữ liệu đơn hàng để copy!");
        return;
      }
      const tsvStr = window.orderTabUtils?.rowsToTsv ? window.orderTabUtils.rowsToTsv(latestPreviewRows) : "";
      if (tsvStr) {
        navigator.clipboard.writeText(tsvStr).then(() => {
          const oldText = btnCopyPreviewTsv.textContent;
          btnCopyPreviewTsv.textContent = "✓ Đã copy";
          setTimeout(() => { btnCopyPreviewTsv.textContent = oldText; }, 1200);
        });
      }
    });
  }

  // Nút Xuất Excel đơn xem trước
  if (btnExportExcelPreview) {
    btnExportExcelPreview.addEventListener("click", () => {
      if (!latestPreviewRows?.length) {
        alert("Chưa có dữ liệu để xuất Excel.");
        return;
      }
      try {
        if (typeof XLSX === "undefined") {
          alert("Thư viện Excel chưa sẵn sàng.");
          return;
        }
        const exportCols = window.orderTabUtils?.exportColumns || [];
        const normCell = window.orderTabUtils?.normalizeCellForExport || ((r, k) => r?.[k] || "");
        const rows = [exportCols.map(col => col.label)];
        latestPreviewRows.forEach(row => {
          rows.push(exportCols.map(col => normCell(row, col.key)));
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DonHang");
        const sampleMdh = latestPreviewRows[0]?.orderId || "order";
        XLSX.writeFile(wb, `DonHang_${sampleMdh}.xlsx`);
      } catch (e) {
        alert("Lỗi xuất Excel: " + e.message);
      }
    });
  }

  // Toggle & Close bảng xem trước
  if (btnTogglePreviewBody && previewBody) {
    btnTogglePreviewBody.addEventListener("click", () => {
      const isHidden = previewBody.style.display === "none";
      previewBody.style.display = isHidden ? "block" : "none";
      btnTogglePreviewBody.textContent = isHidden ? "▲ Thu gọn" : "▼ Xem chi tiết";
    });
  }

  if (btnClosePreview && previewCard) {
    btnClosePreview.addEventListener("click", () => {
      latestPreviewRows = [];
      currentPreviewExistingInfo = { exists: false, rowNums: [], comparison: null };
      try {
        chrome.storage.local.remove(["nhieuDonLastPreviewRows", "nhieuDonLastPreviewExistingInfo", "nhieuDonLastPreviewWasSaved"]);
      } catch (e) {}
      renderPreviewRows([]);
      if (nhieuDonPreviewStatus) nhieuDonPreviewStatus.innerHTML = "";
      if (previewTitle) previewTitle.textContent = "Đơn hàng vừa đọc";
    });
  }

  // Cấu hình Tự động đọc & Tự động lưu (localStorage)
  if (autoReadToggle) {
    const savedAutoRead = localStorage.getItem("nhieu_don_hang_autoread");
    if (savedAutoRead !== null) {
      autoReadToggle.checked = (savedAutoRead === "true");
    }
    autoReadToggle.addEventListener("change", () => {
      localStorage.setItem("nhieu_don_hang_autoread", String(autoReadToggle.checked));
      if (autoReadToggle.checked) {
        triggerAutoReadOrder();
      }
    });
  }

  if (autoSaveToggle) {
    const savedAutoSave = localStorage.getItem("nhieu_don_hang_autosave");
    if (savedAutoSave !== null) {
      autoSaveToggle.checked = (savedAutoSave === "true");
    } else {
      autoSaveToggle.checked = false;
    }
    autoSaveToggle.addEventListener("change", () => {
      localStorage.setItem("nhieu_don_hang_autosave", String(autoSaveToggle.checked));
    });
  }

  function triggerAutoReadOrder() {
    if (!isTabActive()) return;
    if (autoReadToggle && !autoReadToggle.checked) return;
    readShopeeOrderDetail({ auto: true });
  }

  // Nút bấm Đọc đơn thủ công
  if (btnReadOrder) {
    btnReadOrder.addEventListener("click", () => {
      readShopeeOrderDetail({ auto: false });
    });
  }

  // Khởi động auto-read khi popup vừa mở
  setTimeout(() => {
    triggerAutoReadOrder();
  }, 600);

  // Bộ đếm kiểm tra đọc đơn tự động mỗi 2.5 giây khi tab Nhiều đơn hàng đang mở
  window.setInterval(() => {
    triggerAutoReadOrder();
  }, 2500);

  // =========================================================================
  // 📥 1. XỬ LÝ NHẬP FILE EXCEL BÁO CÁO SHOPEE (10.000 ĐƠN / 5 GIÂY)
  // =========================================================================
  async function handleShopeeExcelFile(file) {
    if (!file) return;
    if (typeof XLSX === "undefined") {
      alert("Thư viện XLSX chưa được tải! Vui lòng tải lại trang.");
      return;
    }

    if (btnUploadExcelShopee) {
      btnUploadExcelShopee.disabled = true;
      btnUploadExcelShopee.innerHTML = "⏳ Đang đọc file...";
    }
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:#0284c7;font-weight:bold;">⏳ Đang đọc file Excel Shopee "${escapeHtml(file.name)}"...</span>`;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!workbook.Sheets[sheetName]) {
          throw new Error("Không tìm thấy dữ liệu trong file Excel.");
        }

        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        if (!rawJson || rawJson.length < 2) {
          throw new Error("File Excel không có dữ liệu đơn hàng.");
        }

        // Tìm dòng tiêu đề (Shopee có thể đặt tiêu đề ở dòng 0, 1 hoặc 2)
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(6, rawJson.length); i++) {
          const rowStr = rawJson[i].map(c => String(c || "").trim().toLowerCase()).join(" | ");
          if (rowStr.includes("mã đơn hàng") || rowStr.includes("order id") || rowStr.includes("order sn") || rowStr.includes("mã vận đơn") || rowStr.includes("mã kiện hàng")) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = 0;
        }

        const rawHeaders = rawJson[headerRowIdx].map(h => String(h || "").trim());
        const headerMap = new Map();
        rawHeaders.forEach((h, idx) => {
          const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
          if (norm && !headerMap.has(norm)) headerMap.set(norm, idx);
        });

        // Helper tìm chỉ số cột theo danh sách tên gọi
        function getColIdx(possibleNames) {
          for (const name of possibleNames) {
            const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
            if (headerMap.has(norm)) return headerMap.get(norm);
          }
          for (const [key, idx] of headerMap.entries()) {
            for (const name of possibleNames) {
              const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
              if (key.includes(norm) || norm.includes(key)) return idx;
            }
          }
          return -1;
        }

        const colMdh = getColIdx(["mã đơn hàng", "order id", "order sn", "mã đơn", "orderid", "ordersn"]);
        const colMvd = getColIdx(["mã vận đơn", "tracking no", "tracking number", "mã kiện hàng", "tracking"]);
        const colNgay = getColIdx(["ngày đặt hàng", "order creation date", "thời gian đặt hàng", "ngày tạo đơn", "ngày đặt", "thời gian đơn hàng được thanh toán"]);
        const colTrangThai = getColIdx(["trạng thái đơn hàng", "trạng thái", "order status"]);
        const colTinhTrang = getColIdx(["trạng thái trả hàng/hoàn tiền", "lý do hủy", "trạng thái hoàn/trả", "return / refund status", "cancel reason"]);
        const colSku = getColIdx(["sku phân loại hàng", "sku phân loại", "sku sản phẩm", "variation sku", "parent sku", "mã sku", "sku"]);
        const colSlg = getColIdx(["số lượng", "quantity", "số lượng mua", "sl"]);
        const colGiaGoc = getColIdx(["giá gốc", "giá ưu đãi", "giá bán", "đơn giá", "deal price", "original price"]);
        const colTongTien = getColIdx(["tổng số tiền người mua thanh toán", "tổng giá trị đơn hàng (vnd)", "tổng giá bán (sản phẩm)", "tổng tiền hàng", "thành tiền"]);
        const colVoucherShop = getColIdx(["mã giảm giá của shop", "voucher của shop", "shop voucher", "giảm giá từ combo của shop"]);
        const colPhiVc = getColIdx(["phí vận chuyển (dự kiến)", "phí vận chuyển mà người mua trả", "phí vận chuyển", "shipping fee"]);
        const colPhiCoDinh = getColIdx(["phí cố định", "fixed fee"]);
        const colPhiDichVu = getColIdx(["phí dịch vụ", "service fee"]);
        const colPhiThanhToan = getColIdx(["phí thanh toán", "payment fee"]);
        const colKyQuy = getColIdx(["tiền ký quỹ", "escrow amount"]);
        const colPhuPhi = getColIdx(["phụ phí", "surcharge"]);
        const colThue = getColIdx(["thuế", "thuế gtgt", "vat", "wht"]);
        const colDoanhThu = getColIdx(["doanh thu", "doanh thu ước tính", "tổng thu nhập", "tiền thu về", "estimated order income"]);
        const colTenKhach = getColIdx(["người mua", "buyer username", "tên người mua", "buyer"]);
        const colNgNhan = getColIdx(["tên người nhận", "recipient name", "người nhận"]);
        const colDiaChi = getColIdx(["địa chỉ nhận hàng", "địa chỉ", "shipping address", "tỉnh/thành phố"]);

        const maGian = (inputGian?.value || "").trim();

        // 1. Tải bảng giá từ DS_SP để tra giá vốn (gia_nhap / don_gia)
        let dsSpMap = new Map();
        try {
          const dsRes = await new Promise((res) => chrome.runtime.sendMessage({ type: "FETCH_DS_SP" }, res));
          if (dsRes?.ok && dsRes.values && dsRes.values.length > 1) {
            const h = dsRes.values[0].map(x => String(x || "").trim().toLowerCase());
            const idSpIdx = h.findIndex(x => x === "id_sp" || x === "mã sp" || x.includes("id_sp"));
            const giaBanIdx = h.findIndex(x => x === "gia_ban" || x === "giá bán" || x.includes("gia_ban") || x.includes("giá"));
            const bIdx = idSpIdx !== -1 ? idSpIdx : 1;
            const eIdx = giaBanIdx !== -1 ? giaBanIdx : 4;
            for (let r = 1; r < dsRes.values.length; r++) {
              const row = dsRes.values[r];
              const key = String(row[bIdx] || "").trim().toLowerCase();
              if (key) {
                const p = parseFloat(String(row[eIdx] || "").replace(/[^\d-]/g, "")) || 0;
                dsSpMap.set(key, p);
              }
            }
          }
        } catch (e) {
          console.warn("Lỗi đọc DS_SP:", e);
        }

        // 2. Parse dữ liệu các dòng Excel
        const dataRows = rawJson.slice(headerRowIdx + 1);

        function formatShopeeExcelDate(val) {
          if (!val) return { ngay: "", ngayGio: "" };
          if (typeof val === "number") {
            const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, "0");
            const d = String(dateObj.getDate()).padStart(2, "0");
            const hh = String(dateObj.getHours()).padStart(2, "0");
            const mm = String(dateObj.getMinutes()).padStart(2, "0");
            return { ngay: `${y}-${m}-${d}`, ngayGio: `${y}-${m}-${d} ${hh}:${mm}` };
          }
          const s = String(val).trim();
          const match = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (match) {
            const y = match[1];
            const m = match[2].padStart(2, "0");
            const d = match[3].padStart(2, "0");
            return { ngay: `${y}-${m}-${d}`, ngayGio: s };
          }
          const matchVn = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          if (matchVn) {
            const d = matchVn[1].padStart(2, "0");
            const m = matchVn[2].padStart(2, "0");
            const y = matchVn[3];
            return { ngay: `${y}-${m}-${d}`, ngayGio: s };
          }
          return { ngay: s.split(" ")[0] || s, ngayGio: s };
        }

        const orderTempList = [];
        dataRows.forEach(row => {
          if (!row || !row.length) return;
          const mdh = String(colMdh !== -1 ? row[colMdh] : "").trim();
          const mvd = String(colMvd !== -1 ? row[colMvd] : "").trim();
          const sku = String(colSku !== -1 ? row[colSku] : "").trim();
          if (!mdh && !mvd && !sku) return;

          const dateInfo = formatShopeeExcelDate(colNgay !== -1 ? row[colNgay] : "");
          const slg = Math.max(1, parseFloat(String(colSlg !== -1 ? row[colSlg] : "1").replace(/[^\d.]/g, "")) || 1);
          const idSp = sku.length >= 10 ? sku.substring(0, 10) : sku;

          let donGia = dsSpMap.get(idSp.toLowerCase());
          if (donGia === undefined || donGia === null || donGia === 0) {
            donGia = parseFloat(String(colGiaGoc !== -1 ? row[colGiaGoc] : "0").replace(/[^\d.]/g, "")) || 0;
          }
          const thanhTien = slg * donGia;

          const tongTien = parseFloat(String(colTongTien !== -1 ? row[colTongTien] : "0").replace(/[^\d.]/g, "")) || 0;
          const voucherShop = parseFloat(String(colVoucherShop !== -1 ? row[colVoucherShop] : "0").replace(/[^\d.]/g, "")) || 0;
          const phiVc = parseFloat(String(colPhiVc !== -1 ? row[colPhiVc] : "0").replace(/[^\d.]/g, "")) || 0;
          
          let phuPhi = 0;
          if (colPhuPhi !== -1 && row[colPhuPhi]) {
            phuPhi = parseFloat(String(row[colPhuPhi]).replace(/[^\d.]/g, "")) || 0;
          } else {
            const cd = parseFloat(String(colPhiCoDinh !== -1 ? row[colPhiCoDinh] : "0").replace(/[^\d.]/g, "")) || 0;
            const dv = parseFloat(String(colPhiDichVu !== -1 ? row[colPhiDichVu] : "0").replace(/[^\d.]/g, "")) || 0;
            const tt = parseFloat(String(colPhiThanhToan !== -1 ? row[colPhiThanhToan] : "0").replace(/[^\d.]/g, "")) || 0;
            const kq = parseFloat(String(colKyQuy !== -1 ? row[colKyQuy] : "0").replace(/[^\d.]/g, "")) || 0;
            phuPhi = cd + dv + tt + kq;
          }

          const thue = parseFloat(String(colThue !== -1 ? row[colThue] : "0").replace(/[^\d.]/g, "")) || 0;
          let doanhThu = parseFloat(String(colDoanhThu !== -1 ? row[colDoanhThu] : "0").replace(/[^\d.]/g, "")) || 0;
          if (!doanhThu && tongTien > 0) {
            doanhThu = Math.max(0, tongTien - voucherShop - phiVc - phuPhi - thue);
          }

          const trangThai = String(colTrangThai !== -1 ? row[colTrangThai] : "").trim();
          const tinhTrang = String(colTinhTrang !== -1 ? row[colTinhTrang] : "").trim();
          const tenKhach = String(colTenKhach !== -1 ? row[colTenKhach] : "").trim();
          const ngNhan = String(colNgNhan !== -1 ? row[colNgNhan] : "").trim();
          const diaChi = String(colDiaChi !== -1 ? row[colDiaChi] : "").trim();
          const linkDon = mdh ? `https://banhang.shopee.vn/portal/sale/order/${mdh}` : "";

          orderTempList.push({
            maGian,
            ngay: dateInfo.ngay,
            ngayGio: dateInfo.ngayGio,
            mdh,
            mvd,
            tongTien,
            voucherShop,
            phiVc,
            phuPhi,
            thue,
            doanhThu,
            trangThai,
            tinhTrang,
            sku,
            idSp,
            slg,
            donGia,
            thanhTien,
            tenKhach,
            ngNhan,
            diaChi,
            linkDon
          });
        });

        // 3. Tính tổng tiền vốn theo MDH
        const mdhTienSpMap = new Map();
        orderTempList.forEach(it => {
          const k = it.mdh || "__order__";
          mdhTienSpMap.set(k, (mdhTienSpMap.get(k) || 0) + it.thanhTien);
        });

        const finalDhValues = orderTempList.map(it => {
          const tienSp = mdhTienSpMap.get(it.mdh || "__order__") || 0;
          const loiNhuan = it.doanhThu - tienSp;
          return [
            it.maGian,           // 0: gian
            it.ngay,             // 1: ngay
            it.ngayGio,          // 2: ngay_gio
            it.mdh,              // 3: mdh
            it.mvd,              // 4: mvd
            it.tongTien,         // 5: tong_tien
            it.voucherShop,      // 6: ma_giam_gia
            it.phiVc,            // 7: phi_vc
            it.phuPhi,           // 8: phu_phi
            it.thue,             // 9: thue
            it.doanhThu,         // 10: doanh_thu
            "",                  // 11: phi_khac
            tienSp,              // 12: tien_sp
            loiNhuan,            // 13: loi_nhuan
            it.tinhTrang,        // 14: tinh_trang
            it.trangThai,        // 15: trang_thai
            it.sku,              // 16: sku
            it.idSp,             // 17: id_sp
            it.slg,              // 18: slg
            it.donGia,           // 19: don_gia
            it.thanhTien,        // 20: thanh_tien
            it.tenKhach,         // 21: ten_khach
            it.ngNhan,           // 22: ng_nhan
            it.diaChi,           // 23: dia_chi
            it.linkDon           // 24: link_don
          ];
        });

        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#16a34a;font-weight:bold;">🚀 Đã đọc ${finalDhValues.length} dòng. Đang lưu vào Google Sheet theo lô...</span>`;
        }

        chrome.runtime.sendMessage({
          type: "BATCH_SAVE_DH_ORDERS",
          values: finalDhValues
        }, (res) => {
          if (btnUploadExcelShopee) {
            btnUploadExcelShopee.disabled = false;
            btnUploadExcelShopee.innerHTML = "📥 Nhập Excel Shopee";
          }
          if (res && res.ok) {
            const uniqueOrders = new Set(finalDhValues.map(r => r[3])).size;
            alert(`🎉 Nhập file Excel thành công!\n\n- Tổng số dòng: ${finalDhValues.length}\n- Số đơn hàng: ${uniqueOrders}\n- Đơn thêm mới: ${res.inserted || 0}\n- Đơn cập nhật: ${res.updated || 0}`);
            if (statusEl) {
              statusEl.innerHTML = `<span style="color:#16a34a;font-weight:bold;">✅ Đã nhập thành công ${finalDhValues.length} dòng (${uniqueOrders} đơn) vào Sheet DH!</span>`;
            }
            loadDhSheetData(false);
          } else {
            alert("Lỗi lưu vào Google Sheet: " + (res?.error || "Không rõ nguyên nhân"));
            if (statusEl) {
              statusEl.innerHTML = `<span style="color:#dc2626;font-weight:bold;">❌ Lỗi lưu dữ liệu: ${res?.error || 'Lỗi không xác định'}</span>`;
            }
          }
        });

      } catch (err) {
        console.error("Lỗi đọc Excel Shopee:", err);
        if (btnUploadExcelShopee) {
          btnUploadExcelShopee.disabled = false;
          btnUploadExcelShopee.innerHTML = "📥 Nhập Excel Shopee";
        }
        alert("Lỗi đọc file Excel: " + err.message);
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#dc2626;">❌ Lỗi đọc file: ${escapeHtml(err.message)}</span>`;
        }
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileUploadExcelShopee) fileUploadExcelShopee.value = "";
  }

  // =========================================================================
  // Helper gọi Shopee API trực tiếp trong tab qua chrome.scripting hoặc sendMessage
  // =========================================================================
  async function fetchShopeePageViaScripting(tabId, page, pageSize, status, startTime, endTime) {
    if (chrome.scripting?.executeScript) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: async (page, pageSize, status, startTime, endTime) => {
            function getCookieVal(name) {
              const value = `; ${document.cookie}`;
              const parts = value.split(`; ${name}=`);
              if (parts.length === 2) return parts.pop().split(';').shift();
              return '';
            }
            const spcCds = getCookieVal('SPC_CDS');
            const spcQuery = spcCds ? `&SPC_CDS=${encodeURIComponent(spcCds)}&SPC_CDS_VER=2` : '';

            const endpoints = [];

            // 1. Ưu tiên sử dụng URL template vừa bắt được từ interceptor
            if (window.__LAST_SHOPEE_ORDER_API__?.url) {
              let templUrl = window.__LAST_SHOPEE_ORDER_API__.url;
              templUrl = templUrl.replace(/page_number=\d+/, `page_number=${page}`).replace(/page=\d+/, `page=${page}`);
              templUrl = templUrl.replace(/page_size=\d+/, `page_size=${pageSize}`).replace(/page_size=\d+/, `page_size=${pageSize}`);
              endpoints.push(templUrl);
            }

            // 2. Danh sách endpoint theo trạng thái và tìm kiếm
            if (startTime && endTime) {
              endpoints.push(`/api/v3/order/search_order_list?page_number=${page}&page_size=${pageSize}&order_status=${encodeURIComponent(status)}&source_type=all&start_time=${startTime}&end_time=${endTime}${spcQuery}`);
              endpoints.push(`/api/seller/v3/order/search_order_list?page_number=${page}&page_size=${pageSize}&order_status=${encodeURIComponent(status)}&source_type=all&start_time=${startTime}&end_time=${endTime}${spcQuery}`);
              endpoints.push(`/api/v4/order/search_order_list?page_number=${page}&page_size=${pageSize}&order_status=${encodeURIComponent(status)}&source_type=all&start_time=${startTime}&end_time=${endTime}${spcQuery}`);
            }

            if (status === "to_ship") {
              endpoints.push(`/api/v3/order/get_ship_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
              endpoints.push(`/api/seller/v3/order/get_ship_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
            }
            if (status === "completed") {
              endpoints.push(`/api/v3/order/get_completed_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
              endpoints.push(`/api/seller/v3/order/get_completed_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
            }
            if (status === "cancelled") {
              endpoints.push(`/api/v3/order/get_cancelled_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
              endpoints.push(`/api/seller/v3/order/get_cancelled_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
            }
            if (status === "tosort") {
              endpoints.push(`/api/v3/order/get_tosort_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
              endpoints.push(`/api/seller/v3/order/get_tosort_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
            }

            // Standard order list endpoints
            endpoints.push(`/api/v3/order/get_order_list?page_number=${page}&page_size=${pageSize}&total=0&source=&order_status=${encodeURIComponent(status)}&source_type=all${spcQuery}`);
            endpoints.push(`/api/seller/v3/order/get_order_list?page_number=${page}&page_size=${pageSize}&total=0&source=&order_status=${encodeURIComponent(status)}&source_type=all${spcQuery}`);
            endpoints.push(`/api/v3/order/search_order_list?page_number=${page}&page_size=${pageSize}&order_status=${encodeURIComponent(status)}&source_type=all${spcQuery}`);
            endpoints.push(`/api/seller/v3/order/search_order_list?page_number=${page}&page_size=${pageSize}&order_status=${encodeURIComponent(status)}&source_type=all${spcQuery}`);
            endpoints.push(`/api/v4/order/get_order_list?page_number=${page}&page_size=${pageSize}&total=0&source=&order_status=${encodeURIComponent(status)}&source_type=all${spcQuery}`);
            endpoints.push(`/api/seller/order/list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
            endpoints.push(`/api/v3/order/get_all_order_list?page_number=${page}&page_size=${pageSize}${spcQuery}`);
            endpoints.push(`/api/v2/orders/?page_number=${page}&page_size=${pageSize}${spcQuery}`);

            let lastErr = null;
            let lastStatus = 0;
            for (const url of endpoints) {
              try {
                const res = await fetch(url, {
                  method: "GET",
                  credentials: "include",
                  headers: { "Accept": "application/json, text/plain, */*" }
                });
                lastStatus = res.status;
                if (!res.ok) continue;
                const json = await res.json();
                if (json && (json.data || json.orders || json.order_list || json.code === 0 || json.message === "success" || Array.isArray(json.list))) {
                  return { ok: true, data: json };
                }
              } catch (e) {
                lastErr = e.message;
              }
            }
            if (lastStatus === 401 || lastStatus === 403) {
              return { ok: false, error: "Phiên đăng nhập Shopee hết hạn. Vui lòng F5 tải lại tab Shopee Kênh Người Bán!" };
            }
            return { ok: false, error: lastErr || `Shopee API trả về mã lỗi ${lastStatus || 404}. Vui lòng mở trang Quản lý đơn hàng (banhang.shopee.vn/portal/sale/order) hoặc sử dụng nút "📥 Nhập Excel Shopee" để nạp 10.000 đơn trong 5s!` };
          },
          args: [page, pageSize, status, startTime, endTime]
        });

        if (results && results[0]?.result) {
          return results[0].result;
        }
      } catch (errScript) {
        console.warn("Lỗi executeScript, fallback sang sendMessage:", errScript);
      }
    }

    // Fallback sang chrome.tabs.sendMessage
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, {
        action: "SHOPEE_FETCH_ORDER_PAGE",
        page,
        pageSize,
        status,
        startTime,
        endTime
      }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: "Không thể kết nối với tab Shopee. Vui lòng bấm F5 tải lại tab Kênh Người Bán Shopee rồi thử lại!"
          });
        } else {
          resolve(res || { ok: false, error: "Không nhận được phản hồi từ tab Shopee." });
        }
      });
    });
  }

  // =========================================================================
  // 🚀 2. QUÉT TỰ ĐỘNG ĐƠN HÀNG QUA API SHOPEE (CHẠY NGẦM KHÔNG CẦN MỞ TAB)
  // =========================================================================
  async function startShopeeApiScanner() {
    if (isApiScanning) return;

    // 1. Tìm tab Shopee Seller đang mở
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({ url: "*://banhang.shopee.vn/*" }, resolve);
    });

    if (!tabs || tabs.length === 0) {
      alert("⚠️ Không tìm thấy tab Kênh Người Bán Shopee nào đang mở!\n\nVui lòng mở một tab 'https://banhang.shopee.vn' trên trình duyệt để tiện ích kết nối API quét ngầm.");
      return;
    }

    const sellerTab = tabs.find(t => t.active) || tabs[0];
    const maGian = (inputGian?.value || "").trim();

    // 2. Tính toán khoảng thời gian
    const preset = datePresetSelect ? datePresetSelect.value : "last_7_days";
    let startTime = null;
    let endTime = null;
    const now = new Date();

    if (preset === "today") {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      startTime = Math.floor(d.getTime() / 1000);
      endTime = Math.floor(Date.now() / 1000);
    } else if (preset === "yesterday") {
      const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      startTime = Math.floor(d1.getTime() / 1000);
      endTime = Math.floor(d2.getTime() / 1000);
    } else if (preset === "last_7_days") {
      startTime = Math.floor((Date.now() - 7 * 86400 * 1000) / 1000);
      endTime = Math.floor(Date.now() / 1000);
    } else if (preset === "last_30_days") {
      startTime = Math.floor((Date.now() - 30 * 86400 * 1000) / 1000);
      endTime = Math.floor(Date.now() / 1000);
    } else if (preset === "this_month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      startTime = Math.floor(d.getTime() / 1000);
      endTime = Math.floor(Date.now() / 1000);
    } else if (preset === "last_month") {
      const d1 = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const d2 = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      startTime = Math.floor(d1.getTime() / 1000);
      endTime = Math.floor(d2.getTime() / 1000);
    } else if (preset === "custom") {
      if (!scanFromDate?.value || !scanToDate?.value) {
        alert("Vui lòng chọn đầy đủ Từ ngày và Đến ngày!");
        return;
      }
      const d1 = new Date(scanFromDate.value + "T00:00:00");
      const d2 = new Date(scanToDate.value + "T23:59:59");
      startTime = Math.floor(d1.getTime() / 1000);
      endTime = Math.floor(d2.getTime() / 1000);
    }

    const statusFilterVal = scanStatusFilter ? scanStatusFilter.value : "all";

    // 3. Tải DS_SP để tra giá vốn
    let dsSpMap = new Map();
    try {
      const dsRes = await new Promise((res) => chrome.runtime.sendMessage({ type: "FETCH_DS_SP" }, res));
      if (dsRes?.ok && dsRes.values && dsRes.values.length > 1) {
        const h = dsRes.values[0].map(x => String(x || "").trim().toLowerCase());
        const idSpIdx = h.findIndex(x => x === "id_sp" || x === "mã sp" || x.includes("id_sp"));
        const giaBanIdx = h.findIndex(x => x === "gia_ban" || x === "giá bán" || x.includes("gia_ban") || x.includes("giá"));
        const bIdx = idSpIdx !== -1 ? idSpIdx : 1;
        const eIdx = giaBanIdx !== -1 ? giaBanIdx : 4;
        for (let r = 1; r < dsRes.values.length; r++) {
          const row = dsRes.values[r];
          const key = String(row[bIdx] || "").trim().toLowerCase();
          if (key) {
            const p = parseFloat(String(row[eIdx] || "").replace(/[^\d-]/g, "")) || 0;
            dsSpMap.set(key, p);
          }
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc DS_SP:", e);
    }

    // UI state
    isApiScanning = true;
    cancelApiScanRequested = false;
    if (btnStartApiScan) btnStartApiScan.style.display = "none";
    if (btnStopApiScan) btnStopApiScan.style.display = "inline-flex";
    if (scanProgressBox) scanProgressBox.style.display = "block";
    if (scanProgressBar) scanProgressBar.style.width = "0%";
    if (scanPercentText) scanPercentText.textContent = "0%";
    if (scanStatusText) scanStatusText.textContent = "Đang kết nối API Shopee Seller...";

    let page = 1;
    const pageSize = 40;
    let totalOrders = 0;
    let fetchedOrders = 0;
    let accumulatedRows = [];
    let grandTotalInserted = 0;
    let grandTotalUpdated = 0;

    try {
      while (isApiScanning && !cancelApiScanRequested) {
        if (scanStatusText) {
          scanStatusText.textContent = `Đang tải trang ${page}... (${fetchedOrders} / ${totalOrders || '...'} đơn)`;
        }

        const res = await fetchShopeePageViaScripting(
          sellerTab.id,
          page,
          pageSize,
          statusFilterVal,
          startTime,
          endTime
        );

        if (!res || !res.ok || !res.data) {
          throw new Error(res?.error || "Không thể gọi API từ tab Shopee.");
        }

        const payload = res.data;
        const data = payload.data || payload;
        const orders = data.orders || data.order_list || data.list || data.user_orders || data.orders_list || data.cards || [];
        totalOrders = data.total || data.total_count || data.page_info?.total || totalOrders || orders.length;

        if (orders.length === 0) {
          break;
        }

        fetchedOrders += orders.length;
        const percent = totalOrders > 0 ? Math.min(100, Math.round((fetchedOrders / totalOrders) * 100)) : 50;
        if (scanProgressBar) scanProgressBar.style.width = `${percent}%`;
        if (scanPercentText) scanPercentText.textContent = `${percent}%`;

        orders.forEach(order => {
          const mdh = String(order.order_sn || order.ordersn || order.order_id || order.orderid || order.id || "").trim();
          const mvd = String(order.tracking_no || order.tracking_number || order.package_list?.[0]?.tracking_no || order.shipping_carrier_tracking_no || "").trim();
          
          let rawTime = order.create_time || order.created_at || order.order_create_time || order.pay_time || 0;
          if (rawTime > 0 && rawTime < 10000000000) rawTime = rawTime * 1000;
          const createTime = rawTime ? new Date(rawTime) : new Date();

          const y = createTime.getFullYear();
          const m = String(createTime.getMonth() + 1).padStart(2, "0");
          const d = String(createTime.getDate()).padStart(2, "0");
          const hh = String(createTime.getHours()).padStart(2, "0");
          const mm = String(createTime.getMinutes()).padStart(2, "0");
          const ngay = `${y}-${m}-${d}`;
          const ngayGio = `${y}-${m}-${d} ${hh}:${mm}`;

          const trangThai = String(order.order_status || order.status || order.order_status_desc || order.status_desc || "").trim();
          const tinhTrang = String(order.cancel_reason || order.return_status || order.cancel_reason_desc || "").trim();
          const tenKhach = String(order.buyer_user?.user_name || order.buyer_username || order.buyer_name || "").trim();
          const ngNhan = String(order.shipping_address?.name || order.recipient_address?.name || order.buyer_address?.name || "").trim();
          const diaChi = String(order.shipping_address?.full_address || order.recipient_address?.full_address || order.shipping_address?.city || "").trim();
          const linkDon = mdh ? `https://banhang.shopee.vn/portal/sale/order/${mdh}` : "";

          const tongTien = parseFloat(order.total_amount || order.order_amount || order.buyer_total_amount || order.buyer_paid_amount || 0) || 0;
          const voucherShop = parseFloat(order.seller_voucher || order.shop_voucher || order.voucher_price || 0) || 0;
          const phiVc = parseFloat(order.actual_shipping_fee || order.shipping_fee || order.estimated_shipping_fee || 0) || 0;
          const phuPhi = parseFloat(order.commission_fee || order.service_fee || order.surcharge || (parseFloat(order.commission_fee||0) + parseFloat(order.service_fee||0) + parseFloat(order.transaction_fee||0)) || 0) || 0;
          const thue = parseFloat(order.tax_amount || order.tax || 0) || 0;
          let doanhThu = parseFloat(order.escrow_amount || order.income_amount || order.final_income || 0) || 0;
          if (!doanhThu && tongTien > 0) {
            doanhThu = Math.max(0, tongTien - voucherShop - phiVc - phuPhi - thue);
          }

          const items = order.order_items || order.item_list || order.items || order.order_lines || [];
          if (items.length > 0) {
            items.forEach(item => {
              const sku = String(item.model_sku || item.item_sku || item.sku || item.variation_sku || "").trim();
              const idSp = sku.length >= 10 ? sku.substring(0, 10) : (sku || String(item.item_id || ""));
              const slg = parseFloat(item.amount || item.quantity || item.count || 1) || 1;
              let donGia = dsSpMap.get(idSp.toLowerCase());
              if (donGia === undefined || donGia === null || donGia === 0) {
                donGia = parseFloat(item.item_price || item.model_price || item.price || item.deal_price || 0) || 0;
              }
              const thanhTien = slg * donGia;

              accumulatedRows.push({
                maGian, ngay, ngayGio, mdh, mvd, tongTien, voucherShop, phiVc, phuPhi, thue, doanhThu,
                trangThai, tinhTrang, sku, idSp, slg, donGia, thanhTien, tenKhach, ngNhan, diaChi, linkDon
              });
            });
          } else {
            accumulatedRows.push({
              maGian, ngay, ngayGio, mdh, mvd, tongTien, voucherShop, phiVc, phuPhi, thue, doanhThu,
              trangThai, tinhTrang, sku: "", idSp: "", slg: 1, donGia: tongTien, thanhTien: tongTien,
              tenKhach, ngNhan, diaChi, linkDon
            });
          }
        });

        if (accumulatedRows.length >= 300) {
          const rowsToSave = convertTempListToDhFormat(accumulatedRows);
          accumulatedRows = [];
          if (scanStatusText) scanStatusText.textContent = `Đang lưu ${rowsToSave.length} dòng vào Sheet DH...`;
          const saveRes = await new Promise(res => {
            chrome.runtime.sendMessage({ type: "BATCH_SAVE_DH_ORDERS", values: rowsToSave }, res);
          });
          if (saveRes?.ok) {
            grandTotalInserted += saveRes.inserted || 0;
            grandTotalUpdated += saveRes.updated || 0;
          }
        }

        page++;
        await new Promise(r => setTimeout(r, 300));
      }

      if (accumulatedRows.length > 0) {
        const rowsToSave = convertTempListToDhFormat(accumulatedRows);
        accumulatedRows = [];
        if (scanStatusText) scanStatusText.textContent = `Đang lưu ${rowsToSave.length} dòng cuối vào Sheet DH...`;
        const saveRes = await new Promise(res => {
          chrome.runtime.sendMessage({ type: "BATCH_SAVE_DH_ORDERS", values: rowsToSave }, res);
        });
        if (saveRes?.ok) {
          grandTotalInserted += saveRes.inserted || 0;
          grandTotalUpdated += saveRes.updated || 0;
        }
      }

      if (scanProgressBar) scanProgressBar.style.width = "100%";
      if (scanPercentText) scanPercentText.textContent = "100%";
      if (scanStatusText) {
        scanStatusText.textContent = `🎉 Hoàn tất! Quét được ${fetchedOrders} đơn (${grandTotalInserted} mới, ${grandTotalUpdated} cập nhật).`;
      }

      alert(`🎉 Quét đơn Shopee API hoàn tất!\n\n- Đã quét: ${fetchedOrders} đơn\n- Thêm mới: ${grandTotalInserted}\n- Cập nhật: ${grandTotalUpdated}`);
      loadDhSheetData(false);

    } catch (err) {
      console.error("Lỗi khi quét API:", err);
      alert("Lỗi khi quét API Shopee: " + err.message);
      if (scanStatusText) scanStatusText.textContent = `❌ Lỗi: ${err.message}`;
    } finally {
      isApiScanning = false;
      if (btnStartApiScan) btnStartApiScan.style.display = "inline-flex";
      if (btnStopApiScan) btnStopApiScan.style.display = "none";
    }
  }

  function convertTempListToDhFormat(list) {
    const mdhTienSpMap = new Map();
    list.forEach(it => {
      const k = it.mdh || "__order__";
      mdhTienSpMap.set(k, (mdhTienSpMap.get(k) || 0) + it.thanhTien);
    });

    return list.map(it => {
      const tienSp = mdhTienSpMap.get(it.mdh || "__order__") || 0;
      const loiNhuan = it.doanhThu - tienSp;
      return [
        it.maGian, it.ngay, it.ngayGio, it.mdh, it.mvd, it.tongTien, it.voucherShop,
        it.phiVc, it.phuPhi, it.thue, it.doanhThu, "", tienSp, loiNhuan, "",
        "", it.sku, it.idSp, it.slg, it.donGia, it.thanhTien, it.tenKhach,
        it.ngNhan, it.diaChi, it.linkDon
      ];
    });
  }

  // =========================================================================
  // XỬ LÝ ĐỌC DANH SÁCH ĐƠN TỪ TRANG SHOPEE SELLER LIST (/portal/sale/order)
  // =========================================================================
  async function getShopeeOrderListTab() {
    try {
      const tabs = await chrome.tabs.query({});
      // 1. Tab active có URL chứa /portal/sale/order
      const activeOrderTab = tabs.find(t => t.active && t.url && t.url.includes("/portal/sale/order"));
      if (activeOrderTab) return activeOrderTab;

      // 2. Tab bất kỳ có URL chứa /portal/sale/order
      const anyOrderTab = tabs.find(t => t.url && t.url.includes("/portal/sale/order"));
      if (anyOrderTab) return anyOrderTab;

      // 3. Tab active trên banhang.shopee.vn hoặc seller.shopee.vn
      const activeSellerTab = tabs.find(t => t.active && t.url && (t.url.includes("banhang.shopee.vn") || t.url.includes("seller.shopee.vn")));
      if (activeSellerTab) return activeSellerTab;

      // 4. Tab bất kỳ trên banhang.shopee.vn
      const anySellerTab = tabs.find(t => t.url && (t.url.includes("banhang.shopee.vn") || t.url.includes("seller.shopee.vn") || t.url.includes("shopee.vn/portal/sale")));
      return anySellerTab || null;
    } catch (err) {
      console.error("Lỗi khi tìm tab Shopee:", err);
      return null;
    }
  }

  async function sendMessageToTab(tabId, message) {
    try {
      return await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (res) => {
          if (chrome.runtime.lastError) {
            const lastErrMsg = chrome.runtime.lastError.message || "";
            chrome.scripting?.executeScript({
              target: { tabId: tabId },
              files: ["xlsx.full.min.js", "html2pdf.bundle.min.js", "pdf-lib.min.js", "content.js"]
            }, () => {
              if (chrome.runtime.lastError) {
                resolve({ ok: false, error: lastErrMsg });
              } else {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (res2) => {
                    if (chrome.runtime.lastError) {
                      resolve({ ok: false, error: chrome.runtime.lastError.message });
                    } else {
                      resolve(res2 || { ok: false, error: "Không nhận được phản hồi từ trang Shopee." });
                    }
                  });
                }, 400);
              }
            });
          } else {
            resolve(res || { ok: false, error: "Không nhận được phản hồi từ trang Shopee." });
          }
        });
      });
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function handleReadOrderListPage() {
    const tab = await getShopeeOrderListTab();
    if (!tab?.id) {
      alert("Vui lòng mở trang Quản lý đơn hàng Shopee:\nhttps://banhang.shopee.vn/portal/sale/order\ntrước khi bấm đọc danh sách!");
      return;
    }

    if (btnReadOrderListPage) {
      btnReadOrderListPage.disabled = true;
      btnReadOrderListPage.innerHTML = "⏳ Đang đọc...";
    }

    try {
      const res = await sendMessageToTab(tab.id, { action: "SHOPEE_READ_ORDER_LIST_PAGE", type: "SHOPEE_READ_ORDER_LIST_PAGE" });
      if (!res || !res.ok) {
        alert("Không đọc được đơn hàng trên trang này: " + (res?.error || "Lỗi không xác định. Hãy bấm F5 tải lại trang Shopee rồi thử lại!"));
        return;
      }

      if (!res.orders || res.orders.length === 0) {
        alert("Không tìm thấy đơn hàng nào hiển thị trên trang danh sách Shopee hiện tại.\n\nHãy đảm bảo bạn đang ở trang Quản lý đơn hàng (https://banhang.shopee.vn/portal/sale/order) và trang đã tải xong danh sách đơn.");
        return;
      }

      const cleanOrderCode = (v) => {
        if (!v) return "";
        let s = String(v).trim();
        s = s.replace(/(?:Copy(?:\s*All)?|Sao\s*ch[eéê]p|SaoChep|Excel|In\s*đơn|In\s*phiếu|\bC\b)+$/gi, '').trim();
        s = s.replace(/copy$/i, '').trim();
        return s;
      };

      const maGian = (inputGian?.value || "").trim();
      const todayStr = new Date().toISOString().split("T")[0];
      const rows = res.orders.map(o => {
        const orderDate = o.ngay || todayStr;
        const tongTien = o.tongTien || 0;
        const sku = o.sku || "";
        const tenSp = o.tenSp || "";
        const slg = o.slg || 1;
        const donGia = o.donGia || tongTien;
        const thanhTien = o.thanhTien || tongTien;
        const tenKhach = o.tenKhach || "";
        const mdh = cleanOrderCode(o.mdh);
        const mvd = cleanOrderCode(o.mvd);
        const linkDon = o.linkDon ? String(o.linkDon).replace(/Copy$/i, '') : (mdh ? `https://banhang.shopee.vn/portal/sale/order/${mdh}` : "");

        return [
          maGian,                                              // 0: gian
          orderDate,                                           // 1: ngay
          orderDate ? `${orderDate} 00:00` : "",               // 2: ngay_gio
          mdh,                                                 // 3: mdh
          mvd,                                                 // 4: mvd
          tongTien,                                            // 5: tong_tien
          0,                                                   // 6: ma_giam_gia
          0,                                                   // 7: phi_vc
          0,                                                   // 8: phu_phi
          0,                                                   // 9: thue
          tongTien,                                            // 10: doanh_thu
          0,                                                   // 11: phi_khac
          0,                                                   // 12: tien_sp
          tongTien,                                            // 13: loi_nhuan
          "",                                                  // 14: tinh_trang
          "",                                                  // 15: trang_thai
          sku,                                                 // 16: sku
          o.idSp || "",                                        // 17: id_sp
          slg,                                                 // 18: slg
          donGia,                                              // 19: don_gia
          thanhTien,                                           // 20: thanh_tien
          tenKhach,                                            // 21: ten_khach
          "",                                                  // 22: ng_nhan
          "",                                                  // 23: dia_chi
          linkDon                                              // 24: link_don
        ];
      });

      // 1. Hiển thị ngay lập tức lên bảng giao diện
      addDhRows(rows, "", "", false);

      // 2. Ghi trực tiếp vào Google Sheet DH
      const saveRes = await new Promise(r => {
        chrome.runtime.sendMessage({ type: "INSERT_NEW_DH_ORDERS_IF_NOT_EXISTS", values: rows }, r);
      });

      if (!saveRes || !saveRes.ok) {
        alert("Lỗi lưu đơn vào Sheet DH: " + (saveRes?.error || "Lỗi không xác định"));
        return;
      }

      const insertedCount = saveRes.inserted || 0;
      const updatedCount = saveRes.updated || 0;
      const skippedCount = saveRes.skipped || 0;
      
      let msg = `✅ Đã đọc thành công ${res.orders.length} đơn trên trang Shopee!`;
      if (insertedCount > 0) msg += `\n➕ Thêm mới vào Sheet DH: ${insertedCount} đơn`;
      if (updatedCount > 0) msg += `\n🔄 Cập nhật bổ sung MVD/Link: ${updatedCount} đơn`;
      if (skippedCount > 0) msg += `\n⏭ Bỏ qua (đã có đầy đủ trong Sheet): ${skippedCount} đơn`;
      alert(msg);

      // 3. Tải lại dữ liệu hoàn chỉnh từ Sheet
      loadDhSheetData(false);
    } catch (err) {
      console.error("Lỗi khi đọc danh sách đơn hàng:", err);
      alert("Lỗi: " + err.message);
    } finally {
      if (btnReadOrderListPage) {
        btnReadOrderListPage.disabled = false;
        btnReadOrderListPage.innerHTML = "📑 Đọc DS Đơn";
      }
    }
  }

  async function handleAutoPaginateOrderList() {
    const tab = await getShopeeOrderListTab();
    if (!tab?.id) {
      alert("Vui lòng mở trang Quản lý đơn hàng Shopee:\nhttps://banhang.shopee.vn/portal/sale/order\ntrước khi bấm Tự động Next trang!");
      return;
    }

    if (isListScanning) {
      alert("Tiến trình đọc danh sách đang chạy!");
      return;
    }

    isListScanning = true;
    cancelListScanRequested = false;

    if (listScanStatusBox) listScanStatusBox.style.display = "block";
    if (listScanBar) listScanBar.style.width = "10%";
    if (btnAutoPaginateOrderList) {
      btnAutoPaginateOrderList.disabled = true;
      btnAutoPaginateOrderList.innerHTML = "⏳ Đang chạy...";
    }

    let totalPages = 0;
    let totalScanned = 0;
    let grandTotalInserted = 0;
    let grandTotalUpdated = 0;
    let grandTotalSkipped = 0;

    try {
      const cleanOrderCode = (v) => {
        if (!v) return "";
        let s = String(v).trim();
        s = s.replace(/(?:Copy(?:\s*All)?|Sao\s*ch[eéê]p|SaoChep|Excel|In\s*đơn|In\s*phiếu|\bC\b)+$/gi, '').trim();
        s = s.replace(/copy$/i, '').trim();
        return s;
      };

      const maGian = (inputGian?.value || "").trim();
      const todayStr = new Date().toISOString().split("T")[0];

      while (!cancelListScanRequested) {
        totalPages++;
        if (listScanText) {
          listScanText.innerHTML = `<span>⏳</span> Đang đọc trang ${totalPages}... (Đã thêm: <b style="color:#15803d;">${grandTotalInserted}</b>, Cập nhật: <b style="color:#2563eb;">${grandTotalUpdated}</b>, Bỏ qua: <b style="color:#d97706;">${grandTotalSkipped}</b>)`;
        }
        if (listScanBar) {
          const w = Math.min(95, 10 + totalPages * 5);
          listScanBar.style.width = `${w}%`;
        }

        // 1. Đọc đơn trang hiện tại
        const res = await sendMessageToTab(tab.id, { action: "SHOPEE_READ_ORDER_LIST_PAGE", type: "SHOPEE_READ_ORDER_LIST_PAGE" });
        if (res?.ok && res.orders && res.orders.length > 0) {
          totalScanned += res.orders.length;
          const rows = res.orders.map(o => {
            const orderDate = o.ngay || todayStr;
            const tongTien = o.tongTien || 0;
            const sku = o.sku || "";
            const tenSp = o.tenSp || "";
            const slg = o.slg || 1;
            const donGia = o.donGia || tongTien;
            const thanhTien = o.thanhTien || tongTien;
            const tenKhach = o.tenKhach || "";
            const mdh = cleanOrderCode(o.mdh);
            const mvd = cleanOrderCode(o.mvd);
            const linkDon = o.linkDon ? String(o.linkDon).replace(/Copy$/i, '') : (mdh ? `https://banhang.shopee.vn/portal/sale/order/${mdh}` : "");

            return [
              maGian, orderDate, orderDate ? `${orderDate} 00:00` : "",
              mdh, mvd,
              tongTien, 0, 0, 0, 0, tongTien, 0, 0, tongTien,
              "", "", sku, o.idSp || "", slg, donGia, thanhTien,
              tenKhach, "", "", linkDon
            ];
          });

          // 2. Thêm/Cập nhật vào Sheet DH (chống trùng lặp tuyệt đối)
          const saveRes = await new Promise(r => {
            chrome.runtime.sendMessage({ type: "INSERT_NEW_DH_ORDERS_IF_NOT_EXISTS", values: rows }, r);
          });

          if (saveRes?.ok) {
            grandTotalInserted += (saveRes.inserted || 0);
            grandTotalUpdated += (saveRes.updated || 0);
            grandTotalSkipped += (saveRes.skipped || 0);
          }
        }

        if (cancelListScanRequested) break;

        if (listScanText) {
          listScanText.innerHTML = `<span>🔄</span> Đang chuyển sang trang tiếp theo... (Trang ${totalPages}: +${grandTotalInserted} mới, ${grandTotalUpdated} cập nhật)`;
        }

        // 3. Bấm nút Next trang
        const nextRes = await sendMessageToTab(tab.id, { action: "SHOPEE_CLICK_NEXT_PAGE", type: "SHOPEE_CLICK_NEXT_PAGE" });
        if (!nextRes?.ok || !nextRes.hasNext) {
          // Đã đến trang cuối cùng
          break;
        }

        // 4. Chờ 2.5 giây cho Shopee load bảng trang tiếp theo
        for (let w = 0; w < 25; w++) {
          if (cancelListScanRequested) break;
          await new Promise(r => setTimeout(r, 100));
        }
      }

      if (listScanText) {
        listScanText.innerHTML = `<span>🎉</span> Hoàn tất! Đã quét ${totalPages} trang (${grandTotalInserted} mới, ${grandTotalUpdated} cập nhật, ${grandTotalSkipped} bỏ qua).`;
      }
      if (listScanBar) listScanBar.style.width = "100%";

      alert(`🎉 Đã quét xong danh sách đơn hàng Shopee!\n\n- Số trang đã quét: ${totalPages}\n- Thêm mới vào Sheet DH: ${grandTotalInserted} đơn\n- Cập nhật bổ sung MVD/Link: ${grandTotalUpdated} đơn\n- Bỏ qua do đã tồn tại đầy đủ: ${grandTotalSkipped} đơn`);
      loadDhSheetData(false);

    } catch (err) {
      console.error("Lỗi khi tự động next trang:", err);
      alert("Lỗi: " + err.message);
    } finally {
      isListScanning = false;
      cancelListScanRequested = false;
      if (btnAutoPaginateOrderList) {
        btnAutoPaginateOrderList.disabled = false;
        btnAutoPaginateOrderList.innerHTML = "🔄 Next trang";
      }
      setTimeout(() => {
        if (listScanStatusBox && !isListScanning) {
          listScanStatusBox.style.display = "none";
        }
      }, 5000);
    }
  }

  // =========================================================================
  // TỰ ĐỘNG MỞ & ĐIỀN CHI TIẾT CÁC ĐƠN HÀNG CÒN THIẾU THÔNG TIN VÀO SHEET DH
  // =========================================================================

  function waitForTabLoad(tabId, timeoutMs = 15000) {
    return new Promise((resolve) => {
      let resolved = false;
      let timer = null;

      const listener = (id, changeInfo) => {
        if (id === tabId && changeInfo.status === "complete") {
          cleanup();
          resolve(true);
        }
      };

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
      };

      chrome.tabs.onUpdated.addListener(listener);

      timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
    });
  }

  async function handleQuickFillSingleOrder(mdh, linkDon, gian, btn) {
    if (!mdh && !linkDon) {
      alert("Không có thông tin mã đơn hàng hoặc link đơn!");
      return;
    }

    let targetUrl = linkDon || (mdh ? `https://banhang.shopee.vn/portal/sale/order/${mdh}` : "");
    if (targetUrl.startsWith("/")) {
      targetUrl = "https://banhang.shopee.vn" + targetUrl;
    }
    if (!targetUrl.startsWith("http")) {
      targetUrl = "https://banhang.shopee.vn/portal/sale/order/" + targetUrl;
    }

    const oldText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "⏳ Đọc...";
    }

    if (statusEl) {
      statusEl.innerHTML = `⏳ Đang mở & đọc chi tiết đơn ${escapeHtml(mdh)}...`;
    }

    try {
      const existingTabs = await chrome.tabs.query({ url: "*://banhang.shopee.vn/*" });
      let workerTab = existingTabs && existingTabs.length > 0 ? existingTabs[0] : null;
      if (!workerTab) {
        workerTab = await chrome.tabs.create({ url: targetUrl, active: false });
      } else {
        await chrome.tabs.update(workerTab.id, { url: targetUrl });
      }

      await waitForTabLoad(workerTab.id, 15000);
      await new Promise(r => setTimeout(r, 1800));

      let detailRes = null;
      const readOrderFn = window.orderTabUtils?.readOrderFromTab;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (readOrderFn) {
          detailRes = await readOrderFn(workerTab.id);
        } else {
          detailRes = await sendMessageToTab(workerTab.id, {
            action: "EXTRACT_SELLER_ORDER_DETAIL_FULL",
            type: "EXTRACT_SELLER_ORDER_DETAIL_FULL"
          });
        }
        if (detailRes?.ok && Array.isArray(detailRes.rows) && detailRes.rows.length > 0) {
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!detailRes?.ok || !Array.isArray(detailRes.rows) || detailRes.rows.length === 0) {
        throw new Error(detailRes?.error || "Không đọc được chi tiết đơn từ trang Shopee.");
      }

      const rowsToDhValuesFn = window.orderTabUtils?.rowsToDhValues;
      const maGian = gian || (inputGian?.value || "").trim();
      const dhValues = rowsToDhValuesFn ? await rowsToDhValuesFn(detailRes.rows, maGian) : [];

      if (!dhValues.length) {
        throw new Error("Không thể chuyển đổi sang dòng Sheet DH.");
      }

      const sampleMdh = mdh || detailRes.rows[0]?.orderId;
      const sampleMvd = detailRes.rows[0]?.tracking;

      addDhRows(dhValues, sampleMdh, sampleMvd, true);

      if (btn) {
        btn.innerHTML = "✓ Xong";
        btn.style.background = "#dcfce7";
        btn.style.color = "#15803d";
        btn.style.borderColor = "#86efac";
      }

      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#15803d; font-weight:bold;">✅ Đã cập nhật xong chi tiết đơn ${escapeHtml(sampleMdh)} (${dhValues.length} SP) vào Sheet DH!</span>`;
      }
    } catch (err) {
      console.error("Lỗi đọc nhanh chi tiết đơn:", err);
      alert("Lỗi: " + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldText;
      }
    }
  }

  async function handleAutoFillMissingDetails() {
    if (isAutoFillingDetails || isListScanning) {
      alert("Đang có một tiến trình quét/điền đơn hàng đang chạy. Vui lòng đợi hoặc bấm Dừng trước!");
      return;
    }

    // 1. Quét danh sách các đơn hàng còn thiếu chi tiết trong bảng / Sheet DH
    const missingMap = new Map();
    for (const item of allData) {
      const cells = item.cells || [];
      const mdh = String(cells[mdhColumnIdx] || "").trim();
      if (!mdh) continue;

      const tinhTrangVal = String(cells[tinhTrangColumnIdx] || "").trim();
      const trangThaiVal = String(cells[trangThaiColumnIdx] || "").trim();
      const currentStatus = trangThaiVal || tinhTrangVal;

      // NẾU ĐÃ ĐỔI TÌNH TRẠNG (HỦY / HOÀN / TRẢ / TÌNH TRẠNG KHÁC) -> BỎ QUA HOÀN TOÀN, KHÔNG QUÉT / KHÔNG CẬP NHẬT TỰ ĐỘNG
      if (isOrderCustomOrModifiedStatus(currentStatus)) {
        continue;
      }

      const tongTien = Number(String(cells[5] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const doanhThu = Number(String(cells[10] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const tienSp = Number(String(cells[12] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const sku = String(cells[skuColumnIdx] || "").trim();
      const mvd = String(cells[mvdColumnIdx] || "").trim();
      const gian = String(cells[gianColumnIdx] || "").trim();
      let linkDon = String(cells[linkDonColumnIdx] || "").trim();
      if (!linkDon || !linkDon.startsWith("http")) {
        linkDon = `https://banhang.shopee.vn/portal/sale/order/${mdh}`;
      }

      // Đơn bị thiếu chi tiết nếu chưa có SKU hoặc (Tổng tiền = 0 và Doanh thu = 0 và Tiền SP = 0)
      const isMissing = (tongTien === 0 && doanhThu === 0 && tienSp === 0) || !sku;
      if (isMissing && !missingMap.has(mdh)) {
        missingMap.set(mdh, { mdh, mvd, gian, linkDon, rowOriginalIndex: item.rowOriginalIndex });
      }
    }

    const missingOrders = Array.from(missingMap.values());

    if (missingOrders.length === 0) {
      alert("🎉 Tuyệt vời! Tất cả đơn hàng trong Sheet DH đều đã có đầy đủ chi tiết sản phẩm, doanh thu và tài chính.\n\nKhông có đơn hàng nào bị thiếu!");
      return;
    }

    const confirmMsg = `🔍 Phát hiện ${missingOrders.length} đơn hàng trong Sheet DH chưa có chi tiết sản phẩm & tài chính (tổng tiền, phí, doanh thu, SKU...).\n\nTiện ích sẽ tự động mở lần lượt từng đơn, chờ khoảng 40 - 50 giây mỗi đơn để trang Shopee tải đầy đủ 100% dữ liệu rồi cập nhật vào Sheet DH.\n\nBạn có muốn bắt đầu không?`;
    if (!confirm(confirmMsg)) return;

    isAutoFillingDetails = true;
    cancelAutoFillRequested = false;

    if (listScanStatusBox) listScanStatusBox.style.display = "block";
    if (listScanBar) listScanBar.style.width = "0%";
    if (btnAutoFillMissingDetail) {
      btnAutoFillMissingDetail.disabled = true;
      btnAutoFillMissingDetail.innerHTML = "⏳ Đang điền...";
    }

    let successCount = 0;
    let failCount = 0;
    let workerTab = null;
    const ORDER_CYCLE_DURATION_MS = 45000; // 45 giây mỗi đơn (khoảng 40 tới 50 giây)

    try {
      // Tìm tab Shopee đang mở hoặc tạo 1 tab mới làm tab làm việc
      const existingTabs = await chrome.tabs.query({ url: "*://banhang.shopee.vn/*" });
      if (existingTabs && existingTabs.length > 0) {
        workerTab = existingTabs[0];
      } else {
        workerTab = await chrome.tabs.create({ url: missingOrders[0].linkDon, active: false });
      }

      for (let i = 0; i < missingOrders.length; i++) {
        if (cancelAutoFillRequested) break;

        const order = missingOrders[i];
        const orderStartTime = Date.now();
        const progressPct = Math.round((i / missingOrders.length) * 100);

        if (listScanBar) listScanBar.style.width = `${progressPct}%`;
        
        const getRemainingSec = () => Math.max(0, Math.ceil((ORDER_CYCLE_DURATION_MS - (Date.now() - orderStartTime)) / 1000));

        if (listScanText) {
          listScanText.innerHTML = `<span>⚡</span> [${i + 1}/${missingOrders.length}] Đang mở & tải đơn: <b style="color:#2563eb;">${escapeHtml(order.mdh)}</b> (chờ load: <b style="color:#ea580c;">${getRemainingSec()}s</b>)... (Thành công: <b style="color:#15803d;">${successCount}</b>, Lỗi: <b style="color:#dc2626;">${failCount}</b>)`;
        }

        try {
          // Kiểm tra xem workerTab có còn tồn tại không, nếu người dùng lỡ tắt thì tạo tab mới
          try {
            await chrome.tabs.get(workerTab.id);
          } catch (tabCheckErr) {
            workerTab = await chrome.tabs.create({ url: order.linkDon, active: false });
          }

          // 1. Chuyển tab đến URL đơn hàng
          let targetUrl = order.linkDon || `https://banhang.shopee.vn/portal/sale/order/${order.mdh}`;
          if (targetUrl.startsWith("/")) {
            targetUrl = "https://banhang.shopee.vn" + targetUrl;
          }
          if (!targetUrl.startsWith("http")) {
            targetUrl = "https://banhang.shopee.vn/portal/sale/order/" + targetUrl;
          }

          await chrome.tabs.update(workerTab.id, { url: targetUrl });

          // 2. Chờ trang tải xong (status complete) - tối đa 20s
          await waitForTabLoad(workerTab.id, 20000);

          // 3. Chờ thêm 3s ban đầu cho Vue render DOM chi tiết đơn
          for (let w = 0; w < 30; w++) {
            if (cancelAutoFillRequested) break;
            await new Promise(r => setTimeout(r, 100));
            if (listScanText && w % 10 === 0) {
              listScanText.innerHTML = `<span>⏳</span> [${i + 1}/${missingOrders.length}] Đang render trang đơn: <b style="color:#2563eb;">${escapeHtml(order.mdh)}</b> (còn <b style="color:#ea580c;">${getRemainingSec()}s</b>)... (Thành công: <b style="color:#15803d;">${successCount}</b>, Lỗi: <b style="color:#dc2626;">${failCount}</b>)`;
            }
          }
          if (cancelAutoFillRequested) break;

          // 4. Trích xuất dữ liệu chi tiết đơn hàng (thử lại liên tục trong 15-20s nếu trang chưa load xong bảng)
          let detailRes = null;
          const readOrderFn = window.orderTabUtils?.readOrderFromTab;
          const maxReadAttempts = 8;

          for (let attempt = 0; attempt < maxReadAttempts; attempt++) {
            if (cancelAutoFillRequested) break;

            if (listScanText) {
              listScanText.innerHTML = `<span>🔍</span> [${i + 1}/${missingOrders.length}] Đang đọc chi tiết đơn: <b style="color:#2563eb;">${escapeHtml(order.mdh)}</b> (lần ${attempt + 1}, còn <b style="color:#ea580c;">${getRemainingSec()}s</b>)... (Thành công: <b style="color:#15803d;">${successCount}</b>, Lỗi: <b style="color:#dc2626;">${failCount}</b>)`;
            }

            if (readOrderFn) {
              detailRes = await readOrderFn(workerTab.id);
            } else {
              detailRes = await sendMessageToTab(workerTab.id, {
                action: "EXTRACT_SELLER_ORDER_DETAIL_FULL",
                type: "EXTRACT_SELLER_ORDER_DETAIL_FULL"
              });
            }

            if (detailRes?.ok && Array.isArray(detailRes.rows) && detailRes.rows.length > 0) {
              break;
            }
            await new Promise(r => setTimeout(r, 1500));
          }

          if (cancelAutoFillRequested) break;

          let orderSaved = false;
          let sampleMdh = order.mdh || detailRes?.rows?.[0]?.orderId || "";
          let sampleMvd = order.mvd || detailRes?.rows?.[0]?.tracking || "";

          if (detailRes?.ok && Array.isArray(detailRes.rows) && detailRes.rows.length > 0) {
            // 5. Chuyển đổi sang định dạng 25 cột của Sheet DH
            const rowsToDhValuesFn = window.orderTabUtils?.rowsToDhValues;
            const maGian = order.gian || (inputGian?.value || "").trim();
            const dhValues = rowsToDhValuesFn 
              ? await rowsToDhValuesFn(detailRes.rows, maGian)
              : [];

            if (dhValues.length > 0) {
              sampleMdh = order.mdh || detailRes.rows[0]?.orderId;
              sampleMvd = order.mvd || detailRes.rows[0]?.tracking;

              // 6. Lưu vào Sheet DH (Background cập nhật dòng cũ, thay thế bằng các dòng sản phẩm chi tiết)
              const saveRes = await new Promise(res => {
                chrome.runtime.sendMessage({
                  type: "SAVE_DH_ORDER",
                  values: dhValues,
                  mdh: sampleMdh,
                  mvd: sampleMvd
                }, res);
              });

              if (saveRes?.ok) {
                successCount++;
                orderSaved = true;
                // Cập nhật ngay vào bảng bộ nhớ để giao diện đổi màu
                addDhRows(dhValues, sampleMdh, sampleMvd, false);
              } else {
                console.warn(`[AutoFill] Lỗi lưu đơn ${order.mdh}:`, saveRes?.error);
                failCount++;
              }
            } else {
              console.warn(`[AutoFill] Không convert được dhValues cho đơn ${order.mdh}`);
              failCount++;
            }
          } else {
            console.warn(`[AutoFill] Không đọc được dữ liệu đơn ${order.mdh}`);
            failCount++;
          }

          // 7. Đếm ngược toàn bộ thời gian còn lại của chu kỳ 40-50s để trang Shopee hoàn tất ổn định trước khi chuyển đơn khác
          while (Date.now() - orderStartTime < ORDER_CYCLE_DURATION_MS) {
            if (cancelAutoFillRequested) break;
            const remSec = getRemainingSec();
            if (listScanText) {
              if (orderSaved) {
                listScanText.innerHTML = `<span>✅</span> [${i + 1}/${missingOrders.length}] Đã lưu xong đơn <b style="color:#15803d;">${escapeHtml(sampleMdh)}</b>! Chờ sang đơn tiếp theo: <b style="color:#ea580c;">${remSec}s</b> (Thành công: <b style="color:#15803d;">${successCount}</b>, Lỗi: <b style="color:#dc2626;">${failCount}</b>)`;
              } else {
                listScanText.innerHTML = `<span>⏳</span> [${i + 1}/${missingOrders.length}] Đang chờ đơn <b style="color:#2563eb;">${escapeHtml(sampleMdh)}</b>: còn <b style="color:#ea580c;">${remSec}s</b>... (Thành công: <b style="color:#15803d;">${successCount}</b>, Lỗi: <b style="color:#dc2626;">${failCount}</b>)`;
              }
            }
            await new Promise(r => setTimeout(r, 500));
          }

        } catch (itemErr) {
          console.error(`[AutoFill] Lỗi xử lý đơn ${order.mdh}:`, itemErr);
          failCount++;
        }
      }

      if (listScanBar) listScanBar.style.width = "100%";
      if (listScanText) {
        listScanText.innerHTML = `<span>🎉</span> Hoàn tất! Đã cập nhật xong: <b style="color:#15803d;">${successCount}</b> đơn, Lỗi: <b style="color:#dc2626;">${failCount}</b>.`;
      }

      alert(`🎉 Hoàn tất tiến trình điền chi tiết đơn hàng!\n\n- Tổng số đơn quét: ${missingOrders.length}\n- Cập nhật thành công vào Sheet DH: ${successCount} đơn\n- Không đọc được / Lỗi: ${failCount} đơn`);
      loadDhSheetData(false);

    } catch (err) {
      console.error("Lỗi tự động điền chi tiết đơn:", err);
      alert("Lỗi tiến trình: " + err.message);
    } finally {
      isAutoFillingDetails = false;
      cancelAutoFillRequested = false;
      if (btnAutoFillMissingDetail) {
        btnAutoFillMissingDetail.disabled = false;
        btnAutoFillMissingDetail.innerHTML = "⚡ Điền chi tiết đơn thiếu";
      }
      setTimeout(() => {
        if (listScanStatusBox && !isAutoFillingDetails && !isListScanning) {
          listScanStatusBox.style.display = "none";
        }
      }, 6000);
    }
  }

  // =========================================================================
  // GẮN SỰ KIỆN ĐIỀU KHIỂN XỬ LÝ HÀNG LOẠT
  // =========================================================================
  if (btnReadOrderListPage) {
    btnReadOrderListPage.addEventListener("click", () => {
      handleReadOrderListPage();
    });
  }

  if (btnAutoPaginateOrderList) {
    btnAutoPaginateOrderList.addEventListener("click", () => {
      handleAutoPaginateOrderList();
    });
  }

  if (btnAutoFillMissingDetail) {
    btnAutoFillMissingDetail.addEventListener("click", () => {
      handleAutoFillMissingDetails();
    });
  }

  if (btnStopListScan) {
    btnStopListScan.addEventListener("click", () => {
      cancelListScanRequested = true;
      cancelAutoFillRequested = true;
      if (listScanText) {
        listScanText.innerHTML = "<span>⏹</span> Đang dừng tiến trình quét/điền chi tiết...";
      }
    });
  }

  if (datePresetSelect) {
    datePresetSelect.addEventListener("change", () => {
      if (customDateContainer) {
        customDateContainer.style.display = (datePresetSelect.value === "custom") ? "grid" : "none";
      }
    });
  }

  if (btnToggleApiScanner && apiScanPanel) {
    btnToggleApiScanner.addEventListener("click", () => {
      const isHidden = apiScanPanel.style.display === "none";
      apiScanPanel.style.display = isHidden ? "block" : "none";
    });
  }

  if (btnCloseApiScanner && apiScanPanel) {
    btnCloseApiScanner.addEventListener("click", () => {
      apiScanPanel.style.display = "none";
    });
  }

  if (btnStartApiScan) {
    btnStartApiScan.addEventListener("click", () => {
      startShopeeApiScanner();
    });
  }

  if (btnStopApiScan) {
    btnStopApiScan.addEventListener("click", () => {
      cancelApiScanRequested = true;
      if (scanStatusText) scanStatusText.textContent = "⏳ Đang dừng quét...";
    });
  }

  if (btnUploadExcelShopee && fileUploadExcelShopee) {
    btnUploadExcelShopee.addEventListener("click", () => {
      fileUploadExcelShopee.click();
    });

    fileUploadExcelShopee.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) handleShopeeExcelFile(file);
    });

    btnUploadExcelShopee.addEventListener("dragover", (e) => {
      e.preventDefault();
      btnUploadExcelShopee.style.opacity = "0.7";
      btnUploadExcelShopee.style.outline = "2px dashed #15803d";
    });
    btnUploadExcelShopee.addEventListener("dragleave", (e) => {
      e.preventDefault();
      btnUploadExcelShopee.style.opacity = "1";
      btnUploadExcelShopee.style.outline = "none";
    });
    btnUploadExcelShopee.addEventListener("drop", (e) => {
      e.preventDefault();
      btnUploadExcelShopee.style.opacity = "1";
      btnUploadExcelShopee.style.outline = "none";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleShopeeExcelFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Bắt đầu Realtime Polling
  setupRealtimePolling();

  // Export các hàm điều khiển tab Nhiều đơn hàng
  window.nhieuDonHangTab = {
    addDhRows,
    loadDhSheetData,
    compareOrderRows,
    handleShopeeExcelFile,
    startShopeeApiScanner,
    handleReadOrderListPage,
    handleAutoPaginateOrderList,
    handleAutoFillMissingDetails,
    handleQuickFillSingleOrder,
    getAllData: () => allData
  };

})();
