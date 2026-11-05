// AutoIn (bản gộp từ extension TOPCARE – Đọc đơn hàng): phần chạy ngầm, nạp bằng importScripts từ extension/background.js.
// Tự động chạy nền ngay cả khi đóng Side Panel, báo động âm thanh + góc màn hình khi có đơn / khi lỗi,
// gửi thông báo vào Telegram, và tổng kết cuối ngày (17h chiều & 8h sáng).
// Bọc trong IIFE để tên biến/hàm không đụng với các phần khác của background chính.
// Side panel do extension chính quản lý (tab "AutoIn" nhúng extension/autoin/panel.html).

importScripts("autoin/xlsx.js", "autoin/sku.js", "../shared/order-sheet.js");

(() => {
const { variationSku, skuPair, fillSkusFromSheet } = self.AutoInSku;
const ICON_URL = chrome.runtime.getURL("extension/autoin/icon.png");

const DEFAULT_TELE_TOKEN = "7328548423:AAEaMToHm1IYWJ28_u8WrZ9fu8qO2QkbZ9Y";
const DEFAULT_TELE_CHAT = "-4209766497";

async function applyDefaults() {
  const existing = await chrome.storage.local.get(["tcdd-tele-token", "tcdd-tele-chat", "tcdd-tele-on", "tcdd-every", "tcdd-auto-open-wameli", "tcdd-wameli"]);
  const updates = {};
  if (!existing["tcdd-tele-token"]) updates["tcdd-tele-token"] = DEFAULT_TELE_TOKEN;
  if (!existing["tcdd-tele-chat"]) updates["tcdd-tele-chat"] = DEFAULT_TELE_CHAT;
  if (!existing["tcdd-tele-on"]) updates["tcdd-tele-on"] = "1";
  if (!existing["tcdd-every"]) updates["tcdd-every"] = "2"; // 120 giây = 2 phút
  if (existing["tcdd-auto-open-wameli"] === undefined) updates["tcdd-auto-open-wameli"] = "1";
  if (existing["tcdd-wameli"] === undefined) updates["tcdd-wameli"] = "1";
  if (existing["tcdd-skip-sunday"] === undefined) updates["tcdd-skip-sunday"] = "1";
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await applyDefaults();
  initAlarms();
  startTelegramPollingLoop();
});
chrome.runtime.onStartup.addListener(async () => {
  await applyDefaults();
  initAlarms();
  startTelegramPollingLoop();
});

// TỰ CẬP NHẬT 1 LẦN: bản extension đang chạy có thể được Chrome nạp từ manifest CŨ
// (chưa có "externally_connectable"), nên web đã deploy (Vercel/GitHub Pages...) không gọi được.
// Gặp trường hợp đó thì tự reload để Chrome đọc lại manifest mới — chỉ làm 1 lần cho mỗi version.
(async () => {
  try {
    const man = chrome.runtime.getManifest();
    const matches = (man && man.externally_connectable && man.externally_connectable.matches) || [];
    if (matches.length) return;                    // manifest đã mới -> không cần làm gì
    const KEY = "autoin-web-bridge-reload";
    const st = await chrome.storage.local.get([KEY]).catch(() => ({}));
    if (st && st[KEY] === man.version) return;     // đã thử reload cho version này rồi
    await chrome.storage.local.set({ [KEY]: man.version }).catch(() => {});
    chrome.runtime.reload();                       // Chrome đọc lại manifest.json từ đĩa
  } catch (_) { /* bỏ qua */ }
})();

// Danh sách API Shopee cho phép
const ALLOW = [
  "/api/v3/order/search_order_list_index",
  "/api/v3/order/get_order_list_card_list",
  "/api/v3/order/search_mass_shipment_index",
  "/api/v3/product/get_shop_warehouse/",
  "/api/v3/shipment/mass_ship/get_pickup_address_list",
  "/api/v3/general/get_shop_address",
  "/api/v3/shipment/mass_ship/get_pickup_time_slots",
  "/api/v3/shipment/batch_get_package_shipment_status",
  "/api/v3/shipment/batch_init_orders",
  "/api/v3/logistics/create_sd_jobs",
  "/api/v3/logistics/get_sd_job",
  "/api/v3/order/get_one_order",
  "/api/v3/logistics/download_sd_job_filelink",
];

// ---------- ÂM THANH & THÔNG BÁO GÓC MÀN HÌNH ----------
async function ensureOffscreen() {
  if (await chrome.offscreen?.hasDocument?.()) return;
  try {
    await chrome.offscreen.createDocument({
      url: "extension/autoin/offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Báo âm thanh khi có đơn mới và khi có lỗi",
    });
  } catch (e) {
    // Nếu document đã tồn tại thì bỏ qua
  }
}

async function playAudio(sound = "ting") {
  try {
    await ensureOffscreen();
    chrome.runtime.sendMessage({ type: "tcdd-play-sound", sound }).catch(() => {});
  } catch (e) {
    console.error("playAudio error:", e);
  }
}

async function notifyAndSound({ title, message, sound = "ting", isError = false, reportType = null }) {
  await playAudio(sound);
  try {
    // Đọc lại ô Mã gian mỗi lần gửi, tránh giữ tên cố định khi đổi gian.
    const store = await chrome.storage.local.get(["dhHoanTextValue", "maGian", "tcdd-shop-code"]);
    const shopCode = [store.dhHoanTextValue, store.maGian, store["tcdd-shop-code"]]
      .map(value => String(value || "").trim()).find(Boolean);
    const shopLabel = shopCode ? shopCode.toUpperCase() : "Chưa đặt mã gian";
    const notificationTitle = String(title || (isError ? "TOPCARE ❌ LỖI" : "TOPCARE · Đơn hàng"))
      .replace(/^TOPCARE(?=\s|$)/, () => shopLabel);
    const notifId = reportType ? `report-${reportType}-${Date.now()}` : `tcdd-${Date.now()}`;
    chrome.notifications.create(notifId, {
      type: "basic",
      iconUrl: ICON_URL,
      title: notificationTitle,
      message: message || "",
      priority: isError ? 2 : 1,
    });
  } catch (e) {
    console.error("Notification error:", e);
  }
}

// Bấm vào thông báo -> mở Side Panel và mở bảng tổng kết nếu là thông báo báo cáo
chrome.notifications.onClicked.addListener(async (notifId) => {
  // Chỉ xử lý thông báo của AutoIn, không đụng thông báo của các tab khác
  if (!notifId.startsWith("tcdd-") && !notifId.startsWith("report-")) return;
  try {
    const wins = await chrome.windows.getAll({ populate: false, windowTypes: ["normal"] });
    const win = wins.find((w) => w.focused) || wins[0];
    if (win && chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: win.id });
    }
    if (notifId.startsWith("report-")) {
      const type = notifId.includes("17h") ? "17h" : "8h";
      await chrome.storage.local.set({ tcdd_open_report: { type, time: Date.now() } });
      chrome.runtime.sendMessage({ type: "tcdd-open-report", reportType: type }).catch(() => {});
    }
  } catch (e) {
    console.error("Open sidepanel on notification click error:", e);
  }
});

// ---------- GỬI THÔNG BÁO VÀO TELEGRAM ----------
const teleEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function getTelegramConfig() {
  const cfg = await chrome.storage.local.get([
    "tcdd-tele-on",
    "tcdd-tele-token",
    "tcdd-tele-chat",
    "tcdd-tele-order",
    "tcdd-tele-error",
    "tcdd-tele-report",
    "tcdd-tele-wameli",
  ]);
  return {
    enabled: cfg["tcdd-tele-on"] !== "0", // Mặc định BẬT
    token: (cfg["tcdd-tele-token"] || DEFAULT_TELE_TOKEN).trim(),
    chatId: (cfg["tcdd-tele-chat"] || DEFAULT_TELE_CHAT).trim(),
    notifyOrder: cfg["tcdd-tele-order"] !== "0",
    notifyError: cfg["tcdd-tele-error"] !== "0",
    notifyReport: cfg["tcdd-tele-report"] !== "0",
    notifyWameli: cfg["tcdd-tele-wameli"] !== "0",
  };
}

async function sendTelegram(text, targetChatId = null, replyMarkup = null) {
  try {
    const cfg = await getTelegramConfig();
    const chatId = targetChatId || cfg.chatId;
    if (!cfg.enabled || !cfg.token || !chatId) return { ok: false, error: "Chưa cấu hình hoặc chưa bật gửi Telegram" };
    const url = `https://api.telegram.org/bot${cfg.token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.description || "Lỗi Telegram API");
    return { ok: true, message_id: j.result?.message_id };
  } catch (e) {
    console.error("sendTelegram error:", e);
    return { ok: false, error: e.message || String(e) };
  }
}

async function answerTelegramCallbackQuery(callbackQueryId, text = "", showAlert = false) {
  try {
    const cfg = await getTelegramConfig();
    if (!cfg.token) return;
    const url = `https://api.telegram.org/bot${cfg.token}/answerCallbackQuery`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
  } catch (e) {
    console.warn("answerTelegramCallbackQuery error:", e);
  }
}

// ---------- XỬ LÝ LỆNH TRA CỨU TỪ TELEGRAM (ĐƠN CHƯA ĐI) ----------
function normText(t) {
  return String(t || "")
    .replace(/@[a-zA-Z0-9_]+/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

const MENU_KEYBOARD = {
  keyboard: [
    [
      { text: "📦 Đơn chưa đi" },
      { text: "📊 Báo cáo ngày" }
    ],
    [
      { text: "💡 Hướng dẫn" }
    ]
  ],
  resize_keyboard: true,
  is_persistent: true
};

async function registerTelegramBotMenu() {
  try {
    const cfg = await getTelegramConfig();
    if (!cfg.enabled || !cfg.token) return;
    const url = `https://api.telegram.org/bot${cfg.token}/setMyCommands`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "donchuadi", description: "📦 Tra cứu đơn chưa đi & In Wameli" },
          { command: "baocao", description: "📊 Báo cáo vận hành trong ngày" },
          { command: "menu", description: "📱 Bàn phím nút bấm thao tác nhanh" },
          { command: "help", description: "💡 Hướng dẫn sử dụng trợ lý Topcare" }
        ]
      })
    });
  } catch (e) {
    console.warn("registerTelegramBotMenu error:", e);
  }
}

function isUnshippedOrderQuery(text) {
  if (!text) return false;
  const t = normText(text);
  if (t === "/donchuadi" || t === "/don_chua_di" || t === "/chuadi" || t === "/donhang" || t === "/don") return true;
  if (t.includes("don chua di") || t.includes("chua di") || t.includes("don chua giao") || t.includes("kiem tra don")) return true;
  return false;
}

function formatShortItems(items = []) {
  if (!items || !items.length) return "Chưa có thông tin SP";
  const first = items[0].replace(/\s+/g, " ").trim();
  const shortFirst = first.length > 45 ? first.slice(0, 43) + "..." : first;
  if (items.length > 1) {
    return `${shortFirst} <i>(+ ${items.length - 1} món khác)</i>`;
  }
  return shortFirst;
}

async function sendTelegramChunked(text, chatId = null, replyMarkup = null) {
  if (text.length <= 3800) {
    return await sendTelegram(text, chatId, replyMarkup);
  }
  const parts = text.split("\n\n");
  let currentChunk = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if ((currentChunk + "\n\n" + part).length > 3800) {
      if (currentChunk) await sendTelegram(currentChunk, chatId);
      currentChunk = part;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + part : part;
    }
  }
  if (currentChunk) {
    await sendTelegram(currentChunk, chatId, replyMarkup);
  }
  return { ok: true };
}

async function handleUnshippedOrdersQuery(chatId) {
  try {
    const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/*" });
    if (!tabs.length) {
      await sendTelegram(
        `⚠️ <b>Kênh Người Bán Shopee chưa mở</b>\n\n` +
        `Vui lòng mở trang Shopee (banhang.shopee.vn) trên máy tính để tiện ích đọc dữ liệu nhé!`,
        chatId
      );
      return;
    }

    await bgLog("🤖 Telegram yêu cầu tra cứu 'đơn chưa đi'...");

    // Lấy danh sách Chưa xử lý & Đã xử lý
    let choXuLyIdx = { list: [] }, daXuLyIdx = { list: [] };
    try {
      choXuLyIdx = await bgFetchIndex(1);
    } catch (e) {
      console.warn("Lỗi fetch đơn chưa xử lý:", e);
    }
    try {
      daXuLyIdx = await bgFetchIndex(2);
    } catch (e) {
      console.warn("Lỗi fetch đơn đã xử lý:", e);
    }

    const totalUnshipped = (choXuLyIdx.list?.length || 0) + (daXuLyIdx.list?.length || 0);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

    if (totalUnshipped === 0) {
      await sendTelegram(
        `🎉 <b>TẤT CẢ ĐƠN ĐÃ ĐI!</b>\n\n` +
        `✅ Không còn đơn nào tồn kho.\n` +
        `⏰ Cập nhật lúc: ${timeStr}`,
        chatId
      );
      return;
    }

    // Lấy chi tiết thẻ đơn (tối đa 15 đơn mỗi loại để nhanh và gọn)
    const choXuLyCards = (await bgFetchCards(choXuLyIdx.list.slice(0, 15))).map(toRow);
    const daXuLyCards = (await bgFetchCards(daXuLyIdx.list.slice(0, 15))).map(toRow);

    const store = await chrome.storage.local.get(["tcdd-shop-code", "maGian", "dhHoanTextValue"]);
    const shopCode = String(store["tcdd-shop-code"] || store.maGian || store.dhHoanTextValue || "").trim().toUpperCase();
    await resolveTelegramSkus([...choXuLyCards, ...daXuLyCards], shopCode);
    const msg = formatUnshippedTelegram(choXuLyCards, daXuLyCards, shopCode, choXuLyIdx.list.length, daXuLyIdx.list.length);

    // Tạo các nút Inline Keyboard
    const inlineButtons = [];

    // Nút in tất cả ở đầu
    inlineButtons.push([
      { text: `⚡ IN & NẠP TẤT CẢ LÊN WAMELI (${totalUnshipped} đơn)`, callback_data: "wml_all" }
    ]);

    // Tạo nút cho từng đơn (tối đa 15 đơn)
    const combinedOrders = [
      ...choXuLyCards.map((r, i) => ({ ...r, label: `In đơn ${i + 1}` })),
      ...daXuLyCards.map((r, i) => ({ ...r, label: `In đơn ${choXuLyCards.length + i + 1}` }))
    ];

    combinedOrders.slice(0, 15).forEach((r, idx) => {
      inlineButtons.push([
        {
          text: `🖨️ In đơn ${idx + 1}: ${r.order_sn}`,
          callback_data: `wml:${r.order_sn}`
        }
      ]);
    });

    const replyMarkup = { inline_keyboard: inlineButtons };

    await sendTelegramChunked(msg, chatId, replyMarkup);
    await bgLog(`✅ Đã gửi danh sách ${totalUnshipped} đơn chưa đi kèm nút in về Telegram`);
  } catch (err) {
    console.error("handleUnshippedOrdersQuery error:", err);
    await sendTelegram(`❌ Lỗi khi đọc dữ liệu đơn từ Shopee: ${teleEsc(err.message)}`, chatId);
  }
}

async function handlePrintSingleOrderWameliFromTelegram(targetSn, chatId) {
  try {
    const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/*" });
    if (!tabs.length) {
      await sendTelegram(`⚠️ Kênh Người Bán Shopee chưa mở trên máy tính, không thể in đơn <code>${teleEsc(targetSn)}</code>.`, chatId);
      return;
    }

    for (let w = 0; w < 10 && isAutoBusy; w++) {
      await new Promise((r) => setTimeout(r, 1000));
    }

    let targetRow = null;
    let orderStatus = 0; // 1 = chưa xử lý, 2 = đã xử lý
    let shop = { shop_id: 0, region_id: "VN" };

    // 1. Tìm trong Chưa xử lý
    try {
      const idx1 = await bgFetchIndex(1);
      if (idx1.list.length) {
        shop = { shop_id: idx1.list[0].shop_id, region_id: idx1.list[0].region_id || "VN" };
        const cards1 = await bgFetchCards(idx1.list);
        const rows1 = cards1.map(toRow);
        targetRow = rows1.find((r) => r.order_sn === targetSn);
        if (targetRow) orderStatus = 1;
      }
    } catch (e) {
      console.warn("Lỗi tìm đơn chưa xử lý:", e);
    }

    // 2. Tìm trong Đã xử lý nếu chưa có
    if (!targetRow) {
      try {
        const idx2 = await bgFetchIndex(2);
        if (idx2.list.length) {
          if (!shop.shop_id) shop = { shop_id: idx2.list[0].shop_id, region_id: idx2.list[0].region_id || "VN" };
          const cards2 = await bgFetchCards(idx2.list);
          const rows2 = cards2.map(toRow);
          targetRow = rows2.find((r) => r.order_sn === targetSn);
          if (targetRow) orderStatus = 2;
        }
      } catch (e) {
        console.warn("Lỗi tìm đơn đã xử lý:", e);
      }
    }

    if (!targetRow) {
      await sendTelegram(`⚠️ Không tìm thấy đơn <code>${teleEsc(targetSn)}</code> trong danh sách Chưa xử lý hoặc Đã xử lý (có thể đơn đã giao cho bưu tá hoặc bị huỷ).`, chatId);
      return;
    }

    // Nếu đơn ở Chưa xử lý -> cần xác nhận giao hàng trước trên Shopee
    if (orderStatus === 1) {
      await bgLog(`⚡ [Telegram] Xác nhận giao hàng đơn ${targetSn} trên Shopee...`);
      const w = await bgApi("/api/v3/product/get_shop_warehouse/", null, "GET");
      const whs = (w.warehouse_list || w.list || w || []).map((x) => ({ id: x.location_id, name: x.warehouse_name || x.name, holiday: !!x.in_holiday_mode }));
      const a = await bgApi("/api/v3/shipment/mass_ship/get_pickup_address_list", {});
      const addrs = a.list || a.address_list || a || [];
      const cfg = await chrome.storage.local.get(["tcdd-addr"]);
      let pickId = +(cfg["tcdd-addr"] || 0);
      if (!addrs.some((x) => x.address_id === pickId && x.can_pickup_code >= 0)) {
        const def = await bgApi("/api/v3/general/get_shop_address", null, "GET");
        pickId = def.pickup_address_id || addrs.find((x) => x.can_pickup_code >= 0)?.address_id || 0;
      }
      const addrOf = () => addrs.find((ad) => ad.address_id === pickId) || addrs[0];
      const ad = addrOf();

      await bgApi("/api/v3/shipment/batch_init_orders", {
        group_list: [{
          primary_package_number: targetRow.package_number,
          pickup: { address_id: ad.address_id },
        }],
        channel_id: targetRow.channel_id,
        ...shop,
      });

      // Chờ mã vận đơn
      let tn = targetRow.tracking || "";
      for (let i = 0; i < 8 && !tn; i++) {
        await new Promise((res) => setTimeout(res, 2000));
        const st = await bgApi("/api/v3/shipment/batch_get_package_shipment_status", {
          group_list: [{ primary_package_number: targetRow.package_number, package_list: [{ order_id: targetRow.order_id, package_number: targetRow.package_number }] }],
          channel_id: targetRow.channel_id,
          ...shop,
        });
        const x = (st.group_status_list || []).find((g) => g.primary_package_number === targetRow.package_number);
        if (x?.third_party_tn) tn = x.third_party_tn;
      }
      targetRow.tracking = tn;
    }

    // Tiến hành in và nạp đơn lên Wameli
    await bgLog(`🖨 [Telegram] Đang tạo phiếu in & nạp Wameli đơn ${targetSn}...`);
    const res = await processProcessedOrders([targetRow], { source: "Telegram Nút Bấm" });

    if (res.ok) {
      await sendTelegram(
        `🎉 <b>ĐÃ IN & NẠP WAMELI THÀNH CÔNG!</b>\n\n` +
        `• Mã đơn: <code>${teleEsc(targetSn)}</code>\n` +
        `• ĐVVC: <b>${teleEsc(targetRow.carrier || "Shopee")}</b>\n` +
        `• Mã vận đơn: <code>${teleEsc(targetRow.tracking || "Đã tạo phiếu")}</code>\n` +
        `• Trạng thái: Đã tải file PDF/Excel và nạp lên hệ thống Wameli thành công!\n` +
        `⏰ Lúc: ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
        chatId
      );
    } else {
      await sendTelegram(`❌ Lỗi khi in & nạp đơn <code>${teleEsc(targetSn)}</code>: ${teleEsc(res.error || "Không rõ nguyên nhân")}`, chatId);
    }
  } catch (err) {
    console.error("handlePrintSingleOrderWameliFromTelegram error:", err);
    await sendTelegram(`❌ Lỗi khi xử lý đơn <code>${teleEsc(targetSn)}</code>: ${teleEsc(err.message)}`, chatId);
  }
}

async function handlePrintAllWameliFromTelegram(chatId) {
  try {
    const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/*" });
    if (!tabs.length) {
      await sendTelegram("⚠️ Kênh Người Bán Shopee chưa mở trên máy tính, không thể in toàn bộ đơn.", chatId);
      return;
    }

    await sendTelegram("⏳ Đang bắt đầu in và nạp toàn bộ đơn lên Wameli...", chatId);
    await runAutoBackground();
    await processProcessedOrders(null, { source: "Telegram In Tất Cả" });
    await sendTelegram("🎉 <b>HOÀN TẤT:</b> Đã xử lý in và nạp toàn bộ đơn lên Wameli!", chatId);
  } catch (err) {
    console.error("handlePrintAllWameliFromTelegram error:", err);
    await sendTelegram(`❌ Lỗi khi in toàn bộ đơn: ${teleEsc(err.message)}`, chatId);
  }
}

async function handleTelegramCallbackQuery(cq) {
  const cfg = await getTelegramConfig();
  const cqId = cq.id;
  const data = cq.data || "";
  const chatId = cq.message?.chat?.id;

  // Kiểm tra quyền nhận lệnh
  if (cfg.chatId) {
    const cfgIdStr = String(cfg.chatId).trim();
    const chatIdStr = String(chatId || "").trim();
    const fromIdStr = String(cq.from?.id || "").trim();
    if (chatIdStr !== cfgIdStr && fromIdStr !== cfgIdStr) {
      await answerTelegramCallbackQuery(cqId, "⛔ Bạn không có quyền thực hiện thao tác này.", true);
      return;
    }
  }

  if (data === "wml_all") {
    await answerTelegramCallbackQuery(cqId, "⏳ Đang bắt đầu in & nạp toàn bộ đơn lên Wameli...", false);
    await handlePrintAllWameliFromTelegram(chatId);
  } else if (data.startsWith("wml:")) {
    const targetSn = data.slice(4).trim();
    await answerTelegramCallbackQuery(cqId, `⏳ Đang in & nạp đơn ${targetSn} lên Wameli...`, false);
    await handlePrintSingleOrderWameliFromTelegram(targetSn, chatId);
  } else {
    await answerTelegramCallbackQuery(cqId);
  }
}

async function sendTelegramDailySummary(chatId) {
  try {
    const stats = await getDayStats(todayStr());
    const now = new Date();
    const today = todayStr(now);
    const total = stats.total_orders || stats.confirmed.length;
    const printed = stats.printed.reduce((n, p) => n + (p.sns?.length || 1), 0);
    const errorCount = stats.errors.length;

    let reportText = `📊 <b>BÁO CÁO VẬN HÀNH TRONG NGÀY</b>\n` +
      `📅 Ngày: <b>${today}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 Tổng đơn tiếp nhận: <b>${total} đơn</b>\n` +
      `🖨 Đã in phiếu: <b>${printed} đơn</b>\n` +
      `☁️ Lô nạp Wameli: <b>${stats.wameli.length} lượt</b>\n`;
    for (const w of stats.wameli) {
      reportText += `   • Khung ${teleEsc(w.slot)} (${teleEsc(w.warehouse || "HN")}): ${w.count || w.sns?.length || 0} đơn (${teleEsc(w.base)})\n`;
    }
    if (errorCount > 0) {
      reportText += `❌ Đơn lỗi: <b>${errorCount} đơn</b>\n`;
      for (const e of stats.errors) {
        reportText += `   • <code>${teleEsc(e.order_sn)}</code>: [${teleEsc(e.stage)}] ${teleEsc(e.message)}\n`;
      }
    } else {
      reportText += `✅ Đơn lỗi: <b>0 đơn</b> (Vận hành trơn tru)\n`;
    }
    reportText += `━━━━━━━━━━━━━━━━━━━━\n` +
      `⏰ Trả lời tự động lúc ${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
    await sendTelegram(reportText, chatId);
  } catch (e) {
    await sendTelegram(`❌ Lỗi tạo báo cáo: ${teleEsc(e.message)}`, chatId);
  }
}

let isPollingTelegram = false;
let teleLastUpdateId = 0;

async function pollTelegramUpdates() {
  const cfg = await getTelegramConfig();
  if (!cfg.enabled || !cfg.token) return;
  if (isPollingTelegram) return;

  isPollingTelegram = true;
  try {
    if (!teleLastUpdateId) {
      const store = await chrome.storage.local.get(["tcdd-tele-last-update-id"]);
      teleLastUpdateId = store["tcdd-tele-last-update-id"] || 0;
    }

    const url = `https://api.telegram.org/bot${cfg.token}/getUpdates?offset=${teleLastUpdateId}&limit=10&timeout=2`;
    const res = await fetch(url);
    const j = await res.json();

    if (j.ok && Array.isArray(j.result)) {
      if (teleLastUpdateId === 0) {
        if (j.result.length > 0) {
          teleLastUpdateId = Math.max(...j.result.map((u) => u.update_id)) + 1;
          await chrome.storage.local.set({ "tcdd-tele-last-update-id": teleLastUpdateId });
        } else {
          teleLastUpdateId = 1;
        }
        isPollingTelegram = false;
        return;
      }

      for (const update of j.result) {
        if (update.update_id >= teleLastUpdateId) {
          teleLastUpdateId = update.update_id + 1;
          await chrome.storage.local.set({ "tcdd-tele-last-update-id": teleLastUpdateId });
        }

        // 1. Nhận sự kiện bấm nút Inline Button
        if (update.callback_query) {
          await handleTelegramCallbackQuery(update.callback_query);
          continue;
        }

        // 2. Nhận tin nhắn văn bản
        const msg = update.message || update.channel_post;
        if (!msg || !msg.text) continue;

        const incomingText = msg.text.trim();
        const incomingChatId = msg.chat?.id;

        // Kiểm tra quyền nhận lệnh
        if (cfg.chatId) {
          const cfgIdStr = String(cfg.chatId).trim();
          const chatIdStr = String(incomingChatId || "").trim();
          const fromIdStr = String(msg.from?.id || "").trim();
          if (chatIdStr !== cfgIdStr && fromIdStr !== cfgIdStr) continue;
        }

        const nText = normText(incomingText);
        if (isUnshippedOrderQuery(incomingText)) {
          await handleUnshippedOrdersQuery(incomingChatId);
        } else if (nText.includes("bao cao") || /^\/?(bao[ _]?cao|report)$/i.test(nText)) {
          await sendTelegramDailySummary(incomingChatId);
        } else if (incomingText === "/start" || incomingText === "/help" || incomingText === "/menu" || nText === "menu" || nText === "huong dan" || nText.includes("tro giup")) {
          await sendTelegram(
            `👋 <b>XIN CHÀO! TRỢ LÝ TỰ ĐỘNG TOPCARE ĐÃ SẴN SÀNG</b>\n\n` +
            `Bạn có thể bấm trực tiếp các nút menu bên dưới bàn phím hoặc gửi lệnh:\n\n` +
            `• <b>📦 Đơn chưa đi</b> (hoặc <code>/donchuadi</code>): Tra cứu toàn bộ đơn chưa giao cho bưu tá và có nút in trực tiếp lên Wameli.\n` +
            `• <b>📊 Báo cáo ngày</b> (hoặc <code>/baocao</code>): Xem tổng kết số đơn tiếp nhận, đã in & nạp Wameli trong ngày.\n` +
            `• <b>💡 Hướng dẫn</b> (hoặc <code>/help</code>): Mở lại menu bấm nhanh.\n\n` +
            `⏰ Tiện ích đang kết nối với Kênh Người Bán Shopee và sẵn sàng 24/7!`,
            incomingChatId,
            MENU_KEYBOARD
          );
        }
      }
    }
  } catch (err) {
    // Im lặng khi mạng chập chờn
  } finally {
    isPollingTelegram = false;
  }
}

let hasRegisteredTeleMenu = false;
function startTelegramPollingLoop() {
  if (!hasRegisteredTeleMenu) {
    hasRegisteredTeleMenu = true;
    registerTelegramBotMenu().catch(() => {});
  }
  if (globalThis._telePollInterval) clearInterval(globalThis._telePollInterval);
  globalThis._telePollInterval = setInterval(async () => {
    await pollTelegramUpdates();
  }, 4000);
}

// ---------- DỮ LIỆU TỔNG KẾT NGÀY (DAILY STATS) ----------
const p2 = (n) => String(n).padStart(2, "0");
function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

async function getStatsMap() {
  const data = await chrome.storage.local.get("tcdd_daily_stats");
  return data.tcdd_daily_stats || {};
}

async function getDayStats(date = todayStr()) {
  const map = await getStatsMap();
  return map[date] || {
    date,
    total_orders: 0,
    confirmed: [],
    printed: [],
    wameli: [],
    errors: [],
  };
}

async function updateDayStats(date, updater) {
  const map = await getStatsMap();
  const day = map[date] || {
    date,
    total_orders: 0,
    confirmed: [],
    printed: [],
    wameli: [],
    errors: [],
  };
  updater(day);
  map[date] = day;

  // Giữ tối đa 30 ngày gần nhất
  const keys = Object.keys(map).sort();
  if (keys.length > 30) {
    for (let i = 0; i < keys.length - 30; i++) delete map[keys[i]];
  }
  await chrome.storage.local.set({ tcdd_daily_stats: map });
  chrome.runtime.sendMessage({ type: "tcdd-stats-updated", date }).catch(() => {});
}

async function resolveTelegramSkus(fresh, shopCode) {
  for (const r of fresh) {
    if (!(r.itemRows || []).some((it) => !it.modelSku) || !r.order_id) continue;
    try {
      const detail = await bgApi("/api/v3/order/get_one_order", null, "GET", `&order_id=${encodeURIComponent(r.order_id)}`);
      for (const it of r.itemRows) {
        if (it.modelSku) continue;
        const matches = (detail.order_items || []).filter((d) => {
          const id = d.item_id || d.itemid || d.product?.item_id;
          const modelId = d.model_id || d.modelid || d.item_model?.model_id;
          return (it.itemId && it.modelId && String(id) === String(it.itemId) && String(modelId) === String(it.modelId))
            || skuPair(d.product?.name || d.item_name || d.name, d.item_model?.name || d.model_name || "") === skuPair(it.name, it.model);
        });
        const skus = new Set(matches.map((d) => String(d.item_model?.sku || d.model_sku || d.variation_sku || d.sku || "").trim()).filter(Boolean));
        if (skus.size === 1) it.modelSku = [...skus][0];
      }
    } catch (e) { console.warn("Không đọc được SKU chi tiết đơn", r.order_sn, e.message); }
  }
  if (!fresh.some((r) => r.itemRows.some((it) => !it.modelSku))) return;
  try {
    const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
    const values = await fetchSheetValues("SP_SHOPEE!A:AZ", token, 30000, sheetId);
    fillSkusFromSheet(fresh, values || [], shopCode);
  } catch (e) { bgLog(`Không tra được SKU từ SP_SHOPEE: ${teleEsc(e.message)}`); }
}

function formatTelegramOrderLines(r) {
  const products = (r.itemRows || []).map((it) => `${teleEsc(it.name)}\nSKU phân loại: <code>${teleEsc(it.modelSku || "Chưa tìm thấy SKU")}</code>`).join("\n");
  return `Mã đơn: <code>${teleEsc(r.order_sn)}</code>\n${products || "Chưa có thông tin sản phẩm"}`;
}

function formatOrderTelegram(r, shopCode) {
  return `📦 <b>Gian ${teleEsc(shopCode || "Chưa đặt mã gian")}</b>\n\n${formatTelegramOrderLines(r)}`;
}

function formatUnshippedTelegram(pending, processed, shopCode, pendingCount, processedCount) {
  const blocks = [`📦 <b>Gian ${teleEsc(shopCode || "Chưa đặt mã gian")}</b>`];
  for (const [list, count, label] of [[pending, pendingCount, "Chưa xử lý"], [processed, processedCount, "Chờ bưu tá lấy"]]) {
    if (!count) continue;
    blocks.push(`<b>${label}: ${count} đơn</b>`);
    blocks.push(...list.map(formatTelegramOrderLines));
    if (count > list.length) blocks.push(`<i>Còn ${count - list.length} đơn khác</i>`);
  }
  return blocks.join("\n\n");
}

async function recordConfirmed(r) {
  const now = new Date();
  const time = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
  await updateDayStats(todayStr(), (day) => {
    if (!day.confirmed.some((x) => x.order_sn === r.order_sn)) {
      day.confirmed.push({ order_sn: r.order_sn, carrier: r.carrier || "", order_id: r.order_id, time });
    }
  });

  // Bắn thông báo Telegram khi có đơn mới
  const teleCfg = await getTelegramConfig();
  if (teleCfg.enabled && teleCfg.notifyOrder) {
    const store = await chrome.storage.local.get(["tcdd-shop-code", "maGian", "dhHoanTextValue"]);
    const shopCode = String(store["tcdd-shop-code"] || store.maGian || store.dhHoanTextValue || "").trim().toUpperCase();
    await resolveTelegramSkus([r], shopCode);
    const text = formatOrderTelegram(r, shopCode);
    await sendTelegram(text);
  }
}

async function recordPrinted(base, sns) {
  const now = new Date();
  const time = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
  await updateDayStats(todayStr(), (day) => {
    day.printed.push({ base, sns: sns || [], time });
  });
}

async function recordWameli(base, slot, warehouse, count, sns) {
  const now = new Date();
  const time = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
  await updateDayStats(todayStr(), (day) => {
    day.wameli.push({ base, slot, warehouse, count: count || sns?.length || 0, sns: sns || [], time });
  });

  // Bắn thông báo Telegram khi nạp Wameli
  const teleCfg = await getTelegramConfig();
  if (teleCfg.enabled && teleCfg.notifyWameli) {
    const text = `☁️ <b>[TOPCARE] ĐÃ NẠP WAMELI THÀNH CÔNG</b>\n` +
      `• Lô / File: <code>${teleEsc(base)}</code>\n` +
      `• Khung giờ: <b>${teleEsc(slot)}</b>\n` +
      `• Kho: <b>${teleEsc(warehouse)}</b>\n` +
      `• Số lượng: <b>${count || sns?.length || 0} đơn</b>\n` +
      `⏰ Lúc: ${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
    sendTelegram(text);
  }
}

async function recordError(order_sn, stage, message) {
  const now = new Date();
  const time = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
  await updateDayStats(todayStr(), (day) => {
    day.errors.push({ order_sn: order_sn || "Hệ thống", stage, message: String(message || ""), time });
  });

  // Bắn thông báo Telegram cảnh báo lỗi khẩn cấp
  const teleCfg = await getTelegramConfig();
  if (teleCfg.enabled && teleCfg.notifyError) {
    const text = `🚨 <b>[TOPCARE] CẢNH BÁO LỖI VẬN HÀNH</b>\n` +
      `• Đối tượng: <code>${teleEsc(order_sn || "Hệ thống")}</code>\n` +
      `• Khâu bị lỗi: <b>${teleEsc(stage || "Quy trình")}</b>\n` +
      `• Chi tiết lỗi: <pre>${teleEsc(message || "Không rõ nguyên nhân")}</pre>\n` +
      `⏰ Lúc: ${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - Vui lòng kiểm tra lại!`;
    sendTelegram(text);
  }
}

// ---------- GHI LOG HỆ THỐNG ----------
async function bgLog(html) {
  const time = new Date().toLocaleTimeString("vi-VN");
  const line = `<div>${time} ${html}</div>`;
  chrome.runtime.sendMessage({ type: "tcdd-log", html: line }).catch(() => {});
  const data = await chrome.storage.local.get("tcdd_autolog");
  const list = (data.tcdd_autolog || []).slice(0, 49);
  list.unshift(line);
  await chrome.storage.local.set({ tcdd_autolog: list });
}

// ---------- THỰC THI FETCH TRONG TAB SHOPEE ----------
async function callInTab(tabId, path, body, method, query) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [path, body, method, query || ""],
    func: async (path, body, method, query) => {
      try {
        const cds = (document.cookie.match(/SPC_CDS=([^;]+)/) || [])[1] || "";
        const r = await fetch(`${path}?SPC_CDS=${cds}&SPC_CDS_VER=2${query}`, {
          method,
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: method === "GET" ? undefined : JSON.stringify(body || {}),
        });
        return { json: await r.json() };
      } catch (e) {
        return { error: String(e) };
      }
    },
  });
  return r?.result;
}

async function bgApi(path, body, method = "POST", query = "") {
  if (!ALLOW.includes(path)) throw new Error("API không được phép: " + path);
  const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/*" });
  if (!tabs.length) throw new Error("Chưa mở tab Kênh Người Bán (banhang.shopee.vn)");
  tabs.sort((a, b) => (b.active - a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  let last = "Tab Kênh Người Bán chưa sẵn sàng";
  for (const t of tabs) {
    try {
      const res = await callInTab(t.id, path, body, method, query);
      if (res?.json) {
        const j = res.json;
        if (j?.code !== 0) throw new Error(j?.message || j?.user_message || "Lỗi API Shopee");
        return j.data;
      }
      last = res?.error || last;
    } catch (e) {
      last = String(e.message || e);
    }
  }
  throw new Error(last);
}

// ---------- TRA CỨU MÃ GIAN & TÊN SHOP TỪ SHEET CAI_DAT ----------
async function getTenShopAndCode(orders = [], forceCode = "") {
  const store = await chrome.storage.local.get(["maGian", "dhHoanTextValue", "tcdd-shop-code", "tcdd-shop-name", "tcdd-shop-id"]);
  let code = String(forceCode || store["tcdd-shop-code"] || store.maGian || store.dhHoanTextValue || "").trim().toLowerCase();

  // Nếu chưa có mã gian, thử đoán từ SKU (format chuẩn: X009-OR-00-BCE-00-001-...)
  if (!code && Array.isArray(orders)) {
    for (const o of orders) {
      const items = o.order_items || o.items || [];
      for (const it of items) {
        const sku = String(it.item_model?.sku || it.product?.sku || it.modelSku || it.itemSku || "");
        const m = sku.match(/^[A-Z0-9]+-[A-Z0-9]+-[0-9]+-([A-Z0-9]{2,6})(-|$)/i);
        if (m) { code = m[1].toLowerCase(); break; }
      }
      if (code) break;
    }
  }

  // Mã shop lấy từ SKU thì không dùng tên / id shop đã lưu (có thể là của shop khác)
  let tenShop = forceCode ? "" : store["tcdd-shop-name"] || "";
  let shopId = forceCode ? "" : store["tcdd-shop-id"] || "";

  // Tra cứu sheet cai_dat theo mã gian
  try {
    if (typeof getGoogleAccessToken === "function" && typeof getSpreadsheetId === "function" && typeof fetchSheetValues === "function") {
      const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
      const rows = await fetchSheetValues("cai_dat!A:Z", token, 30000, sheetId);
      if (rows && rows.length > 1) {
        const normVi = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const header = (rows[0] || []).map(normVi);
        const gi = header.findIndex(h => h === 'gian' || h === 'ma_gian' || h === 'ma gian' || h === 'mã gian');
        const ti = header.findIndex(h => h === 'ten_shop' || h === 'ten shop' || h === 'tên shop' || h === 'shop' || h === 'shop_name');
        const si = header.findIndex(h => h === 'shop_id' || h === 'id_shop' || h === 'wameli_shop_id');

        if (gi >= 0 && ti >= 0) {
          if (code) {
            const r = rows.slice(1).find(row => normVi(row[gi]) === normVi(code));
            if (r) {
              tenShop = String(r[ti] || "").trim();
              if (si >= 0 && r[si]) shopId = String(r[si] || "").trim();
            }
          }
          if (!tenShop && rows.length === 2 && rows[1][ti]) {
            tenShop = String(rows[1][ti] || "").trim();
            if (!code && rows[1][gi]) code = String(rows[1][gi]).trim().toLowerCase();
          }
        }
      }
    }
  } catch (err) {
    console.warn("[AutoIn] Lỗi đọc sheet cai_dat tra cứu tên shop:", err);
  }

  if (!code) code = "gdd";
  return { code, tenShop, shopId };
}

// ---------- NẠP ĐƠN WAMELI ----------
async function wameliUpload(tabId, msg) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [msg],
    func: async (msg) => {
      try {
        const SLOTS = [["8H", 3, 8 * 60 + 25], ["11H", 6, 9 * 60 + 45], ["13H", 7, 13 * 60 + 30], ["14H", 10, 15 * 60 + 45], ["16H", 12, 17 * 60]];
        const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
        let k = SLOTS.findIndex((s) => mins < s[2]);
        const html = await (await fetch("/admin/order/upload", { credentials: "include" })).text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        if (!doc.querySelector("table") || /login/i.test(doc.title + (doc.querySelector("form")?.action || ""))) {
          return { error: "Wameli chưa đăng nhập — mở phanmem.wameli.vn và đăng nhập" };
        }
        const p2 = (n) => String(n).padStart(2, "0");
        const today = `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()}`;
        const kho = msg.warehouse_id === 2 ? "HCM" : "HN";
        const printed = new Set();
        for (const tr of doc.querySelectorAll("table tr")) {
          const c = [...tr.children].map((td) => td.textContent.trim());
          if (c.length > 7 && c[1] === "Đã in" && c[2] === kho && c[6].startsWith(today)) printed.add(c[7]);
        }
        while (k >= 0 && k < SLOTS.length && printed.has(SLOTS[k][0])) k++;
        let day = now;
        if (k < 0 || k >= SLOTS.length) { day = new Date(now.getTime() + 86400000); k = 0; }
        let [slot, house_id] = SLOTS[k];

        // Nếu người dùng chỉ định giờ in cụ thể hoặc có cài đặt giờ in
        const targetSlot = msg.target_slot || msg.slot;
        if (targetSlot && targetSlot !== "auto") {
          if (targetSlot === "8H_next") {
            slot = "8H";
            day = new Date(now.getTime() + 86400000);
            house_id = 3;
          } else {
            const chosen = SLOTS.find((s) => s[0] === targetSlot);
            if (chosen) {
              slot = chosen[0];
              house_id = chosen[1];
              day = now;
            }
          }
        }

        // QUY TẮC: Nếu Chủ nhật không làm việc (skip_sunday)
        // Khi ngày in rơi vào Chủ nhật (chiều Thứ 7 sau 17h/hết khung chuyển sang hôm sau, hoặc 8H_next vào T7, hoặc in vào ngày Chủ nhật)
        // -> Tự động chuyển ngày in sang sáng Thứ 2 (khung 8H)!
        const skipSunday = msg.skip_sunday !== false;
        if (skipSunday && day.getDay() === 0) {
          day = new Date(day.getTime() + 86400000); // Chủ nhật + 1 ngày = Thứ 2
          slot = "8H";
          house_id = 3;
        }

        // Danh sách Shop / Giờ chỉ có trong form "Thêm mới" (trang danh sách ở trên không có),
        // nên mở form đó (chỉ đọc) giống tab Đơn Tool.
        const formRes = await fetch("/admin/order/upload", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            text_count: "2", filter_count: "4", sort_field: "", sort_direct: "asc", module: "order", view: "upload",
            total: "0", page: "0", field_change: "", task: "add", boxchecked: "0", limit: "0",
          }).toString(),
        });
        const formDoc = new DOMParser().parseFromString(await formRes.text(), "text/html");
        const optsOf = (name) => [...(formDoc.querySelector(`select[name="${name}"]`)?.options || [])]
          .filter((o) => o.value && o.value !== "0")
          .map((o) => ({ value: o.value, text: o.textContent.trim() }));
        const shops = optsOf("shop_id");
        if (!shops.length) return { error: "Không mở được form Thêm mới trên Wameli để lấy danh sách shop (phiên đăng nhập hết hoặc không có quyền)" };

        // Khớp shop: tên shop (cột ten_shop trong CAI_DAT) -> mã gian -> shop_id. Khớp đúng trước, gần đúng sau.
        const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
        const targetName = norm(msg.shop_name || msg.ten_shop || "");
        const targetCode = norm(msg.shop_code || msg.code || "");
        const wantId = String(msg.shop_id || "").trim();
        const words = (t) => t.split(/[^a-z0-9]+/).filter(Boolean);
        let matched =
          (targetName && shops.find((o) => norm(o.text) === targetName)) ||
          (targetName && shops.find((o) => norm(o.text).includes(targetName))) ||
          (targetName && shops.find((o) => norm(o.text).length >= 3 && targetName.includes(norm(o.text)))) ||
          (targetCode && shops.find((o) => words(norm(o.text)).includes(targetCode))) ||
          (wantId && wantId !== "0" && shops.find((o) => String(o.value) === wantId)) ||
          null;
        if (!matched) {
          return {
            error: `Không tìm thấy shop Wameli cho gian "${msg.shop_code || "?"}"` +
              (msg.shop_name ? ` (tên shop "${msg.shop_name}")` : " – sheet CAI_DAT chưa có cột ten_shop cho gian này") +
              `. Shop đang có trên Wameli: ${shops.map((o) => o.text).join(", ")}`,
          };
        }
        const finalShopId = matched.value;
        const matchedShopName = matched.text;

        // Khung giờ: dùng mã giờ thật trong form nếu có (vd "14H"), không thì dùng bảng có sẵn
        const hourOpt = optsOf("house_id").find((o) => norm(o.text) === norm(slot));
        const finalHouseId = hourOpt ? hourOpt.value : house_id;

        const bin = (b, type) => new Blob([Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0))], { type });
        const fd = new FormData();
        fd.append("is_seeding", "0");
        fd.append("platform_id", "2");                 // Shopee
        fd.append("warehouse_id", String(msg.warehouse_id));
        fd.append("shop_id", String(finalShopId));     // Shop ID đã được so khớp chuẩn
        fd.append("date", `${p2(day.getDate())}-${p2(day.getMonth() + 1)}-${day.getFullYear()}`);
        fd.append("house_id", String(finalHouseId));
        fd.append("name", msg.base || "");              // Tên lô / Tên file đầy đủ
        fd.append("file_pdf[]", bin(msg.pdf, "application/pdf"), msg.base + ".pdf");
        fd.append("file_xlsx", bin(msg.xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), msg.base + ".xlsx");
        fd.append("module", "order");
        fd.append("view", "upload");
        fd.append("task", "save");
        fd.append("boxchecked", "0");
        fd.append("page", "0");

        const res = await fetch("/admin/order/upload", { method: "POST", body: fd, credentials: "include" });
        const out = await res.text();
        if (!res.ok) return { error: "Wameli trả lỗi HTTP " + res.status };

        // Parse chi tiết trang phản hồi của Wameli để lấy lỗi thật
        const outDoc = new DOMParser().parseFromString(out, "text/html");
        const stillForm = !!outDoc.querySelector('input[name="file_xlsx"]') || !!outDoc.querySelector('select[name="shop_id"]');
        const alertEls = [...outDoc.querySelectorAll('.alert, .message, #system-message, .error, .alert-danger, .alert-error, .alert-warning')];
        const alertMsg = alertEls.map(el => el.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).join(" | ");

        if (stillForm) {
          return { error: `Wameli từ chối nạp vào shop "${matchedShopName}": ` + (alertMsg || "Vẫn ở trang Thêm mới (kiểm tra lại quyền shop hoặc trường dữ liệu)") };
        }

        if (!out.includes(msg.base)) {
          const firstRow = outDoc.querySelector("table tr:nth-child(2)");
          const firstText = firstRow ? firstRow.textContent : "";
          const targetDay = `${p2(day.getDate())}/${p2(day.getMonth() + 1)}/${day.getFullYear()}`;
          if (!firstText.includes(today) && !firstText.includes(targetDay) && !alertMsg.toLowerCase().includes("thành công") && !alertMsg.toLowerCase().includes("success")) {
            return { error: "Đã gửi nhưng không thấy file " + msg.base + " trên Wameli" + (alertMsg ? ` (${alertMsg})` : "") };
          }
        }

        return {
          ok: true,
          slot: `${slot} ngày ${p2(day.getDate())}/${p2(day.getMonth() + 1)}`,
          shop_id: finalShopId,
          shop_name: matchedShopName
        };
      } catch (e) {
        return { error: String(e.message || e) };
      }
    },
  });
  return r?.result;
}
function waitComplete(tabId, ms = 25000) {
  return new Promise((ok) => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); chrome.tabs.onUpdated.removeListener(f); setTimeout(ok, 1500); }
    function f(id, info) { if (id === tabId && info.status === "complete") done(); }
    chrome.tabs.onUpdated.addListener(f);
  });
}
// Mã shop trong SKU của file Excel (cột S), vd "X009-OR-00-BCE-00-001" -> "bce".
// File Excel do xlsx.js tạo ở dạng không nén nên đọc thẳng được chữ bên trong.
function skuShopCodeFromXlsx(xlsxB64) {
  try {
    const text = atob(xlsxB64 || "");
    const m = text.match(/>[A-Z0-9]+-[A-Z0-9]+-[0-9]+-([A-Z]{2,6})(?:-[^<]*)?</i);
    return m ? m[1].toLowerCase() : "";
  } catch (e) {
    return "";
  }
}

async function executeWameliUpload(msg) {
  if (msg.skip_sunday === undefined) {
    const store = await chrome.storage.local.get(["tcdd-skip-sunday"]);
    msg.skip_sunday = store["tcdd-skip-sunday"] !== "0";
  }
  // Wameli đối chiếu shop với mã trong SKU, nên ưu tiên mã lấy từ SKU nếu khác mã gian đang cài
  const skuCode = skuShopCodeFromXlsx(msg.xlsx);
  if (skuCode && skuCode !== String(msg.shop_code || "").trim().toLowerCase()) {
    const sc = await getTenShopAndCode([], skuCode);
    msg.shop_code = sc.code;
    msg.shop_name = sc.tenShop;
    msg.shop_id = sc.shopId;
  }
  if (!msg.shop_name || !msg.shop_code) {
    const sc = await getTenShopAndCode();
    if (!msg.shop_code) msg.shop_code = sc.code;
    if (!msg.shop_name) msg.shop_name = sc.tenShop;
    if (!msg.shop_id) msg.shop_id = sc.shopId;
  }
  const WURL = "https://phanmem.wameli.vn/admin/order/upload";
  let [tab] = await chrome.tabs.query({ url: "https://phanmem.wameli.vn/*" });
  if (!tab) {
    tab = await chrome.tabs.create({ url: WURL, active: false });
    await waitComplete(tab.id);
  } else if (tab.discarded || tab.status !== "complete" || !/^https:\/\/phanmem\.wameli\.vn\//.test(tab.url || "")) {
    // tab bị Edge cho "ngủ" hoặc chưa tải xong -> đánh thức
    await chrome.tabs.update(tab.id, { url: WURL });
    await waitComplete(tab.id);
  }
  let res;
  try {
    res = await wameliUpload(tab.id, msg);
  } catch (e) {
    if (!/Cannot access|No tab|Frame|cannot be scripted/i.test(String(e.message || e))) throw e;
    await chrome.tabs.update(tab.id, { url: WURL });
    await waitComplete(tab.id);
    res = await wameliUpload(tab.id, msg);
  }
  if (res?.error && /đăng nhập/.test(res.error)) {
    // Tự đăng nhập bằng tài khoản đã lưu ở tab Cài đặt / sheet cai_dat rồi nạp lại 1 lần
    const login = await autoLoginWameli(tab.id);
    if (login.ok) {
      await chrome.tabs.update(tab.id, { url: WURL }).catch(() => {});
      await waitComplete(tab.id);
      res = await wameliUpload(tab.id, msg);
    } else {
      res = { error: login.error };
    }
    if (res?.error && /đăng nhập/.test(res.error)) chrome.tabs.update(tab.id, { active: true });
  }
  return res;
}

// Tài khoản Wameli: tab Cài đặt lưu vào chrome.storage (wameliUser / wameliPass), đồng bộ sheet cai_dat
// (cột wameli_user / wameli_pass, dòng 2). Máy chưa có thì đọc sheet rồi nhớ lại.
async function getWameliCredentials() {
  let { wameliUser, wameliPass } = await chrome.storage.local.get(["wameliUser", "wameliPass"]);
  if ((!wameliUser || !wameliPass) && typeof getGoogleAccessToken === "function" && typeof getSpreadsheetId === "function" && typeof fetchSheetValues === "function") {
    try {
      const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
      const rows = await fetchSheetValues("cai_dat!A:Z", token, 30000, sheetId);
      const header = (rows[0] || []).map((h) => String(h || "").trim().toLowerCase());
      const get = (k) => (header.indexOf(k) >= 0 ? String((rows[1] || [])[header.indexOf(k)] || "").trim() : "");
      if (get("wameli_user") && get("wameli_pass")) {
        wameliUser = get("wameli_user");
        wameliPass = get("wameli_pass");
        await chrome.storage.local.set({ wameliUser, wameliPass });
      }
    } catch (e) { /* không đọc được sheet */ }
  }
  return { user: wameliUser || "", pass: wameliPass || "" };
}

async function autoLoginWameli(tabId) {
  const { user, pass } = await getWameliCredentials();
  if (!user || !pass) {
    return { ok: false, error: "Wameli chưa đăng nhập và chưa có tài khoản Wameli – nhập tài khoản/mật khẩu ở tab Cài đặt" };
  }
  await bgLog("🔑 Wameli chưa đăng nhập – đang tự đăng nhập tài khoản <b>" + user.replace(/</g, "&lt;") + "</b>...");
  await chrome.tabs.update(tabId, { url: "https://phanmem.wameli.vn/admin" }).catch(() => {});
  await waitComplete(tabId);

  const [fill] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [user, pass],
    func: (u, p) => {
      const pwd = document.querySelector("input[type=\"password\"]");
      if (!pwd) return { already: !/login/i.test(location.href) };
      const form = pwd.closest("form") || document.body;
      const userInput = form.querySelector("input[name*=\"user\" i], input[name*=\"login\" i], input[name*=\"name\" i], input[name*=\"email\" i], input[id*=\"user\" i]")
        || [...form.querySelectorAll("input:not([type=hidden]):not([type=password]):not([type=submit]):not([type=checkbox]):not([type=radio])")][0];
      if (!userInput) return { error: "Không thấy ô tài khoản trên trang đăng nhập Wameli" };
      const setVal = (el, v) => {
        el.focus();
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      setVal(userInput, u);
      setVal(pwd, p);
      const btn = form.querySelector("button[type=submit], input[type=submit], button");
      if (btn) btn.click();
      else if (form.tagName === "FORM") form.submit();
      return { submitted: true };
    },
  }).catch((e) => [{ result: { error: String(e.message || e) } }]);
  const r = fill && fill.result;
  if (r?.error) return { ok: false, error: r.error };
  if (r?.already) return { ok: true };

  await waitComplete(tabId);
  const [check] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const pwd = document.querySelector("input[type=\"password\"]");
      const err = document.querySelector(".alert, .alert-danger, .error, .message, #system-message");
      return { stillLogin: !!pwd, msg: err ? err.textContent.trim().replace(/\s+/g, " ") : "" };
    },
  }).catch(() => [{ result: { stillLogin: true, msg: "" } }]);
  if (check?.result?.stillLogin) {
    return { ok: false, error: "Tự đăng nhập Wameli không thành công" + (check.result.msg ? ": " + check.result.msg : " – kiểm tra lại tài khoản/mật khẩu ở tab Cài đặt") };
  }
  await bgLog("✅ Đã tự đăng nhập Wameli");
  return { ok: true };
}

// ---------- QUY TRÌNH TỰ ĐỘNG CHẠY NỀN ----------
let isAutoBusy = false;
const isHCM = (name) => /hồ chí minh|hcm/i.test(name || "");

function toRow(c) {
  const p = c.package_card || c.order_card || {};
  const ext = p.order_ext_info || {};
  const head = p.card_header || {};
  const items = (p.item_info_group?.item_info_list || []).flatMap((g) => g.item_list || []);
  const fi = p.fulfilment_info || p.fulfillment_info || {};
  const st = p.status_info || {};
  const pay = p.payment_info || {};
  return {
    order_sn: head.order_sn || ext.order_sn || "",
    order_id: ext.order_id,
    channel_id: p.package_ext_info?.fulfilment_channel_id || p.package_ext_info?.shipping_method || 0,
    package_number: p.package_ext_info?.package_number || "",
    orderTime: (() => { const n = Number(ext.order_time || ext.create_time || head.order_time || head.create_time || 0); return n && n < 1e12 ? n * 1000 : n; })(),
    shipByTs: Number(ext.ship_by_date || 0) * 1000,
    buyer: head.buyer_info?.username || "",
    items: items.map((it) => `${it.name}${it.description ? " [" + it.description + "]" : ""} ×${it.amount}`),
    itemRows: items.map((it) => ({
      image: (() => { const v = String(it.image || it.item_image || it.product?.image || ""); return /^https?:\/\//i.test(v) ? v : /^[\w-]+$/.test(v) ? `https://cf.shopee.vn/file/${v}` : ""; })(),
      itemId: it.item_id || it.itemid || it.product?.item_id,
      modelId: it.model_id || it.modelid || it.item_model?.model_id,
      name: it.product?.name || it.item_name || it.name || "",
      model: it.item_model?.name || it.model_name || String(it.description || "").replace(/^\s*(Variation|Phân loại)\s*:\s*/i, "").replace(/\s*\[[^\]]*\]\s*$/, ""),
      itemSku: it.product?.sku || it.item_sku || it.parent_sku || "",
      modelSku: it.item_model?.sku || it.model_sku || it.variation_sku || it.sku || variationSku(it.description) || "",
      qty: it.amount ?? it.quantity ?? 1
    })),
    total: (pay.total_price || 0) / 1e5,
    status: st.status || "",
    ship_by: ext.ship_by_date ? "Hạn " + new Date(ext.ship_by_date * 1000).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "",
    tag: (st.status_tag || []).map((t) => t.tag_value).join(", "),
    warn: /quá hạn|trễ/i.test((st.status_tag || []).map((t) => t.tag_value).join(" ")),
    carrier: fi.fulfilment_channel_name || fi.masked_channel_name || "",
    seller_addr: ext.seller_address ? `${ext.seller_address.address}, ${ext.seller_address.city}, ${ext.seller_address.state}` : "",
    tracking: fi.tracking_number || (fi.tracking_number_list || []).join(", ") || "",
    location_id: null,
  };
}

// Dữ liệu gọn cho web (module "Chờ lấy hàng"): chỉ các trường cần hiển thị.
function cardToWebRow(c, stage) {
  const p = c.package_card || c.order_card || {};
  const ext = p.order_ext_info || {};
  const head = p.card_header || {};
  const r = toRow(c);
  const rawTime = ext.order_time || ext.create_time || head.order_time || head.create_time || 0;
  return {
    orderSn: r.order_sn,
    orderId: r.order_id || 0,
    packageNumber: r.package_number,
    buyer: r.buyer,
    items: r.items,
    total: r.total,
    status: r.status,
    tag: r.tag,
    warn: r.warn,
    shipBy: r.ship_by,
    shipByTs: ext.ship_by_date ? ext.ship_by_date * 1000 : 0,
    carrier: r.carrier,
    tracking: r.tracking,
    pickupAddr: r.seller_addr,
    stage, // 1 = Chờ lấy hàng - Chưa xử lý, 2 = Chờ lấy hàng - Đã xử lý
    orderTime: rawTime && rawTime < 1e12 ? rawTime * 1000 : rawTime,
  };
}

// Xử lý yêu cầu "Chờ lấy hàng" cho web: dùng chung cho trang extension và web đã deploy.
function handleChoLayHang(msg, reply) {
  (async () => {
    try {
      const stage = msg.status === 1 || msg.status === 2 ? Number(msg.status) : 0;
      const maxCards = Math.min(Math.max(Number(msg.limit) || 200, 1), 400);
      const stages = stage ? [stage] : [1, 2];
      const rows = [];
      const errors = [];
      let total = 0;
      for (const st of stages) {
        try {
          const idx = await bgFetchIndex(st);
          total += idx.list.length;
          const cards = await bgFetchCards(idx.list.slice(0, maxCards));
          for (const c of cards) rows.push(cardToWebRow(c, st));
        } catch (e) {
          errors.push(`${st === 1 ? "Chưa xử lý" : "Đã xử lý"}: ${e.message || e}`);
        }
      }
      reply({ ok: errors.length === 0, rows, total, at: Date.now(), errors });
    } catch (e) {
      reply({ ok: false, error: e.message || String(e), rows: [] });
    }
  })();
  return true;
}

// Web đã deploy (Vercel/Netlify/tên miền riêng...) gọi vào extension qua
// chrome.runtime.sendMessage(EXTENSION_ID, ...) — cần khai báo externally_connectable trong manifest.json.
chrome.runtime.onMessageExternal.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "autoin-ping") {
    reply({ ok: true, id: chrome.runtime.id, origin: (sender && sender.origin) || "", at: Date.now() });
    return true;
  }
  if (msg.type === "autoin-cho-lay-hang") return handleChoLayHang(msg, reply);
});

// ---------- ĐƠN HỦY: XÓA KHỎI WAMELI NẾU KHO CHƯA IN ----------
const WML_WATCH_KEY = "tcdd-wml-watch";
const WML_WATCH_MS = 7 * 24 * 60 * 60 * 1000;
async function readWameliWatch() {
  const list = (await chrome.storage.local.get(WML_WATCH_KEY))[WML_WATCH_KEY];
  return (Array.isArray(list) ? list : []).filter((x) => Date.now() - x.at < WML_WATCH_MS);
}
async function rememberWameliOrder(order, base) {
  if (!order?.order_id) return;
  const list = (await readWameliWatch()).filter((x) => x.order_id !== order.order_id);
  list.unshift({ order_id: order.order_id, order_sn: order.order_sn, base, at: Date.now() });
  await chrome.storage.local.set({ [WML_WATCH_KEY]: list.slice(0, 1000) });
}

// Đọc 5 trang danh sách đơn Wameli. Dòng đã in không có ô chọn nên không thể bị xóa nhầm.
async function findWameliRow(tabId, sn) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [sn],
    func: async (sn) => {
      const hits = [];
      for (let page = 1; page <= 5; page++) {
        const html = await (await fetch(`/admin/order/upload?page=${page}`, { credentials: "include" })).text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const rows = [...doc.querySelectorAll("table tbody tr")].filter((tr) => tr.cells.length > 8);
        if (page === 1 && !doc.querySelector("table")) return { error: "Wameli chưa đăng nhập" };
        for (const tr of rows) {
          if (tr.cells[5].textContent.includes(sn) || tr.cells[8].textContent.includes(sn)) {
            hits.push({ page, id: tr.querySelector('input[name="id[]"]')?.value || "", printed: !tr.querySelector('input[name="id[]"]') });
          }
        }
        if (!rows.length) break;
      }
      return { hits };
    },
  });
  if (r.result?.error) throw new Error(r.result.error);
  return r.result?.hits || [];
}

async function deleteWameliOrder(item) {
  const tab = await chrome.tabs.create({ url: "https://phanmem.wameli.vn/admin/order/upload", active: false });
  try {
    await waitComplete(tab.id);
    const hits = await findWameliRow(tab.id, item.order_sn);
    if (!hits.length) return "missing";
    if (hits.some((h) => h.printed)) return "printed";
    if (hits.length !== 1) return "ambiguous";
    await chrome.tabs.update(tab.id, { url: `https://phanmem.wameli.vn/admin/order/upload?page=${hits[0].page}` });
    await waitComplete(tab.id);
    const [clicked] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [hits[0].id],
      func: (id) => {
        const box = [...document.querySelectorAll('input[name="id[]"]')].find((x) => x.value === id);
        const btn = [...document.querySelectorAll("a.toolbar")].find((x) => x.textContent.trim() === "Xóa");
        if (!box || !btn) return false;
        window.confirm = () => true;
        box.click();
        setTimeout(() => btn.click(), 100);
        return true;
      },
    });
    if (!clicked?.result) return "failed";
    await new Promise((res) => setTimeout(res, 3000));
    await waitComplete(tab.id);
    return (await findWameliRow(tab.id, item.order_sn)).length ? "failed" : "deleted";
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function checkCancelledOrders() {
  if (isAutoBusy) return;
  const watch = await readWameliWatch();
  if (!watch.length) return;
  const cancelled = new Set();
  for (let page = 1; page <= 3; page++) {
    const d = await bgApi("/api/v3/order/search_order_list_index", {
      order_list_tab: 600, entity_type: 1, // 600 = Đơn huỷ
      pagination: { from_page_number: page, page_number: page, page_size: 40 },
      filter: { fulfillment_type: 0, is_drop_off: 0, fulfillment_source: 0, action_filter: 0 },
      sort: { sort_type: 3, ascending: false },
    });
    const list = d.index_list || [];
    for (const x of list) cancelled.add(x.order_id);
    if (list.length < 40) break;
  }
  for (const item of watch.filter((x) => cancelled.has(x.order_id))) {
    // Lỗi tạm thời (chưa đăng nhập, mất mạng): giữ đơn lại để lần sau thử tiếp
    const result = await deleteWameliOrder(item);
    const text = {
      deleted: `Đơn hủy ${item.order_sn}: đã xóa khỏi Wameli (kho chưa in).`,
      printed: `Đơn hủy ${item.order_sn}: KHO ĐÃ IN, báo kho giữ lại hàng. Lô ${item.base}.`,
      missing: `Đơn hủy ${item.order_sn}: không thấy trên Wameli, kiểm tra tay lô ${item.base}.`,
      ambiguous: `Đơn hủy ${item.order_sn}: thấy nhiều dòng trên Wameli, chưa xóa, kiểm tra tay.`,
      failed: `Đơn hủy ${item.order_sn}: xóa tự động không thành công, xóa tay lô ${item.base}.`,
    }[result];
    const isError = result !== "deleted";
    await bgLog(`${isError ? "⚠️" : "🗑"} ${text}`);
    if (isError) await recordError(item.order_sn, "Xóa đơn hủy", text);
    await notifyAndSound({ title: isError ? "TOPCARE ❌ ĐƠN HỦY" : "TOPCARE · Đơn hủy", message: text, sound: isError ? "error" : "ting", isError });
    const rest = (await readWameliWatch()).filter((x) => x.order_id !== item.order_id);
    await chrome.storage.local.set({ [WML_WATCH_KEY]: rest });
  }
}

async function bgFetchIndex(status = 1) {
  let out = [], page = 1;
  for (;;) {
    const d = await bgApi("/api/v3/order/search_order_list_index", {
      order_list_tab: 300, entity_type: 1,
      pagination: { from_page_number: 1, page_number: page, page_size: 40 },
      filter: { fulfillment_type: 0, is_drop_off: 0, fulfillment_source: 0, action_filter: 0, order_to_ship_status: status },
      sort: { sort_type: 2, ascending: true },
    });
    const list = d.index_list || [];
    out = out.concat(list);
    if (list.length < 40 || out.length >= 400) return { list: out, total: d.pagination?.total ?? out.length };
    page++;
  }
}

async function bgFetchCards(index) {
  const cards = [];
  for (let i = 0; i < index.length; i += 5) {
    const part = index.slice(i, i + 5);
    const body = {
      order_list_tab: 300,
      need_count_down_desc: false,
      package_param_list: part.map((x) => ({ package_number: x.package_number, shop_id: x.shop_id, region_id: x.region_id })),
    };
    const d = await bgApi("/api/v3/order/get_order_list_card_list", body);
    cards.push(...(d.card_list || []));
  }
  return cards;
}

let sheetSyncTask = null;
function syncWaitingOrdersSheet() {
  if (sheetSyncTask) return sheetSyncTask;
  sheetSyncTask = syncWaitingOrdersSheetNow().finally(() => { sheetSyncTask = null; });
  return sheetSyncTask;
}
async function syncWaitingOrdersSheetNow() {
  const {TITLE, buildSnapshot} = self.AutoInOrderSheet;
  const store = await chrome.storage.local.get(["tcdd-shop-code", "maGian", "dhHoanTextValue"]);
  const code = String(store["tcdd-shop-code"] || store.maGian || store.dhHoanTextValue || "").trim().toUpperCase();
  if (!code) throw new Error("Chưa nhập Mã gian trong Auto In");
  const fresh = [];
  for (const stage of [1, 2]) {
    const idx = await bgFetchIndex(stage);
    if (!Number.isFinite(Number(idx.total)) || idx.list.length !== Number(idx.total)) throw new Error("Shopee chưa trả đủ danh sách; giữ nguyên sheet");
    const cards = await bgFetchCards(idx.list);
    const parsed = cards.map(toRow);
    const expected = new Set(idx.list.map((x) => x.package_number));
    const actual = new Set(parsed.map((r) => r.package_number));
    if (expected.has(undefined) || actual.size !== expected.size || parsed.length !== idx.list.length || [...expected].some((p) => !actual.has(p))) throw new Error("Thiếu thẻ đơn Shopee; giữ nguyên sheet");
    fresh.push(...parsed.map((r) => ({...r,stage})));
  }
  await resolveTelegramSkus(fresh, code);
  const sheetId = self.SHARED_GOOGLE_CONFIG.webSpreadsheetId;
  if (!sheetId) throw new Error("Chưa cấu hình bảng tính cho web");
  const token = await getGoogleAccessToken();
  const title = await ensureSheetExists(TITLE, token, sheetId);
  const previous = await fetchSheetValues(`'${title}'!A:W`, token, 30000, sheetId);
  const at = Date.now(), values = buildSnapshot(previous, fresh, code, at);
  const metadata = await fetchSpreadsheetMetadata(token, sheetId);
  const props = metadata.sheets.find((x) => x.properties.title === title).properties;
  const rowCount = Math.max(previous.length, values.length);
  const requests = [];
  if (rowCount > props.gridProperties.rowCount) requests.push({appendDimension:{sheetId:props.sheetId,dimension:"ROWS",length:rowCount-props.gridProperties.rowCount}});
  requests.push({updateCells:{range:{sheetId:props.sheetId,startRowIndex:0,endRowIndex:rowCount,startColumnIndex:0,endColumnIndex:23},rows:values.map((r)=>({values:r.map((v)=>({userEnteredValue:typeof v === "number" ? {numberValue:v} : {stringValue:String(v ?? "")}}))})),fields:"userEnteredValue"}});
  const {res,data} = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({requests})});
  if (!res.ok) throw new Error(data.error?.message || "Không ghi được sheet đơn");
  await chrome.storage.local.set({tcdd_sheet_sync_at:at,tcdd_sheet_sync_error:""});
  await bgLog(`Đã đồng bộ ${fresh.length} đơn gian ${code} → ${TITLE}`);
  return {ok:true,at,count:fresh.length};
}
async function safeSyncWaitingOrders() {
  try { return await syncWaitingOrdersSheet(); }
  catch(e) { await chrome.storage.local.set({tcdd_sheet_sync_error:e.message}); await bgLog(`Đồng bộ sheet: ${e.message}`); return {ok:false,error:e.message}; }
}

const XLS_HEAD = ["Mã đơn hàng", "Mã Kiện Hàng", "Ngày đặt hàng", "Trạng Thái Đơn Hàng", "Nhận xét từ Người mua", "Mã vận đơn",
  "Đơn Vị Vận Chuyển", "Phương thức giao hàng", "Loại đơn hàng", "Ngày giao hàng dự kiến", "Ngày gửi hàng", "Thời gian giao hàng",
  "Trạng thái Trả hàng/Hoàn tiền", "SKU sản phẩm", "Tên sản phẩm", "Cân nặng sản phẩm", "Tổng cân nặng", "Tên kho hàng",
  "SKU phân loại hàng", "Tên phân loại hàng", "Giá gốc", "Người bán trợ giá", "Được Shopee trợ giá",
  "Tổng số tiền được người bán trợ giá", "Giá gốc (Y)", "Số lượng", "Số lượng sản phẩm được hoàn trả", "Tổng số tiền Người mua thanh toán"];

const DEFAULT_EXCEL_PRICE = 100000000; // Mặc định giá 100.000.000đ khi xuất Excel nạp Wameli

// ---------- GHI LỊCH SỬ IN ĐƠN VÀO GOOGLE SHEET IN_DON_WML ----------
const IN_DON_WML_HEADERS = [
  "Thời gian in", "Lô Wameli", "Khung giờ", "Kho hàng", "Mã gian", "Tên shop",
  "Mã đơn hàng", "Mã kiện hàng", "Mã vận đơn", "Đơn vị vận chuyển",
  "SKU sản phẩm", "SKU phân loại", "Tên sản phẩm", "Số lượng", "Đơn giá",
  "Tổng tiền đơn", "Trạng thái Wameli", "Nguồn xử lý", "Ghi chú"
];

async function appendInDonWmlRows(rows) {
  if (!rows || !rows.length) return { ok: false, error: "Không có dữ liệu đơn để ghi sheet" };
  try {
    let token = null, sheetId = null;
    if (typeof getGoogleAccessToken === "function" && typeof getSpreadsheetId === "function") {
      [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
    }
    if (!token || !sheetId) {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "APPEND_IN_DON_WML", values: rows }, (r) => resolve(r));
      });
      return res || { ok: false, error: "Không thể kết nối Google Sheets" };
    }

    if (typeof ensureSheetExists === "function") {
      await ensureSheetExists("IN_DON_WML", token, sheetId);
    }

    try {
      const { res: hRes, data: hData } = await fetchJsonWithTimeout(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("IN_DON_WML!A1:S1")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const existingHeader = (hRes.ok && hData.values && hData.values[0]) || [];
      if (!existingHeader.length || !existingHeader[0]) {
        await fetchJsonWithTimeout(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("IN_DON_WML!A1:S1")}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: [IN_DON_WML_HEADERS] })
          }
        );
      }
    } catch (hErr) {
      console.warn("[AutoIn] Lỗi kiểm tra header IN_DON_WML:", hErr);
    }

    const { res: appRes, data: appData } = await fetchJsonWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("IN_DON_WML!A:S")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: rows })
      }
    );

    if (!appRes.ok) {
      throw new Error(appData.error?.message || "Lỗi ghi dữ liệu vào sheet IN_DON_WML");
    }

    return { ok: true, count: rows.length, spreadsheetId: sheetId };
  } catch (err) {
    console.warn("[AutoIn] Lỗi appendInDonWmlRows:", err);
    return { ok: false, error: err.message || String(err) };
  }
}

async function syncPrintedOrdersToSheet(info) {
  try {
    const {
      base = "",
      slot = "--",
      warehouse = "",
      shopCode = "",
      tenShop = "",
      orderDetails = [],
      wameliStatus = "",
      source = "Chưa xử lý",
      note = ""
    } = info;

    if (!orderDetails || !orderDetails.length) return { ok: false, error: "Không có chi tiết đơn để ghi sheet" };

    const now = new Date();
    const timeStr = `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;

    const sheetRows = orderDetails.map((item) => {
      const orderSnStr = String(item.order_sn || "");
      const safeOrderSn = /^\d+$/.test(orderSnStr) ? `'${orderSnStr}` : orderSnStr;
      const pkgStr = String(item.package_number || "");
      const safePkg = /^\d+$/.test(pkgStr) ? `'${pkgStr}` : pkgStr;
      const tnStr = String(item.tn || "");
      const safeTn = /^\d+$/.test(tnStr) ? `'${tnStr}` : tnStr;

      return [
        timeStr,
        base,
        slot,
        warehouse,
        shopCode,
        tenShop,
        safeOrderSn,
        safePkg,
        safeTn,
        item.carrier || "",
        item.parentSku || "",
        item.modelSku || "",
        item.productName || "",
        item.amount || 1,
        item.price || 0,
        item.orderTotal || 0,
        wameliStatus || "Đã in",
        source || "Chưa xử lý",
        note || ""
      ];
    });

    const res = await appendInDonWmlRows(sheetRows);
    if (res.ok) {
      await bgLog(`📗 Đã ghi ${sheetRows.length} dòng vào Google Sheet [IN_DON_WML] (Lô: ${base})`);
    } else {
      await bgLog(`⚠️ Ghi Google Sheet [IN_DON_WML] lỗi: ${res.error}`);
    }
    return res;
  } catch (err) {
    console.warn("[AutoIn] syncPrintedOrdersToSheet lỗi:", err);
    return { ok: false, error: err.message || String(err) };
  }
}

// Danh sách phiếu in "tcdd-jobs" dùng chung với giao diện AutoIn (panel.js lưu dạng chuỗi JSON).
// Đọc được cả chuỗi lẫn mảng (dữ liệu cũ), luôn lưu lại dạng chuỗi JSON cho thống nhất.
async function readJobs() {
  const v = (await chrome.storage.local.get("tcdd-jobs"))["tcdd-jobs"];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}
async function writeJobs(list) {
  await chrome.storage.local.set({ "tcdd-jobs": JSON.stringify(list) });
}

async function runAutoBackground() {
  const cfg = await chrome.storage.local.get(["tcdd-auto", "tcdd-autopdf", "tcdd-wameli", "tcdd-addr", "tcdd-jobs"]);
  if (cfg["tcdd-auto"] !== "1") return;
  if (isAutoBusy) return;

  isAutoBusy = true;
  try {
    const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/*" });
    if (!tabs.length) {
      isAutoBusy = false;
      return;
    }

    const idx = await bgFetchIndex();
    if (!idx.list.length) {
      isAutoBusy = false;
      return;
    }

    const shop = { shop_id: idx.list[0].shop_id, region_id: idx.list[0].region_id };
    const list = (await bgFetchCards(idx.list)).map(toRow);

    // Lấy danh sách kho & địa chỉ lấy hàng
    const w = await bgApi("/api/v3/product/get_shop_warehouse/", null, "GET");
    const whs = (w.warehouse_list || w.list || w || []).map((x) => ({ id: x.location_id, name: x.warehouse_name || x.name, holiday: !!x.in_holiday_mode }));
    const a = await bgApi("/api/v3/shipment/mass_ship/get_pickup_address_list", {});
    const addrs = a.list || a.address_list || a || [];
    let pickId = +(cfg["tcdd-addr"] || 0);
    if (!addrs.some((x) => x.address_id === pickId && x.can_pickup_code >= 0)) {
      const def = await bgApi("/api/v3/general/get_shop_address", null, "GET");
      pickId = def.pickup_address_id || addrs.find((x) => x.can_pickup_code >= 0)?.address_id || 0;
    }
    const addrOf = (wh) => addrs.find((ad) => ad.address_id === pickId);

    // Gắn kho cho từng đơn
    const byPkg = {};
    for (const wh of whs) {
      const d = await bgApi("/api/v3/order/search_mass_shipment_index", {
        mass_shipment_tab: 201, entity_type: 1,
        filter: { is_single_item: 0, product_location_id: wh.id, pre_order: 0, product_location_ids: [wh.id], process_status: 1, ofg_process_status: 1, return_null_product_location_id_order: false },
        pagination: { from_page_number: 1, page_number: 1, page_size: 50 },
        sort: { sort_type: 2, ascending: true },
      });
      for (const x of d.index_list || []) byPkg[x.package_number || x] = wh.id;
    }
    const hnWh = whs.find((w) => /hà nội/i.test(w.name) && !w.holiday) || whs.find((w) => !w.holiday);
    for (const r of list) {
      r.location_id = byPkg[r.package_number] || null;
      if (!r.location_id && hnWh) {
        r.location_id = hnWh.id;
        await bgLog(`ℹ️ ${r.order_sn}: Shopee chưa gắn kho → xử lý theo ${hnWh.name}`);
      }
    }

    // Cập nhật tổng số đơn phát hiện hôm nay
    await updateDayStats(todayStr(), (day) => {
      day.total_orders = Math.max(day.total_orders, list.length);
    });

    // Gom nhóm theo ĐVVC và địa chỉ lấy hàng
    const groupsMap = {};
    for (const r of list) {
      const wh = whs.find((w) => w.id === r.location_id);
      const ad = addrOf(wh);
      if (!wh || !ad || wh.holiday || ad.can_pickup_code < 0) {
        if (!wh) recordError(r.order_sn, "Xác nhận lấy hàng", "Chưa rõ kho hàng");
        else if (wh.holiday) recordError(r.order_sn, "Xác nhận lấy hàng", "Kho đang bật chế độ nghỉ");
        else recordError(r.order_sn, "Xác nhận lấy hàng", "Kho chưa có địa chỉ lấy hàng hợp lệ");
        continue;
      }
      const k = r.channel_id + "|" + ad.address_id;
      (groupsMap[k] ||= { channel_id: r.channel_id, address_id: ad.address_id, wh, ad, list: [] }).list.push(r);
    }
    const groups = Object.values(groupsMap);
    if (!groups.length) {
      isAutoBusy = false;
      return;
    }

    await bgLog(`🤖 Phát hiện ${list.length} đơn mới chưa xử lý — tiến hành tự động xác nhận + in phiếu...`);

    // Xử lý từng nhóm
    for (const g of groups) {
      try {
        const slotsData = await bgApi("/api/v3/shipment/mass_ship/get_pickup_time_slots", {
          package_numbers: g.list.map((r) => r.package_number),
          channel_id: g.channel_id,
          address_id: g.address_id,
        });
        const storeSkipSun = await chrome.storage.local.get(["tcdd-skip-sunday"]);
        const autoSkipSunday = storeSkipSun["tcdd-skip-sunday"] !== "0";
        let slot = (slotsData.time_slots || [])[0];
        if (autoSkipSunday && slot && new Date(slot.value * 1000).getDay() === 0) {
          // Chủ nhật nghỉ -> tìm slot ngày làm việc tiếp theo (Thứ 2)
          const nonSun = (slotsData.time_slots || []).find((s) => new Date(s.value * 1000).getDay() !== 0);
          if (nonSun) slot = nonSun;
        }
        if (!slot) {
          const err = `${g.wh.name}: Shopee không trả về ngày lấy hàng`;
          await bgLog(`❌ ${err}`);
          await notifyAndSound({ title: "TOPCARE ❌ LỖI", message: err, sound: "error", isError: true });
          for (const r of g.list) recordError(r.order_sn, "Xác nhận lấy hàng", err);
          continue;
        }

        const group_list = g.list.map((r) => ({
          group_shipment_id: 0,
          primary_package_number: r.package_number,
          package_list: [{ order_id: r.order_id, package_number: r.package_number }],
        }));

        const d = await bgApi("/api/v3/shipment/batch_init_orders", {
          group_list,
          channel_id: g.channel_id,
          pickup_time: slot.value,
          remark: "",
          pickup_address_id: g.address_id,
          shipping_mode: "pickup",
          ...shop,
        });

        const ok = [];
        for (const x of d.data || []) {
          const r = g.list.find((y) => y.package_number === x.primary_package_number);
          if (x.retcode === 0) {
            ok.push(group_list.find((y) => y.primary_package_number === x.primary_package_number));
            await bgLog(`✅ ${r?.order_sn}: đã gửi yêu cầu lấy hàng`);
            await recordConfirmed(r);
            await notifyAndSound({
              title: "TOPCARE · Đơn hàng mới",
              message: `Đã xác nhận lấy hàng đơn: ${r?.order_sn} (${r?.carrier})`,
              sound: "ting",
            });
          } else {
            const msg = x.message || x.rettype || "Lỗi xác nhận Shopee";
            await bgLog(`❌ ${r?.order_sn}: ${msg}`);
            await recordError(r?.order_sn, "Xác nhận lấy hàng", msg);
            await notifyAndSound({
              title: "TOPCARE ❌ LỖI XÁC NHẬN",
              message: `Đơn ${r?.order_sn}: ${msg}`,
              sound: "error",
              isError: true,
            });
          }
        }

        if (!ok.length) continue;

        // Nếu người dùng KHÔNG tích chọn "Thêm vào Wameli", ta chỉ xác nhận đơn thôi (không tạo phiếu in, không nạp wameli)
        if (cfg["tcdd-wameli"] === "0") {
          await bgLog(`✅ Đã xác nhận thành công ${ok.length} đơn trên Shopee! (Chế độ: Chỉ xác nhận đơn, không nạp Wameli)`);
          continue;
        }

        // Chờ mã vận đơn (tối đa ~30s)
        let ready = false;
        const tn = {};
        for (let i = 0; i < 15 && !ready; i++) {
          await new Promise((res) => setTimeout(res, 2000));
          const st = await bgApi("/api/v3/shipment/batch_get_package_shipment_status", { group_list: ok, channel_id: g.channel_id, ...shop });
          if (st.success_num >= st.total_num) {
            ready = true;
            for (const x of st.group_status_list || []) {
              const r = g.list.find((y) => y.package_number === x.primary_package_number);
              tn[x.primary_package_number] = x.third_party_tn || "";
              await bgLog(`📦 ${r?.order_sn} → mã vận đơn <b>${x.third_party_tn || "đang chờ"}</b>`);
            }
          }
        }

        if (!ready) {
          await bgLog(`⏳ Chưa có mã vận đơn, chưa in được — kiểm tra lại trên Shopee`);
          continue;
        }

        // In từng đơn một: mỗi đơn một phiếu, một file PDF/Excel và một lần nạp Wameli.
        // Đơn lỗi không chặn các đơn còn lại vì tất cả đã được xác nhận với Shopee.
        for (const one of ok) {
          try {
            // Tạo phiếu in
            const job = await bgApi("/api/v3/logistics/create_sd_jobs", {
              group_list: [one],
              ...shop,
              channel_id: g.channel_id,
              generate_file_details: [{ file_type: "NORMAL_PDF", file_name: "Phiếu gửi hàng và Phiếu đóng gói", file_contents: [1] }],
              record_generate_schema: true,
            });

            const done = g.list.filter((r) => r.package_number === one.primary_package_number);
            const sns = done.map((r) => r.order_sn);
            const orders = done.map((r) => ({ order_id: r.order_id, order_sn: r.order_sn, tn: tn[r.package_number] || "" }));

            for (const jb of job.list || []) {
              const url = `https://banhang.shopee.vn/awbprint?job_id=${encodeURIComponent(jb.job_id)}&shop_id=${shop.shop_id}&lang=vi&first_time=${jb.is_first_time ?? 1}`;
              chrome.tabs.create({ url, active: false });
              await bgLog(`🖨 Đã mở phiếu in: ${jb.job_name || jb.job_id}`);

              // Lấy mã gian và tên shop từ sheet CAI_DAT
              const { code: shopCode, tenShop, shopId: sheetShopId } = await getTenShopAndCode(orders);

              // Tạo tên file Wameli: ddmm-magian-HHMM-n
              const now = new Date();
              const p2 = (n) => String(n).padStart(2, "0");
              const recentJobs = await readJobs();
              const todayJobs = recentJobs.filter((j) => new Date(j.at).toDateString() === now.toDateString());
              const baseStem = `${p2(now.getDate())}${p2(now.getMonth() + 1)}-${shopCode}-${p2(now.getHours())}${p2(now.getMinutes())}-${todayJobs.length + 1}-${sns[0]}`;
              // Lịch sử chỉ giữ 30 lô nên số thứ tự có thể lặp: thêm hậu tố để tên lô không trùng
              let base = baseStem;
              for (let n = 2; recentJobs.some((j) => j.base === base); n++) base = `${baseStem}-${n}`;

              const rec = { job_id: jb.job_id, sns, orders, at: Date.now(), base };
              recentJobs.unshift(rec);
              await writeJobs(recentJobs.slice(0, 30));
              await recordPrinted(base, sns);

              if (cfg["tcdd-autopdf"] !== "0") {
                // Đợi Shopee tạo file PDF
                let pdfLink = null;
                const q = `&job_id=${encodeURIComponent(jb.job_id)}&is_first_time=0`;
                for (let i = 0; i < 15; i++) {
                  const st = await bgApi("/api/v3/logistics/get_sd_job", null, "GET", q);
                  if (st.job_status === 5) break;
                  if (st.job_status > 5) throw new Error("Shopee tạo phiếu lỗi");
                  await new Promise((res) => setTimeout(res, 2000));
                }
                const dLink = await bgApi("/api/v3/logistics/download_sd_job_filelink", null, "GET", q);
                pdfLink = dLink.media_link;
                if (!pdfLink) throw new Error("Shopee chưa trả link PDF");

                // Tải file PDF về máy
                await chrome.downloads.download({
                  url: pdfLink,
                  filename: `TOPCARE-phieu-in/${base}.pdf`,
                  conflictAction: "uniquify",
                });
                await bgLog(`💾 Đã tải PDF: ${base}.pdf`);

                // Đọc nội dung PDF thành base64 để nạp Wameli
                const pdfResp = await fetch(pdfLink);
                const pdfBuf = await pdfResp.arrayBuffer();
                const pdfBytes = new Uint8Array(pdfBuf);
                let pdfBin = "";
                for (let i = 0; i < pdfBytes.length; i += 8192) {
                  pdfBin += String.fromCharCode.apply(null, pdfBytes.subarray(i, i + 8192));
                }
                const pdfB64 = btoa(pdfBin);

                // Tạo file Excel 28 cột và trích xuất dữ liệu chi tiết
                const orderDetailList = [];
                const xlsRows = [XLS_HEAD];
                for (const o of orders) {
                  try {
                    const od = await bgApi("/api/v3/order/get_one_order", null, "GET", `&order_id=${o.order_id}`);
                    const carrier = [od.masking_carrier_name, od.fulfillment_carrier_name].filter(Boolean).join("-") || o.carrier || "";
                    for (const it of od.order_items || []) {
                      const parentSku = (it.product?.sku || "").trim();
                      const modelSku = (it.item_model?.sku || "").trim() || parentSku;
                      const productName = (it.product?.name || "").trim();
                      const modelName = (it.item_model?.name || "").trim();
                      const fullName = modelName ? `${productName} [${modelName}]` : productName;
                      const price = Math.round(+it.order_price || 0);
                      const amount = it.amount || 1;
                      const orderTotal = Math.round((od.payment_info?.total_price || 0) / 1e5) || (price * amount);

                      const r = Array(XLS_HEAD.length).fill("");
                      r[0] = od.order_sn || o.order_sn;
                      r[5] = o.tn || "";
                      r[6] = carrier;
                      r[18] = modelSku;
                      r[24] = DEFAULT_EXCEL_PRICE;
                      r[25] = amount;
                      xlsRows.push(r);

                      orderDetailList.push({
                        order_sn: od.order_sn || o.order_sn,
                        package_number: o.package_number || od.package_number || "",
                        tn: o.tn || "",
                        carrier,
                        parentSku,
                        modelSku,
                        productName: fullName,
                        amount,
                        price,
                        orderTotal,
                      });
                    }
                  } catch (e) {
                    await bgLog(`⚠️ Lỗi lấy chi tiết đơn ${o.order_sn}: ${e.message}`);
                    orderDetailList.push({
                      order_sn: o.order_sn,
                      package_number: o.package_number || "",
                      tn: o.tn || "",
                      carrier: o.carrier || "",
                      parentSku: "",
                      modelSku: "",
                      productName: Array.isArray(o.items) ? o.items.join("; ") : (o.items || ""),
                      amount: 1,
                      price: o.total || 0,
                      orderTotal: o.total || 0,
                    });
                  }
                }

                const xlsxB64 = await globalThis.makeXlsxBase64(xlsRows);
                await chrome.downloads.download({
                  url: "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + xlsxB64,
                  filename: `TOPCARE-phieu-in/${base}.xlsx`,
                  conflictAction: "uniquify",
                });
                await bgLog(`💾 Đã tải Excel: ${base}.xlsx (${xlsRows.length - 1} dòng)`); 
                // Nạp Wameli
                let wRes = null;
                const warehouse_id = isHCM(g.ad?.warehouse_name) ? 2 : 1; // theo địa chỉ lấy hàng (dùng cả khi ghi sheet)
                if (cfg["tcdd-wameli"] !== "0") {
                  const target_slot = cfg["tcdd-wameli-slot"] || "auto";
                  const skip_sunday = cfg["tcdd-skip-sunday"] !== "0";
                  wRes = await executeWameliUpload({
                    base,
                    warehouse_id,
                    pdf: pdfB64,
                    xlsx: xlsxB64,
                    shop_code: shopCode,
                    shop_name: tenShop,
                    shop_id: sheetShopId,
                    target_slot,
                  });
                  if (wRes?.ok) {
                    const sName = wRes.shop_name || tenShop || "Shop " + (wRes.shop_id || "");
                    await bgLog(`☁️ Đã nạp Wameli: ${base} · [${sName}] · khung <b>${wRes.slot}</b> · kho ${warehouse_id === 1 ? "HN" : "HCM"}`);
                    await recordWameli(base, wRes.slot, warehouse_id === 1 ? "HN" : "HCM", orders.length, sns);
                    await rememberWameliOrder(orders[0], base);
                    await notifyAndSound({
                      title: `${tenShop || "AutoIn"} · Wameli`,
                      message: `Đã nạp ${base} lên Wameli · Khung ${wRes.slot}`,
                      sound: "ting",
                    });
                  } else {
                    const wErr = wRes?.error || "Lỗi không xác định khi nạp Wameli";
                    await bgLog(`❌ Nạp Wameli lỗi: ${wErr}`);
                    await recordError(base, "Nạp Wameli", wErr);
                    await notifyAndSound({
                      title: `${tenShop || "AutoIn"} ❌ LỖI WAMELI`,
                      message: `Nạp Wameli thất bại: ${wErr}`,
                      sound: "error",
                      isError: true,
                    });
                  }
                }

                // Ghi nhận lịch sử in vào Google Sheet IN_DON_WML
                const wamStatus = wRes?.ok ? `Thành công (${wRes.slot})` : (wRes?.error ? `Lỗi: ${wRes.error}` : "Chưa nạp");
                await syncPrintedOrdersToSheet({
                  base,
                  slot: wRes?.slot || "--",
                  warehouse: warehouse_id === 1 ? "Hà Nội" : "Hồ Chí Minh",
                  shopCode,
                  tenShop,
                  orderDetails: orderDetailList,
                  wameliStatus: wamStatus,
                  source: "Chưa xử lý",
                  note: "Tự động chạy nền"
                });
              }
            }
          } catch (e) {
            const sn = g.list.find((r) => r.package_number === one.primary_package_number)?.order_sn;
            await bgLog(`❌ ${sn}: lỗi in/nạp: ${e.message}`);
            await recordError(sn, "Quy trình in/nạp", e.message);
            await notifyAndSound({
              title: "TOPCARE ❌ LỖI QUY TRÌNH",
              message: `${sn}: ${e.message}`,
              sound: "error",
              isError: true,
            });
          }
        }
      } catch (e) {
        await bgLog(`❌ Lỗi nhóm ${g.wh.name}: ${e.message}`);
        await recordError(g.wh.name, "Quy trình in/nạp", e.message);
        await notifyAndSound({
          title: "TOPCARE ❌ LỖI QUY TRÌNH",
          message: `${g.wh.name}: ${e.message}`,
          sound: "error",
          isError: true,
        });
      }
    }
  } catch (e) {
    await bgLog(`❌ Lỗi chạy tự động: ${e.message}`);
  } finally {
    isAutoBusy = false;
  }
}

// ---------- QUY TRÌNH CHẠY LẠI CHO ĐƠN [ĐÃ XỬ LÝ] ----------
async function processProcessedOrders(targetOrders = null, options = {}) {
  const { source = "Đã xử lý (Chạy lại)", forceAll = false } = options;
  if (isAutoBusy) {
    await bgLog("⏳ Hệ thống đang bận xử lý lô đơn khác, vui lòng chờ trong giây lát...");
    return { ok: false, error: "Hệ thống đang bận xử lý lô đơn khác" };
  }

  isAutoBusy = true;
  try {
    const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/*" });
    if (!tabs.length) {
      isAutoBusy = false;
      const err = "Cần mở Kênh Người Bán Shopee (banhang.shopee.vn)";
      await bgLog(`❌ ${err}`);
      return { ok: false, error: err };
    }

    let list = [];
    let shop = { shop_id: 0, region_id: "VN" };

    if (Array.isArray(targetOrders) && targetOrders.length > 0) {
      list = targetOrders.slice();
      if (list[0].shop_id) {
        shop = { shop_id: list[0].shop_id, region_id: list[0].region_id || "VN" };
      } else {
        const idxSample = await bgFetchIndex(2).catch(() => null);
        if (idxSample?.list?.length) {
          shop = { shop_id: idxSample.list[0].shop_id, region_id: idxSample.list[0].region_id || "VN" };
        }
      }
    } else {
      await bgLog("🔍 Đang quét danh sách đơn hàng ở tab [Đã xử lý]...");
      const idx = await bgFetchIndex(2); // order_to_ship_status: 2
      if (!idx.list.length) {
        isAutoBusy = false;
        await bgLog("ℹ️ Không có đơn nào ở trạng thái [Đã xử lý].");
        return { ok: true, count: 0, message: "Không có đơn Đã xử lý" };
      }
      shop = { shop_id: idx.list[0].shop_id, region_id: idx.list[0].region_id || "VN" };
      list = (await bgFetchCards(idx.list)).map(toRow);
    }

    if (!list.length) {
      isAutoBusy = false;
      return { ok: true, count: 0, message: "Không có đơn để xử lý" };
    }

    await bgLog(`⚡ Bắt đầu quy trình chạy lại cho ${list.length} đơn [Đã xử lý]...`);

    // Lấy thông tin kho và địa chỉ lấy hàng
    const w = await bgApi("/api/v3/product/get_shop_warehouse/", null, "GET");
    const whs = (w.warehouse_list || w.list || w || []).map((x) => ({ id: x.location_id, name: x.warehouse_name || x.name, holiday: !!x.in_holiday_mode }));
    const a = await bgApi("/api/v3/shipment/mass_ship/get_pickup_address_list", {});
    const addrs = a.list || a.address_list || a || [];
    const cfg = await chrome.storage.local.get(["tcdd-addr", "tcdd-autopdf", "tcdd-wameli"]);
    let pickId = +(cfg["tcdd-addr"] || 0);
    if (!addrs.some((x) => x.address_id === pickId && x.can_pickup_code >= 0)) {
      const def = await bgApi("/api/v3/general/get_shop_address", null, "GET");
      pickId = def.pickup_address_id || addrs.find((x) => x.can_pickup_code >= 0)?.address_id || 0;
    }
    const addrOf = (wh) => addrs.find((ad) => ad.address_id === pickId);

    // Gắn kho cho từng đơn
    const hnWh = whs.find((w) => /hà nội/i.test(w.name) && !w.holiday) || whs.find((w) => !w.holiday);
    for (const r of list) {
      if (!r.location_id) r.location_id = hnWh?.id || null;
    }

    // Gom nhóm theo ĐVVC (channel_id)
    const groupsMap = {};
    for (const r of list) {
      const wh = whs.find((w) => w.id === r.location_id);
      const ad = addrOf(wh) || addrs[0];
      const ch = r.channel_id || 0;
      const k = String(ch);
      (groupsMap[k] ||= { channel_id: ch, wh, ad, list: [] }).list.push(r);
    }

    const groups = Object.values(groupsMap);
    let totalProcessed = 0;

    for (const g of groups) {
      // Chia thành các đợt tối đa 40 đơn để Shopee tạo phiếu in ổn định
      for (let i = 0; i < g.list.length; i += 40) {
        const batchList = g.list.slice(i, i + 40);
        const group_list = batchList.map((r) => ({
          group_shipment_id: 0,
          primary_package_number: r.package_number,
          package_list: [{ order_id: r.order_id, package_number: r.package_number }],
        }));

        // Kiểm tra và lấy mã vận đơn TN nếu thiếu
        let tn = {};
        const missingTn = batchList.filter((r) => !r.tracking);
        if (missingTn.length > 0) {
          try {
            const st = await bgApi("/api/v3/shipment/batch_get_package_shipment_status", {
              group_list: missingTn.map((r) => ({
                group_shipment_id: 0,
                primary_package_number: r.package_number,
                package_list: [{ order_id: r.order_id, package_number: r.package_number }],
              })),
              channel_id: g.channel_id,
              ...shop
            });
            for (const x of st.group_status_list || []) {
              tn[x.primary_package_number] = x.third_party_tn || "";
            }
          } catch (e) {
            console.warn("Lỗi lấy tracking_number:", e);
          }
        }
        for (const r of batchList) {
          if (!tn[r.package_number]) {
            tn[r.package_number] = r.tracking || "";
          }
        }

        // Tạo phiếu in Shopee
        let job;
        try {
          job = await bgApi("/api/v3/logistics/create_sd_jobs", {
            group_list,
            ...shop,
            channel_id: g.channel_id,
            generate_file_details: [{ file_type: "NORMAL_PDF", file_name: "Phiếu gửi hàng và Phiếu đóng gói", file_contents: [1] }],
            record_generate_schema: true,
          });
        } catch (jobErr) {
          await bgLog(`❌ Lỗi tạo phiếu in Shopee cho nhóm ${g.channel_id}: ${jobErr.message}`);
          continue;
        }

        const sns = batchList.map((r) => r.order_sn);
        const orders = batchList.map((r) => ({
          order_id: r.order_id,
          order_sn: r.order_sn,
          tn: tn[r.package_number] || "",
          package_number: r.package_number,
          carrier: r.carrier
        }));

        for (const jb of job.list || []) {
          const url = `https://banhang.shopee.vn/awbprint?job_id=${encodeURIComponent(jb.job_id)}&shop_id=${shop.shop_id}&lang=vi&first_time=${jb.is_first_time ?? 1}`;
          chrome.tabs.create({ url, active: false });
          await bgLog(`🖨 Đã tạo phiếu in: ${jb.job_name || jb.job_id} (${orders.length} đơn)`);

          const { code: shopCode, tenShop, shopId: sheetShopId } = await getTenShopAndCode(orders);

          const now = new Date();
          const recentJobs = await readJobs();
          const todayJobs = recentJobs.filter((j) => new Date(j.at).toDateString() === now.toDateString());
          const base = `${p2(now.getDate())}${p2(now.getMonth() + 1)}-${shopCode}-${p2(now.getHours())}${p2(now.getMinutes())}-${todayJobs.length + 1}${sns.length === 1 ? `-${sns[0]}` : ""}`;

          const rec = { job_id: jb.job_id, sns, orders, at: Date.now(), base, source };
          recentJobs.unshift(rec);
          await writeJobs(recentJobs.slice(0, 30));
          await recordPrinted(base, sns);

          // Tải PDF
          let pdfB64 = null;
          try {
            const q = `&job_id=${encodeURIComponent(jb.job_id)}&is_first_time=0`;
            for (let k = 0; k < 15; k++) {
              const st = await bgApi("/api/v3/logistics/get_sd_job", null, "GET", q);
              if (st.job_status === 5) break;
              if (st.job_status > 5) throw new Error("Shopee tạo phiếu lỗi");
              await new Promise((res) => setTimeout(res, 2000));
            }
            const dLink = await bgApi("/api/v3/logistics/download_sd_job_filelink", null, "GET", q);
            const pdfLink = dLink.media_link;
            if (pdfLink) {
              await chrome.downloads.download({
                url: pdfLink,
                filename: `TOPCARE-phieu-in/${base}.pdf`,
                conflictAction: "uniquify",
              });
              await bgLog(`💾 Đã tải PDF: ${base}.pdf`);

              const pdfResp = await fetch(pdfLink);
              const pdfBuf = await pdfResp.arrayBuffer();
              const pdfBytes = new Uint8Array(pdfBuf);
              let pdfBin = "";
              for (let b = 0; b < pdfBytes.length; b += 8192) {
                pdfBin += String.fromCharCode.apply(null, pdfBytes.subarray(b, b + 8192));
              }
              pdfB64 = btoa(pdfBin);
            }
          } catch (pdfErr) {
            await bgLog(`⚠️ Lỗi tải PDF: ${pdfErr.message}`);
          }

          // Tạo Excel 28 cột và trích xuất orderDetailList cho Google Sheet
          const xlsRows = [XLS_HEAD];
          const orderDetailList = [];
          for (const o of orders) {
            try {
              const od = await bgApi("/api/v3/order/get_one_order", null, "GET", `&order_id=${o.order_id}`);
              const carrier = [od.masking_carrier_name, od.fulfillment_carrier_name].filter(Boolean).join("-") || o.carrier || "";
              for (const it of od.order_items || []) {
                const parentSku = (it.product?.sku || "").trim();
                const modelSku = (it.item_model?.sku || "").trim() || parentSku;
                const productName = (it.product?.name || "").trim();
                const modelName = (it.item_model?.name || "").trim();
                const fullName = modelName ? `${productName} [${modelName}]` : productName;
                const price = Math.round(+it.order_price || 0);
                const amount = it.amount || 1;
                const orderTotal = Math.round((od.payment_info?.total_price || 0) / 1e5) || (price * amount);

                const r = Array(XLS_HEAD.length).fill("");
                r[0] = od.order_sn || o.order_sn;
                r[5] = o.tn || "";
                r[6] = carrier;
                r[18] = modelSku;
                r[24] = DEFAULT_EXCEL_PRICE;
                r[25] = amount;
                xlsRows.push(r);

                orderDetailList.push({
                  order_sn: od.order_sn || o.order_sn,
                  package_number: o.package_number || od.package_number || "",
                  tn: o.tn || "",
                  carrier,
                  parentSku,
                  modelSku,
                  productName: fullName,
                  amount,
                  price,
                  orderTotal,
                });
              }
            } catch (e) {
              await bgLog(`⚠️ Lỗi lấy chi tiết đơn ${o.order_sn}: ${e.message}`);
              orderDetailList.push({
                order_sn: o.order_sn,
                package_number: o.package_number || "",
                tn: o.tn || "",
                carrier: o.carrier || "",
                parentSku: "",
                modelSku: "",
                productName: Array.isArray(o.items) ? o.items.join("; ") : (o.items || ""),
                amount: 1,
                price: 0,
                orderTotal: 0,
              });
            }
          }

          let xlsxB64 = null;
          try {
            xlsxB64 = await globalThis.makeXlsxBase64(xlsRows);
            await chrome.downloads.download({
              url: "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + xlsxB64,
              filename: `TOPCARE-phieu-in/${base}.xlsx`,
              conflictAction: "uniquify",
            });
            await bgLog(`💾 Đã tải Excel: ${base}.xlsx (${xlsRows.length - 1} dòng)`);
          } catch (xlsErr) {
            await bgLog(`⚠️ Lỗi tạo Excel: ${xlsErr.message}`);
          }

          // Nạp Wameli
          let wRes = null;
          const warehouse_id = isHCM(g.ad?.warehouse_name) ? 2 : 1;
          if (pdfB64 && xlsxB64) {
            try {
              const target_slot = options.target_slot || cfg["tcdd-wameli-slot"] || "auto";
              const skip_sunday = cfg["tcdd-skip-sunday"] !== "0";
              wRes = await executeWameliUpload({
                base,
                warehouse_id,
                pdf: pdfB64,
                xlsx: xlsxB64,
                shop_code: shopCode,
                shop_name: tenShop,
                shop_id: sheetShopId,
                target_slot,
              });
              if (wRes?.ok) {
                const sName = wRes.shop_name || tenShop || "Shop " + (wRes.shop_id || "");
                await bgLog(`☁️ Đã nạp Wameli: ${base} · [${sName}] · khung <b>${wRes.slot}</b> · kho ${warehouse_id === 1 ? "HN" : "HCM"}`);
                await recordWameli(base, wRes.slot, warehouse_id === 1 ? "HN" : "HCM", orders.length, sns);
                for (const o of orders) await rememberWameliOrder(o, base);
                await notifyAndSound({
                  title: `${tenShop || "AutoIn"} · Wameli`,
                  message: `[Đã xử lý] Đã nạp ${base} lên Wameli · Khung ${wRes.slot}`,
                  sound: "ting",
                });
              } else {
                const wErr = wRes?.error || "Lỗi nạp Wameli";
                await bgLog(`❌ Nạp Wameli lỗi: ${wErr}`);
                await recordError(base, "Nạp Wameli", wErr);
              }
            } catch (wmErr) {
              await bgLog(`❌ Lỗi nạp Wameli: ${wmErr.message}`);
            }
          }

          // GHI LỊCH SỬ VÀO GOOGLE SHEET IN_DON_WML
          const wamStatus = wRes?.ok ? `Thành công (${wRes.slot})` : (wRes?.error ? `Lỗi: ${wRes.error}` : "Chưa nạp");
          await syncPrintedOrdersToSheet({
            base,
            slot: wRes?.slot || "--",
            warehouse: warehouse_id === 1 ? "Hà Nội" : "Hồ Chí Minh",
            shopCode,
            tenShop,
            orderDetails: orderDetailList,
            wameliStatus: wamStatus,
            source,
            note: `Chạy lại lúc ${now.toLocaleTimeString("vi-VN")}`
          });

          totalProcessed += orders.length;
        }
      }
    }

    await bgLog(`🎉 ĐÃ HOÀN TẤT: Đã xử lý ${totalProcessed} đơn [Đã xử lý] thành công!`);
    return { ok: true, count: totalProcessed };
  } catch (err) {
    await bgLog(`❌ Lỗi trong quy trình chạy lại: ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    isAutoBusy = false;
  }
}

// ---------- BÁO CÁO TỔNG KẾT (17H & 8H) ----------
function getNextAlarmTime(targetHour, targetMinute = 0) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

async function triggerDailyReport(type = "17h") {
  const now = new Date();
  const today = todayStr(now);
  const stats = await getDayStats(today);

  const total = stats.total_orders || stats.confirmed.length;
  const printed = stats.printed.reduce((n, p) => n + (p.sns?.length || 1), 0);
  const wameliSlots = stats.wameli.map((w) => w.slot).filter(Boolean);
  const uniqueSlots = [...new Set(wameliSlots)];
  const errorCount = stats.errors.length;

  let msg = `Hôm nay: ${total} đơn, đã in ${printed} đơn, ${stats.wameli.length} lô Wameli (${uniqueSlots.join(", ") || "chưa nạp"}).`;
  if (errorCount > 0) {
    msg += ` ❌ ${errorCount} đơn lỗi cần kiểm tra!`;
  } else {
    msg += ` ✅ Hoàn thành tốt, không có đơn lỗi.`;
  }

  await notifyAndSound({
    title: `TOPCARE 📊 Tổng kết ${type === "17h" ? "17:00 chiều" : "8:00 sáng"}`,
    message: msg + " Bấm để xem bảng chi tiết.",
    sound: "report",
    isError: errorCount > 0,
    reportType: type,
  });

  // Gửi báo cáo tổng kết qua Telegram nếu được cấu hình
  const teleCfg = await getTelegramConfig();
  if (teleCfg.enabled && teleCfg.notifyReport) {
    let reportText = `📊 <b>BÁO CÁO VẬN HÀNH TOPCARE (${type === "17h" ? "17:00 CHIỀU" : "08:00 SÁNG"})</b>\n` +
      `📅 Ngày: ${today}\n` +
      `------------------------------------\n` +
      `📦 Tổng đơn tiếp nhận: <b>${total} đơn</b>\n` +
      `🖨 Đã in phiếu: <b>${printed} đơn</b>\n` +
      `☁️ Lô nạp Wameli: <b>${stats.wameli.length} lượt</b>\n`;
    for (const w of stats.wameli) {
      reportText += `   • Khung ${teleEsc(w.slot)} (${teleEsc(w.warehouse || "HN")}): ${w.count || w.sns?.length || 0} đơn (${teleEsc(w.base)})\n`;
    }
    if (errorCount > 0) {
      reportText += `❌ Đơn lỗi: <b>${errorCount} đơn</b>\n`;
      for (const e of stats.errors) {
        reportText += `   • <code>${teleEsc(e.order_sn)}</code>: [${teleEsc(e.stage)}] ${teleEsc(e.message)}\n`;
      }
    } else {
      reportText += `✅ Đơn lỗi: <b>0 đơn</b> (Vận hành trơn tru)\n`;
    }
    reportText += `------------------------------------\n` +
      `⏰ Tự động gửi từ Extension Topcare lúc ${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
    await sendTelegram(reportText);
  }

  // Lưu flag để Side Panel tự động mở modal khi mở
  await chrome.storage.local.set({
    tcdd_open_report: { type, date: today, time: Date.now() },
  });
  chrome.runtime.sendMessage({ type: "tcdd-open-report", reportType: type }).catch(() => {});
}

// ---------- TỰ ĐỘNG MỞ TAB WAMELI SAU 5 PHÚT NẾU CHƯA CÓ TAB ----------
let wameliMissingStartTime = 0;

async function checkAutoOpenWameliTab() {
  const cfg = await chrome.storage.local.get(["tcdd-auto-open-wameli"]);
  if (cfg["tcdd-auto-open-wameli"] === "0") {
    wameliMissingStartTime = 0;
    return;
  }
  try {
    const tabs = await chrome.tabs.query({ url: ["*://phanmem.wameli.vn/*", "*://*.wameli.vn/*"] });
    if (tabs && tabs.length > 0) {
      wameliMissingStartTime = 0;
    } else {
      const now = Date.now();
      if (!wameliMissingStartTime) {
        wameliMissingStartTime = now;
      } else if (now - wameliMissingStartTime >= 5 * 60 * 1000) {
        wameliMissingStartTime = 0;
        await chrome.tabs.create({ url: "https://phanmem.wameli.vn/admin/", active: false });
        await bgLog("🌐 Đã tự động mở tab Wameli (sau 5 phút không phát hiện tab Wameli: https://phanmem.wameli.vn/admin/)");
      }
    }
  } catch (err) {
    console.error("checkAutoOpenWameliTab error:", err);
  }
}

// ---------- KHỞI TẠO VÀ QUẢN LÝ ALARMS ----------
async function initAlarms() {
  const cfg = await chrome.storage.local.get(["tcdd-auto", "tcdd-every"]);
  const interval = Math.max(1, +(cfg["tcdd-every"] || 2));

  // 1. Alarm tự động đọc đơn theo chu kỳ
  if (cfg["tcdd-auto"] === "1") {
    chrome.alarms.create("tcdd-auto-alarm", { periodInMinutes: interval });
  } else {
    chrome.alarms.clear("tcdd-auto-alarm");
  }

  chrome.alarms.create("tcdd-sheet-sync", { periodInMinutes: interval });

  // 2. Alarm báo cáo 17h chiều
  chrome.alarms.create("tcdd-report-17", {
    when: getNextAlarmTime(17, 0),
    periodInMinutes: 24 * 60,
  });

  // 3. Alarm báo cáo 8h sáng
  chrome.alarms.create("tcdd-report-8", {
    when: getNextAlarmTime(8, 0),
    periodInMinutes: 24 * 60,
  });

  // 4. Alarm kiểm tra tự mở tab Wameli (mỗi 1 phút)
  chrome.alarms.create("tcdd-wameli-tab-check", { periodInMinutes: 1 });
  chrome.alarms.create("tcdd-cancel-check", { periodInMinutes: 5 });

  // 5. Alarm định kỳ kiểm tra tin nhắn Telegram đến bot (mỗi 1 phút)
  chrome.alarms.create("tcdd-tele-poll", { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "tcdd-sheet-sync") {
    await safeSyncWaitingOrders();
  } else if (alarm.name === "tcdd-auto-alarm") {
    await runAutoBackground();
  } else if (alarm.name === "tcdd-report-17") {
    await triggerDailyReport("17h");
  } else if (alarm.name === "tcdd-report-8") {
    await triggerDailyReport("8h");
  } else if (alarm.name === "tcdd-wameli-tab-check") {
    await checkAutoOpenWameliTab();
  } else if (alarm.name === "tcdd-cancel-check") {
    await checkCancelledOrders().catch((e) => bgLog(`⚠️ Kiểm tra đơn hủy lỗi: ${e.message}`));
  } else if (alarm.name === "tcdd-tele-poll") {
    startTelegramPollingLoop();
    await pollTelegramUpdates();
  }
});

// Khi đóng tab, kiểm tra ngay trạng thái tab Wameli
chrome.tabs.onRemoved.addListener(async () => {
  await checkAutoOpenWameliTab();
});

// Khi tab Shopee tải xong (F5 hoặc thao tác mới) -> kích hoạt kiểm tra
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (info.status === "complete" && tab.url?.startsWith("https://banhang.shopee.vn/")) {
    runAutoBackground();
  }
});

// ---------- XỬ LÝ MESSAGE TỪ PANEL & CÁC THÀNH PHẦN KHÁC ----------
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "tcdd-api") {
    (async () => {
      try {
        const data = await bgApi(msg.path, msg.body, msg.method, msg.query);
        reply({ json: { code: 0, data } });
      } catch (e) {
        reply({ error: e.message || String(e) });
      }
    startTelegramPollingLoop();
})();
    return true;
  }

  // ---------- WEB (dist/index.html): DANH SÁCH ĐƠN "CHỜ LẤY HÀNG" ĐỌC TRỰC TIẾP TỪ SHOPEE ----------
  // Dùng lại đúng đường API của AutoIn (bgFetchIndex + bgFetchCards) nên cần 1 tab banhang.shopee.vn đang mở.
  // status: 0 = cả Chưa xử lý + Đã xử lý, 1 = Chưa xử lý, 2 = Đã xử lý
  if (msg.type === "autoin-cho-lay-hang") {
    return handleChoLayHang(msg, reply);
  }

  if (msg.type === "autoin-ping") {
    reply({ ok: true, id: chrome.runtime.id, at: Date.now() });
    return true;
  }

  if (msg.type === "tcdd-wameli") {
    (async () => {
      try {
        const res = await executeWameliUpload(msg);
        reply(res);
      } catch (e) {
        reply({ error: "Wameli: " + String(e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === "tcdd-download") {
    if (!/^https:\/\/[a-z0-9.-]+\.susercontent\.com\//.test(msg.url)) {
      reply({ error: "Link tải không phải của Shopee" });
      return;
    }
    chrome.downloads.download({ url: msg.url, filename: msg.filename, conflictAction: "uniquify" })
      .then((id) => reply({ id }), (e) => reply({ error: String(e.message || e) }));
    return true;
  }

  if (msg.type === "tcdd-set-auto") {
    (async () => {
      await chrome.storage.local.set({ "tcdd-auto": msg.enabled ? "1" : "0" });
      await initAlarms();
      if (msg.enabled) runAutoBackground();
      reply({ ok: true });
    })();
    return true;
  }

  if (msg.type === "tcdd-set-every") {
    (async () => {
      await chrome.storage.local.set({ "tcdd-every": String(msg.minutes) });
      await initAlarms();
      reply({ ok: true });
    })();
    return true;
  }

  if (msg.type === "tcdd-test-sound") {
    (async () => {
      await playAudio(msg.sound || "ting");
      reply({ ok: true });
    })();
    return true;
  }

  if (msg.type === "tcdd-trigger-report") {
    (async () => {
      await triggerDailyReport(msg.reportType || "17h");
      reply({ ok: true });
    })();
    return true;
  }

  if (msg.type === "tcdd-run-processed") {
    (async () => {
      try {
        const res = await processProcessedOrders(msg.orders, msg.options || {});
        reply(res);
      } catch (e) {
        reply({ ok: false, error: e.message || String(e) });
      }
    })();
    return true;
  }

  if (msg.type === "tcdd-wml-delete") {
    (async () => {
      const results = [];
      for (const order_sn of msg.order_sns || []) {
        try {
          const result = await deleteWameliOrder({ order_sn });
          if (result === "deleted") {
            const rest = (await readWameliWatch()).filter((x) => x.order_sn !== order_sn);
            await chrome.storage.local.set({ [WML_WATCH_KEY]: rest });
          }
          results.push({ order_sn, result });
        } catch (e) {
          results.push({ order_sn, result: "failed", error: e.message });
        }
      }
      reply({ results });
    })();
    return true;
  }

  if (msg.type === "tcdd-wml-watch") {
    rememberWameliOrder(msg.order, msg.base).then(() => reply({ ok: true }));
    return true;
  }

  if (msg.type === "tcdd-record-in-don-wml") {
    (async () => {
      try {
        const res = await appendInDonWmlRows(msg.rows);
        reply(res);
      } catch (e) {
        reply({ ok: false, error: e.message || String(e) });
      }
    })();
    return true;
  }

  if (msg.type === "tcdd-sync-waiting-sheet") {
    safeSyncWaitingOrders().then(reply);
    return true;
  }

  if (msg.type === "tcdd-run-now") {
    (async () => {
      await runAutoBackground();
      reply({ ok: true });
    })();
    return true;
  }

  if (msg.type === "tcdd-get-stats") {
    (async () => {
      const stats = await getDayStats(msg.date || todayStr());
      reply({ stats });
    })();
    return true;
  }

  if (msg.type === "tcdd-record-error") {
    (async () => {
      await recordError(msg.order_sn, msg.stage, msg.message);
      await notifyAndSound({
        title: "TOPCARE ❌ LỖI",
        message: `${msg.order_sn ? msg.order_sn + ": " : ""}${msg.message}`,
        sound: "error",
        isError: true,
      });
      reply({ ok: true });
    })();
    return true;
  }

  if (msg.type === "tcdd-notify") {
    (async () => {
      await notifyAndSound(msg);
      reply({ ok: true });
    })();
    return true;
  }

  if (msg.type === "tcdd-test-tele") {
    (async () => {
      const text = `🎉 <b>[TOPCARE] KẾT NỐI TELEGRAM THÀNH CÔNG!</b>\n` +
        `• Bot Token & Chat ID hợp lệ.\n` +
        `• Tiện ích đã sẵn sàng tự động bắn đơn hàng, cảnh báo lỗi và gửi báo cáo 17h/8h vào nhóm chat này.\n` +
        `⏰ Thử nghiệm lúc: ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
      const res = await sendTelegram(text);
      reply(res);
    })();
    return true;
  }

  if (msg.type === "tcdd-check-wameli-tab") {
    (async () => {
      await checkAutoOpenWameliTab();
      reply({ ok: true });
    })();
    return true;
  }

  if (msg.type === "tcdd-send-tele-report") {
    (async () => {
      const stats = await getDayStats(msg.date || todayStr());
      const now = new Date();
      const total = stats.total_orders || stats.confirmed.length;
      const printed = stats.printed.reduce((n, p) => n + (p.sns?.length || 1), 0);
      const errorCount = stats.errors.length;

      let reportText = `📊 <b>BÁO CÁO VẬN HÀNH TOPCARE</b>\n` +
        `📅 Ngày: ${msg.date || todayStr()}\n` +
        `------------------------------------\n` +
        `📦 Tổng đơn tiếp nhận: <b>${total} đơn</b>\n` +
        `🖨 Đã in phiếu: <b>${printed} đơn</b>\n` +
        `☁️ Lô nạp Wameli: <b>${stats.wameli.length} lượt</b>\n`;
      for (const w of stats.wameli) {
        reportText += `   • Khung ${teleEsc(w.slot)} (${teleEsc(w.warehouse || "HN")}): ${w.count || w.sns?.length || 0} đơn (${teleEsc(w.base)})\n`;
      }
      if (errorCount > 0) {
        reportText += `❌ Đơn lỗi: <b>${errorCount} đơn</b>\n`;
        for (const e of stats.errors) {
          reportText += `   • <code>${teleEsc(e.order_sn)}</code>: [${teleEsc(e.stage)}] ${teleEsc(e.message)}\n`;
        }
      } else {
        reportText += `✅ Đơn lỗi: <b>0 đơn</b> (Vận hành trơn tru)\n`;
      }
      reportText += `------------------------------------\n` +
        `⏰ Gửi từ tiện ích Topcare lúc ${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
      const res = await sendTelegram(reportText);
      reply(res);
    })();
    return true;
  }
});
})();
