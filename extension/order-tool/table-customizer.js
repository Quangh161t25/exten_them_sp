/**
 * Table Column Customizer for Shopee Order Tool & Wameli Tool
 * Hỗ trợ:
 * 1. Kéo trực tiếp ở tiêu đề cột (view ngoài bảng) để chỉnh kích thước (Column Resizing).
 * 2. Nhấp đúp vào vạch kéo để đưa cột về kích thước Tự động.
 * 3. Modal tuỳ chỉnh chi tiết: đổi thứ tự kéo thả / nút bấm, ẩn/hiện cột, căn lề, xuống dòng, đặt độ rộng px / tự động, ghim cố định sticky.
 */

const STORAGE_PREFIX = 'shopee_order_table_cols_v1_';

const tableDefaultColsRegistry = new Map();

export function getTableConfig(tableId, defaultCols) {
  try {
    if (Array.isArray(defaultCols) && defaultCols.length > 0) {
      tableDefaultColsRegistry.set(tableId, defaultCols);
    } else if (tableDefaultColsRegistry.has(tableId)) {
      defaultCols = tableDefaultColsRegistry.get(tableId);
    } else {
      defaultCols = defaultCols || [];
    }

    const raw = localStorage.getItem(STORAGE_PREFIX + tableId);
    if (!raw) return cloneDefaults(defaultCols);
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.length) return cloneDefaults(defaultCols);

    // Nếu không có defaultCols (ví dụ gọi từ attachColumnResizers), trả về saved giữ nguyên 100% cấu hình
    if (!defaultCols || !defaultCols.length) {
      return saved.map((s, idx) => ({
        id: s.id || `col_${idx}`,
        label: s.label || `Cột ${idx + 1}`,
        visible: s.visible !== false,
        align: s.align || 'left',
        wrap: !!s.wrap,
        width: s.width !== undefined ? Number(s.width) : 0,
        fixed: !!s.fixed,
        originalIndex: s.originalIndex !== undefined ? s.originalIndex : idx
      }));
    }

    const result = [];
    const usedDefIds = new Set();

    // 1. Giữ nguyên thứ tự cột đã được người dùng sắp xếp trong saved
    for (const s of saved) {
      let def = defaultCols.find(d => d.id === s.id);
      if (!def && s.label) {
        def = defaultCols.find(d => d.label && String(d.label).trim().toLowerCase() === String(s.label).trim().toLowerCase());
      }
      if (def && !usedDefIds.has(def.id)) {
        usedDefIds.add(def.id);
        result.push({
          ...def,
          ...s,
          id: def.id,
          originalIndex: def.originalIndex !== undefined ? def.originalIndex : s.originalIndex,
          label: def.label || s.label,
          visible: s.visible !== undefined ? s.visible : (def.visible ?? true),
          align: s.align || def.align || 'left',
          wrap: s.wrap !== undefined ? s.wrap : (def.wrap ?? false),
          width: Number(s.width) > 0 ? Number(s.width) : (def.width || def.defaultWidth || 0),
          fixed: s.fixed !== undefined ? s.fixed : (def.fixed ?? false)
        });
      } else if (!def && s.id) {
        result.push({
          ...s,
          visible: s.visible !== undefined ? s.visible : true,
          align: s.align || 'left',
          wrap: !!s.wrap,
          width: s.width !== undefined ? Number(s.width) : 0,
          fixed: !!s.fixed
        });
      }
    }

    // 2. Bổ sung các cột mặc định chưa có trong cấu hình đã lưu
    // Cột mới đặt ngay sau cột đứng trước nó trong danh sách mặc định (không dồn xuống cuối)
    defaultCols.forEach((def, i) => {
      if (usedDefIds.has(def.id)) return;
      const prevId = i > 0 ? defaultCols[i - 1].id : null;
      const at = prevId ? result.findIndex((c) => c.id === prevId) : -1;
      // Lấy độ rộng/căn lề mặc định: cột "Tự động" trong bảng table-layout: fixed bị co về 0px
      const col = cloneDefaults([def])[0];
      if (i === 0) result.unshift(col);
      else if (at >= 0) result.splice(at + 1, 0, col);
      else result.push(col);
      usedDefIds.add(def.id);
    });

    return result;
  } catch (e) {
    console.warn('Lỗi đọc cấu hình cột table:', e);
    return cloneDefaults(defaultCols || []);
  }
}

export function saveTableConfig(tableId, config) {
  try {
    localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(config));
  } catch (e) {
    console.warn('Lỗi lưu cấu hình cột table:', e);
  }
}

export function resetTableConfig(tableId, defaultCols) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + tableId);
  } catch (e) {}
  return cloneDefaults(defaultCols || []);
}

function cloneDefaults(defaultCols) {
  if (!Array.isArray(defaultCols)) return [];
  return defaultCols.map((c, i) => ({
    id: c.id || `col_${i}`,
    originalIndex: c.originalIndex !== undefined ? c.originalIndex : i,
    label: c.label || `Cột ${i + 1}`,
    visible: c.visible ?? true,
    align: c.align || c.defaultAlign || 'left',
    wrap: c.wrap ?? c.defaultWrap ?? false,
    width: c.width || c.defaultWidth || 0,
    fixed: c.fixed ?? c.defaultFixed ?? false
  }));
}

export function applyTableStyles(tableId, config, skipResizer = false) {
  let styleEl = document.getElementById(`custom-style-${tableId}`);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = `custom-style-${tableId}`;
    document.head.appendChild(styleEl);
  }

  const tableEl = document.getElementById(tableId);
  const rules = [];
  const activeCols = config.filter(c => c.visible !== false);
  let cumulativeLeft = 0;
  let lastFixedColId = null;

  // Thiết lập cấu trúc bảng chuẩn cố định kích thước, không bị co ép cột tự động
  rules.push(`#${tableId} { table-layout: fixed !important; min-width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; }`);

  for (const c of activeCols) {
    const sel = `#${tableId} [data-col="${c.id}"]`;
    const thSel = `#${tableId} th[data-col="${c.id}"]`;
    const tdSel = `#${tableId} td[data-col="${c.id}"]`;

    // 1. Căn lề
    if (c.align) {
      rules.push(`${sel} { text-align: ${c.align} !important; }`);
    }

    // 2. Xuống dòng (Nếu KHÔNG xuống dòng: ẩn overflow và hiện dấu ... để không bao giờ bị tràn đè lên cột bên cạnh)
    if (c.wrap) {
      rules.push(`${sel} { white-space: normal !important; word-break: break-word !important; overflow: visible !important; }`);
    } else {
      rules.push(`${sel} { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }`);
    }

    // 3. Kích thước (Độ rộng)
    const hasExplicitWidth = c.width && Number(c.width) > 0;
    if (hasExplicitWidth) {
      const w = Number(c.width);
      rules.push(`${sel} { width: ${w}px !important; min-width: ${w}px !important; max-width: ${w}px !important; }`);
    } else {
      // Cột tự động: min-width an toàn để không bị ép nhỏ hơn kích thước nội dung tối thiểu
      const minW = c.defaultWidth || 45;
      rules.push(`${sel} { width: auto !important; min-width: ${minW}px !important; max-width: none !important; }`);
    }

    // 4. Cố định cột (Sticky Left)
    if (c.fixed) {
      let fixedColWidth = hasExplicitWidth ? Number(c.width) : 0;
      if (fixedColWidth <= 0) {
        const thEl = tableEl ? tableEl.querySelector(`th[data-col="${c.id}"]`) : null;
        if (thEl) {
          fixedColWidth = Math.round(thEl.getBoundingClientRect().width);
        }
        if (!fixedColWidth || fixedColWidth <= 0) {
          fixedColWidth = c.defaultWidth || 60;
        }
        rules.push(`${sel} { width: ${fixedColWidth}px !important; min-width: ${fixedColWidth}px !important; max-width: ${fixedColWidth}px !important; }`);
      }

      const leftPx = cumulativeLeft;
      rules.push(`${thSel} { position: sticky !important; left: ${leftPx}px !important; z-index: 15 !important; background: #fafafa !important; }`);
      rules.push(`${tdSel} { position: sticky !important; left: ${leftPx}px !important; z-index: 5 !important; background: #ffffff !important; }`);
      rules.push(`#${tableId} tr:nth-child(even) ${tdSel} { background: #fdfdfd !important; }`);
      cumulativeLeft += fixedColWidth;
      lastFixedColId = c.id;
    }
  }

  if (lastFixedColId) {
    rules.push(`#${tableId} [data-col="${lastFixedColId}"] { border-right: 2px solid #cbd5e1 !important; box-shadow: 2px 0 5px rgba(0,0,0,0.06); }`);
  }

  const hiddenCols = config.filter(c => c.visible === false);
  for (const c of hiddenCols) {
    rules.push(`#${tableId} [data-col="${c.id}"] { display: none !important; }`);
  }

  styleEl.textContent = rules.join('\n');

  if (!skipResizer) {
    setTimeout(() => {
      attachColumnResizers(tableId);
    }, 20);
  }
}

/**
 * Kéo trực tiếp ở tiêu đề cột (view ngoài bảng) để chỉnh kích thước
 */
export function attachColumnResizers(tableId, onResizeEnd, storageKey) {
  const table = typeof tableId === 'string' ? document.getElementById(tableId) : tableId;
  if (!table) return;

  const thead = table.querySelector('thead');
  if (!thead) return;

  const domId = typeof tableId === 'string' ? tableId : table.id;
  const storeId = storageKey || domId;

  const ths = thead.querySelectorAll('th[data-col]');
  ths.forEach(th => {
    // Tránh gắn trùng lặp
    if (th.querySelector('.col-resizer')) return;

    // Bảo toàn position nếu cột đang sticky, ngược lại gán relative
    if (!th.style.position || th.style.position === 'static') {
      th.style.position = 'relative';
    }

    const resizer = document.createElement('div');
    resizer.className = 'col-resizer';
    resizer.title = 'Kéo chuột để thay đổi độ rộng cột (Nhấp đúp để đặt lại Tự động)';
    th.appendChild(resizer);

    // Nhấp đúp để đặt lại kích thước tự động
    resizer.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colId = th.getAttribute('data-col');
      if (!colId) return;
      const config = getTableConfig(storeId);
      const targetCol = config.find(c => c.id === colId);
      if (targetCol) {
        targetCol.width = 0; // Tự động
        saveTableConfig(storeId, config);
        applyTableStyles(domId, config, false);
        if (typeof onResizeEnd === 'function') onResizeEnd(config);
      }
    });

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const colId = th.getAttribute('data-col');
      if (!colId) return;

      const startX = e.clientX;
      const startWidth = th.getBoundingClientRect().width;
      let currentWidth = Math.round(startWidth);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      resizer.classList.add('is-resizing');

      // Tạo guideline màu xanh hiển thị đường kéo trực quan
      let guideLine = document.getElementById('table-resize-guideline');
      if (!guideLine) {
        guideLine = document.createElement('div');
        guideLine.id = 'table-resize-guideline';
        document.body.appendChild(guideLine);
      }
      guideLine.style.left = e.clientX + 'px';
      guideLine.style.display = 'block';

      let config = getTableConfig(storeId);
      if (!config || !config.length) {
        config = Array.from(ths).map((h, i) => ({
          id: h.getAttribute('data-col') || `col_${i}`,
          label: h.textContent.replace(/⚙️/g, '').trim(),
          visible: true,
          align: 'left',
          wrap: false,
          width: Math.round(h.getBoundingClientRect().width),
          fixed: false
        }));
      }

      let animFrameId = null;

      const onMouseMove = (moveEvent) => {
        const diffX = moveEvent.clientX - startX;
        currentWidth = Math.max(35, Math.round(startWidth + diffX));
        guideLine.style.left = moveEvent.clientX + 'px';

        // Cập nhật CSS mượt mà qua requestAnimationFrame và skipResizer = true
        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(() => {
          let targetCol = config.find(c => c.id === colId);
          if (targetCol) {
            targetCol.width = currentWidth;
          } else {
            targetCol = {
              id: colId,
              label: th.textContent.replace(/⚙️/g, '').trim(),
              visible: true,
              width: currentWidth
            };
            config.push(targetCol);
          }
          applyTableStyles(domId, config, true);
        });
      };

      const onMouseUp = () => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        resizer.classList.remove('is-resizing');
        if (guideLine) guideLine.style.display = 'none';

        let targetCol = config.find(c => c.id === colId);
        if (targetCol) {
          targetCol.width = currentWidth;
        }
        saveTableConfig(storeId, config);
        applyTableStyles(domId, config, false);

        if (typeof onResizeEnd === 'function') {
          onResizeEnd(config);
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

export function openColumnCustomizerModal({ tableId, storageKey, tableName, defaultCols, currentConfig, onSave }) {
  let modal = document.getElementById('tableColCustomizerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tableColCustomizerModal';
    document.body.appendChild(modal);
  }

  const domId = tableId;
  const storeId = storageKey || tableId;

  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(2px);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  `;

  let workingConfig = JSON.parse(JSON.stringify(currentConfig || getTableConfig(storeId, defaultCols)));
  let filterQuery = '';

  function renderList() {
    const listBody = modal.querySelector('#colConfigList');
    if (!listBody) return;

    const itemsToRender = workingConfig.map((col, idx) => ({ col, idx })).filter(({ col }) => {
      if (!filterQuery) return true;
      return (col.label || '').toLowerCase().includes(filterQuery.toLowerCase());
    });

    listBody.innerHTML = itemsToRender.map(({ col, idx }) => `
      <div class="col-item-row" data-idx="${idx}" draggable="true">
        <div class="col-drag-handle" title="Kéo thả để đổi thứ tự">⠿</div>
        
        <div class="col-move-btns">
          <button type="button" class="btn-move-up" data-idx="${idx}" title="Di chuyển lên" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="btn-move-down" data-idx="${idx}" title="Di chuyển xuống" ${idx === workingConfig.length - 1 ? 'disabled' : ''}>▼</button>
        </div>

        <label class="col-label-wrap" title="${col.label}">
          <input type="checkbox" class="col-vis-chk" data-idx="${idx}" ${col.visible !== false ? 'checked' : ''}>
          <span>${col.label}</span>
        </label>

        <!-- Căn lề dạng icon -->
        <div class="col-align-group" title="Căn lề cột">
          <button type="button" class="btn-align-icon ${col.align === 'left' ? 'active' : ''}" data-idx="${idx}" data-align="left" title="Căn trái">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="15" y2="12"></line><line x1="3" y1="18" x2="18" y2="18"></line></svg>
          </button>
          <button type="button" class="btn-align-icon ${col.align === 'center' ? 'active' : ''}" data-idx="${idx}" data-align="center" title="Căn giữa">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="6" y1="12" x2="18" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
          </button>
          <button type="button" class="btn-align-icon ${col.align === 'right' ? 'active' : ''}" data-idx="${idx}" data-align="right" title="Căn phải">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="9" y1="12" x2="21" y2="12"></line><line x1="6" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>

        <!-- Xuống dòng dạng icon -->
        <button type="button" class="btn-wrap-icon ${col.wrap ? 'active' : ''}" data-idx="${idx}" title="${col.wrap ? 'Xuống dòng: BẬT (Bấm để tắt)' : 'Xuống dòng: TẮT (Bấm để bật)'}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><path d="M3 12h15a3 3 0 1 1 0 6h-4"></path><polyline points="16 16 14 18 16 20"></polyline><line x1="3" y1="18" x2="10" y2="18"></line></svg>
        </button>

        <!-- Độ rộng px / Tự động -->
        <div class="col-width-box" title="Độ rộng cột: nhập số px hoặc để trống / gõ 0 để Tự động (nhấp đúp để đặt lại Tự động)">
          <input type="text" inputmode="numeric" class="col-width-input" data-idx="${idx}" value="${col.width && Number(col.width) > 0 ? col.width : ''}" placeholder="Tự động" title="Để trống hoặc gõ 0 để Tự động (nhấp đúp để xoá về Tự động)">
        </div>

        <!-- Cố định cột -->
        <label class="col-fixed-label" title="Cố định cột đứng yên bên trái khi cuộn ngang">
          <input type="checkbox" class="col-fixed-chk" data-idx="${idx}" ${col.fixed ? 'checked' : ''}>
          <span>📌 Ghim</span>
        </label>
      </div>
    `).join('');

    bindListEvents();
  }

  function bindListEvents() {
    const listBody = modal.querySelector('#colConfigList');
    if (!listBody) return;

    listBody.querySelectorAll('.col-vis-chk').forEach(chk => {
      chk.onchange = (e) => {
        const idx = Number(e.target.dataset.idx);
        workingConfig[idx].visible = e.target.checked;
      };
    });

    listBody.querySelectorAll('.btn-align-icon').forEach(btn => {
      btn.onclick = (e) => {
        const b = e.currentTarget;
        const idx = Number(b.dataset.idx);
        const align = b.dataset.align;
        workingConfig[idx].align = align;
        const group = b.closest('.col-align-group');
        if (group) {
          group.querySelectorAll('.btn-align-icon').forEach(item => {
            const isActive = item.dataset.align === align;
            if (isActive) item.classList.add('active');
            else item.classList.remove('active');
          });
        }
      };
    });

    listBody.querySelectorAll('.btn-wrap-icon').forEach(btn => {
      btn.onclick = (e) => {
        const b = e.currentTarget;
        const idx = Number(b.dataset.idx);
        const nextWrap = !workingConfig[idx].wrap;
        workingConfig[idx].wrap = nextWrap;
        b.title = nextWrap ? 'Xuống dòng: BẬT (Bấm để tắt)' : 'Xuống dòng: TẮT (Bấm để bật)';
        if (nextWrap) b.classList.add('active');
        else b.classList.remove('active');
      };
    });

    listBody.querySelectorAll('.col-width-input').forEach(inp => {
      inp.oninput = (e) => {
        const idx = Number(e.target.dataset.idx);
        const cleaned = e.target.value.replace(/[^0-9]/g, '');
        if (e.target.value !== cleaned) {
          e.target.value = cleaned;
        }
        const val = parseInt(cleaned, 10);
        workingConfig[idx].width = (!isNaN(val) && val > 0) ? val : 0;
      };

      inp.onblur = (e) => {
        const val = parseInt(e.target.value, 10);
        if (isNaN(val) || val <= 0) {
          e.target.value = '';
          const idx = Number(e.target.dataset.idx);
          workingConfig[idx].width = 0;
        }
      };

      inp.ondblclick = (e) => {
        e.target.value = '';
        const idx = Number(e.target.dataset.idx);
        workingConfig[idx].width = 0;
      };
    });

    listBody.querySelectorAll('.col-fixed-chk').forEach(chk => {
      chk.onchange = (e) => {
        const idx = Number(e.target.dataset.idx);
        workingConfig[idx].fixed = e.target.checked;
      };
    });

    listBody.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        if (idx > 0) {
          const item = workingConfig.splice(idx, 1)[0];
          workingConfig.splice(idx - 1, 0, item);
          renderList();
        }
      };
    });

    listBody.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        if (idx < workingConfig.length - 1) {
          const item = workingConfig.splice(idx, 1)[0];
          workingConfig.splice(idx + 1, 0, item);
          renderList();
        }
      };
    });

    let dragIdx = null;
    const rows = listBody.querySelectorAll('.col-item-row');
    rows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        dragIdx = Number(row.dataset.idx);
        row.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });

      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
        rows.forEach(r => (r.style.background = '#fff'));
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.style.background = '#e0f2fe';
      });

      row.addEventListener('dragleave', () => {
        row.style.background = '#fff';
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.style.background = '#fff';
        const targetIdx = Number(row.dataset.idx);
        if (dragIdx !== null && dragIdx !== targetIdx) {
          const movedItem = workingConfig.splice(dragIdx, 1)[0];
          workingConfig.splice(targetIdx, 0, movedItem);
          renderList();
        }
      });
    });
  }

  modal.innerHTML = `
    <style id="customizer-modal-isolated-style">
      #tableColCustomizerModal,
      #tableColCustomizerModal * {
        box-sizing: border-box !important;
      }
      #tableColCustomizerModal button {
        width: auto !important;
        min-height: 0 !important;
        height: auto !important;
        font-weight: 500 !important;
        line-height: 1 !important;
        color: inherit !important;
        background: transparent !important;
        border: 1px solid transparent !important;
        margin: 0 !important;
        padding: 0 !important;
        flex: 0 0 auto !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
      }
      #tableColCustomizerModal input[type="text"],
      #tableColCustomizerModal input[type="number"] {
        height: 26px !important;
        min-height: 26px !important;
        font-size: 11px !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 4px !important;
        padding: 2px 6px !important;
        background: #ffffff !important;
        color: #1e293b !important;
      }
      #tableColCustomizerModal .col-item-row {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 5px 10px !important;
        border-bottom: 1px solid #f1f5f9 !important;
        background: #ffffff !important;
        border-radius: 6px !important;
        margin-bottom: 4px !important;
        user-select: none !important;
        height: 38px !important;
        min-height: 38px !important;
        box-sizing: border-box !important;
      }
      #tableColCustomizerModal .col-drag-handle {
        flex: 0 0 16px !important;
        width: 16px !important;
        font-size: 16px !important;
        color: #94a3b8 !important;
        cursor: grab !important;
        text-align: center !important;
      }
      #tableColCustomizerModal .col-move-btns {
        display: flex !important;
        gap: 2px !important;
        flex: 0 0 auto !important;
      }
      #tableColCustomizerModal .btn-move-up,
      #tableColCustomizerModal .btn-move-down {
        flex: 0 0 20px !important;
        width: 20px !important;
        height: 22px !important;
        min-height: 22px !important;
        border: 1px solid #cbd5e1 !important;
        background: #ffffff !important;
        color: #475569 !important;
        font-size: 9px !important;
        border-radius: 4px !important;
        padding: 0 !important;
      }
      #tableColCustomizerModal .btn-move-up:disabled,
      #tableColCustomizerModal .btn-move-down:disabled {
        opacity: 0.3 !important;
        cursor: not-allowed !important;
      }
      #tableColCustomizerModal .col-label-wrap {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        flex: 1 1 140px !important;
        min-width: 100px !important;
        margin: 0 !important;
        font-weight: 600 !important;
        font-size: 12px !important;
        cursor: pointer !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      #tableColCustomizerModal .col-label-wrap input[type="checkbox"] {
        width: 14px !important;
        height: 14px !important;
        cursor: pointer !important;
        accent-color: #0284c7 !important;
        margin: 0 !important;
        flex: 0 0 14px !important;
      }
      #tableColCustomizerModal .col-label-wrap span {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        color: #1e293b !important;
      }
      #tableColCustomizerModal .col-align-group {
        display: inline-flex !important;
        flex: 0 0 auto !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        overflow: hidden !important;
        background: #f8fafc !important;
        height: 24px !important;
      }
      #tableColCustomizerModal .btn-align-icon {
        flex: 0 0 25px !important;
        width: 25px !important;
        height: 22px !important;
        min-height: 22px !important;
        max-height: 22px !important;
        padding: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        cursor: pointer !important;
      }
      #tableColCustomizerModal .btn-align-icon.active {
        background: #0284c7 !important;
        color: #ffffff !important;
      }
      #tableColCustomizerModal .btn-align-icon:not(.active) {
        background: transparent !important;
        color: #64748b !important;
      }
      #tableColCustomizerModal .btn-align-icon[data-align="center"] {
        border-left: 1px solid #cbd5e1 !important;
        border-right: 1px solid #cbd5e1 !important;
      }
      #tableColCustomizerModal .btn-wrap-icon {
        flex: 0 0 26px !important;
        width: 26px !important;
        height: 24px !important;
        min-height: 24px !important;
        max-height: 24px !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        padding: 0 !important;
        cursor: pointer !important;
      }
      #tableColCustomizerModal .btn-wrap-icon.active {
        background: #0284c7 !important;
        border-color: #0284c7 !important;
        color: #ffffff !important;
      }
      #tableColCustomizerModal .btn-wrap-icon:not(.active) {
        background: #f8fafc !important;
        border-color: #cbd5e1 !important;
        color: #64748b !important;
      }
      #tableColCustomizerModal .col-list-header {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 7px 10px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        color: #64748b !important;
        letter-spacing: 0.3px !important;
        background: #f1f5f9 !important;
        border: 1px solid #e2e8f0 !important;
        border-bottom: 1px solid #cbd5e1 !important;
        border-radius: 8px 8px 0 0 !important;
        box-sizing: border-box !important;
      }
      #tableColCustomizerModal .hdr-col-name {
        flex: 1 1 140px !important;
        min-width: 100px !important;
        text-align: left !important;
        padding-left: 54px !important;
      }
      #tableColCustomizerModal .hdr-col-align {
        width: 80px !important;
        flex: 0 0 80px !important;
        text-align: center !important;
      }
      #tableColCustomizerModal .hdr-col-wrap {
        width: 26px !important;
        flex: 0 0 26px !important;
        text-align: center !important;
      }
      #tableColCustomizerModal .hdr-col-width {
        width: 86px !important;
        flex: 0 0 86px !important;
        text-align: center !important;
      }
      #tableColCustomizerModal .hdr-col-fixed {
        width: 68px !important;
        flex: 0 0 68px !important;
        text-align: center !important;
      }
      #tableColCustomizerModal .col-width-box {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 86px !important;
        flex: 0 0 86px !important;
      }
      #tableColCustomizerModal .col-width-input {
        width: 82px !important;
        height: 25px !important;
        min-height: 25px !important;
        max-height: 25px !important;
        font-size: 11.5px !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        padding: 2px 6px !important;
        text-align: center !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #0f172a !important;
        outline: none !important;
        transition: all 0.15s ease !important;
      }
      #tableColCustomizerModal .col-width-input:focus {
        border-color: #0284c7 !important;
        box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15) !important;
        text-align: center !important;
      }
      #tableColCustomizerModal .col-width-input::placeholder {
        color: #64748b !important;
        font-size: 11.5px !important;
        font-weight: 500 !important;
        opacity: 0.85 !important;
        text-align: center !important;
      }
      #tableColCustomizerModal .col-fixed-label {
        display: inline-flex !important;
        align-items: center !important;
        gap: 3px !important;
        margin: 0 !important;
        font-size: 11px !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        color: #475569 !important;
        flex: 0 0 auto !important;
      }
      #tableColCustomizerModal .col-fixed-label input[type="checkbox"] {
        width: 13px !important;
        height: 13px !important;
        cursor: pointer !important;
        accent-color: #0284c7 !important;
        margin: 0 !important;
      }
      #tableColCustomizerModal .btn-header-tool {
        height: 26px !important;
        min-height: 26px !important;
        padding: 4px 8px !important;
        font-size: 11px !important;
        border: 1px solid #cbd5e1 !important;
        background: #f8fafc !important;
        color: #334155 !important;
        border-radius: 4px !important;
        cursor: pointer !important;
      }
      #tableColCustomizerModal .btn-header-reset {
        height: 26px !important;
        min-height: 26px !important;
        padding: 4px 8px !important;
        font-size: 11px !important;
        border: 1px solid #fca5a5 !important;
        background: #fff1f2 !important;
        color: #b91c1c !important;
        border-radius: 4px !important;
        cursor: pointer !important;
      }
      #tableColCustomizerModal .btn-modal-cancel {
        height: 32px !important;
        min-height: 32px !important;
        padding: 6px 14px !important;
        font-size: 12px !important;
        border: 1px solid #cbd5e1 !important;
        background: #ffffff !important;
        color: #334155 !important;
        border-radius: 6px !important;
        cursor: pointer !important;
      }
      #tableColCustomizerModal .btn-modal-save {
        height: 32px !important;
        min-height: 32px !important;
        padding: 6px 16px !important;
        font-size: 12px !important;
        border: none !important;
        background: #0284c7 !important;
        color: #ffffff !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-weight: 700 !important;
        box-shadow: 0 1px 3px rgba(2, 132, 199, 0.4) !important;
      }
    </style>

    <div style="width:min(760px, 96vw);max-height:88vh;display:flex;flex-direction:column;padding:16px;background:#fff;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,0.3);box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:10px;">
        <div>
          <h3 style="margin:0;font-size:15px;color:#0f172a;display:flex;align-items:center;gap:6px;font-weight:700;">
            <span>⚙️</span> Tuỳ chỉnh chi tiết các cột — <span style="color:#0284c7;">${tableName || tableId}</span>
          </h3>
          <p style="margin:3px 0 0;font-size:11px;color:#64748b;">
            Kéo thả ⠿ hoặc ấn ▲▼ đổi vị trí, bật/tắt hiển thị, căn lề, xuống dòng, kích thước &amp; cố định ghim cột.
          </p>
        </div>
        <button id="btnColConfigCloseX" type="button" style="border:none;background:none;font-size:16px;color:#64748b;cursor:pointer;padding:4px 8px;border-radius:4px;line-height:1;">✕</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;gap:6px;align-items:center;">
          <button id="btnColCheckAll" class="btn-header-tool" type="button">Hiện tất cả</button>
          <button id="btnColUncheckAll" class="btn-header-tool" type="button">Bỏ chọn hết</button>
          <button id="btnColAutoWidth" class="btn-header-tool" type="button" title="Đặt độ rộng tất cả các cột về Tự động">Rộng: Tự động</button>
          <button id="btnColResetDefault" class="btn-header-reset" type="button">Khôi phục mặc định</button>
        </div>
        <input type="text" id="colSearchInput" placeholder="Tìm tên cột..." style="width:130px;box-sizing:border-box;">
      </div>

      <!-- Header danh sách cột -->
      <div class="col-list-header">
        <span class="hdr-col-name">TÊN CỘT</span>
        <span class="hdr-col-align">CĂN LỀ</span>
        <span class="hdr-col-wrap" title="Xuống dòng">DÒNG</span>
        <span class="hdr-col-width">RỘNG (PX)</span>
        <span class="hdr-col-fixed">CỐ ĐỊNH</span>
      </div>

      <div id="colConfigList" style="flex:1;overflow-y:auto;max-height:50vh;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:6px;background:#f8fafc;"></div>

      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:10px;">
        <span style="font-size:11px;color:#64748b;">Tổng: <b>${workingConfig.length}</b> cột</span>
        <div style="display:flex;gap:8px;">
          <button id="btnColConfigCancel" class="btn-modal-cancel" type="button">Huỷ</button>
          <button id="btnColConfigSave" class="btn-modal-save" type="button">💾 Lưu &amp; Áp dụng</button>
        </div>
      </div>
    </div>
  `;

  renderList();
  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };
  modal.querySelector('#btnColConfigCloseX').onclick = close;
  modal.querySelector('#btnColConfigCancel').onclick = close;

  const searchInput = modal.querySelector('#colSearchInput');
  if (searchInput) {
    searchInput.oninput = (e) => {
      filterQuery = e.target.value.trim();
      renderList();
    };
  }

  modal.querySelector('#btnColCheckAll').onclick = () => {
    workingConfig.forEach(c => (c.visible = true));
    renderList();
  };

  modal.querySelector('#btnColUncheckAll').onclick = () => {
    workingConfig.forEach(c => (c.visible = false));
    renderList();
  };

  modal.querySelector('#btnColAutoWidth').onclick = () => {
    workingConfig.forEach(c => (c.width = 0));
    renderList();
  };

  modal.querySelector('#btnColResetDefault').onclick = () => {
    if (confirm('Khôi phục toàn bộ cột về trạng thái mặc định ban đầu?')) {
      workingConfig = resetTableConfig(storeId, defaultCols);
      renderList();
    }
  };

  modal.querySelector('#btnColConfigSave').onclick = () => {
    saveTableConfig(storeId, workingConfig);
    applyTableStyles(domId, workingConfig);
    close();
    if (typeof onSave === 'function') {
      onSave(workingConfig);
    }
  };
}

export function tagAndReorderDOM(tableId, config, onResizeEnd, storageKey) {
  const table = typeof tableId === 'string' ? document.getElementById(tableId) : tableId;
  if (!table) return;

  const theadTr = table.querySelector('thead tr');
  if (theadTr) {
    config.forEach(c => {
      const th = theadTr.querySelector(`:scope > [data-col="${c.id}"]`);
      if (th) theadTr.appendChild(th);
    });
    theadTr.querySelectorAll(':scope > th.th-settings-gear, :scope > th:not([data-col])').forEach(th => theadTr.appendChild(th));
  }

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr');
  rows.forEach(tr => {
    const tds = Array.from(tr.querySelectorAll(':scope > td'));
    if (!tds.length) return;
    if (tds.length === 1 && tds[0].hasAttribute('colspan')) return;

    if (!tds[0].hasAttribute('data-col')) {
      config.forEach((c, idx) => {
        if (tds[idx]) tds[idx].setAttribute('data-col', c.id);
      });
    }

    config.forEach(c => {
      const td = tr.querySelector(`:scope > [data-col="${c.id}"]`);
      if (td) tr.appendChild(td);
    });
    tr.querySelectorAll(':scope > td:not([data-col])').forEach(td => tr.appendChild(td));
  });

  attachColumnResizers(tableId, onResizeEnd, storageKey);
}

// Gắn vào window để hỗ trợ mọi script
if (typeof window !== 'undefined') {
  window.TableCustomizer = {
    getTableConfig,
    saveTableConfig,
    resetTableConfig,
    applyTableStyles,
    attachColumnResizers,
    openColumnCustomizerModal,
    tagAndReorderDOM
  };
}
