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
    { key: "totalProductAmount", label: "Tong tien SP" },
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
  function shortCell(value, max = 120) {
    const text = String(value || "");
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function renderRows(rows, existingInfo = currentOrderExistingInfo) {
    latestRows = Array.isArray(rows) ? rows : [];
    if (!latestRows.length) {
      tbody.innerHTML = `<tr><td colspan="1" style="text-align: center; padding: 10px; color: #ef4444;">Khong co du lieu.</td></tr>`;
      return;
    }

    const isExisting = !!existingInfo?.exists;
    const rowNums = existingInfo?.rowNums || [];

    tbody.innerHTML = latestRows.map((row) => `
      <tr>
        <td style="padding: 6px; border-bottom: 1px solid #edf2f7; vertical-align: top; white-space: normal;">${renderVerticalDetails(row, isExisting, rowNums)}</td>
      </tr>
    `).join("");
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
    const processedRows = rows.map((row) => {
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

    // 4. Trả về mảng 21 cột dữ liệu chuẩn
    return processedRows.map((item) => {
      const { row, mdh, sku, idSp, slg, donGia, thanhTien } = item;
      const tienSp = tienSpMap.get(mdh || "__order__") || 0;
      
      const tongTien = numberOrZero(moneyValue(row.totalProductAmount));
      const maGiamGia = 0;
      const phiVc = numberOrZero(moneyValue(row.estimatedShippingTotal));
      const phuPhi = numberOrZero(moneyValue(row.surcharge));
      const thue = numberOrZero(moneyValue(row.tax));
      const doanhThu = numberOrZero(moneyValue(row.estimatedOrderIncome));
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
        moneyValue(row.totalProductAmount),      // Col F (6): tong_tien
        "",                                       // Col G (7): ma_giam_gia
        moneyValue(row.estimatedShippingTotal),   // Col H (8): phi_vc
        moneyValue(row.surcharge),                // Col I (9): phu_phi
        moneyValue(row.tax),                      // Col J (10): thue
        moneyValue(row.estimatedOrderIncome),     // Col K (11): doanh_thu
        "",                                       // Col L (12): phi_khac
        tienSp,                                   // Col M (13): tien_sp (tổng thanh_tien mdh)
        loiNhuan,                                 // Col N (14): loi_nhuan (theo công thức)
        "",                                       // Col O (15): tinh_trang
        "",                                       // Col P (16): trang_thai
        sku,                                      // Col Q (17): sku
        idSp,                                     // Col R (18): id_sp (left sku 10)
        slg,                                      // Col S (19): slg
        donGia,                                   // Col T (20): don_gia (lấy gia_ban từ DS_SP)
        thanhTien                                 // Col U (21): thanh_tien (slg * don_gia)
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
      const isShopeeOrderUrl = tab?.url && /^https:\/\/banhang\.shopee\.vn\/portal\/sale\/order/.test(tab.url);
      
      if (!tab?.id || !isShopeeOrderUrl) {
        if (!auto) throw new Error("Hãy mở trang chi tiết đơn hàng banhang.shopee.vn/portal/sale/order/... trước.");
        if (auto && !latestRows.length) {
          status.textContent = "Chờ mở trang chi tiết đơn hàng Shopee...";
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
        const orderId = response.orderId || response.rows[0]?.orderId || "";
        const tracking = response.tracking || response.rows[0]?.tracking || "";

        // Kiểm tra xem đơn hàng đã có trong Sheet DH chưa
        let exists = false;
        let rowNums = [];
        try {
          const checkRes = await sendRuntimeMessage({
            type: "CHECK_DH_ORDER_EXISTS",
            mdh: orderId,
            mvd: tracking
          });
          if (checkRes?.ok && checkRes.exists) {
            exists = true;
            rowNums = checkRes.rowNums || [];
          }
        } catch (e) {
          console.warn("Lỗi kiểm tra đơn hàng trong sheet:", e);
        }

        currentOrderExistingInfo = { exists, rowNums };
        renderRows(response.rows, currentOrderExistingInfo);

        if (exists) {
          status.innerHTML = `<span style="color:#d97706; font-weight:bold;">⚠️ Đơn hàng ĐÃ CÓ trong Sheet DH (Dòng ${rowNums.join(", ")}). Bấm "Lưu ĐH" để cập nhật lại.</span>`;
          if (saveDhButton) {
            saveDhButton.textContent = "Cập nhật DH";
            saveDhButton.style.background = "#d97706";
            saveDhButton.style.borderColor = "#b45309";
          }
        } else {
          status.textContent = `Đã đọc dữ liệu đơn hàng. Mã đơn: ${orderId || ""}. (Chưa có trong Sheet)`;
          if (saveDhButton) {
            saveDhButton.textContent = "Luu DH";
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

      const values = await rowsToDhValues(latestRows, maGian);
      const sampleMdh = latestRows[0]?.orderId || "";
      const sampleMvd = latestRows[0]?.tracking || "";

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
})();