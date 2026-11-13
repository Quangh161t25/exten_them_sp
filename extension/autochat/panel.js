// Auto Chat: giao diện trong side panel (tab "Auto Chat" nhúng iframe này).
// Bật/tắt chế độ chạy ngầm, xem danh sách khách chờ, nhật ký tin đã gửi và cài đặt.
/* global AUTOCHAT */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  document.getElementById('btn-sheet-sync')?.addEventListener('click', async () => {
    const btn=$('btn-sheet-sync'), label=$('sheet-sync-status');btn.disabled=true;label.textContent='Đang đồng bộ…';
    try {const res=await chrome.runtime.sendMessage({type:'autochat-sync-sheet'});label.textContent=res?.ok?`${res.customers} khách · ${res.pending} hội thoại đang tải · ${res.indexDone?'Đã quét hết danh sách':'Đang quét danh sách'}${res.error?' · '+res.error:''}`:(res?.error || 'Không đồng bộ được');}
    catch(e){label.textContent=e.message;}finally{btn.disabled=false;}
  });
  let currentTab = 'waiting';

  const MODE_HINTS = {
    off: 'Đang TẮT: không quét, không gửi gì.',
    watch: 'Chỉ quét và lập danh sách khách chờ, KHÔNG gửi tin nào.',
    auto: 'Khách là người nhắn cuối → tự gửi câu chào / câu nhắn tiếp qua API.'
  };

  async function loadSettings() {
    const s = await AUTOCHAT.getSettings();
    $('s-text').value = s.greetText;
    $('s-follow').value = s.followText;
    $('s-fdelay').value = s.followDelaySec;
    $('s-fgap').value = s.followGapMin;
    $('s-age').value = s.greetMaxAgeMin;
    $('s-max').value = s.maxPerHour;
    if ($('s-poll')) $('s-poll').value = s.pollSec || 30;
    if ($('s-backlog')) $('s-backlog').checked = s.replyBacklog !== false;
  }

  async function saveSettings() {
    const cur = await AUTOCHAT.getSettings();
    const num = (id, def, min) => {
      const v = parseInt($(id).value, 10);
      return Number.isFinite(v) && v >= min ? v : def;
    };
    await AUTOCHAT.saveSettings({
      greetText: $('s-text').value.trim() || cur.greetText,
      followText: $('s-follow').value.trim() || cur.followText,
      followDelaySec: num('s-fdelay', cur.followDelaySec, 0),
      followGapMin: num('s-fgap', cur.followGapMin, 1),
      greetMaxAgeMin: num('s-age', cur.greetMaxAgeMin, 5),
      maxPerHour: num('s-max', cur.maxPerHour, 1),
      pollSec: $('s-poll') ? num('s-poll', cur.pollSec || 30, 30) : (cur.pollSec || 30),
      replyBacklog: $('s-backlog') ? $('s-backlog').checked : true
    });
  }

  function card(e) {
    const waiting = e.status === 'waiting';
    const msgs = (e.msgs && e.msgs.length ? e.msgs : [{ text: e.lastText }])
      .slice(-4)
      .map((m) => `<div class="msg">${AUTOCHAT.esc(m.text)}</div>`)
      .join('');
    const since = waiting
      ? 'chờ ' + AUTOCHAT.timeAgo(e.firstAt)
      : (e.doneReason === 'manual' ? 'đánh dấu xong ' : 'đã trả lời ') + AUTOCHAT.timeAgo(e.doneAt) + ' trước';
    const id = AUTOCHAT.esc(e.convId);
    return `
      <div class="card ${waiting ? 'u-' + AUTOCHAT.urgency(e.firstAt) : 'is-done'}">
        <div class="card-top"><b>${AUTOCHAT.esc(e.name)}</b><span>${AUTOCHAT.esc(since)}</span></div>
        ${msgs}
        <div class="card-foot">
          ${AUTOCHAT.greetTags(e, 'tag')}
          <span class="grow"></span>
          ${waiting && e.lastIsBuyer ? `<button class="btn" style="background:#16a34a;border-color:#16a34a;color:#fff;" data-act="send-now" data-id="${id}">⚡ Gửi ngay</button>` : ''}
          <button class="btn" data-act="open" data-id="${id}">💬 Mở chat</button>
          ${waiting && e.greet && e.greet.error ? `<button class="btn ghost" data-act="retry" data-id="${id}">🔄 Thử gửi lại</button>` : ''}
          ${waiting
            ? `<button class="btn ghost" data-act="done" data-id="${id}">✔ Xong</button>`
            : `<button class="btn ghost" data-act="reopen" data-id="${id}">↩ Chờ lại</button>`}
        </div>
      </div>`;
  }

  function logRow(l) {
    const kind = l.kind === 'follow' ? 'Nhắn tiếp' : 'Chào';
    return `
      <div class="log ${l.ok ? 'ok' : 'fail'}">
        <div class="log-top">
          <span>${AUTOCHAT.hhmm(l.at)}</span>
          <b>${AUTOCHAT.esc(l.name)}</b>
          <span class="tag ${l.ok ? 'ok' : 'warn'}">${l.ok ? '✅ ' + kind : '⚠️ ' + kind + ' lỗi'}</span>
        </div>
        <div class="log-text">${AUTOCHAT.esc(l.ok ? l.text : l.error)}</div>
      </div>`;
  }

  async function render() {
    const [q, meta, s, session, log] = await Promise.all([
      AUTOCHAT.getQueue(), AUTOCHAT.getMeta(), AUTOCHAT.getSettings(), AUTOCHAT.getSession(), AUTOCHAT.getLog()
    ]);
    const syncInfo=await chrome.storage.local.get(['autochat_sheet_meta','autochat_sheet_error']);
    const syncMeta=syncInfo.autochat_sheet_meta;
    if ($('sheet-sync-status') && !$('btn-sheet-sync').disabled) $('sheet-sync-status').textContent=syncInfo.autochat_sheet_error || (syncMeta ? `${syncMeta.code} · ${syncMeta.customers} khách · ${syncMeta.indexDone?'Đã quét hết danh sách':'Đang quét danh sách'} · ${syncMeta.pending} hội thoại đang tải${syncMeta.error?' · '+syncMeta.error:''}` : 'Chỉ đọc, đồng bộ mỗi phút; không bật chế độ gửi tin.');
    const waiting = s.mode === 'off' ? [] : AUTOCHAT.waitingList(q);
    const done = Object.values(q).filter((e) => e.status === 'done').sort((a, b) => b.doneAt - a.doneAt);
    const today = new Date().setHours(0, 0, 0, 0);

    // Thẻ trạng thái
    $('hero').dataset.mode = s.mode;
    document.querySelectorAll('#modes [data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === s.mode));
    $('mode-hint').textContent = MODE_HINTS[s.mode];
    $('st-session').textContent = session
      ? '✅ ' + (session.shopName || 'Đã có') + ' · ' + AUTOCHAT.timeAgo(session.at) + ' trước'
      : '❌ Chưa có: mở Kênh Người Bán 1 lần';
    $('st-poll').textContent = s.mode === 'off' ? '—' : meta.lastPollAt ? new Date(meta.lastPollAt).toLocaleTimeString('vi-VN') : 'đang chờ lượt đầu…';
    $('st-waiting').textContent = waiting.length;
    $('st-sent').textContent = log.filter((l) => l.ok && l.at >= today).length;
    const hasErr = s.mode !== 'off' && meta.lastError;
    $('st-error').hidden = !hasErr;
    if (hasErr) {
      $('st-error').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
          <span>${AUTOCHAT.esc(meta.lastError)}</span>
          <button id="btn-renew-session" style="padding:3px 8px;font-size:11px;font-weight:700;border:1px solid #dc2626;border-radius:4px;background:#fff;color:#dc2626;cursor:pointer;white-space:nowrap;">🔄 Lấy lại phiên ngay</button>
          <a href="https://banhang.shopee.vn/new-webchat/conversations" target="_blank" rel="noopener" style="padding:3px 8px;font-size:11px;font-weight:700;border:1px solid #ee4d2d;border-radius:4px;background:#fff;color:#ee4d2d;text-decoration:none;white-space:nowrap;">💬 Mở Webchat</a>
        </div>`;
      const renewBtn = $('btn-renew-session');
      if (renewBtn) {
        renewBtn.onclick = () => {
          renewBtn.disabled = true;
          renewBtn.textContent = '⏳ Đang làm mới...';
          chrome.runtime.sendMessage({ type: 'autochat-refresh-session' }, () => {
            setTimeout(render, 1500);
          });
        };
      }
    } else {
      $('st-error').textContent = '';
    }

    $('n-waiting').textContent = waiting.length;
    $('n-done').textContent = done.length;

    $('settings').hidden = currentTab !== 'settings';
    $('list').hidden = currentTab === 'settings';
    if (currentTab === 'settings') return;
    if (currentTab === 'log') {
      $('list').innerHTML = log.length ? log.slice(0, 100).map(logRow).join('') : '<div class="empty">Chưa gửi tin nào.</div>';
      return;
    }
    const items = currentTab === 'waiting' ? waiting : done;
    $('list').innerHTML = items.length
      ? items.map(card).join('')
      : `<div class="empty">${currentTab === 'waiting' ? (s.mode === 'off' ? 'Auto Chat đang tắt.' : '🎉 Không có khách nào đang chờ.') : 'Chưa có hội thoại nào xong.'}</div>`;
  }

  $('modes').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-mode]');
    if (b) AUTOCHAT.saveSettings({ mode: b.dataset.mode });
  });

  $('btn-save').addEventListener('click', async () => {
    await saveSettings();
    $('btn-save').textContent = '✅ Đã lưu';
    setTimeout(() => ($('btn-save').textContent = '💾 Lưu cài đặt'), 1500);
  });

  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      currentTab = t.dataset.tab;
      if (currentTab === 'settings') loadSettings();
      render();
    })
  );

  $('list').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const q = await AUTOCHAT.getQueue();
    const e = q[btn.dataset.id];
    if (!e) return;
    if (btn.dataset.act === 'send-now') {
      btn.disabled = true;
      btn.textContent = '⏳ Đang gửi...';
      chrome.runtime.sendMessage({ type: 'autochat-send-now', convId: e.convId }, (res) => {
        btn.disabled = false;
        btn.textContent = '⚡ Gửi ngay';
        if (!res || !res.ok) {
          alert('Chưa gửi được: ' + (res?.error || 'Phiên hết hạn hoặc lỗi mạng'));
        }
        render();
      });
    } else if (btn.dataset.act === 'open') {
      chrome.runtime.sendMessage({ type: 'autochat-open-conv', convId: e.convId });
    } else if (btn.dataset.act === 'retry') {
      if (e.greet) {
        delete e.greet.error;
        delete e.greet.failMsgId;
        e.greet.tries = 0;
      }
      await AUTOCHAT.saveQueue(q);
      chrome.runtime.sendMessage({ type: 'autochat-tick-now' });
    } else if (btn.dataset.act === 'done') {
      Object.assign(e, { status: 'done', doneAt: Date.now(), doneReason: 'manual' });
      await AUTOCHAT.saveQueue(q);
    } else if (btn.dataset.act === 'reopen') {
      Object.assign(e, { status: 'waiting', doneAt: 0, doneReason: '' });
      await AUTOCHAT.saveQueue(q);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (Object.values(AUTOCHAT.K).some((k) => changes[k])) render();
  });

  render();
  setInterval(render, 30000); // cập nhật "chờ X phút"
})();
