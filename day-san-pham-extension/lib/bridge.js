// Cầu nối: chạy fetch bên trong tab Shopee (world MAIN) để dùng đúng cookie đăng nhập và origin của trang.
// Dùng được cả ở service worker (background) lẫn trang của extension.
(() => {
  const ORIGINS = {
    seller: { match: 'https://banhang.shopee.vn/*', base: 'https://banhang.shopee.vn', open: 'https://banhang.shopee.vn/portal/settings/shop/rating' },
    shopee: { match: 'https://shopee.vn/*', base: 'https://shopee.vn', open: 'https://shopee.vn/' },
  };
  const HAS_EXT = typeof chrome !== 'undefined' && !!(chrome.scripting && chrome.tabs);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isLoginUrl = (u) => /\/account\/signin|accounts\.shopee|\/buyer\/login|\/verify\/|\/login\b/.test(u || '');

  function waitComplete(tabId, timeout = 40000) {
    return new Promise((resolve) => {
      const timer = setTimeout(done, timeout);
      function done() { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(l); resolve(); }
      function l(id, info) { if (id === tabId && info.status === 'complete') done(); }
      chrome.tabs.onUpdated.addListener(l);
      chrome.tabs.get(tabId).then((t) => t.status === 'complete' && done()).catch(done);
    });
  }

  // Tránh mở nhiều tab cùng lúc khi nhiều lệnh gọi song song
  const opening = {};
  async function getTab(kind) {
    if (opening[kind]) return opening[kind];
    opening[kind] = (async () => {
      const o = ORIGINS[kind];
      const tabs = await chrome.tabs.query({ url: o.match });
      let tab = tabs.find((t) => t.status === 'complete' && !isLoginUrl(t.url)) || tabs.find((t) => !isLoginUrl(t.url));
      if (!tab) {
        tab = await chrome.tabs.create({ url: o.open, active: false, pinned: kind === 'seller' });
        await waitComplete(tab.id);
        await sleep(2000);
        tab = await chrome.tabs.get(tab.id);
      } else if (tab.status !== 'complete') {
        await waitComplete(tab.id);
        tab = await chrome.tabs.get(tab.id);
      }
      if (isLoginUrl(tab.url) || !String(tab.url).startsWith(o.base)) {
        throw new Error(kind === 'seller'
          ? 'NEED_LOGIN: Chưa đăng nhập Kênh Người Bán. Hãy mở banhang.shopee.vn, đăng nhập rồi thử lại.'
          : 'NEED_LOGIN: Hãy mở shopee.vn và đăng nhập rồi thử lại.');
      }
      return tab;
    })();
    try { return await opening[kind]; } finally { delete opening[kind]; }
  }

  async function exec(kind, func, args) {
    const tab = await getTab(kind);
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func, args });
    if (!r) throw new Error('NO_RESULT');
    return r.result;
  }

  // ---- Hàm được inject vào trang (phải tự chứa, không dùng biến bên ngoài) ----
  async function pageFetch(req) {
    const headers = { accept: 'application/json, text/plain, */*', ...(req.headers || {}) };
    const opts = { method: req.method || 'GET', headers, credentials: 'include' };
    if (req.form) {
      const fd = new FormData();
      const bin = atob(req.form.b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      fd.append(req.form.field || 'file', new Blob([u8], { type: req.form.type || 'image/jpeg' }), req.form.name || 'image.jpg');
      opts.body = fd;
      delete headers['content-type'];
    } else if (req.body !== undefined && req.body !== null) {
      opts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!headers['content-type']) headers['content-type'] = 'application/json';
    }
    try {
      const res = await fetch(req.url, opts);
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch {}
      return { ok: res.ok, status: res.status, data, text: data ? '' : text.slice(0, 300) };
    } catch (e) {
      return { ok: false, status: 0, error: String(e) };
    }
  }

  async function pageSha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function getCookie(kind, name) {
    try { const c = await chrome.cookies.get({ url: ORIGINS[kind].base + '/', name }); return c ? c.value : ''; } catch { return ''; }
  }

  const Bridge = {
    HAS_EXT,
    ORIGINS,
    getTab,
    getCookie,
    /** req: { path|url, method, query, body, headers, form } */
    async fetch(kind, req) {
      const o = ORIGINS[kind];
      const u = new URL(req.url || o.base + req.path);
      Object.entries(req.query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v); });
      const r = await exec(kind, pageFetch, [{ ...req, url: u.toString() }]);
      if (!r) throw new Error('NO_RESULT');
      if (r.error) throw new Error('Lỗi mạng: ' + r.error);
      if (r.status === 401 || r.status === 403) {
        throw new Error('NEED_LOGIN: Phiên đăng nhập Shopee hết hạn hoặc bị chặn (HTTP ' + r.status + '). Hãy mở lại Kênh Người Bán.');
      }
      return r;
    },
    sha256: (s) => exec('seller', pageSha256, [s]),
  };

  self.Bridge = Bridge;
})();
