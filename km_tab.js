(function () {
  // DOM Elements
  const readBtn = document.getElementById('btn-km-read');
  const injectSkuBtn = document.getElementById('btn-km-inject-sku');
  const copyTsvBtn = document.getElementById('btn-km-copy-tsv');
  const exportExcelBtn = document.getElementById('btn-km-export-excel');
  const clearBtn = document.getElementById('btn-km-clear');
  const saveSheetBtn = document.getElementById('btn-km-save-sheet');
  const searchInput = document.getElementById('km-search-input');
  const statusEl = document.getElementById('km-status');
  const statsEl = document.getElementById('km-stats');
  const tbody = document.getElementById('km-tbody');
  const sheetGroupInput = document.getElementById('km-sheet-group-name');
  const saveGroupSection = document.getElementById('km-save-group-section');

  let allRows = [];
  let currentTabId = null;
  let lastScrapedFingerprint = "";
  let isScrapingInProgress = false;

  function isShopeePromotionUrl(url) {
    if (!url) return false;
    const cleanUrl = url.toLowerCase();
    return (
      (cleanUrl.includes("shopee.vn") || cleanUrl.includes("banhang.shopee.vn") || cleanUrl.includes("seller.shopee.vn")) &&
      (cleanUrl.includes("/portal/marketing/") || cleanUrl.includes("/portal/sale/") || cleanUrl.includes("discount") || cleanUrl.includes("flashsale") || cleanUrl.includes("promotion") || cleanUrl.includes("bundle") || cleanUrl.includes("add-on-deal") || cleanUrl.includes("voucher") || cleanUrl.includes("/datacenter/"))
    );
  }

  function getItemsFingerprint(items) {
    if (!items || !items.length) return "";
    return items.map(it => `${it.name}||${it.variationName}||${it.originalPrice}||${it.discountPrice}||${it.stock}`).join("@@");
  }

  // Load cached data from chrome.storage.local immediately on startup
  chrome.storage.local.get(['km_scanned_rows'], (res) => {
    if (res && res.km_scanned_rows && Array.isArray(res.km_scanned_rows) && res.km_scanned_rows.length > 0) {
      allRows = res.km_scanned_rows;
      updateStats();
      renderTable();
      if (saveGroupSection) saveGroupSection.style.display = 'block';

      getActiveTab().then(tab => {
        if (tab && tab.id) {
          injectSkusIntoShopeePage(tab.id, allRows);
        }
      });
    }

    // Tự động kiểm tra link & bắt đầu đọc realtime
    setTimeout(() => {
      autoSyncRealtime(true);
    }, 400);
  });

  // Event Listeners
  if (readBtn) {
    readBtn.addEventListener('click', () => {
      readPromotionData(false, true);
    });
  }

  if (injectSkuBtn) {
    injectSkuBtn.addEventListener('click', async () => {
      if (allRows.length === 0) {
        alert("Chưa có dữ liệu. Vui lòng bấm '⚡ Đọc KM từ Shopee' trước!");
        return;
      }
      const tab = await getActiveTab();
      if (tab && tab.id) {
        await injectSkusIntoShopeePage(tab.id, allRows);
        setStatus(`📌 Đã chèn nhãn SKU trực tiếp vào dưới tên các phân loại trên trang Shopee.`);
      } else {
        alert("Không tìm thấy tab Shopee đang mở!");
      }
    });
  }
      if (tab && tab.id) {
        await injectSkusIntoShopeePage(tab.id, allRows);
        setStatus(`📌 Đã chèn nhãn SKU trực tiếp vào dưới tên các phân loại trên trang Shopee.`);
      } else {
        alert("Không tìm thấy tab Shopee đang mở!");
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderTable();
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
      if (allRows.length > 0 && confirm("Bạn có chắc muốn xóa danh sách khuyến mãi đang lưu không?")) {
        allRows = [];
        chrome.storage.local.remove(['km_scanned_rows']);
        updateStats();
        renderTable();
        setStatus("Đã xóa dữ liệu bảng KM.");
        if (saveGroupSection) saveGroupSection.style.display = 'none';

        // Clear injected badges on web
        getActiveTab().then(tab => {
          if (tab && tab.id) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                document.querySelectorAll('.ext-km-injected-sku').forEach(el => el.remove());
              }
            }).catch(() => {});
          }
        });
      }
    });
  }

  if (saveSheetBtn) {
    saveSheetBtn.addEventListener('click', () => {
      saveToSheet();
    });
  }

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.innerHTML = msg;
    statusEl.style.color = isError ? '#ef4444' : '#1e293b';
  }

  function cleanString(str) {
    if (!str) return "";
    return String(str)
      .normalize("NFC")
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\.\.\.$/, '')
      .replace(/\u2026$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findSkuForShopeeVariation(pName, vName, spRows, currentMaGian) {
    if (!spRows || spRows.length <= 1) return "";
    const cleanStr = (val) => {
      if (!val) return "";
      return String(val).normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\.\.\.$/, '').replace(/\u2026$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
    };
    const cleanP = cleanStr(pName);
    const cleanV = cleanStr(vName);
    if (!cleanV && !cleanP) return "";

    const headers = spRows[0].map(v => cleanStr(v));
    let pIdx = headers.findIndex(col => col.includes('tên sản phẩm') || col === 'ten sp' || col === 'name');
    if (pIdx === -1) pIdx = 1;
    let vIdx = headers.findIndex(col => (col.includes('phân loại') || col.includes('variation')) && !col.includes('mã') && !col.includes('ma'));
    if (vIdx === -1) vIdx = 3;
    let sIdx = headers.findIndex(col => (col === 'sku' || col === 'mã sku' || col === 'sku phân loại') && !col.includes('chi tiết'));
    if (sIdx === -1) sIdx = 5;
    let gIdx = headers.findIndex(col => col === 'gian' || col === 'mã gian' || col === 'ma gian');
    if (gIdx === -1) gIdx = 11;

    const getOverlap = (s1, s2) => {
      if (!s1 || !s2) return 0;
      const w1 = s1.split(' ');
      const w2 = s2.split(' ');
      let overlap = 0;
      for (const w of w1) {
        if (w2.includes(w)) overlap++;
      }
      return overlap;
    };

    let bestMatchSku = "";
    let bestScore = -1;

    for (let i = 1; i < spRows.length; i++) {
      const row = spRows[i];
      const sV = cleanStr(row[vIdx]);
      const sP = cleanStr(row[pIdx]);
      const sG = cleanStr(row[gIdx]);
      const sku = String(row[sIdx] || "").trim();

      if (!sku) continue;

      const gOk = !currentMaGian || (sG === currentMaGian);
      if (!gOk) continue;

      let score = 0;

      // Rule 1: Variation Name
      if (cleanV) {
        if (sV === cleanV) score += 100;
        else if (sV.includes(cleanV) || cleanV.includes(sV)) score += 50;
        else continue; // Variation mismatch, skip
      } else {
        if (!sV || sV === "-") score += 50;
        else score -= 50;
      }

      // Rule 2: Parent Name
      if (cleanP && sP) {
        if (sP === cleanP) score += 1000;
        else if (sP.includes(cleanP) || cleanP.includes(sP)) score += 500;
        else {
          const overlap = getOverlap(cleanP, sP);
          if (overlap > 0) score += overlap * 10;
          else continue; // ZERO overlap in parent names = different product, SKIP
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatchSku = sku;
      }
    }
    return bestMatchSku;
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function readPromotionData(isSilent = false, force = false) {
    if (isScrapingInProgress) return;
    isScrapingInProgress = true;

    if (!isSilent) {
      setStatus('<span style="color: #2563eb;">⏳ Đang đọc dữ liệu Tên, Phân Loại, SKU & Giá từ Shopee...</span>');
      if (tbody && allRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 25px; color: #64748b;"><div style="display: inline-block; width: 16px; height: 16px; border: 2px solid #cbd5e1; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; vertical-align: middle; margin-right: 6px;"></div>Đang quét dữ liệu trên trang Shopee...</td></tr>';
      }
    }

    try {
      const tab = await getActiveTab();
      if (!tab || !tab.id) {
        throw new Error("Không tìm thấy tab trình duyệt đang hoạt động.");
      }
      currentTabId = tab.id;

      if (!isShopeePromotionUrl(tab.url)) {
        throw new Error("Vui lòng mở đúng trang Khuyến Mãi / Giảm Giá Shopee (link có dạng /portal/marketing/...) để đọc dữ liệu.");
      }

      // 1. EXECUTE SCRAPING ON SHOPEE PAGE
      const [scriptResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          const delay = ms => new Promise(r => setTimeout(r, ms));

          const cleanNodeText = (el) => {
            if (!el) return "";
            const clone = el.cloneNode(true);
            clone.querySelectorAll('.eds-popper, .eds-popover__popper, .eds-tooltip__popper, [class*="popper"], [class*="tooltip"], .ext-km-injected-sku').forEach(p => p.remove());
            return (clone.getAttribute('title') || clone.innerText || clone.textContent || "")
              .replace(/[\u200B-\u200D\uFEFF]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
          };

          const parsePrice = (str) => {
            if (!str) return "";
            return String(str).replace(/[^\d]/g, '');
          };

          for (let attempt = 0; attempt < 3; attempt++) {
            let items = [];
            let pIndex = 0;

            // =========================================================================
            // 1. SHOPEE MARKETING / DISCOUNT PAGE
            // =========================================================================
            let productCards = Array.from(document.querySelectorAll('.discount-view-item-component, .discount-item-component, .discount-edit-item-component'));
            const allModelsDirect = Array.from(document.querySelectorAll('.discount-view-item-model-component, .discount-item-model-component, .discount-edit-item-model-component'));

            if (productCards.length > 0 || allModelsDirect.length > 0) {
              if (productCards.length === 0) {
                productCards = [document.body];
              }

              // Hàm đọc tên SP - thử nhiều cách
              const getProductName = (card) => {
                // Cách 1: link sản phẩm
                const linkEl = card.querySelector('a[href*="/portal/product/"]');
                if (linkEl) {
                  const t = (linkEl.getAttribute('title') || linkEl.innerText || "").replace(/\s+/g,' ').trim();
                  if (t && t.length > 1) return t;
                }
                // Cách 2: ellipsis-content trong phần header
                const headerArea = card.querySelector('.discount-view-item-header, .discount-edit-item-header, .item-header, .item-info');
                if (headerArea) {
                  const ec = headerArea.querySelector('.ellipsis-content');
                  if (ec) {
                    const clone = ec.cloneNode(true);
                    clone.querySelectorAll('.eds-popper,.eds-tooltip__popper,.ext-km-injected-sku').forEach(x=>x.remove());
                    const t = (clone.getAttribute('title') || clone.innerText || "").replace(/\s+/g,' ').trim();
                    if (t && t.length > 1) return t;
                  }
                  // innerText của toàn header (bỏ model rows)
                  const headerClone = headerArea.cloneNode(true);
                  headerClone.querySelectorAll('.discount-view-item-model-component,.discount-edit-item-model-component,.discount-item-model-component,.eds-popper,.ext-km-injected-sku').forEach(x=>x.remove());
                  const t2 = (headerClone.innerText || "").replace(/\s+/g,' ').trim();
                  if (t2 && t2.length > 1) return t2;
                }
                // Cách 3: fallback lấy ellipsis-content đầu tiên không thuộc variation
                const allEllipsis = Array.from(card.querySelectorAll('.ellipsis-content.single, .ellipsis-content'));
                for (const el of allEllipsis) {
                  // Đảm bảo không nằm trong dòng model
                  if (!el.closest('.discount-view-item-model-component, .discount-edit-item-model-component, .discount-item-model-component')) {
                    const t = (el.getAttribute('title') || el.innerText || "").replace(/\s+/g,' ').trim();
                    if (t && t.toLowerCase() !== "sản phẩm" && t.length > 1) return t;
                  }
                }
                // Cách 4: title attribute bất kỳ
                const titleEl = card.querySelector('[title]:not(.ext-km-injected-sku)');
                if (titleEl) {
                  const t = titleEl.getAttribute('title').trim();
                  if (t && t.toLowerCase() !== "sản phẩm" && t.length > 1) return t;
                }
                return "";
              };

              // Hàm đọc tên phân loại - theo HTML Shopee thực tế:
              // <div class="ellipsis-content single"> máy bào đá </div>
              const getVariationName = (mEl) => {
                // Cách 1: .ellipsis-content.single (chính xác nhất theo HTML thực tế)
                const singleEl = mEl.querySelector('.ellipsis-content.single');
                if (singleEl) {
                  const t = (singleEl.innerText || singleEl.textContent || "").replace(/\s+/g,' ').trim();
                  if (t) return t;
                }
                // Cách 2: .eds-popover__content (nội dung tooltip = text đầy đủ khi bị cắt ...)
                const tooltipContent = mEl.querySelector('.eds-popover__content');
                if (tooltipContent) {
                  const t = (tooltipContent.innerText || "").replace(/\s+/g,' ').trim();
                  if (t) return t;
                }
                // Cách 3: toàn bộ .ellipsis-content nhưng strip tooltip
                const ecEl = mEl.querySelector('.item-variation .ellipsis-content, .item-content.item-variation .ellipsis-content');
                if (ecEl) {
                  const clone = ecEl.cloneNode(true);
                  clone.querySelectorAll('.eds-popper,.eds-tooltip__popper,[class*="popper"],.ext-km-injected-sku').forEach(x=>x.remove());
                  const t = (clone.innerText || clone.textContent || "").replace(/\s+/g,' ').trim();
                  if (t) return t;
                }
                return "";
              };

              productCards.forEach((card) => {
                const parentName = getProductName(card);
                const models = Array.from(card.querySelectorAll('.discount-view-item-model-component, .discount-item-model-component, .discount-edit-item-model-component'));

                if (models.length > 0) {
                  items.push({
                    rowIndex: pIndex++, isParent: true,
                    name: parentName || "Sản phẩm", variationName: "",
                    sku: "", originalPrice: "", discountPrice: "", stock: ""
                  });

                  models.forEach((mEl) => {
                    const varName = getVariationName(mEl);

                    // ✅ ĐỌC SKU TRỰC TIẾP TỪ BADGE ĐÃ INJECT TRÊN TRANG
                    const badge = mEl.querySelector('.ext-km-injected-sku');
                    const sku = badge ? (badge.getAttribute('data-sku') || "") : "";

                    const priceEl = mEl.querySelector('.item-price');
                    const origPrice = priceEl ? parsePrice(priceEl.innerText) : "";

                    const discPriceEl = mEl.querySelector('.item-discounted-price-after-tax, .item-discounted-price');
                    const discInput = mEl.querySelector('.item-discounted-price input, input.eds-input__input, input');
                    let discPrice = discInput ? parsePrice(discInput.value) : (discPriceEl ? parsePrice(discPriceEl.innerText) : "");

                    const stockEl = mEl.querySelector('.item-stock');
                    const stock = stockEl ? (stockEl.innerText||"").replace(/\s+/g,' ').trim() : "";

                    items.push({
                      rowIndex: pIndex++, isParent: false,
                      name: parentName || "Sản phẩm", variationName: varName,
                      sku: sku, originalPrice: origPrice, discountPrice: discPrice, stock: stock
                    });
                  });
                } else if (card !== document.body) {
                  const priceEl = card.querySelector('.item-price');
                  const origPrice = priceEl ? parsePrice(priceEl.innerText) : "";
                  const discInput = card.querySelector('.item-discounted-price input, input.eds-input__input');
                  const discPriceEl = card.querySelector('.item-discounted-price-after-tax, .item-discounted-price');
                  let discPrice = discInput ? parsePrice(discInput.value) : (discPriceEl ? parsePrice(discPriceEl.innerText) : "");
                  const stockEl = card.querySelector('.item-stock');
                  const stock = stockEl ? (stockEl.innerText||"").replace(/\s+/g,' ').trim() : "";
                  if (parentName || origPrice || discPrice) {
                    items.push({
                      rowIndex: pIndex++, isParent: true,
                      name: parentName || "Sản phẩm", variationName: "-",
                      sku: "", originalPrice: origPrice, discountPrice: discPrice, stock: stock
                    });
                  }
                }
              });

              if (items.length > 0) return { ok: true, items };
            }

            // =========================================================================
            // 2. ANT TABLE (Flash Sale / Promotion Tables)
            // =========================================================================
            const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row, table.ant-table-fixed tbody tr.ant-table-row, .shopee-table__body tr'));
            
            if (rows.length > 0) {
              let currentParentName = "";

              rows.forEach((row, index) => {
                const nameElement = row.querySelector('.product-name, .name-title, [class*="product-name"], [class*="item-name"]');
                let rawText = "";
                if (nameElement) rawText = cleanNodeText(nameElement);
                if (!rawText) {
                  const linkEl = row.querySelector('a[href*="/portal/product/"], a[class*="title"]');
                  if (linkEl) rawText = cleanNodeText(linkEl);
                }

                let isParent = row.classList.contains('ant-table-row-level-0') || row.innerText.includes('Product ID:');

                let sku = "";
                const metaDivs = row.querySelectorAll('.product-meta-info > div, [class*="meta-info"] > div, [class*="sku"]');
                metaDivs.forEach(div => {
                  const divText = div.innerText.trim();
                  if (divText.startsWith('SKU:') || divText.startsWith('Product ID:') || divText.startsWith('Mã phân loại:')) {
                    sku = divText.split(':')[1].trim();
                  }
                });

                const priceTd = row.querySelector('td:nth-child(3), td:nth-child(4), [class*="price"]');
                let originalPrice = priceTd ? parsePrice(priceTd.innerText) : "";

                const discInput = row.querySelector('.ant-input-number-input, input[placeholder*="giá" i]');
                let discPrice = discInput ? parsePrice(discInput.value) : "";

                const stockInput = row.querySelector('input[placeholder*="kho" i], input[placeholder*="Stock" i]');
                let stock = stockInput ? stockInput.value : "";

                if (isParent) {
                  currentParentName = rawText || "Sản phẩm";
                  items.push({
                    rowIndex: index,
                    isParent: true,
                    name: currentParentName,
                    variationName: "",
                    sku: sku,
                    originalPrice: originalPrice,
                    discountPrice: discPrice,
                    stock: stock
                  });
                } else {
                  items.push({
                    rowIndex: index,
                    isParent: false,
                    name: currentParentName || rawText,
                    variationName: rawText,
                    sku: sku,
                    originalPrice: originalPrice,
                    discountPrice: discPrice,
                    stock: stock
                  });
                }
              });

              if (items.length > 0) return { ok: true, items };
            }

            // =========================================================================
            // 3. VARIATION TABLE ON PRODUCT EDIT PAGE (portal/product/...)
            // =========================================================================
            const leftCells = Array.from(document.querySelectorAll('.variation-model-table-fixed-left .first-variation-cell, .variation-item, .eds-table__row'));
            const nameInput = document.querySelector('input[placeholder*="Tên thương hiệu"], input[placeholder*="tên sản phẩm"], input.eds-input__input');
            const productName = nameInput ? (nameInput.value || nameInput.getAttribute("modelvalue") || "") : (document.querySelector('h1')?.innerText || "");

            if (leftCells.length > 0 && productName) {
              const mainArea = document.querySelector('.variation-model-table-main, .variation-table');
              const priceElements = mainArea ? Array.from(mainArea.querySelectorAll('input[placeholder*="Giá" i], input[placeholder*="giá" i], input[placeholder="₫"]')) : [];
              const skuElements = mainArea ? Array.from(mainArea.querySelectorAll('input[placeholder*="SKU" i], input[placeholder*="sku" i], input[placeholder*="Mã" i]')) : [];

              items.push({
                rowIndex: 0,
                isParent: true,
                name: productName.trim(),
                variationName: "",
                sku: "",
                originalPrice: "",
                discountPrice: "",
                stock: ""
              });

              leftCells.forEach((cell, idx) => {
                const varName = cleanNodeText(cell);
                const varSku = skuElements[idx] ? (skuElements[idx].value || "").trim() : "";
                const varPrice = priceElements[idx] ? parsePrice(priceElements[idx].value) : "";

                items.push({
                  rowIndex: idx + 1,
                  isParent: false,
                  name: productName.trim(),
                  variationName: varName,
                  sku: varSku,
                  originalPrice: varPrice,
                  discountPrice: "",
                  stock: ""
                });
              });

              return { ok: true, items };
            }

            await delay(300);
          }

          return { ok: false, error: "Không tìm thấy danh sách sản phẩm trên trang Shopee. Vui lòng đảm bảo trang đã load xong." };
        }
      });

      if (!scriptResult || !scriptResult.result || !scriptResult.result.ok) {
        throw new Error(scriptResult?.result?.error || "Không thể đọc dữ liệu từ trang Shopee.");
      }

      const scrapedItems = scriptResult.result.items || [];
      if (scrapedItems.length === 0) {
        throw new Error("Không có dòng sản phẩm nào được tìm thấy trên trang.");
      }

      const currentFingerprint = getItemsFingerprint(scrapedItems);
      if (!force && isSilent && currentFingerprint === lastScrapedFingerprint && allRows.length > 0) {
        // Dữ liệu trên web không đổi, không cần render lại làm giật lag
        return;
      }
      lastScrapedFingerprint = currentFingerprint;

      allRows = scrapedItems;
      updateStats();
      renderTable();
      if (saveGroupSection) saveGroupSection.style.display = 'block';

      // 2. MATCH SKU FROM SHEET AND INJECT INTO SHOPEE WEB PAGE
      await matchSkuFromSheetAndInject(scrapedItems, tab.id, isSilent);

    } catch (err) {
      if (!isSilent) {
        console.error(err);
        setStatus(`❌ ${err.message}`, true);
      }
    } finally {
      isScrapingInProgress = false;
    }
  }

  async function matchSkuFromSheetAndInject(items, tabId, isSilent = false) {
    try {
      const storage = await new Promise(resolve => chrome.storage.local.get(["maGian", "dhHoanTextValue", "sp_shopee_cache_data", "ds_sp_cache_data"], resolve));
      const currentMaGian = (storage.maGian || storage.dhHoanTextValue || "").trim().toLowerCase();

      let spRows = storage.sp_shopee_cache_data;
      let dsRows = storage.ds_sp_cache_data;

      // If cache is empty, fetch fresh from Google Sheets
      if (!spRows || !Array.isArray(spRows) || spRows.length === 0) {
        const res = await new Promise(resolve => {
          chrome.runtime.sendMessage({ type: "FETCH_SP_SHOPEE" }, resolve);
        });
        if (res && res.ok && res.values) {
          spRows = res.values;
          chrome.storage.local.set({ sp_shopee_cache_data: spRows });
        }
      }

      if (!dsRows || !Array.isArray(dsRows) || dsRows.length === 0) {
        const resDs = await new Promise(resolve => {
          chrome.runtime.sendMessage({ type: "FETCH_DS_SP" }, resolve);
        });
        if (resDs && resDs.ok && resDs.values) {
          dsRows = resDs.values;
          chrome.storage.local.set({ ds_sp_cache_data: dsRows });
        }
      }

      // Identify column indices in DS_SP
      let dsGiaThapNhatIdx = 6; // Default to Column G
      let dsIdSpIdx = 1; // Default to Column B
      if (dsRows && dsRows.length > 0) {
        const dsHeaders = dsRows[0].map(h => String(h || "").normalize("NFC").trim().toLowerCase());
        
        // id_sp
        const idCol = dsHeaders.findIndex(h => h === "id_sp" || h === "id sp" || h === "id_sp_ct");
        if (idCol !== -1) dsIdSpIdx = idCol;
        
        // gia_thap_nhat
        const giaCol = dsHeaders.findIndex(h => h === "gia_thap_nhat" || h === "gia thap nhat" || h.includes("thấp nhất") || h.includes("giá min"));
        if (giaCol !== -1) dsGiaThapNhatIdx = giaCol;
      }

      items.forEach(item => {
        if (!item.isParent && !item.sku && spRows && spRows.length > 0) {
          item.sku = findSkuForShopeeVariation(item.name, item.variationName, spRows, currentMaGian);
        }
        // Match gia_thap_nhat based on 4-char prefix of SKU
        if (!item.isParent && item.sku && dsRows && dsRows.length > 1 && dsGiaThapNhatIdx !== -1) {
          const skuPrefix = String(item.sku).trim().substring(0, 4).toUpperCase();
          const matchRows = dsRows.filter((r, idx) => idx > 0 && String(r[dsIdSpIdx] || "").trim().toUpperCase() === skuPrefix);
          
          if (matchRows.length > 0) {
            let minPrice = null;
            for (const r of matchRows) {
              const rawVal = r[dsGiaThapNhatIdx];
              if (rawVal) {
                const numericMatch = parseInt(String(rawVal).replace(/[^\d]/g, ''), 10);
                if (!isNaN(numericMatch) && numericMatch > 0) {
                  if (minPrice === null || numericMatch < minPrice) {
                    minPrice = numericMatch;
                  }
                }
              }
            }
            if (minPrice !== null) {
              item.lowestPrice = minPrice;
            }
          }
        }
      });

      allRows = items;
      chrome.storage.local.set({ km_scanned_rows: allRows });
      updateStats();
      renderTable();

      // 3. INJECT SKU BADGE DIRECTLY ONTO SHOPEE WEB PAGE
      if (tabId) {
        await injectSkusIntoShopeePage(tabId, allRows);
      }

      const parentCount = allRows.filter(r => r.isParent).length;
      const varCount = allRows.filter(r => !r.isParent).length;
      const skuCount = allRows.filter(r => !r.isParent && r.sku).length;
      const now = new Date().toLocaleTimeString('vi-VN');
      setStatus(`<span style="display:inline-flex; align-items:center; gap:4px; background:#ecfdf5; color:#059669; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">🟢 Realtime ${now}</span> Đã đọc <b>${parentCount}</b> SP, <b>${varCount}</b> phân loại (Đã gắn <b>${skuCount}</b> SKU lên Shopee).`);

    } catch (e) {
      console.warn("Lỗi đối chiếu & chèn SKU:", e);
      chrome.storage.local.set({ km_scanned_rows: allRows });
      renderTable();
    }
  }

  // Chèn nhãn SKU trực tiếp dưới tên phân loại trên trang web Shopee
  async function injectSkusIntoShopeePage(tabId, items) {
    if (!tabId || !items || items.length === 0) return;

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [items],
        func: (productsData) => {
          const cleanString = (val) => {
            if (!val) return "";
            return String(val).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
          };

          const childProducts = (productsData || []).filter(p => !p.isParent);

          // 1. Discount View Model Components (.discount-view-item-model-component)
          const discountModels = Array.from(document.querySelectorAll('.discount-view-item-model-component, .discount-item-model-component, .discount-edit-item-model-component'));
          
          discountModels.forEach((mEl, idx) => {
            const varCell = mEl.querySelector('.item-content.item-variation, .item-variation') || mEl;
            
            // Đọc tên phân loại theo cách mới (ưu tiên .ellipsis-content.single)
            let cleanVar = "";
            if (varCell) {
              const singleEl = varCell.querySelector('.ellipsis-content.single');
              if (singleEl) {
                cleanVar = cleanString(singleEl.innerText || singleEl.textContent || "");
              } else {
                const clone = varCell.cloneNode(true);
                clone.querySelectorAll('.eds-popper, .eds-popover__popper, .eds-tooltip__popper, [class*="popper"], [class*="tooltip"], .ext-km-injected-sku').forEach(p => p.remove());
                cleanVar = cleanString(clone.innerText || clone.textContent || "");
              }
            }

            // Extract Parent Name from surrounding card
            const parentBlock = mEl.closest('.discount-view-item-component, .discount-item-component, .discount-edit-item-component') || mEl.parentElement?.parentElement;
            let cleanParent = "";
            if (parentBlock) {
              const pEl = parentBlock.querySelector('a[href*="/portal/product/"]');
              if (pEl) {
                cleanParent = cleanString(pEl.getAttribute('title') || pEl.innerText || "");
              } else {
                const titleCandidates = Array.from(parentBlock.querySelectorAll('.discount-view-item-header .ellipsis-content.single, .item-header .ellipsis-content, .ellipsis-content.single'));
                for (const hEl of titleCandidates) {
                  const text = (hEl.getAttribute('title') || hEl.innerText || "").replace(/\s+/g, ' ').trim();
                  if (text && text.toLowerCase() !== "sản phẩm" && text.toLowerCase() !== "product" && text !== cleanVar) {
                    cleanParent = cleanString(text);
                    break;
                  }
                }
              }
            }

            // Match item from scanned data
            let matchedItem = null;
            if (cleanVar) {
              matchedItem = childProducts.find(p => p.sku && p.variationName && cleanString(p.variationName) === cleanVar && (!cleanParent || !p.name || cleanString(p.name).includes(cleanParent) || cleanParent.includes(cleanString(p.name))));
              if (!matchedItem) {
                matchedItem = childProducts.find(p => p.sku && p.variationName && cleanString(p.variationName) === cleanVar);
              }
              if (!matchedItem) {
                matchedItem = childProducts.find(p => p.sku && p.variationName && (cleanString(p.variationName).includes(cleanVar) || cleanVar.includes(cleanString(p.variationName))));
              }
            }

            // Fallback by index
            if (!matchedItem && childProducts[idx] && childProducts[idx].sku) {
              matchedItem = childProducts[idx];
            }

            const finalSku = matchedItem?.sku;

            if (varCell && finalSku) {
              mEl.style.setProperty('height', 'auto', 'important');
              mEl.style.setProperty('min-height', '56px', 'important');
              mEl.style.setProperty('overflow', 'visible', 'important');

              varCell.style.setProperty('height', 'auto', 'important');
              varCell.style.setProperty('display', 'flex', 'important');
              varCell.style.setProperty('flex-direction', 'column', 'important');
              varCell.style.setProperty('align-items', 'flex-start', 'important');
              varCell.style.setProperty('justify-content', 'center', 'important');
              varCell.style.setProperty('overflow', 'visible', 'important');

              // Clear old injected badges
              varCell.querySelectorAll('.ext-km-injected-sku').forEach(e => e.remove());

              const badge = document.createElement('div');
              badge.className = 'ext-km-injected-sku';
              badge.title = 'Bấm để copy SKU: ' + finalSku;
              badge.style.cssText = 'display: inline-block !important; margin-top: 4px !important; background: #e0f2fe !important; border: 1px solid #7dd3fc !important; border-radius: 4px !important; padding: 2px 7px !important; font-family: monospace, Consolas, sans-serif !important; font-size: 11px !important; font-weight: bold !important; color: #0284c7 !important; width: max-content !important; cursor: pointer !important; user-select: all !important; z-index: 10 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;';
              badge.innerHTML = `<span style="color: #0369a1; font-weight: normal; margin-right: 3px;">SKU:</span><b>${finalSku}</b>`;
              badge.setAttribute('data-sku', finalSku);

              badge.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(finalSku).then(() => {
                  badge.innerHTML = `<span style="color: #15803d; font-weight: bold;">✓ Đã copy!</span>`;
                  badge.style.background = '#dcfce7';
                  badge.style.borderColor = '#86efac';
                  setTimeout(() => {
                    badge.innerHTML = `<span style="color: #0369a1; font-weight: normal; margin-right: 3px;">SKU:</span><b>${finalSku}</b>`;
                    badge.style.background = '#e0f2fe';
                    badge.style.borderColor = '#7dd3fc';
                  }, 1200);
                });
              });

              varCell.appendChild(badge);
            }
          });
        }
      });
    } catch (err) {
      console.warn("Lỗi chèn SKU lên Shopee:", err);
    }
  }

  function updateStats() {
    if (!statsEl) return;
    const parentCount = allRows.filter(r => r.isParent).length;
    const varCount = allRows.filter(r => !r.isParent).length;
    const skuCount = allRows.filter(r => !r.isParent && r.sku).length;

    statsEl.innerHTML = `
      <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Sản phẩm: ${parentCount}</span>
      <span style="background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Phân loại: ${varCount}</span>
      <span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Có SKU: ${skuCount}</span>
    `;
  }

  function renderTable() {
    if (!tbody) return;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const tokens = query.split(/\s+/).filter(Boolean);

    let filtered = allRows.filter(r => {
      if (tokens.length > 0) {
        const fullSearchStr = `${r.name || ''} ${r.variationName || ''} ${r.sku || ''} ${r.originalPrice || ''} ${r.discountPrice || ''} ${r.stock || ''}`.toLowerCase();
        return tokens.every(token => fullSearchStr.includes(token));
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #64748b;">Chưa có dữ liệu hoặc không có dòng nào phù hợp với bộ lọc tìm kiếm.</td></tr>';
      return;
    }

    let html = '';
    let stt = 1;

    filtered.forEach((row) => {
      const isParent = row.isParent;
      const rowBg = isParent ? '#f8fafc' : '#ffffff';
      const borderTop = isParent ? '2px solid #cbd5e1' : '1px solid #f1f5f9';
      const nameStyle = isParent ? 'font-weight: bold; color: #0f172a; font-size: 12px;' : 'color: #475569; font-size: 11px;';

      const formattedOrigPrice = row.originalPrice ? Number(row.originalPrice).toLocaleString('vi-VN') + ' đ' : '-';
      const formattedDiscPrice = row.discountPrice ? `<b style="color: #dc2626; font-size: 12px;">${Number(row.discountPrice).toLocaleString('vi-VN')} đ</b>` : '-';
      const formattedMinPrice = row.lowestPrice ? `<b style="color: #059669; font-size: 12px;">${Number(row.lowestPrice).toLocaleString('vi-VN')} đ</b>` : '-';
      const formattedSku = row.sku ? `<b style="color: #0284c7;">${escapeHtml(row.sku)}</b>` : '<span style="color: #cbd5e1;">-</span>';

      html += `
        <tr style="background-color: ${rowBg}; border-top: ${borderTop};">
          <td style="padding: 6px 4px; text-align: center; color: #64748b;">${isParent ? `<b>${stt++}</b>` : ''}</td>
          <td style="padding: 6px; ${nameStyle}" title="${escapeHtml(row.name)}">
            ${isParent ? `🏷️ <b>${escapeHtml(row.name)}</b>` : `<span style="color: #94a3b8; margin-left: 8px;">↳</span> ${escapeHtml(row.name)}`}
          </td>
          <td style="padding: 6px; color: #1e293b; font-weight: ${row.variationName ? '600' : 'normal'};">
            ${row.variationName ? `<span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${escapeHtml(row.variationName)}</span>` : '<i style="color: #94a3b8;">-</i>'}
          </td>
          <td style="padding: 6px; font-family: monospace; font-size: 11px;">
            ${formattedSku}
          </td>
          <td style="padding: 6px; text-align: right; color: #64748b;">
            ${formattedOrigPrice}
          </td>
          <td style="padding: 6px; text-align: right;">
            ${formattedDiscPrice}
          </td>
          <td style="padding: 6px; text-align: right; background-color: #ecfdf5;">
            ${formattedMinPrice}
          </td>
          <td style="padding: 6px; text-align: center; color: #334155; font-weight: 500;">
            ${row.stock || '-'}
          </td>
          <td style="padding: 6px 4px; text-align: center;">
            <button type="button" class="btn-single-copy" data-name="${escapeHtml(row.name)}" data-var="${escapeHtml(row.variationName || '')}" data-sku="${escapeHtml(row.sku || '')}" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; width: auto;">Copy</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Attach copy event listeners
    tbody.querySelectorAll('.btn-single-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        const varName = btn.getAttribute('data-var');
        const sku = btn.getAttribute('data-sku');
        let textToCopy = varName && varName !== '-' ? `${name} - ${varName}` : name;
        if (sku) textToCopy += ` [${sku}]`;

        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.innerText = '✓ Đã copy';
          btn.style.background = '#22c55e';
          btn.style.color = '#ffffff';
          setTimeout(() => {
            btn.innerText = 'Copy';
            btn.style.background = '#f1f5f9';
            btn.style.color = '#334155';
          }, 1000);
        });
      });
    });
  }

  function copyTableToTsv() {
    if (!allRows.length) {
      alert("Chưa có dữ liệu để copy. Vui lòng bấm 'Đọc KM từ Shopee' trước.");
      return;
    }

    const headers = ["STT", "Tên sản phẩm", "Phân loại hàng", "SKU / SKU_CT", "Giá gốc", "Giá khuyến mãi", "Giá thấp nhất", "Tồn kho"];
    const lines = [headers.join("\t")];

    let stt = 1;
    allRows.forEach(row => {
      lines.push([
        row.isParent ? stt++ : "",
        (row.name || "").replace(/[\t\n\r]/g, " "),
        (row.variationName || "").replace(/[\t\n\r]/g, " "),
        (row.sku || "").replace(/[\t\n\r]/g, " "),
        row.originalPrice || "",
        row.discountPrice || "",
        row.lowestPrice || "",
        row.stock || ""
      ].join("\t"));
    });

    const tsvText = lines.join("\n");
    navigator.clipboard.writeText(tsvText).then(() => {
      setStatus(`📋 Đã copy <b>${allRows.length}</b> dòng TSV vào clipboard. Bạn có thể dán trực tiếp vào Excel hoặc Google Sheets.`);
      if (copyTsvBtn) {
        copyTsvBtn.innerText = '✓ Đã copy TSV';
        setTimeout(() => {
          copyTsvBtn.innerText = '📋 Copy TSV';
        }, 1500);
      }
    });
  }

  function exportToExcel() {
    if (!allRows.length) {
      alert("Chưa có dữ liệu để xuất Excel. Vui lòng bấm 'Đọc KM từ Shopee' trước.");
      return;
    }

    try {
      if (typeof XLSX === 'undefined') {
        throw new Error("Thư viện XLSX chưa sẵn sàng.");
      }

      const headers = ["STT", "Tên sản phẩm", "Phân loại hàng", "SKU / SKU_CT", "Giá gốc", "Giá khuyến mãi", "Tồn kho"];
      const dataRows = [headers];

      let stt = 1;
      allRows.forEach(row => {
        dataRows.push([
          row.isParent ? stt++ : "",
          row.name || "",
          row.variationName || "",
          row.sku || "",
          row.originalPrice ? Number(row.originalPrice) : "",
          row.discountPrice ? Number(row.discountPrice) : "",
          row.stock || ""
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KM_Shopee");

      const nowStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `KM_Shopee_${nowStr}.xlsx`);
      setStatus(`📊 Đã xuất thành công file <b>KM_Shopee_${nowStr}.xlsx</b>!`);
    } catch (err) {
      setStatus(`❌ Lỗi xuất Excel: ${err.message}`, true);
      alert("Lỗi xuất Excel: " + err.message);
    }
  }

  async function saveToSheet() {
    const nhomVal = (sheetGroupInput?.value || "").trim();
    if (!nhomVal) {
      alert("Vui lòng nhập Tên nhóm / Đợt khuyến mãi trước khi lưu!");
      sheetGroupInput?.focus();
      return;
    }

    const parentProducts = allRows.filter(r => r.isParent);
    if (!parentProducts.length) {
      alert("Không có sản phẩm nào để lưu.");
      return;
    }

    saveSheetBtn.disabled = true;
    saveSheetBtn.innerText = '⏳ Đang lưu vào Sheet...';

    try {
      const appendValues = parentProducts.map((p, idx) => [
        Date.now().toString() + idx.toString(),
        nhomVal,
        p.name
      ]);

      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "SAVE_FLASH_SALE", values: appendValues }, resolve);
      });

      if (res && res.ok) {
        setStatus(`💾 Đã lưu thành công <b>${parentProducts.length}</b> sản phẩm với nhóm <b>"${nhomVal}"</b> vào Sheet FLASH_SALE.`);
        alert(`Lưu thành công ${parentProducts.length} sản phẩm vào Sheet FLASH_SALE!`);
        if (sheetGroupInput) sheetGroupInput.value = '';
      } else {
        throw new Error(res?.error || "Lỗi ghi vào Google Sheets");
      }
    } catch (err) {
      setStatus(`❌ Lỗi lưu Sheet: ${err.message}`, true);
      alert("Lỗi lưu Sheet: " + err.message);
    } finally {
      saveSheetBtn.disabled = false;
      saveSheetBtn.innerText = '💾 Lưu Sheet FLASH_SALE';
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ==========================================
  // REALTIME SYNC & LINK TRACKING MANAGER
  // ==========================================
  async function autoSyncRealtime(force = false) {
    try {
      const tab = await getActiveTab();
      if (!tab || !tab.id || !tab.url) return;

      if (!isShopeePromotionUrl(tab.url)) {
        if (!allRows.length && statusEl) {
          setStatus(`⚠️ Vui lòng mở đúng trang Khuyến Mãi / Giảm Giá Shopee (link có dạng <code>/portal/marketing/discount/...</code>) để tự động đọc realtime.`);
        }
        return;
      }

      await readPromotionData(true, force);
    } catch (e) {
      console.debug("autoSyncRealtime error:", e);
    }
  }

  // Tự động quét realtime định kỳ mỗi 2 giây
  setInterval(() => {
    autoSyncRealtime(false);
  }, 2000);

  // Lắng nghe khi người dùng chuyển tab trình duyệt
  if (chrome.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener(() => {
      setTimeout(() => autoSyncRealtime(true), 300);
    });
  }

  // Lắng nghe khi URL thay đổi (chuyển chương trình khuyến mãi, đổi trang...)
  if (chrome.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' || changeInfo.url) {
        setTimeout(() => autoSyncRealtime(true), 300);
      }
    });
  }

  // Lắng nghe khi người dùng click vào Tab KM trong popup
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-tab') === 'tab-km') {
        setTimeout(() => autoSyncRealtime(true), 200);
      }
    });
  });
})();

