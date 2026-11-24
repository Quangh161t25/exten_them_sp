// Lưu trữ cục bộ: chiến dịch, video, cài đặt (chrome.storage.local) + file video (IndexedDB)
(() => {
  // Khi mở trang ngoài extension (xem thử giao diện) thì giả lập chrome.storage bằng localStorage
  const HAS_EXT = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const area = HAS_EXT ? chrome.storage.local : {
    async get(keys) {
      const out = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
        try { const v = localStorage.getItem('svx:' + k); if (v != null) out[k] = JSON.parse(v); } catch {}
      });
      return out;
    },
    async set(obj) {
      Object.entries(obj).forEach(([k, v]) => { try { localStorage.setItem('svx:' + k, JSON.stringify(v)); } catch {} });
    },
  };

  const K = { campaigns: 'svx_campaigns', items: 'svx_items', settings: 'svx_settings' };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => new Date().toISOString();

  async function read(key, def) { const r = await area.get(key); return r[key] ?? def; }
  async function write(key, val) { await area.set({ [key]: val }); }

  // Hàng đợi ghi để tránh 2 thao tác đè nhau
  let chain = Promise.resolve();
  const serial = (fn) => (chain = chain.then(fn, fn));

  const Store = {
    HAS_EXT,
    uid,

    async getSettings() {
      const s = await read(K.settings, {});
      return { demoMode: !HAS_EXT, ...s, ...(HAS_EXT ? {} : { demoMode: true }) };
    },
    saveSettings(patch) {
      return serial(async () => write(K.settings, { ...(await read(K.settings, {})), ...patch }));
    },

    // ---- Chiến dịch ----
    async listCampaigns(shopId) {
      const all = await read(K.campaigns, []);
      return all.filter((c) => !shopId || `${c.shopId}` === `${shopId}`)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },
    createCampaign({ name, shopId, shopName }) {
      return serial(async () => {
        const all = await read(K.campaigns, []);
        const c = { id: uid(), name: name.trim(), shopId: `${shopId}`, shopName: shopName || '', createdAt: now() };
        all.push(c);
        await write(K.campaigns, all);
        return c;
      });
    },
    renameCampaign(id, name) {
      return serial(async () => {
        const all = await read(K.campaigns, []);
        const c = all.find((x) => x.id === id);
        if (c) c.name = name.trim();
        await write(K.campaigns, all);
        return c || null;
      });
    },
    removeCampaign(id) {
      return serial(async () => {
        await write(K.campaigns, (await read(K.campaigns, [])).filter((c) => c.id !== id));
        const items = await read(K.items, []);
        const drop = items.filter((i) => i.campaignId === id);
        await write(K.items, items.filter((i) => i.campaignId !== id));
        await Promise.all(drop.map((i) => Blobs.remove(i.id).catch(() => {})));
        return true;
      });
    },

    // ---- Video ----
    async listItems(campaignId) {
      const all = await read(K.items, []);
      return all.filter((i) => !campaignId || i.campaignId === campaignId)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },
    async getItem(id) { return (await read(K.items, [])).find((i) => i.id === id) || null; },
    createItem(data) {
      return serial(async () => {
        const all = await read(K.items, []);
        const it = {
          id: uid(), status: 'pending', createdAt: now(), caption: '', products: [],
          source: 'shopee', sourceUrl: '', ...data,
        };
        all.push(it);
        await write(K.items, all);
        return it;
      });
    },
    updateItem(id, patch) {
      return serial(async () => {
        const all = await read(K.items, []);
        const it = all.find((i) => i.id === id);
        if (!it) return null;
        Object.assign(it, patch, { updatedAt: now() });
        await write(K.items, all);
        return it;
      });
    },
    removeItem(id) {
      return serial(async () => {
        await write(K.items, (await read(K.items, [])).filter((i) => i.id !== id));
        await Blobs.remove(id).catch(() => {});
        return true;
      });
    },

    async stats(shopId) {
      const camps = await Store.listCampaigns(shopId);
      const ids = new Set(camps.map((c) => c.id));
      const items = (await read(K.items, [])).filter((i) => ids.has(i.campaignId));
      return {
        campaigns: camps.length,
        items: items.length,
        done: items.filter((i) => i.status === 'done').length,
        error: items.filter((i) => i.status === 'error').length,
        pending: items.filter((i) => i.status !== 'done' && i.status !== 'error').length,
      };
    },

    // Dữ liệu mẫu để thử giao diện
    async seedDemo(shopId, shopName) {
      const c1 = await Store.createCampaign({ name: 'Khuyến mãi 11.11', shopId, shopName });
      const c2 = await Store.createCampaign({ name: 'Đồ gia dụng', shopId, shopName });
      const p = (id, name, price, stock) => ({ itemId: `${id}`, name, cover: '', snapshot: { minPrice: price, maxPrice: price, stock, status: 1 } });
      const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
      await Store.createItem({
        campaignId: c1.id, caption: 'Máy sấy tóc 2 chế độ nóng lạnh, bảo vệ tóc suôn mượt', status: 'done',
        sourceUrl: 'demo', products: [p(101, 'Máy sấy tóc SKH-01', 289000, 120)], mmsVid: 'demo_vid_1',
        videoId: '2892422635324640', postedAt: ago(60), duration: 33, viewCount: 1534, likeCount: 87,
        commentCount: 12, shareCount: 5, metricsSyncedAt: ago(20),
      });
      await Store.createItem({
        campaignId: c1.id, caption: 'Nồi áp suất inox 6L dùng mọi loại bếp', status: 'error',
        errorMsg: 'putBytes: HTTP 403', sourceUrl: 'demo', products: [p(102, 'Nồi áp suất 6L', 1169000, 40), p(103, 'Quánh inox 18cm', 744000, 80)],
      });
      await Store.createItem({
        campaignId: c1.id, caption: 'Máy làm sữa hạt 1.7L chống ồn', status: 'pending', sourceUrl: 'demo',
        products: [p(104, 'Máy làm sữa hạt 1.7L', 859000, 2000)],
      });
      await Store.createItem({ campaignId: c2.id, caption: 'Chảo chống dính 26cm', status: 'pending', sourceUrl: 'demo', products: [] });
    },
  };

  // ---- IndexedDB: giữ file video người dùng chọn từ máy để đăng lại được ----
  const DB = 'svx_video_files';
  function openDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function tx(mode, fn) {
    const db = await openDb();
    try {
      return await new Promise((res, rej) => {
        const t = db.transaction('files', mode);
        const req = fn(t.objectStore('files'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      });
    } finally { db.close(); }
  }
  const Blobs = {
    put: (id, blob) => tx('readwrite', (s) => s.put(blob, id)),
    get: (id) => tx('readonly', (s) => s.get(id)),
    remove: (id) => tx('readwrite', (s) => s.delete(id)),
  };

  window.Store = Store;
  window.Blobs = Blobs;
})();
