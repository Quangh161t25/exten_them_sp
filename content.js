
function downloadExcelFileBypass(wb, filename) {
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.addEventListener('click', (e) => e.stopPropagation());
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

(function () {
  if (window.__shopeeQlspLoaded) {
    return;
  }

  window.__shopeeQlspLoaded = true;

  const ADD_PRODUCT_TEXT = "Th\u00eam S\u1ea3n Ph\u1ea9m";
  const ADD_PRODUCT_URL = "https://banhang.shopee.vn/portal/product/new";
  const IMAGE_UPLOAD_TEXT = "Th\u00eam h\u00ecnh \u1ea3nh";
  const ADD_VARIATION_TEXT = "Th\u00eam nh\u00f3m ph\u00e2n lo\u1ea1i";
  const PRODUCT_GALLERY_STYLE_ID = "shopee-qlsp-product-gallery-style";
  const SCROLL_BUTTONS_ID = "shopee-qlsp-scroll-buttons";
  const SCROLL_BUTTONS_STYLE_ID = "shopee-qlsp-scroll-buttons-style";
  const AWB_DOWNLOAD_BUTTON_ID = "shopee-qlsp-awb-download";
  const AWB_DOWNLOAD_STYLE_ID = "shopee-qlsp-awb-download-style";
  const INCOME_TO_THU_CHI_BUTTON_ID = "shopee-qlsp-income-to-thu-chi";
  const INCOME_TO_THU_CHI_SUMMARY_ID = "shopee-qlsp-income-summary";
  const INCOME_TO_THU_CHI_TABLE_ID = "shopee-qlsp-income-table";
  const INCOME_TO_THU_CHI_STYLE_ID = "shopee-qlsp-income-to-thu-chi-style";
  const INCOME_ROW_ADD_BUTTON_CLASS = "shopee-qlsp-income-row-add";
  const PRODUCT_LIST_STYLE_ID = "shopee-qlsp-product-list-style";
  const PRODUCT_LIST_CLASS = "shopee-qlsp-product-list-page";
  const PRODUCT_LIST_QUICK_ACTION_CLASS = "shopee-qlsp-product-list-actions";
  const PRODUCT_LIST_ACTIONS = ["Xem tr\u01b0\u1edbc", "\u0110\u1ea9y s\u1ea3n ph\u1ea9m"];
  const PRODUCT_LIST_COPY_LINK_TEXT = "Copy link";
  const PRODUCT_LIST_COPY_NAME_TEXT = "Copy t\u00ean";
  const ORDER_SN_COPY_STYLE_ID = "shopee-qlsp-order-sn-copy-style";
  const ORDER_SN_COPY_BUTTON_CLASS = "shopee-qlsp-order-sn-copy";
  const WEIGHT_STYLE_ID = "shopee-qlsp-weight-style";
  const WEIGHT_WRAP_CLASS = "shopee-qlsp-weight-actions";
  const WEIGHT_VALUES = [2000, 3000, 4000, 5000];
  const VARIATION_STYLE_ID = "shopee-qlsp-variation-style";
  const VARIATION_WRAP_CLASS = "shopee-qlsp-variation-actions";
  const VARIATION_VALUES = ["Ph\u00e2n lo\u1ea1i", "M\u00e0u"];
  const DESCRIPTION_DROP_STYLE_ID = "shopee-qlsp-description-drop-style";
  let cachedProductListShopId = "";

  // ============================================================
  // SHOPEE FETCH INTERCEPTOR - Lấy ảnh bằng cơ chế API thật
  // ============================================================
  const SPLQ_INTERCEPT_CHANNEL = 'SPLQ_FETCH_INTERCEPTED';
  const interceptedApiData = {}; // { url: { url, headers, data } }
  const interceptedByProduct = {}; // { "itemId-shopId": [...data] }

  // Lắng nghe data từ interceptor script (đã được nạp qua manifest.json)
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.channel !== SPLQ_INTERCEPT_CHANNEL) return;
    const { url, headers, data } = e.data;
    if (!url || !data) return;

    // Lưu vào cache toàn bộ
    interceptedApiData[url] = { url, headers, data };

    // Nếu data chứa item, lưu theo itemId-shopId
    let itemId, shopId;
    if (data?.data?.item?.item_id) {
      itemId = data.data.item.item_id;
      shopId = data.data.item.shop_id;
    } else if (data?.item?.item_id) {
      itemId = data.item.item_id;
      shopId = data.item.shop_id;
    } else if (data?.data?.item_id) {
      itemId = data.data.item_id;
      shopId = data.data.shop_id;
    }
    
    if (itemId && shopId) {
      const key = `${itemId}-${shopId}`;
      if (!interceptedByProduct[key]) interceptedByProduct[key] = [];
      interceptedByProduct[key].push({ url, headers, data });
    }
  });

  function callShopeeApiViaInterceptor(url, headers = {}) {
    return new Promise((resolve) => {
      const messageId = Math.random().toString(36).substring(2);
      const handler = (e) => {
        if (e.data && e.data.channel === 'SPLQ_FETCH_REPLY' && e.data.messageId === messageId) {
          window.removeEventListener('message', handler);
          resolve({ ok: !!e.data.data, data: e.data.data, error: e.data.error });
        }
      };
      window.addEventListener('message', handler);
      window.postMessage({ channel: 'SPLQ_FETCH_REQUEST', messageId, url, headers }, '*');
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ ok: false, error: 'timeout' });
      }, 10000);
    });
  }

  /**
   * Gọi Shopee API /api/v4/pdp/get_pc với credentials thật từ trang.
   * Trả về dữ liệu sản phẩm đầy đủ gồm ảnh, mô tả, thuộc tính.
   */
  async function fetchShopeeProductByApi(itemId, shopId) {
    // 1. Thử dùng data đã intercepted (từ content-start.js hoặc content.js)
    const key = `${itemId}-${shopId}`;
    const cachedObj = (window.splqInterceptedByProduct && window.splqInterceptedByProduct[key]) || interceptedByProduct[key];
    if (cachedObj && cachedObj.length > 0) {
      // Tìm request chứa dữ liệu sản phẩm hợp lệ (có trường images hoặc image_urls)
      const cached = cachedObj.find(c => {
        const item = c.data?.data?.item || c.data?.item || c.data?.data || c.data;
        return item && (item.images || item.image_urls);
      });
      if (cached) {
        if (cached.data?.data) return { ok: true, data: cached.data.data, source: 'intercepted_v4' };
        if (cached.data?.item) return { ok: true, data: cached.data.item, source: 'intercepted_v2' };
      }
    }

    // Lấy header cũ nếu có (thường là lấy từ bất kỳ request nào để có header base)
    const baseHeaders = {
      'accept': 'application/json',
      'af-ac-enc-dat': null,
      'af-ac-enc-sz-token': '',
      'content-type': 'application/json'
    };

    // 2. Gọi API thông qua script interceptor (chạy ở main world)
    const apiUrl = `https://shopee.vn/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;
    try {
      const res = await callShopeeApiViaInterceptor(apiUrl, baseHeaders);
      if (res.ok && res.data && (res.data.error === 0 || res.data.error === null)) {
        if (res.data.data) {
          return { ok: true, data: res.data.data, source: 'main_world_fetch_v4' };
        } else if (res.data.item) {
          return { ok: true, data: res.data.item, source: 'main_world_fetch_v4_item' };
        }
      }
    } catch (err) {
      console.warn('[SPLQ] Main world API call failed:', err.message);
    }

    // 3. Fallback: thử API v2
    try {
      const res2 = await fetch(`https://shopee.vn/api/v2/item/get?itemid=${itemId}&shopid=${shopId}`, {
        credentials: 'include',
        headers: { 'accept': 'application/json' }
      });
      if (res2.ok) {
        const json2 = await res2.json();
        if ((json2.error === 0 || json2.error === null) && json2?.item) {
          return { ok: true, data: json2.item, source: 'api_v2' };
        }
      }
    } catch (err2) {
      console.warn('[SPLQ] API v2 call failed:', err2.message);
    }
    return { ok: false, data: null, source: 'failed' };
  }

  /**
   * Chuyển image hash/id thành URL đầy đủ Shopee CDN.
   * Shopee dùng dạng: https://down-vn.img.susercontent.com/file/<hash>
   */
  function shopeeImageHashToUrl(hash) {
    if (!hash) return null;
    if (hash.startsWith('http')) return hash;
    return `https://down-vn.img.susercontent.com/file/${hash}`;
  }

  /**
   * Trích xuất toàn bộ danh sách ảnh từ data API Shopee.
   */
  function extractImagesFromApiData(data) {
    const images = [];
    const item = data?.item || data; 
    
    // 1. Lấy video (nếu có)
    const videos = item?.video_info_list || [];
    videos.forEach((vid, idx) => {
       const vidUrl = vid.default_format?.url || vid.video_url;
       if (vidUrl) {
         images.push({ url: vidUrl, fileName: `video-${idx + 1}.mp4`, type: 'video' });
       }
    });

    // 2. Lấy ảnh chính (main)
    const mainImages = item?.images || item?.image_urls || [];
    mainImages.forEach((hash, idx) => {
      const url = typeof hash === 'string' ? shopeeImageHashToUrl(hash) : hash;
      if (url) images.push({ url, fileName: `main-${idx + 1}.jpg`, type: 'main' });
    });

    // 3. Lấy ảnh phân loại hàng (variation/models)
    const variationImages = [];
    if (item?.tier_variations && item.tier_variations.length > 0) {
      const tier0 = item.tier_variations[0];
      if (tier0.images && tier0.images.length > 0) {
        tier0.images.forEach((hash, idx) => {
           if (hash) {
             const optName = (tier0.options && tier0.options[idx]) ? tier0.options[idx] : `opt-${idx+1}`;
             const cleanName = optName.replace(/[/\\?%*:|"<>]/g, '-'); // tránh lỗi tên file
             variationImages.push({ hash, name: cleanName });
           }
        });
      }
    } else if (item?.models && item.models.length > 0) {
      item.models.forEach((model, idx) => {
        if (model.image || model.image_id) {
           const hash = model.image || model.image_id;
           const cleanName = (model.name || `model-${idx+1}`).replace(/[/\\?%*:|"<>]/g, '-');
           variationImages.push({ hash, name: cleanName });
        }
      });
    }

    variationImages.forEach((v) => {
       const url = shopeeImageHashToUrl(v.hash);
       if (url) images.push({ url, fileName: `phanloai-${v.name}.jpg`, type: 'variation' });
    });

    // 4. Lấy ảnh mô tả (description)
    const descInfo = item?.description_info;
    const descImages = [];
    if (descInfo?.extended_description?.field_list) {
      descInfo.extended_description.field_list.forEach(field => {
        const imageInfo = field.image_info || field.info;
        if (imageInfo && imageInfo.image_id) {
           descImages.push(shopeeImageHashToUrl(imageInfo.image_id));
        } else if ((field.type === 'image' || field.field_type === 'image') && field.text) {
           descImages.push(shopeeImageHashToUrl(field.text));
        }
      });
    } 
    // Fallback nếu API dùng cấu trúc image_info trực tiếp
    if (descInfo?.image_info) {
       descInfo.image_info.forEach(img => {
          if (img.image_id) descImages.push(shopeeImageHashToUrl(img.image_id));
       });
    }

    descImages.forEach((url, idx) => {
       if (url) images.push({ url, fileName: `description-${idx + 1}.jpg`, type: 'description' });
    });

    return images;
  }

  /**
   * Trích xuất thuộc tính sản phẩm từ data API.
   */
  function extractAttributesFromApiData(data) {
    const attrs = {};
    const attrList = data?.attributes || data?.tier_variations || [];
    attrList.forEach(attr => {
      const name = attr.name || attr.display_name || attr.attribute_name;
      const value = attr.value || (attr.options && attr.options[0]);
      if (name && value) attrs[name] = value;
    });
    return attrs;
  }

  function injectProductGalleryStyle() {
    if (document.getElementById(PRODUCT_GALLERY_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = PRODUCT_GALLERY_STYLE_ID;
    style.textContent = `
      section._OguPS .airUhU {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: flex-start !important;
        gap: 8px !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        transform: none !important;
      }

      section._OguPS .airUhU .UBG7wZ {
        flex: 0 0 82px !important;
        width: 82px !important;
        height: 82px !important;
        margin: 0 !important;
        transform: none !important;
      }

      section._OguPS .airUhU .jA1mTx,
      section._OguPS .airUhU .YM40Nc,
      section._OguPS .airUhU picture,
      section._OguPS .airUhU img.raRnQV {
        width: 82px !important;
        height: 82px !important;
      }

      section._OguPS.shopee-qlsp-gallery-ready .airUhU button.CAvqYR,
      section._OguPS.shopee-qlsp-gallery-ready .airUhU button.lWmpR1 {
        display: none !important;
      }

      section._OguPS .shopee-qlsp-full-gallery {
        display: grid !important;
        grid-template-columns: repeat(5, 82px) !important;
        gap: 8px !important;
        width: 100% !important;
        margin-top: 10px !important;
        padding-bottom: 8px !important;
      }

      section._OguPS .shopee-qlsp-full-gallery img {
        width: 82px !important;
        height: 82px !important;
        border: 1px solid #e5e5e5 !important;
        object-fit: cover !important;
        background: #fff !important;
        cursor: pointer !important;
      }

      section._OguPS .shopee-qlsp-full-gallery img:hover {
        border-color: #ee4d2d !important;
      }
    `;
    document.documentElement.append(style);
  }

  injectProductGalleryStyle();

  function injectDescriptionDropStyle() {
    if (document.getElementById(DESCRIPTION_DROP_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = DESCRIPTION_DROP_STYLE_ID;
    style.textContent = `
      .shopee-qlsp-description-drop-ready {
        outline: 2px dashed transparent !important;
        outline-offset: -8px !important;
        transition: outline-color 0.16s ease, background-color 0.16s ease !important;
      }

      .shopee-qlsp-description-drag-over {
        outline-color: #ee4d2d !important;
        background-color: rgba(238, 77, 45, 0.06) !important;
      }
    `;
    document.documentElement.append(style);
  }

  function injectScrollButtonsStyle() {
    if (document.getElementById(SCROLL_BUTTONS_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = SCROLL_BUTTONS_STYLE_ID;
    style.textContent = `
      #${SCROLL_BUTTONS_ID} {
        position: fixed !important;
        right: 18px !important;
        bottom: 92px !important;
        z-index: 2147483647 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
        pointer-events: auto !important;
      }

      #${SCROLL_BUTTONS_ID} button {
        width: 42px !important;
        height: 34px !important;
        border: 0 !important;
        border-radius: 50% !important;
        color: #fff !important;
        background: #2673dd !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24) !important;
        font: 700 11px/1 Arial, sans-serif !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      #${SCROLL_BUTTONS_ID} button:hover {
        background: #1e5fb8 !important;
      }
    `;
    document.documentElement.append(style);
  }

  function isScrollableElement(element) {
    if (!element || element === document.documentElement || element === document.body) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;

    return (
      ["auto", "scroll"].includes(overflowY) &&
      element.scrollHeight > element.clientHeight + 80 &&
      isVisible(element)
    );
  }

  function findBestScrollableElement() {
    const candidates = Array.from(document.querySelectorAll("main, [class*='scroll'], [class*='container'], [class*='content'], div"))
      .filter(isScrollableElement)
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        const leftArea = leftRect.width * leftRect.height;
        const rightArea = rightRect.width * rightRect.height;

        return rightArea - leftArea;
      });

    return candidates[0] || document.scrollingElement || document.documentElement;
  }

  function scrollPageBy(direction) {
    const distance = Math.max(360, Math.round(window.innerHeight * 0.82)) * direction;

    if (document.documentElement.scrollHeight > window.innerHeight + 10) {
      window.scrollBy({ top: distance, behavior: "smooth" });
      return;
    }

    const target = findBestScrollableElement();

    if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
      window.scrollBy({ top: distance, behavior: "smooth" });
      return;
    }

    target.scrollBy({ top: distance, behavior: "smooth" });
  }

  function scrollPageTo(position) {
    if (document.documentElement.scrollHeight > window.innerHeight + 10) {
      window.scrollTo({ top: position === 'top' ? 0 : document.documentElement.scrollHeight, behavior: "smooth" });
      return;
    }
    const target = findBestScrollableElement();
    if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
      window.scrollTo({ top: position === 'top' ? 0 : document.documentElement.scrollHeight, behavior: "smooth" });
      return;
    }
    target.scrollTo({ top: position === 'top' ? 0 : target.scrollHeight, behavior: "smooth" });
  }

  function removeOldScrollButtons(keepCurrent = false) {
    const oldLabels = new Set(["TOP", "UP", "DN", "BOT", "XLS", "â†‘", "â†“", "â‡ˆ", "â‡Š", "↑", "↓", "⇈", "⇊"]);

    if (!keepCurrent) {
      document.querySelectorAll(`#${SCROLL_BUTTONS_ID}, [data-shopee-qlsp-scroll-buttons="1"]`).forEach(element => element.remove());
    }
    document.querySelectorAll("button").forEach(button => {
      const text = normalizeText(button.textContent || button.innerHTML);
      const parent = button.parentElement;
      if (!parent || parent.id === SCROLL_BUTTONS_ID) return;
      if (!oldLabels.has(text)) return;

      const style = window.getComputedStyle(parent);
      const parentButtons = Array.from(parent.querySelectorAll("button"));
      const allLookLikeScrollButtons = parentButtons.length > 0 && parentButtons.every(item => oldLabels.has(normalizeText(item.textContent || item.innerHTML)));

      if ((style.position === "fixed" || parent.style.position === "fixed") && allLookLikeScrollButtons) {
        parent.remove();
      }
    });
  }

  function injectScrollButtons() {
    removeOldScrollButtons();

    if (window !== window.top) {
      return; 
    }

    injectScrollButtonsStyle();

    const wrap = document.createElement("div");
    wrap.id = SCROLL_BUTTONS_ID;
    wrap.dataset.shopeeQlspScrollButtons = "1";
    wrap.style.zIndex = "2147483647";

    const topButton = document.createElement("button");
    topButton.type = "button";
    topButton.title = "Len dau trang";
    topButton.textContent = "TOP";

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.title = "Len";
    upButton.textContent = "UP";

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.title = "Xuong";
    downButton.textContent = "DN";

    const bottomButton = document.createElement("button");
    bottomButton.type = "button";
    bottomButton.title = "Xuong cuoi trang";
    bottomButton.textContent = "BOT";

    topButton.addEventListener("click", () => scrollPageTo("top"));
    upButton.addEventListener("click", () => scrollPageBy(-1));
    downButton.addEventListener("click", () => scrollPageBy(1));
    bottomButton.addEventListener("click", () => scrollPageTo("bottom"));

    const bulkExcelBtn = document.createElement("button");
    bulkExcelBtn.id = "shopee-qlsp-bulk-excel-btn";
    bulkExcelBtn.type = "button";
    bulkExcelBtn.title = "Tai Excel hang loat cac don da tick";
    bulkExcelBtn.textContent = "XLS";
    bulkExcelBtn.style.backgroundColor = "#107c41";
    bulkExcelBtn.style.fontSize = "12px";
    bulkExcelBtn.addEventListener("click", () => {
      if (!isOrderListPage()) return;
      
      const checkedCustoms = Array.from(document.querySelectorAll("input.shopee-qlsp-bulk-checkbox:checked"));
      const selectedOrders = checkedCustoms.map(checkbox => {
          let orderContainer = checkbox;
          let lastValidContainer = null;
          while (orderContainer && orderContainer.tagName !== "BODY") {
            const snCount = orderContainer.querySelectorAll("span.order-sn").length;
            if (snCount > 1) break;
            if (orderContainer.querySelector("div.item-name")) {
              lastValidContainer = orderContainer;
            }
            orderContainer = orderContainer.parentElement;
          }
          return lastValidContainer;
      }).filter(Boolean);
      
      if (selectedOrders.length === 0) {
        alert("Vui long tick chon it nhat 1 don hang de tai Excel.");
        return;
      }

      const headers = ["Ma don hang", "Ma Kien Hang", "Ngay dat hang", "Trang Thai Don Hang", "Nhan xet tu Nguoi mua", "Ma van don", "Don Vi Van Chuyen", "Phuong thuc giao hang", "Loai don hang", "Ngay giao hang du kien", "Ngay gui hang", "Thoi gian giao hang", "Trang thai Tra hang/Hoan tien", "SKU san pham", "Ten san pham", "Can nang san pham", "Tong can nang", "Ten kho hang", "SKU phan loai hang", "Ten phan loai hang", "Gia goc", "Nguoi ban tro gia", "Duoc Shopee tro gia", "Tong so tien duoc nguoi ban tro gia", "Gia goc (Y)", "So luong", "So luong san pham duoc hoan tra", "Tong so tien Nguoi mua thanh toan"];
      const rowsData = [headers];

      const getCleanText = (el) => {
        if (!el) return "";
        const clone = el.cloneNode(true);
        clone.querySelectorAll('button, .shopee-qlsp-sku-display, .shopee-qlsp-copy-button, .btn-copy-price, .injected-sku-ct, .tracking-copy-btn, .order-copy-btn').forEach(n => n.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
      };
      
      selectedOrders.forEach(orderContainer => {
        const orderSnEl = orderContainer.querySelector("span.order-sn");
        const orderSn = orderSnEl ? getOrderSnFromText(orderSnEl.textContent) : "";
        if (!orderSn) return;

        const trackingEl = orderContainer.querySelector("div.tracking-number");
        const trackingText = getCleanText(trackingEl);

        const priceEl = orderContainer.querySelector("div.total-price");
        let priceText = getCleanText(priceEl).replace(/[^\d]/g, "");
        if (priceText) {
          priceText = String(parseInt(priceText, 10) * 10 + 10000000);
        }

        const items = orderContainer.querySelectorAll("div.item");
        items.forEach(itemEl => {
          const amountEl = itemEl.querySelector("div.item-amount");
          const quantity = getCleanText(amountEl).replace(/[^\d]/g, "") || "1";
          
          let skuText = "";
          const varEl = itemEl.querySelector("div.item-description");
          const nameEl = itemEl.querySelector("div.item-name");
          let sibling = (varEl || nameEl)?.nextElementSibling;
          while (sibling) {
            if (sibling.classList.contains("shopee-qlsp-sku-display")) {
              skuText = getCleanText(sibling).replace(/^SKU:\s*/i, "");
              break;
            }
            if (sibling.classList.contains("item-name")) break;
            sibling = sibling.nextElementSibling;
          }
          
          let row = new Array(28).fill("");
          row[0] = orderSn;
          row[5] = trackingText;
          row[6] = "Nhanh-SPX Express";
          row[18] = skuText;
          row[24] = priceText;
          row[25] = quantity;
          rowsData.push(row);
        });
      });
      
      chrome.storage.local.get(["maGian", "dhHoanTextValue"], (res) => {
        const maGian = res.maGian || res.dhHoanTextValue || "bce";
        
        try {
          if (typeof XLSX === "undefined") {
            alert("Thu vien Excel chua san sang, vui long thu lai sau 1-2 giay.");
            return;
          }
          const ws = XLSX.utils.aoa_to_sheet(rowsData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Orders");
          const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
          const dataUrl = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + base64;
          chrome.runtime.sendMessage({
            type: "FORCE_DOWNLOAD",
            url: dataUrl,
            filename: getCustomExcelFilename(maGian)
          });
        } catch (e) {
          console.error(e);
          alert("Loi tai Excel: " + e.message);
        }
      });
    });

    async function handleFillMultiWarehousePopup(targetValue = '1000', triggerInput = null) {
      let popup = document.querySelector('.multi-warehouse-stock-edit');
      
      if (!popup || !isVisible(popup)) {
        if (triggerInput) {
          const popoverRef = triggerInput.closest('.eds-popover__ref') || triggerInput.closest('.multi-warehouse-stock-input') || triggerInput.closest('.eds-input') || triggerInput;
          triggerInput.focus();
          triggerInput.click();
          if (popoverRef && popoverRef !== triggerInput) {
            popoverRef.click();
            emitRealClick(popoverRef);
          }
        }
        
        for (let i = 0; i < 25; i++) {
          await sleep(60);
          popup = document.querySelector('.multi-warehouse-stock-edit');
          if (popup && isVisible(popup)) break;
        }
      }

      if (!popup) {
        if (triggerInput && !triggerInput.readOnly && !triggerInput.disabled) {
          fillInputLikeUser(triggerInput, targetValue);
          return true;
        }
        return false;
      }

      const rows = Array.from(popup.querySelectorAll('.eds-table__body tr.eds-table__row, .stock-table tr, tr'));
      let filledCount = 0;

      for (const row of rows) {
        const isPaused = row.textContent.includes('Chế độ tạm nghỉ') || row.querySelector('.eds-tag');
        const input = row.querySelector('input.eds-input__input, input');
        
        if (input && !input.disabled && !input.readOnly) {
          if (isPaused) {
            continue;
          }
          fillInputLikeUser(input, targetValue);
          filledCount++;
          await sleep(40);
        }
      }

      await sleep(150);

      const confirmBtn = Array.from(popup.querySelectorAll('button')).find(btn => {
        const txt = (btn.textContent || '').trim();
        return (txt === 'Xác nhận' || txt.includes('Xác nhận')) && isVisible(btn);
      }) || popup.querySelector('.stock-edit-fixed-right button.eds-button--primary');

      if (confirmBtn) {
        emitRealClick(confirmBtn);
      }

      return true;
    }

    async function handleFillAllWarehouses(targetValue = '1000') {
      showTopNotification(`⏳ Đang bắt đầu điền ${targetValue} cho tất cả các kho...`);

      // 1. Thử điền vào ô kho hàng loạt ở trên bảng trước
      const batchInput = findStockBatchInput();
      if (batchInput) {
        const ok = await handleFillMultiWarehousePopup(targetValue, batchInput);
        await sleep(250);
        const applyBtn = findApplyToAllButton();
        if (applyBtn) {
          emitRealClick(applyBtn);
          await sleep(300);
          showTopNotification(`✅ Đã áp dụng ${targetValue} cho tất cả phân loại thành công!`);
          return;
        }
      }

      // 2. Quét tất cả các ô kho trong bảng phân loại
      const stockInputs = Array.from(document.querySelectorAll('.two-tier-multi-warehouse-stock input, .multi-warehouse-stock-input input, .two-tier-stock input, .product-edit-input input[readonly]')).filter(isVisible);

      if (stockInputs.length === 0) {
        const allReadonly = Array.from(document.querySelectorAll('table input[readonly], .eds-table input[readonly], input[placeholder*="Input"][readonly]')).filter(isVisible);
        stockInputs.push(...allReadonly);
      }

      if (stockInputs.length === 0) {
        showTopNotification('Không tìm thấy ô kho hàng nào trên trang!', true);
        return;
      }

      let successCount = 0;
      for (let i = 0; i < stockInputs.length; i++) {
        const inp = stockInputs[i];
        showTopNotification(`⏳ Đang điền kho dòng ${i + 1}/${stockInputs.length}...`);
        const ok = await handleFillMultiWarehousePopup(targetValue, inp);
        if (ok) successCount++;
        await sleep(250);
      }

      showTopNotification(`🎉 Đã điền ${targetValue} cho ${successCount}/${stockInputs.length} dòng thành công!`);
    }

    const saveSheetBtn = document.createElement("button");
    saveSheetBtn.id = "btn-save-product-sheet-sidebar";
    saveSheetBtn.type = "button";
    saveSheetBtn.title = "Thêm SP vào Google Sheet";
    saveSheetBtn.textContent = "Lưu SP";
    saveSheetBtn.style.backgroundColor = "#ee4d2d";
    saveSheetBtn.style.fontSize = "12px";
    saveSheetBtn.style.setProperty("display", "none", "important");
    saveSheetBtn.addEventListener("click", async () => {
      saveSheetBtn.textContent = "...";
      saveSheetBtn.disabled = true;
      try {
        await extractProductDataAndSave();
        saveSheetBtn.style.backgroundColor = "#17a36b";
        saveSheetBtn.textContent = "Xong!";
        setTimeout(() => { saveSheetBtn.textContent = "Lưu SP"; saveSheetBtn.disabled = false; saveSheetBtn.style.backgroundColor = "#ee4d2d"; }, 2000);
      } catch (err) {
        alert("Lỗi: " + err.message);
        saveSheetBtn.textContent = "Lưu SP";
        saveSheetBtn.disabled = false;
      }
    });

    const stock1000Btn = document.createElement("button");
    stock1000Btn.id = "btn-fill-stock-1000-sidebar";
    stock1000Btn.type = "button";
    stock1000Btn.title = "Điền 1000 cho tất cả các kho của toàn bộ phân loại";
    stock1000Btn.textContent = "1000";
    stock1000Btn.style.backgroundColor = "#16a34a";
    stock1000Btn.style.fontSize = "11px";
    stock1000Btn.style.fontWeight = "bold";
    stock1000Btn.style.setProperty("display", "none", "important");
    stock1000Btn.addEventListener("click", async () => {
      stock1000Btn.textContent = "⏳";
      stock1000Btn.disabled = true;
      try {
        await handleFillAllWarehouses("1000");
      } finally {
        stock1000Btn.textContent = "1000";
        stock1000Btn.disabled = false;
      }
    });

    const stock0Btn = document.createElement("button");
    stock0Btn.id = "btn-fill-stock-0-sidebar";
    stock0Btn.type = "button";
    stock0Btn.title = "Điền 0 cho tất cả các kho của toàn bộ phân loại";
    stock0Btn.textContent = "Kho 0";
    stock0Btn.style.backgroundColor = "#dc2626";
    stock0Btn.style.fontSize = "11px";
    stock0Btn.style.fontWeight = "bold";
    stock0Btn.style.setProperty("display", "none", "important");
    stock0Btn.addEventListener("click", async () => {
      stock0Btn.textContent = "⏳";
      stock0Btn.disabled = true;
      try {
        await handleFillAllWarehouses("0");
      } finally {
        stock0Btn.textContent = "Kho 0";
        stock0Btn.disabled = false;
      }
    });

    wrap.append(topButton, upButton, downButton, bottomButton, bulkExcelBtn, stock1000Btn, stock0Btn, saveSheetBtn);
    document.documentElement.append(wrap);
    toggleBulkExcelBtn();
    
    let lastCheckedMaSp = null;
    
    // Toggle the Save SP, 1000 and Kho 0 buttons visibility based on URL
    window.setInterval(() => {
        const path = window.location.pathname;
        const isEdit = path.startsWith("/portal/product/new") || (path.startsWith("/portal/product/") && !path.includes("/list"));
        if (isEdit) {
            saveSheetBtn.style.setProperty("display", "flex", "important");
            stock1000Btn.style.setProperty("display", "flex", "important");
            stock0Btn.style.setProperty("display", "flex", "important");
        } else {
            saveSheetBtn.style.setProperty("display", "none", "important");
            stock1000Btn.style.setProperty("display", "none", "important");
            stock0Btn.style.setProperty("display", "none", "important");
        }
        
        if (isEdit) {
            const urlMatches = path.match(/\/portal\/product\/(\d+)/);
            let maSp = urlMatches ? urlMatches[1] : "";
            if (!maSp) {
                const searchParams = new URLSearchParams(window.location.search);
                maSp = searchParams.get('id') || "";
            }
            
            if (maSp && maSp !== lastCheckedMaSp) {
                lastCheckedMaSp = maSp;
                saveSheetBtn.style.backgroundColor = "#ee4d2d"; // reset to orange
                window.cachedSpShopee = null; // Clear old cache
                
                // Fetch sheet to check if maSp exists
                chrome.runtime.sendMessage({ type: "FETCH_SP_SHOPEE" }, (res) => {
                    if (res && res.ok && res.values && res.values.length > 0) {
                        window.cachedSpShopee = res.values;
                    } else {
                        console.error("[Lưu SP] Lỗi tải dữ liệu SP_SHOPEE:", res);
                    }
                });
            }
            
            if (window.cachedSpShopee) {
                extractProductData().then(rows => {
                    if (rows && rows.length > 0) {
                        let allMatch = true;
                        for (const row of rows) {
                            const maSpVal = String(row[0] || "").trim();
                            const tenSpVal = String(row[1] || "").trim();
                            const tenPhanLoaiVal = String(row[3] || "").trim();
                            const skuVal = String(row[5] || "").trim();
                            
                            const found = window.cachedSpShopee.some(cachedRow => {
                                return String(cachedRow[0] || "").trim() === maSpVal &&
                                       String(cachedRow[1] || "").trim() === tenSpVal &&
                                       String(cachedRow[3] || "").trim() === tenPhanLoaiVal &&
                                       String(cachedRow[5] || "").trim() === skuVal;
                            });
                            
                            if (!found) {
                                allMatch = false;
                                break;
                            }
                        }
                        
                        if (allMatch) {
                            saveSheetBtn.style.backgroundColor = "#17a36b"; // green
                            saveSheetBtn.textContent = "Đã lưu SP";
                        } else {
                            saveSheetBtn.style.backgroundColor = "#ee4d2d"; // orange
                            saveSheetBtn.textContent = "Lưu SP";
                        }
                    }
                }).catch(err => {
                    // Ignore errors during background extraction check
                });
            }
        } else {
            lastCheckedMaSp = null;
        }
    }, 1000);

    function injectRowStockQuickButtons() {
      const path = window.location.pathname;
      const isEdit = path.startsWith("/portal/product/new") || (path.startsWith("/portal/product/") && !path.includes("/list"));
      if (!isEdit) return;

      // 1. Quét các ô multi-warehouse stock của từng phân loại
      const stockCells = Array.from(document.querySelectorAll('.two-tier-multi-warehouse-stock, .two-tier-stock, .multi-warehouse-stock-input, [data-product-edit-field-unique-id*="stockModel"], [class*="multi-warehouse-stock"]'));

      stockCells.forEach(cell => {
        if (cell.querySelector('.shopee-qlsp-row-stock-btns')) return;

        const input = cell.querySelector('input');
        if (!input) return;

        const td = cell.closest('td, .eds-table__cell') || cell;
        td.style.setProperty('overflow', 'visible', 'important');
        td.style.setProperty('height', 'auto', 'important');
        cell.style.setProperty('overflow', 'visible', 'important');

        const btnWrap = document.createElement('div');
        btnWrap.className = 'shopee-qlsp-row-stock-btns';
        btnWrap.style.cssText = 'display: inline-flex !important; gap: 4px !important; margin-top: 4px !important; align-items: center !important; position: relative !important; z-index: 999 !important;';

        const btn1000 = document.createElement('button');
        btn1000.type = 'button';
        btn1000.textContent = '1000';
        btn1000.title = 'Điền 1000 vào từng kho của phân loại này';
        btn1000.style.cssText = 'font-size: 11px !important; font-weight: bold !important; background: #16a34a !important; color: white !important; border: 1px solid #15803d !important; border-radius: 4px !important; padding: 2px 8px !important; cursor: pointer !important; line-height: 1.2 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.15) !important;';
        btn1000.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          btn1000.textContent = '⏳';
          btn1000.disabled = true;
          try {
            await handleFillMultiWarehousePopup('1000', input);
          } finally {
            btn1000.textContent = '1000';
            btn1000.disabled = false;
          }
        };

        const btn0 = document.createElement('button');
        btn0.type = 'button';
        btn0.textContent = '0';
        btn0.title = 'Điền 0 vào từng kho của phân loại này';
        btn0.style.cssText = 'font-size: 11px !important; font-weight: bold !important; background: #ef4444 !important; color: white !important; border: 1px solid #b91c1c !important; border-radius: 4px !important; padding: 2px 6px !important; cursor: pointer !important; line-height: 1.2 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.15) !important;';
        btn0.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          btn0.textContent = '⏳';
          btn0.disabled = true;
          try {
            await handleFillMultiWarehousePopup('0', input);
          } finally {
            btn0.textContent = '0';
            btn0.disabled = false;
          }
        };

        btnWrap.append(btn1000, btn0);

        const helpDiv = cell.querySelector('.two-tier-basic-stock-container-help') || cell.querySelector('.stock-help-text');
        if (helpDiv) {
          helpDiv.appendChild(btnWrap);
        } else {
          const targetParent = cell.querySelector('.stock-content, .product-edit-form-item') || cell;
          targetParent.appendChild(btnWrap);
        }
      });

      // 2. Tiêu đề Popup
      const popupTitle = document.querySelector('.multi-warehouse-stock-edit .stock-edit-title');
      if (popupTitle && !popupTitle.querySelector('.shopee-qlsp-popup-fill-1000')) {
        const popupBtnWrap = document.createElement('span');
        popupBtnWrap.className = 'shopee-qlsp-popup-fill-1000';
        popupBtnWrap.style.cssText = 'display: inline-flex !important; gap: 6px !important; margin-left: 12px !important; vertical-align: middle !important; font-size: 11px !important;';

        const pBtn1000 = document.createElement('button');
        pBtn1000.type = 'button';
        pBtn1000.textContent = '⚡ Điền 1000';
        pBtn1000.title = 'Điền 1000 cho tất cả các kho đang hoạt động';
        pBtn1000.style.cssText = 'padding: 2px 8px !important; font-size: 11px !important; font-weight: bold !important; background: #16a34a !important; color: white !important; border: 1px solid #15803d !important; border-radius: 3px !important; cursor: pointer !important;';
        pBtn1000.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFillMultiWarehousePopup('1000');
        };

        const pBtn0 = document.createElement('button');
        pBtn0.type = 'button';
        pBtn0.textContent = '⚡ Điền 0';
        pBtn0.title = 'Điền 0 cho tất cả các kho đang hoạt động';
        pBtn0.style.cssText = 'padding: 2px 8px !important; font-size: 11px !important; font-weight: bold !important; background: #dc2626 !important; color: white !important; border: 1px solid #b91c1c !important; border-radius: 3px !important; cursor: pointer !important;';
        pBtn0.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFillMultiWarehousePopup('0');
        };

        popupBtnWrap.append(pBtn1000, pBtn0);
        popupTitle.appendChild(popupBtnWrap);
      }
    }

    window.setInterval(injectRowStockQuickButtons, 400);
    
    if (!window.scrollButtonKiller) {
        window.scrollButtonKiller = new MutationObserver(() => removeOldScrollButtons(true));
        window.scrollButtonKiller.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  injectScrollButtons();

  function toggleBulkExcelBtn() {
    const btn = document.getElementById("shopee-qlsp-bulk-excel-btn");
    if (btn) {
        if (isOrderListPage()) {
            btn.style.setProperty("display", "flex", "important");
        } else {
            btn.style.setProperty("display", "none", "important");
        }
    }
  }
  window.setInterval(toggleBulkExcelBtn, 500);



  function isAwbPrintPage() {
    return window.location.href.includes("awbprint") || 
           window.location.href.includes("/waybill") || 
           window.location.href.includes("/receipt");
  }

  function injectAwbDownloadStyle() {
    if (document.getElementById(AWB_DOWNLOAD_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = AWB_DOWNLOAD_STYLE_ID;
    style.textContent = `
      #${AWB_DOWNLOAD_BUTTON_ID} {
        position: fixed !important;
        top: 60px !important;
        right: 30px !important;
        z-index: 2147483647 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        min-width: 150px !important;
        height: 46px !important;
        padding: 0 18px !important;
        border: 2px solid white !important;
        border-radius: 8px !important;
        color: #fff !important;
        background: #e11d48 !important;
        font: bold 14px/1 Arial, sans-serif !important;
        cursor: pointer !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        transition: all 0.2s ease !important;
      }

      #${AWB_DOWNLOAD_BUTTON_ID}:hover {
        background: #be123c !important;
        transform: scale(1.03) !important;
      }

      @media print {
        #${AWB_DOWNLOAD_BUTTON_ID} {
          display: none !important;
        }
      }
    `;
    document.documentElement.append(style);
  }

  function getAwbDownloadUrl() {
    const docs = [document];
    try {
      document.querySelectorAll("iframe, frame").forEach(iframe => {
        try {
          if (iframe.contentDocument && iframe.contentDocument.body) {
            docs.push(iframe.contentDocument);
          }
        } catch (e) {}
      });
    } catch (e) {}

    for (const doc of docs) {
      const embeddedPdf = Array.from(doc.querySelectorAll("iframe[src], embed[src], object[data], a[href]"))
        .map((element) => element.getAttribute("src") || element.getAttribute("data") || element.getAttribute("href"))
        .find((url) => {
          return url && (/\.pdf(?:[?#]|$)/i.test(url) || url.startsWith("blob:"));
        });
      if (embeddedPdf) {
        return new URL(embeddedPdf, window.location.href).href;
      }
    }
    return window.location.href;
  }

  async function getAwbFileName() {
    return new Promise(resolve => {
      chrome.storage.local.get(["dhHoanTextValue", "maGian", "awbCounter", "awbDate"], (res) => {
        const storeCode = (res.dhHoanTextValue || res.maGian || "gdd").toLowerCase();
        
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        const dateStr = `${day}${month}`;
        const timeStr = `${hours}${minutes}`;
        
        let counter = 1;
        if (res.awbDate === dateStr) {
          counter = (res.awbCounter || 0) + 1;
        }
        
        chrome.storage.local.set({ awbDate: dateStr, awbCounter: counter });
        
        const storeStr = storeCode ? `-${storeCode}` : "";
        const filename = `${dateStr}${storeStr}-${timeStr}-${counter}.pdf`;
        resolve(filename);
      });
    });
  }

  function setAwbDownloadStatus(button, text) {
    button.textContent = text;
    window.setTimeout(() => {
      if (document.contains(button)) {
        button.textContent = "Tải PDF";
      }
    }, 1800);
  }

  function downloadAwbInPage(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.documentElement.append(link);
    link.click();
    link.remove();
    return { ok: true, method: "page-link" };
  }

  function sendAwbDownloadMessage(url, filename) {
    return Promise.race([
      chrome.runtime.sendMessage({
        type: "DOWNLOAD_AWB_PDF",
        url,
        filename
      }),
      new Promise((resolve) => {
        window.setTimeout(() => {
          resolve({ ok: false, message: "Qua thoi gian cho tai PDF." });
        }, 10000);
      })
    ]);
  }

  async function downloadAwbPdf() {
    const filename = await getAwbFileName();
    const url = getAwbDownloadUrl();

    if (url && url !== window.location.href && (url.startsWith("blob:") || url.toLowerCase().includes(".pdf"))) {
      if (url.startsWith("blob:")) {
        return downloadAwbInPage(url, filename);
      }

      const response = await sendAwbDownloadMessage(url, filename);
      if (response?.ok) {
        return response;
      }
      return downloadAwbInPage(url, filename);
    }

    window.print();
    return { ok: true, method: "print" };
  }

  function injectAwbDownloadButton() {
    if (!isAwbPrintPage() || window !== window.top || document.getElementById(AWB_DOWNLOAD_BUTTON_ID)) {
      return;
    }

    injectAwbDownloadStyle();

    const button = document.createElement("button");
    button.id = AWB_DOWNLOAD_BUTTON_ID;
    button.type = "button";
    button.title = "Tải file PDF với tên tự động: {ddmm}-{gian}-{hhmm}-{stt}.pdf";
    button.textContent = "Tải PDF";
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Đang tải...";

      try {
        const response = await downloadAwbPdf();
        setAwbDownloadStatus(button, response?.ok ? "Đã tải" : "Lỗi tải");
      } catch (error) {
        setAwbDownloadStatus(button, "Lỗi tải");
      } finally {
        window.setTimeout(() => {
          if (document.contains(button)) {
            button.disabled = false;
          }
        }, 500);
      }
    });

    document.documentElement.append(button);

    // Lắng nghe khi bấm vào nút "Tải PDF" mặc định của Shopee để tự động tải với tên chuẩn
    if (!window.__shopeeNativePdfIntercepted) {
      window.__shopeeNativePdfIntercepted = true;
      document.addEventListener("click", (e) => {
        const btn = e.target.closest("button, a, div");
        if (btn && btn.id !== AWB_DOWNLOAD_BUTTON_ID && btn.textContent && 
            (btn.textContent.trim() === "Tải PDF" || btn.textContent.trim().includes("Tải PDF") || btn.textContent.trim().includes("Tải tập tin"))) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          downloadAwbPdf();
        }
      }, true);
    }
  }

  injectAwbDownloadButton();

  function isIncomePaidPage() {
    return window.location.href.startsWith("https://banhang.shopee.vn/portal/finance/income") &&
      new URLSearchParams(window.location.search).get("type") === "2";
  }

  function injectIncomeToThuChiStyle() {
    if (document.getElementById(INCOME_TO_THU_CHI_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = INCOME_TO_THU_CHI_STYLE_ID;
    style.textContent = `
      #${INCOME_TO_THU_CHI_BUTTON_ID} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 92px !important;
        height: 32px !important;
        margin-right: 10px !important;
        padding: 0 12px !important;
        border: 1px solid #ee4d2d !important;
        border-radius: 4px !important;
        color: #ee4d2d !important;
        background: #fff !important;
        font: 500 14px/1 Arial, sans-serif !important;
        cursor: pointer !important;
      }

      #${INCOME_TO_THU_CHI_BUTTON_ID}:hover {
        background: #fff4f1 !important;
      }

      #${INCOME_TO_THU_CHI_BUTTON_ID}:disabled {
        opacity: 0.7 !important;
        cursor: default !important;
      }

      #${INCOME_TO_THU_CHI_SUMMARY_ID} {
        display: inline-flex !important;
        align-items: center !important;
        min-width: 220px !important;
        height: 32px !important;
        margin-right: 10px !important;
        padding: 0 10px !important;
        border: 1px solid #d8dde6 !important;
        border-radius: 4px !important;
        color: #1f2d3d !important;
        background: #f8fafc !important;
        font: 500 13px/1 Arial, sans-serif !important;
        white-space: nowrap !important;
      }

      #${INCOME_TO_THU_CHI_SUMMARY_ID}[data-empty="true"] {
        color: #8c98a4 !important;
      }

      .${INCOME_ROW_ADD_BUTTON_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 22px !important;
        margin-top: 0 !important;
        padding: 0 8px !important;
        border: 1px solid #ee4d2d !important;
        border-radius: 4px !important;
        color: #ee4d2d !important;
        background: #fff !important;
        font: 600 12px/1 Arial, sans-serif !important;
        cursor: pointer !important;
      }

      .${INCOME_ROW_ADD_BUTTON_CLASS}:disabled {
        opacity: 0.65 !important;
        cursor: default !important;
      }

      #${INCOME_TO_THU_CHI_TABLE_ID} {
        margin: 10px 0 12px !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 4px !important;
        overflow: hidden !important;
        background: #fff !important;
        font: 13px/1.4 Arial, sans-serif !important;
      }

      #${INCOME_TO_THU_CHI_TABLE_ID} table {
        width: 100% !important;
        border-collapse: collapse !important;
      }

      #${INCOME_TO_THU_CHI_TABLE_ID} th,
      #${INCOME_TO_THU_CHI_TABLE_ID} td {
        padding: 8px 10px !important;
        border-bottom: 1px solid #edf0f2 !important;
        text-align: left !important;
        vertical-align: middle !important;
        color: #1f2d3d !important;
        white-space: nowrap !important;
      }

      #${INCOME_TO_THU_CHI_TABLE_ID} th {
        background: #f8fafc !important;
        font-weight: 600 !important;
      }

      #${INCOME_TO_THU_CHI_TABLE_ID} tr:last-child td {
        border-bottom: 0 !important;
      }

      #${INCOME_TO_THU_CHI_TABLE_ID} .income-empty-row {
        color: #8c98a4 !important;
        text-align: center !important;
      }
    `;
    document.documentElement.append(style);
  }

  function getOrderIdFromRow(row) {
    const orderIdElement = row.querySelector(".transaction-order .order-id");
    const directText = Array.from(orderIdElement?.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(" ")
      .trim();
    const text = directText || normalizeText(orderIdElement?.textContent || "");
    const match = text.match(/[A-Z0-9]{10,}/);

    return match?.[0] || "";
  }

  function parseShopeeMoney(value) {
    const cleaned = String(value || "").replace(/[^\d-]/g, "");
    return cleaned ? Number(cleaned) : "";
  }

  function getCellTextWithoutIncomeSummary(cell) {
    const clone = cell?.cloneNode(true);

    return normalizeText(clone?.textContent || "");
  }

  function getVisibleIncomeRows() {
    const rows = Array.from(document.querySelectorAll(".transaction-table .grid-table-body .grid-table-row"));

    return rows.map((row) => {
      const cells = Array.from(row.children);
      const mdh = getOrderIdFromRow(row);

      if (!mdh || cells.length < 5) {
        return null;
      }

      return {
        ngay: getCellTextWithoutIncomeSummary(cells[1]),
        mdh,
        so_tien: parseShopeeMoney(getCellTextWithoutIncomeSummary(cells[4]))
      };
    }).filter(Boolean);
  }

  function formatShopeeVnd(value) {
    const amount = Number(value || 0);

    return `\u0111${amount.toLocaleString("vi-VN")}`;
  }

  function getIncomeRowsSummary(incomeRows) {
    const total = incomeRows.reduce((sum, row) => sum + (Number(row.so_tien) || 0), 0);
    const dates = Array.from(new Set(incomeRows.map((row) => row.ngay).filter(Boolean)));

    return {
      total,
      dateText: dates.length === 1 ? dates[0] : `${dates[0] || ""} - ${dates[dates.length - 1] || ""}`,
      detailText: incomeRows.map((row, index) => `${index + 1}. ${row.ngay} | ${row.mdh} | ${formatShopeeVnd(row.so_tien)}`).join("\n")
    };
  }

  function updateIncomeSummaryPanel() {
    const panel = document.getElementById(INCOME_TO_THU_CHI_SUMMARY_ID);

    if (!panel) {
      return;
    }

    const incomeRows = getVisibleIncomeRows();

    if (!incomeRows.length) {
      panel.dataset.empty = "true";
      panel.textContent = "0 don | \u01110";
      panel.title = "Chua lay duoc dong nao de ghi";
      return;
    }

    const summary = getIncomeRowsSummary(incomeRows);

    panel.dataset.empty = "false";
    panel.textContent = `${incomeRows.length} don | ${formatShopeeVnd(summary.total)} | ${summary.dateText}`;
    panel.title = summary.detailText;
  }

  function createIncomeAddButton(incomeRow) {
    const addButton = document.createElement("button");

    addButton.type = "button";
    addButton.className = INCOME_ROW_ADD_BUTTON_CLASS;
    addButton.textContent = "Them";
    addButton.title = `Ghi rieng dong nay vao THU_CHI: ${incomeRow.ngay} | ${incomeRow.mdh} | ${formatShopeeVnd(incomeRow.so_tien)}`;
    addButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      addButton.disabled = true;

      try {
        await saveIncomeRowsToThuChi([incomeRow], addButton);
      } catch (error) {
        console.error(error);
        addButton.title = error?.message || "Loi ghi THU_CHI.";
        addButton.textContent = "Loi";
      } finally {
        window.setTimeout(() => {
          if (document.contains(addButton)) {
            addButton.disabled = false;
            addButton.textContent = "Them";
          }
        }, 1800);
      }
    });

    return addButton;
  }

  function updateIncomeInfoTable() {
    const tableWrap = document.getElementById(INCOME_TO_THU_CHI_TABLE_ID);

    if (!tableWrap) {
      return;
    }

    const incomeRows = getVisibleIncomeRows();
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    const headerRow = document.createElement("tr");

    ["Ngay", "Ma don", "So tien", ""].forEach((title) => {
      const th = document.createElement("th");

      th.textContent = title;
      headerRow.append(th);
    });
    thead.append(headerRow);

    if (!incomeRows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");

      td.colSpan = 4;
      td.className = "income-empty-row";
      td.textContent = "Chua co dong de ghi";
      tr.append(td);
      tbody.append(tr);
    } else {
      incomeRows.forEach((incomeRow) => {
        const tr = document.createElement("tr");
        const dateTd = document.createElement("td");
        const orderTd = document.createElement("td");
        const moneyTd = document.createElement("td");
        const actionTd = document.createElement("td");

        dateTd.textContent = incomeRow.ngay;
        orderTd.textContent = incomeRow.mdh;
        moneyTd.textContent = formatShopeeVnd(incomeRow.so_tien);
        actionTd.append(createIncomeAddButton(incomeRow));
        tr.append(dateTd, orderTd, moneyTd, actionTd);
        tbody.append(tr);
      });
    }

    table.append(thead, tbody);
    tableWrap.replaceChildren(table);
  }

  function normalizeIncomeActionText(value) {
    return normalizeText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0111/g, "d");
  }

  function setIncomeToThuChiStatus(button, text) {
    button.textContent = text;
    window.setTimeout(() => {
      if (document.contains(button)) {
        button.textContent = "T\u1ea3i thu chi";
      }
    }, 2200);
  }

  function sendRuntimeMessageWithTimeout(message, timeoutMs = 90000) {
    return Promise.race([
      chrome.runtime.sendMessage(message),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Qua 90 giay chua nhan phan hoi.")), timeoutMs);
      })
    ]);
  }

  async function saveIncomeToThuChi(button) {
    const incomeRows = getVisibleIncomeRows();

    if (!incomeRows.length) {
      setIncomeToThuChiStatus(button, "Khong co dong");
      return;
    }

    await saveIncomeRowsToThuChi(incomeRows, button);
  }

  async function saveIncomeRowsToThuChi(incomeRows, button) {
    button.textContent = "Dang ghi...";
    button.title = "Dang ghi cac dong dang hien thi vao sheet THU_CHI";
    const response = await sendRuntimeMessageWithTimeout({
      type: "SAVE_INCOME_TO_THU_CHI",
      rows: incomeRows
    });

    if (!response?.ok) {
      throw new Error(response?.message || "Khong ghi duoc THU_CHI.");
    }

    button.title = response.message || "Da ghi vao sheet THU_CHI";

    if (button.classList?.contains(INCOME_ROW_ADD_BUTTON_CLASS)) {
      button.textContent = "Da ghi";
      return;
    }

    setIncomeToThuChiStatus(button, `Da ghi ${response.count || incomeRows.length}`);
  }

  function findIncomeToolbar() {
    const exportButton = Array.from(document.querySelectorAll("button"))
      .find((button) => normalizeIncomeActionText(button.textContent) === "xuat" && isVisible(button));

    return exportButton?.parentElement || null;
  }

  function injectIncomeToThuChiButton() {
    if (!isIncomePaidPage()) {
      return;
    }

    if (document.getElementById(INCOME_TO_THU_CHI_BUTTON_ID)) {
      updateIncomeSummaryPanel();
      updateIncomeInfoTable();
      return;
    }

    const toolbar = findIncomeToolbar();

    if (!toolbar) {
      return;
    }

    injectIncomeToThuChiStyle();

    const summaryPanel = document.createElement("div");
    const infoTable = document.createElement("div");
    const button = document.createElement("button");

    summaryPanel.id = INCOME_TO_THU_CHI_SUMMARY_ID;
    summaryPanel.textContent = "Dang gom thong tin...";
    summaryPanel.title = "Dang gom thong tin cac dong dang hien thi";
    infoTable.id = INCOME_TO_THU_CHI_TABLE_ID;
    button.id = INCOME_TO_THU_CHI_BUTTON_ID;
    button.type = "button";
    button.textContent = "T\u1ea3i thu chi";
    button.title = "Ghi cac dong dang hien thi vao sheet THU_CHI";
    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await saveIncomeToThuChi(button);
      } catch (error) {
        console.error(error);
        button.title = error?.message || "Loi ghi THU_CHI.";
        setIncomeToThuChiStatus(button, "Loi ghi");
      } finally {
        window.setTimeout(() => {
          if (document.contains(button)) {
            button.disabled = false;
          }
        }, 500);
      }
    });

    toolbar.insertBefore(summaryPanel, toolbar.firstChild);
    toolbar.insertBefore(button, toolbar.firstChild);
    toolbar.parentElement?.insertBefore(infoTable, toolbar.nextSibling);
    updateIncomeSummaryPanel();
    updateIncomeInfoTable();
  }

  function injectProductListStyle() {
    if (document.getElementById(PRODUCT_LIST_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = PRODUCT_LIST_STYLE_ID;
    style.textContent = `
      html.${PRODUCT_LIST_CLASS} .eds-popper,
      html.${PRODUCT_LIST_CLASS} .eds-dropdown__popper,
      html.${PRODUCT_LIST_CLASS} .eds-popover__popper {
        z-index: 2147483646 !important;
      }

      html.${PRODUCT_LIST_CLASS} ul.eds-dropdown-menu {
        width: max-content !important;
        min-width: 128px !important;
        max-width: 240px !important;
        padding: 6px 0 !important;
        border: 1px solid #ee4d2d !important;
        border-radius: 4px !important;
        background: #fff !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18) !important;
        overflow: visible !important;
      }

      html.${PRODUCT_LIST_CLASS} ul.eds-dropdown-menu > div {
        display: block !important;
      }

      html.${PRODUCT_LIST_CLASS} ul.eds-dropdown-menu .eds-dropdown-item {
        display: flex !important;
        align-items: center !important;
        min-height: 32px !important;
        padding: 0 12px !important;
        color: #333 !important;
        font-size: 13px !important;
        line-height: 1.35 !important;
        white-space: nowrap !important;
        cursor: pointer !important;
      }

      html.${PRODUCT_LIST_CLASS} ul.eds-dropdown-menu .eds-dropdown-item:hover {
        color: #ee4d2d !important;
        background: #fff4f0 !important;
      }

      html.${PRODUCT_LIST_CLASS} ul.eds-dropdown-menu .eds-dropdown-item.disabled {
        color: #aaa !important;
        background: #fff !important;
        cursor: not-allowed !important;
      }

      html.${PRODUCT_LIST_CLASS} ul.eds-dropdown-menu .count-cool {
        color: #ee4d2d !important;
        font-weight: 600 !important;
      }

      html.${PRODUCT_LIST_CLASS} .${PRODUCT_LIST_QUICK_ACTION_CLASS} {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 4px !important;
        width: 100% !important;
        padding: 6px !important;
        border-top: 1px solid #f0f0f0 !important;
        background: #fff !important;
      }

      html.${PRODUCT_LIST_CLASS} .${PRODUCT_LIST_QUICK_ACTION_CLASS} button {
        min-width: 0 !important;
        min-height: 28px !important;
        padding: 0 5px !important;
        border: 1px solid #ffd7ca !important;
        border-radius: 4px !important;
        color: #ee4d2d !important;
        background: #fff7f4 !important;
        font: 600 12px/1 Arial, sans-serif !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        cursor: pointer !important;
      }

      html.${PRODUCT_LIST_CLASS} .${PRODUCT_LIST_QUICK_ACTION_CLASS} button:hover {
        border-color: #ee4d2d !important;
        background: #fff0ea !important;
      }

      html.${PRODUCT_LIST_CLASS} .${PRODUCT_LIST_QUICK_ACTION_CLASS} button.shopee-qlsp-copy-done {
        border-color: #17a36b !important;
        color: #0f8a59 !important;
        background: #f0fff8 !important;
      }
    `;
    document.documentElement.append(style);
  }

  function isProductListPage() {
    return window.location.pathname.startsWith("/portal/product/list");
  }

  function syncProductListClass() {
    document.documentElement.classList.toggle(PRODUCT_LIST_CLASS, isProductListPage());
  }

  function isProductEditPage() {
    const path = window.location.pathname;
    return path.startsWith("/portal/product/new") || (path.startsWith("/portal/product/") && !path.includes("/list"));
  }

  function injectWeightStyle() {
    if (document.getElementById(WEIGHT_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = WEIGHT_STYLE_ID;
    style.textContent = `
      .${WEIGHT_WRAP_CLASS} {
        display: inline-flex !important;
        gap: 6px !important;
        margin-left: 10px !important;
        align-items: center !important;
        vertical-align: middle !important;
      }

      .${WEIGHT_WRAP_CLASS} button {
        min-width: 50px !important;
        height: 32px !important;
        padding: 0 8px !important;
        border: 1px solid #ffd7ca !important;
        border-radius: 4px !important;
        color: #ee4d2d !important;
        background: #fff7f4 !important;
        font: 600 13px/1 Arial, sans-serif !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
      }

      .${WEIGHT_WRAP_CLASS} button:hover {
        border-color: #ee4d2d !important;
        background: #fff0ea !important;
        box-shadow: 0 2px 4px rgba(238, 77, 45, 0.1) !important;
      }

      .${WEIGHT_WRAP_CLASS} button:active {
        transform: translateY(1px) !important;
      }
    `;
    document.documentElement.append(style);
  }

  function findWeightInput() {
    const containers = Array.from(document.querySelectorAll(".edit-row, .eds-form-item, div"));
    const weightContainer = containers.find((element) => {
      const label = element.querySelector(".edit-label, label, .eds-form-item__label");

      return label && normalizeText(label.textContent).includes("C\u00e2n n\u1eb7ng (Sau khi \u0111\u00f3ng g\u00f3i)");
    });

    if (weightContainer) {
      const input = weightContainer.querySelector("input.eds-input__input");

      if (input) {
        return input;
      }
    }

    const suffixes = Array.from(document.querySelectorAll(".eds-input__suffix"));
    const grSuffix = suffixes.find((element) => normalizeText(element.textContent) === "gr");

    if (grSuffix) {
      return grSuffix.closest(".eds-input")?.querySelector("input");
    }

    return null;
  }

  function renderWeightQuickActions() {
    if (!isProductEditPage()) {
      return;
    }

    const input = findWeightInput();

    if (!input || !isVisible(input)) {
      return;
    }

    const inputWrap = input.closest(".eds-input") || input.parentElement;

    if (!inputWrap || inputWrap.dataset.shopeeQlspWeight === "1") {
      return;
    }

    injectWeightStyle();
    inputWrap.dataset.shopeeQlspWeight = "1";

    const wrap = document.createElement("div");

    wrap.className = WEIGHT_WRAP_CLASS;

    for (const value of WEIGHT_VALUES) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = value;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        fillInputLikeUser(input, value);
      });
      wrap.append(button);
    }

    inputWrap.insertAdjacentElement("afterend", wrap);
  }

  function findVariationLabel() {
    const labels = Array.from(document.querySelectorAll(".edit-label, .eds-form-item__label, span"));

    return labels.find((element) => {
      return normalizeText(element.textContent).includes("Ph\u00e2n lo\u1ea1i h\u00e0ng") && isVisible(element);
    });
  }

  function injectVariationStyle() {
    if (document.getElementById(VARIATION_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = VARIATION_STYLE_ID;
    style.textContent = `
      .${VARIATION_WRAP_CLASS} {
        display: inline-flex !important;
        gap: 6px !important;
        margin-left: 10px !important;
        align-items: center !important;
        vertical-align: middle !important;
      }

      .${VARIATION_WRAP_CLASS} button {
        min-width: 65px !important;
        height: 28px !important;
        padding: 0 8px !important;
        border: 1px solid #ffd7ca !important;
        border-radius: 4px !important;
        color: #ee4d2d !important;
        background: #fff7f4 !important;
        font: 600 12px/1 Arial, sans-serif !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
      }

      .${VARIATION_WRAP_CLASS} button:hover {
        border-color: #ee4d2d !important;
        background: #fff0ea !important;
        box-shadow: 0 2px 4px rgba(238, 77, 45, 0.1) !important;
      }
    `;
    document.documentElement.append(style);
  }

  function renderVariationQuickActions() {
    if (!isProductEditPage()) {
      return;
    }

    const label = findVariationLabel();

    if (!label || !isVisible(label) || label.dataset.shopeeQlspVariation === "1") {
      return;
    }

    injectVariationStyle();
    label.dataset.shopeeQlspVariation = "1";

    const wrap = document.createElement("div");

    wrap.className = VARIATION_WRAP_CLASS;

    for (const value of VARIATION_VALUES) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = value;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const input = findVariationNameInput();

        if (input) {
          fillInputLikeUser(input, value);
        } else {
          addVariationGroup(value);
        }
      });
      wrap.append(button);
    }

    label.insertAdjacentElement("afterend", wrap);
  }

  injectProductListStyle();
  syncProductListClass();
  window.setInterval(syncProductListClass, 500);
  window.setInterval(renderWeightQuickActions, 1000);
  window.setInterval(renderVariationQuickActions, 1000);

  function normalizeText(text) {
    return String(text || "")
      .replace(/…/g, "...")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeSearchText(text) {
    return normalizeText(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0111/g, "d")
      .replace(/\u0110/g, "d");
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function findAddProductTextNode() {
    const candidates = Array.from(document.querySelectorAll("span, a, div, li"));

    return candidates.find((element) => {
      return normalizeText(element.textContent) === ADD_PRODUCT_TEXT && isVisible(element);
    });
  }

  function findClickableTarget(element) {
    const selectors = [
      "a[href]",
      "button",
      "[role='button']",
      "[tabindex]",
      "[class*='menu']",
      ".shopee-menu-item",
      ".shopee-menu-item-link",
      ".eds-menu-item",
      ".eds-menu-item-label",
      "li",
      "div"
    ];

    for (const selector of selectors) {
      const target = element.closest(selector);

      if (target && isVisible(target)) {
        return target;
      }
    }

    return element;
  }

  function emitRealClick(element) {
    const rect = element.getBoundingClientRect();
    const options = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      view: window
    };

    element.dispatchEvent(new PointerEvent("pointerdown", options));
    element.dispatchEvent(new MouseEvent("mousedown", options));
    element.dispatchEvent(new PointerEvent("pointerup", options));
    element.dispatchEvent(new MouseEvent("mouseup", options));
    element.dispatchEvent(new MouseEvent("click", options));
  }

  function emitRealHover(element) {
    const rect = element.getBoundingClientRect();
    const options = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      view: window
    };

    element.dispatchEvent(new PointerEvent("pointerover", options));
    element.dispatchEvent(new MouseEvent("mouseover", options));
    element.dispatchEvent(new PointerEvent("pointerenter", options));
    element.dispatchEvent(new MouseEvent("mouseenter", options));
    element.dispatchEvent(new PointerEvent("pointermove", options));
    element.dispatchEvent(new MouseEvent("mousemove", options));
  }

  function openAddProductByUrl() {
    window.location.assign(ADD_PRODUCT_URL);
  }

  function dataUrlToFile(fileData) {
    const parts = String(fileData.dataUrl).split(",");
    const header = parts[0] || "";
    const base64 = parts[1] || "";
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mimeType = fileData.type || mimeMatch?.[1] || "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], fileData.name, {
      type: mimeType,
      lastModified: fileData.lastModified || Date.now()
    });
  }

  function isImageFileName(name) {
    return /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i.test(String(name || ""));
  }

  function isImageUrl(url) {
    try {
      const parsedUrl = new URL(url, window.location.href);

      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" || parsedUrl.protocol === "data:";
    } catch (error) {
      return false;
    }
  }

  function getExtensionFromMimeType(mimeType) {
    return {
      "image/avif": "avif",
      "image/bmp": "bmp",
      "image/gif": "gif",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[String(mimeType || "").split(";")[0].toLowerCase()] || "";
  }

  function getExtensionFromUrl(url) {
    try {
      const extension = new URL(url, window.location.href).pathname.split(".").pop()?.toLowerCase();

      return /^(?:avif|bmp|gif|jpeg|jpg|png|webp)$/.test(extension) ? extension : "";
    } catch (error) {
      return "";
    }
  }

  function getUrlsFromDroppedHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    return Array.from(doc.querySelectorAll("img"))
      .map((image) => image.currentSrc || image.src || image.getAttribute("src"))
      .filter(Boolean);
  }

  function getDroppedImageUrls(dataTransfer) {
    const candidates = [
      dataTransfer.getData("text/uri-list"),
      dataTransfer.getData("text/plain"),
      ...getUrlsFromDroppedHtml(dataTransfer.getData("text/html"))
    ]
      .flatMap((value) => String(value || "").split(/\r?\n/))
      .map((value) => value.trim())
      .filter((value) => value && !value.startsWith("#") && isImageUrl(value));

    return Array.from(new Set(candidates));
  }

  function getDroppedImageFiles(dataTransfer) {
    const items = Array.from(dataTransfer.items || []);
    const itemFiles = items
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);

    if (itemFiles.length) {
      return itemFiles;
    }

    return Array.from(dataTransfer.files || []).filter((file) => {
      return file.type.startsWith("image/") || isImageFileName(file.name);
    });
  }

  async function fileFromDroppedImageUrl(url, index) {
    if (url.startsWith("data:")) {
      return dataUrlToFile({
        name: `mo-ta-keo-tha-${String(index + 1).padStart(2, "0")}.png`,
        dataUrl: url
      });
    }

    const response = await fetch(url, { credentials: "omit" });

    if (!response.ok) {
      throw new Error(`Khong tai duoc anh vua keo: ${response.status}`);
    }

    const blob = await response.blob();
    const mimeType = blob.type || response.headers.get("content-type") || "image/jpeg";

    if (!String(mimeType).startsWith("image/")) {
      throw new Error("Du lieu vua keo khong phai anh.");
    }

    const extension = getExtensionFromMimeType(mimeType) || getExtensionFromUrl(url) || "jpg";

    return new File([blob], `mo-ta-keo-tha-${String(index + 1).padStart(2, "0")}.${extension}`, {
      type: mimeType,
      lastModified: Date.now()
    });
  }

  function findImageInput() {
    const directInput = document.querySelector(
      "input.eds-upload__input[type='file'][accept*='image']"
    );

    if (directInput && isVisible(directInput.closest(".eds-upload-wrapper") || directInput)) {
      return directInput;
    }

    const inputs = Array.from(document.querySelectorAll("input[type='file']"));

    return inputs.find((input) => {
      const wrapper = input.closest(".eds-upload-wrapper") || input.parentElement;
      const wrapperText = normalizeText(wrapper?.textContent || "");

      return (
        (input.accept || "").includes("image") &&
        (input.multiple || input.hasAttribute("multiple")) &&
        (wrapperText.includes(IMAGE_UPLOAD_TEXT) || input.getAttribute("aspect") === "1")
      );
    });
  }

  function showTopNotification(text, isError = false) {
    let notifyDiv = document.getElementById("shopee-qlsp-top-notification");
    if (!notifyDiv) {
      notifyDiv = document.createElement("div");
      notifyDiv.id = "shopee-qlsp-top-notification";
      notifyDiv.style.cssText = "position: fixed; top: 15px; left: 50%; transform: translateX(-50%); z-index: 999999; padding: 8px 18px; border-radius: 6px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.3s ease;";
      document.body.appendChild(notifyDiv);
    }
    notifyDiv.style.background = isError ? "#fef2f2" : "#f0fdf4";
    notifyDiv.style.color = isError ? "#991b1b" : "#166534";
    notifyDiv.style.border = isError ? "1px solid #fca5a5" : "1px solid #86efac";
    notifyDiv.textContent = text;
    notifyDiv.style.display = "block";

    clearTimeout(notifyDiv._timer);
    notifyDiv._timer = setTimeout(() => {
      notifyDiv.style.display = "none";
    }, 3500);
  }

  function uploadProductImages(filePayloads) {
    const input = findImageInput();

    if (!input) {
      const msg = "Không thấy ô Thêm hình ảnh trên trang này.";
      showTopNotification(msg, true);
      return {
        ok: false,
        message: msg
      };
    }

    const dataTransfer = new DataTransfer();
    const files = filePayloads.slice(0, 9).map(dataUrlToFile);

    for (const file of files) {
      dataTransfer.items.add(file);
    }

    input.files = dataTransfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));

    const msg = `Đã đưa ${files.length} ảnh vào ô Thêm hình ảnh.`;
    showTopNotification(msg, false);

    return {
      ok: true,
      message: msg
    };
  }

  function findDescriptionWrap() {
    return document.querySelector(".description-wrap") || document;
  }

  function findDescriptionUploadAction() {
    const container = findDescriptionWrap();
    const actions = Array.from(container.querySelectorAll(".image-upload-action, .action-content"));

    return actions.find((element) => {
      return normalizeText(element.textContent).includes("T\u1ea3i l\u00ean h\u00ecnh \u1ea3nh") && isVisible(element);
    });
  }

  function findDeviceUploadOption() {
    const candidates = Array.from(document.querySelectorAll("div, span, li"));

    return candidates.find((element) => {
      return normalizeText(element.textContent) === "T\u1eeb Thi\u1ebft b\u1ecb" && isVisible(element);
    });
  }

  function findDescriptionImageInput() {
    const dropdownInput = document.querySelector(
      ".eds-dropdown-menu .eds-upload.file-upload input.file-upload.eds-upload__input[type='file'][multiple]"
    );

    if (dropdownInput) {
      return dropdownInput;
    }

    const container = findDescriptionWrap();
    const fileUploadInput = container.querySelector(
      ".eds-upload.file-upload input.file-upload.eds-upload__input[type='file']"
    );

    if (fileUploadInput) {
      return fileUploadInput;
    }

    const editorUploadInput = container.querySelector(
      ".product-description-editor input[type='file'][accept*='image']"
    );

    if (editorUploadInput) {
      return editorUploadInput;
    }

    const inputs = Array.from(container.querySelectorAll("input[type='file']"));

    return inputs.find((input) => {
      const accept = input.accept || "";

      return accept.includes(".jpg") || accept.includes(".jpeg") || accept.includes(".png");
    });
  }

  function setFileInputFiles(input, files) {
    const dataTransfer = new DataTransfer();

    for (const file of files) {
      dataTransfer.items.add(file);
    }

    input.files = dataTransfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function focusDescriptionEditorEnd(editor = findProductDescriptionEditor()) {
    if (!editor) {
      return false;
    }

    editor.scrollIntoView({ block: "center", inline: "nearest" });
    editor.focus();

    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    editor.dispatchEvent(new Event("selectionchange", { bubbles: true, composed: true }));

    return true;
  }

  function setDescriptionEditorSelection(editor, range) {
    if (!editor || !range) {
      return false;
    }

    editor.focus();

    const selection = window.getSelection();

    selection.removeAllRanges();
    selection.addRange(range);
    editor.dispatchEvent(new Event("selectionchange", { bubbles: true, composed: true }));

    return true;
  }

  function getDescriptionEditorRangeFromPoint(clientX, clientY) {
    const editor = findProductDescriptionEditor();

    if (!editor) {
      return null;
    }

    let range = null;

    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(clientX, clientY);
    } else if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(clientX, clientY);

      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }

    if (!range || !editor.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    setDescriptionEditorSelection(editor, range);

    return range.cloneRange();
  }

  async function prepareDescriptionImageInput(options = {}) {
    if (options.focusEnd !== false) {
      focusDescriptionEditorEnd();
      await sleep(120);
    }

    const action = findDescriptionUploadAction();

    if (action) {
      emitRealClick(action);
      await sleep(150);
    }

    const deviceOption = findDeviceUploadOption();

    if (deviceOption) {
      emitRealClick(deviceOption);
      await sleep(150);
    }

    return findDescriptionImageInput();
  }

  async function uploadDescriptionImageFiles(files, options = {}) {
    if (!files.length) {
      const msg = "Không có ảnh để tải vào Mô tả sản phẩm.";
      showTopNotification(msg, true);
      return {
        ok: false,
        message: msg
      };
    }

    const input = await prepareDescriptionImageInput(options);

    if (!input) {
      const msg = "Không thấy input Từ Thiết bị trong Mô tả sản phẩm.";
      showTopNotification(msg, true);
      return {
        ok: false,
        message: msg
      };
    }

    if (options.selectionRange) {
      setDescriptionEditorSelection(findProductDescriptionEditor(), options.selectionRange);
      await sleep(80);
    }

    setFileInputFiles(input, files);

    const msg = `Đã đưa ${files.length} ảnh vào Mô tả sản phẩm, Shopee đang xử lý.`;
    showTopNotification(msg, false);

    return {
      ok: true,
      message: msg
    };
  }

  async function uploadDescriptionImages(filePayloads) {
    const files = filePayloads.slice(0, 12).map(dataUrlToFile);

    return uploadDescriptionImageFiles(files);
  }

  function hasImageDropData(dataTransfer) {
    const types = Array.from(dataTransfer?.types || []);

    return types.includes("Files")
      || types.includes("text/uri-list")
      || types.includes("text/plain")
      || types.includes("text/html");
  }

  async function handleDescriptionImageDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    const selectionRange = getDescriptionEditorRangeFromPoint(event.clientX, event.clientY);

    target.classList.remove("shopee-qlsp-description-drag-over");

    const droppedFiles = getDroppedImageFiles(event.dataTransfer);
    const droppedUrls = droppedFiles.length ? [] : getDroppedImageUrls(event.dataTransfer);

    if (!droppedFiles.length && !droppedUrls.length) {
      return;
    }

    try {
      const urlFiles = await Promise.all(droppedUrls.map(fileFromDroppedImageUrl));
      const files = [...droppedFiles, ...urlFiles].slice(0, 12);

      await uploadDescriptionImageFiles(files, {
        focusEnd: false,
        selectionRange
      });
    } catch (error) {
      console.warn("Shopee Helper: khong tai duoc anh keo vao mo ta", error);
    }
  }

  function bindDescriptionImageDrop() {
    const target = findProductDescriptionEditor() || findDescriptionWrap();

    if (!target?.dataset || !target?.classList || target.dataset.shopeeQlspDescriptionDrop === "1") {
      return;
    }

    injectDescriptionDropStyle();
    target.dataset.shopeeQlspDescriptionDrop = "1";
    target.classList.add("shopee-qlsp-description-drop-ready");

    target.addEventListener("dragenter", (event) => {
      if (!hasImageDropData(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      target.classList.add("shopee-qlsp-description-drag-over");
    });
    target.addEventListener("dragover", (event) => {
      if (!hasImageDropData(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      target.classList.add("shopee-qlsp-description-drag-over");
    });
    target.addEventListener("dragleave", (event) => {
      if (!target.contains(event.relatedTarget)) {
        target.classList.remove("shopee-qlsp-description-drag-over");
      }
    });
    target.addEventListener("drop", handleDescriptionImageDrop);
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function fillInputLikeUser(input, value) {
    const text = value !== undefined && value !== null ? String(value) : "";

    input.scrollIntoView({ block: "center", inline: "nearest" });
    
    // Simulate mouse interaction on the wrapper to activate custom event handlers
    const wrapper = input.closest('.eds-input, .eds-input-number') || input.parentElement || input;
    if (wrapper) {
      wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      wrapper.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      wrapper.click();
    }
    
    input.focus();
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    input.click();
    
    setNativeValue(input, "");
    input.setAttribute("modelvalue", "");

    for (const character of text) {
      const nextValue = input.value + character;

      input.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        composed: true,
        key: character
      }));
      input.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        composed: true,
        data: character,
        inputType: "insertText"
      }));
      setNativeValue(input, nextValue);
      input.setAttribute("modelvalue", nextValue);
      input.dispatchEvent(new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        composed: true,
        key: character
      }));
    }

    input.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    input.blur();
  }

  function findProductNameInput() {
    let input = document.querySelector(
      "input.eds-input__input[placeholder*='Tên thương hiệu + Loại sản phẩm'], input.eds-input__input[placeholder*='Tên sản phẩm'], input.eds-input__input[placeholder*='Tên thương hiệu']"
    );

    if (input && isVisible(input)) {
      return input;
    }

    return Array.from(document.querySelectorAll("input.eds-input__input, input[type='text']")).find((el) => {
      const p = normalizeText(el.placeholder || "");
      return p.includes("ten thuong hieu") || p.includes("ten san pham") || p.includes("loai san pham");
    });
  }

  function findProductDescriptionEditor() {
    const editables = Array.from(document.querySelectorAll("[contenteditable='true']"));
    
    // 1. Try finding by placeholder containing 'mo ta'
    let editor = editables.find((el) => {
      const p1 = normalizeSearchText(el.getAttribute("data-placeholder") || "");
      const p2 = normalizeSearchText(el.getAttribute("placeholder") || "");
      return p1.includes("mo ta") || p2.includes("mo ta");
    });
    
    if (editor && isVisible(editor)) return editor;

    // 2. Fallback: find any textarea with placeholder containing 'mo ta'
    const textareas = Array.from(document.querySelectorAll("textarea"));
    let textarea = textareas.find((el) => {
      const p1 = normalizeSearchText(el.getAttribute("placeholder") || "");
      const p2 = normalizeSearchText(el.placeholder || "");
      return p1.includes("mo ta") || p2.includes("mo ta");
    });

    if (textarea && isVisible(textarea)) return textarea;

    // 3. Fallback: return the first large editable or textarea (height > 50px)
    editor = editables.find(el => isVisible(el) && el.clientHeight > 50);
    if (editor) return editor;

    textarea = textareas.find(el => isVisible(el) && el.clientHeight > 50);
    if (textarea) return textarea;

    return null;
  }
  
  function fillDescriptionEditor(editor, text) {
    if (!editor || !text) return;
    editor.focus();
    
    if (editor.tagName && editor.tagName.toLowerCase() === "textarea") {
      setNativeValue(editor, text);
    } else {
      editor.classList.remove("ql-blank");
      editor.innerHTML = "";
      for (const line of text.split(/\r?\n/)) {
        const paragraph = document.createElement("p");
        paragraph.textContent = line || " ";
        editor.append(paragraph);
      }
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
      editor.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }
  }

  
  async function autoFillIfEmpty(product, brand) {
    let result = "";
    
    if (product.name) {
      const nameInput = findProductNameInput();
      if (nameInput && !nameInput.value.trim() && document.activeElement !== nameInput) {
        nameInput.focus();
        setNativeValue(nameInput, product.name);
        result += "Da auto dien ten. ";
      }
    }

    if (product.description) {
      const descriptionEditor = findProductDescriptionEditor();
      if (descriptionEditor) {
        let isEmpty = false;
        if (descriptionEditor.tagName && descriptionEditor.tagName.toLowerCase() === "textarea") {
           isEmpty = !descriptionEditor.value.trim();
        } else {
           isEmpty = (!descriptionEditor.textContent || !descriptionEditor.textContent.trim());
        }
        
        if (isEmpty && document.activeElement !== descriptionEditor) {
          fillDescriptionEditor(descriptionEditor, product.description);
          result += "Da auto dien mo ta. ";
        }
      }
    }

    if (brand) {
      const selector = findBrandSelector();
      if (selector) {
        const text = selector.textContent.trim().toLowerCase();
        if (!text || text.includes("vui") || text.includes("thi\u1ebft l\u1eadp")) {
          await fillProductBrand(brand);
          result += "Da auto dien brand. ";
        }
      }
    }
    
    return { ok: true, message: result.trim() || "Cac o da co du lieu, khong dien de." };
  }

  function fillProductText(product) {
    let filledCount = 0;

    if (product.name) {
      const nameInput = findProductNameInput();

      if (!nameInput) {
        return {
          ok: false,
          message: "Khong thay o Ten san pham."
        };
      }

      fillInputLikeUser(nameInput, product.name);
      filledCount += 1;
    }

    if (product.description) {
      const descriptionEditor = findProductDescriptionEditor();

      if (!descriptionEditor) {
        return {
          ok: false,
          message: "Khong thay o Mo ta san pham."
        };
      }

      fillDescriptionEditor(descriptionEditor, product.description);
      if (typeof focusDescriptionEditorEnd === 'function') {
        try { focusDescriptionEditorEnd(descriptionEditor); } catch(e) {}
      }
      filledCount += 1;
    }

    return {
      ok: true,
      message: `Da dien ${filledCount} muc thong tin san pham.`
    };
  }

  function findTextElementByExactText(text) {
    return Array.from(document.querySelectorAll("label, span, div, h3, p")).find((element) => {
      return normalizeText(element.textContent) === text && isVisible(element);
    });
  }

  function findRealTextInput(container) {
    if (!container) return null;
    const inputs = Array.from(container.querySelectorAll('input'));
    return inputs.find(input => {
      // Exclude dropdown inputs
      if (input.closest('.eds-select') || input.closest('.eds-selector') || input.closest('.eds-dropdown-menu') || input.closest('.eds-popover-content') || input.closest('.eds-select-dropdown')) {
        return false;
      }
      return true;
    });
  }

  async function fillProductAttribute(labelName, value) {
    const cleanValue = normalizeText(value);
    if (!cleanValue) {
      return { ok: false, message: `Chưa có giá trị cho ${labelName}.` };
    }

    let label = findTextElementByExactText(labelName);
    if (!label) {
      label = Array.from(document.querySelectorAll("label, span, div, h3, p")).find((element) => {
        return normalizeText(element.textContent).includes(labelName) && isVisible(element);
      });
    }
    if (!label) {
      return { ok: false, message: `Không tìm thấy nhãn "${labelName}" trên trang.` };
    }

    let rowContainer = label;
    let input = null;
    let selector = null;

    for (let depth = 0; depth < 8 && rowContainer; depth += 1) {
      const foundInput = findRealTextInput(rowContainer);
      const foundSelector = rowContainer.querySelector('.scroll-selector-content, .eds-selector__inner, .eds-select__inner');

      if (foundInput || (foundSelector && isVisible(foundSelector))) {
        input = foundInput;
        selector = foundSelector;
        break;
      }
      rowContainer = rowContainer.parentElement;
    }

    if (input) {
      fillInputLikeUser(input, cleanValue);
      return { ok: true, message: `Đã điền ${labelName}: ${cleanValue}` };
    }

    if (selector) {
      selector.scrollIntoView({ block: "center", inline: "nearest" });
      emitRealClick(selector);
      await sleep(350);

      const parts = cleanValue.split(",").map(p => p.trim()).filter(Boolean);
      let successCount = 0;

      for (const part of parts) {
        const option = findDropdownOptionByText(part);
        if (option) {
          emitRealClick(option);
          successCount++;
          await sleep(200);
        } else {
          const popoverInput = Array.from(document.querySelectorAll('.eds-dropdown-menu input, .eds-popover input, .eds-select-dropdown input, .eds-popover-content input')).find(isVisible);
          if (popoverInput) {
            popoverInput.focus();
            popoverInput.click();
            setNativeValue(popoverInput, "");
            popoverInput.setAttribute("modelvalue", "");
            setNativeValue(popoverInput, part);
            popoverInput.setAttribute("modelvalue", part);
            popoverInput.dispatchEvent(new KeyboardEvent("keyup", {
              bubbles: true,
              cancelable: true,
              composed: true,
              key: part.slice(-1) || " "
            }));
            await sleep(1500);

            const newOption = findDropdownOptionByText(part);
            if (newOption) {
              emitRealClick(newOption);
              successCount++;
              await sleep(200);
            }
          }
        }
      }

      if (successCount > 0) {
        return { ok: true, message: `Đã điền và chọn ${labelName}: ${cleanValue}` };
      }

      return { ok: false, message: `Không tìm thấy lựa chọn "${cleanValue}" trong dropdown của ${labelName}.` };
    }

    return { ok: false, message: `Không tìm thấy ô nhập liệu hoặc dropdown cho "${labelName}".` };
  }

  async function addNewProductAttribute(labelName, value) {
    const cleanValue = normalizeText(value);
    if (!cleanValue) {
      return { ok: false, message: `Chưa có giá trị cho ${labelName}.` };
    }

    let label = findTextElementByExactText(labelName);
    if (!label) {
      label = Array.from(document.querySelectorAll("label, span, div, h3, p")).find((element) => {
        return normalizeText(element.textContent).includes(labelName) && isVisible(element);
      });
    }
    if (!label) {
      return { ok: false, message: `Không tìm thấy nhãn "${labelName}" trên trang.` };
    }

    let container = label;
    let selector = null;

    for (let depth = 0; depth < 8 && container; depth += 1) {
      selector = container.querySelector('.scroll-selector-content, .eds-selector__inner, .eds-select__inner');
      if (selector && isVisible(selector)) {
        break;
      }
      const siblingSelector = Array.from(container.parentElement?.querySelectorAll('.scroll-selector-content, .eds-selector__inner, .eds-select__inner') || [])
        .find(isVisible);
      if (siblingSelector) {
        selector = siblingSelector;
        break;
      }
      container = container.parentElement;
    }

    if (!selector) {
      return { ok: false, message: `Không tìm thấy dropdown của "${labelName}" để thêm mới.` };
    }

    selector.scrollIntoView({ block: "center", inline: "nearest" });
    emitRealClick(selector);
    await sleep(350);

    const popoverInput = Array.from(document.querySelectorAll('.eds-dropdown-menu input, .eds-popover input, .eds-select-dropdown input, .eds-popover-content input')).find(isVisible);
    if (popoverInput) {
      popoverInput.focus();
      popoverInput.click();
      setNativeValue(popoverInput, "");
      popoverInput.setAttribute("modelvalue", "");
      setNativeValue(popoverInput, cleanValue);
      popoverInput.setAttribute("modelvalue", cleanValue);
      popoverInput.dispatchEvent(new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        composed: true,
        key: cleanValue.slice(-1) || " "
      }));
      await sleep(2000);
    }

    const dropdowns = Array.from(document.querySelectorAll(".eds-popover-content, .eds-dropdown-menu, .eds-select-dropdown, .eds-popover")).filter(isVisible);
    const dropdown = dropdowns[dropdowns.length - 1] || document;

    const addOption = Array.from(dropdown.querySelectorAll("div, span, li, button")).find((option) => {
      if (!isVisible(option)) return false;
      const text = normalizeText(option.textContent).toLowerCase();
      return (text.includes("thêm") || text.includes("add") || text.includes("tạo") || text.includes("create")) && text.includes(cleanValue.toLowerCase());
    });

    if (addOption) {
      emitRealClick(addOption);
      return { ok: true, message: `Đã kích hoạt thêm mới "${cleanValue}" cho ${labelName}.` };
    }

    return { ok: false, message: `Không tìm thấy nút thêm mới trong dropdown của ${labelName}.` };
  }

  function findDropdownOptionByText(textVal) {
    const normalizedVal = normalizeText(textVal).toLowerCase().trim();
    if (!normalizedVal) return null;

    const dropdowns = Array.from(document.querySelectorAll(".eds-popover-content, .eds-dropdown-menu, .eds-select-dropdown, .eds-popover, .eds-dropdown, .eds-select__menu")).filter(isVisible);
    const dropdown = dropdowns[dropdowns.length - 1] || document;

    const optionSelectors = [
      ".eds-option",
      ".eds-select__option",
      ".eds-select-dropdown__item",
      ".eds-dropdown-menu__item",
      ".eds-select__options > div",
      "[data-ls-upload-cmpt]"
    ].join(", ");

    const dedicatedOption = Array.from(dropdown.querySelectorAll(optionSelectors)).find((option) => {
      if (!isVisible(option)) return false;
      const text = normalizeText(option.textContent).toLowerCase().trim();
      return text === normalizedVal;
    });

    if (dedicatedOption) return dedicatedOption;

    const anyOption = Array.from(dropdown.querySelectorAll("div, span, li, p, a")).find((option) => {
      if (!isVisible(option)) return false;
      if (option.querySelector("input") || option.tagName === 'INPUT') return false;
      if (option.closest(".eds-select-dropdown__search") || option.closest(".eds-input")) return false;

      const text = normalizeText(option.textContent).toLowerCase().trim();
      return text === normalizedVal;
    });

    return anyOption;
  }

  function findBrandSelector() {
    const label = findTextElementByExactText("Th\u01b0\u01a1ng hi\u1ec7u");

    if (label) {
      let container = label;

      for (let depth = 0; depth < 8 && container; depth += 1) {
        const selector = Array.from(container.querySelectorAll(".eds-selector__inner")).find(isVisible);

        if (selector) {
          return selector;
        }

        const siblingSelector = Array.from(container.parentElement?.querySelectorAll(".eds-selector__inner") || [])
          .find(isVisible);

        if (siblingSelector) {
          return siblingSelector;
        }

        container = container.parentElement;
      }
    }

    return Array.from(document.querySelectorAll(".eds-selector__inner")).find((element) => {
      const text = normalizeText(element.textContent);

      return isVisible(element) && (text === "Haatz" || text === "Vui l\u00f2ng ch\u1ecdn" || text.length > 0);
    });
  }

  function findBrandDropdownInput() {
    return Array.from(document.querySelectorAll(".eds-dropdown-menu input.eds-input__input, input.eds-input__input")).find((input) => {
      return isVisible(input) && normalizeText(input.placeholder).includes("Vui l\u00f2ng nh\u1eadp t\u1ed1i thi\u1ec3u");
    });
  }

  function findBrandOption(brand) {
    const normalizedBrand = normalizeText(brand).toLowerCase();
    const dropdown = Array.from(document.querySelectorAll(".eds-dropdown-menu")).find(isVisible) || document;
    const optionSelectors = [
      ".eds-option",
      ".eds-select__option",
      ".eds-select__options > div",
      "[data-ls-upload-cmpt]"
    ].join(", ");

    return Array.from(dropdown.querySelectorAll(optionSelectors)).find((option) => {
      const text = normalizeText(option.textContent).toLowerCase();

      return (
        isVisible(option) &&
        text === normalizedBrand &&
        !option.querySelector("input") &&
        !option.closest(".eds-input") &&
        !option.closest(".eds-select_footer")
      );
    }) || Array.from(dropdown.querySelectorAll("div, span, li")).find((option) => {
      const text = normalizeText(option.textContent).toLowerCase();

      return (
        isVisible(option) &&
        text === normalizedBrand &&
        !option.querySelector("input") &&
        !option.closest(".eds-input") &&
        !option.closest(".eds-select_footer")
      );
    });
  }

  async function fillProductBrand(brand) {
    const cleanBrand = normalizeText(brand);

    if (!cleanBrand) {
      return {
        ok: false,
        message: "Chua co thuong hieu de dien."
      };
    }

    const selector = findBrandSelector();

    if (!selector) {
      return {
        ok: false,
        message: "Khong thay o Thuong hieu."
      };
    }

    selector.scrollIntoView({ block: "center", inline: "nearest" });
    emitRealClick(selector);
    await sleep(250);

    const input = findBrandDropdownInput();

    if (!input) {
      return {
        ok: false,
        message: "Khong thay o tim kiem Thuong hieu."
      };
    }

    input.focus();
    input.click();
    setNativeValue(input, "");
    input.setAttribute("modelvalue", "");
    setNativeValue(input, cleanBrand);
    input.setAttribute("modelvalue", cleanBrand);
    input.dispatchEvent(new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: cleanBrand.slice(-1) || " "
    }));
    await sleep(5000);

    const option = findBrandOption(cleanBrand);

    if (!option) {
      return {
        ok: false,
        message: `Khong thay thuong hieu ${cleanBrand} trong dropdown.`
      };
    }

    emitRealClick(option);

    return {
      ok: true,
      message: `Da chon thuong hieu ${cleanBrand}.`
    };
  }

  function isShopeeImageUrl(url) {
    try {
      const parsedUrl = new URL(url, window.location.href);
      const host = parsedUrl.hostname.toLowerCase();
      const path = parsedUrl.pathname.toLowerCase();

      return host.endsWith("susercontent.com")
        || (host.endsWith("shopee.vn") && path.startsWith("/file/"));
    } catch (error) {
      return false;
    }
  }

  function cleanShopeeImageUrl(url) {
    if (!url) {
      return "";
    }

    let absoluteUrl;

    try {
      absoluteUrl = new URL(url, window.location.href);
    } catch (error) {
      return "";
    }

    absoluteUrl.pathname = absoluteUrl.pathname
      .replace(/@resize_[^/]+$/, "")
      .replace(/_tn$/, "");
    absoluteUrl.search = "";
    absoluteUrl.hash = "";

    return absoluteUrl.toString();
  }

  function getUrlsFromSrcset(srcset) {
    return String(srcset || "")
      .split(",")
      .map((item) => item.trim().split(/\s+/)[0])
      .filter(Boolean);
  }

  function getUrlsFromInlineStyle(styleValue) {
    const urls = [];
    const pattern = /url\(["']?([^"')]+)["']?\)/g;
    let match;

    while ((match = pattern.exec(String(styleValue || "")))) {
      if (match[1]) {
        urls.push(match[1]);
      }
    }

    return urls;
  }

  function getImageCandidateUrls(element) {
    const urls = [];

    if (!element) {
      return urls;
    }

    for (const attr of ["src", "data-src", "data-original", "data-lazy-src", "lazy-src"]) {
      const value = element.getAttribute?.(attr);

      if (value) {
        urls.push(value);
      }
    }

    if (element.currentSrc) {
      urls.push(element.currentSrc);
    }

    urls.push(...getUrlsFromSrcset(element.getAttribute?.("srcset")));
    urls.push(...getUrlsFromSrcset(element.getAttribute?.("data-srcset")));
    urls.push(...getUrlsFromInlineStyle(element.getAttribute?.("style")));

    return urls;
  }

  function collectShopeeImageUrls(root = document) {
    const urls = [];

    root.querySelectorAll("img, source, [srcset], [data-src], [data-original], [data-lazy-src], [lazy-src], [style*='url(']")
      .forEach((element) => {
        urls.push(...getImageCandidateUrls(element));
      });

    return uniqueImageUrls(urls);
  }

  function findProductTitle() {
    const title = document.querySelector("h1.vR6K3w") || document.querySelector("h1");

    return normalizeText(title?.textContent || "");
  }

  function findProductBrand() {
    const brandRow = Array.from(document.querySelectorAll(".ybxj32, div")).find((element) => {
      return normalizeText(element.querySelector("h3")?.textContent || "") === "Th\u01b0\u01a1ng hi\u1ec7u";
    });

    if (!brandRow) {
      return "";
    }

    return normalizeText(brandRow.querySelector("a")?.textContent || "");
  }

  function findProductDescriptionSection() {
    return Array.from(document.querySelectorAll("section")).find((element) => {
      return normalizeText(element.querySelector("h2")?.textContent || "") === "M\u00d4 T\u1ea2 S\u1ea2N PH\u1ea8M";
    }) || document.querySelector("section.I_DV_3");
  }

  function findProductDescription() {
    const section = findProductDescriptionSection();

    if (!section) {
      return "";
    }

    const lines = Array.from(section.querySelectorAll("p.QN2lPu, p"))
      .map((paragraph) => normalizeText(paragraph.textContent))
      .filter((line) => line && !line.startsWith("To\u00e0n b\u1ed9 th\u00f4ng tin v\u1ec1 s\u1ea3n ph\u1ea9m"));

    return lines.join("\n");
  }

  async function findProductDescriptionImageUrls() {
    const section = findProductDescriptionSection();

    if (!section) {
      return [];
    }

    section.scrollIntoView({ block: "start", inline: "nearest" });
    await sleep(350);

    return collectShopeeImageUrls(section);
  }

  function findMainProductImageUrl() {
    const selectors = [
      ".UdI7e2 picture img",
      ".UdI7e2 img",
      ".TMw1ot picture img",
      ".TMw1ot img[alt*='Product image']",
      "img[alt*='Product image']",
      "meta[property='og:image']",
      "link[rel='image_src']"
    ];

    for (const selector of selectors) {
      const image = Array.from(document.querySelectorAll(selector)).find((element) => {
        if (element.tagName === "META" || element.tagName === "LINK") {
          return isShopeeImageUrl(element.getAttribute("content") || element.getAttribute("href"));
        }

        return isVisible(element) && getImageCandidateUrls(element).some((url) => {
          const cleanUrl = cleanShopeeImageUrl(url);

          return isShopeeImageUrl(cleanUrl) && !cleanUrl.includes("_cover");
        });
      });

      if (image) {
        if (image.tagName === "META") {
          return cleanShopeeImageUrl(image.getAttribute("content"));
        }

        if (image.tagName === "LINK") {
          return cleanShopeeImageUrl(image.getAttribute("href"));
        }

        return uniqueImageUrls(getImageCandidateUrls(image))[0] || "";
      }
    }

    return "";
  }

  function uniqueImageUrls(urls) {
    const seen = new Set();
    const results = [];

    for (const url of urls) {
      const cleanUrl = cleanShopeeImageUrl(url);

      if (!cleanUrl || seen.has(cleanUrl) || !isShopeeImageUrl(cleanUrl)) {
        continue;
      }

      seen.add(cleanUrl);
      results.push(cleanUrl);
    }

    return results;
  }

  function collectProductImageUrlsFromDom() {
    const roots = [
      document.querySelector("section._OguPS"),
      document.querySelector(".UdI7e2")?.closest("section, div"),
      document.querySelector(".TMw1ot")?.closest("section, div"),
      document.querySelector("[class*='product-briefing']"),
      document.querySelector("[class*='ProductBriefing']")
    ].filter(Boolean);

    for (const root of Array.from(new Set(roots))) {
      const urls = collectShopeeImageUrls(root);

      if (urls.length) {
        return urls;
      }
    }

    const metaUrls = Array.from(document.querySelectorAll("meta[property='og:image'], link[rel='image_src']"))
      .map((element) => element.getAttribute("content") || element.getAttribute("href"));
    const urlsFromMeta = uniqueImageUrls(metaUrls);

    return urlsFromMeta.length ? urlsFromMeta : collectShopeeImageUrls(document).slice(0, 12);
  }

  function findGalleryNextButton() {
    const gallery = document.querySelector("section._OguPS") || document;
    const directButton = gallery.querySelector("button.lWmpR1");

    if (directButton && isVisible(directButton)) {
      return directButton;
    }

    return Array.from(gallery.querySelectorAll("button")).find((button) => {
      const icon = button.querySelector("img[alt*='arrow right']");

      return icon && isVisible(button);
    });
  }

  async function findProductImageUrls() {
    injectProductGalleryStyle();

    const seen = new Set();
    const results = [];
    let stillCount = 0;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const urls = collectProductImageUrlsFromDom();
      let addedCount = 0;

      for (const url of urls) {
        if (!seen.has(url)) {
          seen.add(url);
          results.push(url);
          addedCount += 1;
        }
      }

      const nextButton = findGalleryNextButton();

      if (!nextButton) {
        break;
      }

      if (!addedCount) {
        stillCount += 1;
      } else {
        stillCount = 0;
      }

      if (stillCount >= 4) {
        break;
      }

      emitRealClick(nextButton);
      await sleep(250);
    }

    return results;
  }

  function renderFullProductGallery(imageUrls) {
    const section = document.querySelector("section._OguPS");
    const thumbnailWrap = section?.querySelector(".airUhU");

    if (!section || !thumbnailWrap || !imageUrls.length) {
      return;
    }

    let helperGallery = section.querySelector(".shopee-qlsp-full-gallery");

    if (!helperGallery) {
      helperGallery = document.createElement("div");
      helperGallery.className = "shopee-qlsp-full-gallery";
      thumbnailWrap.insertAdjacentElement("afterend", helperGallery);
    }

    helperGallery.textContent = "";

    for (const imageUrl of imageUrls) {
      const image = document.createElement("img");

      image.src = imageUrl;
      image.alt = "Shopee product image";
      image.loading = "lazy";
      image.addEventListener("click", () => {
        const mainImage = section.querySelector(".UdI7e2 img, .TMw1ot img[alt*='Product image'], img[alt*='Product image']");

        if (mainImage) {
          mainImage.src = imageUrl;
          mainImage.srcset = "";
        }
      });
      helperGallery.append(image);
    }

    section.classList.add("shopee-qlsp-gallery-ready");
  }

  async function refreshVisibleProductGallery() {
    if (!document.querySelector("section._OguPS .airUhU")) {
      return;
    }

    const imageUrls = await findProductImageUrls();

    renderFullProductGallery(imageUrls);
  }

  function findProductDetails() {
    const details = {};
    const rows = document.querySelectorAll('.RNeUsI .c0ztn1, .c0ztn1, .ybxj32');
    rows.forEach(row => {
      const labelNode = row.querySelector('h3');
      if (!labelNode) return;
      const label = labelNode.textContent.trim();
      
      const valNode = row.querySelector('div, a:not(h3 a)');
      if (valNode) {
        if (label === 'Danh Mục') {
          return;
        }
        details[label] = valNode.textContent.trim();
      }
    });
    return details;
  }

  async function extractShopeeProduct() {
    const name = findProductTitle();
    const brand = findProductBrand();
    const description = findProductDescription();
    const descriptionImageUrls = await findProductDescriptionImageUrls();
    const imageUrl = findMainProductImageUrl();
    const imageUrls = await findProductImageUrls();
    const details = findProductDetails();

    renderFullProductGallery(imageUrls);

    if (!name && !description && !descriptionImageUrls.length && !imageUrl && !imageUrls.length) {
      return {
        ok: false,
        message: "Khong thay ten, mo ta hoac anh san pham tren trang nay."
      };
    }

    return {
      ok: true,
      name,
      brand,
      description,
      descriptionImageUrls,
      imageUrl,
      imageUrls: imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [],
      details
    };
  }

  async function extractBuyerProduct() {
    let name = "";
    let description = "";
    let brand = "No Brand";
    let images = [];
    let details = {};
    let priceText = "0";

    // 1. Get Title from document.title
    if (document.title) {
      name = document.title.split('|')[0].trim();
      if (name.toLowerCase() === "shopee") {
        name = "";
      }
    }

    // 2. Semantic Scrape for Description & Details
    const headings = Array.from(document.querySelectorAll('h2, h3, div, span, label'));
    
    // Find Description
    const descHeader = headings.find(el => {
      const txt = el.textContent.trim();
      return txt === "MÔ TẢ SẢN PHẨM" || txt === "Product Description";
    });
    if (descHeader) {
      const sibling = descHeader.nextElementSibling || descHeader.parentElement?.nextElementSibling;
      if (sibling) {
        description = sibling.textContent.trim();
      }
    }

    // Find Specifications / Details
    const specsHeader = headings.find(el => {
      const txt = el.textContent.trim();
      return txt === "CHI TIẾT SẢN PHẨM" || txt === "Product Specifications";
    });
    if (specsHeader) {
      const sibling = specsHeader.nextElementSibling || specsHeader.parentElement?.nextElementSibling;
      if (sibling) {
        const rows = Array.from(sibling.querySelectorAll('div, tr, .flex'));
        rows.forEach(row => {
          const labelEl = row.querySelector('label, td:first-child, div:first-child');
          const valEl = row.querySelector('div:last-child, td:last-child, a');
          if (labelEl && valEl && labelEl !== valEl) {
            const k = labelEl.textContent.replace(/[\:\>]/g, "").trim();
            const v = valEl.textContent.trim();
            if (k && v && k !== v && k.length < 40) {
              details[k] = v;
              if (k.includes("Thương hiệu") || k.toLowerCase().includes("brand")) {
                brand = v;
              }
            }
          }
        });
      }
    }

    // 3. Fallback to selectors if empty
    if (!name) {
      const titleEl = document.querySelector('h1, h2, h3, ._44qnta, .product-title');
      name = titleEl ? titleEl.textContent.trim() : "";
    }

    if (!description) {
      const descEl = document.querySelector('.irpt4H, .product-detail, ._3y123, pre, [style*="white-space: pre-wrap"]');
      description = descEl ? descEl.textContent.trim() : "";
    }

    // 4. Scrape Images with recommendation filter
    const imgElements = Array.from(document.querySelectorAll('img')).filter(img => {
      const src = img.src || img.getAttribute('src') || "";
      return src.includes('down-vn.img.susercontent.com/file/') || src.includes('cf.shopee.vn/file/');
    });

    const briefingImages = imgElements.filter(img => {
      let parent = img.parentElement;
      while (parent) {
        const cls = (parent.className || "").toString().toLowerCase();
        const id = (parent.id || "").toString().toLowerCase();
        if (cls.includes("recommend") || cls.includes("sidebar") || cls.includes("footer") || cls.includes("header") || cls.includes("related") || cls.includes("top-product")) {
          return false;
        }
        parent = parent.parentElement;
      }
      return true;
    });

    images = Array.from(new Set(briefingImages.map(img => {
      const src = img.src || img.getAttribute('src') || "";
      return src.split('_')[0];
    }))).filter(src => src.startsWith('http'));

    // 5. Scrape Price
    const priceEl = document.querySelector('.pqTWkA, .product-price, ._2OBmZ7');
    if (priceEl) {
      priceText = priceEl.textContent.replace(/[đ\.\s₫đ]/g, "").trim();
    }

    // Clean up details keys/values
    const cleanDetails = {};
    for (const [k, v] of Object.entries(details)) {
      if (k && v && k.length < 50) {
        cleanDetails[k] = v;
      }
    }

    return {
      ok: true,
      name,
      description,
      brand: brand || cleanDetails["Thương hiệu"] || "No Brand",
      images,
      details: cleanDetails,
      priceText
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function isMoreIconPath(path) {
    const d = path?.getAttribute?.("d") || "";

    return d.includes("M3.5,7") && d.includes("13.5");
  }

  function findProductMoreClickTarget(path, row) {
    const pathRect = path.getBoundingClientRect();
    const pathX = pathRect.left + pathRect.width / 2;
    const pathY = pathRect.top + pathRect.height / 2;
    let current = path.parentElement;
    let bestTarget = path.closest("svg") || path.parentElement;

    while (current && current !== row.parentElement) {
      const rect = current.getBoundingClientRect();
      const containsIcon = (
        rect.left <= pathX &&
        rect.right >= pathX &&
        rect.top <= pathY &&
        rect.bottom >= pathY
      );

      if (
        containsIcon &&
        rect.width >= 20 &&
        rect.width <= 90 &&
        rect.height >= 20 &&
        rect.height <= 60 &&
        isVisible(current)
      ) {
        bestTarget = current;
      }

      if (current === row) {
        break;
      }

      current = current.parentElement;
    }

    return bestTarget;
  }

  function findProductActionRows() {
    const rows = [];
    const paths = Array.from(document.querySelectorAll("path")).filter(isMoreIconPath);

    for (const path of paths) {
      let current = path.parentElement;

      for (let depth = 0; current && depth < 8; depth += 1) {
        const rect = current.getBoundingClientRect();

        if (
          rect.width >= 120 &&
          rect.width <= 260 &&
          rect.height >= 24 &&
          rect.height <= 70 &&
          current.querySelector("svg") &&
          isVisible(current)
        ) {
          rows.push({
            row: current,
            moreTarget: findProductMoreClickTarget(path, current)
          });
          break;
        }

        current = current.parentElement;
      }
    }

    return rows.filter((entry, index) => {
      return rows.findIndex((item) => item.row === entry.row) === index;
    });
  }

  function findVisibleDropdownItem(text) {
    const items = Array.from(document.querySelectorAll("ul.eds-dropdown-menu .eds-dropdown-item"));

    return items.find((item) => {
      return normalizeText(item.textContent) === text && isVisible(item);
    });
  }

  function clickElementAtCenter(element) {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const target = document.elementFromPoint(clientX, clientY) || element;
    const options = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      view: window
    };

    target.dispatchEvent(new PointerEvent("pointerdown", options));
    target.dispatchEvent(new MouseEvent("mousedown", options));
    target.dispatchEvent(new PointerEvent("pointerup", options));
    target.dispatchEvent(new MouseEvent("mouseup", options));
    target.dispatchEvent(new MouseEvent("click", options));

    if (typeof target.click === "function") {
      target.click();
    }
  }

  function hoverElementAtCenter(element) {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const target = document.elementFromPoint(clientX, clientY) || element;
    const options = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      view: window
    };

    target.dispatchEvent(new PointerEvent("pointerover", options));
    target.dispatchEvent(new MouseEvent("mouseover", options));
    target.dispatchEvent(new PointerEvent("pointerenter", options));
    target.dispatchEvent(new MouseEvent("mouseenter", options));
    target.dispatchEvent(new PointerEvent("pointermove", options));
    target.dispatchEvent(new MouseEvent("mousemove", options));
  }

  async function waitForVisibleDropdownItem(text) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const item = findVisibleDropdownItem(text);

      if (item) {
        return item;
      }

      await sleep(80);
    }

    return null;
  }

  function openProductListPreview(productCard) {
    const url = getProductListLink(productCard);

    if (!url) {
      return false;
    }

    window.open(url, "_blank", "noopener");
    return true;
  }

  async function clickProductListAction(moreButton, actionText, productCard) {
    if (actionText === PRODUCT_LIST_ACTIONS[0] && openProductListPreview(productCard)) {
      return;
    }

    hoverElementAtCenter(moreButton);
    await sleep(180);
    clickElementAtCenter(moreButton);

    const item = await waitForVisibleDropdownItem(actionText);

    if (!item) {
      return;
    }

    if (item.classList.contains("disabled")) {
      return;
    }

    clickElementAtCenter(item);
  }

  function findProductCardFromActionRow(row) {
    return row.closest(".product-item") || row.closest(".product-card-item") || row;
  }

  function getProductListName(productCard) {
    const nameElement = productCard.querySelector(".product-name .eds-popover__ref")
      || productCard.querySelector(".product-name-wrap")
      || productCard.querySelector(".product-name");

    return normalizeText(nameElement?.textContent || "");
  }

  function getProductListItemId(productCard) {
    const link = productCard.querySelector("a[href*='/portal/product/']");

    if (link) {
      const match = link.getAttribute("href")?.match(/\/portal\/product\/(\d+)/);

      if (match?.[1]) {
        return match[1];
      }
    }

    const checkbox = productCard.querySelector(".product-checkbox input[name]");

    return checkbox?.name?.match(/^\d+$/) ? checkbox.name : "";
  }

  function isLikelyShopeeId(value) {
    return /^\d{6,16}$/.test(String(value || ""));
  }

  function findShopIdInObject(value, depth = 0) {
    if (!value || depth > 5) {
      return "";
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const shopId = findShopIdInObject(item, depth + 1);

        if (shopId) {
          return shopId;
        }
      }

      return "";
    }

    if (typeof value !== "object") {
      return "";
    }

    for (const [key, item] of Object.entries(value)) {
      if (/^(shopid|shop_id|shopId|shopID)$/.test(key) && isLikelyShopeeId(item)) {
        return String(item);
      }

      const nestedShopId = findShopIdInObject(item, depth + 1);

      if (nestedShopId) {
        return nestedShopId;
      }
    }

    return "";
  }

  function findShopIdInStorageValue(value) {
    const text = String(value || "");
    const directMatch = text.match(/["']?(?:shopid|shop_id|shopId|shopID)["']?\s*[:=]\s*["']?(\d{6,16})/);

    if (directMatch?.[1]) {
      return directMatch[1];
    }

    try {
      return findShopIdInObject(JSON.parse(text));
    } catch {
      return "";
    }
  }

  function getProductListShopId() {
    if (cachedProductListShopId) {
      return cachedProductListShopId;
    }

    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        const shopId = findShopIdInStorageValue(storage.getItem(key));

        if (shopId) {
          cachedProductListShopId = shopId;
          return shopId;
        }
      }
    }

    return "";
  }

  function getProductListLink(productCard) {
    const itemId = getProductListItemId(productCard);
    const shopId = getProductListShopId();

    if (!itemId || !shopId) {
      return "";
    }

    return `https://shopee.vn/product/${shopId}/${itemId}/`;
  }

  async function copyTextToClipboard(text) {
    if (!text) {
      return false;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();

    const ok = document.execCommand("copy");

    textarea.remove();
    return ok;
  }

  function showCopyButtonState(button, successText) {
    const oldText = button.textContent;

    button.textContent = successText;
    button.classList.add("shopee-qlsp-copy-done");
    window.setTimeout(() => {
      button.textContent = oldText;
      button.classList.remove("shopee-qlsp-copy-done");
    }, 1000);
  }

  function createCopyButton(text, getValue) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.title = text;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const value = await Promise.resolve(getValue());

      if (await copyTextToClipboard(value)) {
        showCopyButtonState(button, "\u0110\u00e3 copy");
      } else {
        showCopyButtonState(button, "Thi\u1ebfu link");
      }
    });

    return button;
  }

  function isOrderListPage() {
    return window.location.pathname.startsWith("/portal/sale/order");
  }

  function injectOrderSnCopyStyle() {
    if (document.getElementById(ORDER_SN_COPY_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = ORDER_SN_COPY_STYLE_ID;
    style.textContent = `
      .${ORDER_SN_COPY_BUTTON_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 28px !important;
        min-width: 28px !important;
        height: 24px !important;
        margin-left: 6px !important;
        padding: 0 !important;
        border: 1px solid #d8dee8 !important;
        border-radius: 4px !important;
        color: #2673dd !important;
        background: #fff !important;
        font: 700 12px/1 Arial, sans-serif !important;
        cursor: pointer !important;
        vertical-align: middle !important;
      }

      .${ORDER_SN_COPY_BUTTON_CLASS}:hover {
        border-color: #2673dd !important;
        background: #eef5ff !important;
      }

      .${ORDER_SN_COPY_BUTTON_CLASS}.shopee-qlsp-copy-done {
        border-color: #17a36b !important;
        color: #0f8a59 !important;
        background: #f0fff8 !important;
      }
      .ud-ct-badge {
        display: inline-flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 2px !important;
        margin: 0 8px !important;
        vertical-align: middle !important;
      }

      .ud-ct-badge-row {
        display: inline-flex !important;
        align-items: center !important;
        max-width: 760px !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        color: #fff !important;
        font: 700 12px/1.35 Arial, sans-serif !important;
        white-space: normal !important;
        word-break: break-word !important;
      }
    `;
    document.documentElement.append(style);
  }

  function getOrderSnFromText(text) {
    const normalized = normalizeText(text);
    const match = normalized.match(/(?:M[\u00e3a]\s*\u0111\u01a1n\s*h[\u00e0a]ng|ma\s*don\s*hang)?\s*([A-Z0-9]{10,})/i);

    return match?.[1] || "";
  }

  
  function getCustomExcelFilename(maGian = "bce") {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    
    const dateKey = `shopee_excel_stt_${dd}${mm}`;
    let dailyStt = parseInt(localStorage.getItem(dateKey) || '0', 10) + 1;
    localStorage.setItem(dateKey, dailyStt);
    
    const cleanGian = String(maGian || "").trim().toLowerCase();
    return `${dd}${mm}-${cleanGian}-${hh}${m}-${dailyStt}.xlsx`;
  }

  function renderOrderSnCopyButtons() {
    updateDonHangMdhCache().then(() => updateCopyAllButtonColors());
    if (!isOrderListPage()) {
      return;
    }

    updateUdCtMdhIdsCache().then(() => updateUdCtBadgeColors());
    updateUdCtBadgeColors();

    injectOrderSnCopyStyle();

    for (const orderSnElement of document.querySelectorAll("span.order-sn")) {
      if (orderSnElement.dataset.shopeeQlspOrderSnCopy === "1") {
        continue;
      }

      const orderSn = getOrderSnFromText(orderSnElement.textContent);

      if (!orderSn) {
        continue;
      }

      const button = document.createElement("button");

      orderSnElement.dataset.shopeeQlspOrderSnCopy = "1";
      
      // Inject custom checkbox for bulk export
      if (!orderSnElement.parentNode.querySelector('.shopee-qlsp-bulk-checkbox')) {
        const customCb = document.createElement("input");
        customCb.type = "checkbox";
        customCb.className = "shopee-qlsp-bulk-checkbox";
        customCb.style.marginRight = "10px";
        customCb.style.transform = "scale(1.5)";
        customCb.style.cursor = "pointer";
        customCb.title = "TÃ­ch Ä‘á»ƒ táº£i file Excel hÃ ng loáº¡t";
        orderSnElement.parentNode.insertBefore(customCb, orderSnElement);
      }


      const badge = document.createElement("span");
      badge.textContent = "UD_CT...";
      badge.className = "ud-ct-badge";
      badge.dataset.shopeeQlspOrderId = orderSn;
      badge.dataset.shopeeQlspUdCtFilled = "0";
      badge.style.padding = "2px 6px";
      badge.style.borderRadius = "4px";
      badge.style.fontSize = "12px";
      badge.style.fontWeight = "bold";
      badge.style.border = "none";
      
      if (cachedUdCtMdhIds.has(orderSn)) {
          badge.innerHTML = cachedUdCtMdhIds.get(orderSn);
          badge.style.backgroundColor = "#22c55e";
          badge.style.color = "white";
      } else {
          badge.style.backgroundColor = "transparent";
          badge.style.color = "#64748b";
      }
      
      let tempContainer = orderSnElement;
      let orderContainer = null;
      while (tempContainer && tempContainer.tagName !== "BODY") {
          const snCount = tempContainer.querySelectorAll("span.order-sn").length;
          if (snCount > 1) break;
          // shoppe lists order in a card. we can usually identify it by containing item-name or tracking-number or specific classes
          if (tempContainer.querySelector(".eds-button--link") || tempContainer.querySelector("button")) {
              orderContainer = tempContainer;
          }
          tempContainer = tempContainer.parentElement;
      }
      
      let xemChiTietBtn = null;
      if (orderContainer) {
          const btns = Array.from(orderContainer.querySelectorAll("button"));
          xemChiTietBtn = btns.find(b => (b.textContent || b.innerText || "").trim() === "Xem chi tiết");
      }
      
      if (xemChiTietBtn) {
          let badgeWrapper = document.createElement("div");
          badgeWrapper.style.marginTop = "8px";
          badgeWrapper.style.width = "100%";
          badgeWrapper.style.display = "flex";
          badgeWrapper.style.justifyContent = "center"; // center or flex-end depending on the layout, looking at the image it's on the right
          badgeWrapper.style.alignItems = "center";
          badgeWrapper.appendChild(badge);
          xemChiTietBtn.parentElement.appendChild(badgeWrapper);
      } else {
          orderSnElement.parentNode.insertBefore(badge, orderSnElement);
      }
      button.type = "button";
      button.className = ORDER_SN_COPY_BUTTON_CLASS;
      button.textContent = "C";
      button.title = `Copy ma don hang ${orderSn}`;
      button.setAttribute("aria-label", `Copy ma don hang ${orderSn}`);
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (await copyTextToClipboard(orderSn)) {
          showCopyButtonState(button, "OK");
        } else {
          showCopyButtonState(button, "Loi");
        }
      });

      const copyAllBtn = document.createElement("button");
      copyAllBtn.type = "button";
      copyAllBtn.className = ORDER_SN_COPY_BUTTON_CLASS + " btn-copy-all-check";
      copyAllBtn.dataset.shopeeQlspCopyAllOrderId = orderSn;
      copyAllBtn.textContent = "Copy All";
      if (cachedDonHangMdhIndices.has(orderSn) || cachedDhHoanIds.has(orderSn)) {
          copyAllBtn.style.backgroundColor = "#cbb89d"; // màu be
          copyAllBtn.style.borderColor = "#b7a285";
          copyAllBtn.style.color = "#3d3124";
          copyAllBtn.style.fontWeight = "bold";
      }
      copyAllBtn.title = `Copy toan bo thong tin don hang ${orderSn}`;
      copyAllBtn.setAttribute("aria-label", `Copy toan bo thong tin don hang ${orderSn}`);
      copyAllBtn.style.width = "auto";
      copyAllBtn.style.padding = "0 8px";
      copyAllBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        let orderContainer = orderSnElement;
        let lastValidContainer = null;
        while (orderContainer && orderContainer.tagName !== "BODY") {
          const snCount = orderContainer.querySelectorAll("span.order-sn").length;
          if (snCount > 1) break;
          if (orderContainer.querySelector("div.item-name")) {
            lastValidContainer = orderContainer;
          }
          orderContainer = orderContainer.parentElement;
        }
        orderContainer = lastValidContainer;

        if (!orderContainer) {
          showCopyButtonState(copyAllBtn, "Loi");
          return;
        }

        const getCleanText = (el) => {
          if (!el) return "";
          const clone = el.cloneNode(true);
          clone.querySelectorAll('button, .shopee-qlsp-sku-display, .shopee-qlsp-copy-button, .btn-copy-price, .injected-sku-ct, .tracking-copy-btn, .order-copy-btn').forEach(n => n.remove());
          return clone.textContent.replace(/\s+/g, ' ').trim();
        };

        const trackingEl = orderContainer.querySelector("div.tracking-number");
        const trackingText = getCleanText(trackingEl);

        const productInfos = [];
        for (const nameEl of orderContainer.querySelectorAll("div.item-name")) {
          const nameText = getCleanText(nameEl);
          const varEl = nameEl.parentElement.querySelector("div.item-description");
          const varText = getCleanText(varEl);
          
          let skuText = "";
          let sibling = (varEl || nameEl).nextElementSibling;
          while (sibling) {
            if (sibling.classList.contains("shopee-qlsp-sku-display")) {
              skuText = getCleanText(sibling);
              break;
            }
            if (sibling.classList.contains("item-name")) break;
            sibling = sibling.nextElementSibling;
          }
          
          productInfos.push({ name: nameText, variation: varText, sku: skuText });
        }

        let copyText = `Mã vận đơn: ${trackingText || "Chưa có"}\nMã đơn hàng: ${orderSn}`;
        for (const p of productInfos) {
          copyText += `\n-----\n`;
          if (p.sku) copyText += `${p.sku}\n`;
          copyText += `Tên SP: ${p.name}`;
          if (p.variation) copyText += `\nPhân loại: ${p.variation}`;
        }

        if (await copyTextToClipboard(copyText)) {
          showCopyButtonState(copyAllBtn, "OK");
        } else {
          showCopyButtonState(copyAllBtn, "Loi");
        }
      });


      const excelBtn = document.createElement("button");
      excelBtn.type = "button";
      excelBtn.className = ORDER_SN_COPY_BUTTON_CLASS;
      excelBtn.textContent = "Excel";
      excelBtn.title = "Tải Excel đơn hàng";
      excelBtn.style.width = "auto";
      excelBtn.style.padding = "0 8px";
      excelBtn.style.marginLeft = "6px";
      excelBtn.style.backgroundColor = "#107c41"; // Excel green
      excelBtn.style.color = "white";
      excelBtn.style.borderColor = "#107c41";
      
      excelBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        let orderContainer = orderSnElement;
        let lastValidContainer = null;
        while (orderContainer && orderContainer.tagName !== "BODY") {
          const snCount = orderContainer.querySelectorAll("span.order-sn").length;
          if (snCount > 1) break;
          if (orderContainer.querySelector("div.item-name")) {
            lastValidContainer = orderContainer;
          }
          orderContainer = orderContainer.parentElement;
        }
        orderContainer = lastValidContainer;

        if (!orderContainer) {
          showCopyButtonState(excelBtn, "Loi");
          return;
        }

        const getCleanText = (el) => {
          if (!el) return "";
          const clone = el.cloneNode(true);
          clone.querySelectorAll('button, .shopee-qlsp-sku-display, .shopee-qlsp-copy-button, .btn-copy-price, .injected-sku-ct, .tracking-copy-btn, .order-copy-btn').forEach(n => n.remove());
          return clone.textContent.replace(/\s+/g, ' ').trim();
        };

        const trackingEl = orderContainer.querySelector("div.tracking-number");
        const trackingText = getCleanText(trackingEl);

        const priceEl = orderContainer.querySelector("div.total-price");
        const priceText = getCleanText(priceEl).replace(/[^\d]/g, '');

        const items = orderContainer.querySelectorAll("div.item");
        
        const headers = ["MÃ£ Ä‘Æ¡n hÃ ng", "MÃ£ Kiá»‡n HÃ ng", "NgÃ y Ä‘áº·t hÃ ng", "Tráº¡ng ThÃ¡i ÄÆ¡n HÃ ng", "Nháº­n xÃ©t tá»« NgÆ°á»i mua", "MÃ£ váº­n Ä‘Æ¡n", "ÄÆ¡n Vá»‹ Váº­n Chuyá»ƒn", "PhÆ°Æ¡ng thá»©c giao hÃ ng", "Loáº¡i Ä‘Æ¡n hÃ ng", "NgÃ y giao hÃ ng dá»± kiáº¿n", "NgÃ y gá»­i hÃ ng", "Thá»i gian giao hÃ ng", "Tráº¡ng thÃ¡i Tráº£ hÃ ng/HoÃ n tiá»n", "SKU sáº£n pháº©m", "TÃªn sáº£n pháº©m", "CÃ¢n náº·ng sáº£n pháº©m", "Tá»•ng cÃ¢n náº·ng", "TÃªn kho hÃ ng", "SKU phÃ¢n loáº¡i hÃ ng", "TÃªn phÃ¢n loáº¡i hÃ ng", "GiÃ¡ gá»‘c", "NgÆ°á»i bÃ¡n trá»£ giÃ¡", "ÄÆ°á»£c Shopee trá»£ giÃ¡", "Tá»•ng sá»‘ tiá»n Ä‘Æ°á»£c ngÆ°á»i bÃ¡n trá»£ giÃ¡", "GiÃ¡ gá»‘c (Y)", "Sá»‘ lÆ°á»£ng", "Sá»‘ lÆ°á»£ng sáº£n pháº©m Ä‘Æ°á»£c hoÃ n tráº£", "Tá»•ng sá»‘ tiá»n NgÆ°á»i mua thanh toÃ¡n"];
        
        const rowsData = [headers];
        
        items.forEach(itemEl => {
          const amountEl = itemEl.querySelector("div.item-amount");
          const quantity = getCleanText(amountEl).replace(/[^\d]/g, '') || "1";
          
          let skuText = "";
          const varEl = itemEl.querySelector("div.item-description");
          const nameEl = itemEl.querySelector("div.item-name");
          let sibling = (varEl || nameEl)?.nextElementSibling;
          while (sibling) {
            if (sibling.classList.contains("shopee-qlsp-sku-display")) {
              skuText = getCleanText(sibling).replace(/^SKU:\s*/i, '');
              break;
            }
            if (sibling.classList.contains("item-name")) break;
            sibling = sibling.nextElementSibling;
          }
          
          let row = new Array(28).fill("");
          row[0] = orderSn; // A
          row[5] = trackingText; // F
          row[6] = "Nhanh-SPX Express"; // G
          row[18] = skuText; // S
          row[24] = priceText ? String(parseInt(priceText, 10) * 10 + 10000000) : ""; // Y
          row[25] = quantity; // Z
          
          rowsData.push(row);
        });
        
        chrome.storage.local.get(["maGian", "dhHoanTextValue"], (res) => {
          const maGian = res.maGian || res.dhHoanTextValue || "bce";
          try {
            if (typeof XLSX === "undefined") {
              alert("Đang tải thư viện Excel, vui lòng thử lại sau 1-2 giây!");
              return;
            }
            const ws = XLSX.utils.aoa_to_sheet(rowsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Orders");
            const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
            const dataUrl = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + base64;
            chrome.runtime.sendMessage({
              type: "FORCE_DOWNLOAD",
              url: dataUrl,
              filename: getCustomExcelFilename(maGian)
            });
            showCopyButtonState(excelBtn, "OK");
          } catch (e) {
            console.error(e);
            showCopyButtonState(excelBtn, "Loi");
          }
        });
      });

      orderSnElement.insertAdjacentElement("afterend", excelBtn);
      orderSnElement.insertAdjacentElement("afterend", copyAllBtn);

      orderSnElement.insertAdjacentElement("afterend", button);
    }
  }

  function renderItemNameCopyButtons() {
    if (!isOrderListPage()) {
      return;
    }

    injectOrderSnCopyStyle();

    for (const itemNameElement of document.querySelectorAll("div.item-name")) {
      if (itemNameElement.dataset.shopeeQlspItemNameCopy === "1") {
        continue;
      }

      const itemName = itemNameElement.textContent.trim();

      if (!itemName) {
        continue;
      }

      const button = document.createElement("button");

      itemNameElement.dataset.shopeeQlspItemNameCopy = "1";
      button.type = "button";
      button.className = ORDER_SN_COPY_BUTTON_CLASS;
      button.textContent = "C";
      button.title = `Copy ten san pham ${itemName}`;
      button.setAttribute("aria-label", `Copy ten san pham ${itemName}`);
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (await copyTextToClipboard(itemName)) {
          showCopyButtonState(button, "OK");
        } else {
          showCopyButtonState(button, "Loi");
        }
      });

      // Äáº·t nÃºt á»Ÿ Ä‘áº§u Ä‘á»ƒ khÃ´ng bá»‹ áº©n khi tÃªn sáº£n pháº©m quÃ¡ dÃ i (bá»‹ Shopee cáº¯t báº±ng dáº¥u ...)
      button.style.marginLeft = "0";
      button.style.marginRight = "6px";
      itemNameElement.prepend(button);
    }
  }

  function renderTrackingNumberCopyButtons() {
    if (!isOrderListPage()) {
      return;
    }

    injectOrderSnCopyStyle();

    for (const trackingElement of document.querySelectorAll("div.tracking-number")) {
      if (trackingElement.dataset.shopeeQlspTrackingCopy === "1") {
        continue;
      }

      const trackingNumber = trackingElement.textContent.trim();

      if (!trackingNumber) {
        continue;
      }

      const button = document.createElement("button");

      trackingElement.dataset.shopeeQlspTrackingCopy = "1";
      button.type = "button";
      button.className = ORDER_SN_COPY_BUTTON_CLASS;
      button.textContent = "C";
      button.title = `Copy ma van don ${trackingNumber}`;
      button.setAttribute("aria-label", `Copy ma van don ${trackingNumber}`);
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (await copyTextToClipboard(trackingNumber)) {
          showCopyButtonState(button, "OK");
        } else {
          showCopyButtonState(button, "Loi");
        }
      });

      trackingElement.append(button);
    }
  }

  let spShopeePromise = null;

  function loadSpShopeeData() {
    if (!spShopeePromise) {
      spShopeePromise = new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "FETCH_SP_SHOPEE" }, (response) => {
          if (response && response.ok) {
            resolve(response.values);
          } else {
            console.error("Loi khi lay du lieu SP_SHOPEE:", response?.error);
            resolve(null);
          }
        });
      });
    }
    return spShopeePromise;
  }

  function getShopeeSkuFromRow(row) {
    const sku = String(row?.[5] || "").trim();
    return sku || String(row?.[4] || "").trim();
  }

  function isShopeeSkuFallbackFromProductSku(row) {
    return !String(row?.[5] || "").trim() && !!String(row?.[4] || "").trim();
  }

  function isShopeeProductNameMatch(sheetName, productName) {
    const normSheetName = normalizeText(sheetName).toLowerCase();
    const normProductName = normalizeText(productName).toLowerCase();

    if (!normSheetName || !normProductName) return false;

    const sheetPrefix = normSheetName.replace(/\.\.\.$/, "").trim();
    const productPrefix = normProductName.replace(/\.\.\.$/, "").trim();

    return normSheetName === normProductName ||
      (normProductName.endsWith("...") && normSheetName.startsWith(productPrefix)) ||
      (normSheetName.endsWith("...") && normProductName.startsWith(sheetPrefix)) ||
      normProductName.includes(normSheetName) ||
      normSheetName.includes(normProductName);
  }

  async function renderProductSkus() {
    if (!isOrderListPage()) {
      return;
    }

    const data = await loadSpShopeeData();
    if (!data || !data.length) {
      return;
    }
    
    const storageRes = await new Promise(resolve => chrome.storage.local.get(["maGian", "dhHoanTextValue"], resolve));
    const maGian = (storageRes.maGian || storageRes.dhHoanTextValue || "").trim().toLowerCase();

    for (const nameEl of document.querySelectorAll("div.item-name")) {
      const currentText = nameEl.textContent.trim();
      if (nameEl.dataset.shopeeQlspSkuRendered === "1" && nameEl.dataset.shopeeQlspLastText === currentText) {
        continue;
      }

      // Remove any existing sku display under the parent
      const parent = nameEl.parentElement;
      if (parent) {
        parent.querySelectorAll(".shopee-qlsp-sku-display").forEach(el => el.remove());
      }

      const cloneName = nameEl.cloneNode(true);
      cloneName.querySelectorAll('button, .shopee-qlsp-sku-display, .shopee-qlsp-copy-button').forEach(n => n.remove());
      const itemNameClean = cloneName.textContent.replace(/\s+/g, ' ').trim();

      if (!itemNameClean) {
        continue;
      }

      const varEl = nameEl.parentElement.querySelector("div.item-description");
      let varText = "";
      
      if (varEl) {
        const cloneVar = varEl.cloneNode(true);
        cloneVar.querySelectorAll('button, .shopee-qlsp-sku-display, .shopee-qlsp-copy-button').forEach(n => n.remove());
        varText = cloneVar.textContent.replace(/\s+/g, ' ').trim();
      }

      const normItemName = normalizeText(itemNameClean).toLowerCase();
      const normItemVar = normalizeText(varText).toLowerCase();
      const cleanItemVar = normItemVar.replace(/^(variation|ph\u00e2n lo\u1ea1i h\u00e0ng|ph\u00e2n lo\u1ea1i)\s*:\s*/i, "").trim();

      let matchedSku = null;

      for (const row of data) {
        const sheetName = (row[1] || "").trim();
        const sheetVar = (row[3] || "").trim();
        const sheetSku = getShopeeSkuFromRow(row);
        const isFallbackProductSku = isShopeeSkuFallbackFromProductSku(row);
        const sheetGian = (row[11] || "").trim(); // Col L (index 11)

        if (!sheetName) continue;
        
        // Filter by maGian if it is set
        if (maGian && sheetGian.toLowerCase() !== maGian) continue;

        const isNameMatch = isShopeeProductNameMatch(sheetName, itemNameClean);

        if (!isNameMatch) continue;

        const normSheetVar = normalizeText(sheetVar).toLowerCase();
        
        let isVarMatch = false;
        if (isFallbackProductSku || (!normSheetVar && !cleanItemVar)) {
          isVarMatch = true;
        } else if (normSheetVar && cleanItemVar) {
          if (normSheetVar === cleanItemVar || cleanItemVar.includes(normSheetVar) || normSheetVar.includes(cleanItemVar)) {
            isVarMatch = true;
          }
        }

        if (isNameMatch && isVarMatch && sheetSku) {
          matchedSku = sheetSku;
          break;
        }
      }

      nameEl.dataset.shopeeQlspSkuRendered = "1";
      nameEl.dataset.shopeeQlspLastText = currentText;

      if (matchedSku) {
        const skuDiv = document.createElement("div");
        skuDiv.className = "shopee-qlsp-sku-display";
        skuDiv.style.color = "#ee4d2d";
        skuDiv.style.fontWeight = "bold";
        skuDiv.style.marginTop = "4px";
        skuDiv.style.fontSize = "13px";
        skuDiv.textContent = `SKU: ${matchedSku}`;

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = ORDER_SN_COPY_BUTTON_CLASS;
        copyBtn.textContent = "C";
        copyBtn.title = `Copy SKU ${matchedSku}`;
        copyBtn.setAttribute("aria-label", `Copy SKU ${matchedSku}`);
        copyBtn.style.marginLeft = "6px";
        copyBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (await copyTextToClipboard(matchedSku)) {
            showCopyButtonState(copyBtn, "OK");
          } else {
            showCopyButtonState(copyBtn, "Loi");
          }
        });

        skuDiv.append(copyBtn);
        
        if (varEl) {
          varEl.insertAdjacentElement("afterend", skuDiv);
        } else {
          nameEl.insertAdjacentElement("afterend", skuDiv);
        }
      }
    }
  }

  let globalSpShopeePromise = null;
  function getSpShopeeDataList() {
      if (window.cachedSpShopee) return Promise.resolve(window.cachedSpShopee);
      if (!globalSpShopeePromise) {
          globalSpShopeePromise = new Promise(resolve => {
              chrome.runtime.sendMessage({ type: "FETCH_SP_SHOPEE" }, (res) => {
                  if (res && res.ok && res.values) {
                      window.cachedSpShopee = res.values;
                  }
                  resolve(window.cachedSpShopee || []);
              });
          });
      }
      return globalSpShopeePromise;
  }

  function createProductListQuickActions(moreButton, productCard) {
    const wrap = document.createElement("div");

    wrap.className = PRODUCT_LIST_QUICK_ACTION_CLASS;

    for (const actionText of PRODUCT_LIST_ACTIONS) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = actionText;
      button.title = actionText;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        if (actionText === PRODUCT_LIST_ACTIONS[0]) {
          const now = Date.now();
          const lastPreviewClick = Number(button.dataset.shopeeQlspLastPreviewClick || "0");

          if (now - lastPreviewClick < 1000) {
            return;
          }

          button.dataset.shopeeQlspLastPreviewClick = String(now);
        }

        await clickProductListAction(moreButton, actionText, productCard);
      });
      wrap.append(button);
    }

    wrap.append(
      createCopyButton(PRODUCT_LIST_COPY_LINK_TEXT, () => getProductListLink(productCard)),
      createCopyButton(PRODUCT_LIST_COPY_NAME_TEXT, () => getProductListName(productCard))
    );
    
    const skuContainer = document.createElement("div");
    skuContainer.style.gridColumn = "1 / -1";
    skuContainer.style.padding = "4px 0 0 0";
    skuContainer.style.fontSize = "11px";
    skuContainer.style.display = "flex";
    skuContainer.style.flexWrap = "wrap";
    skuContainer.style.gap = "4px";
    skuContainer.style.maxHeight = "54px";
    skuContainer.style.overflowY = "auto";
    skuContainer.style.overflowX = "hidden";
    skuContainer.className = "shopee-qlsp-custom-scrollbar"; // Will style scrollbar if needed
    wrap.append(skuContainer);

    const productName = getProductListName(productCard).trim();
    if (productName) {
        skuContainer.textContent = "Đang tải SKU...";
        chrome.storage.local.get(["maGian", "dhHoanTextValue"], (res) => {
            const maGian = (res.maGian || res.dhHoanTextValue || "").trim().toLowerCase();
            getSpShopeeDataList().then(spData => {
                const skus = [];
                for (const row of spData) {
                    const tenSp = String(row[1] || "").trim(); // Cột B
                    const sku = getShopeeSkuFromRow(row); // Col F, fallback to Col E
                    const gian = String(row[11] || "").trim().toLowerCase(); // Cột L
                    
                    if (isShopeeProductNameMatch(tenSp, productName) && (!maGian || gian === maGian) && sku) {
                        if (!skus.includes(sku)) skus.push(sku);
                    }
                }
                
                if (skus.length > 0) {
                    skuContainer.innerHTML = skus.map(s => {
                        let shortSku = s;
                        const match = s.match(/^[a-zA-Z0-9\-]+/);
                        if (match) {
                            shortSku = match[0].replace(/-+$/, '');
                        }
                        shortSku = shortSku.slice(0, 15);
                        return `<span title="${s}" style="background:#f0fff8;color:#0f8a59;border:1px solid #17a36b;padding:2px 4px;border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;cursor:help;display:inline-block;">${shortSku}</span>`;
                    }).join("");
                } else {
                    skuContainer.textContent = "";
                    skuContainer.style.padding = "0";
                }
            });
        });
    }

    return wrap;
  }

  function renderProductListQuickActions() {
    if (!isProductListPage()) {
      return;
    }

    for (const { row, moreTarget } of findProductActionRows()) {
      if (row.dataset.shopeeQlspQuickActions === "1") {
        continue;
      }

      if (row.nextElementSibling?.classList.contains(PRODUCT_LIST_QUICK_ACTION_CLASS)) {
        continue;
      }

      row.dataset.shopeeQlspQuickActions = "1";
      row.insertAdjacentElement("afterend", createProductListQuickActions(moreTarget, findProductCardFromActionRow(row)));
    }
  }

  function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll("button"));

    return buttons.find((button) => {
      return normalizeText(button.textContent) === text && isVisible(button);
    });
  }

  function findVariationNameInput() {
    const directInput = document.querySelector(
      "input.eds-input__input[placeholder='e.g. Color, etc']"
    );

    if (directInput && isVisible(directInput)) {
      return directInput;
    }

    return Array.from(document.querySelectorAll("input[type='text']")).find((input) => {
      return normalizeText(input.placeholder) === "e.g. Color, etc" && isVisible(input);
    });
  }

  async function waitForVariationNameInput() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const input = findVariationNameInput();

      if (input) {
        return input;
      }

      await sleep(150);
    }

    return null;
  }

  async function addVariationGroup(name) {
    const button = findButtonByText(ADD_VARIATION_TEXT);

    if (!button) {
      return {
        ok: false,
        message: "Khong thay nut Them nhom phan loai."
      };
    }

    button.scrollIntoView({ block: "center", inline: "nearest" });
    emitRealClick(button);

    const input = await waitForVariationNameInput();

    if (!input) {
      return {
        ok: false,
        message: "Da bam nut nhung khong thay o nhap ten phan loai."
      };
    }

    fillInputLikeUser(input, name || "ph\u00e2n lo\u1ea1i");

    return {
      ok: true,
      message: "Da them nhom phan loai va dien ten phan loai."
    };
  }

  function clickAddProduct() {
    const textNode = findAddProductTextNode();

    if (!textNode) {
      openAddProductByUrl();
      return {
        ok: true,
        method: "fallback-url",
        message: "Khong thay menu, da mo truc tiep trang Them San Pham."
      };
    }

    const target = findClickableTarget(textNode);

    target.scrollIntoView({ block: "center", inline: "nearest" });
    const previousUrl = window.location.href;

    emitRealClick(target);

    window.setTimeout(() => {
      if (window.location.href === previousUrl) {
        openAddProductByUrl();
      }
    }, 400);

    return {
      ok: true,
      method: "click",
      message: "Da bam Them San Pham. Neu Shopee khong nhan click, extension se mo truc tiep."
    };
  }

  function findStockBatchInput() {
    const inputs = Array.from(document.querySelectorAll("input.eds-input__input, input"));

    // Uu tien o nhap co placeholder Warehouse-Level (thuong la o sua hang loat)
    const batchInput = inputs.find((input) => {
      const placeholder = normalizeText(input.placeholder);
      return (placeholder.includes("Warehouse-Level") || placeholder.includes("Kho h\u00e0ng(")) && isVisible(input);
    });

    if (batchInput) {
      return batchInput;
    }

    // Tim o nhap Kho hang bat ky neu khong thay o hang loat
    return inputs.find((input) => {
      const placeholder = normalizeText(input.placeholder);
      return (placeholder === "Kho h\u00e0ng" || placeholder.includes("Kho h\u00e0ng")) && isVisible(input);
    });
  }

  function findApplyToAllButton() {
    const directButton = document.querySelector("button.batch-apply-button");

    if (directButton && isVisible(directButton)) {
      return directButton;
    }

    const buttons = Array.from(document.querySelectorAll("button"));

    return buttons.find((button) => {
      return normalizeText(button.textContent).includes("\u00c1p d\u1ee5ng cho t\u1ea5t c\u1ea3 ph\u00e2n lo\u1ea1i") && isVisible(button);
    });
  }

  function findSaveProductButton() {
    const buttons = Array.from(document.querySelectorAll("button.eds-button--xl-large, button"));
    return buttons.find((button) => {
      const text = String(button.textContent || "").trim().toLowerCase();
      const hasText = text.includes("cập nhật") || text.includes("save") || text.includes("lưu");
      const isXlLarge = button.classList.contains("eds-button--xl-large") || button.className.includes("xl-large");
      return hasText && isXlLarge && isVisible(button);
    });
  }

  async function fillStockAndApply(value) {
    const match = window.location.pathname.match(/\/portal\/product\/(\d+)/);
    const itemId = match ? match[1] : null;
    const sendStatus = (status, color = '#faad14') => {
      if (itemId) {
        chrome.runtime.sendMessage({ type: "UPDATE_AUTOMATION_STATUS", itemId, status, color });
      }
    };

    if (window.location.href.includes('banhang.shopee.vn/portal/marketing/shop-flash-sale')) {
      const rows = document.querySelectorAll('.ant-table-row');
      let count = 0;
      for (const row of rows) {
        const inputs = row.querySelectorAll('.ant-input-number-input');
        if (inputs.length >= 3) {
          const stockInput = inputs[2];
          if (!isDisabledControl(stockInput) && !stockInput.closest('.ant-input-number-disabled')) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeSetter.call(stockInput, value);
            stockInput.dispatchEvent(new Event('input', { bubbles: true }));
            stockInput.dispatchEvent(new Event('change', { bubbles: true }));
            count++;
          }
        }
      }
      return { ok: true, message: `Da dien kho ${value} cho ${count} phan loai.` };
    }

    const input = findStockBatchInput();

    if (!input) {
      sendStatus("Lỗi: Không tìm thấy ô nhập kho", "#ef4444");
      return { ok: false, message: "Khong thay o nhap kho hang." };
    }

    sendStatus("Đang điền số lượng...");
    fillInputLikeUser(input, value);
    await sleep(350);

    const applyButton = findApplyToAllButton();

    if (applyButton && isVisible(applyButton)) {
      sendStatus("Đang áp dụng phân loại...");
      emitRealClick(applyButton);
      
      // Wait and poll for the Save/Cập nhật button to be enabled (up to 3 seconds)
      let saveBtn = null;
      for (let i = 0; i < 6; i++) {
        await sleep(500);
        saveBtn = findSaveProductButton();
        if (saveBtn && !saveBtn.disabled && !saveBtn.classList.contains('is-disabled') && !saveBtn.classList.contains('eds-button--disabled')) {
          break;
        }
      }
      
      if (saveBtn) {
        sendStatus("Đang lưu sản phẩm...");
        emitRealClick(saveBtn);
        sendStatus("Đã hoàn thành!", "#52c41a");
        return { ok: true, message: `Da dien kho ${value}, Ap dung va bam Cap nhat.` };
      }
      sendStatus("Đã áp dụng, hãy tự bấm Cập nhật", "#ef4444");
      return { ok: true, message: `Da dien kho ${value} va bam Ap dung.` };
    }

    sendStatus("Không tìm thấy nút Áp dụng", "#ef4444");
    return { ok: true, message: `Da dien kho ${value}.` };
  }

  function isDisabledControl(element) {
    const control = element.closest("button, [aria-disabled='true'], .disabled, .is-disabled, .eds-checkbox--disabled");

    return Boolean(control?.disabled || control?.getAttribute?.("aria-disabled") === "true" || control?.classList?.contains("disabled") || control?.classList?.contains("is-disabled"));
  }

  function findPrintFlowCheckboxIndicator() {
    const indicators = Array.from(document.querySelectorAll("span.eds-checkbox__indicator"));
    const visibleIndicators = indicators
      .filter((indicator) => isVisible(indicator) && !isDisabledControl(indicator))
      .sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();

        return rectA.top - rectB.top || rectA.left - rectB.left;
      });

    return visibleIndicators[0] || null;
  }

  async function selectPrintFlowCheckbox() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const indicator = findPrintFlowCheckboxIndicator();

      if (indicator) {
        const target = indicator.closest("label, .eds-checkbox, [role='checkbox']") || indicator;

        target.scrollIntoView({ block: "center", inline: "nearest" });
        await sleep(100);
        emitRealClick(target);

        return {
          ok: true,
          message: "Da bam hop kiem."
        };
      }

      await sleep(200);
    }

    return {
      ok: false,
      message: "Khong thay hop kiem tren trang in don."
    };
  }

  function findPrintWarehouseSelect() {
    const directSelect = document.querySelector("[data-testid='warehouse-filter']");

    if (directSelect && isVisible(directSelect)) {
      return directSelect;
    }

    return Array.from(document.querySelectorAll(".eds-select")).find((select) => {
      return select.querySelector(".eds-selector__inner") && isVisible(select);
    }) || null;
  }

  function getPrintWarehouseSelectTarget(select) {
    return select?.querySelector(".eds-selector") || select;
  }

  function findVisibleWarehouseOptions() {
    return Array.from(document.querySelectorAll(".eds-select__options .eds-option, .eds-option"))
      .filter((option) => isVisible(option))
      .map((option) => ({
        element: option,
        name: normalizeText(option.textContent),
        selected: option.classList.contains("selected")
      }))
      .filter((option) => option.name);
  }

  async function openPrintWarehouseMenu() {
    const select = findPrintWarehouseSelect();

    if (!select) {
      return null;
    }

    const target = getPrintWarehouseSelectTarget(select);

    target.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(100);
    emitRealClick(target);
    await sleep(250);

    return select;
  }

  async function getPrintWarehouses() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await openPrintWarehouseMenu();

      const options = findVisibleWarehouseOptions();

      if (options.length) {
        return {
          ok: true,
          warehouses: options.map((option) => ({
            name: option.name,
            selected: option.selected
          })),
          message: `Da tim ${options.length} kho.`
        };
      }

      await sleep(200);
    }

    return {
      ok: false,
      warehouses: [],
      message: "Khong thay danh sach kho."
    };
  }

  async function selectPrintWarehouse(name) {
    const wantedName = normalizeText(name);

    if (!wantedName) {
      return {
        ok: false,
        message: "Chua co ten kho de chon."
      };
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await openPrintWarehouseMenu();

      const option = findVisibleWarehouseOptions().find((item) => normalizeText(item.name) === wantedName);

      if (option?.element) {
        option.element.scrollIntoView({ block: "nearest", inline: "nearest" });
        await sleep(80);
        emitRealClick(option.element);

        return {
          ok: true,
          message: `Da chon kho ${option.name}.`
        };
      }

      await sleep(200);
    }

    return {
      ok: false,
      message: `Khong thay kho ${wantedName}.`
    };
  }

  function findChangePickupAddressButton() {
    const directButton = document.querySelector("[data-testid='change-pickup-address-button']");

    if (directButton && isVisible(directButton)) {
      return directButton;
    }

    return Array.from(document.querySelectorAll("button, [role='button'], .action, div, span")).find((element) => {
      return normalizeSearchText(element.textContent) === "doi" && isVisible(element);
    }) || null;
  }

  function findPickupAddressModal() {
    return Array.from(document.querySelectorAll(".eds-modal__content")).find((modal) => {
      const title = normalizeSearchText(modal.querySelector(".eds-modal__title")?.textContent);

      return title === "chon dia chi lay hang" && isVisible(modal);
    }) || null;
  }

  async function openPickupAddressModal() {
    let modal = findPickupAddressModal();

    if (modal) {
      return modal;
    }

    const changeButton = findChangePickupAddressButton();

    if (!changeButton) {
      return null;
    }

    changeButton.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(100);
    emitRealClick(changeButton);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(200);
      modal = findPickupAddressModal();

      if (modal) {
        return modal;
      }
    }

    return null;
  }

  function getPickupAddressItems(modal) {
    return Array.from(modal.querySelectorAll(".pickup-address-select-item"))
      .map((item, index) => {
        const input = item.querySelector("input[type='radio'][name='address-item']");
        const name = normalizeText(item.querySelector(".name")?.textContent);
        const addr = normalizeText(item.querySelector(".addr")?.innerText || item.querySelector(".addr")?.textContent);
        const selected = Boolean(input?.checked || item.querySelector(".eds-radio__input:checked"));
        const normalizedAddr = normalizeSearchText(addr);
        const shortText = normalizedAddr.includes("ha noi")
          ? "Ha Noi"
          : normalizedAddr.includes("ho chi minh") || normalizedAddr.includes("hcm")
            ? "Ho Chi Minh"
            : `Dia chi ${index + 1}`;

        return {
          element: item,
          input,
          id: input?.value || String(index),
          name,
          addr,
          shortText,
          selected,
          fullText: [name, addr].filter(Boolean).join(" - ")
        };
      })
      .filter((address) => address.input && address.fullText);
  }

  async function getPickupAddresses() {
    const modal = await openPickupAddressModal();

    if (!modal) {
      return {
        ok: false,
        addresses: [],
        message: "Khong thay nut Doi dia chi lay hang."
      };
    }

    const addresses = getPickupAddressItems(modal);

    return {
      ok: addresses.length > 0,
      addresses: addresses.map((address) => ({
        id: address.id,
        name: address.name,
        addr: address.addr,
        shortText: address.shortText,
        selected: address.selected,
        fullText: address.fullText
      })),
      message: addresses.length ? `Da tim ${addresses.length} dia chi.` : "Khong thay dia chi trong popup."
    };
  }

  function findConfirmPickupAddressButton(modal) {
    return Array.from(modal.querySelectorAll("button")).find((button) => {
      return normalizeText(button.textContent) === "Confirm" && isVisible(button);
    }) || null;
  }

  async function selectPickupAddress(id) {
    const modal = await openPickupAddressModal();

    if (!modal) {
      return {
        ok: false,
        message: "Khong thay popup chon dia chi lay hang."
      };
    }

    const addresses = getPickupAddressItems(modal);
    const address = addresses.find((item) => item.id === String(id));

    if (!address) {
      return {
        ok: false,
        message: "Khong thay dia chi can chon."
      };
    }

    const target = address.input.closest("label") || address.element;

    target.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(80);
    emitRealClick(target);
    await sleep(150);

    const confirmButton = findConfirmPickupAddressButton(modal);

    if (confirmButton) {
      emitRealClick(confirmButton);
      return {
        ok: true,
        message: `Da chon ${address.shortText} va bam Confirm.`
      };
    }

    return {
      ok: true,
      message: `Da chon ${address.shortText}, nhung khong thay nut Confirm.`
    };
  }

  async function selectPickupAddressLocation(location) {
    const modal = await openPickupAddressModal();

    if (!modal) {
      return {
        ok: false,
        message: "Khong thay popup chon dia chi lay hang."
      };
    }

    const normalizedLocation = normalizeSearchText(location);
    const addresses = getPickupAddressItems(modal);
    const address = addresses.find((item) => {
      const normalizedAddr = normalizeSearchText(item.addr);

      if (normalizedLocation.includes("ha noi")) {
        return normalizedAddr.includes("ha noi");
      }

      if (normalizedLocation.includes("ho chi minh") || normalizedLocation.includes("hcm")) {
        return normalizedAddr.includes("ho chi minh") || normalizedAddr.includes("hcm");
      }

      return normalizedAddr.includes(normalizedLocation);
    });

    if (!address) {
      return {
        ok: false,
        message: `Khong thay dia chi ${location}.`
      };
    }

    const target = address.input.closest("label") || address.element;

    target.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(80);
    emitRealClick(target);
    await sleep(150);

    const confirmButton = findConfirmPickupAddressButton(modal);

    if (confirmButton) {
      emitRealClick(confirmButton);
      return {
        ok: true,
        message: `Da chon dia chi ${address.shortText} va bam Confirm.`
      };
    }

    return {
      ok: true,
      message: `Da chon dia chi ${address.shortText}, nhung khong thay nut Confirm.`
    };
  }

  function findArrangePickupConfirmButton() {
    const directButton = document.querySelector("[data-testid='arrange-pickup-confirm-button']");

    if (directButton && isVisible(directButton)) {
      return directButton;
    }

    return Array.from(document.querySelectorAll("button")).find((button) => {
      return normalizeSearchText(button.textContent).includes("yeu cau don vi van chuyen den lay hang") && isVisible(button);
    }) || null;
  }

  async function arrangePickupConfirm() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const confirmButton = findArrangePickupConfirmButton();

      if (confirmButton) {
        confirmButton.scrollIntoView({ block: "center", inline: "nearest" });
        await sleep(100);
        emitRealClick(confirmButton);

        return {
          ok: true,
          message: "Da bam Yeu cau don vi van chuyen den lay hang."
        };
      }

      await sleep(200);
    }

    return {
      ok: false,
      message: "Khong thay nut Yeu cau don vi van chuyen den lay hang."
    };
  }

  function findGenerateDocButton() {
    const directButton = document.querySelector("[data-testid='generate-doc-for-arranged-shipment-orders']");

    if (directButton && isVisible(directButton)) {
      return directButton;
    }

    return Array.from(document.querySelectorAll("button")).find((button) => {
      return normalizeSearchText(button.textContent).startsWith("tao") && isVisible(button);
    }) || null;
  }

  function findNormalPdfDocOption() {
    const directOption = document.querySelector("[data-testid='doc-type-NORMAL_PDF']");

    if (directOption && isVisible(directOption)) {
      return directOption;
    }

    return Array.from(document.querySelectorAll("[data-testid], .eds-dropdown-menu div, .eds-dropdown-item, div")).find((element) => {
      const text = normalizeSearchText(element.textContent);

      return text.includes("pdf") && text.includes("phieu gui hang") && text.includes("phieu dong goi") && isVisible(element);
    }) || null;
  }

  async function generateNormalPdfDoc() {
    let foundGenerateButton = false;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const generateButton = findGenerateDocButton();

      if (generateButton) {
        generateButton.scrollIntoView({ block: "center", inline: "nearest" });
        await sleep(100);
        emitRealHover(generateButton);
        await sleep(250);
        emitRealClick(generateButton);
        foundGenerateButton = true;
        break;
      }

      await sleep(200);
    }

    if (!foundGenerateButton) {
      return {
        ok: false,
        message: "Khong thay nut Tao phieu."
      };
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const generateButton = findGenerateDocButton();

      if (generateButton) {
        emitRealHover(generateButton);
      }

      const pdfOption = findNormalPdfDocOption();

      if (pdfOption) {
        pdfOption.scrollIntoView({ block: "nearest", inline: "nearest" });
        await sleep(80);
        emitRealClick(pdfOption);

        return {
          ok: true,
          message: "Da chon PDF: Phieu gui hang va Phieu dong goi. Trang PDF se hien nut Tai PDF."
        };
      }

      await sleep(200);
    }

    return {
      ok: false,
      message: "Khong thay muc PDF: Phieu gui hang va Phieu dong goi."
    };
  }

  function findExportWaitingOrdersButton() {
    const directButton = document.querySelector("button.export-with-modal");

    if (directButton && isVisible(directButton) && normalizeSearchText(directButton.textContent) === "xuat") {
      return directButton;
    }

    return Array.from(document.querySelectorAll("button")).find((button) => {
      return normalizeSearchText(button.textContent) === "xuat" && isVisible(button) && !button.closest(".eds-modal__content");
    }) || null;
  }

  function findExportWaitingOrdersModal() {
    return Array.from(document.querySelectorAll(".eds-modal__content")).find((modal) => {
      const title = normalizeSearchText(modal.querySelector(".eds-modal__title")?.textContent);

      return title.includes("xuat don hang cho lay hang") && isVisible(modal);
    }) || null;
  }

  function findExportWaitingOrdersModalButton(modal) {
    return Array.from(modal.querySelectorAll(".eds-modal__footer-buttons button, button")).find((button) => {
      return normalizeSearchText(button.textContent) === "xuat" && isVisible(button);
    }) || null;
  }

  function findExportDownloadButton() {
    return Array.from(document.querySelectorAll(".eds-modal__content button, button")).find((button) => {
      return normalizeSearchText(button.textContent) === "tai ve" && isVisible(button);
    }) || null;
  }

  async function exportWaitingOrders() {
    let modal = findExportWaitingOrdersModal();

    if (!modal) {
      const exportButton = findExportWaitingOrdersButton();

      if (!exportButton) {
        return {
          ok: false,
          message: "Khong thay nut Xuat."
        };
      }

      exportButton.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(100);
      emitRealClick(exportButton);

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await sleep(200);
        modal = findExportWaitingOrdersModal();

        if (modal) {
          break;
        }
      }
    }

    if (!modal) {
      return {
        ok: false,
        message: "Khong thay hop xuat don hang."
      };
    }

    const modalExportButton = findExportWaitingOrdersModalButton(modal);

    if (!modalExportButton) {
      return {
        ok: false,
        message: "Khong thay nut Xuat trong hop xuat don hang."
      };
    }

    modalExportButton.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(100);
    emitRealClick(modalExportButton);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(250);

      const downloadButton = findExportDownloadButton();

      if (downloadButton) {
        downloadButton.scrollIntoView({ block: "center", inline: "nearest" });
        await sleep(100);
        emitRealClick(downloadButton);

        return {
          ok: true,
          message: "Da bam Xuat va Tai ve."
        };
      }
    }

    return {
      ok: true,
      message: "Da bam Xuat, nhung chua thay nut Tai ve."
    };
  }

  async function extractProductPerformanceData() {
    // 1. Tìm các phần tử thông tin sản phẩm trên trang
    let infoElements = Array.from(document.querySelectorAll('.product-item__info, [class*="product-item__info"]'));
    
    if (!infoElements.length) {
      const titles = Array.from(document.querySelectorAll('.item-title, [class*="item-title"]'));
      infoElements = titles.map(t => t.closest('.product-item__info, [class*="product-item"], tr, .eds-table__row') || t.parentElement).filter(Boolean);
    }

    if (!infoElements.length) {
      return {
        ok: false,
        error: "Không tìm thấy danh sách sản phẩm trên trang hiện tại. Vui lòng mở trang Hiệu quả sản phẩm (banhang.shopee.vn/datacenter/product/performance)."
      };
    }

    // 2. Trích xuất tiêu đề bảng nếu có
    const headerCells = Array.from(document.querySelectorAll('thead th, .eds-table__header-cell, [class*="header-cell"], [class*="table__header"] th, th'));
    const headers = [];
    headerCells.forEach(cell => {
      const clone = cell.cloneNode(true);
      clone.querySelectorAll('.resize-triggers, .eds-popper, style, script').forEach(el => el.remove());
      let txt = clone.textContent.replace(/\s+/g, ' ').trim();
      if (txt && !headers.includes(txt)) {
        headers.push(txt);
      }
    });

    // 3. Trích xuất từng dòng sản phẩm
    const rows = [];
    const processedKeys = new Set();

    for (let idx = 0; idx < infoElements.length; idx++) {
      const infoEl = infoElements[idx];

      // Tiêu đề sản phẩm
      let titleEl = infoEl.querySelector('.item-title') || infoEl.querySelector('[class*="item-title"]');
      let title = "";
      if (titleEl) {
        title = titleEl.textContent.trim();
      } else {
        const refEl = infoEl.querySelector('.eds-popover__ref, .eds-popover__content');
        title = (refEl ? refEl.textContent : infoEl.textContent.split('\n')[0]).trim();
      }
      title = title.replace(/\s+/g, ' ').trim();

      // Mã sản phẩm / Phụ đề
      let subtitleEl = infoEl.querySelector('.item-subtitle') || infoEl.querySelector('[class*="item-subtitle"]');
      let subtitle = subtitleEl ? subtitleEl.textContent.replace(/\s+/g, ' ').trim() : "";
      if (!subtitle) {
        const flexCol = infoEl.querySelector('.flex-col') || infoEl.parentElement?.querySelector('.item-subtitle');
        if (flexCol) subtitle = flexCol.textContent.replace(/\s+/g, ' ').trim();
      }

      let productId = "";
      const idMatch = (subtitle || infoEl.textContent).match(/(\d{8,})/);
      if (idMatch) productId = idMatch[1];

      let sku = "";
      const skuMatch = (subtitle || infoEl.textContent).match(/sku[:\s]*([^\s,;]+)/i);
      if (skuMatch) sku = skuMatch[1];

      // Hàng chứa sản phẩm (tr / row container)
      const rowContainer = infoEl.closest('tr, .eds-table__row, [class*="table__row"], [class*="table-row"], .product-item') || infoEl.parentElement;

      // Ảnh sản phẩm
      let imgUrl = "";
      if (rowContainer) {
        const imgEl = rowContainer.querySelector('img.product-image, .product-item__image img, .product-item img, [class*="product-item__image"] img, img');
        if (imgEl) {
          imgUrl = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset') || "";
          if (imgUrl.includes(' ')) imgUrl = imgUrl.split(' ')[0];
        }
      }

      // Các ô chỉ số hiệu quả trong cùng hàng
      const metricCells = [];
      if (rowContainer && rowContainer.tagName === 'TR') {
        const cells = Array.from(rowContainer.querySelectorAll('td, .eds-table__cell'));
        cells.forEach(c => {
          if (!c.contains(infoEl)) {
            const clone = c.cloneNode(true);
            clone.querySelectorAll('.resize-triggers, .eds-popper, style, script').forEach(el => el.remove());
            const cellText = clone.textContent.replace(/\s+/g, ' ').trim();
            metricCells.push(cellText);
          }
        });
      } else if (rowContainer) {
        const cells = Array.from(rowContainer.querySelectorAll('.eds-table__cell, [class*="table__cell"], [class*="cell"]'));
        cells.forEach(c => {
          if (!c.contains(infoEl)) {
            const clone = c.cloneNode(true);
            clone.querySelectorAll('.resize-triggers, .eds-popper, style, script').forEach(el => el.remove());
            const cellText = clone.textContent.replace(/\s+/g, ' ').trim();
            if (cellText && !cellText.includes(title)) {
              metricCells.push(cellText);
            }
          }
        });
      }

      const rowKey = `${productId}_${title}`;
      if (!processedKeys.has(rowKey) && (title || productId)) {
        processedKeys.add(rowKey);
        rows.push({
          index: rows.length + 1,
          productId,
          sku,
          title,
          subtitle,
          imgUrl,
          metricCells,
          rawText: `${title} ${subtitle} ${productId} ${sku} ${metricCells.join(' ')}`
        });
      }
    }

    return {
      ok: rows.length > 0,
      headers,
      rows,
      count: rows.length,
      url: window.location.href
    };
  }

  async function executeAutoBoostProductList(productIds = [], maxSlots = 5) {
    if (!Array.isArray(productIds) || !productIds.length) {
      return { ok: false, error: "Danh sách Mã sản phẩm trống" };
    }

    // 1. Thu thập tất cả các thẻ sản phẩm và action row trên trang hiện tại
    const actionEntries = findProductActionRows();
    if (!actionEntries.length) {
      return {
        ok: false,
        error: "Không tìm thấy sản phẩm nào trên trang. Vui lòng mở trang Danh sách sản phẩm (portal/product/list)!"
      };
    }

    const results = [];
    let boostedCount = 0;
    let alreadyBoostingCount = 0;

    // Thu thập thông tin các thẻ sản phẩm trên trang
    const pageCards = actionEntries.map(entry => {
      const card = findProductCardFromActionRow(entry.row);
      const itemId = getProductListItemId(card);
      const name = getProductListName(card);
      return {
        entry,
        card,
        itemId,
        name,
        cardText: card.textContent || ""
      };
    });

    for (const targetId of productIds) {
      const cleanTargetId = String(targetId).trim();
      if (!cleanTargetId) continue;

      // Tìm thẻ sản phẩm khớp Mã SP (hoặc chứa Mã SP)
      const matched = pageCards.find(pc => pc.itemId === cleanTargetId || pc.cardText.includes(cleanTargetId));

      if (!matched) {
        results.push({
          id: cleanTargetId,
          name: "",
          status: "not_found",
          msg: "Không tìm thấy trên trang"
        });
        continue;
      }

      // Kiểm tra xem sản phẩm có đang trong trạng thái được đẩy (còn đếm ngược giờ) không
      const cardText = matched.card.textContent || "";
      const isCurrentlyBoosting = cardText.includes("Đang đẩy") || (cardText.includes("Còn ") && /\d{2}:\d{2}/.test(cardText));
      
      if (isCurrentlyBoosting) {
        const timeMatch = cardText.match(/Còn\s*([0-9:]+)/i);
        const remaining = timeMatch ? timeMatch[1] : "đang đẩy";
        alreadyBoostingCount++;
        results.push({
          id: cleanTargetId,
          name: matched.name,
          status: "already_boosting",
          msg: `Đang đẩy (còn ${remaining})`
        });
        continue;
      }

      // Kiểm tra nếu tổng số sản phẩm đã đẩy đạt giới hạn maxSlots
      if (boostedCount + alreadyBoostingCount >= maxSlots) {
        results.push({
          id: cleanTargetId,
          name: matched.name,
          status: "limit_reached",
          msg: "Đã đạt giới hạn 5/5 SP đang đẩy"
        });
        continue;
      }

      // Thực hiện thao tác bấm menu ... -> Đẩy sản phẩm
      try {
        hoverElementAtCenter(matched.entry.moreTarget);
        await sleep(250);
        clickElementAtCenter(matched.entry.moreTarget);
        await sleep(250);

        const dropdownItem = await waitForVisibleDropdownItem("Đẩy sản phẩm");

        if (!dropdownItem) {
          results.push({
            id: cleanTargetId,
            name: matched.name,
            status: "error",
            msg: "Không thấy tùy chọn Đẩy SP"
          });
        } else if (dropdownItem.classList.contains("disabled") || dropdownItem.getAttribute("aria-disabled") === "true") {
          const reason = dropdownItem.title || dropdownItem.textContent.trim() || "Bị khóa";
          results.push({
            id: cleanTargetId,
            name: matched.name,
            status: "limit_reached",
            msg: `Không thể đẩy (${reason})`
          });
        } else {
          clickElementAtCenter(dropdownItem);
          await sleep(500);
          boostedCount++;
          results.push({
            id: cleanTargetId,
            name: matched.name,
            status: "boosted",
            msg: "Đã kích hoạt đẩy thành công!"
          });
        }

        // Đóng dropdown bằng cách dispatch Escape
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
        await sleep(500);
      } catch (clickErr) {
        results.push({
          id: cleanTargetId,
          name: matched.name,
          status: "error",
          msg: clickErr.message
        });
      }
    }

    return {
      ok: true,
      results,
      boostedCount,
      alreadyBoostingCount,
      totalRequested: productIds.length
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "PING") {
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === "OPEN_ADD_PRODUCT") {
      sendResponse(clickAddProduct());
      return false;
    }
    
    if (message?.type === "READ_HANG_HOAN_LIST") {
      try {
        const items = [];
        const rows = document.querySelectorAll('.return-row-item, a.return-row-item');
        rows.forEach(row => {
          // Mã đơn hàng
          const orderIdNode = row.querySelector('.order-id .id-content');
          const orderId = orderIdNode ? orderIdNode.textContent.trim() : '';

          // Mã yêu cầu trả hàng
          const returnIdNode = row.querySelector('.return-id .id-content');
          const returnId = returnIdNode ? returnIdNode.textContent.trim() : '';

          // Mã vận đơn trả hàng
          let trackingNum = "";
          const trackingNode = row.querySelector('.item-return-logistic .tracking-number, .tracking-number');
          if (trackingNode) {
            const clone = trackingNode.cloneNode(true);
            const span = clone.querySelector('span, .hh-bh-info');
            if (span) span.remove();
            trackingNum = clone.textContent.trim();
          }

          // Tình trạng
          const statusNode = row.querySelector('.item-request-status');
          const statusText = statusNode ? statusNode.innerText.replace(/\n/g, ' - ').trim() : "";

          // Vận chuyển hàng hoàn info
          let returnLogistics = "";
          const returnLogisticsNode = row.querySelector('.item-return-logistic');
          if (returnLogisticsNode) {
            const tagNode = returnLogisticsNode.querySelector('.tag, .eds-tag');
            const statusTag = tagNode ? tagNode.textContent.trim() : "";

            const hintNode = returnLogisticsNode.querySelector('.logistics-hint-text');
            const hintText = hintNode ? hintNode.textContent.trim() : "";

            const channelNode = returnLogisticsNode.querySelector('.logistic-channel');
            const channelText = channelNode ? channelNode.textContent.trim() : "";

            returnLogistics = [statusTag, channelText, hintText].filter(Boolean).join(" - ");
          }

          // hh-bh-info
          let hhBhInfo = "Chưa có";
          const hhBhNode = row.querySelector('.hh-bh-info');
          if (hhBhNode) {
            hhBhInfo = hhBhNode.textContent.trim();
          }

          // Extract products inside the return row
          const products = [];
          const productWrappers = row.querySelectorAll('.order-product-wrapper');
          productWrappers.forEach(wrapper => {
            const imgNode = wrapper.querySelector('.item-images, img');
            const imgUrl = imgNode ? imgNode.src : '';
            
            const nameNode = wrapper.querySelector('.ct-item-product-name');
            const pName = nameNode ? nameNode.textContent.trim() : '';

            if (pName || imgUrl) {
              products.push({ pName, imgUrl });
            }
          });

          if (orderId || returnId || trackingNum) {
            items.push({
              orderId,
              returnId,
              trackingNum,
              statusText,
              returnLogistics,
              hhBhInfo,
              products
            });
          }
        });
  // --- INJECT MAIN-WORLD INTERCEPTOR FOR SHOPEE API (EXACT TẢI ẢNH SHOPEE METHOD) ---
  let cachedShopeeProductDataExt = null;
  window.addEventListener("message", (event) => {
    if (event.data && event.data.action === "sendShopeeProductDataExt") {
      cachedShopeeProductDataExt = event.data.data;
    }
  });

  try {
    const interceptorScript = document.createElement("script");
    interceptorScript.textContent = `
      (function() {
        let productData = { isProduct: false, title: '', mainImages: [], categoryImages: [], descriptionImages: [], videos: [] };
        
        function parsePdpData(f) {
          try {
            const data = f?.data || {};
            const title = data?.item?.title || '';
            
            let categoryImages = [];
            const variations = data?.product_images?.first_tier_variations;
            if (Array.isArray(variations)) {
              categoryImages = variations.map(k => ({
                sku: k?.name || '',
                name: k?.name || '',
                image: k?.image ? 'https://down-id.img.susercontent.com/file/' + k.image : ''
              })).filter(x => x.image);
            }

            let mainImages = [];
            const images = data?.product_images?.images;
            if (Array.isArray(images)) {
              mainImages = images.map(k => 'https://down-id.img.susercontent.com/file/' + k);
            }

            let descriptionImages = [];
            let pList = data?.rich_text_description?.paragraph_list || data?.item?.rich_text_description?.paragraph_list;
            if (Array.isArray(pList)) {
              descriptionImages = pList.filter(k => k?.img_id).map(k => 'https://down-id.img.susercontent.com/file/' + k.img_id);
            }

            let videos = [];
            const vid = data?.product_images?.video;
            if (vid && vid.video_id) {
              videos = [{
                src: 'https://cvf.shopee.com/file/' + vid.video_id,
                cover: vid.thumb_url ? 'https://down-id.img.susercontent.com/file/' + vid.thumb_url : ''
              }];
            }

            productData = {
              isProduct: true,
              title: title || document.title || '',
              mainImages,
              categoryImages,
              descriptionImages,
              videos
            };
            window.postMessage({ action: 'sendShopeeProductDataExt', data: productData }, '*');
          } catch (e) { console.error('Pdp parse error:', e); }
        }

        const origFetch = window.fetch;
        window.fetch = function(url, opts) {
          const u = typeof url === 'string' ? url : url?.url;
          return origFetch.apply(this, arguments).then(res => {
            if (u && typeof u === 'string' && u.includes('/api/v4/pdp/get_pc')) {
              res.clone().json().then(json => parsePdpData(json)).catch(() => {});
            }
            return res;
          });
        };

        const OrigXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
          const xhr = new OrigXHR();
          xhr.addEventListener('load', function() {
            if (xhr._url && typeof xhr._url === 'string' && xhr._url.includes('/api/v4/pdp/get_pc')) {
              try { parsePdpData(JSON.parse(xhr.responseText)); } catch (e) {}
            }
          });
          const origOpen = xhr.open;
          xhr.open = function(method, url) {
            xhr._url = url;
            return origOpen.apply(this, arguments);
          };
          return xhr;
        };
      })();
    `;
    (document.head || document.documentElement).appendChild(interceptorScript);
    interceptorScript.remove();
  } catch (e) {}

  function collectShopeeProductDataForTaiAnh() {
    // 1. If intercepted API data exists and has images, use it (Exact Tải Ảnh Shopee output)
    if (cachedShopeeProductDataExt && (cachedShopeeProductDataExt.mainImages.length || cachedShopeeProductDataExt.categoryImages.length)) {
      return cachedShopeeProductDataExt;
    }

    let title = "";
    let mainImages = [];
    let categoryImages = [];
    let descriptionImages = [];
    let videos = [];

    if (location.host.includes("banhang.shopee.vn")) {
      const titleInput = document.querySelector("input[placeholder*='tên sản phẩm'], textarea[placeholder*='tên sản phẩm'], .product-edit-form-item input");
      if (titleInput) title = titleInput.value || titleInput.textContent || "";

      descriptionImages = typeof findSellerDescriptionImageUrls === "function" ? findSellerDescriptionImageUrls() : [];
      const varRows = typeof extractSellerProductTableRows === "function" ? extractSellerProductTableRows() : [];
      
      const imagesRoot = typeof findSellerFieldRoot === "function" ? findSellerFieldRoot("images") : null;
      if (imagesRoot && typeof collectSellerShopeeImageUrls === "function") {
        mainImages = collectSellerShopeeImageUrls(imagesRoot).slice(0, 9);
      }

      varRows.forEach(row => {
        if (row.variationImages && row.variationImages.length) {
          row.variationImages.forEach(img => {
            if (!categoryImages.some(c => c.image === img)) {
              categoryImages.push({ name: row.sku || row.variationName || "Biến thể", image: img, sku: row.sku || "" });
            }
          });
        }
      });

      const catUrls = new Set(categoryImages.map(c => c.image));
      const descUrls = new Set(descriptionImages);
      mainImages = mainImages.filter(img => !catUrls.has(img) && !descUrls.has(img));
    }

    if (location.host.includes("shopee.vn") && !location.host.includes("banhang")) {
      const titleEl = document.querySelector(".page-product__name, [class*='product-title'], h1");
      if (titleEl) title = titleEl.textContent.trim();

      // Try parsing inline script JSON data containing product_images
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        const text = s.textContent || "";
        if (text.includes("product_images") || text.includes("first_tier_variations")) {
          try {
            const mImages = text.match(/"images":\s*\[(.*?)\]/);
            if (mImages && mImages[1]) {
              const hashes = mImages[1].match(/"([a-f0-9]{32})"/g);
              if (hashes) {
                hashes.forEach(h => {
                  const hash = h.replace(/"/g, "");
                  const url = `https://down-id.img.susercontent.com/file/${hash}`;
                  if (!mainImages.includes(url)) mainImages.push(url);
                });
              }
            }

            const mVars = text.match(/"first_tier_variations":\s*\[(.*?)\]/);
            if (mVars && mVars[1]) {
              const varMatches = mVars[1].match(/\{"name":".*?"/g);
              const imgHashes = mVars[1].match(/"image":"([a-f0-9]{32})"/g);
              if (imgHashes) {
                imgHashes.forEach((h, idx) => {
                  const hash = h.replace(/"image":"|"$/g, "");
                  const url = `https://down-id.img.susercontent.com/file/${hash}`;
                  if (!categoryImages.some(c => c.image === url)) {
                    categoryImages.push({ name: `Biến thể ${idx + 1}`, image: url });
                  }
                });
              }
            }
          } catch (e) {}
        }
      }

      // Fallback DOM extraction
      if (mainImages.length === 0) {
        const galleryEls = document.querySelectorAll(".page-product__shop-images img, .product-briefing img, div[style*='background-image']");
        galleryEls.forEach(el => {
          let src = el.src || "";
          if (!src && el.style && el.style.backgroundImage) {
            const m = el.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
            if (m) src = m[1];
          }
          if (src && src.includes("susercontent.com") && !src.includes("avatar") && !src.includes("icon")) {
            src = src.replace(/_(tn|ss)\.(jpg|png|jpeg)/i, ".$2");
            if (!mainImages.includes(src)) mainImages.push(src);
          }
        });
      }

      if (descriptionImages.length === 0) {
        const descContainer = document.querySelector(".product-detail-page, .page-product__detail, [class*='description'], .product-detail");
        if (descContainer) {
          const descImgs = descContainer.querySelectorAll("img[src*='susercontent.com'], img[data-src*='susercontent.com']");
          descImgs.forEach(img => {
            let src = img.src || img.getAttribute("data-src") || "";
            if (src && !src.includes("avatar") && !src.includes("icon")) {
              src = src.replace(/_(tn|ss)\.(jpg|png|jpeg)/i, ".$2");
              if (!descriptionImages.includes(src)) descriptionImages.push(src);
            }
          });
        }
      }
    }

    const isProduct = (mainImages.length > 0 || descriptionImages.length > 0 || categoryImages.length > 0 || title !== "");

    return {
      isProduct,
      title: title || "Sản phẩm Shopee",
      mainImages,
      categoryImages,
      descriptionImages,
      videos
    };
  }
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return true;
    }

    if (message?.type === "READ_SP_SHOPEE_LIST") {
      try {
        const products = [];
        for (const { row } of findProductActionRows()) {
            const card = findProductCardFromActionRow(row);
            const name = getProductListName(card).trim();
            if (!name) continue;
            
            // Tìm container chứa các SKU (do mình render ra hoặc SKU gốc của web nếu có)
            const skuContainer = row.nextElementSibling?.querySelector(".shopee-qlsp-custom-scrollbar") || card.querySelector(".shopee-qlsp-custom-scrollbar");
            let skus = [];
            if (skuContainer) {
                skus = Array.from(skuContainer.querySelectorAll("span")).map(span => span.textContent.trim());
            } else {
                // Nếu không có SKU tiêm vào, thử lấy native SKU nếu có
                const nativeSku = card.querySelector(".product-sku")?.textContent.trim();
                if (nativeSku) skus.push(nativeSku);
            }
            
            const itemId = getProductListItemId(card);
            if (skus.length > 0) {
                skus.forEach(s => {
                    products.push({ name, sku: s, itemId });
                });
            } else {
                products.push({ name, sku: "", itemId });
            }
        }
        sendResponse({ ok: true, data: products });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return false;
    }

    if (message?.type === "FILL_SKU_TO_SHOPEE") {
      (async () => {
        const skuVal = message.sku || "";
        const inputs = Array.from(document.querySelectorAll("input.eds-input__input, input")).filter(isVisible);
        // Find batch SKU input first, or any SKU input
        const skuInput = inputs.find(i => {
          const p = normalizeText(i.placeholder || "");
          return p.includes("sku") || p.includes("mã phân loại");
        });
        if (skuInput) {
          fillInputLikeUser(skuInput, skuVal);
          showTopNotification(`Đã điền SKU phân loại: ${skuVal}`);
          sendResponse({ ok: true, message: "Đã điền SKU phân loại." });
        } else {
          showTopNotification("Không tìm thấy ô nhập SKU phân loại", true);
          sendResponse({ ok: false, message: "Không tìm thấy ô nhập SKU phân loại" });
        }
      })();
      return true;
    }

    if (message?.type === "FILL_PRICE_TO_SHOPEE") {
      (async () => {
        const priceVal = message.price || "";
        const inputs = Array.from(document.querySelectorAll("input.eds-input__input, input")).filter(isVisible);
        // Find batch Price input first, or any Price input
        const priceInput = inputs.find(i => {
          const p = normalizeText(i.placeholder || "");
          return (p.includes("giá") || p.includes("price") || p.includes("₫")) && !p.includes("thấp") && !p.includes("bán");
        }) || inputs.find(i => normalizeText(i.placeholder || "").includes("giá"));

        if (priceInput) {
          fillInputLikeUser(priceInput, priceVal);
          showTopNotification(`Đã điền giá: ${priceVal}`);
          sendResponse({ ok: true, message: "Đã điền giá." });
        } else {
          showTopNotification("Không tìm thấy ô nhập Giá", true);
          sendResponse({ ok: false, message: "Không tìm thấy ô nhập Giá" });
        }
      })();
      return true;
    }

    if (message?.type === "UPLOAD_PRODUCT_IMAGES") {
      sendResponse(uploadProductImages(message.files || []));
      return false;
    }

    if (message?.type === "UPLOAD_DESCRIPTION_IMAGES") {
      uploadDescriptionImages(message.files || []).then(sendResponse);
      return true;
    }

        if (message?.type === "AUTO_FILL_IF_EMPTY") {
      autoFillIfEmpty(message.product || {}, message.brand || "").then(sendResponse);
      return true;
    }

    if (message?.type === "GET_PRODUCT_NAME") {
      let name = "";
      const nameInput = findProductNameInput();
      if (nameInput && nameInput.value) {
        name = nameInput.value.trim();
      } else {
        const titleEl = document.querySelector(".page-product__name, [class*='product-title'], h1");
        if (titleEl) name = titleEl.textContent.trim();
      }
      sendResponse({ name: name || document.title.split('|')[0].trim() });
      return false;
    }

    if (message?.type === "FILL_PRODUCT_TEXT") {
      sendResponse(fillProductText(message.product || {}));
      return false;
    }

    if (message?.type === "FILL_PRODUCT_BRAND") {
      fillProductBrand(message.brand).then(sendResponse);
      return true;
    }

    if (message?.type === "FILL_PRODUCT_ATTRIBUTE") {
      fillProductAttribute(message.labelName, message.value).then(sendResponse);
      return true;
    }

    if (message?.type === "ADD_NEW_PRODUCT_ATTRIBUTE") {
      addNewProductAttribute(message.labelName, message.value).then(sendResponse);
      return true;
    }

    if (message?.action === "requestProductData" || message?.type === "requestProductData") {
      try {
        const productData = collectShopeeProductDataForTaiAnh();
        sendResponse({ data: productData });
      } catch (err) {
        sendResponse({ data: null });
      }
      return true;
    }

    if (message?.type === "EXTRACT_SELLER_SP_FULL") {
      extractSellerSpFullData()
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (message?.type === "EXTRACT_PRODUCT_PERFORMANCE") {
      extractProductPerformanceData()
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (message?.type === "EXECUTE_AUTO_BOOST_LIST") {
      executeAutoBoostProductList(message.productIds, message.maxSlots)
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (message?.type === "EXTRACT_SELLER_ORDER_DETAIL_FULL") {
      extractSellerOrderDetailFullData()
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (message?.type === "EXTRACT_SHOPEE_PRODUCT") {
      extractShopeeProduct().then(sendResponse);
      return true;
    }

    if (message?.type === "ADD_VARIATION_GROUP") {
      addVariationGroup(message.name).then(sendResponse);
      return true;
    }

    if (message?.type === "FILL_WEIGHT_SHIPPING") {
      (async () => {
        const weightVal = message.weight || 2000;
        
        // 1. Fill weight
        const weightContainer = Array.from(document.querySelectorAll(".edit-row, .eds-form-item, div")).find((element) => {
          const label = element.querySelector(".edit-label, label, .eds-form-item__label");
          return label && normalizeText(label.textContent).includes("C\u00e2n n\u1eb7ng");
        });
        const input = weightContainer ? (weightContainer.querySelector("input.eds-input__input") || findRealTextInput(weightContainer)) : null;
        
        if (input) {
          fillInputLikeUser(input, String(weightVal));
        }

        // 2. Enable all shipping channels
        await sleep(500);
        const switches = Array.from(document.querySelectorAll('.eds-switch, .shopee-switch, [role="switch"]')).filter(isVisible);
        for (const sw of switches) {
          let isExcluded = false;
          let current = sw;
          for (let d = 0; d < 5 && current; d++) {
            const txt = current.textContent || "";
            if (txt.includes("từng phân loại") || txt.includes("Thiết lập cân nặng") || txt.includes("kích thước cho từng")) {
              isExcluded = true;
              break;
            }
            current = current.parentElement;
          }
          if (isExcluded) {
            continue;
          }

          const isChecked = sw.classList.contains('eds-switch--checked') || 
                            sw.classList.contains('shopee-switch--checked') || 
                            sw.getAttribute('aria-checked') === 'true' ||
                            sw.querySelector('input[type="checkbox"]')?.checked;
          if (!isChecked) {
            emitRealClick(sw);
            await sleep(200);
          }
        }

        sendResponse({ ok: true, message: "Đã điền cân nặng 2000g và bật hết các kênh vận chuyển." });
      })();
      return true;
    }

    if (message?.type === "FILL_STOCK") {
      fillStockAndApply(message.value).then(sendResponse);
      return true;
    }

    if (message?.type === "EXTRACT_BUYER_PRODUCT") {
      extractBuyerProduct().then(sendResponse);
      return true;
    }

    if (message?.type === "DOWNLOAD_IMAGE_AS_BASE64") {
      fetch(message.url)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => sendResponse({ ok: true, dataUrl: reader.result, type: blob.type });
          reader.readAsDataURL(blob);
        })
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    if (message?.type === "FETCH_PRODUCT_BY_API") {
      // Dùng cơ chế API thật (credentials + intercepted headers) để lấy dữ liệu sản phẩm
      (async () => {
        const { itemId, shopId } = message;
        if (!itemId || !shopId) {
          sendResponse({ ok: false, message: "Thiếu itemId hoặc shopId" });
          return;
        }
        try {
          const result = await fetchShopeeProductByApi(itemId, shopId);
          if (!result.ok || !result.data) {
            sendResponse({ ok: false, message: "Không lấy được dữ liệu từ API Shopee", source: result.source });
            return;
          }
          const data = result.data;
          const images = extractImagesFromApiData(data);
          const attrs = extractAttributesFromApiData(data);
          const brand = data.brand || attrs["Thương hiệu"] || "No Brand";
          sendResponse({
            ok: true,
            source: result.source,
            name: data.name || "",
            description: data.description || "",
            brand: brand,
            images: images,
            details: attrs,
            price: data.price ? (data.price / 100000) : 0,
            stock: data.stock || 0,
            weight: data.weight || 2000
          });
        } catch (err) {
          sendResponse({ ok: false, message: err.message });
        }
      })();
      return true;
    }

    if (message?.type === "PRINT_FLOW_SELECT_CHECKBOX") {
      selectPrintFlowCheckbox().then(sendResponse);
      return true;
    }

    if (message?.type === "PRINT_FLOW_GET_WAREHOUSES") {
      getPrintWarehouses().then(sendResponse);
      return true;
    }

    if (message?.type === "PRINT_FLOW_SELECT_WAREHOUSE") {
      selectPrintWarehouse(message.name).then(sendResponse);
      return true;
    }

    if (message?.type === "PRINT_FLOW_GET_ADDRESSES") {
      getPickupAddresses().then(sendResponse);
      return true;
    }

    if (message?.type === "PRINT_FLOW_SELECT_ADDRESS") {
      selectPickupAddress(message.id).then(sendResponse);
      return true;
    }

    if (message?.type === "PRINT_FLOW_SELECT_ADDRESS_LOCATION") {
      selectPickupAddressLocation(message.location).then(sendResponse);
      return true;
    }

    if (message?.type === "PRINT_FLOW_ARRANGE_PICKUP") {
      arrangePickupConfirm().then(sendResponse);
      return true;
    }

    if (message?.type === "PRINT_FLOW_GENERATE_DOC") {
      generateNormalPdfDoc().then(sendResponse);
      return true;
    }

    if (message?.type === "PRINT_FLOW_EXPORT_WAITING_ORDERS") {
      exportWaitingOrders().then(sendResponse);
      return true;
    }

    if (message?.type === "GET_VISIBLE_INCOME_ROWS") {
      sendResponse({
        ok: true,
        rows: isIncomePaidPage() ? getVisibleIncomeRows() : []
      });
      return false;
    }

    if (message?.type) {
      return false;
    }

    return false;
  });

  let dsSpCache = null;
  let isFetchingDsSp = false;
  let lastDsSpFetchTime = 0;

  async function fetchDsSpData() {
    if (dsSpCache) return dsSpCache;
    const now = Date.now();
    if (now - lastDsSpFetchTime < 10000) return null; // Throttle to 10 seconds on failure
    if (isFetchingDsSp) return null;
    isFetchingDsSp = true;
    lastDsSpFetchTime = now;
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "FETCH_DS_SP" }, (response) => {
        isFetchingDsSp = false;
        if (response && response.ok && response.values && response.values.length > 0) {
          const headers = response.values[0];
          const normalizeHeader = (t) => String(t || "").trim().toLowerCase();
          const idSpCtIdx = headers.findIndex(h => {
             const nh = normalizeHeader(h);
             return nh === "id_sp_ct" || nh === "id_sp_con";
          });
          const giaBanIdx = headers.findIndex(h => normalizeHeader(h) === "gia_ban");
          
          if (idSpCtIdx !== -1 && giaBanIdx !== -1) {
            dsSpCache = new Map();
            for (let i = 1; i < response.values.length; i++) {
              const row = response.values[i];
              const idSpCt = row[idSpCtIdx];
              const giaBanRaw = row[giaBanIdx];
              if (idSpCt) {
                 const giaBan = parseInt(String(giaBanRaw).replace(/[^0-9]/g, '')) || 0;
                 const idKey = String(idSpCt).trim();
                 dsSpCache.set(idKey, giaBan);
                 dsSpCache.set(idKey.toUpperCase(), giaBan);
                 dsSpCache.set(idKey.toLowerCase(), giaBan);
              }
            }
            resolve(dsSpCache);
          } else {
            console.warn("Khong tim thay cot id_sp_ct hoac gia_ban");
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }


  // =========================================================================
  // ENHANCE ORDER DETAIL PRODUCTS (/portal/sale/order/*)
  // - Copy icon for Product Name
  // - Copy icon for Variation SKU
  // - Lookup Mã Sản Phẩm in Sheet SP_SHOPEE (matching Mã Gian & Tên SP)
  // - Button "Mở Sản Phẩm" -> https://banhang.shopee.vn/portal/product/[Mã Sản Phẩm]
  // =========================================================================
  let orderDetailSpCache = null;
  let orderDetailMaGian = "";
  let orderDetailLoadingSp = false;

  function loadOrderDetailSpData(callback) {
    if (orderDetailSpCache && orderDetailSpCache.length > 1) {
      if (callback) callback(orderDetailSpCache, orderDetailMaGian);
      return;
    }
    if (orderDetailLoadingSp) {
      // Đang tải, đợi một chút rồi gọi lại callback
      setTimeout(() => loadOrderDetailSpData(callback), 500);
      return;
    }
    orderDetailLoadingSp = true;

    chrome.storage.local.get(['sp_shopee_cache_data', 'maGian', 'dhHoanTextValue'], (res) => {
      orderDetailMaGian = (res?.maGian || res?.dhHoanTextValue || "").trim().toLowerCase();
      if (res && res.sp_shopee_cache_data && res.sp_shopee_cache_data.length > 1) {
        orderDetailSpCache = res.sp_shopee_cache_data;
        orderDetailLoadingSp = false;
        if (callback) callback(orderDetailSpCache, orderDetailMaGian);
      } else {
        chrome.runtime.sendMessage({ type: "FETCH_SP_SHOPEE" }, (fRes) => {
          orderDetailLoadingSp = false;
          if (fRes && fRes.ok && fRes.values && fRes.values.length > 1) {
            orderDetailSpCache = fRes.values;
            chrome.storage.local.set({ sp_shopee_cache_data: fRes.values });
            if (callback) callback(orderDetailSpCache, orderDetailMaGian);
          } else {
            orderDetailSpCache = [];
            if (callback) callback(orderDetailSpCache, orderDetailMaGian);
          }
        });
      }
    });
  }

  function findMaSanPhamFromSheet(productName, currentMaGian, spRows) {
    if (!productName || !spRows || spRows.length <= 1) return null;
    
    const cleanStr = (val) => {
      if (!val) return "";
      return String(val)
        .normalize("NFC")
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\.\.\.$/, '')
        .replace(/\u2026$/, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    };

    const cleanP = cleanStr(productName);
    const targetGian = cleanStr(currentMaGian);

    const headers = spRows[0].map(v => cleanStr(v));
    let maSpIdx = headers.findIndex(col => col.includes('mã sản phẩm') || col.includes('ma san pham') || col === 'ma sp' || col === 'mã sp' || col === 'item id' || col === 'id');
    if (maSpIdx === -1) maSpIdx = 0;
    
    let pIdx = headers.findIndex(col => col.includes('tên sản phẩm') || col.includes('ten san pham') || col === 'ten sp' || col === 'name');
    if (pIdx === -1) pIdx = 1;

    let gIdx = headers.findIndex(col => col === 'gian' || col === 'mã gian' || col === 'ma gian' || col === 'ma_gian');
    if (gIdx === -1) gIdx = 11;

    // Lọc theo gian trước nếu có
    let candidateRows = [];
    if (targetGian) {
      for (let i = 1; i < spRows.length; i++) {
        const row = spRows[i];
        const sG = cleanStr(row[gIdx]);
        if (sG === targetGian || sG.includes(targetGian) || targetGian.includes(sG)) {
          candidateRows.push(row);
        }
      }
    }
    if (candidateRows.length === 0) {
      candidateRows = spRows.slice(1);
    }

    const getWordOverlap = (s1, s2) => {
      if (!s1 || !s2) return 0;
      const w1 = s1.split(' ').filter(w => w.length > 1);
      const w2 = s2.split(' ').filter(w => w.length > 1);
      let count = 0;
      for (const w of w1) {
        if (w2.includes(w)) count++;
      }
      return count;
    };

    const extractCodes = (str) => {
      const matches = str.match(/[a-z0-9]+[0-9]+[a-z0-9]*/gi) || [];
      return matches.map(m => m.toLowerCase());
    };

    const pCodes = extractCodes(cleanP);

    let bestScore = -1;
    let bestMaSp = "";

    for (const row of candidateRows) {
      const sheetName = cleanStr(row[pIdx]);
      const maSp = String(row[maSpIdx] || "").trim();
      if (!sheetName || !maSp) continue;

      let score = 0;
      if (sheetName === cleanP) {
        score += 10000;
      } else if (sheetName.startsWith(cleanP) || cleanP.startsWith(sheetName)) {
        score += 5000;
      } else if (sheetName.includes(cleanP) || cleanP.includes(sheetName)) {
        score += 3000;
      } else {
        const sheetCodes = extractCodes(sheetName);
        let codeMatch = false;
        for (const c of pCodes) {
          if (c.length >= 3 && sheetCodes.includes(c)) {
            score += 2000;
            codeMatch = true;
          }
        }
        const overlap = getWordOverlap(cleanP, sheetName);
        if (overlap >= 2 || codeMatch) {
          score += overlap * 100;
        }
      }

      if (score > bestScore && score > 0) {
        bestScore = score;
        bestMaSp = maSp;
      }
    }

    return bestMaSp || null;
  }

  function renderOrderDetailProductEnhancements() {
    if (!window.location.href.includes('/portal/sale/order/')) return;

    const productDetailElements = Array.from(document.querySelectorAll('.product-detail, [class*="product-detail"], .order-product-wrapper, .order-item, .product-item, .order-view-item'));
    if (productDetailElements.length === 0) return;

    productDetailElements.forEach(detailEl => {
      const nameEl = detailEl.querySelector('.product-name, [class*="product-name"], .ct-item-product-name, .item-name');
      if (!nameEl) return;

      const productName = (nameEl.getAttribute('title') || nameEl.innerText || nameEl.textContent || "").replace(/\s+/g, ' ').trim();
      if (!productName) return;

      let skuVal = "";
      const metaDivs = Array.from(detailEl.querySelectorAll('.product-meta > div, [class*="product-meta"] > div, .item-meta, .ct-item-meta, [class*="meta"]'));
      for (const mDiv of metaDivs) {
        const text = (mDiv.innerText || mDiv.textContent || "").trim();
        if (text.includes('SKU phân loại:') || text.includes('SKU:') || text.includes('Mã phân loại:') || text.includes('Mã sản phẩm:')) {
          skuVal = text.replace(/.*(?:SKU phân loại|SKU|Mã phân loại|Mã sản phẩm)\s*:\s*/i, '').trim();
          skuVal = skuVal.replace(/copy\s*sku|sao\s*ch[eé]p\s*sku|copy|sao\s*ch[eé]p/gi, '').trim();
          if (skuVal) break;
        }
      }

      // Đưa toàn bộ các nút Copy tên, Copy SKU, Mở SP xuống dòng footer riêng ở dưới cùng
      let actionsFooter = detailEl.querySelector('.ext-product-actions-footer');
      if (!actionsFooter) {
        actionsFooter = document.createElement('div');
        actionsFooter.className = 'ext-product-actions-footer';
        actionsFooter.style.cssText = 'margin-top: 8px !important; display: flex !important; align-items: center !important; gap: 8px !important; flex-wrap: wrap !important;';
        detailEl.appendChild(actionsFooter);

        // 1. Nút Copy Tên
        const copyNameBtn = document.createElement('button');
        copyNameBtn.type = 'button';
        copyNameBtn.className = 'ext-copy-prod-name-btn';
        copyNameBtn.title = 'Bấm để copy tên sản phẩm';
        copyNameBtn.style.cssText = 'display: inline-flex !important; align-items: center !important; gap: 2px !important; padding: 2px 8px !important; font-size: 11px !important; font-weight: bold !important; color: #0284c7 !important; background: #e0f2fe !important; border: 1px solid #7dd3fc !important; border-radius: 4px !important; cursor: pointer !important; user-select: none !important; box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;';
        copyNameBtn.innerHTML = '📋 Copy tên';
        copyNameBtn.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          navigator.clipboard.writeText(productName).then(() => {
            copyNameBtn.innerHTML = '✓ Đã copy tên!';
            copyNameBtn.style.color = '#15803d';
            copyNameBtn.style.background = '#dcfce7';
            copyNameBtn.style.borderColor = '#86efac';
            setTimeout(() => {
              copyNameBtn.innerHTML = '📋 Copy tên';
              copyNameBtn.style.color = '#0284c7';
              copyNameBtn.style.background = '#e0f2fe';
              copyNameBtn.style.borderColor = '#7dd3fc';
            }, 1200);
          });
        };
        actionsFooter.appendChild(copyNameBtn);

        // 2. Nút Copy SKU (nếu có SKU)
        if (skuVal) {
          const copySkuBtn = document.createElement('button');
          copySkuBtn.type = 'button';
          copySkuBtn.className = 'ext-copy-sku-btn';
          copySkuBtn.title = 'Bấm để copy SKU: ' + skuVal;
          copySkuBtn.style.cssText = 'display: inline-flex !important; align-items: center !important; gap: 2px !important; padding: 2px 8px !important; font-size: 11px !important; font-weight: bold !important; color: #0369a1 !important; background: #f0f9ff !important; border: 1px solid #bae6fd !important; border-radius: 4px !important; cursor: pointer !important; user-select: none !important; box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;';
          copySkuBtn.innerHTML = '📋 Copy SKU';
          copySkuBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            navigator.clipboard.writeText(skuVal).then(() => {
              copySkuBtn.innerHTML = '✓ Đã copy SKU!';
              copySkuBtn.style.color = '#15803d';
              copySkuBtn.style.background = '#dcfce7';
              copySkuBtn.style.borderColor = '#86efac';
              setTimeout(() => {
                copySkuBtn.innerHTML = '📋 Copy SKU';
                copySkuBtn.style.color = '#0369a1';
                copySkuBtn.style.background = '#f0f9ff';
                copySkuBtn.style.borderColor = '#bae6fd';
              }, 1200);
            });
          };
          actionsFooter.appendChild(copySkuBtn);
        }

        // 3. Khung Mở Sản Phẩm
        const openWrapper = document.createElement('span');
        openWrapper.className = 'ext-open-product-wrapper';
        openWrapper.innerHTML = '<span style="font-size: 11px; color: #94a3b8;">⏳ Đang tra cứu mã SP...</span>';
        actionsFooter.appendChild(openWrapper);

        loadOrderDetailSpData((spRows, currentMaGian) => {
          const maSp = findMaSanPhamFromSheet(productName, currentMaGian, spRows);
          if (maSp) {
            openWrapper.innerHTML = `
              <a href="https://banhang.shopee.vn/portal/product/${maSp}" target="_blank" class="ext-open-product-btn" style="
                display: inline-flex !important; align-items: center !important; gap: 4px !important;
                background: #ee4d2d !important; color: #ffffff !important;
                font-size: 11px !important; font-weight: bold !important;
                padding: 2px 8px !important; border-radius: 4px !important;
                text-decoration: none !important; border: 1px solid #d03b1f !important;
                box-shadow: 0 1px 3px rgba(238, 77, 45, 0.25) !important; cursor: pointer !important;
              ">🌐 Mở sản phẩm (${maSp}) ↗</a>
            `;
          } else {
            openWrapper.innerHTML = `
              <a href="https://banhang.shopee.vn/portal/product/list/all?search=name&keyword=${encodeURIComponent(productName.substring(0, 35))}" target="_blank" style="
                display: inline-flex !important; align-items: center !important; gap: 2px !important;
                font-size: 11px !important; color: #0284c7 !important; background: #e0f2fe !important;
                padding: 2px 8px !important; border: 1px solid #7dd3fc !important; border-radius: 4px !important;
                text-decoration: none !important; font-weight: 500 !important;
              ">🔍 Tìm SP trên Shopee ↗</a>
            `;
          }
        });
      }
    });
  }

  // =========================================================================
  // NÂNG CẤP BẤM MỞ RỘNG ĐƠN TRÊN TRANG SHOPEE FINANCE (CHỐNG MỞ TAB TUYỆT ĐỐI)
  // =========================================================================
  function clickOnlyArrowIcon(row) {
    if (!row) return;

    // Tìm icon mũi tên (có chứa SVG mũi tên xuống hoặc nằm trong cột số tiền)
    const arrowIcon = row.querySelector('path[d*="9.18933983"]')?.closest('i') ||
                      row.querySelector('.transaction-amount-wrapper i.eds-icon') ||
                      row.querySelector('.transaction-amount-wrapper i') ||
                      row.querySelector('i.eds-icon');

    if (!arrowIcon) return;
    if (arrowIcon.tagName === 'A' || arrowIcon.closest('a')) return; // Chặn tuyệt đối nếu nằm trong thẻ A

    // Tạm thời chặn mọi hành vi mở link thẻ <a> trong lúc bấm
    const preventLink = (e) => {
      if (e.target.closest('a') || e.target.tagName === 'A') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('click', preventLink, true);

    try {
      const opts = { bubbles: true, cancelable: true, view: window };
      arrowIcon.dispatchEvent(new MouseEvent('mousedown', opts));
      arrowIcon.dispatchEvent(new MouseEvent('mouseup', opts));
      arrowIcon.dispatchEvent(new MouseEvent('click', opts));
    } catch (_) {}

    setTimeout(() => {
      window.removeEventListener('click', preventLink, true);
    }, 200);
  }

  function injectFinanceExpandButtons() {
    if (!window.location.href.includes('/portal/finance/income')) {
      const floatBtn = document.getElementById('ext-btn-expand-all-finance');
      if (floatBtn) floatBtn.remove();
      return;
    }

    // 1. Nút nổi ở góc dưới bên phải màn hình
    if (!document.getElementById('ext-btn-expand-all-finance')) {
      const floatBtn = document.createElement('button');
      floatBtn.id = 'ext-btn-expand-all-finance';
      floatBtn.type = 'button';
      floatBtn.innerHTML = '⚡ Mở Rộng Tất Cả Đơn';
      floatBtn.title = 'Bấm để tự động mở rộng toàn bộ các dòng đơn hàng trên trang này';
      floatBtn.style.cssText = 'position: fixed !important; bottom: 20px !important; right: 20px !important; z-index: 999999 !important; background: #ee4d2d !important; color: #ffffff !important; border: 2px solid #ffffff !important; border-radius: 20px !important; padding: 10px 18px !important; font-size: 13px !important; font-weight: bold !important; cursor: pointer !important; box-shadow: 0 4px 14px rgba(238, 77, 45, 0.4) !important; font-family: Arial, sans-serif !important; display: flex !important; align-items: center !important; gap: 6px !important;';

      floatBtn.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        floatBtn.innerHTML = '⏳ Đang mở rộng...';
        floatBtn.style.background = '#0284c7';

        // Tự động chuyển 50 đơn/trang nếu cần
        try {
          const sizeSpan = document.querySelector('.eds-pagination-sizes__content');
          if (sizeSpan && !sizeSpan.innerText.includes('50')) {
            sizeSpan.click();
            await new Promise(r => setTimeout(r, 400));
            const item50 = Array.from(document.querySelectorAll('.eds-dropdown-item, .eds-dropdown-menu li')).find(el => el.innerText.trim() === '50' || el.textContent.trim() === '50');
            if (item50) {
              item50.click();
              await new Promise(r => setTimeout(r, 1200));
            }
          }
        } catch (_) {}

        // Mở rộng tất cả các dòng chỉ bằng icon mũi tên
        const rows = Array.from(document.querySelectorAll('.grid-table-body .grid-table-row, .transaction-table .grid-table-row, .grid-table-row'));
        rows.forEach(r => clickOnlyArrowIcon(r));

        floatBtn.innerHTML = '✓ Đã mở rộng ' + rows.length + ' đơn!';
        floatBtn.style.background = '#16a34a';
        setTimeout(() => {
          floatBtn.innerHTML = '⚡ Mở Rộng Tất Cả Đơn';
          floatBtn.style.background = '#ee4d2d';
        }, 3000);
      };

      document.body.appendChild(floatBtn);
    }

    // 2. Thêm nút [⚡ Mở rộng] trực tiếp vào từng dòng cạnh số tiền
    const rows = Array.from(document.querySelectorAll('.grid-table-body .grid-table-row, .transaction-table .grid-table-row'));
    rows.forEach(r => {
      const cells = Array.from(r.children);
      if (cells.length < 5) return;
      const amountCell = cells[4];
      if (!amountCell || amountCell.querySelector('.ext-btn-row-expand')) return;

      const wrapper = amountCell.querySelector('.transaction-amount-wrapper') || amountCell;
      const rowBtn = document.createElement('button');
      rowBtn.className = 'ext-btn-row-expand';
      rowBtn.type = 'button';
      rowBtn.innerHTML = '⚡ Mở rộng';
      rowBtn.title = 'Bấm để mở rộng chi tiết đơn này';
      rowBtn.style.cssText = 'background: #0284c7 !important; color: #ffffff !important; font-size: 10px !important; font-weight: bold !important; padding: 2px 6px !important; border-radius: 4px !important; border: none !important; cursor: pointer !important; margin-left: 6px !important; display: inline-block !important; vertical-align: middle !important;';

      rowBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        clickOnlyArrowIcon(r);
        rowBtn.innerHTML = '✓ Đã mở';
        rowBtn.style.background = '#16a34a';
      };

      wrapper.appendChild(rowBtn);
    });

    // 3. Thêm nút trên thanh công cụ gần nút [Xuất]
    const xuanBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Xuất' || b.textContent.trim() === 'Xuất');
    if (xuanBtn && !document.getElementById('ext-btn-toolbar-expand')) {
      const topBtn = document.createElement('button');
      topBtn.id = 'ext-btn-toolbar-expand';
      topBtn.type = 'button';
      topBtn.innerHTML = '⚡ Mở Rộng Tất Cả Đơn';
      topBtn.style.cssText = 'background: #ee4d2d !important; color: #ffffff !important; font-weight: bold !important; padding: 5px 12px !important; border-radius: 4px !important; border: none !important; cursor: pointer !important; font-size: 12px !important; margin-left: 8px !important; display: inline-flex !important; align-items: center !important;';

      topBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        document.getElementById('ext-btn-expand-all-finance')?.click();
      };

      xuanBtn.parentElement.insertBefore(topBtn, xuanBtn.nextSibling);
    }
  }
  async function renderOrderProfit() {
    if (!window.location.href.includes('/portal/sale/order/')) return;
    
    // Find all amount elements, as requested by the user
    const allAmountValues = document.querySelectorAll('.amount');
    // Fallback to .income-value if .amount doesn't exist
    const allIncomeValues = document.querySelectorAll('.income-value');
    
    const validElements = (allAmountValues && allAmountValues.length > 0) ? allAmountValues : allIncomeValues;
    if (!validElements || validElements.length === 0) return;

    if (document.querySelector('.custom-order-profit')) return;

    // Use a robust selector for "SKU phân loại:" or "Mã phân loại:"
    const skuElements = Array.from(document.querySelectorAll('.product-meta > div')).filter(el => {
      const txt = el.innerText || '';
      return txt.includes('SKU ph') || txt.includes('Mã phân loại:') || txt.includes('Mã phân loại') || txt.includes('S0');
    });
    
    if (skuElements.length === 0) return;

    const dsSpData = await fetchDsSpData();
    if (!dsSpData) return;
    
    // Check again after await
    const currentAmountValues = document.querySelectorAll('.amount');
    const currentIncomeValues = document.querySelectorAll('.income-value');
    const finalValidElements = (currentAmountValues && currentAmountValues.length > 0) ? currentAmountValues : currentIncomeValues;
    
    if (!finalValidElements || finalValidElements.length === 0 || document.querySelector('.custom-order-profit')) return;
    
    // The final total is usually the last one on the page
    const currentFinalValueElement = finalValidElements[finalValidElements.length - 1];

    let totalGiaBan = 0;
    let productsCount = 0;
    let productDetails = [];
    
    skuElements.forEach(el => {
      const text = el.innerText || '';
      if (!text.includes('SKU') && !text.includes('Mã phân loại')) return;
      // Extract everything after the colon
      const match = text.match(/:\s*(.*)/);
      const skuFull = match ? match[1].trim() : text.replace(/.*(?:SKU|Mã).*?:/, '').trim();
      const sku10 = skuFull.substring(0, 10);
      const giaBan = dsSpData.get(sku10);
      
      if (giaBan !== undefined) {
         let qty = 1;
         const listItem = el.closest('.product-list-item');
         if (listItem) {
           const qtyElement = listItem.querySelector('.qty');
           if (qtyElement) {
              const qtyParsed = parseInt(qtyElement.innerText.replace(/[^0-9]/g, ''));
              if (!isNaN(qtyParsed)) qty = qtyParsed;
           }
         }
         productsCount += qty;
         totalGiaBan += (giaBan * qty);
         productDetails.push({ sku: sku10, qty, giaBan, total: giaBan * qty });
      }
    });

    if (productsCount === 0) return;

    const incomeRawText = currentFinalValueElement.innerText || '';
    const incomeValueParsed = parseInt(incomeRawText.replace(/[^0-9]/g, '')) || 0;
    const loiNhuan = incomeValueParsed - totalGiaBan;

    const container = document.createElement('div');
    container.className = 'custom-order-profit';
    container.style.marginTop = '15px';
    container.style.paddingTop = '15px';
    container.style.borderTop = '1px dashed #e5e5e5';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-end';
    container.style.width = '100%';

    const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

    let detailRowsHTML = '';
    if (productsCount >= 2) {
      productDetails.forEach((p, index) => {
         detailRowsHTML += `
            <div style="font-size: 13px; color: #888; display: flex; justify-content: flex-end; width: 100%; margin-bottom: 4px;">
               <span style="text-align: right; margin-right: 20px;">SP ${index + 1} (${p.sku}) x${p.qty}:</span>
               <span style="width: 120px; text-align: right;">${formatVND(p.total)}</span>
            </div>
         `;
      });
    }

    container.innerHTML = `
      ${detailRowsHTML}
      <div style="font-size: 14px; color: #666; display: flex; justify-content: flex-end; width: 100%; margin-bottom: 8px;">
        <span style="text-align: right; margin-right: 20px;">Tổng vốn (${productsCount} SP):</span>
        <span style="width: 120px; text-align: right;"><strong>${formatVND(totalGiaBan)}</strong></span>
      </div>
            <div style="font-size: 16px; color: ${loiNhuan >= 0 ? '#ee4d2d' : 'red'}; display: flex; justify-content: flex-end; width: 100%;">
        <span style="text-align: right; margin-right: 20px;">Lợi nhuận:</span>
        <span style="width: 120px; text-align: right;"><strong>${formatVND(loiNhuan)}</strong></span>
      </div>
    `;

    // The payment detail block usually has rows. Let's find the parent row of the last income value.
    let targetRow = currentFinalValueElement.closest('.income-row') || currentFinalValueElement.closest('.flex') || currentFinalValueElement.parentElement;
    
    // Find the wrapper block to append cleanly at the bottom
    let wrapperBlock = currentFinalValueElement.closest('.shopee-popover__ref') || currentFinalValueElement.closest('.right-col') || currentFinalValueElement.closest('ul') || targetRow.parentElement;

    if (wrapperBlock) {
       wrapperBlock.appendChild(container);
    } else {
       targetRow.insertAdjacentElement('afterend', container);
    }
  }

  let cachedDhHoanIds = new Set();
  let isFetchingDhHoanIds = false;
  let lastFetchDhHoanIdsTime = 0;

  async function updateDhHoanIdsCache(force = false) {
      if (isFetchingDhHoanIds) return;
      const now = Date.now();
      if (!force && now - lastFetchDhHoanIdsTime < 30000) return;
      isFetchingDhHoanIds = true;
      try {
          const response = await new Promise(resolve => chrome.runtime.sendMessage({ type: "FETCH_DH_HOAN_IDS" }, resolve));
          if (response && response.ok && response.values) {
              cachedDhHoanIds.clear();
              for (const row of response.values) {
                  const id = String(row[0] || "").trim();
                  if (id) cachedDhHoanIds.add(id);
              }
              lastFetchDhHoanIdsTime = Date.now();
              updateCopyButtonColors();
              updateCopyAllButtonColors();
          }
      } catch(e) {
          console.error(e);
      } finally {
          isFetchingDhHoanIds = false;
      }
  }

  let cachedUdCtMdhIds = new Map();
  let isFetchingUdCtMdhIds = false;
  let lastFetchUdCtMdhIdsTime = 0;

  async function updateUdCtMdhIdsCache() {
      if (isFetchingUdCtMdhIds) return;
      const now = Date.now();
      if (now - lastFetchUdCtMdhIdsTime < 30000) return;
      isFetchingUdCtMdhIds = true;
      try {
          const response = await new Promise(resolve => chrome.runtime.sendMessage({ type: "FETCH_UD_CT_MDH" }, resolve));
          if (response && response.ok && response.values) {
              cachedUdCtMdhIds.clear();
              for (const row of response.values) {
                  const id = String(row[8] || "").trim();
                  if (id) {
                      const ngay = String(row[0] || "").trim();
                      const san = String(row[4] || "").trim();
                      const khungh = String(row[5] || "").trim();
                      const idspct = String(row[12] || "").trim();
                      const trangthai = String(row[20] || "").trim();
                      const displayText = [ngay, san, khungh, idspct, trangthai].filter(Boolean).join(" - ");
                      if (cachedUdCtMdhIds.has(id)) {
                          cachedUdCtMdhIds.set(id, cachedUdCtMdhIds.get(id) + "<br>" + displayText);
                      } else {
                          cachedUdCtMdhIds.set(id, displayText);
                      }
                  }
              }
              lastFetchUdCtMdhIdsTime = Date.now();
              updateUdCtBadgeColors();
          }
      } catch(e) {
          console.error(e);
      } finally {
          isFetchingUdCtMdhIds = false;
      }
  }

  let cachedDonHangMdhIndices = new Map();
  let cachedDonHangData = new Map();
  let isFetchingDonHangMdh = false;
  let lastFetchDonHangMdhTime = 0;

  async function updateDonHangMdhCache(force = false) {
      if (isFetchingDonHangMdh) return;
      const now = Date.now();
      if (!force && now - lastFetchDonHangMdhTime < 30000) return;
      isFetchingDonHangMdh = true;
      try {
          const response = await new Promise(resolve => chrome.runtime.sendMessage({ type: "FETCH_DON_HANG_MDH" }, resolve));
          if (response && response.ok && response.values) {
              cachedDonHangMdhIndices.clear();
              cachedDonHangData.clear();
              for (let i = 0; i < response.values.length; i++) {
                  const row = response.values[i];
                  const id = String(row[0] || "").trim();
                  if (id) {
                      const rowIdx = i + 1;
                      if (!cachedDonHangMdhIndices.has(id)) {
                          cachedDonHangMdhIndices.set(id, []);
                      }
                      cachedDonHangMdhIndices.get(id).push(rowIdx);
                  }
              }
              lastFetchDonHangMdhTime = Date.now();
              updateCopyAllButtonColors();
              updateCopyButtonColors();
          }
      } catch(e) {
          console.error(e);
      } finally {
          isFetchingDonHangMdh = false;
      }
  }

  function updateUdCtBadgeColors() {
      document.querySelectorAll('.ud-ct-badge').forEach(badge => {
          if (badge.dataset.shopeeQlspUdCtFilled === "1") return;
          const id = badge.dataset.shopeeQlspOrderId;
          if (id && cachedUdCtMdhIds.has(id)) {
              badge.innerHTML = cachedUdCtMdhIds.get(id);
              badge.style.backgroundColor = "#22c55e";
              badge.style.color = "white";
              badge.style.border = "none";
              badge.style.padding = "2px 6px";
          } else {
              badge.textContent = "";
              badge.style.backgroundColor = "transparent";
              badge.style.color = "transparent";
              badge.style.border = "none";
              badge.style.padding = "0";
          }
      });
  }

  let cachedHhBhData = new Map();
  let isFetchingHhBhMvdIds = false;
  let lastFetchHhBhMvdIdsTime = 0;

  async function updateHhBhMvdIdsCache() {
      if (isFetchingHhBhMvdIds) return;
      const now = Date.now();
      if (now - lastFetchHhBhMvdIdsTime < 30000) return;
      isFetchingHhBhMvdIds = true;
      try {
          const response = await new Promise(resolve => chrome.runtime.sendMessage({ type: "FETCH_HH_BH_MVD" }, resolve));
          if (response && response.ok && response.values && response.values.length > 0) {
              const headers = response.values[0] || [];
              const normalize = s => String(s || "").trim().toLowerCase();
              const idxMap = {};
              ['ngay_nhan', 'mvd', 'mvd_2', 'ma_gian', 'sku_ct', 'slg', 'tinh_trang', 'kho'].forEach(key => {
                  idxMap[key] = headers.findIndex(h => normalize(h) === normalize(key));
              });

              cachedHhBhData.clear();
              for (let i = 1; i < response.values.length; i++) {
                  const row = response.values[i];
                  const mvdIdx = idxMap['mvd'];
                  if (mvdIdx === -1) continue;
                  
                  const mvd = String(row[mvdIdx] || "").trim();
                  if (mvd) {
                      const dataObj = {};
                      ['ngay_nhan', 'mvd', 'mvd_2', 'ma_gian', 'sku_ct', 'slg', 'tinh_trang', 'kho'].forEach(key => {
                          const idx = idxMap[key];
                          dataObj[key] = (idx !== -1 && row[idx]) ? row[idx] : "";
                      });
                      cachedHhBhData.set(mvd, dataObj);
                  }
              }
              lastFetchHhBhMvdIdsTime = Date.now();
              updateTrackingNumberColors();
          }
      } catch(e) {
          console.error(e);
      } finally {
          isFetchingHhBhMvdIds = false;
      }
  }

  function updateTrackingNumberColors() {
      document.querySelectorAll('.tracking-number').forEach(el => {
          const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
          const mvd = textNodes.map(n => n.textContent).join('').trim();
          
          if (mvd && cachedHhBhData.has(mvd)) {
              el.style.backgroundColor = "#22c55e";
              el.style.color = "white";
              el.style.padding = "2px 4px";
              el.style.borderRadius = "4px";
              el.style.border = "none";
              el.style.display = "inline-flex";
              el.style.alignItems = "center";
              el.style.flexWrap = "wrap";
              
              const dataObj = cachedHhBhData.get(mvd);
              let infoSpan = el.querySelector('.hh-bh-info');
              if (!infoSpan) {
                  infoSpan = document.createElement('span');
                  infoSpan.className = 'hh-bh-info';
                  infoSpan.style.marginLeft = '10px';
                  infoSpan.style.fontSize = '12px';
                  infoSpan.style.color = '#333';
                  infoSpan.style.backgroundColor = '#f0f0f0';
                  infoSpan.style.padding = '2px 6px';
                  infoSpan.style.borderRadius = '4px';
                  el.appendChild(infoSpan);
              }
              infoSpan.textContent = `${dataObj.ngay_nhan} | ${dataObj.mvd} | ${dataObj.mvd_2} | ${dataObj.ma_gian} | ${dataObj.sku_ct} | ${dataObj.slg} | ${dataObj.tinh_trang} | ${dataObj.kho}`;
          } else {
              el.style.backgroundColor = "transparent";
              el.style.color = "inherit";
              el.style.padding = "0";
              el.style.border = "1px solid white";
              
              const infoSpan = el.querySelector('.hh-bh-info');
              if (infoSpan) infoSpan.remove();
          }
      });
  }



  function extractShopeeCode(elementOrText) {
    if (!elementOrText) return "";
    let text = typeof elementOrText === "string" ? elementOrText : (elementOrText.textContent || "");
    text = text.replace(/copy|sao\s*ch[eé]p|m[aã]\s*([đd][oơ]n\s*h[aà]ng|y[eê]u\s*c[aầ]u\s*tr[aả]\s*h[aà]ng)/gi, " ").trim();
    const m = text.match(/([0-9]{6}[A-Z0-9]{7,14})/i);
    if (m) {
      let code = m[1].toUpperCase();
      if (code.endsWith("COPY")) code = code.slice(0, -4);
      return code;
    }
    return "";
  }

  function extractReturnRowData(orderIdEl) {
    let orderId = "";
    const contentEl = orderIdEl.querySelector(".id-content, a[href*='order'], a");
    if (contentEl) {
      orderId = extractShopeeCode(contentEl.textContent);
    }
    if (!orderId) {
      orderId = extractShopeeCode(orderIdEl.textContent);
    }

    let current = orderIdEl;
    let rowContainer = orderIdEl;
    while(current && current.parentElement && current.parentElement !== document.body) {
        if (current.parentElement.querySelectorAll(".id.order-id").length > 1) {
            break;
        }
        current = current.parentElement;
        rowContainer = current;
    }

    if (!rowContainer) return { orderId, reason: "", returnId: "", tracking: "" };

    let returnId = "";
    const returnIdEl_ = rowContainer.querySelector(".id.return-id, .return-id, [class*=\"return-id\"]");
    if (returnIdEl_) {
      returnId = extractShopeeCode(returnIdEl_.textContent);
    }

    let tracking = "";
    const trackingEl = rowContainer.querySelector(".item-return-logistic .tracking-number, .tracking-number, [class*=\"tracking\"]");
    if (trackingEl) {
      tracking = trackingEl.textContent.replace(/#\s*/, "").replace(/copy|sao\s*ch[eé]p/gi, "").trim();
    } else {
      const logisticHint = rowContainer.querySelector(".logistics-hint-text");
      if (logisticHint && logisticHint.parentElement) {
         const tEl = logisticHint.parentElement.querySelector(".tracking-number");
         if (tEl) tracking = tEl.textContent.replace(/#\s*/, "").replace(/copy|sao\s*ch[eé]p/gi, "").trim();
      }
    }

    let reason = "";
    const rowText = rowContainer.innerText || rowContainer.textContent || "";
    const commonReasons = [
      "Khác với mô tả", "Tôi muốn thay đổi sản phẩm", "Thiếu hàng", "Hàng lỗi",
      "Không hoạt động", "Hư hỏng", "Giao sai", "Hàng giả", "Chưa nhận được hàng",
      "hàng không nguyên vẹn", "Bể vỡ", "Hết hạn sử dụng", "Tôi muốn cập nhật địa chỉ/sđt nhận hàng", "Tôi muốn thêm/thay đổi Mã giảm giá"
    ];
    for (const cr of commonReasons) {
       if (rowText.includes(cr)) {
           reason = cr;
           break;
       }
    }
    if (!reason) {
        const allDivs = Array.from(rowContainer.querySelectorAll("div"));
        const reasonDiv = allDivs.find(div => {
            const txt = div.textContent.trim();
            return txt && !div.children.length && txt.length > 5 && txt.length < 100 && !txt.includes("Mã") && !txt.includes("đơn hàng") && !txt.includes("Ngày") && !txt.includes("Giao") && !txt.includes("hoàn") && !txt.includes("yêu cầu");
        });
        if (reasonDiv) reason = reasonDiv.textContent.trim();
    }
    return { orderId, reason, returnId, tracking };
  }

  function updateCopyAllButtonColors() {
      document.querySelectorAll(".btn-copy-all-check").forEach(btn => {
          const id = btn.dataset.shopeeQlspCopyAllOrderId;
          if (id && (cachedDonHangMdhIndices.has(id) || cachedDhHoanIds.has(id))) {
              btn.style.backgroundColor = "#cbb89d"; // màu be
              btn.style.borderColor = "#b7a285";
              btn.style.color = "#3d3124";
              btn.style.fontWeight = "bold";
          } else {
              btn.style.backgroundColor = "";
              btn.style.borderColor = "";
              btn.style.color = "";
              btn.style.fontWeight = "";
          }
      });
  }

  function updateCopyButtonColors() {
      document.querySelectorAll(".btn-copy-return-data-check").forEach(btn => {
          const id = btn.dataset.shopeeQlspCopyReturnOrderId;
          if (id && (cachedDhHoanIds.has(id) || cachedDonHangMdhIndices.has(id))) {
              btn.style.backgroundColor = "#cbb89d"; // màu be
              btn.style.borderColor = "#b7a285";
              btn.style.color = "#3d3124";
              btn.style.fontWeight = "bold";
          } else {
              btn.style.backgroundColor = "#ee4d2d";
              btn.style.borderColor = "";
              btn.style.color = "#fff";
              btn.style.fontWeight = "";
          }
      });
  }

  function findOrderRowHref(orderIdEl, fallbackOrderId) {
    if (orderIdEl) {
      const closestA = orderIdEl.closest("a[href]");
      if (closestA) {
        const h = closestA.getAttribute("href") || closestA.href;
        if (h && h !== "#" && !h.startsWith("javascript:")) {
          return h.startsWith("http") ? h : `https://banhang.shopee.vn${h.startsWith("/") ? "" : "/"}${h}`;
        }
      }

      let current = orderIdEl;
      let rowContainer = orderIdEl;
      while(current && current.parentElement && current.parentElement !== document.body) {
          if (current.parentElement.querySelectorAll(".id.order-id").length > 1) {
              break;
          }
          current = current.parentElement;
          rowContainer = current;
      }

      if (rowContainer) {
        const containerA = rowContainer.closest("a[href]") || rowContainer.querySelector("a[href*='/order/'], a[href*='/sale/order'], a[href*='/portal/sale/order'], a[href]");
        if (containerA) {
          const h = containerA.getAttribute("href") || containerA.href;
          if (h && h !== "#" && !h.startsWith("javascript:")) {
            return h.startsWith("http") ? h : `https://banhang.shopee.vn${h.startsWith("/") ? "" : "/"}${h}`;
          }
        }
      }
    }
    return `https://banhang.shopee.vn/portal/sale/order/${fallbackOrderId}`;
  }

  function handleDhHoanAction(action, orderIdEl, btn) {
      const data = extractReturnRowData(orderIdEl);
      if (!data || !data.orderId) {
          alert("Không tìm thấy Mã đơn hàng trên dòng này!");
          return;
      }
      
      const originalText = btn.dataset.originalText || btn.textContent;
      btn.dataset.originalText = originalText;
      btn.textContent = "⏳...";
      btn.disabled = true;

      const timer = setTimeout(() => {
          if (btn.disabled) {
              btn.disabled = false;
              btn.textContent = originalText;
          }
      }, 70000);

      chrome.storage.local.get(["maGian", "dhHoanTextValue"], (result) => {
          const maGian = (result.maGian || result.dhHoanTextValue || "").trim();
          
          const sendUpdateReq = (isRetry = false) => {
            chrome.runtime.sendMessage({ 
                type: "UPDATE_DH_RETURN_STATUS", 
                status: action === "Cập nhật" ? "" : action,
                orderId: data.orderId, 
                reason: data.reason, 
                returnId: data.returnId, 
                tracking: data.tracking,
                maGian: maGian
            }, (response) => {
                if (response && response.ok) {
                    clearTimeout(timer);
                    btn.disabled = false;
                    cachedDhHoanIds.add(data.orderId);
                    updateCopyButtonColors();
                    btn.textContent = "OK!";
                    setTimeout(() => { btn.textContent = originalText; }, 2000);
                } else if (response && (response.notFound || (response.error && response.error.includes("Không tìm thấy Mã đơn hàng")))) {
                    // Chưa có trong Sheet DH -> Kích hoạt click vào thẻ span.id-content để mở chi tiết đơn hàng
                    const orderIdContentEl = orderIdEl.querySelector('.id-content');
                    btn.textContent = "⏳ Mở Chrome...";
                    
                    if (orderIdContentEl) {
                        orderIdContentEl.click();
                    } else {
                        const targetUrl = findOrderRowHref(orderIdEl, data.orderId);
                        chrome.runtime.sendMessage({
                            type: "OPEN_ORDER_IN_NEW_WINDOW",
                            url: targetUrl,
                            orderId: data.orderId,
                            autoCloseDelay: 60000
                        });
                    }

                    // Tự động kiểm tra và cập nhật lại khi đơn hàng được lưu xong vào Sheet DH
                    let pollCount = 0;
                    const pollInterval = setInterval(() => {
                        pollCount++;
                        if (pollCount > 20) { // Sau 60s nếu chưa xong
                            clearInterval(pollInterval);
                            clearTimeout(timer);
                            btn.disabled = false;
                            btn.textContent = "Lỗi!";
                            setTimeout(() => { btn.textContent = originalText; }, 2500);
                            alert(`Không tìm thấy đơn hàng "${data.orderId}" sau khi mở cửa sổ chi tiết đơn.`);
                            return;
                        }

                        chrome.runtime.sendMessage({
                            type: "CHECK_AND_GET_DH_ORDER",
                            mdh: data.orderId,
                            maGian: maGian
                        }, (chkRes) => {
                            if (chkRes && chkRes.exists && chkRes.rows.length > 0) {
                                clearInterval(pollInterval);
                                btn.textContent = "⏳ Cập nhật...";
                                sendUpdateReq(true);
                            }
                        });
                    }, 3000);
                } else {
                    clearTimeout(timer);
                    btn.disabled = false;
                    btn.textContent = "Lỗi!";
                    setTimeout(() => { btn.textContent = originalText; }, 2500);
                    alert("Lỗi cập nhật: " + (response?.error || "Không có phản hồi từ Background Service"));
                }
            });
          };

          sendUpdateReq(false);
      });
  }

  function createActionBtn(text, color, onClick) {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.className = "eds-btn eds-btn--primary";
      btn.style.marginLeft = "8px";
      btn.style.padding = "0 8px";
      btn.style.height = "24px";
      btn.style.fontSize = "12px";
      btn.style.lineHeight = "24px";
      btn.style.cursor = "pointer";
      btn.style.display = "inline-block";
      btn.style.backgroundColor = color;
      btn.style.border = "none";
      btn.style.color = "#fff";
      btn.addEventListener("click", onClick);
      return btn;
  }

  function renderReturnInfoCopyButtons() {
    const href = (window.location.href || "").toLowerCase();
    if (!href.includes('/portal/sale/returnrefundcancel') && !href.includes('/portal/sale/return')) {
      return;
    }

    updateDhHoanIdsCache().then(() => updateCopyButtonColors());
    updateHhBhMvdIdsCache().then(() => updateTrackingNumberColors());
    updateTrackingNumberColors();

    const orderIdElements = document.querySelectorAll('.id.order-id');
    for (const orderIdEl of orderIdElements) {
      // Gắn sự kiện click trực tiếp và style cho span.id-content
      const orderIdContentEl = orderIdEl.querySelector('.id-content');
      if (orderIdContentEl) {
        orderIdContentEl.style.cursor = "pointer";
        orderIdContentEl.style.color = "#1890ff";
        orderIdContentEl.style.fontWeight = "bold";
        orderIdContentEl.title = "Click để mở chi tiết đơn hàng trong Chrome mới (tự đóng sau 1 phút)";

        if (orderIdContentEl.dataset.shopeeExtClickBound !== "1") {
          orderIdContentEl.dataset.shopeeExtClickBound = "1";
          orderIdContentEl.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const data = extractReturnRowData(orderIdEl);
            const targetUrl = findOrderRowHref(orderIdEl, data.orderId);
            chrome.runtime.sendMessage({
              type: "OPEN_ORDER_IN_NEW_WINDOW",
              url: targetUrl,
              orderId: data.orderId,
              autoCloseDelay: 60000
            });
          });
        }
      }

      if (orderIdEl.dataset.shopeeQlspCopyReturnInfo === "1") {
        continue;
      }
      orderIdEl.dataset.shopeeQlspCopyReturnInfo = "1";

      const container = document.createElement("div");
      container.style.display = "inline-flex";
      container.style.alignItems = "center";
      container.style.marginLeft = "12px";

      const btnCopy = createActionBtn("Copy Data", "#ee4d2d", (e) => {
        e.stopPropagation(); e.preventDefault();
        const data = extractReturnRowData(orderIdEl);
        if (!data) return;
        const copyLines = [];
        if (data.orderId) copyLines.push(`Mã đơn hàng: ${data.orderId}`);
        if (data.reason) copyLines.push(`Lý do: ${data.reason}`);
        if (data.returnId) copyLines.push(`Mã yêu cầu trả hàng: ${data.returnId}`);
        if (data.tracking) copyLines.push(`Vận chuyển hàng hoàn: ${data.tracking}`);
        const copyText = copyLines.join('\n');
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(copyText).then(() => {
                btnCopy.textContent = "Copied!";
                setTimeout(() => { btnCopy.textContent = "Copy Data"; }, 1500);
            });
        } else {
            const textarea = document.createElement("textarea");
            textarea.value = copyText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            btnCopy.textContent = "Copied!";
            setTimeout(() => { btnCopy.textContent = "Copy Data"; }, 1500);
        }
      });
      
      const directOrderId = extractShopeeCode(orderIdEl.textContent);
      btnCopy.dataset.shopeeQlspCopyReturnOrderId = directOrderId;
      btnCopy.classList.add("btn-copy-return-data-check");
      
      if (directOrderId && (cachedDhHoanIds.has(directOrderId) || cachedDonHangMdhIndices.has(directOrderId))) {
          btnCopy.style.backgroundColor = "#cbb89d"; // màu be
          btnCopy.style.borderColor = "#b7a285";
          btnCopy.style.color = "#3d3124";
          btnCopy.style.fontWeight = "bold";
      }
      
      container.appendChild(btnCopy);

      const btnHuy = createActionBtn("Hủy", "#ef4444", (e) => { e.stopPropagation(); e.preventDefault(); handleDhHoanAction("Hủy", orderIdEl, btnHuy); });
      container.appendChild(btnHuy);

      const btnHoan = createActionBtn("Hoàn", "#f59e0b", (e) => { e.stopPropagation(); e.preventDefault(); handleDhHoanAction("Hoàn", orderIdEl, btnHoan); });
      container.appendChild(btnHoan);

      const btnTra = createActionBtn("Trả", "#3b82f6", (e) => { e.stopPropagation(); e.preventDefault(); handleDhHoanAction("Trả", orderIdEl, btnTra); });
      container.appendChild(btnTra);

      const btnUpdate = createActionBtn("Cập nhật", "#64748b", (e) => { e.stopPropagation(); e.preventDefault(); handleDhHoanAction("Cập nhật", orderIdEl, btnUpdate); });
      container.appendChild(btnUpdate);

      const returnIdContainer = orderIdEl.parentElement.querySelector('.id.return-id');
      if (returnIdContainer) {
          returnIdContainer.appendChild(container);
      } else {
          orderIdEl.appendChild(container);
      }
    }
  }

  window.setTimeout(refreshVisibleProductGallery, 1200);
  window.setTimeout(refreshVisibleProductGallery, 3500);
  function normalizeOrderDetailText(value) {
      return String(value || "")
          .replace(/\u00a0/g, " ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\u0111/g, "d")
          .replace(/\u0110/g, "D")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
  }

  function cleanOrderDetailText(value) {
      return String(value || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim();
  }

  function getOrderDetailOwnText(element) {
      return Array.from(element?.childNodes || [])
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
  }

  function isOrderDetailVisible(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && element.getClientRects().length > 0;
  }

  function getOrderDetailLines(root = document.body) {
      return String(root?.innerText || root?.textContent || "")
          .split(/\r?\n+/)
          .map(cleanOrderDetailText)
          .filter(Boolean);
  }

  function extractOrderMoneyValues(text) {
      return String(text || "").match(/(?:[-–—]\s*)?₫\s*[\d.,]+|[\d.,]+\s*₫|(?:[-–—]\s*)?\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/g) || [];
  }

  function extractSellerOrderIdFromPage() {
      const directSnEl = document.querySelector(".order-sn, .order-id, [class*='order-sn'], [class*='orderId']");
      if (directSnEl) {
        const txt = directSnEl.textContent;
        const m = txt.match(/([0-9]{6}[A-Z0-9]{8,14})/i);
        if (m && m[1].toLowerCase() !== "detail") return m[1].toUpperCase();
      }

      const bodyDivs = document.querySelectorAll(".body, .body-content");
      for (const div of bodyDivs) {
          let text = "";
          for (let node of div.childNodes) {
              if (node.nodeType === Node.TEXT_NODE) {
                  text += node.textContent;
              }
          }
          text = text.trim();
          if (text) {
              const match = text.match(/([0-9]{6}[A-Z0-9]{8,14})/i);
              if (match && match[1].toLowerCase() !== "detail") return match[1].toUpperCase();
          }
      }

      const lines = getOrderDetailLines();
      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (normalizeOrderDetailText(line).includes("ma don hang") || normalizeOrderDetailText(line).includes("order sn")) {
              const sameLine = line.match(/([0-9]{6}[A-Z0-9]{8,14})/i);
              if (sameLine && sameLine[1].toLowerCase() !== "detail") return sameLine[1].toUpperCase();
              const next = lines[i + 1] || "";
              const nextMatch = next.match(/([0-9]{6}[A-Z0-9]{8,14})/i);
              if (nextMatch && nextMatch[1].toLowerCase() !== "detail") return nextMatch[1].toUpperCase();
          }
      }

      const allDivs = document.querySelectorAll(".order-id, .order-sn, [class*='order-sn'], [class*='orderSn'], [class*='order-id']");
      for (const div of allDivs) {
          const text = cleanOrderDetailText(div.textContent);
          const match = text.match(/([0-9]{6}[A-Z0-9]{8,14})/i);
          if (match && match[1].toLowerCase() !== "detail") return match[1].toUpperCase();
      }

      const urlMatch = location.pathname.match(/\/sale\/order\/([0-9]{6}[A-Z0-9]{8,14})/i) || location.search.match(/order_sn=([0-9]{6}[A-Z0-9]{8,14})/i);
      if (urlMatch) return urlMatch[1].toUpperCase();

      return "";
  }

  function findOrderPackageContainer(trackingText) {
      const candidates = Array.from(document.querySelectorAll("span.label, div, span")).filter(isOrderDetailVisible);
      const trackingNeedle = normalizeOrderDetailText(trackingText || "").replace(/^#\s*/, "");
      const matching = candidates.find((element) => {
          const text = normalizeOrderDetailText(element.textContent);
          return trackingNeedle && text.includes(trackingNeedle);
      });

      let current = matching;
      for (let depth = 0; depth < 8 && current; depth++) {
          const text = normalizeOrderDetailText(current.innerText || current.textContent);
          if (text.includes("kien hang") || text.includes("giao hang") || text.includes("nhanh")) {
              return current;
          }
          current = current.parentElement;
      }
      return matching || null;
  }

  function extractSellerOrderCreatedAt() {
      const timePattern1 = /\b(\d{1,2}:\d{2}(?::\d{2})?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\b/;
      const timePattern2 = /\b(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)\b/;

      // 1. Quét trực tiếp các thẻ có class .time hoặc div.time
      const timeElements = Array.from(document.querySelectorAll('.time, div[class*="time"], span[class*="time"], .order-time, .eds-timeline-item, div.time'));
      for (const el of timeElements) {
          const txt = cleanOrderDetailText(el.textContent || "").trim();
          const m1 = txt.match(timePattern1);
          if (m1) return `${m1[1]} ${m1[2]}`;
          const m2 = txt.match(timePattern2);
          if (m2) return `${m2[2]} ${m2[1]}`;
      }

      // 2. Quét các dòng văn bản cạnh 'đơn hàng mới' hoặc 'ngày đặt'
      const lines = getOrderDetailLines();
      for (let i = 0; i < lines.length; i++) {
          const norm = normalizeOrderDetailText(lines[i]);
          if (norm.includes("don hang moi") || norm.includes("ngay dat") || norm.includes("thoi gian dat")) {
              for (let off = 0; off <= 4; off++) {
                  const l = lines[i + off] || "";
                  const m1 = l.match(timePattern1);
                  if (m1) return `${m1[1]} ${m1[2]}`;
                  const m2 = l.match(timePattern2);
                  if (m2) return `${m2[2]} ${m2[1]}`;
              }
          }
      }

      // 3. Fallback quét toàn bộ text trong trang
      const allMatches = (document.body.innerText || "").match(/\b\d{1,2}:\d{2}(?::\d{2})?\s+\d{1,2}\/\d{1,2}\/\d{4}\b/g);
      if (allMatches && allMatches.length > 0) {
          return allMatches[0];
      }

      return "";
  }
  function extractSellerOrderPackageInfo() {
      const labelTexts = Array.from(document.querySelectorAll("span.label, div.label, .label"))
          .map((element) => cleanOrderDetailText(element.textContent))
          .filter(Boolean);
      let tracking = "";
      const trackingLabel = labelTexts.find((text) => /#\s*[A-Z0-9-]+/i.test(text));
      if (trackingLabel) {
          tracking = (trackingLabel.match(/#\s*([A-Z0-9-]+)/i) || [])[1] || "";
      }

      const globalLines = getOrderDetailLines();
      if (!tracking) {
          const trackingLine = globalLines.find((line) => /#\s*[A-Z0-9-]+/i.test(line));
          tracking = trackingLine ? ((trackingLine.match(/#\s*([A-Z0-9-]+)/i) || [])[1] || "") : "";
      }

      const container = findOrderPackageContainer(tracking);
      const lines = getOrderDetailLines(container || document.body);
      let packageName = "";
      let shippingType = "";
      let carrier = "";

      const packageIndex = lines.findIndex((line) => normalizeOrderDetailText(line).includes("kien hang"));
      if (packageIndex >= 0) {
          packageName = lines[packageIndex].replace(/:$/, "").trim();
      }

      const startIndex = packageIndex >= 0 ? packageIndex + 1 : 0;
      const packageDataLines = lines.slice(startIndex).filter((line) => {
          const normalized = normalizeOrderDetailText(line);
          return line &&
              !normalized.includes("ma don hang") &&
              !normalized.includes("sku phan loai") &&
              !normalized.includes("so luong") &&
              !extractOrderMoneyValues(line).length &&
              !/^#/.test(line.trim());
      });

      const trackingLine = lines.find((line) => /#\s*[A-Z0-9-]+/i.test(line));
      if (!tracking && trackingLine) {
          tracking = (trackingLine.match(/#\s*([A-Z0-9-]+)/i) || [])[1] || "";
      }

      shippingType = packageDataLines[0] || "";
      carrier = packageDataLines[1] || "";

      return { packageName, shippingType, carrier, tracking };
  }

  function collectSellerOrderPaymentItems() {
      const items = [];
      const addItem = (label, value) => {
          const cleanLabel = cleanOrderDetailText(label);
          const cleanValue = cleanOrderDetailText(value);
          if (!cleanLabel || !cleanValue || !extractOrderMoneyValues(cleanValue).length) return;
          const key = `${normalizeOrderDetailText(cleanLabel)}|||${cleanValue}`;
          if (!items.some((item) => item.key === key)) {
              items.push({ key, label: cleanLabel, normalizedLabel: normalizeOrderDetailText(cleanLabel), value: cleanValue });
          }
      };

      const itemContainers = document.querySelectorAll(
        ".income-item, .income-detail-item, .payment-item, .order-income-item, " +
        "[class*='income-item'], [class*='incomeItem'], [class*='cost-item'], " +
        ".order-income-section div, .order-panel-income div, .order-income div"
      );
      itemContainers.forEach((item) => {
          const labelEl = item.querySelector(".income-label-text, .label, .income-label, [class*='label'], [class*='title'], dt, span:first-child");
          const valueEl = item.querySelector(".income-value, .amount, .value, [class*='value'], [class*='amount'], dd, span:last-child");
          if (labelEl && valueEl && labelEl !== valueEl) {
            addItem(labelEl.textContent || "", valueEl.textContent || "");
          }
      });

      const lines = getOrderDetailLines();
      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const sameLineMoney = extractOrderMoneyValues(line);
          if (sameLineMoney.length) {
              const label = line.replace(sameLineMoney[sameLineMoney.length - 1], "").trim();
              if (label) addItem(label, sameLineMoney[sameLineMoney.length - 1]);
          }
          if (lines[i + 1] && extractOrderMoneyValues(lines[i + 1]).length) {
              addItem(line, lines[i + 1]);
          }
      }

      return items;
  }

  function findSellerOrderPaymentValue(paymentItems, labels) {
      const keys = labels.map(normalizeOrderDetailText).filter(Boolean);
      for (const key of keys) {
          const exact = paymentItems.find((item) => item.normalizedLabel === key);
          if (exact) return exact.value;
      }
      for (const key of keys) {
          const starts = paymentItems.find((item) => item.normalizedLabel.startsWith(key));
          if (starts) return starts.value;
      }
      for (const key of keys) {
          const includes = paymentItems.find((item) => item.normalizedLabel.includes(key));
          if (includes) return includes.value;
      }
      return "";
  }

  function findSellerOrderProductContainer(skuElement) {
      let current = skuElement;
      for (let depth = 0; depth < 8 && current; depth++) {
          const className = String(current.className || "");
          if (/product|item|order/i.test(className) && (current.querySelector(".qty") || extractOrderMoneyValues(current.innerText || "").length)) {
              return current;
          }
          current = current.parentElement;
      }
      return skuElement.parentElement || skuElement;
  }

  function extractSellerOrderProducts() {
      const productContainers = Array.from(document.querySelectorAll(
        ".order-view-item, .order-product-wrapper, .order-item, .product-item, .item-card, " +
        "[class*='order-view-item'], [class*='order-item'], [class*='orderProduct'], [class*='product-item']"
      )).filter(isOrderDetailVisible);

      if (productContainers.length > 0) {
          const results = [];
          for (const container of productContainers) {
              const clone = container.cloneNode(true);
              clone.querySelectorAll('button, .ext-copy-sku-btn, .ext-copy-prod-name-btn, .ext-open-product-wrapper, .ext-product-actions-footer, .shopee-qlsp-sku-display, .shopee-qlsp-copy-button, .btn-copy-price, .injected-sku-ct').forEach(n => n.remove());

              const cleanText = (el) => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';

              // 1. Tên sản phẩm & Mã trong ngoặc vuông [CODE] từ tên SP
              const titleEl = clone.querySelector(".ct-item-product-name, .product-name, [class*='product-name'], [class*='item-name']");
              const productName = cleanText(titleEl);
              let titleBracketCode = "";
              const mBracket = productName.match(/\[([A-Z0-9_-]{3,35})\]/i);
              if (mBracket && !/^(copy|sp|sku)$/i.test(mBracket[1])) {
                  titleBracketCode = mBracket[1].trim();
              }

              // 2. Tìm SKU từ các dòng meta
              let skuFromMeta = "";
              let variationName = "";
              const metaLines = Array.from(clone.querySelectorAll(".ct-item-meta, .item-meta, [class*='ct-item-meta'], [class*='item-meta'], [class*='sku'], [class*='variation'], .product-meta > div, [class*='product-meta'] > div"))
                  .map(cleanText).filter(Boolean);

              const allLines = (clone.innerText || clone.textContent || "").split('\n').map(l => l.trim()).filter(Boolean);
              const combinedLines = [...new Set([...metaLines, ...allLines])];

              for (const line of combinedLines) {
                  if (/sku\s*ph[aâ]n\s*lo[aạ]i|m[aã]\s*ph[aâ]n\s*lo[aạ]i|m[aã]\s*sku|^sku\s*:/i.test(line)) {
                      let val = line.replace(/.*(?:sku\s*ph[aâ]n\s*lo[aạ]i|m[aã]\s*ph[aâ]n\s*lo[aạ]i|m[aã]\s*sku|^sku)\s*:\s*/i, '').trim();
                      val = val.replace(/copy\s*sku|sao\s*ch[eé]p\s*sku|copy|sao\s*ch[eé]p/gi, '').trim();
                      if (val && !/^(copy|sku|sp)$/i.test(val)) {
                          skuFromMeta = val;
                          break;
                      }
                  }
                  if (/m[aã]\s*s[aả]n\s*ph[aẩ]m/i.test(line)) {
                      let val = line.replace(/.*m[aã]\s*s[aả]n\s*ph[aẩ]m\s*:\s*/i, '').trim();
                      val = val.replace(/copy\s*sku|sao\s*ch[eé]p\s*sku|copy|sao\s*ch[eé]p/gi, '').trim();
                      if (val && !/^(copy|sku|sp)$/i.test(val)) {
                          skuFromMeta = val;
                          break;
                      }
                  }
                  if (/ph[aâ]n\s*lo[aạ]i(?:\s*h[aà]ng)?\s*:/i.test(line) && !variationName) {
                      variationName = line.replace(/.*ph[aâ]n\s*lo[aạ]i(?:\s*h[aà]ng)?\s*:\s*/i, '').trim();
                  }
              }

              let finalSku = skuFromMeta || titleBracketCode || variationName || (productName ? productName.substring(0, 35) : "SP");
              finalSku = finalSku.replace(/copy\s*sku|sao\s*ch[eé]p/gi, '').trim();
              if (!finalSku) finalSku = titleBracketCode || "SP";

              let quantity = "1";
              const qtyEl = container.querySelector(".ct-item-product-num, .ct-item-product-qty, .qty, .quantity, [class*='qty'], [class*='quantity'], [class*='num']");
              if (qtyEl) {
                  quantity = cleanOrderDetailText(qtyEl.textContent).replace(/[^0-9]/g, "") || "1";
              }

              const moneyValues = extractOrderMoneyValues(container.innerText || container.textContent || "");
              const productPrice = moneyValues[0] || "";

              results.push({ sku: finalSku, quantity: quantity || "1", productPrice });
          }
          if (results.length > 0) return results;
      }

      return [{ sku: "SP", quantity: "1", productPrice: "" }];
  }

  function parseSellerOrderMoneyNumber(value) {
      const text = String(value || "").trim();
      if (!text) return 0;
      return parseInt(text.replace(/[^0-9]/g, ""), 10) || 0;
  }

  async function calculateSellerOrderProfitData(products, payments) {
      const dsSpData = await fetchDsSpData();
      const details = [];
      let totalCapital = 0;
      let totalQuantity = 0;

      const items = products.map((product, index) => {
          const sku = String(product.sku || "").trim();
          const sku10 = sku.substring(0, 10);
          const quantity = parseInt(String(product.quantity || "1").replace(/[^0-9]/g, ""), 10) || 1;
          const unitCost = dsSpData ? (dsSpData.get(sku10) || dsSpData.get(sku10.toUpperCase()) || dsSpData.get(sku10.toLowerCase()) || 0) : 0;
          const lineCost = unitCost ? unitCost * quantity : 0;

          if (sku10 && unitCost) {
              details.push(`SP ${index + 1} (${sku10}) x${quantity}: ${lineCost}`);
              totalCapital += lineCost;
              totalQuantity += quantity;
          }

          return {
              ...product,
              idSp: sku10,
              unitCost: unitCost ? String(unitCost) : "",
              lineCost: lineCost ? String(lineCost) : ""
          };
      });

      const income = parseSellerOrderMoneyNumber(payments.estimatedOrderIncome);
      return {
          items,
          capitalDetails: details.join(" | "),
          totalCapital: totalCapital ? String(totalCapital) : "",
          profit: totalCapital ? String(income - totalCapital) : "",
          capitalProductCount: totalQuantity ? String(totalQuantity) : ""
      };
  }

  function extractSellerOrderCustomerInfo() {
    let tenKhach = "";
    let ngNhan = "";
    let diaChi = "";
    let linkDon = window.location.href || "";

    const usernameEl = document.querySelector(".username, [class*='username'], .buyer-name, [class*='buyer-name'], .user-name");
    if (usernameEl && usernameEl.textContent) {
      tenKhach = cleanOrderDetailText(usernameEl.textContent).trim();
    }
    if (!tenKhach) {
      const chatBtn = Array.from(document.querySelectorAll('button, a, span, div')).find(el => {
        const t = (el.textContent || "").trim().toLowerCase();
        return t === "chat ngay" || t.includes("chat ngay");
      });
      if (chatBtn) {
        const parent = chatBtn.closest('.buyer-info, .order-panel, .panel, div') || chatBtn.parentElement?.parentElement;
        if (parent) {
          const directDivs = Array.from(parent.querySelectorAll('div, span, p'))
            .map(e => cleanOrderDetailText(e.textContent).trim())
            .filter(t => t && !t.toLowerCase().includes("chat ngay") && t.length > 2);
          if (directDivs.length > 0) tenKhach = directDivs[0];
        }
      }
    }

    const shipAddressEl = document.querySelector(".ship-address, [class*='ship-address'], [class*='shipping-address'], .shipping-address");
    if (shipAddressEl) {
      diaChi = cleanOrderDetailText(shipAddressEl.textContent).trim();
      const parentEl = shipAddressEl.parentElement;
      if (parentEl) {
        const prevDiv = parentEl.querySelector('div:not(.ship-address):not([class*="ship-address"]), span:first-child');
        if (prevDiv && prevDiv !== shipAddressEl) {
          ngNhan = cleanOrderDetailText(prevDiv.textContent).trim();
        }
      }
    }

    if (!diaChi || !ngNhan) {
      const recipientDiv = Array.from(document.querySelectorAll('div, span, p')).find(el => {
        const t = el.textContent || "";
        return /\*{4,}\d{2}/.test(t) || /\d{3,4}\s*\*{3,}\s*\d{3,4}/.test(t);
      });
      if (recipientDiv) {
        if (!ngNhan) ngNhan = cleanOrderDetailText(recipientDiv.textContent).trim();
        const nextDiv = recipientDiv.nextElementSibling || recipientDiv.parentElement?.querySelector('.ship-address, div:nth-child(2)');
        if (nextDiv && !diaChi) diaChi = cleanOrderDetailText(nextDiv.textContent).trim();
      }
    }

    if (!diaChi || !ngNhan) {
      const addressHeaders = Array.from(document.querySelectorAll('div, span, p, h3, h4')).filter(el => {
        const t = normalizeOrderDetailText(el.textContent || "");
        return t === "dia chi nhan hang" || t.includes("dia chi nhan hang");
      });
      for (const header of addressHeaders) {
        const box = header.closest('.address-panel, .panel, .card, div') || header.parentElement;
        if (box) {
          const texts = Array.from(box.querySelectorAll('div, p, span'))
            .map(e => cleanOrderDetailText(e.textContent).trim())
            .filter(t => t && !normalizeOrderDetailText(t).includes("dia chi nhan hang") && !normalizeOrderDetailText(t).includes("thong tin van chuyen") && t.length > 2);
          if (texts.length >= 2) {
            if (!ngNhan) ngNhan = texts[0];
            if (!diaChi) diaChi = texts[1];
            break;
          }
        }
      }
    }

    return { tenKhach, ngNhan, diaChi, linkDon };
  }

  async function extractSellerOrderDetailFullData() {
      if (!location.pathname.startsWith("/portal/sale/order")) {
          return { ok: false, error: "Hãy mở trang chi tiết đơn hàng Shopee trước." };
      }

      const orderId = extractSellerOrderIdFromPage();
      const packageInfo = extractSellerOrderPackageInfo();
      const orderCreatedAt = extractSellerOrderCreatedAt();
      const customerInfo = extractSellerOrderCustomerInfo();
      const paymentItems = collectSellerOrderPaymentItems();
      const products = extractSellerOrderProducts();

      const totalProductAmount = findSellerOrderPaymentValue(paymentItems, ["tong tien san pham", "tong tien hang", "tong gia ban"]);
      const productPrice = findSellerOrderPaymentValue(paymentItems, ["gia san pham"]);
      const estimatedShippingTotal = findSellerOrderPaymentValue(paymentItems, ["tong phi van chuyen uoc tinh", "tong phi van chuyen", "phi van chuyen uoc tinh", "phi van chuyen"]);
      const buyerPaidShippingFee = findSellerOrderPaymentValue(paymentItems, ["phi van chuyen nguoi mua tra"]);
      const estimatedShippingFee = findSellerOrderPaymentValue(paymentItems, ["phi van chuyen uoc tinh"]);
      
      const fixedFee = findSellerOrderPaymentValue(paymentItems, ["phi co dinh"]);
      const serviceFee = findSellerOrderPaymentValue(paymentItems, ["phi dich vu"]);
      const transactionFee = findSellerOrderPaymentValue(paymentItems, ["phi xu ly giao dich", "phi thanh toan", "phi giao dich"]);
      
      let surcharge = findSellerOrderPaymentValue(paymentItems, ["tong phi san", "phi san", "phu phi", "phi nguoi ban phai tra", "chi phi san"]);
      if (!surcharge || parseSellerOrderMoneyNumber(surcharge) === 0) {
        const subFeeSum = parseSellerOrderMoneyNumber(fixedFee) + parseSellerOrderMoneyNumber(serviceFee) + parseSellerOrderMoneyNumber(transactionFee);
        if (subFeeSum > 0) {
          surcharge = String(subFeeSum);
        }
      }

      const vatTax = findSellerOrderPaymentValue(paymentItems, ["thue gtgt", "thue gia tri gia tang"]);
      const pitTax = findSellerOrderPaymentValue(paymentItems, ["thue tncn", "thue thu nhap ca nhan"]);
      let tax = findSellerOrderPaymentValue(paymentItems, ["tong thue", "thue"]);
      if (!tax || parseSellerOrderMoneyNumber(tax) === 0) {
        const taxSum = parseSellerOrderMoneyNumber(vatTax) + parseSellerOrderMoneyNumber(pitTax);
        if (taxSum > 0) {
          tax = String(taxSum);
        }
      }

      const estimatedOrderIncome = findSellerOrderPaymentValue(paymentItems, ["doanh thu don hang uoc tinh", "doanh thu don hang", "thuc nhan", "so tien thanh toan"]);

      const payments = {
          totalProductAmount,
          productPrice,
          estimatedShippingTotal,
          buyerPaidShippingFee,
          estimatedShippingFee,
          surcharge,
          fixedFee,
          serviceFee,
          transactionFee,
          tax,
          vatTax,
          pitTax,
          buyerValueAddedServiceTotal: findSellerOrderPaymentValue(paymentItems, ["tong phu dich vu gia tri gia tang cho nguoi mua", "tong phu dv gtgt"]),
          estimatedOrderIncome
      };
      const profitData = await calculateSellerOrderProfitData(products, payments);

      const rows = (profitData.items || products).map((product) => ({
          orderId,
          orderCreatedAt,
          packageName: packageInfo.packageName,
          shippingType: packageInfo.shippingType,
          carrier: packageInfo.carrier,
          tracking: packageInfo.tracking,
          tenKhach: customerInfo.tenKhach,
          ngNhan: customerInfo.ngNhan,
          diaChi: customerInfo.diaChi,
          linkDon: customerInfo.linkDon,
          sku: product.sku,
          idSp: product.idSp || String(product.sku || "").trim().substring(0, 10),
          quantity: product.quantity,
          unitCost: product.unitCost || "",
          lineCost: product.lineCost || "",
          totalProductAmount: payments.totalProductAmount,
          productPrice: product.productPrice || payments.productPrice,
          estimatedShippingTotal: payments.estimatedShippingTotal,
          buyerPaidShippingFee: payments.buyerPaidShippingFee,
          estimatedShippingFee: payments.estimatedShippingFee,
          surcharge: payments.surcharge,
          fixedFee: payments.fixedFee,
          serviceFee: payments.serviceFee,
          transactionFee: payments.transactionFee,
          tax: payments.tax,
          vatTax: payments.vatTax,
          pitTax: payments.pitTax,
          buyerValueAddedServiceTotal: payments.buyerValueAddedServiceTotal,
          estimatedOrderIncome: payments.estimatedOrderIncome,
          capitalDetails: profitData.capitalDetails,
          totalCapital: profitData.totalCapital,
          profit: profitData.profit
      }));

      return { ok: true, orderId, orderCreatedAt, packageInfo, customerInfo, payments, products, profitData, rows, url: location.href };
  }

  async function buildDhValuesFromDetail(rows, maGian) {
    let dsSpMap = new Map();
    try {
      const res = await new Promise((resolve) => chrome.runtime.sendMessage({ type: "FETCH_DS_SP" }, resolve));
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

    const processedRows = rows.map((row) => {
      const mdh = String(row.orderId || "").trim();
      const sku = String(row.sku || "").trim();
      const idSp = sku.length >= 10 ? sku.substring(0, 10) : sku;
      const slg = Number(String(row.quantity || "1").replace(/[^0-9]/g, "")) || 1;
      
      let donGia = dsSpMap.get(idSp.toLowerCase());
      if (donGia === undefined || donGia === null || donGia === 0) {
        const rawUnitCost = String(row.unitCost || "").replace(/[^0-9]/g, "");
        donGia = rawUnitCost ? Number(rawUnitCost) : 0;
      }

      const thanhTien = slg * donGia;

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

    const tienSpMap = new Map();
    processedRows.forEach(item => {
      const key = item.mdh || "__order__";
      tienSpMap.set(key, (tienSpMap.get(key) || 0) + item.thanhTien);
    });

    const parseMoneyNumber = (val) => {
      if (val === null || val === undefined) return 0;
      const digits = String(val).replace(/[^0-9]/g, "");
      return digits ? Number(digits) : 0;
    };

    const extractDatePart = (timeStr) => {
      if (!timeStr) return "";
      const m = timeStr.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
      return m ? m[0] : timeStr;
    };

    const formatDateTime = (timeStr) => {
      if (!timeStr) return "";
      const m1 = timeStr.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (m1) {
        const t = m1[1].split(":");
        const hhmm = `${t[0].padStart(2, "0")}:${t[1].padStart(2, "0")}`;
        const ss = t[2] ? `:${t[2].padStart(2, "0")}` : ":00";
        return `${m1[2]} ${hhmm}${ss}`;
      }
      const m2 = timeStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
      if (m2) {
        const t = m2[2].split(":");
        const hhmm = `${t[0].padStart(2, "0")}:${t[1].padStart(2, "0")}`;
        const ss = t[2] ? `:${t[2].padStart(2, "0")}` : ":00";
        return `${m2[1]} ${hhmm}${ss}`;
      }
      return timeStr;
    };

    // 25 CỘT CHUẨN XÁC 100% VỚI SHEET DH
    return processedRows.map((item) => {
      const { row, mdh, sku, idSp, slg, donGia, thanhTien } = item;
      const tienSp = tienSpMap.get(mdh || "__order__") || 0;
      
      const tongTien = parseMoneyNumber(row.totalProductAmount);
      const maGiamGia = 0;
      const phiVc = parseMoneyNumber(row.estimatedShippingTotal);
      const phuPhi = parseMoneyNumber(row.surcharge);
      const thue = parseMoneyNumber(row.tax);
      
      // Doanh thu theo công thức: tong_tien - ma_giam_gia (0) - phi_vc - phu_phi - thue
      const doanhThu = tongTien - maGiamGia - phiVc - phuPhi - thue;
      const phiKhac = 0;

      // Lợi nhuận = doanh_thu - phi_khac - tien_sp
      const loiNhuan = doanhThu - phiKhac - tienSp;

      return [
        maGian,                                   // Col A (1): gian
        extractDatePart(row.orderCreatedAt),     // Col B (2): ngay
        formatDateTime(row.orderCreatedAt),       // Col C (3): ngay_gio
        mdh,                                      // Col D (4): mdh
        String(row.tracking || "").trim(),        // Col E (5): mvd
        tongTien,                                 // Col F (6): tong_tien
        maGiamGia,                                // Col G (7): ma_giam_gia
        phiVc,                                    // Col H (8): phi_vc
        phuPhi,                                   // Col I (9): phu_phi
        thue,                                     // Col J (10): thue
        doanhThu,                                 // Col K (11): doanh_thu
        phiKhac,                                  // Col L (12): phi_khac
        tienSp,                                   // Col M (13): tien_sp
        loiNhuan,                                 // Col N (14): loi_nhuan
        "",                                       // Col O (15): tinh_trang
        "",                                       // Col P (16): trang_thai
        sku,                                      // Col Q (17): sku
        idSp,                                     // Col R (18): id_sp
        slg,                                      // Col S (19): slg
        donGia,                                   // Col T (20): don_gia
        thanhTien,                                // Col U (21): thanh_tien
        String(row.tenKhach || "").trim(),        // Col V (22): ten_khach
        String(row.ngNhan || "").trim(),          // Col W (23): ng_nhan
        String(row.diaChi || "").trim(),          // Col X (24): dia_chi
        String(row.linkDon || location.href || "").trim() // Col Y (25): link_don
      ];
    });
  }


  let syncedOrderSnapshots = new Map();
  let isAutoProcessingOrder = false;

  function isOrderDetailDataReady(orderDetail) {
    if (!orderDetail || !orderDetail.ok || !orderDetail.rows || orderDetail.rows.length === 0) return false;
    if (!orderDetail.orderId) return false;
    return true;
  }

  async function checkAndAutoSyncDonHang(orderId) {
    if (!orderId || isAutoProcessingOrder) return;

    // Chỉ chạy khi đang ở trang chi tiết đơn hàng (không phải returnrefundcancel)
    if (!isSellerOrderDetailPage()) return;

    const orderDetail = await extractSellerOrderDetailFullData();
    if (!isOrderDetailDataReady(orderDetail)) {
      // Dữ liệu trang chưa load xong hết, đợi observer chu kỳ tiếp theo
      return;
    }

    const parseMoneyNumber = (val) => {
      if (val === null || val === undefined) return 0;
      const digits = String(val).replace(/[^0-9]/g, "");
      return digits ? Number(digits) : 0;
    };

    const pageTongTien = parseMoneyNumber(orderDetail.payments?.totalProductAmount);
    const pagePhiVc = parseMoneyNumber(orderDetail.payments?.estimatedShippingTotal);
    const pagePhuPhi = parseMoneyNumber(orderDetail.payments?.surcharge);
    const pageThue = parseMoneyNumber(orderDetail.payments?.tax);
    const pageMvd = String(orderDetail.packageInfo?.tracking || orderDetail.rows[0]?.tracking || "").trim();
    const pageTenKhach = String(orderDetail.customerInfo?.tenKhach || "").trim();
    const pageNgNhan = String(orderDetail.customerInfo?.ngNhan || "").trim();
    const pageDiaChi = String(orderDetail.customerInfo?.diaChi || "").trim();
    const pageSkuCount = orderDetail.rows.length;

    const currentSnapshotKey = `${pageTongTien}_${pagePhiVc}_${pagePhuPhi}_${pageThue}_${pageMvd}_${pageSkuCount}_${pageTenKhach}_${pageNgNhan}`;
    const lastSnapshot = syncedOrderSnapshots.get(orderId);

    if (lastSnapshot === currentSnapshotKey) {
      // Dữ liệu hiện tại đã được sync khớp hoàn toàn
      const btnAdd = document.getElementById('btn-add-don-hang');
      if (btnAdd && btnAdd.textContent.includes('Thêm mới')) {
        btnAdd.textContent = '✓ Đã có trong DH';
        btnAdd.style.backgroundColor = '#00bfa5';
        btnAdd.style.borderColor = '#00bfa5';
      }
      return;
    }

    isAutoProcessingOrder = true;

    try {
      const storage = await new Promise(r => chrome.storage.local.get(["maGian", "dhHoanTextValue"], r));
      const maGian = (storage?.maGian || storage?.dhHoanTextValue || "").trim();
      if (!maGian) {
        isAutoProcessingOrder = false;
        return;
      }

      const checkResponse = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: "CHECK_AND_GET_DH_ORDER",
          mdh: orderId,
          maGian: maGian
        }, resolve);
      });

      const btnAdd = document.getElementById('btn-add-don-hang');

      if (!checkResponse || !checkResponse.exists || checkResponse.rows.length === 0) {
        // TỰ ĐỘNG THÊM MỚI KHI CHƯA CÓ TRONG SHEET DH
        if (btnAdd) {
          btnAdd.textContent = '⚡ Đang tự động thêm vào DH...';
          btnAdd.disabled = true;
        }

        const dhValues = await buildDhValuesFromDetail(orderDetail.rows, maGian);
        const sampleMdh = orderDetail.orderId || orderDetail.rows[0]?.orderId || "";
        const sampleMvd = pageMvd;

        const saveRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({
            type: "SAVE_DH_ORDER",
            values: dhValues,
            mdh: sampleMdh,
            mvd: sampleMvd
          }, resolve);
        });

        if (saveRes && saveRes.ok) {
          syncedOrderSnapshots.set(orderId, currentSnapshotKey);
          lastFetchDonHangMdhTime = 0;
          updateDonHangMdhCache(true);
          if (btnAdd) {
            btnAdd.disabled = false;
            btnAdd.textContent = '✓ Đã tự động thêm vào DH';
            btnAdd.style.backgroundColor = '#00bfa5';
            btnAdd.style.borderColor = '#00bfa5';
          }
          console.log(`[Shopee Ext] Đã tự động thêm mới đơn hàng ${orderId} vào Sheet DH`);
        } else {
          if (btnAdd) {
            btnAdd.disabled = false;
            btnAdd.textContent = 'Thêm mới vào DH';
          }
        }
      } else {
        // TỰ ĐỘNG CẬP NHẬT KHI THÔNG TIN TÀI CHÍNH HOẶC THÔNG TIN ĐƠN CHƯA GIỐNG NHAU
        let isDataMismatch = false;

        for (const r of checkResponse.rows) {
          const sheetTongTien = parseMoneyNumber(r.tongTien);
          const sheetPhiVc = parseMoneyNumber(r.phiVc);
          const sheetPhuPhi = parseMoneyNumber(r.phuPhi);
          const sheetThue = parseMoneyNumber(r.thue);
          const sheetMvd = String(r.mvd || "").trim();
          const sheetTenKhach = String(r.tenKhach || "").trim();
          const sheetNgNhan = String(r.ngNhan || "").trim();
          const sheetDiaChi = String(r.diaChi || "").trim();

          if (sheetTongTien !== pageTongTien || 
              sheetPhiVc !== pagePhiVc || 
              sheetPhuPhi !== pagePhuPhi || 
              sheetThue !== pageThue ||
              (!sheetMvd && pageMvd) ||
              (!sheetTenKhach && pageTenKhach) ||
              (!sheetNgNhan && pageNgNhan) ||
              (!sheetDiaChi && pageDiaChi)) {
            isDataMismatch = true;
            break;
          }
        }

        if (isDataMismatch) {
          if (btnAdd) {
            btnAdd.textContent = '⚡ Đang tự động cập nhật lại DH...';
            btnAdd.disabled = true;
          }

          const dhValues = await buildDhValuesFromDetail(orderDetail.rows, maGian);
          const sampleMdh = orderDetail.orderId || orderDetail.rows[0]?.orderId || "";
          const sampleMvd = pageMvd;

          const saveRes = await new Promise(resolve => {
            chrome.runtime.sendMessage({
              type: "SAVE_DH_ORDER",
              values: dhValues,
              mdh: sampleMdh,
              mvd: sampleMvd
            }, resolve);
          });

          if (saveRes && saveRes.ok) {
            syncedOrderSnapshots.set(orderId, currentSnapshotKey);
            lastFetchDonHangMdhTime = 0;
            updateDonHangMdhCache(true);
            if (btnAdd) {
              btnAdd.disabled = false;
              btnAdd.textContent = '✓ Đã cập nhật lại vào DH';
              btnAdd.style.backgroundColor = '#00bfa5';
              btnAdd.style.borderColor = '#00bfa5';
            }
            console.log(`[Shopee Ext] Đã tự động cập nhật lại đơn ${orderId} vào Sheet DH`);
          } else {
            if (btnAdd) {
              btnAdd.disabled = false;
              btnAdd.textContent = 'Đã có trong DH';
              btnAdd.style.backgroundColor = '#00bfa5';
            }
          }
        } else {
          syncedOrderSnapshots.set(orderId, currentSnapshotKey);
          if (btnAdd) {
            btnAdd.disabled = false;
            btnAdd.textContent = '✓ Đã có trong DH';
            btnAdd.style.backgroundColor = '#00bfa5';
            btnAdd.style.borderColor = '#00bfa5';
          }
        }
      }
    } catch (err) {
      console.warn("Lỗi auto-sync đơn hàng:", err);
    } finally {
      isAutoProcessingOrder = false;
    }
  }

  function isSellerOrderDetailPage() {
    const path = (window.location.pathname || "").toLowerCase();
    
    // TUYỆT ĐỐI LOẠI TRỪ TRANG TRẢ HÀNG, HOÀN TIỀN, HỦY
    if (path.includes('returnrefundcancel') || path.includes('/sale/return') || path.includes('/cancel') || path.includes('/refund')) {
      return false;
    }

    if (!path.startsWith('/portal/sale/order')) {
      return false;
    }

    const cleanPath = path.replace(/^\/portal\/sale\/order\/?/i, '').replace(/^detail\/?/i, '').trim();
    if (cleanPath) {
      const seg = cleanPath.split('/')[0].split('?')[0].trim();
      if (/^(order|list|mass|shipping|return|setting|batch|all|unprocessed|toship|completed|cancelled)$/i.test(seg)) {
        return false;
      }
    }

    const breadcrumb = document.querySelector('.eds-breadcrumb, [class*="breadcrumb"], .portal-breadcrumb');
    if (breadcrumb && /chi tiết đơn hàng/i.test(breadcrumb.textContent)) {
      return true;
    }

    if (cleanPath && /^[0-9A-Z]{10,}$/i.test(cleanPath)) {
      return true;
    }

    const search = window.location.search || "";
    if (/[?&](?:order_sn|orderId|order_id|ordersn)=([0-9A-Z]{8,})/i.test(search)) {
      return true;
    }

    return false;
  }

    function removeDonHangButtons() {
    const btnContainer = document.getElementById('shopee-ext-donhang-btns');
    if (btnContainer) btnContainer.remove();
    const btnAdd = document.getElementById('btn-add-don-hang');
    if (btnAdd && btnAdd.parentElement) btnAdd.remove();
    const floatingBtn = document.getElementById('shopee-ext-floating-dh-btn');
    if (floatingBtn) floatingBtn.remove();
  }

  function findTargetContainerForDonHangButton(orderId) {
    const breadcrumb = document.querySelector('.eds-breadcrumb, [class*="breadcrumb"], .portal-breadcrumb');
    if (breadcrumb) {
      return breadcrumb;
    }

    if (orderId) {
      const allDivs = document.querySelectorAll('.body, .order-sn, .order-sn-text, .order-number, [class*="order-sn"], [class*="order-id"], div, section, p');
      for (const div of allDivs) {
        const txt = (div.textContent || "").trim();
        if (txt.includes(orderId)) {
          return div;
        }
      }
    }

    return document.querySelector('.order-panel-header, .order-detail-header, .portal-panel-header, .page-header, .header-container, main, #app');
  }

  function renderDonHangButtons() {
      // 1. Chỉ chạy khi đang ở trang chi tiết đơn hàng
      if (!isSellerOrderDetailPage()) {
          removeDonHangButtons();
          return;
      }

      // 2. Tìm Mã đơn hàng (orderId) từ DOM hoặc URL
      let orderId = extractSellerOrderIdFromPage();
      if (!orderId) {
          const urlMatch = window.location.pathname.match(/\/portal\/sale\/(?:order|return)\/(?:detail\/)?([0-9A-Z]{8,})/i);
          if (urlMatch && urlMatch[1] && !/^(order|list|mass|shipping|return|setting|batch|all)$/i.test(urlMatch[1])) {
              orderId = urlMatch[1].trim();
          }
      }

      // Luôn dọn dẹp nút nổi thừa ở góc màn hình
      const floatingBtn = document.getElementById('shopee-ext-floating-dh-btn');
      if (floatingBtn) floatingBtn.remove();

      updateDonHangMdhCache();

      // 3. Tự động kiểm tra và đồng bộ (auto-add khi chưa có, auto-update khi phí/thuế sai)
      if (orderId && !/^(order|detail|list|all)$/i.test(orderId)) {
          checkAndAutoSyncDonHang(orderId);
      }

      // 4. Gắn duy nhất 1 nút bấm trực tiếp vào Breadcrumb / Header
      const targetContainer = findTargetContainerForDonHangButton(orderId);
      if (!targetContainer) return;

      let btnContainer = document.getElementById('shopee-ext-donhang-btns');
      if (!btnContainer) {
          btnContainer = document.createElement('div');
          btnContainer.id = 'shopee-ext-donhang-btns';
          btnContainer.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; margin-left: 14px; vertical-align: middle; z-index: 999;';
          targetContainer.appendChild(btnContainer);
      } else if (btnContainer.parentElement !== targetContainer) {
          targetContainer.appendChild(btnContainer);
      }

      let btnAdd = document.getElementById('btn-add-don-hang');
      if (!btnAdd) {
          btnAdd = document.createElement('button');
          btnAdd.id = 'btn-add-don-hang';
          btnAdd.className = "eds-btn eds-btn--primary";
          btnAdd.style.cssText = "padding: 4px 12px; font-size: 12px; font-weight: bold; cursor: pointer; border-radius: 4px; border: 1px solid #ee4d2d; background-color: #ee4d2d; color: white; transition: all 0.2s;";
          
          btnAdd.addEventListener('click', async () => {
              const originalText = btnAdd.textContent;
              btnAdd.textContent = '⏳ Đang tính toán...';
              btnAdd.disabled = true;

              try {
                  const orderDetail = await extractSellerOrderDetailFullData();
                  if (!orderDetail || !orderDetail.ok || !orderDetail.rows || orderDetail.rows.length === 0) {
                      alert('Không tìm thấy thông tin chi tiết đơn hàng! Vui lòng cuộn trang xuống để tải hết dữ liệu.');
                      btnAdd.textContent = originalText;
                      btnAdd.disabled = false;
                      return;
                  }

                  const storage = await new Promise(r => chrome.storage.local.get(["maGian", "dhHoanTextValue"], r));
                  const maGian = (storage?.maGian || storage?.dhHoanTextValue || "").trim();
                  if (!maGian) {
                      alert('Vui lòng vào Popup Extension cài đặt Mã Gian trước khi lưu!');
                      btnAdd.textContent = originalText;
                      btnAdd.disabled = false;
                      return;
                  }

                  const dhValues = await buildDhValuesFromDetail(orderDetail.rows, maGian);
                  const sampleMdh = orderDetail.orderId || orderDetail.rows[0]?.orderId || "";
                  const sampleMvd = orderDetail.packageInfo?.tracking || orderDetail.rows[0]?.tracking || "";

                  btnAdd.textContent = '⏳ Đang đẩy...';

                  chrome.runtime.sendMessage({
                      type: "SAVE_DH_ORDER",
                      values: dhValues,
                      mdh: sampleMdh,
                      mvd: sampleMvd
                  }, (response) => {
                      btnAdd.disabled = false;
                      if (response && response.ok) {
                          btnAdd.textContent = 'OK!';
                          lastFetchDonHangMdhTime = 0;
                          updateDonHangMdhCache(true);
                          setTimeout(() => { 
                              btnAdd.textContent = 'Đã có trong DH'; 
                              btnAdd.style.backgroundColor = '#00bfa5';
                              btnAdd.style.borderColor = '#00bfa5';
                          }, 1500);
                      } else {
                          btnAdd.textContent = 'Lỗi!';
                          alert('Lỗi: ' + (response?.error || 'Unknown'));
                          setTimeout(() => { btnAdd.textContent = originalText; }, 2000);
                      }
                  });
              } catch (err) {
                  console.error(err);
                  alert('Lỗi: ' + err.message);
                  btnAdd.textContent = originalText;
                  btnAdd.disabled = false;
              }
          });

          btnContainer.appendChild(btnAdd);
      }

      if (orderId && cachedDonHangMdhIndices.has(orderId) && cachedDonHangMdhIndices.get(orderId).length > 0) {
          if (!btnAdd.textContent.startsWith('⚡')) {
              btnAdd.textContent = 'Đã có trong DH';
              btnAdd.style.backgroundColor = '#00bfa5';
              btnAdd.style.borderColor = '#00bfa5';
          }
      } else {
          if (!btnAdd.textContent.startsWith('⚡')) {
              btnAdd.textContent = 'Thêm mới vào DH';
              btnAdd.style.backgroundColor = '#ee4d2d';
              btnAdd.style.borderColor = '#ee4d2d';
          }
      }
  }
  // Injected interceptor for FORCE_DOWNLOAD
  if ((window.location.href.includes("auto_download_ds_sp=1") || window.location.href.includes("auto_download_giam_gia=1")) && !window.hasInjectedDownloadInterceptor) {
      window.hasInjectedDownloadInterceptor = true;
      const script = document.createElement('script');
      script.textContent = `
          const originalClick = HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click = function() {
              const isPdfLink = this.href && (this.href.toLowerCase().includes('.pdf') || (this.textContent && this.textContent.toLowerCase().includes('pdf')) || this.href.startsWith('blob:'));
              
              if ((this.download && this.href) || isPdfLink) {
                  fetch(this.href).then(r => r.blob()).then(blob => {
                      const reader = new FileReader();
                      reader.onload = () => {
                          let fName = this.download || "shopee_document.pdf";
                          if (isPdfLink && !fName.endsWith('.pdf')) fName += '.pdf';
                          window.postMessage({ type: 'SHOPEE_FILE_DOWNLOAD', url: reader.result, filename: fName, isPdf: isPdfLink }, '*');
                      };
                      reader.readAsDataURL(blob);
                  }).catch(e => console.error("Shopee Download Intercept Error:", e));
                  
                  try { return originalClick.apply(this, arguments); } catch(e){}
              } else {
                  return originalClick.apply(this, arguments);
              }
          };

          const originalOpen = window.open;
          window.open = function(url, ...args) {
              if (url && typeof url === 'string') {
                  const isPdfUrl = url.toLowerCase().includes('.pdf') || url.includes('/api/v2/receipt/download');
                  if (isPdfUrl || url.startsWith('blob:')) {
                      fetch(url).then(r => r.blob()).then(blob => {
                          const reader = new FileReader();
                          reader.onload = () => {
                              window.postMessage({ type: 'SHOPEE_FILE_DOWNLOAD', url: reader.result, filename: "shopee_waybill.pdf", isPdf: true }, '*');
                          };
                          reader.readAsDataURL(blob);
                      }).catch(e => console.error("Shopee Window.Open Intercept Error:", e));
                      
                      return null;
                  }
              }
              return originalOpen.apply(this, [url, ...args]);
          };
      `;
      document.documentElement.appendChild(script);
      script.remove();

      window.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SHOPEE_FILE_DOWNLOAD') {
              chrome.storage.local.get(["maGian", "dhHoanTextValue"], (res) => {
                  let fName = event.data.filename;
                  const isPdf = event.data.isPdf || (fName && fName.toLowerCase().endsWith('.pdf'));
                  
                  if (isPdf) {
                      let maGian = (res.maGian || res.dhHoanTextValue || "BCE").toUpperCase();
                      const now = new Date();
                      const dd = String(now.getDate()).padStart(2, '0');
                      const mm = String(now.getMonth() + 1).padStart(2, '0');
                      const yyyy = now.getFullYear();
                      const hh = String(now.getHours()).padStart(2, '0');
                      const m = String(now.getMinutes()).padStart(2, '0');
                      fName = `Shopee_${maGian}_${dd}${mm}${yyyy}_${hh}${m}.pdf`;
                  }

                  // 1. Tải file về máy tính
                  chrome.runtime.sendMessage({
                      type: "FORCE_DOWNLOAD",
                      url: event.data.url,
                      filename: fName
                  });
              });
              
              const updateStatus = (msg, color) => {
                  const isGiamGia = window.location.href.includes("auto_download_giam_gia=1");
                  let statusDiv = document.getElementById(isGiamGia ? 'shopee-auto-giamgia-status' : 'shopee-auto-download-status');
                  if (statusDiv) {
                      statusDiv.textContent = msg;
                      if (color) statusDiv.style.backgroundColor = color;
                  }
              };

              // Prevent trying to parse PDF files as Excel
              if (event.data.isPdf || (event.data.filename && event.data.filename.toLowerCase().endsWith('.pdf'))) {
                  updateStatus("Đã tải xong file PDF!", "#16a34a");
                  setTimeout(() => {
                      const sd = document.getElementById('shopee-auto-download-status') || document.getElementById('shopee-auto-giamgia-status');
                      if (sd) sd.remove();
                  }, 3000);
                  return; // Stop here, do not parse as Excel
              }

              // 2. Tự động đọc file và đẩy lên SP_SHOPEE
              try {
                  if (typeof XLSX === 'undefined') {
                      updateStatus("Lỗi: Không tìm thấy thư viện XLSX!", "#dc2626");
                      return;
                  }
                  
                  updateStatus("B5. Đang đọc file Excel để tự động đẩy lên SP_SHOPEE...", "#f59e0b");
                  
                  const base64 = event.data.url.split(',')[1];
                  const binary_string = window.atob(base64);
                  const len = binary_string.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                      bytes[i] = binary_string.charCodeAt(i);
                  }
                  
                  const workbook = XLSX.read(bytes, { type: 'array' });
                  const sheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[sheetName];
                  const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                  const dataRows = json.slice(1);
                  
                  chrome.storage.local.get(["maGian", "dhHoanTextValue"], (result) => {
                      const maGian = result.maGian || result.dhHoanTextValue || "";
                      const isGiamGia = window.location.href.includes("auto_download_giam_gia=1");
                      
                      if (maGian) {
                          dataRows.forEach(row => {
                              if (isGiamGia) row[8] = maGian; // Cột I cho SP_GIAM_GIA
                              else row[11] = maGian; // Cột L cho SP_SHOPEE
                          });
                      }
                      
                      updateStatus(`B6. Đang đẩy ${dataRows.length} sản phẩm lên Google Sheet...`, "#3b82f6");
                      const uploadType = isGiamGia ? "UPLOAD_SP_GIAM_GIA" : "UPLOAD_SP_SHOPEE";
                      
                      chrome.runtime.sendMessage({ type: uploadType, values: dataRows, maGian: maGian }, (response) => {
                          if (response && response.ok) {
                              updateStatus(`Tuyệt vời! Đã tự động đẩy xong ${dataRows.length} SP lên Sheet.`, "#16a34a");
                              setTimeout(() => {
                                  const sd = document.getElementById('shopee-auto-download-status');
                                  if (sd) sd.remove();
                              }, 7000);
                          } else {
                              updateStatus(`Lỗi lưu Google Sheet: ${response ? response.error : 'Unknown'}`, "#dc2626");
                          }
                      });
                  });

              } catch (err) {
                  console.error("Auto upload error:", err);
                  updateStatus("Lỗi đọc file Excel tự động: " + err.message, "#dc2626");
              }
          }
      });
  }
// Auto Download DS_SP Logic with Floating Status
  if (window.location.href.includes("auto_download_ds_sp=1")) {
      const showFloatingStatus = (msg) => {
          console.log(msg);
          let statusDiv = document.getElementById('shopee-auto-download-status');
          if (!statusDiv) {
              statusDiv = document.createElement('div');
              statusDiv.id = 'shopee-auto-download-status';
              statusDiv.style.position = 'fixed';
              statusDiv.style.top = '80px';
              statusDiv.style.right = '20px';
              statusDiv.style.padding = '15px 20px';
              statusDiv.style.backgroundColor = '#16a34a';
              statusDiv.style.color = '#fff';
              statusDiv.style.fontSize = '16px';
              statusDiv.style.fontWeight = 'bold';
              statusDiv.style.borderRadius = '8px';
              statusDiv.style.zIndex = '999999';
              statusDiv.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              statusDiv.style.transition = 'all 0.3s ease';
              document.body.appendChild(statusDiv);
          }
          statusDiv.textContent = msg;
          
          if (msg.includes("Lỗi") || msg.includes("Không tìm thấy")) {
              statusDiv.style.backgroundColor = '#dc2626'; // red
          } else if (msg.includes("Hoàn tất")) {
              statusDiv.style.backgroundColor = '#2563eb'; // blue
              setTimeout(() => {
                  if (statusDiv) statusDiv.remove();
              }, 5000);
          }
      };

      const getFirstRowText = () => {
          const btn = document.querySelector('button.eds-button--outline');
          if (!btn) return "";
          const row = btn.closest('tr, [class*="row"]');
          return row ? row.textContent.trim() : "";
      };

      const waitForRender = setInterval(() => {
          if (document.querySelector('button.generate-btn')) {
              clearInterval(waitForRender);
              showFloatingStatus("B1. Trang load xong, đợi 3s để chọn mẫu...");
              
              setTimeout(() => {
                  let clickedRadio = false;
                  const spans = document.querySelectorAll('span, div, label');
                  for (const span of spans) {
                      if (span.textContent && span.textContent.trim() === "Thông tin Bán hàng") {
                          const container = span.closest('.eds-radio') || span.parentElement;
                          const indicator = container ? container.querySelector('.eds-radio__indicator') : null;
                          if (indicator) {
                              indicator.click();
                              clickedRadio = true;
                              showFloatingStatus("B2. Đã chọn Thông tin Bán hàng. Đợi 3s...");
                              break;
                          }
                      }
                  }
                  
                  if (!clickedRadio) {
                     const indicators = document.querySelectorAll('.eds-radio__indicator');
                     if (indicators.length > 1) {
                         indicators[1].click();
                         showFloatingStatus("B2. Đã chọn Thông tin Bán hàng (auto). Đợi 3s...");
                     }
                  }

                  setTimeout(() => {
                      const btn = document.querySelector('button.generate-btn');
                      if (btn && !btn.disabled) {
                          const oldRowText = getFirstRowText();

                          btn.click();
                          showFloatingStatus("B3. Đã bấm Tạo Báo Cáo. Đang đợi xử lý...");
                          
                          let checkCount = 0;
                          const checkDownloadExcel = setInterval(() => {
                              checkCount++;
                              
                              const currentFirstBtn = document.querySelector('button.eds-button--outline');
                              const currentFirstRow = currentFirstBtn ? currentFirstBtn.closest('tr, [class*="row"]') : null;
                              const curRowText = currentFirstRow ? currentFirstRow.textContent.trim() : '';

                              if (curRowText && curRowText !== oldRowText) {
                                  if (currentFirstBtn && currentFirstBtn.textContent.trim() === "Tải về") {
                                      currentFirstBtn.click();
                                      showFloatingStatus("B4. Hoàn tất! Đã click tải file Excel.");
                                      clearInterval(checkDownloadExcel);
                                  } else {
                                      showFloatingStatus(`B3. Đang xử lý báo cáo mới... (${checkCount}s)`);
                                  }
                              } else {
                                  showFloatingStatus(`B3. Đang chờ báo cáo xuất hiện... (${checkCount}s)`);
                              }
                              
                              if (checkCount > 120) {
                                  showFloatingStatus("Lỗi: Quá 2 phút báo cáo chưa xong.");
                                  clearInterval(checkDownloadExcel);
                              }
                          }, 1000);

                      } else {
                          showFloatingStatus("Lỗi: Không tìm thấy nút tạo báo cáo.");
                      }
                  }, 3500);
                  
              }, 3500);
          }
      }, 1000);
      
      setTimeout(() => clearInterval(waitForRender), 20000);
  }

  window.setTimeout(renderProductListQuickActions, 1200);
  window.setTimeout(renderOrderSnCopyButtons, 1200);
  window.setTimeout(renderItemNameCopyButtons, 1200);
  window.setTimeout(renderTrackingNumberCopyButtons, 1200);
  window.setTimeout(renderProductSkus, 1200);
  window.setTimeout(injectAwbDownloadButton, 1200);
  window.setTimeout(bindDescriptionImageDrop, 1200);
  window.setTimeout(renderOrderProfit, 1200);
  window.setTimeout(renderOrderDetailProductEnhancements, 1000);
  window.setInterval(renderOrderDetailProductEnhancements, 1200);
  window.setInterval(injectFinanceExpandButtons, 1000);
  window.setTimeout(renderReturnInfoCopyButtons, 1200);
  window.setInterval(renderProductListQuickActions, 1500);
  window.setInterval(renderOrderSnCopyButtons, 1500);
  window.setInterval(renderItemNameCopyButtons, 1500);
  window.setInterval(renderTrackingNumberCopyButtons, 1500);
  window.setInterval(renderProductSkus, 1500);
  window.setInterval(injectAwbDownloadButton, 1500);
  window.setInterval(bindDescriptionImageDrop, 1500);
  window.setInterval(renderOrderProfit, 1500);
  window.setInterval(renderReturnInfoCopyButtons, 1500);
  window.setInterval(renderDonHangButtons, 600);

  // ===== BACKGROUND AUTO-FILL =====
  // Listens for autoFillText saved to chrome.storage by popup.js
  // and automatically fills empty fields on the Shopee add-product page.

  let lastAutoFillTimestamp = 0;
  let isAutoFilling = false;

  function parseAutoFillText(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return { name: "", description: "" };
    if (!text.includes("|")) {
      return text.length > 120
        ? { name: "", description: text }
        : { name: text, description: "" };
    }
    const parts = text.split("|");
    return {
      name: parts[0].trim(),
      description: parts.slice(1).join("|").trim()
    };
  }

  async function runAutoFill(autoFillText, autoFillBrand) {
    if (isAutoFilling) return;
    isAutoFilling = true;
    try {
      const product = parseAutoFillText(autoFillText);
      await autoFillIfEmpty(product, autoFillBrand || "");
    } finally {
      isAutoFilling = false;
    }
  }

  function handleAutoFillStorage(result) {
    const ts = result.autoFillTimestamp || 0;
    if (ts <= lastAutoFillTimestamp) return; // already handled this one
    lastAutoFillTimestamp = ts;

    const autoFillText = String(result.autoFillText || "").trim();
    const autoFillBrand = String(result.autoFillBrand || "").trim();
    if (autoFillText || autoFillBrand) {
      runAutoFill(autoFillText, autoFillBrand);
    }
  }

  // Listen for changes from popup.js
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.autoFillTimestamp) {
      chrome.storage.local.get(["autoFillText", "autoFillBrand", "autoFillTimestamp"], handleAutoFillStorage);
    }
  });

  // Also try on page load (in case popup was already set before page load)
  chrome.storage.local.get(["autoFillText", "autoFillBrand", "autoFillTimestamp"], (result) => {
    const ts = result.autoFillTimestamp || 0;
    const now = Date.now();
    // Only auto-fill if storage was set within last 5 minutes (fresh pick)
    if (now - ts < 5 * 60 * 1000) {
      lastAutoFillTimestamp = ts; // mark as handled so onChanged doesn't double-fire
      const autoFillText = String(result.autoFillText || "").trim();
      const autoFillBrand = String(result.autoFillBrand || "").trim();
      if (autoFillText || autoFillBrand) {
        // Wait for page to load fields before filling
        setTimeout(() => runAutoFill(autoFillText, autoFillBrand), 1500);
        setTimeout(() => runAutoFill(autoFillText, autoFillBrand), 3000);
        setTimeout(() => runAutoFill(autoFillText, autoFillBrand), 5000);
      }
    }
  });

})();



// Tá»± Ä‘á»™ng xoÃ¡ nÃºt c�…© náº¿u ngÆ°á»i dÃ¹ng chÆ°a táº£i láº¡i trang
const oldFlashBtn = document.getElementById('shopee-export-flash-btn');
if (oldFlashBtn) oldFlashBtn.remove();

(function() {
    let discountSkuMappingCache = null;
    let isFetchingDiscountSkuMapping = false;
    let cachedMaGian = null;
    
    function cleanStr(s) {
        return String(s || "")
            .normalize("NFC")
            .toLowerCase()
            .replace(/[\.…\u2026]+$/g, '')
            .replace(/[\s\-_,]+/g, ' ')
            .trim();
    }

    function cleanHeader(s) {
        return cleanStr(s)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd');
    }

    function makeKey(pName, vName) {
        return cleanStr(pName) + '|||' + cleanStr(vName);
    }

    function getElTitleOrText(el) {
        if (!el) return '';
        const title = el.getAttribute('title') || 
                      el.closest('[title]')?.getAttribute('title') || 
                      el.querySelector('[title]')?.getAttribute('title') || '';
        const text = (el.textContent || '').trim();
        if (title && title.trim().length > text.length) {
            return title.trim();
        }
        return text;
    }

    function cleanWords(s) {
        return cleanStr(s).split(/\s+/).filter(w => w.length > 1);
    }

    function wordOverlapRatio(str1, str2) {
        const w1 = cleanWords(str1);
        const w2 = cleanWords(str2);
        if (!w1.length || !w2.length) return 0;
        const set2 = new Set(w2);
        const matches = w1.filter(w => set2.has(w)).length;
        return matches / Math.min(w1.length, w2.length);
    }

    function sendMessageWithTimeout(msg, timeoutMs = 10000) {
        return new Promise(resolve => {
            let timer = setTimeout(() => {
                console.warn('[Shopee Discount SKU] Request timed out:', msg);
                resolve({ ok: false, error: 'Timeout' });
            }, timeoutMs);
            try {
                chrome.runtime.sendMessage(msg, res => {
                    clearTimeout(timer);
                    if (chrome.runtime.lastError) {
                        console.warn('[Shopee Discount SKU] Runtime error:', chrome.runtime.lastError);
                        resolve({ ok: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(res || { ok: false });
                    }
                });
            } catch (err) {
                clearTimeout(timer);
                console.warn('[Shopee Discount SKU] SendMessage exception:', err);
                resolve({ ok: false, error: err.message });
            }
        });
    }

    async function fetchDiscountMappings() {
        if (isFetchingDiscountSkuMapping) return null;
        isFetchingDiscountSkuMapping = true;
        try {
            // 1. Read maGian from tab Cai dat (chrome.storage.local)
            const storage = await new Promise(resolve => {
                chrome.storage.local.get(["maGian", "dhHoanTextValue"], resolve);
            });
            const currentMaGian = cleanStr(storage?.maGian || storage?.dhHoanTextValue || "");
            cachedMaGian = currentMaGian;

            // 2. Fetch SP_SHOPEE!A:Z
            let rowsSP = [];
            const shopeeRes = await sendMessageWithTimeout({ type: "FETCH_SP_SHOPEE" }, 15000);
            if (shopeeRes && shopeeRes.ok && shopeeRes.values && shopeeRes.values.length > 0) {
                rowsSP = shopeeRes.values;
            } else if (window.cachedSpShopee && window.cachedSpShopee.length > 0) {
                rowsSP = window.cachedSpShopee;
            }

            if (!rowsSP || rowsSP.length === 0) {
                console.warn('[Shopee Discount SKU] Could not load SP_SHOPEE data.');
                return;
            }
            
            // Resolve columns dynamically:
            // Cột B (1): Tên Sản phẩm
            // Cột D (3): Tên phân loại
            // Cột E (4): SKU Sản phẩm
            // Cột F (5): SKU
            // Cột L (11): Gian (Mã gian)
            let pNameIdx = 1;
            let vNameIdx = 3;
            let parentSkuIdx = 4;
            let skuIdx = 5;
            let gianIdx = 11;

            if (rowsSP.length > 0) {
                const headers = rowsSP[0].map(h => cleanStr(h));
                const foundP = headers.findIndex(h => h.includes('tên sản phẩm') || h === 'ten sp' || h === 'tên sp' || h === 'name');
                if (foundP !== -1) pNameIdx = foundP;

                const foundV = headers.findIndex(h => (h.includes('tên phân loại') || h.includes('phân loại') || h.includes('variation')) && !h.includes('mã') && !h.includes('ma'));
                if (foundV !== -1) vNameIdx = foundV;

                const headerKeys = rowsSP[0].map(h => cleanHeader(h));

                const foundParentSku = headerKeys.findIndex(h => h.includes('sku san pham') || h.includes('parent sku'));
                if (foundParentSku !== -1) parentSkuIdx = foundParentSku;

                const foundSku = headerKeys.findIndex(h => (h === 'sku' || h === 'ma sku' || h.includes('sku phan loai') || h.includes('sku ct')) && !h.includes('san pham'));
                if (foundSku !== -1) skuIdx = foundSku;

                const foundGian = headerKeys.findIndex(h => h === 'gian' || h === 'ma gian' || h === 'ma_gian' || h.includes('gian'));
                if (foundGian !== -1) gianIdx = foundGian;
            }

            // Build SKU Map & list of filtered rows
            const skuMap = {};
            const rawFilteredRows = [];
            const rawAllRows = [];

            for (let i = 1; i < rowsSP.length; i++) {
                const row = rowsSP[i];
                if (!row || !row.some(c => c)) continue;

                const rowGian = cleanStr(row[gianIdx]);
                const rawPName = String(row[pNameIdx] || '').trim();
                const rawVName = String(row[vNameIdx] || '').trim();
                const rawParentSku = String(row[parentSkuIdx] || '').trim();
                const rawVarSku = String(row[skuIdx] || '').trim();

                // Lấy cột F (SKU), nếu cột F không có thì lấy cột E (SKU Sản phẩm) chỉ lấy 14 ký tự
                let targetSku = '';
                if (rawVarSku) {
                    targetSku = rawVarSku;
                } else if (rawParentSku) {
                    targetSku = rawParentSku.slice(0, 14);
                }

                if (rawPName && targetSku) {
                    const rowObj = {
                        pName: cleanStr(rawPName),
                        vName: cleanStr(rawVName),
                        targetSku: targetSku,
                        rowGian: rowGian
                    };
                    rawAllRows.push(rowObj);

                    // So sánh cột L (gian) với mã gian ở tab Cài đặt.
                    if (!currentMaGian || rowGian === currentMaGian) {
                        const key = makeKey(rawPName, rawVName);
                        skuMap[key] = targetSku;
                        if (!rawVName) {
                            skuMap[makeKey(rawPName, '')] = targetSku;
                        }
                        rawFilteredRows.push(rowObj);
                    }
                }
            }
            
            // 3. Fetch DS_SP (for min price if available)
            const priceMap = {};
            try {
                const dsSpRes = await sendMessageWithTimeout({ type: "FETCH_DS_SP" }, 10000);
                if (dsSpRes && dsSpRes.ok && dsSpRes.values && dsSpRes.values.length > 0) {
                    const rowsDS = dsSpRes.values;
                    const headers = rowsDS[0].map(h => cleanStr(h));
                    const idIdx = headers.findIndex(h => h === "id_sp_ct" || h === "sku" || h.includes("mã sku"));
                    const priceIdx = headers.findIndex(h => h === "gia_thap_nhat" || h.includes("giá thấp nhất") || h.includes("gia thap nhat"));
                    
                    if (idIdx !== -1 && priceIdx !== -1) {
                        for (let i = 1; i < rowsDS.length; i++) {
                            const idVal = cleanStr(rowsDS[i][idIdx]);
                            const priceVal = String(rowsDS[i][priceIdx] || "").trim();
                            if (idVal && priceVal) {
                                priceMap[idVal] = priceVal;
                            }
                        }
                    }
                }
            } catch(e) {
                console.warn('Could not fetch DS_SP for min prices:', e);
            }
            
            discountSkuMappingCache = {
                skuMap,
                priceMap,
                rawFilteredRows,
                rawAllRows,
                maGian: currentMaGian
            };
            console.log('[Shopee Discount SKU] Loaded mappings successfully: filtered =', rawFilteredRows.length, ', total =', rawAllRows.length, ', gian =', currentMaGian);
        } catch(e) {
            console.error('[Shopee Discount SKU] Error fetching discount mappings:', e);
        } finally {
            isFetchingDiscountSkuMapping = false;
        }
    }

    function searchInRows(rows, cleanP, cleanV) {
        if (!rows || !rows.length) return null;
        
        // 1. Exact pName, exact vName
        for (const item of rows) {
            if (item.pName === cleanP && (!cleanV || item.vName === cleanV)) {
                return item.targetSku;
            }
        }
        
        // 2. Exact pName, partial vName
        if (cleanV) {
            for (const item of rows) {
                if (item.pName === cleanP) {
                    if (item.vName === cleanV || item.vName.includes(cleanV) || cleanV.includes(item.vName)) {
                        return item.targetSku;
                    }
                }
            }
        }

        // 3. Substring pName and matching vName
        for (const item of rows) {
            if (item.pName.includes(cleanP) || cleanP.includes(item.pName) || item.pName.startsWith(cleanP) || cleanP.startsWith(item.pName)) {
                if (!cleanV && !item.vName) {
                    return item.targetSku;
                }
                if (cleanV && item.vName && (item.vName === cleanV || item.vName.includes(cleanV) || cleanV.includes(item.vName))) {
                    return item.targetSku;
                }
            }
        }

        // 4. Word overlap ratio >= 50%
        for (const item of rows) {
            if (wordOverlapRatio(item.pName, cleanP) >= 0.5) {
                if (!cleanV && !item.vName) {
                    return item.targetSku;
                }
                if (cleanV && item.vName && (item.vName === cleanV || item.vName.includes(cleanV) || cleanV.includes(item.vName))) {
                    return item.targetSku;
                }
            }
        }

        // 5. If cleanV is empty and only 1 match for this product
        if (!cleanV) {
            const matches = rows.filter(item => item.pName.includes(cleanP) || cleanP.includes(item.pName) || wordOverlapRatio(item.pName, cleanP) >= 0.5);
            if (matches.length === 1) {
                return matches[0].targetSku;
            }
        }

        return null;
    }

    function findSkuInCache(pName, vName) {
        if (!discountSkuMappingCache || !pName) return null;
        const { skuMap, rawFilteredRows, rawAllRows, maGian } = discountSkuMappingCache;
        const cleanP = cleanStr(pName);
        const cleanV = cleanStr(vName);
        
        // 1. Exact key match from skuMap
        const exactKey = cleanP + '|||' + cleanV;
        if (skuMap[exactKey]) return skuMap[exactKey];
        if (!cleanV && skuMap[cleanP + '|||']) return skuMap[cleanP + '|||'];

        // 2. Search within filtered rows for this gian
        let sku = searchInRows(rawFilteredRows, cleanP, cleanV);
        if (sku) return sku;

        // 3. Only search all rows when no maGian is configured.
        if (!maGian) {
            sku = searchInRows(rawAllRows, cleanP, cleanV);
            return sku;
        }

        return null;
    }
    
    function findInputForRow(v) {
        let curr = v;
        while (curr && curr !== document.body) {
            const inputs = curr.querySelectorAll('.eds-input__input, input.ant-input-number-input, input[type="text"], input[type="number"]');
            if (inputs.length > 0) {
                const textInputs = Array.from(inputs).filter(i => (i.type === 'text' || i.type === 'number') && !i.placeholder?.includes('Tìm'));
                if (textInputs.length > 0) return textInputs[0];
            }
            curr = curr.parentElement;
        }
        return null;
    }

    function updateCopyButtonColor(rowContainer, injected) {
        const copyBtn = injected?.querySelector?.('.btn-copy-price');
        const minPriceStr = copyBtn?.getAttribute('data-min-price') || '';
        if (!copyBtn || !minPriceStr) return;

        const input = findInputForRow(rowContainer);
        const currentPrice = Number(String(input?.value || '').replace(/[^\d]/g, ''));
        const minPrice = Number(String(minPriceStr).replace(/[^\d]/g, ''));
        if (!currentPrice || !minPrice) return;

        if (currentPrice > minPrice) {
            copyBtn.style.background = '#16a34a';
        } else if (currentPrice < minPrice) {
            copyBtn.style.background = '#dc2626';
        } else {
            copyBtn.style.background = '#64748b';
        }
    }

    function createSkuElement(sku, minPrice, rowContainer) {
        if (!sku) return null;

        const skuDiv = document.createElement('div');
        skuDiv.className = 'injected-sku-ct';
        skuDiv.style.cssText = 'margin-top: 4px; font-size: 11px; line-height: 1.3; display: block !important; clear: both !important; text-align: left !important; z-index: 9999 !important; position: relative !important; width: 100% !important;';
        
        let priceHtml = '';
        const priceNumberStr = minPrice ? String(minPrice).replace(/[^\d]/g, '') : '';
        if (minPrice && priceNumberStr) {
            priceHtml = `
            <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                <span style="color:#dc2626; font-weight: bold; font-size: 10px;">Giá min: <b>${minPrice}</b></span>
                <button type="button" class="btn-copy-price" data-min-price="${priceNumberStr}" style="background:#dc2626; color:white; border:none; border-radius:3px; padding:1px 5px; font-size:9px; cursor:pointer; font-weight: bold;">Điền</button>
            </div>`;
        }
        
        skuDiv.innerHTML = `
        <div class="badge-row" style="display: flex; flex-wrap: wrap; align-items: center; gap: 4px;">
            <div class="injected-sku-badge-text" style="display: inline-block; color: #1d4ed8; font-weight: 700; font-size: 11px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 3px; padding: 1px 6px; white-space: nowrap;">SKU: <span>${sku}</span></div>
        </div>
        ${priceHtml}`;
        
        const copyBtn = skuDiv.querySelector('.btn-copy-price');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!priceNumberStr) return;
                
                const input = findInputForRow(rowContainer);
                if (input) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(input, priceNumberStr);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    copyBtn.innerText = 'Đã điền!';
                    setTimeout(() => {
                        copyBtn.innerText = 'Điền';
                    }, 1500);
                } else {
                    alert('Không tìm thấy ô nhập giá.');
                }
            });
        }
        
        return skuDiv;
    }

    function getCleanDiscountText(el) {
        if (!el) return '';
        const clone = el.cloneNode(true);
        clone.querySelectorAll('button, input, textarea, select, script, style, .injected-sku-ct, .injected-sku-info, .injected-sku-price-helper').forEach(n => n.remove());
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeDiscountVariantText(text) {
        return String(text || '')
            .replace(/\b(Bán hết|Ban het|Sold out|Hết hàng|Het hang)\b/gi, '')
            .replace(/^Phân loại\s*:\s*/i, '')
            .replace(/^Variation\s*:\s*/i, '')
            .replace(/^SKU\s*:\s*\S+\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isLikelyDiscountVariantName(text) {
        const normalized = normalizeDiscountVariantText(text);
        const clean = cleanHeader(normalized);
        if (!clean || clean.length < 2 || clean.length > 120) return false;
        if (/^\d+([.,]\d+)?$/.test(clean)) return false;
        if (/[₫đ]|\d+\s*%/.test(normalized)) return false;
        if (/\b(gia|kho|so luong|khuyen mai|gioi han|bat tat|thao tac|khong|xoa|giam)\b/.test(clean)) return false;
        return true;
    }

    function getDiscountRowCells(row) {
        const cells = Array.from(row.querySelectorAll(':scope > td, :scope > [role="cell"], :scope > .eds-table__cell, :scope > [class*="cell"], :scope > div'));
        if (cells.length) return cells;
        return Array.from(row.children || []);
    }

    function findDiscountVariantTarget(row) {
        const directVariation = row.querySelector('.item-variation .ellipsis-content, .item-content.item-variation .ellipsis-content, [class*="item-variation"] .ellipsis-content');
        if (directVariation) {
            const text = normalizeDiscountVariantText(getElTitleOrText(directVariation));
            if (isLikelyDiscountVariantName(text)) {
                return { el: directVariation, text };
            }
        }

        const cells = getDiscountRowCells(row);
        for (const cell of cells) {
            if (!cell || cell.matches?.('input, button')) continue;
            if (cell.querySelector('input[type="checkbox"]') && !getCleanDiscountText(cell)) continue;
            if (cell.querySelector('.eds-select, .ant-select, [class*="select"], [class*="dropdown"]')) continue;

            const ellipsis = cell.querySelector('.ellipsis-content.single, .ellipsis-content, [title]');
            const rawText = ellipsis ? getElTitleOrText(ellipsis) : getCleanDiscountText(cell);
            const text = normalizeDiscountVariantText(rawText);
            if (isLikelyDiscountVariantName(text)) {
                return { el: ellipsis || cell, text };
            }
        }

        return null;
    }

    function getDiscountProductNameFromRow(row, allowImageFallback = true) {
        const selectors = [
            '.discount-item-product-name .ellipsis-content',
            '.discount-item-product-name',
            '[class*="product-name"] .ellipsis-content',
            '[class*="product-name"]',
            '[class*="item-title"] .ellipsis-content',
            '[class*="item-title"]'
        ];

        for (const selector of selectors) {
            const el = row.querySelector(selector);
            if (!el) continue;
            const text = getElTitleOrText(el);
            if (text && isLikelyDiscountVariantName(text)) return text;
        }

        if (!allowImageFallback || !row.querySelector('img')) return '';
        const target = findDiscountVariantTarget(row);
        return target?.text || '';
    }

    function findDiscountProductNameFromContext(row) {
        const modelList = row.closest('.discount-edit-item-model-list');
        let ancestor = row.parentElement;

        while (ancestor && ancestor !== document.body) {
            const candidates = Array.from(ancestor.querySelectorAll([
                '.discount-item-product-name .ellipsis-content',
                '.discount-item-product-name',
                '[class*="product-name"] .ellipsis-content',
                '[class*="product-name"]',
                '[class*="item-title"] .ellipsis-content',
                '[class*="item-title"]',
                '.ellipsis-content.single',
                '.ellipsis-content',
                '[title]'
            ].join(',')));

            for (const candidate of candidates) {
                if (modelList && modelList.contains(candidate)) continue;
                if (candidate.closest('.discount-edit-item-model-list, .item-variation, .item-price, .item-stock, .item-promotion-stock, .item-purchase-limit, .item-enable-disable, .item-action')) continue;
                if (candidate.closest('.eds-select, .ant-select, [class*="dropdown"], button')) continue;

                const text = normalizeDiscountVariantText(getElTitleOrText(candidate));
                if (text && isLikelyDiscountVariantName(text)) {
                    return text;
                }
            }

            ancestor = ancestor.parentElement;
        }

        return '';
    }

    function findDiscountSkuForNames(pName, vName) {
        const sku = pName ? findSkuInCache(pName, vName) : null;
        if (sku) return sku;

        const cleanV = cleanStr(vName);
        if (!discountSkuMappingCache || !cleanV) return null;

        const { rawFilteredRows, rawAllRows, maGian } = discountSkuMappingCache;
        const rows = maGian ? rawFilteredRows : rawAllRows;
        const matches = (rows || []).filter(item => {
            if (!item.vName) return false;
            return item.vName === cleanV || item.vName.includes(cleanV) || cleanV.includes(item.vName);
        });
        const uniqueSkus = Array.from(new Set(matches.map(item => item.targetSku).filter(Boolean)));

        return uniqueSkus.length === 1 ? uniqueSkus[0] : null;
    }

    function getDiscountTableRows() {
        const selectors = [
            '.discount-edit-item-model-component',
            '.eds-table__row',
            'tr',
            '[role="row"]',
            '.discount-edit-item-model-list > div',
            '.item-content.item-variation'
        ];
        const seen = new Set();
        const rows = [];

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(row => {
                if (!row || seen.has(row)) return;
                seen.add(row);
                rows.push(row);
            });
        });

        return rows;
    }

    function renderDiscountTableSkuCt() {
        const rows = getDiscountTableRows();
        if (!rows.length || !discountSkuMappingCache) return;

        const priceMap = discountSkuMappingCache.priceMap || {};
        let currentPName = '';

        rows.forEach(row => {
            const hasEditableInput = row.querySelector('input.eds-input__input, input.ant-input-number-input, input[type="text"], input[type="number"]');
            const productName = getDiscountProductNameFromRow(row, !hasEditableInput);
            if (productName) currentPName = productName;

            if (!hasEditableInput) return;

            const target = findDiscountVariantTarget(row);
            if (!target || !target.text) return;

            const pName = currentPName || productName || findDiscountProductNameFromContext(row);

            const existing = row.querySelector('.injected-sku-ct');
            const sku = findDiscountSkuForNames(pName, target.text);
            if (!sku) return;

            const minPrice = priceMap[cleanStr(sku)] || priceMap[sku] || null;
            if (existing) {
                const skuSpan = existing.querySelector('.injected-sku-badge-text span');
                if (skuSpan && skuSpan.textContent !== sku) skuSpan.textContent = sku;
                updateCopyButtonColor(row, existing);
                return;
            }

            const skuDiv = createSkuElement(sku, minPrice, row);
            if (!skuDiv) return;

            const mountEl = target.el.closest('.item-content.item-variation, .item-variation, td, [role="cell"], .eds-table__cell, [class*="cell"]') || target.el.parentElement || target.el;
            mountEl.style.setProperty('overflow', 'visible', 'important');
            mountEl.style.setProperty('height', 'auto', 'important');
            mountEl.appendChild(skuDiv);
        });
    }

    async function renderDiscountSkuCt() {
        const hasDiscountDom = document.querySelector('.discount-edit-item-model-component, .item-content.item-variation, .item-variation, .discount-edit-item-model-list');
        const isDiscountUrl = window.location.href.includes('discount');
        if (!hasDiscountDom && !isDiscountUrl) return;
        
        // Find all variation containers on page
        const variations = Array.from(document.querySelectorAll('.item-variation, .item-content.item-variation, [class*="item-variation"]'));
        
        // Trigger fetch if not loaded
        if (!discountSkuMappingCache && !isFetchingDiscountSkuMapping) {
            fetchDiscountMappings();
        }
        
        const priceMap = discountSkuMappingCache ? (discountSkuMappingCache.priceMap || {}) : {};

        if (!variations.length) {
            renderDiscountTableSkuCt();
            return;
        }

        variations.forEach(v => {
            const row = v.closest('.discount-edit-item-model-component, tr, .eds-table__row') || v.parentElement;
            
            // Fix CSS clipping on all levels
            if (row) {
                row.style.setProperty('height', 'auto', 'important');
                row.style.setProperty('min-height', '60px', 'important');
                row.style.setProperty('overflow', 'visible', 'important');
                if (row.parentElement) {
                    row.parentElement.style.setProperty('height', 'auto', 'important');
                    row.parentElement.style.setProperty('overflow', 'visible', 'important');
                }
            }
            v.style.setProperty('overflow', 'visible', 'important');
            v.style.setProperty('height', 'auto', 'important');

            const injected = v.querySelector('.injected-sku-ct');
            
            // 1. Get Variation Name from inside v
            const vNameEl = v.querySelector('.ellipsis-content.single, .ellipsis-content');
            const vName = vNameEl ? getElTitleOrText(vNameEl) : '';
            
            // 2. Get Product Name from ancestor
            const pName = findDiscountProductNameFromContext(row || v);

            // 3. Find SKU
            const sku = vName ? findDiscountSkuForNames(pName, vName) : null;
            const minPrice = sku ? (priceMap[cleanStr(sku)] || priceMap[sku] || null) : null;

            if (injected) {
                // Update SKU badge if sheet just finished loading
                if (sku && !injected.querySelector('.injected-sku-badge-text')) {
                    const badgeRow = injected.querySelector('.badge-row');
                    if (badgeRow) {
                        badgeRow.innerHTML = `
                            <div class="injected-sku-badge-text" style="display: inline-block; color: #1d4ed8; font-weight: 700; font-size: 11px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 3px; padding: 1px 6px; white-space: nowrap;">SKU: <span>${sku}</span></div>
                        `;
                    }
                } else if (sku) {
                    const skuSpan = injected.querySelector('.injected-sku-badge-text span');
                    if (skuSpan && skuSpan.textContent !== sku) skuSpan.textContent = sku;
                }
                updateCopyButtonColor(v, injected);
            } else {
                const skuDiv = createSkuElement(sku, minPrice, v);
                if (skuDiv) v.appendChild(skuDiv);
            }

            // 4. Also inject helper into Price Form (Column 3) for quick filling
            if (row) {
                const priceForm = row.querySelector('.price-discount-form, .price-and-discount-wrapper, .item-price');
                if (priceForm && sku && !priceForm.querySelector('.injected-sku-price-helper')) {
                    priceForm.style.setProperty('overflow', 'visible', 'important');
                    priceForm.style.setProperty('height', 'auto', 'important');
                    const priceHelper = document.createElement('div');
                    priceHelper.className = 'injected-sku-price-helper';
                    priceHelper.style.cssText = 'display: block !important; margin-top: 3px !important; font-size: 11px !important; line-height: 1.3 !important; clear: both !important; z-index: 9999 !important; position: relative !important;';
                    
                    let priceBtnHtml = '';
                    const priceNum = minPrice ? String(minPrice).replace(/[^\d]/g, '') : '';
                    if (priceNum) {
                        priceBtnHtml = `<button type="button" class="btn-fill-price-quick" data-price="${priceNum}" style="background: #dc2626 !important; color: white !important; font-weight: bold !important; font-size: 10px !important; padding: 2px 7px !important; border: none !important; border-radius: 3px !important; cursor: pointer !important; margin-left: 5px !important;">⚡ Điền: ${minPrice}</button>`;
                    }
                    
                    priceHelper.innerHTML = `
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                            <span style="color: #1d4ed8; font-weight: 700; font-size: 11px;">SKU: ${sku}</span>
                            ${priceBtnHtml}
                        </div>
                    `;

                    const btn = priceHelper.querySelector('.btn-fill-price-quick');
                    if (btn) {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const input = row.querySelector('input.eds-input__input, input[type="text"]');
                            if (input) {
                                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                setter.call(input, priceNum);
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                btn.innerText = 'Đã điền!';
                                setTimeout(() => { btn.innerText = `⚡ Điền: ${minPrice}`; }, 1200);
                            }
                        });
                    }

                    priceForm.appendChild(priceHelper);
                }
            }
        });

        renderDiscountTableSkuCt();
    }

    async function renderFlashSaleSkuCt() {
        if (!window.location.href.includes('banhang.shopee.vn/portal/marketing/shop-flash-sale')) return;
        
        const rows = document.querySelectorAll('.ant-table-row');
        if (!rows.length) return;
        
        if (!discountSkuMappingCache) {
            let needsFetch = false;
            rows.forEach(row => {
                if (row.querySelector('.ant-input-number-input') && !row.querySelector('.injected-sku-ct')) {
                    needsFetch = true;
                }
            });
            if (needsFetch) {
                await fetchDiscountMappings();
                return;
            }
        }
        
        const priceMap = discountSkuMappingCache ? discountSkuMappingCache.priceMap : {};
        
        let currentPName = '';
        rows.forEach(row => {
            if (row.classList.contains('ant-table-row-level-0')) {
                const pNameEl = row.querySelector('.product-name');
                if (pNameEl) currentPName = pNameEl.textContent.trim();
            }
            
            if (!row.querySelector('.ant-input-number-input')) return;
            
            let vName = '';
            if (row.classList.contains('ant-table-row-level-1')) {
                const vNameEl = row.querySelector('.product-name');
                if (vNameEl) vName = vNameEl.textContent.trim();
            }
            
            const injected = row.querySelector('.injected-sku-ct, .injected-sku-info');
            
            if (injected) {
                const copyBtn = injected.querySelector('.btn-copy-price');
                if (copyBtn) {
                    const minPriceStr = copyBtn.getAttribute('data-min-price');
                    if (minPriceStr) {
                        const minPriceVal = parseFloat(minPriceStr);
                        const inputs = row.querySelectorAll('.ant-input-number-input');
                        if (inputs.length > 0) {
                            const priceInput = inputs[0];
                            const currentVal = parseFloat((priceInput.value || '').replace(/[^\d]/g, ''));
                            if (!isNaN(currentVal) && !isNaN(minPriceVal)) {
                                if (currentVal > minPriceVal) {
                                    priceInput.style.color = '#52c41a';
                                    priceInput.style.fontWeight = 'bold';
                                } else if (currentVal < minPriceVal) {
                                    priceInput.style.color = '#f5222d';
                                    priceInput.style.fontWeight = 'bold';
                                } else {
                                    priceInput.style.color = 'inherit';
                                    priceInput.style.fontWeight = 'normal';
                                }
                            }
                        }
                    }
                }
                return;
            }
            
            if (!currentPName) return;
            
            const sku = findSkuInCache(currentPName, vName);
            
            if (sku) {
                const minPrice = priceMap[cleanStr(sku)] || priceMap[sku] || 'Chưa có';
                const priceNumberStr = minPrice.replace(/[^\d]/g, '');
                
                const skuDiv = document.createElement('div');
                skuDiv.className = 'injected-sku-ct injected-sku-info';
                skuDiv.innerHTML = `<span>SKU: <b>${sku}</b></span><br/>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                    <span style="color:#cf1322">Giá thấp nhất: <b>${minPrice}</b></span>
                    <button type="button" class="btn-copy-price" data-min-price="${priceNumberStr}" style="background:#cf1322; color:white; border:none; border-radius:3px; padding:2px 6px; font-size:10px; cursor:pointer;">Điền giá</button>
                </div>`;
                
                skuDiv.querySelector('.btn-copy-price').addEventListener('click', (e) => {
                    const minP = e.target.getAttribute('data-min-price');
                    if (minP) {
                        const inputs = row.querySelectorAll('.ant-input-number-input');
                        if (inputs.length > 0) {
                            const input = inputs[0];
                            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                            nativeSetter.call(input, minP);
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            
                            const btn = e.target;
                            btn.innerText = 'Đã điền!';
                            setTimeout(() => { btn.innerText = 'Điền giá'; }, 1000);
                        }
                    }
                });
                
                const metaInfo = row.querySelector('.product-meta-info');
                if (metaInfo) {
                    metaInfo.appendChild(skuDiv);
                } else {
                    const firstTd = row.querySelector('td:nth-child(2)');
                    if (firstTd) firstTd.appendChild(skuDiv);
                }
            }
        });
    }

    // Listen for changes in tab Cai dat (maGian)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.maGian || changes.dhHoanTextValue)) {
                discountSkuMappingCache = null;
                document.querySelectorAll('.injected-sku-ct, .injected-sku-info').forEach(el => el.remove());
                renderDiscountSkuCt();
            }
        });
    }

    window.setInterval(renderDiscountSkuCt, 1500);
    window.setInterval(renderFlashSaleSkuCt, 1500);
})();

 
// ===== UD_CT STATUS =====
(function() {
let udCtRowsByMdh = null;
let udCtError = false;
let udCtErrorMessage = "";
let isFetchingUdCt = false;
let lastFetchUdCtTime = 0;

function normalizeUdCtHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeUdCtOrderKey(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getUdCtCell(row, index) {
  return String(row?.[index] || "").trim();
}

function fetchUdCtData(force = false) {
  const now = Date.now();
  if (isFetchingUdCt) return;
  if (!force && udCtRowsByMdh && now - lastFetchUdCtTime < 300000) return;

  isFetchingUdCt = true;
  chrome.runtime.sendMessage({ type: "FETCH_UD_CT" }, (res) => {
    isFetchingUdCt = false;
    lastFetchUdCtTime = Date.now();

    if (!res || !res.ok || !Array.isArray(res.values) || res.values.length === 0) {
      udCtRowsByMdh = new Map();
      udCtError = true;
      udCtErrorMessage = res?.error || "Khong doc duoc UD_CT";
      updateUdCtDisplay();
      return;
    }

    const mdhIdx = 12; // M
    const ngayIdx = 4; // E
    const sanIdx = 8; // I
    const khungHIdx = 9; // J
    const idSpCtIdx = 16; // Q
    const trangThaiIdx = 24; // Y
    const rowsByMdh = new Map();

    for (const row of res.values.slice(1)) {
      const mdh = getUdCtCell(row, mdhIdx);
      const mdhKey = normalizeUdCtOrderKey(mdh);
      if (!mdhKey) continue;

      const entry = {
        mdh,
        ngay: getUdCtCell(row, ngayIdx),
        san: getUdCtCell(row, sanIdx),
        khungH: getUdCtCell(row, khungHIdx),
        idSpCt: getUdCtCell(row, idSpCtIdx),
        trangThai: getUdCtCell(row, trangThaiIdx)
      };

      if (!rowsByMdh.has(mdhKey)) rowsByMdh.set(mdhKey, []);
      rowsByMdh.get(mdhKey).push(entry);
    }

    udCtRowsByMdh = rowsByMdh;
    udCtError = false;
    udCtErrorMessage = "";
    updateUdCtDisplay();
  });
}

function getUdCtStatusColor(status) {
  const normalized = normalizeUdCtHeader(status);
  if (normalized.includes("huy")) return "#ef4444";
  if (normalized.includes("xuat") || normalized.includes("in") || normalized.includes("hoan_thanh")) return "#22c55e";
  if (normalized.includes("cho") || normalized.includes("dang")) return "#f59e0b";
  return "#3b82f6";
}

function renderUdCtBadgeRows(badge, rows) {
  badge.dataset.shopeeQlspUdCtFilled = "1";
  badge.textContent = "";
  badge.style.backgroundColor = "transparent";
  badge.style.color = "initial";
  badge.style.padding = "0";
  badge.style.border = "none";

  rows.forEach(row => {
    const line = document.createElement("span");
    line.className = "ud-ct-badge-row";
    line.style.backgroundColor = getUdCtStatusColor(row.trangThai);
    line.textContent = row.trangThai || "";
    badge.appendChild(line);
  });
}

function renderUdCtFallbackBadge(badge, text, backgroundColor, color = "white") {
  badge.dataset.shopeeQlspUdCtFilled = "0";
  badge.innerHTML = text || "";
  badge.style.backgroundColor = backgroundColor || "transparent";
  badge.style.color = color;
  badge.style.padding = text ? "2px 6px" : "0";
  badge.style.border = "none";
}

function updateUdCtDisplay() {
  if (!isOrderListPage()) return;

  if (!udCtRowsByMdh && !isFetchingUdCt) {
    fetchUdCtData();
  }

  document.querySelectorAll(".ud-ct-badge").forEach(badge => {
    const orderSn = badge.dataset.shopeeQlspOrderId;
    if (!orderSn) return;

    const isPrinted = typeof cachedUdCtMdhIds !== "undefined" && cachedUdCtMdhIds.has(orderSn);

    if (!udCtRowsByMdh) {
      renderUdCtFallbackBadge(badge, isPrinted ? cachedUdCtMdhIds.get(orderSn) : "UD_CT...", isPrinted ? "#22c55e" : "transparent", isPrinted ? "white" : "#64748b");
      return;
    }

    if (udCtError) {
      renderUdCtFallbackBadge(badge, "ERR: " + (udCtErrorMessage || "API Fail"), "#ef4444", "white");
      badge.title = udCtErrorMessage;
      return;
    }

    const matchingRows = udCtRowsByMdh.get(normalizeUdCtOrderKey(orderSn)) || [];
    if (matchingRows.length) {
      badge.title = "UD_CT: " + orderSn;
      renderUdCtBadgeRows(badge, matchingRows);
      return;
    }

    badge.title = "";
    renderUdCtFallbackBadge(badge, "NO MATCH: " + orderSn, "#f59e0b", "white");
  });
}
window.setInterval(updateUdCtDisplay, 1500);
})();








  // Auto Download Giảm Giá Logic
  chrome.storage.local.get(["autoDownloadGiamGia"], (res) => {
  if (res.autoDownloadGiamGia || window.location.href.includes("auto_download_giam_gia=1")) {
      chrome.storage.local.remove("autoDownloadGiamGia"); // Consume the flag

      const showFloatingStatusGG = (msg, color = '#16a34a') => {
          console.log("[AutoGiamGia]", msg);
          let statusDiv = document.getElementById('shopee-auto-giamgia-status');
          if (!statusDiv) {
              statusDiv = document.createElement('div');
              statusDiv.id = 'shopee-auto-giamgia-status';
              statusDiv.style.position = 'fixed';
              statusDiv.style.top = '140px';
              statusDiv.style.right = '20px';
              statusDiv.style.padding = '15px 20px';
              statusDiv.style.color = '#fff';
              statusDiv.style.fontSize = '16px';
              statusDiv.style.fontWeight = 'bold';
              statusDiv.style.borderRadius = '8px';
              statusDiv.style.zIndex = '999999';
              statusDiv.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              statusDiv.style.transition = 'all 0.3s ease';
              document.body.appendChild(statusDiv);
          }
          statusDiv.style.backgroundColor = color;
          statusDiv.textContent = msg;
      };

      const simulateMouseClick = (el) => {
          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          ['mousedown', 'mouseup', 'click'].forEach(evt => {
              el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
          });
      };

      const findAllButtonsRobust = (searchText) => {
          // Fallback to all elements if needed, but start with buttons
          const buttons = document.querySelectorAll('button, a, .eds-button, .list-header-action, span');
          
          // Normalize to NFC to fix Vietnamese composed/decomposed unicode issues
          const target = searchText.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
          const results = [];
          
          for (const b of buttons) {
              if (!b.textContent) continue;
              const text = b.textContent.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
              if (text.includes(target)) {
                  // To avoid grabbing a giant parent div, only take elements whose text is reasonably short
                  if (text.length < target.length + 30) {
                      results.push(b);
                  }
              }
          }
          return results;
      };

      const aggressiveClick = (btns) => {
          let clicked = false;
          for (const b of btns) {
              try {
                  simulateMouseClick(b);
                  b.click();
                  // Click EVERYTHING inside the button to bypass strict event listeners
                  const children = b.querySelectorAll('*');
                  for (const child of children) {
                      try {
                          simulateMouseClick(child);
                          child.click();
                      } catch(e) {}
                  }
                  clicked = true;
              } catch(e) {}
          }
          return clicked;
      };
      
      const getTopRowDateGG = () => {
          const modalBody = document.querySelector('.eds-modal__body');
          if (!modalBody) return null;
          const table = modalBody.querySelector('.record-table .eds-table__body');
          if (!table) return null;
          const firstRow = table.querySelector('tr');
          if (!firstRow) return null;
          const firstCell = firstRow.querySelector('td .eds-table__cell');
          return firstCell ? firstCell.textContent.trim() : null;
      };

      const startGiamGiaDownload = () => {
          showFloatingStatusGG("Bước 1: Chờ 5 giây để click 'Chỉnh sửa giảm giá'...", "#f59e0b");
          
          setTimeout(() => {
              const btnsChinhSua = findAllButtonsRobust("chỉnh sửa giảm giá");
              
              if (btnsChinhSua.length > 0) {
                  aggressiveClick(btnsChinhSua);
                  showFloatingStatusGG("Bước 2: Đã click. Chờ 5 giây popup hiện lên...", "#3b82f6");
                  
                  setTimeout(() => {
                      const oldRowDate = getTopRowDateGG();
                      const btnsTaiVe = findAllButtonsRobust("tải về thông tin sản phẩm");
                      
                      if (btnsTaiVe.length > 0) {
                          aggressiveClick(btnsTaiVe);
                          showFloatingStatusGG("Bước 3: Đã yêu cầu tải. Đang theo dõi tiến trình xử lý...", "#f59e0b");
                          
                          let attempts = 0;
                          const checkDownloadReady = setInterval(() => {
                              attempts++;
                              if (attempts > 120) {
                                  clearInterval(checkDownloadReady);
                                  showFloatingStatusGG("Lỗi: Quá thời gian chờ xử lý (2 phút).", "#dc2626");
                                  return;
                              }
                              
                              const newRowDate = getTopRowDateGG();
                              if (newRowDate && newRowDate !== oldRowDate) {
                                  const modalBody = document.querySelector('.eds-modal__body');
                                  if (modalBody) {
                                      const table = modalBody.querySelector('.record-table .eds-table__body');
                                      if (table) {
                                          const firstRow = table.querySelector('tr');
                                          if (firstRow) {
                                              const downloadBtn = firstRow.querySelector('button');
                                              if (downloadBtn && downloadBtn.textContent.toLowerCase().includes("tải về")) {
                                                  clearInterval(checkDownloadReady);
                                                  showFloatingStatusGG("Bước 4: Shopee đã xử lý xong! Đang tải file...", "#16a34a");
                                                  aggressiveClick([downloadBtn]);
                                              } else {
                                                  showFloatingStatusGG(`Bước 3: Đang chờ Shopee tạo file... (${attempts}s)`, "#3b82f6");
                                              }
                                          }
                                      }
                                  }
                              } else {
                                  showFloatingStatusGG(`Bước 3: Đang đợi Shopee thêm báo cáo mới... (${attempts}s)`, "#3b82f6");
                              }
                          }, 1000);
                          
                      } else {
                          showFloatingStatusGG("Lỗi: Không tìm thấy nút 'Tải về thông tin sản phẩm'", "#dc2626");
                      }
                  }, 5000);
              } else {
                  showFloatingStatusGG("Lỗi: Không tìm thấy nút 'Chỉnh sửa giảm giá'", "#dc2626");
              }
          }, 5000);
      };

      const waitForRenderGG = setInterval(() => {
          const btns = findAllButtonsRobust("chỉnh sửa giảm giá");
          if (btns.length > 0) {
              clearInterval(waitForRenderGG);
              startGiamGiaDownload();
          }
      }, 1000);
      
      setTimeout(() => clearInterval(waitForRenderGG), 30000);
   }
});

// THÊM SẢN PHẨM VÀO SHEET

function getTextFromNode(node) {
  if (!node) return "";
  let text = "";
  for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
  }
  return text.trim();
}

function normalizeSellerSpDisplayText(text) {
  return String(text || "")
    .replace(/…|…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSellerSpText(text) {
  return normalizeSellerSpDisplayText(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSellerShopeeImageUrl(url) {
  try {
    const parsedUrl = new URL(url, window.location.href);
    const host = parsedUrl.hostname.toLowerCase();
    const path = parsedUrl.pathname.toLowerCase();

    return host.endsWith("susercontent.com")
      || (host.endsWith("shopee.vn") && path.startsWith("/file/"));
  } catch (error) {
    return false;
  }
}

function cleanSellerShopeeImageUrl(url) {
  if (!url) return "";

  let absoluteUrl;

  try {
    absoluteUrl = new URL(url, window.location.href);
  } catch (error) {
    return "";
  }

  absoluteUrl.pathname = absoluteUrl.pathname
    .replace(/@resize_[^/]+$/, "")
    .replace(/_tn$/, "");
  absoluteUrl.search = "";
  absoluteUrl.hash = "";

  return absoluteUrl.toString();
}

function getSellerUrlsFromSrcset(srcset) {
  return String(srcset || "")
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function getSellerUrlsFromInlineStyle(styleValue) {
  const urls = [];
  const pattern = /url\(["']?([^"')]+)["']?\)/g;
  let match;

  while ((match = pattern.exec(String(styleValue || "")))) {
    if (match[1]) urls.push(match[1]);
  }

  return urls;
}

function getSellerImageCandidateUrls(element) {
  const urls = [];
  if (!element) return urls;

  for (const attr of ["src", "data-src", "data-original", "data-lazy-src", "lazy-src"]) {
    const value = element.getAttribute?.(attr);
    if (value) urls.push(value);
  }

  if (element.currentSrc) urls.push(element.currentSrc);

  urls.push(...getSellerUrlsFromSrcset(element.getAttribute?.("srcset")));
  urls.push(...getSellerUrlsFromSrcset(element.getAttribute?.("data-srcset")));
  urls.push(...getSellerUrlsFromInlineStyle(element.getAttribute?.("style")));

  return urls;
}

function uniqueSellerImageUrls(urls) {
  const seen = new Set();
  const results = [];

  for (const url of urls) {
    const cleanUrl = cleanSellerShopeeImageUrl(url);

    if (!cleanUrl || seen.has(cleanUrl) || !isSellerShopeeImageUrl(cleanUrl)) continue;

    seen.add(cleanUrl);
    results.push(cleanUrl);
  }

  return results;
}

function collectSellerShopeeImageUrls(root = document) {
  const urls = [];
  root.querySelectorAll("img, source, [srcset], [data-src], [data-original], [data-lazy-src], [lazy-src], [style*='url(']")
    .forEach((element) => {
      urls.push(...getSellerImageCandidateUrls(element));
    });

  return uniqueSellerImageUrls(urls);
}

function getSellerControlValue(control) {
  if (!control) return "";

  if ("value" in control) {
    const value = String(control.value || "").trim();
    if (value) return value;
    return String(control.getAttribute("modelvalue") || control.getAttribute("value") || "").trim();
  }

  return String(control.getAttribute?.("modelvalue") || control.textContent || "").trim();
}

function cleanSellerSkuValue(value) {
  const sku = String(value || "").trim();
  return sku === "-" ? "" : sku;
}

function findSellerFieldRoot(uniqueId) {
  return document.querySelector(`[data-product-edit-field-unique-id="${uniqueId}"]`);
}

function getSellerFieldValueByUniqueId(uniqueId) {
  const root = findSellerFieldRoot(uniqueId);
  return getSellerFieldValueFromRoot(root);
}

function getSellerFieldValueFromRoot(root) {
  if (!root) return "";

  const control = root.querySelector("input, textarea, [contenteditable='true']");
  return getSellerControlValue(control) || String(root.getAttribute("data") || "").trim() || getSellerControlValue(root);
}

function cleanSellerVariationName(cell) {
  if (!cell) return "";

  const clone = cell.cloneNode(true);
  clone.querySelectorAll("img, svg, button, input, textarea, .image-manager-wrapper, .shopee-image-manager, .eds-modal, .resize-triggers")
    .forEach((node) => node.remove());

  return normalizeSellerSpDisplayText(clone.textContent || "");
}

function findSellerFieldControl(labelNeedles) {
  const needles = labelNeedles.map(normalizeSellerSpText);
  const labels = Array.from(document.querySelectorAll("label, .edit-label, .eds-form-item__label, .product-edit-form-item-label, .product-basic-info-item-label"));

  for (const label of labels) {
    const labelText = normalizeSellerSpText(label.textContent || "");
    if (!needles.some((needle) => labelText.includes(needle))) continue;

    const root = label.closest(".eds-form-item, .edit-row, .product-edit-form-item, .basic-info-item, div") || label.parentElement;
    const control = root?.querySelector("input, textarea, [contenteditable='true']");
    if (control) return control;
  }

  return null;
}

function findSellerProductNameValue() {
  return getSellerFieldValueByUniqueId("name") || getSellerControlValue(findSellerFieldControl(["ten san pham", "product name"]));
}

function findSellerProductSkuValue() {
  return cleanSellerSkuValue(getSellerFieldValueByUniqueId("parentSku") || getSellerControlValue(findSellerFieldControl(["sku san pham", "product sku"])));
}

function findSellerProductDescriptionEditor() {
  const stableRoot = findSellerFieldRoot("description");
  const stableEditor = stableRoot?.querySelector('.ql-editor[contenteditable="true"], textarea, [contenteditable="true"]:not(.ql-clipboard)');
  if (stableEditor) return stableEditor;

  const selectors = [
    '.ql-editor.shopee-qlsp-description-drop-ready',
    '.editor-container .ql-editor[contenteditable="true"]',
    '.ql-editor[contenteditable="true"][data-placeholder]',
    '.product-description-editor .ql-editor[contenteditable="true"]',
    '.description-wrap .ql-editor[contenteditable="true"]',
    '.product-description-editor [contenteditable="true"]:not(.ql-clipboard)',
    '.description-wrap [contenteditable="true"]:not(.ql-clipboard)',
    'textarea[placeholder*="mo ta" i]'
  ];

  for (const selector of selectors) {
    const editor = document.querySelector(selector);
    if (editor) return editor;
  }

  return Array.from(document.querySelectorAll('.ql-editor[contenteditable="true"], [contenteditable="true"]:not(.ql-clipboard), textarea'))
    .find((element) => {
      if (element.classList?.contains('ql-clipboard')) return false;
      if (element.classList?.contains('ql-editor') && element.querySelector('p')) return true;
      const rootText = normalizeSellerSpText(element.closest('.eds-form-item, .edit-row, section, div')?.textContent || '');
      return rootText.includes('mo ta') || rootText.includes('description');
    }) || null;
}

function cleanSellerEditorText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSellerEditorText(editor) {
  if (!editor) return "";

  if (editor.matches?.('textarea, input')) {
    return getSellerControlValue(editor);
  }

  const blockTexts = Array.from(editor.querySelectorAll('p, li'))
    .map((block) => {
      const clone = block.cloneNode(true);
      clone.querySelectorAll('img, svg, button, input, textarea, .ql-clipboard').forEach((node) => node.remove());
      return normalizeSellerSpDisplayText(clone.textContent || "");
    })
    .filter(Boolean);

  if (blockTexts.length) {
    return cleanSellerEditorText(blockTexts.join("\n"));
  }

  const clone = editor.cloneNode(true);
  clone.querySelectorAll('img, svg, button, input, textarea, .ql-clipboard, .toolbar, [class*="toolbar"], [class*="upload"], [class*="Upload"], .resize-triggers')
    .forEach((node) => node.remove());

  return cleanSellerEditorText(clone.innerText || clone.textContent || "");
}
function findSellerDescriptionValue() {
  const editor = findSellerProductDescriptionEditor();
  const value = getSellerEditorText(editor);
  if (value) return value;

  const stableRoot = findSellerFieldRoot("description");
  if (stableRoot) {
    const clone = stableRoot.cloneNode(true);
    clone.querySelectorAll('button, svg, img, input, textarea, .toolbar, [class*="toolbar"], [class*="upload"], [class*="Upload"], .resize-triggers')
      .forEach((node) => node.remove());
    clone.querySelectorAll('*').forEach((node) => {
      const text = normalizeSellerSpText(node.textContent || '');
      const shortText = normalizeSellerSpDisplayText(node.textContent || '');
      if ((text.includes('tai len hinh anh') || /^\d+\s*\/\s*\d+$/.test(shortText)) && shortText.length < 80) {
        node.remove();
      }
    });
    const fallback = String(clone.innerText || clone.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (fallback) return fallback;
  }

  return getSellerControlValue(findSellerFieldControl(["mo ta san pham", "mo ta", "description"]));
}

function findSellerCategoryValue() {
  const categoryRoot = findSellerFieldRoot("category");
  const categoryText = categoryRoot?.querySelector('.product-category-text span, .product-category-text, [class*="category-text"]');
  const fromStableField = normalizeSellerSpDisplayText(categoryText?.textContent || categoryRoot?.textContent || "");
  if (fromStableField) return fromStableField;

  const labelControl = findSellerFieldControl(["nganh hang", "category"]);
  return normalizeSellerSpDisplayText(labelControl?.textContent || labelControl?.value || "");
}
function collectSellerModelFieldMap(prefix) {
  const map = new Map();
  document.querySelectorAll(`[data-product-edit-field-unique-id^="${prefix}"]`).forEach((root) => {
    const id = root.getAttribute("data-product-edit-field-unique-id") || "";
    const key = id.slice(prefix.length);
    if (key) map.set(key, root);
  });
  return map;
}

function collectSellerVariationRows(productSku) {
  const rows = [];
  const rowWrappers = Array.from(document.querySelectorAll(".variation-model-table-body .table-cell-wrapper"));
  const leftCells = Array.from(document.querySelectorAll('.variation-model-table-fixed-left .first-variation-cell, .variation-model-table .first-variation-cell'));
  const skuWrappers = rowWrappers.filter((wrapper) => wrapper.querySelector('[data-product-edit-field-unique-id^="skuModel_"]'));

  if (skuWrappers.length) {
    skuWrappers.forEach((wrapper, index) => {
      const cell = wrapper.querySelector(".first-variation-cell") || leftCells[index];
      const skuRoot = wrapper.querySelector('[data-product-edit-field-unique-id^="skuModel_"]');
      const priceRoot = wrapper.querySelector('[data-product-edit-field-unique-id^="priceModel_"]');
      const stockRoot = wrapper.querySelector('[data-product-edit-field-unique-id^="stockModel_"]');
      const sku = cleanSellerSkuValue(getSellerFieldValueFromRoot(skuRoot));
      const variationName = cleanSellerVariationName(cell);
      const priceRaw = getSellerFieldValueFromRoot(priceRoot);
      const stockRaw = getSellerFieldValueFromRoot(stockRoot);
      const variationImages = uniqueSellerImageUrls([
        ...collectSellerShopeeImageUrls(cell || document.createElement("div")),
        ...collectSellerShopeeImageUrls(wrapper)
      ]);

      if (sku || variationName || variationImages.length) {
        rows.push({
          sku,
          variationName,
          price: String(priceRaw || "").replace(/[^0-9]/g, ""),
          stock: String(stockRaw || "").replace(/[^0-9]/g, ""),
          variationImages
        });
      }
    });

    return rows;
  }

  const skuMap = collectSellerModelFieldMap("skuModel_");
  const priceMap = collectSellerModelFieldMap("priceModel_");
  const stockMap = collectSellerModelFieldMap("stockModel_");
  const modelKeys = Array.from(new Set([...skuMap.keys(), ...priceMap.keys(), ...stockMap.keys()]));

  if (!modelKeys.length && !leftCells.length) return rows;

  modelKeys.forEach((key, index) => {
    const cell = leftCells[index];
    const sku = cleanSellerSkuValue(getSellerFieldValueByUniqueId(`skuModel_${key}`));
    const variationName = cleanSellerVariationName(cell);
    const priceRaw = getSellerFieldValueByUniqueId(`priceModel_${key}`);
    const stockRaw = getSellerFieldValueByUniqueId(`stockModel_${key}`);
    const variationImages = uniqueSellerImageUrls(collectSellerShopeeImageUrls(cell || document.createElement("div")));

    if (sku || variationName || variationImages.length) {
      rows.push({
        sku,
        variationName,
        price: String(priceRaw || "").replace(/[^0-9]/g, ""),
        stock: String(stockRaw || "").replace(/[^0-9]/g, ""),
        variationImages
      });
    }
  });

  return rows;
}

function findSellerDescriptionImageUrls() {
  const stableRoot = findSellerFieldRoot("description");
  const editor = findSellerProductDescriptionEditor();
  const roots = [
    stableRoot,
    editor?.closest(".description-wrap, .eds-form-item, .edit-row, section, div"),
    document.querySelector(".description-wrap"),
    document.querySelector(".product-description-editor"),
    document.querySelector("[class*='description']")
  ].filter(Boolean);

  for (const root of Array.from(new Set(roots))) {
    const urls = collectSellerShopeeImageUrls(root);
    if (urls.length) return urls;
  }

  return [];
}

function findSellerMainImageUrls(descriptionImages, variationRows) {
  const imagesRoot = findSellerFieldRoot("images");
  const stableMainImages = imagesRoot ? collectSellerShopeeImageUrls(imagesRoot) : [];

  if (stableMainImages.length) {
    return stableMainImages.slice(0, 12);
  }

  const excluded = new Set([
    ...descriptionImages,
    ...variationRows.flatMap((row) => row.variationImages || [])
  ]);

  const imageElements = Array.from(document.querySelectorAll("img, source, [srcset], [data-src], [data-original], [data-lazy-src], [lazy-src], [style*='url(']")).filter((element) => {
    if (element.closest('.variation-model-table, .shopee-qlsp-product-list-actions')) return false;
    if (element.closest('.seller-preview, [class*="preview"], [class*="Preview"]')) return false;
    const rect = element.getBoundingClientRect?.();
    return !rect || rect.width >= 24 || rect.height >= 24;
  });

  const urls = uniqueSellerImageUrls(imageElements.flatMap((element) => getSellerImageCandidateUrls(element)))
    .filter((url) => !excluded.has(url));

  return urls.slice(0, 12);
}
function cleanSellerMediaUrl(url) {
  if (!url) return "";

  try {
    const absoluteUrl = new URL(url, window.location.href);
    absoluteUrl.hash = "";
    return absoluteUrl.toString();
  } catch (error) {
    return "";
  }
}

function isSellerVideoUrl(url) {
  const cleanUrl = cleanSellerMediaUrl(url);
  if (!cleanUrl) return false;

  try {
    const parsedUrl = new URL(cleanUrl);
    const host = parsedUrl.hostname.toLowerCase();
    const path = parsedUrl.pathname.toLowerCase();
    return /\.(mp4|mov|m4v|webm)(?:$|[?#])/.test(cleanUrl.toLowerCase())
      || ((host.includes("susercontent") || host.includes("shopee")) && path.includes("video"));
  } catch (error) {
    return false;
  }
}

function uniqueSellerVideoUrls(urls) {
  const seen = new Set();
  const results = [];

  for (const url of urls) {
    const cleanUrl = cleanSellerMediaUrl(url);
    if (!cleanUrl || seen.has(cleanUrl) || !isSellerVideoUrl(cleanUrl)) continue;
    seen.add(cleanUrl);
    results.push(cleanUrl);
  }

  return results;
}

function getSellerVideoCandidateUrls(element) {
  const urls = [];
  if (!element) return urls;

  for (const attr of ["src", "currentSrc", "href", "data-src", "data-url", "data-video", "data-video-url", "video-url", "url"]) {
    const value = attr === "currentSrc" ? element.currentSrc : element.getAttribute?.(attr);
    if (value) urls.push(value);
  }

  const html = element.outerHTML || "";
  const urlPattern = /https?:\/\/[^\s"'<>]+?(?:\.mp4|\.mov|\.m4v|\.webm)(?:[^\s"'<>]*)?/gi;
  let match;
  while ((match = urlPattern.exec(html))) {
    urls.push(match[0]);
  }

  return urls;
}

function findSellerVideoUrls() {
  const roots = [
    findSellerFieldRoot("video"),
    findSellerFieldRoot("videos"),
    document.querySelector('[data-product-edit-field-unique-id*="video" i]'),
    document.querySelector('.product-video'),
    document.querySelector('[class*="video" i]')
  ].filter(Boolean);

  const candidates = [];
  const selectors = 'video, source, a[href*=".mp4"], a[href*="video"], [src*=".mp4"], [data-src*=".mp4"], [data-video], [data-video-url], [class*="video" i]';

  for (const root of Array.from(new Set([...roots, document]))) {
    root.querySelectorAll(selectors).forEach((element) => {
      candidates.push(...getSellerVideoCandidateUrls(element));
    });
    candidates.push(...getSellerVideoCandidateUrls(root));
  }

  return uniqueSellerVideoUrls(candidates).slice(0, 6);
}

function sleepSellerSp(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clickSellerSpElement(element) {
  if (!element) return false;

  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, composed: true }));
  element.click?.();
  return true;
}

function findSellerVideoPreviewButton() {
  const roots = [
    findSellerFieldRoot("video"),
    findSellerFieldRoot("videos"),
    document.querySelector('[data-product-edit-field-unique-id*="video" i]'),
    document.querySelector('.product-video'),
    ...Array.from(document.querySelectorAll('[class*="video" i]')).slice(0, 10)
  ].filter(Boolean);

  const controls = [];
  for (const root of Array.from(new Set(roots))) {
    controls.push(...root.querySelectorAll('button, [role="button"], .eds-icon, i, span, svg'));
  }

  const isPreview = (element) => {
    const text = normalizeSellerSpText([
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title"),
      element.getAttribute?.("class"),
      element.textContent
    ].filter(Boolean).join(" "));

    return text.includes("preview")
      || text.includes("view")
      || text.includes("xem")
      || text.includes("eye")
      || text.includes("play");
  };

  const badControl = (element) => {
    const text = normalizeSellerSpText([
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title"),
      element.getAttribute?.("class"),
      element.textContent
    ].filter(Boolean).join(" "));

    return text.includes("delete")
      || text.includes("trash")
      || text.includes("xoa")
      || text.includes("remove")
      || text.includes("upload")
      || text.includes("tai len");
  };

  const visibleSmallControls = controls.filter((element) => {
    if (badControl(element) || !element.closest?.('[class*="video" i]')) return false;
    const rect = element.getBoundingClientRect?.();
    if (!rect) return false;
    return rect.width >= 8 && rect.height >= 8 && rect.width <= 48 && rect.height <= 48;
  });

  return controls.find((element) => isPreview(element) && !badControl(element))
    || visibleSmallControls.find((element) => element.querySelector?.('svg') || element.tagName?.toLowerCase() === 'svg')
    || visibleSmallControls[0]
    || null;
}

async function findSellerVideoUrlsWithPreview() {
  let videos = findSellerVideoUrls();
  if (videos.length) return videos;

  const previewButton = findSellerVideoPreviewButton();
  if (!previewButton) return videos;

  const previewRoot = previewButton.closest?.('[class*="video" i]');
  previewRoot?.scrollIntoView?.({ block: "center", inline: "nearest" });
  previewRoot?.dispatchEvent?.(new MouseEvent("mouseenter", { bubbles: true, composed: true }));
  clickSellerSpElement(previewButton.closest?.('button, [role="button"], span, i') || previewButton);

  for (let i = 0; i < 12; i += 1) {
    await sleepSellerSp(250);
    videos = findSellerVideoUrls();
    if (videos.length) break;
  }

  const closeButton = Array.from(document.querySelectorAll('.eds-modal__close, .eds-dialog__close, [aria-label="Close"], [aria-label="Đóng"]'))
    .find((button) => button.offsetParent !== null);
  if (closeButton) clickSellerSpElement(closeButton);

  return videos;
}

async function extractSellerSpFullData() {
  const urlMatches = window.location.pathname.match(/\/portal\/product\/(\d+)/);
  const itemId = urlMatches ? urlMatches[1] : (new URLSearchParams(window.location.search).get("id") || "");
  const linkShopee = itemId ? `https://banhang.shopee.vn/portal/product/${itemId}` : window.location.href;
  const productName = findSellerProductNameValue();
  const productSku = findSellerProductSkuValue();
  const description = findSellerDescriptionValue();
  const category = findSellerCategoryValue();
  const variationRows = collectSellerVariationRows(productSku);
  const descriptionImages = findSellerDescriptionImageUrls();
  const mainImages = findSellerMainImageUrls(descriptionImages, variationRows);
  const videos = await findSellerVideoUrlsWithPreview();
  const variationRowsWithSku = variationRows.filter((row) => row.sku);
  const allVariationImages = uniqueSellerImageUrls(variationRows.flatMap((row) => row.variationImages || []));
  const baseRows = variationRowsWithSku.length
    ? variationRowsWithSku
    : [{ sku: productSku, variationName: "", price: "", stock: "", variationImages: allVariationImages }];
  const rows = baseRows
    .filter((row) => row.sku || productName || description || mainImages.length || descriptionImages.length || videos.length || (row.variationImages || []).length)
    .map((row) => ({
      itemId,
      linkShopee,
      sku: row.sku || productSku || "",
      variationName: row.variationName || "",
      productName,
      category,
      description,
      price: row.price || "",
      stock: row.stock || "",
      mainImageLinks: mainImages.join(" | "),
      descriptionImageLinks: descriptionImages.join(" | "),
      variationImageLinks: (row.variationImages || []).join(" | "),
      videoLinks: videos.join(" | ")
    }));

  return {
    ok: rows.length > 0,
    itemId,
    linkShopee,
    productName,
    productSku,
    category,
    description,
    mainImages,
    descriptionImages,
    videos,
    rows,
    message: rows.length ? "OK" : "Khong lay duoc du lieu SP tren trang hien tai."
  };
}
async function extractProductData() {
  const urlMatches = window.location.pathname.match(/\/portal\/product\/(\d+)/);
  let maSp = urlMatches ? urlMatches[1] : "";
  if (!maSp) {
      const searchParams = new URLSearchParams(window.location.search);
      maSp = searchParams.get('id') || "";
  }
  if (!maSp) return []; // Don't throw here, just return empty for interval checking

  let tenSp = "";
  const nameInput = document.querySelector('input[placeholder*="Tên thương hiệu"], input[placeholder*="tên sản phẩm"]');
  if (nameInput) {
    tenSp = nameInput.value || nameInput.getAttribute("modelvalue") || "";
  }

  const maGian = await new Promise(resolve => {
    chrome.storage.local.get(["dhHoanTextValue"], (res) => {
      resolve(res.dhHoanTextValue || "");
    });
  });

  const rows = [];
  
  const leftCells = Array.from(document.querySelectorAll('.variation-model-table-fixed-left .first-variation-cell'));
  const mainArea = document.querySelector('.variation-model-table-main');
  
  let hasVariations = false;
  if (mainArea && leftCells.length > 0) {
    hasVariations = true;
    
    const priceElements = Array.from(mainArea.querySelectorAll('input[placeholder*="Giá" i], input[placeholder*="giá" i], input[placeholder="₫"], .basic-price-help-text .help-right'));
    const skuElements = Array.from(mainArea.querySelectorAll('input[placeholder*="SKU" i], input[placeholder*="sku" i], input[placeholder*="Mã" i], input[placeholder*="mã" i], .sku-textarea textarea'));

    for (let i = 0; i < leftCells.length; i++) {
        const tenPhanLoai = getTextFromNode(leftCells[i]);
        
        let skuPhanLoai = "";
        if (skuElements[i]) {
            skuPhanLoai = (skuElements[i].value || skuElements[i].getAttribute("modelvalue") || skuElements[i].textContent || "").trim();
        }
        
        let gia = "";
        if (priceElements[i]) {
            let rawGia = priceElements[i].tagName === "INPUT" ? priceElements[i].value : priceElements[i].textContent.split('(')[0];
            gia = rawGia.replace(/[^\d]/g, '');
        }
        
        rows.push([
            maSp,
            tenSp,
            "",
            tenPhanLoai,
            "",
            skuPhanLoai,
            gia,
            "",
            "",
            "",
            "",
            maGian
        ]);
    }
  }

  if (!hasVariations) {
    const giaEl = document.querySelector('input[placeholder*="Giá" i], input[placeholder*="giá" i], input[placeholder="₫"], .basic-price-help-text .help-right');
    const skuEl = document.querySelector('input[placeholder*="SKU" i], input[placeholder*="sku" i], .sku-textarea textarea');
    
    let gia = "";
    if (giaEl) {
        let rawGia = giaEl.tagName === "INPUT" ? giaEl.value : giaEl.textContent.split('(')[0];
        gia = rawGia.replace(/[^\d]/g, '');
    }
    
    let sku = "";
    if (skuEl) {
        sku = (skuEl.value || skuEl.getAttribute("modelvalue") || skuEl.textContent || "").trim();
    }
    
    // Only push if we actually have some data, otherwise it might be a ghost row
    if (tenSp || sku || gia) {
        rows.push([
            maSp,
            tenSp,
            "",
            "",
            sku,
            sku,
            gia,
            "",
            "",
            "",
            "",
            maGian
        ]);
    }
  }

  return rows;
}

async function extractProductDataAndSave() {
  const rows = await extractProductData();
  if (!rows || rows.length === 0) throw new Error("Không lấy được dữ liệu sản phẩm");

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "APPEND_SP_SHOPEE", values: rows }, (res) => {
      if (res && res.ok) resolve();
      else reject(new Error(res?.error || "Lỗi ghi vào Google Sheets"));
    });
  });
}

// Automatic Stock Update trigger based on URL query parameter
(async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const autoStock = params.get('auto_update_stock');
    if (autoStock !== null) {
      const match = window.location.pathname.match(/\/portal\/product\/(\d+)/);
      const itemId = match ? match[1] : null;
      const sendStatus = (status, color = '#faad14') => {
        if (itemId) {
          chrome.runtime.sendMessage({ type: "UPDATE_AUTOMATION_STATUS", itemId, status, color });
        }
      };

      console.log("[Extension] Detected auto_update_stock parameter:", autoStock);
      sendStatus("Đang chờ tải trang (5s)...");
      
      // Wait 5 seconds initially as requested
      await new Promise(r => setTimeout(r, 5000));
      
      sendStatus("Đang tìm ô nhập tồn...");
      
      // Poll every 1 second up to 5 more seconds (total 10 seconds max)
      let input = null;
      for (let i = 0; i < 5; i++) {
        input = findStockBatchInput();
        if (input) break;
        await new Promise(r => setTimeout(r, 1000));
      }
      
      if (input) {
        console.log("[Extension] Found stock batch input. Filling stock value...");
        await fillStockAndApply(autoStock);
      } else {
        console.error("[Extension] Could not find stock batch input within 10 seconds.");
        sendStatus("Lỗi: Không tìm thấy ô nhập", "#ef4444");
      }
    }
  } catch (e) {
    console.error("[Extension] Error in automatic stock updater:", e);
  }
})();


// Tính năng thêm nút Viết mô tả bằng AI
(function() {
  function injectAiDescriptionButton() {
    // Chỉ chạy trên trang tạo/sửa sản phẩm Shopee Seller
    if (!window.location.href.includes('banhang.shopee.vn/portal/product')) return;

    // Tránh inject nhiều lần
    if (document.getElementById('btn-ai-description')) return;

    // Tìm vùng nhập Mô tả sản phẩm
    const labels = Array.from(document.querySelectorAll('label, div, span'));
    const descLabel = labels.find(el => {
      const t = el.textContent.trim().toLowerCase();
      return t.includes("mô tả sản phẩm") || t.includes("product description");
    });
    
    let targetContainer = null;
    let editorElement = null;

    if (descLabel) {
      // Khung soạn thảo thường nằm kế bên nhãn hoặc cùng container
      const parentRow = descLabel.closest('.row, .flex, div[class*="product-edit"]') || descLabel.parentElement?.parentElement;
      if (parentRow) {
        editorElement = parentRow.querySelector('.ProseMirror, [contenteditable="true"], textarea');
      }
    }

    // Dự phòng tìm editor theo class nếu không tìm thấy qua label
    if (!editorElement) {
      editorElement = document.querySelector('.ProseMirror, [contenteditable="true"], textarea[placeholder*="Mô tả"]');
    }

    if (editorElement) {
      targetContainer = editorElement.closest('div[style*="border"], div[class*="editor"], .edit-content, .field-wrapper') || editorElement.parentElement;
      if (!targetContainer) targetContainer = editorElement.parentElement;
      
      const btnContainer = document.createElement('div');
      btnContainer.style.marginTop = '10px';
      btnContainer.style.marginBottom = '10px';
      btnContainer.style.textAlign = 'right';
      btnContainer.style.width = '100%';

      const aiBtn = document.createElement('button');
      aiBtn.id = 'btn-ai-description';
      aiBtn.type = 'button';
      aiBtn.innerHTML = '✨ Viết mô tả bằng AI';
      aiBtn.style.cssText = `
        background-color: #10b981; 
        color: white; 
        border: none; 
        padding: 8px 16px; 
        border-radius: 4px; 
        font-weight: bold; 
        cursor: pointer;
        font-size: 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      `;

      aiBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Tìm tên sản phẩm
        let productName = "";
        const nameInput = document.querySelector('input[placeholder*="Tên sản phẩm"], input[maxLength="120"], input[maxLength="255"]');
        if (nameInput) {
          productName = nameInput.value.trim();
        } else {
          const nameLabel = labels.find(el => el.textContent.trim() === "Tên sản phẩm" || el.textContent.trim() === "Product Name");
          if (nameLabel) {
            const row = nameLabel.closest('.row, .flex') || nameLabel.parentElement?.parentElement;
            if (row) {
              const input = row.querySelector('input');
              if (input) productName = input.value.trim();
            }
          }
        }

        if (!productName) {
          // Fallback lấy document.title
          productName = document.title.split('|')[0].trim();
        }

        if (!productName || productName.toLowerCase() === "shopee") {
          alert("Vui lòng nhập Tên sản phẩm trước khi sử dụng AI.");
          return;
        }

        const originalText = aiBtn.innerHTML;
        aiBtn.innerHTML = '⏳ Đang tạo mô tả...';
        aiBtn.disabled = true;
        aiBtn.style.opacity = '0.7';

        chrome.runtime.sendMessage({
          type: 'GENERATE_AI_DESCRIPTION',
          productName: productName
        }, (response) => {
          aiBtn.innerHTML = originalText;
          aiBtn.disabled = false;
          aiBtn.style.opacity = '1';

          if (response && response.ok) {
            // Điền vào khung soạn thảo
            editorElement.focus();
            
            // Chọn toàn bộ text cũ
            document.execCommand('selectAll', false, null);
            
            // Chèn HTML mới
            const success = document.execCommand('insertHTML', false, response.result);
            if (!success) {
               // Nếu trình duyệt chặn insertHTML, thử insertText
               document.execCommand('insertText', false, response.result.replace(/<[^>]+>/g, ''));
            }
            
            // Dispatch event để trigger Shopee React validation
            editorElement.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertHTML', data: response.result }));
            editorElement.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            alert("Lỗi: " + (response?.error || "Không thể kết nối đến AI."));
          }
        });
      });

      btnContainer.appendChild(aiBtn);
      
      // Chèn ngay sau vùng nhập để đảm bảo hiển thị
      if (targetContainer && targetContainer.parentNode) {
         targetContainer.parentNode.insertBefore(btnContainer, targetContainer.nextSibling);
      } else if (targetContainer) {
         targetContainer.appendChild(btnContainer);
      }
    }
  }

  // =========================================================================
  // TÍNH NĂNG TỰ ĐỘNG ĐIỀN TỒN KHO 1000 CHO KHO HÀNG ĐA KHO (MULTI-WAREHOUSE)
  // =========================================================================

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetParent !== null;
  }

  function emitRealClick(element) {
    if (!element) return;
    element.focus?.();
    ['mousedown', 'mouseup', 'click'].forEach(evtType => {
      element.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
    });
    element.click?.();
  }

  function fillInputLikeUser(input, value) {
    if (!input) return;
    input.focus();
    input.value = value;
    input.setAttribute('modelvalue', value);
    input.setAttribute('value', value);
    
    if (input._value !== undefined) input._value = value;
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    }

    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }

  function showTopNotification(message, isError = false) {
    const noti = document.createElement('div');
    noti.style.cssText = `position: fixed !important; top: 20px !important; right: 20px !important; z-index: 9999999 !important; padding: 10px 18px !important; border-radius: 6px !important; color: white !important; font-weight: bold !important; font-size: 13px !important; box-shadow: 0 4px 14px rgba(0,0,0,0.25) !important; background: ${isError ? '#dc2626' : '#16a34a'} !important; transition: opacity 0.3s !important; font-family: sans-serif !important;`;
    noti.textContent = message;
    document.body.appendChild(noti);
    setTimeout(() => {
      noti.style.opacity = '0';
      setTimeout(() => noti.remove(), 300);
    }, 2800);
  }

  function findStockBatchInput() {
    const inputs = Array.from(document.querySelectorAll("input.eds-input__input, input"));
    const batchInput = inputs.find((input) => {
      const placeholder = (input.placeholder || '').toLowerCase();
      return (placeholder.includes("warehouse") || placeholder.includes("kho hàng(")) && isVisible(input);
    });
    if (batchInput) return batchInput;

    return inputs.find((input) => {
      const placeholder = (input.placeholder || '').toLowerCase();
      return (placeholder === "kho hàng" || placeholder.includes("kho hàng")) && isVisible(input);
    });
  }

  function findApplyToAllButton() {
    const directButton = document.querySelector("button.batch-apply-button");
    if (directButton && isVisible(directButton)) return directButton;

    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.find((button) => {
      const txt = (button.textContent || '').toLowerCase();
      return (txt.includes("áp dụng cho tất cả") || txt.includes("apply to all")) && isVisible(button);
    });
  }

  async function fillMultiWarehouseStock(targetValue = '1000', triggerInput = null) {
    let popup = document.querySelector('.multi-warehouse-stock-edit');
    
    // Nếu popup chưa mở, bấm vào triggerInput / popoverRef để mở
    if (!popup || !isVisible(popup)) {
      if (triggerInput) {
        const popoverRef = triggerInput.closest('.eds-popover__ref') || triggerInput.closest('.multi-warehouse-stock-input') || triggerInput.closest('.eds-input') || triggerInput;
        triggerInput.focus();
        triggerInput.click();
        if (popoverRef && popoverRef !== triggerInput) {
          popoverRef.click();
          emitRealClick(popoverRef);
        }
      }
      
      // Chờ popup xuất hiện tối đa 1.5 giây
      for (let i = 0; i < 25; i++) {
        await sleep(60);
        popup = document.querySelector('.multi-warehouse-stock-edit');
        if (popup && isVisible(popup)) break;
      }
    }

    if (!popup) {
      if (triggerInput && !triggerInput.readOnly && !triggerInput.disabled) {
        fillInputLikeUser(triggerInput, targetValue);
        showTopNotification(`Đã điền ${targetValue} vào ô Kho hàng!`);
        return true;
      }
      showTopNotification('Không mở được bảng kho hàng', true);
      return false;
    }

    // Tìm tất cả các dòng kho trong bảng popup
    const rows = Array.from(popup.querySelectorAll('.eds-table__body tr.eds-table__row, .stock-table tr, tr'));
    let filledCount = 0;

    for (const row of rows) {
      const isPaused = row.textContent.includes('Chế độ tạm nghỉ') || row.querySelector('.eds-tag');
      const input = row.querySelector('input.eds-input__input, input');
      
      if (input && !input.disabled && !input.readOnly) {
        if (isPaused) {
          continue;
        }
        fillInputLikeUser(input, targetValue);
        filledCount++;
        await sleep(40);
      }
    }

    await sleep(150);

    // Tự động bấm nút Xác nhận
    const confirmBtn = Array.from(popup.querySelectorAll('button')).find(btn => {
      const txt = (btn.textContent || '').trim();
      return (txt === 'Xác nhận' || txt.includes('Xác nhận')) && isVisible(btn);
    }) || popup.querySelector('.stock-edit-fixed-right button.eds-button--primary');

    if (confirmBtn) {
      emitRealClick(confirmBtn);
    }

    showTopNotification(`Đã điền ${targetValue} cho ${filledCount} kho thành công!`);
    return true;
  }

  let isBatchFilling = false;
  async function fillAllVariationsStock(targetValue = '1000') {
    if (isBatchFilling) return;
    isBatchFilling = true;
    showTopNotification(`⏳ Đang bắt đầu điền ${targetValue} cho tất cả các kho...`);

    // 1. Thử điền qua ô Sửa hàng loạt trước
    const batchInput = findStockBatchInput();
    if (batchInput) {
      await fillMultiWarehouseStock(targetValue, batchInput);
      await sleep(250);
      const applyBtn = findApplyToAllButton();
      if (applyBtn) {
        emitRealClick(applyBtn);
        await sleep(300);
        showTopNotification(`✅ Đã áp dụng ${targetValue} cho tất cả phân loại thành công!`);
        isBatchFilling = false;
        return;
      }
    }

    // 2. Nếu không áp dụng được hàng loạt, quét và điền từng dòng trong bảng phân loại
    const stockInputs = Array.from(document.querySelectorAll('.two-tier-multi-warehouse-stock input, .multi-warehouse-stock-input input, .two-tier-stock input, .product-edit-input input[readonly]')).filter(isVisible);
    
    if (stockInputs.length === 0) {
      showTopNotification('Không tìm thấy ô kho hàng nào trong bảng!', true);
      isBatchFilling = false;
      return;
    }

    let successCount = 0;
    for (let i = 0; i < stockInputs.length; i++) {
      const inp = stockInputs[i];
      showTopNotification(`⏳ Đang điền kho dòng ${i + 1}/${stockInputs.length}...`);
      const ok = await fillMultiWarehouseStock(targetValue, inp);
      if (ok) successCount++;
      await sleep(300);
    }

    showTopNotification(`🎉 Đã hoàn tất điền ${targetValue} cho ${successCount}/${stockInputs.length} dòng phân loại!`);
    isBatchFilling = false;
  }

  // 1. THANH CÔNG CỤ NỔI (Floating Panel)
  function injectFloatingStockPanel() {
    if (!window.location.href.includes('banhang.shopee.vn/portal/product')) return;
    if (document.getElementById('shopee-qlsp-floating-stock-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'shopee-qlsp-floating-stock-panel';
    panel.style.cssText = `
      position: fixed !important;
      right: 20px !important;
      bottom: 90px !important;
      z-index: 999999 !important;
      background: #ffffff !important;
      border: 2px solid #16a34a !important;
      border-radius: 10px !important;
      padding: 10px 14px !important;
      box-shadow: 0 6px 20px rgba(0,0,0,0.2) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 12px !important; font-weight: bold !important; color: #15803d !important; text-align: center !important; display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 6px !important; border-bottom: 1px solid #e5e7eb !important; padding-bottom: 4px !important;';
    title.innerHTML = '<span>⚡ Điền Kho Nhanh</span><span style="font-size:10px; color:#6b7280; font-weight:normal;">Shopee</span>';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex !important; gap: 6px !important;';

    const btn1000 = document.createElement('button');
    btn1000.type = 'button';
    btn1000.textContent = '⚡ Điền tất cả 1000';
    btn1000.title = 'Tự động điền 1000 cho tất cả các kho của toàn bộ phân loại';
    btn1000.style.cssText = 'padding: 6px 12px !important; font-size: 12px !important; font-weight: bold !important; background: #16a34a !important; color: white !important; border: none !important; border-radius: 6px !important; cursor: pointer !important; box-shadow: 0 2px 4px rgba(22,163,74,0.3) !important; white-space: nowrap !important; transition: all 0.2s !important;';
    btn1000.onmouseover = () => btn1000.style.background = '#15803d';
    btn1000.onmouseout = () => btn1000.style.background = '#16a34a';
    btn1000.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fillAllVariationsStock('1000');
    };

    const btn0 = document.createElement('button');
    btn0.type = 'button';
    btn0.textContent = '⚡ Điền 0';
    btn0.title = 'Tự động điền 0 cho tất cả các kho của toàn bộ phân loại';
    btn0.style.cssText = 'padding: 6px 10px !important; font-size: 12px !important; font-weight: bold !important; background: #dc2626 !important; color: white !important; border: none !important; border-radius: 6px !important; cursor: pointer !important; box-shadow: 0 2px 4px rgba(220,38,38,0.3) !important; white-space: nowrap !important; transition: all 0.2s !important;';
    btn0.onmouseover = () => btn0.style.background = '#b91c1c';
    btn0.onmouseout = () => btn0.style.background = '#dc2626';
    btn0.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fillAllVariationsStock('0');
    };

    btnRow.append(btn1000, btn0);
    panel.append(title, btnRow);
    document.body.appendChild(panel);
  }

  // 2. NÚT CẠNH "ÁP DỤNG CHO TẤT CẢ PHÂN LOẠI"
  function injectBatchApplyButtons() {
    const applyBtn = findApplyToAllButton();
    if (applyBtn && applyBtn.parentElement && !applyBtn.parentElement.querySelector('.shopee-qlsp-batch-fill-1000-btn')) {
      const wrap = document.createElement('span');
      wrap.className = 'shopee-qlsp-batch-fill-1000-btn';
      wrap.style.cssText = 'display: inline-flex !important; gap: 6px !important; margin-left: 8px !important; vertical-align: middle !important;';

      const btn1000 = document.createElement('button');
      btn1000.type = 'button';
      btn1000.textContent = '⚡ Điền 1000';
      btn1000.title = 'Điền 1000 cho tất cả kho của phân loại hàng loạt';
      btn1000.style.cssText = 'padding: 6px 14px !important; font-size: 12px !important; font-weight: bold !important; background: #16a34a !important; color: white !important; border: 1px solid #15803d !important; border-radius: 4px !important; cursor: pointer !important;';
      btn1000.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillAllVariationsStock('1000');
      };

      const btn0 = document.createElement('button');
      btn0.type = 'button';
      btn0.textContent = '⚡ Điền 0';
      btn0.title = 'Điền 0 cho tất cả kho của phân loại hàng loạt';
      btn0.style.cssText = 'padding: 6px 10px !important; font-size: 12px !important; font-weight: bold !important; background: #ef4444 !important; color: white !important; border: 1px solid #b91c1c !important; border-radius: 4px !important; cursor: pointer !important;';
      btn0.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillAllVariationsStock('0');
      };

      wrap.append(btn1000, btn0);
      applyBtn.parentElement.appendChild(wrap);
    }
  }

  function processBatchInputs() {
    const allLabels = Array.from(document.querySelectorAll('div, label, span, h2, h3, h4'));
    const batchLabel = allLabels.find(el => {
      const txt = (el.textContent || '').trim();
      return txt.includes('Danh sách phân loại hàng') && el.children.length <= 4;
    });

    if (batchLabel) {
      const existing = document.getElementById('shopee-qlsp-stock-quick-btns-header');
      if (!existing || !document.contains(existing)) {
        if (existing) existing.remove();

        const headerBtnWrap = document.createElement('span');
        headerBtnWrap.id = 'shopee-qlsp-stock-quick-btns-header';
        headerBtnWrap.style.cssText = 'display: inline-flex !important; gap: 6px !important; margin-left: 10px !important; vertical-align: middle !important; position: relative !important; z-index: 99999 !important;';

        const btn0 = document.createElement('button');
        btn0.type = 'button';
        btn0.textContent = '0';
        btn0.title = 'Điền 0 và bấm Áp dụng cho tất cả';
        btn0.style.cssText = 'padding: 2px 10px !important; font-size: 11px !important; font-weight: bold !important; background: #ff4d4f !important; color: white !important; border: 1px solid #b91c1c !important; border-radius: 3px !important; cursor: pointer !important; height: 22px !important; line-height: 22px !important; display: inline-block !important;';
        btn0.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          fillAllVariationsStock('0');
        };

        const btn1000 = document.createElement('button');
        btn1000.type = 'button';
        btn1000.textContent = '1000';
        btn1000.title = 'Điền 1000 và bấm Áp dụng cho tất cả';
        btn1000.style.cssText = 'padding: 2px 10px !important; font-size: 11px !important; font-weight: bold !important; background: #52c41a !important; color: white !important; border: 1px solid #15803d !important; border-radius: 3px !important; cursor: pointer !important; height: 22px !important; line-height: 22px !important; display: inline-block !important;';
        btn1000.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          fillAllVariationsStock('1000');
        };

        headerBtnWrap.append(btn0, btn1000);
        batchLabel.appendChild(headerBtnWrap);
      }
    }
  }

  function processVariationTables() {
    const multiContainers = Array.from(document.querySelectorAll('.two-tier-multi-warehouse-stock, .multi-warehouse-stock-input, .two-tier-stock, [class*="multi-warehouse-stock"]'));
    
    multiContainers.forEach(container => {
      if (container.querySelector('.shopee-qlsp-inline-fill-stock-1000')) return;

      const input = container.querySelector('input');
      if (!input) return;

      const btnWrap = document.createElement('div');
      btnWrap.className = 'shopee-qlsp-inline-fill-stock-1000';
      btnWrap.style.cssText = 'display: inline-flex !important; gap: 4px !important; margin-top: 4px !important; align-items: center !important; position: relative !important; z-index: 99999 !important;';

      const btn1000 = document.createElement('button');
      btn1000.type = 'button';
      btn1000.textContent = '1000';
      btn1000.title = 'Bấm để mở popup và điền 1000 cho từng kho';
      btn1000.style.cssText = 'font-size: 11px !important; font-weight: bold !important; background: #16a34a !important; color: white !important; border: 1px solid #15803d !important; border-radius: 3px !important; padding: 2px 8px !important; cursor: pointer !important; line-height: 1.2 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.15) !important;';
      btn1000.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillMultiWarehouseStock('1000', input);
      };

      const btn0 = document.createElement('button');
      btn0.type = 'button';
      btn0.textContent = '0';
      btn0.title = 'Bấm để mở popup và điền 0 cho từng kho';
      btn0.style.cssText = 'font-size: 11px !important; font-weight: bold !important; background: #ef4444 !important; color: white !important; border: 1px solid #b91c1c !important; border-radius: 3px !important; padding: 2px 6px !important; cursor: pointer !important; line-height: 1.2 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.15) !important;';
      btn0.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillMultiWarehouseStock('0', input);
      };

      btnWrap.append(btn1000, btn0);

      const helpContainer = container.querySelector('.two-tier-basic-stock-container-help') || container.querySelector('.stock-content') || container;
      helpContainer.appendChild(btnWrap);
    });

    const allThs = Array.from(document.querySelectorAll('.eds-table__header th, thead th, th'));
    let priceColIdx = -1;
    let skuColIdx = -1;

    allThs.forEach((th, idx) => {
      const txt = (th.textContent || '').toLowerCase().replace(/\s+/g, ' ');
      if (txt.includes('giá') || txt.includes('price')) {
        if (priceColIdx === -1) priceColIdx = idx;
      } else if (txt.includes('sku')) {
        if (skuColIdx === -1) skuColIdx = idx;
      }
    });

    const rows = Array.from(document.querySelectorAll('.eds-table__body tr, tbody tr, tr.eds-table__row'));
    
    rows.forEach(row => {
      if (row.closest('.multi-warehouse-stock-edit')) return;

      const cells = Array.from(row.querySelectorAll('td, .eds-table__cell'));
      if (cells.length === 0) return;

      // Cột Giá
      let priceCell = priceColIdx !== -1 ? cells[priceColIdx] : null;
      if (!priceCell) {
        priceCell = cells.find(c => {
          const inp = c.querySelector('input');
          if (!inp) return false;
          const ph = (inp.placeholder || '').toLowerCase();
          return ph.includes('giá') || ph.includes('price') || c.querySelector('.basic-price, .price-input') || c.textContent.includes('₫');
        });
      }

      if (priceCell) {
        const priceInput = priceCell.querySelector('input');
        if (priceInput && !priceCell.querySelector('.shopee-qlsp-inline-fill-price')) {
          priceCell.style.setProperty('overflow', 'visible', 'important');
          priceCell.style.setProperty('height', 'auto', 'important');
          priceCell.style.setProperty('min-height', '45px', 'important');

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'shopee-qlsp-inline-fill-price';
          btn.textContent = '⚡ Điền giá';
          btn.title = 'Bấm để điền Giá từ Web bán SP';
          btn.style.cssText = 'display: inline-block !important; margin-top: 4px !important; font-size: 10px !important; font-weight: bold !important; background: #ee4d2d !important; color: white !important; border: 1px solid #c2410c !important; border-radius: 3px !important; padding: 2px 6px !important; cursor: pointer !important; z-index: 9999 !important; position: relative !important; line-height: 1.2 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.15) !important;';
          btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            chrome.storage.local.get(['webSpLastPrice'], (res) => {
              const val = res.webSpLastPrice || '306250';
              fillInputLikeUser(priceInput, val);
              showTopNotification(`Đã điền giá: ${val}`);
            });
          };

          const inputWrapper = priceInput.closest('.eds-input, .product-edit-input') || priceInput.parentElement || priceCell;
          if (inputWrapper && inputWrapper.parentElement) {
            inputWrapper.parentElement.appendChild(btn);
          } else {
            priceCell.appendChild(btn);
          }
        }
      }

      // Cột SKU
      let skuCell = skuColIdx !== -1 ? cells[skuColIdx] : null;
      if (!skuCell) {
        skuCell = cells.find(c => {
          const inp = c.querySelector('input, textarea');
          if (!inp) return false;
          const ph = (inp.placeholder || '').toLowerCase();
          return ph.includes('sku') || ph.includes('nhập vào') || c.querySelector('.sku-textarea');
        });
      }

      if (skuCell) {
        const skuInput = skuCell.querySelector('input, textarea');
        if (skuInput && !skuCell.querySelector('.shopee-qlsp-inline-fill-sku')) {
          skuCell.style.setProperty('overflow', 'visible', 'important');
          skuCell.style.setProperty('height', 'auto', 'important');
          skuCell.style.setProperty('min-height', '45px', 'important');

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'shopee-qlsp-inline-fill-sku';
          btn.textContent = '⚡ Điền SKU';
          btn.title = 'Bấm để điền SKU từ Web bán SP';
          btn.style.cssText = 'display: inline-block !important; margin-top: 4px !important; font-size: 10px !important; font-weight: bold !important; background: #2563eb !important; color: white !important; border: 1px solid #1d4ed8 !important; border-radius: 3px !important; padding: 2px 6px !important; cursor: pointer !important; z-index: 9999 !important; position: relative !important; line-height: 1.2 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.15) !important;';
          btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            chrome.storage.local.get(['webSpLastSku'], (res) => {
              const val = res.webSpLastSku || '';
              if (val) {
                fillInputLikeUser(skuInput, val);
                showTopNotification(`Đã điền SKU: ${val}`);
              } else {
                showTopNotification('Hãy chọn 1 sản phẩm ở tab Web bán SP trước', true);
              }
            });
          };

          const inputWrapper = skuInput.closest('.eds-input, .sku-textarea, .product-edit-input') || skuInput.parentElement || skuCell;
          if (inputWrapper && inputWrapper.parentElement) {
            inputWrapper.parentElement.appendChild(btn);
          } else {
            skuCell.appendChild(btn);
          }
        }
      }
    });
  }

  function processPopupInputs() {
    const popupTitle = document.querySelector('.multi-warehouse-stock-edit .stock-edit-title');
    if (popupTitle && !popupTitle.querySelector('.shopee-qlsp-popup-fill-1000')) {
      const popupBtnWrap = document.createElement('span');
      popupBtnWrap.className = 'shopee-qlsp-popup-fill-1000';
      popupBtnWrap.style.cssText = 'display: inline-flex !important; gap: 6px !important; margin-left: 12px !important; vertical-align: middle !important; font-size: 11px !important;';
      
      const pBtn1000 = document.createElement('button');
      pBtn1000.type = 'button';
      pBtn1000.textContent = '⚡ Điền 1000';
      pBtn1000.title = 'Điền 1000 cho tất cả các kho đang hoạt động';
      pBtn1000.style.cssText = 'padding: 2px 8px !important; font-size: 11px !important; font-weight: bold !important; background: #16a34a !important; color: white !important; border: 1px solid #15803d !important; border-radius: 3px !important; cursor: pointer !important;';
      pBtn1000.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillMultiWarehouseStock('1000');
      };

      const pBtn0 = document.createElement('button');
      pBtn0.type = 'button';
      pBtn0.textContent = '⚡ Điền 0';
      pBtn0.title = 'Điền 0 cho tất cả các kho đang hoạt động';
      pBtn0.style.cssText = 'padding: 2px 8px !important; font-size: 11px !important; font-weight: bold !important; background: #dc2626 !important; color: white !important; border: 1px solid #b91c1c !important; border-radius: 3px !important; cursor: pointer !important;';
      pBtn0.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillMultiWarehouseStock('0');
      };

      popupBtnWrap.append(pBtn1000, pBtn0);
      popupTitle.appendChild(popupBtnWrap);
    }
  }

  function injectStockQuickButtons() {
    if (!window.location.href.includes('banhang.shopee.vn/portal/product')) return;
    injectFloatingStockPanel();
    injectBatchApplyButtons();
    processBatchInputs();
    processVariationTables();
    processPopupInputs();
  }

  // =========================================================================
  // AUTO-INJECT SKU BADGES ON SHOPEE MARKETING / PROMOTION PAGES
  // =========================================================================
  let autoShopeeSpCache = null;   // null = chưa load; [] = đã load nhưng rỗng
  let autoShopeeMaGian = "";
  let autoShopeeLoadingData = false; // tránh gọi API song song

  function findSkuForShopeeVariation(pName, vName, spRows, currentMaGian) {
    if (!spRows || spRows.length <= 1) return "";
    
    const cleanP = cleanString(pName);
    const cleanV = cleanString(vName);
    if (!cleanV && !cleanP) return "";

    // 1. Xác định vị trí các cột
    const headers = spRows[0].map(v => cleanString(v));
    let pIdx = headers.findIndex(col => col.includes('tên sản phẩm') || col === 'ten sp' || col === 'name');
    if (pIdx === -1) pIdx = 1;
    let vIdx = headers.findIndex(col => (col.includes('phân loại') || col.includes('variation')) && !col.includes('mã') && !col.includes('ma'));
    if (vIdx === -1) vIdx = 3;
    let sIdx = headers.findIndex(col => (col === 'sku' || col === 'mã sku' || col === 'sku phân loại') && !col.includes('chi tiết'));
    if (sIdx === -1) sIdx = 5;
    let gIdx = headers.findIndex(col => col === 'gian' || col === 'mã gian' || col === 'ma gian');
    if (gIdx === -1) gIdx = 11;

    // BƯỚC 1: LỌC MÃ GIAN HÀNG TRƯỚC TIÊN (Shop Code Filtering)
    let candidateRows = [];
    const targetGian = cleanString(currentMaGian);

    if (targetGian) {
      for (let i = 1; i < spRows.length; i++) {
        const row = spRows[i];
        const sG = cleanString(row[gIdx]);
        if (sG === targetGian || sG.includes(targetGian) || targetGian.includes(sG)) {
          candidateRows.push(row);
        }
      }
    }

    // Nếu không lọc được theo gian hoặc chưa chọn gian, dùng toàn bộ dữ liệu
    if (candidateRows.length === 0) {
      candidateRows = spRows.slice(1);
    }

    // BƯỚC 2: TÌM SẢN PHẨM CHA (Parent Product Matching)
    const getWordOverlap = (s1, s2) => {
      if (!s1 || !s2) return 0;
      const w1 = s1.split(' ').filter(w => w.length > 1);
      const w2 = s2.split(' ').filter(w => w.length > 1);
      let count = 0;
      for (const w of w1) {
        if (w2.includes(w)) count++;
      }
      return count;
    };

    const extractCodes = (str) => {
      const matches = str.match(/[a-z0-9]+[0-9]+[a-z0-9]*/gi) || [];
      return matches.map(m => m.toLowerCase());
    };

    const pCodes = extractCodes(cleanP);

    let bestParentScore = -1;
    let bestParentRows = [];
    
    // Gom nhóm các dòng theo Tên sản phẩm cha trong sheet
    const productGroups = new Map();
    for (const row of candidateRows) {
      const sP = cleanString(row[pIdx]);
      if (!sP) continue;
      if (!productGroups.has(sP)) {
        productGroups.set(sP, []);
      }
      productGroups.get(sP).push(row);
    }

    for (const [sheetParentName, rows] of productGroups.entries()) {
      let pScore = 0;

      if (sheetParentName === cleanP) {
        pScore += 10000;
      } else if (sheetParentName.startsWith(cleanP) || cleanP.startsWith(sheetParentName)) {
        pScore += 5000;
      } else if (sheetParentName.includes(cleanP) || cleanP.includes(sheetParentName)) {
        pScore += 3000;
      } else {
        // Kiểm tra trùng mã model (ví dụ CIM382, SK-09, PA516...)
        const sheetCodes = extractCodes(sheetParentName);
        let codeMatch = false;
        for (const c of pCodes) {
          if (c.length >= 3 && sheetCodes.includes(c)) {
            pScore += 2000;
            codeMatch = true;
          }
        }

        const overlap = getWordOverlap(cleanP, sheetParentName);
        if (overlap >= 2 || codeMatch) {
          pScore += overlap * 100;
        }
      }

      if (pScore > bestParentScore && pScore > 0) {
        bestParentScore = pScore;
        bestParentRows = rows;
      }
    }

    if (bestParentRows.length === 0) {
      bestParentRows = candidateRows;
    }

    // BƯỚC 3: TÌM PHÂN LOẠI CON TRONG ĐÚNG NHÓM SẢN PHẨM CHA ĐÃ KHỚP (Variation Matching)
    let bestVarScore = -1;
    let bestSku = "";

    for (const row of bestParentRows) {
      const sV = cleanString(row[vIdx]);
      const sku = String(row[sIdx] || "").trim();
      if (!sku) continue;

      let vScore = 0;
      if (cleanV) {
        if (sV === cleanV) {
          vScore += 1000;
        } else if (sV.startsWith(cleanV) || cleanV.startsWith(sV)) {
          vScore += 500;
        } else if (sV.includes(cleanV) || cleanV.includes(sV)) {
          vScore += 300;
        } else {
          const overlap = getWordOverlap(cleanV, sV);
          if (overlap > 0) vScore += overlap * 50;
        }
      } else {
        if (!sV || sV === "-") vScore += 100;
      }

      if (vScore > bestVarScore) {
        bestVarScore = vScore;
        bestSku = sku;
      }
    }

    if (!bestSku && bestParentRows.length > 0) {
      bestSku = String(bestParentRows[0][sIdx] || "").trim();
    }

    return bestSku;
  }

  function doInjectBadges() {
    const models = Array.from(document.querySelectorAll('.discount-view-item-model-component, .discount-item-model-component, .discount-edit-item-model-component'));
    models.forEach((mEl) => {
      const varCell = mEl.querySelector('.item-content.item-variation, .item-variation') || mEl;
      if (!varCell) return;

      let varName = "";
      const singleEl = varCell.querySelector('.ellipsis-content.single');
      if (singleEl) {
        varName = (singleEl.innerText || singleEl.textContent || "").replace(/\s+/g,' ').trim();
      }
      if (!varName) {
        // Fallback: tooltip content hoặc clone strip
        const tipEl = varCell.querySelector('.eds-popover__content');
        if (tipEl) varName = (tipEl.innerText || "").replace(/\s+/g,' ').trim();
      }
      if (!varName) {
        const clone = varCell.cloneNode(true);
        clone.querySelectorAll('.eds-popper,.eds-popover__popper,.eds-tooltip__popper,[class*="popper"],[class*="tooltip"],.ext-km-injected-sku').forEach(p=>p.remove());
        varName = (clone.innerText || clone.textContent || "").replace(/\s+/g,' ').trim();
      }
      if (!varName) return;

      const parentCard = mEl.closest('.discount-view-item-component, .discount-item-component, .discount-edit-item-component') || mEl.parentElement?.parentElement;
      let parentName = "";
      if (parentCard) {
        const pEl = parentCard.querySelector('a[href*="/portal/product/"]');
        if (pEl) parentName = (pEl.getAttribute('title') || pEl.innerText || "").replace(/\s+/g,' ').trim();
        if (!parentName) {
            const titleCandidates = Array.from(parentCard.querySelectorAll('.discount-view-item-header .ellipsis-content.single, .discount-edit-item-header .ellipsis-content.single, .item-header .ellipsis-content, .ellipsis-content.single'));
            for (const hEl of titleCandidates) {
              if (!hEl.closest('.discount-view-item-model-component, .discount-edit-item-model-component, .discount-item-model-component')) {
                const text = (hEl.getAttribute('title') || hEl.innerText || "").replace(/\s+/g, ' ').trim();
                if (text && text.toLowerCase() !== "sản phẩm" && text.toLowerCase() !== "product" && text !== varName) {
                  parentName = text;
                  break;
                }
              }
            }
          }
      }

      const sku = findSkuForShopeeVariation(parentName, varName, autoShopeeSpCache, autoShopeeMaGian);
      if (!sku) return;

      // Already has correct badge → skip
      const existing = varCell.querySelector('.ext-km-injected-sku');
      if (existing && existing.getAttribute('data-sku') === sku) return;
      if (existing) existing.remove();

      mEl.style.setProperty('height', 'auto', 'important');
      mEl.style.setProperty('min-height', '56px', 'important');
      mEl.style.setProperty('overflow', 'visible', 'important');
      varCell.style.setProperty('height', 'auto', 'important');
      varCell.style.setProperty('display', 'flex', 'important');
      varCell.style.setProperty('flex-direction', 'column', 'important');
      varCell.style.setProperty('align-items', 'flex-start', 'important');
      varCell.style.setProperty('justify-content', 'center', 'important');
      varCell.style.setProperty('overflow', 'visible', 'important');

      const minPrice = findMinPriceForSku(sku, autoShopeeDsCache);
      const shortSku = String(sku || '').trim().substring(0, 14);

      const badge = document.createElement('div');
      badge.className = 'ext-km-injected-sku';
      badge.setAttribute('data-sku', shortSku);
      badge.setAttribute('data-min-price', minPrice || '');
      badge.style.cssText = 'display: inline-flex !important; align-items: center !important; flex-wrap: wrap !important; gap: 4px !important; margin-top: 4px !important; font-family: monospace, Consolas, sans-serif !important; font-size: 11px !important; width: max-content !important; z-index: 10 !important;';

      const skuSpan = document.createElement('span');
      skuSpan.style.cssText = 'background: #e0f2fe !important; border: 1px solid #7dd3fc !important; border-radius: 4px !important; padding: 2px 6px !important; font-weight: bold !important; color: #0284c7 !important; cursor: pointer !important;';
      skuSpan.title = 'Bấm để copy: ' + shortSku;
      skuSpan.innerText = shortSku;
      skuSpan.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        navigator.clipboard.writeText(shortSku).then(() => {
          skuSpan.innerHTML = `<span style="color:#15803d;font-weight:bold;">✓ Đã copy!</span>`;
          setTimeout(() => {
            skuSpan.innerText = shortSku;
          }, 1200);
        });
      };
      badge.appendChild(skuSpan);

      if (minPrice) {
        const formattedPriceStr = Number(minPrice).toLocaleString('vi-VN');
        const minSpan = document.createElement('span');
        minSpan.style.cssText = 'background: #16a34a !important; border: 1px solid #15803d !important; color: #ffffff !important; border-radius: 4px !important; padding: 2px 6px !important; font-weight: bold !important; font-size: 11px !important;';
        minSpan.title = 'Giá Min từ Sheet DS_SP: ' + formattedPriceStr;
        minSpan.innerText = formattedPriceStr;
        badge.appendChild(minSpan);

        const fillBtn = document.createElement('button');
        fillBtn.type = 'button';
        fillBtn.style.cssText = 'background: #f97316 !important; border: 1px solid #ea580c !important; color: #ffffff !important; border-radius: 4px !important; padding: 2px 8px !important; font-weight: bold !important; font-size: 11px !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 2px !important; box-shadow: 0 1px 2px rgba(0,0,0,0.12) !important; user-select: none !important;';
        fillBtn.title = `Điền Giá Min (${formattedPriceStr}) vào ô Giá sau giảm của dòng này`;
        fillBtn.innerHTML = `⚡ Điền`;

        fillBtn.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          const discInput = mEl.querySelector('.item-discounted-price input, input.eds-input__input, input[restrictiontype="value"], input');
          if (discInput && !discInput.disabled) {
            discInput.focus();
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            if (nativeSetter) nativeSetter.call(discInput, String(minPrice));
            else discInput.value = String(minPrice);
            discInput.dispatchEvent(new Event('input', { bubbles: true }));
            discInput.dispatchEvent(new Event('change', { bubbles: true }));
            discInput.dispatchEvent(new Event('blur', { bubbles: true }));

            fillBtn.innerHTML = `✓ Đã điền`;
            fillBtn.style.background = '#059669';
            fillBtn.style.borderColor = '#047857';

            discInput.style.border = '2px solid #16a34a';
            discInput.style.backgroundColor = '#f0fdf4';
            setTimeout(() => {
              fillBtn.innerHTML = `⚡ Điền`;
              fillBtn.style.background = '#f97316';
              fillBtn.style.borderColor = '#ea580c';
              discInput.style.border = '';
              discInput.style.backgroundColor = '';
            }, 1500);
          }
        };
        badge.appendChild(fillBtn);
      }

      varCell.appendChild(badge);
    });
  }

  function autoInjectPromotionSkuBadges() {
    if (!window.location.href.includes('/portal/marketing/')) return;

    // Data đã thử load (dù có hay không)
    if (autoShopeeSpCache !== null) {
      if (autoShopeeSpCache.length > 1) {
        doInjectBadges();
      }
      return;
    }

    // Đang load → chờ
    if (autoShopeeLoadingData) return;

    // Chưa có data → load
    autoShopeeLoadingData = true;
    try {
      chrome.storage.local.get(['sp_shopee_cache_data', 'ds_sp_cache_data', 'maGian', 'dhHoanTextValue'], (res) => {
        if (res && res.ds_sp_cache_data) autoShopeeDsCache = res.ds_sp_cache_data;
        autoShopeeMaGian = (res?.maGian || res?.dhHoanTextValue || "").trim().toLowerCase();

        if (res && res.sp_shopee_cache_data && res.sp_shopee_cache_data.length > 1) {
          // Cache có sẵn trong storage
          autoShopeeSpCache = res.sp_shopee_cache_data;
          autoShopeeLoadingData = false;
          doInjectBadges();
        } else {
          // Cần gọi API lấy từ Google Sheets
          chrome.runtime.sendMessage({ type: "FETCH_SP_SHOPEE" }, (fRes) => {
            autoShopeeLoadingData = false;
            if (fRes && fRes.ok && fRes.values && fRes.values.length > 1) {
              autoShopeeSpCache = fRes.values;
              chrome.storage.local.set({ sp_shopee_cache_data: fRes.values });
              doInjectBadges();
            } else {
              autoShopeeSpCache = []; // đánh dấu đã thử, tránh loop vô hạn
            }
          });
        }
      });
    } catch (_) {
      autoShopeeLoadingData = false;
    }
  }

  // Khởi động lần đầu
  autoInjectPromotionSkuBadges();

  // Chạy định kỳ 800ms — inject tiếp khi Shopee Vue re-render thêm dòng mới
  
  // =========================================================================
  // NÚT "SỬA SẢN PHẨM" VÀ "COPY TÊN SP" TRÊN TRANG SHOPEE NGƯỜI MUA (shopee.vn)
  // =========================================================================
  function extractShopeeBuyerItemId() {
    const href = window.location.href;
    const path = window.location.pathname;

    const m1 = path.match(/\/product\/\d+\/(\d+)/i) || href.match(/\/product\/\d+\/(\d+)/i);
    if (m1) return m1[1];

    const m2 = path.match(/-i\.\d+\.(\d+)/i) || href.match(/-i\.\d+\.(\d+)/i);
    if (m2) return m2[1];

    const m3 = path.match(/\/universal-link\/product\/\d+\/(\d+)/i);
    if (m3) return m3[1];

    const m4 = href.match(/[?&](?:item_id|itemId|itemid)=(\d+)/i);
    if (m4) return m4[1];

    return "";
  }

  function extractShopeeBuyerProductName() {
    const selectors = [
      '.WBVL_7',
      '._44qnta',
      '.qaNIZv',
      '.vR6Z3Z',
      '.page-product__name',
      '[class*="product-name"]',
      '[class*="productTitle"]',
      'h1'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = (el.innerText || el.textContent || "").replace(/\s+/g, ' ').trim();
        if (txt && txt.length > 3 && !/shopee|đăng nhập|tìm kiếm/i.test(txt)) {
          return txt;
        }
      }
    }

    const metaTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (metaTitle && metaTitle.length > 3) {
      return metaTitle.replace(/\|\s*Shopee.*$/i, '').trim();
    }

    if (document.title) {
      return document.title.replace(/\|\s*Shopee.*$/i, '').replace(/Shopee\s*Việt\s*Nam.*$/i, '').trim();
    }

    return "";
  }

  function injectBuyerProductActionButtons() {
    if (!window.location.host.includes("shopee.vn") || window.location.host.includes("banhang")) {
      return;
    }

    const itemId = extractShopeeBuyerItemId();
    if (!itemId) return;

    const editUrl = `https://banhang.shopee.vn/portal/product/${itemId}`;

    // 1. Gắn nút Inline ngay bên cạnh / dưới tiêu đề sản phẩm
    const titleEl = document.querySelector('.WBVL_7, ._44qnta, .qaNIZv, .vR6Z3Z, .page-product__name, [class*="product-name"], [class*="productTitle"], h1');
    if (titleEl && !document.getElementById('shopee-ext-buyer-actions')) {
      const actionsDiv = document.createElement('div');
      actionsDiv.id = 'shopee-ext-buyer-actions';
      actionsDiv.style.cssText = 'margin: 12px 0 14px 0 !important; display: flex !important; align-items: center !important; gap: 10px !important; flex-wrap: wrap !important; z-index: 99 !important;';

      const editBtn = document.createElement('a');
      editBtn.href = editUrl;
      editBtn.target = '_blank';
      editBtn.className = 'ext-buyer-btn-edit';
      editBtn.style.cssText = 'display: inline-flex !important; align-items: center !important; gap: 6px !important; padding: 6px 14px !important; background: #ee4d2d !important; color: #ffffff !important; font-size: 13px !important; font-weight: bold !important; border-radius: 6px !important; text-decoration: none !important; border: 1px solid #d03b1f !important; box-shadow: 0 2px 5px rgba(238, 77, 45, 0.25) !important; cursor: pointer !important; transition: all 0.2s !important;';
      editBtn.innerHTML = `🛠️ Sửa sản phẩm (${itemId}) ↗`;

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ext-buyer-btn-copy-name';
      copyBtn.style.cssText = 'display: inline-flex !important; align-items: center !important; gap: 6px !important; padding: 6px 14px !important; background: #0284c7 !important; color: #ffffff !important; font-size: 13px !important; font-weight: bold !important; border-radius: 6px !important; border: 1px solid #0369a1 !important; box-shadow: 0 2px 5px rgba(2, 132, 199, 0.25) !important; cursor: pointer !important; transition: all 0.2s !important;';
      copyBtn.innerHTML = `📋 Copy tên sản phẩm`;

      copyBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const pName = extractShopeeBuyerProductName();
        if (pName) {
          navigator.clipboard.writeText(pName).then(() => {
            copyBtn.innerHTML = '✓ Đã copy tên!';
            copyBtn.style.backgroundColor = '#16a34a';
            copyBtn.style.borderColor = '#15803d';
            setTimeout(() => {
              copyBtn.innerHTML = `📋 Copy tên sản phẩm`;
              copyBtn.style.backgroundColor = '#0284c7';
              copyBtn.style.borderColor = '#0369a1';
            }, 1500);
          });
        }
      };

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(copyBtn);

      if (titleEl.parentElement) {
        titleEl.parentElement.insertBefore(actionsDiv, titleEl.nextSibling);
      }
    }

    // 2. Gắn thanh nổi Floating Bar ở góc phải màn hình
    if (!document.getElementById('shopee-ext-buyer-floating-bar')) {
      const floatDiv = document.createElement('div');
      floatDiv.id = 'shopee-ext-buyer-floating-bar';
      floatDiv.style.cssText = 'position: fixed !important; top: 120px !important; right: 20px !important; z-index: 999999 !important; display: flex !important; flex-direction: column !important; gap: 8px !important; background: rgba(255, 255, 255, 0.96) !important; padding: 10px 12px !important; border-radius: 8px !important; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15) !important; border: 1px solid #cbd5e1 !important; backdrop-filter: blur(4px) !important;';

      const floatHeader = document.createElement('div');
      floatHeader.style.cssText = 'font-size: 11px !important; font-weight: bold !important; color: #475569 !important; margin-bottom: 2px !important; display: flex !important; align-items: center !important; justify-content: space-between !important;';
      floatHeader.innerHTML = `<span>⚡ Shopee Ext (${itemId})</span>`;
      floatDiv.appendChild(floatHeader);

      const fEditBtn = document.createElement('a');
      fEditBtn.href = editUrl;
      fEditBtn.target = '_blank';
      fEditBtn.style.cssText = 'display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 4px !important; padding: 5px 12px !important; background: #ee4d2d !important; color: #ffffff !important; font-size: 12px !important; font-weight: bold !important; border-radius: 4px !important; text-decoration: none !important; box-shadow: 0 1px 3px rgba(238, 77, 45, 0.25) !important; text-align: center !important;';
      fEditBtn.innerHTML = `🛠️ Về sửa sản phẩm ↗`;

      const fCopyBtn = document.createElement('button');
      fCopyBtn.type = 'button';
      fCopyBtn.style.cssText = 'display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 4px !important; padding: 5px 12px !important; background: #0284c7 !important; color: #ffffff !important; font-size: 12px !important; font-weight: bold !important; border-radius: 4px !important; border: 1px solid #0369a1 !important; cursor: pointer !important;';
      fCopyBtn.innerHTML = `📋 Copy tên SP`;

      fCopyBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const pName = extractShopeeBuyerProductName();
        if (pName) {
          navigator.clipboard.writeText(pName).then(() => {
            fCopyBtn.innerHTML = '✓ Đã copy!';
            fCopyBtn.style.backgroundColor = '#16a34a';
            fCopyBtn.style.borderColor = '#15803d';
            setTimeout(() => {
              fCopyBtn.innerHTML = `📋 Copy tên SP`;
              fCopyBtn.style.backgroundColor = '#0284c7';
              fCopyBtn.style.borderColor = '#0369a1';
            }, 1500);
          });
        }
      };

      floatDiv.appendChild(fEditBtn);
      floatDiv.appendChild(fCopyBtn);
      document.body.appendChild(floatDiv);
    }
  }

  injectBuyerProductActionButtons();

  setInterval(() => {
    injectAiDescriptionButton();
    injectStockQuickButtons();
    autoInjectPromotionSkuBadges();
    injectBuyerProductActionButtons();
  }, 800);
})();

window.addEventListener('message', (e) => { if (e.data && e.data.action === 'RELOAD_PAGE') { window.location.reload(); } });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "upload_video_from_url") {
        (async () => {
            const statusDiv = document.createElement("div");
            statusDiv.id = "shopee-auto-video-upload-status";
            statusDiv.style.cssText = "position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 999999; background: #fffbeb; border: 2px solid #f59e0b; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #d97706; display: flex; align-items: center; gap: 8px;";
            statusDiv.innerHTML = "⏳ Đang tải video từ sản phẩm Shopee...";
            document.body.appendChild(statusDiv);

            const updateStatus = (text, color = "#d97706") => {
                statusDiv.innerHTML = text;
                statusDiv.style.color = color;
                statusDiv.style.borderColor = color;
            };

            try {
                const fileInput = Array.from(document.querySelectorAll('input[type="file"]'))
                    .find(input => input.accept && (input.accept.includes('video') || input.accept.includes('mp4')))
                    || document.querySelector('input[type="file"]');
                
                if (!fileInput) {
                    updateStatus("❌ Không tìm thấy khung tải video trên trang!", "#dc2626");
                    setTimeout(() => statusDiv.remove(), 4000);
                    sendResponse({ success: false, message: "Không tìm thấy khung tải video trên trang" });
                    return;
                }

                updateStatus("⏳ Đang tải tệp video xuống bộ nhớ...", "#3b82f6");
                const response = await fetch(request.url);
                if (!response.ok) throw new Error("Không thể tải video từ link gốc");
                const blob = await response.blob();

                const filename = `shopee-video-${Date.now()}.mp4`;
                const file = new File([blob], filename, { type: "video/mp4" });

                updateStatus("⏳ Đang đẩy tệp video vào Shopee...", "#10b981");
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;

                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                updateStatus("�… Đã đẩy video vào khung tải lên thành công!", "#16a34a");
                setTimeout(() => statusDiv.remove(), 3000);
                sendResponse({ success: true });
            } catch(e) {
                console.error("Auto video upload error:", e);
                updateStatus(`❌ Lỗi: ${e.message}`, "#dc2626");
                setTimeout(() => statusDiv.remove(), 4000);
                sendResponse({ success: false, message: e.message });
            }
        })();
        return true;
    }
});
