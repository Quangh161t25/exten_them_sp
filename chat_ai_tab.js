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
      // Ưu tiên 1: Tab đang active hiện tại
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url && (tabs[0].url.includes("webchat") || tabs[0].url.includes("banhang.shopee.vn"))) {
          return resolve(tabs[0]);
        }

        // Ưu tiên 2: Tìm tab Shopee Webchat bất kỳ đang mở trong Chrome
        chrome.tabs.query({ url: ["*://banhang.shopee.vn/*webchat*", "*://seller.shopee.vn/*webchat*", "*://banhang.shopee.vn/*"] }, (allTabs) => {
          if (allTabs && allTabs.length > 0) {
            return resolve(allTabs[0]);
          }
          resolve(null);
        });
      });
    });
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
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "GET_SHOPEE_CHAT_DATA" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { ok: false, error: "Không nhận được phản hồi" });
          }
        });
      });

      if (!response || !response.ok) {
        if (statusEl) {
          statusEl.innerHTML = `⚠️ Chưa lấy được dữ liệu. Bạn hãy mở đúng cuộc trò chuyện trên Webchat rồi bấm Quét lại nhé!`;
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

        // Cuộn xuống cuối danh sách tin nhắn
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

      // Xây dựng đoạn hội thoại gần nhất
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

    chrome.tabs.sendMessage(tab.id, {
      action: "FILL_SHOPEE_CHAT_INPUT",
      text: text,
      autoSend: !!autoSend
    }, (res) => {
      if (chrome.runtime.lastError) {
        showActionFeedback(`❌ Lỗi: ${chrome.runtime.lastError.message}`, "#dc2626");
      } else if (res && res.ok) {
        showActionFeedback(autoSend ? "⚡ Đã điền và GỬI tin nhắn thành công!" : "📝 Đã điền vào ô chat Shopee!", "#16a34a");
      } else {
        showActionFeedback(`⚠️ ${res?.error || "Không thể điền vào ô chat"}`, "#dc2626");
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
