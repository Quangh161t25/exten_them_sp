// Table Tools — tự gắn cho MỌI bảng có <thead> trên trang:
//  1) Sắp xếp theo cột: bấm tiêu đề → tăng ▲ → giảm ▼ → bỏ ⇅ (số, tiền, ngày dd/mm/yyyy, chữ tiếng Việt).
//  2) Kéo giãn độ rộng cột: kéo mép phải ô tiêu đề; nhớ độ rộng theo từng bảng (localStorage).
// Bảng tự có sắp xếp riêng: đặt data-tt-nosort trên <table> hoặc có th[data-colsort] → chỉ gắn kéo giãn.
// Bỏ hẳn 1 bảng: data-tt-off. Bỏ 1 cột: th[data-tt-skip].
// Dòng có ít ô hơn tiêu đề (do rowspan) hoặc dòng .dh-subrow được coi là thuộc dòng phía trên khi sắp xếp.
(() => {
  if (typeof window === 'undefined' || window.__tableTools) return;
  window.__tableTools = true;

  const WKEY = 'tt_widths';
  const loadW = () => { try { return JSON.parse(localStorage.getItem(WKEY) || '{}'); } catch (e) { return {}; } };
  const saveW = (o) => { try { localStorage.setItem(WKEY, JSON.stringify(o)); } catch (e) { /* bỏ qua */ } };

  const css = document.createElement('style');
  css.textContent = `
    th.tt-th{position:relative}
    th.tt-sortable{cursor:pointer;user-select:none}
    th.tt-sortable:hover{background-image:linear-gradient(rgba(79,70,229,.06),rgba(79,70,229,.06))}
    .tt-arrow{display:inline-block;margin-left:3px;font-size:10px;color:#94a3b8;font-weight:400;vertical-align:middle}
    th.tt-on .tt-arrow{color:#ee4d2d;font-weight:700}
    .tt-rz{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:3}
    .tt-rz:hover,.tt-rz.tt-drag{background:rgba(79,70,229,.35)}
    body.tt-resizing,body.tt-resizing *{cursor:col-resize!important;user-select:none!important}`;
  (document.head || document.documentElement).appendChild(css);

  const headerRow = (t) => (t.tHead && t.tHead.rows.length ? t.tHead.rows[t.tHead.rows.length - 1] : null);
  const span = (row) => [...row.cells].reduce((a, c) => a + (c.colSpan || 1), 0);
  const sig = (t, hr) => (t.id ? '#' + t.id : '') + '|' + location.pathname + '|' + [...hr.cells].map((c) => (c.textContent || '').trim().slice(0, 20)).join('¦');
  // Bảng đã tự sắp xếp (sắp trên toàn bộ dữ liệu, không chỉ trang đang xem) → giữ cách cũ, chỉ thêm kéo giãn
  const hasOwnSort = (t) => t.hasAttribute('data-tt-nosort') || !!(t.tHead && t.tHead.querySelector('[data-colsort],[data-sort]'));

  // ---------- Giá trị để so sánh ----------
  function valueOf(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s || s === '—' || s === '-') return { e: true };
    const d = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
    if (d) return { n: new Date(+d[3], d[2] - 1, +d[1], +(d[4] || 0), +(d[5] || 0)).getTime() };
    const numPart = s.replace(/[₫đ%xX×]|VND|vnđ/gi, '').trim();
    if (/^[-+]?[\d.,\s]+$/.test(numPart) && /\d/.test(numPart)) {
      let t = numPart.replace(/\s/g, '');
      if (/^[-+]?\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
      else t = t.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
      const n = Number(t);
      if (Number.isFinite(n)) return { n };
    }
    const lead = s.match(/^[-+]?\d[\d.,]*/); // "2000 Hà Nội: 1000" → 2000
    if (lead && /^\d/.test(s) && s.length > lead[0].length) {
      const n = Number(lead[0].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
      if (Number.isFinite(n)) return { n, s };
    }
    return { s: s.toLowerCase() };
  }
  function cmp(a, b) {
    if (a.e && b.e) return 0;
    if (a.e) return 1; // ô trống luôn xuống cuối
    if (b.e) return -1;
    if (a.n != null && b.n != null) return a.n - b.n;
    if (a.n != null) return -1;
    if (b.n != null) return 1;
    return a.s.localeCompare(b.s, 'vi', { numeric: true });
  }

  // ---------- Sắp xếp ----------
  let seq = 0;
  function groupsOf(tbody, headSpan) {
    const groups = [];
    for (const r of tbody.rows) {
      if (r.__ttIdx == null) r.__ttIdx = ++seq; // thứ tự gốc để "bỏ sắp xếp"
      const cont = groups.length && (r.classList.contains('dh-subrow') || span(r) < Math.max(2, headSpan - 1));
      if (cont) groups[groups.length - 1].push(r); else groups.push([r]);
    }
    return groups;
  }
  function cellAt(row, colIdx) {
    let pos = 0;
    for (const c of row.cells) { if (pos === colIdx) return c; pos += c.colSpan || 1; if (pos > colIdx) return c; }
    return null;
  }
  function applySort(t) {
    const st = t.__ttSort;
    const hr = headerRow(t);
    const tb = t.tBodies[0];
    if (!hr || !tb || tb.rows.length < 2) return;
    const groups = groupsOf(tb, span(hr));
    let sorted;
    if (!st) {
      sorted = groups.slice().sort((a, b) => a[0].__ttIdx - b[0].__ttIdx);
    } else {
      const dir = st.dir === 'desc' ? -1 : 1;
      const keyed = groups.map((g) => ({ g, v: valueOf(cellAt(g[0], st.col)?.innerText) }));
      keyed.sort((x, y) => { const r = cmp(x.v, y.v); return r === 0 ? x.g[0].__ttIdx - y.g[0].__ttIdx : (x.v.e || y.v.e ? r : r * dir); });
      sorted = keyed.map((k) => k.g);
    }
    const flat = sorted.flat();
    const cur = [...tb.rows];
    if (flat.every((r, i) => r === cur[i])) return; // đã đúng thứ tự
    t.__ttBusy = true;
    const frag = document.createDocumentFragment();
    flat.forEach((r) => frag.appendChild(r));
    tb.appendChild(frag);
    setTimeout(() => { t.__ttBusy = false; }, 0);
  }
  function paintArrows(t) {
    const hr = headerRow(t);
    if (!hr) return;
    let pos = 0;
    for (const th of hr.cells) {
      const a = th.querySelector(':scope > .tt-arrow');
      const on = t.__ttSort && t.__ttSort.col === pos;
      th.classList.toggle('tt-on', !!on);
      if (a) a.textContent = on ? (t.__ttSort.dir === 'desc' ? '▼' : '▲') : '⇅';
      pos += th.colSpan || 1;
    }
  }

  // ---------- Kéo giãn ----------
  function setWidth(th, w) {
    th.style.width = w + 'px';
    th.style.minWidth = w + 'px';
    th.style.maxWidth = w + 'px';
  }
  function startResize(e, t, th, key, idx) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startW = th.getBoundingClientRect().width;
    const bar = e.currentTarget;
    bar.classList.add('tt-drag');
    document.body.classList.add('tt-resizing');
    const move = (ev) => setWidth(th, Math.max(36, Math.round(startW + ev.clientX - startX)));
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      bar.classList.remove('tt-drag');
      document.body.classList.remove('tt-resizing');
      const all = loadW();
      all[key] = all[key] || {};
      all[key][idx] = Math.round(th.getBoundingClientRect().width);
      saveW(all);
      th.__ttJustResized = Date.now();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  // ---------- Gắn vào bảng ----------
  function enhance(t) {
    if (t.hasAttribute('data-tt-off')) return;
    const hr = headerRow(t);
    if (!hr || !hr.cells.length) return;
    const key = sig(t, hr);
    const saved = loadW()[key] || {};
    const sortable = !hasOwnSort(t);
    [...hr.cells].forEach((th, idx) => {
      if (th.__tt === key) return; // đã gắn cho đúng tiêu đề này
      th.__tt = key;
      th.classList.add('tt-th');
      if (getComputedStyle(th).position === 'static') th.style.position = 'relative';
      if (saved[idx]) setWidth(th, saved[idx]);
      if (!th.querySelector(':scope > .tt-rz')) {
        const rz = document.createElement('span');
        rz.className = 'tt-rz';
        rz.title = 'Kéo để đổi độ rộng cột · nhấp đúp để bỏ';
        rz.addEventListener('mousedown', (e) => startResize(e, t, th, key, idx));
        rz.addEventListener('click', (e) => e.stopPropagation());
        rz.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          th.style.width = th.style.minWidth = th.style.maxWidth = '';
          const all = loadW();
          if (all[key]) { delete all[key][idx]; saveW(all); }
        });
        th.appendChild(rz);
      }
      const label = (th.textContent || '').trim();
      const hasCtl = th.querySelector('input,select,textarea');
      if (!sortable || th.hasAttribute('data-tt-skip') || !label || hasCtl) return;
      if (!th.querySelector(':scope > .tt-arrow')) {
        const a = document.createElement('span');
        a.className = 'tt-arrow';
        a.textContent = '⇅';
        th.insertBefore(a, th.querySelector(':scope > .tt-rz'));
      }
      th.classList.add('tt-sortable');
      th.title = th.title || 'Bấm để sắp xếp tăng / giảm';
      if (!th.__ttClick) {
        th.__ttClick = true;
        th.addEventListener('click', (e) => {
          if (e.target.closest('input,button,select,a,.tt-rz')) return;
          if (th.__ttJustResized && Date.now() - th.__ttJustResized < 300) return;
          let col = 0;
          for (const c of headerRow(t).cells) { if (c === th) break; col += c.colSpan || 1; }
          const cur = t.__ttSort;
          t.__ttSort = !cur || cur.col !== col ? { col, dir: 'asc' } : cur.dir === 'asc' ? { col, dir: 'desc' } : null;
          paintArrows(t);
          applySort(t);
        });
      }
    });
    if (sortable) paintArrows(t);
  }

  let timer = null;
  function scan() {
    timer = null;
    document.querySelectorAll('table').forEach((t) => {
      try {
        enhance(t);
        if (t.__ttSort && !t.__ttBusy) applySort(t); // bảng vẽ lại → sắp xếp lại theo cột đang chọn
      } catch (e) { /* bỏ qua bảng lỗi */ }
    });
  }
  const schedule = () => { if (!timer) timer = setTimeout(scan, 250); };
  const start = () => {
    scan();
    new MutationObserver((muts) => {
      if (muts.every((m) => m.target.closest && m.target.closest('table') && m.target.closest('table').__ttBusy)) return;
      schedule();
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
