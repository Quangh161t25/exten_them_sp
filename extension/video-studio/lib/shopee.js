// API Shopee cho Shopee Video + chế độ demo (dữ liệu giả, không gọi Shopee)
(() => {
  const SHOPEE = 'https://shopee.vn';
  const SELLER = 'https://banhang.shopee.vn';
  const CREATOR = 'https://creator.shopee.vn';
  const MMS = 'https://api.mms.shopee.vn';
  const IMG = 'https://cf.shopee.vn/file/';
  const VID = 'https://cvf.shopee.vn/file/';
  const SDK_VER = 'mms-3.6.0';
  const TASK = { READY: 100, POSTED: 300 };
  const MAX_PRODUCTS = 6;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');
  const imgUrl = (h) => (!h ? '' : /^https?:/.test(h) ? h : IMG + h);

  let demo = false;
  const setDemo = (v) => { demo = !!v; };

  // ================= Crypto (WebCrypto + MD5 tự viết) =================
  const enc = new TextEncoder();
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const sha256Hex = async (data) => hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
  async function hmac(key, msg) {
    const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', k, enc.encode(msg));
  }
  // access_key trả về từ preupload được mã hoá AES-128-CBC (khoá = "shopee_vod_" + biz 5 chữ số)
  async function decryptAccessKey(b64, biz = 201) {
    const key = await crypto.subtle.importKey('raw', enc.encode(`shopee_vod_${String(biz).padStart(5, '0')}`), 'AES-CBC', false, ['decrypt']);
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const out = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: enc.encode('1234567887654321') }, key, data);
    return new TextDecoder().decode(out);
  }
  function md5Hex(buffer) {
    const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
    const src = new Uint8Array(buffer);
    const len = src.length;
    const total = (((len + 8) >> 6) + 1) << 6;
    const m = new Uint8Array(total);
    m.set(src);
    m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, (len * 8) >>> 0, true);
    dv.setUint32(total - 4, Math.floor(len / 0x20000000), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < total; off += 64) {
      for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new DataView(new ArrayBuffer(16));
    [a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v, true));
    return hex(out.buffer);
  }
  const amzDate = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  /** Ký AWS SigV4 cho PUT /mms/{vid}.mp4?x-id=PutObject */
  async function signS3Put({ accessKey, secretKey, host, uri, bodyHash, bodyLength, vid, contentType }) {
    const date = amzDate();
    const day = date.slice(0, 8);
    const h = {
      'content-length': String(bodyLength),
      'content-type': contentType,
      host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': date,
      'x-amz-meta-mms-hasattach': 'false',
      'x-amz-meta-mms-mediaid': vid,
    };
    const keys = Object.keys(h).sort();
    const signed = keys.join(';');
    const canonical = ['PUT', uri, 'x-id=PutObject', keys.map((k) => `${k}:${h[k]}\n`).join(''), signed, bodyHash].join('\n');
    const scope = `${day}/VN/s3/aws4_request`;
    const sts = ['AWS4-HMAC-SHA256', date, scope, await sha256Hex(canonical)].join('\n');
    let k = await hmac('AWS4' + secretKey, day);
    k = await hmac(k, 'VN'); k = await hmac(k, 's3'); k = await hmac(k, 'aws4_request');
    const sig = hex(await hmac(k, sts));
    const headers = { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed}, Signature=${sig}` };
    delete headers.host; delete headers['content-length']; // trình duyệt tự đặt
    return headers;
  }

  // ================= Gọi API thật =================
  const creatorHeaders = () => ({
    language: 'en', 'x-env': 'live', 'x-region': 'vn', 'x-region-domain': 'vn', 'x-region-timezone': '+0700', 'x-traceid': rand(21),
  });

  function unwrap(r, what) {
    const d = r.data;
    if (!r.ok || !d) throw new Error(`${what}: HTTP ${r.status}${r.text ? ' ' + r.text : ''}`);
    const code = d.code ?? d.error ?? 0;
    if (code && code !== 0) throw new Error(`${what}: ${d.msg || d.message || d.error_msg || 'code ' + code}`);
    return d.data !== undefined ? d.data : d;
  }

  const creator = async (method, path, { params, body } = {}) => {
    const q = params ? '?' + new URLSearchParams(params) : '';
    const r = await Bridge.fetch('seller', { url: CREATOR + path + q, method, headers: creatorHeaders(), body });
    return unwrap(r, path);
  };
  const seller = async (path, params = {}) => {
    const cds = await Bridge.getCookie(SELLER, 'SPC_CDS');
    const q = new URLSearchParams({ ...(cds ? { SPC_CDS: cds, SPC_CDS_VER: '2' } : {}), ...params });
    const r = await Bridge.fetch('seller', { url: `${SELLER}${path}?${q}` });
    return r;
  };
  const mms = async (path, body) => {
    const r = await Bridge.fetch('seller', { url: MMS + path, method: 'POST', body });
    return unwrap(r, path);
  };

  // ---- Link sản phẩm ----
  function parseProductLink(raw) {
    const s = String(raw || '').trim();
    let m = s.match(/-i\.(\d+)\.(\d+)/) || s.match(/\/product\/(\d+)\/(\d+)/);
    if (m) return { shopId: m[1], itemId: m[2] };
    m = s.match(/^(\d+)[\s./_-]+(\d+)$/);
    if (m) return { shopId: m[1], itemId: m[2] };
    return null;
  }

  function pickVideoUrl(v) {
    if (!v) return '';
    if (v.formats && v.formats[0] && v.formats[0].url) return v.formats[0].url;
    if (v.default_format && v.default_format.url) return v.default_format.url;
    return v.video_id ? VID + v.video_id : '';
  }

  const Real = {
    async getProduct(link) {
      const p = parseProductLink(link);
      if (!p) throw new Error('Link sản phẩm không hợp lệ (cần dạng ...-i.<shopId>.<itemId>)');
      const q = new URLSearchParams({ item_id: p.itemId, shop_id: p.shopId, tz_offset_minutes: '420', detail_level: '0' });
      const r = await Bridge.fetch('shopee', { url: `${SHOPEE}/api/v4/pdp/get_pc?${q}`, headers: { 'x-api-source': 'pc', 'x-shopee-language': 'vi', 'x-requested-with': 'XMLHttpRequest' } });
      const d = r.data || {};
      if (d.error === 90309999 || `${d.error}` === '90309999') throw new Error('Shopee chặn request (anti-bot). Mở shopee.vn, đăng nhập rồi thử lại.');
      const item = (d.data && (d.data.item || d.data)) || null;
      if (!item || !(item.item_id || item.itemid)) throw new Error('Không lấy được dữ liệu sản phẩm' + (d.error ? ` (mã ${d.error})` : ''));
      // get_pc để ảnh/video trong data.product_images (video: 1 object), API cũ để trong item
      const pi = (d.data && d.data.product_images) || {};
      const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
      const rawVideos = [...asList(pi.video), ...asList(pi.videos), ...asList(item.video_info_list), ...asList(item.video)];
      const seen = new Set();
      const videos = rawVideos.filter((v) => {
        const k = v && (v.video_id || pickVideoUrl(v));
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      });
      const images = [...new Set([...(pi.images || []), ...(item.images || [])])];
      return {
        shopId: `${item.shop_id || item.shopid || p.shopId}`,
        itemId: `${item.item_id || item.itemid}`,
        name: item.title || item.name || '',
        images: images.map(imgUrl),
        videos: videos.map((v, i) => ({
          index: i, url: pickVideoUrl(v), thumb: imgUrl(v.thumb_url || ''), duration: v.duration || 0,
        })).filter((v) => v.url),
      };
    },

    async getShop() {
      let r = await seller('/api/forward/accountservice/v2/shop/');
      if (r.data && r.data.shop_id) return { shopId: `${r.data.shop_id}`, shopName: r.data.shop_name || r.data.username || '' };
      r = await seller('/api/selleraccount/shop_info/');
      const d = r.data && r.data.data;
      if (d && d.shop_id) return { shopId: `${d.shop_id}`, shopName: d.name || '' };
      throw new Error('NEED_SELLER_LOGIN: Chưa đăng nhập Kênh Người Bán (banhang.shopee.vn).');
    },

    async searchItems(name = '') {
      const d = await creator('GET', '/publish/pc/api/item/list', { params: { page: 1, pageSize: 20, itemName: name } });
      return (d.items || []).map((e) => ({
        itemId: `${e.itemId}`, name: e.name || '', cover: e.cover || '',
        snapshot: { minPrice: e.minPrice || 0, maxPrice: e.maxPrice || 0, stock: e.stock || 0, status: e.status || 0 },
      }));
    },

    /** Upload + đăng. onStep(text, progress?) để báo tiến độ */
    async publish(blob, { caption, products, shopId }, onStep = () => {}) {
      const contentType = blob.type || 'video/mp4';
      const buffer = await blob.arrayBuffer();
      onStep('Chuẩn bị upload (xin quyền upload)...');
      const pre = await mms('/uploadapi/api/v1/vod/preupload', {
        biz: 201, ver: 2, mediatype: 1,
        reportdata: { sdkversion: SDK_VER, appversion: SDK_VER, ostype: '2', userid: String(shopId), reporttime: Date.now() },
      });
      if (!pre || !pre.vid || !(pre.services && pre.services.length)) throw new Error('preupload: không có thông tin upload');
      const svc = pre.services.find((s) => s.serviceid === 'shopeeuss') || pre.services[0];
      const vid = pre.vid;

      onStep('Đang tính checksum...');
      const bodyHash = await sha256Hex(buffer);
      const md5 = md5Hex(buffer);
      const host = new URL(svc.uploaddomain).host;
      const uri = `/mms/${vid}.mp4`;
      const headers = await signS3Put({
        accessKey: await decryptAccessKey(svc.access_key, 201), secretKey: svc.secret_key,
        host, uri, bodyHash, bodyLength: buffer.byteLength, vid, contentType,
      });
      onStep('Đang upload video...', 0);
      const put = await Bridge.putBytes('seller', `${svc.uploaddomain}${uri}?x-id=PutObject`, headers, buffer, contentType,
        (p) => onStep('Đang upload video...', p));
      if (!put.ok) throw new Error(`putBytes: HTTP ${put.status} ${put.error || put.text || ''}`.trim());

      onStep('Báo upload hoàn tất...');
      await mms('/uploadapi/api/v1/vod/reportupload', {
        vid, mid: '', serviceid: svc.serviceid, updomain: svc.uploaddomain, biz: 201, region: 'VN', extendid: vid,
        fsize: buffer.byteLength, md5, videourl: String(svc.urlformat || '').replace('{vid}', vid).replace('{extend}', 'mp4'),
        code: 0, reportdata: { cost: 1, sdkversion: SDK_VER, ostype: '2', reporttime: Date.now(), userid: String(shopId) },
        fileinfos: { mediatype: 1 },
      });

      onStep('Chờ Shopee xử lý video...');
      let info = null;
      for (let i = 0; i < 20; i++) {
        info = await creator('GET', '/publish/pc/api/vid/info', { params: { mmsVid: vid } }).then((d) => d && d.format).catch(() => null);
        if (info && info.duration) break;
        await sleep(2500);
      }

      onStep('Tạo bài đăng...');
      const created = await creator('POST', '/publish/pc/api/task/create', { body: {} });
      const taskId = created && created.taskId;
      if (!taskId) throw new Error('task/create: không có taskId');
      const productList = products.slice(0, MAX_PRODUCTS).map((p) => ({
        itemId: Number(p.itemId), name: p.name, cover: p.cover, minPrice: p.snapshot.minPrice, maxPrice: p.snapshot.maxPrice,
        status: p.snapshot.status, stock: p.snapshot.stock, shopId: Number(shopId),
      }));
      const edited = await creator('POST', '/publish/pc/api/task/edit', {
        body: { taskList: [{
          taskId, mmsVid: vid, caption, productList, cover: (info && info.cover) || '', coverFrameTime: 0,
          duration: (info && info.duration) || 0, width: (info && info.width) || 0, height: (info && info.height) || 0,
          allowInfo: { allowDuet: true, allowStitch: true }, scheduledInfo: { scheduledPost: false },
        }] },
      });
      const st1 = edited && edited.taskList && edited.taskList[0] ? edited.taskList[0].status : 0;
      if (st1 !== TASK.READY) throw new Error(`task/edit: trạng thái ${st1} (chưa sẵn sàng đăng)`);

      onStep('Đăng video...');
      const posted = await creator('POST', '/publish/pc/api/task/post', { body: { taskIdList: [taskId] } });
      const st2 = posted && posted.taskList && posted.taskList[0] ? posted.taskList[0].status : 0;
      if (st2 !== TASK.POSTED) throw new Error(`task/post: trạng thái ${st2}`);

      onStep('Lấy mã video...');
      let videoId = '';
      for (let i = 0; i < 4 && !videoId; i++) {
        const list = await creator('GET', '/publish/pc/api/video/list', { params: { page: 1, pageSize: 10, order: 'ptime', orderBy: 'desc' } }).catch(() => null);
        const found = ((list && list.list) || []).find((v) => `${v.mmsVid}` === `${vid}`);
        if (found && found.videoId) videoId = `${found.videoId}`;
        else await sleep(2500);
      }
      return { mmsVid: vid, videoId, duration: (info && info.duration) || 0 };
    },

    async getMetrics(videoId) {
      const r = await seller('/api/supply/sellercenter/video/detail', { postId: videoId });
      const d = r.data && r.data.data;
      if (!d) throw new Error('Không lấy được chỉ số video' + (r.data && r.data.message ? ': ' + r.data.message : ''));
      const p = d.postInfo || {}, t = d.trend || {};
      return {
        cover: p.cover || '', duration: p.duration || 0, viewCount: t.views || 0, likeCount: t.likes || 0,
        commentCount: t.comments || 0, shareCount: t.shares || 0, soldCount: t.soldItems || 0,
        placedOrders: t.placedOrders || 0, placedSales: t.placedSales || 0, productClicks: t.productClicks || 0,
        metricsSyncedAt: new Date().toISOString(),
      };
    },

    async deleteVideo(videoId) {
      await creator('POST', '/publish/pc/api/video/delete', { body: { videoId: Number(videoId) } });
      return true;
    },
  };

  // ================= Demo (dữ liệu giả) =================
  const DEMO_PRODUCTS = [
    ['Máy làm sữa hạt SKG250L 2.5L 800W', 989000, 2000], ['Máy làm sữa hạt SKG460 1.7L chống ồn', 859000, 2000],
    ['Quánh Titanium LK-3116 inox 316', 744000, 4000], ['Nồi luộc gà đa năng LK-3226', 1169000, 2000],
    ['Nồi áp suất inox 6L EL9112', 1290000, 150], ['Chảo chống dính 26cm đáy từ', 259000, 800],
    ['Máy sấy tóc 2 chiều nóng lạnh', 289000, 120], ['Bộ dao inox 5 món', 399000, 60],
  ].map(([name, price, stock], i) => ({
    itemId: `${2000 + i}`, name, cover: '', snapshot: { minPrice: price, maxPrice: i === 2 ? price + 125000 : price, stock, status: 1 },
  }));

  const Demo = {
    async getProduct(link) {
      await sleep(400);
      const p = parseProductLink(link) || { shopId: '999000111', itemId: '40907864792' };
      return {
        shopId: p.shopId, itemId: p.itemId, name: 'Nồi áp suất inox 6L dùng mọi loại bếp (dữ liệu mẫu)',
        images: [], videos: [{ index: 0, url: 'demo', thumb: '', duration: 16 }],
      };
    },
    async getShop() { return { shopId: '999000111', shopName: 'Shop Demo' }; },
    async searchItems(name = '') {
      await sleep(250);
      const q = name.trim().toLowerCase();
      return DEMO_PRODUCTS.filter((p) => !q || p.name.toLowerCase().includes(q));
    },
    async publish(_blob, _opts, onStep = () => {}) {
      const steps = ['Chuẩn bị upload (xin quyền upload)...', 'Đang tính checksum...'];
      for (const s of steps) { onStep(s); await sleep(400); }
      for (let p = 0; p <= 1; p += 0.25) { onStep('Đang upload video...', p); await sleep(300); }
      for (const s of ['Chờ Shopee xử lý video...', 'Tạo bài đăng...', 'Đăng video...', 'Lấy mã video...']) { onStep(s); await sleep(400); }
      return { mmsVid: 'demo_' + rand(8), videoId: String(2892400000000000 + Math.floor(Math.random() * 99999999)), duration: 16 };
    },
    async getMetrics() {
      await sleep(300);
      const v = Math.floor(Math.random() * 3000);
      return { viewCount: v, likeCount: Math.floor(v / 15), commentCount: Math.floor(v / 90), shareCount: Math.floor(v / 200), metricsSyncedAt: new Date().toISOString() };
    },
    async deleteVideo() { await sleep(200); return true; },
  };

  const api = new Proxy({}, { get: (_t, k) => (demo ? Demo : Real)[k] });

  window.Shopee = {
    api, setDemo, isDemo: () => demo, parseProductLink, imgUrl, MAX_PRODUCTS,
    links: {
      insight: (videoId) => `${SELLER}/creator-center/insight/video/${videoId}`,
      manage: `${SELLER}/creator-center/video-upload/manage/posted`,
      upload: `${SELLER}/creator-center/video-upload`,
      product: (shopId, itemId) => `${SHOPEE}/product/${shopId}/${itemId}`,
    },
    _test: { md5Hex, sha256Hex, decryptAccessKey },
  };
})();
