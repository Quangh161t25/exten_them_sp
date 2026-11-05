// Sao chép 1 sản phẩm shopee.vn sang shop đang đăng nhập Kênh Người Bán.
import { products, shop, uploadImage } from './shopee-api.js';

const PRICE_SCALE = 100000; // giá trong API shopee.vn được nhân 100000
const MAX_IMAGES = 9;
const MAX_TITLE = 120;
const MAX_DESC = 3000;
const MAX_OPTION_LEN = 20;
const MIN_PRICE = 1000;

// ---------- Tiện ích ----------

export const imgId = (s) => String(s || '')
  .replace(/^https?:\/\/[^/]+\/file\//, '')
  .split('?')[0]
  .replace(/_tn$/, '');

export const imgUrl = (id) => (!id ? '' : String(id).startsWith('http') ? id : `https://down-vn.img.susercontent.com/file/${id}`);

const pick = (obj, paths) => {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) return v;
  }
  return undefined;
};

const scalePrice = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n / PRICE_SCALE : 0;
};

const normText = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd')
  .replace(/\s+/g, ' ')
  .trim();

// Quy tắc tăng giảm giá: "+10%", "-5%", "10%" (= +10%), "+20000", "-15.000", "=99000"
export function applyPrice(price, rule) {
  let p = Number(price) || 0;
  const r = String(rule || '').replace(/\s/g, '').replace(/[.,](?=\d{3}(\D|$))/g, '');
  if (r && p) {
    let m;
    if ((m = r.match(/^=(\d+)$/))) p = Number(m[1]);
    else if ((m = r.match(/^([+-]?\d+(?:\.\d+)?)%$/))) p *= 1 + Number(m[1]) / 100;
    else if (/^[+-]?\d+$/.test(r)) p += Number(r);
  }
  if (!p) return 0;
  return Math.max(MIN_PRICE, Math.round(p / 100) * 100);
}

export const replacePhones = (text, phone) => (phone ? String(text).replace(/(?:[-+() |.]*\d){9,11}/g, ` ${phone} `) : text);

// ---------- Đọc dữ liệu sản phẩm nguồn (từ trang shopee.vn) ----------

export function normalizeSource(record) {
  const d = record.data || record;
  const item = d.item || d;

  const images = (pick(d, ['product_images.images', 'item.images', 'images']) || []).map(imgId).filter(Boolean);

  const rawTiers = pick(item, ['tier_variations']) || pick(d, ['tier_variations', 'item.tier_variations', 'product_info.tier_variations']) || [];
  const tiers = rawTiers
    .filter((t) => t && Array.isArray(t.options) && t.options.length)
    .map((t) => ({
      name: t.name || '',
      options: t.options.map((o) => String(o ?? '')),
      images: (t.images || []).map(imgId)
    }));

  const scanned = record.scannedStock || {};
  const rawModelsList = pick(item, ['models']) || pick(d, ['models', 'item.models', 'product_info.models']) || item.models || [];
  const models = rawModelsList.map((m) => {
    const tierIndex = ((m.extinfo && m.extinfo.tier_index) || m.tier_index || []).map(Number);
    const key = tierIndex.join('-');
    const hasScan = Object.prototype.hasOwnProperty.call(scanned, key);
    return {
      name: m.name || '',
      price: scalePrice(m.price),
      priceBefore: scalePrice(m.price_before_discount),
      stock: hasScan ? Number(scanned[key]) : Number(pick(m, ['stock', 'normal_stock', 'model_stock'])) || 0,
      soldOut: hasScan ? Number(scanned[key]) === 0 : m.has_stock === false,
      scanned: hasScan,
      tierIndex
    };
  });

  const categories = (pick(item, ['categories', 'fe_categories']) || pick(d, ['product_attributes.categories', 'categories']) || [])
    .map((c) => Number(c.catid ?? c.cat_id ?? c.id ?? c))
    .filter(Boolean);
  if (!categories.length && item.catid) categories.push(Number(item.catid));

  const attributes = (pick(d, ['product_attributes.attrs', 'item.attributes', 'attributes']) || [])
    .map((a) => ({
      id: Number(a.id ?? a.attribute_id ?? 0),
      name: a.name || a.attribute_name || '',
      value: String(a.value ?? (Array.isArray(a.values) ? a.values.join(', ') : '') ?? '')
    }))
    .filter((a) => a.name || a.id);

  const paragraphs = (pick(d, ['product_description.paragraph_list', 'item.rich_text_description.paragraph_list']) || [])
    .map((p) => ({ text: p.text == null ? '' : String(p.text), imgId: p.img_id ? imgId(p.img_id) : '' }));
  let description = item.description || pick(d, ['product_description.description']) || '';
  if (!description) description = paragraphs.map((p) => p.text).filter(Boolean).join('\n');

  const priceList = models.map((m) => m.price).filter(Boolean);
  const price = scalePrice(pick(item, ['price', 'price_min'])) || (priceList.length ? Math.min(...priceList) : 0);
  const priceBefore = scalePrice(pick(item, ['price_before_discount', 'price_min_before_discount']));

  return {
    itemId: String(item.item_id || item.itemid || record.itemId || ''),
    shopId: String(item.shop_id || item.shopid || record.shopId || ''),
    name: item.title || item.name || '',
    originalName: item.title || item.name || '',
    description,
    originalDescription: description,
    descParagraphs: paragraphs,
    images,
    tiers,
    models,
    categories,
    attributes,
    price,
    priceBefore,
    priceMax: priceList.length ? Math.max(...priceList) : price,
    stock: scanned.single != null ? Number(scanned.single) : Number(item.stock) || 0,
    stockScanned: scanned.single != null ? 1 : models.filter((m) => m.scanned).length,
    brandId: Number(item.brand_id || 0),
    condition: Number(item.condition || 1) || 1,
    preOrder: !!(item.is_pre_order || item.pre_order),
    daysToShip: Number(item.estimated_days || item.days_to_ship || 0),
    videos: sourceVideos(d, item),
    media: collectMedia(d, item, images, tiers)
  };
}

function sourceVideos(d, item) {
  let list = pick(item, ['video_info_list']) || pick(d, ['product_images.video', 'product_images.videos', 'product_images.video_info_list']) || [];
  if (!Array.isArray(list)) list = [list];
  return list.filter((v) => v && v.video_id);
}

const videoUrlOf = (v) => {
  const url = pick(v, ['default_format.url', 'formats.0.url', 'url']);
  if (url) return url;
  const path = pick(v, ['formats.0.path', 'default_format.path']);
  return path ? `https://down-bs-vn.img.susercontent.com/${path}` : '';
};

// Toàn bộ ảnh + video để xem / tải về
function collectMedia(d, item, images, tiers) {
  const list = [];
  const seen = new Set();
  // Mỗi nhóm tự lọc trùng (cùng 1 ảnh vẫn hiện ở cả nhóm Ảnh sản phẩm và Phân loại)
  const addImage = (id, label, group) => {
    if (!id || seen.has(`${group}:${id}`)) return;
    seen.add(`${group}:${id}`);
    list.push({ type: 'image', group, id, url: imgUrl(id), label });
  };
  images.forEach((id, i) => addImage(id, `Ảnh ${i + 1}`, 'main'));
  tiers.forEach((t) => t.images.forEach((id, i) => addImage(id, t.options[i] || t.name, 'variation')));
  const paragraphs = pick(d, ['product_description.paragraph_list', 'item.rich_text_description.paragraph_list']) || [];
  paragraphs.filter((p) => p.img_id).forEach((p, i) => addImage(imgId(p.img_id), `Mô tả ${i + 1}`, 'description'));

  sourceVideos(d, item).forEach((v, i) => {
    const url = v && videoUrlOf(v);
    if (url && !seen.has(url)) {
      seen.add(url);
      list.push({ type: 'video', group: 'video', url, thumb: v.thumb_url ? imgUrl(imgId(v.thumb_url)) : '', label: `Video ${i + 1}` });
    }
  });
  return list;
}

// ---------- Mô tả có ảnh ----------

const MAX_DESC_IMAGES = 12;

// Mô tả dạng "json" của Shopee: danh sách đoạn chữ (type 0) và ảnh (type 1) xen kẽ.
export function buildRichDescription(src, opts) {
  const phone = String(opts.phone || '').trim();
  const fields = [];
  let textLen = 0;
  let images = 0;
  const addText = (t) => {
    const v = replacePhones(String(t), phone);
    if (textLen + v.length > MAX_DESC) return;
    textLen += v.length;
    fields.push({ type: 0, value: `${v}\n` });
  };
  if (String(opts.descPrefix || '').trim()) addText(opts.descPrefix.trim());
  // Neu nguoi dung da sua mo ta thi uu tien dung noi dung sua
  if (src.originalDescription && src.description !== src.originalDescription) {
    addText(src.description);
    for (const p of src.descParagraphs || []) {
      if (p.imgId && images < MAX_DESC_IMAGES) {
        fields.push({ type: 1, value: p.imgId });
        images++;
      }
    }
  } else {
  for (const p of src.descParagraphs || []) {
    if (p.imgId) {
      if (images < MAX_DESC_IMAGES) {
        fields.push({ type: 1, value: p.imgId });
        images++;
      }
    } else if (p.text.trim()) {
      addText(p.text);
    } else {
      fields.push({ type: 0, value: '\n' });
    }
  }
  }
  if (String(opts.descSuffix || '').trim()) addText(opts.descSuffix.trim());
  if (!images) return null;
  if (textLen < 100) addText(src.name.padEnd(100, '.'));
  return { description: JSON.stringify({ field_list: fields }), description_type: 'json' };
}

// ---------- Thuộc tính ngành hàng ----------

const isExpiryAttribute = (names, id) => Number(id) === 100061 || names.some((n) => n.includes('expiry') || n.includes('han su dung'));

export function buildAttributes(tree, srcAttributes, opts) {
  const out = [];
  const expiryUnix = String(Math.floor(Date.now() / 1000) + (Number(opts.expiryDays) || 365) * 86400);

  for (const a of tree || []) {
    const id = Number(a.attribute_id ?? a.id);
    if (!id) continue;
    const names = [a.name, a.display_name, a.attribute_name, a.local_display_name].filter(Boolean).map(normText);
    const mandatory = !!(a.mandatory ?? a.is_mandatory);
    const values = a.children || a.attribute_value_list || a.value_list || [];
    const info = a.attribute_info || {};
    const units = info.attribute_unit_list || [];
    const valueId = (v) => Number(v.value_id ?? v.id);
    const valueName = (v) => normText(v.display_name || v.name || v.value || v.value_name);

    let val = null;
    if (isExpiryAttribute(names, id)) {
      val = { raw_value: expiryUnix, unit: '' };
    } else {
      const src = srcAttributes.find((s) => (s.id && s.id === id) || names.includes(normText(s.name)));
      if (src && src.value) {
        const match = values.find((v) => valueName(v) === normText(src.value));
        if (match) {
          val = { value_id: valueId(match) };
        } else if (units.length) {
          const num = (src.value.match(/^[\d.,]+/) || [''])[0];
          const unit = src.value.slice(num.length).trim();
          if (num && units.includes(unit)) val = { raw_value: num.replace(',', '.'), unit };
        } else if (!values.length || info.input_type === 2 || info.input_validation_type) {
          val = { raw_value: src.value.slice(0, 40), unit: '' };
        }
      }
      if (!val && mandatory) {
        if (values.length) val = { value_id: valueId(values[0]) };
        else val = { raw_value: '1', unit: units[0] || '' };
      }
    }
    if (val) out.push({ attribute_id: id, attribute_values: [val], _mandatory: mandatory });
  }
  return out;
}

// ---------- Dựng payload tạo sản phẩm ----------

/**
 * @param src  sản phẩm đã normalizeSource
 * @param opts tuỳ chọn từ giao diện
 * @param ctx  { template: {channels, weightUnit}, attributes, coverId }
 */
export function buildPayload(src, opts, ctx) {
  const basePrice = (p, before) => (opts.usePriceBefore && before ? before : p);
  const defaultStock = Math.max(0, Number(opts.stock) || 0) || 1000;
  const stockOf = (s) => (opts.keepStock && s > 0 ? Math.min(s, 200000) : defaultStock);
  const locations = (ctx.template && ctx.template.locations) || [];
  const stockSettings = (n) => (locations.length
    ? locations.map((location_id) => ({ location_id, sellable_stock: n }))
    : [{ sellable_stock: n }]);

  // Ảnh
  let images = [...src.images];
  if (opts.dropCover && images.length > 1) images.shift();
  if (ctx.coverId) images.unshift(ctx.coverId);
  images = images.slice(0, MAX_IMAGES);

  // Phân loại
  const tiers = src.tiers.slice(0, 2);
  const hasVariants = tiers.length > 0 && src.models.length > 0;
  const parentSku = String(opts.parentSku || src.itemId).slice(0, 100);
  const modelSku = String(opts.modelSku || '').trim();

  let modelList;
  let tierList;
  if (hasVariants) {
    const seen = new Set();
    modelList = src.models
      .filter((m) => m.tierIndex.length === tiers.length && m.tierIndex.every((ti, gi) => ti >= 0 && ti < tiers[gi].options.length))
      .filter((m) => {
        const key = m.tierIndex.join('-');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((m) => {
        const stock = m.soldOut && opts.keepStock ? 0 : stockOf(m.stock);
        const key = m.tierIndex.join('-');
        const specificSku = (opts.modelSkus && opts.modelSkus[key]) || modelSku || parentSku;
        return {
          id: 0,
          sku: String(specificSku || '').slice(0, 100),
          tier_index: m.tierIndex,
          // Giá sửa tay của phân loại được dùng nguyên, không cộng thêm mức Tăng giảm giá
          price: String((opts.modelPrices && Number(opts.modelPrices[key])) || applyPrice(basePrice(m.price, m.priceBefore) || src.price, opts.priceChange)),
          stock,
          stock_setting_list: stockSettings(stock)
        };
      });
    tierList = tiers.map((t, gi) => ({
      id: 0,
      group_id: String(gi),
      custom_value: (t.name || `Phân loại ${gi + 1}`).slice(0, 14),
      value_list: t.options.map((o, oi) => ({
        id: 0,
        custom_value: (opts.modelNames && String(opts.modelNames[`${gi}-${oi}`] || '').trim().slice(0, MAX_OPTION_LEN)) || (o.length > MAX_OPTION_LEN ? `${o.slice(0, MAX_OPTION_LEN - 3)}_${oi + 1}` : o) || `Loại ${oi + 1}`,
        image_id: gi === 0 ? (t.images[oi] || '') : ''
      }))
    }));
  } else {
    const stock = stockOf(src.stock);
    modelList = [{
      id: 0,
      sku: (modelSku || parentSku).slice(0, 100),
      tier_index: [0],
      price: String(applyPrice(basePrice(src.price, src.priceBefore), opts.priceChange)),
      stock,
      stock_setting_list: stockSettings(stock)
    }];
    tierList = [{ id: 0, group_id: '0', custom_value: '', value_list: [{ id: 0, custom_value: '', image_id: '' }] }];
  }

  const prices = modelList.map((m) => Number(m.price)).filter(Boolean);
  const totalStock = modelList.reduce((a, m) => a + m.stock, 0);

  const grams = Math.max(1, Number(opts.weight) || 5000);
  const weightUnit = ctx.template && ctx.template.weightUnit != null ? Number(ctx.template.weightUnit) : 2;
  const weightValue = weightUnit === 1 ? grams / 1000 : grams;

  const name = [opts.titlePrefix, src.name, opts.titleSuffix].map((s) => String(s || '').trim()).filter(Boolean).join(' ').slice(0, MAX_TITLE);
  let description = [opts.descPrefix, src.description, opts.descSuffix].map((s) => String(s || '').trim()).filter(Boolean).join('\n');
  description = replacePhones(description, String(opts.phone || '').trim()).slice(0, MAX_DESC);
  if (description.length < 100) description = (description + '\n' + name).padEnd(100, '.');

  let daysToShip = src.daysToShip;
  if (!src.preOrder) daysToShip = daysToShip > 0 && daysToShip <= 2 ? daysToShip : 2;
  else if (daysToShip < 7 || daysToShip > 15) daysToShip = 10;

  return {
    id: 0,
    name,
    brand_id: src.brandId || 0,
    images,
    long_images: [],
    description_info: (opts.descImages && buildRichDescription(src, opts)) || { description, description_type: 'normal' },
    _plainDescription: description,
    category_path: src.categories,
    attributes: (ctx.attributes || []).map(({ _mandatory, ...a }) => a),
    price: String(prices.length ? Math.min(...prices) : MIN_PRICE),
    parent_sku: parentSku,
    stock: totalStock,
    stock_setting_list: stockSettings(totalStock),
    weight: { unit: weightUnit, value: String(weightValue) },
    dimension: { width: '0', height: '0', length: '0' },
    model_list: modelList,
    std_tier_variation_list: tierList,
    logistics_channels: ((ctx.template && ctx.template.channels) || []).map(({ _name, ...c }) => c),
    pre_order_info: { pre_order: src.preOrder, days_to_ship: daysToShip },
    condition: src.condition || 1,
    unlisted: !!opts.unlisted,
    video_list: opts.copyVideo ? src.videos.map((v) => ({ ...v, version: Number(v.version) || 1 })) : [],
    size_chart_info: null,
    wholesale_list: [],
    installment_tenures: {},
    add_on_deal: [],
    ds_cat_rcmd_id: '0',
    enable_model_level_dts: false
  };
}

// ---------- Tự sửa payload theo thông báo lỗi của Shopee ----------

async function reuploadImage(id) {
  const r = await fetch(imgUrl(id));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  const jpeg = await toJpegBase64(blob);
  return uploadImage(jpeg, 'image/jpeg', `${id}.jpg`);
}

export async function fixPayload(payload, msg, state, log) {
  const m = msg.toLowerCase();

  if (m.includes('image') && m.includes('invalid')) {
    const bad = (m.split(':')[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
    const targets = bad.length ? payload.images.filter((id) => bad.some((b) => id.toLowerCase().includes(b))) : payload.images;
    if (!targets.length || state.reuploaded) return false;
    state.reuploaded = true;
    log(`Shopee không nhận ${targets.length} ảnh, đang tải ảnh lên lại...`);
    const replaced = [];
    for (const id of payload.images) {
      if (!targets.includes(id)) { replaced.push(id); continue; }
      try { replaced.push(await reuploadImage(id)); } catch (e) { /* bỏ ảnh lỗi */ }
    }
    payload.images = replaced;
    return replaced.length > 0;
  }
  if (m.includes('brand') && payload.brand_id) {
    payload.brand_id = 0;
    return true;
  }
  if (m.includes('size chart') && !payload.size_chart_info) {
    payload.size_chart_info = { size_chart_id: 0, size_chart: payload.images[payload.images.length - 1] };
    return true;
  }
  if (m.includes('video') && payload.video_list.length) {
    payload.video_list = [];
    return true;
  }
  if (m.includes('condition') && payload.condition !== 1) {
    payload.condition = 1;
    return true;
  }
  if (m.includes('attribute')) {
    if (!state.attrMandatoryOnly) {
      state.attrMandatoryOnly = true;
      const mandatoryIds = new Set(state.attributes.filter((a) => a._mandatory).map((a) => a.attribute_id));
      payload.attributes = payload.attributes.filter((a) => mandatoryIds.has(a.attribute_id));
      return true;
    }
    if (payload.attributes.length) {
      payload.attributes = [];
      return true;
    }
  }
  if ((m.includes('description') || m.includes('mô tả')) && payload.description_info.description_type === 'json') {
    log('Shopee không nhận mô tả có ảnh, chuyển sang mô tả chữ...', 'warn');
    payload.description_info = { description: state.plainDescription, description_type: 'normal' };
    return true;
  }
  if ((m.includes('description') || m.includes('mô tả')) && !state.descTrimmed) {
    state.descTrimmed = true;
    payload.description_info.description = payload.description_info.description.slice(0, 2500);
    return true;
  }
  if ((m.includes('name') || m.includes('title') || m.includes('tên')) && m.includes('length') && !state.nameTrimmed) {
    state.nameTrimmed = true;
    payload.name = payload.name.slice(0, 100);
    return true;
  }
  if ((m.includes('create product') || m.includes('system error')) && !state.genericFix) {
    state.genericFix = true;
    payload.video_list = [];
    payload.attributes = payload.attributes.filter((a) => state.attributes.find((x) => x.attribute_id === a.attribute_id && x._mandatory));
    return true;
  }
  return false;
}

// ---------- Ảnh ----------

export async function toJpegBase64(source) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Không đọc được ảnh'));
      im.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

// ---------- Mẫu vận chuyển (lấy từ 1 sản phẩm có sẵn của shop) ----------

// Tìm mọi mảng object có tên khớp keyRe (ở bất kỳ độ sâu nào, tối đa 5 tầng)
function findObjectArrays(obj, keyRe, depth = 0, out = []) {
  if (!obj || typeof obj !== 'object' || depth > 5) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (keyRe.test(k) && v.length && v[0] && typeof v[0] === 'object') out.push({ key: k, list: v });
      v.forEach((x) => findObjectArrays(x, keyRe, depth + 1, out));
    } else if (v && typeof v === 'object') {
      findObjectArrays(v, keyRe, depth + 1, out);
    }
  }
  return out;
}

const channelIdOf = (c) => Number(c.channelid ?? c.channel_id ?? c.logistics_channel_id ?? c.logistic_channel_id ?? c.channelId ?? 0);

const channelEnabled = (c) => {
  for (const k of ['enabled', 'is_enabled', 'enable', 'selected', 'is_selected']) {
    if (c[k] !== undefined) return !!c[k];
  }
  if (c.status !== undefined) return c.status === 1 || c.status === true;
  return true;
};

// Đơn vị vận chuyển đang bật của 1 sản phẩm (đọc được nhiều kiểu đặt tên trường)
export function extractChannels(raw) {
  const ids = new Map();
  for (const { list } of findObjectArrays(raw, /logistic|channel/i)) {
    for (const c of list) {
      const id = channelIdOf(c);
      if (id && channelEnabled(c) && !ids.has(id)) ids.set(id, c);
    }
  }
  return [...ids.entries()].map(([channelid, c]) => ({
    price: String(c.price ?? c.shipping_fee ?? '0'),
    cover_shipping_fee: !!c.cover_shipping_fee,
    enabled: true,
    item_flag: String(c.item_flag ?? '0'),
    channelid,
    sizeid: Number(c.sizeid ?? c.size_id ?? 0),
    size: Number(c.size ?? 0),
    _name: String(c.name ?? c.channel_name ?? c.display_name ?? c.logistics_channel_name ?? '')
  }));
}

// Kho (location_id + tên nếu có) mà sản phẩm đang dùng
export function extractLocations(raw) {
  const found = new Map();
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 6) return;
    if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
    const id = o.location_id ?? o.warehouse_id;
    if (id) {
      const name = String(o.location_name ?? o.warehouse_name ?? o.address_name ?? o.name ?? '');
      if (!found.has(String(id)) || (name && !found.get(String(id)))) found.set(String(id), name);
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(raw.model_list || []);
  walk(raw.stock_setting_list || []);
  walk(raw.stock_detail || {});
  return [...found.entries()].map(([id, name]) => ({ id, name }));
}

const describeKeys = (raw) => {
  const keys = Object.keys(raw || {});
  const hit = keys.filter((k) => /logistic|channel|ship/i.test(k));
  return `các trường: ${(hit.length ? hit : keys).slice(0, 25).join(', ')}`;
};

// Dự phòng: đọc đơn vị vận chuyển + kho từ các sản phẩm có sẵn của shop (gộp tối đa `max` sản phẩm).
async function loadSettingsFromProducts(manual, max) {
  const ids = manual ? [manual] : (await products.search({ pageSize: max })).map((p) => String(p.itemId)).filter(Boolean);
  if (!ids.length) throw new Error('Shop chưa có sản phẩm nào để lấy cài đặt vận chuyển/kho. Hãy tạo tay 1 sản phẩm trước (hoặc nhập ID sản phẩm mẫu trong "Nâng cao").');

  const channels = new Map();
  const locations = new Map();
  let weightUnit = null;
  let lastRaw = null;
  for (const id of ids) {
    let raw = null;
    try { raw = await products.getRaw(id); } catch (e) { /* bỏ qua sản phẩm lỗi */ }
    if (!raw) continue;
    lastRaw = raw;
    if (weightUnit == null && raw.weight && raw.weight.unit != null) weightUnit = raw.weight.unit;
    extractChannels(raw).forEach((c) => {
      const old = channels.get(c.channelid);
      if (!old || (!old._name && c._name)) channels.set(c.channelid, c);
    });
    extractLocations(raw).forEach((l) => {
      if (!locations.has(l.id) || (l.name && !locations.get(l.id).name)) locations.set(l.id, l);
    });
  }
  console.log('[Shopee Clone] shop settings', { ids, channels: [...channels.values()], locations: [...locations.values()], lastRaw });

  if (!channels.size) {
    throw new Error(`Không đọc được đơn vị vận chuyển từ sản phẩm của shop (${ids.slice(0, 5).join(', ')}; ${describeKeys(lastRaw)}). `
      + 'Hãy nhập ID một sản phẩm đang bán bình thường vào "ID sản phẩm mẫu" trong mục Nâng cao, hoặc gửi dòng lỗi này để chỉnh.');
  }
  return {
    channels: [...channels.values()],
    locations: [...locations.values()],
    weightUnit: weightUnit == null ? 2 : weightUnit,
    source: 'products'
  };
}

// Kênh vận chuyển của shop: ưu tiên các kênh gộp đang bật (Nhanh, Hỏa Tốc, Trong Ngày...),
// không có thì dùng các kênh thường đang bật.
export function mapShopChannels(list) {
  const on = (list || []).filter((c) => c && c.enabled && c.channel_id);
  const masked = on.filter((c) => c.is_mask_channel);
  return (masked.length ? masked : on).map((c) => ({
    price: '0',
    cover_shipping_fee: false,
    enabled: true,
    item_flag: '0',
    channelid: Number(c.channel_id),
    sizeid: 0,
    size: 0,
    _name: String(c.name || '')
  }));
}

export function mapShopWarehouses(list) {
  return (list || [])
    .filter((w) => w && w.location_id)
    .map((w) => ({
      id: String(w.location_id),
      name: `${w.warehouse_name || w.location_id}${w.in_holiday_mode ? ' (Off)' : ''}`,
      off: !!w.in_holiday_mode
    }));
}

let shopSettingsCache = null;

// Đơn vị vận chuyển + kho của shop (đọc trực tiếp từ cài đặt shop, dự phòng: từ sản phẩm có sẵn).
export async function loadShopSettings({ templateId = '', max = 10, force = false } = {}) {
  const manual = String(templateId || '').trim();
  const cacheKey = manual || '*';
  if (!force && shopSettingsCache && shopSettingsCache.key === cacheKey && Date.now() - shopSettingsCache.ts < 10 * 60 * 1000) {
    return shopSettingsCache.value;
  }

  let channels = [];
  let locations = [];
  if (!manual) {
    try { channels = mapShopChannels(await shop.channels()); } catch (e) { console.warn('[Shopee Clone] get_channel_list', e); }
    try { locations = mapShopWarehouses(await shop.warehouses()); } catch (e) { console.warn('[Shopee Clone] get_shop_warehouse', e); }
  }

  let value;
  if (channels.length) {
    value = { channels, locations, weightUnit: 2, source: 'shop' };
  } else {
    value = await loadSettingsFromProducts(manual, max);
    if (!value.locations.length && locations.length) value.locations = locations;
  }
  console.log('[Shopee Clone] shop settings', value);
  shopSettingsCache = { key: cacheKey, ts: Date.now(), value };
  return value;
}

// Áp lựa chọn của người dùng (mảng rỗng / chưa chọn = dùng tất cả)
export function pickShopSettings(settings, opts) {
  const selCh = Array.isArray(opts.selectedChannels) ? opts.selectedChannels.map(Number) : null;
  const selLoc = Array.isArray(opts.selectedLocations) ? opts.selectedLocations.map(String) : null;
  const channels = selCh ? settings.channels.filter((c) => selCh.includes(c.channelid)) : settings.channels;
  const locations = selLoc ? settings.locations.filter((l) => selLoc.includes(l.id)) : settings.locations.filter((l) => !l.off);
  if (!channels.length) throw new Error('Chưa chọn đơn vị vận chuyển nào.');
  if (settings.locations.length && !locations.length) throw new Error('Chưa chọn kho nào.');
  return { channels, locations: locations.map((l) => l.id), weightUnit: settings.weightUnit };
}

// ---------- Quy trình sao chép ----------

const ERROR_TEXT = [
  [/duplicat|trùng/, 'Shopee báo sản phẩm bị trùng với sản phẩm khác trong shop.'],
  [/listing limit|reach.*max/, 'Shop đã đạt giới hạn số sản phẩm.'],
  [/too fast|frequen/, 'Thao tác quá nhanh, hãy đợi 1 phút rồi thử lại.'],
  [/logistic|channel/, 'Lỗi đơn vị vận chuyển – kiểm tra sản phẩm mẫu có bật vận chuyển phù hợp với cân nặng.'],
  [/weight|dimension/, 'Cân nặng/kích thước không hợp lệ với đơn vị vận chuyển.'],
  [/category/, 'Ngành hàng không hợp lệ (shop có thể không được bán ngành này).']
];

const friendlyError = (msg, code) => {
  const hit = ERROR_TEXT.find(([re]) => re.test(msg.toLowerCase()));
  return `${hit ? hit[1] + ' ' : ''}(Shopee: ${msg || 'không rõ'}${code ? `, code ${code}` : ''})`;
};

// Đọc lại sản phẩm vừa tạo để báo nếu Shopee bỏ qua video / ảnh mô tả.
async function verifyCreated(productId, payload, log) {
  try {
    await new Promise((r) => setTimeout(r, 1500));
    const raw = await products.getRaw(productId);
    if (!raw) return;
    console.log('[Shopee Clone] created product', raw);
    if (payload.video_list.length) {
      const videos = raw.video_list || raw.video_info_list || [];
      if (videos.length) log(`Video: đã thêm ${videos.length} video.`, 'ok');
      else log('Shopee không nhận video sao chép. Bấm "Tải" ở video (mục Ảnh & Video) rồi thêm tay vào sản phẩm.', 'warn');
    }
    if (payload.description_info.description_type === 'json') {
      const info = raw.description_info || {};
      const hasImages = info.description_type === 'json' || /"type"\s*:\s*1/.test(String(info.description || ''));
      log(hasImages ? 'Mô tả: đã thêm ảnh vào mô tả.' : 'Shopee không giữ ảnh trong mô tả.', hasImages ? 'ok' : 'warn');
    }
  } catch (e) {
    console.warn('[Shopee Clone] verify', e);
  }
}

/**
 * @param src   sản phẩm đã normalizeSource
 * @param opts  tuỳ chọn
 * @param extra { coverDataUrl, log }
 * @returns {Promise<{productId: number}>}
 */
export async function cloneProduct(src, opts, { coverDataUrl = null, log = () => {} } = {}) {
  if (!src.categories.length) throw new Error('Không đọc được ngành hàng của sản phẩm nguồn. Hãy F5 trang sản phẩm rồi thử lại.');
  if (!src.images.length) throw new Error('Sản phẩm nguồn không có ảnh.');

  if (opts.skipDuplicate) {
    log('Kiểm tra sản phẩm đã sao chép chưa...');
    try {
      const found = await products.search({ keyword: String(opts.parentSku || src.itemId), searchType: 'sku', pageSize: 5 });
      if (found.length) throw Object.assign(new Error(`Sản phẩm này đã được sao chép rồi (ID ${found[0].itemId}). Bỏ chọn "Không trùng SP" nếu vẫn muốn sao chép.`), { stop: true });
    } catch (e) {
      if (e.stop) throw e;
    }
  }

  log('Đọc cài đặt vận chuyển & kho của shop...');
  const settings = await loadShopSettings({ templateId: opts.templateId });
  const template = pickShopSettings(settings, opts);
  const chNames = template.channels.map((c) => c._name || c.channelid).join(', ');
  log(`Vận chuyển: ${chNames}${template.locations.length ? ` · Kho: ${template.locations.join(', ')}` : ''}`);
  if (opts.copyVideo) {
    log(src.videos.length ? `Sẽ sao chép ${src.videos.length} video.` : 'Sản phẩm nguồn không có video để sao chép.', src.videos.length ? '' : 'warn');
  }

  log('Đọc thuộc tính ngành hàng...');
  let attributes = [];
  try {
    const tree = await products.attributeTree(src.categories[src.categories.length - 1]);
    attributes = buildAttributes(tree, src.attributes, opts);
  } catch (e) {
    log('Không đọc được thuộc tính ngành hàng, bỏ qua: ' + e.message, 'warn');
  }

  let coverId = '';
  if (coverDataUrl) {
    log('Tải ảnh bìa mới lên Shopee...');
    try {
      coverId = await uploadImage(await toJpegBase64(coverDataUrl), 'image/jpeg', 'cover.jpg');
    } catch (e) {
      log('Không tải được ảnh bìa mới, giữ ảnh gốc: ' + e.message, 'warn');
    }
  }

  const payload = buildPayload(src, opts, { template, attributes, coverId });
  const state = { attributes, plainDescription: payload._plainDescription };
  delete payload._plainDescription;
  console.log('[Shopee Clone] payload', payload);

  for (let attempt = 1; attempt <= 8; attempt++) {
    log(attempt === 1 ? 'Đang tạo sản phẩm...' : `Đang thử lại (lần ${attempt})...`);
    const res = await products.create(payload);
    const productId = res && res.data && res.data.product_id;
    if (productId) {
      await verifyCreated(productId, payload, log);
      return { productId, payload };
    }

    const msg = String((res && (res.user_message || res.message || res.msg)) || '');
    console.warn('[Shopee Clone] create failed', res);
    if (/duplicat|listing limit|too fast/i.test(msg) || !(await fixPayload(payload, msg, state, log))) {
      throw new Error(friendlyError(msg, res && res.code));
    }
    log(`Shopee báo: "${msg}" – đã tự chỉnh, thử lại...`, 'warn');
  }
  throw new Error('Đã thử nhiều lần nhưng Shopee vẫn từ chối. Mở Console (F12) của Side Panel để xem chi tiết.');
}
