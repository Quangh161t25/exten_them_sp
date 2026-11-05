// Gắn video của sản phẩm nguồn vào 1 sản phẩm có sẵn trong shop (gộp từ extension ShopeeVideoSync).
import { products } from './shopee-api.js';

// Video gắn thêm phải có version 1; video đã có của sản phẩm giữ nguyên, trừ khi chọn thay thế.
export function mergeVideos(existing, incoming, replace = false) {
  const added = incoming.map((v) => ({ ...v, version: 1 }));
  const list = replace ? added : [...(existing || []), ...added];
  const seen = new Set();
  return list.filter((v) => {
    if (seen.has(v.video_id)) return false;
    seen.add(v.video_id);
    return true;
  });
}

const sameVideos = (a, b) => a.length === b.length && a.every((v, i) => v.video_id === b[i].video_id);

/**
 * @returns {Promise<{changed: boolean, count: number, confirmed: boolean|null}>}
 *   confirmed: đọc lại sản phẩm có thấy đủ video không (null = không đọc lại được)
 */
export async function syncVideos(productId, videos, { replace = false, log = () => {}, verifyDelay = 1500 } = {}) {
  if (!videos.length) throw new Error('Sản phẩm nguồn không có video.');

  log('Đọc sản phẩm trong shop...');
  const raw = await products.getRaw(productId);
  if (!raw) throw new Error(`Không đọc được sản phẩm ${productId}.`);

  const existing = raw.video_list || [];
  const merged = mergeVideos(existing, videos, replace);
  if (sameVideos(existing, merged)) return { changed: false, count: existing.length, confirmed: true };

  log(`Gửi ${merged.length} video lên Shopee...`);
  const res = await products.updateRaw(productId, { id: raw.id ?? productId, video_list: merged });
  const msg = String((res && (res.user_message || res.message || res.msg)) || '');
  const code = res && (res.code ?? res.error);
  if (code || (msg && msg.toLowerCase() !== 'success')) {
    if (/size chart/i.test(msg)) {
      throw new Error(`Sản phẩm này bắt buộc có bảng size nên Shopee từ chối cập nhật. Hãy thêm bảng size rồi đồng bộ lại. (Shopee: ${msg})`);
    }
    throw new Error(`Shopee từ chối: ${msg || `code ${code}`}`);
  }

  // Shopee báo thành công vẫn có thể bỏ qua video, nên đọc lại để chắc chắn.
  let confirmed = null;
  try {
    await new Promise((r) => setTimeout(r, verifyDelay));
    const after = await products.getRaw(productId);
    if (after) {
      const ids = (after.video_list || []).map((v) => v.video_id);
      confirmed = merged.every((v) => ids.includes(v.video_id));
    }
  } catch (e) {
    console.warn('[Video Sync] verify', e);
  }
  return { changed: true, count: merged.length, confirmed };
}
