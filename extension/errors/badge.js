// Nút "⚠️ Lỗi hôm nay (n)" trên panel: đếm lỗi trong ngày, bấm mở trang Lỗi
(() => {
  const btn = document.getElementById('qlsp-err-btn');
  if (!btn) return;
  const KEY = 'qlsp_errors';
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function paint(list) {
    const n = (list || []).filter((x) => x.at >= today()).length;
    btn.textContent = n ? `⚠️ Lỗi hôm nay (${n})` : '✔ Không có lỗi hôm nay';
    btn.style.background = n ? '#fee2e2' : '#f0fdf4';
    btn.style.color = n ? '#b91c1c' : '#15803d';
    btn.style.borderColor = n ? '#fca5a5' : '#bbf7d0';
  }
  chrome.storage.local.get(KEY, (r) => paint(r[KEY]));
  chrome.storage.onChanged.addListener((c, a) => { if (a === 'local' && c[KEY]) paint(c[KEY].newValue); });
  btn.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('extension/errors/errors.html') });
})();
