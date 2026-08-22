self.window = self;
self.navigator = { userAgent: "Node" };
importScripts("jsrsasign-all-min.js");

let GOOGLE_SHEET_CONFIG = {
  spreadsheetId: "1cnA33cHHMhcOSaXa9l4Jeu6qw8QnXlUnEU4Bqtkj9wo",
  serviceAccountEmail: "test-gia-ason@api-test-sheet-161.iam.gserviceaccount.com",
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC3NN84hLTkQPZd
Lj7niXZTICq7nHsuTn3J6r2Paq12m70/lYSmrwh1i0EStr9bO19QM8cevGlslwGr
WSVOLJlc6+w1HGPKvRXtA41kYV9MYIvpzIPQtkFE7Hxq71QyBARcv39Lfzze6Ioj
3G8VBvAKFLAnCUr97GHRv+KbCTFxPZupd3PEB+xS5ZUlzdBCEZvDid3iXaaEJJ+l
Td1apAGQHjtnDTLOkiTa8zf7X5ebALwnI9MziOdN8VyprHXGhkachPbKyrG0QwEs
2jtiI6Y5ULsBPjNefoavH8MKU5DEAT9h0fZ7KfsKYVMDuXqmEKBs0D3B4Z6aDZQW
wT2dDRZDAgMBAAECggEAEIuVoSzZVuFhaz1GI9ji0IacjvO50cIq7M8Zrj4/F756
Ew6PIhKENafAb7U4INm2AnzUMO8CqL9Jpxs85qUM3W4JysSByqLUiRW2184amIyb
j7jCXfLBTQn8AbHgrUepl5d/vBmFYMgon/mqjbNiGDb4FZgEQSkie5o6fi/dWp5d
NahbZl+WTOB/znhAfKh/zferHNxldR/ERmwOubZUerkqysWiBigc3ovpLSUof9ur
z3hNPPp0CKQjF40xuQc6FYTHUHMLuMvp78PXuc/mYqQmZ8VOGhU+faGtZ4m+QJly
dF5dS8U5cwKEF+ptuAUiWSahn6INb9yKn3+FcsW0UQKBgQDb8N4eWFvbgpRo/vxo
wBN2u2TWubj6clcrq/1a+VR0njC28Can0ogJHhrFhPxVs5D/rugs3HlbyAXJFptY
V0DZPCwBxGU5P5RbGjXWWEUXjp4ISKQD8WKfVlXNr79TqLdOg2NZBYQAi06Cpo/T
PV9l7LSG2Tj/9WdvD7W2wvrpaQKBgQDVPjpJN6xh7+sHtSU0mjKvrqigpHbuSQ/o
XpUaWSIpJffm5QpFPAOcTT5mHZCyllicJQIrfPSY+sH8n+sF03CUqVkV4Q2UqfOf
pFaLDB4P6SQ8iesZyF4VKFrj/cAvRJmp0e5W/DRnFkoEp+8c+nrru2+Dzm9kb7Uq
0CiltqYAywKBgBtcfrV1to+7Ue0x84KwintV2rifyDRX7yI+tjkQFYKgf1zyyUxN
c6D2vsvdvGqI+TvlrXqPPwW8/4NBrbeyux2LT8o0fYc+sp0WyKXOu2Gv21caelUH
PYam/eultn6Y2Z0J2V0kw4Qx0GWOhQv5cZnDdb3k3iNxixmU8b03ynEpAoGBAKEA
7O0fNe50QRZ+tOq0ihSPYQ55XrqnO3WNBDLynZJH8pbI1CpWF7vJrpVXOUs9rQWo
A61mGR/wJMtiywaJEHWOL48PbzuR3jno0NcHfSMyOoPi9jlvSWncIFQH4TVPLF5F
/Rh8L+ytrZE6YpWUoX6e9KGmGgDRPw5mQGpuL4RlAoGADe9n080SXlsUk4nHVjUz
Efv7EBoBkgOpqb9T1foRfJl46NxmmTOYV3iGIhjwcDskEg284k4iq/gH6EEFyEBc
Vz13jzB1nBgjfezFesVQz7bA/+Wik6HZtxAxVg38BKMt+Q1tYw9wOjbGPqOn++VC
sR2Sh8e3h3Knd6j1tceRIFU=
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
  const apiKey = "6d207e02198a847aa98d0a2a901485a5";
  
  // Nguồn ảnh là Data URL base64 hoặc URL HTTP/HTTPS
  let sourceToUpload = imageUrl;

  // Nếu là đường dẫn URL, fetch về dạng blob/base64 để upload chắc chắn
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Bỏ tiền tố "data:image/jpeg;base64," chỉ lấy chuỗi base64 thuần
          const resStr = reader.result;
          const commaIdx = resStr.indexOf(",");
          resolve(commaIdx !== -1 ? resStr.substring(commaIdx + 1) : resStr);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      sourceToUpload = base64Data;
    } catch (e) {
      console.warn("Không fetch trực tiếp được blob ảnh, dùng thẳng URL:", e);
    }
  } else if (imageUrl.startsWith("data:image")) {
    const commaIdx = imageUrl.indexOf(",");
    if (commaIdx !== -1) {
      sourceToUpload = imageUrl.substring(commaIdx + 1);
    }
  }

  const formData = new FormData();
  formData.append("key", apiKey);
  formData.append("action", "upload");
  formData.append("source", sourceToUpload);
  formData.append("format", "json");

  const res = await fetch("https://freeimage.host/api/1/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  if (data && data.status_code === 200 && data.image && data.image.url) {
    return data.image.url; // Link ảnh sau khi upload thành công
  } else {
    throw new Error(data?.error?.message || "Lỗi upload ảnh lên FreeImage.host");
  }
}

  if (message?.type === "SAVE_IMAGE_TO_SHEET_API") {
    (async () => {
      try {
        let rawUrl = message.imageUrl || "";
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

        // 1. Upload ảnh lên FreeImage.host bằng API key
        const hostedImageUrl = await uploadImageToFreeImageHost(rawUrl);

        // 2. Chuẩn bị kết nối Google Sheet
        const token = await getGoogleAccessToken();
        await ensureSheetExists("LUU_ANH_API", token);

        // Đảm bảo tiêu đề cột [id, link, ten_anh, link_cu] tồn tại
        const { res: hRes, data: hData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/LUU_ANH_API!A1:D1`, {
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
        
        // Chuẩn bị dòng dữ liệu 4 cột: [id, link, ten_anh, link_cu]
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
    getGoogleAccessToken()
      .then(async (token) => {
        await ensureSheetExists("LUU_ANH_API", token);
        // Ensure header row id, link, ten_anh, link_cu exists
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/LUU_ANH_API!A1:D1`, {
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
          const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:AA")}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(data.error?.message || "Không đọc được Sheet DH");
          const rows = data.values || [];
          const processed = [];
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const mdh = String(r[3] || "").trim(); // Col D
            const status = String(r[15] || "").trim(); // Col P (trang_thai)
            const returnId = String(r[25] || "").trim(); // Col Z (ma_yc_tra_hang)
            const tracking = String(r[26] || "").trim(); // Col AA (vc_hang_hoan)
            if (mdh && (status || returnId || tracking)) {
              processed.push([mdh, status, returnId, tracking]);
            }
          }
          sendResponse({ ok: true, values: processed });
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

            // Cập nhật dải F -> N (hoặc F -> K)
            // F: tong_tien, G: ma_giam_gia, H: phi_vc, I: phu_phi, J: thue, K: doanh_thu, L: phi_khac, M: tien_sp, N: loi_nhuan
            const startCol = tongTienIdx;
            const endCol = Math.max(doanhThuIdx, loiNhuanIdx);

            const rowValues = [];
            for (let c = startCol; c <= endCol; c++) {
              if (c === tongTienIdx) rowValues.push(tienSpVal);
              else if (c === maGiamGiaIdx) rowValues.push(0);
              else if (c === phiVcIdx) rowValues.push(phiVcVal);
              else if (c === phuPhiIdx) rowValues.push(phuPhiVal);
              else if (c === thueIdx) rowValues.push(thueVal);
              else if (c === doanhThuIdx) rowValues.push(doanhThuVal);
              else if (c === loiNhuanIdx) rowValues.push(loiNhuanVal);
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
        sendResponse({
          ok: true,
          matchedCount,
          matchedOrders: Array.from(matchedOrders),
          unmatchedOrders,
          rowNums: matchedRowNumbers,
          message: `Đã cập nhật thành công ${matchedCount} dòng (${matchedOrders.size} đơn hàng) trong Sheet DH!`
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

        if (!mdh) {
          sendResponse({ ok: true, exists: false, rows: [] });
          return;
        }

        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:Y")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(data.error?.message || "Không đọc được sheet DH.");
        const values = data.values || [];
        if (values.length <= 1) {
          sendResponse({ ok: true, exists: false, rows: [] });
          return;
        }

        const headers = values[0].map(h => String(h || "").trim().toLowerCase());
        let gianIdx = 0;
        let mdhIdx = 3;
        let tongTienIdx = headers.findIndex(h => h.includes("tong_tien") || h.includes("tổng tiền"));
        if (tongTienIdx === -1) tongTienIdx = 5;
        let phiVcIdx = headers.findIndex(h => h.includes("phi_vc") || h.includes("phí vc"));
        if (phiVcIdx === -1) phiVcIdx = 7;
        let phuPhiIdx = headers.findIndex(h => h.includes("phu_phi") || h.includes("phụ phí"));
        if (phuPhiIdx === -1) phuPhiIdx = 8;
        let thueIdx = headers.findIndex(h => h.includes("thue") || h.includes("thuế"));
        if (thueIdx === -1) thueIdx = 9;

        const matchingRows = [];
        for (let i = 1; i < values.length; i++) {
          const r = values[i];
          const rowGian = String(r[gianIdx] || "").trim().toLowerCase();
          const rowMdh = String(r[mdhIdx] || "").trim().toLowerCase();

          const isGianMatch = !currentMaGian || (rowGian === currentMaGian);
          if (isGianMatch && rowMdh === mdh) {
            matchingRows.push({
              rowNum: i + 1,
              tongTien: r[tongTienIdx] || "",
              phiVc: r[phiVcIdx] || "",
              phuPhi: r[phuPhiIdx] || "",
              thue: r[thueIdx] || ""
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
          sendResponse({ ok: true, exists: false, rowNums: [] });
          return;
        }

        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!D:E")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(data.error?.message || "Không đọc được sheet DH.");
        const rows = data.values || [];
        const matchingRowNums = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowMdh = String(row[0] || "").trim();
          const rowMvd = String(row[1] || "").trim();
          const rowNum = i + 1; // 1-indexed trong Google Sheets

          if ((mdh && rowMdh && rowMdh.toLowerCase() === mdh.toLowerCase()) || 
              (mvd && rowMvd && rowMvd.toLowerCase() === mvd.toLowerCase())) {
            matchingRowNums.push(rowNum);
          }
        }

        sendResponse({ ok: true, exists: matchingRowNums.length > 0, rowNums: matchingRowNums });
      } catch (err) {
        sendResponse({ ok: false, error: err.message, exists: false, rowNums: [] });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message, exists: false, rowNums: [] }));
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
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        await ensureSheetExists("DH", token);
        const newValues = message.values || [];
        if (!newValues.length) throw new Error("Không có dữ liệu để lưu.");

        // Lấy mdh và mvd từ tham số hoặc dòng dữ liệu đầu tiên
        const sampleMdh = String(message.mdh || newValues[0]?.[3] || "").trim();
        const sampleMvd = String(message.mvd || newValues[0]?.[4] || "").trim();

        // 1. Quét tìm xem đơn hàng đã có trong Sheet DH chưa
        const { res: readRes, data: readData } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!D:E")}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const rows = (readRes.ok && readData.values) ? readData.values : [];
        const matchingRowNums = [];

        if (sampleMdh || sampleMvd) {
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const rowMdh = String(r[0] || "").trim();
            const rowMvd = String(r[1] || "").trim();
            const rowNum = i + 1;

            if ((sampleMdh && rowMdh && rowMdh.toLowerCase() === sampleMdh.toLowerCase()) ||
                (sampleMvd && rowMvd && rowMvd.toLowerCase() === sampleMvd.toLowerCase())) {
              matchingRowNums.push(rowNum);
            }
          }
        }

        // 2. Nếu ĐÃ TỒN TẠI -> CẬP NHẬT LẠI (UPDATE)
        if (matchingRowNums.length > 0) {
          const updateData = [];
          for (let i = 0; i < newValues.length; i++) {
            if (i < matchingRowNums.length) {
              const rowNum = matchingRowNums[i];
              updateData.push({
                range: `DH!A${rowNum}:Y${rowNum}`,
                values: [newValues[i]]
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
            if (!updateRes.ok) throw new Error(updateResult.error?.message || "Không thể cập nhật dòng trong sheet DH");
          }

          // Nếu số dòng mới nhiều hơn số dòng cũ đã có, thêm các dòng còn lại vào cuối
          const remainingValues = newValues.slice(matchingRowNums.length);
          if (remainingValues.length > 0) {
            await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:Y")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ values: remainingValues })
            });
          }

          sendResponse({
            ok: true,
            updated: true,
            count: newValues.length,
            rowNums: matchingRowNums
          });
          return;
        }

        // 3. Nếu CHƯA TỒN TẠI -> THÊM MỚI (APPEND)
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:Y")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            values: newValues
          })
        });
        if (!res.ok) throw new Error(data.error?.message || "Không thể ghi vào sheet DH");
        sendResponse({ ok: true, updated: false, count: newValues.length });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message?.type === "APPEND_DON_HANG") {
    Promise.all([getGoogleAccessToken(), getSpreadsheetId()]).then(async ([token, sheetId]) => {
      try {
        await ensureSheetExists("DH", token);
        const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:Y")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            values: message.rowDatas
          })
        });
        if (!res.ok) throw new Error(data.error?.message || "Khong the ghi vao sheet DH");
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }).catch(err => sendResponse({ ok: false, error: err.message }));
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

  async function updateDhOrderReturnInfo(message, token, sheetId) {
    await ensureSheetExists("DH", token);
    
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

    // 2. Đọc cột A (gian), Cột D (mdh) từ sheet DH
    const { res, data } = await fetchJsonWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("DH!A:D")}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(data.error?.message || "Không thể đọc dữ liệu Sheet DH");
    const rows = data.values || [];
    if (rows.length <= 1) {
      throw new Error("Sheet DH chưa có dữ liệu đơn hàng nào để cập nhật.");
    }

    let reqOrderId = String(message.orderId || "").trim().toLowerCase();
    reqOrderId = reqOrderId.replace(/copy|sao\s*ch[eé]p/gi, "").trim();
    const reqGian = String(message.maGian || message.noidung || "").trim().toLowerCase();

    if (!reqOrderId) {
      throw new Error("Không có Mã đơn hàng để cập nhật.");
    }

    // 3. Tìm các dòng khớp mã đơn hàng (và mã gian nếu có)
    let matchingRowNums = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const rowGian = String(r[0] || "").trim().toLowerCase();
      const rowMdh = String(r[3] || "").trim().toLowerCase().replace(/copy|sao\s*ch[eé]p/gi, "").trim();
      const rowNum = i + 1;

      if (rowMdh === reqOrderId) {
        if (!reqGian || rowGian === reqGian) {
          matchingRowNums.push(rowNum);
        }
      }
    }

    // Nếu lọc theo cả gian không thấy, fallback tìm theo mã đơn hàng
    if (matchingRowNums.length === 0) {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const rowMdh = String(r[3] || "").trim().toLowerCase().replace(/copy|sao\s*ch[eé]p/gi, "").trim();
        const rowNum = i + 1;
        if (rowMdh === reqOrderId) {
          matchingRowNums.push(rowNum);
        }
      }
    }

    if (matchingRowNums.length === 0) {
      throw new Error(`Không tìm thấy Mã đơn hàng "${reqOrderId.toUpperCase()}"${reqGian ? ` (Gian: ${reqGian})` : ''} trong Sheet DH.`);
    }

    // 4. Cập nhật Cột P (Trạng thái) và Cột Z (Mã yêu cầu trả hàng), Cột AA (Vận chuyển hàng hoàn)
    const updateData = [];
    const statusVal = String(message.status || "").trim();
    const returnIdVal = String(message.returnId || "").trim();
    const trackingVal = String(message.tracking || "").trim();

    for (const rowNum of matchingRowNums) {
      if (statusVal) {
        updateData.push({
          range: `DH!P${rowNum}`,
          values: [[statusVal]]
        });
      }
      updateData.push({
        range: `DH!Z${rowNum}:AA${rowNum}`,
        values: [[returnIdVal, trackingVal]]
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

      if (!updateRes.ok) {
        throw new Error(updateResult.error?.message || "Không thể cập nhật Sheet DH.");
      }
    }

    return {
      ok: true,
      updated: true,
      count: matchingRowNums.length,
      rowNums: matchingRowNums
    };
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

  return false;
});

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
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

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = GOOGLE_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));

    return { res, data };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Google API qua ${Math.round(timeoutMs / 1000)} giay khong phan hoi.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

