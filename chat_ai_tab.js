// =========================================================================
// CHAT AI TAB - TỰ ĐỘNG LẤY THÔNG TIN SHOPEE WEBCHAT & TƯ VẤN KHÁCH HÀNG BẰNG AI
// =========================================================================

(function () {
  let currentChatData = null;
  let activeWebchatTabId = null;
  const selectedCustomerIndices = new Set();

  // DOM Elements
  const statusEl = document.getElementById("chat-ai-status");
  const btnScanChat = document.getElementById("chat-ai-btn-scan");
  const btnOpenWebchat = document.getElementById("chat-ai-btn-open-webchat");

  // Product Card Elements
  const productSection = document.getElementById("chat-ai-product-section");
  const pImgEl = document.getElementById("chat-ai-product-img");
  const pNameEl = document.getElementById("chat-ai-product-name");
  const pPriceEl = document.getElementById("chat-ai-product-price");
  const pOrigPriceEl = document.getElementById("chat-ai-product-orig-price");
  const pStockEl = document.getElementById("chat-ai-product-stock");
  const pSoldEl = document.getElementById("chat-ai-product-sold");
  const pDiscountEl = document.getElementById("chat-ai-product-discount");
  const pSheetInfoEl = document.getElementById("chat-ai-product-sheet-info");

  // Chat History & Multi-Select Elements
  const chatHistoryContainer = document.getElementById("chat-ai-history-list");
  const inputCustomerQuestion = document.getElementById("chat-ai-customer-question");
  const inputCustomNote = document.getElementById("chat-ai-custom-note");
  const btnSelectAllCustomer = document.getElementById("chat-ai-btn-select-all-customer");
  const btnSelectLatestCustomer = document.getElementById("chat-ai-btn-select-latest-customer");
  const btnClearSelection = document.getElementById("chat-ai-btn-clear-selection");
  const btnClearQuestionInput = document.getElementById("chat-ai-btn-clear-question-input");
  const selectedCountBadge = document.getElementById("chat-ai-selected-count-badge");

  // Style Buttons
  const styleButtons = document.querySelectorAll(".chat-ai-style-btn");
  let selectedStyle = "tu_van";

  // AI Output Elements
  const btnGenerateAi = document.getElementById("chat-ai-btn-generate");
  const aiOutputTextarea = document.getElementById("chat-ai-output-text");
  const btnCopyReply = document.getElementById("chat-ai-btn-copy");
  const btnFillToShopee = document.getElementById("chat-ai-btn-fill-shopee");
  const btnFillAndSend = document.getElementById("chat-ai-btn-send-shopee");
  const actionFeedback = document.getElementById("chat-ai-action-feedback");

  // Quick Templates Elements (Cột H sheet CAI_DAT + Custom Templates)
  const templatesContainer = document.getElementById("chat-ai-templates-list");
  const searchTemplateInput = document.getElementById("chat-ai-search-template");
  const btnRefreshTemplates = document.getElementById("chat-ai-btn-refresh-templates");
  const btnToggleAddTemplate = document.getElementById("chat-ai-btn-toggle-add-template");
  const addTemplatePanel = document.getElementById("chat-ai-add-template-panel");
  const newTemplateInput = document.getElementById("chat-ai-new-template-input");
  const btnCancelAddTemplate = document.getElementById("chat-ai-btn-cancel-add-template");
  const btnSaveNewTemplate = document.getElementById("chat-ai-btn-save-new-template");
  const btnTogglePresets = document.getElementById("chat-ai-btn-toggle-preset-templates");
  const presetsPanel = document.getElementById("chat-ai-preset-templates-panel");
  const presetsList = document.getElementById("chat-ai-preset-templates-list");
  const btnClosePresets = document.getElementById("chat-ai-btn-close-presets");

  let sheetTemplates = [];
  let customTemplates = [];
  let chatTemplates = [];

  // Mẫu câu trả lời nhanh gợi ý chuẩn Shopee
  const PRESET_TEMPLATES = [
    { title: "🌸 Còn hàng & giao ngay", text: "Dạ chào bạn! Sản phẩm bên mình luôn có sẵn tại kho và chuẩn bị gửi đi ngay được ạ. Bạn đặt sớm để bên mình đóng gói giao liền nhé!" },
    { title: "🚚 Thời gian giao hàng", text: "Dạ đơn hàng thường sẽ được giao trong khoảng 1-3 ngày tùy khu vực ạ. Shop đóng gói và gửi đơn vị vận chuyển ngay trong ngày bạn nhé!" },
    { title: "🏷️ Mã giảm giá & Freeship", text: "Dạ bạn nhớ bấm Lưu mã voucher của Shop trên trang sản phẩm và áp thêm mã Freeship Extra của Shopee ở bước thanh toán để được giảm giá tốt nhất nhé!" },
    { title: "🛡️ Cam kết & Bảo hành", text: "Dạ sản phẩm chính hãng 100%, bảo hành uy tín đầy đủ. Khi nhận hàng bạn được đồng kiểm tra, nếu có bất kỳ vấn đề gì Shop hỗ trợ đổi mới 1-1 ngay lập tức ạ!" },
    { title: "🎁 Quà tặng & Phụ kiện", text: "Dạ sản phẩm có đầy đủ phụ kiện/quà tặng kèm theo đúng như mô tả và hình ảnh ạ. Bạn yên tâm đặt hàng nhé!" },
    { title: "🙏 Cảm ơn sau khi mua", text: "Dạ cảm ơn bạn rất nhiều vì đã tin tưởng ủng hộ Shop! Nếu cần hỗ trợ thêm thông tin gì bạn cứ nhắn tin cho Shop bất cứ lúc nào nhé ạ!" },
    { title: "⚠️ Hỗ trợ sự cố/đổi trả", text: "Dạ Shop rất tiếc về sự cố chưa tốt này ạ. Bạn gửi giúp Shop hình ảnh/video sản phẩm để Shop kiểm tra và hỗ trợ đổi mới/bù hàng nhanh nhất cho bạn nhé ạ!" }
  ];

  // Style mapping descriptions
  const STYLE_PROMPTS = {
    tu_van: "Trả lời ngắn gọn 1-2 câu, giải đáp thẳng câu hỏi của khách.",
    chot_don: "Trả lời nhanh gọn, xác nhận còn hàng và hướng dẫn đặt ngay.",
    voucher: "Nhắc nhẹ khách áp mã giảm giá / freeship.",
    bao_hanh: "Khẳng định hàng chính hãng, bảo hành đổi trả uy tín."
  };

  // 1. Tìm Tab Shopee Webchat đang mở
  async function findShopeeWebchatTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (allTabs) => {
        if (!allTabs || allTabs.length === 0) return resolve(null);

        const activeTab = allTabs.find(t => t.active && t.url && (t.url.includes("webchat") || t.url.includes("banhang.shopee.vn")));
        if (activeTab) return resolve(activeTab);

        const webchatTab = allTabs.find(t => t.url && (t.url.includes("new-webchat") || t.url.includes("webchat")));
        if (webchatTab) return resolve(webchatTab);

        const shopeeTab = allTabs.find(t => t.url && t.url.includes("banhang.shopee.vn"));
        if (shopeeTab) return resolve(shopeeTab);

        resolve(null);
      });
    });
  }

  // Hàm chạy trực tiếp trong trang Shopee
  function extractShopeeChatDataInPage() {
    const detailChat = document.querySelector('._3h5To4QZew, [data-cy="webchat-conversation-detail-chat"], ._2WZcuAW5Qo') || document.body;

    let productInfo = {
      name: "",
      image: "",
      price: "",
      originalPrice: "",
      stock: "",
      sold: "",
      discount: "",
      source: ""
    };

    // A. Thẻ sản phẩm ghim trên đầu khung chat
    const pinnedProduct = detailChat.querySelector('.Wy5_SjKidw, ._ki3uOms2o, [class*="pinned-product"]');
    if (pinnedProduct) {
      const nameEl = pinnedProduct.querySelector('.rFHc1_XxbI, .CFm21BsdMu, [class*="title"]');
      if (nameEl) productInfo.name = nameEl.textContent.trim();

      const imgEl = pinnedProduct.querySelector('img.EOkaqhE5Vk, img');
      if (imgEl) productInfo.image = imgEl.src || "";

      const priceEl = pinnedProduct.querySelector('.izywe_mFbr, [class*="price"]');
      if (priceEl) productInfo.price = priceEl.textContent.trim();

      const origPriceEl = pinnedProduct.querySelector('.NY59qgWgc3, [class*="origin-price"]');
      if (origPriceEl) productInfo.originalPrice = origPriceEl.textContent.trim();

      productInfo.source = "Thẻ sản phẩm ghim đầu chat";
    }

    // B. Thẻ sản phẩm trong tin nhắn
    if (!productInfo.name) {
      const chatProductCard = detailChat.querySelector('.P8CcB0wjwY, .HOPL9U0T1c, [class*="productcard"]');
      if (chatProductCard) {
        const cardParent = chatProductCard.closest('.P8CcB0wjwY') || chatProductCard.parentElement;
        const nameEl = cardParent.querySelector('.Qp7M6nTYF_, .xIrlSYpAIZ, [title]');
        if (nameEl) productInfo.name = nameEl.getAttribute('title') || nameEl.textContent.trim();

        const imgEl = cardParent.querySelector('img.LWnGpseTts, img');
        if (imgEl && !productInfo.image) productInfo.image = imgEl.src || "";

        const priceEl = cardParent.querySelector('.NMPRLXUCs1, .wWpupCJoha');
        if (priceEl && !productInfo.price) productInfo.price = priceEl.textContent.trim();

        const origPriceEl = cardParent.querySelector('.eHBPNxGGDK');
        if (origPriceEl && !productInfo.originalPrice) productInfo.originalPrice = origPriceEl.textContent.trim();

        productInfo.source = "Thẻ sản phẩm trong tin nhắn";
      }
    }

    // C. Khung thông tin sản phẩm ở thanh bên phải (Workstation)
    const workstation = document.querySelector('#workstation, ._1wok-igujT, .S3OvW0Hxe8');
    if (workstation) {
      if (!productInfo.name) {
        const nameEl = workstation.querySelector('.PwWXFM7aOY [title], [data-cy*="product"] [title]');
        if (nameEl) productInfo.name = nameEl.getAttribute('title') || nameEl.textContent.trim();
      }
      if (!productInfo.image) {
        const imgEl = workstation.querySelector('img.IaIV2xKT1C, img');
        if (imgEl) productInfo.image = imgEl.src || "";
      }
      if (!productInfo.price) {
        const priceEl = workstation.querySelector('.HMBXaKkUSS, .FWKGhSkSNN');
        if (priceEl) productInfo.price = priceEl.textContent.trim();
      }

      const stockEl = workstation.querySelector('._46VsRuudzE');
      if (stockEl) productInfo.stock = stockEl.textContent.trim();

      const soldEl = workstation.querySelector('.yy8KyS7UNN');
      if (soldEl) productInfo.sold = soldEl.textContent.trim();

      const discEl = workstation.querySelector('.CQcE9c4xWM, [data-cy*="promotion"]');
      if (discEl) productInfo.discount = discEl.textContent.trim();
    }

    // 2. LẤY DANH SÁCH TIN NHẮN
    const messages = [];
    let lastCustomerMessage = "";

    const rawMsgElements = Array.from(detailChat.querySelectorAll('#messagesContainer .DEwekPN7v2, #messagesContainer .RtO616EACf, [data-cy^="webchat-message"]'));
    const msgElements = rawMsgElements.filter(el => !rawMsgElements.some(other => other !== el && other.contains(el)));

    msgElements.forEach(msgEl => {
      const isReceive = msgEl.querySelector('[data-cy="webchat-message-receive"]') || msgEl.classList.contains('x_vjYCA89K') || msgEl.getAttribute('data-cy') === 'webchat-message-receive';
      const isSend = msgEl.querySelector('[data-cy="webchat-message-send"]') || msgEl.classList.contains('IjkExKWyR_') || msgEl.getAttribute('data-cy') === 'webchat-message-send';

      const sender = isReceive ? "customer" : (isSend ? "shop" : "system");
      const isAutoReply = !!msgEl.querySelector('.ufjjFujTb2, [class*="autoreply"]');

      const timeEl = msgEl.querySelector('.sSIhmxFOh6, .pE0ax8leZo, .ps7_zN15iV');
      const timeStr = timeEl ? timeEl.textContent.trim() : "";

      let text = "";
      const textContainer = msgEl.querySelector('.w2C67vtnXi, .FkK7VxR2qX, .i6xFxbUJy0');
      if (textContainer) {
        const clone = textContainer.cloneNode(true);
        clone.querySelectorAll('.sSIhmxFOh6, .pE0ax8leZo, .ujrf_CG21r, .ChatbotUI-icon, svg').forEach(x => x.remove());
        text = clone.textContent.trim();
      }

      const productCardInMsg = msgEl.querySelector('.Qp7M6nTYF_, .HOPL9U0T1c');
      let cardText = "";
      if (productCardInMsg) {
        const cardParent = productCardInMsg.closest('.P8CcB0wjwY') || productCardInMsg.parentElement;
        const pName = cardParent.querySelector('.Qp7M6nTYF_')?.textContent?.trim() || "";
        const pPrice = cardParent.querySelector('.NMPRLXUCs1')?.textContent?.trim() || "";
        cardText = `[Thẻ sản phẩm: ${pName} ${pPrice ? '(' + pPrice + ')' : ''}]`;
      }

      const fullContent = text || cardText;
      if (fullContent && !fullContent.includes("LƯU Ý: Shopee KHÔNG cho phép")) {
        const lastMsg = messages[messages.length - 1];
        const isDuplicate = lastMsg &&
          lastMsg.sender === sender &&
          lastMsg.text === fullContent &&
          (!timeStr || !lastMsg.time || lastMsg.time === timeStr);

        if (!isDuplicate) {
          messages.push({
            sender,
            text: fullContent,
            time: timeStr,
            isAutoReply
          });

          if (sender === "customer" && text) {
            lastCustomerMessage = text;
          }
        }
      }
    });

    return {
      ok: true,
      url: window.location.href,
      product: productInfo,
      messages: messages.slice(-20),
      lastCustomerQuestion: lastCustomerMessage
    };
  }

  // Hàm điền chat trực tiếp trong trang
  function fillShopeeChatInPageDirect(text, autoSend) {
    const textarea = document.querySelector('textarea.E2MWg3w8y6, [data-cy="webchat-conversation-detail-input"] textarea, #inputField textarea, textarea[placeholder*="tin nhắn"], textarea');
    if (!textarea) {
      return { ok: false, error: "Không tìm thấy ô nhập tin nhắn trên Shopee Chat" };
    }

    textarea.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(textarea, text);
    } else {
      textarea.value = text;
    }

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    if (autoSend) {
      setTimeout(() => {
        const sendBtn = document.querySelector('.XsR3zIeGOc, .kgP1yPCqxR, [data-cy="webchat-conversation-detail-input"] [class*="send"]');
        if (sendBtn) {
          sendBtn.click();
        } else {
          textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
        }
      }, 300);
    }

    return { ok: true };
  }

  // 2. Quét thông tin từ Shopee Webchat
  async function scanShopeeChatData() {
    if (statusEl) {
      statusEl.innerHTML = `⏳ Đang quét dữ liệu từ Shopee Webchat...`;
      statusEl.style.color = "#d97706";
    }

    const tab = await findShopeeWebchatTab();
    if (!tab) {
      if (statusEl) {
        statusEl.innerHTML = `⚠️ Không tìm thấy tab Shopee Webchat! Vui lòng mở trang Webchat Shopee.`;
        statusEl.style.color = "#dc2626";
      }
      return;
    }

    activeWebchatTabId = tab.id;

    try {
      let response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "GET_SHOPEE_CHAT_DATA" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(res);
          }
        });
      });

      if (!response || !response.ok) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractShopeeChatDataInPage
          });
          if (results && results[0] && results[0].result) {
            response = results[0].result;
          }
        } catch (e) {
          console.warn("Execute script fallback error:", e);
        }
      }

      if (!response || !response.ok) {
        if (statusEl) {
          statusEl.innerHTML = `⚠️ Chưa lấy được dữ liệu. Bạn hãy bấm F5 (Tải lại) trang Shopee Webchat rồi bấm Quét lại nhé!`;
          statusEl.style.color = "#dc2626";
        }
        return;
      }

      currentChatData = response;
      renderChatData(response);

      if (statusEl) {
        const pName = response.product?.name ? `1 SP ("${response.product.name.substring(0, 25)}...")` : "chưa có SP ghim";
        const msgCount = response.messages?.length || 0;
        statusEl.innerHTML = `🟢 Đã kết nối Webchat: <b>${pName}</b>, <b>${msgCount}</b> tin nhắn gần nhất.`;
        statusEl.style.color = "#16a34a";
      }
    } catch (err) {
      console.error("Lỗi scanShopeeChatData:", err);
      if (statusEl) {
        statusEl.innerHTML = `❌ Lỗi: ${err.message}`;
        statusEl.style.color = "#dc2626";
      }
    }
  }

  // Cập nhật câu hỏi của khách khi chọn/bỏ chọn nhiều tin nhắn
  function updateSelectedCustomerQuestions() {
    if (!currentChatData?.messages) return;

    const selectedTexts = [];
    currentChatData.messages.forEach((msg, idx) => {
      if (selectedCustomerIndices.has(idx) && msg.text) {
        selectedTexts.push(msg.text);
      }
    });

    if (inputCustomerQuestion) {
      inputCustomerQuestion.value = selectedTexts.join("\n");
    }

    if (selectedCountBadge) {
      selectedCountBadge.textContent = `Đã chọn: ${selectedCustomerIndices.size} câu`;
      selectedCountBadge.style.color = selectedCustomerIndices.size > 0 ? "#16a34a" : "#64748b";
    }

    // Cập nhật class .selected cho các bubble
    if (chatHistoryContainer) {
      chatHistoryContainer.querySelectorAll(".bubble-customer").forEach(bubble => {
        const idx = parseInt(bubble.getAttribute("data-msg-idx"), 10);
        if (selectedCustomerIndices.has(idx)) {
          bubble.classList.add("selected");
        } else {
          bubble.classList.remove("selected");
        }
      });
    }
  }

  // 3. Hiển thị thông tin lên giao diện
  function renderChatData(data) {
    const p = data.product || {};

    // A. Sản phẩm
    if (productSection) {
      if (p.name || p.image || p.price) {
        productSection.style.display = "block";
        if (pImgEl) {
          pImgEl.src = p.image || "icon-128.png";
          pImgEl.style.display = p.image ? "block" : "none";
        }
        if (pNameEl) pNameEl.textContent = p.name || "Không có tên sản phẩm";
        if (pPriceEl) pPriceEl.textContent = p.price ? `💰 ${p.price}` : "";
        if (pOrigPriceEl) pOrigPriceEl.textContent = p.originalPrice ? ` (${p.originalPrice})` : "";
        if (pStockEl) {
          pStockEl.textContent = p.stock ? `📦 ${p.stock}` : "";
          pStockEl.style.display = p.stock ? "inline-block" : "none";
        }
        if (pSoldEl) {
          pSoldEl.textContent = p.sold ? `🔥 ${p.sold}` : "";
          pSoldEl.style.display = p.sold ? "inline-block" : "none";
        }
        if (pDiscountEl) {
          pDiscountEl.textContent = p.discount ? `🏷️ ${p.discount}` : "";
          pDiscountEl.style.display = p.discount ? "inline-block" : "none";
        }

        lookupProductInSheet(p.name);
      } else {
        productSection.style.display = "none";
      }
    }

    // B. Chọn mặc định tin nhắn mới nhất của khách
    selectedCustomerIndices.clear();
    if (data.messages && data.messages.length > 0) {
      let lastCustIdx = -1;
      data.messages.forEach((msg, idx) => {
        if (msg.sender === "customer" && msg.text) {
          lastCustIdx = idx;
        }
      });
      if (lastCustIdx !== -1) {
        selectedCustomerIndices.add(lastCustIdx);
      }
    }

    // C. Lịch sử tin nhắn
    if (chatHistoryContainer) {
      chatHistoryContainer.innerHTML = "";
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg, idx) => {
          const isCustomer = msg.sender === "customer";
          const item = document.createElement("div");
          item.className = `chat-ai-bubble ${isCustomer ? "bubble-customer" : (msg.sender === "shop" ? "bubble-shop" : "bubble-system")}`;
          item.setAttribute("data-msg-idx", idx);

          const senderLabel = isCustomer ? "👤 Khách:" : (msg.sender === "shop" ? "🏪 Shop:" : "ℹ️ Hệ thống:");
          const autoBadge = msg.isAutoReply ? `<span class="chat-ai-auto-badge">Tự động</span>` : "";
          const timeBadge = msg.time ? `<span class="chat-ai-time-badge">${msg.time}</span>` : "";
          const checkIcon = isCustomer ? `<span class="chat-ai-checkbox-indicator">✓</span>` : "";

          item.innerHTML = `
            <div class="chat-ai-bubble-header">
              ${checkIcon}
              <span class="chat-ai-sender-name">${senderLabel}</span>
              ${autoBadge}
              ${timeBadge}
            </div>
            <div class="chat-ai-bubble-text">${escapeHtml(msg.text)}</div>
          `;

          if (isCustomer && msg.text) {
            item.title = "Bấm để chọn / bỏ chọn câu hỏi này";
            item.onclick = () => {
              if (selectedCustomerIndices.has(idx)) {
                selectedCustomerIndices.delete(idx);
              } else {
                selectedCustomerIndices.add(idx);
              }
              updateSelectedCustomerQuestions();
            };
          }

          chatHistoryContainer.appendChild(item);
        });

        chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
      } else {
        chatHistoryContainer.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 10px; font-size: 12px;">Chưa có tin nhắn nào trong cuộc trò chuyện</div>`;
      }
    }

    updateSelectedCustomerQuestions();
  }

  // 4. Tra cứu thông tin sản phẩm từ Sheet SP_SHOPEE / DS_SP
  function lookupProductInSheet(productName) {
    if (!productName || !pSheetInfoEl) return;

    chrome.storage.local.get(['sp_shopee_cache_data', 'ds_sp_cache_data'], (res) => {
      const spCache = res?.sp_shopee_cache_data || [];
      const dsCache = res?.ds_sp_cache_data || [];

      let matchedSku = "";
      let minPrice = "";

      const cleanName = productName.toLowerCase();

      if (Array.isArray(spCache)) {
        for (const row of spCache) {
          const rowName = String(row.ten_sp || row[2] || "").toLowerCase();
          const rowSku = String(row.id_sp_ct || row.id_sp || row.sku || row[1] || "");
          if (rowName && cleanName.includes(rowName.substring(0, 20))) {
            matchedSku = rowSku;
            break;
          }
        }
      }

      if (matchedSku && Array.isArray(dsCache)) {
        for (const r of dsCache) {
          const rowSku = String(r.id_sp || r.id_sp_ct || r.sku || (Array.isArray(r) ? r[1] : "")).toUpperCase();
          if (rowSku && matchedSku.toUpperCase().startsWith(rowSku.substring(0, 4))) {
            const rawVal = r.gia_thap_nhat || r.gia_min || (Array.isArray(r) ? r[6] : "");
            if (rawVal) minPrice = rawVal;
            break;
          }
        }
      }

      if (matchedSku || minPrice) {
        pSheetInfoEl.style.display = "block";
        pSheetInfoEl.innerHTML = `📋 <b>Dữ liệu Shop:</b> SKU: <code>${matchedSku || 'N/A'}</code> ${minPrice ? `| Giá Min: <b style="color:#16a34a;">${Number(String(minPrice).replace(/[^\d]/g, '')).toLocaleString('vi-VN')}₫</b>` : ''}`;
      } else {
        pSheetInfoEl.style.display = "none";
      }
    });
  }

  async function callXkiroDeepseekChat(promptText) {
    const DEFAULT_XKIRO_KEY = "sk-xt-27e56ff5d3d864c86e4993e85cf95f1695698217d913faf3";
    const res = await chrome.storage.local.get(["xkiroApiKey", "xkiroModel", "xkiroModels"]);
    const apiKey = (res.xkiroApiKey || "").trim() || DEFAULT_XKIRO_KEY;
    const configuredModel = (res.xkiroModel || "").trim() || "deepseek/deepseek-v4-flash";

    const fallbackList = [
      configuredModel,
      "deepseek/deepseek-v4-pro",
      "qwen/qwen3.8-max:free",
      "deepseek/deepseek-v4-flash",
      "qwen/qwen3.7-max:free",
      "qwen/qwen3.7-plus:free",
      "qwen/qwen3.6-plus:free",
      "minimax/minimax-m2.7-highspeed:free"
    ];
    const modelsToTry = [...new Set(fallbackList)];

    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const response = await fetch("https://api.xkiro.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: promptText }]
          })
        });

        const data = await response.json();
        if (!response.ok) {
          const errMsg = data.error?.message || `Lỗi XKiro HTTP ${response.status}`;
          lastError = new Error(errMsg);
          console.warn(`[XKiro AI Chat] Model ${model} gặp lỗi (${errMsg}), thử model tiếp theo...`);
          await new Promise(r => setTimeout(r, 300));
          continue;
        }

        let resultText = data.choices?.[0]?.message?.content || "";
        resultText = resultText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (resultText) {
          return resultText;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[XKiro AI Chat] Lỗi model ${model}:`, err.message);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    throw lastError || new Error("Tất cả model XKiro đều không phản hồi");
  }

  // 5. Gọi Gemini API để sinh câu trả lời tư vấn
  async function generateAiChatReply() {
    const question = inputCustomerQuestion ? inputCustomerQuestion.value.trim() : "";
    if (!question && (!currentChatData || !currentChatData.product?.name)) {
      alert("Vui lòng tick chọn câu hỏi của khách hoặc nhập nội dung cần tư vấn trước!");
      return;
    }

    if (btnGenerateAi) {
      btnGenerateAi.disabled = true;
      btnGenerateAi.innerHTML = `⏳ Đang suy nghĩ câu trả lời...`;
    }

    try {
      const resStore = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
      const apiKey = resStore.geminiApiKey ? resStore.geminiApiKey.trim() : "";
      const model = resStore.geminiModel || "gemini-2.5-flash";

      const p = currentChatData?.product || {};
      const customNote = inputCustomNote ? inputCustomNote.value.trim() : "";
      const styleInstruction = STYLE_PROMPTS[selectedStyle] || STYLE_PROMPTS.tu_van;

      let chatHistoryText = "";
      if (currentChatData?.messages && currentChatData.messages.length > 0) {
        chatHistoryText = currentChatData.messages.map(m => `${m.sender === 'customer' ? 'Khách' : 'Shop'}: ${m.text}`).join('\n');
      }

      const prompt = `Bạn là nhân viên hỗ trợ khách hàng của Shop trên Shopee. Hãy trả lời tin nhắn của khách hàng một cách thân thiện, lịch sự và chính xác.

THÔNG TIN SẢN PHẨM:
- Tên: ${p.name || 'Sản phẩm của Shop'}
- Giá: ${p.price || ''}
- Tình trạng: ${p.stock || 'Sẵn hàng'}

${chatHistoryText ? `LỊCH SỬ CHAT GẦN ĐÂY:\n${chatHistoryText}\n` : ''}
CÁC CÂU HỎI / YÊU CẦU CỦA KHÁCH HÀNG CẦN TRẢ LỜI:
"${question || (p.name ? 'Sản phẩm này dùng thế nào shop?' : 'Shop tư vấn giúp mình')}"

${customNote ? `GHI CHÚ THÊM CỦA SHOP: "${customNote}"\n` : ''}

QUY TẮC BẮT BUỘC TRẢ LỜI:
1. ĐƠN GIẢN, NGẮN GỌN (chỉ 1 - 3 câu).
2. TẬP TRUNG THẲNG VÀO TẤT CẢ CÂU HỎI VÀ NGỮ CẢNH CỦA KHÁCH, nếu khách hỏi nhiều ý thì trả lời đầy đủ từng ý một cách rõ ràng.
3. Yêu cầu phong cách: ${styleInstruction}
4. Xưng hô lịch sự, thân thiện tự nhiên (Dạ vâng ạ / Dạ anh/chị...).
5. Tuyệt đối KHÔNG dùng định dạng markdown như **, *, #, không dùng dấu ngoặc kép bọc câu. Chỉ trả về đúng nội dung tin nhắn gửi khách.`;

      let reply = "";
      let lastError = null;

      // 1. Thử gọi Gemini nếu có API Key
      if (apiKey) {
        const configuredModel = model || "gemini-2.5-flash";
        const modelsToTry = [...new Set([configuredModel, "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"])];

        for (const m of modelsToTry) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
              })
            });

            const data = await response.json();
            if (!response.ok) {
              const errMsg = data.error?.message || `Lỗi HTTP ${response.status}`;
              if (response.status === 503 || response.status === 429 || errMsg.toLowerCase().includes("high demand")) {
                lastError = new Error(errMsg);
                await new Promise(r => setTimeout(r, 400));
                continue;
              }
              throw new Error(errMsg);
            }

            reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (reply) break;
          } catch (err) {
            lastError = err;
            if (err.message?.toLowerCase().includes("high demand") || err.message?.toLowerCase().includes("503") || err.message?.toLowerCase().includes("429")) {
              await new Promise(r => setTimeout(r, 400));
              continue;
            }
            throw err;
          }
        }
      }

      // 2. Nếu Gemini không có key hoặc bị quá tải / lỗi -> Tự động chuyển sang XKiro DeepSeek V4
      if (!reply) {
        try {
          console.warn("[Chat AI] Gemini lỗi hoặc hết hạn, tự động chuyển sang XKiro DeepSeek V4...");
          reply = await callXkiroDeepseekChat(prompt);
        } catch (deepseekErr) {
          if (lastError) throw lastError;
          throw deepseekErr;
        }
      }

      if (reply) {
        reply = reply
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/^["']|["']$/g, '')
          .trim();

        if (aiOutputTextarea) {
          aiOutputTextarea.value = reply;
        }

        showActionFeedback("✓ Đã tạo câu trả lời thành công!", "#16a34a");
      } else {
        throw new Error("AI không trả về nội dung nào");
      }
    } catch (err) {
      console.error("Lỗi generateAiChatReply:", err);
      showActionFeedback(`❌ Lỗi AI: ${err.message}`, "#dc2626");
    } finally {
      if (btnGenerateAi) {
        btnGenerateAi.disabled = false;
        btnGenerateAi.innerHTML = `✨ AI Sinh Câu Trả Lời`;
      }
    }
  }

  // =========================================================================
  // 6. QUẢN LÝ MẪU TRẢ LỜI NHANH (Cột H sheet CAI_DAT + Custom Templates)
  // =========================================================================
  async function loadCustomTemplatesFromStorage() {
    const res = await new Promise(r => chrome.storage.local.get(["custom_chat_templates"], r));
    if (res.custom_chat_templates && Array.isArray(res.custom_chat_templates)) {
      customTemplates = res.custom_chat_templates;
    } else {
      customTemplates = [];
    }
  }

  async function saveCustomTemplatesToStorage() {
    await chrome.storage.local.set({ custom_chat_templates: customTemplates });
    mergeAndRenderTemplates();
  }

  async function loadCaiDatChatTemplates(forceRefresh = false) {
    if (!templatesContainer) return;

    await loadCustomTemplatesFromStorage();

    if (!forceRefresh) {
      const storage = await new Promise(r => chrome.storage.local.get(["cai_dat_chat_templates"], r));
      if (storage.cai_dat_chat_templates && Array.isArray(storage.cai_dat_chat_templates) && storage.cai_dat_chat_templates.length > 0) {
        sheetTemplates = storage.cai_dat_chat_templates;
        mergeAndRenderTemplates();
        return;
      }
    }

    templatesContainer.innerHTML = '<div style="text-align:center; color:#64748b; font-size:11px; padding:6px;">Đang tải mẫu từ sheet CAI_DAT (Cột H)...</div>';

    chrome.runtime.sendMessage({ type: "FETCH_CAI_DAT" }, (res) => {
      if (res && res.ok && res.values && res.values.length > 0) {
        const rows = res.values;
        const headers = rows[0].map(h => String(h || "").trim().toLowerCase());

        let chatColIdx = headers.findIndex(h => h === "chat" || h === "chat_mau" || h.includes("chat") || h.includes("trả lời nhanh") || h.includes("mẫu tin") || h.includes("tin nhắn"));
        if (chatColIdx === -1) chatColIdx = 7; // Cột H (index 7: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7)

        const extracted = [];
        for (let i = 1; i < rows.length; i++) {
          const val = String(rows[i][chatColIdx] || "").trim();
          if (val) {
            extracted.push(val);
          }
        }

        sheetTemplates = extracted;
        chrome.storage.local.set({ cai_dat_chat_templates: sheetTemplates });
        mergeAndRenderTemplates();
      } else {
        mergeAndRenderTemplates();
      }
    });
  }

  function mergeAndRenderTemplates() {
    chatTemplates = [
      ...customTemplates.map(t => ({ text: t, isCustom: true })),
      ...sheetTemplates.map(t => ({ text: t, isCustom: false }))
    ];
    renderChatTemplates();
  }

  function renderChatTemplates() {
    if (!templatesContainer) return;

    const query = searchTemplateInput ? searchTemplateInput.value.trim().toLowerCase() : "";
    let filtered = chatTemplates;
    if (query) {
      filtered = chatTemplates.filter(item => item.text.toLowerCase().includes(query));
    }

    if (!filtered || filtered.length === 0) {
      templatesContainer.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:11px; padding:6px;">${query ? "Không tìm thấy mẫu phù hợp" : "Chưa có mẫu trả lời nào. Hãy bấm '+ Thêm mẫu' hoặc '💡 Mẫu gợi ý'!"}</div>`;
      return;
    }

    templatesContainer.innerHTML = filtered.map((item, idx) => {
      const isCustom = item.isCustom;
      const customBadge = isCustom ? `<span style="background:#dcfce7; color:#15803d; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:bold; flex-shrink:0;">Tùy chỉnh</span>` : `<span style="background:#f1f5f9; color:#475569; padding:1px 4px; border-radius:3px; font-size:9px; flex-shrink:0;">Sheet</span>`;
      const deleteBtn = isCustom ? `<button type="button" class="btn-delete-custom-template" data-text="${escapeHtml(item.text)}" style="padding:3px 5px; font-size:10px; background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:3px; cursor:pointer;" title="Xóa mẫu này">🗑️</button>` : "";

      return `
        <div class="chat-template-card ${isCustom ? 'custom-template' : ''}">
          <div style="display:flex; align-items:center; gap:4px; flex:1; min-width:0;">
            ${customBadge}
            <div class="chat-template-text-click" data-index="${idx}" style="flex:1; min-width:0; font-size:11px; color:#1e293b; line-height:1.35; cursor:pointer; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;" title="Bấm để đưa vào ô trả lời">
              ${escapeHtml(item.text)}
            </div>
          </div>
          <div style="display:flex; gap:3px; flex-shrink:0;">
            <button type="button" class="btn-use-template" data-index="${idx}" style="padding:3px 6px; font-size:10px; background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:3px; cursor:pointer; font-weight:500;" title="Đưa vào ô trả lời">📝 Chọn</button>
            <button type="button" class="btn-fill-template-shopee" data-index="${idx}" style="padding:3px 6px; font-size:10px; background:#2563eb; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:500;" title="Điền thẳng vào ô chat Shopee">💬 Điền</button>
            <button type="button" class="btn-send-template-shopee" data-index="${idx}" style="padding:3px 6px; font-size:10px; background:#ea580c; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;" title="Điền và gửi luôn cho khách">⚡ Gửi</button>
            ${deleteBtn}
          </div>
        </div>
      `;
    }).join("");

    // Sự kiện chọn mẫu
    templatesContainer.querySelectorAll(".chat-template-text-click, .btn-use-template").forEach(el => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.getAttribute("data-index"), 10);
        const item = filtered[idx];
        if (item && aiOutputTextarea) {
          aiOutputTextarea.value = item.text;
          aiOutputTextarea.focus();
          showActionFeedback("✓ Đã chọn mẫu câu trả lời!", "#16a34a");
        }
      });
    });

    // Sự kiện điền vào chat Shopee
    templatesContainer.querySelectorAll(".btn-fill-template-shopee").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        const item = filtered[idx];
        if (item) {
          fillToShopeeChat(false, item.text);
        }
      });
    });

    // Sự kiện điền và gửi chat Shopee
    templatesContainer.querySelectorAll(".btn-send-template-shopee").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        const item = filtered[idx];
        if (item) {
          fillToShopeeChat(true, item.text);
        }
      });
    });

    // Sự kiện xóa mẫu tùy chỉnh
    templatesContainer.querySelectorAll(".btn-delete-custom-template").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetText = btn.getAttribute("data-text");
        if (confirm("Bạn có chắc muốn xóa câu mẫu này không?")) {
          customTemplates = customTemplates.filter(t => t !== targetText);
          saveCustomTemplatesToStorage();
          showActionFeedback("✓ Đã xóa câu mẫu tùy chỉnh!", "#16a34a");
        }
      });
    });
  }

  // Render danh sách Preset Suggestions
  function renderPresetTemplatesList() {
    if (!presetsList) return;
    presetsList.innerHTML = PRESET_TEMPLATES.map((p, idx) => {
      return `
        <div style="background:white; border:1px solid #fde68a; border-radius:4px; padding:4px 6px; display:flex; justify-content:space-between; align-items:center; gap:6px;">
          <div style="flex:1; min-width:0;">
            <div style="font-size:10px; font-weight:bold; color:#b45309;">${escapeHtml(p.title)}</div>
            <div style="font-size:10px; color:#475569; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${escapeHtml(p.text)}</div>
          </div>
          <button type="button" class="btn-add-preset-item" data-index="${idx}" style="padding:2px 6px; font-size:10px; background:#10b981; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold; white-space:nowrap;">+ Thêm</button>
        </div>
      `;
    }).join("");

    presetsList.querySelectorAll(".btn-add-preset-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        const preset = PRESET_TEMPLATES[idx];
        if (preset && !customTemplates.includes(preset.text)) {
          customTemplates.push(preset.text);
          saveCustomTemplatesToStorage();
          showActionFeedback(`✓ Đã thêm mẫu: "${preset.title}"`, "#16a34a");
        } else {
          showActionFeedback("Mẫu này đã có trong danh sách!", "#d97706");
        }
      });
    });
  }

  // =========================================================================
  // 7. ĐIỀN CÂU TRẢ LỜI VÀO SHOPEE CHAT
  // =========================================================================
  async function fillToShopeeChat(autoSend = false, explicitText = null) {
    const text = explicitText !== null ? String(explicitText).trim() : (aiOutputTextarea ? aiOutputTextarea.value.trim() : "");
    if (!text) {
      alert("Chưa có nội dung câu trả lời để điền!");
      return;
    }

    const tab = await findShopeeWebchatTab();
    if (!tab) {
      alert("Không tìm thấy tab Shopee Webchat đang mở để điền tin nhắn!");
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      action: "FILL_SHOPEE_CHAT_INPUT",
      text: text,
      autoSend: !!autoSend
    }, async (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: fillShopeeChatInPageDirect,
            args: [text, autoSend]
          });
          if (results && results[0] && results[0].result?.ok) {
            showActionFeedback(autoSend ? "⚡ Đã điền và GỬI tin nhắn thành công!" : "📝 Đã điền vào ô chat Shopee!", "#16a34a");
          } else {
            showActionFeedback("⚠️ Không thể điền vào ô chat", "#dc2626");
          }
        } catch (e) {
          showActionFeedback(`❌ Lỗi: ${e.message}`, "#dc2626");
        }
      } else if (res && res.ok) {
        showActionFeedback(autoSend ? "⚡ Đã điền và GỬI tin nhắn thành công!" : "📝 Đã điền vào ô chat Shopee!", "#16a34a");
      }
    });
  }

  // 8. Copy câu trả lời
  function copyAiReply() {
    const text = aiOutputTextarea ? aiOutputTextarea.value.trim() : "";
    if (!text) {
      alert("Chưa có nội dung câu trả lời để copy!");
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      showActionFeedback("✓ Đã copy vào bộ nhớ tạm!", "#16a34a");
    });
  }

  // 9. Hiển thị thông báo phản hồi
  function showActionFeedback(msg, color = "#16a34a") {
    if (!actionFeedback) return;
    actionFeedback.textContent = msg;
    actionFeedback.style.color = color;
    actionFeedback.style.display = "block";
    setTimeout(() => {
      actionFeedback.textContent = "";
    }, 3500);
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

  // Quét & mở webchat
  if (btnScanChat) {
    btnScanChat.addEventListener("click", scanShopeeChatData);
  }

  if (btnOpenWebchat) {
    btnOpenWebchat.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://banhang.shopee.vn/new-webchat/conversations" });
    });
  }

  // Chọn nhiều câu hỏi của khách
  if (btnSelectAllCustomer) {
    btnSelectAllCustomer.addEventListener("click", () => {
      if (!currentChatData?.messages) return;
      selectedCustomerIndices.clear();
      currentChatData.messages.forEach((msg, idx) => {
        if (msg.sender === "customer" && msg.text) {
          selectedCustomerIndices.add(idx);
        }
      });
      updateSelectedCustomerQuestions();
    });
  }

  if (btnSelectLatestCustomer) {
    btnSelectLatestCustomer.addEventListener("click", () => {
      if (!currentChatData?.messages) return;
      selectedCustomerIndices.clear();
      let lastCustIdx = -1;
      currentChatData.messages.forEach((msg, idx) => {
        if (msg.sender === "customer" && msg.text) {
          lastCustIdx = idx;
        }
      });
      if (lastCustIdx !== -1) {
        selectedCustomerIndices.add(lastCustIdx);
      }
      updateSelectedCustomerQuestions();
    });
  }

  if (btnClearSelection) {
    btnClearSelection.addEventListener("click", () => {
      selectedCustomerIndices.clear();
      updateSelectedCustomerQuestions();
    });
  }

  if (btnClearQuestionInput) {
    btnClearQuestionInput.addEventListener("click", () => {
      selectedCustomerIndices.clear();
      if (inputCustomerQuestion) inputCustomerQuestion.value = "";
      updateSelectedCustomerQuestions();
    });
  }

  // Quản lý mẫu câu trả lời
  if (btnRefreshTemplates) {
    btnRefreshTemplates.addEventListener("click", () => {
      loadCaiDatChatTemplates(true);
    });
  }

  if (searchTemplateInput) {
    searchTemplateInput.addEventListener("input", renderChatTemplates);
  }

  if (btnToggleAddTemplate) {
    btnToggleAddTemplate.addEventListener("click", () => {
      if (addTemplatePanel) {
        const isHidden = addTemplatePanel.style.display === "none";
        addTemplatePanel.style.display = isHidden ? "block" : "none";
        if (isHidden && newTemplateInput) {
          newTemplateInput.focus();
        }
      }
    });
  }

  if (btnCancelAddTemplate) {
    btnCancelAddTemplate.addEventListener("click", () => {
      if (addTemplatePanel) addTemplatePanel.style.display = "none";
      if (newTemplateInput) newTemplateInput.value = "";
    });
  }

  if (btnSaveNewTemplate) {
    btnSaveNewTemplate.addEventListener("click", () => {
      const text = newTemplateInput ? newTemplateInput.value.trim() : "";
      if (!text) {
        alert("Vui lòng nhập nội dung câu mẫu trước khi lưu!");
        return;
      }
      if (customTemplates.includes(text)) {
        alert("Câu mẫu này đã có trong danh sách!");
        return;
      }
      customTemplates.unshift(text);
      saveCustomTemplatesToStorage();
      if (newTemplateInput) newTemplateInput.value = "";
      if (addTemplatePanel) addTemplatePanel.style.display = "none";
      showActionFeedback("✓ Đã lưu câu mẫu mới thành công!", "#16a34a");
    });
  }

  if (btnTogglePresets) {
    btnTogglePresets.addEventListener("click", () => {
      if (presetsPanel) {
        const isHidden = presetsPanel.style.display === "none";
        presetsPanel.style.display = isHidden ? "block" : "none";
        if (isHidden) {
          renderPresetTemplatesList();
        }
      }
    });
  }

  if (btnClosePresets) {
    btnClosePresets.addEventListener("click", () => {
      if (presetsPanel) presetsPanel.style.display = "none";
    });
  }

  // Chọn phong cách AI
  if (styleButtons) {
    styleButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        styleButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedStyle = btn.getAttribute("data-style") || "tu_van";
      });
    });
  }

  // Sinh câu trả lời & Tác vụ
  if (btnGenerateAi) {
    btnGenerateAi.addEventListener("click", generateAiChatReply);
  }

  if (btnCopyReply) {
    btnCopyReply.addEventListener("click", copyAiReply);
  }

  if (btnFillToShopee) {
    btnFillToShopee.addEventListener("click", () => fillToShopeeChat(false));
  }

  if (btnFillAndSend) {
    btnFillAndSend.addEventListener("click", () => fillToShopeeChat(true));
  }

  // Khởi tạo
  loadCaiDatChatTemplates(false);

  // Tự động quét khi chuyển sang tab Chat AI
  document.querySelectorAll('.tab-btn[data-tab="tab-chat-ai"]').forEach(btn => {
    btn.addEventListener("click", () => {
      setTimeout(scanShopeeChatData, 200);
      loadCaiDatChatTemplates(false);
    });
  });

})();
