// Lưu trữ cục bộ (chrome.storage.local). Ngoài extension (xem thử giao diện) thì dùng localStorage.
(() => {
  const HAS_EXT = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
  const area = HAS_EXT ? chrome.storage.local : {
    async get(keys) {
      const out = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
        try { const v = localStorage.getItem('ssa:' + k); if (v != null) out[k] = JSON.parse(v); } catch {}
      });
      return out;
    },
    async set(obj) { Object.entries(obj).forEach(([k, v]) => { try { localStorage.setItem('ssa:' + k, JSON.stringify(v)); } catch {} }); },
    async remove(k) { try { localStorage.removeItem('ssa:' + k); } catch {} },
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD theo giờ máy

  async function read(key, def) { const r = await area.get(key); return r[key] ?? def; }
  async function write(key, val) { await area.set({ [key]: val }); }

  // Ghi tuần tự trong cùng 1 ngữ cảnh để tránh đè nhau
  let chain = Promise.resolve();
  const serial = (fn) => (chain = chain.then(fn, fn));
  const patchKey = (key, def, fn) => serial(async () => { const v = fn(await read(key, def)); await write(key, v); return v; });

  const DEFAULTS = {
    settings: { demo: !HAS_EXT, boost: {}, closeConversation: true },
    push: {
      enabled: false, items: [], from: '08:00', to: '23:00', days: [0, 1, 2, 3, 4, 5, 6],
      maxActive: 5, durationHours: 4, lastBoost: {}, nextIndex: 0, lastRun: 0, lastError: '',
    },
    reply: {
      enabled: false, stars: [5, 4], intervalMin: 30, perRun: 30, delayMs: 800,
      text: 'Shop cảm ơn {ten} đã đánh giá {sao} sao cho Shop, hãy tiếp tục ủng hộ Shop nhé ❤️',
      chat: '', lastRun: 0, lastError: '',
    },
    rate: {
      enabled: false, star: 5, intervalMin: 60, perRun: 50, pages: 3, delayMs: 500,
      text: 'Shop chân thành cảm ơn quý khách ❤️', chat: '', lastRun: 0, lastError: '',
    },
  };

  const Store = {
    HAS_EXT, uid, today, DEFAULTS,
    read, write,

    async getSettings() { const s = { ...DEFAULTS.settings, ...(await read('settings', {})) }; if (!HAS_EXT) s.demo = true; return s; },
    saveSettings: (p) => patchKey('settings', {}, (s) => ({ ...s, ...p })),

    async getConfig(name) { return { ...DEFAULTS[name], ...(await read('cfg_' + name, {})) }; },
    saveConfig: (name, p) => patchKey('cfg_' + name, {}, (s) => ({ ...s, ...p })),

    // ---- Nhật ký từng tính năng (tối đa 400 dòng) ----
    async getLog(name) { return read('log_' + name, []); },
    addLog: (name, type, msg) => patchKey('log_' + name, [], (l) => { l.unshift({ t: Date.now(), type, msg }); return l.slice(0, 400); }),
    clearLog: (name) => serial(() => write('log_' + name, [])),

    // ---- Thống kê ----
    async getStats() { return read('stats', {}); },
    bump: (name, field = 'ok', n = 1) => patchKey('stats', {}, (s) => {
      const d = today();
      const x = s[name] || {};
      if (x.date !== d) { x.date = d; x.todayOk = 0; x.todayFail = 0; }
      x[field] = (x[field] || 0) + n;
      if (field === 'ok') x.todayOk += n;
      if (field === 'fail') x.todayFail += n;
      s[name] = x;
      return s;
    }),

    // ---- Đơn đã đánh giá / đánh giá đã trả lời (để lần quét sau bỏ qua) ----
    async getDone(name) { return read('done_' + name, {}); },
    markDone: (name, ids) => patchKey('done_' + name, {}, (m) => {
      const t = Date.now();
      [].concat(ids).forEach((id) => { m[id] = t; });
      const keys = Object.keys(m);
      if (keys.length > 20000) keys.sort((a, b) => m[a] - m[b]).slice(0, keys.length - 15000).forEach((k) => delete m[k]);
      return m;
    }),

    // ---- Khoá chạy (tránh tab và background chạy cùng 1 việc) ----
    async lock(name, ttlMs = 10 * 60e3) {
      return serial(async () => {
        const k = 'lock_' + name;
        const v = await read(k, 0);
        if (v && Date.now() - v < ttlMs) return false;
        await write(k, Date.now());
        return true;
      });
    },
    unlock: (name) => serial(() => write('lock_' + name, 0)),
    touchLock: (name) => serial(() => write('lock_' + name, Date.now())),
    async isLocked(name, ttlMs = 10 * 60e3) { const v = await read('lock_' + name, 0); return !!v && Date.now() - v < ttlMs; },

    // ---- Chiến dịch gửi tin nhắn ----
    async listCampaigns() { return (await read('campaigns', [])).sort((a, b) => b.createdAt - a.createdAt); },
    async getCampaign(id) { return (await read('campaigns', [])).find((c) => c.id === id) || null; },
    createCampaign: (name) => patchKey('campaigns', [], (all) => {
      all.push({
        id: uid(), name, status: 'pending', createdAt: Date.now(),
        config: { delaySec: 5, pauseAfter: 10, pauseSec: 60, cooldownMin: 1440, maxSend: 100 },
        contents: [{ type: 'sticker', text: '', payload: { stickerId: '0029', stickerPackage: 'shrimp_vn_new' } }, { type: 'text', text: 'Xin chào {ten}, Shop gửi bạn ưu đãi mới nhé!', payload: {} }],
      });
      return all;
    }).then((all) => all[all.length - 1]),
    updateCampaign: (id, p) => patchKey('campaigns', [], (all) => all.map((c) => (c.id === id ? { ...c, ...p } : c))),
    async removeCampaign(id) {
      await patchKey('campaigns', [], (all) => all.filter((c) => c.id !== id));
      await serial(() => area.remove ? area.remove('cust_' + id) : write('cust_' + id, []));
    },

    async getCustomers(cid) { return read('cust_' + cid, []); },
    saveCustomers: (cid, list) => serial(() => write('cust_' + cid, list)),
    /** Thêm khách, bỏ trùng. Trả { added, skipped } */
    addCustomers: async (cid, list) => {
      let added = 0, skipped = 0;
      await patchKey('cust_' + cid, [], (cur) => {
        const seen = new Set(cur.map((c) => c.key));
        list.forEach((c) => {
          const key = c.userId ? `u${c.userId}` : `n${String(c.username).toLowerCase()}`;
          if (seen.has(key)) { skipped++; return; }
          seen.add(key);
          cur.push({ key, userId: Number(c.userId) || 0, username: c.username || '', name: c.name || c.username || String(c.userId), source: c.source || 'import', active: true, status: 'pending', error: '', sentAt: 0, addedAt: Date.now() });
          added++;
        });
        return cur;
      });
      return { added, skipped };
    },
    updateCustomer: (cid, key, p) => patchKey('cust_' + cid, [], (l) => l.map((c) => (c.key === key ? { ...c, ...p } : c))),

    // ---- Lần gửi gần nhất cho mỗi khách (chống gửi trùng giữa các chiến dịch) ----
    async lastSent(shopId, userId) { const m = await read('sent_at', {}); return m[`${shopId}:${userId}`] || 0; },
    setLastSent: (shopId, userId) => patchKey('sent_at', {}, (m) => { m[`${shopId}:${userId}`] = Date.now(); return m; }),

    onChange(fn) { if (HAS_EXT && chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch, a) => a === 'local' && fn(ch)); },
  };

  self.Store = Store;
})();
