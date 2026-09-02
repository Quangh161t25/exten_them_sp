const statusText = document.querySelector("#status");
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
const printFlowSelectCheckboxButton = document.querySelector("#print-flow-select-checkbox");
const printWarehouseButtons = document.querySelector("#print-warehouse-buttons");
const printAddressButtons = document.querySelector("#print-address-buttons");
const selectWarehouseHanoiButton = document.querySelector("#select-warehouse-hanoi");
const selectWarehouseHcmButton = document.querySelector("#select-warehouse-hcm");
const selectAddressHanoiButton = document.querySelector("#select-address-hanoi");
const selectAddressHcmButton = document.querySelector("#select-address-hcm");
const arrangePickupConfirmButton = document.querySelector("#arrange-pickup-confirm");
const generatePrintDocButton = document.querySelector("#generate-print-doc");
const exportWaitingOrdersButton = document.querySelector("#export-waiting-orders");
const choosePrintFolderButton = document.querySelector("#choose-print-folder");
const reloadPrintFolderButton = document.querySelector("#reload-print-folder");
const printFileCountText = document.querySelector("#print-file-count");
const printPdfTable = document.querySelector("#print-pdf-table");
const printExcelTable = document.querySelector("#print-excel-table");

const PRINT_FLOW_URL = "https://banhang.shopee.vn/portal/sale/mass/ship?filter.product_location_id=VNZ&mass_shipment_tab=201&filter.shipping_method=50021&filter.order_item_filter_type=item0&filter.order_process_status=1&filter.sort.sort_type=2&filter.sort.ascending=true&filter.pre_order=2&filter.shipping_urgency_filter.current_time=1782553036&filter.shipping_urgency_filter.shipping_urgency=1";
const ORDER_EXPORT_URL = "https://banhang.shopee.vn/portal/sale/order?type=toship&source=processed&sort_by=ship_by_date_asc";
const DB_NAME = "shopee-helper-print";
const DB_STORE = "handles";
const PRINT_FOLDER_KEY = "print-folder";
const PRINT_FOLDER_NAME_KEY = "printFolderName";
const AUTO_CONFIGS_KEY = "autoRunConfigs";

let printDirectoryHandle = null;
let isAutoRunningPrintFlow = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  setStatus(`Da luu cau hinh tu dong: ${name}.`);
}

async function loadAutoRunConfig(name = getAutoConfigName()) {
  const configName = String(name || "").trim() || "mac-dinh";
  const data = await chrome.storage.local.get(AUTO_CONFIGS_KEY);
  const config = data[AUTO_CONFIGS_KEY]?.[configName];

  if (!config) {
    setStatus(`Chua co cau hinh: ${configName}.`);
    return;
  }

  if (autoConfigNameInput) {
    autoConfigNameInput.value = configName;
  }
  applyAutoRunConfig(config);
  setStatus(`Da tai cau hinh tu dong: ${configName}.`);
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
    empty.textContent = "Chua co cau hinh da luu";
    savedAutoConfigsTable.append(empty);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  thead.innerHTML = "<tr><th>Ten</th><th>Buoc</th><th>Giay</th><th>Kho</th><th>Dia chi</th><th></th></tr>";

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
    loadButton.textContent = "Tai";
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

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isPrintFlowPage(url) {
  return String(url || "").startsWith("https://banhang.shopee.vn/portal/sale/mass/ship");
}

function isOrderExportPage(url) {
  return String(url || "").startsWith("https://banhang.shopee.vn/portal/sale/order");
}

function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      resolve(false);
    }, timeoutMs);

    function handleUpdated(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(handleUpdated);
        resolve(true);
      }
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);
  });
}

async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["seller-flow.js"]
    });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function getOrOpenPrintFlowTab() {
  const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/portal/sale/mass/ship*" });
  const existingTab = tabs.find((tab) => isPrintFlowPage(tab.url));

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { active: true });
    return existingTab;
  }

  const printTab = await chrome.tabs.create({ url: PRINT_FLOW_URL, active: true });

  if (printTab?.id) {
    await waitForTabLoad(printTab.id);
  }

  return printTab;
}

async function getOrOpenOrderExportTab() {
  const tabs = await chrome.tabs.query({ url: "https://banhang.shopee.vn/portal/sale/order*" });
  const existingTab = tabs.find((tab) => isOrderExportPage(tab.url));

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { active: true });

    if (existingTab.url === ORDER_EXPORT_URL) {
      await chrome.tabs.reload(existingTab.id);
    } else {
      await chrome.tabs.update(existingTab.id, { url: ORDER_EXPORT_URL });
    }

    await waitForTabLoad(existingTab.id);
    return chrome.tabs.get(existingTab.id);
  }

  const orderTab = await chrome.tabs.create({ url: ORDER_EXPORT_URL, active: true });

  if (orderTab?.id) {
    await waitForTabLoad(orderTab.id);
  }

  return orderTab;
}

function setStatus(message) {
  if (statusText) {
    statusText.textContent = message;
  }
}

function renderPrintWarehouseButtons(warehouses) {
  printWarehouseButtons.textContent = "";

  if (!warehouses?.length) {
    const empty = document.createElement("div");
    empty.className = "print-flow-empty";
    empty.textContent = "Chua tai duoc danh sach kho";
    printWarehouseButtons.append(empty);
    return;
  }

  for (const warehouse of warehouses) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = warehouse.selected ? "primary-action" : "secondary";
    button.textContent = `Kho ${warehouse.name}`;
    button.addEventListener("click", () => selectPrintWarehouse(warehouse.name, button));
    printWarehouseButtons.append(button);
  }
}

async function loadPrintWarehouses() {
  const tab = await getOrOpenPrintFlowTab();

  if (!tab?.id) {
    throw new Error("Khong tim thay tab quy trinh in don.");
  }

  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_GET_WAREHOUSES"
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Khong tai duoc danh sach kho.");
  }

  renderPrintWarehouseButtons(response.warehouses || []);
  return response.warehouses || [];
}

async function selectPrintWarehouse(name, button) {
  if (button) {
    button.disabled = true;
  }

  try {
    const response = await selectPrintWarehouseByName(name);
    setStatus(response?.message || `Da chon kho ${name}.`);
  } catch (error) {
    setStatus(error?.message || "Khong chon duoc kho.");
  } finally {
    if (button && document.contains(button)) {
      button.disabled = false;
    }
  }
}

async function selectPrintWarehouseByName(name) {
  const tab = await getOrOpenPrintFlowTab();
  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_SELECT_WAREHOUSE",
    name
  });

  if (!response?.ok) {
    throw new Error(response?.message || `Khong chon duoc kho ${name}.`);
  }

  return response;
}

function renderPrintAddressButtons(addresses) {
  printAddressButtons.textContent = "";

  if (!addresses?.length) {
    const empty = document.createElement("div");
    empty.className = "print-flow-empty";
    empty.textContent = "Chua tai duoc danh sach dia chi";
    printAddressButtons.append(empty);
    return;
  }

  for (const address of addresses) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = address.selected ? "primary-action" : "secondary";
    button.textContent = `Dia chi ${address.shortText || address.name || address.id}`;
    button.title = address.fullText || button.textContent;
    button.addEventListener("click", () => selectPrintAddress(address.id, button));
    printAddressButtons.append(button);
  }
}

async function loadPrintAddresses() {
  const tab = await getOrOpenPrintFlowTab();

  if (!tab?.id) {
    throw new Error("Khong tim thay tab quy trinh in don.");
  }

  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_GET_ADDRESSES"
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Khong tai duoc danh sach dia chi.");
  }

  renderPrintAddressButtons(response.addresses || []);
  return response.addresses || [];
}

async function selectPrintAddress(id, button) {
  if (button) {
    button.disabled = true;
  }

  try {
    const tab = await getOrOpenPrintFlowTab();
    const response = await sendMessageToTab(tab.id, {
      type: "PRINT_FLOW_SELECT_ADDRESS",
      id
    });

    setStatus(response?.message || "Da chon dia chi.");
  } catch (error) {
    setStatus(error?.message || "Khong chon duoc dia chi.");
  } finally {
    if (button && document.contains(button)) {
      button.disabled = false;
    }
  }
}

async function selectPrintAddressLocation(location, button) {
  if (button) {
    button.disabled = true;
  }

  try {
    const response = await selectPrintAddressByLocation(location);
    setStatus(response?.message || `Da chon dia chi ${location}.`);
  } catch (error) {
    setStatus(error?.message || "Khong chon duoc dia chi.");
  } finally {
    if (button && document.contains(button)) {
      button.disabled = false;
    }
  }
}

async function selectPrintAddressByLocation(location) {
  const tab = await getOrOpenPrintFlowTab();
  const response = await sendMessageToTab(tab.id, {
    type: "PRINT_FLOW_SELECT_ADDRESS_LOCATION",
    location
  });

  if (!response?.ok) {
    throw new Error(response?.message || `Khong chon duoc dia chi ${location}.`);
  }

  return response;
}

async function sendPrintFlowCommand(type, pendingText, fallbackText) {
  setStatus(pendingText);

  const tab = type === "PRINT_FLOW_EXPORT_WAITING_ORDERS"
    ? await getOrOpenOrderExportTab()
    : await getOrOpenPrintFlowTab();

  if (!tab?.id) {
    throw new Error(type === "PRINT_FLOW_EXPORT_WAITING_ORDERS"
      ? "Khong tim thay tab xuat don."
      : "Khong tim thay tab quy trinh in don.");
  }

  const response = await sendMessageToTab(tab.id, { type });

  if (!response?.ok) {
    throw new Error(response?.message || fallbackText);
  }

  setStatus(response.message || fallbackText);
  return response;
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

  setStatus(`Cho ${delayMs / 1000} giay de chay buoc tiep theo...`);
  for (let waited = 0; waited < delayMs; waited += 200) {
    if (!isAutoRunningPrintFlow) break;
    await sleep(200);
  }
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
      label: `Chon kho ${warehouseLocation}`,
      run: () => selectPrintWarehouseByName(warehouseLocation)
    },
    {
      id: "checkbox",
      label: "Chon hop kiem",
      run: () => sendPrintFlowCommand("PRINT_FLOW_SELECT_CHECKBOX", "Dang chon hop kiem...", "Da chon hop kiem.")
    },
    {
      id: "address",
      label: `Chon dia chi ${addressLocation}`,
      run: () => selectPrintAddressByLocation(addressLocation)
    },
    {
      id: "pickup",
      label: "Yeu cau lay hang",
      run: () => sendPrintFlowCommand("PRINT_FLOW_ARRANGE_PICKUP", "Dang yeu cau van chuyen toi lay hang...", "Da gui yeu cau lay hang.")
    },
    {
      id: "doc",
      label: "Tao phieu",
      run: () => sendPrintFlowCommand("PRINT_FLOW_GENERATE_DOC", "Dang tao phieu...", "Da tao phieu.")
    },
    {
      id: "export",
      label: "Xuat don",
      run: () => sendPrintFlowCommand("PRINT_FLOW_EXPORT_WAITING_ORDERS", "Dang xuat don...", "Da xuat don.")
    }
  ];
  const steps = allSteps.filter((step) => selectedStepIds.has(step.id));

  if (!steps.length) {
    setStatus("Hay chon it nhat mot nut de chay tu dong.");
    return;
  }

  isAutoRunningPrintFlow = true;
  setPrintFlowButtonsDisabled(true);
  autoRunPrintFlowButton.classList.add("auto-running");
  autoRunPrintFlowButton.style.display = "none";
  if (stopPrintFlowButton) stopPrintFlowButton.style.display = "inline-block";

  try {
    for (const [index, step] of steps.entries()) {
      if (!isAutoRunningPrintFlow) {
        setStatus("Da dung chay tu dong.");
        break;
      }
      setStatus(`Dang chay ${index + 1}/${steps.length}: ${step.label}...`);
      const response = await step.run();
      setStatus(response?.message || `Da xong: ${step.label}.`);
      if (!isAutoRunningPrintFlow) {
        setStatus("Da dung chay tu dong.");
        break;
      }
      await waitBeforeNextAutoStep(index, steps.length);
    }

    if (isAutoRunningPrintFlow) {
      setStatus(`Da chay xong ${steps.length} nut, moi buoc cach nhau ${getAutoStepDelayMs() / 1000} giay.`);
    }
  } catch (error) {
    setStatus(error?.message || "Chay tu dong bi loi.");
  } finally {
    isAutoRunningPrintFlow = false;
    setPrintFlowButtonsDisabled(false);
    autoRunPrintFlowButton.classList.remove("auto-running");
    autoRunPrintFlowButton.style.display = "";
    if (stopPrintFlowButton) stopPrintFlowButton.style.display = "none";
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(DB_STORE);
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function savePrintDirectoryHandle(handle) {
  const db = await openDb();
  const transaction = db.transaction(DB_STORE, "readwrite");

  transaction.objectStore(DB_STORE).put(handle, PRINT_FOLDER_KEY);

  await new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });

  await chrome.storage.local.set({ [PRINT_FOLDER_NAME_KEY]: handle.name });
}

async function loadPrintDirectoryHandle() {
  const db = await openDb();
  const transaction = db.transaction(DB_STORE, "readonly");
  const request = transaction.objectStore(DB_STORE).get(PRINT_FOLDER_KEY);

  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function ensureDirectoryPermission(handle) {
  if (!handle) {
    return false;
  }

  const options = { mode: "readwrite" };

  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }

  return (await handle.requestPermission(options)) === "granted";
}

function isSameLocalDate(leftDate, rightDate) {
  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function isTodayFile(timestamp) {
  return isSameLocalDate(new Date(timestamp), new Date());
}

function getPrintFileType(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    return "pdf";
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    return "excel";
  }

  return "";
}

function isPrintFileName(name) {
  return /\.(pdf|xlsx|xls|csv)$/i.test(name);
}

function formatPrintFileDate(timestamp) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatPrintFileSize(size) {
  if (!Number.isFinite(size)) {
    return "";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function getPrintableFileObject(fileRecord) {
  return fileRecord.file || fileRecord;
}

function openPrintFile(fileRecord) {
  const file = getPrintableFileObject(fileRecord);
  const url = URL.createObjectURL(file);

  chrome.tabs.create({ url }, () => {
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}

function renderPrintFileTable(container, files, emptyText) {
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
  const tbody = document.createElement("tbody");

  thead.innerHTML = "<tr><th>Ten file</th><th>Gio</th><th>Size</th><th></th></tr>";

  for (const file of files) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const dateCell = document.createElement("td");
    const sizeCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const openButton = document.createElement("button");

    nameCell.className = "file-name";
    nameCell.textContent = file.name;
    nameCell.title = file.name;
    dateCell.textContent = formatPrintFileDate(file.lastModified);
    sizeCell.textContent = formatPrintFileSize(file.size);
    openButton.type = "button";
    openButton.className = "print-file-open";
    openButton.textContent = "Mo";
    openButton.addEventListener("click", () => openPrintFile(file));

    actionCell.append(openButton);
    row.append(nameCell, dateCell, sizeCell, actionCell);
    tbody.append(row);
  }

  table.append(thead, tbody);
  container.append(table);
}

function renderPrintFiles(files) {
  const todayFiles = files.filter((file) => isTodayFile(file.lastModified));
  const pdfFiles = todayFiles.filter((file) => file.typeName === "pdf");
  const excelFiles = todayFiles.filter((file) => file.typeName === "excel");

  printFileCountText.textContent = `${pdfFiles.length + excelFiles.length} file`;
  renderPrintFileTable(printPdfTable, pdfFiles, "Khong co file PDF hom nay");
  renderPrintFileTable(printExcelTable, excelFiles, "Khong co file Excel hom nay");
}

async function collectPrintFilesFromDirectory(directoryHandle) {
  const files = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind !== "file" || !isPrintFileName(entry.name)) {
      continue;
    }

    const file = await entry.getFile();
    const typeName = getPrintFileType(file);

    if (typeName) {
      files.push({
        file,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        typeName
      });
    }
  }

  return files.sort((left, right) => right.lastModified - left.lastModified);
}

async function loadPrintFilesFromHandle(handle) {
  if (!handle) {
    renderPrintFiles([]);
    return;
  }

  if (!(await ensureDirectoryPermission(handle))) {
    setStatus("Chua co quyen doc thu muc in don.");
    return;
  }

  const files = await collectPrintFilesFromDirectory(handle);

  renderPrintFiles(files);
  setStatus(`Da load ${files.length} file in don.`);
}

autoRunPrintFlowButton.addEventListener("click", runAutomaticPrintFlow);
if (stopPrintFlowButton) stopPrintFlowButton.addEventListener("click", () => { isAutoRunningPrintFlow = false; });
saveAutoConfigButton.addEventListener("click", saveAutoRunConfig);
loadAutoConfigButton.addEventListener("click", loadAutoRunConfig);

printFlowSelectCheckboxButton.addEventListener("click", async () => {
  printFlowSelectCheckboxButton.disabled = true;
  try {
    await sendPrintFlowCommand("PRINT_FLOW_SELECT_CHECKBOX", "Dang chon hop kiem...", "Da chon hop kiem.");
  } catch (error) {
    setStatus(error?.message || "Khong chon duoc hop kiem.");
  } finally {
    printFlowSelectCheckboxButton.disabled = false;
  }
});

selectWarehouseHanoiButton.addEventListener("click", () => selectPrintWarehouse("Ha Noi", selectWarehouseHanoiButton));
selectWarehouseHcmButton.addEventListener("click", () => selectPrintWarehouse("Ho Chi Minh", selectWarehouseHcmButton));
selectAddressHanoiButton.addEventListener("click", () => selectPrintAddressLocation("Ha Noi", selectAddressHanoiButton));
selectAddressHcmButton.addEventListener("click", () => selectPrintAddressLocation("Ho Chi Minh", selectAddressHcmButton));

arrangePickupConfirmButton.addEventListener("click", async () => {
  arrangePickupConfirmButton.disabled = true;
  try {
    await sendPrintFlowCommand("PRINT_FLOW_ARRANGE_PICKUP", "Dang yeu cau van chuyen toi lay hang...", "Da gui yeu cau lay hang.");
  } catch (error) {
    setStatus(error?.message || "Khong yeu cau lay hang duoc.");
  } finally {
    arrangePickupConfirmButton.disabled = false;
  }
});

generatePrintDocButton.addEventListener("click", async () => {
  generatePrintDocButton.disabled = true;
  try {
    await sendPrintFlowCommand("PRINT_FLOW_GENERATE_DOC", "Dang tao phieu...", "Da tao phieu.");
  } catch (error) {
    setStatus(error?.message || "Khong tao duoc phieu.");
  } finally {
    generatePrintDocButton.disabled = false;
  }
});

exportWaitingOrdersButton.addEventListener("click", async () => {
  exportWaitingOrdersButton.disabled = true;
  try {
    await sendPrintFlowCommand("PRINT_FLOW_EXPORT_WAITING_ORDERS", "Dang xuat don...", "Da xuat don.");
  } catch (error) {
    setStatus(error?.message || "Khong xuat duoc don.");
  } finally {
    exportWaitingOrdersButton.disabled = false;
  }
});

choosePrintFolderButton.addEventListener("click", async () => {
  try {
    printDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    await savePrintDirectoryHandle(printDirectoryHandle);
    await loadPrintFilesFromHandle(printDirectoryHandle);
  } catch (error) {
    if (error?.name !== "AbortError") {
      setStatus(error?.message || "Khong chon duoc thu muc in don.");
    }
  }
});

reloadPrintFolderButton.addEventListener("click", async () => {
  try {
    await loadPrintFilesFromHandle(printDirectoryHandle);
  } catch (error) {
    setStatus(error?.message || "Khong load duoc thu muc in don.");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await refreshSavedAutoConfigs(getAutoConfigName());

  try {
    printDirectoryHandle = await loadPrintDirectoryHandle();
    await loadPrintFilesFromHandle(printDirectoryHandle);
  } catch (error) {
    renderPrintFiles([]);
  }

  try {
    await loadPrintWarehouses();
  } catch (_) {
    // Kho chi tai duoc khi trang Shopee san sang.
  }

  try {
    await loadPrintAddresses();
  } catch (_) {
    // Dia chi chi tai duoc khi trang Shopee san sang.
  }
});
