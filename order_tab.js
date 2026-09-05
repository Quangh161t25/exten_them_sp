(function () {
  const readButton = document.getElementById("btn-read-current-order");
  const copyButton = document.getElementById("btn-copy-current-order");
  const saveDhButton = document.getElementById("btn-save-current-order-dh");
  const status = document.getElementById("current-order-status");
  const tbody = document.querySelector("#table-current-order tbody");

  if (!readButton || !copyButton || !tbody) return;

  const exportColumns = [
    { key: "orderCreatedAt", label: "Don hang moi" },
    { key: "orderId", label: "Ma don hang" },
    { key: "tracking", label: "Ma van don" },
    { key: "tenKhach", label: "Ten khach" },
    { key: "ngNhan", label: "Nguoi nhan" },
    { key: "diaChi", label: "Dia chi" },
    { key: "linkDon", label: "Link don" },
    { key: "totalProductAmount", label: "Tong tien SP" },
    { key: "shopVoucher", label: "Ma giam gia shop" },
    { key: "productPrice", label: "Gia SP" },
    { key: "estimatedShippingTotal", label: "Tong phi VC uoc tinh" },
    { key: "buyerPaidShippingFee", label: "Phi VC nguoi mua tra" },
    { key: "estimatedShippingFee", label: "Phi VC uoc tinh" },
    { key: "surcharge", label: "Phu phi" },
    { key: "fixedFee", label: "Phi co dinh" },
    { key: "serviceFee", label: "Phi dich vu" },
    { key: "transactionFee", label: "Phi xu ly GD" },
    { key: "tax", label: "Thue" },
    { key: "vatTax", label: "Thue GTGT" },
    { key: "pitTax", label: "Thue TNCN" },
    { key: "buyerValueAddedServiceTotal", label: "Tong phu DV GTGT" },
    { key: "estimatedOrderIncome", label: "Doanh thu uoc tinh" },
    { key: "capitalDetails", label: "Chi tiet von" },
    { key: "totalCapital", label: "Tong von" },
    { key: "profit", label: "Loi nhuan" },
    { key: "sku", label: "SKU phan loai" },
    { key: "quantity", label: "So luong" }
  ];

  const moneyColumnKeys = new Set([
    "totalProductAmount",
    "shopVoucher",
    "maGiamGia",
    "productPrice",
    "estimatedShippingTotal",
    "buyerPaidShippingFee",
    "estimatedShippingFee",
    "surcharge",
    "fixedFee",
    "serviceFee",
    "transactionFee",
    "tax",
    "vatTax",
    "pitTax",
    "buyerValueAddedServiceTotal",
    "estimatedOrderIncome",
    "totalCapital",
    "profit"
  ]);
  const displayColumns = exportColumns;

  let latestRows = [];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeCell(value) {
    return String(value || "")
      .replace(/\r?\n/g, " ")
      .replace(/\t/g, " ")
      .trim();
  }

  function moneyToNumber(value) {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (!text) return "";
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return digits;
  }

  function normalizeCellForExport(row, key) {
    const value = row?.[key] || "";
    if (moneyColumnKeys.has(key)) {
      return moneyToNumber(value);
    }
    return normalizeCell(value);
  }
  function renderDisplayValue(row, col) {
    const shownValue = normalizeCellForExport(row, col.key);
    if (col.key === "linkDon" && shownValue) {
      return `<a href="${escapeHtml(shownValue)}" class="order-link-btn" data-order-link="${escapeHtml(shownValue)}" target="_blank" style="color: #2563eb; text-decoration: underline; word-break: break-all; font-weight: normal; font-size: 11px; cursor: pointer;">${escapeHtml(shownValue)}</a>`;
    }
    if (col.key === "orderId" && shownValue) {
      const link = row.linkDon || row.link_don || (row.orderId ? `https://banhang.shopee.vn/portal/sale/order/${row.orderId}` : "");
      return `<a href="${escapeHtml(link)}" class="order-link-btn" data-order-link="${escapeHtml(link)}" style="color: #2563eb; text-decoration: underline; font-weight: bold; cursor: pointer;" title="Bấm để mở chi tiết đơn">${escapeHtml(shownValue)}</a>`;
    }
    const html = escapeHtml(shownValue);
    return col.key === "capitalDetails" ? html.replace(/\s+\|\s+/g, "<br>") : html;
  }
  let currentOrderExistingInfo = { exists: false, rowNums: [] };

  function renderVerticalDetails(row, isExisting = false, rowNums = []) {
    return `<div style="display: grid; min-width: 300px; border: 1px solid #d8dee8; border-bottom: 0; background: #fff;">${displayColumns.map((col) => {
      const isTracking = col.key === "tracking";
      
      let rowStyle = "display: grid; grid-template-columns: minmax(120px, 0.9fr) minmax(130px, 1.1fr); gap: 8px; align-items: center; min-height: 26px; padding: 4px 6px; border-bottom: 1px solid #d8dee8; line-height: 1.25;";
      let valueStyle = "text-align:right; color:#0f172a; font-size:13px; font-weight:700; white-space: normal; word-break: break-word;";
      let extraTag = "";

      if (isExisting && isTracking) {
        rowStyle = "display: grid; grid-template-columns: minmax(120px, 0.9fr) minmax(130px, 1.1fr); gap: 8px; align-items: center; min-height: 26px; padding: 6px 8px; border-bottom: 1px solid #d8dee8; line-height: 1.25; background: #fef08a; border-left: 4px solid #eab308;";
        valueStyle = "text-align:right; color:#854d0e; font-size:13px; font-weight:bold; white-space: normal; word-break: break-word;";
        const rowText = rowNums && rowNums.length > 0 ? ` (Dòng ${rowNums.join(", ")})` : "";
        extraTag = `<div style="font-size:10px; color:#b45309; font-weight:bold; margin-top:2px;">⚠️ Đã có trong Sheet DH${rowText}</div>`;
      }

      return `<div style="${rowStyle}"><span style="color:#475569; font-size:11px; white-space: normal;">${escapeHtml(col.label)}</span><div style="text-align:right;"><b style="${valueStyle}">${renderDisplayValue(row, col)}</b>${extraTag}</div></div>`;
    }).join("")}</div>`;
  }
  const thead = document.getElementById("thead-current-order") || document.querySelector("#table-current-order thead");
  const toggleViewModeBtn = document.getElementById("btn-toggle-view-mode-order");
  const assignToNhieuDonHangBtn = document.getElementById("btn-assign-to-nhieu-don-hang");

  let orderViewMode = localStorage.getItem("shopee_order_view_mode") || "row";

  function updateToggleViewBtnText() {
    if (!toggleViewModeBtn) return;
    if (orderViewMode === "row") {
      toggleViewModeBtn.innerHTML = "🔄 Xem: Dạng thẻ dọc";
      toggleViewModeBtn.title = "Đang ở kiểu xem dạng dòng. Bấm để chuyển sang dạng thẻ dọc";
      toggleViewModeBtn.style.background = "#f0fdf4";
      toggleViewModeBtn.style.color = "#047857";
      toggleViewModeBtn.style.borderColor = "#86efac";
    } else {
      toggleViewModeBtn.innerHTML = "🔄 Xem: Dạng dòng";
      toggleViewModeBtn.title = "Đang ở kiểu xem dạng thẻ. Bấm để chuyển sang dạng dòng";
      toggleViewModeBtn.style.background = "#eff6ff";
      toggleViewModeBtn.style.color = "#1d4ed8";
      toggleViewModeBtn.style.borderColor = "#bfdbfe";
    }
  }

  if (toggleViewModeBtn) {
    updateToggleViewBtnText();
    toggleViewModeBtn.addEventListener("click", () => {
      orderViewMode = (orderViewMode === "row") ? "vertical" : "row";
      localStorage.setItem("shopee_order_view_mode", orderViewMode);
      updateToggleViewBtnText();
      renderRows(latestRows, currentOrderExistingInfo);
    });
  }

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
    const num = moneyToNumber(val);
    if (!num) return "";
    return Number(num).toLocaleString("vi-VN") + "₫";
  }

  const rowViewColumns = [
    { label: "STT", render: (r, idx) => idx + 1, style: "text-align:center; color:#64748b;" },
    { 
      label: "Mã đơn hàng", 
      render: (r) => {
        const link = r.linkDon || r.link_don || (r.orderId ? `https://banhang.shopee.vn/portal/sale/order/${r.orderId}` : "");
        return `<a href="${escapeHtml(link)}" class="order-link-btn" data-order-link="${escapeHtml(link)}" style="color:#2563eb; font-weight:bold; text-decoration:underline; cursor:pointer;" title="Bấm để mở chi tiết đơn">${escapeHtml(r.orderId || "")}</a>`;
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
        return link ? `<a href="${escapeHtml(link)}" class="order-link-btn" data-order-link="${escapeHtml(link)}" target="_blank" style="color:#2563eb; font-weight:600; text-decoration:underline; cursor:pointer;" title="Mở trang chi tiết đơn hàng">Link</a>` : '';
      }
    }
  ];

  function shortCell(value, max = 120) {
    const text = String(value || "");
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function renderRows(rows, existingInfo = currentOrderExistingInfo) {
    latestRows = Array.isArray(rows) ? rows : [];
    if (!latestRows.length) {
      if (thead) {
        thead.innerHTML = `<tr><th style="padding: 6px; border-bottom: 1px solid #cbd5e1;">Thong tin don hang</th></tr>`;
      }
      tbody.innerHTML = `<tr><td colspan="1" style="text-align: center; padding: 10px; color: #ef4444;">Khong co du lieu.</td></tr>`;
      return;
    }

    const isExisting = !!existingInfo?.exists;
    const rowNums = existingInfo?.rowNums || [];

    if (orderViewMode === "row") {
      // 1. Header dạng dòng (Bảng ngang)
      if (thead) {
        thead.innerHTML = `<tr>${rowViewColumns.map(c => `<th style="padding: 7px 8px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; white-space: nowrap; font-size: 11px; font-weight: 600; color: #334155; position: sticky; top: 0; z-index: 2;">${c.label}</th>`).join("")}</tr>`;
      }

      // 2. Body dạng dòng
      tbody.innerHTML = latestRows.map((row, idx) => {
        const isEven = idx % 2 === 0;
        let rowBg = isEven ? "#ffffff" : "#f8fafc";
        const rowLink = row.linkDon || row.link_don || (row.orderId ? `https://banhang.shopee.vn/portal/sale/order/${row.orderId}` : "");
        return `
          <tr class="order-tab-row-clickable" data-order-link="${escapeHtml(rowLink)}" style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'" title="Bấm vào dòng để mở chi tiết đơn hàng: ${escapeHtml(row.orderId || '')}">
            ${rowViewColumns.map(col => `
              <td style="padding: 6px 8px; font-size: 11px; white-space: nowrap; ${col.style || ''}">${col.render(row, idx)}</td>
            `).join("")}
          </tr>
        `;
      }).join("");

      tbody.querySelectorAll('.order-tab-row-clickable').forEach(tr => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button') || e.target.closest('input')) return;
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

      // Thêm banner cảnh báo nếu đơn đã có trong Sheet DH
      if (isExisting) {
        const rowText = rowNums && rowNums.length > 0 ? ` (Dòng ${rowNums.join(", ")})` : "";
        status.innerHTML = `<span style="color: #b45309; font-weight: bold; background: #fef08a; padding: 3px 8px; border-radius: 4px; border: 1px solid #fde047;">⚠️ Đơn hàng đã có trong Sheet DH${rowText}</span>`;
      }
    } else {
      // Header dạng thẻ dọc
      if (thead) {
        thead.innerHTML = `<tr><th style="padding: 6px; border-bottom: 1px solid #cbd5e1;">Thong tin don hang</th></tr>`;
      }
      tbody.innerHTML = latestRows.map((row) => `
        <tr>
          <td style="padding: 6px; border-bottom: 1px solid #edf2f7; vertical-align: top; white-space: normal;">${renderVerticalDetails(row, isExisting, rowNums)}</td>
        </tr>
      `).join("");
    }
  }

  function rowsToTsv(rows) {
    const headerLine = exportColumns.map((col) => col.label).join("\t");
    const bodyLines = rows.map((row) => exportColumns.map((col) => normalizeCellForExport(row, col.key)).join("\t"));
    return [headerLine, ...bodyLines].join("\n");
  }

  function sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function injectContentScript(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  async function readOrderFromTab(tabId) {
    try {
      const response = await sendMessageToTab(tabId, { type: "EXTRACT_SELLER_ORDER_DETAIL_FULL" });
      if (response) return response;
    } catch (error) {
      // Extension reloads do not automatically re-inject content scripts into open Shopee tabs.
    }

    await injectContentScript(tabId);
    await delay(350);
    return sendMessageToTab(tabId, { type: "EXTRACT_SELLER_ORDER_DETAIL_FULL" });
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
  }

  function getStorage(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  async function getCurrentMaGian() {
    const inputValue = document.getElementById("dh-hoan-text")?.value?.trim();
    if (inputValue) return inputValue;

    const storage = await getStorage(["maGian", "dhHoanTextValue"]);
    return String(storage.maGian || storage.dhHoanTextValue || "").trim();
  }

  function moneyValue(value) {
    const normalized = moneyToNumber(value);
    if (normalized === "") return "";
    const number = Number(normalized);
    return Number.isFinite(number) ? number : "";
  }

  function numberValue(value) {
    const text = String(value || "").replace(/[^0-9-]/g, "");
    if (!text) return "";
    const number = Number(text);
    return Number.isFinite(number) ? number : "";
  }

  function numberOrZero(value) {
    const number = typeof value === "number" ? value : moneyValue(value);
    return number === "" ? 0 : number;
  }

  function extractDatePart(value) {
    const text = normalizeCell(value);
    const match = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
    return match ? match[0] : text;
  }

  function formatDateTimeValue(value) {
    const text = normalizeCell(value);
    if (!text) return "";
    const matchTimeFirst = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (matchTimeFirst) {
      const timeParts = matchTimeFirst[1].split(":");
      const hhmm = `${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}`;
      return `${matchTimeFirst[2]} ${hhmm}`;
    }
    const matchDateFirst = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (matchDateFirst) {
      const timeParts = matchDateFirst[2].split(":");
      const hhmm = `${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}`;
      return `${matchDateFirst[1]} ${hhmm}`;
    }
    return text;
  }

  function buildOrderCapitalTotals(rows) {
    const totals = new Map();
    const hasLineCost = new Map();

    rows.forEach((row) => {
      const key = normalizeCell(row.orderId) || "__order__";
      const lineCost = moneyValue(row.lineCost);
      if (lineCost !== "") {
        totals.set(key, (totals.get(key) || 0) + lineCost);
        hasLineCost.set(key, true);
      }
    });

    rows.forEach((row) => {
      const key = normalizeCell(row.orderId) || "__order__";
      if (!hasLineCost.get(key)) {
        const totalCapital = moneyValue(row.totalCapital);
        if (totalCapital !== "") totals.set(key, totalCapital);
      }
    });

    return totals;
  }

  async function rowsToDhValues(rows, maGian) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    
    // Lọc bỏ ngay các dòng rỗng không có mã đơn và không có SKU
    const validRawRows = rows.filter(r => {
      if (!r) return false;
      const mdh = normalizeCell(r.orderId);
      const sku = normalizeCell(r.sku);
      const prc = normalizeCell(r.productPrice);
      return (mdh || sku || prc);
    });
    if (validRawRows.length === 0) return [];

    // 1. Đọc dữ liệu từ sheet DS_SP để tra cứu giá bán (don_gia)
    let dsSpMap = new Map();
    try {
      const res = await sendRuntimeMessage({ type: "FETCH_DS_SP" });
      if (res && res.ok && res.values && res.values.length > 1) {
        const headers = res.values[0].map(h => String(h || "").trim().toLowerCase());
        const idSpIdx = headers.findIndex(h => h === "id_sp" || h === "mã sp" || h.includes("id_sp"));
        const giaBanIdx = headers.findIndex(h => h === "gia_ban" || h === "giá bán" || h.includes("gia_ban") || h.includes("giá"));
        
        const bIdx = idSpIdx !== -1 ? idSpIdx : 1;
        const eIdx = giaBanIdx !== -1 ? giaBanIdx : 4;

        for (let i = 1; i < res.values.length; i++) {
          const row = res.values[i];
          const key = String(row[bIdx] || "").trim().toLowerCase();
          if (key) {
            const priceStr = String(row[eIdx] || "").replace(/[^\d-]/g, "");
            const priceNum = parseFloat(priceStr) || 0;
            dsSpMap.set(key, priceNum);
          }
        }
      }
    } catch (e) {
      console.warn("Không thể tải sheet DS_SP:", e);
    }

    // 2. Tính đơn giá (don_gia), thành tiền (thanh_tien) cho từng dòng sản phẩm
    const processedRows = validRawRows.map((row) => {
      const mdh = normalizeCell(row.orderId);
      const sku = normalizeCell(row.sku);
      // id_sp = left(sku, 10)
      const idSp = sku.length >= 10 ? sku.substring(0, 10) : sku;
      const slg = numberValue(row.quantity) || 1;
      
      // Đơn giá lấy từ cột gia_ban của DS_SP nếu id_sp trùng khớp, nếu không có lấy unitCost
      let donGia = dsSpMap.get(idSp.toLowerCase());
      if (donGia === undefined || donGia === null || donGia === 0) {
        donGia = moneyValue(row.unitCost);
      }
      if (donGia === "") donGia = 0;

      // thanh_tien = slg * don_gia
      const thanhTien = Number(slg) * Number(donGia);

      return {
        row,
        mdh,
        sku,
        idSp,
        slg,
        donGia,
        thanhTien
      };
    });

    // 3. Tính tien_sp (Tổng thanh_tien của tất cả sản phẩm cùng mã đơn hàng mdh)
    const tienSpMap = new Map();
    processedRows.forEach(item => {
      const key = item.mdh || "__order__";
      tienSpMap.set(key, (tienSpMap.get(key) || 0) + item.thanhTien);
    });

    // 4. Trả về mảng 25 cột dữ liệu chuẩn (loại bỏ dòng không có MDH và SKU)
    return processedRows
      .filter(item => item.mdh || item.sku)
      .map((item) => {
      const { row, mdh, sku, idSp, slg, donGia, thanhTien } = item;
      const tienSp = tienSpMap.get(mdh || "__order__") || 0;
      
      const tongTien = numberOrZero(moneyValue(row.totalProductAmount));
      const maGiamGia = numberOrZero(moneyValue(row.shopVoucher || row.maGiamGia || 0));
      const phiVc = numberOrZero(moneyValue(row.estimatedShippingTotal));
      const phuPhi = numberOrZero(moneyValue(row.surcharge));
      const thue = numberOrZero(moneyValue(row.tax));
      let doanhThu = numberOrZero(moneyValue(row.estimatedOrderIncome));

      if (!doanhThu || doanhThu === 0) {
        doanhThu = tongTien - maGiamGia - phiVc - phuPhi - thue;
      }
      const phiKhac = 0;

      // Công thức loi_nhuan = (doanh_thu - phi_khac - tien_sp)
      // Lưu ý: Trong kế toán bán hàng, Doanh Thu thực nhận đã khấu trừ Phí VC, Thuế, Phụ Phí... nên Lợi nhuận = Doanh Thu thực nhận - Phí khác - Tiền vốn sản phẩm
      const loiNhuan = doanhThu - phiKhac - tienSp;

      return [
        maGian,                                   // Col A (1): gian
        extractDatePart(row.orderCreatedAt),     // Col B (2): ngay
        formatDateTimeValue(row.orderCreatedAt),  // Col C (3): ngay_gio
        mdh,                                      // Col D (4): mdh
        normalizeCell(row.tracking),              // Col E (5): mvd
        tongTien || moneyValue(row.totalProductAmount), // Col F (6): tong_tien
        maGiamGia ? maGiamGia : 0,                // Col G (7): ma_giam_gia
        phiVc || moneyValue(row.estimatedShippingTotal), // Col H (8): phi_vc
        phuPhi || moneyValue(row.surcharge),      // Col I (9): phu_phi
        thue || moneyValue(row.tax),              // Col J (10): thue
        doanhThu,                                 // Col K (11): doanh_thu
        "",                                       // Col L (12): phi_khac
        tienSp,                                   // Col M (13): tien_sp (tổng thanh_tien mdh)
        loiNhuan,                                 // Col N (14): loi_nhuan (theo công thức)
        "",                                       // Col O (15): tinh_trang
        "",                                       // Col P (16): trang_thai
        sku,                                      // Col Q (17): sku
        idSp,                                     // Col R (18): id_sp (left sku 10)
        slg,                                      // Col S (19): slg
        donGia,                                   // Col T (20): don_gia (lấy gia_ban từ DS_SP)
        thanhTien,                                // Col U (21): thanh_tien (slg * don_gia)
        normalizeCell(row.tenKhach),              // Col V (22): ten_khach
        normalizeCell(row.ngNhan),                // Col W (23): ng_nhan
        normalizeCell(row.diaChi),                // Col X (24): dia_chi
        normalizeCell(row.linkDon)                // Col Y (25): link_don
      ];
    });
  }

  let isReadingOrder = false;
  let lastAutoReadUrl = "";
  let lastAutoReadAt = 0;

  function isOrderTabActive() {
    const tabContent = document.getElementById("tab-don-hang-detail");
    return !!tabContent && tabContent.classList.contains("active");
  }

  async function readCurrentOrder(options = {}) {
    const auto = !!options.auto;
    if (isReadingOrder) return;

    isReadingOrder = true;
    readButton.disabled = true;
    if (!auto) status.textContent = "Đang đọc đơn hàng...";

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isShopeeOrderUrl = (url) => {
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
      
      if (!tab?.id || !isShopeeOrderUrl(tab.url)) {
        if (!auto) throw new Error("Chỉ đọc link chi tiết đơn hàng có ID (ví dụ: https://banhang.shopee.vn/portal/sale/order/242102147201615).");
        if (auto && !latestRows.length) {
          status.textContent = "Chờ mở trang chi tiết đơn hàng Shopee có ID...";
        }
        return;
      }

      if (auto) {
        const now = Date.now();
        if (tab.url === lastAutoReadUrl && now - lastAutoReadAt < 2500) return;
        lastAutoReadUrl = tab.url;
        lastAutoReadAt = now;
      }

      const response = await readOrderFromTab(tab.id);
      if (!response?.ok) {
        if (!auto) {
          throw new Error(response?.error || response?.message || "Không đọc được đơn hàng.");
        } else {
          if (!latestRows.length) {
            status.textContent = "Đang chờ tải dữ liệu chi tiết đơn hàng...";
          }
          return;
        }
      }

      if (response.rows && response.rows.length > 0) {
        const orderId = String(response.orderId || response.rows[0]?.orderId || "").trim();
        const tracking = String(response.tracking || response.rows[0]?.tracking || "").trim();

        if (!orderId && !tracking) {
          if (!auto) throw new Error("Không tìm thấy Mã đơn hàng hoặc Mã vận đơn.");
          return;
        }

        // Kiểm tra xem đơn hàng đã có trong Sheet DH chưa và lấy dữ liệu đang lưu trong Sheet
        let exists = false;
        let rowNums = [];
        let existingRows = [];
        try {
          const checkRes = await sendRuntimeMessage({
            type: "CHECK_DH_ORDER_EXISTS",
            mdh: orderId,
            mvd: tracking
          });
          if (checkRes?.ok && checkRes.exists) {
            exists = true;
            rowNums = checkRes.rowNums || [];
            existingRows = checkRes.existingRows || [];
          }
        } catch (e) {
          console.warn("Lỗi kiểm tra đơn hàng trong sheet:", e);
        }

        // Tạo giá trị dòng và đối soát
        const maGian = await getCurrentMaGian();
        const currentDhValues = await rowsToDhValues(response.rows, maGian);
        
        let comparison = { isMatch: true, diffs: [], isNew: !exists };
        if (exists && existingRows && existingRows.length > 0) {
          const compareFn = window.nhieuDonHangTab?.compareOrderRows;
          if (compareFn) {
            comparison = compareFn(currentDhValues, existingRows);
          }
        }

        currentOrderExistingInfo = { exists, rowNums, existingRows, comparison };
        if (comparison && comparison.hasModifiedStatus) {
          status.innerHTML = `<span style="color:#b45309; font-weight:bold;">ℹ️ Đơn hàng trong Sheet DH (Dòng ${rowNums.join(", ")}) ĐÃ ĐƯỢC ĐỔI TÌNH TRẠNG: ${escapeHtml(comparison.existingStatus || "")}. Bấm "Cập nhật DH" nếu muốn lưu đè.</span>`;
          if (saveDhButton) {
            saveDhButton.textContent = "Cập nhật DH";
            saveDhButton.style.background = "#d97706";
            saveDhButton.style.borderColor = "#b45309";
          }
        } else if (exists && !comparison.isMatch) {
          status.innerHTML = `<span style="color:#dc2626; font-weight:bold;">⚠️ Dữ liệu Sheet DH (Dòng ${rowNums.join(", ")}) KHÁC với trang (Khác: ${comparison.diffs[0]}). Bấm "Cập nhật DH" để đồng bộ lại!</span>`;
          if (saveDhButton) {
            saveDhButton.textContent = "🔄 Cập nhật khớp DH";
            saveDhButton.style.background = "#dc2626";
            saveDhButton.style.borderColor = "#b91c1c";
          }
        } else if (exists) {
          status.innerHTML = `<span style="color:#15803d; font-weight:bold;">✅ Đơn hàng ĐÃ CÓ trong Sheet DH (Dòng ${rowNums.join(", ")}) - Dữ liệu KHỚP 100%.</span>`;
          if (saveDhButton) {
            saveDhButton.textContent = "✓ Đã khớp Sheet DH";
            saveDhButton.style.background = "#10b981";
            saveDhButton.style.borderColor = "#059669";
          }
        } else {
          status.textContent = `Đã đọc dữ liệu đơn hàng. Mã đơn: ${orderId || ""}. (Chưa có trong Sheet)`;
          if (saveDhButton) {
            saveDhButton.textContent = "Lưu DH";
            saveDhButton.style.background = "#16a34a";
            saveDhButton.style.borderColor = "#15803d";
          }
        }
      } else if (!auto) {
        throw new Error("Không tìm thấy thông tin sản phẩm trong đơn hàng.");
      }
    } catch (error) {
      if (!auto) {
        renderRows([]);
        status.textContent = `Lỗi: ${error.message}`;
      } else {
        if (!latestRows.length) {
          status.textContent = "Chờ mở trang chi tiết đơn hàng Shopee...";
        }
      }
    } finally {
      isReadingOrder = false;
      readButton.disabled = false;
    }
  }

  readButton.addEventListener("click", () => readCurrentOrder());

  document.querySelector('.tab-btn[data-tab="tab-don-hang-detail"]')?.addEventListener("click", () => {
    window.setTimeout(() => readCurrentOrder({ auto: true }), 250);
  });

  window.setTimeout(() => {
    if (isOrderTabActive()) readCurrentOrder({ auto: true });
  }, 600);

  window.setInterval(() => {
    if (isOrderTabActive()) readCurrentOrder({ auto: true });
  }, 3500);

  saveDhButton?.addEventListener("click", async () => {
    if (!latestRows.length) {
      status.textContent = "Chua co du lieu de luu DH.";
      return;
    }

    saveDhButton.disabled = true;
    status.textContent = "Dang luu vao sheet DH...";

    try {
      const maGian = await getCurrentMaGian();
      if (!maGian) throw new Error("Chua co ma gian trong tab Cai dat.");

      const sampleMdh = latestRows[0]?.orderId || "";
      const sampleMvd = latestRows[0]?.tracking || "";
      if (!sampleMdh && !sampleMvd) {
        throw new Error("Không tìm thấy Mã đơn hàng hoặc Mã vận đơn để lưu.");
      }

      const values = await rowsToDhValues(latestRows, maGian);
      if (!values.length) {
        throw new Error("Không có dữ liệu dòng đơn hàng hợp lệ để lưu.");
      }

      const response = await sendRuntimeMessage({
        type: "SAVE_DH_ORDER",
        values,
        mdh: sampleMdh,
        mvd: sampleMvd
      });

      if (!response?.ok) throw new Error(response?.error || "Khong luu duoc DH.");

      if (response.updated) {
        currentOrderExistingInfo = { exists: true, rowNums: response.rowNums || [] };
        renderRows(latestRows, currentOrderExistingInfo);
        const rowStr = response.rowNums && response.rowNums.length > 0 ? ` (Dòng ${response.rowNums.join(", ")})` : "";
        status.innerHTML = `<span style="color:#16a34a; font-weight:bold;">✅ Đã CẬP NHẬT LẠI ${response.count || values.length} dòng vào sheet DH${rowStr}.</span>`;
      } else {
        currentOrderExistingInfo = { exists: true, rowNums: [] };
        renderRows(latestRows, currentOrderExistingInfo);
        status.innerHTML = `<span style="color:#16a34a; font-weight:bold;">✅ Đã LƯU MỚI ${response.count || values.length} dòng vào sheet DH.</span>`;
      }

      if (saveDhButton) {
        saveDhButton.textContent = "Cập nhật DH";
        saveDhButton.style.background = "#d97706";
        saveDhButton.style.borderColor = "#b45309";
      }
    } catch (error) {
      status.textContent = `Loi luu DH: ${error.message}`;
    } finally {
      saveDhButton.disabled = false;
    }
  });
  copyButton.addEventListener("click", async () => {
    if (!latestRows.length) {
      status.textContent = "Chua co du lieu de copy.";
      return;
    }

    await navigator.clipboard.writeText(rowsToTsv(latestRows));
    status.textContent = `Da copy ${latestRows.length} dong TSV.`;
  });

  const exportExcelBtn = document.getElementById("btn-export-excel-current-order");
  exportExcelBtn?.addEventListener("click", async () => {
    if (!latestRows.length) {
      status.textContent = "Chưa có dữ liệu để xuất Excel.";
      return;
    }

    try {
      if (typeof XLSX === "undefined") {
        status.textContent = "Thư viện Excel chưa sẵn sàng.";
        return;
      }

      const maGian = await getCurrentMaGian();
      const rows = [exportColumns.map(col => col.label)];
      latestRows.forEach(row => {
        rows.push(exportColumns.map(col => normalizeCellForExport(row, col.key)));
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DonHang");

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const filename = `DH_${maGian || 'bce'}_${dd}${mm}_${hh}${m}.xlsx`;

      XLSX.writeFile(wb, filename);
      status.textContent = `✅ Đã xuất file Excel: ${filename}`;
    } catch (e) {
      status.textContent = `Lỗi xuất Excel: ${e.message}`;
    }
  });

  // Gán đơn hàng hiện tại sang tab Nhiều đơn hàng (và lưu vào Sheet DH)
  if (assignToNhieuDonHangBtn) {
    assignToNhieuDonHangBtn.addEventListener("click", async () => {
      if (!latestRows.length) {
        status.textContent = "Chưa có dữ liệu đơn hàng. Vui lòng bấm Đọc đơn trước!";
        return;
      }

      assignToNhieuDonHangBtn.disabled = true;
      const originalText = assignToNhieuDonHangBtn.textContent;
      assignToNhieuDonHangBtn.textContent = "⏳ Đang gán...";
      status.textContent = "⏳ Đang gán đơn vào Tab Nhiều đơn hàng & lưu Sheet DH...";

      try {
        const sampleMdh = latestRows[0]?.orderId || "";
        const sampleMvd = latestRows[0]?.tracking || "";
        if (!sampleMdh && !sampleMvd) {
          throw new Error("Không tìm thấy Mã đơn hàng hoặc Mã vận đơn để gán.");
        }

        const maGian = await getCurrentMaGian();
        const dhValues = await rowsToDhValues(latestRows, maGian);
        if (!dhValues.length) {
          throw new Error("Không có dữ liệu dòng đơn hàng hợp lệ để gán.");
        }

        if (window.nhieuDonHangTab?.addDhRows) {
          window.nhieuDonHangTab.addDhRows(dhValues, sampleMdh, sampleMvd, true);
        } else {
          await sendRuntimeMessage({
            type: "SAVE_DH_ORDER",
            values: dhValues,
            mdh: sampleMdh,
            mvd: sampleMvd
          });
        }

        status.innerHTML = `<span style="color:#16a34a; font-weight:bold;">✅ Đã gán đơn ${sampleMdh} vào tab Nhiều đơn hàng & lưu Sheet DH!</span>`;

        // Tự động chuyển tab sang Nhiều đơn hàng
        const tabBtn = document.querySelector('.tab-btn[data-tab="tab-nhieu-don-hang"]');
        if (tabBtn) tabBtn.click();
      } catch (err) {
        status.textContent = `Lỗi gán đơn: ${err.message}`;
      } finally {
        assignToNhieuDonHangBtn.disabled = false;
        assignToNhieuDonHangBtn.textContent = originalText;
      }
    });
  }

  // Chia sẻ các hàm tiện ích cho tab Nhiều đơn hàng sử dụng
  window.orderTabUtils = {
    readOrderFromTab,
    rowsToDhValues,
    getCurrentMaGian,
    moneyValue,
    moneyToNumber,
    normalizeCell,
    formatDateTimeValue,
    extractDatePart,
    getLatestRows: () => latestRows,
    rowViewColumns,
    exportColumns,
    displayColumns,
    renderVerticalDetails,
    formatMoneyDisplay,
    rowsToTsv,
    normalizeCellForExport
  };
})();