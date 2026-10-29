self.window = self;
self.navigator = { userAgent: "Node" };
importScripts("lib/jsrsasign-all-min.js", "../shared/google-config.js");
// Flash Sale Tool: tự động đăng ký Flash Sale (bản đóng gói từ extension/flash-sale/)
importScripts("flash-sale/fs-background.bundle.js");
// Sao chép sản phẩm (Shopee Clone Tool): lấy ảnh Gemini làm ảnh bìa (extension/clone-tool/)
importScripts("clone-tool/background.js");
// AutoIn (TOPCARE – Đọc đơn hàng): tự xác nhận lấy hàng, in phiếu, nạp Wameli, Telegram (extension/autoin/)
importScripts("autoin/background.js");
// Auto Chat: chạy ngầm qua API chat, khách là người nhắn cuối thì tự nhắn lại + lập danh sách khách chờ (extension/autochat/)
importScripts("autochat/shared.js", "autochat/engine.js", "autochat/background.js", "autochat/sheet-sync.js");
importScripts("order-tool/dh-sync.bundle.js");

let GOOGLE_SHEET_CONFIG = {
  spreadsheetId: self.SHARED_GOOGLE_CONFIG.extensionSpreadsheetId,
  serviceAccountEmail: self.SHARED_GOOGLE_CONFIG.serviceAccountEmail,
  privateKey: self.SHARED_GOOGLE_CONFIG.privateKey,
  tokenUrl: self.SHARED_GOOGLE_CONFIG.tokenUrl
};
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const googleTokenCache = new Map();
const GOOGLE_REQUEST_TIMEOUT_MS = 30000;
const THU_CHI_SHEET_NAME = "THU_CHI";
const TRACKING_LOOKUP_TIMEOUT_MS = 8000;
const THU_CHI_HEADERS = ["id", "ngay", "thu_chi", "truong", "mdh", "mvd", "so_tien", "so_tien_loi_nhuan"];

async function getSpreadsheetId() {
  const res = await chrome.storage.local.get(["customSpreadsheetId"]);
  if (res.customSpreadsheetId && res.customSpreadsheetId.trim()) {
    GOOGLE_SHEET_CONFIG.spreadsheetId = res.customSpreadsheetId.trim();
  }
  return GOOGLE_SHEET_CONFIG.spreadsheetId;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
});

let saveDhOrderQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "FORCE_DOWNLOAD") {
    chrome.downloads.download({
        url: message.url,
        filename: message.filename || "shopee_report.xlsx",
        saveAs: false
    });
    sendResponse({ ok: true });
    return true;
  }

async function blobToBase64String(blob) {
  const arrayBuf = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

async function uploadImageToFreeImageHost(imageUrl) {
  let blob = null;
  let fileName = "image.png";

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("blob:")) {
    try {
      const response = await fetch(imageUrl);
      const arrayBuf = await response.arrayBuffer();
      if (arrayBuf && arrayBuf.byteLength > 0) {
        const mime = response.headers.get("content-type") || "image/png";
        blob = new Blob([arrayBuf], { type: mime });
        const urlPath = new URL(imageUrl).pathname;
        const lastSeg = urlPath.split("/").pop();
        if (lastSeg && lastSeg.includes(".")) {
          fileName = lastSeg;
        }
      }
    } catch (e) {
      console.warn("Không fetch trực tiếp được blob ảnh:", e);
    }
  } else if (imageUrl.startsWith("data:image")) {
    const parts = imageUrl.split(",");
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const b64 = parts[1] || "";
    const binStr = atob(b64);
    const len = binStr.length;
    const u8arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8arr[i] = binStr.charCodeAt(i);
    }
    blob = new Blob([u8arr], { type: mime });
  }

  if (!blob || blob.size === 0) {
    throw new Error("Không thể xử lý dữ liệu ảnh hoặc dữ liệu ảnh rỗng để upload!");
  }

  const ext = (fileName.split(".").pop() || "png").toLowerCase();
  const safeName = fileName || `image_${Date.now()}.${ext}`;

  // 1. Kiểm tra Catbox Userhash nếu người dùng đã lưu
  let catboxUserhash = "";
  try {
    const store = await chrome.storage.local.get(["catboxUserhash"]);
    catboxUserhash = (store?.catboxUserhash || "").trim();
  } catch (e) {}

  // 2. Thử upload qua API Catbox (https://catbox.moe/user/api.php)
  let catboxErr = "";
  try {
    const fdCatbox = new FormData();
    fdCatbox.append("reqtype", "fileupload");
    if (catboxUserhash) {
      fdCatbox.append("userhash", catboxUserhash);
    }
    fdCatbox.append("fileToUpload", blob, safeName);

    const resCatbox = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: fdCatbox
    });
    const textCatbox = await resCatbox.text();
    const cleanText = (textCatbox || "").trim();
    if (resCatbox.ok && cleanText.startsWith("http") && !cleanText.toLowerCase().includes("invalid uploader") && !cleanText.toLowerCase().includes("error")) {
      return cleanText;
    }
    catboxErr = cleanText || `HTTP ${resCatbox.status}`;
  } catch (e) {
    catboxErr = e.message;
  }

  // 3. Tự động fallback sang FreeImageHost / ImgBB nếu Catbox bị chặn hoặc lỗi
  console.warn("Catbox upload không thành công (" + catboxErr + "), chuyển sang máy chủ dự phòng...");
  let base64Data = "";
  try {
    base64Data = await blobToBase64String(blob);
  } catch (b64Err) {
    console.warn("Không convert được sang base64:", b64Err);
  }

  if (base64Data) {
    // Dự phòng 1: FreeImageHost
    try {
      const fdFree = new FormData();
      fdFree.append("key", "6d207e02198a847aa98d0a2a901485a5");
      fdFree.append("action", "upload");
      fdFree.append("source", base64Data);
      fdFree.append("format", "json");

      const resFree = await fetch("https://freeimage.host/api/1/upload", {
        method: "POST",
        body: fdFree
      });
      const dataFree = await resFree.json();
      if (dataFree?.image?.url) {
        return dataFree.image.url;
      }
    } catch (freeErr) {
      console.warn("Dự phòng FreeImageHost lỗi:", freeErr);
    }

    // Dự phòng 2: ImgBB
    try {
      const fdImgBB = new FormData();
      fdImgBB.append("key", "1bad1429a242d7040fda3f2cfddb3a25");
      fdImgBB.append("image", base64Data);

      const resImgBB = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: fdImgBB
      });
      const dataImgBB = await resImgBB.json();
      if (dataImgBB?.data?.url) {
        return dataImgBB.data.url;
      }
    } catch (imgbbErr) {
      console.warn("Dự phòng ImgBB lỗi:", imgbbErr);
    }
  }

  throw new Error(catboxErr || "Không thể upload ảnh lên API Catbox (https://files.catbox.moe/) và các máy chủ dự phòng.");
}

  if (message?.type === "SAVE_IMAGE_TO_SHEET_API") {
    (async () => {
      try {
        let rawUrl = (message.imageUrl || "").trim();
        if (!rawUrl) {
          throw new Error("Không tìm thấy đường dẫn ảnh!");
        }

        if (rawUrl.startsWith("//")) {
          rawUrl = "https:" + rawUrl;
        } else if (rawUrl.startsWith("/") && message.pageUrl) {
          try {
            rawUrl = new URL(rawUrl, message.pageUrl).href;
          } catch (e) {}
        }

        // 1. Kiểm tra: nếu có link sẵn (http/https), lấy link đó add thẳng vào Cột B (không cần tải lên API nữa)
        let hostedImageUrl = "";
        if (/^https?:\/\//i.test(rawUrl)) {
          hostedImageUrl = rawUrl;
        } else {
          // Chỉ upload lên API khi là dạng base64 (data:image) hoặc blob
          hostedImageUrl = await uploadImageToFreeImageHost(rawUrl);
        }

        // 2. Chuẩn bị kết nối Google Sheet
        const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
        await ensureSheetExists("LUU_ANH_API", token, sheetId);

        // Đảm bảo tiêu đề cột [id, link, ten_anh, link_cu] tồn tại
        const { res: hRes, data: hData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!A:D")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const existingRows = (hRes.ok && hData.values) ? hData.values : [];
        let lastUsedRow = 0;
        for (let i = 0; i < existingRows.length; i++) {
          const r = existingRows[i];
          if (r && r.some(cell => String(cell ?? "").trim() !== "")) {
            lastUsedRow = i + 1;
          }
        }
        if (lastUsedRow === 0) {
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!A1:D1")}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: [["id", "link", "ten_anh", "link_cu"]] })
          });
          lastUsedRow = 1;
        } else if (existingRows[0] && (existingRows[0].length < 4 || !existingRows[0][3])) {
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!D1")}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: [["link_cu"]] })
          });
        }
        
        // 3. Tạo ID và tên ảnh
        const imgId = "IMG_" + Date.now();
        const titleName = message.title || "Ảnh từ Web";
        
        // Chuẩn bị dòng dữ liệu 4 cột: [id, link, ten_anh, link_cu] (Cột A: id, Cột B: link ảnh)
        const rowData = [imgId, hostedImageUrl, titleName, rawUrl];
        const startRowNum = lastUsedRow + 1;
        
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`LUU_ANH_API!A${startRowNum}`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [rowData] })
        });
        if (!res.ok) throw new Error(data.error?.message || "Không lưu được vào LUU_ANH_API.");
        sendResponse({ ok: true, id: imgId, url: hostedImageUrl, link_cu: rawUrl });
      } catch (err) {
        console.error("Lỗi lưu LUU_ANH_API:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message?.type === "SAVE_INCOME_TO_THU_CHI") {
    saveIncomeToThuChi(message.rows || []).then(sendResponse);
    return true;
  }

  if (message?.type === "UPLOAD_SP_SHOPEE") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
         await ensureSheetExists("SP_SHOPEE", token, sheetId);
         
         // Đảm bảo header chuẩn nếu dòng 1 còn trống
         try {
             const headerRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A1:O1")}`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             if (!headerRes.res.ok || !headerRes.data.values || !headerRes.data.values.length || !headerRes.data.values[0].length) {
                 const defaultHeaders = [["Mã Sản phẩm", "Tên Sản phẩm", "Mã Phân loại", "Tên phân loại", "SKU Sản phẩm", "SKU", "Giá", "Kho hàng", "Tồn kho thực tế", "", "", "Mã gian", "Giá KM", "Tồn kho", "Ngày tạo"]];
                 await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A1:O1")}?valueInputOption=USER_ENTERED`, {
                     method: "PUT",
                     headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                     body: JSON.stringify({ values: defaultHeaders })
                 });
             }
         } catch (hErr) {
             console.warn("Lỗi kiểm tra header SP_SHOPEE:", hErr);
         }

         if (message.maGian) {
             const existingRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A2:Z")}`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             let existingRows = [];
             if (existingRes.res.ok && existingRes.data.values) {
                 existingRows = existingRes.data.values;
             }
             const filteredRows = existingRows.filter(row => {
                 const rowGian = ((row[11] !== undefined && row[11] !== "") ? row[11] : (row[6] || "")).trim().toLowerCase();
                 return rowGian !== message.maGian.toLowerCase();
             });
             const finalRows = filteredRows.concat(message.values || []);
             
             await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A2:Z")}:clear`, {
                 method: "POST",
                 headers: { Authorization: `Bearer ${token}` }
             });
             
             if (finalRows.length > 0) {
                 await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A2")}?valueInputOption=USER_ENTERED`, {
                     method: "PUT",
                     headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                     body: JSON.stringify({ values: finalRows })
                 });
             }
         } else {
             const clearRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A2:Z")}:clear`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
             });
             if (!clearRes.res.ok) console.warn("Khong the clear SP_SHOPEE: ", clearRes.data);

             if (message.values && message.values.length > 0) {
               await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A2")}?valueInputOption=USER_ENTERED`, {
                   method: "PUT",
                   headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                   body: JSON.stringify({ values: message.values })
               });
             }
         }
         sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "UPLOAD_SP_SHOPEE_DAY_DU") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
         const metadata = await fetchSpreadsheetMetadata(token, sheetId);
         let targetSheet = (metadata.sheets || []).find((s) => {
           const t = (s.properties?.title || "").trim().toLowerCase();
           return t === "sp_shopee_day_du" || t === "sp shopee day du" || t === "sp shopee đầy đủ" || t === "sp_shopee_full" || t.includes("day_du") || t.includes("đầy đủ");
         });
         let targetTitle = targetSheet ? targetSheet.properties.title : "SP_SHOPEE_DAY_DU";
         if (!targetSheet) {
           await addSheet(targetTitle, token, sheetId);
         }

         // Đảm bảo header chuẩn nếu dòng 1 còn trống
         try {
             const headerRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTitle + "!A1:U1")}`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             if (!headerRes.res.ok || !headerRes.data.values || !headerRes.data.values.length || !headerRes.data.values[0].length) {
                 const defaultHeaders = [["Mã Sản phẩm", "Tên Sản phẩm", "Mã Phân loại", "Tên phân loại", "SKU Sản phẩm", "SKU", "Giá", "Kho hàng", "Tồn kho thực tế", "", "", "Mã gian", "Giá KM", "Tồn kho", "Ngày tạo", "Link SP", "Mô tả SP", "Ảnh chính", "Ảnh mô tả", "Ảnh phân loại", "Video"]];
                 await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTitle + "!A1:U1")}?valueInputOption=USER_ENTERED`, {
                     method: "PUT",
                     headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                     body: JSON.stringify({ values: defaultHeaders })
                 });
             }
         } catch (hErr) {
             console.warn("Lỗi kiểm tra header SP_SHOPEE_DAY_DU:", hErr);
         }

         if (message.maGian) {
             const existingRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTitle + "!A2:Z")}`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             let existingRows = [];
             if (existingRes.res.ok && existingRes.data.values) {
                 existingRows = existingRes.data.values;
             }
             const filteredRows = existingRows.filter(row => {
                 const rowGian = ((row[11] !== undefined && row[11] !== "") ? row[11] : (row[6] || "")).trim().toLowerCase();
                 return rowGian !== message.maGian.toLowerCase();
             });
             const finalRows = filteredRows.concat(message.values || []);
             
             await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTitle + "!A2:Z")}:clear`, {
                 method: "POST",
                 headers: { Authorization: `Bearer ${token}` }
             });
             
             if (finalRows.length > 0) {
                 await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTitle + "!A2")}?valueInputOption=USER_ENTERED`, {
                     method: "PUT",
                     headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                     body: JSON.stringify({ values: finalRows })
                 });
             }
         } else {
             const clearRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTitle + "!A2:Z")}:clear`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
             });

             if (message.values && message.values.length > 0) {
               await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetTitle + "!A2")}?valueInputOption=USER_ENTERED`, {
                   method: "PUT",
                   headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                   body: JSON.stringify({ values: message.values })
               });
             }
         }
         sendResponse({ ok: true, sheetTitle: targetTitle });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "UPLOAD_WEB_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
         await ensureSheetExists("WEB_SP", token, sheetId);
         
         const headerRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A1:O1")}`, {
             headers: { Authorization: `Bearer ${token}` }
         });
         if (!headerRes.res.ok || !headerRes.data.values || !headerRes.data.values.length || !headerRes.data.values[0].length) {
             const defaultHeaders = [["ID", "Mã gian", "SKU phân loại", "Tên phân loại", "Tên sản phẩm", "Ngành hàng", "Mô tả sản phẩm", "Ảnh chính", "Ảnh mô tả", "Ảnh phân loại", "Video", "Giá", "Giá KM", "ID Shopee", "Link sản phẩm"]];
             await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A1:O1")}?valueInputOption=USER_ENTERED`, {
                 method: "PUT",
                 headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                 body: JSON.stringify({ values: defaultHeaders })
             });
         }
         
         if (message.maGian) {
             const existingRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A2:O")}`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             let existingRows = [];
             if (existingRes.res.ok && existingRes.data.values) {
                 existingRows = existingRes.data.values;
             }
             // Cột B (index 1) là Mã gian
             const filteredRows = existingRows.filter(row => {
                 const rowGian = (row[1] || "").trim().toLowerCase();
                 return rowGian !== message.maGian.trim().toLowerCase();
             });
             const finalRows = filteredRows.concat(message.values || []);
             
             await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A2:Z")}:clear`, {
                 method: "POST",
                 headers: { Authorization: `Bearer ${token}` }
             });
             
             if (finalRows.length > 0) {
                 await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A2")}?valueInputOption=USER_ENTERED`, {
                     method: "PUT",
                     headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                     body: JSON.stringify({ values: finalRows })
                 });
             }
         } else {
             const clearRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A2:Z")}:clear`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
             });
             if (!clearRes.res.ok) console.warn("Không thể clear WEB_SP: ", clearRes.data);

             if (message.values && message.values.length > 0) {
               await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A2")}?valueInputOption=USER_ENTERED`, {
                   method: "PUT",
                   headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                   body: JSON.stringify({ values: message.values })
               });
             }
         }
         sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "UPLOAD_SP_GIAM_GIA") {
    getGoogleAccessToken()
      .then(async (token) => {
         await ensureSheetExists("SP_GIAM_GIA", token);
         
         if (message.maGian) {
             const existingRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/SP_GIAM_GIA!A2:Z`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             let existingRows = [];
             if (existingRes.res.ok && existingRes.data.values) {
                 existingRows = existingRes.data.values;
             }
             const filteredRows = existingRows.filter(row => {
                 const rowGian = (row[8] || "").trim().toLowerCase(); // Col I is index 8
                 return rowGian !== message.maGian.toLowerCase();
             });
             const finalRows = filteredRows.concat(message.values || []);
             
             await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent("SP_GIAM_GIA!A2:Z")}:clear`, {
                 method: "POST",
                 headers: { Authorization: `Bearer ${token}` }
             });
             
             if (finalRows.length > 0) {
                 await updateSheetValues("SP_GIAM_GIA!A2", finalRows, token);
             }
         } else {
             const clearRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent("SP_GIAM_GIA!A2:Z")}:clear`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
             });
             if (!clearRes.res.ok) console.warn("Khong the clear SP_GIAM_GIA: ", clearRes.data);

             if (message.values && message.values.length > 0) {
               await updateSheetValues("SP_GIAM_GIA!A2", message.values, token);
             }
         }
         sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "UPLOAD_LUU_ANH_API") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        await ensureSheetExists("LUU_ANH_API", token, sheetId);
        // Ensure header row id, link, ten_anh, link_cu exists
        const { res: hRes, data: hData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!A:D")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const existingRows = (hRes.ok && hData.values) ? hData.values : [];
        let lastUsedRow = 0;
        for (let i = 0; i < existingRows.length; i++) {
          const r = existingRows[i];
          if (r && r.some(cell => String(cell ?? "").trim() !== "")) {
            lastUsedRow = i + 1;
          }
        }
        if (lastUsedRow === 0) {
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!A1:D1")}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: [["id", "link", "ten_anh", "link_cu"]] })
          });
          lastUsedRow = 1;
        } else if (existingRows[0] && (existingRows[0].length < 4 || !existingRows[0][3])) {
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!D1")}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: [["link_cu"]] })
          });
        }
        const validRows = (message.rows || []).filter(r => Array.isArray(r) && r.length > 0);
        if (validRows.length > 0) {
          const startRowNum = lastUsedRow + 1;
          const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`LUU_ANH_API!A${startRowNum}`)}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: validRows })
          });
          if (!res.ok) throw new Error(data.error?.message || "Không lưu được vào LUU_ANH_API.");
        }
        sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "DELETE_LUU_ANH_API_ITEMS") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        await ensureSheetExists("LUU_ANH_API", token, sheetId);
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!A:D")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok || !data.values || data.values.length <= 1) {
          sendResponse({ ok: true, deleted: 0 });
          return;
        }

        const rows = data.values;
        const header = rows[0] || ["id", "link", "ten_anh", "link_cu"];
        const headers = header.map(h => String(h || "").trim().toLowerCase());
        let idIdx = headers.findIndex(h => h === "id");
        let linkIdx = headers.findIndex(h => h === "link");
        if (idIdx === -1) idIdx = 0;
        if (linkIdx === -1) linkIdx = 1;

        const idsToDelete = new Set((message.ids || []).map(id => String(id || "").trim()).filter(Boolean));
        const linksToDelete = new Set((message.links || []).map(l => String(l || "").trim().toLowerCase()).filter(Boolean));

        const remainingRows = [header];
        let deletedCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowId = String(row[idIdx] || "").trim();
          const rowLink = String(row[linkIdx] || "").trim().toLowerCase();

          const shouldDelete = (rowId && idsToDelete.has(rowId)) || (rowLink && linksToDelete.has(rowLink));
          if (shouldDelete) {
            deletedCount++;
          } else {
            remainingRows.push(row);
          }
        }

        // Xóa sạch dữ liệu cũ trong Sheet LUU_ANH_API
        await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!A:D")}:clear`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });

        // Ghi lại danh sách còn lại
        if (remainingRows.length > 0) {
          await updateSheetValues("LUU_ANH_API!A1", remainingRows, token);
        }

        sendResponse({ ok: true, deleted: deletedCount, remaining: remainingRows.length - 1 });
      })
      .catch(error => {
        console.error("Lỗi DELETE_LUU_ANH_API_ITEMS:", error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message?.type === "GET_SPREADSHEET_ID") {
    getSpreadsheetId()
      .then(sheetId => sendResponse({ ok: true, spreadsheetId: sheetId }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "APPEND_IN_DON_WML") {
    (async () => {
      try {
        const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
        await ensureSheetExists("IN_DON_WML", token, sheetId);

        // Đảm bảo hàng tiêu đề chuẩn nếu chưa có
        try {
          const { res: hRes, data: hData } = await fetchJsonWithTimeout(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("IN_DON_WML!A1:S1")}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const existingHeader = (hRes.ok && hData.values && hData.values[0]) || [];
          if (!existingHeader.length || !existingHeader[0]) {
            const defaultHeaders = [[
              "Thời gian in", "Lô Wameli", "Khung giờ", "Kho hàng", "Mã gian", "Tên shop",
              "Mã đơn hàng", "Mã kiện hàng", "Mã vận đơn", "Đơn vị vận chuyển",
              "SKU sản phẩm", "SKU phân loại", "Tên sản phẩm", "Số lượng", "Đơn giá",
              "Tổng tiền đơn", "Trạng thái Wameli", "Nguồn xử lý", "Ghi chú"
            ]];
            await fetchJsonWithTimeout(
              `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("IN_DON_WML!A1:S1")}?valueInputOption=USER_ENTERED`,
              {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ values: defaultHeaders })
              }
            );
          }
        } catch (hErr) {
          console.warn("Lỗi kiểm tra/tạo header IN_DON_WML:", hErr);
        }

        const validRows = (message.values || message.rows || []).filter(r => Array.isArray(r) && r.some(cell => String(cell ?? "").trim() !== ""));
        if (!validRows.length) {
          sendResponse({ ok: false, error: "Không có dữ liệu hợp lệ để ghi vào sheet IN_DON_WML." });
          return;
        }

        const { res: appRes, data: appData } = await fetchJsonWithTimeout(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("IN_DON_WML!A:S")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: validRows })
          }
        );

        if (!appRes.ok) {
          throw new Error(appData.error?.message || "Lỗi ghi dữ liệu vào sheet IN_DON_WML");
        }

        sendResponse({ ok: true, count: validRows.length, spreadsheetId: sheetId });
      } catch (err) {
        console.error("Lỗi APPEND_IN_DON_WML:", err);
        sendResponse({ ok: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "GET_AUTH_TOKEN") {
    getGoogleAccessToken()
      .then(token => sendResponse({ ok: true, token }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "SAVE_FLASH_SALE") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => appendSheetValues("FLASH_SALE!A:C", message.values, token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(res => sendResponse({ ok: true, res }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_UD_CT") {
    getGoogleAccessToken()
      .then(token => fetchUdCtCompactValues(token))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_SP_SHOPEE_SKU_MAPPING") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("SP_SHOPEE!A:Z", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_DH") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("DH!A:AZ", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_SP_SHOPEE") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        const metadata = await fetchSpreadsheetMetadata(token, sheetId);
        const found = (metadata.sheets || []).find((s) => {
          const t = (s.properties?.title || "").trim().toLowerCase();
          return t === "sp_shopee" || t === "sp shopee" || t === "spshopee";
        });
        if (!found) {
          sendResponse({ ok: true, values: [], sheetTitle: "SP_SHOPEE" });
          return;
        }
        const targetSheetTitle = found.properties.title;
        const values = await fetchSheetValues(`${targetSheetTitle}!A:AZ`, token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId);
        sendResponse({ ok: true, values, sheetTitle: targetSheetTitle });
      })
      .catch(error => sendResponse({ ok: false, error: error.message, values: [] }));
    return true;
  }

  if (message?.type === "FETCH_SP_SHOPEE_DAY_DU") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        const metadata = await fetchSpreadsheetMetadata(token, sheetId);
        const found = (metadata.sheets || []).find((s) => {
          const t = (s.properties?.title || "").trim().toLowerCase();
          return t === "sp_shopee_day_du" || t === "sp shopee day du" || t === "sp shopee đầy đủ" || t === "sp_shopee_full" || t.includes("day_du") || t.includes("đầy đủ");
        });
        if (!found) {
          sendResponse({ ok: true, values: [], sheetTitle: "SP_SHOPEE_DAY_DU" });
          return;
        }
        const targetSheetTitle = found.properties.title;
        const values = await fetchSheetValues(`${targetSheetTitle}!A:AZ`, token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId);
        sendResponse({ ok: true, values, sheetTitle: targetSheetTitle });
      })
      .catch(error => sendResponse({ ok: false, error: error.message, values: [] }));
    return true;
  }

  if (message?.type === "FETCH_QUET_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        const metadata = await fetchSpreadsheetMetadata(token, sheetId);
        const found = (metadata.sheets || []).find((s) => {
          const t = (s.properties?.title || "").trim().toLowerCase();
          return t === "quet_sp" || t === "quet sp" || t === "quét sp" || t === "quét_sp" || t === "quet_shop" || t === "quét shop" || t === "quet shop" || t.includes("quet_sp") || t.includes("quet_shop");
        });
        if (!found) {
          sendResponse({ ok: true, values: [], sheetTitle: "QUET_SP" });
          return;
        }
        const targetSheetTitle = found.properties.title;
        const values = await fetchSheetValues(`${targetSheetTitle}!A:AZ`, token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId);
        sendResponse({ ok: true, values, sheetTitle: targetSheetTitle });
      })
      .catch(error => sendResponse({ ok: false, error: error.message, values: [] }));
    return true;
  }

  if (message?.type === "FETCH_SP_GIAM_GIA") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("SP_GIAM_GIA!A:Z", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_WEB_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("WEB_SP!A:Z", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_DS_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("DS_SP!A:G", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "FETCH_TINH_GIA") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("TINH_GIA!A:V", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_CAI_DAT") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("cai_dat!A:Z", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // Ghi giá trị vào sheet cai_dat theo TÊN CỘT ở dòng 1 (giá trị ở dòng 2).
  // Chưa có cột thì thêm vào cột trống đầu tiên, không đè dữ liệu khác. values: { ten_cot: gia_tri }
  if (message?.type === "SAVE_CAI_DAT_VALUES") {
    (async () => {
      const token = await getGoogleAccessToken();
      const sheetId = await getSpreadsheetId();
      const rows = await fetchSheetValues("cai_dat!1:2", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId);
      const header = (rows[0] || []).map(h => String(h || "").trim());
      const colLetter = (idx) => {
        let n = idx + 1, s = "";
        while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
        return s;
      };
      for (const [key, value] of Object.entries(message.values || {})) {
        let idx = header.findIndex(h => h.toLowerCase() === key.toLowerCase());
        if (idx === -1) {
          idx = header.length;
          header.push(key);
          await updateSheetValues(`cai_dat!${colLetter(idx)}1`, [[key]], token);
        }
        await updateSheetValues(`cai_dat!${colLetter(idx)}2`, [[String(value ?? "")]], token);
      }
    })()
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // Đọc danh sách link làm việc nhanh từ Sheet cai_dat (cột link_mo theo định dạng JSON cho từng shop)
  if (message?.type === "FETCH_CAI_DAT_QUICK_LINKS") {
    (async () => {
      const token = await getGoogleAccessToken();
      const sheetId = await getSpreadsheetId();
      const actualSheetName = await ensureSheetExists("cai_dat", token, sheetId);
      const rows = await fetchSheetValues(`${actualSheetName}!A1:AZ100`, token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId);
      if (!rows || rows.length < 1) {
        return { ok: true, links: [] };
      }

      // Xác định shop hiện tại (từ message hoặc storage)
      let targetShop = String(message.maGian || "").trim();
      if (!targetShop) {
        const st = await chrome.storage.local.get(["maGian", "dhHoanTextValue"]);
        targetShop = String(st.maGian || st.dhHoanTextValue || "").trim();
      }

      const header = (rows[0] || []).map(h => String(h || "").trim().toLowerCase());
      const linkMoColIdx = header.findIndex(h => h === "link_mo" || h === "linkmo");
      const shopColIdx = header.findIndex(h => ["gian", "ma_gian", "shop", "ma_shop"].includes(h));
      const colBIdx = shopColIdx !== -1 ? shopColIdx : 1; // Mặc định cột B (index 1) là mã gian

      let links = [];
      let foundInLinkMo = false;

      // 1. Tìm theo cột link_mo (JSON)
      if (linkMoColIdx !== -1 && rows.length >= 2) {
        let targetRow = null;
        if (targetShop) {
          targetRow = rows.slice(1).find(r => String(r[colBIdx] || "").trim().toLowerCase() === targetShop.toLowerCase());
        }
        // Nếu không tìm thấy dòng của shop cụ thể, lấy dòng có link_mo đầu tiên
        if (!targetRow) {
          targetRow = rows.slice(1).find(r => String(r[linkMoColIdx] || "").trim().length > 2) || rows[1];
        }

        if (targetRow && targetRow[linkMoColIdx]) {
          const rawJson = String(targetRow[linkMoColIdx] || "").trim();
          if (rawJson.startsWith("[") || rawJson.startsWith("{")) {
            try {
              const parsed = JSON.parse(rawJson);
              const arr = Array.isArray(parsed) ? parsed : [parsed];
              links = arr.map((item, idx) => ({
                id: item.id || `link_${idx}_${Date.now()}`,
                name: String(item.name || "Trang làm việc").trim(),
                url: String(item.url || "").trim(),
                enabled: item.enabled !== false
              })).filter(l => Boolean(l.url));
              foundInLinkMo = true;
            } catch (err) {
              console.warn("Lỗi parse JSON cột link_mo:", err);
            }
          }
        }
      }

      // 2. Fallback: Nếu chưa có trong link_mo, đọc từ các cột cũ (ten_link, url_link, bat_tat)
      if (!foundInLinkMo) {
        const nameColIdx = header.findIndex(h => ["ten_link", "ten_trang", "link_nhanh_ten", "ten_web"].includes(h));
        const urlColIdx = header.findIndex(h => ["url_link", "link_trang", "link_nhanh_url", "link_web"].includes(h));
        const statusColIdx = header.findIndex(h => ["bat_tat", "trang_thai", "trang_thai_link", "enable", "enabled"].includes(h));

        if (nameColIdx !== -1 && urlColIdx !== -1) {
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i] || [];
            const name = String(r[nameColIdx] || "").trim();
            const url = String(r[urlColIdx] || "").trim();
            let enabled = true;
            if (statusColIdx !== -1) {
              const st = String(r[statusColIdx] || "").trim().toUpperCase();
              if (st === "TAT" || st === "0" || st === "FALSE" || st === "OFF") {
                enabled = false;
              }
            }
            if (name && url) {
              links.push({ id: `link_${i}_${Date.now()}`, name, url, enabled });
            }
          }
        }
      }

      return { ok: true, links, shop: targetShop };
    })()
      .then(res => sendResponse(res))
      .catch(error => sendResponse({ ok: false, error: error.message, links: [] }));
    return true;
  }

  // Lưu danh sách link làm việc nhanh vào Sheet cai_dat (cột link_mo dạng JSON, mỗi shop 1 dòng riêng)
  if (message?.type === "SAVE_CAI_DAT_QUICK_LINKS") {
    (async () => {
      const token = await getGoogleAccessToken();
      const sheetId = await getSpreadsheetId();
      const actualSheetName = await ensureSheetExists("cai_dat", token, sheetId);
      const rows = await fetchSheetValues(`${actualSheetName}!1:100`, token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId);
      const header = (rows[0] || []).map(h => String(h || "").trim());

      const colLetter = (idx) => {
        let n = idx + 1, s = "";
        while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
        return s;
      };

      // 1. Đảm bảo cột link_mo tồn tại ở hàng tiêu đề
      let linkMoColIdx = header.findIndex(h => h.toLowerCase() === "link_mo" || h.toLowerCase() === "linkmo");
      if (linkMoColIdx === -1) {
        linkMoColIdx = header.length;
        header.push("link_mo");
        await updateSheetValues(`${actualSheetName}!${colLetter(linkMoColIdx)}1`, [["link_mo"]], token);
      }

      // 2. Xác định cột chứa mã shop (cột B hoặc header có tên gian, ma_gian, shop)
      let shopColIdx = header.findIndex(h => ["gian", "ma_gian", "shop", "ma_shop"].includes(h.toLowerCase()));
      if (shopColIdx === -1) {
        shopColIdx = 1; // Cột B (index 1)
      }

      // 3. Xác định shop hiện tại
      let currentShop = String(message.maGian || "").trim();
      if (!currentShop) {
        const st = await chrome.storage.local.get(["maGian", "dhHoanTextValue"]);
        currentShop = String(st.maGian || st.dhHoanTextValue || "").trim();
      }

      // 4. Chuẩn bị chuỗi JSON lưu trữ
      const rawLinks = Array.isArray(message.links) ? message.links : [];
      const cleanLinks = rawLinks.map(l => ({
        name: String(l.name || "").trim(),
        url: String(l.url || "").trim(),
        enabled: l.enabled !== false
      })).filter(l => Boolean(l.url));
      const jsonStr = JSON.stringify(cleanLinks);

      // 5. Tìm dòng của shop này trong sheet (từ dòng 2 trở đi)
      let targetRowNum = 2; // Mặc định dòng 2
      let foundShopRow = false;

      if (currentShop) {
        for (let i = 1; i < rows.length; i++) {
          const rowShop = String(rows[i]?.[shopColIdx] || "").trim();
          if (rowShop.toLowerCase() === currentShop.toLowerCase()) {
            targetRowNum = i + 1; // 1-based row index
            foundShopRow = true;
            break;
          }
        }

        // Nếu shop chưa có dòng nào trong sheet, tạo dòng mới cho shop này
        if (!foundShopRow) {
          targetRowNum = Math.max(2, rows.length + 1);
          await updateSheetValues(`${actualSheetName}!${colLetter(shopColIdx)}${targetRowNum}`, [[currentShop]], token);
        }
      }

      // 6. Ghi JSON vào cột link_mo tại đúng dòng của mã shop đó
      const linkMoCol = colLetter(linkMoColIdx);
      await updateSheetValues(`${actualSheetName}!${linkMoCol}${targetRowNum}`, [[jsonStr]], token);

      // 7. Lưu vào storage cục bộ
      await chrome.storage.local.set({
        order_tool_quick_links: rawLinks,
        [`order_tool_quick_links_${currentShop || "default"}`]: rawLinks
      });

      return { ok: true, count: cleanLinks.length, shop: currentShop, row: targetRowNum };
    })()
      .then(res => sendResponse(res))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_TEST_SHEET") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("test!A:E", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_DON_HANG") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(([token, sheetId]) => fetchSheetValues("DH!A:Z", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_DH_HOAN_IDS" || message?.type === "FETCH_DH_RETURN_IDS") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        try {
          const values = await getCachedDhRows(token, sheetId);
          if (!values || values.length <= 1) {
            sendResponse({ ok: true, values: [], statusMap: {} });
            return;
          }

          const processed = [];
          const statusMap = {};

          for (let i = 1; i < values.length; i++) {
            const r = values[i];
            const mdh = String(r[3] || "").trim();
            const tinhTrang = String(r[14] || "").trim();
            const trangThai = String(r[15] || "").trim();
            const returnId = String(r[25] || "").trim();

            if (mdh) {
              processed.push([mdh]);
              // Nếu đã có trạng thái Hủy / Hoàn / Trả hoặc có mã yêu cầu trả hàng
              if (tinhTrang || trangThai || returnId) {
                statusMap[mdh] = trangThai || tinhTrang || "Đã cập nhật";
              }
            }
          }
          sendResponse({ ok: true, values: processed, statusMap });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_HH_BH_MVD") {
    getGoogleAccessToken().then(async token => {
      try {
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo/values/HH_BH!A:Z`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong doc duoc sheet HH_BH.");
        sendResponse({ ok: true, values: data.values || [] });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "FETCH_DON_KHO_NHAN") {
    getGoogleAccessToken().then(async token => {
      try {
        const spreadsheetId = message.spreadsheetId || "1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo";
        const sheetName = message.sheetName || "HH_BH";
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(data.error?.message || `Không đọc được sheet ${sheetName}.`);
        sendResponse({ ok: true, values: data.values || [] });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "FETCH_UD_CT_MDH") {
    getGoogleAccessToken().then(async token => {
      try {
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo/values/UD_CT!E:Y`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong doc duoc sheet UD_CT.");
        sendResponse({ ok: true, values: data.values || [] });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "FETCH_HH_SHOP_DIEN_MDH") {
    getGoogleAccessToken().then(async token => {
      try {
        const spreadsheetId = message.spreadsheetId || "1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo";
        const sheetName = message.sheetName || "HH_SHOP_DIEN";
        const { res, data } = await fetchJsonWithTimeout(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!E2:E")}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(data.error?.message || "Không đọc được sheet " + sheetName);
        sendResponse({ ok: true, values: data.values || [] });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "APPEND_HH_SHOP_DIEN") {
    getGoogleAccessToken().then(async token => {
      try {
        const spreadsheetId = message.spreadsheetId || "1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo";
        const sheetName = message.sheetName || "HH_SHOP_DIEN";
        const validRows = (message.values || message.rows || []).filter(r => Array.isArray(r) && r.some(cell => String(cell ?? "").trim() !== ""));
        if (!validRows.length) {
          sendResponse({ ok: false, error: "Không có dữ liệu hợp lệ để ghi vào sheet " + sheetName });
          return;
        }

        const { res: appRes, data: appData } = await fetchJsonWithTimeout(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A:P")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: validRows })
          }
        );

        if (!appRes.ok) {
          throw new Error(appData.error?.message || `Lỗi ghi dữ liệu vào sheet ${sheetName}`);
        }

        sendResponse({ ok: true, count: validRows.length, spreadsheetId, updatedRows: appData.updates?.updatedRows || validRows.length });
      } catch (err) {
        console.error("Lỗi APPEND_HH_SHOP_DIEN:", err);
        sendResponse({ ok: false, error: err.message || String(err) });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }


  if (message?.type === "UPDATE_DH_INCOME_FINANCIALS") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        const targetSheetName = "DH";
        await ensureSheetExists(targetSheetName, token);
        const items = message.items || [];
        if (!items.length) throw new Error("Không có dữ liệu đơn hàng để cập nhật.");

        const currentMaGian = String(message.maGian || "").trim().toLowerCase();

        // 1. Đọc Header và các cột từ A đến U của sheet DH
        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetSheetName + "!A:U")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!readRes.ok) throw new Error(readData.error?.message || "Không đọc được sheet DH.");
        const rows = readData.values || [];
        if (rows.length <= 1) throw new Error("Sheet DH chưa có dữ liệu đơn hàng.");

        const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
        
        // Vị trí các cột trong sheet DH
        // Cột A (0): gian
        // Cột D (3): mdh
        // Cột F (5): tong_tien (Tiền SP)
        // Cột G (6): ma_giam_gia (0)
        // Cột H (7): phi_vc (Phí VC)
        // Cột I (8): phu_phi (Phụ phí)
        // Cột J (9): thue (Thuế)
        // Cột K (10): doanh_thu (Doanh thu)
        // Cột L (11): phi_khac
        // Cột M (12): tien_sp
        // Cột N (13): loi_nhuan
        let gianIdx = 0;
        let mdhIdx = 3;
        
        let tongTienIdx = headers.findIndex(h => h === "tong_tien" || h === "tong tien" || h === "tổng tiền" || h.includes("tong_tien"));
        if (tongTienIdx === -1) tongTienIdx = 5;

        let maGiamGiaIdx = headers.findIndex(h => h === "ma_giam_gia" || h === "mã giảm giá" || h.includes("ma_giam_gia"));
        if (maGiamGiaIdx === -1) maGiamGiaIdx = 6;

        let phiVcIdx = headers.findIndex(h => h === "phi_vc" || h === "phí vc" || h === "phí vận chuyển" || h.includes("phi_vc"));
        if (phiVcIdx === -1) phiVcIdx = 7;

        let phuPhiIdx = headers.findIndex(h => h === "phu_phi" || h === "phụ phí" || h.includes("phu_phi"));
        if (phuPhiIdx === -1) phuPhiIdx = 8;

        let thueIdx = headers.findIndex(h => h === "thue" || h === "thuế" || h.includes("thue"));
        if (thueIdx === -1) thueIdx = 9;

        let doanhThuIdx = headers.findIndex(h => h === "doanh_thu" || h === "doanh thu" || h.includes("doanh_thu"));
        if (doanhThuIdx === -1) doanhThuIdx = 10;

        let phiKhacIdx = headers.findIndex(h => h === "phi_khac" || h === "phí khác" || h.includes("phi_khac"));
        if (phiKhacIdx === -1) phiKhacIdx = 11;

        let tienSpIdx = headers.findIndex(h => h === "tien_sp" || h === "tiền sp" || h.includes("tien_sp"));
        if (tienSpIdx === -1) tienSpIdx = 12;

        let loiNhuanIdx = headers.findIndex(h => h === "loi_nhuan" || h === "lợi nhuận" || h.includes("loi_nhuan"));
        if (loiNhuanIdx === -1) loiNhuanIdx = 13;

        let tinhTrangIdx = headers.findIndex(h => h === "tinh_trang" || h === "tình trạng" || h === "tinh trang" || h.includes("tinh_trang") || h.includes("tình trạng"));
        if (tinhTrangIdx === -1) tinhTrangIdx = 14;

        let trangThaiIdx = headers.findIndex(h => h === "trang_thai" || h === "trạng thái" || h === "trang thai" || h.includes("trang_thai") || h.includes("trạng thái"));
        if (trangThaiIdx === -1) trangThaiIdx = 15;

        const getColLetter = (colIndex) => {
          let temp, letter = '';
          while (colIndex >= 0) {
            temp = colIndex % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            colIndex = (colIndex - temp) / 26 - 1;
          }
          return letter;
        };

        const updateData = [];
        let matchedCount = 0;
        const matchedRowNumbers = [];
        const matchedOrders = new Set();
        let conflictCount = 0;
        const conflictedOrders = new Set();

        const itemMap = new Map();
        items.forEach(item => {
          if (item.orderId) {
            itemMap.set(item.orderId.trim().toLowerCase(), item);
          }
        });

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowGian = String(row[gianIdx] || "").trim().toLowerCase();
          const rowMdh = String(row[mdhIdx] || "").trim().toLowerCase();
          const rowNum = i + 1;

          // So sánh mã gian và mã đơn hàng (Cột D)
          const isGianMatch = !currentMaGian || (rowGian === currentMaGian);
          if (isGianMatch && itemMap.has(rowMdh)) {
            const item = itemMap.get(rowMdh);
            matchedCount++;
            matchedRowNumbers.push(rowNum);
            matchedOrders.add(rowMdh);

            // Chuyển toàn bộ các giá trị thành số DƯƠNG theo yêu cầu người dùng
            const tienSpVal = Math.abs(Number(item.tienSanPham) || 0);
            const maGiamGiaVal = 0;
            const phiVcVal = Math.abs(Number(item.phiVanChuyen) || 0);
            const phuPhiVal = Math.abs(Number(item.phuPhi) || 0);
            const thueVal = Math.abs(Number(item.thue) || 0);

            // Công thức Doanh Thu: doanh_thu = tong_tien - ma_giam_gia - phi_vc - phu_phi - thue
            const doanhThuVal = tienSpVal - maGiamGiaVal - phiVcVal - phuPhiVal - thueVal;

            // Tính lại lợi nhuận: doanh_thu - phi_khac - tien_sp
            const phiKhacVal = Math.abs(Number(String(row[phiKhacIdx] || "").replace(/[^0-9-]/g, "")) || 0);
            const tienSpGoc = Math.abs(Number(String(row[tienSpIdx] || "").replace(/[^0-9-]/g, "")) || 0);
            const loiNhuanVal = doanhThuVal - phiKhacVal - tienSpGoc;

            // Kiểm tra xem đơn hàng này có phải là doanh thu âm không
            const isNegativeRevenue = Boolean(
              item.isNegative ||
              (Number(item.amount) < 0) ||
              (Number(item.doanhThu) < 0) ||
              String(item.rawAmount || "").includes("-")
            );

            // Quy tắc xử lý tinh_trang và trang_thai khi cập nhật doanh thu:
            // 1. Doanh thu âm: giữ nguyên cả tinh_trang và trang_thai
            // 2. Doanh thu bình thường:
            //    - Nếu cột tinh_trang đang TRỐNG (hoặc đã là "XONG"): ghi "XONG" (hoặc giữ nguyên "XONG"), giữ nguyên trang_thai
            //    - Nếu cột tinh_trang ĐÃ CÓ DỮ LIỆU KHÁC (HỦY, HOÀN, TRẢ,...):
            //      GIỮ NGUYÊN cột tinh_trang (không ghi đè chữ "XONG"), ghi "xung đột" ở cột trang_thai
            const rawTinhTrang = (row[tinhTrangIdx] !== undefined && row[tinhTrangIdx] !== null) ? row[tinhTrangIdx] : "";
            const currentTinhTrang = String(rawTinhTrang).trim();
            const rawTrangThai = (row[trangThaiIdx] !== undefined && row[trangThaiIdx] !== null) ? row[trangThaiIdx] : "";

            let newTinhTrang = rawTinhTrang;
            let newTrangThai = rawTrangThai;

            if (isNegativeRevenue) {
              newTinhTrang = rawTinhTrang;
              newTrangThai = rawTrangThai;
            } else {
              if (!currentTinhTrang) {
                newTinhTrang = "XONG";
                newTrangThai = rawTrangThai || "HOÀN THÀNH";
              } else if (currentTinhTrang.toUpperCase() === "XONG") {
                newTinhTrang = rawTinhTrang;
                newTrangThai = rawTrangThai || "HOÀN THÀNH";
              } else {
                // Đã có dữ liệu (HỦY, HOÀN, TRẢ,...): giữ nguyên tinh_trang, ghi "XUNG ĐỘT" vào trang_thai
                newTinhTrang = rawTinhTrang;
                newTrangThai = "XUNG ĐỘT";
                conflictCount++;
                conflictedOrders.add(rowMdh);
              }
            }

            // Cập nhật dải F -> P (tong_tien đến trang_thai)
            // F: tong_tien, G: ma_giam_gia, H: phi_vc, I: phu_phi, J: thue, K: doanh_thu, L: phi_khac, M: tien_sp, N: loi_nhuan, O: tinh_trang, P: trang_thai
            const startCol = tongTienIdx;
            const endCol = Math.max(doanhThuIdx, loiNhuanIdx, tinhTrangIdx, trangThaiIdx);

            const rowValues = [];
            for (let c = startCol; c <= endCol; c++) {
              if (c === tongTienIdx) rowValues.push(tienSpVal);
              else if (c === maGiamGiaIdx) rowValues.push(0);
              else if (c === phiVcIdx) rowValues.push(phiVcVal);
              else if (c === phuPhiIdx) rowValues.push(phuPhiVal);
              else if (c === thueIdx) rowValues.push(thueVal);
              else if (c === doanhThuIdx) rowValues.push(doanhThuVal);
              else if (c === loiNhuanIdx) rowValues.push(loiNhuanVal);
              else if (c === tinhTrangIdx) rowValues.push(newTinhTrang);
              else if (c === trangThaiIdx) rowValues.push(newTrangThai);
              else rowValues.push(row[c] !== undefined ? row[c] : "");
            }

            updateData.push({
              range: `${targetSheetName}!${getColLetter(startCol)}${rowNum}:${getColLetter(endCol)}${rowNum}`,
              values: [rowValues]
            });
          }
        }

        // Danh sách các đơn chưa có trong Sheet DH
        const unmatchedOrders = [];
        items.forEach(item => {
          if (item.orderId && !matchedOrders.has(item.orderId.trim().toLowerCase())) {
            unmatchedOrders.push(item.orderId);
          }
        });

        if (updateData.length === 0) {
          sendResponse({
            ok: true,
            matchedCount: 0,
            matchedOrders: [],
            unmatchedOrders,
            message: `Chưa có đơn hàng nào trong Sheet DH (Mã gian: "${currentMaGian || 'Tất cả'}").`
          });
          return;
        }

        // Thực hiện batchUpdate
        const { res: batchRes, data: batchResult } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: updateData
          })
        });

        if (!batchRes.ok) {
          throw new Error(batchResult.error?.message || "Không thể cập nhật sheet DH.");
        }
        invalidateDhCache();
        sendResponse({
          ok: true,
          matchedCount,
          matchedOrders: Array.from(matchedOrders),
          unmatchedOrders,
          conflictCount,
          conflictedOrders: Array.from(conflictedOrders),
          rowNums: matchedRowNumbers,
          message: conflictCount > 0
            ? `Đã cập nhật thành công ${matchedCount} dòng (${matchedOrders.size} đơn hàng) trong Sheet DH! (Phát hiện ${conflictedOrders.size} đơn xung đột trạng thái)`
            : `Đã cập nhật thành công ${matchedCount} dòng (${matchedOrders.size} đơn hàng) trong Sheet DH!`
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }


  if (message?.type === "CHECK_AND_GET_DH_ORDER") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        await ensureSheetExists("DH", token);
        const mdh = String(message.mdh || "").trim().toLowerCase();
        const currentMaGian = String(message.maGian || "").trim().toLowerCase();
        const forceRefresh = !!message.forceRefresh;

        if (!mdh) {
          sendResponse({ ok: true, exists: false, rows: [] });
          return;
        }

        const values = await getCachedDhRows(token, sheetId, forceRefresh);
        if (!values || values.length <= 1) {
          sendResponse({ ok: true, exists: false, rows: [] });
          return;
        }

        let gianIdx = 0;
        let ngayIdx = 1;
        let ngayGioIdx = 2;
        let mdhIdx = 3;
        let mvdIdx = 4;
        let tongTienIdx = 5;
        let maGiamGiaIdx = 6;
        let phiVcIdx = 7;
        let phuPhiIdx = 8;
        let thueIdx = 9;
        let doanhThuIdx = 10;
        let phiKhacIdx = 11;
        let tienSpIdx = 12;
        let loiNhuanIdx = 13;
        let tinhTrangIdx = 14;
        let trangThaiIdx = 15;
        let skuIdx = 16;
        let idSpIdx = 17;
        let slgIdx = 18;
        let donGiaIdx = 19;
        let thanhTienIdx = 20;
        let tenKhachIdx = 21;
        let ngNhanIdx = 22;
        let diaChiIdx = 23;
        let linkDonIdx = 24;

        const matchingRows = [];
        for (let i = 1; i < values.length; i++) {
          const r = values[i];
          const rowGian = String(r[gianIdx] || "").trim().toLowerCase();
          const rowMdh = String(r[mdhIdx] || "").trim().toLowerCase();

          const isGianMatch = !currentMaGian || (rowGian === currentMaGian);
          if (isGianMatch && rowMdh === mdh) {
            matchingRows.push({
              rowNum: i + 1,
              gian: r[gianIdx] || "",
              ngay: r[ngayIdx] || "",
              ngayGio: r[ngayGioIdx] || "",
              mdh: r[mdhIdx] || "",
              mvd: r[mvdIdx] || "",
              tongTien: r[tongTienIdx] || "",
              maGiamGia: r[maGiamGiaIdx] || "",
              phiVc: r[phiVcIdx] || "",
              phuPhi: r[phuPhiIdx] || "",
              thue: r[thueIdx] || "",
              doanhThu: r[doanhThuIdx] || "",
              phiKhac: r[phiKhacIdx] || "",
              tienSp: r[tienSpIdx] || "",
              loiNhuan: r[loiNhuanIdx] || "",
              tinhTrang: r[tinhTrangIdx] || "",
              trangThai: r[trangThaiIdx] || "",
              sku: r[skuIdx] || "",
              idSp: r[idSpIdx] || "",
              slg: r[slgIdx] || "",
              donGia: r[donGiaIdx] || "",
              thanhTien: r[thanhTienIdx] || "",
              tenKhach: r[tenKhachIdx] || "",
              ngNhan: r[ngNhanIdx] || "",
              diaChi: r[diaChiIdx] || "",
              linkDon: r[linkDonIdx] || ""
            });
          }
        }

        sendResponse({
          ok: true,
          exists: matchingRows.length > 0,
          rows: matchingRows
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message, exists: false, rows: [] });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message, exists: false, rows: [] }));
    return true;
  }

  if (message?.type === "CHECK_DH_ORDER_EXISTS") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        await ensureSheetExists("DH", token);
        const mdh = String(message.mdh || "").trim();
        const mvd = String(message.mvd || "").trim();

        if (!mdh && !mvd) {
          sendResponse({ ok: true, exists: false, rowNums: [], existingRows: [] });
          return;
        }

        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:Y")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(data.error?.message || "Không đọc được sheet DH.");
        const rows = data.values || [];
        const matchingRowNums = [];
        const existingRows = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowMdh = String(row[3] || "").trim();
          const rowMvd = String(row[4] || "").trim();
          const rowNum = i + 1; // 1-indexed trong Google Sheets

          if ((mdh && rowMdh && rowMdh.toLowerCase() === mdh.toLowerCase()) || 
              (mvd && rowMvd && rowMvd.toLowerCase() === mvd.toLowerCase())) {
            matchingRowNums.push(rowNum);
            existingRows.push(row);
          }
        }

        sendResponse({ ok: true, exists: matchingRowNums.length > 0, rowNums: matchingRowNums, existingRows });
      } catch (err) {
        sendResponse({ ok: false, error: err.message, exists: false, rowNums: [], existingRows: [] });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message, exists: false, rowNums: [], existingRows: [] }));
    return true;
  }

  if (message?.type === "FETCH_DON_HANG_MDH") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!D:D")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong doc duoc sheet DH.");
        sendResponse({ ok: true, values: data.values || [] });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "SAVE_DH_ORDER") {
    saveDhOrderQueue = saveDhOrderQueue.catch(() => {}).then(async () => {
      try {
        const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
        await ensureSheetExists("DH", token, sheetId);
        const rawValues = message.values || [];

        // Lọc nghiêm ngặt: dòng phải có ít nhất MDH (cột 3), MVD (cột 4) hoặc SKU (cột 16)
        const newValues = rawValues.filter(r => {
          if (!Array.isArray(r) || r.length === 0) return false;
          const mdh = String(r[3] || "").trim();
          const mvd = String(r[4] || "").trim();
          const sku = String(r[16] || "").trim();
          return mdh || mvd || sku;
        });

        if (!newValues.length) throw new Error("Dữ liệu đơn hàng không hợp lệ hoặc thiếu Mã đơn hàng / SKU.");

        // Lấy mdh và mvd từ tham số hoặc dòng dữ liệu đầu tiên
        const sampleMdh = String(message.mdh || newValues[0]?.[3] || "").trim();
        const sampleMvd = String(message.mvd || newValues[0]?.[4] || "").trim();

        if (!sampleMdh && !sampleMvd) {
          throw new Error("Không có Mã đơn hàng hoặc Mã vận đơn để lưu.");
        }

        // 1. Quét tìm xem đơn hàng đã có trong Sheet DH chưa (đọc toàn bộ từ A đến AZ để đảm bảo số dòng i+1 luôn khớp 100%)
        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:AZ")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const rows = (readRes.ok && readData.values) ? readData.values : [];
        let matchingRowNums = [];
        let existingOldTinhTrang = "";
        let existingOldTrangThai = "";

        const isCodeMatch = (cellVal, targetCode) => {
          if (!cellVal || !targetCode) return false;
          const c = String(cellVal).trim().toLowerCase();
          const t = String(targetCode).trim().toLowerCase();
          if (!c || !t || c.length < 6 || t.length < 6) return false;
          if (c === t) return true;
          const clean = (s) => s.replace(/copy|sao\s*ch[eéê]p/gi, " ").trim();
          const m1 = clean(c).match(/([0-9]{6}[a-z0-9]{6,16})/i) || clean(c).match(/([a-z0-9]{10,25})/i);
          const m2 = clean(t).match(/([0-9]{6}[a-z0-9]{6,16})/i) || clean(t).match(/([a-z0-9]{10,25})/i);
          return Boolean(m1 && m2 && m1[1].toLowerCase() === m2[1].toLowerCase());
        };

        const headers = (rows[0] || []).map(h => String(h || "").trim().toLowerCase());
        let mdhIdx = headers.findIndex(h => h === "mdh" || h.includes("mã đơn") || h.includes("ma don") || h === "order sn");
        if (mdhIdx === -1) mdhIdx = 3;
        let mvdIdx = headers.findIndex(h => h === "mvd" || h.includes("mã vận") || h.includes("ma van") || h === "tracking");
        if (mvdIdx === -1) mvdIdx = 4;
        let tinhTrangIdx = headers.findIndex(h => h === "tinh_trang" || h.includes("tình trạng"));
        if (tinhTrangIdx === -1) tinhTrangIdx = 14;
        let trangThaiIdx = headers.findIndex(h => h === "trang_thai" || h.includes("trạng thái"));
        if (trangThaiIdx === -1) trangThaiIdx = 15;

        // Ưu tiên 1: Kiểm tra các rowNums do client chỉ định (nếu client đã biết chính xác vị trí dòng)
        const explicitRowNums = (Array.isArray(message.rowNums) ? message.rowNums : [message.rowNum, message.rowOriginalIndex])
          .map(n => Number(n))
          .filter(n => !isNaN(n) && n >= 2);

        for (const rowNum of explicitRowNums) {
          if (rowNum <= rows.length) {
            const r = rows[rowNum - 1] || [];
            const rMdh = String(r[mdhIdx] || "").trim();
            const rMvd = String(r[mvdIdx] || "").trim();
            if ((sampleMdh && isCodeMatch(rMdh, sampleMdh)) || (sampleMvd && isCodeMatch(rMvd, sampleMvd))) {
              if (!matchingRowNums.includes(rowNum)) matchingRowNums.push(rowNum);
              if (!existingOldTinhTrang && r[tinhTrangIdx]) existingOldTinhTrang = String(r[tinhTrangIdx]).trim();
              if (!existingOldTrangThai && r[trangThaiIdx]) existingOldTrangThai = String(r[trangThaiIdx]).trim();
            }
          }
        }

        let lastUsedRow = 1;

        // Ưu tiên 2: Tìm kiếm trong toàn bộ Sheet DH theo đúng cột MDH và MVD
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (r && r.some(cell => String(cell || "").trim())) {
            lastUsedRow = i + 1;
          }
          const rowMdh = String(r[mdhIdx] || "").trim();
          const rowMvd = String(r[mvdIdx] || "").trim();
          const rowNum = i + 1;

          const isMatch = (sampleMdh && isCodeMatch(rowMdh, sampleMdh)) ||
                          (sampleMvd && isCodeMatch(rowMvd, sampleMvd));

          if (isMatch) {
            if (!matchingRowNums.includes(rowNum)) matchingRowNums.push(rowNum);
            if (!existingOldTinhTrang && r[tinhTrangIdx]) existingOldTinhTrang = String(r[tinhTrangIdx]).trim();
            if (!existingOldTrangThai && r[trangThaiIdx]) existingOldTrangThai = String(r[trangThaiIdx]).trim();
          }
        }

        // Nếu đơn hàng trong Sheet DH đã có tình trạng (ví dụ Hủy, Hoàn, Trả) mà newValues chưa có, bảo toàn tình trạng đó
        const statusToCheck = existingOldTrangThai || existingOldTinhTrang;
        if (matchingRowNums.length > 0 && isModifiedStatusText(statusToCheck)) {
          newValues.forEach(row => {
            if (!row[14] && existingOldTinhTrang) row[14] = existingOldTinhTrang;
            if (!row[15] && existingOldTrangThai) row[15] = existingOldTrangThai;

            if (/hủy|huy/i.test(statusToCheck)) {
              row[10] = "0"; // doanh_thu
              row[12] = "0"; // tien_sp
              row[13] = "0"; // loi_nhuan
            } else if (/hoàn|hoan|trả|tra/i.test(statusToCheck)) {
              row[12] = "0"; // tien_sp
              const dt = Number(String(row[10] || 0).replace(/[^0-9.-]/g, '')) || 0;
              const pk = Number(String(row[11] || 0).replace(/[^0-9.-]/g, '')) || 0;
              row[13] = String(dt - pk); // loi_nhuan
            }
          });
        }

        // 2. Nếu ĐÃ TỒN TẠI -> CẬP NHẬT CHÍNH XÁC VÀO CÁC DÒNG ĐÓ
        if (matchingRowNums.length > 0) {
          const updateData = [];
          const firstRowNum = matchingRowNums[0];

          for (let i = 0; i < newValues.length; i++) {
            const targetRowNum = (i < matchingRowNums.length) ? matchingRowNums[i] : (firstRowNum + i);
            updateData.push({
              range: `DH!A${targetRowNum}:Y${targetRowNum}`,
              values: [newValues[i]]
            });
          }

          if (updateData.length > 0) {
            const { res: updateRes, data: updateResult } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                valueInputOption: "USER_ENTERED",
                data: updateData
              })
            });
            if (!updateRes.ok) throw new Error(updateResult.error?.message || "Không thể cập nhật dòng trong sheet DH");
            invalidateDhCache();
          }

          sendResponse({
            ok: true,
            updated: true,
            count: newValues.length,
            rowNums: matchingRowNums
          });
          return;
        }

        // 3. Nếu CHƯA TỒN TẠI HOÀN TOÀN -> THÊM MỚI VÀO CUỐI SHEET (THEO TỌA ĐỘ A{startRowNum}:Y{endRowNum})
        const startRowNum = lastUsedRow + 1;
        const endRowNum = startRowNum + newValues.length - 1;
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`DH!A${startRowNum}:Y${endRowNum}`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            values: newValues
          })
        });
        if (!res.ok) throw new Error(data.error?.message || "Không thể ghi vào sheet DH");
        invalidateDhCache();
        sendResponse({ ok: true, updated: false, count: newValues.length });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    });
    return true;
  }

  if (message?.type === "APPEND_DON_HANG") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        await ensureSheetExists("DH", token);
        const validRows = (message.rowDatas || []).filter(r => Array.isArray(r) && (String(r[3] || "").trim() || String(r[4] || "").trim() || String(r[16] || "").trim()));
        if (!validRows.length) throw new Error("Không có dòng hợp lệ để thêm.");
        
        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:AZ")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const rows = (readRes.ok && readData.values) ? readData.values : [];
        let lastUsedRow = 1;
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (r && r.some(cell => String(cell || "").trim())) {
            lastUsedRow = i + 1;
          }
        }
        const startRowNum = lastUsedRow + 1;
        const endRowNum = startRowNum + validRows.length - 1;

        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`DH!A${startRowNum}:Y${endRowNum}`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            values: validRows
          })
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong the ghi vao sheet DH");
        invalidateDhCache();
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "INSERT_NEW_DH_ORDERS_IF_NOT_EXISTS") {
    saveDhOrderQueue = saveDhOrderQueue.catch(() => {}).then(async () => {
      try {
        const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
        await ensureSheetExists("DH", token, sheetId);
        const rawValues = message.values || [];

        const cleanOrderCode = (v) => {
          if (!v) return "";
          let s = String(v).trim();
          s = s.replace(/(?:Copy(?:\s*All)?|Sao\s*ch[eéê]p|SaoChep|Excel|In\s*đơn|In\s*phiếu|\bC\b)+$/gi, '').trim();
          s = s.replace(/copy$/i, '').trim();
          return s;
        };

        // Lọc các dòng hợp lệ có MDH hoặc MVD và làm sạch chuỗi
        const validRows = rawValues.map(r => {
          if (!Array.isArray(r)) return r;
          const cloned = [...r];
          if (cloned[3]) cloned[3] = cleanOrderCode(cloned[3]);
          if (cloned[4]) cloned[4] = cleanOrderCode(cloned[4]);
          if (cloned[24] && cloned[3]) {
            cloned[24] = String(cloned[24]).replace(/Copy$/i, '');
          }
          return cloned;
        }).filter(r => {
          if (!Array.isArray(r) || r.length === 0) return false;
          const mdh = String(r[3] || "").trim();
          const mvd = String(r[4] || "").trim();
          return mdh || mvd;
        });

        if (!validRows.length) {
          sendResponse({ ok: true, total: 0, inserted: 0, updated: 0, skipped: 0, message: "Không có dòng hợp lệ để thêm." });
          return;
        }

        // 1. Đảm bảo có dòng header chuẩn nếu sheet trống
        const { res: headerRes, data: headerData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A1:Y1")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const existingHeaders = headerData?.values?.[0] || [];
        if (!existingHeaders.length || !existingHeaders.some(h => String(h || "").trim())) {
          const defaultHeaders = [
            "gian", "ngay", "ngay_gio", "mdh", "mvd", "tong_tien", "ma_giam_gia",
            "phi_vc", "phu_phi", "thue", "doanh_thu", "phi_khac", "tien_sp", "loi_nhuan",
            "tinh_trang", "trang_thai", "sku", "id_sp", "slg", "don_gia", "thanh_tien",
            "ten_khach", "ng_nhan", "dia_chi", "link_don"
          ];
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A1:Y1")}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ values: [defaultHeaders] })
          });
        }

        // 2. Đọc toàn bộ dữ liệu hiện có trong Sheet DH (cột A đến Y)
        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:Y")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const sheetRows = (readRes.ok && readData.values) ? readData.values : [];
        const headerRow = sheetRows[0] || [];
        let mdhColIdx = 3;
        let mvdColIdx = 4;
        let gianColIdx = 0;
        let linkColIdx = 24;

        headerRow.forEach((h, idx) => {
          const lower = String(h || "").trim().toLowerCase();
          if (lower === "mdh" || lower === "mã đơn hàng" || lower === "ma don hang" || lower === "order sn") mdhColIdx = idx;
          if (lower === "mvd" || lower === "mã vận đơn" || lower === "ma van don" || lower === "tracking no") mvdColIdx = idx;
          if (lower === "gian" || lower === "mã gian" || lower === "ma gian" || lower === "ma_gian") gianColIdx = idx;
          if (lower === "link_don" || lower === "link đơn" || lower === "link don" || lower === "link") linkColIdx = idx;
        });

        const existingMdhRowMap = new Map();
        const existingMvdRowMap = new Map();
        let lastUsedRow = 1;

        for (let i = 1; i < sheetRows.length; i++) {
          const r = sheetRows[i];
          const hasContent = r && r.some(cell => String(cell || "").trim());
          if (hasContent) {
            lastUsedRow = i + 1;
          }
          const rMdh = cleanOrderCode(r[mdhColIdx] || "").toLowerCase();
          const rMvd = cleanOrderCode(r[mvdColIdx] || "").toLowerCase();
          const rowNum = i + 1;

          if (rMdh) {
            if (!existingMdhRowMap.has(rMdh)) existingMdhRowMap.set(rMdh, []);
            existingMdhRowMap.get(rMdh).push({ rowNum, rowData: r });
          }
          if (rMvd) {
            if (!existingMvdRowMap.has(rMvd)) existingMvdRowMap.set(rMvd, []);
            existingMvdRowMap.get(rMvd).push({ rowNum, rowData: r });
          }
        }

        // 3. Phân loại: Thêm mới hoặc Cập nhật bổ sung (MVD / Link / Gian)
        const sheetExistingMdhSet = new Set(existingMdhRowMap.keys());
        const sheetExistingMvdSet = new Set(existingMvdRowMap.keys());
        const newRowsToInsert = [];
        const updateRanges = [];
        const seenExistingOrderKeys = new Set();
        const batchInsertedSignatures = new Set();
        let updatedCount = 0;
        let skippedCount = 0;

        for (const row of validRows) {
          const mdh = String(row[3] || "").trim().toLowerCase();
          const mvd = String(row[4] || "").trim().toLowerCase();
          const sku = String(row[16] || "").trim().toLowerCase();
          const idSp = String(row[17] || "").trim().toLowerCase();
          const slg = String(row[18] || "").trim();
          const link = String(row[24] || "").trim();
          const gian = String(row[0] || "").trim();
          const orderKey = mdh || mvd;

          // Kiểm tra xem đơn hàng đã từng tồn tại trong Sheet DH chưa
          const existsInSheet = (mdh && sheetExistingMdhSet.has(mdh)) || (mvd && sheetExistingMvdSet.has(mvd));

          if (existsInSheet) {
            // Đơn hàng ĐÃ CÓ trong Sheet DH -> KHÔNG thêm dòng mới (chỉ thêm 1 lần thôi)
            // Chỉ cập nhật bổ sung MVD, Link, Mã gian nếu dòng cũ còn thiếu
            if (!seenExistingOrderKeys.has(orderKey)) {
              seenExistingOrderKeys.add(orderKey);
              const existingMatches = (mdh ? existingMdhRowMap.get(mdh) : null) || (mvd ? existingMvdRowMap.get(mvd) : null) || [];
              let didUpdate = false;
              for (const match of existingMatches) {
                const exRow = match.rowData;
                const exRowNum = match.rowNum;
                const exMvd = String(exRow[mvdColIdx] || "").trim();
                const exLink = String(exRow[linkColIdx] || "").trim();
                const exGian = String(exRow[gianColIdx] || "").trim();

                // Bổ sung MVD nếu dòng cũ chưa có
                if (!exMvd && row[4]) {
                  updateRanges.push({
                    range: `DH!${String.fromCharCode(65 + mvdColIdx)}${exRowNum}`,
                    values: [[row[4]]]
                  });
                  exRow[mvdColIdx] = row[4];
                  didUpdate = true;
                }
                // Bổ sung Link đơn nếu dòng cũ chưa có
                if (!exLink && link) {
                  updateRanges.push({
                    range: `DH!${String.fromCharCode(65 + linkColIdx)}${exRowNum}`,
                    values: [[link]]
                  });
                  exRow[linkColIdx] = link;
                  didUpdate = true;
                }
                // Bổ sung Mã Gian nếu dòng cũ chưa có
                if (!exGian && gian) {
                  updateRanges.push({
                    range: `DH!${String.fromCharCode(65 + gianColIdx)}${exRowNum}`,
                    values: [[gian]]
                  });
                  exRow[gianColIdx] = gian;
                  didUpdate = true;
                }
              }
              if (didUpdate) {
                updatedCount++;
              } else {
                skippedCount++;
              }
            }
          } else {
            // Đơn hàng MỚI CHƯA CÓ TRONG SHEET DH
            // Cho phép thêm nhiều sản phẩm / nhiều dòng cho cùng 1 MDH, chống trùng lặp dòng y hệt trong cùng batch
            const rowSig = `${orderKey}__${sku}__${idSp}__${slg}`;
            if (!batchInsertedSignatures.has(rowSig)) {
              batchInsertedSignatures.add(rowSig);
              newRowsToInsert.push(row);
            }
          }
        }

        // 4. Ghi các cập nhật bổ sung vào Sheet
        if (updateRanges.length > 0) {
          const BATCH_UPDATE_SIZE = 100;
          for (let i = 0; i < updateRanges.length; i += BATCH_UPDATE_SIZE) {
            const chunk = updateRanges.slice(i, i + BATCH_UPDATE_SIZE);
            await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                valueInputOption: "USER_ENTERED",
                data: chunk
              })
            });
          }
        }

        // 5. Thêm các dòng mới vào Sheet DH bắt đầu ngay sau dòng cuối cùng có dữ liệu (lastUsedRow)
        if (newRowsToInsert.length > 0) {
          const startRowNum = lastUsedRow + 1;
          const endRowNum = startRowNum + newRowsToInsert.length - 1;
          const { res: putRes, data: putData } = await fetchJsonWithTimeout(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`DH!A${startRowNum}:Y${endRowNum}`)}?valueInputOption=USER_ENTERED`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ values: newRowsToInsert })
            }
          );
          if (!putRes.ok) throw new Error(putData.error?.message || "Lỗi ghi vào sheet DH");
        }

        invalidateDhCache();

        sendResponse({
          ok: true,
          total: validRows.length,
          inserted: newRowsToInsert.length,
          updated: updatedCount,
          skipped: skippedCount,
          newMdhList: newRowsToInsert.map(r => r[3])
        });
      } catch (err) {
        console.error("Lỗi INSERT_NEW_DH_ORDERS_IF_NOT_EXISTS:", err);
        sendResponse({ ok: false, error: err.message });
      }
    });
    return true;
  }

  if (message?.type === "BATCH_SAVE_DH_ORDERS") {
    saveDhOrderQueue = saveDhOrderQueue.catch(() => {}).then(async () => {
      try {
        const [token, sheetId] = await Promise.all([getGoogleAccessToken(), getSpreadsheetId()]);
        await ensureSheetExists("DH", token);
        const rawValues = message.values || [];

        // Lọc nghiêm ngặt: dòng phải có ít nhất MDH (cột 3), MVD (cột 4) hoặc SKU (cột 16)
        const validRows = rawValues.filter(r => {
          if (!Array.isArray(r) || r.length === 0) return false;
          const mdh = String(r[3] || "").trim();
          const mvd = String(r[4] || "").trim();
          const sku = String(r[16] || "").trim();
          return mdh || mvd || sku;
        });

        if (!validRows.length) {
          sendResponse({ ok: false, error: "Không có dòng dữ liệu hợp lệ để lưu." });
          return;
        }

        // 1. Đọc toàn bộ dữ liệu hiện có trong Sheet DH từ cột A đến AZ
        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:AZ")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const sheetRows = (readRes.ok && readData.values) ? readData.values : [];
        const headerRow = sheetRows[0] || [];
        let mdhColIdx = 3;
        let mvdColIdx = 4;
        let tinhTrangColIdx = 14;
        let trangThaiColIdx = 15;

        headerRow.forEach((h, idx) => {
          const lower = String(h || "").trim().toLowerCase();
          if (lower === "mdh" || lower.includes("mã đơn") || lower.includes("ma don") || lower === "order sn") mdhColIdx = idx;
          if (lower === "mvd" || lower.includes("mã vận") || lower.includes("ma van") || lower === "tracking") mvdColIdx = idx;
          if (lower === "tinh_trang" || lower.includes("tình trạng")) tinhTrangColIdx = idx;
          if (lower === "trang_thai" || lower.includes("trạng thái")) trangThaiColIdx = idx;
        });

        const existingMdhMap = new Map();
        const existingMvdMap = new Map();
        const existingStatusMap = new Map();
        let lastUsedRow = 1;

        for (let i = 1; i < sheetRows.length; i++) {
          const r = sheetRows[i];
          if (r && r.some(cell => String(cell || "").trim())) {
            lastUsedRow = i + 1;
          }
          const rMdh = String(r[mdhColIdx] || "").trim().toLowerCase();
          const rMvd = String(r[mvdColIdx] || "").trim().toLowerCase();
          const rTinhTrang = String(r[tinhTrangColIdx] || "").trim();
          const rTrangThai = String(r[trangThaiColIdx] || "").trim();
          const rowNum = i + 1;

          if (rMdh) {
            if (!existingMdhMap.has(rMdh)) existingMdhMap.set(rMdh, []);
            existingMdhMap.get(rMdh).push(rowNum);
            if (!existingStatusMap.has(rMdh) && (rTinhTrang || rTrangThai)) {
              existingStatusMap.set(rMdh, { tinhTrang: rTinhTrang, trangThai: rTrangThai });
            }
          }
          if (rMvd) {
            if (!existingMvdMap.has(rMvd)) existingMvdMap.set(rMvd, []);
            existingMvdMap.get(rMvd).push(rowNum);
            if (!existingStatusMap.has(rMvd) && (rTinhTrang || rTrangThai)) {
              existingStatusMap.set(rMvd, { tinhTrang: rTinhTrang, trangThai: rTrangThai });
            }
          }
        }

        // 2. Nhóm các dòng gửi lên theo MDH / MVD
        const orderGroups = new Map();
        validRows.forEach(row => {
          const mdh = String(row[3] || "").trim();
          const mvd = String(row[4] || "").trim();
          const groupKey = (mdh || mvd || "__unknown__").toLowerCase();
          if (!orderGroups.has(groupKey)) orderGroups.set(groupKey, []);
          orderGroups.get(groupKey).push(row);
        });

        const updateRanges = [];
        const appendRows = [];
        let updatedCount = 0;
        let insertedCount = 0;

        orderGroups.forEach((rowsInGroup, groupKey) => {
          const matchRowNums = existingMdhMap.get(groupKey) || existingMvdMap.get(groupKey);
          const oldStatusObj = existingStatusMap.get(groupKey);

          if (matchRowNums && matchRowNums.length > 0) {
            // Nếu đơn trong Sheet đã có trạng thái Hủy/Hoàn/Trả/Custom -> Bảo toàn trạng thái
            if (oldStatusObj) {
              const statusToCheck = oldStatusObj.trangThai || oldStatusObj.tinhTrang;
              if (isModifiedStatusText(statusToCheck)) {
                rowsInGroup.forEach(row => {
                  if (!row[14] && oldStatusObj.tinhTrang) row[14] = oldStatusObj.tinhTrang;
                  if (!row[15] && oldStatusObj.trangThai) row[15] = oldStatusObj.trangThai;

                  if (/hủy|huy/i.test(statusToCheck)) {
                    row[10] = "0";
                    row[12] = "0";
                    row[13] = "0";
                  } else if (/hoàn|hoan|trả|tra/i.test(statusToCheck)) {
                    row[12] = "0";
                    const dt = Number(String(row[10] || 0).replace(/[^0-9.-]/g, '')) || 0;
                    const pk = Number(String(row[11] || 0).replace(/[^0-9.-]/g, '')) || 0;
                    row[13] = String(dt - pk);
                  }
                });
              }
            }

            // Đã tồn tại -> Cập nhật các dòng hiện có
            for (let i = 0; i < matchRowNums.length; i++) {
              const rowNum = matchRowNums[i];
              if (i < rowsInGroup.length) {
                updateRanges.push({
                  range: `DH!A${rowNum}:Y${rowNum}`,
                  values: [rowsInGroup[i]]
                });
                updatedCount++;
              } else {
                // Xóa bớt dòng thừa nếu đơn mới ít dòng hơn đơn cũ
                updateRanges.push({
                  range: `DH!A${rowNum}:Y${rowNum}`,
                  values: [new Array(25).fill("")]
                });
              }
            }
            // Nếu đơn mới có nhiều dòng chi tiết hơn đơn cũ, đưa các dòng thừa vào appendRows
            if (rowsInGroup.length > matchRowNums.length) {
              const remainder = rowsInGroup.slice(matchRowNums.length);
              appendRows.push(...remainder);
              insertedCount += remainder.length;
            }
          } else {
            // Đơn mới hoàn toàn -> Thêm mới
            appendRows.push(...rowsInGroup);
            insertedCount += rowsInGroup.length;
          }
        });

        // 3. Thực hiện cập nhật các dòng theo lô (batchUpdate mỗi lô 500 ranges)
        const BATCH_SIZE = 500;
        for (let i = 0; i < updateRanges.length; i += BATCH_SIZE) {
          const chunk = updateRanges.slice(i, i + BATCH_SIZE);
          const { res: batchRes, data: batchData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              valueInputOption: "USER_ENTERED",
              data: chunk
            })
          });
          if (!batchRes.ok) {
            console.error("Lỗi batchUpdate sheet DH:", batchData);
          }
        }

        // 4. Thực hiện Ghi các dòng mới vào Sheet DH theo tọa độ chính xác A{startRowNum}:Y{endRowNum}
        if (appendRows.length > 0) {
          let currentInsertRow = lastUsedRow + 1;
          for (let i = 0; i < appendRows.length; i += BATCH_SIZE) {
            const chunk = appendRows.slice(i, i + BATCH_SIZE);
            const chunkStart = currentInsertRow;
            const chunkEnd = chunkStart + chunk.length - 1;
            const { res: appendRes, data: appendData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`DH!A${chunkStart}:Y${chunkEnd}`)}?valueInputOption=USER_ENTERED`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                values: chunk
              })
            });
            if (!appendRes.ok) {
              console.error("Lỗi ghi dòng mới sheet DH:", appendData);
              throw new Error(appendData.error?.message || "Lỗi ghi dòng mới vào sheet DH");
            }
            currentInsertRow = chunkEnd + 1;
          }
        }

        invalidateDhCache();
        sendResponse({
          ok: true,
          total: validRows.length,
          updated: updatedCount,
          inserted: insertedCount
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    });
    return true;
  }

  if (message?.type === "SCHEDULE_AUTO_BOOST_ALARM") {
    scheduleDailyAutoBoostAlarms(message.scheduleTimes);
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "CANCEL_AUTO_BOOST_ALARM") {
    clearAutoBoostAlarms();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "RUN_AUTO_BOOST_NOW") {
    runAutoBoostJob(message.productIds, message.maxSlots || 5);
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "SAVE_WEB_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        await ensureSheetExists("WEB_SP", token, sheetId);
        const validRows = (message.values || []).filter(r => Array.isArray(r) && r.some(cell => String(cell ?? "").trim() !== ""));
        if (!validRows.length) throw new Error("Không có dữ liệu hợp lệ để lưu WEB_SP.");

        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A:AZ")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const existingRows = (readRes.ok && readData.values) ? readData.values : [];
        let lastUsedRow = 0;
        for (let i = 0; i < existingRows.length; i++) {
          const r = existingRows[i];
          if (r && r.some(cell => String(cell ?? "").trim() !== "")) {
            lastUsedRow = i + 1;
          }
        }

        if (lastUsedRow === 0) {
          const webSpHeaders = [["id", "gian", "sku", "phan_loai", "ten_sp", "nganh_hang", "mo_ta", "anh", "anh_mota", "anh_phan_loai", "link_video", "gia", "gia_khuyen_mai", "item_id", "link_shopee"]];
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A1:O1")}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: webSpHeaders })
          });
          lastUsedRow = 1;
        }

        const startRowNum = lastUsedRow + 1;
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`WEB_SP!A${startRowNum}`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: validRows })
        });
        if (!res.ok) throw new Error(data.error?.message || "Không ghi được vào WEB_SP.");
        sendResponse({ ok: true, count: validRows.length });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "DELETE_WEB_SP_ROWS") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        await ensureSheetExists("WEB_SP", token, sheetId);
        const { res: readRes, data: readData } = await fetchJsonWithTimeout(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A:AZ")}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!readRes.ok || !readData.values || readData.values.length <= 1) {
          sendResponse({ ok: true, deleted: 0 });
          return;
        }

        const rows = readData.values;
        const header = rows[0];
        const headers = header.map(h => String(h || "").trim().toLowerCase());
        let idIdx = headers.findIndex(h => h === "id" || h.includes("mã sp"));
        if (idIdx === -1) idIdx = 0;
        let skuIdx = headers.findIndex(h => h === "sku" || h.includes("mã sku"));
        if (skuIdx === -1) skuIdx = 2;
        let plIdx = headers.findIndex(h => h === "phan_loai" || h.includes("phân loại"));
        if (plIdx === -1) plIdx = 3;

        const idsToDelete = new Set((message.ids || []).map(id => String(id || "").trim()).filter(Boolean));
        const keysToDelete = new Set((message.keys || []).map(k => String(k || "").trim().toLowerCase()).filter(Boolean));

        const remainingRows = [header];
        let deletedCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowId = String(row[idIdx] || "").trim();
          const rowSku = String(row[skuIdx] || "").trim().toLowerCase();
          const rowPl = String(row[plIdx] || "").trim().toLowerCase();
          const rowKey = `${rowSku}|${rowPl}`;

          const shouldDelete = (rowId && idsToDelete.has(rowId)) || keysToDelete.has(rowKey) || (rowSku && keysToDelete.has(rowSku));
          if (shouldDelete) {
            deletedCount++;
          } else {
            remainingRows.push(row);
          }
        }

        // Xóa trắng dữ liệu cũ trong Sheet WEB_SP
        await fetchJsonWithTimeout(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A:AZ")}:clear`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        // Ghi lại danh sách còn lại
        if (remainingRows.length > 0) {
          await updateSheetValues("WEB_SP!A1", remainingRows, token);
        }

        sendResponse({ ok: true, deleted: deletedCount, remaining: remainingRows.length - 1 });
      })
      .catch(error => {
        console.error("Lỗi DELETE_WEB_SP_ROWS:", error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message?.type === "APPEND_DS_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        await ensureSheetExists("DS_SP", token, sheetId);
        const validRows = (message.rowDatas || []).filter(r => Array.isArray(r) && r.some(cell => String(cell ?? "").trim() !== ""));
        if (!validRows.length) throw new Error("Không có dữ liệu hợp lệ để thêm vào DS_SP.");

        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DS_SP!A:AZ")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const existingRows = (readRes.ok && readData.values) ? readData.values : [];
        let lastUsedRow = 0;
        for (let i = 0; i < existingRows.length; i++) {
          const r = existingRows[i];
          if (r && r.some(cell => String(cell ?? "").trim() !== "")) {
            lastUsedRow = i + 1;
          }
        }
        if (lastUsedRow === 0) lastUsedRow = 1;

        const startRowNum = lastUsedRow + 1;
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`DS_SP!A${startRowNum}`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: validRows })
        });
        if (!res.ok) throw new Error(data.error?.message || "Không thêm được vào DS_SP.");
        sendResponse({ ok: true, data });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "APPEND_SP_SHOPEE" || message?.type === "UPSERT_SP_SHOPEE") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        await ensureSheetExists("SP_SHOPEE", token, sheetId);
        const validRows = (message.values || []).filter(r => Array.isArray(r) && r.some(cell => String(cell ?? "").trim() !== ""));
        if (!validRows.length) throw new Error("Không có dữ liệu hợp lệ để thêm vào SP_SHOPEE.");

        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A:AZ")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const existingRows = (readRes.ok && readData.values) ? readData.values : [];
        let lastUsedRow = 0;
        for (let i = 0; i < existingRows.length; i++) {
          const r = existingRows[i];
          if (r && r.some(cell => String(cell ?? "").trim() !== "")) {
            lastUsedRow = i + 1;
          }
        }

        if (lastUsedRow === 0) {
          const defaultHeaders = [["Mã Sản phẩm", "Tên Sản phẩm", "Mã Phân loại", "Tên phân loại", "SKU Sản phẩm", "SKU", "Giá", "Kho hàng", "Tồn kho thực tế", "", "", "Mã gian", "Giá KM", "Tồn kho", "Ngày tạo"]];
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("SP_SHOPEE!A1:O1")}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: defaultHeaders })
          });
          lastUsedRow = 1;
        }

        const toUpdate = [];
        const toAppend = [];

        for (const vRow of validRows) {
          const incomingItemId = String(vRow[0] ?? "").trim();
          const incomingModelId = String(vRow[2] ?? "").trim();

          let foundIdx = -1;
          for (let i = 1; i < existingRows.length; i++) {
            const ex = existingRows[i];
            if (!ex) continue;
            const exItemId = String(ex[0] ?? "").trim();
            const exModelId = String(ex[2] ?? "").trim();

            if (incomingItemId && exItemId === incomingItemId) {
              if (!incomingModelId && !exModelId) {
                foundIdx = i;
                break;
              } else if (incomingModelId && exModelId === incomingModelId) {
                foundIdx = i;
                break;
              }
            }
          }

          if (foundIdx > 0) {
            toUpdate.push({ rowNum: foundIdx + 1, values: vRow });
          } else {
            toAppend.push(vRow);
          }
        }

        for (const item of toUpdate) {
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`SP_SHOPEE!A${item.rowNum}:O${item.rowNum}`)}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: [item.values] })
          });
        }

        if (toAppend.length > 0) {
          const startRowNum = lastUsedRow + 1;
          const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`SP_SHOPEE!A${startRowNum}`)}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ values: toAppend })
          });
          if (!res.ok) throw new Error(data.error?.message || "Không thêm được vào SP_SHOPEE.");
        }

        sendResponse({ ok: true, updated: toUpdate.length, appended: toAppend.length });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "APPEND_WEB_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        await ensureSheetExists("WEB_SP", token, sheetId);
        const validRows = (message.values || []).filter(r => Array.isArray(r) && r.some(cell => String(cell ?? "").trim() !== ""));
        if (!validRows.length) throw new Error("Không có dữ liệu hợp lệ để thêm vào sheet WEB_SP.");

        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A:O")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const existingRows = (readRes.ok && readData.values) ? readData.values : [];
        let lastUsedRow = 0;
        for (let i = 0; i < existingRows.length; i++) {
          const r = existingRows[i];
          if (r && r.some(cell => String(cell ?? "").trim() !== "")) {
            lastUsedRow = i + 1;
          }
        }

        if (lastUsedRow === 0) {
          const defaultHeaders = [["ID", "Mã gian", "SKU phân loại", "Tên phân loại", "Tên sản phẩm", "Ngành hàng", "Mô tả sản phẩm", "Ảnh chính", "Ảnh mô tả", "Ảnh phân loại", "Video", "Giá", "Giá KM", "ID Shopee", "Link sản phẩm"]];
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A1:O1")}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: defaultHeaders })
          });
          lastUsedRow = 1;
        }

        const startRowNum = lastUsedRow + 1;
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`WEB_SP!A${startRowNum}`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: validRows })
        });
        if (!res.ok) throw new Error(data.error?.message || "Không thêm được vào WEB_SP.");
        sendResponse({ ok: true, data });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "APPEND_QUET_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        const metadata = await fetchSpreadsheetMetadata(token, sheetId);
        const found = (metadata.sheets || []).find((s) => {
          const t = (s.properties?.title || "").trim().toLowerCase();
          return t === "quet_sp" || t === "quet sp" || t === "quét sp" || t === "quét_sp" || t === "quet_shop" || t === "quét shop" || t === "quet shop" || t.includes("quet_sp") || t.includes("quet_shop");
        });
        const targetSheetTitle = found ? found.properties.title : "QUET_SP";

        await ensureSheetExists(targetSheetTitle, token, sheetId);

        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${targetSheetTitle}!A:AZ`)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const existingRows = (readRes.ok && readData.values) ? readData.values : [];
        let lastUsedRow = 0;
        for (let i = 0; i < existingRows.length; i++) {
          const r = existingRows[i];
          if (r && r.some(cell => String(cell ?? "").trim() !== "")) {
            lastUsedRow = i + 1;
          }
        }

        let headerRow = (existingRows.length > 0 && Array.isArray(existingRows[0])) ? existingRows[0] : null;

        if (!headerRow || !headerRow.length) {
          headerRow = [
            "ID", "Tên shop", "ID Shopee", "Tên sản phẩm", "Tên phân loại", "SKU phân loại",
            "Giá gốc", "Giá KM", "Tồn kho", "Đã bán", "Đánh giá", "Ngành hàng",
            "Thương hiệu", "Link sản phẩm", "Ảnh phân loại", "Ảnh chính", "Ảnh mô tả",
            "Video", "Mô tả sản phẩm", "Thời gian lưu", "Voucher của Shop", "Giá sau Shopee Voucher"
          ];
          await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${targetSheetTitle}!A1:V1`)}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: [headerRow] })
          });
          lastUsedRow = 1;
        } else {
          // If existing header doesn't have voucher columns, append them to row 1
          const hasVoucher = headerRow.some(h => {
            const lower = String(h || '').toLowerCase();
            return lower.includes('voucher') || lower.includes('giá sau');
          });
          if (!hasVoucher) {
            headerRow.push("Voucher của Shop", "Giá sau Shopee Voucher");
            await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${targetSheetTitle}!A1:AZ1`)}?valueInputOption=USER_ENTERED`, {
              method: "PUT",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ values: [headerRow] })
            });
          }
        }

        function mapFieldByHeader(h) {
          const s = String(h || '').trim().toLowerCase();
          if (s === 'id') return 'id';
          if (s === 'tên shop' || s === 'ten shop' || s === 'shop') return 'shopName';
          if (s === 'id shopee' || s === 'id sản phẩm' || s === 'mã sản phẩm' || s === 'ma san pham') return 'itemId';
          if (s === 'tên sản phẩm' || s === 'ten san pham' || s === 'tên sp') return 'name';
          if (s === 'tên phân loại' || s === 'ten phan loai' || s === 'phân loại') return 'modelName';
          if (s === 'sku phân loại' || s === 'sku') return 'sku';
          if (s === 'giá gốc' || s === 'gia goc' || s === 'giá bán' || s === 'giá') return 'price';
          if (s === 'giá km' || s === 'gia km') return 'promoPrice';
          if (s === 'voucher của shop' || s === 'voucher') return 'voucherDesc';
          if (s === 'giá sau shopee voucher' || s === 'giá sau voucher') return 'priceAfterVoucher';
          if (s === 'tồn kho' || s === 'ton kho' || s === 'kho hàng' || s === 'kho') return 'stock';
          if (s === 'đã bán' || s === 'da ban') return 'sold';
          if (s === 'đánh giá' || s === 'danh gia') return 'rating';
          if (s === 'ngành hàng' || s === 'nganh hang') return 'category';
          if (s === 'thương hiệu' || s === 'thuong hieu') return 'brand';
          if (s === 'link sản phẩm' || s === 'link') return 'url';
          if (s === 'ảnh phân loại' || s === 'anh phan loai') return 'modelImg';
          if (s === 'ảnh chính' || s === 'anh chinh') return 'mainImages';
          if (s === 'ảnh mô tả' || s === 'anh mo ta') return 'descImages';
          if (s === 'video') return 'video';
          if (s === 'mô tả sản phẩm' || s === 'mo ta san pham' || s === 'mô tả' || s === 'mo ta') return 'description';
          if (s === 'thời gian lưu' || s === 'thoi gian luu' || s === 'thời gian' || s === 'thoi gian') return 'timestamp';
          return null;
        }

        const validRows = (message.values || []).map(item => {
          if (!item) return [];
          if (Array.isArray(item)) return item;
          if (typeof item === 'object') {
            return headerRow.map(h => {
              const field = mapFieldByHeader(h);
              return field ? (item[field] ?? '') : '';
            });
          }
          return [];
        }).filter(r => Array.isArray(r) && r.length > 0 && r.some(cell => String(cell ?? "").trim() !== ""));

        if (!validRows.length) throw new Error("Không có dữ liệu hợp lệ để thêm vào sheet " + targetSheetTitle);

        const startRowNum = lastUsedRow + 1;
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${targetSheetTitle}!A${startRowNum}`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: validRows })
        });
        if (!res.ok) throw new Error(data.error?.message || `Không thêm được vào ${targetSheetTitle}.`);
        sendResponse({ ok: true, data, sheetTitle: targetSheetTitle, count: validRows.length });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_SAVED_QUET_SP_IDS") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        const metadata = await fetchSpreadsheetMetadata(token, sheetId);
        const found = (metadata.sheets || []).find((s) => {
          const t = (s.properties?.title || "").trim().toLowerCase();
          return t === "quet_sp" || t === "quet sp" || t === "quét sp" || t === "quét_sp" || t === "quet_shop";
        });
        if (!found) {
          sendResponse({ ok: true, savedIds: [], sheetTitle: "QUET_SP" });
          return;
        }
        const targetSheetTitle = found.properties.title;
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${targetSheetTitle}!C2:C`)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const savedIds = [];
        if (res.ok && Array.isArray(data.values)) {
          data.values.forEach(row => {
            const id = String(row[0] || "").trim();
            if (id && !savedIds.includes(id)) savedIds.push(id);
          });
        }
        sendResponse({ ok: true, savedIds, sheetTitle: targetSheetTitle });
      })
      .catch(err => sendResponse({ ok: false, error: err.message, savedIds: [] }));
    return true;
  }

  if (message?.type === "UPDATE_DON_HANG_ROWS") {
    getGoogleAccessToken().then(async token => {
      try {
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: message.updateData // Array of ValueRange objects
          })
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong the cap nhat vao sheet DH");
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "UPDATE_DON_HANG_VALUES") {
    getGoogleAccessToken()
      .then(async (token) => {
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: message.data
          })
        });
        if (!res.ok) throw new Error(data.error?.message || "Loi khi update sheet");
        return data;
      })
      .then(data => sendResponse({ ok: true, data }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  async function handleSaveDhOrder(token, sheetId, payload) {
    const values = payload?.values || [];
    if (!values.length) return { ok: false, error: "Không có dòng dữ liệu." };
    await ensureSheetExists("DH", token, sheetId);
    
    const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:AZ")}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const sheetRows = (readRes.ok && readData.values) ? readData.values : [];
    let lastUsedRow = 1;
    for (let i = 1; i < sheetRows.length; i++) {
      if (sheetRows[i] && sheetRows[i].some(cell => String(cell || "").trim())) {
        lastUsedRow = i + 1;
      }
    }
    const startRowNum = lastUsedRow + 1;
    const endRowNum = startRowNum + values.length - 1;

    const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`DH!A${startRowNum}:AA${endRowNum}`)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values })
    });
    if (!res.ok) throw new Error(data.error?.message || "Không thể lưu mới đơn hàng vào Sheet DH.");
    invalidateDhCache();
    return { ok: true, count: values.length };
  }

  async function updateDhOrderReturnInfo(message, token, sheetId) {
    await ensureSheetExists("DH", token, sheetId);
    
    // 1. Đảm bảo header Z1 và AA1 đã có trong sheet DH
    try {
      const { res: hRes, data: hData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!Z1:AA1")}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const headerVals = (hRes.ok && hData.values && hData.values[0]) ? hData.values[0] : [];
      if (!headerVals[0] || !headerVals[1]) {
        await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!Z1:AA1")}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            values: [["ma_yc_tra_hang", "vc_hang_hoan"]]
          })
        });
      }
    } catch (err) {
      console.warn("Lỗi kiểm tra header Z1:AA1:", err);
    }

    // 2. Đọc cột A:P từ sheet DH
    const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:P")}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(data.error?.message || "Không thể đọc dữ liệu Sheet DH");
    const rows = data.values || [];
    const statusVal = String(message.status || "").trim();
    const returnIdVal = String(message.returnId || "").trim();
    const trackingVal = String(message.tracking || "").trim();

    let reqOrderId = String(message.orderId || "").trim().toLowerCase();
    reqOrderId = reqOrderId.replace(/copy|sao\s*ch[eé]p|m[aã]\s*([đd][oơ]n\s*h[aà]ng|y[eê]u\s*c[aầ]u\s*tr[aả]\s*h[aà]ng)/gi, " ").trim();
    const mReq = reqOrderId.match(/([0-9]{6}[a-z0-9]{7,14})/i);
    if (mReq) reqOrderId = mReq[1].toLowerCase();
    const reqGian = String(message.maGian || message.noidung || "").trim().toLowerCase();

    if (rows.length <= 1) {
      return {
        ok: true,
        skipped: true,
        notFound: true,
        message: `Mã đơn "${reqOrderId ? reqOrderId.toUpperCase() : trackingVal}" không có trong Sheet DH, đã bỏ qua.`
      };
    }

    const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
    let mdhIdx = headers.findIndex(h => h === "mdh" || h.includes("mã đơn") || h.includes("ma don") || h === "order sn");
    if (mdhIdx === -1) mdhIdx = 3;
    let gianIdx = headers.findIndex(h => h === "gian" || h.includes("mã gian") || h.includes("ma gian"));
    if (gianIdx === -1) gianIdx = 0;

    if (!reqOrderId && !trackingVal) {
      throw new Error("Không có Mã đơn hàng hoặc Mã vận đơn để cập nhật.");
    }

    // 3. Tìm các dòng khớp mã đơn hàng (và mã gian nếu có)
    let matchingRows = [];

    const isCodeMatch = (cellVal, targetCode) => {
      if (!cellVal || !targetCode) return false;
      const c = String(cellVal).trim().toLowerCase();
      const t = String(targetCode).trim().toLowerCase();
      if (!c || !t || c.length < 6 || t.length < 6) return false;
      if (c === t) return true;
      const clean = (s) => s.replace(/copy|sao\s*ch[eéê]p/gi, " ").trim();
      const m1 = clean(c).match(/([0-9]{6}[a-z0-9]{6,16})/i) || clean(c).match(/([a-z0-9]{10,25})/i);
      const m2 = clean(t).match(/([0-9]{6}[a-z0-9]{6,16})/i) || clean(t).match(/([a-z0-9]{10,25})/i);
      return Boolean(m1 && m2 && m1[1].toLowerCase() === m2[1].toLowerCase());
    };

    // Ưu tiên 1: Nếu client có truyền rowNum / rowNums cụ thể, kiểm tra dòng đó trước
    const explicitRowNums = (Array.isArray(message.rowNums) ? message.rowNums : [message.rowNum, message.rowOriginalIndex])
      .map(n => Number(n))
      .filter(n => !isNaN(n) && n >= 2);

    for (const rowNum of explicitRowNums) {
      if (rowNum <= rows.length) {
        const r = rows[rowNum - 1] || [];
        const rMdh = String(r[mdhIdx] || "").trim();
        const rMvd = String(r[4] || "").trim();
        if ((reqOrderId && isCodeMatch(rMdh, reqOrderId)) || (trackingVal && isCodeMatch(rMvd, trackingVal))) {
          if (!matchingRows.some(m => m.rowNum === rowNum)) {
            matchingRows.push({ rowNum, rowData: r });
          }
        }
      }
    }

    if (matchingRows.length === 0) {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const rowGian = String(r[gianIdx] || "").trim().toLowerCase();
        const rowMdh = String(r[mdhIdx] || "").trim();
        const rowMvd = String(r[4] || "").trim();
        const rowNum = i + 1;

        if ((reqOrderId && isCodeMatch(rowMdh, reqOrderId)) || (trackingVal && isCodeMatch(rowMvd, trackingVal))) {
          if (!reqGian || rowGian === reqGian || !rowGian) {
            matchingRows.push({ rowNum, rowData: r });
          }
        }
      }
    }

    // Nếu lọc theo cả gian không thấy, fallback tìm theo mã đơn hàng bất kể gian
    if (matchingRows.length === 0) {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const rowMdh = String(r[mdhIdx] || "").trim();
        const rowMvd = String(r[4] || "").trim();
        const rowNum = i + 1;
        if ((reqOrderId && isCodeMatch(rowMdh, reqOrderId)) || (trackingVal && isCodeMatch(rowMvd, trackingVal))) {
          matchingRows.push({ rowNum, rowData: r });
        }
      }
    }

    // Nếu đơn hàng CHƯA CÓ TRONG SHEET DH -> BỎ QUA, KHÔNG LƯU MỚI VÀO SHEET DH
    if (matchingRows.length === 0) {
      return { 
        ok: true, 
        skipped: true,
        notFound: true,
        message: `Mã đơn "${reqOrderId ? reqOrderId.toUpperCase() : trackingVal}" không có trong Sheet DH, đã bỏ qua.` 
      };
    }

    const isHuy = statusVal === "Hủy" || statusVal === "HỦY" || /^h[uủ]y$/i.test(statusVal);
    const isHoan = statusVal === "Hoàn" || statusVal === "HOÀN" || /^ho[aà]n$/i.test(statusVal);
    const isTra = statusVal === "Trả" || statusVal === "TRẢ" || /^tr[aả]$/i.test(statusVal);

    // QUY TẮC CẬP NHẬT TRẠNG THÁI:
    // 1. Khi ấn HỦY: CHỈ cập nhật đơn nào CHƯA CẬP NHẬT TRẠNG THÁI (chưa có tinh_trang hoặc trạng thái tùy chỉnh)!
    //    Nếu đơn đã có trạng thái rồi -> BỎ QUA không ghi đè!
    // 2. Khi ấn HOÀN hoặc TRẢ: Cứ CÓ ĐƠN NÀY trong Sheet DH là CẬP NHẬT TRẠNG THÁI ĐƠN ĐÓ!
    if (isHuy) {
      const rowsToUpdate = matchingRows.filter(m => {
        const existingTinhTrang = String(m.rowData[14] || "").trim();
        const existingTrangThai = String(m.rowData[15] || "").trim();
        return !existingTinhTrang && !isModifiedStatusText(existingTrangThai || existingTinhTrang);
      });

      if (rowsToUpdate.length === 0) {
        const existingStatus = matchingRows.find(m => m.rowData[14] || m.rowData[15])?.rowData[14] || matchingRows[0]?.rowData[15] || "đã có trạng thái";
        return {
          ok: true,
          skipped: true,
          alreadyUpdated: true,
          message: `Mã đơn "${reqOrderId ? reqOrderId.toUpperCase() : trackingVal}" đã cập nhật trạng thái (${existingStatus}) rồi! Chỉ cập nhật đơn nào chưa cập nhật trạng thái thôi.`
        };
      }
      matchingRows = rowsToUpdate;
    }

    // 4. Cập nhật các cột theo trạng thái (Hủy: tinh_trang=Hủy, doanh_thu=0, tien_sp=0; Hoàn: tinh_trang=hoàn, trang_thai="", tien_sp=0; Trả: tinh_trang=TRẢ, tien_sp=0)
    const updateData = [];

    const parseNum = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === "number") return val;
      const d = String(val).replace(/[^0-9.-]/g, "");
      return d ? Number(d) : 0;
    };

    for (const item of matchingRows) {
      const { rowNum, rowData } = item;

      if (isHuy) {
        // Hủy: tinh_trang = "HỦY", trang_thai = "", doanh_thu = 0, tien_sp = 0, loi_nhuan = 0
        updateData.push({
          range: `DH!K${rowNum}`,
          values: [[0]]
        });
        updateData.push({
          range: `DH!M${rowNum}:P${rowNum}`,
          values: [[0, 0, "HỦY", ""]]
        });
      } else if (isHoan) {
        // Hoàn: tinh_trang = "HOÀN", trang_thai = "", tien_sp = 0, loi_nhuan = doanh_thu - phi_khac
        let dt = parseNum(rowData[10]);
        const pk = parseNum(rowData[11]);
        if (dt === 0) {
          const tongTien = parseNum(rowData[5]);
          const maGiamGia = parseNum(rowData[6]);
          const phiVc = parseNum(rowData[7]);
          const phuPhi = parseNum(rowData[8]);
          const thue = parseNum(rowData[9]);
          if (tongTien > 0) {
            dt = tongTien - maGiamGia - phiVc - phuPhi - thue;
            updateData.push({
              range: `DH!K${rowNum}`,
              values: [[dt]]
            });
          }
        }
        const newLoiNhuan = dt - pk;
        updateData.push({
          range: `DH!M${rowNum}:P${rowNum}`,
          values: [[0, newLoiNhuan, "HOÀN", ""]]
        });
      } else if (isTra) {
        // Trả: tinh_trang = "TRẢ", trang_thai = "", tien_sp = 0, loi_nhuan = doanh_thu - phi_khac
        let dt = parseNum(rowData[10]);
        const pk = parseNum(rowData[11]);
        if (dt === 0) {
          const tongTien = parseNum(rowData[5]);
          const maGiamGia = parseNum(rowData[6]);
          const phiVc = parseNum(rowData[7]);
          const phuPhi = parseNum(rowData[8]);
          const thue = parseNum(rowData[9]);
          if (tongTien > 0) {
            dt = tongTien - maGiamGia - phiVc - phuPhi - thue;
            updateData.push({
              range: `DH!K${rowNum}`,
              values: [[dt]]
            });
          }
        }
        const newLoiNhuan = dt - pk;
        updateData.push({
          range: `DH!M${rowNum}:P${rowNum}`,
          values: [[0, newLoiNhuan, "TRẢ", ""]]
        });
      } else if (statusVal) {
        updateData.push({
          range: `DH!O${rowNum}`,
          values: [[statusVal.toUpperCase()]]
        });
      }

      if (returnIdVal || trackingVal) {
        updateData.push({
          range: `DH!Z${rowNum}:AA${rowNum}`,
          values: [[returnIdVal, trackingVal]]
        });
      }
    }

    if (updateData.length > 0) {
      const { res: updateRes, data: updateResult } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: updateData
        })
      });

      if (!updateRes.ok) {
        throw new Error(updateResult.error?.message || "Không thể cập nhật Sheet DH.");
      }
      invalidateDhCache();
    }

    return {
      ok: true,
      updated: true,
      count: matchingRows.length,
      rowNums: matchingRows.map(m => m.rowNum)
    };
  }

  async function updateBatchDhOrderReturnInfo(message, token, sheetId) {
    const orders = Array.isArray(message.orders) ? message.orders : [];
    if (orders.length === 0) {
      throw new Error("Không có danh sách đơn hàng để cập nhật.");
    }

    const statusVal = String(message.status || "").trim();
    const maGian = String(message.maGian || "").trim();

    // 1. Tải toàn bộ Sheet DH
    const { res: getRes, data: getData } = await fetchJsonWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/DH!A:AA`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!getRes.ok) {
      throw new Error(getData.error?.message || "Không thể đọc dữ liệu Sheet DH");
    }

    const rows = getData.values || [];
    if (rows.length === 0) {
      throw new Error("Sheet DH đang trống");
    }

    const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
    let mdhIdx = headers.findIndex(h => h === "mdh" || h.includes("mã đơn") || h.includes("ma don") || h === "order sn");
    if (mdhIdx === -1) mdhIdx = 3;
    let mvdIdx = headers.findIndex(h => h === "mvd" || h.includes("mã vận") || h.includes("ma van") || h === "tracking");
    if (mvdIdx === -1) mvdIdx = 4;

    const isCodeMatch = (cellVal, targetCode) => {
      if (!cellVal || !targetCode) return false;
      const c = String(cellVal).trim().toLowerCase();
      const t = String(targetCode).trim().toLowerCase();
      if (!c || !t || c.length < 6 || t.length < 6) return false;
      if (c === t) return true;
      const clean = (s) => s.replace(/copy|sao\s*ch[eéê]p/gi, " ").trim();
      const m1 = clean(c).match(/([0-9]{6}[a-z0-9]{6,16})/i) || clean(c).match(/([a-z0-9]{10,25})/i);
      const m2 = clean(t).match(/([0-9]{6}[a-z0-9]{6,16})/i) || clean(t).match(/([a-z0-9]{10,25})/i);
      return Boolean(m1 && m2 && m1[1].toLowerCase() === m2[1].toLowerCase());
    };

    const parseNum = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === "number") return val;
      const d = String(val).replace(/[^0-9.-]/g, "");
      return d ? Number(d) : 0;
    };

    // Map nhanh mã đơn -> các dòng trong Sheet DH
    const orderRowMap = new Map();
    let lastUsedRow = 1;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r && r.some(cell => String(cell || "").trim())) {
        lastUsedRow = i + 1;
      }
      const rowMdh = String(r[mdhIdx] || "").trim();
      const rowMvd = String(r[mvdIdx] || "").trim();
      const rowNum = i + 1;

      if (rowMdh) {
        const cleanMdh = rowMdh.toLowerCase();
        if (!orderRowMap.has(cleanMdh)) orderRowMap.set(cleanMdh, []);
        orderRowMap.get(cleanMdh).push({ rowNum, rowData: r });
      }
      if (rowMvd) {
        const cleanMvd = rowMvd.toLowerCase();
        if (!orderRowMap.has(cleanMvd)) orderRowMap.set(cleanMvd, []);
        orderRowMap.get(cleanMvd).push({ rowNum, rowData: r });
      }
    }

    const updateData = [];
    let updatedOrdersCount = 0;
    let skippedOrdersCount = 0;
    let skippedAlreadyUpdatedCount = 0;
    const processedRowNums = new Set();

    const isHuy = statusVal === "Hủy" || statusVal === "HỦY" || /^h[uủ]y$/i.test(statusVal);
    const isHoan = statusVal === "Hoàn" || statusVal === "HOÀN" || /^ho[aà]n$/i.test(statusVal);
    const isTra = statusVal === "Trả" || statusVal === "TRẢ" || /^tr[aả]$/i.test(statusVal);

    for (const item of orders) {
      const oId = String(item.orderId || "").trim();
      const trk = String(item.tracking || "").trim();
      const retId = String(item.returnId || "").trim();

      // Tìm các dòng khớp
      let matchedRows = [];
      if (oId && orderRowMap.has(oId.toLowerCase())) {
        matchedRows = orderRowMap.get(oId.toLowerCase());
      } else if (trk && orderRowMap.has(trk.toLowerCase())) {
        matchedRows = orderRowMap.get(trk.toLowerCase());
      } else {
        // Fuzzy lookup
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const rowMdh = String(r[mdhIdx] || "").trim();
          const rowMvd = String(r[mvdIdx] || "").trim();
          if ((oId && isCodeMatch(rowMdh, oId)) || (trk && isCodeMatch(rowMvd, trk))) {
            matchedRows.push({ rowNum: i + 1, rowData: r });
          }
        }
      }

      if (matchedRows.length > 0) {
        let hasNewUpdate = false;
        let orderAlreadyUpdated = false;

        for (const m of matchedRows) {
          if (processedRowNums.has(m.rowNum)) continue;

          const { rowNum, rowData } = m;
          const existingTinhTrang = String(rowData[14] || "").trim();
          const existingTrangThai = String(rowData[15] || "").trim();
          const isAlreadyUpdated = Boolean(existingTinhTrang || isModifiedStatusText(existingTrangThai || existingTinhTrang));

          if (isHuy) {
            // HỦY: CHỈ cập nhật đơn nào CHƯA CẬP NHẬT TRẠNG THÁI
            if (isAlreadyUpdated) {
              orderAlreadyUpdated = true;
              continue; // Bỏ qua đơn đã cập nhật trạng thái trước đó!
            }
            processedRowNums.add(m.rowNum);
            hasNewUpdate = true;
            updateData.push({ range: `DH!K${rowNum}`, values: [[0]] });
            updateData.push({ range: `DH!M${rowNum}:P${rowNum}`, values: [[0, 0, "HỦY", ""]] });
          } else if (isHoan) {
            // HOÀN: CÓ ĐƠN NÀY LÀ CẬP NHẬT TRẠNG THÁI ĐƠN ĐÓ
            processedRowNums.add(m.rowNum);
            hasNewUpdate = true;
            let dt = parseNum(rowData[10]);
            const pk = parseNum(rowData[11]);
            if (dt === 0) {
              const tongTien = parseNum(rowData[5]);
              const maGiamGia = parseNum(rowData[6]);
              const phiVc = parseNum(rowData[7]);
              const phuPhi = parseNum(rowData[8]);
              const thue = parseNum(rowData[9]);
              if (tongTien > 0) {
                dt = tongTien - maGiamGia - phiVc - phuPhi - thue;
                updateData.push({ range: `DH!K${rowNum}`, values: [[dt]] });
              }
            }
            const newLoiNhuan = dt - pk;
            updateData.push({ range: `DH!M${rowNum}:P${rowNum}`, values: [[0, newLoiNhuan, "HOÀN", ""]] });
          } else if (isTra) {
            // TRẢ: CÓ ĐƠN NÀY LÀ CẬP NHẬT TRẠNG THÁI ĐƠN ĐÓ
            processedRowNums.add(m.rowNum);
            hasNewUpdate = true;
            let dt = parseNum(rowData[10]);
            const pk = parseNum(rowData[11]);
            if (dt === 0) {
              const tongTien = parseNum(rowData[5]);
              const maGiamGia = parseNum(rowData[6]);
              const phiVc = parseNum(rowData[7]);
              const phuPhi = parseNum(rowData[8]);
              const thue = parseNum(rowData[9]);
              if (tongTien > 0) {
                dt = tongTien - maGiamGia - phiVc - phuPhi - thue;
                updateData.push({ range: `DH!K${rowNum}`, values: [[dt]] });
              }
            }
            const newLoiNhuan = dt - pk;
            updateData.push({ range: `DH!M${rowNum}:P${rowNum}`, values: [[0, newLoiNhuan, "TRẢ", ""]] });
          }

          if (retId || trk) {
            updateData.push({ range: `DH!Z${rowNum}:AA${rowNum}`, values: [[retId, trk]] });
          }
        }
        if (hasNewUpdate) {
          updatedOrdersCount++;
        } else if (orderAlreadyUpdated) {
          skippedAlreadyUpdatedCount++;
        }
      } else {
        // Nếu mã đơn hàng không có ở sheet thì bỏ qua
        skippedOrdersCount++;
      }
    }

    if (updateData.length > 0) {
      const { res: updateRes, data: updateResult } = await fetchJsonWithTimeout(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: updateData
          })
        }
      );

      if (!updateRes.ok) {
        throw new Error(updateResult.error?.message || "Không thể cập nhật Sheet DH");
      }
      invalidateDhCache();
    }

    return {
      ok: true,
      updatedCount: updatedOrdersCount,
      skippedCount: skippedOrdersCount,
      skippedAlreadyUpdatedCount: skippedAlreadyUpdatedCount,
      total: orders.length
    };
  }

  if (message?.type === "OPEN_ORDER_IN_NEW_WINDOW") {
    const targetUrl = message.url || `https://banhang.shopee.vn/portal/sale/order/${message.orderId}`;
    const autoCloseDelay = message.autoCloseDelay || 60000;

    chrome.windows.create({
      url: targetUrl,
      type: "normal",
      focused: true
    }, (newWindow) => {
      if (chrome.runtime.lastError || !newWindow) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message || "Không thể mở cửa sổ mới" });
        return;
      }

      const winId = newWindow.id;
      setTimeout(() => {
        chrome.windows.get(winId, (win) => {
          if (!chrome.runtime.lastError && win) {
            chrome.windows.remove(winId, () => {
              console.log(`[Shopee Ext] Đã tự động đóng cửa sổ đơn hàng ${message.orderId || ""} sau 1 phút.`);
            });
          }
        });
      }, autoCloseDelay);

      sendResponse({ ok: true, windowId: winId });
    });
    return true;
  }

  if (message?.type === "UPDATE_DH_RETURN_STATUS" || message?.type === "APPEND_DH_HOAN" || message?.type === "UPDATE_DH_HOAN") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        const result = await updateDhOrderReturnInfo(message, token, sheetId);
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "UPDATE_BATCH_DH_RETURN_STATUS") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        const result = await updateBatchDhOrderReturnInfo(message, token, sheetId);
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "DOWNLOAD_AWB_PDF") {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename || "shopee-awb.pdf",
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, downloadId });
      }
    });
    return true;
  }

  if (message?.type === "OPEN_AND_SEND_WEBCHAT_MESSAGE") {
    const webchatUrl = "https://banhang.shopee.vn/new-webchat/conversations";
    chrome.storage.local.set({
      pendingAutoChat: {
        buyerName: message.buyerName || "",
        message: message.message || "",
        timestamp: Date.now()
      }
    });

    const dispatchToTab = (targetTabId, bName, msg) => {
      let messageDispatched = false;
      const onUpdatedListener = (tabId, changeInfo) => {
        if (tabId === targetTabId && changeInfo.status === "complete" && !messageDispatched) {
          messageDispatched = true;
          chrome.tabs.onUpdated.removeListener(onUpdatedListener);
          const sendTask = () => {
            chrome.tabs.sendMessage(targetTabId, {
              type: "EXECUTE_AUTO_CHAT_BUYER",
              buyerName: bName,
              message: msg
            }).catch(() => {});
          };
          setTimeout(sendTask, 800);
          setTimeout(sendTask, 2200);
        }
      };
      chrome.tabs.onUpdated.addListener(onUpdatedListener);
      setTimeout(() => {
        try { chrome.tabs.onUpdated.removeListener(onUpdatedListener); } catch (_) {}
      }, 30000);
    };

    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs?.find(t => t.url && (t.url.includes("new-webchat") || t.url.includes("/webchat/")));
      if (existingTab && existingTab.id) {
        chrome.tabs.update(existingTab.id, { active: true }, (updatedTab) => {
          if (chrome.runtime.lastError || !updatedTab) {
            chrome.tabs.create({ url: webchatUrl, active: true }, (newTab) => {
              if (newTab?.id && message.buyerName) {
                dispatchToTab(newTab.id, message.buyerName, message.message);
              }
            });
          } else {
            if (existingTab.windowId) {
              chrome.windows.update(existingTab.windowId, { focused: true }).catch(() => {});
            }
            if (message.buyerName) {
              const sendTask = () => {
                chrome.tabs.sendMessage(existingTab.id, {
                  type: "EXECUTE_AUTO_CHAT_BUYER",
                  buyerName: message.buyerName,
                  message: message.message
                }).catch(() => {});
              };
              setTimeout(sendTask, 400);
              setTimeout(sendTask, 1200);
            }
          }
        });
      } else {
        chrome.tabs.create({
          url: webchatUrl,
          active: true
        }, (newTab) => {
          if (newTab?.id && message.buyerName) {
            dispatchToTab(newTab.id, message.buyerName, message.message);
          }
        });
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  // =========================================================================
  // MODULE: ORDER TOOL - Tự động dọn tab & kiểm soát tab
  // =========================================================================
  if (message?.type === "ORDER_TOOL_OPEN_ALL") {
    executeAutoCleanTabs({ open: true, focusFirst: true, links: message.links, config: message.config }).then(res => sendResponse(res))
      .catch(err => sendResponse({ ok: false, error: err.message, closedCount: 0 }));
    return true;
  }

  if (message?.type === "ORDER_TOOL_TRIGGER_CLEAN_NOW") {
    executeAutoCleanTabs({ open: false, cleanNow: true, links: message.links, config: message.config }).then(res => {
      sendResponse(res);
    }).catch(err => {
      sendResponse({ ok: false, error: err.message, closedCount: 0 });
    });
    return true;
  }

  if (message?.type === "ORDER_TOOL_TOGGLE_AUTO_CLEAN") {
    (async () => {
      try {
        const enabled = !!message.enabled;
        const res = await chrome.storage.local.get(["order_tool_auto_clean_config"]);
        const cfg = Object.assign({}, res.order_tool_auto_clean_config || {}, { enabled });
        await chrome.storage.local.set({ order_tool_auto_clean_config: cfg });

        if (enabled) {
          try { await chrome.alarms.clear("ALARM_AUTO_CLEAN_TABS"); } catch (e) {}
          chrome.alarms.create("ALARM_AUTO_CLEAN_TABS", {
            delayInMinutes: 30,
            periodInMinutes: 30
          });
          const nextRunAt = Date.now() + 30 * 60 * 1000;
          await chrome.storage.local.set({ order_tool_next_run_at: nextRunAt });
          sendResponse({ ok: true, enabled: true, nextRunAt });
        } else {
          try { await chrome.alarms.clear("ALARM_AUTO_CLEAN_TABS"); } catch (e) {}
          await chrome.storage.local.remove(["order_tool_next_run_at"]);
          sendResponse({ ok: true, enabled: false });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message?.type === "ORDER_TOOL_GET_STATUS") {
    (async () => {
      try {
        const alarm = await chrome.alarms.get("ALARM_AUTO_CLEAN_TABS");
        const store = await chrome.storage.local.get([
          "order_tool_auto_clean_config",
          "order_tool_last_clean",
          "order_tool_next_run_at"
        ]);
        const cfg = Object.assign({
          enabled: false,
          keepOrder: true,
          keepAllProduct: true,
          keepWameli: true,
          keepActiveTab: true,
          keepTabIds: [],
          keepTabUrls: []
        }, store.order_tool_auto_clean_config || {});

        sendResponse({
          ok: true,
          enabled: !!cfg.enabled,
          alarm: !!alarm,
          scheduledTime: alarm ? alarm.scheduledTime : store.order_tool_next_run_at,
          lastClean: store.order_tool_last_clean || null,
          config: cfg
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function isModifiedStatusText(statusStr) {
  if (!statusStr) return false;
  const s = String(statusStr).trim().toLowerCase();
  if (!s) return false;
  if (/hủy|huy|hoàn|hoan|trả|tra/i.test(s)) return true;
  const normal = ["", "đang giao", "chờ giao", "chờ lấy hàng", "chờ xác nhận", "đã giao", "hoàn thành"];
  return !normal.includes(s);
}

function normalizeHeaderText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = GOOGLE_REQUEST_TIMEOUT_MS, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));

      // Nếu gặp lỗi 429 Quota Exceeded / Rate Limit: Tự động đợi 2s, 4s, 6s và thử lại
      if (res.status === 429 && attempt < retries) {
        console.warn(`[Google Sheets Quota 429] Đang đợi ${(attempt + 1) * 2}s để thử lại tự động (lần ${attempt + 1}/${retries})...`);
        clearTimeout(timeoutId);
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }

      return { res, data };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Google API quá ${Math.round(timeoutMs / 1000)} giây không phản hồi.`);
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

let cachedDhRows = null;
let cachedDhRowsTimestamp = 0;
const DH_CACHE_TTL_MS = 60000; // 60 giây cache trong RAM

async function getCachedDhRows(token, sheetId, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedDhRows && (now - cachedDhRowsTimestamp < DH_CACHE_TTL_MS)) {
    return cachedDhRows;
  }

  const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:Y")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok && data.values) {
    cachedDhRows = data.values;
    cachedDhRowsTimestamp = Date.now();
    return cachedDhRows;
  }

  if (cachedDhRows) return cachedDhRows;
  throw new Error(data.error?.message || "Không đọc được sheet DH.");
}

function invalidateDhCache() {
  cachedDhRows = null;
  cachedDhRowsTimestamp = 0;
}

async function getGoogleAccessToken() {
  const cachedToken = googleTokenCache.get(GOOGLE_SHEETS_SCOPE);

  if (cachedToken?.accessToken && Date.now() < cachedToken.expiry - 300000) {
    return cachedToken.accessToken;
  }

  if (typeof KJUR === "undefined" || !KJUR || !KJUR.jws || !KJUR.jws.JWS) {
    throw new Error("Thư viện jsrsasign (KJUR) chưa được nạp trong Background Service Worker!");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: GOOGLE_SHEET_CONFIG.serviceAccountEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_SHEET_CONFIG.tokenUrl,
    exp: now + 3600,
    iat: now
  };
  const assertion = KJUR.jws.JWS.sign("RS256", JSON.stringify(header), JSON.stringify(payload), GOOGLE_SHEET_CONFIG.privateKey);
  const { res, data } = await fetchJsonWithTimeout(GOOGLE_SHEET_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`
  });

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Khong lay duoc Google token.");
  }

  const token = {
    accessToken: data.access_token,
    expiry: Date.now() + (Number(data.expires_in || 3600) * 1000)
  };

  googleTokenCache.set(GOOGLE_SHEETS_SCOPE, token);
  return token.accessToken;
}

async function fetchSheetValues(sheetRange, token, timeoutMs = GOOGLE_REQUEST_TIMEOUT_MS, spreadsheetId = GOOGLE_SHEET_CONFIG.spreadsheetId) {
  const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetRange)}`, {
    headers: { Authorization: `Bearer ${token}` }
  }, timeoutMs);

  if (!res.ok) {
    throw new Error(data.error?.message || `Khong doc duoc sheet ${sheetRange}.`);
  }

  return data.values || [];
}
async function fetchUdCtCompactValues(token) {
  const spreadsheetId = "1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo";
  const ranges = ["UD_CT!E:E", "UD_CT!I:J", "UD_CT!M:M", "UD_CT!Q:Q", "UD_CT!Y:Y"];
  const query = ranges.map(range => `ranges=${encodeURIComponent(range)}`).join("&");
  const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  }, GOOGLE_REQUEST_TIMEOUT_MS);

  if (!res.ok) {
    throw new Error(data.error?.message || "Khong doc duoc sheet UD_CT.");
  }

  const valueRanges = data.valueRanges || [];
  const colE = valueRanges[0]?.values || [];
  const colsIJ = valueRanges[1]?.values || [];
  const colM = valueRanges[2]?.values || [];
  const colQ = valueRanges[3]?.values || [];
  const colY = valueRanges[4]?.values || [];
  const rowCount = Math.max(colE.length, colsIJ.length, colM.length, colQ.length, colY.length);
  const values = [];

  for (let i = 0; i < rowCount; i++) {
    const row = new Array(25).fill("");
    row[4] = colE[i]?.[0] || "";
    row[8] = colsIJ[i]?.[0] || "";
    row[9] = colsIJ[i]?.[1] || "";
    row[12] = colM[i]?.[0] || "";
    row[16] = colQ[i]?.[0] || "";
    row[24] = colY[i]?.[0] || "";
    values.push(row);
  }

  return values;
}

async function appendSheetValues(sheetRange, values, token) {
  const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent(sheetRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    throw new Error(data.error?.message || "Khong ghi duoc THU_CHI.");
  }

  return data;
}

async function updateSheetValues(sheetRange, values, token) {
  const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent(sheetRange)}?valueInputOption=RAW`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    throw new Error(data.error?.message || `Khong cap nhat duoc sheet ${sheetRange}.`);
  }

  return data;
}

async function fetchSpreadsheetMetadata(token, spreadsheetId = GOOGLE_SHEET_CONFIG.spreadsheetId) {
  const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(data.error?.message || "Không đọc được danh sách sheet.");
  }

  return data;
}

async function addSheet(sheetName, token, spreadsheetId = GOOGLE_SHEET_CONFIG.spreadsheetId) {
  const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
              gridProperties: {
                columnCount: 35
              }
            }
          }
        }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(data.error?.message || `Không tạo được sheet ${sheetName}.`);
  }

  return data;
}

async function ensureSheetExists(sheetName, token, spreadsheetId = GOOGLE_SHEET_CONFIG.spreadsheetId) {
  const metadata = await fetchSpreadsheetMetadata(token, spreadsheetId);
  const targetSheet = (metadata.sheets || []).find((sheet) => 
    (sheet.properties?.title || "").trim().toLowerCase() === sheetName.trim().toLowerCase()
  );

  if (!targetSheet) {
    try {
      await addSheet(sheetName, token, spreadsheetId);
      return sheetName;
    } catch (e) {
      if (String(e.message || "").toLowerCase().includes("already exists")) {
        const metaRetry = await fetchSpreadsheetMetadata(token, spreadsheetId);
        const retrySheet = (metaRetry.sheets || []).find((s) => (s.properties?.title || "").trim().toLowerCase() === sheetName.trim().toLowerCase());
        return retrySheet?.properties?.title || sheetName;
      }
      throw e;
    }
  } else if ((targetSheet.properties?.gridProperties?.columnCount || 0) < 30) {
    await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: targetSheet.properties.sheetId,
                gridProperties: {
                  columnCount: 35
                }
              },
              fields: "gridProperties.columnCount"
            }
          }
        ]
      })
    }).catch(err => console.warn("Lỗi mở rộng cột Sheet:", err));
  }
  return targetSheet.properties?.title || sheetName;
}

async function ensureThuChiSheetReady(token) {
  await ensureSheetExists(THU_CHI_SHEET_NAME, token);

  const headerRows = await fetchSheetValues(`${THU_CHI_SHEET_NAME}!A1:H1`, token);
  const hasHeader = (headerRows[0] || []).some((header) => normalizeText(header));

  if (!hasHeader) {
    await updateSheetValues(`${THU_CHI_SHEET_NAME}!A1:H1`, [THU_CHI_HEADERS], token);
    return [THU_CHI_HEADERS];
  }

  return headerRows;
}

async function fetchTrackingRows(token) {
  try {
    return await fetchSheetValues("DH_S!A1:H", token, TRACKING_LOOKUP_TIMEOUT_MS);
  } catch (error) {
    console.warn("Khong lay duoc ma van don, van ghi THU_CHI.", error);
    return [];
  }
}

function findSheetColumn(headers, names) {
  const normalizedNames = names.map(normalizeHeaderText);

  return headers.findIndex((header) => normalizedNames.includes(normalizeHeaderText(header)));
}

function buildOrderTrackingMap(dhRows) {
  const headers = dhRows[0] || [];
  const orderIndex = findSheetColumn(headers, ["ma don hang", "mdh"]);
  const trackingIndex = findSheetColumn(headers, ["ma van don", "mvd"]);
  const map = new Map();

  if (orderIndex < 0 || trackingIndex < 0) {
    return map;
  }

  for (const row of dhRows.slice(1)) {
    const orderId = String(row[orderIndex] || "").trim();
    const trackingId = String(row[trackingIndex] || "").trim();

    if (orderId) {
      map.set(orderId, trackingId);
    }
  }

  return map;
}

function buildThuChiRows(incomeRows, trackingMap, thuChiRows) {
  const headers = thuChiRows[0] || [];
  const hasHeaders = headers.some((header) => normalizeText(header));
  const fieldValuesByKey = (incomeRow, index) => ({
    id: `TC${Date.now()}${String(index + 1).padStart(3, "0")}`,
    ngay: incomeRow.ngay,
    thu_chi: "thu",
    truong: "\u0111\u01a1n h\u00e0ng",
    mdh: incomeRow.mdh,
    mvd: trackingMap.get(incomeRow.mdh) || "",
    so_tien: incomeRow.so_tien
  });

  if (!hasHeaders) {
    return incomeRows.map((incomeRow, index) => {
      const values = fieldValuesByKey(incomeRow, index);
      return [values.id, values.ngay, values.thu_chi, values.truong, values.mdh, values.mvd, values.so_tien];
    });
  }

  const aliases = {
    id: ["id"],
    ngay: ["ngay"],
    thu_chi: ["thu_chi", "thu chi"],
    truong: ["truong"],
    mdh: ["mdh", "ma don hang"],
    mvd: ["mvd", "ma van don"],
    so_tien: ["so_tien", "so tien", "so tien thanh toan"]
  };
  const columnByField = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [
    field,
    findSheetColumn(headers, names)
  ]));

  return incomeRows.map((incomeRow, index) => {
    const values = fieldValuesByKey(incomeRow, index);
    const row = new Array(headers.length).fill("");

    for (const [field, value] of Object.entries(values)) {
      const columnIndex = columnByField[field];

      if (columnIndex >= 0) {
        row[columnIndex] = value;
      }
    }

    return row;
  });
}

function buildDefaultThuChiRows(incomeRows) {
  return incomeRows.map((incomeRow, index) => [
    [
      `TC${Date.now()}${String(index + 1).padStart(3, "0")}`,
      incomeRow.ngay,
      "thu",
      "\u0111\u01a1n h\u00e0ng",
      incomeRow.mdh,
      incomeRow.so_tien
    ].join(" | ")
  ]);
}

async function saveIncomeToThuChi(incomeRows) {
  try {
    if (!incomeRows.length) {
      return { ok: false, message: "Khong co dong de ghi." };
    }

    const token = await getGoogleAccessToken();
    const [thuChiRows, trackingRows] = await Promise.all([
      ensureThuChiSheetReady(token),
      fetchTrackingRows(token)
    ]);
    const values = buildThuChiRows(incomeRows, buildOrderTrackingMap(trackingRows), thuChiRows);

    await appendSheetValues(`${THU_CHI_SHEET_NAME}!A:H`, values, token);

    return {
      ok: true,
      message: `Da ghi ${values.length} dong vao THU_CHI.`
    };
  } catch (error) {
    console.error("Luu THU_CHI that bai:", error);
    return {
      ok: false,
      message: error?.message || "Loi ghi du lieu vao THU_CHI."
    };
  }
}

chrome.storage.local.get(["customSpreadsheetId"], (res) => {
  if (res.customSpreadsheetId && res.customSpreadsheetId.trim()) {
    GOOGLE_SHEET_CONFIG.spreadsheetId = res.customSpreadsheetId.trim();
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.customSpreadsheetId) {
    const nextId = changes.customSpreadsheetId.newValue || "";
    if (nextId && nextId.trim()) {
      GOOGLE_SHEET_CONFIG.spreadsheetId = nextId.trim();
    }
  }
});

// --- AUTO BOOST SCHEDULER (Custom Daily Times & Auto-Open Product List) ---
function getNextDailyAlarmTimestamp(hour, minute) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

function clearAutoBoostAlarms(callback) {
  if (!chrome.alarms) {
    if (callback) callback();
    return;
  }
  chrome.alarms.getAll((alarms) => {
    const toClear = (alarms || []).filter(a => a.name && a.name.startsWith("ALARM_AUTO_BOOST_"));
    if (!toClear.length) {
      if (callback) callback();
      return;
    }
    let remaining = toClear.length;
    toClear.forEach((a) => {
      chrome.alarms.clear(a.name, () => {
        remaining--;
        if (remaining <= 0 && callback) callback();
      });
    });
  });
}

function scheduleDailyAutoBoostAlarms(customTimes = null) {
  const applySchedule = (timesList) => {
    const validTimes = Array.isArray(timesList) && timesList.length > 0 ? timesList : ["09:00", "13:20"];
    clearAutoBoostAlarms(() => {
      validTimes.forEach((timeStr) => {
        const m = String(timeStr || "").trim().match(/^(\d{1,2}):(\d{1,2})$/);
        if (!m) return;
        const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
        const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
        const alarmName = `ALARM_AUTO_BOOST_${String(hh).padStart(2, "0")}_${String(mm).padStart(2, "0")}`;
        chrome.alarms?.create(alarmName, {
          when: getNextDailyAlarmTimestamp(hh, mm),
          periodInMinutes: 1440
        });
      });
    });
  };

  if (Array.isArray(customTimes) && customTimes.length > 0) {
    applySchedule(customTimes);
  } else {
    chrome.storage?.local?.get(["shopee_auto_boost_config"], (res) => {
      const config = res?.shopee_auto_boost_config || {};
      applySchedule(config.scheduleTimes);
    });
  }
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish();
      }
    };
    const timer = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function runAutoBoostJob(customIds = null, maxSlots = 5) {
  try {
    const res = await chrome.storage.local.get(["shopee_auto_boost_config"]);
    const config = res.shopee_auto_boost_config || {};

    let ids = Array.isArray(customIds) ? customIds : [];
    if (!ids.length && config.ids) {
      const tokens = String(config.ids).split(/[\s,;\n\r\t]+/);
      ids = tokens.map(t => t.replace(/[^0-9]/g, '')).filter(t => t.length >= 6);
    }
    if (!ids.length) return;

    // 1. Tìm tab đang mở danh sách sản phẩm Shopee, nếu chưa có thì tự động mở tab mới
    let tabs = await chrome.tabs.query({ url: "*://banhang.shopee.vn/portal/product/list*" });
    let targetTabId = null;

    if (tabs && tabs.length > 0) {
      targetTabId = tabs[0].id;
      await chrome.tabs.update(targetTabId, { active: true });
    } else {
      const createdTab = await chrome.tabs.create({
        url: "https://banhang.shopee.vn/portal/product/list/live/all?operationSortBy=modified_time&page=1&size=48",
        active: true
      });
      targetTabId = createdTab.id;
      await waitForTabComplete(targetTabId, 20000);
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!targetTabId) return;

    // 2. Đảm bảo content.js đã được inject trước khi gửi lệnh đẩy
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(targetTabId, { type: "PING" }, (pingRes) => {
        if (chrome.runtime.lastError || !pingRes || !pingRes.ok) {
          chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ["extension/lib/xlsx.full.min.js", "extension/content/content.js"]
          }, () => setTimeout(resolve, 400));
        } else {
          resolve();
        }
      });
    });

    // 3. Gửi lệnh đẩy sản phẩm
    chrome.tabs.sendMessage(targetTabId, {
      type: "EXECUTE_AUTO_BOOST_LIST",
      productIds: ids,
      maxSlots: maxSlots
    }, (response) => {
      if (response && response.ok) {
        const now = Date.now();
        const results = (response.results || []).map(item => ({
          ...item,
          timestamp: item.timestamp || now,
          boostedAt: item.status === 'boosted' ? (item.boostedAt || now) : item.boostedAt,
          expireAt: item.status === 'boosted' ? (item.expireAt || (now + 4 * 60 * 60 * 1000)) : item.expireAt
        }));
        config.lastLogs = results;
        config.lastRunTime = now;
        chrome.storage.local.set({ shopee_auto_boost_config: config });
      }
    });
  } catch (err) {
    console.warn("Auto boost job error:", err);
  }
}

// Khởi tạo lại lịch hẹn nếu đang bật autoRepeat khi trình duyệt/extension khởi động
chrome.storage?.local?.get(["shopee_auto_boost_config"], (res) => {
  const config = res?.shopee_auto_boost_config;
  if (config && config.autoRepeat) {
    scheduleDailyAutoBoostAlarms(config.scheduleTimes);
  }
});

chrome.alarms?.onAlarm?.addListener(async (alarm) => {
  if (alarm?.name && alarm.name.startsWith("ALARM_AUTO_BOOST_")) {
    const res = await chrome.storage.local.get(["shopee_auto_boost_config"]);
    const config = res.shopee_auto_boost_config || {};
    if (!config.autoRepeat || !config.ids) return;
    await runAutoBoostJob(null, 5);
  }

  if (alarm?.name === "ALARM_AUTO_CLEAN_TABS") {
    const res = await chrome.storage.local.get(["order_tool_auto_clean_config"]);
    const config = res.order_tool_auto_clean_config || {};
    if (config.enabled) {
      const cleanRes = await executeAutoCleanTabs({ open: true, auto: true });
      chrome.runtime.sendMessage({
        type: "ORDER_TOOL_AUTO_CLEAN_DONE",
        result: cleanRes
      }).catch(() => {});
    }
  }
});

// Khởi tạo lại lịch dọn dẹp tab nếu đang bật khi khởi động extension/trình duyệt
chrome.storage?.local?.get(["order_tool_auto_clean_config"], (res) => {
  const cfg = res?.order_tool_auto_clean_config;
  if (cfg && cfg.enabled) {
    chrome.alarms.get("ALARM_AUTO_CLEAN_TABS", (alarm) => {
      if (!alarm) {
        chrome.alarms.create("ALARM_AUTO_CLEAN_TABS", {
          delayInMinutes: 30,
          periodInMinutes: 30
        });
        chrome.storage.local.set({
          order_tool_next_run_at: Date.now() + 30 * 60 * 1000
        });
      }
    });
  }
});

// =========================================================================
// HÀM SO KHỚP URL TAB VỚI LINK ĐÃ LƯU & TỰ ĐỘNG DỌN TAB
// =========================================================================

const DEFAULT_ORDER_TOOL_QUICK_LINKS = [
  { id: "def_order", name: "Đơn hàng (Cần xử lý)", url: "https://banhang.shopee.vn/portal/sale/order?type=toship&source=to_process", enabled: true },
  { id: "def_product", name: "Tất cả sản phẩm (All)", url: "https://banhang.shopee.vn/portal/product/list/live/all?operationSortBy=recommend_v2&page=1&size=48", enabled: true },
  { id: "def_wameli", name: "Wameli (Quản trị)", url: "https://phanmem.wameli.vn/admin/", enabled: true }
];

function isTabUrlMatchingSavedLink(tabUrl, savedUrl) {
  if (!tabUrl || !savedUrl) return false;
  const tUrl = String(tabUrl).trim();
  const sUrl = String(savedUrl).trim();
  if (tUrl === sUrl) return true;

  try {
    const uTab = new URL(tUrl);
    const uSaved = new URL(sUrl);

    // 1. Phải cùng hostname (bỏ www.)
    const hTab = uTab.hostname.replace(/^www\./, "").toLowerCase();
    const hSaved = uSaved.hostname.replace(/^www\./, "").toLowerCase();
    if (hTab !== hSaved) return false;

    // 2. Google Spreadsheets: so khớp ID bảng tính
    if (hTab.includes("docs.google.com") && uTab.pathname.includes("/spreadsheets/d/")) {
      const matchTab = uTab.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const matchSaved = uSaved.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (matchTab && matchSaved && matchTab[1] === matchSaved[1]) {
        return true;
      }
    }

    // 3. Chuẩn hoá pathname (bỏ dấu / ở cuối)
    const pTab = uTab.pathname.replace(/\/+$/, "").toLowerCase();
    const pSaved = uSaved.pathname.replace(/\/+$/, "").toLowerCase();

    // Trang quản trị Wameli: tab trong admin/ coi là khớp
    if (hSaved.includes("wameli.vn") && (pSaved === "/admin" || pSaved.startsWith("/admin/"))) {
      if (pTab === "/admin" || pTab.startsWith("/admin/")) return true;
    }

    // Shopee Kênh Người Bán: So khớp thông minh theo phân hệ chức năng
    if (hSaved.includes("banhang.shopee.vn") && hTab.includes("banhang.shopee.vn")) {
      // a) Danh sách sản phẩm (list, list/all, list/live/all...)
      if (pSaved.startsWith("/portal/product/list") && pTab.startsWith("/portal/product/list")) {
        return true;
      }
      // b) Danh sách đơn hàng
      if (pSaved.startsWith("/portal/sale/order") && pTab.startsWith("/portal/sale/order")) {
        const sType = uSaved.searchParams.get("type");
        const tType = uTab.searchParams.get("type");
        if (sType && tType && sType.toLowerCase() !== tType.toLowerCase()) {
          return false;
        }
        return true;
      }
      // c) Giao hàng loạt (Mass ship)
      if (pSaved.startsWith("/portal/sale/mass/ship") && pTab.startsWith("/portal/sale/mass/ship")) {
        return true;
      }
      // d) Kênh marketing
      if (pSaved.startsWith("/portal/marketing") && pTab.startsWith("/portal/marketing")) {
        return true;
      }
      // e) Trả hàng / hoàn tiền
      if (pSaved.startsWith("/portal/sale/return") && pTab.startsWith("/portal/sale/return")) {
        return true;
      }
    }

    // Nếu pathname khác nhau -> khác trang hoàn toàn (VD /portal/sale/order vs /portal/product/list)
    if (pTab !== pSaved) {
      return false;
    }

    // 4. Cùng pathname: kiểm tra tham số quan trọng nếu có (ví dụ type trong Shopee order)
    const sType = uSaved.searchParams.get("type");
    const tType = uTab.searchParams.get("type");
    if (sType && tType && sType.toLowerCase() !== tType.toLowerCase()) {
      return false;
    }

    return true;
  } catch (e) {
    return tUrl.toLowerCase() === sUrl.toLowerCase();
  }
}

// =========================================================================
// HÀM TỰ ĐỘNG DỌN DẸP TAB TRÌNH DUYỆT (CHỈ GIỮ LẠI CÁC TAB ĐƯỢC LƯU)
// =========================================================================
// Đồng bộ tab làm việc theo các link đang BẬT trong tab Đơn Tool:
// - mỗi link chỉ giữ ĐÚNG 1 tab (ưu tiên tab đang xem / dùng gần nhất), đóng các tab trùng;
// - đóng mọi tab khác không thuộc link nào (trừ tab ghim, trang hệ thống/tiện ích);
// - opts.open = true ("Mở toàn bộ" & Tự động 30 phút): mở thêm link còn thiếu và tải lại link về đúng trang.
// - opts.open = false ("Dọn ngay"): chỉ đóng tab không lưu và tab trùng, không mở thêm.
async function executeAutoCleanTabs(opts = {}) {
  const open = !!opts.open;
  const focusFirst = !!opts.focusFirst;
  const isCleanNow = !!opts.cleanNow || !open;

  try {
    const res = await chrome.storage.local.get(["order_tool_auto_clean_config", "order_tool_quick_links"]);
    const cfg = Object.assign({
      enabled: true,
      keepActiveTab: false,
      keepOrder: true,
      keepTabIds: []
    }, res.order_tool_auto_clean_config || {}, opts.config || {});

    // Ưu tiên danh sách link truyền trực tiếp từ giao diện (mới nhất)
    let quickLinks = Array.isArray(opts.links) && opts.links.length > 0
      ? opts.links
      : (Array.isArray(res.order_tool_quick_links) && res.order_tool_quick_links.length > 0 ? res.order_tool_quick_links : []);

    if (!quickLinks.length) {
      const shopRes = await chrome.storage.local.get(["maGian", "dhHoanTextValue"]);
      const shopCode = (shopRes.maGian || shopRes.dhHoanTextValue || "").trim();
      if (shopCode) {
        const subRes = await chrome.storage.local.get([`order_tool_quick_links_${shopCode}`]);
        if (Array.isArray(subRes[`order_tool_quick_links_${shopCode}`]) && subRes[`order_tool_quick_links_${shopCode}`].length > 0) {
          quickLinks = subRes[`order_tool_quick_links_${shopCode}`];
        }
      }
    }

    if (!quickLinks.length) {
      quickLinks = [...DEFAULT_ORDER_TOOL_QUICK_LINKS];
    }

    // Đảm bảo lưu lại vào storage
    chrome.storage.local.set({ order_tool_quick_links: quickLinks }).catch(() => {});

    const links = quickLinks.filter(l => l && l.url && l.enabled !== false);
    if (!links.length) {
      return { ok: false, error: "Chưa có link nào đang BẬT trong danh sách trang làm việc.", closedCount: 0, remainingCount: 0 };
    }

    const tabs = await chrome.tabs.query({});
    const isSystem = (t) => {
      const url = t.url || t.pendingUrl || "";
      return t.pinned || /^(chrome|chrome-extension|edge|about|devtools|view-source):/.test(url);
    };

    // 1. Mỗi link chọn đúng 1 tab giữ lại (ưu tiên tab đang xem hoặc truy cập gần nhất)
    const assigned = new Set();
    const keepers = []; // { link, tab | null }
    for (const link of links) {
      const matches = tabs.filter(t => !assigned.has(t.id) && !isSystem(t) && isTabUrlMatchingSavedLink(t.url || t.pendingUrl || "", link.url));
      matches.sort((a, b) => (b.active - a.active) || ((b.lastAccessed || 0) - (a.lastAccessed || 0)));
      const keeper = matches[0] || null;
      if (keeper) assigned.add(keeper.id);
      keepers.push({ link, tab: keeper });
    }

    // 2. Mở link còn thiếu / tải lại link về đúng trang (khi open=true)
    let createdCount = 0;
    let firstTabId = null;
    if (open) {
      for (const k of keepers) {
        if (k.tab) {
          // Không làm gián đoạn tab bạn đang xem khi chạy tự động
          if (!(opts.auto && k.tab.active)) {
            await chrome.tabs.update(k.tab.id, { url: k.link.url }).catch(() => {});
          }
          if (firstTabId === null) firstTabId = k.tab.id;
        } else {
          const t = await chrome.tabs.create({ url: k.link.url, active: false }).catch(() => null);
          if (t) {
            createdCount++;
            assigned.add(t.id);
            if (firstTabId === null) firstTabId = t.id;
          }
        }
      }
    }

    // 3. Quy tắc bảo vệ tab:
    // - Tab hệ thống / tab ghim luôn được giữ lại
    // - Nếu bật "Giữ tab đang xem" (keepActiveTab) thì chỉ giữ thêm tab đang active
    // - Khi "Dọn ngay": đóng TOÀN BỘ tab không thuộc link nào đã lưu và tab trùng
    const isProtected = (t) => isSystem(t) || (cfg.keepActiveTab && t.active);

    const idsToClose = tabs.filter(t => !assigned.has(t.id) && !isProtected(t)).map(t => t.id);
    if (idsToClose.length > 0) {
      await chrome.tabs.remove(idsToClose).catch(err => {
        console.warn("[executeAutoCleanTabs] Lỗi đóng tab:", err);
      });
    }

    if (focusFirst && firstTabId !== null) {
      await chrome.tabs.update(firstTabId, { active: true }).catch(() => {});
    }

    const remaining = await chrome.tabs.query({}).catch(() => []);
    const lastClean = {
      time: Date.now(),
      closedCount: idsToClose.length,
      remainingCount: remaining.length,
      createdCount
    };
    const store = { order_tool_last_clean: lastClean };
    if (cfg.enabled) store.order_tool_next_run_at = Date.now() + 30 * 60 * 1000;
    await chrome.storage.local.set(store);

    console.log(`[executeAutoCleanTabs] open=${open}, cleanNow=${isCleanNow}: mở ${createdCount}, đóng ${idsToClose.length}, còn ${remaining.length} tab.`);
    return { ok: true, closedCount: idsToClose.length, remainingCount: remaining.length, createdCount, linkCount: links.length };
  } catch (err) {
    console.error("[executeAutoCleanTabs] Lỗi:", err);
    return { ok: false, error: err.message, closedCount: 0, remainingCount: 0 };
  }
}
