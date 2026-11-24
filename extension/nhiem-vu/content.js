// Nhiệm vụ Người Bán – Shopee
// 1) Trên Kênh Người Bán: nút "Nhiệm vụ" mở danh sách nhiệm vụ + phần thưởng, bấm để làm / nhận.
// 2) Trên trang khóa học Shopee Uni mở từ danh sách: tự đọc chậm từng chuyên đề tới khi đủ dấu ✓.
(() => {
  if (window.__nhiemVu) return;
  window.__nhiemVu = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cds = () => (document.cookie.match(/(?:^|;\s*)SPC_CDS=([^;]+)/) || [])[1] || '';
  const post = async (path, body) =>
    (await fetch(`${path}?SPC_CDS=${cds()}&SPC_CDS_VER=2`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}),
    })).json();

  // Tên nhiệm vụ Shopee trả về dạng khóa dịch; đây là các khóa đã gặp.
  const NAMES = {
    be_seller_mission_name_10: (a) => `Đăng hàng loạt ${a} sản phẩm`,
    be_seller_mission_name_14: () => 'Hoàn thành khóa học Hiệu quả vận hành',
    be_seller_mission_name_33: () => 'Hoàn thành khóa học Đạt được đơn hàng đầu tiên của bạn',
    be_seller_mission_name_39: () => 'Hoàn thành khóa học Bán hàng trên Shopee',
    be_seller_mission_name_50: () => 'Hoàn thành khóa học Bắt đầu',
    be_seller_mission_name_53: () => 'Hoàn thành khóa học Thiết lập thông tin cửa hàng',
    be_seller_mission_name_52: () => 'Truy cập trang Dịch vụ Hiển thị Shopee',
    be_seller_mission_name_16: () => 'Tạo 1 chương trình khuyến mãi',
    be_seller_mission_name_15: () => 'Tạo 1 Mã giảm giá của tôi',
    be_seller_mission_name_18: () => 'Trang trí Shop cơ bản (di động)',
    be_seller_mission_name_9: (a) => `Đăng tải video cho ${a} sản phẩm`,
    be_seller_mission_name_28: () => 'Tạo 1 chương trình Mua Kèm Deal Sốc',
    be_seller_mission_name_3: (a) => `Livestream tối thiểu ${a} phút`,
  };
  // Khóa học đã biết của các nhiệm vụ (khi pcUrl không trỏ thẳng tới khóa học)
  const COURSES = { 501024: 233, 501023: 93, 501022: 277, 501021: null, 501025: null };
  const missionName = (m) => {
    const n = m.missionName || {};
    const f = NAMES[n.key];
    return f ? f(n.amount) : `Nhiệm vụ #${m.missionId}`;
  };
  const rewardText = (rs) => (rs || []).map((r) => {
    const a = r.rewardName?.amount;
    if (r.rewardType === 1) return `${(+a).toLocaleString('vi-VN')}đ phí quảng cáo`;
    if (r.rewardType === 3) return `${a} lần Đẩy sản phẩm`;
    if (r.rewardType === 4) return `Voucher ${r.rewardName?.voucherValue ? (+r.rewardName.voucherValue).toLocaleString('vi-VN') + 'đ' : ''}`.trim();
    return 'Phần thưởng';
  }).join(', ');
  const courseUrl = (m) => {
    if (m.pcUrl && m.pcUrl.includes('/edu/courseDetail/')) return m.pcUrl.split('#')[0];
    const id = COURSES[m.missionId];
    return id ? `https://banhang.shopee.vn/edu/courseDetail/${id}` : null;
  };

  // ---------- Khung giao diện dùng chung ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial}*{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    .fab{background:#ee4d2d;color:#fff;border:0;border-radius:24px;padding:10px 16px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
    .panel{position:fixed;right:16px;bottom:70px;width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 100px);background:#fff;color:#1f2937;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden}
    .panel.open{display:flex}
    header{background:#ee4d2d;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:8px}
    header b{flex:1}header button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}
    .body{overflow:auto;padding:8px 12px 12px}
    h4{margin:12px 4px 6px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.03em}
    .item{border:1px solid #eef0f4;border-radius:8px;padding:10px 12px;margin-bottom:8px}
    .item .n{font-weight:600;font-size:14px}.item .r{font-size:12.5px;color:#ee4d2d;margin-top:2px}
    .item .p{font-size:12px;color:#6b7280;margin-top:2px}
    .row{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
    .btn{padding:6px 12px;border-radius:6px;border:1px solid #ee4d2d;background:#ee4d2d;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
    .btn.alt{background:#fff;color:#ee4d2d}.btn:disabled{opacity:.5;cursor:default}
    .muted{font-size:12.5px;color:#6b7280;padding:4px}
    .done{color:#2e7d32;font-weight:600}
    .log{font-size:12.5px;line-height:1.5;padding:12px 16px;max-height:300px;overflow:auto}
  </style>
  <button class="fab"></button>
  <div class="panel"><header><b class="title"></b><button class="rf" title="Tải lại">⟳</button><button class="x" title="Đóng">×</button></header><div class="body"></div></div>`;
  const $ = (s) => root.querySelector(s);
  const panel = $('.panel');
  $('.fab').onclick = () => panel.classList.toggle('open');
  $('.x').onclick = () => panel.classList.remove('open');

  const learnerMatch = location.pathname.match(/^\/edu\/courseDetail\/(\d+)/);
  const autoKey = learnerMatch && `nvAuto:${learnerMatch[1]}`;
  if (learnerMatch && (location.hash.includes('nv-auto') || sessionStorage.getItem(autoKey))) {
    sessionStorage.setItem(autoKey, '1');
    runLearner(learnerMatch[1]);
  } else if (!location.pathname.startsWith('/edu/')) {
    initMissions();
    // Chỉ hiện nút "Nhiệm vụ" ở trang Nhiệm vụ Người Bán (/portal/seller-mission); trang khác thì ẩn.
    // Kênh Người Bán là SPA nên kiểm tra lại mỗi khi đổi URL.
    const onMissionPage = () => location.pathname.startsWith('/portal/seller-mission');
    let lastPath = '';
    const syncVisible = () => {
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      host.style.display = onMissionPage() ? '' : 'none';
      if (!onMissionPage()) panel.classList.remove('open');
    };
    syncVisible();
    setInterval(syncVisible, 800);
  } else {
    host.remove();
  }

  // ---------- Danh sách nhiệm vụ ----------
  function initMissions() {
    $('.fab').textContent = 'Nhiệm vụ';
    $('.title').textContent = 'Nhiệm Vụ Người Bán';
    $('.rf').onclick = load;
    $('.fab').addEventListener('click', () => { if (panel.classList.contains('open')) load(); });

    async function load() {
      const body = $('.body');
      body.innerHTML = '<div class="muted">Đang tải…</div>';
      try {
        const [ml, rl] = await Promise.all([
          post('/api/seller_mission_pc/v2/get_mission_list'),
          post('/api/seller_mission_pc/v2/get_reward_list'),
        ]);
        const todo = ml.data?.missions || [];
        const rewards = rl.data?.missions || [];
        const claimable = rewards.filter((m) => m.status === 2);
        const claimed = rewards.filter((m) => m.status === 3).slice(0, 5);
        body.innerHTML = '';
        section(body, 'Chờ nhận thưởng', claimable, (m, row) => {
          const b = btn(row, 'Nhận');
          b.onclick = async () => {
            b.disabled = true; b.textContent = 'Đang nhận…';
            const r = await post('/api/seller_mission_pc/v2/claim_mission', { missionId: m.missionId });
            b.textContent = r.data?.status === 3 ? 'Đã nhận ✓' : 'Lỗi, thử lại';
            if (r.data?.status !== 3) b.disabled = false; else setTimeout(load, 1200);
          };
        });
        section(body, 'Nhiệm vụ đang làm', todo, (m, row) => {
          const cu = courseUrl(m);
          if (cu) {
            const b = btn(row, 'Làm (tự đọc khóa học)');
            b.onclick = () => window.open(cu + '#nv-auto', '_blank');
          }
          const go = btn(row, cu ? 'Mở khóa học' : 'Mở trang làm', true);
          go.onclick = () => window.open(cu || m.pcUrl || 'https://banhang.shopee.vn/portal/seller-mission', '_blank');
        }, (m) => `Tiến độ ${m.currentValue ?? m.missionName?.currentValue ?? 0}/${m.progressBarTarget ?? m.missionName?.amount ?? 1}`
          + (courseUrl(m) ? '' : ' · cần bạn tự làm'));
        section(body, 'Đã nhận gần đây', claimed, null, (m) => {
          const end = m.rewards?.[0]?.rewardValidEndDate;
          return end ? `Hạn dùng ${new Date(end * 1000).toLocaleDateString('vi-VN')}` + (m.rewards[0].claimedRewardExpired ? ' (đã hết hạn)' : '') : '';
        });
      } catch (e) {
        body.innerHTML = `<div class="muted">Lỗi: ${e.message}. Hãy chắc chắn đang đăng nhập Kênh Người Bán.</div>`;
      }
    }
  }
  function section(body, title, list, actions, sub) {
    const h = document.createElement('h4');
    h.textContent = `${title} (${list.length})`;
    body.appendChild(h);
    if (!list.length) { const d = document.createElement('div'); d.className = 'muted'; d.textContent = 'Không có.'; body.appendChild(d); return; }
    for (const m of list) {
      const it = document.createElement('div');
      it.className = 'item';
      it.innerHTML = `<div class="n"></div><div class="r"></div><div class="p"></div><div class="row"></div>`;
      it.querySelector('.n').textContent = missionName(m);
      it.querySelector('.r').textContent = rewardText(m.rewards);
      it.querySelector('.p').textContent = sub ? sub(m) : '';
      if (actions) actions(m, it.querySelector('.row'));
      body.appendChild(it);
    }
  }
  function btn(row, text, alt) {
    const b = document.createElement('button');
    b.className = 'btn' + (alt ? ' alt' : '');
    b.textContent = text;
    row.appendChild(b);
    return b;
  }

  // ---------- Tự đọc khóa học ----------
  async function runLearner(courseId) {
    $('.fab').textContent = 'Đang học…';
    $('.title').textContent = 'Tự đọc khóa học';
    $('.rf').style.display = 'none';
    panel.classList.add('open');
    const body = $('.body');
    body.innerHTML = '<div class="log"></div><div class="row" style="padding:0 12px 12px"></div>';
    const logEl = body.querySelector('.log');
    const log = (t) => { const d = document.createElement('div'); d.textContent = t; logEl.appendChild(d); logEl.scrollTop = 1e9; };
    let stop = false;
    const stopBtn = btn(body.querySelector('.row'), 'Dừng', true);
    stopBtn.onclick = () => { stop = true; sessionStorage.removeItem(autoKey); log('Đã dừng.'); };

    const lessonLinks = () => [...document.querySelectorAll(`a[href*="courseDetail/${courseId}?lessonId="]`)]
      .filter((a) => !/lessonId=Quiz/i.test(a.href));
    const isDone = (a) => !!a.querySelector('svg,[class*=check]');
    const slowScroll = async (to) => {
      for (let y = scrollY; y <= to && !stop; y += 150) { window.scrollTo({ top: y, behavior: 'smooth' }); await sleep(600); }
    };
    async function readLesson() {
      await sleep(3000);
      const heads = [...document.querySelectorAll('.collapseItem > .header')];
      for (const h of heads) {
        if (stop) return;
        await slowScroll(h.getBoundingClientRect().top + scrollY - 200);
        h.click();
        await sleep(1500);
        await slowScroll(h.parentElement.getBoundingClientRect().bottom + scrollY - 300);
      }
      await slowScroll(document.body.scrollHeight);
      return heads.length;
    }

    for (let i = 0; i < 20 && !lessonLinks().length; i++) await sleep(500);
    const total = lessonLinks().length;
    log(`Khóa học có ${total} chuyên đề. Đọc chậm từng chuyên đề…`);
    for (let round = 1; round <= 3 && !stop; round++) {
      const todo = lessonLinks().filter((a) => !isDone(a)).map((a) => a.href);
      if (!todo.length) break;
      log(`Lượt ${round}: ${todo.length} chuyên đề chưa có ✓.`);
      for (const href of todo) {
        if (stop) break;
        const a = lessonLinks().find((x) => x.href === href);
        if (!a) continue;
        const title = a.innerText.trim().replace(/\s+/g, ' ');
        log(`• ${title}`);
        a.click();
        const n = await readLesson();
        log(`  đã đọc ${n} mục.`);
      }
      await sleep(3000);
    }
    if (stop) return;
    const missing = lessonLinks().filter((a) => !isDone(a));
    window.scrollTo({ top: 0 });
    if (missing.length) {
      log(`Còn ${missing.length} chuyên đề chưa có ✓: ${missing.map((a) => a.innerText.trim().split('\n').pop()).join('; ')}. Tải lại trang để chạy tiếp.`);
      return;
    }
    sessionStorage.removeItem(autoKey);
    log(`✓ Đã đủ dấu ✓ cho cả ${total} chuyên đề.`);
    const quiz = document.querySelector(`a[href*="courseDetail/${courseId}?lessonId=Quiz"]`)
      || [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.innerText?.trim() === 'Uni Quiz');
    const row = body.querySelector('.row');
    stopBtn.remove();
    if (quiz) {
      log('Khóa học có bài Quiz: bấm "Làm Quiz", trả lời theo nội dung bài học rồi bấm "Gửi khảo sát".');
      const q = btn(row, 'Làm Quiz');
      q.onclick = () => (quiz.closest('a') || quiz).click();
    }
    const back = btn(row, 'Về trang Nhiệm vụ để nhận thưởng', true);
    back.onclick = () => window.open('https://banhang.shopee.vn/portal/seller-mission', '_blank');
    $('.fab').textContent = 'Học xong ✓';
  }
})();
