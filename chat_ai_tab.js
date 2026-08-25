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

  // Style mapping descriptions
  const STYLE_PROMPTS = {
    tu_van: "Tư vấn tận tình, thân thiện, giải đáp rõ ràng tính năng và công dụng sản phẩm, hướng dẫn chọn phân loại/số lượng và mời khách đặt hàng.",
    chot_don: "Trả lời ngắn gọn, dứt khoát, xác nhận hàng luôn có sẵn tại kho, sẵn sàng đóng gói giao hỏa tốc/nhanh trong ngày, hướng dẫn bấm Mua Ngay.",
    voucher: "Tư vấn giá tốt, nhắc nhở khách hàng lưu và áp thêm mã giảm giá/Voucher của Shop và mã Freeship của Shopee để được giá rẻ nhất.",
    bao_hanh: "Tư vấn lịch sự về chính sách cam kết chất lượng, bảo hành chính hãng, bao đổi trả 1-1 nếu có lỗi từ nhà sản xuất, tạo sự an tâm tuyệt đối."
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

      const prompt = `Bạn là nhân viên chăm sóc khách hàng và tư vấn bán hàng xuất sắc của Shop trên sàn thương mại điện tử Shopee Việt Nam.

THÔNG TIN SẢN PHẨM KHÁCH ĐANG TRAO ĐỔI:
- Tên sản phẩm: ${p.name || 'Sản phẩm tại Shop'}
- Giá bán hiện tại: ${p.price || 'Giá ưu đãi tốt'}
- Giá niêm yết: ${p.originalPrice || 'N/A'}
- Giảm giá / Khuyến mãi: ${p.discount || 'Đang khuyến mãi'}
- Tình trạng kho: ${p.stock || 'Còn hàng sẵn'}
- Lượt đã bán: ${p.sold || 'Nhiều khách tin dùng'}

${chatHistoryText ? `LỊCH SỬ TIN NHẮN VỚI KHÁCH:\n${chatHistoryText}\n` : ''}
CÂU HỎI MỚI NHẤT CỦA KHÁCH HÀNG:
"${question || (p.name ? 'Sản phẩm này dùng thế nào, có tốt không shop?' : 'Shop tư vấn giúp mình')}"

${customNote ? `LƯU Ý RIÊNG TỪ CHỦ SHOP:\n"${customNote}"\n` : ''}

YÊU CẦU TRẢ LỜI:
- Phong cách tư vấn: ${styleInstruction}
- Giọng điệu thân thiện, nhiệt tình, lịch sự, xưng hô Shop - Bạn/Anh/Chị chuẩn văn hóa mua sắm Shopee Việt Nam.
- Trả lời đúng trọng tâm câu hỏi của khách hàng, dựa vào thông tin sản phẩm và ngữ cảnh ở trên.
- Khéo léo hướng dẫn thao tác đặt hàng (ví dụ: cách chọn phân loại màu/size, cách tăng số lượng lên 2-3 chiếc trong giỏ hàng, áp mã Freeship/Voucher Shopee).
- Tuyệt đối KHÔNG chứa các ký tự định dạng markdown như **, *, #, không chứa dấu ngoặc kép bọc cả câu. Viết tự nhiên như một tin nhắn chat thật giữa người với người. Chỉ trả về nội dung câu trả lời.`;

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

  // 6. Điền câu trả lời vào Shopee Chat
  async function fillToShopeeChat(autoSend = false) {
    const text = aiOutputTextarea ? aiOutputTextarea.value.trim() : "";
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

  // 7. Copy câu trả lời
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

  // 8. Hiển thị thông báo phản hồi
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

  // Tự động quét khi người dùng chuyển sang tab Chat AI
  document.querySelectorAll('.tab-btn[data-tab="tab-chat-ai"]').forEach(btn => {
    btn.addEventListener("click", () => {
      setTimeout(scanShopeeChatData, 200);
    });
  });

})();
