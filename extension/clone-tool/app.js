import { getShopInfo, products as shopProducts } from './shopee-api.js';
import { normalizeSource, cloneProduct, applyPrice, imgUrl, loadShopSettings } from './clone.js';
import { syncVideos } from './video-sync.js';
import { scanStock } from './scan.js';

const OPTS_KEY = 'cloneOptions';
const DEFAULT_PROMPT = 'thay ảnh 2 vào ảnh 1 . thay thế tên sản phẩm + model+ đặc điểm + ảnh minh họa bên dưới phù hợp với sản phẩm + slogan+ {ten_sp}';
const DEFAULT_OPTS = {
  weight: 5000,
  stock: 1000,
  expiryDays: 365,
  priceChange: '',
  phone: '',
  titlePrefix: '',
  titleSuffix: '',
  modelSku: '',
  parentSku: '',
  useCaiDatCover: true,
  enableAiCover: false,
  aiProvider: 'gemini',
  dropCover: true,
  usePriceBefore: false,
  skipDuplicate: true,
  keepStock: false,
  copyVideo: false,
  descImages: true,
  unlisted: false,
  templateId: '',
  descPrefix: '',
  descSuffix: '',
  selectedChannels: null,
  selectedLocations: null,
  aiImage1: '',
  aiPrompt: DEFAULT_PROMPT
};
const AUTO_FLOW_TTL = 15 * 60 * 1000;
const AI_TARGETS = {
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com/'
};

const $ = (s) => document.querySelector(s);
const fmtMoney = (v) => (v ? Number(v).toLocaleString('vi-VN') + 'đ' : '');

let opts = { ...DEFAULT_OPTS };
let current = null; // sản phẩm nguồn đã chuẩn hoá
let currentItemId = '';
let aiImageIndex = 0;
let aiCover = null;
let busy = false;
let lastAiStatusTs = 0;
let aiWatchdog = null;
let currentMaGian = '';
let currentModelSkus = {};
let currentModelNames = {}; // 'nhóm-lựa chọn' -> tên phân loại sửa tay
let currentModelPrices = {}; // 'tier_index' -> giá sửa tay
let caiDatCoverUrl = '';
let cachedCaiDatRows = null;

// ---------- Nhật ký ----------

function log(text, type = '') {
  const el = document.createElement('div');
  el.className = type;
  el.textContent = `${new Date().toLocaleTimeString('vi-VN')}  ${text}`;
  $('#log').prepend(el);
}

// ---------- Tuỳ chọn ----------

async function loadOptions() {
  const { [OPTS_KEY]: saved } = await chrome.storage.local.get(OPTS_KEY);
  opts = { ...DEFAULT_OPTS, ...(saved || {}) };
  document.querySelectorAll('[data-opt]').forEach((el) => {
    const key = el.dataset.opt;
    if (el.type === 'checkbox') el.checked = !!opts[key];
    else el.value = opts[key] ?? '';
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
      opts[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      chrome.storage.local.set({ [OPTS_KEY]: opts });
      if (key === 'priceChange' || key === 'usePriceBefore') { renderPrices(); refreshVariantPricePlaceholders(); }
      if (key === 'aiImage1') renderAiImages();
      if (key === 'useCaiDatCover') renderCover();
      if (key === 'enableAiCover') {
        updateCloneButtonUI();
        renderCover();
      }
    });
  });
}

// ---------- Shop ----------

async function checkShop() {
  const pill = $('#shopStatus');
  try {
    const info = await getShopInfo();
    pill.textContent = `Shop: ${info.name || info.shopId}`;
    pill.className = 'pill ok';
    loadShop();
  } catch (e) {
    pill.textContent = 'Chưa đăng nhập Kênh Người Bán';
    pill.title = e.message;
    pill.className = 'pill err';
  }
}

// ---------- Vận chuyển & Kho ----------

function renderChips(boxSel, items, selectedKey, idOf, labelOf, emptyText) {
  const box = $(boxSel);
  box.innerHTML = '';
  if (!items.length) {
    box.innerHTML = `<span class="hint small">${emptyText}</span>`;
    return;
  }
  const selected = Array.isArray(opts[selectedKey]) ? opts[selectedKey].map(String) : null;
  items.forEach((it) => {
    const id = String(idOf(it));
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected ? selected.includes(id) : !it.off;
    cb.addEventListener('change', () => {
      opts[selectedKey] = [...box.querySelectorAll('input')].filter((x) => x.checked).map((x) => x.value);
      chrome.storage.local.set({ [OPTS_KEY]: opts });
    });
    cb.value = id;
    label.append(cb, document.createTextNode(' ' + labelOf(it)));
    label.title = `ID: ${id}`;
    box.appendChild(label);
  });
}

async function loadShop(force = false) {
  $('#channelList').innerHTML = '<span class="hint small">Đang tải...</span>';
  $('#locationList').innerHTML = '<span class="hint small">Đang tải...</span>';
  try {
    const settings = await loadShopSettings({ templateId: opts.templateId, force });
    renderChips('#channelList', settings.channels, 'selectedChannels', (c) => c.channelid,
      (c) => c._name || `Kênh ${c.channelid}`, 'Không có');
    renderChips('#locationList', settings.locations, 'selectedLocations', (l) => l.id,
      (l) => l.name || l.id, 'Shop dùng 1 kho mặc định');
  } catch (e) {
    $('#channelList').innerHTML = '';
    $('#channelList').append(Object.assign(document.createElement('span'), { className: 'hint small', textContent: e.message }));
    $('#locationList').innerHTML = '';
  }
}

// ---------- Quét tồn kho ----------

function renderScanButton() {
  const btn = $('#btnScan');
  if (!current) {
    btn.textContent = 'Quét tồn kho (0/0)';
    btn.disabled = true;
    return;
  }
  const total = current.tiers.length ? current.models.length : 1;
  btn.textContent = `Quét tồn kho (${current.stockScanned}/${total})`;
  btn.disabled = busy;
}

async function runScan() {
  if (!current) return;
  const btn = $('#btnScan');
  btn.disabled = true;
  btn.textContent = 'Đang quét...';
  try {
    const { sclProducts } = await chrome.storage.local.get('sclProducts');
    const record = sclProducts && sclProducts[current.itemId];
    if (!record) throw new Error('Chưa có dữ liệu sản phẩm, hãy F5 trang sản phẩm.');
    const { scanned, total } = await scanStock(record, current);
    log(`Quét tồn kho: đọc được ${scanned}/${total} phân loại.`, scanned ? 'ok' : 'warn');
    if (scanned) {
      opts.keepStock = true;
      document.querySelector('[data-opt="keepStock"]').checked = true;
      chrome.storage.local.set({ [OPTS_KEY]: opts });
    }
  } catch (e) {
    log('Quét tồn kho lỗi: ' + e.message, 'err');
  } finally {
    await setCurrentItem(currentItemId);
  }
}

// ---------- Sản phẩm nguồn ----------

const parseShopeeUrl = (url) => {
  const u = String(url || '');
  if (!/^https:\/\/shopee\.vn\//.test(u)) return null;
  let m = u.match(/-i\.(\d+)\.(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  m = u.match(/\/product\/(\d+)\/(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  return null;
};

async function setCurrentItem(itemId) {
  const { sclProducts } = await chrome.storage.local.get('sclProducts');
  const rec = sclProducts && sclProducts[itemId];
  if (itemId !== currentItemId) aiImageIndex = 0;
  currentItemId = itemId || '';
  current = rec ? normalizeSource(rec) : null;
  renderProduct();
}

async function detectFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const parsed = tab && parseShopeeUrl(tab.url);
  if (parsed) {
    await setCurrentItem(parsed.itemId);
  } else if (!currentItemId) {
    const { sclLastItemId } = await chrome.storage.local.get('sclLastItemId');
    if (sclLastItemId) await setCurrentItem(sclLastItemId);
  }
}

function renderPrices() {
  if (!current) {
    $('#priceNow').value = '';
    $('#priceAfter').value = '';
    return;
  }
  const lo = opts.usePriceBefore && current.priceBefore ? current.priceBefore : current.price;
  const hi = current.priceMax || lo;
  const range = (a, b) => (!b || a === b ? fmtMoney(a) : `${fmtMoney(a)} - ${fmtMoney(b)}`);
  $('#priceNow').value = range(lo, hi);
  $('#priceAfter').value = range(applyPrice(lo, opts.priceChange), applyPrice(hi, opts.priceChange));
}

function renderProduct() {
  const has = !!current;
  const emptyEl = $('#productEmpty');
  const imgEl = $('#pImage');
  const metaEl = $('#pMeta');
  const boxEl = $('#productBox');

  if (boxEl) boxEl.hidden = false;

  if (has) {
    if (emptyEl) emptyEl.style.display = 'none';
    if (imgEl) {
      imgEl.src = imgUrl(current.images && current.images[0]);
      imgEl.style.display = 'block';
    }
    if (metaEl) {
      const variants = current.tiers && current.tiers.length ? `${current.models.length} phân loại` : 'Không phân loại';
      const warn = current.categories && current.categories.length ? '' : ' · ⚠ thiếu ngành hàng';
      metaEl.textContent = `ID ${current.itemId} · ${(current.images || []).length} ảnh · ${variants}${warn}`;
      metaEl.style.display = 'block';
    }

    if (!current.originalName) current.originalName = current.name || '';
    if (!current.originalDescription) current.originalDescription = current.description || '';

    const titleInp = $('#productTitleInput');
    if (titleInp && document.activeElement !== titleInp) {
      titleInp.value = current.name || '';
    }
    const descInp = $('#productDescInput');
    if (descInp && document.activeElement !== descInp) {
      descInp.value = current.description || '';
    }
    const titleCount = $('#titleCharCount');
    if (titleCount) titleCount.textContent = `${(current.name || '').length}/120`;
    const descCount = $('#descCharCount');
    if (descCount) descCount.textContent = `${(current.description || '').length} ký tự`;
  } else {
    if (imgEl) imgEl.style.display = 'none';
    if (metaEl) metaEl.style.display = 'none';
    if (emptyEl) {
      emptyEl.style.display = 'block';
      emptyEl.innerHTML = currentItemId
        ? `Chưa có dữ liệu sản phẩm <b>${currentItemId}</b>. Hãy mở lại trang sản phẩm trên <b>shopee.vn</b> rồi bấm F5.<br><button id="btnFetchActiveTab" style="margin-top:6px; display:inline-flex; align-items:center; gap:6px; padding:4px 10px; font-size:11.5px; background:#ea580c; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🔄 Bấm để tải lại trang Shopee & lấy dữ liệu</button>`
        : `💡 Mở một trang sản phẩm trên <b>shopee.vn</b> (F5) để tự động lấy ảnh và thông tin gốc. Hoặc bạn có thể dán / nhập trực tiếp Tiêu đề &amp; Mô tả bên dưới để <b>Viết lại AI</b> và <b>Điền vào SP</b>:`;
      const fBtn = $('#btnFetchActiveTab');
      if (fBtn) {
        fBtn.onclick = async () => {
          fBtn.disabled = true;
          fBtn.textContent = '⏳ Đang tải lại...';
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id) {
            chrome.tabs.reload(tab.id);
          }
        };
      }
    }
  }

  updateCloneButtonUI();
  renderPrices();
  renderAiImages();
  renderCover();
  renderMedia();
  renderScanButton();
  renderVariations();
}

// ---------- Danh sách phân loại & Điền chi tiết SKU ----------


// ---------- Gợi ý SKU từ Google Sheet DS_SP ----------

function getEffectiveMaGian() {
  const inp = $('#cloneMaGian');
  const val = (inp ? inp.value : '') || currentMaGian || '';
  return val.trim();
}

let dsSpList = [];
let isFetchingDsSp = false;
let skuDropdownEl = null;
let activeSkuInput = null;
let highlightedIndex = -1;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSearchStr(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}

function parseDsSpRows(values) {
  if (!Array.isArray(values) || values.length <= 1) return [];
  const header = (values[0] || []).map((h) => String(h || '').trim().toLowerCase());

  let idCtIdx = header.findIndex(
    (h) => h === 'id_sp_ct' || h === 'id_sp_con' || h.includes('id_sp_ct') || h.includes('id_sp_con')
  );
  if (idCtIdx === -1) idCtIdx = 0;

  let idSpIdx = header.findIndex(
    (h) => h === 'id_sp' || h === 'ma sp' || h === 'mã sp' || (h.includes('id_sp') && !h.includes('ct') && !h.includes('con'))
  );
  if (idSpIdx === -1) idSpIdx = 1;

  let tenIdx = header.findIndex(
    (h) => h === 'ten_sp' || h === 'tên sp' || h.includes('ten_sp') || h.includes('tên')
  );
  if (tenIdx === -1) tenIdx = 2;

  let giaBanIdx = header.findIndex(
    (h) => h === 'gia_ban' || h === 'giá bán' || h.includes('gia_ban') || h.includes('giá')
  );
  if (giaBanIdx === -1) giaBanIdx = 4;

  const list = [];
  const seen = new Set();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;

    const skuCt = String(row[idCtIdx] || '').trim();
    const skuParent = String(row[idSpIdx] || '').trim();
    const name = String(row[tenIdx] || '').trim();
    const price = String(row[giaBanIdx] || '').trim();

    const primarySku = skuCt || skuParent;
    if (primarySku && !seen.has(primarySku.toUpperCase())) {
      seen.add(primarySku.toUpperCase());
      list.push({
        sku: primarySku,
        name,
        parentSku: skuParent,
        price
      });
    }

    if (skuParent && skuParent !== primarySku && !seen.has(skuParent.toUpperCase())) {
      seen.add(skuParent.toUpperCase());
      list.push({
        sku: skuParent,
        name: name ? `${name} (Mã chung)` : '',
        parentSku: skuParent,
        price
      });
    }
  }

  return list;
}

async function loadDsSpData(forceReload = false) {
  if (isFetchingDsSp) return dsSpList;
  try {
    if (!forceReload && (!dsSpList || dsSpList.length === 0)) {
      const stored = await chrome.storage.local.get(['ds_sp_cache_data']);
      if (stored && Array.isArray(stored.ds_sp_cache_data) && stored.ds_sp_cache_data.length > 1) {
        dsSpList = parseDsSpRows(stored.ds_sp_cache_data);
      }
    }

    if (forceReload || !dsSpList || dsSpList.length === 0) {
      isFetchingDsSp = true;
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_DS_SP' }, resolve);
      });
      isFetchingDsSp = false;
      if (res && res.ok && Array.isArray(res.values) && res.values.length > 1) {
        dsSpList = parseDsSpRows(res.values);
        chrome.storage.local.set({ ds_sp_cache_data: res.values });
      }
    }
  } catch (err) {
    isFetchingDsSp = false;
    console.warn('Lỗi tải DS_SP cho gợi ý SKU:', err);
  }
  return dsSpList;
}

function filterDsSpSuggestions(query, limit = 25) {
  if (!dsSpList || dsSpList.length === 0) return [];
  const mg = getEffectiveMaGian();
  let q = normalizeSearchStr(query);
  if (mg) {
    const mgNorm = normalizeSearchStr(mg);
    if (q.endsWith('-' + mgNorm)) {
      q = q.slice(0, -(mgNorm.length + 1)).trim();
    }
  }

  if (!q) {
    return dsSpList.slice(0, limit);
  }

  const results = [];
  for (const item of dsSpList) {
    const skuNorm = normalizeSearchStr(item.sku);
    const nameNorm = normalizeSearchStr(item.name);
    const parentNorm = normalizeSearchStr(item.parentSku);
    if (skuNorm.includes(q) || nameNorm.includes(q) || parentNorm.includes(q)) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }
  return results;
}

function getOrCreateSkuDropdown() {
  if (skuDropdownEl && document.body.contains(skuDropdownEl)) return skuDropdownEl;
  skuDropdownEl = document.createElement('div');
  skuDropdownEl.id = 'skuSuggestDropdown';
  skuDropdownEl.className = 'sku-autocomplete-dropdown';
  skuDropdownEl.hidden = true;
  document.body.appendChild(skuDropdownEl);
  return skuDropdownEl;
}

function positionSkuDropdown(input) {
  if (!skuDropdownEl || !input) return;
  const rect = input.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    hideSkuDropdown();
    return;
  }
  const dropdownWidth = Math.max(rect.width, 280);
  let left = rect.left + window.scrollX;
  if (left + dropdownWidth > window.innerWidth - 10) {
    left = Math.max(10, window.innerWidth - dropdownWidth - 10);
  }
  let top = rect.bottom + window.scrollY + 2;
  const ddHeight = skuDropdownEl.offsetHeight || 200;
  if (rect.bottom + ddHeight > window.innerHeight && rect.top > ddHeight) {
    top = rect.top + window.scrollY - ddHeight - 2;
  }
  skuDropdownEl.style.left = `${left}px`;
  skuDropdownEl.style.top = `${top}px`;
  skuDropdownEl.style.width = `${dropdownWidth}px`;
}

function highlightSkuItem(index) {
  if (!skuDropdownEl) return;
  const items = skuDropdownEl.querySelectorAll('.sku-suggest-item');
  items.forEach((it, idx) => {
    if (idx === index) {
      it.classList.add('active');
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.classList.remove('active');
    }
  });
  highlightedIndex = index;
}

function hideSkuDropdown() {
  if (skuDropdownEl) {
    skuDropdownEl.hidden = true;
  }
  activeSkuInput = null;
  highlightedIndex = -1;
}

function selectSkuSuggestion(item, input) {
  if (!item || !input) return;
  const maGian = getEffectiveMaGian();
  let finalSku = item.sku;
  if (maGian) {
    const suffix = `-${maGian.toLowerCase()}`;
    if (!finalSku.toLowerCase().endsWith(suffix)) {
      finalSku = `${finalSku}-${maGian}`;
    }
  }

  input.value = finalSku;

  const key = input.dataset.key;
  if (key) {
    currentModelSkus[key] = finalSku;
    opts.modelSkus = currentModelSkus;
    if (current) {
      chrome.storage.local.set({ [`modelSkus_${current.itemId}`]: currentModelSkus });
    }
  }

  if (input.id === 'parentSkuInput' || input.dataset.opt === 'parentSku') {
    opts.parentSku = finalSku;
    chrome.storage.local.set({ [OPTS_KEY]: opts });
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  hideSkuDropdown();
  input.focus();
  log(`Đã chọn SKU: ${finalSku}`, 'ok');
}

function renderSkuSuggestions(items, input) {
  const dd = getOrCreateSkuDropdown();
  highlightedIndex = -1;
  const maGian = getEffectiveMaGian();

  if (!items || items.length === 0) {
    dd.innerHTML = `
      <div class="sku-suggest-header">
        <span>Gợi ý từ DS_SP (${dsSpList.length} SP)</span>
        ${maGian ? `<span style="color: #047857;">Mã gian: -${escapeHtml(maGian)}</span>` : '<span style="color: #ea580c;">Chưa có mã gian</span>'}
      </div>
      <div style="padding: 10px; color: #94a3b8; font-size: 11px; text-align: center;">Không tìm thấy SKU phù hợp trong DS_SP</div>
    `;
    dd.hidden = false;
    positionSkuDropdown(input);
    return;
  }

  const gianSuffix = maGian ? `-${maGian}` : '';
  let itemsHtml = '';
  items.forEach((item, idx) => {
    let finalPreview = item.sku;
    if (maGian && !finalPreview.toLowerCase().endsWith(gianSuffix.toLowerCase())) {
      finalPreview = `${finalPreview}${gianSuffix}`;
    }

    const priceText = item.price ? ` · ${fmtMoney(Number(String(item.price).replace(/[^\d]/g, '')) || 0) || item.price}` : '';

    itemsHtml += `
      <div class="sku-suggest-item" data-index="${idx}">
        <div class="sku-suggest-top">
          <span class="sku-suggest-sku">${escapeHtml(item.sku)}</span>
          ${maGian ? `<span class="sku-suggest-badge" title="Tự động gắn mã gian">➔ ${escapeHtml(finalPreview)}</span>` : ''}
        </div>
        ${item.name ? `<div class="sku-suggest-name">${escapeHtml(item.name)}${priceText}</div>` : ''}
      </div>
    `;
  });

  dd.innerHTML = `
    <div class="sku-suggest-header">
      <span>Gợi ý DS_SP (${items.length}/${dsSpList.length})</span>
      ${maGian ? `<span style="color: #047857; font-weight: bold;">Mã gian: -${escapeHtml(maGian)}</span>` : '<span style="color: #ea580c;">Chưa điền mã gian</span>'}
    </div>
    ${itemsHtml}
  `;
  dd.hidden = false;
  positionSkuDropdown(input);

  dd.querySelectorAll('.sku-suggest-item').forEach((el, idx) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectSkuSuggestion(items[idx], input);
    });
    el.addEventListener('mouseenter', () => {
      highlightSkuItem(idx);
    });
  });
}

function handleSkuInputKeydown(e, items, input) {
  const dd = getOrCreateSkuDropdown();
  if (dd.hidden || !items || items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightSkuItem(highlightedIndex + 1 < items.length ? highlightedIndex + 1 : 0);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightSkuItem(highlightedIndex - 1 >= 0 ? highlightedIndex - 1 : items.length - 1);
  } else if (e.key === 'Enter') {
    if (highlightedIndex >= 0 && items[highlightedIndex]) {
      e.preventDefault();
      selectSkuSuggestion(items[highlightedIndex], input);
    }
  } else if (e.key === 'Escape') {
    hideSkuDropdown();
  }
}

function attachSkuAutocomplete(input) {
  if (!input || input._skuAutocompleteAttached) return;
  input._skuAutocompleteAttached = true;
  input.setAttribute('autocomplete', 'off');

  let currentFilteredItems = [];

  const updateSuggestions = async () => {
    if (!dsSpList || dsSpList.length === 0) {
      await loadDsSpData();
    }
    const val = input.value.trim();
    currentFilteredItems = filterDsSpSuggestions(val);
    activeSkuInput = input;
    renderSkuSuggestions(currentFilteredItems, input);
  };

  input.addEventListener('focus', () => {
    updateSuggestions();
  });

  input.addEventListener('input', () => {
    updateSuggestions();
  });

  input.addEventListener('keydown', (e) => {
    handleSkuInputKeydown(e, currentFilteredItems, input);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (activeSkuInput === input) {
        hideSkuDropdown();
      }
    }, 200);
  });
}

document.addEventListener('mousedown', (e) => {
  if (!skuDropdownEl || skuDropdownEl.hidden) return;
  if (activeSkuInput && (activeSkuInput === e.target || activeSkuInput.contains(e.target))) return;
  if (skuDropdownEl.contains(e.target)) return;
  hideSkuDropdown();
});

window.addEventListener('scroll', () => {
  if (activeSkuInput && skuDropdownEl && !skuDropdownEl.hidden) {
    positionSkuDropdown(activeSkuInput);
  }
}, true);

window.addEventListener('resize', () => {
  if (activeSkuInput && skuDropdownEl && !skuDropdownEl.hidden) {
    positionSkuDropdown(activeSkuInput);
  }
});

// Giá tự tính của phân loại khi không sửa tay, khớp với giá gửi lên Shopee
function autoVariantPrice(m) {
  const base = (opts.usePriceBefore && m.priceBefore) || m.price || current?.price;
  return applyPrice(base, opts.priceChange) || base || 0;
}

function refreshVariantPricePlaceholders() {
  if (!current?.models) return;
  for (const m of current.models) {
    const inp = document.querySelector(`.var-price-input[data-key="${m.tierIndex.join('-')}"]`);
    if (inp) inp.placeholder = String(autoVariantPrice(m));
  }
}

const saveVariantEdits = () => {
  opts.modelNames = currentModelNames;
  opts.modelPrices = currentModelPrices;
  if (current) {
    chrome.storage.local.set({
      [`modelNames_${current.itemId}`]: currentModelNames,
      [`modelPrices_${current.itemId}`]: currentModelPrices
    });
  }
};

// Shopee từ chối tên trùng trong cùng nhóm, tên quá 20 ký tự và giá dưới 1.000đ
function variantEditError() {
  for (const [gi, t] of (current?.tiers || []).slice(0, 2).entries()) {
    const seen = new Set();
    for (const [oi, o] of t.options.entries()) {
      const name = (String(currentModelNames[`${gi}-${oi}`] || '').trim() || o).toLowerCase();
      if (seen.has(name)) return `Tên phân loại bị trùng: "${name}"`;
      seen.add(name);
    }
  }
  const low = Object.values(currentModelPrices).find((p) => p && Number(p) < 1000);
  return low ? `Giá phân loại phải từ 1.000đ (đang nhập ${low})` : '';
}

function getModelDisplayName(m, tiers) {
  const edited = (m.tierIndex || []).some((ti, gi) => String(currentModelNames[`${gi}-${ti}`] || '').trim());
  if (edited && tiers && tiers.length) {
    return m.tierIndex.map((ti, gi) => String(currentModelNames[`${gi}-${ti}`] || '').trim() || tiers[gi]?.options?.[ti] || '').filter(Boolean).join(' - ');
  }
  if (m.name && m.name.trim()) return m.name.trim();
  if (tiers && tiers.length) {
    const parts = (m.tierIndex || []).map((ti, gi) => {
      return (tiers[gi] && tiers[gi].options && tiers[gi].options[ti]) || '';
    }).filter(Boolean);
    if (parts.length) return parts.join(' - ');
  }
  return `Phân loại ${(m.tierIndex || []).join('-') || '1'}`;
}

function getModelImage(m, tiers) {
  if (tiers && tiers[0] && Array.isArray(tiers[0].images) && m.tierIndex && m.tierIndex.length > 0) {
    const id = tiers[0].images[m.tierIndex[0]];
    if (id) return imgUrl(id);
  }
  return '';
}

async function renderVariations() {
  const section = $('#variationSection');
  const countEl = $('#varCount');
  const listEl = $('#variationList');
  if (!section || !listEl) return;

  const hasVariants = Boolean(current && current.tiers && current.tiers.length > 0 && current.models && current.models.length > 0);
  section.hidden = !hasVariants;
  if (!hasVariants) {
    listEl.innerHTML = '';
    return;
  }

  const storageKey = `modelSkus_${current.itemId}`;
  const saved = await chrome.storage.local.get(storageKey);
  currentModelSkus = saved[storageKey] || opts.modelSkus || {};
  const namesKey = `modelNames_${current.itemId}`;
  const pricesKey = `modelPrices_${current.itemId}`;
  const savedEdits = await chrome.storage.local.get([namesKey, pricesKey]);
  currentModelNames = savedEdits[namesKey] || {};
  currentModelPrices = savedEdits[pricesKey] || {};
  opts.modelNames = currentModelNames;
  opts.modelPrices = currentModelPrices;

  const models = current.models;
  if (countEl) countEl.textContent = String(models.length);

  listEl.innerHTML = '';
  models.forEach((m) => {
    const key = m.tierIndex.join('-');
    const name = getModelDisplayName(m, current.tiers);
    const img = getModelImage(m, current.tiers);
    const stockStr = m.stock != null ? String(m.stock) : '0';
    const val = currentModelSkus[key] || '';

    const row = document.createElement('div');
    row.className = 'var-row';
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-bottom: 1px solid #f1f5f9; gap: 8px;';

    const leftBox = document.createElement('div');
    leftBox.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;';

    if (img) {
      const im = document.createElement('img');
      im.src = img + '_tn';
      im.alt = '';
      im.style.cssText = 'width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; flex-shrink: 0;';
      leftBox.appendChild(im);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 14px; flex-shrink: 0;';
      placeholder.textContent = '🏷️';
      leftBox.appendChild(placeholder);
    }

    const infoBox = document.createElement('div');
    infoBox.style.cssText = 'min-width: 0; flex: 1;';

    // Tên thuộc về từng lựa chọn của nhóm, nên sửa ở một dòng thì các dòng cùng lựa chọn đổi theo
    const nameBox = document.createElement('div');
    nameBox.style.cssText = 'display: flex; gap: 4px; margin-bottom: 3px;';
    m.tierIndex.slice(0, 2).forEach((ti, gi) => {
      const optKey = `${gi}-${ti}`;
      const original = current.tiers[gi]?.options?.[ti] || '';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'var-name-input';
      nameInput.dataset.optKey = optKey;
      nameInput.maxLength = 20;
      nameInput.placeholder = original;
      nameInput.title = `Tên gốc: ${original}. Tối đa 20 ký tự.`;
      nameInput.value = currentModelNames[optKey] || '';
      nameInput.style.cssText = 'flex: 1; min-width: 0; margin: 0; padding: 3px 5px; font-size: 11px; font-weight: 600; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff;';
      nameInput.addEventListener('input', () => {
        currentModelNames[optKey] = nameInput.value;
        document.querySelectorAll('.var-name-input').forEach((other) => {
          if (other !== nameInput && other.dataset.optKey === optKey) other.value = nameInput.value;
        });
        saveVariantEdits();
      });
      nameBox.appendChild(nameInput);
    });

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 10px; color: #64748b;';
    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.inputMode = 'numeric';
    priceInput.className = 'var-price-input';
    priceInput.dataset.key = key;
    priceInput.placeholder = String(autoVariantPrice(m));
    priceInput.title = 'Giá riêng của phân loại, tính bằng đồng. Để trống thì dùng giá tự tính theo Tăng giảm giá.';
    priceInput.value = currentModelPrices[key] || '';
    priceInput.style.cssText = 'width: 80px; margin: 0; padding: 3px 5px; font-size: 11px; font-weight: 600; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff;';
    priceInput.addEventListener('input', () => {
      priceInput.value = priceInput.value.replace(/\D/g, '');
      if (priceInput.value) currentModelPrices[key] = Number(priceInput.value);
      else delete currentModelPrices[key];
      saveVariantEdits();
    });
    metaEl.append('Giá', priceInput, `đ · Kho: ${stockStr}`);

    infoBox.appendChild(nameBox);
    infoBox.appendChild(metaEl);
    leftBox.appendChild(infoBox);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'var-sku-input';
    input.dataset.key = key;
    input.placeholder = `SKU ${name}...`;
    input.value = val;
    input.style.cssText = 'width: 150px; margin: 0; padding: 4px 6px; font-size: 11px; font-weight: bold; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff;';
    input.addEventListener('input', () => {
      currentModelSkus[key] = input.value.trim();
      opts.modelSkus = currentModelSkus;
      if (current) {
        chrome.storage.local.set({ [`modelSkus_${current.itemId}`]: currentModelSkus });
      }
    });

    row.appendChild(leftBox);
    row.appendChild(input);
    listEl.appendChild(row);
    attachSkuAutocomplete(input);
  });
}

// ---------- Ảnh & Video của sản phẩm nguồn ----------

const fileSlug = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
  .replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'file';

async function downloadUrl(url, fileName) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

const MEDIA_GROUPS = [
  ['main', '📷 Ảnh sản phẩm', 'anh'],
  ['variation', '🎨 Phân loại', 'phan_loai'],
  ['description', '📝 Mô tả', 'mo_ta'],
  ['video', '🎬 Video', 'video']
];

const mediaFileName = (m, i) => {
  const prefix = (MEDIA_GROUPS.find((g) => g[0] === m.group) || [])[2] || 'file';
  return `${fileSlug(current.name)}_${prefix}_${String(i + 1).padStart(2, '0')}_${fileSlug(m.label)}.${m.type === 'video' ? 'mp4' : 'jpg'}`;
};

function mediaItem(m, i) {
  const box = document.createElement('div');
  box.className = 'media-item';
  let el;
  if (m.type === 'video') {
    el = document.createElement('video');
    el.src = m.url;
    el.controls = true;
    el.preload = 'metadata';
    if (m.thumb) el.poster = m.thumb;
  } else {
    el = document.createElement('img');
    el.src = m.url + '_tn';
    el.loading = 'lazy';
    el.title = 'Bấm để xem ảnh gốc';
    el.addEventListener('click', () => chrome.tabs.create({ url: m.url }));
  }
  const cap = document.createElement('div');
  cap.className = 'cap';
  cap.textContent = m.label;
  cap.title = m.label;
  const acts = document.createElement('div');
  acts.className = 'acts';
  const open = document.createElement('a');
  open.textContent = 'Mở';
  open.addEventListener('click', () => chrome.tabs.create({ url: m.url }));
  const dl = document.createElement('a');
  dl.textContent = 'Tải';
  dl.addEventListener('click', () => downloadUrl(m.url, mediaFileName(m, i)).catch((e) => log(`Không tải được ${m.label}: ${e.message}`, 'err')));
  acts.append(open, dl);
  box.append(el, cap, acts);
  return box;
}

function renderMedia() {
  const media = (current && current.media) || [];
  $('#mediaCard').hidden = !media.length;
  if (!media.length) return;
  const nImg = media.filter((m) => m.type === 'image').length;
  const nVid = media.length - nImg;
  $('#mediaCount').textContent = `(${nImg} ảnh${nVid ? `, ${nVid} video` : ''})`;

  const container = $('#mediaGrid');
  container.innerHTML = '';
  MEDIA_GROUPS.forEach(([key, title]) => {
    const items = media.filter((m) => m.group === key);
    if (!items.length) return;
    const group = document.createElement('div');
    group.className = 'media-group';
    const head = document.createElement('div');
    head.className = 'media-group-head';
    const label = document.createElement('span');
    label.textContent = `${title} (${items.length})`;
    const dlGroup = document.createElement('a');
    dlGroup.textContent = '⬇ Tải nhóm này';
    dlGroup.addEventListener('click', () => downloadAllMedia(items, dlGroup));
    const headActs = document.createElement('span');
    headActs.style.cssText = 'display: inline-flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end;';
    if (key !== 'video') {
      const toMain = document.createElement('a');
      toMain.textContent = 'Đưa vào ảnh chính';
      toMain.title = 'Đưa ảnh nhóm này vào ô Ảnh sản phẩm của trang sửa sản phẩm trên Shopee';
      toMain.addEventListener('click', () => pushImagesToEditPage(items, 'UPLOAD_PRODUCT_IMAGES', toMain));
      const toDesc = document.createElement('a');
      toDesc.textContent = 'Đưa vào mô tả';
      toDesc.title = 'Đưa ảnh nhóm này vào phần Mô tả của trang sửa sản phẩm trên Shopee';
      toDesc.addEventListener('click', () => pushImagesToEditPage(items, 'UPLOAD_DESCRIPTION_IMAGES', toDesc));
      headActs.append(toMain, toDesc);
    }
    headActs.append(dlGroup);
    head.append(label, headActs);
    const grid = document.createElement('div');
    grid.className = 'media-grid';
    // Video xếp sát lề phải, bên trái là phần gắn video vào sản phẩm có sẵn trong shop
    if (key === 'video') grid.style.cssText = 'grid-template-columns: repeat(auto-fit, 110px); justify-content: end; flex: 0 0 auto; margin-top: 0;';
    items.forEach((m, i) => grid.appendChild(mediaItem(m, i)));
    if (key === 'video') {
      const body = document.createElement('div');
      body.style.cssText = 'display: flex; gap: 10px; align-items: flex-start; margin-top: 6px;';
      body.append(videoSyncPanel(), grid);
      group.append(head, body);
    } else {
      group.append(head, grid);
    }
    container.appendChild(group);
  });
}

// Tab sửa/đăng sản phẩm dạng banhang.shopee.vn/portal/product/56214022220 hoặc /new
async function findProductEditTab() {
  const tabs = await chrome.tabs.query({ url: 'https://banhang.shopee.vn/portal/product/*' });
  const isEdit = (t) => /\/portal\/product\/(\d+|new)(?:[/?#]|$)/.test(t.url || '');
  return tabs.filter(isEdit).sort((a, b) => (b.active - a.active) || ((b.lastAccessed || 0) - (a.lastAccessed || 0)))[0] || null;
}

async function pushImagesToEditPage(items, type, btn) {
  if (btn.dataset.busy) return;
  const text = btn.textContent;
  btn.dataset.busy = '1';
  try {
    const tab = await findProductEditTab();
    if (!tab) throw new Error('Chưa mở trang sửa sản phẩm (banhang.shopee.vn/portal/product/...)');
    btn.textContent = 'Đang đưa...';
    const files = await Promise.all(items.map(async (m, i) => {
      const r = await fetch(m.url);
      if (!r.ok) throw new Error(`Không tải được ${m.label} (HTTP ${r.status})`);
      const blob = await r.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Không đọc được ${m.label}`));
        reader.readAsDataURL(blob);
      });
      return { name: `image-${i + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`, type: blob.type || 'image/jpeg', lastModified: Date.now(), dataUrl };
    }));
    const res = await chrome.tabs.sendMessage(tab.id, { type, files });
    if (res && (res.ok === false || res.success === false || res.error)) throw new Error(res.error || res.message || 'Trang Shopee không nhận ảnh');
    await chrome.tabs.update(tab.id, { active: true });
    btn.textContent = 'Đã đưa!';
    log(`Đã đưa ${files.length} ảnh vào trang sửa sản phẩm.`, 'ok');
  } catch (e) {
    btn.textContent = 'Lỗi';
    log(`Không đưa được ảnh: ${e.message}`, 'err');
  } finally {
    delete btn.dataset.busy;
    setTimeout(() => { btn.textContent = text; }, 1500);
  }
}

// ---------- Gắn video vào sản phẩm có sẵn (gộp từ ShopeeVideoSync) ----------

let videoTarget = null;

function videoSyncPanel() {
  const box = document.createElement('div');
  box.style.cssText = 'flex: 1; min-width: 0; font-size: 11px;';
  box.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">Gắn video này vào sản phẩm có sẵn trong shop</div>
    <form class="vs-search" style="display: flex; gap: 4px;">
      <input class="vs-q" placeholder="Tên hoặc ID sản phẩm..." style="flex: 1; min-width: 0; margin: 0; padding: 4px 6px; font-size: 11px;">
      <button type="submit" class="btn" style="padding: 3px 8px; font-size: 11px;">Tìm</button>
    </form>
    <div class="vs-results" style="max-height: 150px; overflow-y: auto; margin-top: 4px;"></div>
    <div class="vs-target" hidden style="margin-top: 4px; padding: 4px; border: 1px solid #2d8cf0; border-radius: 4px; background: #eef6ff;"></div>
    <label style="display: flex; align-items: center; gap: 4px; margin: 4px 0;"><input type="checkbox" class="vs-replace"> Thay thế video đang có (không chọn = thêm vào)</label>
    <button type="button" class="btn primary vs-sync" disabled style="width: 100%; padding: 5px; font-size: 12px;">🎬 Đồng bộ Video</button>`;
  const results = box.querySelector('.vs-results');
  const targetEl = box.querySelector('.vs-target');
  const syncBtn = box.querySelector('.vs-sync');
  const videos = (current && current.videos) || [];
  const refresh = () => { syncBtn.disabled = !videoTarget || !videos.length || !!syncBtn.dataset.busy; };
  const showTarget = () => {
    targetEl.hidden = !videoTarget;
    if (videoTarget) targetEl.textContent = `Đã chọn: [${videoTarget.itemId}] ${videoTarget.name}`;
    refresh();
  };

  box.querySelector('.vs-search').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = box.querySelector('.vs-q').value.trim();
    if (!q) return;
    results.textContent = 'Đang tìm...';
    try {
      const list = await shopProducts.search({ keyword: q, searchType: /^\d+$/.test(q) ? 'id' : 'name' });
      results.innerHTML = '';
      if (!list.length) results.textContent = 'Không tìm thấy sản phẩm nào.';
      list.forEach((p) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.style.cssText = 'display: flex; gap: 6px; align-items: center; width: 100%; padding: 3px; border: 0; border-bottom: 1px solid #f0f0f0; background: none; text-align: left; cursor: pointer; font-size: 11px;';
        if (p.cover) {
          const img = document.createElement('img');
          img.src = imgUrl(p.cover) + '_tn';
          img.alt = '';
          img.style.cssText = 'width: 28px; height: 28px; object-fit: cover; border-radius: 3px; flex: 0 0 auto;';
          row.appendChild(img);
        }
        const name = document.createElement('span');
        name.textContent = `[${p.itemId}] ${p.name}`;
        row.appendChild(name);
        row.addEventListener('click', () => {
          videoTarget = p;
          results.innerHTML = '';
          showTarget();
        });
        results.appendChild(row);
      });
    } catch (err) {
      results.textContent = '';
      log('Lỗi tìm sản phẩm: ' + err.message, 'err');
    }
  });

  syncBtn.addEventListener('click', async () => {
    if (syncBtn.dataset.busy || !videoTarget) return;
    syncBtn.dataset.busy = '1';
    refresh();
    try {
      const { changed, count, confirmed } = await syncVideos(videoTarget.itemId, videos, {
        replace: box.querySelector('.vs-replace').checked,
        log: (t) => log(t)
      });
      if (!changed) log('Sản phẩm này đã có video đó rồi, không cần đồng bộ.', 'warn');
      else if (confirmed === false) log('Shopee báo thành công nhưng đọc lại không thấy video. Hãy mở sản phẩm để kiểm tra.', 'warn');
      else log(`✔ Đã đồng bộ video, sản phẩm hiện có ${count} video.`, 'ok');
      if (changed) chrome.tabs.create({ url: `https://banhang.shopee.vn/portal/product/${videoTarget.itemId}` });
    } catch (e) {
      log('✖ Đồng bộ video: ' + e.message, 'err');
    } finally {
      delete syncBtn.dataset.busy;
      refresh();
    }
  });

  showTarget();
  return box;
}

async function downloadAllMedia(list = null, btnEl = null) {
  const media = list || (current && current.media) || [];
  if (!media.length) return;
  const btn = btnEl || $('#btnDlAll');
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const btnText = btn.textContent;
  btn.disabled = true;
  let ok = 0;
  for (let i = 0; i < media.length; i++) {
    btn.textContent = `Đang tải ${i + 1}/${media.length}...`;
    try {
      await downloadUrl(media[i].url, mediaFileName(media[i], i));
      ok++;
    } catch (e) {
      log(`Không tải được ${media[i].label}: ${e.message}`, 'err');
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  btn.textContent = btnText;
  btn.disabled = false;
  delete btn.dataset.busy;
  log(`Đã tải ${ok}/${media.length} file ảnh/video.`, ok === media.length ? 'ok' : 'warn');
}

// ---------- AI ảnh bìa ----------

function renderAiImages() {
  const url1 = String(opts.aiImage1 || '').trim();
  $('#aiImg1').hidden = !url1;
  $('#aiImg1Empty').hidden = !!url1;
  if (url1) $('#aiImg1').src = url1;

  const imgs = current ? current.images : [];
  if (aiImageIndex >= imgs.length) aiImageIndex = 0;
  const url2 = imgs.length ? imgUrl(imgs[aiImageIndex]) : '';
  $('#aiImg2').hidden = !url2;
  $('#aiImg2Empty').hidden = !!url2;
  if (url2) $('#aiImg2').src = url2;

  const thumbs = $('#aiThumbs');
  thumbs.innerHTML = '';
  if (imgs.length > 1) {
    imgs.forEach((id, i) => {
      const im = document.createElement('img');
      im.src = imgUrl(id) + '_tn';
      im.title = `Chọn ảnh ${i + 1} làm ảnh 2`;
      if (i === aiImageIndex) im.className = 'sel';
      im.addEventListener('click', () => {
        aiImageIndex = i;
        renderAiImages();
      });
      thumbs.appendChild(im);
    });
  }
}

async function urlToDataUrl(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch (err) {
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'sclFetchImageDataUrl', url }, (r) => {
          if (chrome.runtime.lastError || !r || !r.dataUrl) resolve(null);
          else resolve(r.dataUrl);
        });
      });
      if (res) return res;
    } catch (_) {}
    throw err;
  }
}

async function openAi(target, auto = false) {
  if (!current) return log('Chưa có sản phẩm nguồn.', 'err');
  const buttons = ['#btnAuto', '#btnOpenAi'].map((s) => $(s)).filter(Boolean);
  buttons.forEach((b) => { b.disabled = true; });
  try {
    const images = [];
    const url1 = String(opts.aiImage1 || '').trim();
    if (url1) {
      try {
        images.push({ name: '1_anh_mau.jpg', dataUrl: await urlToDataUrl(url1) });
      } catch (e) {
        log('Không tải được ảnh 1 từ link: ' + e.message, 'warn');
      }
    } else {
      log('Chưa có link ảnh 1, chỉ gửi ảnh sản phẩm.', 'warn');
    }
    try {
      images.push({ name: '2_anh_san_pham.jpg', dataUrl: await urlToDataUrl(imgUrl(current.images[aiImageIndex])) });
    } catch (e) {
      log('Không tải được ảnh sản phẩm: ' + e.message, 'warn');
    }

    const prompt = String(opts.aiPrompt || DEFAULT_PROMPT).replace(/\{ten_sp\}/g, current.name).trim();
    try { await navigator.clipboard.writeText(prompt); } catch (e) { /* không bắt buộc */ }

    // Mở tab trước để gắn lệnh với đúng tab này (tab AI cũ đang mở sẽ không giành lệnh)
    const tab = await chrome.tabs.create({ url: AI_TARGETS[target] });
    await chrome.storage.local.set({
      pendingAiPayload: { target, prompt, images, timestamp: Date.now(), autoSend: !!auto, tabId: tab.id },
      aiLastProductId: current.itemId,
      aiAutoFlow: auto ? { productId: current.itemId, timestamp: Date.now() } : null
    });
    lastAiStatusTs = 0;
    clearTimeout(aiWatchdog);
    aiWatchdog = setTimeout(() => {
      if (!lastAiStatusTs) log('Chưa thấy phản hồi từ trang AI sau 60 giây. Kiểm tra tab AI: đã đăng nhập chưa? Thử F5 tab đó.', 'warn');
    }, 60000);
    const aiName = target === 'chatgpt' ? 'ChatGPT' : 'Gemini';
    log(auto
      ? `Đang chạy tự động: mở ${aiName} → gửi → chờ ảnh → sao chép. Đừng đóng Side Panel!`
      : `Đã mở ${aiName} và điền sẵn ảnh + prompt.`);
  } catch (e) {
    log('Lỗi mở AI: ' + e.message, 'err');
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
  }
}

const coverMatches = () => !!(aiCover && aiCover.dataUrl && current
  && (!aiCover.productId || String(aiCover.productId) === current.itemId));

function normalizeImageUrl(url) {
  if (!url) return '';
  url = String(url).trim();
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

function parseCaiDatRows(rows, targetGian) {
  if (!rows || rows.length <= 1) return { coverUrl: '', gianList: [] };
  const headers = (rows[0] || []).map((h) => String(h || '').trim().toLowerCase());

  let gianIdx = headers.findIndex((h) => h === 'gian' || h === 'mã gian' || h === 'ma gian' || h === 'ma_gian' || h === 'magian');
  if (gianIdx === -1) gianIdx = 1;

  let anhIdx = headers.findIndex((h) =>
    h === 'anh_mau' || h === 'anh mau' || h === 'ảnh mẫu' ||
    h === 'anh_bia' || h === 'anh bia' || h === 'ảnh bìa' ||
    h === 'cover' || h.includes('anh_mau') || h.includes('ảnh')
  );
  if (anhIdx === -1) anhIdx = 3;

  const gianList = [];
  let foundCoverUrl = '';
  const cleanTarget = String(targetGian || '').trim().toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const g = String(row[gianIdx] || '').trim();
    if (g && !gianList.includes(g)) gianList.push(g);

    if (cleanTarget && g.toLowerCase() === cleanTarget && !foundCoverUrl) {
      const rawImg = String(row[anhIdx] || '').trim();
      if (rawImg) {
        const firstUrl = rawImg.split(/[\r\n,;|]+/)[0].trim();
        if (firstUrl) foundCoverUrl = normalizeImageUrl(firstUrl);
      }
    }
  }

  if (!foundCoverUrl && !cleanTarget) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const rawImg = String(row[anhIdx] || '').trim();
      if (rawImg) {
        const firstUrl = rawImg.split(/[\r\n,;|]+/)[0].trim();
        if (firstUrl) {
          foundCoverUrl = normalizeImageUrl(firstUrl);
          break;
        }
      }
    }
  }

  return { coverUrl: foundCoverUrl, gianList };
}

async function loadCaiDatCover(gian = currentMaGian, forceReload = false) {
  const statusEl = $('#caiDatCoverStatus');
  if (statusEl) statusEl.innerHTML = '<span class="hint">⏳ Đang đọc Cột D...</span>';

  try {
    if (!cachedCaiDatRows || forceReload) {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_CAI_DAT' }, resolve);
      });
      if (res && res.ok && Array.isArray(res.values)) {
        cachedCaiDatRows = res.values;
      }
    }

    const { coverUrl, gianList } = parseCaiDatRows(cachedCaiDatRows, gian);

    const dl = $('#cloneMaGianList');
    if (dl && gianList.length > 0) {
      dl.innerHTML = gianList.map((g) => `<option value="${g}"></option>`).join('');
    }

    caiDatCoverUrl = coverUrl;

    if (coverUrl) {
      if (statusEl) {
        statusEl.innerHTML = `<span class="green-t" title="${coverUrl}">✔ Ảnh mẫu Cột D (${gian || 'mặc định'}): <a href="${coverUrl}" target="_blank" style="color: var(--green); text-decoration: underline;">Xem</a></span>`;
      }
      // Tự động điền link Cột D vào Ảnh 1 (Ảnh mẫu) cho AI
      opts.aiImage1 = coverUrl;
      const inpAi1 = $('[data-opt="aiImage1"]');
      if (inpAi1) inpAi1.value = coverUrl;
      chrome.storage.local.set({ [OPTS_KEY]: opts });
      renderAiImages();
    } else {
      if (statusEl) {
        statusEl.innerHTML = gian
          ? `<span class="hint" style="color: #ea580c;">⚠ Chưa có ảnh Cột D cho gian "${gian}"</span>`
          : '<span class="hint">Chưa chọn mã gian</span>';
      }
    }

    renderCover();
  } catch (err) {
    console.warn('Lỗi loadCaiDatCover:', err);
    if (statusEl) statusEl.innerHTML = `<span class="hint" style="color: #ef4444;">Lỗi đọc Sheet: ${err.message}</span>`;
  }
}

function renderCover() {
  const isAiCover = coverMatches();
  const coverTextEl = $('#coverText');
  if (isAiCover) {
    $('#coverBox').hidden = false;
    $('#coverEmpty').hidden = true;
    $('#btnClearCover').hidden = false;
    $('#coverImg').src = aiCover.dataUrl;
    if (coverTextEl) coverTextEl.textContent = '✔ Ảnh này (tạo từ AI) sẽ làm ảnh bìa khi sao chép sang Shopee';
  } else {
    $('#coverBox').hidden = true;
    $('#coverEmpty').hidden = false;
    $('#btnClearCover').hidden = true;
  }
  updateCloneButtonUI();
}

async function loadCover() {
  const { aiCoverImage } = await chrome.storage.local.get('aiCoverImage');
  aiCover = aiCoverImage && aiCoverImage.dataUrl ? aiCoverImage : null;
  renderCover();
}

// Nút "⚡ Tự động": khi Gemini gửi ảnh bìa về thì tự sao chép.
async function checkAutoFlow() {
  const { aiAutoFlow: flow } = await chrome.storage.local.get('aiAutoFlow');
  if (!flow || !aiCover) return;
  if (Date.now() - flow.timestamp > AUTO_FLOW_TTL) {
    await chrome.storage.local.remove('aiAutoFlow');
    return;
  }
  if (aiCover.timestamp < flow.timestamp || String(aiCover.productId) !== String(flow.productId)) return;
  if (!current || current.itemId !== String(flow.productId)) await setCurrentItem(String(flow.productId));
  if (!current) return;
  await chrome.storage.local.remove('aiAutoFlow');
  log('Đã có ảnh bìa mới từ Gemini, tự động sao chép sang Shopee...', 'ok');
  setTimeout(runClone, 800);
}

// ---------- Cập nhật nút Sao chép & Điều hướng AI / Đăng ngay ----------

function updateCloneButtonUI() {
  const btn = $('#btnClone');
  if (!btn) return;
  if (!current) {
    btn.disabled = true;
    btn.textContent = 'Sao chép sang Shopee';
    btn.title = 'Mở một trang sản phẩm trên shopee.vn để sao chép';
    btn.style.background = '';
    return;
  }
  if (busy) {
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  if (opts.enableAiCover) {
    if (coverMatches()) {
      btn.textContent = '✔ Sao chép sang Shopee (đã có ảnh bìa AI)';
      btn.title = 'Đã có ảnh bìa AI sẵn sàng: Bấm để đăng sản phẩm sang Shopee ngay';
      btn.style.background = '';
    } else {
      const pName = (opts.aiProvider || 'gemini') === 'chatgpt' ? 'ChatGPT' : 'Gemini';
      btn.textContent = '🪄 Tạo ảnh ' + pName + ' & Đăng Shopee';
      btn.title = 'Đang bật Tạo ảnh AI: Bấm để mở ' + pName + ' tự tạo ảnh bìa rồi tự động đăng sản phẩm sang Shopee';
      btn.style.background = (opts.aiProvider || 'gemini') === 'chatgpt' ? 'linear-gradient(135deg, #10a37f, #059669)' : 'linear-gradient(135deg, #2563eb, #7c3aed)';
    }
  } else {
    btn.textContent = '⚡ Đăng ngay sang Shopee';
    btn.title = 'Không bật Tạo ảnh AI: Bấm để đăng sản phẩm ngay sang Shopee (dùng ảnh Cột D / ảnh sẵn có)';
    btn.style.background = '';
  }
}

async function handleCloneClick() {
  if (busy || !current) return;

  // Nếu có tích chọn tạo ảnh AI VÀ chưa có ảnh AI hợp lệ cho sản phẩm này:
  if (opts.enableAiCover && !coverMatches()) {
    const targetAi = opts.aiProvider || 'gemini';
    const pName = targetAi === 'chatgpt' ? 'ChatGPT' : 'Gemini';
    log('Đang bật Tạo ảnh AI: Mở ' + pName + ' để tự động tạo ảnh bìa...', 'ok');
    const btn = $('#btnClone');
    if (btn) {
      btn.textContent = '⏳ Đang chờ tạo ảnh AI...';
      btn.disabled = true;
    }
    try {
      await openAi(targetAi, true);
    } catch (e) {
      log('Lỗi mở AI: ' + e.message, 'err');
      updateCloneButtonUI();
    }
    return;
  }

  // Nếu không tích chọn tạo ảnh AI (hoặc đã có sẵn ảnh bìa AI):
  // TỰ ĐĂNG LÊN LUÔN!
  await runClone();
}

// ---------- Sao chép ----------

async function runClone() {
  if (busy || !current) return;
  busy = true;
  $('#btnClone').disabled = true;
  $('#btnClone').textContent = '⏳ Đang đăng sản phẩm lên Shopee...';
  try {
    opts.modelSkus = currentModelSkus;
    const editError = variantEditError();
    if (editError) throw new Error(editError);
    const coverDataUrl = coverMatches() ? aiCover.dataUrl : null;

    const { productId } = await cloneProduct(current, opts, {
      coverDataUrl,
      log
    });
    log(`✔ Sao chép thành công! ID sản phẩm mới: ${productId}`, 'ok');
    chrome.tabs.create({ url: `https://banhang.shopee.vn/portal/product/${productId}`, active: false });
  } catch (e) {
    log('✖ ' + e.message, 'err');
  } finally {
    busy = false;
    updateCloneButtonUI();
  }
}

// ---------- Gemini AI Viết lại & Đẩy vào SP (Y hệt module Web bán SP) ----------

// Helper gửi message tới tab Shopee active hoặc mở mới trang thêm SP nếu chưa mở
async function sendMessageToActiveShopeeTab(message) {
    let tab = null;
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTabs && currentTabs[0] && currentTabs[0].url && currentTabs[0].url.includes("shopee.vn/portal/product/")) {
        tab = currentTabs[0];
    } else {
        const allShopeeTabs = await chrome.tabs.query({ url: "*://*.shopee.vn/portal/product/*" });
        if (allShopeeTabs && allShopeeTabs.length > 0) {
            tab = allShopeeTabs.find(t => t.active) || allShopeeTabs[0];
            await chrome.tabs.update(tab.id, { active: true });
        } else {
            tab = await chrome.tabs.create({ url: "https://banhang.shopee.vn/portal/product/new?from=sidebar" });
            await new Promise((r) => setTimeout(r, 3000));
        }
    }

    if (!tab || !tab.id) {
        throw new Error("Không tìm thấy tab trang sản phẩm Shopee đang mở!");
    }

    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response || { ok: true });
            }
        });
    });
}

// Helper gọi XKiro AI API dự phòng với cơ chế thử nhiều model (DeepSeek, Qwen Free, Minimax...)
async function callXkiroDeepseekDirect(promptText) {
    const DEFAULT_XKIRO_KEY = "sk-xt-27e56ff5d3d864c86e4993e85cf95f1695698217d913faf3";
    const res = await new Promise(r => chrome.storage.local.get(["xkiroApiKey", "xkiroModel", "xkiroModels"], r));
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
                    messages: [
                        { role: "user", content: promptText }
                    ]
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

    throw lastError || new Error("Tất cả model XKiro đều không phản hồi");
}

// Helper gọi Gemini API trực tiếp với cơ chế tự động thử model dự phòng và chuyển sang XKiro DeepSeek khi quá tải hoặc hết hạn
async function callGeminiApiDirect(promptText) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["geminiApiKey", "geminiApiKeys", "geminiModel", "geminiModels"], async (res) => {
            const keyInputVal = $('#geminiApiKeyInput')?.value?.trim();
            const primaryKey = keyInputVal || (res.geminiApiKey ? res.geminiApiKey.trim() : "");
            let apiKeys = Array.isArray(res.geminiApiKeys) && res.geminiApiKeys.length > 0 
                ? res.geminiApiKeys.map(k => String(k || "").trim()).filter(Boolean)
                : (primaryKey ? [primaryKey] : []);
            if (primaryKey && !apiKeys.includes(primaryKey)) {
                apiKeys.unshift(primaryKey);
            }

            // Nếu không có Gemini API key -> Tự động chuyển thẳng sang XKiro DeepSeek
            if (apiKeys.length === 0) {
                try {
                    console.log("[AI] Không có Gemini key, tự động dùng XKiro DeepSeek...");
                    const deepseekResult = await callXkiroDeepseekDirect(promptText);
                    return resolve(deepseekResult);
                } catch (deepseekErr) {
                    return reject(new Error("Lỗi gọi AI (DeepSeek): " + deepseekErr.message));
                }
            }

            const modelSelectVal = $('#geminiModelSelect')?.value;
            const configuredModel = modelSelectVal || res.geminiModel || "gemini-2.0-flash";
            const fallbackModels = [
                configuredModel,
                "gemini-2.0-flash",
                "gemini-1.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.0-flash-lite",
                "gemini-2.5-flash",
                "gemini-2.5-pro"
            ];
            const modelsToTry = [...new Set(fallbackModels)];

            let lastError = null;

            for (const apiKey of apiKeys) {
                for (const model of modelsToTry) {
                    try {
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
                        const response = await fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: promptText }] }]
                            })
                        });

                        const data = await response.json();
                        if (!response.ok) {
                            const errMsg = data.error?.message || `Lỗi HTTP ${response.status}`;
                            const isOverloadedOrQuota = 
                                response.status === 503 || 
                                response.status === 429 || 
                                response.status === 500 || 
                                response.status === 400 || 
                                response.status === 403 || 
                                errMsg.toLowerCase().includes("high demand") || 
                                errMsg.toLowerCase().includes("spikes in demand") || 
                                errMsg.toLowerCase().includes("quota") ||
                                errMsg.toLowerCase().includes("resource_exhausted") ||
                                errMsg.toLowerCase().includes("overloaded") ||
                                errMsg.toLowerCase().includes("expired") ||
                                errMsg.toLowerCase().includes("invalid");

                            if (isOverloadedOrQuota) {
                                console.warn(`[Gemini API] Model ${model} quá tải/lỗi (${errMsg}), thử model tiếp theo...`);
                                lastError = new Error(errMsg);
                                await new Promise(r => setTimeout(r, 350));
                                continue;
                            } else {
                                throw new Error(errMsg);
                            }
                        }

                        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (resultText) {
                            return resolve(resultText.trim());
                        } else {
                            throw new Error("AI không trả về nội dung");
                        }
                    } catch (err) {
                        lastError = err;
                        console.warn(`[Gemini API] Lỗi model ${model}:`, err.message);
                        await new Promise(r => setTimeout(r, 350));
                    }
                }
            }

            // Nếu tất cả model/key Gemini đều quá tải hoặc hết hạn -> Tự động kích hoạt XKiro DeepSeek
            console.warn("[Gemini API] Gemini gặp lỗi hoặc hết hạn, tự động chuyển sang XKiro DeepSeek...");
            try {
                const deepseekResult = await callXkiroDeepseekDirect(promptText);
                if (deepseekResult) {
                    return resolve(deepseekResult);
                }
            } catch (deepseekErr) {
                return reject(new Error("Gemini lỗi (" + (lastError?.message || "quá tải") + ") và XKiro DeepSeek cũng lỗi: " + deepseekErr.message));
            }

            reject(lastError || new Error("Không thể kết nối tới Google Gemini. Vui lòng thử lại sau giây lát!"));
        });
    });
}

async function loadGeminiConfig() {
    const { geminiApiKey, geminiModel } = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
    const keyInput = $("#geminiApiKeyInput");
    const modelSelect = $("#geminiModelSelect");
    const badge = $("#geminiStatusBadge");

    if (keyInput && geminiApiKey) {
        keyInput.value = geminiApiKey;
    }
    if (modelSelect && geminiModel) {
        modelSelect.value = geminiModel;
    }
    if (badge) {
        if (geminiApiKey && geminiApiKey.trim()) {
            badge.textContent = "🟢 Đã có Key";
            badge.className = "pill ok";
        } else {
            badge.textContent = "⚪ Dùng DeepSeek Free";
            badge.className = "pill";
        }
    }
}

async function saveGeminiConfig() {
    const keyInput = $("#geminiApiKeyInput");
    const modelSelect = $("#geminiModelSelect");
    const msgEl = $("#geminiApiMsg");
    const badge = $("#geminiStatusBadge");

    const apiKey = keyInput ? keyInput.value.trim() : "";
    const model = modelSelect ? modelSelect.value : "gemini-2.0-flash";

    await chrome.storage.local.set({
        geminiApiKey: apiKey,
        geminiModel: model
    });

    if (badge) {
        if (apiKey) {
            badge.textContent = "🟢 Đã có Key";
            badge.className = "pill ok";
        } else {
            badge.textContent = "⚪ Dùng DeepSeek Free";
            badge.className = "pill";
        }
    }

    if (msgEl) {
        msgEl.textContent = apiKey ? "✔ Đã lưu Gemini API Key thành công!" : "✔ Đã lưu (sẽ dùng DeepSeek V4 Free nếu chưa có key).";
        msgEl.style.color = apiKey ? "#16a34a" : "#64748b";
    }
    log(apiKey ? "✔ Đã lưu Gemini API Key thành công." : "Đã cập nhật cấu hình API.", apiKey ? "ok" : "");
}

function toggleGeminiKeyVis() {
    const input = $("#geminiApiKeyInput");
    const btn = $("#btnToggleGeminiKeyVis");
    if (!input) return;
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    if (btn) btn.textContent = isPass ? "🙈" : "👁️";
}

async function testGeminiConfig() {
    const keyInput = $("#geminiApiKeyInput");
    const modelSelect = $("#geminiModelSelect");
    const msgEl = $("#geminiApiMsg");
    const testBtn = $("#btnTestGeminiKey");

    const apiKey = keyInput ? keyInput.value.trim() : "";
    const model = modelSelect ? modelSelect.value : "gemini-2.0-flash";

    if (!apiKey) {
        if (msgEl) {
            msgEl.textContent = "Đang test qua XKiro DeepSeek V4 Free...";
            msgEl.style.color = "#3b82f6";
        }
        try {
            await callXkiroDeepseekDirect("Trả lời đúng 1 chữ: OK");
            if (msgEl) {
                msgEl.textContent = "🟢 Kết nối DeepSeek V4 Free thành công!";
                msgEl.style.color = "#16a34a";
            }
            log("✔ Kết nối DeepSeek V4 Free thành công.", "ok");
        } catch (e) {
            if (msgEl) {
                msgEl.textContent = "🔴 Lỗi: " + e.message;
                msgEl.style.color = "#dc2626";
            }
        }
        return;
    }

    if (testBtn) {
        testBtn.disabled = true;
        testBtn.textContent = "⏳ Đang test...";
    }
    if (msgEl) {
        msgEl.textContent = "Đang gửi yêu cầu test tới Gemini API...";
        msgEl.style.color = "#3b82f6";
    }

    const startTime = Date.now();
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Trả lời đúng 1 chữ: OK" }] }],
                generationConfig: { maxOutputTokens: 10 }
            })
        });

        const latency = Date.now() - startTime;
        if (res.ok) {
            if (msgEl) {
                msgEl.textContent = `🟢 Kết nối model ${model} thành công (${latency}ms)!`;
                msgEl.style.color = "#16a34a";
            }
            log(`✔ Kiểm tra Gemini API (${model}) thành công (${latency}ms).`, "ok");
        } else {
            let errText = `HTTP ${res.status}`;
            try {
                const errJson = await res.json();
                if (errJson?.error?.message) errText = errJson.error.message;
            } catch (_) {}
            if (msgEl) {
                msgEl.textContent = `🔴 Thất bại: ${errText}`;
                msgEl.style.color = "#dc2626";
            }
            log(`✖ Kiểm tra Gemini API thất bại: ${errText}`, "err");
        }
    } catch (err) {
        if (msgEl) {
            msgEl.textContent = `🔴 Lỗi mạng: ${err.message}`;
            msgEl.style.color = "#dc2626";
        }
        log(`✖ Lỗi mạng khi kiểm tra Gemini API: ${err.message}`, "err");
    } finally {
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.textContent = "⚡ Kiểm tra kết nối";
        }
    }
}

// Cài đặt các nút Viết lại AI, Điền vào SP, Copy (chuẩn module Web bán SP)
function setupWebSpActionButtons() {
    const titleInp = document.getElementById('productTitleInput');
    const descInp = document.getElementById('productDescInput');

    // 1. Nút Viết lại AI - Tên sản phẩm
    const btnRewriteName = document.getElementById('btnRewriteTitleAi');
    if (btnRewriteName) {
        btnRewriteName.addEventListener('click', async () => {
            const currentName = (titleInp?.value || current?.name || '').trim();
            const currentDesc = (descInp?.value || current?.description || '').trim();
            if (!currentName && !currentDesc) {
                alert("Vui lòng nhập tên hoặc mô tả sản phẩm trước khi viết lại bằng AI!");
                return;
            }
            btnRewriteName.textContent = "Đang viết...";
            btnRewriteName.disabled = true;

            try {
                const prompt = `Bạn là chuyên gia viết tiêu đề sản phẩm chuẩn SEO Shopee. Hãy dựa vào tên và nội dung mô tả sản phẩm dưới đây để viết lại 1 tên sản phẩm mới chuẩn SEO cực kỳ thu hút, có độ dài KHOẢNG 99 KÝ TỰ (tối đa 99 ký tự, không vượt quá 99 ký tự), không chứa các ký tự định dạng markdown như **, không chứa ngoặc kép, chỉ trả về duy nhất câu tên sản phẩm:\nTên hiện tại: ${currentName}\nMô tả sản phẩm: ${currentDesc}`;
                let newTitle = await callGeminiApiDirect(prompt);
                if (newTitle) {
                    newTitle = newTitle
                        .replace(/\*\*/g, '')
                        .replace(/\*/g, '')
                        .replace(/^["']|["']$/g, '')
                        .trim();
                    
                    if (newTitle.length > 99) {
                        newTitle = newTitle.substring(0, 99).trim();
                    }
                    if (titleInp) titleInp.value = newTitle;
                    if (current) current.name = newTitle;
                    const countEl = document.getElementById('titleCharCount');
                    if (countEl) countEl.textContent = `${newTitle.length}/120`;
                    log(`✔ Đã viết lại tên sản phẩm bằng AI: "${newTitle}"`, 'ok');
                }
            } catch (err) {
                alert("Lỗi viết lại tên AI: " + err.message);
                log("✖ Lỗi viết lại tên AI: " + err.message, "err");
            } finally {
                btnRewriteName.textContent = "Viết lại AI";
                btnRewriteName.disabled = false;
            }
        });
    }

    // 2. Nút Viết lại AI - Mô tả sản phẩm
    const btnRewriteDesc = document.getElementById('btnRewriteDescAi');
    if (btnRewriteDesc) {
        btnRewriteDesc.addEventListener('click', async () => {
            const currentName = (titleInp?.value || current?.name || '').trim();
            const currentDesc = (descInp?.value || current?.description || '').trim();
            if (!currentName && !currentDesc) {
                alert("Vui lòng nhập tên hoặc mô tả sản phẩm để AI viết lại!");
                return;
            }
            btnRewriteDesc.textContent = "Đang viết...";
            btnRewriteDesc.disabled = true;

            try {
                const prompt = `Bạn là chuyên gia viết content marketing và SEO Shopee hàng đầu. Hãy viết lại bài mô tả sản phẩm này thật chi tiết, hấp dẫn và chuẩn SEO Shopee.

YÊU CẦU BẮT BUỘC:
1. ĐỘ DÀI: Khoảng 2500 đến 2700 ký tự (Đảm bảo độ dài từ 2500 - 2700 ký tự, không được vượt quá 2900 ký tự vì Shopee giới hạn tối đa 3000 ký tự).
2. HASHTAG: Ở CUỐI BÀI VIẾT, BẮT BUỘC THÊM TỪ 15 - 20 HASHTAG CHUẨN SEO liên quan đến sản phẩm (Định dạng: #hashtag1 #hashtag2 #hashtag3...).
3. BỐ CỤC ĐẦY ĐỦ RÕ RÀNG:
   - Đoạn giới thiệu cuốn hút về sản phẩm.
   - Đặc điểm nổi bật & Lợi ích vượt trội khi sử dụng sản phẩm.
   - Thông số kỹ thuật chi tiết.
   - Hướng dẫn sử dụng & Mẹo bảo quản.
   - Chính sách cam kết & Bảo hành đổi trả uy tín của shop.
   - Danh sách hashtag ở cuối cùng.
4. ĐỊNH DẠNG:
   - Dùng icon emoji sinh động, chuyên nghiệp cho từng đầu mục.
   - Giữ nguyên định dạng xuống dòng rõ ràng giữa các đoạn.
   - TUYỆT ĐỐI KHÔNG DÙNG ký tự markdown in đậm như ** hoặc __ hoặc * (Shopee không hỗ trợ markdown, sẽ bị lỗi hiển thị).
   - Chỉ trả về duy nhất nội dung bài mô tả, không thêm bất kỳ lời chào hay ghi chú thừa nào.

Tên sản phẩm: ${currentName}
Mô tả hiện tại:
${currentDesc}`;
                let newDesc = await callGeminiApiDirect(prompt);
                if (newDesc) {
                    newDesc = newDesc
                        .replace(/```markdown/gi, '')
                        .replace(/```/g, '')
                        .replace(/\*\*/g, '')
                        .replace(/\*/g, '')
                        .trim();

                    // Đảm bảo có hashtag nếu AI quên
                    if (!/#\w+/.test(newDesc)) {
                        const words = (currentName || '').toLowerCase().replace(/[^\w\sà-ỹ]/g, '').split(/\s+/).filter(w => w.length >= 2);
                        const autoTags = [];
                        for (let i = 0; i < words.length - 1 && autoTags.length < 15; i++) {
                            autoTags.push('#' + words[i] + words[i+1]);
                        }
                        autoTags.push('#shopeevn', '#chinhhang', '#giare', '#freeship');
                        newDesc += '\n\n' + autoTags.join(' ');
                    }

                    // Đảm bảo không vượt quá 2950 ký tự (giới hạn cứng của Shopee là 3000 ký tự)
                    if (newDesc.length > 2950) {
                        newDesc = newDesc.substring(0, 2900).trim();
                    }
                    if (descInp) descInp.value = newDesc;
                    if (current) current.description = newDesc;
                    const countEl = document.getElementById('descCharCount');
                    if (countEl) countEl.textContent = `${newDesc.length} ký tự`;
                    log(`✔ Đã viết lại mô tả sản phẩm bằng AI (${newDesc.length} ký tự)`, 'ok');
                }
            } catch (err) {
                alert("Lỗi viết lại mô tả AI: " + err.message);
                log("✖ Lỗi viết lại mô tả AI: " + err.message, "err");
            } finally {
                btnRewriteDesc.textContent = "Viết lại AI";
                btnRewriteDesc.disabled = false;
            }
        });
    }

    // 3. Nút Điền vào SP - Tên
    const btnFillName = document.getElementById('btnPushTitleToProduct');
    if (btnFillName) {
        btnFillName.addEventListener('click', async () => {
            const val = (titleInp?.value || current?.name || '').trim();
            if (!val) {
                alert("Chưa có tên sản phẩm để điền!");
                return;
            }
            if (current) current.name = val;
            btnFillName.textContent = "Đang điền...";
            try {
                const response = await sendMessageToActiveShopeeTab({
                    type: "FILL_PRODUCT_TEXT",
                    product: { name: val }
                });
                if (response?.message) {
                    btnFillName.textContent = "Đã điền!";
                } else {
                    btnFillName.textContent = "Đã gửi điền tên";
                }
                log(`✔ Đã gửi điền tên sản phẩm vào Shopee: "${val}"`, 'ok');
            } catch (err) {
                alert("Lỗi điền tên: " + err.message);
                log("✖ Lỗi điền tên vào Shopee: " + err.message, "err");
            } finally {
                setTimeout(() => { btnFillName.textContent = "Điền vào SP"; }, 1500);
            }
        });
    }

    // 4. Nút Điền vào SP - Mô tả
    const btnFillDesc = document.getElementById('btnPushDescToProduct');
    if (btnFillDesc) {
        btnFillDesc.addEventListener('click', async () => {
            const val = (descInp?.value || current?.description || '').trim();
            if (!val) {
                alert("Chưa có nội dung mô tả để điền!");
                return;
            }
            if (current) current.description = val;
            btnFillDesc.textContent = "Đang điền...";
            try {
                const response = await sendMessageToActiveShopeeTab({
                    type: "FILL_PRODUCT_TEXT",
                    product: { description: val }
                });
                if (response && response.ok) {
                    btnFillDesc.textContent = "✔ Đã điền!";
                    log(`✔ Đã điền mô tả sản phẩm vào Shopee (${val.length} ký tự)`, 'ok');
                } else {
                    const msg = response?.message || "Không tìm thấy ô nhập mô tả trên trang Shopee.";
                    alert("Lỗi điền mô tả: " + msg);
                    log("✖ Lỗi điền mô tả: " + msg, "err");
                    btnFillDesc.textContent = "Lỗi điền";
                }
            } catch (err) {
                alert("Lỗi điền mô tả: " + err.message);
                log("✖ Lỗi điền mô tả vào Shopee: " + err.message, "err");
                btnFillDesc.textContent = "Lỗi điền";
            } finally {
                setTimeout(() => { btnFillDesc.textContent = "Điền vào SP"; }, 2000);
            }
        });
    }

    // 5. Nút Copy Tên
    const btnCopyTitle = document.getElementById('btnCopyTitle');
    if (btnCopyTitle) {
        btnCopyTitle.addEventListener('click', () => {
            const val = (titleInp?.value || current?.name || '').trim();
            if (!val) {
                alert("Không có nội dung để copy!");
                return;
            }
            navigator.clipboard.writeText(val).then(() => {
                btnCopyTitle.textContent = "Đã copy!";
                setTimeout(() => { btnCopyTitle.textContent = "Copy"; }, 1500);
            }).catch(err => alert("Lỗi copy: " + err.message));
        });
    }

    // 6. Nút Copy Mô tả
    const btnCopyDesc = document.getElementById('btnCopyDesc');
    if (btnCopyDesc) {
        btnCopyDesc.addEventListener('click', () => {
            const val = (descInp?.value || current?.description || '').trim();
            if (!val) {
                alert("Không có nội dung để copy!");
                return;
            }
            navigator.clipboard.writeText(val).then(() => {
                btnCopyDesc.textContent = "Đã copy!";
                setTimeout(() => { btnCopyDesc.textContent = "Copy"; }, 1500);
            }).catch(err => alert("Lỗi copy: " + err.message));
        });
    }

    // Cài đặt Gemini API
    document.getElementById('btnSaveGeminiKey')?.addEventListener('click', saveGeminiConfig);
    document.getElementById('btnTestGeminiKey')?.addEventListener('click', testGeminiConfig);
    document.getElementById('btnToggleGeminiKeyVis')?.addEventListener('click', toggleGeminiKeyVis);
}

// ---------- Khởi động ----------

async function init() {
  try {
    setupWebSpActionButtons();
  } catch (err) {
    console.error('Lỗi setupWebSpActionButtons:', err);
  }

  try {
    await loadOptions();
  } catch (err) {
    console.warn('Lỗi loadOptions:', err);
  }

  try {
    await loadGeminiConfig();
  } catch (err) {
    console.warn('Lỗi loadGeminiConfig:', err);
  }

  try {
    await loadCover();
  } catch (err) {
    console.warn('Lỗi loadCover:', err);
  }

  try {
    await detectFromActiveTab();
  } catch (err) {
    console.warn('Lỗi detectFromActiveTab:', err);
  }

  // Đảm bảo luôn hiển thị giao diện sản phẩm & các ô nhập liệu
  try {
    renderProduct();
  } catch (err) {
    console.warn('Lỗi renderProduct ban đầu:', err);
  }

  try {
    checkShop();
    checkAutoFlow();
    updateCloneButtonUI();
  } catch (err) {
    console.warn('Lỗi checkShop/AutoFlow:', err);
  }

  // Đọc mã gian từ chrome.storage.local và đồng bộ ô mã gian
  try {
    const storageGian = await chrome.storage.local.get(['maGian', 'dhHoanTextValue']);
    currentMaGian = String(storageGian.maGian || storageGian.dhHoanTextValue || '').trim();
    const maGianInput = $('#cloneMaGian');
    if (maGianInput) {
      maGianInput.value = currentMaGian;
      let debounceTimer = null;
      maGianInput.addEventListener('input', () => {
        currentMaGian = maGianInput.value.trim();
        chrome.storage.local.set({ maGian: currentMaGian, dhHoanTextValue: currentMaGian });
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadCaiDatCover(currentMaGian);
        }, 400);
      });
    }
    await loadCaiDatCover(currentMaGian);
  } catch (err) {
    console.warn('Lỗi khởi tạo mã gian:', err);
  }

  // Ô sửa Tiêu đề sản phẩm
  const titleInp = $('#productTitleInput');
  if (titleInp) {
    titleInp.addEventListener('input', () => {
      if (current) current.name = titleInp.value;
      const countEl = $('#titleCharCount');
      if (countEl) countEl.textContent = `${titleInp.value.length}/120`;
    });
  }

  // Ô sửa Mô tả sản phẩm
  const descInp = $('#productDescInput');
  if (descInp) {
    descInp.addEventListener('input', () => {
      if (current) current.description = descInp.value;
      const countEl = $('#descCharCount');
      if (countEl) countEl.textContent = `${descInp.value.length} ký tự`;
    });
  }

  // Nút khôi phục tiêu đề & mô tả gốc
  $('#btnResetTitleDesc')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!current) return;
    current.name = current.originalName || current.name;
    current.description = current.originalDescription || current.description;
    if (titleInp) titleInp.value = current.name || '';
    if (descInp) descInp.value = current.description || '';
    const titleCount = $('#titleCharCount');
    if (titleCount) titleCount.textContent = `${(current.name || '').length}/120`;
    const descCount = $('#descCharCount');
    if (descCount) descCount.textContent = `${(current.description || '').length} ký tự`;
    log('Đã khôi phục tiêu đề & mô tả gốc của sản phẩm.', 'ok');
  });

  $('#btnClone')?.addEventListener('click', handleCloneClick);
  $('#btnDlAll')?.addEventListener('click', downloadAllMedia);
  $('#btnScan')?.addEventListener('click', runScan);
  // Tải trước dữ liệu DS_SP cho gợi ý SKU
  loadDsSpData(false);

  // Đính kèm gợi ý SKU cho ô SKU cha
  const parentSkuInp = $('#parentSkuInput');
  if (parentSkuInp) {
    attachSkuAutocomplete(parentSkuInp);
  }

  // Nút làm mới danh sách sản phẩm từ sheet DS_SP
  $('#btnRefreshDsSp')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const btn = $('#btnRefreshDsSp');
    const oldText = btn.textContent;
    btn.textContent = '⏳ Đang tải...';
    try {
      const list = await loadDsSpData(true);
      log(`Đã tải lại ${list.length} mã SKU từ sheet DS_SP thành công!`, 'ok');
    } catch (err) {
      log(`Lỗi tải sheet DS_SP: ${err.message}`, 'err');
    } finally {
      btn.textContent = oldText;
    }
  });

  $('#btnAutoFillSku')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!current || !current.models) return;
    let parentSkuVal = String($('#parentSkuInput')?.value || opts.parentSku || current.itemId || '').trim();
    const maGian = getEffectiveMaGian();

    let baseParent = parentSkuVal;
    let hasMaGian = false;
    if (maGian && baseParent.toLowerCase().endsWith(`-${maGian.toLowerCase()}`)) {
      baseParent = baseParent.slice(0, -(maGian.length + 1)).trim();
      hasMaGian = true;
    }

    current.models.forEach((m) => {
      const key = m.tierIndex.join('-');
      const name = getModelDisplayName(m, current.tiers);
      const slugName = fileSlug(name);
      let autoSku = baseParent ? `${baseParent}-${slugName}` : slugName;
      if (maGian && (hasMaGian || maGian)) {
        if (!autoSku.toLowerCase().endsWith(`-${maGian.toLowerCase()}`)) {
          autoSku = `${autoSku}-${maGian}`;
        }
      }
      currentModelSkus[key] = autoSku;
      const inp = document.querySelector(`.var-sku-input[data-key="${key}"]`);
      if (inp) inp.value = autoSku;
    });
    opts.modelSkus = currentModelSkus;
    if (current) {
      chrome.storage.local.set({ [`modelSkus_${current.itemId}`]: currentModelSkus });
    }
    log('Đã tự động điền SKU cho tất cả phân loại.', 'ok');
  });
  $('#reloadShop')?.addEventListener('click', (e) => { e.preventDefault(); loadShop(true); });
  $('#btnToggleMedia')?.addEventListener('click', () => {
    const collapsed = $('#mediaGrid').classList.toggle('collapsed');
    $('#btnToggleMedia').textContent = collapsed ? 'Mở rộng' : 'Thu gọn';
  });
  // Lựa chọn AI: Gemini hoặc ChatGPT
  const aiRadios = document.querySelectorAll('input[name="aiProvider"]');
  aiRadios.forEach((r) => {
    r.checked = (r.value === (opts.aiProvider || 'gemini'));
    r.addEventListener('change', () => {
      if (r.checked) {
        opts.aiProvider = r.value;
        chrome.storage.local.set({ [OPTS_KEY]: opts });
        updateCloneButtonUI();
        log('Đã chọn dùng AI: ' + (r.value === 'chatgpt' ? 'ChatGPT' : 'Gemini'), 'ok');
      }
    });
  });

  const getActiveAiTarget = () => {
    const checked = document.querySelector('input[name="aiProvider"]:checked');
    return (checked ? checked.value : opts.aiProvider) || 'gemini';
  };
  $('#btnOpenAi')?.addEventListener('click', () => openAi(getActiveAiTarget(), false));
  $('#btnAuto')?.addEventListener('click', () => openAi(getActiveAiTarget(), true));
  $('#resetPrompt')?.addEventListener('click', (e) => {
    e.preventDefault();
    opts.aiPrompt = DEFAULT_PROMPT;
    document.querySelector('[data-opt="aiPrompt"]').value = DEFAULT_PROMPT;
    chrome.storage.local.set({ [OPTS_KEY]: opts });
  });
  function setCoverImageFromFile(file, source = 'file') {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      log('Chỉ chấp nhận file định dạng hình ảnh (PNG, JPG, WEBP)!', 'warn');
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      chrome.storage.local.set({
        aiCoverImage: {
          dataUrl: fr.result,
          timestamp: Date.now(),
          source: source,
          productId: current ? current.itemId : ''
        }
      });
      const sourceLabel = source === 'paste' ? 'Dán Ctrl+V' : source === 'drop' ? 'Kéo thả' : 'Từ máy';
      log(`✔ Đã nhận ảnh bìa mới (${sourceLabel})!`, 'ok');
    };
    fr.readAsDataURL(file);
  }

  $('#btnPickCover')?.addEventListener('click', () => $('#coverFile')?.click());
  $('#coverFile')?.addEventListener('change', () => {
    const file = $('#coverFile')?.files?.[0];
    if (file) setCoverImageFromFile(file, 'file');
    if ($('#coverFile')) $('#coverFile').value = '';
  });

  // Kéo thả ảnh vào vùng ảnh bìa
  const coverZone = document.querySelector('.cover') || document.querySelector('#aiCard');
  if (coverZone) {
    ['dragenter', 'dragover'].forEach((name) => {
      coverZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        coverZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((name) => {
      coverZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        coverZone.classList.remove('drag-over');
      });
    });
    coverZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      if (dt.files && dt.files.length > 0) {
        setCoverImageFromFile(dt.files[0], 'drop');
      } else {
        const html = dt.getData('text/html');
        const srcMatch = html && html.match(/src=["'](.*?)["']/);
        const uri = srcMatch ? srcMatch[1] : (dt.getData('text/uri-list') || dt.getData('text/plain'));
        if (uri && /^https?:\/\//i.test(uri)) {
          log('Đang tải ảnh kéo thả từ liên kết...', 'ok');
          chrome.runtime.sendMessage({ type: 'sclFetchImage', url: uri, source: 'drop' }, (res) => {
            if (res && res.ok) {
              log('✔ Đã đặt ảnh làm ảnh bìa!', 'ok');
            } else {
              log('Không thể tải ảnh từ link kéo thả: ' + (res?.error || 'lỗi'), 'warn');
            }
          });
        }
      }
    });
  }

  // Ctrl+V dán ảnh trực tiếp từ clipboard vào ảnh bìa
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items || items.length === 0) return;
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setCoverImageFromFile(file, 'paste');
          break;
        }
      }
    }
  });
  $('#btnClearCover')?.addEventListener('click', () => chrome.storage.local.remove('aiCoverImage'));

  chrome.tabs.onActivated.addListener(detectFromActiveTab);
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (tab.active && (info.url || info.status === 'complete')) detectFromActiveTab();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.sclProducts && currentItemId) setCurrentItem(currentItemId);
    if (changes.ds_sp_cache_data && changes.ds_sp_cache_data.newValue) {
      dsSpList = parseDsSpRows(changes.ds_sp_cache_data.newValue);
    }
    if (changes.sclLastItemId && !current) detectFromActiveTab();
    if (changes.aiCoverImage) loadCover().then(checkAutoFlow);
    if (changes.maGian || changes.dhHoanTextValue) {
      const newGian = String((changes.maGian?.newValue ?? changes.dhHoanTextValue?.newValue) || '').trim();
      if (newGian && newGian !== currentMaGian) {
        currentMaGian = newGian;
        const maGianInput = $('#cloneMaGian');
        if (maGianInput) maGianInput.value = newGian;
        loadCaiDatCover(newGian);
      }
    }
    const st = changes.aiStatus && changes.aiStatus.newValue;
    if (st && st.ts > lastAiStatusTs) {
      lastAiStatusTs = st.ts;
      log('AI: ' + st.text, st.error ? 'err' : '');
    }
  });
}

init();
