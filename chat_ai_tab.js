// =========================================================================
// CHAT AI TAB - TỰ ĐỘNG LẤY THÔNG TIN SHOPEE WEBCHAT & TƯ VẤN KHÁCH HÀNG BẰNG AI
// =========================================================================

(function () {
  let currentChatData = null;
  let activeWebchatTabId = null;

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

  // Chat History & Question Elements
  const chatHistoryContainer = document.getElementById("chat-ai-history-list");
  const inputCustomerQuestion = document.getElementById("chat-ai-customer-question");
  const inputCustomNote = document.getElementById("chat-ai-custom-note");

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

  // Quick Templates Elements (Cột H sheet CAI_DAT)
  const templatesContainer = document.getElementById("chat-ai-templates-list");
  const searchTemplateInput = document.getElementById("chat-ai-search-template");
  const btnRefreshTemplates = document.getElementById("chat-ai-btn-refresh-templates");
  let chatTemplates = [];

  // Style mapping descriptions (Đơn giản, súc tích)
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

        // Ưu tiên 1: Tab đang active có link webchat hoặc Shopee
        const activeTab = allTabs.find(t => t.active && t.url && (t.url.includes("webchat") || t.url.includes("banhang.shopee.vn")));
        if (activeTab) return resolve(activeTab);

        // Ưu tiên 2: Bất kỳ tab nào có link new-webchat hoặc webchat
        const webchatTab = allTabs.find(t => t.url && (t.url.includes("new-webchat") || t.url.includes("webchat")));
        if (webchatTab) return resolve(webchatTab);

        // Ưu tiên 3: Tab banhang.shopee.vn bất kỳ
        const shopeeTab = allTabs.find(t => t.url && t.url.includes("banhang.shopee.vn"));
        if (shopeeTab) return resolve(shopeeTab);

        resolve(null);
      });
    });
  }

  // Hàm chạy trực tiếp trong trang Shopee (dùng làm fallback qua scripting.executeScript)
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

    const msgElements = detailChat.querySelectorAll('#messagesContainer .DEwekPN7v2, #messagesContainer .RtO616EACf, [data-cy^="webchat-message"]');
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
    });

    return {
      ok: true,
      url: window.location.href,
      product: productInfo,
      messages: messages.slice(-15),
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
      // Cách 1: Gửi message tới content script
      let response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "GET_SHOPEE_CHAT_DATA" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(res);
          }
        });
      });

      // Cách 2 (Fallback tự động): Nếu content script chưa kết nối (do chưa F5 tab), chạy trực tiếp qua scripting
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

        // Tìm thêm thông tin trong Sheet
        lookupProductInSheet(p.name);
      } else {
        productSection.style.display = "none";
      }
    }

    // B. Câu hỏi của khách hàng
    if (inputCustomerQuestion) {
      if (data.lastCustomerQuestion) {
        inputCustomerQuestion.value = data.lastCustomerQuestion;
      }
    }

    // C. Lịch sử tin nhắn
    if (chatHistoryContainer) {
      chatHistoryContainer.innerHTML = "";
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => {
          const item = document.createElement("div");
          item.className = `chat-ai-bubble ${msg.sender === "customer" ? "bubble-customer" : (msg.sender === "shop" ? "bubble-shop" : "bubble-system")}`;
          
          const senderLabel = msg.sender === "customer" ? "👤 Khách:" : (msg.sender === "shop" ? "🏪 Shop:" : "ℹ️ Hệ thống:");
          const autoBadge = msg.isAutoReply ? `<span class="chat-ai-auto-badge">Tự động</span>` : "";
          const timeBadge = msg.time ? `<span class="chat-ai-time-badge">${msg.time}</span>` : "";

          item.innerHTML = `
            <div class="chat-ai-bubble-header">
              <span class="chat-ai-sender-name">${senderLabel}</span>
              ${autoBadge}
              ${timeBadge}
            </div>
            <div class="chat-ai-bubble-text">${escapeHtml(msg.text)}</div>
          `;

          // Bấm vào tin nhắn khách để chọn làm câu hỏi cần trả lời
          if (msg.sender === "customer" && msg.text) {
            item.title = "Bấm để chọn câu hỏi này";
            item.style.cursor = "pointer";
            item.onclick = () => {
              if (inputCustomerQuestion) inputCustomerQuestion.value = msg.text;
            };
          }

          chatHistoryContainer.appendChild(item);
        });

        chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
      } else {
        chatHistoryContainer.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 10px; font-size: 12px;">Chưa có tin nhắn nào trong cuộc trò chuyện</div>`;
      }
    }
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

      // Tìm trong spCache
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

      // Tìm Giá Min trong dsCache
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

  // 5. Gọi Gemini API để sinh câu trả lời tư vấn
  async function generateAiChatReply() {
    const question = inputCustomerQuestion ? inputCustomerQuestion.value.trim() : "";
    if (!question && (!currentChatData || !currentChatData.product?.name)) {
      alert("Vui lòng nhập câu hỏi của khách hoặc chọn cuộc trò chuyện trên Shopee Webchat trước!");
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

      if (!apiKey) {
        alert("Chưa có API Key Gemini! Vui lòng lưu API Key ở Tab Cài đặt (ô cai_dat!E2) trước.");
        if (btnGenerateAi) {
          btnGenerateAi.disabled = false;
          btnGenerateAi.innerHTML = `✨ AI Sinh Câu Trả Lời`;
        }
        return;
      }

      const p = currentChatData?.product || {};
      const customNote = inputCustomNote ? inputCustomNote.value.trim() : "";
      const styleInstruction = STYLE_PROMPTS[selectedStyle] || STYLE_PROMPTS.tu_van;

      let chatHistoryText = "";
      if (currentChatData?.messages && currentChatData.messages.length > 0) {
        chatHistoryText = currentChatData.messages.map(m => `${m.sender === 'customer' ? 'Khách' : 'Shop'}: ${m.text}`).join('\n');
      }

      const prompt = `Bạn là nhân viên hỗ trợ khách hàng của Shop trên Shopee. Hãy trả lời tin nhắn của khách hàng.

THÔNG TIN SẢN PHẨM:
- Tên: ${p.name || 'Sản phẩm của Shop'}
- Giá: ${p.price || ''}
- Tình trạng: ${p.stock || 'Sẵn hàng'}

${chatHistoryText ? `LỊCH SỬ CHAT GẦN ĐÂY:\n${chatHistoryText}\n` : ''}
CÂU HỎI / TIN NHẮN MỚI NHẤT CỦA KHÁCH:
"${question || (p.name ? 'Sản phẩm này dùng thế nào shop?' : 'Shop tư vấn giúp mình')}"

${customNote ? `GHI CHÚ THÊM CỦA SHOP: "${customNote}"\n` : ''}

QUY TẮC BẮT BUỘC TRẢ LỜI:
1. ĐƠN GIẢN, NGẮN GỌN (chỉ 1 - 3 câu).
2. TẬP TRUNG THẲNG VÀO CÂU HỎI VÀ NGỮ CẢNH CỦA KHÁCH, giải đáp trực tiếp, không nói vòng vo, không văn mẫu dài dòng.
3. Yêu cầu phong cách: ${styleInstruction}
4. Xưng hô lịch sự, thân thiện tự nhiên (Dạ vâng ạ / Dạ anh/chị...).
5. Tuyệt đối KHÔNG dùng định dạng markdown như **, *, #, không dùng dấu ngoặc kép bọc câu. Chỉ trả về đúng nội dung tin nhắn gửi khách.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `Lỗi HTTP ${response.status}`);
      }

      let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
  // 6. MẪU TRẢ LỜI NHANH TỪ CỘT H (chat) SHEET CAI_DAT
  // =========================================================================
  async function loadCaiDatChatTemplates(forceRefresh = false) {
    if (!templatesContainer) return;

    if (!forceRefresh) {
      const storage = await new Promise(r => chrome.storage.local.get(["cai_dat_chat_templates"], r));
      if (storage.cai_dat_chat_templates && Array.isArray(storage.cai_dat_chat_templates) && storage.cai_dat_chat_templates.length > 0) {
        chatTemplates = storage.cai_dat_chat_templates;
        renderChatTemplates();
        return;
      }
    }

    templatesContainer.innerHTML = '<div style="text-align:center; color:#64748b; font-size:11px; padding:6px;">Đang tải mẫu từ sheet CAI_DAT (Cột H)...</div>';

    chrome.runtime.sendMessage({ type: "FETCH_CAI_DAT" }, (res) => {
      if (res && res.ok && res.values && res.values.length > 0) {
        const rows = res.values;
        const headers = rows[0].map(h => String(h || "").trim().toLowerCase());

        // Tìm cột chat / chat_mau / mẫu chat hoặc mặc định Cột H (index 7)
        let chatColIdx = headers.findIndex(h => h === "chat" || h === "chat_mau" || h.includes("chat") || h.includes("trả lời nhanh") || h.includes("mẫu tin") || h.includes("tin nhắn"));
        if (chatColIdx === -1) chatColIdx = 7; // Cột H (index 7: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7)

        const extracted = [];
        for (let i = 1; i < rows.length; i++) {
          const val = String(rows[i][chatColIdx] || "").trim();
          if (val) {
            extracted.push(val);
          }
        }

        chatTemplates = extracted;
        chrome.storage.local.set({ cai_dat_chat_templates: chatTemplates });
        renderChatTemplates();
      } else {
        templatesContainer.innerHTML = '<div style="text-align:center; color:#ef4444; font-size:11px; padding:6px;">Không thể tải mẫu từ sheet CAI_DAT. Hãy kiểm tra kết nối Google Sheet!</div>';
      }
    });
  }

  function renderChatTemplates() {
    if (!templatesContainer) return;

    const query = searchTemplateInput ? searchTemplateInput.value.trim().toLowerCase() : "";
    let filtered = chatTemplates;
    if (query) {
      filtered = chatTemplates.filter(t => t.toLowerCase().includes(query));
    }

    if (!filtered || filtered.length === 0) {
      templatesContainer.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:11px; padding:6px;">${query ? "Không tìm thấy mẫu phù hợp" : "Chưa có mẫu nào ở Cột H (chat) sheet CAI_DAT"}</div>`;
      return;
    }

    templatesContainer.innerHTML = filtered.map((tpl, idx) => {
      return `
        <div class="chat-template-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:5px; padding:5px 8px; display:flex; align-items:center; justify-content:space-between; gap:6px; transition:all 0.15s ease;">
          <div class="chat-template-text-click" data-index="${idx}" style="flex:1; min-width:0; font-size:11px; color:#1e293b; line-height:1.35; cursor:pointer; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;" title="Bấm để chọn vào ô trả lời">
            ${escapeHtml(tpl)}
          </div>
          <div style="display:flex; gap:3px; flex-shrink:0;">
            <button type="button" class="btn-use-template" data-index="${idx}" style="padding:3px 6px; font-size:10px; background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; border-radius:3px; cursor:pointer; font-weight:500;" title="Điền vào ô trả lời">📝 Chọn</button>
            <button type="button" class="btn-fill-template-shopee" data-index="${idx}" style="padding:3px 6px; font-size:10px; background:#2563eb; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:500;" title="Điền thẳng vào ô chat Shopee">💬 Điền</button>
            <button type="button" class="btn-send-template-shopee" data-index="${idx}" style="padding:3px 6px; font-size:10px; background:#ea580c; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;" title="Điền và gửi luôn cho khách">⚡ Gửi</button>
          </div>
        </div>
      `;
    }).join("");

    // Gán sự kiện cho các nút trong danh sách mẫu
    templatesContainer.querySelectorAll(".chat-template-text-click, .btn-use-template").forEach(el => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.getAttribute("data-index"), 10);
        const text = filtered[idx];
        if (text && aiOutputTextarea) {
          aiOutputTextarea.value = text;
          aiOutputTextarea.focus();
          showActionFeedback("✓ Đã chọn mẫu câu trả lời!", "#16a34a");
        }
      });
    });

    templatesContainer.querySelectorAll(".btn-fill-template-shopee").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        const text = filtered[idx];
        if (text) {
          fillToShopeeChat(false, text);
        }
      });
    });

    templatesContainer.querySelectorAll(".btn-send-template-shopee").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        const text = filtered[idx];
        if (text) {
          fillToShopeeChat(true, text);
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

    // Gửi qua message
    chrome.tabs.sendMessage(tab.id, {
      action: "FILL_SHOPEE_CHAT_INPUT",
      text: text,
      autoSend: !!autoSend
    }, async (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) {
        // Fallback qua executeScript
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
  if (btnScanChat) {
    btnScanChat.addEventListener("click", scanShopeeChatData);
  }

  if (btnOpenWebchat) {
    btnOpenWebchat.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://banhang.shopee.vn/new-webchat/conversations" });
    });
  }

  if (btnRefreshTemplates) {
    btnRefreshTemplates.addEventListener("click", () => {
      loadCaiDatChatTemplates(true);
    });
  }

  if (searchTemplateInput) {
    searchTemplateInput.addEventListener("input", renderChatTemplates);
  }

  if (styleButtons) {
    styleButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        styleButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedStyle = btn.getAttribute("data-style") || "tu_van";
      });
    });
  }

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

  // Khởi tạo tải mẫu tin nhắn trả lời nhanh từ sheet CAI_DAT
  loadCaiDatChatTemplates(false);

  // Tự động quét khi người dùng chuyển sang tab Chat AI
  document.querySelectorAll('.tab-btn[data-tab="tab-chat-ai"]').forEach(btn => {
    btn.addEventListener("click", () => {
      setTimeout(scanShopeeChatData, 200);
      loadCaiDatChatTemplates(false);
    });
  });

})();
