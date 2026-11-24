// TC Extension - nút "Tải toàn bộ SP" trên trang shop Shopee (shopee.vn/<tên shop>)
(() => {
  const RESERVED = new Set(['search', 'cart', 'user', 'mall', 'daily_discover', 'flash_sale', 'buyer', 'verify',
    'product', 'shop', 'checkout', 'order', 'notifications', 'me', 'm', 'seller', 'live', 'video']);

  function currentShop() {
    const path = decodeURIComponent(location.pathname);
    let m = path.match(/^\/shop\/(\d+)/);
    if (m) return { shopId: m[1] };
    m = path.match(/^\/([\w.\-]+)\/?$/);
    if (m && !RESERVED.has(m[1]) && !/-i\.\d+\.\d+$/.test(m[1])) return { username: m[1] };
    return null;
  }

  let box, btn, info;
  function ensureUi() {
    if (box) return;
    box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', right: '16px', bottom: '90px', zIndex: '2147483646',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px',
      font: '13px/1.4 Arial, sans-serif'
    });
    btn = document.createElement('button');
    btn.textContent = '📋 TC: Danh sách SP';
    btn.title = 'Mở danh sách toàn bộ sản phẩm của shop (ảnh chính + tên)';
    Object.assign(btn.style, {
      background: '#ee4d2d', color: '#fff', border: 'none', borderRadius: '6px',
      padding: '8px 14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.25)'
    });
    info = document.createElement('div');
    Object.assign(info.style, {
      display: 'none', maxWidth: '320px', background: '#fff', color: '#333', border: '1px solid #ddd',
      borderRadius: '6px', padding: '6px 10px', boxShadow: '0 2px 8px rgba(0,0,0,.15)'
    });
    btn.onclick = () => {
      // Mở trang danh sách sản phẩm của shop này
      chrome.runtime.sendMessage({ type: 'TC_OPEN_PANEL', url: location.href }, () => {
        if (chrome.runtime.lastError) show('Lỗi: ' + chrome.runtime.lastError.message + ' (tải lại trang F5)');
      });
    };
    box.append(info, btn);
    document.body.appendChild(box);
  }
  function show(text) {
    info.textContent = text;
    info.style.display = 'block';
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'TC_PROGRESS' && info) show(msg.text);
  });

  // Shopee là trang SPA: theo dõi đổi URL để hiện/ẩn nút
  function refresh() {
    const shop = currentShop();
    if (shop) { ensureUi(); box.style.display = 'flex'; }
    else if (box) box.style.display = 'none';
  }
  let last = '';
  setInterval(() => { if (location.href !== last) { last = location.href; refresh(); } }, 800);
  refresh();
})();

// ===== Tố cáo: tự mở form "Tố cáo" → chọn "Hàng giả, hàng nhái" → điền mô tả → tự động bấm "Gửi Tố Cáo".
// Chạy hoàn toàn tự động ngầm, không hiện thanh thông báo ở trên và không hiện nút nổi ở dưới.
(() => {
  const DEFAULT_TEMPLATES = [
    'Dùng trái phép nhãn hiệu, không được tôi ủy quyền',
    'Sản phẩm giả mạo nhãn hiệu, không có ủy quyền bán',
    'Hàng nhái thương hiệu, vi phạm sở hữu trí tuệ',
    'Hàng giả không rõ nguồn gốc, xâm phạm nhãn hiệu',
    'Mạo danh hàng chính hãng, chưa được tôi cho phép'
  ];
  const isProduct = () => /-i\.\d+\.\d+/.test(location.pathname) || /^\/product\/\d+\/\d+/.test(location.pathname);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeout = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(300);
    }
    return null;
  }

  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter ? setter.call(el, value) : (el.value = value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function triggerClick(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {}
    el.focus();
    el.click();
  }

  function say(text) {
    console.log('[TC Extension]', text);
  }

  // Thông báo nhỏ gọn ở góc dưới bên trái màn hình
  let badgeEl = null;
  function showBadge(html, bg = 'rgba(15, 23, 42, 0.92)') {
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      Object.assign(badgeEl.style, {
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: '2147483647',
        background: bg,
        color: '#ffffff',
        padding: '8px 14px',
        borderRadius: '24px',
        font: '600 13px/1.4 -apple-system, BlinkMacSystemFont, Arial, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'none',
        backdropFilter: 'blur(6px)',
        transition: 'all 0.25s ease'
      });
      document.body.appendChild(badgeEl);
    }
    badgeEl.style.background = bg;
    badgeEl.innerHTML = html;
    badgeEl.style.display = 'flex';
  }

  // Lăn chuột từ từ xuống dưới cùng như người dùng thật đang đọc sản phẩm
  async function humanScrollToBottom() {
    say('Đang lăn chuột xem sản phẩm giống người thật...');
    try {
      let currentY = window.scrollY || 0;
      const getScrollHeight = () => Math.max(
        document.body.scrollHeight || 0,
        document.documentElement.scrollHeight || 0,
        3000
      );

      // Cuộn từng nhịp tự nhiên xuống dưới
      let steps = 6 + Math.floor(Math.random() * 4); // 6 - 9 lần cuộn
      while (steps-- > 0) {
        const totalHeight = getScrollHeight();
        if (currentY >= totalHeight - 600) break;
        const delta = 400 + Math.floor(Math.random() * 300); // 400 - 700px mỗi lần
        currentY = Math.min(currentY + delta, totalHeight);
        window.scrollTo({ top: currentY, behavior: 'smooth' });
        await sleep(700 + Math.floor(Math.random() * 600)); // nghỉ 700 - 1300ms
      }

      // Cuộn xuống gần đáy và dừng lại 1-2s xem đánh giá/mô tả
      window.scrollTo({ top: getScrollHeight(), behavior: 'smooth' });
      await sleep(1200 + Math.floor(Math.random() * 800));

      // Cuộn nhẹ ngược lên đầu trang nơi có nút Tố cáo
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await sleep(1000);
    } catch (e) {
      console.warn('[TC] Lỗi lăn chuột:', e);
    }
  }

  async function fillReport() {
    // 1) Lăn chuột xuống đáy trang như người thật xem sản phẩm
    await humanScrollToBottom();

    const { tcReportText, tcAutoSend = true } = await chrome.storage.local.get(['tcReportText', 'tcAutoSend']);
    const raw = String(tcReportText || '').trim();
    const lines = raw ? raw.split('\n').map((l) => l.trim()).filter((l) => l.length >= 10) : [];
    const pool = lines.length ? lines : DEFAULT_TEMPLATES;
    // Chọn ngẫu nhiên 1 trong 5 nội dung
    let text = pool[Math.floor(Math.random() * pool.length)];
    say(`Đã chọn ngẫu nhiên nội dung: "${text}"`);
    say('Đang mở form tố cáo...');
    const btn = await waitFor(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tố cáo'));
    if (!btn) return say('Không tìm thấy nút "Tố cáo" trên trang');
    btn.click();
    const reason = await waitFor(() => [...document.querySelectorAll('li')].find((li) => /Hàng giả,\s*hàng nhái/i.test(li.textContent)));
    if (!reason) return say('Không thấy lý do "Hàng giả, hàng nhái"');
    reason.click();
    const ta = await waitFor(() => document.querySelector('textarea'));
    if (!ta) return say('Không thấy ô mô tả tố cáo');
    const max = ta.maxLength > 0 ? ta.maxLength : 50;
    if (text.length > max) text = text.slice(0, max).trim();
    ta.focus();
    setNativeValue(ta, text);

    const send = await waitFor(() => {
      const b = [...document.querySelectorAll('button')].find((btn) => /Gửi Tố Cáo/i.test(btn.textContent));
      return b && !b.disabled ? b : null;
    }, 4000) || [...document.querySelectorAll('button')].find((b) => /Gửi Tố Cáo/i.test(b.textContent));

    if (!send) return say('Không thấy nút "Gửi Tố Cáo"');

    const isQueue = new URLSearchParams(location.search).get('tc_q') === '1';
    let queueWatcher = null;
    if (isQueue) queueWatcher = watchQueue(send);

    if (tcAutoSend !== false) {
      say('Đã chọn lý do & điền mô tả. Chờ 1.5s rồi tự động bấm "Gửi Tố Cáo"...');
      await sleep(1500);
      triggerClick(send);
      if (queueWatcher) queueWatcher.markClicked();
      say('Đã tự động bấm "Gửi Tố Cáo"!');
      if (!isQueue) {
        showBadge('✅ Đã khiếu nại sản phẩm thành công!', '#16a34a');
        setTimeout(() => { if (badgeEl) badgeEl.style.display = 'none'; }, 4000);
      }
    }
  }

  // Chế độ lần lượt: tự động bấm "Gửi Tố Cáo" -> khi form đóng thì nghỉ giữa các SP rồi sang SP tiếp theo
  function watchQueue(send) {
    let moving = false;
    let clicked = false;
    let timer = null;

    chrome.runtime.sendMessage({ type: 'TC_QUEUE_STATUS' }).then((st) => {
      if (!st || !st.active) return;
      showBadge(`🚩 Đang khiếu nại SP: <b>${st.pos}/${st.total}</b> (Đã xong: <b>${st.done || 0}</b>)`);

      const next = (skipped) => {
        if (moving) return;
        moving = true;
        if (timer) clearInterval(timer);
        chrome.runtime.sendMessage({ type: 'TC_QUEUE_NEXT', skipped }).then((r) => {
          if (r && r.finished) {
            showBadge(`✅ Hoàn thành: Đã khiếu nại xong <b>${r.done}/${st.total}</b> SP!`, '#16a34a');
            say(`Xong hàng đợi — đã gửi ${r.done}, bỏ qua ${r.skipped}.`);
          }
        }).catch(() => {});
      };

      timer = setInterval(async () => {
        if (moving) return clearInterval(timer);
        // Đã bấm Gửi và form tố cáo đã đóng -> nghỉ giữa các sản phẩm theo khoảng thời gian tùy chỉnh
        if (clicked && !document.querySelector('textarea')) {
          clearInterval(timer);
          const doneCount = (st.done || 0) + 1;
          if (st.pos >= st.total) {
            showBadge(`✅ Hoàn thành: Đã khiếu nại xong <b>${doneCount}/${st.total}</b> SP!`, '#16a34a');
            setTimeout(() => next(false), 1500);
            return;
          }
          const { tcMinDelay, tcMaxDelay } = await chrome.storage.local.get(['tcMinDelay', 'tcMaxDelay']).catch(() => ({}));
          const min = Math.max(1, Number(tcMinDelay) || 20);
          const max = Math.max(min, Number(tcMaxDelay) || 40);
          const waitSec = Math.floor(min + Math.random() * (max - min + 1));
          let remain = waitSec;
          showBadge(`⏳ Đã khiếu nại: <b>${doneCount}/${st.total}</b> SP · Nghỉ <b>${remain}s</b> sang SP ${st.pos + 1}`);
          const countTimer = setInterval(() => {
            remain--;
            if (remain > 0) {
              showBadge(`⏳ Đã khiếu nại: <b>${doneCount}/${st.total}</b> SP · Nghỉ <b>${remain}s</b> sang SP ${st.pos + 1}`);
            } else {
              clearInterval(countTimer);
            }
          }, 1000);
          say(`Đã gửi tố cáo. Đang nghỉ ngẫu nhiên ${waitSec} giây (${min}s - ${max}s) trước khi mở SP tiếp theo...`);
          setTimeout(() => next(false), waitSec * 1000);
        }
      }, 500);
    }).catch(() => {});

    if (send) send.addEventListener('click', () => { clicked = true; }, true);

    return {
      markClicked: () => { clicked = true; }
    };
  }

  // Tự chạy khi mở từ trang danh sách (?tc_report=1)
  let lastUrl = '';
  setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    if (isProduct() && new URLSearchParams(location.search).get('tc_report') === '1') {
      setTimeout(fillReport, 2000);
    }
  }, 800);
})();
