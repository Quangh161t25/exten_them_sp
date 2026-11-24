// Shop Spy - background service worker
// Mọi request tới API Shopee được chạy bên trong một tab shopee.vn (world MAIN),
// để dùng đúng cookie + header chống bot mà trang Shopee tự gắn vào fetch.

const SHOPEE = 'https://shopee.vn';

async function findShopeeTab() {
  const tabs = await chrome.tabs.query({ url: SHOPEE + '/*' });
  return tabs.find((t) => t.status === 'complete' && !t.url.includes('/verify/')) || tabs[0] || null;
}

function waitTabComplete(tabId, timeout = 30000) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeout);
    function done() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') done();
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => t.status === 'complete' && done()).catch(done);
  });
}

async function getShopeeTab() {
  let tab = await findShopeeTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url: SHOPEE, active: false });
    await waitTabComplete(tab.id);
    await new Promise((r) => setTimeout(r, 2000)); // chờ SDK của Shopee khởi tạo
  } else if (tab.status !== 'complete') {
    await waitTabComplete(tab.id);
  }
  return tab;
}

// Hàm này được inject vào trang shopee.vn (world MAIN)
async function pageFetch(url, method, body) {
  const getCsrf = () => {
    const m = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
    return m ? m[1] : '';
  };
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-api-source': 'pc',
    'x-requested-with': 'XMLHttpRequest',
    'x-shopee-language': 'vi',
  };
  const opts = { method, headers, credentials: 'include' };
  if (method === 'POST') {
    opts.body = JSON.stringify(body || {});
    const csrf = getCsrf();
    if (csrf) headers['x-csrftoken'] = csrf;
  }
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
      return { ok: false, status: res.status, error: 'INVALID_JSON' };
    }
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

async function shopeeRequest({ url, method = 'GET', body = null }) {
  const tab = await getShopeeTab();
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: pageFetch,
    args: [url, method, body],
  });
  return result ? result.result : { ok: false, error: 'NO_RESULT' };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'SHOPEE_REQUEST') {
    shopeeRequest(msg.payload)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true;
  }
  if (msg && msg.type === 'OPEN_SPY') {
    const q = new URLSearchParams(msg.query || {}).toString();
    chrome.tabs.create({ url: chrome.runtime.getURL('spy.html') + (q ? '?' + q : '') });
    sendResponse({ ok: true });
  }
  return false;
});
