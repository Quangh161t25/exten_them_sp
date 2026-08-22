(function () {
  const tabBtn = document.querySelector('.tab-btn[data-tab="tab-doanh-thu"]');
  const readBtn = document.getElementById('btn-dt-read');
  const copyTsvBtn = document.getElementById('btn-dt-copy-tsv');
  const exportExcelBtn = document.getElementById('btn-dt-export-excel');
  const clearBtn = document.getElementById('btn-dt-clear');
  const searchInput = document.getElementById('dt-search-input');
  const statusEl = document.getElementById('dt-status');
  const statsEl = document.getElementById('dt-stats');
  const tbody = document.getElementById('dt-tbody');

  let allRows = [];
  let isReading = false;

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
    const isNeg = val < 0;
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString('vi-VN');
    return isNeg ? `-${formatted} đ` : `${formatted} đ`;
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

  if (readBtn) {
    readBtn.addEventListener('click', () => {
      readDoanhThuData(false);
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
  // ĐỌC DỮ LIỆU TỪ TRANG SHOPEE FINANCE (TỰ ĐỘNG CHỌN 50 + MỞ RỘNG TẤT CẢ LINK)
  // =========================================================================
  async function readDoanhThuData(isAuto = false) {
    if (isReading) return;
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

      setStatus('<span style="color: #ee4d2d; font-weight: bold;">⏳ Đang chuyển 50 đơn/trang & mở rộng toàn bộ để lấy Link đơn hàng...</span>');

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: async () => {
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

          // 2. CLICK CHÍNH XÁC VÀO THẺ SỐ TIỀN (.transaction-amount) ĐỂ MỞ RỘNG
          const triggerClickAmount = (el) => {
            if (!el || el.tagName === 'A' || el.closest('a')) return;
            const opts = { bubbles: true, cancelable: true, view: window };
            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            if (typeof el.click === 'function' && el.tagName !== 'A') el.click();
          };

          try {
            const amountEls = Array.from(document.querySelectorAll('.grid-table-body .transaction-amount, .transaction-table .transaction-amount, [class*="transaction-amount"]'));
            amountEls.forEach(amountDiv => {
              triggerClickAmount(amountDiv);
            });

            // Chờ 800ms để toàn bộ các chi tiết đơn hàng mở rộng và render xong vào DOM
            await new Promise(r => setTimeout(r, 800));
          } catch (e) {
            console.warn("Lỗi khi mở rộng số tiền:", e);
          }

          // 3. Quét tất cả các dòng giao dịch trong bảng
          const rowElements = Array.from(document.querySelectorAll('.grid-table.transaction-table .grid-table-body .grid-table-row, .transaction-table .grid-table-body .grid-table-row, .grid-table-body .grid-table-row'));
          
          if (rowElements.length === 0) {
            return { ok: false, message: "Không tìm thấy dòng giao dịch nào trong bảng." };
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
            
            const isNegative = rawAmount.includes('-');
            const digits = rawAmount.replace(/[^0-9]/g, '');
            const numAmount = digits ? (isNegative ? -parseInt(digits, 10) : parseInt(digits, 10)) : 0;

            // Tìm Link đơn hàng từ nút 'Xem thông tin đơn hàng' (a[href*="/portal/sale/"])
            let orderLink = "";
            
            // Tìm trong chính dòng hoặc next sibling (vùng mở rộng)
            let linkEl = rEl.querySelector('a[href*="/portal/sale/"], a[href*="/portal/sale/order/"]');
            if (!linkEl && rEl.nextElementSibling) {
              linkEl = rEl.nextElementSibling.querySelector('a[href*="/portal/sale/"], a[href*="/portal/sale/order/"]');
            }

            // Tìm trong các popover/popper/modal
            if (!linkEl) {
              const allOpenLinks = Array.from(document.querySelectorAll('a[href*="/portal/sale/"], a[href*="/portal/sale/order/"]'));
              if (allOpenLinks.length > i) {
                linkEl = allOpenLinks[i];
              } else if (allOpenLinks.length > 0) {
                linkEl = allOpenLinks[allOpenLinks.length - 1];
              }
            }

            if (linkEl) {
              const href = linkEl.getAttribute('href') || "";
              if (href) {
                orderLink = href.startsWith('http') ? href : `https://banhang.shopee.vn${href}`;
              }
            }

            // Fallback nếu không có link sale: dùng mã đơn hàng
            if (!orderLink && orderId) {
              orderLink = `https://banhang.shopee.vn/portal/sale/order/${orderId}`;
            }

            if (orderId || rawAmount) {
              extractedRows.push({
                orderId,
                buyer,
                imgUrl,
                orderLink,
                date: dateStr,
                status: statusStr,
                paymentMethod: methodStr,
                rawAmount,
                amount: numAmount
              });
            }
          }

          return { ok: true, rows: extractedRows, url: window.location.href };
        }
      });

      if (result && result.result && result.result.ok) {
        allRows = result.result.rows || [];
        chrome.storage.local.set({ doanh_thu_cache_data: allRows });
        updateStats();
        renderTable();
        const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setStatus(`✅ <b>Thành công:</b> Đã đọc <b>${allRows.length}</b> giao dịch (kèm Link đơn hàng) lúc ${now}.`);
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

  function updateStats() {
    if (!statsEl) return;
    if (allRows.length === 0) {
      statsEl.innerHTML = '';
      return;
    }

    const totalCount = allRows.length;
    let totalPositive = 0;
    let totalNegative = 0;
    let netTotal = 0;

    allRows.forEach(r => {
      const val = Number(r.amount) || 0;
      netTotal += val;
      if (val > 0) totalPositive += val;
      else if (val < 0) totalNegative += val;
    });

    statsEl.innerHTML = `
      <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Số đơn: ${totalCount}</span>
      <span style="background: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 12px; font-weight: bold;" title="Tổng doanh thu thực nhận">Thực nhận: ${formatMoneyVND(netTotal)}</span>
      <span style="background: #f0fdf4; color: #15803d; padding: 2px 8px; border-radius: 12px; font-size: 10px;" title="Tổng tiền dương">+${totalPositive.toLocaleString('vi-VN')}₫</span>
      ${totalNegative < 0 ? `<span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 10px;" title="Tổng trừ / hoàn tiền">${totalNegative.toLocaleString('vi-VN')}₫</span>` : ''}
    `;
  }

  function renderTable() {
    if (!tbody) return;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const tokens = query.split(/\s+/).filter(Boolean);

    let filtered = allRows.filter(r => {
      if (tokens.length > 0) {
        const fullSearchStr = `${r.orderId || ''} ${r.buyer || ''} ${r.orderLink || ''} ${r.date || ''} ${r.status || ''} ${r.paymentMethod || ''} ${r.rawAmount || ''} ${r.amount || ''}`.toLowerCase();
        return tokens.every(token => fullSearchStr.includes(token));
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">Chưa có dữ liệu hoặc không có dòng nào phù hợp với tìm kiếm.</td></tr>';
      return;
    }

    let html = '';
    filtered.forEach((row, idx) => {
      const isNeg = (row.amount || 0) < 0;
      const amountColor = isNeg ? '#dc2626' : '#059669';
      const amountBg = isNeg ? '#fef2f2' : '#f0fdf4';

      const saleLink = row.orderLink || `https://banhang.shopee.vn/portal/sale/order/${row.orderId || ''}`;
      const saleIdMatch = saleLink.match(/\/portal\/sale\/(\d+)/);
      const saleLabel = saleIdMatch ? `Đơn ${saleIdMatch[1]}` : (row.orderId ? `Đơn ${row.orderId}` : 'Mở đơn');

      html += `
        <tr style="border-top: 1px solid #f1f5f9; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6px 4px; text-align: center; color: #64748b; font-weight: 600;">${idx + 1}</td>
          <td style="padding: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              ${row.imgUrl ? `<img src="${escapeHtml(row.imgUrl)}" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid #e2e8f0; flex-shrink: 0;">` : ''}
              <div>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="font-weight: bold; color: #1e293b; font-family: monospace; font-size: 11px;">${escapeHtml(row.orderId)}</span>
                  <button type="button" class="btn-dt-copy-order" data-order="${escapeHtml(row.orderId)}" style="background: none; border: none; cursor: pointer; padding: 0; font-size: 11px;" title="Copy mã đơn">📋</button>
                </div>
                ${row.buyer ? `<div style="font-size: 10px; color: #64748b;">Người mua: <b style="color: #334155;">${escapeHtml(row.buyer)}</b></div>` : ''}
              </div>
            </div>
          </td>
          <td style="padding: 6px;">
            <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
              <a href="${saleLink}" target="_blank" style="display: inline-flex; align-items: center; gap: 2px; background: #fff1f0; color: #ee4d2d; border: 1px solid #ffccc7; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; text-decoration: none;" title="${escapeHtml(saleLink)}">
                🔗 ${escapeHtml(saleLabel)} ↗
              </a>
              <button type="button" class="btn-dt-copy-link" data-link="${escapeHtml(saleLink)}" style="background: none; border: none; cursor: pointer; padding: 0; font-size: 11px;" title="Copy link đơn hàng">📋</button>
            </div>
          </td>
          <td style="padding: 6px; color: #475569; font-size: 11px; white-space: nowrap;">
            ${escapeHtml(row.date)}
          </td>
          <td style="padding: 6px; font-size: 11px;">
            <span style="background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 10px;">${escapeHtml(row.status)}</span>
          </td>
          <td style="padding: 6px; color: #334155; font-size: 11px;">
            ${escapeHtml(row.paymentMethod)}
          </td>
          <td style="padding: 6px; text-align: right; background-color: ${amountBg};">
            <b style="color: ${amountColor}; font-size: 12px; font-family: monospace;">${formatMoneyVND(row.amount)}</b>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

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
      alert("Chưa có dữ liệu để copy. Vui lòng bấm 'Đọc Doanh Thu Shopee' trước.");
      return;
    }

    const headers = ["STT", "Mã đơn hàng", "Link đơn hàng", "Người mua", "Ngày chuyển", "Trạng thái", "Phương thức thanh toán", "Số tiền thanh toán", "Số tiền (số)"];
    const lines = [headers.join("\t")];

    allRows.forEach((row, idx) => {
      lines.push([
        idx + 1,
        row.orderId || "",
        row.orderLink || "",
        row.buyer || "",
        row.date || "",
        row.status || "",
        row.paymentMethod || "",
        formatMoneyVND(row.amount),
        row.amount || 0
      ].join("\t"));
    });

    const tsvContent = lines.join("\r\n");
    navigator.clipboard.writeText(tsvContent).then(() => {
      setStatus(`📋 <b style="color:#16a34a;">Đã copy ${allRows.length} dòng (kèm Link đơn) dạng TSV vào Clipboard!</b> Bạn có thể dán (Ctrl+V) vào Google Sheets hoặc Excel.`);
    }).catch(err => {
      alert("Lỗi khi copy: " + err.message);
    });
  }

  function exportToExcel() {
    if (!allRows.length) {
      alert("Chưa có dữ liệu để xuất Excel. Vui lòng bấm 'Đọc Doanh Thu Shopee' trước.");
      return;
    }

    if (typeof XLSX === "undefined") {
      alert("Thư viện XLSX chưa sẵn sàng. Vui lòng thử lại sau vài giây.");
      return;
    }

    const headers = ["STT", "Mã đơn hàng", "Link đơn hàng", "Người mua", "Ngày chuyển", "Trạng thái", "Phương thức thanh toán", "Số tiền thanh toán", "Số tiền (số)"];
    const data = [headers];

    allRows.forEach((row, idx) => {
      data.push([
        idx + 1,
        row.orderId || "",
        row.orderLink || "",
        row.buyer || "",
        row.date || "",
        row.status || "",
        row.paymentMethod || "",
        formatMoneyVND(row.amount),
        Number(row.amount) || 0
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DoanhThu_Shopee");

    const now = new Date();
    const dateStr = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + "_" +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');

    XLSX.writeFile(wb, `DoanhThu_Shopee_${dateStr}.xlsx`);
    setStatus(`📊 <b style="color:#16a34a;">Đã xuất file DoanhThu_Shopee_${dateStr}.xlsx thành công!</b>`);
  }
})();
