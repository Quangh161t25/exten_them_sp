// Cầu nối: chạy fetch bên trong tab Shopee (world MAIN) để dùng đúng cookie đăng nhập,
// origin và header mà trang Shopee tự gắn. Gọi thẳng từ extension dễ bị chặn anti-bot.
(() => {
  const ORIGINS = {
    shopee: { match: 'https://shopee.vn/*', open: 'https://shopee.vn/' },
    seller: { match: 'https://banhang.shopee.vn/*', open: 'https://banhang.shopee.vn/creator-center/video-upload/manage/posted' },
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function waitComplete(tabId, timeout = 40000) {
    return new Promise((resolve) => {
      const timer = setTimeout(done, timeout);
      function done() { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(l); resolve(); }
      function l(id, info) { if (id === tabId && info.status === 'complete') done(); }
      chrome.tabs.onUpdated.addListener(l);
      chrome.tabs.get(tabId).then((t) => t.status === 'complete' && done()).catch(done);
    });
  }

  const isLoginUrl = (u) => /\/account\/signin|accounts\.shopee|\/buyer\/login|\/verify\//.test(u || '');

  async function getTab(kind) {
    const o = ORIGINS[kind];
    const tabs = await chrome.tabs.query({ url: o.match });
    let tab = tabs.find((t) => t.status === 'complete' && !isLoginUrl(t.url)) || tabs.find((t) => !isLoginUrl(t.url));
    if (!tab) {
      tab = await chrome.tabs.create({ url: o.open, active: false });
      await waitComplete(tab.id);
      await sleep(2500); // chờ SDK của trang khởi tạo
      tab = await chrome.tabs.get(tab.id);
    } else if (tab.status !== 'complete') {
      await waitComplete(tab.id);
      tab = await chrome.tabs.get(tab.id);
    }
    if (isLoginUrl(tab.url) || !tab.url.startsWith(o.open.split('/').slice(0, 3).join('/'))) {
      chrome.tabs.update(tab.id, { active: true });
      throw new Error(kind === 'seller'
        ? 'NEED_SELLER_LOGIN: Hãy đăng nhập Kênh Người Bán (banhang.shopee.vn) trong tab vừa mở rồi thử lại.'
        : 'NEED_LOGIN: Hãy đăng nhập shopee.vn trong tab vừa mở rồi thử lại.');
    }
    return tab;
  }

  async function exec(kind, func, args) {
    const tab = await getTab(kind);
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func, args });
    if (!r) throw new Error('NO_RESULT');
    return r.result;
  }

  // ---- Các hàm dưới đây được inject vào trang (phải tự chứa, không dùng biến ngoài) ----
  async function pageFetch(req) {
    const headers = { accept: 'application/json, text/plain, */*', ...(req.headers || {}) };
    const opts = { method: req.method || 'GET', headers, credentials: 'include' };
    if (req.body !== undefined && req.body !== null) {
      opts.body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
      const m = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
      if (m && req.csrf) headers['x-csrftoken'] = m[1];
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

  function pageBufInit(jobId) { window.__svxBuf = window.__svxBuf || {}; window.__svxBuf[jobId] = []; return true; }

  function pageBufPush(jobId, b64) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    window.__svxBuf[jobId].push(u8);
    return window.__svxBuf[jobId].length;
  }

  async function pageBufPut(jobId, url, headers, contentType) {
    const parts = (window.__svxBuf || {})[jobId] || [];
    delete window.__svxBuf[jobId];
    try {
      const res = await fetch(url, { method: 'PUT', headers, body: new Blob(parts, { type: contentType }) });
      return { ok: res.ok, status: res.status, text: res.ok ? '' : (await res.text()).slice(0, 300) };
    } catch (e) {
      return { ok: false, status: 0, error: String(e) };
    }
  }

  function toB64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  const Bridge = {
    getTab,
    async fetch(kind, req) {
      const r = await exec(kind, pageFetch, [req]);
      if (!r) throw new Error('NO_RESULT');
      if (r.error) throw new Error('NETWORK: ' + r.error);
      return r;
    },
    /** Đưa bytes vào tab theo từng mảnh rồi PUT từ trong tab */
    async putBytes(kind, url, headers, buffer, contentType, onProgress) {
      const jobId = 'j' + Date.now();
      await exec(kind, pageBufInit, [jobId]);
      const u8 = new Uint8Array(buffer);
      const CH = 2 * 1024 * 1024;
      for (let off = 0; off < u8.length; off += CH) {
        await exec(kind, pageBufPush, [jobId, toB64(u8.subarray(off, off + CH))]);
        onProgress && onProgress(Math.min(1, (off + CH) / u8.length));
      }
      return exec(kind, pageBufPut, [jobId, url, headers, contentType]);
    },
    async getCookie(url, name) {
      try { const c = await chrome.cookies.get({ url, name }); return c ? c.value : ''; } catch { return ''; }
    },
  };

  window.Bridge = Bridge;
})();
