(function () {
  const tabBtn = document.querySelector('.tab-btn[data-tab="tab-doanh-thu"]');
  const readBtn = document.getElementById('btn-dt-read');
  const syncAllDhBtn = document.getElementById('btn-dt-sync-all-dh');
  const copyTsvBtn = document.getElementById('btn-dt-copy-tsv');
  const exportExcelBtn = document.getElementById('btn-dt-export-excel');
  const clearBtn = document.getElementById('btn-dt-clear');
  const searchInput = document.getElementById('dt-search-input');
  const statusEl = document.getElementById('dt-status');
  const statsEl = document.getElementById('dt-stats');
  const tbody = document.getElementById('dt-tbody');

  // Các phần tử bộ lọc ngày & Tự động quét
  const fromDateInput = document.getElementById('dt-from-date');
  const toDateInput = document.getElementById('dt-to-date');
  const quickDateBtns = document.querySelectorAll('.dt-quick-date-btn');
  const autoRunBtn = document.getElementById('btn-dt-auto-run');
  const autoStopBtn = document.getElementById('btn-dt-auto-stop');
  const autoProgressEl = document.getElementById('dt-auto-progress');

  let allRows = [];
  let isReading = false;
  let isSyncing = false;
  let isAutoScanning = false;
  let stopRequested = false;
  const syncedOrdersMap = new Map(); // orderId -> rowNums string

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.innerHTML = msg;
    statusEl.style.color = isError ? '#dc2626' : '#64748b';
  }

  function escapeHtml(val) {
    return String(val || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMoneyVND(val) {
    if (val === null || val === undefined || isNaN(val)) return "0 đ";
    const num = Number(val);
    const isNeg = num < 0;
    const absVal = Math.abs(num);
    const formatted = absVal.toLocaleString('vi-VN');
    return isNeg ? `-${formatted} đ` : `${formatted} đ`;
  }

  function formatDateToInput(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function initDateInputs() {
    const today = new Date();
    const past7 = new Date();
    past7.setDate(today.getDate() - 6);

    if (fromDateInput && !fromDateInput.value) {
      fromDateInput.value = formatDateToInput(past7);
    }
    if (toDateInput && !toDateInput.value) {
      toDateInput.value = formatDateToInput(today);
    }
  }

  function handleQuickDate(days) {
    const today = new Date();
    let from = new Date();
    let to = new Date(today);

    if (days === 0) {
      // Hôm nay
      from = new Date(today);
      to = new Date(today);
    } else if (days === 1) {
      // Hôm qua
      from.setDate(today.getDate() - 1);
      to.setDate(today.getDate() - 1);
    } else if (days === 7) {
      // 7 ngày
      from.setDate(today.getDate() - 6);
      to = new Date(today);
    } else if (days === 30) {
      // 30 ngày
      from.setDate(today.getDate() - 29);
      to = new Date(today);
    }

    if (fromDateInput) fromDateInput.value = formatDateToInput(from);
    if (toDateInput) toDateInput.value = formatDateToInput(to);

    // Đổi màu nút chọn nhanh
    quickDateBtns.forEach(btn => {
      if (Number(btn.getAttribute('data-days')) === days) {
        btn.style.background = '#6366f1';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#4f46e5';
      } else {
        btn.style.background = '#ffffff';
        btn.style.color = '#475569';
        btn.style.borderColor = '#cbd5e1';
      }
    });
  }

  function getDatesList(fromStr, toStr) {
    if (!fromStr || !toStr) return [];
    const [y1, m1, d1] = fromStr.split('-').map(Number);
    const [y2, m2, d2] = toStr.split('-').map(Number);
    let curr = new Date(y1, m1 - 1, d1);
    let end = new Date(y2, m2 - 1, d2);

    if (curr > end) {
      const temp = new Date(curr);
      curr = new Date(end);
      end = temp;
    }

    const list = [];
    while (curr <= end) {
      list.push(formatDateToInput(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }

  function waitForTabLoaded(tabId, timeoutMs = 25000) {
    return new Promise((resolve) => {
      let timer = null;
      const listener = (id, changeInfo) => {
        if (id === tabId && changeInfo.status === 'complete') {
          cleanup();
          resolve(true);
        }
      };
      const cleanup = () => {
        chrome.tabs.onUpdated.removeListener(listener);
        if (timer) clearTimeout(timer);
      };
      timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function findShopeeFinanceTab() {
    const tabs = await chrome.tabs.query({});
    const directTab = tabs.find(t => t.url && t.url.includes('banhang.shopee.vn/portal/finance/income'));
    if (directTab) return directTab;
    const shopeeTab = tabs.find(t => t.url && t.url.includes('banhang.shopee.vn/portal/finance'));
    return shopeeTab || null;
  }

  function isShopeeFinanceUrl(url) {
    if (!url) return false;
    return url.includes('banhang.shopee.vn/portal/finance/income') || url.includes('banhang.shopee.vn/portal/finance');
  }

  async function getCurrentMaGian() {
    const inputValue = document.getElementById("dh-hoan-text")?.value?.trim();
    if (inputValue) return inputValue;

    const storage = await new Promise(r => chrome.storage.local.get(["maGian", "dhHoanTextValue"], r));
    return String(storage?.maGian || storage?.dhHoanTextValue || "").trim();
  }

  // Khởi tạo ngày mặc định
  initDateInputs();

  // Khôi phục dữ liệu đã lưu trong storage
  chrome.storage.local.get(['doanh_thu_cache_data'], (res) => {
    if (res && res.doanh_thu_cache_data && res.doanh_thu_cache_data.length > 0) {
      allRows = res.doanh_thu_cache_data;
      updateStats();
      renderTable();
      setStatus(`<i>Đã khôi phục ${allRows.length} giao dịch từ bộ nhớ đệm.</i>`);
    }
  });

  // Tự động quét khi mở tab nếu đang ở đúng trang
  if (tabBtn) {
    tabBtn.addEventListener('click', async () => {
      const activeTab = await getActiveTab();
      if (activeTab && isShopeeFinanceUrl(activeTab.url)) {
        readDoanhThuData(true);
      }
    });
  }

  // Gắn sự kiện nút chọn nhanh ngày
  quickDateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const days = Number(btn.getAttribute('data-days'));
      handleQuickDate(days);
    });
  });

  if (autoRunBtn) {
    autoRunBtn.addEventListener('click', () => {
      runAutoDailyScan();
    });
  }

  if (autoStopBtn) {
    autoStopBtn.addEventListener('click', () => {
      stopRequested = true;
      autoStopBtn.disabled = true;
      autoStopBtn.innerHTML = '⏳ Đang dừng...';
      if (autoProgressEl) {
        autoProgressEl.innerHTML += `<br>⏳ <i>Đang dừng sau khi hoàn thành ngày hiện tại...</i>`;
      }
      setTimeout(() => {
        autoStopBtn.disabled = false;
        autoStopBtn.innerHTML = '⏹ Dừng Lại';
      }, 2500);
    });
  }

  if (readBtn) {
    readBtn.addEventListener('click', () => {
      readDoanhThuData(false);
    });
  }

  if (syncAllDhBtn) {
    syncAllDhBtn.addEventListener('click', () => {
      syncAllToSheetDh();
    });
  }

  if (copyTsvBtn) {
    copyTsvBtn.addEventListener('click', () => {
      copyTableToTsv();
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      exportToExcel();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm("Bạn có chắc chắn muốn xóa danh sách doanh thu này không?")) {
        allRows = [];
        syncedOrdersMap.clear();
        chrome.storage.local.remove(['doanh_thu_cache_data']);
        updateStats();
        renderTable();
        setStatus("Đã xóa dữ liệu.");
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderTable();
    });
  }

  // =========================================================================
  // HÀM TRÍCH XUẤT NỘI BỘ TRANG SHOPEE FINANCE (INJECTED SCRIPT)
  // =========================================================================
  async function inPageExtractDoanhThu() {
    if (!window.location.href.includes('/portal/finance/income') && !window.location.href.includes('/portal/finance')) {
      return { ok: false, message: "Trang hiện tại không phải là Shopee Doanh Thu (Finance Income)." };
    }

    // 1. Tự động chọn 50 / page nếu chưa chọn
    try {
      const sizeSpan = document.querySelector('.eds-pagination-sizes__content');
      if (sizeSpan && !sizeSpan.innerText.includes('50')) {
        sizeSpan.click();
        await new Promise(r => setTimeout(r, 400));
        const items = Array.from(document.querySelectorAll('.eds-dropdown-item, .eds-dropdown-menu li, .eds-dropdown__item'));
        const item50 = items.find(el => el.innerText.trim() === '50' || el.textContent.trim() === '50' || el.innerText.includes('50'));
        if (item50) {
          item50.click();
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    } catch (e) {
      console.warn("Could not change page size to 50:", e);
    }

    // 2. BẤM MỞ RỘNG TẤT CẢ CÁC ĐƠN BẰNG ICON MŨI TÊN (CHỐNG MỞ TAB TUYỆT ĐỐI)
    const preventLinkClicks = (e) => {
      if (e.target.closest('a') || e.target.tagName === 'A') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('click', preventLinkClicks, true);

    try {
      const rows = Array.from(document.querySelectorAll('.grid-table-body .grid-table-row, .transaction-table .grid-table-row, .grid-table-row'));
      rows.forEach(r => {
        const arrowIcon = r.querySelector('path[d*="9.18933983"]')?.closest('i') ||
                          r.querySelector('.transaction-amount-wrapper i.eds-icon') ||
                          r.querySelector('.transaction-amount-wrapper i') ||
                          r.querySelector('i.eds-icon');

        if (arrowIcon && !arrowIcon.closest('a')) {
          const opts = { bubbles: true, cancelable: true, view: window };
          arrowIcon.dispatchEvent(new MouseEvent('mousedown', opts));
          arrowIcon.dispatchEvent(new MouseEvent('mouseup', opts));
          arrowIcon.dispatchEvent(new MouseEvent('click', opts));
        }
      });

      if (rows.length > 0) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      console.warn("Lỗi khi mở rộng dòng:", e);
    } finally {
      window.removeEventListener('click', preventLinkClicks, true);
    }

    // 3. Hàm phân tích số tiền VND (Luôn lấy giá trị DƯƠNG)
    const parseVND = (rawStr) => {
      if (!rawStr) return 0;
      const str = String(rawStr).trim();
      const digits = str.replace(/[^0-9]/g, '');
      if (!digits) return 0;
      return parseInt(digits, 10);
    };

    // 4. Quét tất cả các dòng giao dịch trong bảng
    const rowElements = Array.from(document.querySelectorAll('.grid-table.transaction-table .grid-table-body .grid-table-row, .transaction-table .grid-table-body .grid-table-row, .grid-table-body .grid-table-row'));
    
    if (rowElements.length === 0) {
      return { ok: true, rows: [], empty: true, message: "Không tìm thấy dòng giao dịch nào trong bảng." };
    }

    const extractedRows = [];

    for (let i = 0; i < rowElements.length; i++) {
      const rEl = rowElements[i];
      const cells = Array.from(rEl.children);
      if (cells.length < 5) continue;

      // Cột 1: Đơn hàng (Mã đơn + Người mua + Ảnh)
      const orderCell = cells[0];
      const orderIdEl = orderCell.querySelector('.order-id');
      let orderId = "";
      if (orderIdEl) {
        const match = orderIdEl.innerText.match(/[A-Z0-9]{10,20}/i);
        orderId = match ? match[0] : orderIdEl.innerText.trim();
      }

      const buyerNameEl = orderCell.querySelector('.buyer .name, .buyer');
      let buyer = "";
      if (buyerNameEl) {
        buyer = buyerNameEl.innerText.replace(/.*(?:Người mua|Buyer)\s*:\s*/i, '').trim();
      }

      const imgEl = orderCell.querySelector('.first-item-img');
      let imgUrl = "";
      if (imgEl) {
        const bg = imgEl.style.backgroundImage || "";
        const matchBg = bg.match(/url\(["']?(.*?)["']?\)/);
        if (matchBg) imgUrl = matchBg[1];
      }

      // Cột 2: Thanh toán đã chuyển vào (Ngày)
      const dateCell = cells[1];
      const dateStr = (dateCell.innerText || dateCell.textContent || "").trim();

      // Cột 3: Trạng thái
      const statusCell = cells[2];
      const statusStr = (statusCell.innerText || statusCell.textContent || "").trim();

      // Cột 4: Phương thức thanh toán
      const methodCell = cells[3];
      const methodStr = (methodCell.innerText || methodCell.textContent || "").trim();

      // Cột 5: Số tiền thanh toán
      const amountCell = cells[4];
      const amountEl = amountCell.querySelector('.transaction-amount') || amountCell;
      const rawAmount = (amountEl.innerText || amountEl.textContent || "").trim();
      let defaultAmount = parseVND(rawAmount);

      let detailContainer = rEl;
      let nextEl = rEl.nextElementSibling;
      const combinedElements = [rEl];
      while (nextEl && !nextEl.classList.contains('grid-table-row')) {
        combinedElements.push(nextEl);
        nextEl = nextEl.nextElementSibling;
      }

      // 5. Trích xuất Link đơn hàng
      let orderLink = "";
      for (const el of combinedElements) {
        const found = Array.from(el.querySelectorAll('a[href*="/portal/sale/"]')).find(a =>
          a.textContent.includes('Xem thông tin') || /\/portal\/sale\/\d+/.test(a.getAttribute('href') || '')
        );
        if (found) {
          const href = found.getAttribute('href') || "";
          orderLink = href.startsWith('http') ? href : `https://banhang.shopee.vn${href}`;
          break;
        }
      }

      if (!orderLink) {
        const allSaleLinks = Array.from(document.querySelectorAll('a[href*="/portal/sale/"]')).filter(a =>
          /\/portal\/sale\/\d+/.test(a.getAttribute('href') || '')
        );
        if (allSaleLinks.length > i) {
          const href = allSaleLinks[i].getAttribute('href') || "";
          orderLink = href.startsWith('http') ? href : `https://banhang.shopee.vn${href}`;
        }
      }

      if (!orderLink && orderId) {
        orderLink = `https://banhang.shopee.vn/portal/sale/order/${orderId}`;
      }

      // 6. Trích xuất 5 cột tài chính chi tiết
      let tienSanPham = 0;
      let phiVanChuyen = 0;
      let phuPhi = 0;
      let thue = 0;
      let doanhThu = defaultAmount;

      let foundBreakdown = false;

      combinedElements.forEach(el => {
        const textRows = Array.from(el.querySelectorAll('div, tr, li, p'));
        textRows.forEach(trEl => {
          const children = Array.from(trEl.children);
          if (children.length >= 2) {
            const lbl = children[0].innerText.trim().toLowerCase();
            const val = children[children.length - 1].innerText.trim();

            if (lbl === 'tổng tiền sản phẩm' || lbl.startsWith('tổng tiền sản phẩm')) {
              tienSanPham = parseVND(val);
              foundBreakdown = true;
            } else if (lbl === 'tổng phí vận chuyển' || lbl.startsWith('tổng phí vận chuyển')) {
              phiVanChuyen = parseVND(val);
              foundBreakdown = true;
            } else if (lbl === 'phụ phí' || lbl.startsWith('phụ phí')) {
              phuPhi = parseVND(val);
              foundBreakdown = true;
            } else if (lbl === 'thuế' || (lbl.startsWith('thuế') && !lbl.includes('gtgt') && !lbl.includes('tncn'))) {
              thue = parseVND(val);
              foundBreakdown = true;
            } else if (lbl === 'doanh thu đơn hàng' || lbl.includes('doanh thu đơn hàng')) {
              doanhThu = parseVND(val);
              foundBreakdown = true;
            }
          }
        });

        const fullText = el.innerText || "";
        if (!foundBreakdown || tienSanPham === 0) {
          const m1 = fullText.match(/tổng tiền sản phẩm\s*[:\n\t]*([^\n]+)/i);
          if (m1) tienSanPham = parseVND(m1[1]);
        }
        if (!foundBreakdown || phiVanChuyen === 0) {
          const m2 = fullText.match(/tổng phí vận chuyển\s*[:\n\t]*([^\n]+)/i);
          if (m2) phiVanChuyen = parseVND(m2[1]);
        }
        if (!foundBreakdown || phuPhi === 0) {
          const m3 = fullText.match(/phụ phí\s*[:\n\t]*([^\n]+)/i);
          if (m3) phuPhi = parseVND(m3[1]);
        }
        if (!foundBreakdown || thue === 0) {
          const m4 = fullText.match(/(?:^|\n)\s*thuế\s*[:\n\t]*([^\n]+)/im);
          if (m4) thue = parseVND(m4[1]);
        }
        if (!foundBreakdown || doanhThu === 0) {
          const m5 = fullText.match(/doanh thu đơn hàng\s*[:\n\t]*([^\n]+)/i);
          if (m5) doanhThu = parseVND(m5[1]);
        }
      });

      // Công thức Doanh Thu: tong_tien - ma_giam_gia (0) - phi_vc - phu_phi - thue
      const calculatedDoanhThu = (tienSanPham > 0 || phuPhi > 0 || thue > 0)
        ? (tienSanPham - phiVanChuyen - phuPhi - thue)
        : doanhThu;

      if (orderId || rawAmount || calculatedDoanhThu) {
        extractedRows.push({
          orderId,
          buyer,
          imgUrl,
          orderLink,
          date: dateStr,
          status: statusStr,
          paymentMethod: methodStr,
          rawAmount,
          amount: calculatedDoanhThu,
          tienSanPham,
          phiVanChuyen,
          phuPhi,
          thue,
          doanhThu: calculatedDoanhThu
        });
      }
    }

    return { ok: true, rows: extractedRows, url: window.location.href };
  }

  // =========================================================================
  // HÀM TỰ ĐỘNG CHỌN NGÀY BẰNG GIAO DIỆN SHOPEE & TRÍCH XUẤT (INJECTED SCRIPT)
  // =========================================================================
  async function inPageSelectDateAndExtract(targetDateStr) {
    if (!window.location.href.includes('/portal/finance/income') && !window.location.href.includes('/portal/finance')) {
      return { ok: false, message: "Trang hiện tại không phải là Shopee Doanh Thu (Finance Income)." };
    }

    const dispatchClick = (el) => {
      if (!el) return;
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
    };

    const parseMonthText = (text) => {
      if (!text) return null;
      const t = String(text).trim().toLowerCase();
      const numMatch = t.match(/\b([1-9]|1[0-2])\b/);
      if (t.includes('jan') || t.includes('tháng 1') || t.includes('thg 1') || t === '1') return 1;
      if (t.includes('feb') || t.includes('tháng 2') || t.includes('thg 2') || t === '2') return 2;
      if (t.includes('mar') || t.includes('tháng 3') || t.includes('thg 3') || t === '3') return 3;
      if (t.includes('apr') || t.includes('tháng 4') || t.includes('thg 4') || t === '4') return 4;
      if (t.includes('may') || t.includes('tháng 5') || t.includes('thg 5') || t === '5') return 5;
      if (t.includes('jun') || t.includes('tháng 6') || t.includes('thg 6') || t === '6') return 6;
      if (t.includes('jul') || t.includes('tháng 7') || t.includes('thg 7') || t === '7') return 7;
      if (t.includes('aug') || t.includes('tháng 8') || t.includes('thg 8') || t === '8') return 8;
      if (t.includes('sep') || t.includes('tháng 9') || t.includes('thg 9') || t === '9') return 9;
      if (t.includes('oct') || t.includes('tháng 10') || t.includes('thg 10') || t === '10') return 10;
      if (t.includes('nov') || t.includes('tháng 11') || t.includes('thg 11') || t === '11') return 11;
      if (t.includes('dec') || t.includes('tháng 12') || t.includes('thg 12') || t === '12') return 12;
      if (numMatch) return parseInt(numMatch[1], 10);
      return null;
    };

    const getCalendarMonthYear = (container) => {
      const header = container.querySelector('.eds-picker-header');
      if (!header) return null;
      const labels = Array.from(header.querySelectorAll('.eds-picker-header__label'))
        .filter(el => el.offsetParent !== null && window.getComputedStyle(el).display !== 'none');
      let curMonth = null;
      let curYear = null;
      for (const lbl of labels) {
        const txt = (lbl.innerText || lbl.textContent || '').trim();
        const yr = txt.match(/\b(20\d\d)\b/);
        if (yr) {
          curYear = parseInt(yr[1], 10);
        } else {
          const m = parseMonthText(txt);
          if (m !== null) curMonth = m;
        }
      }
      return { month: curMonth, year: curYear };
    };

    const [targetYear, targetMonth, targetDay] = targetDateStr.split('-').map(Number);

    // 1. Mở popup date picker nếu chưa mở
    let popper = document.querySelector('.eds-popper.picker-wrapper, .picker-wrapper, .eds-popper[x-placement]');
    const isPopperVisible = () => {
      popper = document.querySelector('.eds-popper.picker-wrapper, .picker-wrapper, .eds-popper[x-placement]');
      return popper && popper.offsetParent !== null && window.getComputedStyle(popper).display !== 'none';
    };

    if (!isPopperVisible()) {
      // Click icon mũi tên xuống hoặc container chọn ngày
      const arrowSvg = document.querySelector('path[d*="28.2 11.1-10.9 12"], path[d*="28.2 11.1"]');
      const triggerIcon = arrowSvg?.closest('i') || arrowSvg?.closest('svg');
      const triggerParent = triggerIcon?.closest('.picker-trigger, .eds-dropdown, .eds-date-picker, .date-filter, div') || triggerIcon?.parentElement;

      if (triggerIcon) {
        dispatchClick(triggerIcon);
        if (triggerParent && triggerParent !== triggerIcon) dispatchClick(triggerParent);
      } else {
        const allDivs = Array.from(document.querySelectorAll('.eds-dropdown, .picker-trigger, .eds-date-picker, div'));
        const found = allDivs.find(el => {
          const t = (el.innerText || '');
          return (t.includes('Tuần này') || t.includes('Tháng này') || /\d{2}\/\d{2}\/\d{4}/.test(t)) && el.querySelector('.eds-icon');
        });
        if (found) dispatchClick(found);
      }
      await new Promise(r => setTimeout(r, 600));
    }

    // 2. Click vào mục "Chọn ngày" bên menu trái popup
    popper = document.querySelector('.eds-popper.picker-wrapper, .picker-wrapper, .eds-popper[x-placement]');
    if (popper) {
      const options = Array.from(popper.querySelectorAll('.opts-panel li, .options li, li'));
      const customOpt = options.find(li => {
        const t = (li.innerText || li.textContent || '').trim();
        return t.includes('Chọn ngày') || t.includes('Custom') || t.includes('Tùy chọn') || li.querySelector('path[d*="23.5 15.5-12-11"]');
      });
      if (customOpt) {
        dispatchClick(customOpt);
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // 3. Tìm khung lịch bên trái
    let leftBody = document.querySelector('.eds-daterange-picker-panel__body-left, .date-range-panel, .eds-daterange-picker-panel');
    if (!leftBody) {
      return { ok: false, message: "Không tìm thấy khung lịch để chọn ngày." };
    }

    // 4. Điều hướng tháng/năm trên lịch để trùng với targetMonth, targetYear
    let maxNavSteps = 24;
    while (maxNavSteps > 0) {
      maxNavSteps--;
      const current = getCalendarMonthYear(leftBody);
      if (!current || !current.month || !current.year) break;

      const diff = (targetYear - current.year) * 12 + (targetMonth - current.month);
      if (diff === 0) break;

      if (diff < 0) {
        // Sang tháng trước (nút prev tháng có d*="6.81066017")
        const prevBtns = Array.from(leftBody.querySelectorAll('.eds-picker-header__prev:not(.disabled)'));
        const prevMonthBtn = prevBtns.find(b => b.querySelector('path[d*="6.81066017"]')) || prevBtns[prevBtns.length - 1] || prevBtns[0];
        if (!prevMonthBtn) break;
        dispatchClick(prevMonthBtn);
        await new Promise(r => setTimeout(r, 200));
      } else {
        // Sang tháng sau (nút next tháng có d*="9.18933983")
        const nextBtns = Array.from(leftBody.querySelectorAll('.eds-picker-header__next:not(.disabled)'));
        const nextMonthBtn = nextBtns.find(b => b.querySelector('path[d*="9.18933983"]')) || nextBtns[0];
        if (!nextMonthBtn) break;
        dispatchClick(nextMonthBtn);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // 5. Chọn ngày targetDay trong bảng ngày
    let dayCells = Array.from(leftBody.querySelectorAll('.eds-date-table__cell'));
    let validCell = dayCells.find(c => {
      if (c.classList.contains('out-of-month') || c.classList.contains('is-empty') || c.classList.contains('disabled')) return false;
      const inner = c.querySelector('.eds-date-table__cell-inner') || c;
      return (inner.innerText || inner.textContent || '').trim() === String(targetDay);
    });

    if (!validCell) {
      // Thử kiểm tra khung lịch bên phải nếu target nằm ở tháng tiếp theo
      const rightBody = document.querySelector('.eds-daterange-picker-panel__body-right');
      if (rightBody) {
        const rightCells = Array.from(rightBody.querySelectorAll('.eds-date-table__cell'));
        validCell = rightCells.find(c => {
          if (c.classList.contains('out-of-month') || c.classList.contains('is-empty') || c.classList.contains('disabled')) return false;
          const inner = c.querySelector('.eds-date-table__cell-inner') || c;
          return (inner.innerText || inner.textContent || '').trim() === String(targetDay);
        });
      }
    }

    if (!validCell) {
      return { ok: false, message: `Không tìm thấy ô ngày ${targetDay} trong lịch tháng ${targetMonth}/${targetYear}.` };
    }

    // Click 2 lần vào ngày để chọn cả Start Date và End Date là cùng ngày targetDay
    dispatchClick(validCell);
    await new Promise(r => setTimeout(r, 250));
    dispatchClick(validCell);
    await new Promise(r => setTimeout(r, 400));

    // Nếu có nút Xác nhận / Áp dụng thì bấm
    const confirmBtn = document.querySelector('.eds-daterange-picker-panel__footer .eds-btn--primary, .date-range-panel .eds-btn--primary');
    if (confirmBtn) {
      dispatchClick(confirmBtn);
      await new Promise(r => setTimeout(r, 300));
    }

    // 6. Chờ Shopee gửi API và cập nhật bảng dữ liệu giao dịch
    await new Promise(r => setTimeout(r, 2200));

    // 7. Gọi hàm trích xuất dữ liệu trên trang
    return await inPageExtractDoanhThu();
  }

  // =========================================================================
  // ĐỌC DỮ LIỆU ĐƠN LẺ TỪ TRANG SHOPEE FINANCE HIỆN TẠI
  // =========================================================================
  async function readDoanhThuData(isAuto = false) {
    if (isReading || isAutoScanning) return;
    isReading = true;

    if (!isAuto) {
      setStatus('<span style="color: #ee4d2d; font-weight: bold;">⏳ Đang kết nối tới trang Shopee Finance...</span>');
    }

    try {
      let targetTab = await getActiveTab();
      if (!targetTab || !isShopeeFinanceUrl(targetTab.url)) {
        targetTab = await findShopeeFinanceTab();
      }

      if (!targetTab || !isShopeeFinanceUrl(targetTab.url)) {
        if (!isAuto) {
          setStatus('❌ Vui lòng mở trang Shopee Finance: <b>banhang.shopee.vn/portal/finance/income</b> trước!', true);
        }
        isReading = false;
        return;
      }

      setStatus('<span style="color: #ee4d2d; font-weight: bold;">⏳ Đang mở rộng & đọc chi tiết doanh thu (Tiền SP, Phí VC, Phụ phí, Thuế, Doanh thu)...</span>');

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: inPageExtractDoanhThu
      });

      if (result && result.result && result.result.ok) {
        allRows = result.result.rows || [];
        chrome.storage.local.set({ doanh_thu_cache_data: allRows });
        updateStats();
        renderTable();
        const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (allRows.length === 0) {
          setStatus(`ℹ️ Không có giao dịch nào trên trang hiện tại lúc ${now}.`);
        } else {
          setStatus(`✅ <b>Thành công:</b> Đã đọc <b>${allRows.length}</b> đơn lúc ${now}.`);
        }
      } else {
        setStatus(`⚠️ ${result?.result?.message || "Không thể đọc dữ liệu từ trang Shopee Finance."}`, true);
      }
    } catch (err) {
      console.error(err);
      setStatus(`❌ Lỗi đọc doanh thu: ${err.message}`, true);
    } finally {
      isReading = false;
    }
  }

  // =========================================================================
  // TỰ ĐỘNG QUÉT TỪNG NGÀY & CẬP NHẬT TẤT CẢ LÊN SHEET DH
  // =========================================================================
  async function runAutoDailyScan() {
    if (isAutoScanning || isReading) return;

    const fromDateVal = fromDateInput ? fromDateInput.value : '';
    const toDateVal = toDateInput ? toDateInput.value : '';

    if (!fromDateVal || !toDateVal) {
      alert("Vui lòng chọn đầy đủ 'Từ ngày' và 'Tới ngày'!");
      return;
    }

    const dateList = getDatesList(fromDateVal, toDateVal);
    if (!dateList.length) {
      alert("Khoảng ngày không hợp lệ.");
      return;
    }

    let targetTab = await getActiveTab();
    if (!targetTab || !isShopeeFinanceUrl(targetTab.url)) {
      targetTab = await findShopeeFinanceTab();
    }

    if (!targetTab || !isShopeeFinanceUrl(targetTab.url)) {
      alert("Vui lòng mở trang Shopee Finance (banhang.shopee.vn/portal/finance/income) trên một tab trước khi chạy!");
      return;
    }

    isAutoScanning = true;
    stopRequested = false;

    if (autoRunBtn) autoRunBtn.style.display = 'none';
    if (autoStopBtn) autoStopBtn.style.display = 'inline-block';
    if (autoProgressEl) {
      autoProgressEl.style.display = 'block';
      autoProgressEl.innerHTML = `🚀 Bắt đầu quét <b>${dateList.length} ngày</b> (Từ ${fromDateVal} đến ${toDateVal})...`;
    }
    setStatus(`<span style="color: #4f46e5; font-weight: bold;">⚡ Đang tự động quét ${dateList.length} ngày & cập nhật Sheet ĐH...</span>`);

    let totalOrdersExtracted = 0;
    let totalUpdatedToDh = 0;
    let completedDays = 0;

    try {
      const maGian = await getCurrentMaGian();

      for (let i = 0; i < dateList.length; i++) {
        if (stopRequested) {
          if (autoProgressEl) {
            autoProgressEl.innerHTML += `<br>⏹ <b style="color: #dc2626;">Đã dừng theo yêu cầu của bạn!</b>`;
          }
          break;
        }

        const dStr = dateList[i];
        if (autoProgressEl) {
          autoProgressEl.innerHTML = `📅 [${i + 1}/${dateList.length}] Ngày <b>${dStr}</b>: Đang chọn ngày trên Shopee & đọc dữ liệu...`;
        }

        // Ưu tiên 1: Tự động thao tác trực tiếp trên giao diện DatePicker của Shopee
        let dayRows = [];
        let scanSuccess = false;

        try {
          const [execResult] = await chrome.scripting.executeScript({
            target: { tabId: targetTab.id },
            func: inPageSelectDateAndExtract,
            args: [dStr]
          });

          const resData = execResult?.result;
          if (resData && resData.ok) {
            dayRows = resData.rows || [];
            scanSuccess = true;
          }
        } catch (e) {
          console.warn("Lỗi in-page date picker, chuyển sang fallback URL:", e);
        }

        // Fallback: Nếu chọn trên giao diện gặp lỗi, điều hướng URL
        if (!scanSuccess && !stopRequested) {
          const [yyyy, mm, dd] = dStr.split('-').map(Number);
          const startSec = Math.floor(new Date(yyyy, mm - 1, dd, 0, 0, 0).getTime() / 1000);
          const endSec = Math.floor(new Date(yyyy, mm - 1, dd, 23, 59, 59).getTime() / 1000);
          const dayUrl = `https://banhang.shopee.vn/portal/finance/income?type=2&dateRange=CUSTOM&start_time=${startSec}&end_time=${endSec}`;

          await chrome.tabs.update(targetTab.id, { url: dayUrl });
          await waitForTabLoaded(targetTab.id, 25000);
          await new Promise(r => setTimeout(r, 2200));

          if (stopRequested) break;

          const [fallbackResult] = await chrome.scripting.executeScript({
            target: { tabId: targetTab.id },
            func: inPageExtractDoanhThu
          });
          const fData = fallbackResult?.result;
          if (fData && fData.ok) {
            dayRows = fData.rows || [];
          }
        }

        if (dayRows.length > 0) {
          // Merge vào allRows (cập nhật hoặc thêm mới)
          dayRows.forEach(row => {
            const existingIdx = allRows.findIndex(r => r.orderId && row.orderId && r.orderId.toLowerCase() === row.orderId.toLowerCase());
            if (existingIdx !== -1) {
              allRows[existingIdx] = row;
            } else {
              allRows.unshift(row);
            }
          });

          chrome.storage.local.set({ doanh_thu_cache_data: allRows });
          updateStats();
          renderTable();
          totalOrdersExtracted += dayRows.length;

          // Cập nhật ngay ngày này lên Sheet DH
          const positiveItems = dayRows.map(r => {
            const isNeg = Boolean(r.isNegative || (Number(r.amount) < 0) || (Number(r.doanhThu) < 0) || String(r.rawAmount || '').includes('-'));
            return {
              ...r,
              isNegative: isNeg,
              rawAmount: r.rawAmount || "",
              tienSanPham: Math.abs(Number(r.tienSanPham) || 0),
              phiVanChuyen: Math.abs(Number(r.phiVanChuyen) || 0),
              phuPhi: Math.abs(Number(r.phuPhi) || 0),
              thue: Math.abs(Number(r.thue) || 0),
              doanhThu: Math.abs(Number(r.amount || r.doanhThu) || 0),
              amount: Math.abs(Number(r.amount || r.doanhThu) || 0)
            };
          });

          if (autoProgressEl) {
            autoProgressEl.innerHTML = `📅 [${i + 1}/${dateList.length}] Ngày <b>${dStr}</b>: Đã đọc <b>${dayRows.length}</b> đơn. Đang đồng bộ lên Sheet ĐH...`;
          }

          const syncRes = await new Promise(resolve => {
            chrome.runtime.sendMessage({
              type: "UPDATE_DH_INCOME_FINANCIALS",
              items: positiveItems,
              maGian
            }, resolve);
          });

          if (syncRes && syncRes.ok) {
            if (syncRes.matchedOrders && Array.isArray(syncRes.matchedOrders)) {
              const conflictSet = new Set((syncRes.conflictedOrders || []).map(o => String(o).toLowerCase()));
              syncRes.matchedOrders.forEach(ordId => {
                if (conflictSet.has(ordId.toLowerCase())) {
                  syncedOrdersMap.set(ordId.toLowerCase(), "⚠️ Xung đột");
                } else {
                  syncedOrdersMap.set(ordId.toLowerCase(), "✓ Đã cập nhật");
                }
              });
            }
            totalUpdatedToDh += (syncRes.matchedCount || 0);
          }
          renderTable();
        }

        completedDays++;

        if (autoProgressEl) {
          autoProgressEl.innerHTML = `✅ [${i + 1}/${dateList.length}] Ngày <b>${dStr}</b>: Xong (${dayRows.length} đơn). Tiến độ tổng: ${totalOrdersExtracted} đơn đọc, ${totalUpdatedToDh} dòng Sheet ĐH.`;
        }

        // Nghỉ một chút giữa các ngày để tránh spam Shopee API
        if (i < dateList.length - 1 && !stopRequested) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      const finishMsg = stopRequested
        ? `⏹ <b>Đã dừng quét:</b> Hoàn thành <b>${completedDays}/${dateList.length}</b> ngày. Tổng cộng đọc <b>${totalOrdersExtracted}</b> đơn, cập nhật <b>${totalUpdatedToDh}</b> dòng Sheet ĐH.`
        : `🎉 <b>Hoàn tất:</b> Đã quét xong <b>${completedDays} ngày</b>. Tổng cộng đọc <b>${totalOrdersExtracted}</b> đơn, cập nhật <b>${totalUpdatedToDh}</b> dòng Sheet ĐH!`;

      setStatus(finishMsg);
      if (autoProgressEl) {
        autoProgressEl.innerHTML = finishMsg;
      }
    } catch (err) {
      console.error(err);
      setStatus(`❌ Lỗi trong quá trình tự động quét: ${err.message}`, true);
      if (autoProgressEl) {
        autoProgressEl.innerHTML = `❌ <b>Lỗi:</b> ${escapeHtml(err.message)}`;
      }
    } finally {
      isAutoScanning = false;
      stopRequested = false;
      if (autoRunBtn) autoRunBtn.style.display = 'flex';
      if (autoStopBtn) autoStopBtn.style.display = 'none';
    }
  }

  // =========================================================================
  // CẬP NHẬT LÊN SHEET ĐƠN HÀNG (DH)
  // =========================================================================
  async function syncSingleToSheetDh(orderId, btnElement) {
    if (!orderId) return;
    const item = allRows.find(r => (r.orderId || "").toLowerCase() === orderId.toLowerCase());
    if (!item) {
      alert("Không tìm thấy thông tin đơn hàng này trong danh sách.");
      return;
    }

    if (btnElement) {
      btnElement.disabled = true;
      btnElement.innerHTML = '⏳...';
    }

    try {
      const maGian = await getCurrentMaGian();
      const isNeg = Boolean(item.isNegative || (Number(item.amount) < 0) || (Number(item.doanhThu) < 0) || String(item.rawAmount || '').includes('-'));
      const positiveItem = {
        ...item,
        isNegative: isNeg,
        rawAmount: item.rawAmount || "",
        tienSanPham: Math.abs(Number(item.tienSanPham) || 0),
        phiVanChuyen: Math.abs(Number(item.phiVanChuyen) || 0),
        phuPhi: Math.abs(Number(item.phuPhi) || 0),
        thue: Math.abs(Number(item.thue) || 0),
        doanhThu: Math.abs(Number(item.amount || item.doanhThu) || 0),
        amount: Math.abs(Number(item.amount || item.doanhThu) || 0)
      };

      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: "UPDATE_DH_INCOME_FINANCIALS",
          items: [positiveItem],
          maGian
        }, resolve);
      });

      if (!response?.ok) {
        throw new Error(response?.error || response?.message || "Không cập nhật được.");
      }

      // NẾU ĐƠN CHƯA CÓ TRONG SHEET DH -> MỞ LINK ĐƠN HÀNG TRONG TAB MỚI
      const isMatched = response.matchedCount > 0 && response.matchedOrders && response.matchedOrders.length > 0;
      if (!isMatched) {
        const saleLink = item.orderLink || `https://banhang.shopee.vn/portal/sale/order/${orderId}`;
        window.open(saleLink, '_blank');
        
        syncedOrdersMap.set(orderId.toLowerCase(), '🌐 Đã mở link');
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = '🌐 Đã mở link';
          btnElement.style.background = '#d97706';
        }
        setStatus(`⚠️ Đơn <b>${escapeHtml(orderId)}</b> chưa có trong Sheet DH -> <b>Đã mở link chi tiết đơn</b> để bạn kiểm tra & lưu!`);
        return;
      }

      const rowNums = (response.rowNums || []).join(", ");
      const isConflict = response.conflictCount > 0 || (response.conflictedOrders && response.conflictedOrders.map(o => String(o).toLowerCase()).includes(orderId.toLowerCase()));
      if (isConflict) {
        syncedOrdersMap.set(orderId.toLowerCase(), `⚠️ Xung đột`);
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = `⚠️ Xung đột`;
          btnElement.style.background = '#d97706';
        }
        setStatus(`⚠️ Đơn <b>${escapeHtml(orderId)}</b> đã có dữ liệu tình trạng trong Sheet DH -> <b>Giữ nguyên tình trạng, ghi 'xung đột' vào cột trạng thái</b> (Dòng ${rowNums})!`);
      } else {
        syncedOrdersMap.set(orderId.toLowerCase(), `✓ Dòng ${rowNums || 'OK'}`);
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = `✓ Dòng ${rowNums || 'OK'}`;
          btnElement.style.background = '#15803d';
        }
        setStatus(`✅ Đã cập nhật đơn <b>${escapeHtml(orderId)}</b> vào dòng <b>${rowNums}</b> trong Sheet DH!`);
      }
    } catch (err) {
      alert("Lỗi cập nhật: " + err.message);
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = '☁️ Thử lại';
        btnElement.style.background = '#dc2626';
      }
    }
  }

  async function syncAllToSheetDh() {
    if (isSyncing || isAutoScanning) return;
    if (!allRows.length) {
      alert("Chưa có dữ liệu đơn hàng. Vui lòng bấm '⚡ Đọc Doanh Thu Shopee' hoặc chạy Tự Động Quét trước.");
      return;
    }

    isSyncing = true;
    if (syncAllDhBtn) {
      syncAllDhBtn.disabled = true;
      syncAllDhBtn.innerHTML = '⏳ Đang cập nhật...';
    }
    setStatus('<span style="color: #059669; font-weight: bold;">⏳ Đang so khớp mã gian & mã đơn để cập nhật vào Sheet DH...</span>');

    try {
      const maGian = await getCurrentMaGian();
      const positiveItems = allRows.map(r => {
        const isNeg = Boolean(r.isNegative || (Number(r.amount) < 0) || (Number(r.doanhThu) < 0) || String(r.rawAmount || '').includes('-'));
        return {
          ...r,
          isNegative: isNeg,
          rawAmount: r.rawAmount || "",
          tienSanPham: Math.abs(Number(r.tienSanPham) || 0),
          phiVanChuyen: Math.abs(Number(r.phiVanChuyen) || 0),
          phuPhi: Math.abs(Number(r.phuPhi) || 0),
          thue: Math.abs(Number(r.thue) || 0),
          doanhThu: Math.abs(Number(r.amount || r.doanhThu) || 0),
          amount: Math.abs(Number(r.amount || r.doanhThu) || 0)
        };
      });

      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: "UPDATE_DH_INCOME_FINANCIALS",
          items: positiveItems,
          maGian
        }, resolve);
      });

      if (!response?.ok) {
        throw new Error(response?.error || response?.message || "Không cập nhật được vào Sheet DH.");
      }

      if (response.matchedOrders && Array.isArray(response.matchedOrders)) {
        const conflictSet = new Set((response.conflictedOrders || []).map(o => String(o).toLowerCase()));
        response.matchedOrders.forEach(ordId => {
          if (conflictSet.has(ordId.toLowerCase())) {
            syncedOrdersMap.set(ordId.toLowerCase(), "⚠️ Xung đột");
          } else {
            syncedOrdersMap.set(ordId.toLowerCase(), "✓ Đã cập nhật");
          }
        });
      }

      const unmatched = response.unmatchedOrders || [];
      if (unmatched.length > 0) {
        unmatched.forEach(ordId => {
          syncedOrdersMap.set(ordId.toLowerCase(), "⚠️ Chưa có");
        });
      }

      renderTable();
      setStatus(`✅ ${response.message}${unmatched.length > 0 ? ` (Có ${unmatched.length} đơn chưa có trong Sheet)` : ''}`);

      // Nếu có đơn chưa có trong Sheet DH, hỏi người dùng có muốn mở link các đơn này không
      if (unmatched.length > 0) {
        const confirmOpen = confirm(`Đã cập nhật xong các đơn trùng khớp.\nCó ${unmatched.length} đơn CHƯA CÓ trong Sheet DH.\n\nBạn có muốn tự động mở link các đơn này để xem & lưu không?`);
        if (confirmOpen) {
          const toOpen = unmatched.slice(0, 10);
          toOpen.forEach(ordId => {
            const item = allRows.find(r => (r.orderId || "").toLowerCase() === ordId.toLowerCase());
            const url = item?.orderLink || `https://banhang.shopee.vn/portal/sale/order/${ordId}`;
            window.open(url, '_blank');
          });
          if (unmatched.length > 10) {
            alert(`Đã mở 10 đơn đầu tiên trong tab mới (để tránh quá tải trình duyệt).`);
          }
        }
      }

      if (syncAllDhBtn) {
        syncAllDhBtn.innerHTML = `✓ Đã cập nhật (${response.matchedCount} dòng)`;
        setTimeout(() => {
          syncAllDhBtn.innerHTML = '☁️ Cập Nhật Tất Cả Lên Sheet ĐH';
          syncAllDhBtn.disabled = false;
        }, 3000);
      }
    } catch (err) {
      console.error(err);
      setStatus(`❌ Lỗi cập nhật Sheet DH: ${err.message}`, true);
      if (syncAllDhBtn) {
        syncAllDhBtn.disabled = false;
        syncAllDhBtn.innerHTML = '☁️ Cập Nhật Tất Cả Lên Sheet ĐH';
      }
    } finally {
      isSyncing = false;
    }
  }

  function updateStats() {
    if (!statsEl) return;
    if (allRows.length === 0) {
      statsEl.innerHTML = '';
      return;
    }

    const totalCount = allRows.length;
    let sumTienSP = 0;
    let sumPhiVC = 0;
    let sumPhuPhi = 0;
    let sumThue = 0;
    let sumDoanhThu = 0;

    allRows.forEach(r => {
      sumTienSP += Number(r.tienSanPham) || 0;
      sumPhiVC += Number(r.phiVanChuyen) || 0;
      sumPhuPhi += Number(r.phuPhi) || 0;
      sumThue += Number(r.thue) || 0;
      sumDoanhThu += Number(r.amount || r.doanhThu) || 0;
    });

    statsEl.innerHTML = `
      <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Số đơn: ${totalCount}</span>
      <span style="background: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 12px; font-weight: bold;" title="Tổng doanh thu thực nhận">Doanh thu: ${formatMoneyVND(sumDoanhThu)}</span>
      <span style="background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 12px; font-size: 10px;" title="Tổng tiền sản phẩm">Tiền SP: ${formatMoneyVND(sumTienSP)}</span>
      <span style="background: #fef2f2; color: #dc2626; padding: 2px 6px; border-radius: 12px; font-size: 10px;" title="Tổng phụ phí (sàn, dịch vụ,...)">Phụ phí: ${formatMoneyVND(sumPhuPhi)}</span>
      <span style="background: #fef2f2; color: #b91c1c; padding: 2px 6px; border-radius: 12px; font-size: 10px;" title="Tổng thuế">Thuế: ${formatMoneyVND(sumThue)}</span>
    `;
  }

  function renderTable() {
    if (!tbody) return;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const tokens = query.split(/\s+/).filter(Boolean);

    let filtered = allRows.filter(r => {
      if (tokens.length > 0) {
        const fullSearchStr = `${r.orderId || ''} ${r.buyer || ''} ${r.orderLink || ''} ${r.date || ''} ${r.status || ''} ${r.paymentMethod || ''} ${r.tienSanPham || ''} ${r.phuPhi || ''} ${r.thue || ''} ${r.doanhThu || ''} ${r.amount || ''}`.toLowerCase();
        return tokens.every(token => fullSearchStr.includes(token));
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #64748b;">Chưa có dữ liệu hoặc không có dòng nào phù hợp với tìm kiếm.</td></tr>';
      return;
    }

    let html = '';
    filtered.forEach((row, idx) => {
      const isNeg = (row.amount || row.doanhThu || 0) < 0;
      const amountColor = isNeg ? '#dc2626' : '#059669';
      const amountBg = isNeg ? '#fef2f2' : '#f0fdf4';

      const saleLink = row.orderLink || `https://banhang.shopee.vn/portal/sale/order/${row.orderId || ''}`;
      const saleIdMatch = saleLink.match(/\/portal\/sale\/(\d+)/);
      const saleLabel = saleIdMatch ? `Đơn ${saleIdMatch[1]}` : (row.orderId ? `Đơn ${row.orderId}` : 'Mở đơn');

      const syncedStatus = syncedOrdersMap.get((row.orderId || "").toLowerCase());
      const syncBtnText = syncedStatus || "☁️ Cập nhật";
      let syncBtnBg = "#059669";
      if (syncedStatus) {
        if (syncedStatus.includes("Xung đột")) {
          syncBtnBg = "#d97706";
        } else if (syncedStatus.includes("Chưa có") || syncedStatus.includes("Thử lại")) {
          syncBtnBg = "#dc2626";
        } else {
          syncBtnBg = "#15803d";
        }
      }

      html += `
        <tr style="border-top: 1px solid #f1f5f9; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6px 4px; text-align: center; color: #64748b; font-weight: 600;">${idx + 1}</td>
          <td style="padding: 6px 4px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              ${row.imgUrl ? `<img src="${escapeHtml(row.imgUrl)}" style="width: 22px; height: 22px; border-radius: 4px; object-fit: cover; border: 1px solid #e2e8f0; flex-shrink: 0;">` : ''}
              <div>
                <div style="display: flex; align-items: center; gap: 2px;">
                  <span style="font-weight: bold; color: #1e293b; font-family: monospace; font-size: 10px;">${escapeHtml(row.orderId)}</span>
                  <button type="button" class="btn-dt-copy-order" data-order="${escapeHtml(row.orderId)}" style="background: none; border: none; cursor: pointer; padding: 0; font-size: 10px;" title="Copy mã đơn">📋</button>
                </div>
                ${row.buyer ? `<div style="font-size: 9px; color: #64748b;">${escapeHtml(row.buyer)}</div>` : ''}
              </div>
            </div>
          </td>
          <td style="padding: 6px 4px;">
            <div style="display: flex; align-items: center; gap: 2px;">
              <a href="${saleLink}" target="_blank" style="display: inline-flex; align-items: center; background: #fff1f0; color: #ee4d2d; border: 1px solid #ffccc7; border-radius: 4px; padding: 1px 4px; font-size: 9px; font-weight: bold; text-decoration: none;" title="${escapeHtml(saleLink)}">
                🔗 ${escapeHtml(saleLabel)} ↗
              </a>
              <button type="button" class="btn-dt-copy-link" data-link="${escapeHtml(saleLink)}" style="background: none; border: none; cursor: pointer; padding: 0; font-size: 10px;" title="Copy link đơn hàng">📋</button>
            </div>
          </td>
          <td style="padding: 6px 4px; color: #475569; font-size: 10px; white-space: nowrap;">
            ${escapeHtml(row.date)}
          </td>
          <td style="padding: 6px 4px; text-align: right; color: #1e293b; font-size: 10px; font-family: monospace;">
            ${formatMoneyVND(row.tienSanPham)}
          </td>
          <td style="padding: 6px 4px; text-align: right; color: #475569; font-size: 10px; font-family: monospace;">
            ${formatMoneyVND(row.phiVanChuyen)}
          </td>
          <td style="padding: 6px 4px; text-align: right; color: #dc2626; font-size: 10px; font-family: monospace; background-color: #fff5f5;">
            ${formatMoneyVND(row.phuPhi)}
          </td>
          <td style="padding: 6px 4px; text-align: right; color: #b91c1c; font-size: 10px; font-family: monospace; background-color: #fff5f5;">
            ${formatMoneyVND(row.thue)}
          </td>
          <td style="padding: 6px 4px; text-align: right; background-color: ${amountBg};">
            <b style="color: ${amountColor}; font-size: 11px; font-family: monospace;">${formatMoneyVND(row.amount || row.doanhThu)}</b>
          </td>
          <td style="padding: 6px 4px; text-align: center;">
            <button type="button" class="btn-dt-sync-single" data-order="${escapeHtml(row.orderId)}" style="background: ${syncBtnBg}; color: white; border: none; border-radius: 4px; padding: 3px 6px; font-size: 9px; font-weight: bold; cursor: pointer; white-space: nowrap;" title="Cập nhật đơn này vào Sheet Đơn Hàng">${escapeHtml(syncBtnText)}</button>
          </td>
          <td style="padding: 6px 4px; font-size: 9px;">
            <span style="background: #ecfdf5; color: #047857; padding: 1px 4px; border-radius: 4px; font-weight: 500; font-size: 8px;">${escapeHtml(row.status)}</span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Gắn sự kiện cập nhật đơn lẻ
    tbody.querySelectorAll('.btn-dt-sync-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const orderId = btn.getAttribute('data-order');
        if (orderId) {
          syncSingleToSheetDh(orderId, btn);
        }
      });
    });

    // Gắn sự kiện copy mã đơn
    tbody.querySelectorAll('.btn-dt-copy-order').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const orderId = btn.getAttribute('data-order');
        if (orderId) {
          navigator.clipboard.writeText(orderId).then(() => {
            const orig = btn.innerText;
            btn.innerText = '✓';
            setTimeout(() => { btn.innerText = orig; }, 1000);
          });
        }
      });
    });

    // Gắn sự kiện copy link đơn hàng
    tbody.querySelectorAll('.btn-dt-copy-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const link = btn.getAttribute('data-link');
        if (link) {
          navigator.clipboard.writeText(link).then(() => {
            const orig = btn.innerText;
            btn.innerText = '✓';
            setTimeout(() => { btn.innerText = orig; }, 1000);
          });
        }
      });
    });
  }

  function copyTableToTsv() {
    if (!allRows.length) {
      alert("Chưa có dữ liệu để copy. Vui lòng bấm 'Đọc Doanh Thu Shopee' hoặc chạy Tự Động Quét trước.");
      return;
    }

    const headers = [
      "STT",
      "Mã đơn hàng",
      "Link đơn hàng",
      "Người mua",
      "Ngày chuyển",
      "Tổng tiền sản phẩm",
      "Tổng phí vận chuyển",
      "Phụ phí",
      "Thuế",
      "Doanh thu đơn hàng",
      "Trạng thái",
      "Phương thức thanh toán"
    ];
    const lines = [headers.join("\t")];

    allRows.forEach((row, idx) => {
      lines.push([
        idx + 1,
        row.orderId || "",
        row.orderLink || "",
        row.buyer || "",
        row.date || "",
        formatMoneyVND(row.tienSanPham),
        formatMoneyVND(row.phiVanChuyen),
        formatMoneyVND(row.phuPhi),
        formatMoneyVND(row.thue),
        formatMoneyVND(row.amount || row.doanhThu),
        row.status || "",
        row.paymentMethod || ""
      ].join("\t"));
    });

    const tsvContent = lines.join("\r\n");
    navigator.clipboard.writeText(tsvContent).then(() => {
      setStatus(`📋 <b style="color:#16a34a;">Đã copy ${allRows.length} dòng vào Clipboard!</b> Bạn có thể dán (Ctrl+V) vào Google Sheets hoặc Excel.`);
    }).catch(err => {
      alert("Lỗi khi copy: " + err.message);
    });
  }

  function exportToExcel() {
    if (!allRows.length) {
      alert("Chưa có dữ liệu để xuất Excel. Vui lòng bấm 'Đọc Doanh Thu Shopee' hoặc chạy Tự Động Quét trước.");
      return;
    }

    if (typeof XLSX === "undefined") {
      alert("Thư viện XLSX chưa sẵn sàng. Vui lòng thử lại sau vài giây.");
      return;
    }

    const headers = [
      "STT",
      "Mã đơn hàng",
      "Link đơn hàng",
      "Người mua",
      "Ngày chuyển",
      "Tổng tiền sản phẩm (Số)",
      "Tổng phí vận chuyển (Số)",
      "Phụ phí (Số)",
      "Thuế (Số)",
      "Doanh thu đơn hàng (Số)",
      "Trạng thái",
      "Phương thức thanh toán"
    ];
    const data = [headers];

    allRows.forEach((row, idx) => {
      data.push([
        idx + 1,
        row.orderId || "",
        row.orderLink || "",
        row.buyer || "",
        row.date || "",
        Number(row.tienSanPham) || 0,
        Number(row.phiVanChuyen) || 0,
        Number(row.phuPhi) || 0,
        Number(row.thue) || 0,
        Number(row.amount || row.doanhThu) || 0,
        row.status || "",
        row.paymentMethod || ""
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DoanhThu_ChiTiet");

    const now = new Date();
    const dateStr = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + "_" +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');

    XLSX.writeFile(wb, `DoanhThu_ChiTiet_Shopee_${dateStr}.xlsx`);
    setStatus(`📊 <b style="color:#16a34a;">Đã xuất file DoanhThu_ChiTiet_Shopee_${dateStr}.xlsx thành công!</b>`);
  }
})();

