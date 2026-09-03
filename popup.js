const button = document.querySelector("#open-add-product");
const uploadButton = document.querySelector("#upload-images");
const uploadDescriptionImagesButton = document.querySelector("#upload-description-images");
const uploadImagesImgbbButton = document.querySelector("#upload-images-imgbb");
const loadSheetImagesButton = document.querySelector("#load-sheet-images");
const chooseFolderButton = document.querySelector("#choose-folder");
const reloadFolderButton = document.querySelector("#reload-folder");
const folderDescriptionInput = document.querySelector("#folder-description");
const pinnedFoldersSelect = document.querySelector("#pinned-folders");
const pinFolderButton = document.querySelector("#pin-folder");
const openPinnedFolderButton = document.querySelector("#open-pinned-folder");
const fillProductTextButton = document.querySelector("#fill-product-text");
const fillProductNameButton = document.querySelector("#fill-product-name");
const fillAllAutoButton = document.querySelector("#fill-all-auto");
const fillProductBrandButton = document.querySelector("#fill-product-brand");
const fillStock0Button = document.querySelector("#fill-stock-0");
const fillStock300Button = document.querySelector("#fill-stock-300");
const btnLayAnh = document.querySelector("#btn-lay-anh");
const btnLayText = document.querySelector("#btn-lay-text");
const btnLayTextCoAnh = document.querySelector("#btn-lay-text-co-anh");
const btnLayAnhMoTa = document.querySelector("#btn-lay-anh-mo-ta");
const productTextInput = document.querySelector("#product-text");
const productBrandInput = document.querySelector("#product-brand");
const productIdInput = document.querySelector("#product-id");
const skuBceList = document.querySelector("#sku-bce-list");
const giaBanInput = document.querySelector("#sheet-gia-ban");
const giaThapNhatInput = document.querySelector("#sheet-gia-thap-nhat");
const giaTinhInput = document.querySelector("#sheet-gia-tinh");
const copyGiaTinhButton = document.querySelector("#copy-gia-tinh");
const sheetPriceList = document.querySelector("#sheet-price-list");
const sheetSearchQuery = document.querySelector("#sheet-search-query");
const clearSearchBtn = document.querySelector("#clear-search");
const sheetSearchResults = document.querySelector("#sheet-search-results");
const folderNameText = document.querySelector("#folder-name");
const imageList = document.querySelector("#image-list");
const imageCountText = document.querySelector("#image-count");
const imageSizeFilters = document.querySelector("#image-size-filters");
const fixedImagePreview = document.querySelector("#fixed-image-preview");
const toggleImageListSizeButton = document.querySelector("#toggle-image-list-size");
const statusText = document.querySelector("#status");
const saveToSheetTestButton = document.querySelector("#save-to-sheet-test");
const loadIncomeRowsButton = document.querySelector("#load-income-rows");
const saveAllIncomeRowsButton = document.querySelector("#save-all-income-rows");
const addAflRowsButton = document.querySelector("#add-afl-rows");
const incomeTable = document.querySelector("#income-table");
const incomeRowCountText = document.querySelector("#income-row-count");
const openPrintFlowButton = document.querySelector("#open-print-flow");
const printFlowSelectCheckboxButton = document.querySelector("#print-flow-select-checkbox");
const loadPrintWarehousesButton = document.querySelector("#load-print-warehouses");
const printWarehouseButtons = document.querySelector("#print-warehouse-buttons");
const loadPrintAddressesButton = document.querySelector("#load-print-addresses");
const printAddressButtons = document.querySelector("#print-address-buttons");
const selectWarehouseHanoiButton = document.querySelector("#select-warehouse-hanoi");
const selectWarehouseHcmButton = document.querySelector("#select-warehouse-hcm");
const selectAddressHanoiButton = document.querySelector("#select-address-hanoi");
const selectAddressHcmButton = document.querySelector("#select-address-hcm");
const arrangePickupConfirmButton = document.querySelector("#arrange-pickup-confirm");
const generatePrintDocButton = document.querySelector("#generate-print-doc");
const exportWaitingOrdersButton = document.querySelector("#export-waiting-orders");
const autoRunPrintFlowButton = document.querySelector("#auto-run-print-flow");
const stopPrintFlowButton = document.querySelector("#stop-print-flow");
const autoStepCheckboxes = Array.from(document.querySelectorAll(".auto-step"));
const autoWarehouseLocationSelect = document.querySelector("#auto-warehouse-location");
const autoAddressLocationSelect = document.querySelector("#auto-address-location");
const autoStepDelayInput = document.querySelector("#auto-step-delay");
const autoShopCodeInput = document.querySelector("#auto-shop-code");
const autoConfigNameInput = document.querySelector("#auto-config-name");
const savedAutoConfigsTable = document.querySelector("#saved-auto-configs-table");
const saveAutoConfigButton = document.querySelector("#save-auto-config");
const loadAutoConfigButton = document.querySelector("#load-auto-config");
const choosePrintFolderButton = document.querySelector("#choose-print-folder");
const reloadPrintFolderButton = document.querySelector("#reload-print-folder");
const printFileCountText = document.querySelector("#print-file-count");
const printPdfTable = document.querySelector("#print-pdf-table");
const printExcelTable = document.querySelector("#print-excel-table");
const PRINT_FLOW_URL = "https://banhang.shopee.vn/portal/sale/mass/ship?mass_shipment_tab=201";
const AUTO_CONFIGS_KEY = "autoRunConfigs";
let isAutoRunningPrintFlow = false;
let printDirectoryHandle = null;
const IMGBB_API_KEY = "1bad1429a242d7040fda3f2cfddb3a25";
let SAMPLE_IMAGE_PREVIEWS = [
  {
    name: "bce.png",
    url: "https://i.ibb.co/xSFYXWTv/bce.png"
  },
  {
    name: "ioy.jpg",
    url: "https://i.ibb.co/21kr5cDw/ioy.jpg"
  }
];

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
const DEFAULT_SPREADSHEET_ID = GOOGLE_SHEET_CONFIG.spreadsheetId;
let spreadsheetConfigLoadPromise = null;

let accessToken = null;
let tokenExpiry = 0;

function applySpreadsheetConfig(spreadsheetId) {
  const savedId = spreadsheetId ? String(spreadsheetId).trim() : "";
  GOOGLE_SHEET_CONFIG.spreadsheetId = savedId || DEFAULT_SPREADSHEET_ID;

  const configInput = document.getElementById("config-spreadsheet-id");
  if (configInput) configInput.value = GOOGLE_SHEET_CONFIG.spreadsheetId;

  return GOOGLE_SHEET_CONFIG.spreadsheetId;
}

function updateSavedSpreadsheetIdDisplay(savedId) {
  const display = document.getElementById("saved-spreadsheet-id");
  if (!display) return;

  const id = savedId ? String(savedId).trim() : "";
  display.textContent = id ? `Google Spreadsheet ID da luu: ${id}` : "Google Spreadsheet ID da luu: (chua co trong storage)";
  display.title = id || "customSpreadsheetId dang rong";
  display.style.color = id ? "#1e293b" : "#ef4444";
}

function loadSavedSpreadsheetIdDisplay() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    updateSavedSpreadsheetIdDisplay("");
    return;
  }

  chrome.storage.local.get(["customSpreadsheetId"], (res) => {
    updateSavedSpreadsheetIdDisplay(res?.customSpreadsheetId || "");
  });
}

function loadSpreadsheetConfig() {
  if (!spreadsheetConfigLoadPromise) {
    spreadsheetConfigLoadPromise = new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve("");
        return;
      }

      chrome.storage.local.get(["customSpreadsheetId"], (res) => {
        resolve(res?.customSpreadsheetId || "");
      });
    });
  }

  return spreadsheetConfigLoadPromise.then(applySpreadsheetConfig);
}

function saveSpreadsheetConfig(spreadsheetId) {
  const nextId = String(spreadsheetId || "").trim();
  spreadsheetConfigLoadPromise = Promise.resolve(nextId);

  return new Promise((resolve) => {
    chrome.storage.local.set({ customSpreadsheetId: nextId }, () => {
      resolve(applySpreadsheetConfig(nextId));
    });
  });
}

async function getGoogleAccessToken(scope) {
  const cachedToken = googleTokenCache.get(scope);

  if (cachedToken?.accessToken && Date.now() < cachedToken.expiry - 300000) {
    return cachedToken.accessToken;
  }

  if (typeof KJUR === "undefined" || !KJUR || !KJUR.jws || !KJUR.jws.JWS) {
    throw new Error("Thư viện jsrsasign (KJUR) chưa được nạp trong SidePanel/Popup!");
  }

  const header = { alg: "RS256", typ: "JWT" }, now = Math.floor(Date.now() / 1000),
    payload = { iss: GOOGLE_SHEET_CONFIG.serviceAccountEmail, scope, aud: GOOGLE_SHEET_CONFIG.tokenUrl, exp: now + 3600, iat: now };
  const sJWT = KJUR.jws.JWS.sign("RS256", JSON.stringify(header), JSON.stringify(payload), GOOGLE_SHEET_CONFIG.privateKey);
  const res = await fetch(GOOGLE_SHEET_CONFIG.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sJWT}` });
  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Khong lay duoc Google token.");
  }

  accessToken = data.access_token; tokenExpiry = Date.now() + (data.expires_in * 1000);
  googleTokenCache.set(scope, {
    accessToken,
    expiry: tokenExpiry
  });

  return accessToken;
}

async function getAccessToken() {
  return getGoogleAccessToken(GOOGLE_SHEETS_SCOPE);
}
const DB_NAME = "shopee-seller-helper";
const DB_VERSION = 3;
const DB_STORE = "handles";
const CACHE_STORE = "image-cache";
const PINNED_FOLDER_STORE = "pinned-folders";
const FOLDER_KEY = "image-folder";
const PRINT_FOLDER_KEY = "print-folder";
const PRINT_FOLDER_NAME_KEY = "printFolderName";
const IMAGE_CACHE_KEY = "latest-images";
const FOLDER_NAME_KEY = "imageFolderName";
const HELPER_DATA_FILE = "shopee-qlsp-data.json";
const DROPPED_IMAGE_PREFIX = "keo-anh";
const DESCRIPTION_IMAGE_MARKER = "ANH_MO_TA:";
const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "webp"
]);
let directoryHandle = null;
let loadedImageFiles = [];
let previewUrls = [];
let draggedImageIndex = null;
let activeImageSizeFilter = "all";
let activeImagePrefixFilter = "all";
let imageSizeCache = new WeakMap();
let sheetProductCache = null;
let sheetProductCachePromise = null;
let latestSheetSearchId = 0;
let searchTimeout = null;
let latestIncomeRows = [];
let dnHangCache = null;

async function fetchDnHangData() {
  const response = await new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "FETCH_DN_HANG" }, resolve);
  });
  if (!response?.ok) return new Map();
  
  const values = response.values || [];
  if (!values.length) return new Map();

  const headers = values[0].map(h => h ? h.toString().trim() : "");
  const maDonIdx = headers.findIndex(h => h.toLowerCase() === "ma don" || h.toLowerCase() === "mã đơn");
  const doanhThuIdx = headers.findIndex(h => h.toLowerCase() === "doanh_thu" || h.toLowerCase() === "doanh thu");
  
  const map = new Map();
  if (maDonIdx === -1) return map;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const maDon = row[maDonIdx];
    if (maDon) {
      let dt = null;
      if (doanhThuIdx !== -1 && row[doanhThuIdx]) {
        // Strip out non-numeric chars except dot/comma and minus
        const dtStr = row[doanhThuIdx].replace(/[^\d.-]/g, "");
        if (dtStr) dt = parseFloat(dtStr);
      }
      map.set(maDon, {
        rowIndex: i,
        doanhThu: dt
      });
    }
  }
  dnHangCache = map;
  return map;
}
let cachedDonHangRows = null;
let lastDonHangFetchTime = 0;

async function fetchDonHangRows(forceRefresh = false) {
  if (!forceRefresh && cachedDonHangRows && Date.now() - lastDonHangFetchTime < 30000) {
    return cachedDonHangRows;
  }
  const token = await getGoogleAccessToken(GOOGLE_SHEETS_SCOPE);
  const fetchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent("DH!A:Z")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await fetchRes.json().catch(() => ({}));
  if (!fetchRes.ok) {
      throw new Error(data.error?.message || "Loi truy cap DH");
  }
  const values = data.values || [];
  if (!values.length) throw new Error("DH rong");
  
  cachedDonHangRows = values;
  lastDonHangFetchTime = Date.now();
  return values;
}

async function fetchDonHangData() {
  const values = await fetchDonHangRows();

  const headers = values[0].map(h => h ? h.toString().trim().toLowerCase() : "");
  const maDonIdx = headers.findIndex(h => h === "mdh" || h === "ma don" || h === "mã đơn" || h === "mã đơn hàng" || h === "ma don hang");
  const doanhThuIdx = headers.findIndex(h => h === "doanh_thu" || h === "doanh thu" || h === "doanhthu" || h === "doanh_thu_thuc_te");
  
  const map = new Map();
  if (maDonIdx === -1) {
    statusText.textContent = `Loi: Khong tim thay cot mdh. Cac cot: ${headers.slice(0,10).join(", ")}`;
    donHangCache = map;
    return map;
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const maDon = row[maDonIdx] ? row[maDonIdx].toString().trim() : null;
    if (maDon) {
      let dt = null;
      if (doanhThuIdx !== -1 && row[doanhThuIdx]) {
        // Strip out non-numeric chars except dot/comma and minus
        const dtStr = row[doanhThuIdx].replace(/[^\d.-]/g, "");
        if (dtStr) dt = parseFloat(dtStr);
      }
      map.set(maDon, {
        rowIndex: i,
        doanhThu: dt
      });
    }
  }
  donHangCache = map;
  return map;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendOpenCommand(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "OPEN_ADD_PRODUCT"
    });
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });

    return chrome.tabs.sendMessage(tabId, {
      type: "OPEN_ADD_PRODUCT"
    });
  }
}

async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });

    return chrome.tabs.sendMessage(tabId, message);
  }
}

function isPrintFlowPage(url) {
  const u = String(url || "");
  return u.includes("banhang.shopee.vn/portal/sale/mass/ship") || u.includes("banhang.shopee.vn/portal/sale/order");
}

async function getOrOpenPrintFlowTab() {
  const activeTab = await getActiveTab();

  if (activeTab?.id && isPrintFlowPage(activeTab.url)) {
    return activeTab;
  }

  // Check if any tab is currently open on Shopee Mass Ship
  const massShipTabs = await chrome.tabs.query({ url: "*://banhang.shopee.vn/portal/sale/mass/ship*" });
  if (massShipTabs && massShipTabs.length > 0) {
    const existingTab = massShipTabs[0];
    await chrome.tabs.update(existingTab.id, { active: true });
    return existingTab;
  }

  // Check if active tab is any Shopee seller tab
  if (activeTab?.id && activeTab.url?.startsWith("https://banhang.shopee.vn/")) {
    await chrome.tabs.update(activeTab.id, { url: PRINT_FLOW_URL });
    await waitForTabLoad(activeTab.id);
    return activeTab;
  }

  const printTab = await chrome.tabs.create({
    url: PRINT_FLOW_URL,
    active: true
  });

  if (printTab?.id) {
    await waitForTabLoad(printTab.id);
  }

  return printTab;
}

function getAutoStepDelayMs() {
  const seconds = Number(autoStepDelayInput?.value || 3);
  const safeSeconds = Math.min(60, Math.max(1, Number.isFinite(seconds) ? seconds : 3));

  if (autoStepDelayInput) {
    autoStepDelayInput.value = String(safeSeconds);
  }

  return safeSeconds * 1000;
}

function getSelectedAutoStepIds() {
  return autoStepCheckboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function getAutoConfigName() {
  const name = String(autoConfigNameInput?.value || "").trim() || "mac-dinh";

  if (autoConfigNameInput) {
    autoConfigNameInput.value = name;
  }

  return name;
}

function getAutoRunConfig() {
  return {
    steps: getSelectedAutoStepIds(),
    warehouseLocation: autoWarehouseLocationSelect?.value || "Ho Chi Minh",
    addressLocation: autoAddressLocationSelect?.value || "Ho Chi Minh",
    delaySeconds: getAutoStepDelayMs() / 1000,
    shopCode: String(autoShopCodeInput?.value || "").trim()
  };
}

function applyAutoRunConfig(config) {
  const steps = new Set(Array.isArray(config?.steps) ? config.steps : []);

  autoStepCheckboxes.forEach((checkbox) => {
    checkbox.checked = steps.size ? steps.has(checkbox.value) : checkbox.checked;
  });

  if (autoWarehouseLocationSelect && config?.warehouseLocation) {
    autoWarehouseLocationSelect.value = config.warehouseLocation;
  }

  if (autoAddressLocationSelect && config?.addressLocation) {
    autoAddressLocationSelect.value = config.addressLocation;
  }

  if (autoStepDelayInput && config?.delaySeconds) {
    autoStepDelayInput.value = String(config.delaySeconds);
    getAutoStepDelayMs();
  }

  if (autoShopCodeInput && config?.shopCode !== undefined) {
    autoShopCodeInput.value = String(config.shopCode);
  }
}

async function saveAutoRunConfig() {
  const name = getAutoConfigName();
  const data = await chrome.storage.local.get(AUTO_CONFIGS_KEY);
  const configs = data[AUTO_CONFIGS_KEY] || {};

  configs[name] = getAutoRunConfig();
  await chrome.storage.local.set({ [AUTO_CONFIGS_KEY]: configs });
  renderSavedAutoConfigs(configs, name);
  if (statusText) statusText.textContent = `Đã lưu cấu hình tự động: ${name}.`;
}

async function loadAutoRunConfig(name = getAutoConfigName()) {
  const configName = String(name || "").trim() || "mac-dinh";
  const data = await chrome.storage.local.get(AUTO_CONFIGS_KEY);
  const config = data[AUTO_CONFIGS_KEY]?.[configName];

  if (!config) {
    if (statusText) statusText.textContent = `Chưa có cấu hình: ${configName}.`;
    return;
  }

  if (autoConfigNameInput) {
    autoConfigNameInput.value = configName;
  }
  applyAutoRunConfig(config);
  if (statusText) statusText.textContent = `Đã tải cấu hình tự động: ${configName}.`;
}

function renderSavedAutoConfigs(configs, selectedName = "") {
  if (!savedAutoConfigsTable) {
    return;
  }

  const names = Object.keys(configs || {}).sort((left, right) => left.localeCompare(right, "vi"));

  savedAutoConfigsTable.textContent = "";

  if (!names.length) {
    const empty = document.createElement("div");
    empty.className = "print-flow-empty";
    empty.textContent = "Chưa có cấu hình đã lưu";
    savedAutoConfigsTable.append(empty);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  thead.innerHTML = "<tr><th>Tên</th><th>Bước</th><th>Giây</th><th>Kho</th><th>Địa chỉ</th><th></th></tr>";

  for (const name of names) {
    const config = configs[name] || {};
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const stepCell = document.createElement("td");
    const delayCell = document.createElement("td");
    const warehouseCell = document.createElement("td");
    const addressCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const loadButton = document.createElement("button");

    if (name === selectedName) {
      row.className = "selected-config-row";
    }

    nameCell.className = "config-name";
    nameCell.textContent = name;
    nameCell.title = name;
    stepCell.textContent = String(Array.isArray(config.steps) ? config.steps.length : 0);
    delayCell.textContent = String(config.delaySeconds || 3);
    warehouseCell.textContent = config.warehouseLocation || "";
    addressCell.textContent = config.addressLocation || "";
    loadButton.type = "button";
    loadButton.className = "ghost";
    loadButton.textContent = "Tải";
    loadButton.addEventListener("click", () => loadAutoRunConfig(name));

    actionCell.append(loadButton);
    row.append(nameCell, stepCell, delayCell, warehouseCell, addressCell, actionCell);
    tbody.append(row);
  }

  table.append(thead, tbody);
  savedAutoConfigsTable.append(table);
}

async function refreshSavedAutoConfigs(selectedName = "") {
  const data = await chrome.storage.local.get(AUTO_CONFIGS_KEY);
  renderSavedAutoConfigs(data[AUTO_CONFIGS_KEY] || {}, selectedName);
}

function setPrintFlowButtonsDisabled(disabled) {
  [
    autoRunPrintFlowButton,
    printFlowSelectCheckboxButton,
    selectWarehouseHanoiButton,
    selectWarehouseHcmButton,
    selectAddressHanoiButton,
    selectAddressHcmButton,
    arrangePickupConfirmButton,
    generatePrintDocButton,
    exportWaitingOrdersButton
  ].forEach((button) => {
    if (button) {
      button.disabled = disabled;
    }
  });
}

async function waitBeforeNextAutoStep(index, total) {
  if (index >= total - 1) {
    return;
  }

  const delayMs = getAutoStepDelayMs();

  if (statusText) statusText.textContent = `Chờ ${delayMs / 1000} giây để chạy bước tiếp theo...`;
  for (let waited = 0; waited < delayMs; waited += 200) {
    if (!isAutoRunningPrintFlow) break;
    await sleep(200);
  }
}

async function selectPrintWarehouseByName(name) {
  const tab = await getOrOpenPrintFlowTab();
  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_SELECT_WAREHOUSE",
    name
  });

  if (!response?.ok) {
    throw new Error(response?.message || `Không chọn được kho ${name}.`);
  }

  return response;
}

async function selectPrintAddressByLocation(location) {
  const tab = await getOrOpenPrintFlowTab();
  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_SELECT_ADDRESS_LOCATION",
    location
  });

  if (!response?.ok) {
    throw new Error(response?.message || `Không chọn được địa chỉ ${location}.`);
  }

  return response;
}

async function runAutomaticPrintFlow() {
  if (isAutoRunningPrintFlow) {
    return;
  }

  const warehouseLocation = autoWarehouseLocationSelect?.value || "Ho Chi Minh";
  const addressLocation = autoAddressLocationSelect?.value || "Ho Chi Minh";
  const selectedStepIds = new Set(getSelectedAutoStepIds());
  const allSteps = [
    {
      id: "warehouse",
      label: `Chọn kho ${warehouseLocation}`,
      run: () => selectPrintWarehouseByName(warehouseLocation)
    },
    {
      id: "checkbox",
      label: "Chọn hộp kiểm",
      run: async () => {
        const tab = await getOrOpenPrintFlowTab();
        return sendMessageToTab(tab.id, { type: "PRINT_FLOW_SELECT_CHECKBOX" });
      }
    },
    {
      id: "address",
      label: `Chọn địa chỉ ${addressLocation}`,
      run: () => selectPrintAddressByLocation(addressLocation)
    },
    {
      id: "pickup",
      label: "Yêu cầu lấy hàng",
      run: async () => {
        const tab = await getOrOpenPrintFlowTab();
        return sendMessageToTab(tab.id, { type: "PRINT_FLOW_ARRANGE_PICKUP" });
      }
    },
    {
      id: "doc",
      label: "Tạo phiếu",
      run: async () => {
        const tab = await getOrOpenPrintFlowTab();
        return sendMessageToTab(tab.id, { type: "PRINT_FLOW_GENERATE_DOC" });
      }
    },
    {
      id: "export",
      label: "Xuất đơn",
      run: async () => {
        const tab = await getOrOpenPrintFlowTab();
        return sendMessageToTab(tab.id, { type: "PRINT_FLOW_EXPORT_WAITING_ORDERS" });
      }
    }
  ];
  const steps = allSteps.filter((step) => selectedStepIds.has(step.id));

  if (!steps.length) {
    if (statusText) statusText.textContent = "Hãy chọn ít nhất một bước để chạy tự động.";
    return;
  }

  isAutoRunningPrintFlow = true;
  setPrintFlowButtonsDisabled(true);
  if (autoRunPrintFlowButton) {
    autoRunPrintFlowButton.classList.add("auto-running");
    autoRunPrintFlowButton.style.display = "none";
  }
  if (stopPrintFlowButton) stopPrintFlowButton.style.display = "inline-block";

  try {
    for (const [index, step] of steps.entries()) {
      if (!isAutoRunningPrintFlow) {
        if (statusText) statusText.textContent = "Đã dừng chạy tự động.";
        break;
      }
      if (statusText) statusText.textContent = `Đang chạy ${index + 1}/${steps.length}: ${step.label}...`;
      const response = await step.run();
      if (statusText) statusText.textContent = response?.message || `Đã xong: ${step.label}.`;
      if (!isAutoRunningPrintFlow) {
        if (statusText) statusText.textContent = "Đã dừng chạy tự động.";
        break;
      }
      await waitBeforeNextAutoStep(index, steps.length);
    }

    if (isAutoRunningPrintFlow) {
      if (statusText) statusText.textContent = `Đã chạy xong ${steps.length} bước, mỗi bước cách nhau ${getAutoStepDelayMs() / 1000} giây.`;
    }
  } catch (error) {
    if (statusText) statusText.textContent = error?.message || "Chạy tự động bị lỗi.";
  } finally {
    isAutoRunningPrintFlow = false;
    setPrintFlowButtonsDisabled(false);
    if (autoRunPrintFlowButton) {
      autoRunPrintFlowButton.classList.remove("auto-running");
      autoRunPrintFlowButton.style.display = "";
    }
    if (stopPrintFlowButton) stopPrintFlowButton.style.display = "none";
  }
}

function renderPrintWarehouseButtons(warehouses) {
  if (!selectWarehouseHanoiButton || !selectWarehouseHcmButton) {
    return;
  }

  const isHanoi = warehouses?.some(w => {
    const n = String(w.name || "").toLowerCase();
    return (n.includes("hà nội") || n.includes("ha noi")) && w.selected;
  });

  const isHcm = warehouses?.some(w => {
    const n = String(w.name || "").toLowerCase();
    return (n.includes("hồ chí minh") || n.includes("ho chi minh")) && w.selected;
  });

  if (isHanoi) {
    selectWarehouseHanoiButton.className = "primary-action";
    selectWarehouseHcmButton.className = "secondary";
  } else if (isHcm) {
    selectWarehouseHanoiButton.className = "secondary";
    selectWarehouseHcmButton.className = "primary-action";
  }
}

async function loadPrintWarehouses() {
  const tab = await getOrOpenPrintFlowTab();

  if (!tab?.id) {
    throw new Error("Không tìm thấy tab Shopee.");
  }

  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_GET_WAREHOUSES"
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Không tải được danh sách kho.");
  }

  renderPrintWarehouseButtons(response.warehouses || []);
  return response.warehouses || [];
}

async function selectPrintWarehouse(name, warehouseButton) {
  if (warehouseButton) {
    warehouseButton.disabled = true;
  }

  if (statusText) statusText.textContent = `Đang chọn kho ${name}...`;

  try {
    const tab = await getOrOpenPrintFlowTab();

    if (!tab?.id) {
      if (statusText) statusText.textContent = "Không tìm thấy tab Shopee.";
      return;
    }

    const response = await sendMessageToTab(tab.id, {
      type: "PRINT_FLOW_SELECT_WAREHOUSE",
      name
    });

    if (statusText) statusText.textContent = response?.message || `Đã chọn kho ${name}.`;
    if (name.includes("Hà Nội") || name.includes("Ha Noi")) {
      selectWarehouseHanoiButton.className = "primary-action";
      selectWarehouseHcmButton.className = "secondary";
    } else {
      selectWarehouseHanoiButton.className = "secondary";
      selectWarehouseHcmButton.className = "primary-action";
    }
  } catch (error) {
    if (statusText) statusText.textContent = error?.message || "Không chọn được kho.";
  } finally {
    if (warehouseButton && document.contains(warehouseButton)) {
      warehouseButton.disabled = false;
    }
  }
}

function renderPrintAddressButtons(addresses) {
  if (!selectAddressHanoiButton || !selectAddressHcmButton) {
    return;
  }

  const isHanoi = addresses?.some(a => {
    const t = String(a.shortText || a.fullText || "").toLowerCase();
    return (t.includes("hà nội") || t.includes("ha noi")) && a.selected;
  });

  const isHcm = addresses?.some(a => {
    const t = String(a.shortText || a.fullText || "").toLowerCase();
    return (t.includes("hồ chí minh") || t.includes("ho chi minh")) && a.selected;
  });

  if (isHanoi) {
    selectAddressHanoiButton.className = "primary-action";
    selectAddressHcmButton.className = "secondary";
  } else if (isHcm) {
    selectAddressHanoiButton.className = "secondary";
    selectAddressHcmButton.className = "primary-action";
  }
}

async function loadPrintAddresses() {
  const tab = await getOrOpenPrintFlowTab();

  if (!tab?.id) {
    throw new Error("Không tìm thấy tab Shopee.");
  }

  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_GET_ADDRESSES"
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Không tải được địa chỉ lấy hàng.");
  }

  renderPrintAddressButtons(response.addresses || []);
  return response.addresses || [];
}

async function selectPrintAddress(id, addressButton) {
  if (addressButton) {
    addressButton.disabled = true;
  }

  if (statusText) statusText.textContent = "Đang chọn địa chỉ lấy hàng...";

  try {
    const tab = await getOrOpenPrintFlowTab();

    if (!tab?.id) {
      if (statusText) statusText.textContent = "Không tìm thấy tab Shopee.";
      return;
    }

    const response = await sendMessageToTab(tab.id, {
      type: "PRINT_FLOW_SELECT_ADDRESS",
      id
    });

    if (statusText) statusText.textContent = response?.message || "Đã chọn địa chỉ lấy hàng.";
  } catch (error) {
    if (statusText) statusText.textContent = error?.message || "Không chọn được địa chỉ.";
  } finally {
    if (addressButton && document.contains(addressButton)) {
      addressButton.disabled = false;
    }
  }
}

async function selectPrintAddressLocation(location, addressButton) {
  if (addressButton) {
    addressButton.disabled = true;
  }

  if (statusText) statusText.textContent = `Đang chọn địa chỉ ${location}...`;

  try {
    const tab = await getOrOpenPrintFlowTab();

    if (!tab?.id) {
      if (statusText) statusText.textContent = "Không tìm thấy tab Shopee.";
      return;
    }

    const response = await sendMessageToTab(tab.id, {
      type: "PRINT_FLOW_SELECT_ADDRESS_LOCATION",
      location
    });

    if (statusText) statusText.textContent = response?.message || `Đã chọn địa chỉ ${location}.`;
  } catch (error) {
    if (statusText) statusText.textContent = error?.message || "Không chọn được địa chỉ.";
  } finally {
    if (addressButton && document.contains(addressButton)) {
      addressButton.disabled = false;
    }
  }
}

async function arrangePickupConfirm() {
  const tab = await getOrOpenPrintFlowTab();

  if (!tab?.id) {
    throw new Error("Không tìm thấy tab Shopee.");
  }

  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_ARRANGE_PICKUP"
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Không bấm được nút yêu cầu VC tới lấy hàng.");
  }

  return response;
}

async function generatePrintDoc() {
  const tab = await getOrOpenPrintFlowTab();

  if (!tab?.id) {
    throw new Error("Không tìm thấy tab Shopee.");
  }

  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_GENERATE_DOC"
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Không tạo được phiếu PDF.");
  }

  return response;
}

async function exportWaitingOrders() {
  const activeTab = await getActiveTab();
  const tab = activeTab?.id && activeTab.url?.startsWith("https://banhang.shopee.vn/")
    ? activeTab
    : await getOrOpenPrintFlowTab();

  if (!tab?.id) {
    throw new Error("Không tìm thấy tab Shopee.");
  }

  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_EXPORT_WAITING_ORDERS"
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Không xuất được đơn hàng.");
  }

  return response;
}

function isSameLocalDate(leftDate, rightDate) {
  return leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate();
}

function isTodayFile(timestamp) {
  const fileDate = new Date(timestamp);
  const today = new Date();

  return isSameLocalDate(fileDate, today);
}

function getPrintFileType(file) {
  const name = String(file?.name || "").toLowerCase();

  if (name.endsWith(".pdf") || file?.type === "application/pdf") {
    return "pdf";
  }

  if (/\.(xlsx|xls|csv)$/.test(name) || /spreadsheet|excel|csv/i.test(file?.type || "")) {
    return "excel";
  }

  return "";
}

function isPrintFileName(name) {
  return /\.(pdf|xlsx|xls|csv)$/i.test(String(name || ""));
}

function formatPrintFileDate(timestamp) {
  return new Date(timestamp).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPrintFileSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function getPrintableFileObject(fileRecord) {
  return fileRecord?.file || fileRecord;
}

function openPrintFile(fileRecord) {
  const file = getPrintableFileObject(fileRecord);

  if (!file) {
    statusText.textContent = "Khong mo duoc file.";
    return;
  }

  const url = URL.createObjectURL(file);

  chrome.tabs.create({ url }, () => {
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}

function renderPrintFileTable(container, files, emptyText) {
  if (!container) {
    return;
  }

  container.textContent = "";

  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "print-flow-empty";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  for (const text of ["File", "Ngay", "Dung luong", ""]) {
    const th = document.createElement("th");
    th.textContent = text;
    headRow.append(th);
  }

  thead.append(headRow);

  const tbody = document.createElement("tbody");

  for (const file of files) {
    const row = document.createElement("tr");
    const nameTd = document.createElement("td");
    const dateTd = document.createElement("td");
    const sizeTd = document.createElement("td");
    const actionTd = document.createElement("td");
    const openButton = document.createElement("button");
    const fileObject = getPrintableFileObject(file);

    row.draggable = Boolean(fileObject);
    row.title = fileObject ? "Keo file nay vao web hoac bam mat de mo" : "";
    row.addEventListener("dragstart", (event) => {
      if (!fileObject) {
        event.preventDefault();
        return;
      }

      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", file.webkitRelativePath || file.name);

      try {
        event.dataTransfer.items.add(fileObject);
      } catch (error) {
        event.dataTransfer.setData("DownloadURL", `${fileObject.type || "application/octet-stream"}:${fileObject.name}:${URL.createObjectURL(fileObject)}`);
      }
    });
    nameTd.className = "file-name";
    nameTd.textContent = file.webkitRelativePath || file.name;
    nameTd.title = file.webkitRelativePath || file.name;
    dateTd.textContent = formatPrintFileDate(file.lastModified);
    sizeTd.textContent = formatPrintFileSize(file.size);
    openButton.type = "button";
    openButton.className = "print-file-open";
    openButton.textContent = "ðŸ‘";
    openButton.title = "Mo file";
    openButton.addEventListener("click", () => openPrintFile(file));
    actionTd.append(openButton);

    row.append(nameTd, dateTd, sizeTd, actionTd);
    tbody.append(row);
  }

  table.append(thead, tbody);
  container.append(table);
}

function renderPrintFiles(files) {
  const recentFiles = Array.from(files || []).filter((file) => isTodayFile(file.lastModified));
  const pdfFiles = recentFiles
    .filter((file) => getPrintFileType(file) === "pdf")
    .sort((a, b) => b.lastModified - a.lastModified);
  const excelFiles = recentFiles
    .filter((file) => getPrintFileType(file) === "excel")
    .sort((a, b) => b.lastModified - a.lastModified);

  if (printFileCountText) {
    printFileCountText.textContent = `${pdfFiles.length + excelFiles.length} file`;
  }

  renderPrintFileTable(printPdfTable, pdfFiles, "Khong co file PDF hom nay");
  renderPrintFileTable(printExcelTable, excelFiles, "Khong co file Excel hom nay");
}

async function collectPrintFilesFromDirectory(directoryHandle) {
  const files = [];
  const MAX_SCAN_COUNT = 1000;
  let scanned = 0;

  for await (const [name, handle] of directoryHandle.entries()) {
    scanned += 1;

    if (scanned > MAX_SCAN_COUNT) {
      throw new Error(`Thu muc qua nhieu file, da dung sau ${MAX_SCAN_COUNT} file dau.`);
    }

    if (handle.kind !== "file") {
      continue;
    }

    if (!isPrintFileName(name)) {
      continue;
    }

    const file = await handle.getFile();

    if (!isTodayFile(file.lastModified)) {
      continue;
    }

    files.push({
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      webkitRelativePath: name
    });
  }

  return files;
}

async function loadPrintFilesFromHandle(directoryHandle) {
  if (!directoryHandle) {
    throw new Error("Chua luu thu muc file in don.");
  }

  if (await directoryHandle.queryPermission({ mode: "read" }) !== "granted") {
    const permission = await directoryHandle.requestPermission({ mode: "read" });

    if (permission !== "granted") {
      throw new Error("Chua duoc cap quyen doc thu muc.");
    }
  }

  const files = await collectPrintFilesFromDirectory(directoryHandle);

  renderPrintFiles(files);

  return files;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatIncomeMoney(value) {
  return `d${Number(value || 0).toLocaleString("vi-VN")}`;
}

function normalizeSheetHeader(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findIncomeSheetColumn(headers, names) {
  const normalizedNames = names.map(normalizeSheetHeader);

  return headers.findIndex((header) => normalizedNames.includes(normalizeSheetHeader(header)));
}

function parseSheetNumber(value) {
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");

  return cleaned ? Number(cleaned) || 0 : 0;
}

function getSheetNumber(row, columnIndex) {
  return columnIndex >= 0 ? parseSheetNumber(row[columnIndex]) : 0;
}

function getSheetText(row, columnIndex) {
  return columnIndex >= 0 ? String(row[columnIndex] || "").trim() : "";
}

function buildIncomeOrderInfoMap(dhRows) {
  const headers = dhRows[0] || [];
  const orderIndex = findIncomeSheetColumn(headers, ["ma don hang", "mdh"]);
  const trackingIndex = findIncomeSheetColumn(headers, ["ma van don", "mvd"]);
  const profitIndex = findIncomeSheetColumn(headers, ["loi_nhuan", "loi nhuan"]);
  const buyerPaidIndex = findIncomeSheetColumn(headers, [
    "tong so tien nguoi mua thanh toan",
    "tong_so_tien_nguoi_mua_thanh_toan",
    "tong tien nguoi mua thanh toan"
  ]);
  const fixedFeeIndex = findIncomeSheetColumn(headers, ["phi co dinh", "phi_co_dinh"]);
  const serviceFeeIndex = findIncomeSheetColumn(headers, ["phi dich vu", "phi_dich_vu"]);
  const paymentFeeIndex = findIncomeSheetColumn(headers, ["phi thanh toan", "phi_thanh_toan"]);
  const pishipIndex = findIncomeSheetColumn(headers, ["piship"]);
  const taxIndex = findIncomeSheetColumn(headers, ["phi_thue", "thue", "phi thue"]);
  const otherFeeIndex = findIncomeSheetColumn(headers, ["phi_khac", "phi khac"]);
  const productCostIndex = findIncomeSheetColumn(headers, ["gia_sp", "gia sp"]);
  const productCostByOrder = new Map();
  const map = new Map();

  if (orderIndex < 0) {
    return map;
  }

  dhRows.slice(1).forEach((row) => {
    const orderId = String(row[orderIndex] || "").trim();

    if (orderId) {
      productCostByOrder.set(orderId, (productCostByOrder.get(orderId) || 0) + getSheetNumber(row, productCostIndex));
    }
  });

  dhRows.slice(1).forEach((row) => {
    const orderId = String(row[orderIndex] || "").trim();

    if (!orderId || map.has(orderId)) {
      return;
    }

    const existingProfit = getSheetText(row, profitIndex);
    const calculatedProfit = getSheetNumber(row, buyerPaidIndex) -
      getSheetNumber(row, fixedFeeIndex) -
      getSheetNumber(row, serviceFeeIndex) -
      getSheetNumber(row, paymentFeeIndex) -
      getSheetNumber(row, pishipIndex) -
      getSheetNumber(row, taxIndex) -
      getSheetNumber(row, otherFeeIndex) -
      (productCostByOrder.get(orderId) || 0);

    map.set(orderId, {
      mvd: getSheetText(row, trackingIndex),
      loi_nhuan: existingProfit || calculatedProfit
    });
  });

  return map;
}

async function fetchIncomeSheetValues(range, token) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error?.message || `Khong doc duoc ${range}.`);
  }

  return data.values || [];
}

async function appendIncomeSheetValues(range, values, token) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values })
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error?.message || "Khong ghi duoc THU_CHI.");
  }

  return data;
}

async function ensureThuChiSheetForPopup(token) {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meta = await metaRes.json().catch(() => ({}));

  if (!metaRes.ok) {
    throw new Error(meta.error?.message || "Khong doc duoc danh sach sheet.");
  }

  const hasThuChi = (meta.sheets || []).some((sheet) => sheet.properties?.title === "THU_CHI");

  if (!hasThuChi) {
    const createRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: "THU_CHI" } } }]
      })
    });
    const createData = await createRes.json().catch(() => ({}));

    if (!createRes.ok) {
      throw new Error(createData.error?.message || "Khong tao duoc sheet THU_CHI.");
    }
  }
}

function buildThuChiRowsFromIncome(rows, orderInfoMap) {
  return rows.map((row, index) => [
    `TC${Date.now()}${String(index + 1).padStart(3, "0")}`,
    row.ngay,
    "thu",
    "\u0111\u01a1n h\u00e0ng",
    row.mdh,
    orderInfoMap.get(row.mdh)?.mvd || "",
    row.so_tien,
    orderInfoMap.get(row.mdh)?.loi_nhuan ?? ""
  ]);
}

function renderIncomeRows(rows) {
  latestIncomeRows = rows || [];

  if (incomeRowCountText) {
    incomeRowCountText.textContent = `${latestIncomeRows.length} dong`;
  }

  if (!incomeTable) {
    return;
  }

  if (!latestIncomeRows.length) {
    incomeTable.innerHTML = `<div class="income-empty">Chua co dong de ghi</div>`;
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const headRow = document.createElement("tr");

  ["Ngay", "Ma don", "So tien", ""].forEach((title) => {
    const th = document.createElement("th");
    th.textContent = title;
    headRow.append(th);
  });
  thead.append(headRow);

  latestIncomeRows.forEach((row, index) => {
    const tr = document.createElement("tr");
    const dateTd = document.createElement("td");
    const orderTd = document.createElement("td");
    const moneyTd = document.createElement("td");
    const actionTd = document.createElement("td");
    const button = document.createElement("button");

    dateTd.textContent = row.ngay || "";
    orderTd.textContent = row.mdh || "";
    moneyTd.textContent = formatIncomeMoney(row.so_tien);
    moneyTd.className = "money";
    
    button.type = "button";
    button.className = "ghost mini-action";
    button.textContent = "Thêm";
    button.addEventListener("click", () => saveIncomeRows([latestIncomeRows[index]], button));
    actionTd.append(button);
    const dnData = donHangCache ? donHangCache.get((row.mdh || "").trim()) : null;
    const doanhThu = dnData ? (dnData.doanhThu || 0) : 0;
    const aflValue = doanhThu - row.so_tien;
    const addAflBtn = document.createElement("button");
    addAflBtn.type = "button";
    addAflBtn.className = "ghost mini-action";
    addAflBtn.textContent = "Thêm afl: " + formatIncomeMoney(aflValue);
    addAflBtn.style.padding = "2px 6px";
    addAflBtn.style.marginLeft = "4px";
    addAflBtn.style.color = "#ee4d2d";
    
    addAflBtn.addEventListener("click", async () => {
      addAflBtn.disabled = true;
      statusText.textContent = "Dang luu afl cho 1 don...";
      try {
        if (!dnData) throw new Error("Khong tim thay ma don tren sheet DH de ghi afl!");
        
        const token = await getAccessToken();
        const fetchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent("DH!1:1")}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!fetchRes.ok) throw new Error("Khong the lay header DH");
        const data = await fetchRes.json();
        const values = data.values || [];
        if (!values.length) throw new Error("DH trong");

        const headers = values[0].map(h => h ? h.toString().trim() : "");
        const aflIdx = headers.findIndex(h => h.toLowerCase() === "afl");

        if (aflIdx === -1) throw new Error("Khong tim thay cot afl trong DH");

        const getColumnLetter = (colIdx) => {
          let temp, letter = '';
          while (colIdx >= 0) {
            temp = colIdx % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            colIdx = (colIdx - temp) / 26 - 1;
          }
          return letter;
        };


        const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values:batchUpdate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            valueInputOption: "RAW",
            data: updateData
          })
        });
        if (!batchRes.ok) {
            const err = await batchRes.json().catch(()=>({}));
            throw new Error(err.error?.message || "Loi khi ghi sheet");
        }
        
        statusText.textContent = "Luu afl thanh cong.";
        addAflBtn.textContent = "Ok";
        addAflBtn.style.color = "";
      } catch (error) {
        statusText.textContent = error?.message || "Loi them afl.";
        addAflBtn.disabled = false;
      }
    });
    
    actionTd.prepend(addAflBtn);


    tr.append(dateTd, orderTd, moneyTd, actionTd);
    tbody.append(tr);
  });

  table.append(thead, tbody);
  incomeTable.replaceChildren(table);
}

async function loadIncomeRowsFromActiveTab() {
  const tab = await getActiveTab();

  if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/portal/finance/income")) {
    throw new Error("Hay mo trang Doanh thu Shopee truoc.");
  }

  const response = await sendMessageToTab(tab.id, {
    type: "GET_VISIBLE_INCOME_ROWS"
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Khong lay duoc du lieu doanh thu.");
  }

  return response.rows || [];
}

async function saveIncomeRows(rows, button) {
  if (!rows?.length) {
    statusText.textContent = "Khong co dong de ghi.";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Dang ghi";
  }

  try {
    const token = await getAccessToken();

    await ensureThuChiSheetForPopup(token);

    const dhRows = await fetchIncomeSheetValues("DH_S!A1:CZ", token).catch(() => []);
    const values = buildThuChiRowsFromIncome(rows, buildIncomeOrderInfoMap(dhRows));
    const response = await appendIncomeSheetValues("THU_CHI!A2", values, token);
    const updatedRange = response.updates?.updatedRange || "THU_CHI";

    statusText.textContent = `Da ghi ${rows.length} dong vao ${updatedRange}.`;

    if (button) {
      button.textContent = "Da ghi";
      window.setTimeout(() => {
        if (document.contains(button)) {
          button.disabled = false;
          button.textContent = "Them";
        }
      }, 1500);
    }
  } catch (error) {
    statusText.textContent = error?.message || "Loi ghi THU_CHI.";
    if (button) {
      button.disabled = false;
      button.textContent = "Loi";
    }
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }

      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }

      if (!db.objectStoreNames.contains(PINNED_FOLDER_STORE)) {
        db.createObjectStore(PINNED_FOLDER_STORE, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function saveImageCache(files) {
  const db = await openDb();
  const payload = await Promise.all(files.map(readFileAsDataUrl));

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(CACHE_STORE, "readwrite");
    transaction.objectStore(CACHE_STORE).put(payload, IMAGE_CACHE_KEY);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });

  return payload;
}

async function loadImageCache() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CACHE_STORE, "readonly");
    const request = transaction.objectStore(CACHE_STORE).get(IMAGE_CACHE_KEY);

    request.addEventListener("success", () => resolve(request.result || []));
    request.addEventListener("error", () => reject(request.error));
  });
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

async function saveDirectoryHandle(handle) {
  const db = await openDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put(handle, FOLDER_KEY);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });

  await chrome.storage.local.set({
    [FOLDER_NAME_KEY]: handle.name
  });
}

async function loadDirectoryHandle() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get(FOLDER_KEY);

    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function savePrintDirectoryHandle(handle) {
  const db = await openDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put(handle, PRINT_FOLDER_KEY);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });

  await chrome.storage.local.set({
    [PRINT_FOLDER_NAME_KEY]: handle.name
  });
}

async function loadPrintDirectoryHandle() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get(PRINT_FOLDER_KEY);

    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function getPinnedFolders() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PINNED_FOLDER_STORE, "readonly");
    const request = transaction.objectStore(PINNED_FOLDER_STORE).getAll();

    request.addEventListener("success", () => {
      resolve((request.result || []).sort((left, right) => {
        return String(left.name || "").localeCompare(String(right.name || ""), "vi");
      }));
    });
    request.addEventListener("error", () => reject(request.error));
  });
}

async function savePinnedFolder(entry) {
  const db = await openDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PINNED_FOLDER_STORE, "readwrite");
    transaction.objectStore(PINNED_FOLDER_STORE).put(entry);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

async function loadPinnedFolder(id) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PINNED_FOLDER_STORE, "readonly");
    const request = transaction.objectStore(PINNED_FOLDER_STORE).get(id);

    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error));
  });
}

function createFolderId(handle) {
  return `${handle.name}-${Date.now()}`;
}

function createDefaultHelperData() {
  return {
    version: 1,
    folders: [],
    products: []
  };
}

async function readHelperData(handle = directoryHandle) {
  if (!handle) {
    return createDefaultHelperData();
  }

  try {
    const fileHandle = await handle.getFileHandle(HELPER_DATA_FILE);
    const file = await fileHandle.getFile();
    const data = JSON.parse(await file.text());

    return {
      ...createDefaultHelperData(),
      ...data,
      folders: Array.isArray(data.folders) ? data.folders : [],
      products: Array.isArray(data.products) ? data.products : []
    };
  } catch (error) {
    if (error?.name === "NotFoundError") {
      return createDefaultHelperData();
    }

    throw error;
  }
}

async function writeHelperData(data, handle = directoryHandle) {
  if (!handle) {
    return;
  }

  if (!(await ensureDirectoryWritePermission(handle))) {
    throw new Error("Chua duoc cap quyen ghi file json.");
  }

  const fileHandle = await handle.getFileHandle(HELPER_DATA_FILE, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(JSON.stringify({
    version: 1,
    folders: data.folders || [],
    products: data.products || []
  }, null, 2));
  await writable.close();
}

function renderPinnedFolders(folders) {
  pinnedFoldersSelect.textContent = "";

  if (!folders.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Chua co thu muc ghim";
    pinnedFoldersSelect.append(option);
    return;
  }

  for (const folder of folders) {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.description ? `${folder.name} - ${folder.description}` : folder.name;
    pinnedFoldersSelect.append(option);
  }
}

async function refreshPinnedFolders() {
  renderPinnedFolders(await getPinnedFolders());
}

function renderSearchResults(results) {
  sheetSearchResults.textContent = "";
  if (results.length === 0) {
    const item = document.createElement("div");
    item.style.padding = "10px";
    item.style.color = "#667085";
    item.style.fontSize = "12px";
    item.textContent = "Khong tim thay ket qua phù hợp";
    sheetSearchResults.append(item);
    sheetSearchResults.style.display = "block";
    return;
  }

  results.forEach((product, idx) => {
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.style.padding = "10px 12px";
    item.style.cursor = "pointer";
    item.style.borderBottom = idx === results.length - 1 ? "none" : "1px solid #f0f2f5";
    item.style.fontSize = "13px";
    item.style.lineHeight = "1.4";
    item.innerHTML = `<div style="font-weight: bold; color: #2d3748;">${product.id ? '<span style="color: #ee4d2d; margin-right: 4px;">[' + product.id + ']</span>' : ''}${product.name}</div>
                      <div style="font-size: 11px; color: #718096; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.description.substring(0, 80)}...</div>`;

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      productIdInput.value = product.id || "";
      productTextInput.value = formatProductText({
        name: product.name || "",
        description: product.description || "",
        descriptionImageUrls: product.descriptionImageUrls || []
      });
      productTextInput.dispatchEvent(new Event("input", { bubbles: true }));
      productBrandInput.value = product.brand || "";
      statusText.textContent = "Da chon: " + product.name;
      sheetSearchResults.style.display = "none";
      sheetSearchQuery.value = product.name;
      // Trigger lookup for extra fields
      lookupSpPmData(productIdInput.value.trim());
      // Auto fill: save to storage so content.js picks it up
      const autoFillText = formatProductText({
        name: product.name || "",
        description: product.description || "",
        descriptionImageUrls: product.descriptionImageUrls || []
      });
      chrome.storage.local.set({
        autoFillText: autoFillText,
        autoFillBrand: product.brand || "",
        autoFillTimestamp: Date.now()
      });
    });

    item.addEventListener("mouseover", () => {
      item.style.background = "#f7f9fc";
    });
    item.addEventListener("mouseout", () => {
      item.style.background = "#fff";
    });

    sheetSearchResults.append(item);
  });
  sheetSearchResults.style.display = "block";
}

function renderSearchMessage(message) {
  sheetSearchResults.textContent = "";
  const item = document.createElement("div");

  item.style.padding = "10px";
  item.style.color = "#667085";
  item.style.fontSize = "12px";
  item.textContent = message;
  sheetSearchResults.append(item);
  sheetSearchResults.style.display = "block";
}

function normalizeSearchText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseNumberValue(value) {
  const normalized = String(value || "").replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const numberValue = Number(normalized);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatNumberValue(value) {
  return Math.round(value).toLocaleString("en-US");
}

function updateCalculatedPrice() {
  if (!giaTinhInput) {
    return;
  }

  const giaThapNhat = parseNumberValue(giaThapNhatInput.value);

  giaTinhInput.value = giaThapNhat ? formatNumberValue(giaThapNhat / 0.8) : "";
}

function createPriceCell(label, value) {
  const cell = document.createElement("span");
  const labelElement = document.createElement("strong");

  cell.title = `${label}: ${value || ""}`;
  labelElement.textContent = label;
  cell.append(labelElement, ` ${value || "-"}`);
  return cell;
}

function renderSpPmPriceRows(rows, columnIndexes) {
  if (!sheetPriceList) {
    return;
  }

  sheetPriceList.textContent = "";

  for (const row of rows) {
    const giaBan = String(row[columnIndexes.giaBan] || "").trim();
    const giaThapNhat = String(row[columnIndexes.giaThapNhat] || "").trim();
    const giaThapNhatNumber = parseNumberValue(giaThapNhat);
    const giaTinh = giaThapNhatNumber ? formatNumberValue(giaThapNhatNumber / 0.8) : "";
    const item = document.createElement("div");

    item.className = "sheet-price-item";
    item.append(
      createPriceCell("Bán", giaBan),
      createPriceCell("Thấp", giaThapNhat),
      createPriceCell("/0.8", giaThapNhat ? giaTinh : "")
    );
    sheetPriceList.append(item);
  }
}

async function loadSheetProducts() {
  if (sheetProductCache) {
    return sheetProductCache;
  }

  if (sheetProductCachePromise) {
    return sheetProductCachePromise;
  }

  sheetProductCachePromise = (async () => {
    const token = await getAccessToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/test!A:Z`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || "Khong doc duoc Google Sheet.");
    }

    const rows = data.values || [];
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
    let idIdx = headers.findIndex(h => h === "sku" || h === "id_sp" || h === "mã" || h === "id");
    let nameIdx = headers.findIndex(h => h === "ten" || h === "ten_sp" || h === "tên" || h === "tên sp" || h === "name" || h === "tên sản phẩm");
    const descIdx = headers.findIndex(h => h === "mota" || h === "mô tả" || h === "mo ta" || h === "description" || h === "chi tiết");
    const brandIdx = headers.findIndex(h => h === "thuong hieu" || h === "thương hiệu" || h === "brand");
    const imgIdx = headers.findIndex(h => h === "anh" || h === "ảnh" || h === "image");

    if (nameIdx === -1 && idIdx === -1) {
      // Fallback to first two columns if headers don't match exactly
      idIdx = 0;
      nameIdx = headers.length > 1 ? 1 : 0;
    }

    sheetProductCache = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if ((idIdx !== -1 && r[idIdx]) || (nameIdx !== -1 && r[nameIdx])) {
        
        let imgUrls = [];
        if (imgIdx !== -1 && r[imgIdx]) {
           imgUrls = r[imgIdx].split(/[\n,;]/).map(u => u.trim()).filter(Boolean);
        }

        sheetProductCache.push({
          id: idIdx !== -1 ? (r[idIdx] || "") : "",
          name: nameIdx !== -1 ? (r[nameIdx] || "") : "",
          brand: brandIdx !== -1 ? (r[brandIdx] || "") : "",
          description: descIdx !== -1 ? (r[descIdx] || "") : "",
          descriptionImageUrls: imgUrls
        });
      }
    }

    return sheetProductCache;
  })().finally(() => {
    sheetProductCachePromise = null;
  });

  return sheetProductCachePromise;
}

async function refreshSavedProducts() {
  sheetProductCache = null;
}

function findRequiredSheetColumn(headers, columnName) {
  const index = headers.indexOf(columnName);

  if (index === -1) {
    throw new Error(`Khong thay cot '${columnName}' trong SP_PM.`);
  }

  return index;
}

async function lookupSpPmData(id) {
  if (!id) {
    skuBceList.textContent = "";
    renderSpPmPriceRows([], {});
    giaBanInput.value = "";
    giaThapNhatInput.value = "";
    updateCalculatedPrice();
    return;
  }
  try {
    const token = await getAccessToken();
    // Fetch wider range A:CZ to look for headers anywhere
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/SP_PM!A1:CZ`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length < 1) {
      statusText.textContent = "Sheet SP_PM dang trong hoặc không truy cập được.";
      return;
    }

    const headers = rows[0].map(h => String(h || "").trim().toLowerCase());

    const idSpIdx = findRequiredSheetColumn(headers, "id_sp");
    const idSpConIdx = headers.indexOf("id_sp_con") !== -1 ? headers.indexOf("id_sp_con") : headers.indexOf("id_sp_ct");
    if (idSpConIdx === -1) {
        throw new Error("Khong thay cot 'id_sp_con' hoac 'id_sp_ct' trong SP_PM.");
    }
    const tenSpIdx = headers.indexOf("ten_sp") !== -1 ? headers.indexOf("ten_sp") : headers.indexOf("ten");
    if (tenSpIdx === -1) {
        throw new Error("Khong thay cot 'ten_sp' hoac 'ten' trong SP_PM.");
    }
    const gBIdx = findRequiredSheetColumn(headers, "gia_ban");
    const gTNIdx = findRequiredSheetColumn(headers, "gia_thap_nhat");

    const searchId = id.toLowerCase();
    const matchingRows = rows.filter((r, idx) => idx > 0 && String(r[idSpIdx] || "").trim().toLowerCase() === searchId);

    skuBceList.textContent = "";

    if (matchingRows.length > 0) {
      const maGianInput = document.getElementById("dh-hoan-text");
      const maGian = maGianInput ? maGianInput.value.trim().toUpperCase() : "";
      
      const skuBceValues = matchingRows.map(r => {
        const idSpCon = String(r[idSpConIdx] || "").trim();
        const tenSp = String(r[tenSpIdx] || "").trim();
        if (!idSpCon) return null;
        if (maGian) {
            return `${idSpCon}-${maGian}-00-001-${tenSp}`;
        }
        return `${idSpCon}-00-001-${tenSp}`;
      }).filter(Boolean);

      if (skuBceValues.length > 0) {
        skuBceValues.forEach(val => {
          const rowDiv = document.createElement("div");
          rowDiv.style.display = "flex";
          rowDiv.style.gap = "4px";
          rowDiv.style.marginBottom = "4px";
          rowDiv.style.alignItems = "center";

          const input = document.createElement("input");
          input.className = "brand-input";
          input.value = val;
          input.readOnly = true;
          input.style.flex = "1";
          input.style.fontSize = "12px";
          input.style.padding = "4px 8px";
          input.style.background = "#f1f5f9";
          input.style.border = "1px solid #d8dee8";
          input.style.borderRadius = "4px";

          const copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.className = "secondary";
          copyBtn.style.padding = "4px 8px";
          copyBtn.style.fontSize = "11px";
          copyBtn.style.width = "auto";
          copyBtn.textContent = "Copy";
          copyBtn.style.minWidth = "50px";
          copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(val).then(() => {
              const oldText = copyBtn.textContent;
              copyBtn.textContent = "OK!";
              setTimeout(() => copyBtn.textContent = oldText, 1000);
            });
          });

          rowDiv.append(input, copyBtn);
          skuBceList.append(rowDiv);
        });
      } else {
        skuBceList.innerHTML = "<i style='color:#999'>Trống</i>";
      }

      const firstRow = matchingRows[0];
      giaBanInput.value = firstRow[gBIdx] || "";
      giaThapNhatInput.value = firstRow[gTNIdx] || "";
      updateCalculatedPrice();
      renderSpPmPriceRows(matchingRows, {
        giaBan: gBIdx,
        giaThapNhat: gTNIdx
      });
      statusText.textContent = `Da tim thay ${matchingRows.length} dong SP_PM cho ${id}.`;
    } else {
      skuBceList.textContent = "K.Thấy";
      giaBanInput.value = "";
      giaThapNhatInput.value = "";
      updateCalculatedPrice();
      renderSpPmPriceRows([], {});
      statusText.textContent = `Khong tim thay ID ${id} trong cot 'id_sp' cua SP_PM.`;
    }
  } catch (error) {
    console.error("Loi lookup SP_PM:", error);
    statusText.textContent = "Loi lookup SP_PM: " + error.message;
  }
}

async function searchInSheet(query) {
  const searchId = ++latestSheetSearchId;

  try {
    const trimmedQuery = String(query || "").trim();

    if (!sheetProductCache) {
      renderSearchMessage("Dang tai goi y tu Google Sheet...");
    }

    const products = await loadSheetProducts();

    if (searchId !== latestSheetSearchId) {
      return;
    }

    if (!trimmedQuery) {
      renderSearchResults(products.slice(0, 50));
      return;
    }

    const searchTerms = normalizeSearchText(trimmedQuery).split(/\s+/).filter(Boolean);
    const filtered = products.filter(p => {
      const text = normalizeSearchText(`${p.id || ""} ${p.name || ""} ${p.brand || ""} ${p.description || ""}`);
      return searchTerms.every(term => text.includes(term));
    });

    renderSearchResults(filtered.slice(0, 50));
  } catch (error) {
    console.error(error);
    if (searchId === latestSheetSearchId) {
      renderSearchMessage(`Khong tai duoc goi y: ${error?.message || "loi Google Sheet"}`);
    }
  }
}

async function ensureDirectoryPermission(handle) {
  if (!handle) {
    return false;
  }

  const options = { mode: "read" };

  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }

  return (await handle.requestPermission(options)) === "granted";
}

async function ensureDirectoryWritePermission(handle) {
  if (!handle) {
    return false;
  }

  const options = { mode: "readwrite" };

  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }

  return (await handle.requestPermission(options)) === "granted";
}

async function hasDirectoryPermission(handle) {
  if (!handle) {
    return false;
  }

  return (await handle.queryPermission({ mode: "read" })) === "granted";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve({
        name: file.name,
        type: file.type || "image/jpeg",
        lastModified: file.lastModified,
        dataUrl: reader.result
      });
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function uploadFileToImgBB(file) {
  const formData = new FormData();

  formData.append("key", "6d207e02198a847aa98d0a2a901485a5");
  formData.append("action", "upload");
  formData.append("source", file);
  formData.append("format", "json");

  const response = await fetch("https://freeimage.host/api/1/upload", {
    method: "POST",
    body: formData
  });
  const data = await response.json();

  if (!response.ok || data.status_code !== 200) {
    throw new Error(data.success?.message || data.error?.message || `Khong tai duoc ${file.name} len Freeimage.host.`);
  }

  const links = [
    data.image?.url,
    data.image?.medium?.url,
    data.image?.thumb?.url,
    data.image?.display_url
  ].filter(Boolean);
  const originalExtension = file.name.split(".").pop()?.toLowerCase();

  if (originalExtension && IMAGE_EXTENSIONS.has(originalExtension)) {
    const matchingLink = links.find((link) => getExtensionFromUrl(link) === originalExtension);

    if (matchingLink) {
      return matchingLink;
    }
  }

  return links[0] || "";
}

async function saveImgBBLinksToSheet(imageLinks) {
  const id = productIdInput.value.trim();

  if (!id) {
    throw new Error("Nhap ID san pham truoc khi luu link ImgBB vao Sheet.");
  }

  const token = await getAccessToken();
  const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/test!A:E`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const checkData = await checkRes.json();

  if (!checkRes.ok) {
    throw new Error(checkData.error?.message || "Khong doc duoc Google Sheet.");
  }

  const rows = checkData.values || [];
  const foundRowIndex = rows.findIndex(row => String(row[0] || "").trim() === id);
  const newImageCellValue = imageLinks.join("\n");

  if (foundRowIndex < 0) {
    throw new Error(`Khong tim thay ID ${id} trong cot A de luu vao cung hang.`);
  }

  const rowNum = foundRowIndex + 1;
  const existingImageCellValue = String(rows[foundRowIndex]?.[4] || "").trim();
  const imageCellValue = existingImageCellValue
    ? `${existingImageCellValue}\n${newImageCellValue}`
    : newImageCellValue;
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/test!E${rowNum}:E${rowNum}?valueInputOption=RAW`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [[imageCellValue]]
    })
  });
  const updateData = await updateRes.json().catch(() => ({}));

  if (!updateRes.ok) {
    throw new Error(updateData.error?.message || "Khong luu duoc link vao cot E.");
  }

  return {
    rowNum
  };
}

async function uploadVisibleImagesToImgBB() {
  uploadImagesImgbbButton.disabled = true;
  statusText.textContent = "Dang chuan bi tai anh len ImgBB...";

  try {
    if (!loadedImageFiles.length) {
      await loadFolderImages();
    }

    const files = getVisibleImageFiles();

    if (!files.length) {
      statusText.textContent = "Chua co anh dang hien thi de tai len ImgBB.";
      return;
    }

    const imageLinks = [];

    for (const [index, file] of files.entries()) {
      statusText.textContent = `Dang tai ImgBB ${index + 1}/${files.length}...`;
      const link = await uploadFileToImgBB(file);

      if (link) {
        imageLinks.push(link);
      }
    }

    if (!imageLinks.length) {
      statusText.textContent = "ImgBB khong tra ve link anh.";
      return;
    }

    statusText.textContent = "Dang luu link ImgBB vao cot E...";
    const savedRange = await saveImgBBLinksToSheet(imageLinks);
    sheetProductCache = null;
    statusText.textContent = `Da tai ${imageLinks.length} anh len ImgBB va them vao test!E${savedRange.rowNum}.`;
  } catch (error) {
    statusText.textContent = `Loi ImgBB: ${error?.message || "khong tai duoc anh"}`;
  } finally {
    uploadImagesImgbbButton.disabled = false;
  }
}

function parseSheetImageLinks(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((link) => link.trim())
    .filter(isImageUrl);
}

async function getSheetImageLinksById(id) {
  const token = await getAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/test!A:E`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Khong doc duoc Google Sheet.");
  }

  const rows = data.values || [];
  const row = rows.find((item) => String(item[0] || "").trim() === id);

  return parseSheetImageLinks(row?.[4] || "");
}

async function fileFromSheetImageUrl(url, index) {
  const response = await fetch(url, { credentials: "omit" });

  if (!response.ok) {
    throw new Error(`Khong tai duoc anh Sheet ${index + 1}: ${response.status}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || response.headers.get("content-type") || "image/jpeg";

  if (!String(mimeType).startsWith("image/")) {
    throw new Error(`Link Sheet ${index + 1} khong phai anh.`);
  }

  const extension = getExtensionFromUrl(url) || getExtensionFromMimeType(mimeType) || "jpg";

  return new File([blob], `sheet-${String(index + 1).padStart(2, "0")}.${extension}`, {
    type: mimeType,
    lastModified: Date.now()
  });
}

async function loadImagesFromSheetColumn() {
  loadSheetImagesButton.disabled = true;
  statusText.textContent = "Dang lay link anh tu cot E...";

  try {
    const id = productIdInput.value.trim();

    if (!id) {
      statusText.textContent = "Nhap ID san pham truoc khi lay anh tu Sheet.";
      productIdInput.focus();
      return;
    }

    const imageLinks = await getSheetImageLinksById(id);

    if (!imageLinks.length) {
      statusText.textContent = `Khong thay link anh o cot E cho ID ${id}.`;
      return;
    }

    const files = [];

    for (const [index, imageLink] of imageLinks.entries()) {
      statusText.textContent = `Dang tai anh Sheet ${index + 1}/${imageLinks.length}...`;
      files.push(await fileFromSheetImageUrl(imageLink, index));
    }

    loadedImageFiles = files;
    activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
    refreshImageView();
    await saveImageCache(loadedImageFiles);
    setActiveImageSource("sheet");
    folderNameText.textContent = `Sheet: ${id} - ${loadedImageFiles.length} anh`;
    statusText.textContent = `Da hien ${loadedImageFiles.length} anh tu cot E.`;
  } catch (error) {
    statusText.textContent = `Khong lay duoc anh tu Sheet: ${error?.message || "loi khong ro"}`;
  } finally {
    loadSheetImagesButton.disabled = false;
  }
}

async function fileToPngBlob(file) {
  if (file.type === "image/png") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Khong chuyen duoc anh sang PNG."));
      }
    }, "image/png");
  });
}

async function copyImageToClipboard(file) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Chrome nay chua ho tro sao chep anh.");
  }

  const blob = await fileToPngBlob(file);

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob
    })
  ]);
}

function clearPreviewUrls() {
  for (const url of previewUrls) {
    URL.revokeObjectURL(url);
  }

  previewUrls = [];
}

function isImageFileName(name) {
  const extension = name.split(".").pop()?.toLowerCase();

  return extension ? IMAGE_EXTENSIONS.has(extension) : false;
}

function isImageUrl(url) {
  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" || parsedUrl.protocol === "data:";
  } catch (error) {
    return false;
  }
}

function getUrlsFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const image = doc.querySelector("img");
  const src = image?.currentSrc || image?.src || image?.getAttribute("src");

  return src ? [src] : [];
}

function getDroppedImageUrls(dataTransfer) {
  const candidates = [
    dataTransfer.getData("text/uri-list"),
    dataTransfer.getData("text/plain"),
    ...getUrlsFromHtml(dataTransfer.getData("text/html"))
  ]
    .flatMap((value) => String(value || "").split(/\r?\n/))
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith("#") && isImageUrl(value));

  return Array.from(new Set(candidates));
}

function getDroppedImageFiles(dataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  const imageFiles = items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);

  if (imageFiles.length) {
    return imageFiles;
  }

  return Array.from(dataTransfer.files || []).filter((file) => {
    return file.type.startsWith("image/") || isImageFileName(file.name);
  });
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
    const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();

    return extension && IMAGE_EXTENSIONS.has(extension) ? extension : "";
  } catch (error) {
    return "";
  }
}

function createDroppedImageName(source, index, mimeType) {
  const extension = getExtensionFromUrl(source) || getExtensionFromMimeType(mimeType) || "jpg";
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const imageNumber = String(index + 1).padStart(2, "0");

  return `${DROPPED_IMAGE_PREFIX}-${timestamp}-${imageNumber}.${extension}`;
}

async function fileFromDroppedUrl(url, index) {
  if (url.startsWith("data:")) {
    const fileData = {
      name: createDroppedImageName(url, index, url.match(/^data:([^;]+)/)?.[1]),
      dataUrl: url
    };

    return dataUrlToFile(fileData);
  }

  const response = await fetch(url, { credentials: "omit" });

  if (!response.ok) {
    throw new Error(`Khong tai duoc anh: ${response.status}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || response.headers.get("content-type") || "image/jpeg";

  if (!String(mimeType).startsWith("image/")) {
    throw new Error("Link vua tha khong phai anh.");
  }

  return new File([blob], createDroppedImageName(url, index, mimeType), {
    type: mimeType,
    lastModified: Date.now()
  });
}

async function fileFromDescriptionImageUrl(url, index) {
  const response = await fetch(url, { credentials: "omit" });

  if (!response.ok) {
    throw new Error(`Khong tai duoc anh mo ta: ${response.status}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || response.headers.get("content-type") || "image/jpeg";
  const extension = getExtensionFromUrl(url) || getExtensionFromMimeType(mimeType) || "jpg";
  const imageNumber = String(index + 1).padStart(2, "0");

  if (!String(mimeType).startsWith("image/")) {
    throw new Error("Link anh mo ta khong phai anh.");
  }

  return new File([blob], `mo-ta-${imageNumber}.${extension}`, {
    type: mimeType,
    lastModified: Date.now()
  });
}

function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      resolve(false);
    }, timeoutMs);

    function handleUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      resolve(true);
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);
  });
}

async function saveFileToDirectory(file) {
  if (!directoryHandle) {
    directoryHandle = await loadDirectoryHandle();
  }

  if (!directoryHandle) {
    return false;
  }

  const hasWritePermission = await directoryHandle.queryPermission({ mode: "readwrite" }) === "granted";

  if (!hasWritePermission) {
    return false;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || DROPPED_IMAGE_PREFIX;
  const { fileHandle } = await getAvailableFileHandle(directoryHandle, baseName, extension);
  const writable = await fileHandle.createWritable();

  await writable.write(file);
  await writable.close();

  return true;
}

async function addDroppedImages(files) {
  if (!files.length) {
    statusText.textContent = "Khong thay anh de luu.";
    return;
  }

  const validFiles = files.filter((file) => file.type.startsWith("image/") || isImageFileName(file.name));

  if (!validFiles.length) {
    statusText.textContent = "Du lieu vua tha khong phai anh.";
    return;
  }

  let savedToFolder = 0;

  loadedImageFiles = [...validFiles, ...loadedImageFiles];
  refreshImageView();
  await saveImageCache(loadedImageFiles);

  for (const file of validFiles) {
    if (await saveFileToDirectory(file)) {
      savedToFolder += 1;
    }
  }

  if (directoryHandle && savedToFolder) {
    folderNameText.textContent = `${directoryHandle.name} - ${loadedImageFiles.length} anh`;
  }

  statusText.textContent = savedToFolder
    ? `Da luu ${savedToFolder} anh vao thu muc.`
    : `Da luu ${validFiles.length} anh vao cache. Chon thu muc de luu ra may.`;
}

async function handleDroppedImages(event) {
  event.preventDefault();
  event.stopPropagation();
  imageList.classList.remove("drop-target");

  if (draggedImageIndex !== null) {
    return;
  }

  const droppedFiles = getDroppedImageFiles(event.dataTransfer);
  const imageUrls = droppedFiles.length ? [] : getDroppedImageUrls(event.dataTransfer).slice(0, 1);

  if (!droppedFiles.length && !imageUrls.length) {
    statusText.textContent = "Hay tha truc tiep vao hinh anh tren web.";
    return;
  }

  statusText.textContent = "Dang luu anh vua tha...";

  try {
    const urlFiles = await Promise.all(imageUrls.map(fileFromDroppedUrl));
    await addDroppedImages([...droppedFiles, ...urlFiles]);
  } catch (error) {
    statusText.textContent = error?.message || "Khong luu duoc anh vua tha.";
  }
}

function getDescriptionImageFiles(files) {
  const validFiles = files.filter((file) => {
    const name = file.name.toLowerCase();
    return name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png");
  });
  const descriptionFiles = validFiles.filter((file) => {
    return /(^|[-_\s])mo[-_\s]?ta([-_\s]|\d|\.)/.test(file.name.toLowerCase());
  });

  return descriptionFiles.length ? descriptionFiles : validFiles;
}

function moveImage(fromIndex, toIndex) {
  const actualFromIndex = getLoadedImageIndexFromVisibleIndex(fromIndex);
  const actualToIndex = getLoadedImageIndexFromVisibleIndex(toIndex);

  if (
    !Number.isInteger(actualFromIndex) ||
    !Number.isInteger(actualToIndex) ||
    actualFromIndex === actualToIndex ||
    actualFromIndex < 0 ||
    actualToIndex < 0 ||
    actualFromIndex >= loadedImageFiles.length ||
    actualToIndex >= loadedImageFiles.length
  ) {
    return;
  }

  const [file] = loadedImageFiles.splice(actualFromIndex, 1);
  loadedImageFiles.splice(actualToIndex, 0, file);
  refreshImageView();
  saveImageCache(loadedImageFiles).catch(() => {
    statusText.textContent = "Da sap xep anh, nhung chua luu duoc cache.";
  });
  statusText.textContent = "Da sap xep lai thu tu anh.";
}

async function removeImage(index) {
  const actualIndex = getLoadedImageIndexFromVisibleIndex(index);

  if (actualIndex < 0 || actualIndex >= loadedImageFiles.length) {
    return;
  }

  loadedImageFiles.splice(actualIndex, 1);
  refreshImageView();

  try {
    await saveImageCache(loadedImageFiles);
    statusText.textContent = "Da xoa anh khoi danh sach.";
  } catch (error) {
    statusText.textContent = "Da xoa anh, nhung chua luu duoc cache.";
  }
}


async function openAiInNewTab(aiType, file, text, btnEl) {
  const oldHtml = btnEl.innerHTML;
  btnEl.innerHTML = '...';
  btnEl.disabled = true;
  
  try {
    const images = [];
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });
      images.push({ base64, mimeType: file.type || 'image/png' });
    } catch(e) { console.warn('Could not read image file', e); }
    
    if (aiType === 'gemini') {
      await chrome.storage.local.set({ geminiPayload: { text: text, images, timestamp: Date.now() } });
      const tab = await chrome.tabs.create({ url: 'https://gemini.google.com/app', active: true });
      const onUpdated = (tabId, info) => {
        if (tabId !== tab.id || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: 'GEMINI_FILL', text: text, images });
        }, 2500);
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
    } else {
      await chrome.storage.local.set({ chatgptPayload: { text: text, images, timestamp: Date.now() } });
      const tab = await chrome.tabs.create({ url: 'https://chatgpt.com/', active: true });
      const onUpdated = (tabId, info) => {
        if (tabId !== tab.id || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: 'CHATGPT_FILL', text: text, images });
        }, 3000);
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
    }
  } catch(err) {
    console.error(`Mo ${aiType} error:`, err);
  } finally {
    setTimeout(() => { btnEl.innerHTML = oldHtml; btnEl.disabled = false; }, 3500);
  }
}

function createImageGptButton(file) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "image-gpt-button";
  btn.title = "Tạo quảng cáo sản phẩm trên ChatGPT";
  btn.setAttribute("aria-label", "Tạo quảng cáo ChatGPT");
  btn.innerHTML = '🤖';
  btn.addEventListener("mousedown", (e) => e.stopPropagation());
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openAiInNewTab('chatgpt', file, "tạo quảng cáo sản phẩm", btn);
  });
  return btn;
}

function createImageGeminiButton(file) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "image-gemini-button";
  btn.title = "Tạo quảng cáo sản phẩm trên Gemini";
  btn.setAttribute("aria-label", "Tạo quảng cáo Gemini");
  btn.innerHTML = '✨';
  btn.addEventListener("mousedown", (e) => e.stopPropagation());
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openAiInNewTab('gemini', file, "tạo quảng cáo sản phẩm", btn);
  });
  return btn;
}

function createImageMenuButton(index) {
  const menuButton = document.createElement("button");

  menuButton.type = "button";
  menuButton.className = "image-menu-button";
  menuButton.title = "Xoa anh khoi danh sach";
  menuButton.setAttribute("aria-label", "Xoa anh khoi danh sach");
  menuButton.innerHTML = `
    <svg viewBox="0 0 17 17" aria-hidden="true" focusable="false">
      <path d="M3.5,7 C4.328125,7 5,7.671875 5,8.5 C4.9984375,9.328125 4.328125,9.9984375 3.5,10 C2.671875,10 2,9.328125 2,8.5 C2,7.671875 2.671875,7 3.5,7 Z M8.5,7 C9.328125,7 10,7.671875 10,8.5 C9.9984375,9.328125 9.328125,9.9984375 8.5,10 C7.671875,10 7,9.328125 7,8.5 C7,7.671875 7.671875,7 8.5,7 Z M13.5,7 C14.328125,7 15,7.671875 15,8.5 C14.9984375,9.328125 14.328125,9.9984375 13.5,10 C12.671875,10 12,9.328125 12,8.5 C12,7.671875 12.671875,7 13.5,7 Z M3.5,8 C3.2234375,8 3,8.2234375 3,8.5 C3,8.7765625 3.2234375,9 3.5,9 C3.7765625,9 4,8.7765625 4,8.5 C4,8.2234375 3.7765625,8 3.5,8 Z M8.5,8 C8.2234375,8 8,8.2234375 8,8.5 C8,8.7765625 8.2234375,9 8.5,9 C8.7765625,9 9,8.7765625 9,8.5 C9,8.2234375 8.7765625,8 8.5,8 Z M13.5,8 C13.2234375,8 13,8.2234375 13,8.5 C13,8.7765625 13.2234375,9 13.5,9 C13.7765625,9 14,8.7765625 14,8.5 C14,8.2234375 13.7765625,8 13.5,8 Z"></path>
    </svg>
  `;
  menuButton.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  menuButton.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
  menuButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await removeImage(index);
  });

  return menuButton;
}

function createImageCopyButton(index) {
  const copyButton = document.createElement("button");

  copyButton.type = "button";
  copyButton.className = "image-copy-button";
  copyButton.title = "Sao chep anh nay";
  copyButton.setAttribute("aria-label", "Sao chep anh nay");
  copyButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8,7 C8,5.34314575 9.34314575,4 11,4 L18,4 C19.6568542,4 21,5.34314575 21,7 L21,14 C21,15.6568542 19.6568542,17 18,17 L17,17 L17,18 C17,19.6568542 15.6568542,21 14,21 L6,21 C4.34314575,21 3,19.6568542 3,18 L3,10 C3,8.34314575 4.34314575,7 6,7 L8,7 Z M11,6 C10.4477153,6 10,6.44771525 10,7 L10,14 C10,14.5522847 10.4477153,15 11,15 L18,15 C18.5522847,15 19,14.5522847 19,14 L19,7 C19,6.44771525 18.5522847,6 18,6 L11,6 Z M8,9 L6,9 C5.44771525,9 5,9.44771525 5,10 L5,18 C5,18.5522847 5.44771525,19 6,19 L14,19 C14.5522847,19 15,18.5522847 15,18 L15,17 L11,17 C9.34314575,17 8,15.6568542 8,14 L8,9 Z"></path>
    </svg>
  `;
  copyButton.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  copyButton.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
  copyButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyButton.disabled = true;
    statusText.textContent = "Dang sao chep anh...";

    try {
      const file = getVisibleImageFiles()[index];

      if (!file) {
        statusText.textContent = "Khong thay anh de sao chep.";
        return;
      }

      await copyImageToClipboard(file);
      statusText.textContent = `Da sao chep anh: ${file.name}`;
    } catch (error) {
      statusText.textContent = error?.message || "Khong sao chep duoc anh.";
    } finally {
      copyButton.disabled = false;
    }
  });

  return copyButton;
}

function updateImageCount(count) {
  if (!imageCountText) {
    return;
  }

  imageCountText.textContent = `${count} anh`;
}

function setActiveImageSource(source) {
  const sourceButtons = [
    [loadSheetImagesButton, "sheet"]
  ];

  for (const [button, buttonSource] of sourceButtons) {
    if (button) {
      button.classList.toggle("active", buttonSource === source);
    }
  }
}

function createFixedImageCopyButton(itemData) {
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "image-copy-button";
  copyButton.style.right = "5px"; // Override to put it at the very right
  copyButton.title = "Sao chep anh nay";
  copyButton.setAttribute("aria-label", "Sao chep anh nay");
  copyButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8,7 C8,5.34314575 9.34314575,4 11,4 L18,4 C19.6568542,4 21,5.34314575 21,7 L21,14 C21,15.6568542 19.6568542,17 18,17 L17,17 L17,18 C17,19.6568542 15.6568542,21 14,21 L6,21 C4.34314575,21 3,19.6568542 3,18 L3,10 C3,8.34314575 4.34314575,7 6,7 L8,7 Z M11,6 C10.4477153,6 10,6.44771525 10,7 L10,14 C10,14.5522847 10.4477153,15 11,15 L18,15 C18.5522847,15 19,14.5522847 19,14 L19,7 C19,6.44771525 18.5522847,6 18,6 L11,6 Z M8,9 L6,9 C5.44771525,9 5,9.44771525 5,10 L5,18 C5,18.5522847 5.44771525,19 6,19 L14,19 C14.5522847,19 15,18.5522847 15,18 L15,17 L11,17 C9.34314575,17 8,15.6568542 8,14 L8,9 Z"></path>
    </svg>
  `;
  copyButton.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  copyButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyButton.disabled = true;
    statusText.textContent = "Dang sao chep anh...";
    try {
      let fileToCopy = itemData.file;
      if (!fileToCopy) {
        const response = await fetch(itemData.url);
        const blob = await response.blob();
        fileToCopy = new File([blob], itemData.name, { type: blob.type });
      }
      await copyImageToClipboard(fileToCopy);
      statusText.textContent = `Da sao chep anh: ${itemData.name}`;
    } catch (error) {
      statusText.textContent = error?.message || "Khong sao chep duoc anh.";
    } finally {
      copyButton.disabled = false;
    }
  });

  return copyButton;
}

function renderFixedImagePreview(files) {
  if (!fixedImagePreview) {
    return;
  }

  fixedImagePreview.textContent = "";

  const previewItems = SAMPLE_IMAGE_PREVIEWS.map((sample) => {
    const localFile = files.find((file) => {
      const fileName = String(file?.name || "").toLowerCase();

      return fileName.includes(sample.name.split(".")[0]) && isImageFileName(fileName);
    });

    if (localFile) {
      const url = URL.createObjectURL(localFile);

      previewUrls.push(url);
      return {
        name: localFile.name,
        url,
        file: localFile
      };
    }

    return { ...sample, file: null };
  });

  if (!previewItems.length) {
    return;
  }

  for (const itemData of previewItems) {
    const item = document.createElement("div");
    const image = document.createElement("img");
    const name = document.createElement("span");
    const copyButton = createFixedImageCopyButton(itemData);

    item.className = "fixed-image-item";
    item.style.position = "relative";
    image.src = itemData.url;
    image.alt = itemData.name;
    name.textContent = itemData.name;
    item.append(image, copyButton, name);
    fixedImagePreview.append(item);
  }

  const textContainer = document.createElement("div");
  textContainer.style.gridColumn = "1 / -1";
  textContainer.style.marginTop = "8px";
  textContainer.style.padding = "8px";
  textContainer.style.background = "#f8fafc";
  textContainer.style.border = "1px solid #e2e8f0";
  textContainer.style.borderRadius = "4px";
  textContainer.style.display = "flex";
  textContainer.style.justifyContent = "space-between";
  textContainer.style.alignItems = "flex-start";

  const textBlock = document.createElement("div");
  textBlock.id = "fixed-image-preview-text";
  textBlock.style.fontSize = "12px";
  textBlock.style.color = "#1e293b";
  textBlock.style.lineHeight = "1.5";
  textBlock.style.whiteSpace = "pre-wrap";
  textBlock.style.flex = "1";
  textBlock.style.minWidth = "0";

  let productName = "";
  if (productTextInput && productTextInput.value) {
    productName = productTextInput.value.split("|")[0].trim();
  }

  textBlock.textContent = `thay ảnh 2 vào ảnh 1 . thay thế tên sản phẩm + model+ đặc điểm + ảnh minh họa bên dưới phù hợp với sản phẩm + slogan . ${productName}`;

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.textContent = "Copy";
  copyBtn.style.marginLeft = "8px";
  copyBtn.style.padding = "4px 8px";
  copyBtn.style.backgroundColor = "#3b82f6";
  copyBtn.style.color = "white";
  copyBtn.style.border = "none";
  copyBtn.style.borderRadius = "4px";
  copyBtn.style.cursor = "pointer";
  copyBtn.style.fontSize = "11px";
  copyBtn.style.flexShrink = "0";
  copyBtn.style.width = "auto";
  copyBtn.style.minWidth = "unset";
  copyBtn.style.whiteSpace = "nowrap";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(textBlock.textContent).then(() => {
      copyBtn.textContent = "Đã Copy";
      copyBtn.style.backgroundColor = "#22c55e";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.style.backgroundColor = "#3b82f6";
      }, 1500);
    });
  };

  textContainer.append(textBlock, copyBtn);
  fixedImagePreview.append(textContainer);
}

function getImageSizeKey(size) {
  return size ? `${size.width}x${size.height}` : "";
}

function readImageSize(file) {
  const cachedSize = imageSizeCache.get(file);

  if (cachedSize) {
    return Promise.resolve(cachedSize);
  }

  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.addEventListener("load", () => {
      const size = {
        width: image.naturalWidth,
        height: image.naturalHeight
      };

      URL.revokeObjectURL(url);
      imageSizeCache.set(file, size);
      resolve(size);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(null);
    });
    image.src = url;
  });
}

function getFilteredImageFiles() {
  let filtered = loadedImageFiles;
  
  if (activeImagePrefixFilter !== "all") {
    filtered = filtered.filter(file => file.name.charAt(0).toUpperCase() === activeImagePrefixFilter);
  }
  
  if (activeImageSizeFilter !== "all") {
    filtered = filtered.filter((file) => getImageSizeKey(imageSizeCache.get(file)) === activeImageSizeFilter);
  }
  
  return filtered;
}

function getVisibleImageFiles() {
  return getFilteredImageFiles();
}

function getLoadedImageIndexFromVisibleIndex(visibleIndex) {
  const file = getVisibleImageFiles()[visibleIndex];

  return file ? loadedImageFiles.indexOf(file) : -1;
}

function refreshImageView() {
  renderImageList(getFilteredImageFiles());
  renderImageSizeFilters(loadedImageFiles);
}

async function renderImageSizeFilters(files) {
  if (!imageSizeFilters) {
    return;
  }

  imageSizeFilters.textContent = "";

  if (!files.length) {
    activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
    return;
  }

  const sizes = await Promise.all(files.map(readImageSize));
  const sizeCounts = new Map();

  for (const size of sizes) {
    const key = getImageSizeKey(size);

    if (!key) {
      continue;
    }

    sizeCounts.set(key, (sizeCounts.get(key) || 0) + 1);
  }

  if (activeImageSizeFilter !== "all" && !sizeCounts.has(activeImageSizeFilter)) {
    activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
  }

  const prefixCounts = new Map();
  for (const file of files) {
    const prefix = file.name.charAt(0).toUpperCase();
    if (prefix) prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
  }

  const allButton = document.createElement("button");

  allButton.type = "button";
  allButton.className = (activeImageSizeFilter === "all" && activeImagePrefixFilter === "all") ? "active" : "";
  allButton.textContent = `Tat ca ${files.length}`;
  allButton.addEventListener("click", () => {
    activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
    renderImageList(getFilteredImageFiles());
    renderImageSizeFilters(loadedImageFiles);
  });
  imageSizeFilters.append(allButton);

  Array.from(prefixCounts.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, "vi"))
    .forEach(([key, count]) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = activeImagePrefixFilter === key ? "active" : "";
      button.textContent = `[${key}] (${count})`;
      button.style.backgroundColor = activeImagePrefixFilter === key ? "#e0e7ff" : "#f1f5f9";
      button.style.color = activeImagePrefixFilter === key ? "#4338ca" : "#475569";
      button.style.borderColor = activeImagePrefixFilter === key ? "#818cf8" : "#cbd5e1";
      button.addEventListener("click", () => {
        activeImagePrefixFilter = activeImagePrefixFilter === key ? "all" : key;
        renderImageList(getFilteredImageFiles());
        renderImageSizeFilters(loadedImageFiles);
      });
      imageSizeFilters.append(button);
    });

  Array.from(sizeCounts.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, "vi"))
    .forEach(([key, count]) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = activeImageSizeFilter === key ? "active" : "";
      button.textContent = `${key} (${count})`;
      button.addEventListener("click", () => {
        activeImageSizeFilter = activeImageSizeFilter === key ? "all" : key;
        renderImageList(getFilteredImageFiles());
        renderImageSizeFilters(loadedImageFiles);
      });
      imageSizeFilters.append(button);
    });
}

function renderImageList(files) {
  clearPreviewUrls();
  imageList.textContent = "";
  updateImageCount(files.length);
  renderFixedImagePreview(files);

  if (!files.length) {
    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = "Thu muc chua co anh.";
    imageList.append(empty);
    return;
  }

  files.forEach((file, index) => {
    const item = document.createElement("div");
    const image = document.createElement("img");
    const name = document.createElement("span");
    const copyButton = createImageCopyButton(index);
    const menuButton = createImageMenuButton(index);
    const gptBtn = createImageGptButton(file);
    const geminiBtn = createImageGeminiButton(file);
    const url = URL.createObjectURL(file);

    previewUrls.push(url);
    item.className = "image-item";
    item.draggable = true;
    item.dataset.index = String(index);
    image.src = url;
    image.alt = file.name;
    name.textContent = file.name;
    item.append(image, gptBtn, geminiBtn, copyButton, menuButton, name);

    item.addEventListener("dragstart", (event) => {
      draggedImageIndex = index;
      item.classList.add("dragging");
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("text/plain", String(index));

      try {
        event.dataTransfer.items.add(file);
      } catch (error) {
        event.dataTransfer.setData("DownloadURL", `${file.type || "image/jpeg"}:${file.name}:${url}`);
      }
    });

    item.addEventListener("dragend", () => {
      draggedImageIndex = null;
      item.classList.remove("dragging");
      imageList.querySelectorAll(".drag-over").forEach((element) => {
        element.classList.remove("drag-over");
      });
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      item.classList.add("drag-over");
      event.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });

    item.addEventListener("drop", async (event) => {
      event.preventDefault();
      item.classList.remove("drag-over");
      const fromIndex = draggedImageIndex ?? Number(event.dataTransfer.getData("text/plain"));
      const toIndex = Number(item.dataset.index);

      if (Number.isInteger(fromIndex)) {
        event.stopPropagation();
        moveImage(fromIndex, toIndex);
        return;
      }

      await handleDroppedImages(event);
    });

    imageList.append(item);
  });
}

toggleImageListSizeButton.addEventListener("click", () => {
  const expanded = imageList.classList.toggle("expanded");

  toggleImageListSizeButton.textContent = expanded ? "Thu gon" : "Mo rong";
  statusText.textContent = expanded ? "Da mo rong khung anh de keo tha nhanh." : "Da thu gon khung anh.";
});

async function readImagesFromDirectory(handle) {
  const files = [];

  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !isImageFileName(entry.name)) {
      continue;
    }

    const file = await entry.getFile();
    files.push(file);
  }

  return files.sort((left, right) => left.name.localeCompare(right.name, "vi"));
}

async function loadFolderImages() {
  if (!directoryHandle) {
    directoryHandle = await loadDirectoryHandle();
  }

  if (!directoryHandle) {
    folderNameText.textContent = "Chua chon thu muc";
    activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
    refreshImageView();
    return;
  }

  const hasPermission = await ensureDirectoryPermission(directoryHandle);

  if (!hasPermission) {
    folderNameText.textContent = "Chua duoc cap quyen doc thu muc";
    activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
    refreshImageView();
    return;
  }

  loadedImageFiles = await readImagesFromDirectory(directoryHandle);
  await saveImageCache(loadedImageFiles);
  folderNameText.textContent = `${directoryHandle.name} - ${loadedImageFiles.length} anh`;
  activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
  refreshImageView();
}

function isShopeeProductPage(url) {
  return /^https:\/\/(?:[^/]+\.)?shopee\.vn\//.test(url || "");
}

function slugifyFileName(text) {
  const normalized = String(text || "san-pham")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);

  return normalized || "san-pham";
}

function getExtensionFromImage(response, url) {
  const contentType = response.headers.get("content-type") || "";
  const mimeExtension = {
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[contentType.split(";")[0].toLowerCase()];

  if (mimeExtension) {
    return mimeExtension;
  }

  const path = new URL(url).pathname;
  const extension = path.split(".").pop()?.toLowerCase();

  return extension && IMAGE_EXTENSIONS.has(extension) ? extension : "jpg";
}

async function getAvailableFileHandle(handle, baseName, extension) {
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const fileName = `${baseName}${suffix}.${extension}`;

    try {
      await handle.getFileHandle(fileName);
    } catch (error) {
      if (error?.name === "NotFoundError") {
        return {
          fileName,
          fileHandle: await handle.getFileHandle(fileName, { create: true })
        };
      }

      throw error;
    }
  }

  throw new Error("Khong tao duoc ten file anh moi.");
}

async function saveImageUrlsToFolder(imageUrls, baseName, nameSuffix = "") {
  if (!imageUrls.length) {
    return [];
  }

  if (!directoryHandle) {
    directoryHandle = await loadDirectoryHandle();
  }

  if (!directoryHandle) {
    throw new Error("Hay chon thu muc anh truoc.");
  }

  if (!(await ensureDirectoryWritePermission(directoryHandle))) {
    throw new Error("Chua duoc cap quyen ghi vao thu muc anh.");
  }

  const savedFileNames = [];
  let failedCount = 0;

  for (const [index, imageUrl] of imageUrls.entries()) {
    statusText.textContent = `Dang luu anh ${index + 1}/${imageUrls.length}...`;

    try {
      const response = await fetch(imageUrl, { credentials: "omit" });

      if (!response.ok) {
        failedCount += 1;
        console.warn("Khong tai duoc anh Shopee", response.status, imageUrl);
        continue;
      }

      const blob = await response.blob();
      const extension = getExtensionFromImage(response, imageUrl);
      const imageNumber = String(index + 1).padStart(2, "0");
      const { fileName, fileHandle } = await getAvailableFileHandle(
        directoryHandle,
        [baseName, nameSuffix, imageNumber].filter(Boolean).join("-"),
        extension
      );
      const writable = await fileHandle.createWritable();

      await writable.write(blob);
      await writable.close();
      savedFileNames.push(fileName);
    } catch (error) {
      failedCount += 1;
      console.warn("Loi khi luu anh Shopee", imageUrl, error);
    }
  }

  if (!savedFileNames.length && failedCount) {
    throw new Error(`Tim thay ${imageUrls.length} link anh nhung khong tai duoc. Hay thu tai lai trang Shopee roi bam lai.`);
  }

  return savedFileNames;
}

function getTimestamp() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = String(now.getFullYear()).slice(-2);
  const H = String(now.getHours()).padStart(2, '0');
  const M = String(now.getMinutes()).padStart(2, '0');
  const S = String(now.getSeconds()).padStart(2, '0');
  return `${d}${m}${y}-${H}${M}${S}`;
}

async function saveProductImagesToFolder(product) {
  const imageUrls = Array.from(new Set(product.imageUrls || [product.imageUrl].filter(Boolean)));
  return saveImageUrlsToFolder(imageUrls, "a" + getTimestamp());
}

async function saveDescriptionImagesToFolder(product) {
  const imageUrls = Array.from(new Set(product.descriptionImageUrls || []));
  return saveImageUrlsToFolder(imageUrls, "m" + getTimestamp());
}

async function saveAllProductImagesToFolder(product) {
  const productFileNames = await saveProductImagesToFolder(product);
  const descriptionFileNames = await saveDescriptionImagesToFolder(product);
  return {
    productFileNames,
    descriptionFileNames
  };
}

async function autoLoadFolderImages() {
  const cachedImages = await loadImageCache();

  if (cachedImages.length) {
    loadedImageFiles = cachedImages.map(dataUrlToFile);
    activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
    refreshImageView();
  }

  directoryHandle = await loadDirectoryHandle();

  if (!directoryHandle) {
    const stored = await chrome.storage.local.get(FOLDER_NAME_KEY);
    folderNameText.textContent = stored[FOLDER_NAME_KEY]
      ? `${stored[FOLDER_NAME_KEY]} - can chon lai thu muc`
      : "Chua chon thu muc";
    if (!cachedImages.length) {
      activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
      refreshImageView();
    }
    return;
  }

  folderNameText.textContent = `${directoryHandle.name} - dang load...`;

  if (!(await hasDirectoryPermission(directoryHandle))) {
    const stored = await chrome.storage.local.get(FOLDER_NAME_KEY);
    folderNameText.textContent = `${stored[FOLDER_NAME_KEY] || directoryHandle.name} - can bam Load Lai Thu Muc`;
    statusText.textContent = cachedImages.length
      ? `Da hien ${cachedImages.length} anh tu cache. Bam Load Lai Thu Muc neu anh moi thay doi.`
      : "Da nho thu muc, bam Load Lai Thu Muc de cap quyen doc.";
    return;
  }

  loadedImageFiles = await readImagesFromDirectory(directoryHandle);
  await saveImageCache(loadedImageFiles);
  folderNameText.textContent = `${directoryHandle.name} - ${loadedImageFiles.length} anh`;
  activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
  refreshImageView();
  statusText.textContent = `Da auto load ${loadedImageFiles.length} anh.`;
}

function parseProductText(rawText) {
  const textStr = String(rawText || "").trim();
  let name = "";
  let descriptionBlock = "";

  if (!textStr.includes("|")) {
    if (textStr.length > 120) {
      descriptionBlock = textStr;
    } else {
      name = textStr;
    }
  } else {
    const parts = textStr.split("|");
    name = parts[0].trim();
    descriptionBlock = parts.slice(1).join("|").trim();
  }

  const markerIndex = descriptionBlock.indexOf(DESCRIPTION_IMAGE_MARKER);
  const description = markerIndex >= 0
    ? descriptionBlock.slice(0, markerIndex).trim()
    : descriptionBlock;
  const descriptionImageUrls = markerIndex >= 0
    ? descriptionBlock
      .slice(markerIndex + DESCRIPTION_IMAGE_MARKER.length)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(isImageUrl)
    : [];

  return {
    name: name,
    description,
    descriptionImageUrls
  };
}

function formatProductText(product, includeImages = true) {
  const descriptionImageUrls = Array.from(new Set(product.descriptionImageUrls || []));
  const description = [
    product.description || "",
    (includeImages && descriptionImageUrls.length)
      ? `${DESCRIPTION_IMAGE_MARKER}\n${descriptionImageUrls.join("\n")}`
      : ""
  ].filter(Boolean).join("\n\n");

  return [product.name || "", description].join(" | ").trim();
}

async function extractProductFromCurrentTab() {
  const tab = await getActiveTab();

  if (!tab?.id || !isShopeeProductPage(tab.url)) {
    throw new Error("Hay mo trang san pham shopee.vn truoc.");
  }

  const product = await sendMessageToTab(tab.id, {
    type: "EXTRACT_SHOPEE_PRODUCT"
  });

  if (!product?.ok) {
    throw new Error(product?.message || "Khong lay duoc du lieu san pham.");
  }

  return product;
}

function setProductDataButtonsDisabled(disabled) {
  if (btnLayAnh) btnLayAnh.disabled = disabled;
  if (btnLayText) btnLayText.disabled = disabled;
  if (btnLayTextCoAnh) btnLayTextCoAnh.disabled = disabled;
  if (btnLayAnhMoTa) btnLayAnhMoTa.disabled = disabled;
}

button.addEventListener("click", async () => {
  button.disabled = true;
  statusText.textContent = "Dang mo...";

  try {
    const tab = await getActiveTab();

    if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
      statusText.textContent = "Hay mo trang banhang.shopee.vn truoc.";
      return;
    }

    const response = await sendOpenCommand(tab.id);

    statusText.textContent = response?.message || "Da gui lenh.";
  } catch (error) {
    statusText.textContent = "Khong gui duoc lenh, hay tai lai trang.";
  } finally {
    button.disabled = false;
  }
});

// Lấy link_in từ sheet CAI_DAT theo mã gian (nếu có cấu hình)
async function getLinkInByMaGian() {
  try {
    const storage = await new Promise(r => chrome.storage.local.get(["maGian", "dhHoanTextValue"], r));
    const maGian = String(storage.maGian || storage.dhHoanTextValue || "").trim().toLowerCase();
    const token = await getAccessToken();
    if (!GOOGLE_SHEET_CONFIG.spreadsheetId) return "";

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/CAI_DAT!A1:Z100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data && data.values && data.values.length > 1) {
      const rows = data.values;
      const headers = (rows[0] || []).map(h => String(h || "").trim().toLowerCase());
      let gianIdx = headers.findIndex(h => h === "gian" || h === "ma gian" || h === "mã gian" || h === "ma_gian");
      if (gianIdx === -1) gianIdx = 1;

      let linkInIdx = headers.findIndex(h => h === "link_in" || h === "link in" || h === "in" || h === "link_in_don" || h === "in_don" || h.includes("link_in") || h.includes("link in"));
      if (linkInIdx !== -1) {
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowGian = String(row[gianIdx] || "").trim().toLowerCase();
          if (rowGian && (!maGian || rowGian === maGian)) {
            const linkIn = String(row[linkInIdx] || "").trim();
            if (linkIn && (linkIn.startsWith("http://") || linkIn.startsWith("https://"))) {
              return linkIn;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("Lỗi đọc link_in từ sheet CAI_DAT:", e);
  }
  return "";
}

if (openPrintFlowButton) {
  openPrintFlowButton.addEventListener("click", async () => {
    openPrintFlowButton.disabled = true;
    statusText.textContent = "Đang mở link in...";

    try {
      let targetUrl = await getLinkInByMaGian();
      if (!targetUrl) {
        targetUrl = PRINT_FLOW_URL;
      }

      await chrome.tabs.create({
        url: targetUrl,
        active: true
      });
      statusText.textContent = "Đã mở link in ở tab mới.";
    } catch (error) {
      statusText.textContent = "Không mở được link in: " + error.message;
    } finally {
      openPrintFlowButton.disabled = false;
    }
  });
}

if (printFlowSelectCheckboxButton) {
  printFlowSelectCheckboxButton.addEventListener("click", async () => {
    printFlowSelectCheckboxButton.disabled = true;
    statusText.textContent = "Đang chọn hộp kiểm đơn hàng...";

    try {
      const tab = await getOrOpenPrintFlowTab();

      if (!tab?.id) {
        statusText.textContent = "Không tìm thấy tab Shopee Giao hàng loạt.";
        return;
      }

      const response = await sendMessageToTab(tab.id, {
        type: "PRINT_FLOW_SELECT_CHECKBOX"
      });

      statusText.textContent = response?.message || "Đã gửi lệnh chọn hộp kiểm.";
    } catch (error) {
      statusText.textContent = "Không chọn được hộp kiểm, hãy tải lại trang Shopee.";
    } finally {
      printFlowSelectCheckboxButton.disabled = false;
    }
  });
}

if (loadPrintWarehousesButton) {
  loadPrintWarehousesButton.addEventListener("click", async () => {
    loadPrintWarehousesButton.disabled = true;
    statusText.textContent = "Đang tải danh sách kho...";

    try {
      const warehouses = await loadPrintWarehouses();
      statusText.textContent = warehouses.length
        ? `Đã tải ${warehouses.length} kho.`
        : "Không thấy kho nào.";
    } catch (error) {
      statusText.textContent = error?.message || "Không tải được danh sách kho.";
    } finally {
      loadPrintWarehousesButton.disabled = false;
    }
  });
}

if (autoRunPrintFlowButton) {
  autoRunPrintFlowButton.addEventListener("click", runAutomaticPrintFlow);
}

if (stopPrintFlowButton) {
  stopPrintFlowButton.addEventListener("click", () => {
    isAutoRunningPrintFlow = false;
  });
}

if (saveAutoConfigButton) {
  saveAutoConfigButton.addEventListener("click", saveAutoRunConfig);
}

if (loadAutoConfigButton) {
  loadAutoConfigButton.addEventListener("click", () => loadAutoRunConfig());
}

if (loadPrintAddressesButton) {
  loadPrintAddressesButton.addEventListener("click", async () => {
    loadPrintAddressesButton.disabled = true;
    statusText.textContent = "Đang mở danh sách địa chỉ...";

    try {
      const addresses = await loadPrintAddresses();
      statusText.textContent = addresses.length
        ? `Đã tải ${addresses.length} địa chỉ.`
        : "Không thấy địa chỉ nào.";
    } catch (error) {
      statusText.textContent = error?.message || "Không tải được địa chỉ lấy hàng.";
    } finally {
      loadPrintAddressesButton.disabled = false;
    }
  });
}

if (selectWarehouseHanoiButton) {
  selectWarehouseHanoiButton.addEventListener("click", () => selectPrintWarehouse("Hà Nội", selectWarehouseHanoiButton));
}

if (selectWarehouseHcmButton) {
  selectWarehouseHcmButton.addEventListener("click", () => selectPrintWarehouse("Hồ Chí Minh", selectWarehouseHcmButton));
}

if (selectAddressHanoiButton) {
  selectAddressHanoiButton.addEventListener("click", () => selectPrintAddressLocation("Hà Nội", selectAddressHanoiButton));
}

if (selectAddressHcmButton) {
  selectAddressHcmButton.addEventListener("click", () => selectPrintAddressLocation("Hồ Chí Minh", selectAddressHcmButton));
}

if (arrangePickupConfirmButton) {
  arrangePickupConfirmButton.addEventListener("click", async () => {
    arrangePickupConfirmButton.disabled = true;
    statusText.textContent = "Đang yêu cầu VC tới lấy hàng...";

    try {
      const response = await arrangePickupConfirm();
      statusText.textContent = response?.message || "Đã bấm yêu cầu VC tới lấy hàng.";
    } catch (error) {
      statusText.textContent = error?.message || "Không bấm được nút yêu cầu VC tới lấy hàng.";
    } finally {
      arrangePickupConfirmButton.disabled = false;
    }
  });
}

if (generatePrintDocButton) {
  generatePrintDocButton.addEventListener("click", async () => {
    generatePrintDocButton.disabled = true;
    statusText.textContent = "Đang tạo phiếu in PDF...";

    try {
      const response = await generatePrintDoc();
      statusText.textContent = response?.message || "Đã chọn tạo phiếu PDF. Trang PDF sẽ có nút Tải PDF.";
    } catch (error) {
      statusText.textContent = error?.message || "Không tạo được phiếu PDF.";
    } finally {
      generatePrintDocButton.disabled = false;
    }
  });
}

if (exportWaitingOrdersButton) {
  exportWaitingOrdersButton.addEventListener("click", async () => {
    exportWaitingOrdersButton.disabled = true;
    statusText.textContent = "Đang xuất đơn hàng...";

    try {
      const response = await exportWaitingOrders();
      statusText.textContent = response?.message || "Đã bấm xuất đơn hàng.";
    } catch (error) {
      statusText.textContent = error?.message || "Không xuất được đơn hàng.";
    } finally {
      exportWaitingOrdersButton.disabled = false;
    }
  });
}

if (choosePrintFolderButton) {
  choosePrintFolderButton.addEventListener("click", async () => {
    if (!window.showDirectoryPicker) {
      statusText.textContent = "Chrome nay chua ho tro chon thu muc an toan.";
      return;
    }

    choosePrintFolderButton.disabled = true;
    statusText.textContent = "Dang chon thu muc file in don...";

    try {
      const directoryHandle = await window.showDirectoryPicker({ mode: "read" });
      await savePrintDirectoryHandle(directoryHandle);
      statusText.textContent = "Dang quet PDF/Excel hom nay...";
      const files = await loadPrintFilesFromHandle(directoryHandle);

      statusText.textContent = files.length
        ? `Da doc ${files.length} file PDF/Excel hom nay.`
        : `Khong thay PDF/Excel hom nay trong ${directoryHandle.name}.`;
    } catch (error) {
      statusText.textContent = error?.message || "Chua chon thu muc.";
    } finally {
      choosePrintFolderButton.disabled = false;
    }
  });
}

if (reloadPrintFolderButton) {
  reloadPrintFolderButton.addEventListener("click", async () => {
    reloadPrintFolderButton.disabled = true;
    statusText.textContent = "Dang load lai thu muc file in don...";

    try {
      const directoryHandle = await loadPrintDirectoryHandle();
      const files = await loadPrintFilesFromHandle(directoryHandle);

      statusText.textContent = files.length
        ? `Da load lai ${files.length} file PDF/Excel hom nay.`
        : `Khong thay PDF/Excel hom nay trong ${directoryHandle.name}.`;
    } catch (error) {
      statusText.textContent = error?.message || "Chua co thu muc da luu.";
    } finally {
      reloadPrintFolderButton.disabled = false;
    }
  });
}

chooseFolderButton.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    statusText.textContent = "Chrome nay chua ho tro luu thu muc.";
    return;
  }

  chooseFolderButton.disabled = true;
  statusText.textContent = "Dang chon thu muc...";

  try {
    directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    await saveDirectoryHandle(directoryHandle);
    await loadFolderImages();
    await refreshSavedProducts();
    statusText.textContent = "Da luu thu muc anh.";
  } catch (error) {
    statusText.textContent = "Chua chon thu muc.";
  } finally {
    chooseFolderButton.disabled = false;
  }
});

reloadFolderButton.addEventListener("click", async () => {
  reloadFolderButton.disabled = true;
  statusText.textContent = "Dang load lai thu muc...";

  try {
    await loadFolderImages();
    statusText.textContent = `Da load ${loadedImageFiles.length} anh.`;
  } catch (error) {
    statusText.textContent = "Khong doc duoc thu muc, hay chon lai.";
  } finally {
    reloadFolderButton.disabled = false;
  }
});

pinFolderButton.addEventListener("click", async () => {
  pinFolderButton.disabled = true;
  statusText.textContent = "Dang ghim thu muc...";

  try {
    if (!directoryHandle) {
      directoryHandle = await loadDirectoryHandle();
    }

    if (!directoryHandle) {
      statusText.textContent = "Hay chon thu muc truoc khi ghim.";
      return;
    }

    if (!(await ensureDirectoryWritePermission(directoryHandle))) {
      statusText.textContent = "Chua duoc cap quyen ghi thu muc de luu json.";
      return;
    }

    const pinnedFolders = await getPinnedFolders();
    const existing = pinnedFolders.find((folder) => folder.name === directoryHandle.name);
    const entry = {
      id: existing?.id || createFolderId(directoryHandle),
      name: directoryHandle.name,
      description: folderDescriptionInput.value.trim(),
      pinnedAt: existing?.pinnedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      handle: directoryHandle
    };

    await savePinnedFolder(entry);

    const data = await readHelperData(directoryHandle);
    const folderRecord = {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      pinnedAt: entry.pinnedAt,
      updatedAt: entry.updatedAt
    };
    const folderIndex = data.folders.findIndex((folder) => folder.id === entry.id || folder.name === entry.name);

    if (folderIndex >= 0) {
      data.folders[folderIndex] = folderRecord;
    } else {
      data.folders.push(folderRecord);
    }

    await writeHelperData(data, directoryHandle);
    await refreshPinnedFolders();
    pinnedFoldersSelect.value = entry.id;
    statusText.textContent = `Da ghim ${entry.name} va luu ${HELPER_DATA_FILE}.`;
  } catch (error) {
    statusText.textContent = error?.message || "Khong ghim duoc thu muc.";
  } finally {
    pinFolderButton.disabled = false;
  }
});

openPinnedFolderButton.addEventListener("click", async () => {
  const folderId = pinnedFoldersSelect.value;

  if (!folderId) {
    statusText.textContent = "Chua chon thu muc da ghim.";
    return;
  }

  openPinnedFolderButton.disabled = true;
  statusText.textContent = "Dang mo thu muc da ghim...";

  try {
    const entry = await loadPinnedFolder(folderId);

    if (!entry?.handle) {
      statusText.textContent = "Khong thay thu muc da ghim, hay chon lai.";
      return;
    }

    directoryHandle = entry.handle;
    folderDescriptionInput.value = entry.description || "";
    await saveDirectoryHandle(directoryHandle);
    await loadFolderImages();
    await refreshSavedProducts();
    statusText.textContent = `Da mo nhanh ${entry.name}.`;
  } catch (error) {
    statusText.textContent = "Khong mo duoc thu muc da ghim.";
  } finally {
    openPinnedFolderButton.disabled = false;
  }
});

imageList.addEventListener("dragenter", (event) => {
  if (draggedImageIndex === null) {
    event.preventDefault();
    imageList.classList.add("drop-target");
  }
});

imageList.addEventListener("dragover", (event) => {
  if (draggedImageIndex === null) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    imageList.classList.add("drop-target");
  }
});

imageList.addEventListener("dragleave", (event) => {
  if (!imageList.contains(event.relatedTarget)) {
    imageList.classList.remove("drop-target");
  }
});

imageList.addEventListener("drop", handleDroppedImages);

if (uploadImagesImgbbButton) {
  uploadImagesImgbbButton.addEventListener("click", uploadVisibleImagesToImgBB);
}

if (loadSheetImagesButton) {
  loadSheetImagesButton.addEventListener("click", loadImagesFromSheetColumn);
}

if (btnLayAnh) {
  btnLayAnh.addEventListener("click", async () => {
    setProductDataButtonsDisabled(true);
    statusText.textContent = "Dang lay anh san pham...";
    try {
      const product = await extractProductFromCurrentTab();
      populateExtractedDetails(product);
      const productFileNames = await saveProductImagesToFolder(product);
      await loadFolderImages();
      statusText.textContent = productFileNames.length
        ? `Da luu ${productFileNames.length} anh san pham.`
        : "Khong thay anh san pham.";
    } catch (error) {
      statusText.textContent = error?.message || "Khong lay duoc anh san pham.";
    } finally {
      setProductDataButtonsDisabled(false);
    }
  });
}

if (btnLayText) {
  btnLayText.addEventListener("click", async () => {
    setProductDataButtonsDisabled(true);
    statusText.textContent = "Dang lay text (khong anh)...";
    try {
      const product = await extractProductFromCurrentTab();
      populateExtractedDetails(product);
      productTextInput.value = formatProductText(product, false);
      productTextInput.dispatchEvent(new Event("input", { bubbles: true }));
      productBrandInput.value = product.brand || "";
      statusText.textContent = "Da lay ten va mo ta (khong anh).";
    } catch (error) {
      statusText.textContent = error?.message || "Khong lay duoc text.";
    } finally {
      setProductDataButtonsDisabled(false);
    }
  });
}

if (btnLayTextCoAnh) {
  btnLayTextCoAnh.addEventListener("click", async () => {
    setProductDataButtonsDisabled(true);
    statusText.textContent = "Dang lay text co anh...";
    try {
      const product = await extractProductFromCurrentTab();
      populateExtractedDetails(product);
      productTextInput.value = formatProductText(product, true);
      productTextInput.dispatchEvent(new Event("input", { bubbles: true }));
      productBrandInput.value = product.brand || "";
      statusText.textContent = "Da lay ten, mo ta (co anh).";
    } catch (error) {
      statusText.textContent = error?.message || "Khong lay duoc text co anh.";
    } finally {
      setProductDataButtonsDisabled(false);
    }
  });
}

if (btnLayAnhMoTa) {
  btnLayAnhMoTa.addEventListener("click", async () => {
    setProductDataButtonsDisabled(true);
    statusText.textContent = "Dang lay anh mo ta...";
    try {
      const product = await extractProductFromCurrentTab();
      populateExtractedDetails(product);
      const descriptionFileNames = await saveDescriptionImagesToFolder(product);
      await loadFolderImages();
      statusText.textContent = descriptionFileNames.length
        ? `Da luu ${descriptionFileNames.length} anh mo ta.`
        : "Khong thay anh mo ta.";
    } catch (error) {
      statusText.textContent = error?.message || "Khong lay duoc anh mo ta.";
    } finally {
      setProductDataButtonsDisabled(false);
    }
  });
}

if (productTextInput) {
  productTextInput.addEventListener("input", () => {
    const textBlock = document.getElementById("fixed-image-preview-text");
    if (textBlock) {
      let productName = productTextInput.value.split("|")[0].trim();
      textBlock.textContent = `thay ảnh 2 vào ảnh 1 . thay thế tên sản phẩm + model+ đặc điểm + ảnh minh họa bên dưới phù hợp với sản phẩm + slogan . ${productName}`;
    }
  });
}

function handleSheetSearchInput() {
  searchInSheet(sheetSearchQuery.value);
}

sheetSearchQuery.addEventListener("input", handleSheetSearchInput);
sheetSearchQuery.addEventListener("keyup", handleSheetSearchInput);
sheetSearchQuery.addEventListener("change", handleSheetSearchInput);

productIdInput.addEventListener("change", () => {
  lookupSpPmData(productIdInput.value.trim());
});

productIdInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => lookupSpPmData(productIdInput.value.trim()), 600);
});

if (copyGiaTinhButton) {
  copyGiaTinhButton.addEventListener("click", async () => {
    const value = giaTinhInput.value.trim();

    if (!value) {
      statusText.textContent = "Chua co gia tinh de copy.";
      return;
    }

    await navigator.clipboard.writeText(value.replace(/,/g, ""));
    statusText.textContent = `Da copy gia tinh: ${value}`;
  });
}

sheetSearchQuery.addEventListener("click", () => {
  searchInSheet(sheetSearchQuery.value);
});

clearSearchBtn.addEventListener("click", () => {
  sheetSearchQuery.value = "";
  sheetSearchResults.style.display = "none";
  sheetSearchResults.textContent = "";
  sheetSearchQuery.focus();
});

sheetSearchQuery.addEventListener("focus", () => {
  searchInSheet(sheetSearchQuery.value);
});

document.addEventListener("click", (e) => {
  if (!sheetSearchQuery.contains(e.target) && !sheetSearchResults.contains(e.target)) {
    sheetSearchResults.style.display = "none";
  }
});

// Not used anymore as we have custom overlay click logic


fillProductNameButton.addEventListener("click", async () => {
  fillProductNameButton.disabled = true;
  statusText.textContent = "Dang dien ten san pham...";
  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
      statusText.textContent = "Hay mo trang them san pham truoc.";
      return;
    }
    const productText = parseProductText(productTextInput.value);
    if (!productText.name) {
      statusText.textContent = "Khong co ten san pham de dien.";
      return;
    }
    const response = await sendMessageToTab(tab.id, {
      type: "FILL_PRODUCT_TEXT",
      product: { name: productText.name }
    });
    statusText.textContent = response?.message || "Da dien ten san pham.";
  } catch (error) {
    statusText.textContent = "Loi khi dien ten san pham.";
  } finally {
    fillProductNameButton.disabled = false;
  }
});

fillProductTextButton.addEventListener("click", async () => {
  fillProductTextButton.disabled = true;
  statusText.textContent = "Dang dien mo ta san pham...";
  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
      statusText.textContent = "Hay mo trang them san pham truoc.";
      return;
    }
    const productText = parseProductText(productTextInput.value);
    if (!productText.description) {
      statusText.textContent = "Khong co mo ta san pham de dien.";
      return;
    }
    const response = await sendMessageToTab(tab.id, {
      type: "FILL_PRODUCT_TEXT",
      product: { description: productText.description }
    });
    if (productText.descriptionImageUrls.length) {
      await sleep(500);
      statusText.textContent = `Dang dua ${productText.descriptionImageUrls.length} anh vao mo ta...`;
      const files = await Promise.all(productText.descriptionImageUrls.map(fileFromDescriptionImageUrl));
      const payload = await Promise.all(files.map(readFileAsDataUrl));
      await sendMessageToTab(tab.id, {
        type: "UPLOAD_DESCRIPTION_IMAGES",
        files: payload
      });
    }
    statusText.textContent = response?.message || "Da dien mo ta san pham.";
  } catch (error) {
    statusText.textContent = "Loi khi dien mo ta.";
  } finally {
    fillProductTextButton.disabled = false;
  }
});

fillAllAutoButton.addEventListener("click", async () => {
  fillAllAutoButton.disabled = true;
  statusText.textContent = "Dang bat dau quy trinh dien lien hoan...";
  
  try {
    chrome.storage.local.set({
      autoFillText: productTextInput.value,
      autoFillBrand: productBrandInput ? productBrandInput.value : "",
      autoFillTimestamp: Date.now()
    });
  } catch(e) {}

  try {
    const tab = await getActiveTab();

    if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
      statusText.textContent = "Hay mo trang them san pham truoc.";
      return;
    }

    const productText = parseProductText(productTextInput.value);

    if (!productText.name && !productText.description && !productText.descriptionImageUrls.length) {
      statusText.textContent = "Hay nhap theo dang: Ten san pham | Mo ta san pham.";
      return;
    }

    // Step 1: Fill Name and Description
    statusText.textContent = "Dang dien ten va mo ta...";
    try {
      await sendMessageToTab(tab.id, {
        type: "FILL_PRODUCT_TEXT",
        product: productText
      });
    } catch (e) {
      console.error("Loi dien ten/mo ta:", e);
    }

    if (productText.descriptionImageUrls.length) {
      try {
        await sleep(500);
        statusText.textContent = `Dang dua ${productText.descriptionImageUrls.length} anh vao mo ta...`;
        const files = await Promise.all(productText.descriptionImageUrls.map(fileFromDescriptionImageUrl));
        const payload = await Promise.all(files.map(readFileAsDataUrl));
        await sendMessageToTab(tab.id, {
          type: "UPLOAD_DESCRIPTION_IMAGES",
          files: payload
        });
      } catch (e) {
        console.error("Loi upload anh mo ta:", e);
      }
    }

    // Step 2: Wait and fill Brand
    await sleep(2000);
    const brandVal = productBrandInput ? productBrandInput.value.trim() : "";
    if (brandVal) {
      statusText.textContent = `Dang dien thuong hieu: ${brandVal}...`;
      try {
        await sendMessageToTab(tab.id, {
          type: "FILL_PRODUCT_BRAND",
          brand: brandVal
        });
      } catch (e) {
        console.error("Loi dien thuong hieu:", e);
      }
    }

    // Step 3: Wait and fill each of the 7 attributes
    await sleep(2000);
    const attrs = [
      { name: "Hạn bảo hành", id: "#product-han-bh" },
      { name: "Loại bảo hành", id: "#product-loai-bh" },
      { name: "Dung tích", id: "#product-dung-tich" },
      { name: "Điện áp đầu vào", id: "#product-dien-ap" },
      { name: "Tiêu thụ điện năng", id: "#product-cong-suat" },
      { name: "Số người", id: "#product-so-nguoi" },
      { name: "Tính năng", id: "#product-tinh-nang" }
    ];

    for (const attr of attrs) {
      const val = document.querySelector(attr.id)?.value.trim();
      if (val) {
        statusText.textContent = `Dang dien ${attr.name}: ${val}...`;
        try {
          await sendMessageToTab(tab.id, {
            type: "FILL_PRODUCT_ATTRIBUTE",
            labelName: attr.name,
            value: val
          });
        } catch (e) {
          console.error(`Loi dien ${attr.name}:`, e);
        }
        await sleep(1500);
      }
    }

    // Step 4: Click Variation
    statusText.textContent = "Dang click Them nhom phan loai...";
    try {
      await sendMessageToTab(tab.id, {
        type: "ADD_VARIATION_GROUP",
        name: "phân loại"
      });
    } catch (e) {
      console.error("Loi them nhom phan loai:", e);
    }

    // Step 5: Wait and fill weight + enable all shipping channels
    await sleep(2000);
    statusText.textContent = "Dang dien can nang 2000g va bat het cac kenh van chuyen...";
    let shipRes = null;
    try {
      shipRes = await sendMessageToTab(tab.id, {
        type: "FILL_WEIGHT_SHIPPING",
        weight: 2000
      });
    } catch (e) {
      console.error("Loi dien can nang va van chuyen:", e);
    }

    statusText.textContent = shipRes?.message || "Da hoan thanh quy trinh tu dong dien!";
  } catch (error) {
    statusText.textContent = "Khong dien duoc thong tin, hay tai lai trang.";
  } finally {
    fillProductTextButton.disabled = false;
  }
});

fillProductBrandButton.addEventListener("click", async () => {
  fillProductBrandButton.disabled = true;
  statusText.textContent = "Dang dien thuong hieu...";

  try {
    const tab = await getActiveTab();
    const brand = productBrandInput.value.trim();

    if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
      statusText.textContent = "Hay mo trang them/sua san pham truoc.";
      return;
    }

    if (!brand) {
      statusText.textContent = "Hay nhap thuong hieu truoc.";
      return;
    }

    const response = await sendMessageToTab(tab.id, {
      type: "FILL_PRODUCT_BRAND",
      brand
    });

    statusText.textContent = response?.message || "Da dien thuong hieu.";
  } catch (error) {
    statusText.textContent = error?.message || "Khong dien duoc thuong hieu.";
  } finally {
    fillProductBrandButton.disabled = false;
  }
});

async function fillStock(value) {
  const statusTextOriginal = statusText.textContent;
  statusText.textContent = `Dang dien kho ${value}...`;

  try {
    const tab = await getActiveTab();

    if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
      statusText.textContent = "Hay mo trang quan ly san pham truoc.";
      return;
    }

    const response = await sendMessageToTab(tab.id, {
      type: "FILL_STOCK",
      value
    });

    statusText.textContent = response?.message || "Da dien kho.";
  } catch (error) {
    statusText.textContent = "Khong dien được kho, hay tai lai trang.";
  }
}

fillStock0Button.addEventListener("click", () => fillStock(0));
fillStock300Button.addEventListener("click", () => fillStock(300));

uploadButton.addEventListener("click", async () => {
  uploadButton.disabled = true;
  statusText.textContent = "Dang doc anh...";

  try {
    const tab = await getActiveTab();

    if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
      statusText.textContent = "Hay mo trang them san pham truoc.";
      return;
    }

    if (!loadedImageFiles.length) {
      await loadFolderImages();
    }

    const files = getVisibleImageFiles().slice(0, MAX_IMAGES);

    if (!files.length) {
      statusText.textContent = "Thu muc chua co anh de tai.";
      return;
    }

    const payload = await Promise.all(files.map(readFileAsDataUrl));
    statusText.textContent = `Dang dua ${payload.length} anh vao Shopee...`;

    const response = await sendMessageToTab(tab.id, {
      type: "UPLOAD_PRODUCT_IMAGES",
      files: payload
    });

    statusText.textContent = response?.message || "Da gui anh.";
  } catch (error) {
    statusText.textContent = "Khong tai duoc anh, hay tai lai trang.";
  } finally {
    uploadButton.disabled = false;
  }
});

uploadDescriptionImagesButton.addEventListener("click", async () => {
  uploadDescriptionImagesButton.disabled = true;
  statusText.textContent = "Dang doc anh mo ta...";

  try {
    const tab = await getActiveTab();

    if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
      statusText.textContent = "Hay mo trang them san pham truoc.";
      return;
    }

    if (!loadedImageFiles.length) {
      await autoLoadFolderImages();
    }

    const files = getDescriptionImageFiles(getVisibleImageFiles()).slice(0, 12);

    if (!files.length) {
      statusText.textContent = "Thu muc khong co anh JPG/PNG de tai vao mo ta.";
      return;
    }

    const payload = await Promise.all(files.map(readFileAsDataUrl));
    statusText.textContent = `Dang dua ${payload.length} anh vao mo ta...`;

    const response = await sendMessageToTab(tab.id, {
      type: "UPLOAD_DESCRIPTION_IMAGES",
      files: payload
    });

    statusText.textContent = response?.message || "Da gui anh mo ta.";
  } catch (error) {
    statusText.textContent = "Khong tai duoc anh mo ta, hay tai lai trang.";
  } finally {
    uploadDescriptionImagesButton.disabled = false;
  }
});

loadIncomeRowsButton?.addEventListener("click", async () => {
  loadIncomeRowsButton.disabled = true;
  statusText.textContent = "Dang load thu chi Shopee...";

  try {
    if (!donHangCache) {
      statusText.textContent = "Dang doc DON_HANG...";
      try {
        await fetchDonHangData();
      } catch (err) {
        console.warn("Loi load DON_HANG", err);
      }
    }
    
    const rows = await loadIncomeRowsFromActiveTab();

    renderIncomeRows(rows);
    statusText.textContent = rows.length ? `Da load ${rows.length} dong.` : "Khong thay dong nao tren trang.";
  } catch (error) {
    statusText.textContent = error?.message || "Khong load duoc thu chi.";
  } finally {
    loadIncomeRowsButton.disabled = false;
  }
});



  addAflRowsButton?.addEventListener("click", async () => {
    addAflRowsButton.disabled = true;
    statusText.textContent = "Dang cap nhat afl...";

    try {
      if (!dnHangCache) await fetchDnHangData();
      if (!latestIncomeRows.length) throw new Error("Khong co dong de cap nhat.");

      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "FETCH_DN_HANG" }, resolve);
      });
      if (!response?.ok) throw new Error("Khong the lay header DN_HANG");

      const values = response.values || [];
      if (!values.length) throw new Error("DN_HANG trong");

      const headers = values[0].map(h => h ? h.toString().trim() : "");
      const aflIdx = headers.findIndex(h => h.toLowerCase() === "afl");

      if (aflIdx === -1) {
        throw new Error("Khong tim thay cot afl trong DN_HANG");
      }

      const getColumnLetter = (colIdx) => {
        let temp, letter = '';
        while (colIdx >= 0) {
          temp = colIdx % 26;
          letter = String.fromCharCode(temp + 65) + letter;
          colIdx = (colIdx - temp) / 26 - 1;
        }
        return letter;
      };

      const aflColLetter = getColumnLetter(aflIdx);
      const updateData = [];

      latestIncomeRows.forEach(row => {
        const dnData = dnHangCache.get(row.mdh);
        if (dnData && dnData.doanhThu !== null) {
          const aflValue = row.so_tien - dnData.doanhThu;
          updateData.push({
            range: `DN_HANG!${aflColLetter}${dnData.rowIndex + 1}`,
            values: [[aflValue]]
          });
        }
      });

      if (updateData.length > 0) {
        statusText.textContent = `Dang ghi afl cho ${updateData.length} dong...`;
        const res = await new Promise(resolve => chrome.runtime.sendMessage({ type: "UPDATE_DN_HANG_VALUES", data: updateData }, resolve));
        if (!res?.ok) throw new Error(res?.error || "Loi khi ghi sheet");
        statusText.textContent = `Da ghi xong afl cho ${updateData.length} dong.`;
      } else {
        statusText.textContent = "Khong co dong nao hop le de cap nhat afl.";
      }

    } catch (error) {
      statusText.textContent = error?.message || "Loi them afl.";
    } finally {
      addAflRowsButton.disabled = false;
    }
  });

  saveAllIncomeRowsButton?.addEventListener("click", async () => {
  saveAllIncomeRowsButton.disabled = true;

  try {
    if (!latestIncomeRows.length) {
      renderIncomeRows(await loadIncomeRowsFromActiveTab());
    }

    await saveIncomeRows(latestIncomeRows, saveAllIncomeRowsButton);
  } catch (error) {
    statusText.textContent = error?.message || "Khong ghi duoc tat ca dong.";
  } finally {
    window.setTimeout(() => {
      saveAllIncomeRowsButton.disabled = false;
      saveAllIncomeRowsButton.textContent = "Ghi tat ca";
    }, 1500);
  }
});

// --- QUAN LY DH_HOAN ---
const dhHoanText = document.querySelector("#dh-hoan-text");
const btnDhHoanHuy = document.querySelector("#btn-dh-hoan-huy");
const btnDhHoanHoan = document.querySelector("#btn-dh-hoan-hoan");
const btnDhHoanTra = document.querySelector("#btn-dh-hoan-tra");
const btnDhHoanUpdate = document.querySelector("#btn-dh-hoan-update");

if (dhHoanText) {
  chrome.storage.local.get(["dhHoanTextValue"], (result) => {
    if (result.dhHoanTextValue) {
      dhHoanText.value = result.dhHoanTextValue;
    }
  });

  dhHoanText.addEventListener("input", () => {
    chrome.storage.local.set({ dhHoanTextValue: dhHoanText.value });
  });
}

async function getDhHoanDataFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    let orderId = "";
    let reason = "";
    let returnId = "";
    let tracking = "";
    
    const lines = text.split('\\n');
    for (const line of lines) {
       if (line.startsWith("Mã đơn hàng:")) {
          orderId = line.replace("Mã đơn hàng:", "").trim();
       } else if (line.startsWith("Lý do:")) {
          reason = line.replace("Lý do:", "").trim();
       } else if (line.startsWith("Mã yêu cầu trả hàng:")) {
          returnId = line.replace("Mã yêu cầu trả hàng:", "").trim();
       } else if (line.startsWith("Vận chuyển hàng hoàn:")) {
          tracking = line.replace("Vận chuyển hàng hoàn:", "").trim();
       }
    }
    
    return { orderId, reason, returnId, tracking };
  } catch (err) {
    throw new Error("Khong the doc du lieu tu clipboard. Hay bam Copy Data tren Shopee truoc.");
  }
}

function setDhHoanButtonsDisabled(disabled) {
  if (btnDhHoanHuy) btnDhHoanHuy.disabled = disabled;
  if (btnDhHoanHoan) btnDhHoanHoan.disabled = disabled;
  if (btnDhHoanTra) btnDhHoanTra.disabled = disabled;
  if (btnDhHoanUpdate) btnDhHoanUpdate.disabled = disabled;
}

async function appendDhHoanRow(status) {
  try {
    statusText.textContent = `Đang cập nhật trạng thái (${status}) vào Sheet DH...`;
    setDhHoanButtonsDisabled(true);

    const data = await getDhHoanDataFromClipboard();
    if (!data.orderId) {
      throw new Error("Clipboard không có Mã đơn hàng. Hãy bấm Copy Data trên Shopee.");
    }
    
    const maGian = dhHoanText ? dhHoanText.value.trim() : "";
    
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "UPDATE_DH_RETURN_STATUS",
        status: status,
        orderId: data.orderId,
        reason: data.reason,
        returnId: data.returnId,
        tracking: data.tracking,
        maGian: maGian
      }, resolve);
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Lỗi khi cập nhật vào Sheet DH");
    }

    statusText.textContent = `✅ Đã cập nhật (${status}) cho mã đơn ${data.orderId} vào Sheet DH!`;
  } catch (error) {
    statusText.textContent = `❌ ${error?.message || "Lỗi cập nhật Sheet DH"}`;
  } finally {
    setDhHoanButtonsDisabled(false);
  }
}

async function updateDhHoanRow() {
  try {
    statusText.textContent = `Đang cập nhật thông tin hoàn vào Sheet DH...`;
    setDhHoanButtonsDisabled(true);

    const data = await getDhHoanDataFromClipboard();
    if (!data.orderId) {
      throw new Error("Clipboard không có Mã đơn hàng. Hãy bấm Copy Data trên Shopee.");
    }
    
    const maGian = dhHoanText ? dhHoanText.value.trim() : "";
    
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "UPDATE_DH_RETURN_STATUS",
        status: "",
        orderId: data.orderId,
        reason: data.reason,
        returnId: data.returnId,
        tracking: data.tracking,
        maGian: maGian
      }, resolve);
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Lỗi khi cập nhật Sheet DH");
    }

    statusText.textContent = `✅ Đã cập nhật Mã YC (${data.returnId}) và Vận chuyển (${data.tracking}) cho đơn ${data.orderId} vào Sheet DH!`;
  } catch (error) {
    statusText.textContent = `❌ ${error?.message || "Lỗi cập nhật Sheet DH"}`;
  } finally {
    setDhHoanButtonsDisabled(false);
  }
}

if (btnDhHoanHuy) btnDhHoanHuy.addEventListener("click", () => appendDhHoanRow("Hủy"));
if (btnDhHoanHoan) btnDhHoanHoan.addEventListener("click", () => appendDhHoanRow("Hoàn"));
if (btnDhHoanTra) btnDhHoanTra.addEventListener("click", () => appendDhHoanRow("Trả"));
if (btnDhHoanUpdate) btnDhHoanUpdate.addEventListener("click", updateDhHoanRow);
// -------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  async function fetchHomeB2() {
      const b2Element = document.getElementById("sheet-home-b2");
      if (!b2Element) return;
      if (!GOOGLE_SHEET_CONFIG.spreadsheetId) {
          b2Element.textContent = "⚠️ Chưa cấu hình Spreadsheet ID";
          b2Element.style.color = "#f59e0b";
          return;
      }
      b2Element.textContent = "⏳ Đang kiểm tra ID...";
      b2Element.style.color = "#64748b";
      try {
          const token = await getGoogleAccessToken(GOOGLE_SHEETS_SCOPE);
          const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/Home!B2:B2`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.values && data.values.length > 0) {
              b2Element.textContent = "✅ Kết nối thành công! Ô Home!B2: " + data.values[0][0];
              b2Element.style.color = "#22c55e";
          } else {
              b2Element.textContent = "❌ Lỗi: " + (data.error?.message || "Không thể đọc Home!B2");
              b2Element.style.color = "#ef4444";
          }
      } catch(e) {
          b2Element.textContent = "❌ Lỗi kết nối: " + e.message;
          b2Element.style.color = "#ef4444";
      }
  }

  // Load config spreadsheet ID
  chrome.storage.local.get(["customSpreadsheetId"], (res) => {
      const configInput = document.getElementById("config-spreadsheet-id");
      const savedId = res.customSpreadsheetId ? String(res.customSpreadsheetId).trim() : "";
      applySpreadsheetConfig(savedId);
      updateSavedSpreadsheetIdDisplay(savedId);
      if (configInput) configInput.value = GOOGLE_SHEET_CONFIG.spreadsheetId;
      fetchHomeB2();
      loadAndSortTabsFromCaiDat();
      if (typeof window.fetchGianSuggestions === "function") window.fetchGianSuggestions();
  });

  refreshSavedAutoConfigs(getAutoConfigName()).catch(() => {});
  loadPrintDirectoryHandle().then((handle) => {
    if (handle) {
      printDirectoryHandle = handle;
      loadPrintFilesFromHandle(handle).catch(() => {});
    }
  }).catch(() => {});

  // Tự động đọc danh sách vị trí Tab từ sheet CÀI ĐẶT (Cột A: tap) và sắp xếp lại
  async function loadAndSortTabsFromCaiDat() {
    try {
      const token = await getAccessToken();
      if (!GOOGLE_SHEET_CONFIG.spreadsheetId) return;

      const sheetNamesToTry = ["CAI_DAT", "Cài đặt", "CAI DAT", "Cai Dat", "cai_dat"];
      let rows = null;

      for (const sName of sheetNamesToTry) {
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent(sName + "!A1:Z100")}`;
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            if (data.values && data.values.length > 0) {
              rows = data.values;
              break;
            }
          }
        } catch (e) {}
      }

      if (!rows || rows.length <= 1) return;

      const headers = rows[0] || [];

      // Tìm chỉ số cột 'tap' / 'tab' (Mặc định là Cột A - Index 0)
      let tabOrderIdx = headers.findIndex(h => {
        const s = String(h || "").trim().toLowerCase();
        return s === 'tap' || s === 'tab' || s.includes('tap') || s.includes('thứ tự');
      });
      if (tabOrderIdx === -1) tabOrderIdx = 0; // Cột A (tap)

      // Đọc danh sách tên tab theo thứ tự từ trên xuống dưới ở Cột A
      const sheetTabNames = [];
      for (let i = 1; i < rows.length; i++) {
        const name = String(rows[i][tabOrderIdx] || "").trim();
        if (name) sheetTabNames.push(name.toLowerCase());
      }

      if (sheetTabNames.length === 0) return;

      const tabHeader = document.querySelector('.tab-header');
      if (!tabHeader) return;

      const tabButtons = Array.from(tabHeader.querySelectorAll('.tab-btn'));
      
      function removeAccents(str) {
        return String(str || "")
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ');
      }

      const normalizedSheetTabNames = sheetTabNames.map(removeAccents);

      // Sắp xếp các button theo đúng thứ tự ở Cột A trong Sheet (Lấy vị trí đầu tiên xuất hiện)
      tabButtons.sort((a, b) => {
        const textA = removeAccents(a.textContent);
        const textB = removeAccents(b.textContent);

        let indexA = normalizedSheetTabNames.indexOf(textA);
        if (indexA === -1) {
          indexA = normalizedSheetTabNames.findIndex(n => textA.includes(n) || n.includes(textA));
        }

        let indexB = normalizedSheetTabNames.indexOf(textB);
        if (indexB === -1) {
          indexB = normalizedSheetTabNames.findIndex(n => textB.includes(n) || n.includes(textB));
        }

        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;

        return indexA - indexB;
      });

      // Gắn lại các nút vào DOM theo thứ tự mới
      tabButtons.forEach(btn => tabHeader.appendChild(btn));
    } catch (err) {
      console.warn("Không thể sắp xếp lại tab theo sheet CAI_DAT:", err);
    }
  }


  // Load ma gian and link
  chrome.storage.local.get(["maGian", "gianLinks"], (res) => {
      const maGianInput = document.getElementById("dh-hoan-text");
      if (maGianInput && res.maGian) {
          maGianInput.value = res.maGian;
          const links = res.gianLinks || {};
          const linkInput = document.getElementById("gian-link-text");
          const mG = res.maGian.trim().toLowerCase();
          if (linkInput && links[mG]) {
              linkInput.value = links[mG];
          }
      }
  });

  const maGianInput = document.getElementById("dh-hoan-text");
  if (maGianInput) {
      maGianInput.addEventListener("input", (e) => {
          chrome.storage.local.get(["gianLinks"], (res) => {
              const links = res.gianLinks || {};
              const mG = e.target.value.trim().toLowerCase();
              const linkInput = document.getElementById("gian-link-text");
              if (linkInput && links[mG]) {
                  linkInput.value = links[mG];
              } else if (linkInput) {
                  linkInput.value = "";
              }
          });
          const val = e.target.value.trim();
          chrome.storage.local.set({ maGian: val, dhHoanTextValue: val });
      });
  }

  const btnSaveConfig = document.getElementById("btn-save-config");
  if (btnSaveConfig) {
      btnSaveConfig.addEventListener("click", async () => {
          const newId = document.getElementById("config-spreadsheet-id").value.trim();
          if (newId) {
              await saveSpreadsheetConfig(newId);
              updateSavedSpreadsheetIdDisplay(newId);
              const status = document.getElementById("save-config-status");
              if (status) {
                  status.textContent = "Da luu Spreadsheet ID!";
                  setTimeout(() => status.textContent = "", 3000);
              }
              fetchHomeB2();
              fetchGianSuggestions();
          }
      });
  }


  const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];
  let geminiConfigState = {
      apiKey: "",
      apiKeys: [],
      model: "gemini-2.5-flash",
      models: [...DEFAULT_GEMINI_MODELS]
  };

  const DEFAULT_XKIRO_MODELS = [
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "qwen/qwen3.8-max:free",
      "qwen/qwen3.7-max:free",
      "qwen/qwen3.7-plus:free",
      "qwen/qwen3.6-plus:free",
      "minimax/minimax-m2.7-highspeed:free"
  ];
  let xkiroConfigState = {
      apiKey: "sk-xt-27e56ff5d3d864c86e4993e85cf95f1695698217d913faf3",
      model: "deepseek/deepseek-v4-flash",
      models: [...DEFAULT_XKIRO_MODELS]
  };

  function renderXkiroModels() {
      const select = document.getElementById("xkiro-model-select");
      if (!select) return;
      select.innerHTML = "";
      xkiroConfigState.models.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m;
          let label = m;
          if (m.includes(":free")) label += " (Miễn phí)";
          else if (m.includes("flash")) label += " (Tốc độ cao)";
          else if (m.includes("pro")) label += " (Chất lượng cao)";
          opt.textContent = label;
          opt.selected = m === xkiroConfigState.model;
          select.appendChild(opt);
      });
  }

  function addXkiroModel() {
      const input = document.getElementById("xkiro-new-model");
      const model = input ? input.value.trim() : "";
      if (!model) return;
      if (!xkiroConfigState.models.includes(model)) {
          xkiroConfigState.models.unshift(model);
      }
      xkiroConfigState.model = model;
      if (input) input.value = "";
      chrome.storage.local.set({ xkiroModels: xkiroConfigState.models, xkiroModel: model });
      renderXkiroModels();
  }

  function setGeminiStatus(message, color = "#64748b") {
      const status = document.getElementById("gemini-config-status");
      if (!status) return;
      status.textContent = message || "";
      status.style.color = color;
  }

  function escapeGeminiText(value) {
      return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderGeminiModels() {
      const select = document.getElementById("gemini-model-select");
      const chips = document.getElementById("gemini-model-chips");
      if (!select || !chips) return;

      select.innerHTML = "";
      geminiConfigState.models.forEach(model => {
          const option = document.createElement("option");
          option.value = model;
          option.textContent = model;
          option.selected = model === geminiConfigState.model;
          select.appendChild(option);
      });

      chips.innerHTML = "";
      geminiConfigState.models.forEach(model => {
          const chip = document.createElement("span");
          chip.style.display = "inline-flex";
          chip.style.alignItems = "center";
          chip.style.gap = "5px";
          chip.style.padding = "4px 8px";
          chip.style.border = "1px solid #fed7aa";
          chip.style.borderRadius = "999px";
          chip.style.background = "#ffedd5";
          chip.style.color = "#c2410c";
          chip.style.fontSize = "11px";
          chip.style.fontWeight = "bold";
          chip.innerHTML = `<span>${escapeGeminiText(model)}</span>`;

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.textContent = "x";
          removeBtn.style.border = "none";
          removeBtn.style.background = "transparent";
          removeBtn.style.color = "#dc2626";
          removeBtn.style.cursor = "pointer";
          removeBtn.style.fontWeight = "bold";
          removeBtn.style.padding = "0 2px";
          removeBtn.addEventListener("click", () => {
              if (geminiConfigState.models.length <= 1) {
                  setGeminiStatus("Giu lai it nhat 1 model", "#dc2626");
                  return;
              }
              geminiConfigState.models = geminiConfigState.models.filter(item => item !== model);
              if (geminiConfigState.model === model) geminiConfigState.model = geminiConfigState.models[0];
              chrome.storage.local.set({ geminiModels: geminiConfigState.models, geminiModel: geminiConfigState.model });
              renderGeminiModels();
              setGeminiStatus("Da xoa model", "#16a34a");
          });
          chip.appendChild(removeBtn);
          chips.appendChild(chip);
      });
  }

  function loadGeminiConfig() {
      chrome.storage.local.get(["geminiApiKey", "geminiApiKeys", "geminiModel", "geminiModels", "customSpreadsheetId", "xkiroApiKey", "xkiroModel"], async (res) => {
          geminiConfigState.apiKey = res.geminiApiKey || "";
          geminiConfigState.apiKeys = Array.isArray(res.geminiApiKeys) ? res.geminiApiKeys : (geminiConfigState.apiKey ? [geminiConfigState.apiKey] : []);
          geminiConfigState.models = Array.isArray(res.geminiModels) && res.geminiModels.length ? res.geminiModels : [...DEFAULT_GEMINI_MODELS];
          geminiConfigState.model = res.geminiModel || geminiConfigState.models[0] || "gemini-2.5-flash";
          if (!geminiConfigState.models.includes(geminiConfigState.model)) geminiConfigState.models.unshift(geminiConfigState.model);

          const keyInput = document.getElementById("gemini-api-key");

          // Nếu chưa có API Key trong storage, thử đọc từ sheet cai_dat!E2
          if (!geminiConfigState.apiKey && GOOGLE_SHEET_CONFIG.spreadsheetId) {
            try {
              const token = await getAccessToken();
              const sheetId = res.customSpreadsheetId || GOOGLE_SHEET_CONFIG.spreadsheetId;
              const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/cai_dat!E2`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (sheetRes.ok) {
                const sheetData = await sheetRes.json();
                const fetchedKey = sheetData.values?.[0]?.[0]?.trim();
                if (fetchedKey) {
                  geminiConfigState.apiKey = fetchedKey;
                  if (!geminiConfigState.apiKeys.includes(fetchedKey)) geminiConfigState.apiKeys.push(fetchedKey);
                  chrome.storage.local.set({ geminiApiKey: fetchedKey, geminiApiKeys: geminiConfigState.apiKeys });
                }
              }
            } catch (err) {
              console.warn("Khong tu dong doc duoc Gemini Key tu sheet cai_dat!E2:", err);
            }
          }

          if (keyInput) keyInput.value = geminiConfigState.apiKey;
          
          const keyList = document.getElementById("gemini-api-keys-list");
          if (keyList) {
              keyList.innerHTML = geminiConfigState.apiKeys.map(k => `<option value="${escapeGeminiText(k)}">`).join('');
          }
          
          // Load XKiro settings
          xkiroConfigState.apiKey = (res.xkiroApiKey || "").trim() || "sk-xt-27e56ff5d3d864c86e4993e85cf95f1695698217d913faf3";
          xkiroConfigState.models = Array.isArray(res.xkiroModels) && res.xkiroModels.length ? res.xkiroModels : [...DEFAULT_XKIRO_MODELS];
          xkiroConfigState.model = res.xkiroModel || xkiroConfigState.models[0] || "deepseek/deepseek-v4-flash";
          if (!xkiroConfigState.models.includes(xkiroConfigState.model)) xkiroConfigState.models.unshift(xkiroConfigState.model);

          const xkiroKeyInput = document.getElementById("xkiro-api-key");
          if (xkiroKeyInput) {
              xkiroKeyInput.value = xkiroConfigState.apiKey;
          }

          renderGeminiModels();
          renderXkiroModels();
      });
  }

  async function saveGeminiConfig() {
      const keyInput = document.getElementById("gemini-api-key");
      const modelSelect = document.getElementById("gemini-model-select");
      const xkiroKeyInput = document.getElementById("xkiro-api-key");
      const xkiroSelect = document.getElementById("xkiro-model-select");

      geminiConfigState.apiKey = keyInput ? keyInput.value.trim() : "";
      geminiConfigState.model = modelSelect ? modelSelect.value : geminiConfigState.model;
      
      xkiroConfigState.apiKey = xkiroKeyInput ? xkiroKeyInput.value.trim() : xkiroConfigState.apiKey;
      xkiroConfigState.model = xkiroSelect ? xkiroSelect.value : xkiroConfigState.model;

      if (geminiConfigState.apiKey && !geminiConfigState.apiKeys.includes(geminiConfigState.apiKey)) {
          geminiConfigState.apiKeys.push(geminiConfigState.apiKey);
      }
      
      const keyList = document.getElementById("gemini-api-keys-list");
      if (keyList) {
          keyList.innerHTML = geminiConfigState.apiKeys.map(k => `<option value="${escapeGeminiText(k)}">`).join('');
      }
      
      setGeminiStatus("Dang luu...", "#f59e0b");
      
      chrome.storage.local.set({
          geminiApiKey: geminiConfigState.apiKey,
          geminiApiKeys: geminiConfigState.apiKeys,
          geminiModel: geminiConfigState.model,
          geminiModels: geminiConfigState.models,
          xkiroApiKey: xkiroConfigState.apiKey || "sk-xt-27e56ff5d3d864c86e4993e85cf95f1695698217d913faf3",
          xkiroModel: xkiroConfigState.model || "deepseek/deepseek-v4-flash",
          xkiroModels: xkiroConfigState.models
      }, async () => {
          // Lưu API Key vào Google Sheet cột E (E2) của sheet cai_dat
          if (geminiConfigState.apiKey && GOOGLE_SHEET_CONFIG.spreadsheetId) {
            try {
              const token = await getAccessToken();
              
              let res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/cai_dat!E2?valueInputOption=USER_ENTERED`, {
                method: "PUT",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ values: [[geminiConfigState.apiKey]] })
              });
              
              if (!res.ok) {
                 res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/'Cài đặt'!E2?valueInputOption=USER_ENTERED`, {
                    method: "PUT",
                    headers: {
                      "Authorization": `Bearer ${token}`,
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ values: [[geminiConfigState.apiKey]] })
                 });
              }
            } catch (err) {
              console.warn("Lỗi lưu API Key vào Sheet:", err);
            }
          }
          
          setGeminiStatus("Da luu cau hinh AI", "#16a34a");
          setTimeout(() => setGeminiStatus(""), 2500);
      });
  }

  function addGeminiModel() {
      const input = document.getElementById("gemini-new-model");
      const model = input ? input.value.trim() : "";
      if (!model) {
          setGeminiStatus("Nhap ten model truoc", "#dc2626");
          return;
      }
      if (geminiConfigState.models.includes(model)) {
          setGeminiStatus("Model da ton tai", "#dc2626");
          return;
      }
      geminiConfigState.models.push(model);
      geminiConfigState.model = model;
      if (input) input.value = "";
      chrome.storage.local.set({ geminiModels: geminiConfigState.models, geminiModel: model });
      renderGeminiModels();
      setGeminiStatus("Da them model", "#16a34a");
  }

  async function testGeminiConfig() {
      const keyInput = document.getElementById("gemini-api-key");
      const modelSelect = document.getElementById("gemini-model-select");
      const key = keyInput ? keyInput.value.trim() : "";
      const model = modelSelect ? modelSelect.value : "";
      if (!key) {
          setGeminiStatus("Chua nhap API Key", "#dc2626");
          return;
      }
      setGeminiStatus("Dang kiem tra...", "#f59e0b");
      try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
          const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
          });
          if (res.ok) {
              setGeminiStatus(`Ket noi ${model} thanh cong`, "#16a34a");
          } else {
              let message = `Loi HTTP ${res.status}`;
              try {
                  const data = await res.json();
                  if (data?.error?.message) message = data.error.message;
              } catch (_) {}
              setGeminiStatus(message, "#dc2626");
          }
      } catch (err) {
          setGeminiStatus("Loi mang: " + err.message, "#dc2626");
      }
  }

  const geminiToggleBtn = document.getElementById("btn-toggle-gemini-key");
  if (geminiToggleBtn) {
      geminiToggleBtn.addEventListener("click", () => {
          const input = document.getElementById("gemini-api-key");
          if (!input) return;
          input.type = input.type === "password" ? "text" : "password";
          geminiToggleBtn.textContent = input.type === "password" ? "Show" : "Hide";
      });
  }

  const xkiroToggleBtn = document.getElementById("btn-toggle-xkiro-key");
  if (xkiroToggleBtn) {
      xkiroToggleBtn.addEventListener("click", () => {
          const input = document.getElementById("xkiro-api-key");
          if (!input) return;
          input.type = input.type === "password" ? "text" : "password";
          xkiroToggleBtn.textContent = input.type === "password" ? "Show" : "Hide";
      });
  }

  const geminiModelSelect = document.getElementById("gemini-model-select");
  if (geminiModelSelect) {
      geminiModelSelect.addEventListener("change", (e) => {
          geminiConfigState.model = e.target.value;
      });
  }

  const addGeminiModelBtn = document.getElementById("btn-add-gemini-model");
  if (addGeminiModelBtn) addGeminiModelBtn.addEventListener("click", addGeminiModel);

  const newGeminiModelInput = document.getElementById("gemini-new-model");
  if (newGeminiModelInput) {
      newGeminiModelInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") addGeminiModel();
      });
  }

  const xkiroModelSelect = document.getElementById("xkiro-model-select");
  if (xkiroModelSelect) {
      xkiroModelSelect.addEventListener("change", (e) => {
          xkiroConfigState.model = e.target.value;
      });
  }

  const addXkiroModelBtn = document.getElementById("btn-add-xkiro-model");
  if (addXkiroModelBtn) addXkiroModelBtn.addEventListener("click", addXkiroModel);

  const newXkiroModelInput = document.getElementById("xkiro-new-model");
  if (newXkiroModelInput) {
      newXkiroModelInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") addXkiroModel();
      });
  }

  const saveGeminiConfigBtn = document.getElementById("btn-save-gemini-config");
  if (saveGeminiConfigBtn) saveGeminiConfigBtn.addEventListener("click", saveGeminiConfig);

  const testGeminiConfigBtn = document.getElementById("btn-test-gemini-config");
  if (testGeminiConfigBtn) testGeminiConfigBtn.addEventListener("click", testGeminiConfig);

  loadGeminiConfig();
  try {
    statusText.textContent = "Dang auto load thu muc...";
    await refreshPinnedFolders();
    await autoLoadFolderImages();
    await refreshSavedProducts();
  } catch (error) {
    folderNameText.textContent = "Chua chon thu muc";
    activeImageSizeFilter = "all"; activeImagePrefixFilter = "all";
    refreshImageView();
    renderPinnedFolders([]);
    renderSavedProducts([]);
    statusText.textContent = `Khong auto load duoc: ${error?.message || "hay chon lai thu muc"}.`;
  }
});

saveToSheetTestButton.addEventListener("click", async () => {
  saveToSheetTestButton.disabled = true;
  statusText.textContent = "Dang kiem tra ID trong Google Sheet...";

  try {
    const product = parseProductText(productTextInput.value);
    const brand = productBrandInput.value.trim();
    const id = productIdInput.value.trim();

    if (!product.name && !product.description) {
      statusText.textContent = "Hay nhap/lay Ten và Mo ta truoc.";
      saveToSheetTestButton.disabled = false;
      return;
    }

    const token = await getAccessToken();
    const values = [[id, product.name, brand, product.description]];

    let foundRowIndex = -1;
    if (id) {
      const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/test!A:A`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const checkData = await checkRes.json();
      const idRows = checkData.values || [];
      foundRowIndex = idRows.findIndex(row => String(row[0] || "").trim() === id);
    }

    let res;
    if (foundRowIndex >= 0) {
      // Update
      const rowNum = foundRowIndex + 1;
      statusText.textContent = `Dang cap nhat hang ${rowNum} theo ID ${id}...`;
      res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/test!A${rowNum}:D${rowNum}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values })
      });
    } else {
      // Append
      statusText.textContent = "Dang them moi vao Google Sheet...";
      res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/test!A2:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values })
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Lỗi thao tác Google Sheet');
    }

    statusText.textContent = foundRowIndex >= 0 ? `Da cap nhat ID ${id} thanh cong!` : "Da them moi vao Sheet thanh cong!";
    await refreshSavedProducts();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Loi khi luu: " + error.message;
  } finally {
    saveToSheetTestButton.disabled = false;
  }
});

const switchToTab = (tabId) => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.remove("active");
      c.hidden = true;
    });
  
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (targetBtn) targetBtn.classList.add("active");
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
      targetTab.classList.add("active");
      targetTab.hidden = false;
    }

    const sharedFolder = document.getElementById("shared-folder-section");
    const sharedImage = document.getElementById("shared-image-section");
    if (sharedFolder && sharedImage && targetTab) {
      if (tabId === "tab-tools") {
        const nameDesc = document.getElementById("name-desc-section");
        if (nameDesc) {
          targetTab.insertBefore(sharedFolder, nameDesc);
          targetTab.insertBefore(sharedImage, nameDesc);
        } else {
          targetTab.appendChild(sharedFolder);
          targetTab.appendChild(sharedImage);
        }
      } else if (tabId === "tab-images") {
        targetTab.appendChild(sharedFolder);
        targetTab.appendChild(sharedImage);
      }
    }
  
    if (tabId === "tab-flash-sale") {
      const exportBtn = document.getElementById('btn-export-flash-sale');
      if (exportBtn) exportBtn.click();
    }
  };

document.querySelectorAll(".tab-btn").forEach((tabButton) => {
  tabButton.addEventListener("click", () => {
    switchToTab(tabButton.dataset.tab);
  });
});



// --- FLASH SALE TAB LOGIC ---
document.getElementById('btn-export-flash-sale')?.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes("shopee.vn")) {
            alert("Vui lòng mở trang Kênh Người Bán Shopee để sử dụng tính năng này!");
            return;
        }

        const listContainer = document.getElementById('flash-sale-result-list');
        listContainer.innerHTML = '';

        // Closure variables to hold data fetched later
        let products = [];
        let uniqueNames = [];

        // 1. BUILD STATIC UI IMMEDIATELY
        const flashSaleDiv = document.createElement('div');
        Object.assign(flashSaleDiv.style, {
            display: 'flex', flexDirection: 'column', gap: '8px', 
            padding: '12px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', 
            borderRadius: '6px', marginBottom: '15px'
        });
        
        const flashSaleTitle = document.createElement('div');
        flashSaleTitle.innerText = 'Lưu danh sách vào Sheet FLASH_SALE';
        flashSaleTitle.style.fontWeight = 'bold';
        flashSaleTitle.style.fontSize = '14px';
        flashSaleTitle.style.color = '#d46b08';

        const nhomInput = document.createElement('input');
        nhomInput.placeholder = 'Nhập tên nhóm (ví dụ: Đợt 1)...';
        Object.assign(nhomInput.style, {
            padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '13px'
        });

        const savedProductsDiv = document.createElement('div');
        Object.assign(savedProductsDiv.style, {
            marginTop: '8px', fontSize: '12px', color: '#555', maxHeight: '150px', overflowY: 'auto',
            backgroundColor: '#f5f5f5', padding: '5px', borderRadius: '4px', display: 'none'
        });

        const loadSavedProducts = async (nhomVal) => {
            if (!nhomVal) {
                savedProductsDiv.style.display = 'none';
                return;
            }
            savedProductsDiv.style.display = 'block';
            savedProductsDiv.innerHTML = '<i>Đang tải sản phẩm và giá...</i>';
            try {
                const token = await getGoogleAccessToken(GOOGLE_SHEETS_SCOPE);
                
                // Lấy DS_SP để tra cứu giá
                let dsSpRes = await new Promise(resolve => chrome.runtime.sendMessage({ type: "FETCH_DS_SP" }, resolve));
                let dsSpRows = dsSpRes && dsSpRes.ok ? dsSpRes.values : [];
                let nameToPriceMap = {};
                if (dsSpRows && dsSpRows.length > 0) {
                    const headers = dsSpRows[0];
                    const normalizeHeader = (t) => String(t || "").trim().toLowerCase();
                    const nameIdx = headers.findIndex(h => normalizeHeader(h) === "ten_sp" || normalizeHeader(h) === "tên sp");
                    const priceIdx = headers.findIndex(h => normalizeHeader(h) === "gia_thap_nhat");
                    if (nameIdx !== -1 && priceIdx !== -1) {
                        for (let i = 1; i < dsSpRows.length; i++) {
                            const nameVal = String(dsSpRows[i][nameIdx] || "").trim();
                            const priceVal = String(dsSpRows[i][priceIdx] || "").trim();
                            if (nameVal && priceVal) {
                                if (!nameToPriceMap[nameVal] || parseFloat(priceVal.replace(/[^\d]/g, '')) < parseFloat(nameToPriceMap[nameVal].replace(/[^\d]/g, ''))) {
                                    nameToPriceMap[nameVal] = priceVal;
                                }
                            }
                        }
                    }
                }

                const range = encodeURIComponent('FLASH_SALE!A:C');
                const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${range}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const rows = data.values || [];
                    const matchingProducts = rows.filter(row => row[1] && row[1].trim() === nhomVal).map(row => {
                        const pName = row[2] ? row[2].trim() : "";
                        return { name: pName, price: nameToPriceMap[pName] || "" };
                    });
                    
                    if (matchingProducts.length > 0) {
                        let html = `<b>Đã lưu (${matchingProducts.length}):</b><ul style="margin:4px 0; padding-left:10px; list-style-type:none;">`;
                        html += matchingProducts.map((p, idx) => `
                            <li style="margin-bottom:8px; border-bottom: 1px dashed #ccc; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                                <div>${p.name} ${p.price ? `<span style="color:#f5222d; font-weight:bold;">- Giá: ${p.price}</span>` : ''}</div>
                                <button class="add-single-sp" data-idx="${idx}" style="background-color: #faad14; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; min-width: 60px; flex-shrink: 0; margin-left: 6px; width: auto;">+ Thêm</button>
                            </li>`).join('');
                        html += `</ul>`;
                        html += `<button id="add-to-shopee-popup" style="margin-top:8px; padding:6px; background-color:#1890ff; color:white; border:none; border-radius:4px; cursor:pointer; width:100%; font-weight:bold;">Thêm TẤT CẢ từ nhóm (chỉ tick)</button>`;
                        savedProductsDiv.innerHTML = html;

                        const singleAddBtns = savedProductsDiv.querySelectorAll('.add-single-sp');
                        singleAddBtns.forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                                const product = matchingProducts[idx];
                                const targetBtn = e.target;
                                targetBtn.innerText = 'Đang thêm...';
                                targetBtn.disabled = true;

                                try {
                                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                                    if (!tab) {
                                        alert("Không tìm thấy tab đang hoạt động.");
                                        return;
                                    }
                                    
                                    await chrome.scripting.executeScript({
                                        target: { tabId: tab.id },
                                        args: [product.name],
                                        func: async (pName) => {
                                            const delay = ms => new Promise(res => setTimeout(res, ms));
                                            
                                            // 1. Click "Thêm sản phẩm" button in Modal 1
                                            const btns = Array.from(document.querySelectorAll('.ant-modal-body button.ant-btn'));
                                            const addProductBtn = btns.find(b => b.innerText && b.innerText.includes('Thêm sản phẩm'));
                                            if (!addProductBtn) {
                                                alert("Không tìm thấy nút 'Thêm sản phẩm' trên trang Shopee.");
                                                return false;
                                            }
                                            addProductBtn.click();
                                            await delay(1500); // Wait for Modal 2 to open
                                            
                                            // 2. Find search input in Modal 2 (has ant-modal-confirm-body)
                                            const inputs = Array.from(document.querySelectorAll('.ant-modal-confirm-body input.ant-input[placeholder="Vui lòng nhập"]'));
                                            const searchInput = inputs.find(i => i.offsetParent !== null);
                                            if (!searchInput) {
                                                alert("Không tìm thấy ô tìm kiếm trong popup Thêm sản phẩm.");
                                                return false;
                                            }
                                            
                                            // 3. Fill product name
                                            const searchValue = pName;
                                            let lastValue = searchInput.value;
                                            searchInput.value = searchValue;
                                            let tracker = searchInput._valueTracker;
                                            if (tracker) tracker.setValue(lastValue);
                                            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                                            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
                                            await delay(500);
                                            
                                            // 4. Trigger search by clicking search icon in Modal 2
                                            let searchTriggered = false;
                                            const searchIcon = document.querySelector('.ant-modal-confirm-body .ant-input-search-icon');
                                            if (searchIcon) {
                                                searchIcon.click();
                                                searchTriggered = true;
                                            } else {
                                                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                                            }
                                            
                                            await delay(5000); // Wait 5 seconds as requested
                                            
                                            // 5. Tick the checkbox in Modal 2
                                            let checkboxClicked = false;
                                            const productCheckboxes = Array.from(document.querySelectorAll('.ant-modal-confirm-body .ant-table-tbody .ant-checkbox-input'));
                                            const availableCheckbox = productCheckboxes.find(c => c.offsetParent !== null && !c.checked && !c.disabled);
                                            if (availableCheckbox) {
                                                availableCheckbox.click();
                                                checkboxClicked = true;
                                            } else {
                                                // Try Select All checkbox
                                                const selectAll = document.querySelector('.ant-modal-confirm-body .ant-table-thead .ant-checkbox-input');
                                                if (selectAll && !selectAll.checked && !selectAll.disabled && selectAll.offsetParent !== null) {
                                                    selectAll.click();
                                                    checkboxClicked = true;
                                                }
                                            }
                                            
                                            if (!checkboxClicked) {
                                                alert("Không tìm thấy checkbox sản phẩm nào để tick.");
                                                return false;
                                            }
                                            await delay(500);
                                            
                                            // 6. Click Xác nhận in Modal 2
                                            const confirmBtns = Array.from(document.querySelectorAll('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal-confirm-body button.ant-btn-primary'));
                                            const confirmBtn = confirmBtns.find(b => b.innerText && (b.innerText.includes('Xác nhận') || b.innerText.includes('OK') || b.innerText.includes('Đồng ý')));
                                            if (confirmBtn) {
                                                confirmBtn.click();
                                                return true;
                                            } else {
                                                alert("Đã tick chọn nhưng Không tìm thấy nút Xác nhận.");
                                                return false;
                                            }
                                        }
                                    }).then((results) => {
                                        if (results && results[0] && results[0].result) {
                                            targetBtn.innerText = '✓ Đã thêm';
                                            targetBtn.style.backgroundColor = '#52c41a';
                                        } else {
                                            targetBtn.innerText = '❌ Lỗi';
                                        }
                                    }).catch(e => {
                                        targetBtn.innerText = '❌ Lỗi';
                                        alert('Lỗi: ' + e.message);
                                    });
                                } finally {
                                    setTimeout(() => {
                                        targetBtn.disabled = false;
                                        if(targetBtn.innerText === '✓ Đã thêm') {
                                            targetBtn.innerText = '+ Thêm';
                                            targetBtn.style.backgroundColor = '#faad14';
                                        }
                                    }, 2000);
                                }
                            });
                        });

                        document.getElementById('add-to-shopee-popup').addEventListener('click', async () => {
                            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                            if (!tab) return;
                            const namesToSelect = matchingProducts.map(p => p.name);
                            chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                func: (names) => {
                                    const rows = document.querySelectorAll('.ant-table-tbody > tr.ant-table-row');
                                    let checkedCount = 0;
                                    rows.forEach(row => {
                                        const nameEl = row.querySelector('.product-name');
                                        if (!nameEl) return;
                                        const name = (nameEl.getAttribute('title') || nameEl.innerText).trim();
                                        if (names.includes(name)) {
                                            const checkbox = row.querySelector('input[type="checkbox"]');
                                            if (checkbox && !checkbox.checked) {
                                                checkbox.click();
                                                checkedCount++;
                                            }
                                        }
                                    });
                                    alert('Đã tick chọn ' + checkedCount + ' sản phẩm trong popup Shopee!');
                                },
                                args: [namesToSelect]
                            });
                        });
                    } else {
                        savedProductsDiv.innerHTML = `<i>Chưa có sản phẩm nào được lưu cho nhóm "${nhomVal}"</i>`;
                    }
                } else {
                    savedProductsDiv.innerHTML = `<i style="color:red;">Lỗi tải dữ liệu.</i>`;
                }
            } catch (e) {
                console.error(e);
                savedProductsDiv.innerHTML = `<i style="color:red;">Lỗi kết nối.</i>`;
            }
        };

        nhomInput.addEventListener('change', () => {
            loadSavedProducts(nhomInput.value.trim());
        });
        
        nhomInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                loadSavedProducts(nhomInput.value.trim());
            }
        });

        const saveToSheetBtn = document.createElement('button');
        saveToSheetBtn.innerText = '💾 Lưu 0 Tên SP vào Sheet';
        Object.assign(saveToSheetBtn.style, {
            backgroundColor: '#faad14', color: 'white', border: 'none', borderRadius: '4px',
            padding: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px'
        });

        saveToSheetBtn.addEventListener('click', async () => {
            const nhomVal = nhomInput.value.trim();
            if (!nhomVal) {
                alert('Vui lòng nhập tên nhóm!');
                return;
            }
            if (uniqueNames.length === 0) {
                alert('Không có sản phẩm nào để lưu!');
                return;
            }
            
            saveToSheetBtn.innerText = 'Đang lưu...';
            saveToSheetBtn.disabled = true;
            
            try {
                const token = await getGoogleAccessToken(GOOGLE_SHEETS_SCOPE);
                const range = encodeURIComponent('FLASH_SALE!A:C');
                
                const appendData = {
                    values: uniqueNames.map((name, idx) => [
                        Date.now().toString() + idx.toString(), // ID
                        nhomVal, // Nhóm
                        name // Tên SP
                    ])
                };
                
                const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(appendData)
                });
                
                if (res.ok) {
                    alert('Lưu thành công ' + uniqueNames.length + ' sản phẩm vào sheet FLASH_SALE!');
                    nhomInput.value = '';
                } else {
                    const err = await res.json();
                    alert('Lỗi khi lưu: ' + (err.error?.message || 'Unknown error'));
                }
            } catch (e) {
                alert('Lỗi: ' + e.message);
            } finally {
                saveToSheetBtn.innerText = '💾 Lưu ' + uniqueNames.length + ' Tên SP vào Sheet';
                saveToSheetBtn.disabled = false;
            }
        });

        flashSaleDiv.appendChild(flashSaleTitle);
        flashSaleDiv.appendChild(nhomInput);
        flashSaleDiv.appendChild(savedProductsDiv);
        
        // Container for sheet save and add all buttons (grid layout)
        const flashSaleActionGrid = document.createElement('div');
        Object.assign(flashSaleActionGrid.style, {
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px'
        });

        const addAllSpBtn = document.createElement('button');
        addAllSpBtn.innerText = '➕ Thêm toàn bộ SP';
        Object.assign(addAllSpBtn.style, {
            backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px',
            padding: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center'
        });
        addAllSpBtn.addEventListener('click', async () => {
            let buttons = Array.from(document.querySelectorAll('.add-single-sp'));
            if (buttons.length === 0) {
                buttons = Array.from(document.querySelectorAll('.ext-add-btn'));
            }
            if (buttons.length === 0) {
                alert("Không tìm thấy sản phẩm nào để thêm!");
                return;
            }
            
            addAllSpBtn.disabled = true;
            addAllSpBtn.innerText = "⏳ Đang thêm...";
            
            for (let btn of buttons) {
                if (btn.innerText.includes('Đã thêm')) continue;
                
                btn.click();
                
                // Wait for button state to change
                await new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (!btn.innerText.includes('Đang thêm')) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 500);
                    
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        resolve();
                    }, 15000); // 15 seconds timeout
                });
                
                // Small delay before clicking next one
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            addAllSpBtn.disabled = false;
            addAllSpBtn.innerText = "➕ Thêm toàn bộ SP";
            alert("Đã hoàn thành thêm toàn bộ sản phẩm!");
        });

        flashSaleActionGrid.appendChild(saveToSheetBtn);
        flashSaleActionGrid.appendChild(addAllSpBtn);
        
        flashSaleDiv.appendChild(flashSaleActionGrid);
        listContainer.appendChild(flashSaleDiv);

        // Container for Bulk Fill Buttons (grid layout)
        const bulkFillContainer = document.createElement('div');
        Object.assign(bulkFillContainer.style, {
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px'
        });

        // Button: Fill All KM
        const fillAllKmBtn = document.createElement('button');
        fillAllKmBtn.innerText = '⚡ Điền tất cả KM';
        Object.assign(fillAllKmBtn.style, {
            backgroundColor: '#cf1322', color: 'white', border: 'none', borderRadius: '4px',
            padding: '10px 4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center'
        });
        fillAllKmBtn.addEventListener('click', async () => {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const buttons = document.querySelectorAll('.ext-km-btn');
                    if (buttons.length === 0) {
                        alert("Không tìm thấy nút Điền KM nào!");
                        return;
                    }
                    let delay = 0;
                    buttons.forEach(btn => {
                        setTimeout(() => btn.click(), delay);
                        delay += 100;
                    });
                }
            });
        });
        bulkFillContainer.appendChild(fillAllKmBtn);

        // Button: Fill All Thấp Nhất
        const fillAllMinBtn = document.createElement('button');
        fillAllMinBtn.innerText = '📉 Điền Thấp nhất';
        Object.assign(fillAllMinBtn.style, {
            backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px',
            padding: '10px 4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center'
        });
        fillAllMinBtn.addEventListener('click', async () => {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const buttons = document.querySelectorAll('.ext-min-btn');
                    if (buttons.length === 0) {
                        alert("Không tìm thấy nút Điền Thấp nhất nào!");
                        return;
                    }
                    let delay = 0;
                    buttons.forEach(btn => {
                        setTimeout(() => btn.click(), delay);
                        delay += 100;
                    });
                }
            });
        });
        bulkFillContainer.appendChild(fillAllMinBtn);

        // Button: Sync
        const manualSyncBtn = document.createElement('button');
        manualSyncBtn.innerText = '🔄 Đồng bộ';
        Object.assign(manualSyncBtn.style, {
            backgroundColor: '#096dd9', color: 'white', border: 'none', borderRadius: '4px',
            padding: '10px 4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center'
        });
        manualSyncBtn.addEventListener('click', () => {
            const exportBtn = document.getElementById('btn-export-flash-sale');
            if (exportBtn) exportBtn.click();
        });
        bulkFillContainer.appendChild(manualSyncBtn);

        listContainer.appendChild(bulkFillContainer);

        // Add loading indicator
        const fsLoadingDiv = document.createElement('div');
        fsLoadingDiv.style.color = '#334155';
        fsLoadingDiv.style.fontSize = '13px';
        fsLoadingDiv.innerText = 'Đang tải dữ liệu từ Shopee...';
        listContainer.appendChild(fsLoadingDiv);


        // 2. NOW FETCH DATA FROM SHOPEE
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const rows = document.querySelectorAll('.ant-table-tbody > tr.ant-table-row');
                if (rows.length === 0) return null;

                let items = [];
                let currentParentName = "";
                
                rows.forEach((row) => {
                    const nameElement = row.querySelector('.product-name');
                    if (nameElement) {
                        const text = nameElement.getAttribute('title') || nameElement.innerText || "";
                        const textClean = text.trim();
                        
                        let isParent = row.classList.contains('ant-table-row-level-0');
                        let isVariation = row.classList.contains('ant-table-row-level-1');
                        
                        // Fallback in case className doesn't match
                        if (!isParent && !isVariation) {
                            const isParentByMeta = row.innerText.includes('Product ID:');
                            isParent = isParentByMeta;
                            isVariation = !isParentByMeta;
                        }
                        
                        let sku = "";
                        const metaDivs = row.querySelectorAll('.product-meta-info > div');
                        metaDivs.forEach(div => {
                            const divText = div.innerText.trim();
                            if (divText.startsWith('SKU:') || divText.startsWith('Product ID:')) {
                                sku = divText.split(':')[1].trim();
                            }
                        });
                        
                        if (!sku) {
                            sku = row.getAttribute('data-row-key') || "";
                        }
                        
                        if (isParent) {
                            currentParentName = textClean;
                            items.push({
                                name: textClean,
                                variationName: "",
                                sku: sku,
                                isParent: true,
                                discountPrice: ""
                            });
                        } else {
                            items.push({
                                name: currentParentName, // Inherit parent name directly in scraper
                                variationName: textClean, // Variation name
                                sku: sku,
                                isParent: false,
                                discountPrice: ""
                            });
                        }
                    }
                });
                return items;
            }
        });

        if (!result || !result[0] || !result[0].result) {
            if (fsLoadingDiv) fsLoadingDiv.remove();
            const noProductsDiv = document.createElement('div');
            noProductsDiv.style.color = 'red';
            noProductsDiv.style.fontSize = '13px';
            noProductsDiv.innerText = 'Không tìm thấy sản phẩm nào trên trang này!';
            listContainer.appendChild(noProductsDiv);
            return;
        }

        products = result[0].result;
        let sheetDebugInfo = "";

        // 3. FETCH SHEET DATA AND PERFORM ROBUST MATCHING
        let spShopeeRows = [];
        let dsSpRows = [];
        let giamGiaRows = [];

        let shopeeParentNameIdx = 1;
        let shopeeVarNameIdx = 3;
        let shopeeSkuIdx = 5; // Default to Column F (index 5)
        let shopeeGianIdx = 11;

        let dsIdSpCtIdx = 0;
        let dsGiaThapNhatIdx = 6;

        let giamGiaParentNameIdx = 1; 
        let giamGiaVarNameIdx = 4;    
        let giamGiaPriceIdx = 7;       
        let giamGiaGianIdx = 8;        
        let giamGiaSkuIdx = 5;         

        try {
            const token = await getGoogleAccessToken(GOOGLE_SHEETS_SCOPE);
            const [shopeeRes, dsSpRes, giamGiaRes] = await Promise.all([
                chrome.runtime.sendMessage({ type: "FETCH_SP_SHOPEE" }),
                chrome.runtime.sendMessage({ type: "FETCH_DS_SP" }),
                fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/${encodeURIComponent('SP_GIAM_GIA!A:Z')}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then(r => r.ok ? r.json() : null)
            ]);

            spShopeeRows = (shopeeRes && shopeeRes.ok) ? shopeeRes.values : [];
            dsSpRows = (dsSpRes && dsSpRes.ok) ? dsSpRes.values : [];
            giamGiaRows = (giamGiaRes && giamGiaRes.values) ? giamGiaRes.values : [];

            // Resolve SP_SHOPEE indices
            if (spShopeeRows.length > 0) {
                const shopeeHeaders = spShopeeRows[0];
                const normalizeHeader = (t) => String(t || "").normalize("NFC").trim().toLowerCase();
                
                const pIdx = shopeeHeaders.findIndex(h => normalizeHeader(h).includes('tên sản phẩm') || normalizeHeader(h) === 'ten sp' || normalizeHeader(h) === 'name');
                if (pIdx !== -1) shopeeParentNameIdx = pIdx;
                
                const vIdx = shopeeHeaders.findIndex(h => {
                    const lower = normalizeHeader(h);
                    return (lower.includes('phân loại') || lower.includes('variation') || lower.includes('tên nhóm phân loại')) && !lower.includes('mã') && !lower.includes('ma');
                });
                if (vIdx !== -1) shopeeVarNameIdx = vIdx;
                
                const sIdx = shopeeHeaders.findIndex(h => {
                    const lower = normalizeHeader(h);
                    return (lower === 'sku' || lower === 'mã sku' || lower === 'ma sku' || lower === 'mã sku sản phẩm' || lower === 'ma sku san pham') && !lower.includes('phân loại') && !lower.includes('chi tiết');
                });
                if (sIdx !== -1) {
                    shopeeSkuIdx = sIdx;
                } else {
                    shopeeSkuIdx = 5;
                }
                
                const gIdx = shopeeHeaders.findIndex(h => normalizeHeader(h) === 'gian' || normalizeHeader(h) === 'mã gian' || normalizeHeader(h) === 'ma gian' || normalizeHeader(h) === 'ma_gian');
                if (gIdx !== -1) shopeeGianIdx = gIdx;
            }

            // Resolve DS_SP indices
            if (dsSpRows.length > 0) {
                const dsHeaders = dsSpRows[0];
                const normalizeHeader = (t) => String(t || "").normalize("NFC").trim().toLowerCase();
                
                const idIdx = dsHeaders.findIndex(h => normalizeHeader(h) === "id_sp_ct");
                if (idIdx !== -1) dsIdSpCtIdx = idIdx;
                
                const priceIdx = dsHeaders.findIndex(h => normalizeHeader(h) === "gia_thap_nhat");
                if (priceIdx !== -1) dsGiaThapNhatIdx = priceIdx;
            }

            // Resolve SP_GIAM_GIA indices
            if (giamGiaRows.length > 0) {
                const giamGiaHeaders = giamGiaRows[0];
                const normalizeHeader = (t) => String(t || "").normalize("NFC").trim().toLowerCase();

                const pIdx = giamGiaHeaders.findIndex(h => normalizeHeader(h).includes('tên sản phẩm') || normalizeHeader(h) === 'ten sp' || normalizeHeader(h) === 'name');
                if (pIdx !== -1) giamGiaParentNameIdx = pIdx;

                const vIdx = giamGiaHeaders.findIndex(h => {
                    const lower = normalizeHeader(h);
                    return (lower.includes('phân loại') || lower.includes('variation') || lower.includes('tên nhóm phân loại')) && !lower.includes('mã') && !lower.includes('ma');
                });
                if (vIdx !== -1) giamGiaVarNameIdx = vIdx;

                const priceColIdx = giamGiaHeaders.findIndex(h => {
                    const lower = normalizeHeader(h);
                    return lower.includes('giá đã giảm') || lower.includes('giá giảm') || lower.includes('khuyến mãi') || lower === 'giá' || lower === 'gia';
                });
                if (priceColIdx !== -1) giamGiaPriceIdx = priceColIdx;

                const gIdx = giamGiaHeaders.findIndex(h => normalizeHeader(h) === 'gian' || normalizeHeader(h) === 'mã gian' || normalizeHeader(h) === 'ma gian' || normalizeHeader(h) === 'ma_gian');
                if (gIdx !== -1) giamGiaGianIdx = gIdx;

                const sIdx = giamGiaHeaders.findIndex(h => {
                    const lower = normalizeHeader(h);
                    return (lower.includes('sku phân loại') || lower === 'sku' || lower.includes('số sku phân loại hàng') || lower.includes('sku phân loại hàng')) && !lower.includes('sản phẩm');
                });
                if (sIdx !== -1) giamGiaSkuIdx = sIdx;
            }
        } catch (err) {
            sheetDebugInfo = "Lỗi khi truy cập Google Sheet: " + err.message;
        }

        // MAP PRODUCTS WITH THE FETCHED DATA
        try {
            const storage = await new Promise(resolve => chrome.storage.local.get(["maGian", "dhHoanTextValue"], resolve));
            const currentMaGian = (storage.maGian || storage.dhHoanTextValue || "").trim().toLowerCase();

            const cleanEllipsis = (str) => {
                if (!str) return "";
                return str.normalize("NFC").replace(/\.\.\.$/, '').replace(/\u2026$/, '').trim().toLowerCase();
            };

            // 1. First, search in SP_SHOPEE to find the SKU and lowest price
            products.forEach(p => {
                if (p.isParent) return;

                const pName = cleanEllipsis(p.name);
                const vName = cleanEllipsis(p.variationName || "");
                
                let matchedSku = "";

                // Method 1: Match by Parent Product Name + Variation Name + Shop Code
                for (let i = 1; i < spShopeeRows.length; i++) {
                    const row = spShopeeRows[i];
                    const sheetPName = cleanEllipsis(row[shopeeParentNameIdx]);
                    const sheetVName = cleanEllipsis(row[shopeeVarNameIdx]);
                    const sheetGian = String(row[shopeeGianIdx] || "").trim().toLowerCase();
                    
                    if (!sheetPName || !sheetVName) continue;
                    
                    const pNameMatch = (sheetPName === pName || sheetPName.includes(pName) || pName.includes(sheetPName));
                    const vNameMatch = (sheetVName === vName || sheetVName.includes(vName) || vName.includes(sheetVName));
                    const gianMatch = !currentMaGian || (sheetGian === currentMaGian);
                    
                    if (pNameMatch && vNameMatch && gianMatch) {
                        matchedSku = String(row[shopeeSkuIdx] || "").trim();
                        break;
                    }
                }

                // Method 2 (Fallback): Match by numeric Variation ID in Column C
                if (!matchedSku && p.sku) {
                    const cleanSku = p.sku.replace(/\D/g, '');
                    if (cleanSku) {
                        let shopeeVarIdIdx = 2; // Column C
                        if (spShopeeRows.length > 0) {
                            const shopeeHeaders = spShopeeRows[0];
                            const varIdCol = shopeeHeaders.findIndex(h => {
                                const lower = String(h || "").normalize("NFC").trim().toLowerCase();
                                return lower.includes('mã phân loại hàng') || lower.includes('mã phân loại') || lower.includes('variation id');
                            });
                            if (varIdCol !== -1) shopeeVarIdIdx = varIdCol;
                        }

                        for (let i = 1; i < spShopeeRows.length; i++) {
                            const row = spShopeeRows[i];
                            const sheetVarId = String(row[shopeeVarIdIdx] || "").replace(/\D/g, '');
                            const sheetGian = String(row[shopeeGianIdx] || "").trim().toLowerCase();
                            const gianMatch = !currentMaGian || (sheetGian === currentMaGian);

                            if (sheetVarId === cleanSku && gianMatch) {
                                matchedSku = String(row[shopeeSkuIdx] || "").trim();
                                break;
                            }
                        }
                    }
                }

                if (matchedSku) {
                    p.matchedSku = matchedSku;
                    
// Retrieve lowest price using this SKU
                    const sku10 = matchedSku.substring(0, 10).trim().toLowerCase();
                    let matchedGiaThapNhat = "";
                    for (let i = 1; i < dsSpRows.length; i++) {
                        const row = dsSpRows[i];
                        const dsId = String(row[dsIdSpCtIdx] || "").trim().toLowerCase();
                        const dsId10 = dsId.substring(0, 10);
                        if (dsId10 === sku10) {
                            matchedGiaThapNhat = String(row[dsGiaThapNhatIdx] || "").trim();
                            break;
                        }
                    }
                    if (matchedGiaThapNhat) {
                        p.giaThapNhat = matchedGiaThapNhat;
                    }
                }
            });

            // 2. Second, search in SP_GIAM_GIA to find the discount price (and fallback SKU/lowest price)
            products.forEach(p => {
                if (p.isParent) return;

                const pName = cleanEllipsis(p.name);
                const vName = cleanEllipsis(p.variationName || "");
                const pSku = (p.matchedSku || "").trim().toLowerCase();
                
                let matchedPrice = "";

                // Method 1: Match by Variation SKU (from SP_SHOPEE Column F) in Column F of SP_GIAM_GIA
                if (pSku && !pSku.startsWith("không tìm thấy")) {
                    for (let i = 1; i < giamGiaRows.length; i++) {
                        const row = giamGiaRows[i];
                        const sheetSku = String(row[giamGiaSkuIdx] || "").trim().toLowerCase();
                        const sheetGian = String(row[giamGiaGianIdx] || "").trim().toLowerCase();

                        if (sheetSku === pSku) {
                            const gianMatch = !currentMaGian || (sheetGian === currentMaGian);
                            if (gianMatch) {
                                matchedPrice = String(row[giamGiaPriceIdx] || "").trim();
                                break;
                            }
                        }
                    }
                }

                // Method 2 (Fallback 1): Match by Parent Product Name + Variation Name + Shop Code
                if (!matchedPrice) {
                    for (let i = 1; i < giamGiaRows.length; i++) {
                        const row = giamGiaRows[i];
                        const sheetPName = cleanEllipsis(row[giamGiaParentNameIdx]);
                        const sheetVName = cleanEllipsis(row[giamGiaVarNameIdx]);
                        const sheetGian = String(row[giamGiaGianIdx] || "").trim().toLowerCase();

                        if (!sheetPName || !sheetVName) continue;

                        const pNameMatch = (sheetPName === pName || sheetPName.includes(pName) || pName.includes(sheetPName));
                        const vNameMatch = (sheetVName === vName || sheetVName.includes(vName) || vName.includes(sheetVName));
                        const gianMatch = !currentMaGian || (sheetGian === currentMaGian);

                        if (pNameMatch && vNameMatch && gianMatch) {
                            matchedPrice = String(row[giamGiaPriceIdx] || "").trim();
                            
                            // Extract SKU from Column F of SP_GIAM_GIA as well if not already matched
                            const sheetSku = String(row[giamGiaSkuIdx] || "").trim();
                            if (sheetSku && (!p.matchedSku || p.matchedSku.startsWith("Không tìm thấy") || p.matchedSku.startsWith("không tìm thấy"))) {
                                p.matchedSku = sheetSku;
                                
                                // Also lookup lowest price from DS_SP using this newly found SKU
                                const sku10 = sheetSku.substring(0, 10).trim().toLowerCase();
                                let matchedGiaThapNhat = "";
                                for (let j = 1; j < dsSpRows.length; j++) {
                                    const dsRow = dsSpRows[j];
                                    const dsId = String(dsRow[dsIdSpCtIdx] || "").trim().toLowerCase();
                                    if (dsId === sku10) {
                                        matchedGiaThapNhat = String(dsRow[dsGiaThapNhatIdx] || "").trim();
                                        break;
                                    }
                                }
                                if (matchedGiaThapNhat) {
                                    p.giaThapNhat = matchedGiaThapNhat;
                                }
                            }
                            break;
                        }
                    }
                }

                // Method 3 (Fallback 2): Match by numeric Variation ID in any cell
                if (!matchedPrice && p.sku) {
                    const cleanSku = p.sku.replace(/\D/g, '');
                    if (cleanSku) {
                        for (let i = 1; i < giamGiaRows.length; i++) {
                            const row = giamGiaRows[i];
                            const matched = row.some(cell => {
                                const cellStr = cell.toString().replace(/\D/g, '');
                                return cellStr === cleanSku;
                            });
                            if (matched) {
                                matchedPrice = String(row[giamGiaPriceIdx] || "").trim();
                                
                                // Extract SKU here too if not matched yet
                                const sheetSku = String(row[giamGiaSkuIdx] || "").trim();
                                if (sheetSku && (!p.matchedSku || p.matchedSku.startsWith("Không tìm thấy") || p.matchedSku.startsWith("không tìm thấy"))) {
                                    p.matchedSku = sheetSku;
                                    
                                    // Retrieve lowest price using this SKU
                                    const sku10 = sheetSku.substring(0, 10).trim().toLowerCase();
                                    let matchedGiaThapNhat = "";
                                    for (let j = 1; j < dsSpRows.length; j++) {
                                        const dsRow = dsSpRows[j];
                                        const dsId = String(dsRow[dsIdSpCtIdx] || "").trim().toLowerCase();
                                        if (dsId === sku10) {
                                            matchedGiaThapNhat = String(dsRow[dsGiaThapNhatIdx] || "").trim();
                                            break;
                                        }
                                    }
                                    if (matchedGiaThapNhat) {
                                        p.giaThapNhat = matchedGiaThapNhat;
                                    }
                                }
                                break;
                            }
                        }
                    }
                }

                if (matchedPrice) {
                    p.discountPrice = matchedPrice;
                }

                // Set final fallback debug string for matchedSku if still empty
                if (!p.matchedSku) {
                    p.matchedSku = `Không tìm thấy (Tên: "${pName.substring(0, 12)}...", PL: "${vName}")`;
                }
            });
        } catch (e) {
            console.error("Lỗi xử lý dữ liệu đối chiếu:", e);
        }
        // 4. INJECT PRICE HINTS TO SHOPEE PAGE (UNDER SKU TEXT)
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            args: [products],
            func: (productsData) => {
                const rows = document.querySelectorAll('.ant-table-tbody > tr.ant-table-row');
                
                rows.forEach((row) => {
                    let sku = "";
                    let isParent = false;
                    const metaDivs = row.querySelectorAll('.product-meta-info > div');
                    metaDivs.forEach(div => {
                        const divText = div.innerText.trim();
                        if (divText.startsWith('SKU:') || divText.startsWith('Product ID:')) {
                            sku = divText.split(':')[1].trim();
                        }
                        if (divText.startsWith('Product ID:')) {
                            isParent = true;
                        }
                    });
                    if (!sku) {
                        sku = row.getAttribute('data-row-key') || "";
                    }
                    
                    // 1. Clear old price hint layout next to input fields
                    const tds = row.querySelectorAll('td');
                    if (tds.length >= 4) {
                        const priceTd = tds[3];
                        const oldHint = priceTd.querySelector('.ext-price-hint');
                        if (oldHint) oldHint.remove();
                        const flexWrapper = priceTd.querySelector('.ext-flex-wrapper');
                        if (flexWrapper) {
                            const inputWrapper = flexWrapper.querySelector('.ant-input-number');
                            if (inputWrapper) {
                                flexWrapper.parentNode.insertBefore(inputWrapper, flexWrapper);
                            }
                            flexWrapper.remove();
                        }
                    }

                    // 2. Hide price hint if it's the parent product row (which has no inputs anyway)
                    const productMetaInfo = row.querySelector('.product-meta-info');
                    if (isParent) {
                        if (productMetaInfo) {
                            const existingHint = productMetaInfo.querySelector('.ext-price-hint-wrapper');
                            if (existingHint) existingHint.remove();
                        }
                        return;
                    }
                    
                    const input = row.querySelector('.ant-input-number-input');
                    
                    if (!productMetaInfo || !input) return;

                    const productInfo = productsData.find(p => p.sku === sku);
                    if (productInfo) {
                        // Remove existing hint if any
                        const existingHint = productMetaInfo.querySelector('.ext-price-hint-wrapper');
                        if (existingHint) existingHint.remove();
                        
                        const hintDiv = document.createElement('div');
                        hintDiv.className = 'ext-price-hint-wrapper';
                        Object.assign(hintDiv.style, {
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', 
                            backgroundColor: '#fffbe6', padding: '4px 6px', 
                            borderRadius: '4px', border: '1px solid #ffe58f',
                            marginTop: '4px', width: 'max-content',
                            fontSize: '12px'
                        });
                        
                        // Line 1: KM: 646900.00 [Điền] (only if discountPrice is present!)
                        if (productInfo.discountPrice) {
                            const line1 = document.createElement('div');
                            Object.assign(line1.style, {
                                display: 'flex', alignItems: 'center', gap: '6px'
                            });
                            
                            const priceText = document.createElement('span');
                            priceText.innerText = 'KM: ' + productInfo.discountPrice;
                            Object.assign(priceText.style, {
                                color: '#cf1322', fontWeight: 'bold', fontSize: '12px',
                                whiteSpace: 'nowrap'
                            });
                            
                            const fillBtn = document.createElement('button');
                            fillBtn.innerText = 'Điền';
                            fillBtn.className = 'ext-price-hint-btn ext-km-btn';
                            Object.assign(fillBtn.style, {
                                backgroundColor: '#1890ff', color: 'white', border: 'none', 
                                borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px',
                                whiteSpace: 'nowrap', flexShrink: '0', lineHeight: '1'
                            });
                            
                            fillBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                nativeInputValueSetter.call(input, productInfo.discountPrice);
                                
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                                
                                fillBtn.innerText = '✓';
                                fillBtn.style.backgroundColor = '#52c41a';
                                setTimeout(() => {
                                    fillBtn.innerText = 'Điền';
                                    fillBtn.style.backgroundColor = '#1890ff';
                                }, 1000);
                            });
                            
                            line1.appendChild(priceText);
                            line1.appendChild(fillBtn);
                            hintDiv.appendChild(line1);
                        }

                        // Line 2: Thấp nhất: 450000 [Điền] (if giaThapNhat is present!)
                        if (productInfo.giaThapNhat) {
                            const line2 = document.createElement('div');
                            Object.assign(line2.style, {
                                display: 'flex', alignItems: 'center', gap: '6px'
                            });
                            
                            const minPriceText = document.createElement('span');
                            minPriceText.innerText = 'Thấp nhất: ' + productInfo.giaThapNhat;
                            Object.assign(minPriceText.style, {
                                color: '#475569', fontWeight: 'bold', fontSize: '11px',
                                whiteSpace: 'nowrap'
                            });
                            
                            const fillMinBtn = document.createElement('button');
                            fillMinBtn.innerText = 'Điền';
                            fillMinBtn.className = 'ext-price-hint-btn ext-min-btn';
                            Object.assign(fillMinBtn.style, {
                                backgroundColor: '#1890ff', color: 'white', border: 'none', 
                                borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px',
                                whiteSpace: 'nowrap', flexShrink: '0', lineHeight: '1'
                            });
                            
                            fillMinBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                nativeInputValueSetter.call(input, productInfo.giaThapNhat);
                                
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                                
                                fillMinBtn.innerText = '✓';
                                fillMinBtn.style.backgroundColor = '#52c41a';
                                setTimeout(() => {
                                    fillMinBtn.innerText = 'Điền';
                                    fillMinBtn.style.backgroundColor = '#1890ff';
                                }, 1000);
                            });
                            
                            line2.appendChild(minPriceText);
                            line2.appendChild(fillMinBtn);
                            hintDiv.appendChild(line2);
                        }

                        // Line 3: SKU_CT (blue text)
                        const line3 = document.createElement('div');
                        Object.assign(line3.style, {
                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#096dd9'
                        });
                        const displaySku = productInfo.matchedSku || "Không tìm thấy";
                        line3.innerHTML = `<span>SKU_CT: </span><b>${displaySku}</b>`;
                        hintDiv.appendChild(line3);

                        // Only append the wrapper if we actually added at least one line (KM or SKU_CT or Thấp nhất)
                        if (hintDiv.childNodes.length > 0) {
                            productMetaInfo.appendChild(hintDiv);
                        }
                    }
                });
            }
        });

        // 5. UPDATE UI WITH FETCHED DATA
        if (fsLoadingDiv) fsLoadingDiv.remove();

        if (sheetDebugInfo) {
            const errDiv = document.createElement('div');
            Object.assign(errDiv.style, {
                padding: '8px', backgroundColor: '#fee2e2', color: '#ef4444', 
                borderRadius: '4px', fontSize: '12px', marginBottom: '10px'
            });
            errDiv.innerText = sheetDebugInfo;
            listContainer.appendChild(errDiv);
        }

        // Filter: Only keep parent product rows for popup display and sheet saving
        products = products.filter(p => p.isParent);
        
        uniqueNames = [...new Set(products.map(p => p.name).filter(n => n && n !== "Sản phẩm không rõ tên"))];
        
        saveToSheetBtn.innerText = '💾 Lưu ' + uniqueNames.length + ' Tên SP vào Sheet';


        products.forEach((product, index) => {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', flexDirection: 'column', gap: '4px',
                padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc'
            });

            const topRow = document.createElement('div');
            Object.assign(topRow.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            });

            const nameDiv = document.createElement('div');
            nameDiv.innerText = product.name;
            nameDiv.title = product.name;
            Object.assign(nameDiv.style, {
                flex: '1', marginRight: '10px', fontSize: '13px', color: '#1e293b', fontWeight: '500',
                display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden'
            });

            const copyBtn = document.createElement('button');
            copyBtn.innerText = 'Copy Tên';
            Object.assign(copyBtn.style, {
                backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px',
                padding: '4px 8px', cursor: 'pointer', fontSize: '12px', minWidth: '70px', flexShrink: '0',
                width: 'auto'
            });
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(product.name).then(() => {
                    copyBtn.innerText = '✓';
                    copyBtn.style.backgroundColor = '#22c55e';
                    setTimeout(() => {
                        copyBtn.innerText = 'Copy Tên';
                        copyBtn.style.backgroundColor = '#3b82f6';
                    }, 1000);
                });
            });

            const addBtn = document.createElement('button');
            addBtn.className = 'ext-add-btn';
            addBtn.innerText = '+ Thêm';
            Object.assign(addBtn.style, {
                backgroundColor: '#faad14', color: 'white', border: 'none', borderRadius: '4px',
                padding: '4px 8px', cursor: 'pointer', fontSize: '12px', minWidth: '60px', flexShrink: '0',
                marginLeft: '6px', width: 'auto'
            });
            addBtn.addEventListener('click', async () => {
                addBtn.innerText = 'Đang thêm...';
                addBtn.disabled = true;
                
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab) {
                        alert("Không tìm thấy tab đang hoạt động.");
                        return;
                    }
                    
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [product.name, product.sku],
                        func: async (pName, pSku) => {
                            const delay = ms => new Promise(res => setTimeout(res, ms));
                            
                            // 1. Click "Thêm sản phẩm" button in Modal 1
                            const btns = Array.from(document.querySelectorAll('.ant-modal-body button.ant-btn'));
                            const addProductBtn = btns.find(b => b.innerText && b.innerText.includes('Thêm sản phẩm'));
                            if (!addProductBtn) {
                                alert("Không tìm thấy nút 'Thêm sản phẩm' trên trang Shopee.");
                                return false;
                            }
                            addProductBtn.click();
                            await delay(1500); // Wait for Modal 2 to open
                            
                            // 2. Find search input in Modal 2 (has ant-modal-confirm-body)
                            const inputs = Array.from(document.querySelectorAll('.ant-modal-confirm-body input.ant-input[placeholder="Vui lòng nhập"]'));
                            const searchInput = inputs.find(i => i.offsetParent !== null);
                            if (!searchInput) {
                                alert("Không tìm thấy ô tìm kiếm trong popup Thêm sản phẩm.");
                                return false;
                            }
                            
                            // 3. Fill product name
                            const searchValue = pName;
                            let lastValue = searchInput.value;
                            searchInput.value = searchValue;
                            let tracker = searchInput._valueTracker;
                            if (tracker) tracker.setValue(lastValue);
                            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
                            await delay(500);
                            
                            // 4. Trigger search by clicking search icon in Modal 2
                            let searchTriggered = false;
                            const searchIcon = document.querySelector('.ant-modal-confirm-body .ant-input-search-icon');
                            if (searchIcon) {
                                searchIcon.click();
                                searchTriggered = true;
                            } else {
                                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                            }
                            
                            await delay(5000); // Wait 5 seconds as requested
                            
                            // 5. Tick the checkbox in Modal 2
                            let checkboxClicked = false;
                            const productCheckboxes = Array.from(document.querySelectorAll('.ant-modal-confirm-body .ant-table-tbody .ant-checkbox-input'));
                            const availableCheckbox = productCheckboxes.find(c => c.offsetParent !== null && !c.checked && !c.disabled);
                            if (availableCheckbox) {
                                availableCheckbox.click();
                                checkboxClicked = true;
                            } else {
                                // Try Select All checkbox
                                const selectAll = document.querySelector('.ant-modal-confirm-body .ant-table-thead .ant-checkbox-input');
                                if (selectAll && !selectAll.checked && !selectAll.disabled && selectAll.offsetParent !== null) {
                                    selectAll.click();
                                    checkboxClicked = true;
                                }
                            }
                            
                            if (!checkboxClicked) {
                                alert("Không tìm thấy checkbox sản phẩm nào để tick.");
                                return false;
                            }
                            await delay(500);
                            
                            // 6. Click Xác nhận in Modal 2
                            const confirmBtns = Array.from(document.querySelectorAll('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal-confirm-body button.ant-btn-primary'));
                            const confirmBtn = confirmBtns.find(b => b.innerText && (b.innerText.includes('Xác nhận') || b.innerText.includes('OK') || b.innerText.includes('Đồng ý')));
                            if (confirmBtn) {
                                confirmBtn.click();
                                return true;
                            } else {
                                alert("Đã tick chọn nhưng Không tìm thấy nút Xác nhận.");
                                return false;
                            }
                        }
                    }).then((results) => {
                        if (results && results[0] && results[0].result) {
                            addBtn.innerText = '✓ Đã thêm';
                            addBtn.style.backgroundColor = '#52c41a';
                        } else {
                            addBtn.innerText = '❌ Lỗi';
                        }
                    }).catch(e => {
                        addBtn.innerText = '❌ Lỗi';
                        alert('Lỗi: ' + e.message);
                    });
                } finally {
                    setTimeout(() => {
                        addBtn.disabled = false;
                        if(addBtn.innerText === '✓ Đã thêm') {
                            addBtn.innerText = '+ Thêm';
                            addBtn.style.backgroundColor = '#faad14';
                        }
                    }, 2000);
                }
            });

            const btnWrapper = document.createElement('div');
            Object.assign(btnWrapper.style, {
                display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: '0', alignItems: 'stretch'
            });
            
            const btnRow1 = document.createElement('div');
            Object.assign(btnRow1.style, {
                display: 'flex', gap: '4px'
            });
            btnRow1.appendChild(copyBtn);
            btnRow1.appendChild(addBtn);
            btnWrapper.appendChild(btnRow1);

            const editBtn = document.createElement('button');
            editBtn.innerText = 'Sửa sản phẩm';
            Object.assign(editBtn.style, {
                backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px',
                padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
                width: '100%', textAlign: 'center'
            });
            editBtn.addEventListener('click', async () => {
                editBtn.innerText = 'Đang tìm...';
                editBtn.disabled = true;
                
                try {
                    const skuText = String(product.sku || "").trim().toLowerCase();
                    const nameText = String(product.name || "").trim().toLowerCase();
                    
                    const modelMatch = nameText.match(/[a-zA-Z]+[-_\\d]+/g) || [];
                    const searchKeys = [skuText, ...modelMatch].filter(k => k && k.length > 2);

                    let matchedEntry = null;

                    // 1. Search in Pinned Folders
                    const pinned = await getPinnedFolders();
                    for (let entry of pinned) {
                        const fName = String(entry.name || "").toLowerCase();
                        const fDesc = String(entry.description || "").toLowerCase();
                        
                        const isMatch = searchKeys.some(key => fName.includes(key) || fDesc.includes(key));
                        if (isMatch) {
                            matchedEntry = entry;
                            break;
                        }
                    }

                    if (matchedEntry) {
                        directoryHandle = matchedEntry.handle;
                        folderDescriptionInput.value = matchedEntry.description || "";
                        await saveDirectoryHandle(directoryHandle);
                        await loadFolderImages();
                        await refreshSavedProducts();
                        switchToTab("tab-tools");
                        return;
                    }

                    // 2. Search subfolders of the current active directory
                    if (directoryHandle) {
                        let matchedSubHandle = null;
                        try {
                            for await (const entry of directoryHandle.values()) {
                                if (entry.kind === 'directory') {
                                    const entryName = entry.name.toLowerCase();
                                    const isMatch = searchKeys.some(key => entryName.includes(key));
                                    if (isMatch) {
                                        matchedSubHandle = entry;
                                        break;
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("Lỗi duyệt thư mục con:", err);
                        }

                        if (matchedSubHandle) {
                            directoryHandle = matchedSubHandle;
                            await saveDirectoryHandle(directoryHandle);
                            await loadFolderImages();
                            await refreshSavedProducts();
                            switchToTab("tab-tools");
                            return;
                        }
                    }

                    alert(`Không tìm thấy thư mục nào khớp với sản phẩm này!\nTừ khóa tìm kiếm: ${searchKeys.join(', ')}`);
                } catch (e) {
                    alert('Lỗi: ' + e.message);
                } finally {
                    editBtn.innerText = 'Sửa sản phẩm';
                    editBtn.disabled = false;
                }
            });
            btnWrapper.appendChild(editBtn);

            topRow.appendChild(nameDiv);
            topRow.appendChild(btnWrapper);

            const bottomRow = document.createElement('div');
            Object.assign(bottomRow.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px'
            });

            const skuDiv = document.createElement('div');
            skuDiv.innerText = product.sku ? (product.sku.length > 15 ? 'ID: ' + product.sku : 'SKU: ' + product.sku) : '';
            Object.assign(skuDiv.style, {
                fontSize: '11px', color: '#64748b'
            });

            const priceDiv = document.createElement('div');
            if (product.discountPrice) {
                priceDiv.innerHTML = '<span style="color:#64748b; font-size:11px;">Giá giảm: </span>' + 
                                     '<span style="color:#ef4444; font-weight:bold; font-size:12px;">' + product.discountPrice + '</span>';
            } else {
                priceDiv.innerHTML = '<span style="color:#94a3b8; font-style:italic; font-size:11px;">Không có giá giảm</span>';
            }

            bottomRow.appendChild(skuDiv);
            bottomRow.appendChild(priceDiv);

            row.appendChild(topRow);
            row.appendChild(bottomRow);
            listContainer.appendChild(row);
        });

    } catch (err) {
        console.error("Lỗi khi gọi tính năng Flash Sale:", err);
        const listContainer = document.getElementById('flash-sale-result-list');
        if(listContainer) {
            // Keep the static form but show error below
            const errDiv = document.createElement('div');
            errDiv.style.color = 'red';
            errDiv.style.fontSize = '13px';
            errDiv.innerText = 'Lỗi: ' + err.message;
            listContainer.appendChild(errDiv);
        }
    }
});

// ===== AUTOCOMPLETE CHO Ô ID SẢN PHẨM =====
(function() {
  const idInput = document.getElementById('product-id');
  const dropdown = document.getElementById('id-suggest-dropdown');
  if (!idInput || !dropdown) return;

  let activeIndex = -1;
  let currentItems = [];

  function closeDropdown() {
    dropdown.classList.remove('open');
    activeIndex = -1;
  }

  async function onInput() {
    const val = idInput.value.trim().toLowerCase();
    if (!val) {
      closeDropdown();
      return;
    }

    try {
      const products = await loadSheetProducts();
      const filtered = products.filter(p => 
        (p.id && p.id.toLowerCase().includes(val)) || 
        (p.name && p.name.toLowerCase().includes(val))
      ).slice(0, 10);

      if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="id-suggest-empty">Không tìm thấy sản phẩm</div>';
        dropdown.classList.add('open');
        currentItems = [];
        return;
      }

      currentItems = filtered;
      dropdown.innerHTML = filtered.map((p, idx) => `
        <div class="id-suggest-item" data-id="${p.id}" data-index="${idx}">
          <div class="id-suggest-id">${p.id}</div>
          <div class="id-suggest-name">${p.name}</div>
        </div>
      `).join('');
      dropdown.classList.add('open');
    } catch (e) {
      console.error('Autocomplete error', e);
    }
  }

  idInput.addEventListener('input', onInput);

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.id-suggest-item');
    if (item) {
      const id = item.getAttribute('data-id');
      idInput.value = id;
      closeDropdown();
      idInput.dispatchEvent(new Event('input', { bubbles: true }));
      idInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  idInput.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.id-suggest-item');
    if (!dropdown.classList.contains('open') || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault();
        items[activeIndex].click();
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  function updateActiveItem(items) {
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!idInput.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  });
})();
(function() {
  const btnUploadSpShopee = document.getElementById('btn-upload-sp-shopee');
  const fileUploadSpShopee = document.getElementById('upload-excel-sp-shopee');
  const statusUploadSpShopee = document.getElementById('upload-sp-shopee-status');

  if (btnUploadSpShopee && fileUploadSpShopee) {
    btnUploadSpShopee.addEventListener('click', () => {
      fileUploadSpShopee.click();
    });
    // Drag and Drop support for SP_SHOPEE
    btnUploadSpShopee.addEventListener('dragover', (e) => {
        e.preventDefault();
        btnUploadSpShopee.style.opacity = '0.7';
        btnUploadSpShopee.style.border = '2px dashed #fff';
    });
    btnUploadSpShopee.addEventListener('dragleave', (e) => {
        e.preventDefault();
        btnUploadSpShopee.style.opacity = '1';
        btnUploadSpShopee.style.border = '';
    });
    btnUploadSpShopee.addEventListener('drop', (e) => {
        e.preventDefault();
        btnUploadSpShopee.style.opacity = '1';
        btnUploadSpShopee.style.border = '';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileUploadSpShopee.files = e.dataTransfer.files;
            fileUploadSpShopee.dispatchEvent(new Event('change'));
        }
    });


    fileUploadSpShopee.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (typeof XLSX === 'undefined') {
        if (statusUploadSpShopee) {
          statusUploadSpShopee.textContent = 'Thư viện XLSX chưa được tải!';
          statusUploadSpShopee.style.color = 'red';
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          // Lấy sheet đầu tiên trong file Excel
          const sheetName = workbook.SheetNames[0];
          
          if (!workbook.Sheets[sheetName]) {
             if (statusUploadSpShopee) {
               statusUploadSpShopee.textContent = 'Không tìm thấy sheet nÃ o trong file';
               statusUploadSpShopee.style.color = 'red';
             }
             return;
          }

          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          const dataRows = json.slice(1); // Bỏ qua dòng tiêu đề của file Excel
          
          // Thêm mã gian vào cột L (index 11)
          const maGian = document.getElementById("dh-hoan-text") ? document.getElementById("dh-hoan-text").value.trim() : "";
          if (maGian) {
              dataRows.forEach(row => {
                  row[11] = maGian;
              });
          }
          
          if (statusUploadSpShopee) {
             statusUploadSpShopee.textContent = 'Äang Ä‘áº©y ' + json.length + ' dÃ²ng lÃªn Google Sheet...';
             statusUploadSpShopee.style.color = '#3b82f6';
          }

          chrome.runtime.sendMessage({ type: "UPLOAD_SP_SHOPEE", values: dataRows, maGian: maGian }, (response) => {
            if (response && response.ok) {
               if (statusUploadSpShopee) {
                 statusUploadSpShopee.textContent = 'ÄÃ£ táº£i lÃªn thÃ nh cÃ´ng ' + json.length + ' dÃ²ng vÃ o Google Sheet SP_SHOPEE.';
                 statusUploadSpShopee.style.color = 'green';
               }
            } else {
               if (statusUploadSpShopee) {
                 statusUploadSpShopee.textContent = 'Lỗi lưu Google Sheet: ' + (response ? response.error : 'Unknown error');
                 statusUploadSpShopee.style.color = 'red';
               }
            }
          });
        } catch (err) {
          console.error('Error reading Excel', err);
          if (statusUploadSpShopee) {
            statusUploadSpShopee.textContent = 'Lỗi đọc file: ' + err.message;
            statusUploadSpShopee.style.color = 'red';
          }
        }
      };
      reader.readAsArrayBuffer(file);
      
      // Reset input value to allow selecting the same file again
      fileUploadSpShopee.value = '';
    });
  }
  const btnUploadSpGiamGia = document.getElementById('btn-upload-sp-giam-gia');
  const fileUploadSpGiamGia = document.getElementById('upload-excel-sp-giam-gia');
  const statusUploadSpGiamGia = document.getElementById('upload-sp-giam-gia-status');

  if (btnUploadSpGiamGia && fileUploadSpGiamGia) {
    btnUploadSpGiamGia.addEventListener('click', () => {
      fileUploadSpGiamGia.click();
    });
    // Drag and Drop support for SP_GIAM_GIA
    btnUploadSpGiamGia.addEventListener('dragover', (e) => {
        e.preventDefault();
        btnUploadSpGiamGia.style.opacity = '0.7';
        btnUploadSpGiamGia.style.border = '2px dashed #3b82f6';
    });
    btnUploadSpGiamGia.addEventListener('dragleave', (e) => {
        e.preventDefault();
        btnUploadSpGiamGia.style.opacity = '1';
        btnUploadSpGiamGia.style.border = '1px solid #d8dee8'; // restore original border
    });
    btnUploadSpGiamGia.addEventListener('drop', (e) => {
        e.preventDefault();
        btnUploadSpGiamGia.style.opacity = '1';
        btnUploadSpGiamGia.style.border = '1px solid #d8dee8';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileUploadSpGiamGia.files = e.dataTransfer.files;
            fileUploadSpGiamGia.dispatchEvent(new Event('change'));
        }
    });


    fileUploadSpGiamGia.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (typeof XLSX === 'undefined') {
        if (statusUploadSpGiamGia) {
          statusUploadSpGiamGia.textContent = 'Thư viện XLSX chưa được tải!';
          statusUploadSpGiamGia.style.color = 'red';
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          
          if (!workbook.Sheets[sheetName]) {
             if (statusUploadSpGiamGia) {
               statusUploadSpGiamGia.textContent = 'Không tìm thấy sheet nÃ o trong file';
               statusUploadSpGiamGia.style.color = 'red';
             }
             return;
          }

          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          const dataRows = json.slice(1);
          
          // Thêm mã gian vào cột I (index 8)
          const maGian = document.getElementById("dh-hoan-text") ? document.getElementById("dh-hoan-text").value.trim() : "";
          if (maGian) {
              dataRows.forEach(row => {
                  row[8] = maGian;
              });
          }
          
          if (statusUploadSpGiamGia) {
             statusUploadSpGiamGia.textContent = 'Đang đẩy ' + dataRows.length + ' dòng lên Google Sheet...';
             statusUploadSpGiamGia.style.color = '#3b82f6';
          }

          chrome.runtime.sendMessage({ type: "UPLOAD_SP_GIAM_GIA", values: dataRows, maGian: maGian }, (response) => {
            if (response && response.ok) {
               if (statusUploadSpGiamGia) {
                 statusUploadSpGiamGia.textContent = 'Đã tải lên thành công ' + dataRows.length + ' dòng vào Google Sheet SP_GIAM_GIA.';
                 statusUploadSpGiamGia.style.color = 'green';
               }
            } else {
               if (statusUploadSpGiamGia) {
                 statusUploadSpGiamGia.textContent = 'Lỗi lưu Google Sheet: ' + (response ? response.error : 'Unknown error');
                 statusUploadSpGiamGia.style.color = 'red';
               }
            }
          });
        } catch (err) {
          console.error('Error reading Excel', err);
          if (statusUploadSpGiamGia) {
            statusUploadSpGiamGia.textContent = 'Lỗi đọc file: ' + err.message;
            statusUploadSpGiamGia.style.color = 'red';
          }
        }
      };
      reader.readAsArrayBuffer(file);
      fileUploadSpGiamGia.value = '';
    });
  }
})();



const CAI_DAT_TAB_NAME_TO_ID = {
  "web ban sp": "tab-web-sp",
  "web ban san pham": "tab-web-sp",
  "tao anh ai": "tab-api-images",
  "anh api": "tab-api-images",
  "anh ai & api": "tab-api-images",
  "tao anh ai & api": "tab-api-images",
  "anh ai api": "tab-api-images",
  "tao anh": "tab-api-images",
  "cai dat": "tab-settings",
  "anh": "tab-images",
  "lay anh": "tab-images",
  "sp": "tab-sp",
  "hieu qua sp": "tab-hieu-qua-sp",
  "hieu qua san pham": "tab-hieu-qua-sp",
  "day sp": "tab-day-sp",
  "day san pham": "tab-day-sp",
  "don hang": "tab-don-hang-detail",
  "nhieu don hang": "tab-nhieu-don-hang",
  "nhieu don": "tab-nhieu-don-hang",
  "ds don hang": "tab-nhieu-don-hang",
  "dh": "tab-nhieu-don-hang",
  "hang hoan": "tab-hang-hoan",
  "ds sp": "tab-ds-sp",
  "danh sach sp": "tab-ds-sp",
  "web shopee": "tab-sp-shopee",
  "sp shopee": "tab-sheet-sp-shopee",
  "sp giam gia": "tab-sp-giam-gia",
  "km": "tab-km",
  "khuyen mai": "tab-km",
  "doanh thu": "tab-doanh-thu",
  "test": "tab-test",
  "tien ich": "tab-tools",
  "flash sale": "tab-flash-sale",
  "in": "tab-print",
  "chat ai": "tab-chat-ai",
  "chat": "tab-chat-ai",
  "tu van chat": "tab-chat-ai",
  "chat shopee": "tab-chat-ai"
};

function normalizeCaiDatTabName(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function caiDatTabNameToId(value) {
  return CAI_DAT_TAB_NAME_TO_ID[normalizeCaiDatTabName(value)] || "";
}

function applyCaiDatTabOrder(tabNames) {
  const tabHeader = document.querySelector(".tab-header");
  if (!tabHeader) return null;

  const tabBtns = Array.from(tabHeader.querySelectorAll(".tab-btn"));
  const btnById = new Map(tabBtns.map(btn => [btn.dataset.tab, btn]));
  const orderedIds = [];

  if (Array.isArray(tabNames) && tabNames.length > 0) {
    tabNames.forEach((name) => {
      const tabId = caiDatTabNameToId(name);
      if (tabId && btnById.has(tabId) && !orderedIds.includes(tabId)) {
        orderedIds.push(tabId);
      }
    });
  }

  // Các tab bị ẩn cố định
  const explicitlyHiddenTabs = new Set(["tab-flash-sale"]);

  // MẶC ĐỊNH LUÔN HIỂN THỊ TẤT CẢ CÁC TAB (trừ tab bị ẩn cố định)
  tabBtns.forEach((btn) => {
    const tId = btn.dataset.tab;
    if (explicitlyHiddenTabs.has(tId)) {
      btn.style.display = "none";
    } else {
      btn.style.display = "";
    }
  });

  // Đưa các tab được khai báo trong Sheet cai_dat lên đầu theo thứ tự
  orderedIds.forEach((tabId) => {
    const btn = btnById.get(tabId);
    if (btn) tabHeader.appendChild(btn);
  });

  // Đưa các tab mới (chưa có trong Sheet) về phía sau để luôn hiển thị cho người dùng bấm
  tabBtns.forEach((btn) => {
    if (!orderedIds.includes(btn.dataset.tab) && !explicitlyHiddenTabs.has(btn.dataset.tab)) {
      tabHeader.appendChild(btn);
    }
  });

  const activeBtn = document.querySelector(".tab-btn.active");
  if (!activeBtn || activeBtn.style.display === "none") {
    const firstVisible = tabBtns.find(b => b.style.display !== "none");
    if (firstVisible) firstVisible.click();
  }

  return { orderedIds };
}

window.hideAllTabsExceptSettings = function() {
    const tabHeader = document.querySelector(".tab-header");
    if (tabHeader) {
        const tabBtns = Array.from(tabHeader.querySelectorAll(".tab-btn"));
        let settingsBtn = null;
        tabBtns.forEach(btn => {
            const tabName = btn.textContent.trim().toLowerCase();
            if (tabName === "cài đặt" || tabName === "sp shopee" || tabName === "lấy ảnh sp") {
                btn.style.display = "";
                if (tabName === "cài đặt") settingsBtn = btn;
            } else {
                btn.style.display = "none";
            }
        });
        if (settingsBtn) settingsBtn.click();
    }
};

window.fetchGianSuggestions = async function() {
      try {
          if (!GOOGLE_SHEET_CONFIG.spreadsheetId) {
              hideAllTabsExceptSettings();
              return;
          }
          const token = await getGoogleAccessToken(GOOGLE_SHEETS_SCOPE);
          const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/CAI_DAT!A:C`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.values) {
              const datalist = document.getElementById("gian-suggestions");
              const uniqueGians = new Set();
              const allowedTabs = new Set();
              const orderedTabs = [];
              const sheetGianLinks = {};
              
              // Find column index of anh_mau
              const headers = data.values[0] || [];
              const anhMauColIdx = headers.findIndex(h => h.trim().toLowerCase() === "anh_mau");
              const templateUrls = [];

              data.values.forEach((row, idx) => {
                  if (idx === 0) return; // skip header (row 1)
                  
                  const tapStr = (row[0] || "").trim();
                  if (tapStr) {
                      const tap = tapStr.toLowerCase();
                      allowedTabs.add(tap);
                      if (!orderedTabs.includes(tap)) orderedTabs.push(tap);
                  }
                  
                  const gian = (row[1] || "").trim();
                  if (gian) {
                      uniqueGians.add(gian);
                      const link = (row[2] || "").trim();
                      if (link) sheetGianLinks[gian.toLowerCase()] = link;
                  }

                  if (anhMauColIdx !== -1) {
                      const val = (row[anhMauColIdx] || "").trim();
                      if (val && (val.startsWith("http://") || val.startsWith("https://"))) {
                          templateUrls.push(val);
                      }
                  }
              });
              chrome.storage.local.set({ gianLinks: sheetGianLinks });

              // Dynamically render template images from anh_mau column
              if (templateUrls.length > 0) {
                  SAMPLE_IMAGE_PREVIEWS = templateUrls.map((url, i) => {
                      const filename = url.split("/").pop().split("?")[0] || `template-${i + 1}.png`;
                      return { name: filename, url: url };
                  });
                  if (typeof window.renderTemplateImages === "function") {
                      window.renderTemplateImages(templateUrls);
                  }
              }
              
              if (datalist) {
                  datalist.innerHTML = "";
                  uniqueGians.forEach(gian => {
                      const option = document.createElement("option");
                      option.value = gian;
                      datalist.appendChild(option);
                  });
              }

              // Dynamic Tab Visibility & Ordering from CAI_DAT column A.
              applyCaiDatTabOrder(orderedTabs);
          } else {
              hideAllTabsExceptSettings();
          }
      } catch (e) {
          console.error("Lỗi lấy danh sách gian và tab:", e);
          hideAllTabsExceptSettings();
      }
};

document.addEventListener("DOMContentLoaded", () => {

  const btnTaiDsSp = document.getElementById('btn-tai-ds-sp');
  if (btnTaiDsSp) {
    btnTaiDsSp.addEventListener('click', () => {
      chrome.tabs.create({ url: "https://banhang.shopee.vn/portal/product-mass/mass-update/download?auto_download_ds_sp=1", active: true });
      const statusEl = document.getElementById("ds-sp-download-status");
      if (statusEl) statusEl.textContent = "Đang mở tab Shopee để tải DS_SP...";
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === "DS_SP_STATUS") {
          const statusEl = document.getElementById("ds-sp-download-status");
          if (statusEl) {
              statusEl.textContent = request.status;
          }
      }
  });

  const btnSaveGianSheet = document.getElementById("btn-save-gian-sheet");
  const gianStatus = document.getElementById("gian-status");
  if (btnSaveGianSheet) {
      btnSaveGianSheet.addEventListener("click", async () => {
          const maGianInput = document.getElementById("dh-hoan-text");
          const maGian = maGianInput ? maGianInput.value.trim() : "";
          if (!maGian) {
              if (gianStatus) { gianStatus.textContent = "Vui lòng nhập mã gian"; gianStatus.style.color = "red"; }
              return;
          }
          if (gianStatus) { gianStatus.textContent = "Đang lưu lên sheet..."; gianStatus.style.color = "#3b82f6"; }
          
          chrome.storage.local.set({ maGian: maGian, dhHoanTextValue: maGian });
          chrome.storage.local.remove("dhHoanText"); // Xóa triệt để biến cũ gây lỗi chữ JOY
          
          try {
              const token = await getGoogleAccessToken(GOOGLE_SHEETS_SCOPE);
              // Calculate exactly the next empty row in Column B
              const fetchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/CAI_DAT!B:B`, {
                  headers: { Authorization: `Bearer ${token}` }
              });
              const fetchData = await fetchRes.json();
              let rowNum = 1;
              let isDuplicate = false;
              if (fetchRes.ok && fetchData.values) {
                  rowNum = fetchData.values.length + 1;
                  for (let i = 0; i < fetchData.values.length; i++) {
                      const existingGian = (fetchData.values[i][0] || "").trim().toLowerCase();
                      if (existingGian === maGian.toLowerCase()) {
                          isDuplicate = true;
                          break;
                      }
                  }
              }
              if (isDuplicate) {
                  if (gianStatus) { gianStatus.textContent = "Mã gian này đã tồn tại trong Sheet!"; gianStatus.style.color = "#f59e0b"; }
                  setTimeout(() => { if (gianStatus && gianStatus.textContent === "Mã gian này đã tồn tại trong Sheet!") gianStatus.textContent = ""; }, 3000);
                  return;
              }
              const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/CAI_DAT!B${rowNum}?valueInputOption=USER_ENTERED`, {
                  method: "PUT",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ values: [[maGian]] })
              });
              const data = await updateRes.json();
              if (updateRes.ok) {
                  if (gianStatus) { gianStatus.textContent = "ÄÃ£ lÆ°u thÃ nh cÃ´ng vÃ o CAI_DAT!"; gianStatus.style.color = "green"; }
                  // Add to datalist instantly
                  const datalist = document.getElementById("gian-suggestions");
                  if (datalist) {
                      const option = document.createElement("option");
                      option.value = maGian;
                      datalist.appendChild(option);
                  }
                  setTimeout(() => { if (gianStatus) gianStatus.textContent = ""; }, 3000);
              } else {
                  if (gianStatus) { gianStatus.textContent = "Lỗi: " + (data.error?.message || "Unknown error"); gianStatus.style.color = "red"; }
              }
          } catch(e) {
              if (gianStatus) { gianStatus.textContent = "Lỗi kết nối: " + e.message; gianStatus.style.color = "red"; }
          }
      });
  }
});

  const btnTaiGiamGia = document.getElementById('btn-tai-giam-gia');
  if (btnTaiGiamGia) {
      btnTaiGiamGia.addEventListener('click', () => {
          const mG = document.getElementById("dh-hoan-text") ? document.getElementById("dh-hoan-text").value.trim().toLowerCase() : "";
          const statusEl = document.getElementById("giam-gia-download-status");
          
          if (!mG) {
              if (statusEl) { statusEl.textContent = "Vui lòng nhập Mã gian trước!"; statusEl.style.color = "red"; }
              return;
          }
          
          chrome.storage.local.get(["gianLinks"], (res) => {
              const links = res.gianLinks || {};
              const url = links[mG];
              if (!url || !url.startsWith("http")) {
                  if (statusEl) { statusEl.textContent = "Vui lòng lưu link hợp lệ cho mã gian này trước!"; statusEl.style.color = "red"; }
                  return;
              }
              
              if (statusEl) { statusEl.textContent = "Đang mở tab Shopee để tải giảm giá..."; statusEl.style.color = "#16a34a"; }
              
              let finalUrl = url;
              if (url.includes("?")) finalUrl += "&auto_download_giam_gia=1";
              else finalUrl += "?auto_download_giam_gia=1";
              
              chrome.storage.local.set({ autoDownloadGiamGia: true }, () => { chrome.tabs.create({ url: finalUrl, active: true }); });
          });
      });
}

let shopeeWebProducts = [];

function renderShopeeWebTable(items) {
    const tbody = document.querySelector('#table-sp-shopee tbody');
    if (!tbody) return;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td style="text-align: center; padding: 10px; color: #64748b;">Không tìm thấy sản phẩm nào khớp.</td></tr>';
        return;
    }
    
    tbody.innerHTML = items.map(p => `
      <tr>
        <td style="border-bottom: 1px solid #cbd5e1; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1; min-width: 0; padding-right: 8px;">
            <div style="font-weight: 500; font-size: 12px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 210px;" title="${p.name}">${p.name}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 210px;" title="SKU: ${p.sku || ''}">SKU: <span style="font-weight: bold; color: #096dd9;">${p.sku || 'Chưa có'}</span></div>
            <div id="status-${p.itemId || ''}" style="font-size: 10px; color: #8c8c8c; font-style: italic; margin-top: 2px; display: none;"></div>
          </div>
          <div style="display: flex; gap: 4px; flex-shrink: 0;">
            <button class="stock-btn-0" data-item-id="${p.itemId || ''}" style="background-color: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 11px; font-weight: bold; width: 32px; height: 24px; display: inline-flex; align-items: center; justify-content: center;">0</button>
            <button class="stock-btn-300" data-item-id="${p.itemId || ''}" style="background-color: #22c55e; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 11px; font-weight: bold; width: 44px; height: 24px; display: inline-flex; align-items: center; justify-content: center;">300</button>
          </div>
        </td>
      </tr>
    `).join('');
}

const btnReadSpShopee = document.getElementById('btn-read-sp-shopee');
const inputSearchSpShopee = document.getElementById('input-search-sp-shopee');
const tbodySpShopee = document.querySelector('#table-sp-shopee tbody');

if (tbodySpShopee) {
  tbodySpShopee.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const itemId = btn.getAttribute('data-item-id');
    if (!itemId) {
      alert("Không lấy được Item ID của sản phẩm này!");
      return;
    }
    
    let stockVal = "";
    if (btn.classList.contains('stock-btn-0')) {
      stockVal = "0";
    } else if (btn.classList.contains('stock-btn-300')) {
      stockVal = "300";
    }
    
    if (stockVal !== "") {
      const url = `https://banhang.shopee.vn/portal/product/${itemId}?auto_update_stock=${stockVal}`;
      chrome.tabs.create({ url, active: true });
    }
  });
}

if (btnReadSpShopee) {
  btnReadSpShopee.addEventListener('click', async () => {
    btnReadSpShopee.textContent = 'Đang đọc...';
    btnReadSpShopee.disabled = true;
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0].id;
      const res = await sendMessageToTab(tabId, { type: 'READ_SP_SHOPEE_LIST' });
      
      const tbody = document.querySelector('#table-sp-shopee tbody');
      if (res && res.ok && res.data) {
        shopeeWebProducts = res.data || [];
        renderShopeeWebTable(shopeeWebProducts);
        if (inputSearchSpShopee) {
          inputSearchSpShopee.value = '';
        }
      } else {
        tbody.innerHTML = `<tr><td style="text-align: center; padding: 10px; color: #ef4444;">Lỗi: ${res?.error || 'Không nhận được dữ liệu (Hãy chắc chắn bạn đang ở trang Tất cả sản phẩm Shopee)'}</td></tr>`;
      }
    } catch (e) {
      console.error(e);
      document.querySelector('#table-sp-shopee tbody').innerHTML = `<tr><td style="text-align: center; padding: 10px; color: #ef4444;">Lỗi kết nối: ${e.message}</td></tr>`;
    } finally {
      btnReadSpShopee.textContent = 'Đọc Trang Hiện Tại';
      btnReadSpShopee.disabled = false;
    }
  });
}

if (inputSearchSpShopee) {
  inputSearchSpShopee.addEventListener('input', () => {
    const query = inputSearchSpShopee.value.trim().toLowerCase();
    if (!query) {
      renderShopeeWebTable(shopeeWebProducts);
      return;
    }
    const filtered = shopeeWebProducts.filter(p => 
      (p.name && p.name.toLowerCase().includes(query)) || 
      (p.sku && p.sku.toLowerCase().includes(query))
    );
    renderShopeeWebTable(filtered);
  });
}

  // Initialize template image and text buttons in tab-images
  const initTemplateListeners = () => {
    // 1. Copy template text button
    const copyTemplateTextBtn = document.getElementById("copy-template-text");
    if (copyTemplateTextBtn) {
      copyTemplateTextBtn.addEventListener("click", () => {
        const templateTextEl = document.getElementById("template-text");
        if (templateTextEl) {
          const text = templateTextEl.textContent.trim();
          navigator.clipboard.writeText(text).then(() => {
            const oldText = copyTemplateTextBtn.textContent;
            copyTemplateTextBtn.textContent = "Đã Copy";
            copyTemplateTextBtn.style.backgroundColor = "#22c55e";
            setTimeout(() => {
              copyTemplateTextBtn.textContent = oldText;
              copyTemplateTextBtn.style.backgroundColor = "#3b82f6";
            }, 1500);
          });
        }
      });
    }

    // 2. Open GPT image buttons
    document.querySelectorAll(".open-gpt-img-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute("data-target");
        const imgEl = document.getElementById(targetId);
        if (imgEl) {
          const imgUrl = imgEl.getAttribute("src");
          await handleOpenAiForTemplate("chatgpt", imgUrl, btn);
        }
      });
    });

    // 3. Open Gemini image buttons
    document.querySelectorAll(".open-gemini-img-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute("data-target");
        const imgEl = document.getElementById(targetId);
        if (imgEl) {
          const imgUrl = imgEl.getAttribute("src");
          await handleOpenAiForTemplate("gemini", imgUrl, btn);
        }
      });
    });

    // 4. Copy template image buttons
    document.querySelectorAll(".copy-img-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute("data-target");
        const imgEl = document.getElementById(targetId);
        if (imgEl) {
          const imgUrl = imgEl.getAttribute("src");
          const oldHtml = btn.innerHTML;
          btn.innerHTML = '...';
          const success = await copyImageToClipboard(imgUrl);
          btn.innerHTML = success ? "✔" : oldHtml;
          setTimeout(() => { btn.innerHTML = oldHtml; }, 1500);
        }
      });
    });
  };

  async function copyImageToClipboard(imgUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Canvas toBlob failed");

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      return true;
    } catch (err) {
      console.error("Copy image error direct, fallback to fetch:", err);
      try {
        const res = await fetch(imgUrl);
        const fetchedBlob = await res.blob();
        const imgBitmap = await createImageBitmap(fetchedBlob);
        const canvas = document.createElement("canvas");
        canvas.width = imgBitmap.width;
        canvas.height = imgBitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgBitmap, 0, 0);
        const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob })
        ]);
        return true;
      } catch (err2) {
        console.error("Fallback copy image error:", err2);
        return false;
      }
    }
  }

    async function handleOpenAiForTemplate(aiType, imgUrl, btnEl) {
    const oldHtml = btnEl.innerHTML;
    btnEl.innerHTML = '...';
    btnEl.disabled = true;
    try {
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const filename = imgUrl.split('/').pop() || 'image.png';
      const file = new File([blob], filename, { type: blob.type });
      
      const templateTextEl = document.getElementById("template-text");
      const promptText = templateTextEl ? templateTextEl.textContent.trim() : "";
      
      await openAiInNewTab(aiType, file, promptText, btnEl);
    } catch (err) {
      console.error("Open AI template error:", err);
      btnEl.innerHTML = oldHtml;
      btnEl.disabled = false;
    }
  }

  window.renderTemplateImages = function(urls) {
    const container = document.getElementById("template-images-container");
    if (!container) return;

    container.innerHTML = "";
    
    container.style.setProperty("grid-template-columns", "repeat(4, 1fr)", "important");

    urls.forEach((url, i) => {
      const imgId = `template-img-${i + 1}`;
      const div = document.createElement("div");
      div.style.cssText = "position: relative; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;";
      
      div.innerHTML = `
        <img src="${url}" style="width: 100%; height: auto; display: block;" id="${imgId}" alt="template-img">
        <button class="open-gpt-img-btn" data-target="${imgId}" style="position: absolute; top: 8px; right: 72px; width: 28px; height: 28px; min-height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: white; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #333;" title="Mở ảnh này trên ChatGPT">🤖</button>
        <button class="open-gemini-img-btn" data-target="${imgId}" style="position: absolute; top: 8px; right: 40px; width: 28px; height: 28px; min-height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: white; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #333;" title="Mở ảnh này trên Gemini">✨</button>
        <button class="copy-img-btn" data-target="${imgId}" style="position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; min-height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: white; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #333;" title="Copy ảnh">📋</button>
      `;
      
      container.appendChild(div);
    });

    initTemplateListeners();
  };

  // Run initialization
  initTemplateListeners();

  // Update template text when product input changes or is loaded
  if (productTextInput) {
    const updateTemplateText = () => {
      const templateText = document.getElementById("template-text");
      if (templateText) {
        let productName = "";
        if (productTextInput.value) {
          productName = productTextInput.value.split("|")[0].trim();
        }
        if (productName) {
          templateText.textContent = `thay ảnh 2 vào ảnh 1 . thay thế tên sản phẩm + model+ đặc điểm + ảnh minh họa bên dưới phù hợp với sản phẩm + slogan . ${productName}`;
        } else {
          templateText.textContent = `thay ảnh 2 vào ảnh 1 . thay thế tên sản phẩm + model+ đặc điểm + ảnh minh họa bên dưới phù hợp với sản phẩm + slogan . `;
        }
      }
    };
    productTextInput.addEventListener("input", updateTemplateText);
    updateTemplateText(); // run once initially
  }

// Listen for real-time automation status updates from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "UPDATE_AUTOMATION_STATUS") {
    const { itemId, status, color } = message;
    const statusDiv = document.getElementById(`status-${itemId}`);
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = `Quy trình: <b style="color: ${color || '#faad14'}">${status}</b>`;
    }
  }
});

function populateExtractedDetails(product) {
  if (!product || !product.details) return;
  const details = product.details;

  if (productBrandInput) {
    productBrandInput.value = product.brand || details["Thương hiệu"] || "";
  }

  const map = {
    "Hạn bảo hành": "#product-han-bh",
    "Loại bảo hành": "#product-loai-bh",
    "Dung tích": "#product-dung-tich",
    "Điện áp đầu vào": "#product-dien-ap",
    "Tiêu thụ điện năng": "#product-cong-suat",
    "Số người": "#product-so-nguoi"
  };

  for (const [key, selector] of Object.entries(map)) {
    const input = document.querySelector(selector);
    if (input) {
      input.value = details[key] || "";
    }
  }

  const tinhNangInput = document.querySelector("#product-tinh-nang");
  if (tinhNangInput) {
    let tinhNangVal = "";
    for (const [key, val] of Object.entries(details)) {
      if (key.includes("Tính năng")) {
        tinhNangVal = val;
        break;
      }
    }
    tinhNangInput.value = tinhNangVal;
  }
}

function setupAttributeFillButtons() {
  const attrs = [
    { name: "Hạn bảo hành", inputId: "#product-han-bh", fillId: "#fill-han-bh", addId: "#add-han-bh" },
    { name: "Loại bảo hành", inputId: "#product-loai-bh", fillId: "#fill-loai-bh", addId: "#add-loai-bh" },
    { name: "Dung tích", inputId: "#product-dung-tich", fillId: "#fill-dung-tich", addId: "#add-dung-tich" },
    { name: "Điện áp đầu vào", inputId: "#product-dien-ap", fillId: "#fill-dien-ap", addId: "#add-dien-ap" },
    { name: "Tiêu thụ điện năng", inputId: "#product-cong-suat", fillId: "#fill-cong-suat", addId: "#add-cong-suat" },
    { name: "Số người", inputId: "#product-so-nguoi", fillId: "#fill-so-nguoi", addId: "#add-so-nguoi" }
  ];

  attrs.forEach(attr => {
    const input = document.querySelector(attr.inputId);
    const fillBtn = document.querySelector(attr.fillId);
    const addBtn = document.querySelector(attr.addId);

    if (fillBtn && input) {
      fillBtn.addEventListener("click", async () => {
        fillBtn.disabled = true;
        const val = input.value.trim();
        statusText.textContent = `Đang điền ${attr.name}...`;
        try {
          const tab = await getActiveTab();
          if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
            statusText.textContent = "Hãy mở trang thêm/sửa sản phẩm trước.";
            return;
          }
          if (!val) {
            statusText.textContent = `Hãy nhập ${attr.name} trước.`;
            return;
          }
          const response = await sendMessageToTab(tab.id, {
            type: "FILL_PRODUCT_ATTRIBUTE",
            labelName: attr.name,
            value: val
          });
          statusText.textContent = response?.message || `Đã điền ${attr.name}.`;
        } catch (error) {
          statusText.textContent = error?.message || `Lỗi điền ${attr.name}.`;
        } finally {
          fillBtn.disabled = false;
        }
      });
    }

    if (addBtn && input) {
      addBtn.addEventListener("click", async () => {
        addBtn.disabled = true;
        const val = input.value.trim();
        statusText.textContent = `Đang thêm mới ${attr.name}...`;
        try {
          const tab = await getActiveTab();
          if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
            statusText.textContent = "Hãy mở trang thêm/sửa sản phẩm trước.";
            return;
          }
          if (!val) {
            statusText.textContent = `Hãy nhập ${attr.name} trước.`;
            return;
          }
          const response = await sendMessageToTab(tab.id, {
            type: "ADD_NEW_PRODUCT_ATTRIBUTE",
            labelName: attr.name,
            value: val
          });
          statusText.textContent = response?.message || `Đã gửi yêu cầu thêm ${attr.name}.`;
        } catch (error) {
          statusText.textContent = error?.message || `Lỗi thêm ${attr.name}.`;
        } finally {
          addBtn.disabled = false;
        }
      });
    }
  });

  const tnInput = document.querySelector("#product-tinh-nang");
  const tnFillBtn = document.querySelector("#fill-tinh-nang");
  const tnAddBtn = document.querySelector("#add-tinh-nang");

  if (tnFillBtn && tnInput) {
    tnFillBtn.addEventListener("click", async () => {
      tnFillBtn.disabled = true;
      const val = tnInput.value.trim();
      statusText.textContent = `Đang điền Tính năng...`;
      try {
        const tab = await getActiveTab();
        if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
          statusText.textContent = "Hãy mở trang thêm/sửa sản phẩm trước.";
          return;
        }
        if (!val) {
          statusText.textContent = `Hãy nhập Tính năng trước.`;
          return;
        }
        const response = await sendMessageToTab(tab.id, {
          type: "FILL_PRODUCT_ATTRIBUTE",
          labelName: "Tính năng",
          value: val
        });
        statusText.textContent = response?.message || `Đã điền Tính năng.`;
      } catch (error) {
        statusText.textContent = error?.message || `Lỗi điền Tính năng.`;
      } finally {
        tnFillBtn.disabled = false;
      }
    });
  }

  if (tnAddBtn && tnInput) {
    tnAddBtn.addEventListener("click", async () => {
      tnAddBtn.disabled = true;
      const val = tnInput.value.trim();
      statusText.textContent = `Đang thêm mới Tính năng...`;
      try {
        const tab = await getActiveTab();
        if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
          statusText.textContent = "Hãy mở trang thêm/sửa sản phẩm trước.";
          return;
        }
        if (!val) {
          statusText.textContent = `Hãy nhập Tính năng trước.`;
          return;
        }
        const response = await sendMessageToTab(tab.id, {
          type: "ADD_NEW_PRODUCT_ATTRIBUTE",
          labelName: "Tính năng",
          value: val
        });
        statusText.textContent = response?.message || `Đã gửi yêu cầu thêm Tính năng.`;
      } catch (error) {
        statusText.textContent = error?.message || `Lỗi thêm Tính năng.`;
      } finally {
        tnAddBtn.disabled = false;
      }
    });
  }
}

setupAttributeFillButtons();






async function fetchAndConvertUrlToBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Error converting image:", err);
    return null;
  }
}

window.addEventListener("message", async (event) => {
  if (event.data && event.data.action) {
    if (event.data.action === "open-chatgpt") {
      if(typeof handleOpenAiForTemplate === "function") await handleOpenAiForTemplate("chatgpt", event.data.url, null);
    } else if (event.data.action === "open-gemini") {
    } else if (event.data.action === "RELOAD_PAGE") {
      try {
        const tabs = await chrome.tabs.query({ url: "*://*.shopee.vn/*" });
        if (tabs && tabs.length > 0) {
            const activeTab = tabs.find(t => t.active) || tabs[0];
            chrome.tabs.reload(activeTab.id);
        } else {
            console.log("No Shopee tab found to reload.");
        }
      } catch (err) {
        console.error("Error reloading page:", err);
      }
      if(typeof handleOpenAiForTemplate === "function") await handleOpenAiForTemplate("gemini", event.data.url, null);
    } else if (event.data.action === "tai-anh-len-shopee") {
      const urls = event.data.urls || [];
      if (urls.length === 0) return;
      const statusText = document.querySelector("#status");
      if (statusText) statusText.textContent = "Đang tải ảnh từ Shopee...";
      const base64Images = [];
      for (const url of urls) {
        const b64 = await fetchAndConvertUrlToBase64(url);
        if (b64) base64Images.push(b64);
      }
      
      try {
        const tab = await getActiveTab();
        if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
          if (statusText) statusText.textContent = "Hay mo trang them san pham truoc.";
          return;
        }
        if (statusText) statusText.textContent = `Dang dua ${base64Images.length} anh vao Shopee...`;
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "UPLOAD_PRODUCT_IMAGES",
          files: base64Images
        });
        if (statusText) statusText.textContent = response?.message || "Da gui anh.";
      } catch (error) {
        if (statusText) statusText.textContent = "Loi: " + error.message;
      }
    
    } else if (event.data.action === "tai-anh-copy") {
      const url = event.data.url;
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(async (pngBlob) => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': pngBlob })
            ]);
            console.log("Copied to clipboard");
          } catch(e) {
            console.error(e);
          }
        }, 'image/png');
      } catch (err) {
        console.error("Copy image error", err);
      }
} else if (event.data.action === "tai-anh-mo-ta-shopee") {
      const urls = event.data.urls || [];
      if (urls.length === 0) return;
      const statusText = document.querySelector("#status");
      if (statusText) statusText.textContent = "Đang tải ảnh từ Shopee...";
      const base64Images = [];
      for (const url of urls) {
        const b64 = await fetchAndConvertUrlToBase64(url);
        if (b64) base64Images.push(b64);
      }
      
      try {
        const tab = await getActiveTab();
        if (!tab?.id || !tab.url?.startsWith("https://banhang.shopee.vn/")) {
          if (statusText) statusText.textContent = "Hay mo trang them san pham truoc.";
          return;
        }
        if (statusText) statusText.textContent = `Dang dua ${base64Images.length} anh vao Shopee...`;
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "UPLOAD_DESCRIPTION_IMAGES",
          files: base64Images
        });
        if (statusText) statusText.textContent = response?.message || "Da gui anh.";
      } catch (error) {
        if (statusText) statusText.textContent = "Loi: " + error.message;
      }
    }
  }
});


async function handleSaveImageToFolder(url, filename) {
    try {
        let handle = null;
        try { handle = await loadDirectoryHandle(); } catch(e) {}
        
        if (handle) {
            try {
                // Check write permission silently (it should have been granted earlier)
                let perm = await handle.queryPermission({ mode: "readwrite" });
                let hasPerm = (perm === "granted");
                if (!hasPerm) {
                    try {
                        hasPerm = (await handle.requestPermission({ mode: "readwrite" })) === "granted";
                    } catch (e) {
                        console.warn("Permission request failed:", e);
                    }
                }
                if (hasPerm) {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const fileHandle = await handle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    return { ok: true };
                } else {
                    console.warn("No write permission, falling back to chrome.downloads");
                }
            } catch (err) {
                console.warn("Failed to write to folder, falling back to chrome.downloads", err);
            }
        }
        
        // Fallback
        const blobUrl = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: false
        });
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return { ok: true };
    } catch (error) {
        console.error('Lỗi khi lưu ảnh:', error);
        return { ok: false, error: error.message };
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'SAVE_IMAGE_TO_FOLDER') {
        handleSaveImageToFolder(message.url, message.filename).then(sendResponse);
        return true;
    }
});

window.addEventListener("message", (event) => {
    if (event.data && event.data.action === "SAVE_IMAGE_TO_FOLDER") {
        handleSaveImageToFolder(event.data.url, event.data.filename);
    }
});


function cleanMarkdownForFacebook(text) {
  if (!text) return "";
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^[\#\=\-\*\s]{1,6}\s+/gm, '')
    .replace(/[\*\#\_]/g, '')
    .replace(/---/g, '')
    .trim();
}

async function rewriteTextUsingGemini(mode) {
  const currentText = productTextInput.value || "";
  const parsed = parseProductText(currentText);
  let prompt = "";
  const markdownRule = "\n\nQUY TẮC BẮT BUỘC: KHÔNG sử dụng bất kỳ cú pháp định dạng Markdown nào (như **, ###, ---, *, _). Hãy trình bày văn bản bằng chữ viết tự nhiên kết hợp icon/emoji sinh động.";
  
  if (mode === "name") {
    if (!parsed.name) {
      statusText.textContent = "Không có tên để viết lại!";
      return;
    }
    prompt = "Viết lại tên sản phẩm sau cho thật hấp dẫn, chuẩn SEO Shopee, độ dài phù hợp (không quá dài). CHỈ trả về đúng phần tên được viết lại, KHÔNG giải thích gì thêm:\n" + parsed.name + markdownRule;
  } else if (mode === "desc") {
    if (!parsed.description) {
      statusText.textContent = "Không có mô tả để viết lại!";
      return;
    }
    prompt = "Viết lại mô tả sản phẩm sau cho hấp dẫn, chuyên nghiệp, cấu trúc rõ ràng, dễ đọc, phù hợp bán hàng trên Shopee. CHỈ trả về đúng phần mô tả được viết lại, KHÔNG giải thích gì thêm:\n" + parsed.description + markdownRule;
  } else if (mode === "both") {
    if (!parsed.name && !parsed.description) {
      statusText.textContent = "Không có thông tin để viết lại!";
      return;
    }
    prompt = "Dưới đây là thông tin của một sản phẩm. Hãy viết lại TÊN sản phẩm cho hấp dẫn chuẩn SEO, và viết lại MÔ TẢ sản phẩm sao cho chuyên nghiệp, rõ ràng, dễ chốt sale.\n\nTRẢ VỀ ĐÚNG ĐỊNH DẠNG SAU:\n[Tên sản phẩm được viết lại]\n|\n[Mô tả sản phẩm được viết lại]\n\nKHÔNG CẦN giải thích gì thêm. Thông tin hiện tại:\nTên: " + parsed.name + "\nMô tả: " + parsed.description + markdownRule;
  }

  statusText.textContent = "Đang nhờ AI viết lại...";
  const btnId = mode === "name" ? "rewrite-name" : mode === "desc" ? "rewrite-desc" : "rewrite-both";
  const btn = document.getElementById(btnId);
  if (btn) btn.disabled = true;
  
  try {
    const resStore = await chrome.storage.local.get(["geminiApiKey", "geminiApiKeys", "geminiModel"]);
    const key = resStore.geminiApiKey;
    if (!key) throw new Error("Chưa có API Key. Hãy nhập ở tab Cài đặt.");

    const configuredModel = resStore.geminiModel || "gemini-2.5-flash";
    const modelsToTry = [...new Set([configuredModel, "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"])];

    let result = "";
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data?.error?.message || "Lỗi API " + res.status;
          if (res.status === 503 || res.status === 429 || errMsg.toLowerCase().includes("high demand")) {
            lastError = new Error(errMsg);
            continue;
          }
          throw new Error(errMsg);
        }

        result = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (result) break;
      } catch (err) {
        lastError = err;
        if (err.message?.toLowerCase().includes("high demand") || err.message?.toLowerCase().includes("503") || err.message?.toLowerCase().includes("429")) {
          continue;
        }
        throw err;
      }
    }

async function callXkiroDeepseek(promptText) {
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
        console.warn(`[XKiro AI] Model ${model} gặp lỗi (${errMsg}), thử model tiếp theo...`);
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
      console.warn(`[XKiro AI] Lỗi model ${model}:`, err.message);
      await new Promise(r => setTimeout(r, 300));
    }
  }

  throw lastError || new Error("Tất cả các model XKiro đều không phản hồi.");
}

    // Nếu không có Gemini result hoặc không có key -> Thử qua XKiro DeepSeek
    if (!result) {
      try {
        console.warn("[AI] Gemini lỗi hoặc không có key, chuyển sang XKiro DeepSeek...");
        result = await callXkiroDeepseek(prompt);
      } catch (deepseekErr) {
        if (lastError) throw lastError;
        throw deepseekErr;
      }
    }

    result = cleanMarkdownForFacebook(result);
    
    if (mode === "name") {
      productTextInput.value = result + (parsed.description ? "\n|\n" + parsed.description : "");
    } else if (mode === "desc") {
      productTextInput.value = (parsed.name ? parsed.name + "\n|\n" : "") + result;
    } else if (mode === "both") {
      productTextInput.value = result;
    }
    statusText.textContent = "AI đã viết lại xong!";
    const evt = new Event("input", { bubbles: true });
    productTextInput.dispatchEvent(evt);
  } catch (err) {
    statusText.textContent = "Lỗi AI: " + err.message;
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.getElementById("rewrite-name")?.addEventListener("click", () => rewriteTextUsingGemini("name"));
document.getElementById("rewrite-desc")?.addEventListener("click", () => rewriteTextUsingGemini("desc"));
document.getElementById("rewrite-both")?.addEventListener("click", () => rewriteTextUsingGemini("both"));

// TẢI ẢNH SHOPEE NHANH
let cachedShopeeData = null;
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'sendProductData' && request.data) {
        cachedShopeeData = request.data;
    }
});

window.addEventListener('message', async (event) => {
    if (event.data && event.data.action === 'hijack_download') {
        const sendStatus = (status, done = false) => {
            const iframe = document.querySelector('iframe[src*="index.html"]');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ action: 'hijack_status', status, done }, "*");
            }
        };

        let handle = null;
        try { handle = await loadDirectoryHandle(); } catch(e) {}
        if (!handle) handle = directoryHandle;

        if (!handle) {
            sendStatus("Lỗi: Chưa chọn thư mục ở Tab Ảnh", true);
            return;
        }

        // Always query active tab for latest data just in case
        let finalData = cachedShopeeData;
        try {
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (tabs && tabs.length > 0) {
                const response = await chrome.tabs.sendMessage(tabs[0].id, {action: "requestProductData"}).catch(() => null);
                if (response && response.data) finalData = response.data;
            }
        } catch(e) {}

        if (!finalData) {
            sendStatus("Lỗi: Chưa có dữ liệu SP (F5 Shopee)", true);
            return;
        }

        const mainImages = finalData.mainImages || [];
        const descImages = finalData.descriptionImages || [];
        if (mainImages.length === 0 && descImages.length === 0) {
            sendStatus("Lỗi: Không có ảnh nào", true);
            return;
        }

        try {
            let perm = await handle.queryPermission({ mode: "readwrite" });
            if (perm !== "granted") {
                perm = await handle.requestPermission({ mode: "readwrite" });
                if (perm !== "granted") {
                    sendStatus("Lỗi: Chưa cấp quyền thư mục", true);
                    return;
                }
            }

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const mi = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const dateStr = `${yyyy}${mm}${dd}${hh}${mi}${ss}`;

            let total = mainImages.length + descImages.length;
            let count = 0;

            const downloadImg = async (url, prefix, index) => {
                try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const filename = `${prefix}${dateStr}${index}.jpg`;
                    const fileHandle = await handle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    count++;
                    sendStatus(`Đang tải... ${count}/${total}`);
                } catch(e) {
                    console.error("Lỗi tải ảnh", url, e);
                }
            };

            for (let i = 0; i < mainImages.length; i++) {
                await downloadImg(mainImages[i], "c", i + 1);
            }
            for (let i = 0; i < descImages.length; i++) {
                await downloadImg(descImages[i], "m", i + 1);
            }

            sendStatus(`Thành công! Đã lưu ${count} ảnh.`, true);
        } catch (e) {
            console.error(e);
            sendStatus(`Lỗi: ${e.message}`, true);
        }
    } else if (event.data && event.data.action === 'hijack_category_download') {
        const sendStatus = (status, done = false) => {
            const iframe = document.querySelector('iframe[src*="index.html"]');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ action: 'hijack_status', status, done }, "*");
            }
        };

        let handle = null;
        try { handle = await loadDirectoryHandle(); } catch(e) {}
        if (!handle) handle = directoryHandle;

        if (!handle) {
            sendStatus("Lỗi: Chưa chọn thư mục ở Tab Ảnh", true);
            return;
        }

        try {
            let perm = await handle.queryPermission({ mode: "readwrite" });
            if (perm !== "granted") {
                perm = await handle.requestPermission({ mode: "readwrite" });
                if (perm !== "granted") {
                    sendStatus("Lỗi: Chưa cấp quyền", true);
                    return;
                }
            }

            const urls = event.data.urls || [];
            const type = event.data.type || "img";
            if (urls.length === 0) return;
            
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const mi = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const dateStr = `${yyyy}${mm}${dd}${hh}${mi}${ss}`;

            let prefix = type === "main" ? "c" : (type === "desc" || type === "description" ? "m" : (type === "variant" || type === "variants" ? "v" : "img"));
            
            for (let i = 0; i < urls.length; i++) {
                let url = urls[i];
                if ((type === "variant" || type === "variants") && typeof urls[i] === "object" && urls[i].image) {
                    url = urls[i].image;
                }
                
                try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const idx = event.data && event.data.singleIndex ? event.data.singleIndex : (i + 1);
                    const filename = `${prefix}${dateStr}${idx}.jpg`;
                    const fileHandle = await handle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch(e) {
                    console.error("Lỗi tải ảnh", url, e);
                }
                sendStatus(`Đang tải... ${i + 1}/${urls.length}`);
            }
            sendStatus(`Thành công!`, true);
        } catch (e) {
            console.error(e);
            sendStatus(`Lỗi: ${e.message}`, true);
        }
    } else if (event.data && event.data.action === 'save_single_file_to_handle') {
        let handle = null;
        try { handle = await loadDirectoryHandle(); } catch(e) {}
        if (!handle) handle = directoryHandle;
        if (!handle) return;

        try {
            let perm = await handle.queryPermission({ mode: "readwrite" });
            if (perm !== "granted") {
                perm = await handle.requestPermission({ mode: "readwrite" });
                if (perm !== "granted") return;
            }

            const url = event.data.url;
            if (!url) return;

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const mi = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const dateStr = `${yyyy}${mm}${dd}${hh}${mi}${ss}`;

            let type = event.data.type || "img";
            let prefix = event.data.prefixCustom || (type === "main" ? "c" : (type === "desc" || type === "description" ? "m" : (type === "variant" || type === "variants" ? "v" : "img")));
            let idx = event.data.index || 1;

            const res = await fetch(url);
            const blob = await res.blob();
            const filename = `${prefix}${dateStr}${idx}.jpg`;
            const fileHandle = await handle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (e) {
            console.error("Save single file error:", e);
        }
    } else if (event.data && event.data.action === 'upload_video_to_active_tab') {
        const videoUrl = event.data.url;
        try {
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (!tabs || tabs.length === 0) {
                event.source.postMessage({ action: 'upload_video_result', success: false, message: 'Không tìm thấy tab hoạt động' }, "*");
                return;
            }
            const activeTab = tabs[0];
            if (!activeTab.url.includes("banhang.shopee.vn/creator-center/video-upload") && !activeTab.url.includes("banhang.shopee.vn/portal/product")) {
                event.source.postMessage({ action: 'upload_video_result', success: false, message: 'Vui lòng mở đúng trang tải video của Shopee' }, "*");
                return;
            }

            chrome.tabs.sendMessage(activeTab.id, { action: "upload_video_from_url", url: videoUrl }, (response) => {
                if (chrome.runtime.lastError) {
                    event.source.postMessage({ action: 'upload_video_result', success: false, message: 'Không kết nối được trang web. Hãy F5 trang Shopee.' }, "*");
                } else if (response && response.success) {
                    event.source.postMessage({ action: 'upload_video_result', success: true }, "*");
                } else {
                    event.source.postMessage({ action: 'upload_video_result', success: false, message: response?.message || 'Lỗi tải video lên trang' }, "*");
                }
            });
        } catch (e) {
            console.error(e);
            event.source.postMessage({ action: 'upload_video_result', success: false, message: e.message }, "*");
        }
    }
});

// ==========================================
// LOGIC CHO TAB TẠO ẢNH AI
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const chk1 = document.getElementById("ai-chk-tich1");
  const chk2 = document.getElementById("ai-chk-tich2");
  const btnLayText = document.getElementById("ai-btn-lay-text");
  const inputShopeeText = document.getElementById("ai-input-shopee-text");
  const finalPromptArea = document.getElementById("ai-final-prompt");
  const btnCopyPrompt = document.getElementById("ai-btn-copy-full-prompt");
  const baseTextDiv = document.getElementById("ai-base-text");
  const containerImages = document.getElementById("ai-template-images-container");

  const baseTextContent = "thay ảnh 2 vào ảnh 1 . thay thế tên sản phẩm + model+ đặc điểm + ảnh minh họa bên dưới phù hợp với sản phẩm + slogan";

  // Đảm bảo 2 ô tích không bao giờ cùng tích một lúc
  if (chk1 && chk2) {
    chk1.addEventListener("change", () => {
      if (chk1.checked) {
        chk2.checked = false;
      }
      updateFinalPrompt();
    });
    chk2.addEventListener("change", () => {
      if (chk2.checked) {
        chk1.checked = false;
      }
      updateFinalPrompt();
    });
  }

  if (inputShopeeText) {
    inputShopeeText.addEventListener("input", updateFinalPrompt);
    inputShopeeText.addEventListener("keyup", updateFinalPrompt);
    inputShopeeText.addEventListener("change", updateFinalPrompt);
  }

  // Lắng nghe thay đổi tên sản phẩm ở tab Web bán SP (web-sp-ten)
  const tenWebSpInput = document.getElementById("web-sp-ten");
  if (tenWebSpInput) {
    tenWebSpInput.addEventListener("input", updateFinalPrompt);
    tenWebSpInput.addEventListener("keyup", updateFinalPrompt);
    tenWebSpInput.addEventListener("change", updateFinalPrompt);
  }

  // Cập nhật Prompt và ảnh mẫu khi nhấn chuyển sang tab Tạo ảnh AI & API
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-tab");
      if (tabName === "tab-api-images" || tabName === "tab-create-ai-img") {
        updateFinalPrompt();
        loadCaiDatTemplateImages();
      }
    });
  });

  // Nút Lấy Text từ Shopee
  if (btnLayText) {
    btnLayText.addEventListener("click", async () => {
      btnLayText.textContent = "Đang lấy...";
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "GET_PRODUCT_NAME" }, (res) => {
            btnLayText.textContent = "Lấy Text từ Shopee";
            if (res && res.name) {
              inputShopeeText.value = res.name;
              chk2.checked = true;
              chk1.checked = false;
              updateFinalPrompt();
            } else {
              alert("Không lấy được tên từ trang Shopee active.");
            }
          });
        }
      } catch (err) {
        btnLayText.textContent = "Lấy Text từ Shopee";
        alert("Lỗi khi kết nối tab Shopee: " + err.message);
      }
    });
  }

  // Nút Copy Prompt
  if (btnCopyPrompt) {
    btnCopyPrompt.addEventListener("click", () => {
      if (!finalPromptArea || !finalPromptArea.value) return;
      navigator.clipboard.writeText(finalPromptArea.value).then(() => {
        btnCopyPrompt.textContent = "Đã Copy!";
        btnCopyPrompt.style.backgroundColor = "#16a34a";
        setTimeout(() => {
          btnCopyPrompt.textContent = "Copy Prompt";
          btnCopyPrompt.style.backgroundColor = "#2563eb";
        }, 1200);
      });
    });
  }

  function updateFinalPrompt() {
    if (!finalPromptArea) return;
    let fullPrompt = baseTextContent;

    if (chk1 && chk1.checked) {
      const tenWebSpInput = document.getElementById("web-sp-ten");
      const tenWebSp = tenWebSpInput ? tenWebSpInput.value.trim() : "";
      if (tenWebSp) {
        fullPrompt += " . Tên sản phẩm: " + tenWebSp;
      }
    } else if (chk2 && chk2.checked) {
      const tenShopeeText = inputShopeeText ? inputShopeeText.value.trim() : "";
      if (tenShopeeText) {
        fullPrompt += " . Tên sản phẩm: " + tenShopeeText;
      }
    }

    finalPromptArea.value = fullPrompt;
  }

  // Lấy ảnh mẫu từ Sheet CÀI ĐẶT Cột D (anh_mau)
  async function loadCaiDatTemplateImages() {
    if (!containerImages) return;
    try {
      const token = await getAccessToken();
      if (!GOOGLE_SHEET_CONFIG.spreadsheetId) return;

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/CAI_DAT!A1:Z50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.values) {
        containerImages.innerHTML = '<span style="font-size:11px; color:#ef4444;">Không tải được cột anh_mau từ sheet CAI_DAT</span>';
        return;
      }

      const rows = data.values;
      const headers = rows[0] || [];
      // Tìm chỉ số cột anh_mau hoặc mặc định cột D (chỉ số 3)
      let anhMauIdx = headers.findIndex(h => String(h).trim().toLowerCase() === "anh_mau");
      if (anhMauIdx === -1) anhMauIdx = 3; // Cột D

      const imageUrls = [];
      for (let i = 1; i < rows.length; i++) {
        const val = String(rows[i][anhMauIdx] || "").trim();
        if (val && (val.startsWith("http://") || val.startsWith("https://"))) {
          imageUrls.push(val);
        }
      }

      if (imageUrls.length === 0) {
        containerImages.innerHTML = '<span style="font-size:11px; color:#94a3b8; align-self:center;">Không có link ảnh trong cột D (anh_mau) của Sheet CÀI ĐẶT</span>';
        return;
      }

      containerImages.innerHTML = imageUrls.map((url, idx) => {
        const imgId = `ai-template-img-${idx + 1}`;
        return `
          <div style="position: relative; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; flex-shrink: 0; background: #f8fafc; width: 62px; height: 62px; display: flex; align-items: center; justify-content: center;">
            <img id="${imgId}" src="${url}" style="width: 100%; height: 100%; object-fit: contain; display: block;" title="Ảnh mẫu ${idx + 1}">
            <div style="position: absolute; top: 2px; right: 2px; display: flex; gap: 2px; background: rgba(0,0,0,0.5); padding: 1px 2px; border-radius: 3px; backdrop-filter: blur(2px);">
              <button type="button" class="ai-tab-open-gpt" data-target="${imgId}" style="width: 16px !important; height: 16px !important; min-height: unset !important; padding: 0 !important; font-size: 9px; background: #10a37f; color: white; border: none; border-radius: 2px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" title="Mở trên ChatGPT">🤖</button>
              <button type="button" class="ai-tab-open-gemini" data-target="${imgId}" style="width: 16px !important; height: 16px !important; min-height: unset !important; padding: 0 !important; font-size: 9px; background: #1a73e8; color: white; border: none; border-radius: 2px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" title="Mở trên Gemini">✨</button>
              <button type="button" class="ai-tab-copy-img" data-target="${imgId}" style="width: 16px !important; height: 16px !important; min-height: unset !important; padding: 0 !important; font-size: 9px; background: #334155; color: white; border: none; border-radius: 2px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" title="Copy ảnh">📋</button>
            </div>
          </div>
        `;
      }).join("");

      // Gán sự kiện click cho 3 nút
      containerImages.querySelectorAll(".ai-tab-open-gpt").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          const imgEl = document.getElementById(btn.getAttribute("data-target"));
          if (!imgEl) return;
          const imgUrl = imgEl.getAttribute("src");
          const oldText = btn.innerHTML;
          btn.innerHTML = "...";
          btn.disabled = true;
          try {
            const res = await fetch(imgUrl);
            const blob = await res.blob();
            const filename = imgUrl.split("/").pop().split("?")[0] || "image.png";
            const file = new File([blob], filename, { type: blob.type });
            const promptText = finalPromptArea ? finalPromptArea.value.trim() : "";
            await openAiInNewTab("chatgpt", file, promptText, btn);
          } catch (err) {
            console.error("Open ChatGPT error:", err);
          } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
          }
        });
      });

      containerImages.querySelectorAll(".ai-tab-open-gemini").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          const imgEl = document.getElementById(btn.getAttribute("data-target"));
          if (!imgEl) return;
          const imgUrl = imgEl.getAttribute("src");
          const oldText = btn.innerHTML;
          btn.innerHTML = "...";
          btn.disabled = true;
          try {
            const res = await fetch(imgUrl);
            const blob = await res.blob();
            const filename = imgUrl.split("/").pop().split("?")[0] || "image.png";
            const file = new File([blob], filename, { type: blob.type });
            const promptText = finalPromptArea ? finalPromptArea.value.trim() : "";
            await openAiInNewTab("gemini", file, promptText, btn);
          } catch (err) {
            console.error("Open Gemini error:", err);
          } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
          }
        });
      });

      containerImages.querySelectorAll(".ai-tab-copy-img").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          const imgEl = document.getElementById(btn.getAttribute("data-target"));
          if (!imgEl) return;
          const imgUrl = imgEl.getAttribute("src");
          const oldText = btn.innerHTML;
          btn.innerHTML = "...";
          btn.disabled = true;
          const success = await copyImageToClipboard(imgUrl);
          btn.innerHTML = success ? "✔ Đã copy" : "❌ Lỗi";
          setTimeout(() => {
            btn.innerHTML = oldText;
            btn.disabled = false;
          }, 1500);
        });
      });

    } catch (err) {
      if (containerImages) {
        containerImages.innerHTML = `<span style="font-size:11px; color:#ef4444;">Lỗi: ${err.message}</span>`;
      }
    }
  }

  // Nút đóng/mở thu gọn Section 1 Tạo ảnh AI
  const toggleAiSectionBtn = document.getElementById("ai-section-toggle-btn");
  const aiSectionBody = document.getElementById("ai-section-body");
  if (toggleAiSectionBtn && aiSectionBody) {
    toggleAiSectionBtn.addEventListener("click", () => {
      const isHidden = aiSectionBody.style.display === "none";
      aiSectionBody.style.display = isHidden ? "block" : "none";
      toggleAiSectionBtn.textContent = isHidden ? "Thu gọn ▲" : "Mở rộng ▼";
      toggleAiSectionBtn.style.background = isHidden ? "#f1f5f9" : "#dbeafe";
      toggleAiSectionBtn.style.color = isHidden ? "#475569" : "#1d4ed8";
    });
  }

  // Khởi chạy
  updateFinalPrompt();
  loadCaiDatTemplateImages();
});

// ==========================================
// LOGIC CHO TAB ẢNH API (UPLOAD & LƯU SHEET LUU_ANH_API)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.getElementById("api-img-dropzone");
  const fileInput = document.getElementById("api-img-file-input");
  const statusDiv = document.getElementById("api-img-status");
  const tbody = document.getElementById("api-img-tbody");

  const tableContainer = document.getElementById("api-img-table-container");
  const gridContainer = document.getElementById("api-img-grid-container");
  const btnViewTable = document.getElementById("api-view-btn-table");
  const btnViewGrid3 = document.getElementById("api-view-btn-grid3");
  const btnViewGrid4 = document.getElementById("api-view-btn-grid4");

  if (!dropzone || !fileInput) return;

  let uploadedList = [];
  let currentViewMode = "grid3"; // Mặc định là Lưới 3 cột

  // Chuyển đổi chế độ xem
  function setViewMode(mode) {
    currentViewMode = mode;
    [btnViewTable, btnViewGrid3, btnViewGrid4].forEach(b => {
      if (b) b.style.background = "#64748b";
    });

    if (mode === "table") {
      if (btnViewTable) btnViewTable.style.background = "#2563eb";
      if (tableContainer) tableContainer.style.display = "block";
      if (gridContainer) gridContainer.style.display = "none";
    } else if (mode === "grid3") {
      if (btnViewGrid3) btnViewGrid3.style.background = "#2563eb";
      if (tableContainer) tableContainer.style.display = "none";
      if (gridContainer) {
        gridContainer.style.display = "grid";
        gridContainer.style.gridTemplateColumns = "repeat(3, 1fr)";
        gridContainer.style.gap = "6px";
      }
    } else if (mode === "grid4") {
      if (btnViewGrid4) btnViewGrid4.style.background = "#2563eb";
      if (tableContainer) tableContainer.style.display = "none";
      if (gridContainer) {
        gridContainer.style.display = "grid";
        gridContainer.style.gridTemplateColumns = "repeat(4, 1fr)";
        gridContainer.style.gap = "6px";
      }
    }
    renderUploadedItems();
  }

  if (btnViewTable) btnViewTable.addEventListener("click", () => setViewMode("table"));
  if (btnViewGrid3) btnViewGrid3.addEventListener("click", () => setViewMode("grid3"));
  if (btnViewGrid4) btnViewGrid4.addEventListener("click", () => setViewMode("grid4"));

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.background = "#dbeafe";
    dropzone.style.borderColor = "#2563eb";
  });

  dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropzone.style.background = "#f0f7ff";
    dropzone.style.borderColor = "#3b82f6";
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.background = "#f0f7ff";
    dropzone.style.borderColor = "#3b82f6";
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleApiImageFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Hỗ trợ sự kiện Dán ảnh (Ctrl + V) từ Clipboard
  function handlePasteImage(e) {
    const tabApi = document.getElementById("tab-api-images");
    if (!tabApi || tabApi.hidden) return; // Chỉ xử lý khi đang ở tab Ảnh API

    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    const files = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          // Tạo tên file ngẫu nhiên nếu file paste không có tên
          const ext = file.type.split("/")[1] || "png";
          const newName = file.name && file.name !== "image.png" 
            ? file.name 
            : `pasted_image_${Date.now()}_${i + 1}.${ext}`;
          
          const renamedFile = new File([file], newName, { type: file.type });
          files.push(renamedFile);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      handleApiImageFiles(files);
    }
  }

  document.addEventListener("paste", handlePasteImage);

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleApiImageFiles(Array.from(e.target.files));
      fileInput.value = "";
    }
  });

  // Chuyển đuôi file link ảnh API thành .jpg
  function formatLinkToJpg(url) {
    if (!url) return "";
    return url.replace(/\.(webp|png|gif|jpeg|bmp)(\?.*)?$/i, ".jpg$2");
  }

  async function handleApiImageFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      showStatus("Vui lòng chọn file hình ảnh hợp lệ!", "red");
      return;
    }

    showStatus(`Đang tải lên ${imageFiles.length} ảnh lên API...`, "#2563eb");

    const sheetRowsToSave = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      try {
        showStatus(`Đang upload ảnh ${i + 1}/${imageFiles.length}: ${file.name}...`, "#2563eb");
        
        let imgUrl = await uploadFileToImgBB(file);
        // Đổi thành đuôi .jpg theo yêu cầu
        imgUrl = formatLinkToJpg(imgUrl);

        const imgId = "API_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

        const item = {
          id: imgId,
          link: imgUrl,
          ten_anh: file.name,
          link_cu: file.link_cu || file.originalUrl || ""
        };

        uploadedList.push(item);
        sheetRowsToSave.push([item.id, item.link, item.ten_anh, item.link_cu || ""]);
      } catch (err) {
        console.error("Lỗi upload ảnh API:", err);
        showStatus(`Lỗi khi tải ảnh ${file.name}: ${err.message}`, "red");
      }
    }

    if (sheetRowsToSave.length > 0) {
      showStatus(`Đang lưu ${sheetRowsToSave.length} ảnh vào Sheet LUU_ANH_API...`, "#2563eb");
      chrome.runtime.sendMessage({ type: "UPLOAD_LUU_ANH_API", rows: sheetRowsToSave }, (res) => {
        if (res && res.ok) {
          showStatus(`✅ Đã tải lên và lưu thành công ${sheetRowsToSave.length} ảnh vào Sheet LUU_ANH_API!`, "#16a34a");
        } else {
          showStatus(`⚠️ Tải ảnh thành công nhưng lỗi khi lưu Sheet: ${res?.error || "Lỗi không xác định"}`, "#d97706");
        }
        currentPage = 1;
        renderUploadedItems();
      });
    } else {
      currentPage = 1;
      renderUploadedItems();
    }
  }

  function showStatus(text, color) {
    if (statusDiv) {
      statusDiv.textContent = text;
      statusDiv.style.color = color;
    }
  }

  const PAGE_SIZE = 48;
  let currentPage = 1;

  // Cập nhật giao diện phân trang
  function updatePaginationUI(totalItems, totalPages, curPage) {
    const totalCountEl = document.getElementById("api-img-total-count");
    const currentPageEl = document.getElementById("api-img-current-page");
    const totalPagesEl = document.getElementById("api-img-total-pages");
    const btnFirst = document.getElementById("api-img-btn-first");
    const btnPrev = document.getElementById("api-img-btn-prev");
    const btnNext = document.getElementById("api-img-btn-next");
    const btnLast = document.getElementById("api-img-btn-last");
    const paginationBar = document.getElementById("api-img-pagination");

    if (totalCountEl) totalCountEl.textContent = totalItems;
    if (currentPageEl) currentPageEl.textContent = curPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;

    if (btnFirst) btnFirst.disabled = (curPage <= 1);
    if (btnPrev) btnPrev.disabled = (curPage <= 1);
    if (btnNext) btnNext.disabled = (curPage >= totalPages);
    if (btnLast) btnLast.disabled = (curPage >= totalPages);

    [btnFirst, btnPrev, btnNext, btnLast].forEach(btn => {
      if (btn) {
        btn.style.opacity = btn.disabled ? "0.4" : "1";
        btn.style.cursor = btn.disabled ? "not-allowed" : "pointer";
      }
    });

    if (paginationBar) {
      paginationBar.style.display = totalItems > 0 ? "flex" : "none";
    }
  }

  function scrollApiViewToTop() {
    if (tableContainer) tableContainer.scrollTop = 0;
    if (gridContainer) gridContainer.scrollTop = 0;
  }

  // Tải danh sách ảnh đã lưu trong Sheet LUU_ANH_API
  async function fetchLuuAnhApiFromSheet() {
    showStatus("Đang tải dữ liệu ảnh từ Sheet LUU_ANH_API...", "#2563eb");
    try {
      const token = await getAccessToken();
      if (!GOOGLE_SHEET_CONFIG.spreadsheetId) {
        showStatus("Chưa cấu hình Spreadsheet ID!", "red");
        return;
      }

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.spreadsheetId}/values/LUU_ANH_API!A:D`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.values || data.values.length <= 1) {
        showStatus("Chưa có ảnh nào trong Sheet LUU_ANH_API.", "#64748b");
        uploadedList = [];
        renderUploadedItems();
        return;
      }

      const rows = data.values;
      const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = headers.findIndex(h => h === "id");
      let linkIdx = headers.findIndex(h => h === "link");
      let tenAnhIdx = headers.findIndex(h => h === "ten_anh" || h === "tên ảnh" || h === "ten anh");
      let linkCuIdx = headers.findIndex(h => h === "link_cu" || h === "link cu" || h === "link gốc" || h === "link_goc" || h === "linkgoc");

      if (idIdx === -1) idIdx = 0;
      if (linkIdx === -1) linkIdx = 1;
      if (tenAnhIdx === -1) tenAnhIdx = 2;
      if (linkCuIdx === -1) linkCuIdx = 3;

      const loadedItems = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const id = row[idIdx] || "";
        let link = row[linkIdx] || "";
        const ten_anh = row[tenAnhIdx] || "";
        const link_cu = row[linkCuIdx] || "";

        if (link && (link.startsWith("http://") || link.startsWith("https://"))) {
          link = formatLinkToJpg(link);
          loadedItems.push({ id, link, ten_anh, link_cu });
        }
      }

      uploadedList = loadedItems;
      showStatus(`✅ Đã tải ${uploadedList.length} ảnh từ Sheet LUU_ANH_API.`, "#16a34a");
      renderUploadedItems();
    } catch (err) {
      console.error("Lỗi khi tải LUU_ANH_API:", err);
      showStatus(`Lỗi tải Sheet LUU_ANH_API: ${err.message}`, "red");
    }
  }

  function renderUploadedItems() {
    // Đảo ngược danh sách để hiển thị đầy đủ ảnh từ dưới lên trên (dòng dưới cùng trong Sheet = ảnh mới nhất lên đầu)
    const reversedList = [...uploadedList].reverse();
    const totalItems = reversedList.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
    const pageItems = reversedList.slice(startIndex, endIndex);

    updatePaginationUI(totalItems, totalPages, currentPage);

    if (currentViewMode === "table") {
      if (!tbody) return;
      if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px; color: #94a3b8;">Chưa có ảnh nào trong dữ liệu.</td></tr>`;
        return;
      }

      tbody.innerHTML = pageItems.map((item, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 8px; text-align: center; color: #64748b;">${totalItems - (startIndex + idx)}</td>
          <td style="padding: 6px 8px;">
            <img src="${item.link}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; display: block;" loading="lazy">
          </td>
          <td style="padding: 6px 8px; font-weight: 500; color: #1e293b; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.ten_anh}">${item.ten_anh}</td>
          <td style="padding: 6px 8px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <a href="${item.link}" target="_blank" style="color: #2563eb; text-decoration: none;" title="${item.link}">${item.link}</a>
          </td>
          <td style="padding: 6px 8px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${item.link_cu ? `<a href="${item.link_cu}" target="_blank" style="color: #64748b; text-decoration: none;" title="${item.link_cu}">${item.link_cu}</a>` : `<span style="color: #94a3b8;">-</span>`}
          </td>
          <td style="padding: 6px 8px; text-align: center;">
            <button type="button" class="api-copy-btn" data-link="${item.link}" style="padding: 2px 6px; font-size: 10px; background: #0284c7; color: white; border: none; border-radius: 3px; cursor: pointer;">Copy</button>
          </td>
        </tr>
      `).join("");
    } else {
      if (!gridContainer) return;
      if (pageItems.length === 0) {
        gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #94a3b8; font-size: 11px;">Chưa có ảnh nào trong dữ liệu.</div>`;
        return;
      }

      gridContainer.innerHTML = pageItems.map((item) => `
        <div style="position: relative; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #f8fafc; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center;">
          <img src="${item.link}" style="width: 100%; height: 100%; object-fit: cover; display: block;" title="${item.ten_anh || item.id}" loading="lazy">
          <button type="button" class="api-copy-btn" data-link="${item.link}" style="position: absolute; bottom: 4px; right: 4px; padding: 2px 6px; font-size: 9px; font-weight: bold; background: rgba(0,0,0,0.65); color: white; border: none; border-radius: 3px; cursor: pointer;" title="Copy Link .jpg">📋 Copy</button>
        </div>
      `).join("");
    }
  }

  // Sự kiện copy link ảnh
  document.addEventListener("click", (e) => {
    const copyBtn = e.target.closest(".api-copy-btn");
    if (copyBtn) {
      const link = copyBtn.getAttribute("data-link");
      if (link) {
        navigator.clipboard.writeText(link).then(() => {
          const orig = copyBtn.textContent;
          copyBtn.textContent = "✓ Đã copy";
          setTimeout(() => { copyBtn.textContent = orig; }, 1200);
        }).catch(err => {
          console.error("Lỗi copy link ảnh:", err);
        });
      }
    }
  });

  // Sự kiện chuyển trang
  const btnFirst = document.getElementById("api-img-btn-first");
  const btnPrev = document.getElementById("api-img-btn-prev");
  const btnNext = document.getElementById("api-img-btn-next");
  const btnLast = document.getElementById("api-img-btn-last");

  if (btnFirst) btnFirst.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage = 1;
      renderUploadedItems();
      scrollApiViewToTop();
    }
  });

  if (btnPrev) btnPrev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderUploadedItems();
      scrollApiViewToTop();
    }
  });

  if (btnNext) btnNext.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(uploadedList.length / PAGE_SIZE));
    if (currentPage < totalPages) {
      currentPage++;
      renderUploadedItems();
      scrollApiViewToTop();
    }
  });

  if (btnLast) btnLast.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(uploadedList.length / PAGE_SIZE));
    if (currentPage < totalPages) {
      currentPage = totalPages;
      renderUploadedItems();
      scrollApiViewToTop();
    }
  });

  // Khởi tạo mặc định ở dạng 3 cột
  setViewMode("grid3");

  // Tải dữ liệu từ Sheet LUU_ANH_API
  fetchLuuAnhApiFromSheet();

  // Tải lại dữ liệu khi người dùng chuyển sang Tab "Ảnh API"
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.getAttribute("data-tab") === "tab-api-images") {
        fetchLuuAnhApiFromSheet();
      }
    });
  });
});
