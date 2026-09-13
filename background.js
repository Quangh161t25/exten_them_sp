self.window = self;
self.navigator = { userAgent: "Node" };
importScripts("jsrsasign-all-min.js");

let GOOGLE_SHEET_CONFIG = {
  spreadsheetId: "1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo",
  serviceAccountEmail: "ca-nhan@h161-508101.iam.gserviceaccount.com",
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1XkzwY+oHzPmN
YnJ+sMKxe5TRTp8Md0Jb+PFApojE72HcVnXj14zFxFocyCPX1+dtwXJGJ/sSCyAh
iV3OtLEpxRU5QJponFszl9X6vmdLzDbzQS7VQTqMPv0JB+lHEYMU2B37hcIfpfJO
+l6EMprUA7NJtmeJpqmXKjsov6Rdt61sjyH/LKaYj0T2sLGazgZesp96sEOu83HM
nl+KPk9xafPOlKaE34Bk6zl4D8lFUK3v7opndvt/7IOBQ/RdI7p0v+HeOORGUuZW
kW3GH1vo6xY/uyrtmjD7+18w5vmAIRm24Satu0MJYz+j1JtqV4U5wwDkNelXBAWz
hKkfl5yxAgMBAAECggEAA9pDk+Epc943qFhQoo6Oai77+ai8AeuoHBRJCqSm99j2
aRPol+0Im1xZBi69rSxzyO3wp5sajxbvqSq19Im70C10rpVH2mRE3y8Q321LPC3T
tn3aWPMUY22Emjwh6U2uzULsex7roVi48ZLJrnD1Pz7vYGfYofDJfjGqVUqh2xA+
OSiz/U2JFTmePtrhxQGwaS8PHWyyUd+aiHz7pBg+tNzX0L+rMirPsN6i/ph+QolS
4YXubv94O/WL92helDjQuUyWbisYdkuLp2XxnB+5Oa/2fQY7+rhju4pcIm+zA+Wc
GdSzvLtL5hY9vLrZ8e4n0E/saILqViHSkRFksV1PaQKBgQDmEDaYQxmBeQsDbRJN
BLg5lNBCgEWWkW/GNcL9cT+IcmNSyiPAnk2jofQpvmbbBh1lYeCbOhE4HDotN8a8
hc1uRLb4K17fofhGV/znXW9Y12NcwZTkL5u4kKwDy8Qfx3PfckeLxA1s/3oS01tF
wrybv1aB3Vxain5axUps5v0x6QKBgQDJ0Ld9nqXGBrknORjF1uQ7vpp5wp4Haohy
FVNNfMzjKGRzKl8d4TxPVrUpShYBQE+v1pCwahOXCefovff32mQHzg4oVeml3bQq
otLFVVcydb1L8RY1R+QLbiqRy6Pnv5h4pB82eWg1i7xKuZvxZ68v6iPpEz+8zx0F
FJ9IGolPiQKBgBRF03nBV+sHzoejwdwVkWJJkbx6bydgc3gE3sTUiOOuKMBv3Yyo
pnDH4asYAxpDxK1dXZxwFnpaSmoXoySTqdGQrorZz4dnT2hrcna0zg4HFNNkn4ko
BNHTtcSz3Plr6vMCr/lJ8mDrdkdYZo+UJGiZCLdy2SOFVrMK9Y75H9CZAoGBAJcl
jTc06VztTiA1H/uT3K1uLA2DF43gWL5wgEopbN24M7sZAdHEDcIx405AIUjgnI3J
+eVWHMPi9GAYXq2vT3mU9n95EJtb9wJznb2TE9JD4fkNX5+Z7w4sfQ9iX6hCk3PP
H11SAh0QQX4JkuRyzf7pselutC65Qze54S1ESpBZAoGACkqjFmmF9I9jLZfJdWJM
hOdPNHJD8NcM7ixbO9FBMw6S7PeUE//IuKQQcnxm9FsxCFVo2Q16+XKYLryZ/QxD
cRUVkq/nAg4IB78jDp5Yc3n5VXAr10zWHWNFwVbdcZAs3BT9Q4WacASPdyowQPx0
JYdnFqf9hx1XKT04zZ49M7w=
-----END PRIVATE KEY-----`,
  tokenUrl: "https://oauth2.googleapis.com/token"
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

  // Tải lên duy nhất qua API Catbox (https://catbox.moe/user/api.php)
  const fdCatbox = new FormData();
  fdCatbox.append("reqtype", "fileupload");
  fdCatbox.append("fileToUpload", blob, safeName);

  const resCatbox = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: fdCatbox
  });
  const textCatbox = await resCatbox.text();
  if (resCatbox.ok && textCatbox && textCatbox.trim().startsWith("http")) {
    return textCatbox.trim();
  }

  throw new Error(textCatbox || "Không thể upload ảnh lên API Catbox (https://files.catbox.moe/).");
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
        const { res: hRes, data: hData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!A1:D1")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (hRes.ok && (!hData.values || hData.values.length === 0)) {
          await updateSheetValues("LUU_ANH_API!A1:D1", [["id", "link", "ten_anh", "link_cu"]], token);
        } else if (hRes.ok && hData.values && hData.values[0]) {
          if (hData.values[0].length < 4 || !hData.values[0][3]) {
            await updateSheetValues("LUU_ANH_API!D1", [["link_cu"]], token);
          }
        }
        
        // 3. Tạo ID và tên ảnh
        const imgId = "IMG_" + Date.now();
        const titleName = message.title || "Ảnh từ Web";
        
        // Chuẩn bị dòng dữ liệu 4 cột: [id, link, ten_anh, link_cu] (Cột B là link ảnh)
        const rowData = [imgId, hostedImageUrl, titleName, rawUrl];
        
        await appendSheetValues("LUU_ANH_API!A:D", [rowData], token);
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
    getGoogleAccessToken()
      .then(async (token) => {
         await ensureSheetExists("SP_SHOPEE", token);
         
         if (message.maGian) {
             const existingRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/SP_SHOPEE!A2:Z`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             let existingRows = [];
             if (existingRes.res.ok && existingRes.data.values) {
                 existingRows = existingRes.data.values;
             }
             const filteredRows = existingRows.filter(row => {
                 const rowGian = (row[11] || "").trim().toLowerCase();
                 return rowGian !== message.maGian.toLowerCase();
             });
             const finalRows = filteredRows.concat(message.values || []);
             
             await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent("SP_SHOPEE!A2:Z")}:clear`, {
                 method: "POST",
                 headers: { Authorization: `Bearer ${token}` }
             });
             
             if (finalRows.length > 0) {
                 await updateSheetValues("SP_SHOPEE!A2", finalRows, token);
             }
         } else {
             const clearRes = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent("SP_SHOPEE!A2:Z")}:clear`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
             });
             if (!clearRes.res.ok) console.warn("Khong the clear SP_SHOPEE: ", clearRes.data);

             if (message.values && message.values.length > 0) {
               await updateSheetValues("SP_SHOPEE!A2", message.values, token);
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
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("LUU_ANH_API!A1:D1")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && (!data.values || data.values.length === 0)) {
          await updateSheetValues("LUU_ANH_API!A1:D1", [["id", "link", "ten_anh", "link_cu"]], token);
        } else if (res.ok && data.values && data.values[0]) {
          if (data.values[0].length < 4 || !data.values[0][3]) {
            await updateSheetValues("LUU_ANH_API!D1", [["link_cu"]], token);
          }
        }
        if (message.rows && message.rows.length > 0) {
          await appendSheetValues("LUU_ANH_API!A:D", message.rows, token);
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
      .then(([token, sheetId]) => fetchSheetValues("SP_SHOPEE!A:Z", token, GOOGLE_REQUEST_TIMEOUT_MS, sheetId))
      .then(values => sendResponse({ ok: true, values }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
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
    const period = message.intervalMinutes || 240;
    chrome.alarms?.create("ALARM_AUTO_BOOST_4H", { periodInMinutes: period });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "CANCEL_AUTO_BOOST_ALARM") {
    chrome.alarms?.clear("ALARM_AUTO_BOOST_4H");
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "SAVE_WEB_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        await ensureSheetExists("WEB_SP", token);
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("WEB_SP!A:O")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: message.values })
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong ghi duoc vao WEB_SP.");
        sendResponse({ ok: true, count: message.values.length });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "APPEND_DS_SP") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/DS_SP:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: message.rowDatas })
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong them duoc vao DS_SP.");
        sendResponse({ ok: true, data });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "APPEND_SP_SHOPEE") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()])
      .then(async ([token, sheetId]) => {
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/SP_SHOPEE:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: message.values })
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong them duoc vao SP_SHOPEE.");
        sendResponse({ ok: true, data });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
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
  const targetSheet = (metadata.sheets || []).find((sheet) => sheet.properties?.title === sheetName);

  if (!targetSheet) {
    await addSheet(sheetName, token, spreadsheetId);
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

// --- AUTO BOOST SCHEDULER (4 Hours) ---
chrome.alarms?.onAlarm?.addListener(async (alarm) => {
  if (alarm.name === "ALARM_AUTO_BOOST_4H") {
    try {
      const res = await chrome.storage.local.get(["shopee_auto_boost_config"]);
      const config = res.shopee_auto_boost_config || {};
      if (!config.autoRepeat || !config.ids) return;

      const raw = config.ids;
      const tokens = raw.split(/[\s,;\n\r\t]+/);
      const ids = tokens.map(t => t.replace(/[^0-9]/g, '')).filter(t => t.length >= 6);
      if (!ids.length) return;

      // Tìm tab đang mở danh sách sản phẩm Shopee
      const tabs = await chrome.tabs.query({ url: "*://banhang.shopee.vn/portal/product/list*" });
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "EXECUTE_AUTO_BOOST_LIST",
          productIds: ids,
          maxSlots: 5
        }, (response) => {
          if (response && response.ok) {
            config.lastLogs = response.results || [];
            config.lastRunTime = Date.now();
            chrome.storage.local.set({ shopee_auto_boost_config: config });
          }
        });
      }
    } catch (err) {
      console.warn("Auto boost alarm error:", err);
    }
  }
});

