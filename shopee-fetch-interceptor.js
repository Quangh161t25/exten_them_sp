/**
 * shopee-fetch-interceptor.js
 * Được inject trực tiếp vào trang Shopee (buyer) dưới dạng <script> tag.
 * Mục đích: Chặn (intercept) các request fetch của trang và lưu lại headers/cookies thật
 * để content script có thể replay lại request với đúng authentication.
 */
(function () {
  const CHANNEL_INTERCEPT = 'SPLQ_FETCH_INTERCEPTED';
  const CHANNEL_FETCH_REQUEST = 'SPLQ_FETCH_REQUEST';
  const CHANNEL_FETCH_REPLY = 'SPLQ_FETCH_REPLY';

  // Lắng nghe yêu cầu fetch từ content script
  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.channel !== CHANNEL_FETCH_REQUEST) return;
    const { messageId, url, headers } = e.data;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: headers || {},
        credentials: 'include'
      });
      const json = await res.json();
      window.postMessage({ channel: CHANNEL_FETCH_REPLY, messageId, data: json }, '*');
    } catch (err) {
      window.postMessage({ channel: CHANNEL_FETCH_REPLY, messageId, data: null, error: err.message }, '*');
    }
  });

  // Chặn fetch để bắt các request đến Shopee API
  const originalFetch = window.fetch;
  const capturedRequests = {};

  const patchedFetch = async function (...args) {
    const result = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('/api/') && (url.includes('item_id') || url.includes('shop_id') || url.includes('/pdp/'))) {
        const cloned = result.clone();
        cloned.json().then(json => {
          // Lấy headers từ request options (nếu có)
          let reqHeaders = args[1]?.headers || {};
          if (reqHeaders instanceof Headers) {
            const h = {};
            reqHeaders.forEach((val, key) => { h[key] = val; });
            reqHeaders = h;
          } else if (Array.isArray(reqHeaders)) {
            const h = {};
            reqHeaders.forEach(([key, val]) => { h[key] = val; });
            reqHeaders = h;
          }
          window.postMessage({
            channel: CHANNEL_INTERCEPT,
            url: url,
            headers: reqHeaders,
            data: json
          }, '*');
        }).catch(() => {});
      }
    } catch (_) {}
    return result;
  };

  Object.defineProperty(window, 'fetch', {
    configurable: true,
    get() { return patchedFetch; },
    set(newFetch) {
      // Khi Shopee thay thế fetch, vẫn wrap lại
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        get() { return async function (...args) {
          const result = await newFetch.apply(this, args);
          try {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            if (url.includes('/api/') && (url.includes('item_id') || url.includes('shop_id') || url.includes('/pdp/'))) {
              const cloned = result.clone();
              cloned.json().then(json => {
                window.postMessage({ channel: CHANNEL_INTERCEPT, url, headers: args[1]?.headers || {}, data: json }, '*');
              }).catch(() => {});
            }
          } catch (_) {}
          return result;
        }; }
      });
    }
  });
})();
